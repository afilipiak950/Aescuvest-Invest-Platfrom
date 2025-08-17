/**
 * Persistent Financial Analysis Service
 * Matches Clinical architecture exactly for consistent behavior
 */

import { v4 as uuidv4 } from 'uuid';
import { storage } from '../storage';
import { comprehensiveFinancialAnalysisService } from '../comprehensiveFinancialAnalysisService';

interface JobData {
  dealId: number;
  agentType: string;
  status: string;
  progress: number;
  totalDocuments: number;
  processedDocuments: number;
  startTime: Date;
  lastUpdate?: Date;
  currentDocumentName?: string;
}

export class PersistentFinancialAnalysisService {
  private activeJobs = new Map<string, JobData>();
  private jobIntervals = new Map<string, NodeJS.Timeout>();

  async startFinancialAnalysis(dealId: number): Promise<string> {
    const jobId = `financial-analysis-${dealId}`;
    
    console.log(`💰 Starting FRESH persistent financial analysis for deal ${dealId}`);

    // ALWAYS delete existing job to force fresh start - EXACT Clinical behavior
    const existingJob = await storage.getBackgroundJobById(jobId);
    if (existingJob) {
      console.log(`🧹 FORCE DELETING existing job for deal ${dealId} with status ${existingJob.status} to start fresh...`);
      await storage.deleteBackgroundJob(jobId);
      
      // Also clear from memory if running
      if (this.activeJobs.has(jobId)) {
        this.activeJobs.delete(jobId);
      }
      
      const interval = this.jobIntervals.get(jobId);
      if (interval) {
        clearInterval(interval);
        this.jobIntervals.delete(jobId);
      }
    }

    // Create new background job record - EXACTLY like Clinical
    await storage.createBackgroundJob({
      jobId,
      jobType: 'comprehensive_financial_analysis',
      dealId,
      agentType: 'financial',
      status: 'processing',
      progress: 0,
      totalDocuments: 0,
      processedDocuments: 0,
      currentStep: 'Initializing financial analysis...',
      startedAt: new Date()
    });

    // Start the analysis in the background
    this.runFinancialAnalysisInBackground(dealId, jobId);

    return jobId;
  }

  async stopFinancialAnalysis(dealId: number): Promise<boolean> {
    const jobId = `financial-analysis-${dealId}`;
    
    console.log(`🛑 Stopping financial analysis job ${jobId} for deal ${dealId}`);

    try {
      // Remove from active jobs
      this.activeJobs.delete(jobId);
      
      // Clear any intervals
      const interval = this.jobIntervals.get(jobId);
      if (interval) {
        clearInterval(interval);
        this.jobIntervals.delete(jobId);
      }

      // Update database to stopped status
      await storage.failBackgroundJob(jobId, 'Stopped by user');

      console.log(`✅ Successfully stopped financial analysis job ${jobId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error stopping financial analysis job ${jobId}:`, error);
      return false;
    }
  }

  private async runFinancialAnalysisInBackground(dealId: number, jobId: string): Promise<void> {
    try {
      console.log(`🚀 Running financial analysis in background for deal ${dealId}, job ${jobId}`);
      
      // Start the analysis process using Clinical's exact pattern
      await this.processFinancialAnalysis(dealId, jobId);

    } catch (error) {
      console.error(`❌ Financial analysis failed for deal ${dealId}:`, error);
      await storage.failBackgroundJob(jobId, error instanceof Error ? error.message : 'Unknown error');
      this.activeJobs.delete(jobId);
      
      const interval = this.jobIntervals.get(jobId);
      if (interval) {
        clearInterval(interval);
        this.jobIntervals.delete(jobId);
      }
    }
  }

