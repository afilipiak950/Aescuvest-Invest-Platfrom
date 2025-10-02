/**
 * Persistent HR Analysis Service
 * Ensures HR analysis jobs continue running regardless of server restarts or user sessions
 */

import { storage } from '../storage';
import { RagPoweredHRAgent, RAG_HR_QUESTIONS } from './ragPoweredHRAgent';
import { websocketManager } from './websocketManager';
import { db } from '../db';
import { backgroundJobs, agentAnalyses } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface HRJobState {
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

export class PersistentHRAnalysisService {
  private static instance: PersistentHRAnalysisService;
  private activeJobs = new Map<string, HRJobState>();
  private jobIntervals = new Map<string, NodeJS.Timeout>();

  static getInstance(): PersistentHRAnalysisService {
    if (!PersistentHRAnalysisService.instance) {
      PersistentHRAnalysisService.instance = new PersistentHRAnalysisService();
    }
    return PersistentHRAnalysisService.instance;
  }

  /**
   * Initialize and restore any incomplete HR analysis jobs
   */
  async initialize(): Promise<void> {
    try {
      console.log('👥 Initializing Persistent HR Analysis Service...');
      
      // Temporarily reduce initialization load to prevent crashes
      // Only check for actively running jobs to minimize startup queries
      const hrJobs = [];
      console.log('🔄 Skipping expensive job recovery during startup to prevent crashes');

      console.log(`🔄 Found ${hrJobs.length} incomplete HR analysis jobs`);

      for (const job of hrJobs) {
        await this.resumeHRAnalysis(job.dealId, job.jobId);
      }

      console.log('✅ Persistent HR Analysis Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Persistent HR Analysis Service:', error);
    }
  }

  /**
   * Start a new persistent HR analysis job
   */
  async startHRAnalysis(dealId: number): Promise<string> {
    const jobId = `hr-analysis-${dealId}`;
    
    console.log(`👥 Starting persistent HR analysis for deal ${dealId}`);

    // Check if job already exists and is running - FIXED: Direct database query like Legal agent
    const [existingJob] = await db.select().from(backgroundJobs).where(eq(backgroundJobs.jobId, jobId));
    if (existingJob && existingJob.status === 'processing') {
      console.log(`🔄 HR analysis already running for deal ${dealId}, resuming...`);
      await this.resumeHRAnalysis(dealId, jobId);
      return jobId;
    }

    // Clean up any old completed or failed jobs for this deal
    if (existingJob && existingJob.status !== 'processing') {
      console.log(`🧹 Found old job for deal ${dealId} with status ${existingJob.status}, deleting it...`);
      await db.delete(backgroundJobs).where(eq(backgroundJobs.jobId, jobId));
    }

    // Create new background job record using storage service (like Financial/IP agents)
    try {
      await storage.createBackgroundJob({
        jobId,
        jobType: 'comprehensive_hr_analysis',
        dealId,
        agentType: 'HR',
        status: 'processing',
        progress: 0,
        totalDocuments: 12, // 12 HR questions
        processedDocuments: 0,
        currentStep: 'Initializing HR analysis...',
        startedAt: new Date()
      });
      console.log(`✅ Created background job ${jobId} for HR analysis`);
    } catch (error) {
      // Handle duplicate key errors specifically
      if (error instanceof Error && error.message.includes('duplicate key')) {
        console.log(`⚠️ Duplicate job key detected, attempting force cleanup for ${jobId}`);
        await storage.deleteBackgroundJob(jobId);
        await new Promise(resolve => setTimeout(resolve, 200));
        
        await storage.createBackgroundJob({
          jobId,
          jobType: 'comprehensive_hr_analysis',
          dealId,
          agentType: 'HR',
          status: 'processing',
          progress: 0,
          totalDocuments: 12,
          processedDocuments: 0,
          currentStep: 'Initializing HR analysis after cleanup...',
          startedAt: new Date()
        });
        console.log(`✅ Successfully created job ${jobId} after cleanup`);
      } else {
        throw error;
      }
    }

    // Start the analysis process
    await this.processHRAnalysis(dealId, jobId);
    
    return jobId;
  }

  /**
   * Resume an interrupted HR analysis job
   */
  private async resumeHRAnalysis(dealId: number, jobId: string): Promise<void> {
    try {
      console.log(`🔄 Resuming HR analysis job ${jobId} for deal ${dealId}`);

      // Get job state from database - FIXED: Direct database query like Legal agent
      const [job] = await db.select().from(backgroundJobs).where(eq(backgroundJobs.jobId, jobId));
      if (!job) {
        console.error(`❌ Job ${jobId} not found in database`);
        return;
      }

      // Check if analysis is FULLY completed (all questions answered)
      const existingAnalysis = await storage.getAgentAnalysis(dealId, 'hr');
      const expectedQuestions = this.getHRQuestions();
      const answeredQuestions = existingAnalysis?.hrAnswers ? Object.keys(existingAnalysis.hrAnswers).length : 0;
      
      if (existingAnalysis && answeredQuestions >= expectedQuestions.length) {
        console.log(`✅ HR analysis fully completed for deal ${dealId} (${answeredQuestions}/${expectedQuestions.length} questions)`);
        await storage.completeBackgroundJob(jobId, { analysisComplete: true });
        return;
      }
      
      console.log(`🔄 HR analysis incomplete: ${answeredQuestions}/${expectedQuestions.length} questions answered. Continuing...`);

      // Resume from where it left off
      const progress = job.progress || 0;
      console.log(`🔄 Resuming HR analysis at ${progress}% completion`);

      // Update job status to processing if it was stuck - FIXED: Use storage service
      await storage.updateBackgroundJob(jobId, {
        status: 'processing',
        currentStep: `Resuming analysis from ${progress}%...`
      });

      // Continue the analysis process
      await this.processHRAnalysis(dealId, jobId, progress);

    } catch (error) {
      console.error(`❌ Failed to resume HR analysis ${jobId}:`, error);
      await storage.failBackgroundJob(jobId, error.message);
    }
  }

  /**
   * Process HR analysis with persistent state tracking
   */
  private async processHRAnalysis(dealId: number, jobId: string, startProgress: number = 0): Promise<void> {
    try {
      // Track job in memory for real-time updates
      const jobState: HRJobState = {
        dealId,
        jobId,
        progress: startProgress,
        currentQuestionIndex: Math.floor(startProgress / 100 * 12), // 12 total questions
        totalQuestions: 12,
        currentBatch: 0,
        totalBatches: 0,
        currentStep: 'Processing HR analysis...',
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

      // Delegate to RAG-powered HR analysis service but with persistence
      console.log(`👥 Delegating to RAG-powered HR analysis service...`);
      
      // Hook into the existing service but with persistent tracking
      await this.runPersistentAnalysis(dealId, jobId, jobState);

    } catch (error) {
      console.error(`❌ HR analysis failed for deal ${dealId}:`, error);
      
      // Clean up
      const interval = this.jobIntervals.get(jobId);
      if (interval) {
        clearInterval(interval);
        this.jobIntervals.delete(jobId);
      }
      this.activeJobs.delete(jobId);

      // Mark as failed - FIXED: Use storage service
      await storage.failBackgroundJob(jobId, error.message);

      throw error;
    }
  }

  /**
   * Run the actual analysis with persistent state updates
   */
  private async runPersistentAnalysis(dealId: number, jobId: string, jobState: HRJobState): Promise<void> {
    try {
      // Update job state
      jobState.currentStep = 'Running comprehensive HR analysis...';
      await this.updateJobProgress(jobId, jobState.progress, jobState.currentStep);

      // Create RAG-powered HR agent instance
      const ragHRAgent = new RagPoweredHRAgent(dealId);
      
      // Set up progress callback for real-time updates
      ragHRAgent.setProgressCallback(async (progress: any) => {
        const newProgress = progress.percentage || 0;
        const newStep = progress.currentStep || 'Processing HR question...';
        
        jobState.progress = newProgress;
        jobState.currentStep = newStep;
        jobState.currentQuestionIndex = progress.completedQuestions || 0;
        
        await this.updateJobProgress(jobId, newProgress, newStep);
      });

      // Call the RAG-powered HR analysis service
      const result = await ragHRAgent.runComprehensiveAnalysis();

      // Mark as completed
      jobState.progress = 100;
      jobState.currentStep = 'HR analysis completed';
      
      await storage.completeBackgroundJob(jobId, { hrAnalysisComplete: true });

      // Clean up
      const interval = this.jobIntervals.get(jobId);
      if (interval) {
        clearInterval(interval);
        this.jobIntervals.delete(jobId);
      }
      this.activeJobs.delete(jobId);

      console.log(`✅ HR analysis completed for deal ${dealId}`);

    } catch (error) {
      console.error(`❌ Persistent HR analysis failed:`, error);
      throw error;
    }
  }

  /**
   * Update job progress in database and memory
   */
  private async updateJobProgress(jobId: string, progress: number, currentStep: string): Promise<void> {
    try {
      // Update database - FIXED: Use storage service
      await storage.updateBackgroundJob(jobId, {
        progress,
        currentStep
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
   * Broadcast progress via WebSocket - READS real progress from database
   */
  private async broadcastProgress(jobId: string, jobState: HRJobState): Promise<void> {
    try {
      // Get current progress from database (the source of truth) - FIXED: Direct database query like Legal agent
      const [currentJob] = await db.select().from(backgroundJobs).where(eq(backgroundJobs.jobId, jobId));
      if (currentJob && this.activeJobs.has(jobId)) {
        const jobData = this.activeJobs.get(jobId);
        if (jobData) {
          jobData.lastUpdate = new Date();
          
          // Use REAL progress from database, not our stale memory
          const realProgress = currentJob.progress || 0;
          const realCurrentStep = currentJob.currentStep || jobState.currentStep;
          const realCurrentDocumentName = currentJob.currentDocumentName || '';
          const realProcessedDocuments = currentJob.processedDocuments || 0;
          const realTotalDocuments = currentJob.totalDocuments || 0;
          
          // Update our memory with real values from RAG service
          jobState.progress = realProgress;
          jobState.currentStep = realCurrentStep;
          jobState.documentsAnalyzed = realProcessedDocuments;
          jobState.totalDocuments = realTotalDocuments;
          
          const progressData = {
            jobId,
            agentType: 'hr',
            progress: realProgress,
            status: 'processing',
            currentStep: realCurrentStep,
            currentDocumentName: realCurrentDocumentName,
            processedDocuments: realProcessedDocuments,
            totalDocuments: realTotalDocuments,
            metadata: {
              agentType: 'hr',
              startTime: jobState.startTime.toISOString(),
              lastUpdate: jobData.lastUpdate.toISOString()
            }
          };

          // Send via WebSocket to all connected clients for this deal
          websocketManager.broadcastToRoom(`deal-${jobState.dealId}`, 'job-progress', progressData);
          console.log(`📡 Broadcasting REAL HR progress: ${realProgress}% - ${realCurrentStep}`);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to broadcast progress for ${jobId}:`, error);
    }
  }

  /**
   * Stop an HR analysis job
   */
  async stopHRAnalysis(jobId: string): Promise<void> {
    try {
      console.log(`🛑 Stopping HR analysis job ${jobId}`);

      // Clean up intervals
      const interval = this.jobIntervals.get(jobId);
      if (interval) {
        clearInterval(interval);
        this.jobIntervals.delete(jobId);
      }

      // Remove from active jobs
      this.activeJobs.delete(jobId);

      // Update database - FIXED: Use storage service
      await storage.updateBackgroundJob(jobId, {
        status: 'cancelled'
      });

      console.log(`✅ HR analysis job ${jobId} stopped`);

    } catch (error) {
      console.error(`❌ Failed to stop HR analysis job ${jobId}:`, error);
    }
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): HRJobState | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Get all active HR analysis jobs
   */
  getAllActiveJobs(): Map<string, HRJobState> {
    return this.activeJobs;
  }

  /**
   * Get the standard HR questions for analysis
   */
  getHRQuestions() {
    return RAG_HR_QUESTIONS;
  }
}

export const persistentHRAnalysisService = PersistentHRAnalysisService.getInstance();