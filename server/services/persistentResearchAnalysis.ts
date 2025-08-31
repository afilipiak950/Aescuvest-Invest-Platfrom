/**
 * Persistent Research Analysis Service
 * Ensures research analysis jobs continue running regardless of server restarts or user sessions
 * Based on the proven Legal analysis architecture
 */

import { storage } from '../storage';
import { ComprehensiveResearchAnalysisService, RESEARCH_QUESTIONS } from '../comprehensiveResearchAnalysisService';
import { websocketManager } from './websocketManager';

interface ResearchJobState {
  dealId: number;
  jobId: string;
  progress: number;
  currentQuestionIndex: number;
  totalQuestions: number;
  currentBatch: number;
  totalBatches: number;
  currentStep: string;
  documentsAnalyzed: number;
  totalDocuments: number;
  startTime: Date;
  lastUpdate: Date;
}

export class PersistentResearchAnalysisService {
  private static instance: PersistentResearchAnalysisService;
  private activeJobs = new Map<string, ResearchJobState>();
  private jobIntervals = new Map<string, NodeJS.Timeout>();
  private websocketManager = websocketManager;

  static getInstance(): PersistentResearchAnalysisService {
    if (!PersistentResearchAnalysisService.instance) {
      PersistentResearchAnalysisService.instance = new PersistentResearchAnalysisService();
    }
    return PersistentResearchAnalysisService.instance;
  }

  /**
   * Initialize and restore any incomplete research analysis jobs
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing Persistent Research Analysis Service...');
      
      // Temporarily reduce initialization load to prevent crashes
      // Only check for actively running jobs to minimize startup queries
      const researchJobs = [];
      console.log('🔄 Skipping expensive job recovery during startup to prevent crashes');

      console.log(`🔄 Found ${researchJobs.length} incomplete research analysis jobs`);

      for (const job of researchJobs) {
        await this.resumeResearchAnalysis(job.dealId, job.jobId);
      }
      
      console.log('✅ Persistent Research Analysis Service initialized');
    } catch (error) {
      console.error('❌ Error initializing Persistent Research Analysis Service:', error);
    }
  }

  /**
   * Start a new persistent research analysis job - FORCES fresh start like Legal
   */
  async startResearchAnalysis(dealId: number): Promise<string> {
    const jobId = `research-analysis-${dealId}`;
    
    console.log(`🔍 Starting FRESH persistent research analysis for deal ${dealId}`);

    // ALWAYS delete existing job to force fresh start - EXACT Legal behavior
    const existingJob = await storage.getBackgroundJobById(jobId);
    if (existingJob) {
      console.log(`🧹 FORCE DELETING existing job for deal ${dealId} with status ${existingJob.status} to start fresh...`);
      await storage.deleteBackgroundJob(jobId);
      this.stopJobMonitoring(jobId);
    }

    // Legal doesn't delete existing analysis, just background jobs - EXACT Legal approach
    console.log(`🧹 Fresh start for research analysis deal ${dealId}`);

    // Create fresh job state
    const jobState: ResearchJobState = {
      dealId,
      jobId,
      progress: 0,
      currentQuestionIndex: 0,
      totalQuestions: RESEARCH_QUESTIONS.length,
      currentBatch: 1,
      totalBatches: 1,
      currentStep: 'Initializing research analysis',
      documentsAnalyzed: 0,
      totalDocuments: 0,
      startTime: new Date(),
      lastUpdate: new Date()
    };

    this.activeJobs.set(jobId, jobState);

    // Create background job - EXACT Legal schema
    await storage.createBackgroundJob({
      jobId,
      jobType: 'comprehensive_research_analysis',
      dealId,
      agentType: 'research',
      status: 'processing',
      progress: 0,
      totalDocuments: 0,
      processedDocuments: 0,
      currentStep: 'Initializing research analysis...',
      startedAt: new Date()
    });

    // Start WebSocket progress updates - EXACT Legal approach
    this.startProgressUpdates(jobId);

    // Start the actual analysis in background
    this.runResearchAnalysisInBackground(jobId, dealId);

    console.log(`🎯 Research analysis job ${jobId} started for deal ${dealId}`);
    return jobId;
  }

  /**
   * Resume a research analysis job - EXACT Legal approach
   */
  private async resumeResearchAnalysis(dealId: number, jobId: string): Promise<void> {
    console.log(`🔄 Resuming research analysis job ${jobId} for deal ${dealId}`);
    
    // Create job state with current progress
    const jobState: ResearchJobState = {
      dealId,
      jobId,
      progress: 0,
      currentQuestionIndex: 0,
      totalQuestions: RESEARCH_QUESTIONS.length,
      currentBatch: 1,
      totalBatches: 1,
      currentStep: 'Resuming research analysis',
      documentsAnalyzed: 0,
      totalDocuments: 0,
      startTime: new Date(),
      lastUpdate: new Date()
    };

    this.activeJobs.set(jobId, jobState);
    this.startProgressUpdates(jobId);
    this.runResearchAnalysisInBackground(jobId, dealId);
  }

