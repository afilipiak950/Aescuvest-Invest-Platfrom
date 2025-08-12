/**
 * Persistent Clinical Analysis Service
 * Ensures clinical analysis jobs continue running regardless of server restarts or user sessions
 */

import { storage } from '../storage';
import { comprehensiveClinicalAnalysisService, COMPREHENSIVE_CLINICAL_QUESTIONS } from '../comprehensiveClinicalAnalysisService';
import { websocketManager } from './websocketManager';

interface ClinicalJobState {
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

export class PersistentClinicalAnalysisService {
  private static instance: PersistentClinicalAnalysisService;
  private activeJobs = new Map<string, ClinicalJobState>();
  private jobIntervals = new Map<string, NodeJS.Timeout>();

  static getInstance(): PersistentClinicalAnalysisService {
    if (!PersistentClinicalAnalysisService.instance) {
      PersistentClinicalAnalysisService.instance = new PersistentClinicalAnalysisService();
    }
    return PersistentClinicalAnalysisService.instance;
  }

  /**
   * Initialize and restore any incomplete clinical analysis jobs
   */
  async initialize(): Promise<void> {
    try {
      console.log('🧬 Initializing Persistent Clinical Analysis Service...');
      
      // Find all incomplete clinical analysis jobs by checking each known deal
      const knownDealIds = [33, 30, 29, 28, 27]; // Add more deal IDs as needed
      const clinicalJobs = [];
      
      for (const dealId of knownDealIds) {
        try {
          const dealJobs = await storage.getBackgroundJobsByDealId(dealId);
          const clinicalJobsForDeal = dealJobs.filter(job => 
            job.agentType === 'clinical' && 
            job.jobType === 'comprehensive_clinical_analysis' &&
            (job.status === 'processing' || job.status === 'completed')
          );
          
          // For each job, check if it's really complete or just marked as complete incorrectly
          for (const job of clinicalJobsForDeal) {
            const existingAnalysis = await storage.getAgentAnalysis(dealId, 'clinical');
            const expectedQuestions = this.getClinicalQuestions();
            const answeredQuestions = existingAnalysis?.clinicalAnswers ? Object.keys(existingAnalysis.clinicalAnswers).length : 0;
            
            if (answeredQuestions < expectedQuestions.length) {
              console.log(`🔄 Job ${job.jobId} marked complete but only ${answeredQuestions}/${expectedQuestions.length} questions done. Adding to resume list.`);
              clinicalJobs.push(job);
            }
          }
        } catch (error) {
          console.log(`Skipping deal ${dealId} during initialization`);
        }
      }

      console.log(`🔄 Found ${clinicalJobs.length} incomplete clinical analysis jobs`);

      for (const job of clinicalJobs) {
        await this.resumeClinicalAnalysis(job.dealId, job.jobId);
      }

      console.log('✅ Persistent Clinical Analysis Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Persistent Clinical Analysis Service:', error);
    }
  }

  /**
   * Start a new persistent clinical analysis job
   */
  async startClinicalAnalysis(dealId: number): Promise<string> {
    const jobId = `clinical-analysis-${dealId}`;
    
    console.log(`🧬 Starting persistent clinical analysis for deal ${dealId}`);

    // Check if job already exists and is running
    const existingJob = await storage.getBackgroundJobById(jobId);
    if (existingJob && existingJob.status === 'processing') {
      console.log(`🔄 Clinical analysis already running for deal ${dealId}, resuming...`);
      await this.resumeClinicalAnalysis(dealId, jobId);
      return jobId;
    }

    // Clean up any old completed or failed jobs for this deal
    if (existingJob && existingJob.status !== 'processing') {
      console.log(`🧹 Found old job for deal ${dealId} with status ${existingJob.status}, deleting it...`);
      await storage.deleteBackgroundJob(jobId);
    }

    // Create new background job record
    await storage.createBackgroundJob({
      jobId,
      jobType: 'comprehensive_clinical_analysis',
      dealId,
      agentType: 'clinical',
      status: 'processing',
      progress: 0,
      totalDocuments: 0,
      processedDocuments: 0,
      currentStep: 'Initializing clinical analysis...',
      startedAt: new Date()
    });

    // Start the analysis process
    await this.processClinicalAnalysis(dealId, jobId);
    
    return jobId;
  }