  /**
   * Process financial analysis with persistent state tracking - EXACTLY like Clinical
   */
  private async processFinancialAnalysis(dealId: number, jobId: string, startProgress: number = 0): Promise<void> {
    try {
      // Track job in memory for real-time updates - EXACTLY like Clinical
      const jobState: JobData = {
        dealId,
        agentType: 'financial',
        status: 'processing',
        progress: startProgress,
        totalDocuments: 0,
        processedDocuments: 0,
        startTime: new Date(),
        lastUpdate: new Date()
      };

      this.activeJobs.set(jobId, jobState);

      // Remove this duplicate interval setup - it's already done in processFinancialAnalysis

      // Delegate to comprehensive financial analysis service but with persistence - EXACTLY like Clinical
      console.log(`💰 Delegating to comprehensive financial analysis service...`);
      
      // Set up progress monitoring interval - EXACTLY like Clinical
      const progressInterval = setInterval(async () => {
        await this.broadcastProgress(jobId, jobState);
      }, 2000);

      this.jobIntervals.set(jobId, progressInterval);

      // Hook into the existing service but with persistent tracking - EXACTLY like Clinical
      await this.runPersistentFinancialAnalysis(dealId, jobId, jobState);

    } catch (error) {
      console.error(`❌ Financial analysis failed for deal ${dealId}:`, error);
      
      // Clean up - EXACTLY like Clinical
      const interval = this.jobIntervals.get(jobId);
      if (interval) {
        clearInterval(interval);
        this.jobIntervals.delete(jobId);
      }
      this.activeJobs.delete(jobId);
      
      await storage.updateBackgroundJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date()
      });
    }
  }

  /**
   * Run the actual analysis with persistent state updates - EXACT COPY of Clinical's runPersistentAnalysis
   */
  private async runPersistentFinancialAnalysis(dealId: number, jobId: string, jobState: JobData): Promise<void> {
    try {
      // Update job state
      const currentStep = 'Running comprehensive financial analysis...';
      await this.updateJobProgress(jobId, jobState.progress, currentStep);

      // Call the existing comprehensive financial analysis service
      const result = await comprehensiveFinancialAnalysisService.runComprehensiveAnalysis(dealId, storage, jobId);

      // Mark as completed
      jobState.progress = 100;
      const completedStep = 'Financial analysis completed';
      
      await storage.updateBackgroundJob(jobId, {
        status: 'completed',
        progress: 100,
        currentStep: completedStep,
        completedAt: new Date(),
        updatedAt: new Date()
      });

      // CRITICAL FIX: Delay cleanup to ensure frontend sees completed job
      console.log(`✅ Financial analysis completed for deal ${dealId} - Delaying cleanup for 10 seconds`);
      
      setTimeout(() => {
        // Clean up after delay to ensure frontend sees the completed job
        const interval = this.jobIntervals.get(jobId);
        if (interval) {
          clearInterval(interval);
          this.jobIntervals.delete(jobId);
        }
        this.activeJobs.delete(jobId);
        console.log(`🧹 Delayed cleanup completed for job ${jobId}`);
      }, 10000); // 10 second delay

    } catch (error) {
      console.error(`❌ Persistent financial analysis failed:`, error);
      throw error;
    }
  }

  /**
   * Update job progress in database and memory - EXACT COPY of Clinical
   */
  private async updateJobProgress(jobId: string, progress: number, currentStep: string): Promise<void> {
    try {
      // Update database
      await storage.updateBackgroundJob(jobId, {
        progress,
        currentStep,
        updatedAt: new Date()
      });

      // Update memory
      const jobState = this.activeJobs.get(jobId);
      if (jobState) {
        jobState.progress = progress;
        jobState.currentDocumentName = currentStep;
        jobState.lastUpdate = new Date();
      }

    } catch (error) {
      console.error(`❌ Failed to update job progress for ${jobId}:`, error);
    }
  }

  /**
   * Broadcast progress via WebSocket - EXACT COPY of Clinical
   */
  private async broadcastProgress(jobId: string, jobState: JobData): Promise<void> {
    try {
      // Get current progress from database (the source of truth)
      const currentJob = await storage.getBackgroundJobById(jobId);
      if (currentJob && this.activeJobs.has(jobId)) {
        const jobData = this.activeJobs.get(jobId);
        if (jobData) {
          jobData.lastUpdate = new Date();
          
          // Use REAL progress from database, not our stale memory
          const realProgress = currentJob.progress || 0;
          const realCurrentStep = currentJob.currentStep || '';
          const realCurrentDocumentName = currentJob.currentDocumentName || '';
          const realProcessedDocuments = currentJob.processedDocuments || 0;
          const realTotalDocuments = currentJob.totalDocuments || 0;
          
          // Update our memory with real values from comprehensive service
          jobData.progress = realProgress;
          jobData.processedDocuments = realProcessedDocuments;
          jobData.totalDocuments = realTotalDocuments;
          jobData.currentDocumentName = realCurrentDocumentName;

          console.log(`📊 Financial monitoring progress: ${realProgress}% (${realProcessedDocuments}/${realTotalDocuments}) - ${realCurrentStep} - ${realCurrentDocumentName}`);
        }
      }

      // Check if job is completed or failed
      if (currentJob?.status === 'completed' || currentJob?.status === 'failed') {
        console.log(`✅ Financial analysis job ${jobId} finished with status: ${currentJob.status}`);
        const interval = this.jobIntervals.get(jobId);
        if (interval) {
          clearInterval(interval);
          this.jobIntervals.delete(jobId);
        }
        this.activeJobs.delete(jobId);
      }

    } catch (error) {
      console.error(`❌ Error broadcasting financial progress:`, error);
    }
  }

  // Removed duplicate monitorJobProgress method - using broadcastProgress for consistency with Clinical

  private async completeJob(jobId: string, results: any): Promise<void> {
    try {
      // Mark as completed in database
      await storage.completeBackgroundJob(jobId, results);

      // Remove from active tracking
      this.activeJobs.delete(jobId);
      
      // Clear any intervals
      const interval = this.jobIntervals.get(jobId);
      if (interval) {
        clearInterval(interval);
        this.jobIntervals.delete(jobId);
      }

      console.log(`✅ Completed financial background job ${jobId}`);
    } catch (error) {
      console.error(`❌ Failed to complete financial job ${jobId}:`, error);
    }
  }

  async getJobStatus(dealId: number): Promise<any> {
    const jobId = `financial-analysis-${dealId}`;
    
    // Get from database
    const dbJob = await storage.getBackgroundJobById(jobId);
    
    // Get from memory
    const memoryJob = this.activeJobs.get(jobId);
    
    if (dbJob) {
      return {
        jobId,
        dealId,
        agentType: 'financial',
        status: dbJob.status,
        progress: dbJob.progress || 0,
        totalDocuments: dbJob.totalDocuments || 0,
        processedDocuments: dbJob.processedDocuments || 0,
        currentDocumentName: dbJob.currentDocumentName || '',
        currentStep: dbJob.currentStep || '',
        startedAt: dbJob.startedAt,
        updatedAt: dbJob.updatedAt || dbJob.startedAt,
        isActive: memoryJob ? true : false
      };
    }
    
    return null;
  }

  getActiveJobs(): Map<string, JobData> {
    return this.activeJobs;
  }

  async initialize(): Promise<void> {
    try {
      console.log('💰 Initializing Persistent Financial Analysis Service...');
      
      // Find all incomplete financial analysis jobs by checking each known deal
      const knownDealIds = [33, 30, 29, 28, 27, 18]; // Add more deal IDs as needed
      const financialJobs = [];
      
      for (const dealId of knownDealIds) {
        try {
          const dealJobs = await storage.getBackgroundJobsByDealId(dealId);
          const financialJobsForDeal = dealJobs.filter(job => 
            job.agentType === 'financial' && 
            job.jobType === 'comprehensive_financial_analysis' &&
            (job.status === 'processing' || job.status === 'completed')
          );
          
          // For each job, check if it's really complete
          for (const job of financialJobsForDeal) {
            const existingAnalysis = await storage.getAgentAnalysis(dealId, 'financial');
            
            if (!existingAnalysis || !existingAnalysis.findings || existingAnalysis.findings.length === 0) {
              console.log(`🔄 Job ${job.jobId} marked complete but no findings. Adding to resume list.`);
              financialJobs.push(job);
            }
          }
        } catch (error) {
          console.log(`Skipping deal ${dealId} during financial initialization`);
        }
      }

      console.log(`🔄 Found ${financialJobs.length} incomplete financial analysis jobs`);

      for (const job of financialJobs) {
        await this.resumeFinancialAnalysis(job.dealId, job.jobId);
      }

      console.log('✅ Persistent Financial Analysis Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Persistent Financial Analysis Service:', error);
    }
  }

  private async resumeFinancialAnalysis(dealId: number, jobId: string): Promise<void> {
    try {
      console.log(`🔄 Resuming financial analysis for deal ${dealId}, job ${jobId}`);
      
      // Check if job exists and is incomplete
      const job = await storage.getBackgroundJobById(jobId);
      if (!job || job.status === 'completed') {
        console.log(`Job ${jobId} already completed, skipping resume`);
        return;
      }

      // Start monitoring and processing
      this.runFinancialAnalysisInBackground(dealId, jobId);
      
    } catch (error) {
      console.error(`❌ Failed to resume financial analysis ${jobId}:`, error);
    }
  }
}

// Export singleton instance
export const persistentFinancialAnalysisService = new PersistentFinancialAnalysisService();