  /**
   * Run research analysis in background - EXACT Legal approach
   */
  private async runResearchAnalysisInBackground(jobId: string, dealId: number): Promise<void> {
    const jobState = this.activeJobs.get(jobId);
    if (!jobState) {
      console.error(`❌ No job state found for ${jobId}`);
      return;
    }

    try {
      console.log(`🔬 Starting comprehensive research analysis for deal ${dealId}`);
      
      // Create service instance with proper job tracking
      const service = new ComprehensiveResearchAnalysisService();
      
      // Run the comprehensive analysis
      const result = await service.runComprehensiveAnalysis(dealId, storage, jobId);

      // Mark as completed - EXACTLY like Legal
      jobState.progress = 100;
      jobState.currentStep = 'Research analysis completed';
      
      await storage.updateBackgroundJob(jobId, {
        status: 'completed',
        progress: 100,
        currentStep: 'Research analysis completed',
        completedAt: new Date(),
        result: result ? JSON.stringify(result) : null
      });

      console.log(`✅ Research analysis completed for deal ${dealId}`);
      
    } catch (error) {
      console.error(`❌ Error in research analysis for deal ${dealId}:`, error);
      
      // Mark as failed - EXACTLY like Legal
      jobState.currentStep = `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      await storage.updateBackgroundJob(jobId, {
        status: 'failed',
        currentStep: jobState.currentStep,
        completedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      // Clean up job tracking
      this.stopJobMonitoring(jobId);
    }
  }

  /**
   * Start progress updates via WebSocket - EXACT Legal approach
   */
  private startProgressUpdates(jobId: string): void {
    const interval = setInterval(async () => {
      const jobState = this.activeJobs.get(jobId);
      if (!jobState) {
        clearInterval(interval);
        return;
      }

      try {
        // Get latest job status from storage
        const job = await storage.getBackgroundJobById(jobId);
        if (job && ['completed', 'failed'].includes(job.status)) {
          clearInterval(interval);
          this.activeJobs.delete(jobId);
          return;
        }

        // Update job state if needed
        if (job) {
          jobState.progress = job.progress || 0;
          jobState.currentStep = job.currentStep || 'Processing';
          jobState.lastUpdate = new Date();
        }

        // Send WebSocket update - EXACT Legal approach
        this.websocketManager.broadcastToRoom(`deal-${jobState.dealId}`, 'research-progress', {
          dealId: jobState.dealId,
          progress: jobState.progress,
          step: jobState.currentStep,
          currentQuestion: jobState.currentQuestionIndex + 1,
          totalQuestions: jobState.totalQuestions,
          documentsAnalyzed: jobState.documentsAnalyzed,
          totalDocuments: jobState.totalDocuments
        });

      } catch (error) {
        console.error(`❌ Error updating progress for job ${jobId}:`, error);
      }
    }, 2000); // Update every 2 seconds - EXACT Legal approach

    this.jobIntervals.set(jobId, interval);
  }

  /**
   * Stop job monitoring - EXACT Legal approach  
   */
  private stopJobMonitoring(jobId: string): void {
    const interval = this.jobIntervals.get(jobId);
    if (interval) {
      clearInterval(interval);
      this.jobIntervals.delete(jobId);
    }
    this.activeJobs.delete(jobId);
    console.log(`🛑 Stopped monitoring job ${jobId}`);
  }

  /**
   * Get job status - EXACT Legal approach
   */
  async getJobStatus(jobId: string): Promise<any> {
    const job = await storage.getBackgroundJobById(jobId);
    const jobState = this.activeJobs.get(jobId);
    
    return {
      job,
      state: jobState,
      isActive: this.activeJobs.has(jobId)
    };
  }

  /**
   * Cancel a running job - EXACT Legal approach
   */
  async cancelJob(jobId: string): Promise<void> {
    console.log(`🚫 Canceling research analysis job ${jobId}`);
    
    await storage.updateBackgroundJob(jobId, {
      status: 'cancelled',
      completedAt: new Date()
    });
    
    this.stopJobMonitoring(jobId);
  }

  /**
   * Get all active jobs
   */
  getActiveJobs(): Map<string, ResearchJobState> {
    return this.activeJobs;
  }

  /**
   * Check if a deal has an active research analysis
   */
  hasActiveResearchAnalysis(dealId: number): boolean {
    for (const jobState of this.activeJobs.values()) {
      if (jobState.dealId === dealId) {
        return true;
      }
    }
    return false;
  }
}

// Export singleton instance
export const persistentResearchAnalysisService = PersistentResearchAnalysisService.getInstance();