  /**
   * Resume an interrupted clinical analysis job
   */
  private async resumeClinicalAnalysis(dealId: number, jobId: string): Promise<void> {
    try {
      console.log(`🔄 Resuming clinical analysis job ${jobId} for deal ${dealId}`);

      // Get job state from database
      const job = await storage.getBackgroundJobById(jobId);
      if (!job) {
        console.error(`❌ Job ${jobId} not found in database`);
        return;
      }

      // Check if analysis is FULLY completed (all questions answered)
      const existingAnalysis = await storage.getAgentAnalysis(dealId, 'clinical');
      const expectedQuestions = this.getClinicalQuestions();
      const answeredQuestions = existingAnalysis?.clinicalAnswers ? Object.keys(existingAnalysis.clinicalAnswers).length : 0;
      
      if (existingAnalysis && answeredQuestions >= expectedQuestions.length) {
        console.log(`✅ Clinical analysis fully completed for deal ${dealId} (${answeredQuestions}/${expectedQuestions.length} questions)`);
        await storage.updateBackgroundJob(jobId, {
          status: 'completed',
          progress: 100,
          completedAt: new Date()
        });
        return;
      }
      
      console.log(`🔄 Clinical analysis incomplete: ${answeredQuestions}/${expectedQuestions.length} questions answered. Continuing...`);

      // Resume from where it left off
      const progress = job.progress || 0;
      console.log(`🔄 Resuming clinical analysis at ${progress}% completion`);

      // Update job status to processing if it was stuck
      await storage.updateBackgroundJob(jobId, {
        status: 'processing',
        currentStep: `Resuming analysis from ${progress}%...`,
        updatedAt: new Date()
      });

      // Continue the analysis process
      await this.processClinicalAnalysis(dealId, jobId, progress);

    } catch (error) {
      console.error(`❌ Failed to resume clinical analysis ${jobId}:`, error);
      await storage.updateBackgroundJob(jobId, {
        status: 'failed',
        error: error.message,
        updatedAt: new Date()
      });
    }
  }

  /**
   * Process clinical analysis with persistent state tracking
   */
  private async processClinicalAnalysis(dealId: number, jobId: string, startProgress: number = 0): Promise<void> {
    try {
      // Track job in memory for real-time updates
      const jobState: ClinicalJobState = {
        dealId,
        jobId,
        progress: startProgress,
        currentQuestionIndex: Math.floor(startProgress / 100 * 13), // 13 total questions
        totalQuestions: 13,
        currentBatch: 0,
        totalBatches: 0,
        currentStep: 'Processing clinical analysis...',
        documentsAnalyzed: 0,
        totalDocuments: 0,
        startTime: new Date(),
        lastUpdate: new Date()
      };

      this.activeJobs.set(jobId, jobState);

      // Set up progress monitoring interval
      const progressInterval = setInterval(async () => {
        await this.broadcastProgress(jobId, jobState);
      }, 2000);

      this.jobIntervals.set(jobId, progressInterval);

      // Delegate to comprehensive clinical analysis service but with persistence
      console.log(`🧬 Delegating to comprehensive clinical analysis service...`);
      
      // Hook into the existing service but with persistent tracking
      await this.runPersistentAnalysis(dealId, jobId, jobState);

    } catch (error) {
      console.error(`❌ Clinical analysis failed for deal ${dealId}:`, error);
      
      // Clean up
      const interval = this.jobIntervals.get(jobId);
      if (interval) {
        clearInterval(interval);
        this.jobIntervals.delete(jobId);
      }
      this.activeJobs.delete(jobId);

      // Mark as failed
      await storage.updateBackgroundJob(jobId, {
        status: 'failed',
        error: error.message,
        updatedAt: new Date()
      });

      throw error;
    }
  }

