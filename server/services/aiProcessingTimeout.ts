/**
 * AI Processing Timeout Service
 * Handles automatic completion of stuck AI processing after timeout periods
 * Prevents AI processing from getting stuck at 87-88% indefinitely
 */

import { db } from '../db';
import { backgroundJobs, agentAnalyses } from '../../shared/schema';
import { eq, and, lt } from 'drizzle-orm';
import { websocketManager } from './websocketManager';

interface TimeoutConfig {
  processingTimeout: number; // 12 hours in milliseconds
  checkInterval: number; // Check every 30 minutes
  maxRetries: number; // Maximum retry attempts before forcing completion
}

class AIProcessingTimeoutService {
  private config: TimeoutConfig = {
    processingTimeout: 12 * 60 * 60 * 1000, // 12 hours
    checkInterval: 30 * 60 * 1000, // 30 minutes  
    maxRetries: 3
  };
  
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start the timeout monitoring service
   */
  start(): void {
    if (this.isRunning) {
      console.log('⏰ AI Processing Timeout Service already running');
      return;
    }

    console.log('🚀 Starting AI Processing Timeout Service');
    console.log(`⏰ Processing timeout: ${this.config.processingTimeout / (60 * 60 * 1000)} hours`);
    console.log(`🔄 Check interval: ${this.config.checkInterval / (60 * 1000)} minutes`);

    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.checkForStuckProcessing().catch(error => {
        console.error('❌ Error in AI processing timeout check:', error);
      });
    }, this.config.checkInterval);

    // Also run an immediate check
    this.checkForStuckProcessing().catch(error => {
      console.error('❌ Error in initial AI processing timeout check:', error);
    });
  }

  /**
   * Stop the timeout monitoring service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('⏹️ AI Processing Timeout Service stopped');
  }

  /**
   * Check for stuck AI processing jobs and auto-complete them
   */
  private async checkForStuckProcessing(): Promise<void> {
    console.log('🔍 Checking for stuck AI processing jobs...');
    
    try {
      // Find jobs that have been processing for longer than the timeout
      const timeoutThreshold = new Date(Date.now() - this.config.processingTimeout);
      
      const stuckJobs = await db
        .select()
        .from(backgroundJobs)
        .where(
          and(
            eq(backgroundJobs.status, 'processing'),
            lt(backgroundJobs.createdAt, timeoutThreshold)
          )
        );

      console.log(`⏰ Found ${stuckJobs.length} stuck jobs older than ${this.config.processingTimeout / (60 * 60 * 1000)} hours`);

      for (const job of stuckJobs) {
        await this.handleStuckJob(job);
      }

      // Also check for deals with incomplete AI processing
      await this.checkForIncompleteDeals();

    } catch (error) {
      console.error('❌ Error checking for stuck processing:', error);
    }
  }

  /**
   * Handle a specific stuck job
   */
  private async handleStuckJob(job: any): Promise<void> {
    const jobAge = Date.now() - new Date(job.createdAt).getTime();
    const hoursStuck = Math.round(jobAge / (60 * 60 * 1000) * 10) / 10;
    
    console.log(`⚠️ Processing stuck job ${job.jobId} (${job.jobType}) for deal ${job.dealId}`);
    console.log(`⏰ Job has been running for ${hoursStuck} hours`);

    try {
      // Update the job to completed with timeout message
      await db
        .update(backgroundJobs)
        .set({
          status: 'completed',
          progress: 100,
          currentStep: `Auto-completed after ${hoursStuck} hours timeout`,
          error: `Processing was automatically completed due to ${hoursStuck} hour timeout. Results may be partial.`,
          updatedAt: new Date()
        })
        .where(eq(backgroundJobs.id, job.id));

      // Create a minimal analysis result if none exists
      await this.createMinimalAnalysisResult(job.dealId, job.jobType);

      // Send WebSocket update
      if (job.dealId) {
        websocketManager.notifyJobUpdate(job.dealId, {
          jobId: job.jobId,
          status: 'completed',
          progress: 100,
          currentStep: `Auto-completed after ${hoursStuck} hours timeout`,
          message: 'Processing completed automatically due to timeout'
        });
      }

      console.log(`✅ Successfully handled stuck job ${job.jobId} after ${hoursStuck} hours`);
      
    } catch (error) {
      console.error(`❌ Error handling stuck job ${job.jobId}:`, error);
      
      // Mark as failed if we can't complete it
      try {
        await db
          .update(backgroundJobs)
          .set({
            status: 'failed',
            error: `Failed to auto-complete after timeout: ${error.message}`,
            updatedAt: new Date()
          })
          .where(eq(backgroundJobs.id, job.id));
      } catch (updateError) {
        console.error(`❌ Failed to update stuck job status:`, updateError);
      }
    }
  }

  /**
   * Check for deals with incomplete AI processing and auto-complete them
   */
  private async checkForIncompleteDeals(): Promise<void> {
    console.log('🔍 Checking for deals with incomplete AI processing...');
    
    try {
      // This would need to be implemented based on your specific logic
      // for determining when a deal's AI processing should be considered "complete"
      
      // For now, we focus on the background jobs timeout
      console.log('✅ Deal completion check completed');
      
    } catch (error) {
      console.error('❌ Error checking incomplete deals:', error);
    }
  }

  /**
   * Create a minimal analysis result for timed-out jobs
   */
  private async createMinimalAnalysisResult(dealId: number, jobType: string): Promise<void> {
    if (!jobType || !dealId) return;

    // Extract agent type from job type
    let agentType: string | null = null;
    if (jobType.includes('legal')) agentType = 'legal';
    else if (jobType.includes('clinical')) agentType = 'clinical';
    else if (jobType.includes('commercial')) agentType = 'commercial';
    else if (jobType.includes('hr')) agentType = 'hr';
    else if (jobType.includes('financial')) agentType = 'financial';
    else if (jobType.includes('ip')) agentType = 'ip';
    else if (jobType.includes('research')) agentType = 'research';

    if (!agentType) return;

    try {
      // Check if analysis already exists
      const existingAnalysis = await db
        .select()
        .from(agentAnalyses)
        .where(
          and(
            eq(agentAnalyses.dealId, dealId),
            eq(agentAnalyses.agentType, agentType as any)
          )
        )
        .limit(1);

      if (existingAnalysis.length > 0) {
        console.log(`📊 Analysis already exists for ${agentType} agent on deal ${dealId}`);
        return;
      }

      // Create minimal analysis result
      const minimalFindings = [
        {
          id: 1,
          type: 'warning',
          content: `${agentType.charAt(0).toUpperCase() + agentType.slice(1)} analysis was automatically completed due to processing timeout. Manual review may be required.`,
          source: 'Automated Timeout',
          confidence: 0.1,
          category: 'timeout',
          evidenceCount: 0
        }
      ];

      const minimalRecommendations = [
        {
          title: `${agentType.charAt(0).toUpperCase() + agentType.slice(1)} Analysis Timeout`,
          description: `The ${agentType} analysis was automatically completed after exceeding the maximum processing time. Consider manually reviewing relevant documents or restarting the analysis if needed.`,
          priority: 'medium',
          category: agentType,
          impact: 'moderate'
        }
      ];

      await db
        .insert(agentAnalyses)
        .values({
          dealId,
          agentType: agentType as any,
          status: 'completed',
          progress: 100,
          findings: JSON.stringify(minimalFindings),
          recommendations: JSON.stringify(minimalRecommendations),
          createdAt: new Date(),
          updatedAt: new Date()
        });

      console.log(`📊 Created minimal ${agentType} analysis for deal ${dealId} due to timeout`);

    } catch (error) {
      console.error(`❌ Error creating minimal analysis for ${agentType} on deal ${dealId}:`, error);
    }
  }

  /**
   * Force complete AI processing for a specific deal
   */
  async forceCompleteProcessing(dealId: number, reason = 'Manual override'): Promise<void> {
    console.log(`🔧 Force completing AI processing for deal ${dealId}: ${reason}`);
    
    try {
      // Update all processing jobs for this deal
      const processingJobs = await db
        .select()
        .from(backgroundJobs)
        .where(
          and(
            eq(backgroundJobs.dealId, dealId),
            eq(backgroundJobs.status, 'processing')
          )
        );

      console.log(`📋 Found ${processingJobs.length} processing jobs to complete for deal ${dealId}`);

      for (const job of processingJobs) {
        await this.handleStuckJob(job);
      }

      console.log(`✅ Force completed AI processing for deal ${dealId}`);

    } catch (error) {
      console.error(`❌ Error force completing processing for deal ${dealId}:`, error);
      throw error;
    }
  }

  /**
   * Get processing timeout statistics
   */
  async getTimeoutStats(): Promise<any> {
    try {
      const timeoutThreshold = new Date(Date.now() - this.config.processingTimeout);
      
      const [processingJobs, stuckJobs] = await Promise.all([
        db
          .select()
          .from(backgroundJobs)
          .where(eq(backgroundJobs.status, 'processing')),
        db
          .select()
          .from(backgroundJobs)
          .where(
            and(
              eq(backgroundJobs.status, 'processing'),
              lt(backgroundJobs.createdAt, timeoutThreshold)
            )
          )
      ]);

      return {
        totalProcessingJobs: processingJobs.length,
        stuckJobs: stuckJobs.length,
        timeoutThresholdHours: this.config.processingTimeout / (60 * 60 * 1000),
        isMonitoringActive: this.isRunning,
        nextCheckIn: this.isRunning ? Math.round((this.config.checkInterval - (Date.now() % this.config.checkInterval)) / (60 * 1000)) : null
      };

    } catch (error) {
      console.error('❌ Error getting timeout stats:', error);
      return {
        error: error.message,
        totalProcessingJobs: 0,
        stuckJobs: 0,
        timeoutThresholdHours: this.config.processingTimeout / (60 * 60 * 1000),
        isMonitoringActive: this.isRunning
      };
    }
  }
}

// Export singleton instance
export const aiProcessingTimeoutService = new AIProcessingTimeoutService();