  /**
   * Run the actual analysis with persistent state updates
   */
  private async runPersistentAnalysis(dealId: number, jobId: string, jobState: ClinicalJobState): Promise<void> {
    try {
      // Update job state
      jobState.currentStep = 'Running comprehensive clinical analysis...';
      await this.updateJobProgress(jobId, jobState.progress, jobState.currentStep);

      // Call the existing comprehensive clinical analysis service
      const result = await comprehensiveClinicalAnalysisService.runComprehensiveAnalysis(dealId, storage, jobId);

      // Mark as completed
      jobState.progress = 100;
      jobState.currentStep = 'Clinical analysis completed';
      
      await storage.updateBackgroundJob(jobId, {
        status: 'completed',
        progress: 100,
        currentStep: 'Clinical analysis completed',
        completedAt: new Date(),
        updatedAt: new Date()
      });

      // Clean up
      const interval = this.jobIntervals.get(jobId);
      if (interval) {
        clearInterval(interval);
        this.jobIntervals.delete(jobId);
      }
      this.activeJobs.delete(jobId);

      console.log(`✅ Clinical analysis completed for deal ${dealId}`);

    } catch (error) {
      console.error(`❌ Persistent clinical analysis failed:`, error);
      throw error;
    }
  }

  /**
   * Update job progress in database and memory
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
        jobState.currentStep = currentStep;
        jobState.lastUpdate = new Date();
      }

    } catch (error) {
      console.error(`❌ Failed to update job progress for ${jobId}:`, error);
    }
  }

  /**
   * Broadcast progress via WebSocket
   */
  private async broadcastProgress(jobId: string, jobState: ClinicalJobState): Promise<void> {
    try {
      const progressData = {
        jobId,
        agentType: 'clinical',
        progress: jobState.progress,
        status: 'processing',
        currentStep: jobState.currentStep,
        processedDocuments: jobState.documentsAnalyzed,
        totalDocuments: jobState.totalDocuments,
        metadata: {
          agentType: 'clinical',
          startTime: jobState.startTime.toISOString(),
          lastUpdate: jobState.lastUpdate.toISOString()
        }
      };

      // Send via WebSocket to all connected clients for this deal
      websocketManager.broadcastToRoom(`deal-${jobState.dealId}`, 'job-progress', progressData);

    } catch (error) {
      console.error(`❌ Failed to broadcast progress for ${jobId}:`, error);
    }
  }

  /**
   * Stop a clinical analysis job
   */
  async stopClinicalAnalysis(jobId: string): Promise<void> {
    try {
      console.log(`🛑 Stopping clinical analysis job ${jobId}`);

      // Clean up intervals
      const interval = this.jobIntervals.get(jobId);
      if (interval) {
        clearInterval(interval);
        this.jobIntervals.delete(jobId);
      }

      // Remove from active jobs
      this.activeJobs.delete(jobId);

      // Update database
      await storage.updateBackgroundJob(jobId, {
        status: 'cancelled',
        updatedAt: new Date()
      });

      console.log(`✅ Clinical analysis job ${jobId} stopped`);

    } catch (error) {
      console.error(`❌ Failed to stop clinical analysis job ${jobId}:`, error);
    }
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): ClinicalJobState | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Get all active clinical analysis jobs
   */
  getAllActiveJobs(): Map<string, ClinicalJobState> {
    return this.activeJobs;
  }

  /**
   * Get the standard clinical questions for analysis
   */
  getClinicalQuestions() {
    return COMPREHENSIVE_CLINICAL_QUESTIONS;
  }
}

export const persistentClinicalAnalysisService = PersistentClinicalAnalysisService.getInstance();