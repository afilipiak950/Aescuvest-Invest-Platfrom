/**
 * Persistent HR Analysis Service
 * Ensures HR analysis jobs continue running regardless of server restarts or user sessions
 */

import { storage } from '../storage';
import { RAG_HR_QUESTIONS } from './ragPoweredHRAgent';
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
      
      // Query for incomplete jobs that need to be resumed - IDENTICAL to Legal agent
      const hrJobs = await db
        .select()
        .from(backgroundJobs)
        .where(and(
          eq(backgroundJobs.agentType, 'HR'),
          eq(backgroundJobs.status, 'processing')
        ));

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
    const jobId = `rag_hr_analysis_${dealId}_${Date.now()}`;
    
    console.log(`👥 Starting persistent HR analysis for deal ${dealId}`);

    console.log(`👥 Starting FRESH RAG-powered HR analysis for deal ${dealId}`);

    // ALWAYS delete existing job to force fresh start - EXACT Legal behavior
    const existingJobs = await db
      .select()
      .from(backgroundJobs)
      .where(and(
        eq(backgroundJobs.dealId, dealId),
        eq(backgroundJobs.agentType, 'HR')
      ));
    
    for (const job of existingJobs) {
      console.log(`🧹 FORCE DELETING existing job ${job.jobId} for deal ${dealId} with status ${job.status} to start fresh...`);
      await db
        .delete(backgroundJobs)
        .where(eq(backgroundJobs.jobId, job.jobId));
      
      // Also clear from memory if running
      if (this.activeJobs.has(job.jobId)) {
        this.activeJobs.delete(job.jobId);
      }
      
      const interval = this.jobIntervals.get(job.jobId);
      if (interval) {
        clearInterval(interval);
        this.jobIntervals.delete(job.jobId);
      }
    }

    // CRITICAL FIX: Clear existing analysis data before starting fresh analysis
    console.log(`🧹 Clearing existing HR analysis data for deal ${dealId}`);
    try {
      await db
        .delete(agentAnalyses)
        .where(and(
          eq(agentAnalyses.dealId, dealId),
          eq(agentAnalyses.agentType, 'HR')
        ));
      console.log(`✅ Successfully cleared existing HR analysis for deal ${dealId}`);
    } catch (error) {
      console.log(`⚠️ No existing HR analysis to clear for deal ${dealId}: ${error.message}`);
    }

    // Create new background job record - FIXED: Direct database insert like Legal agent
    await db.insert(backgroundJobs).values({
      jobId,
      dealId,
      jobType: 'rag_hr_analysis',
      agentType: 'HR',
      status: 'processing',
      progress: 0,
      processedDocuments: 0,
      totalDocuments: this.getHRQuestions()?.length || 12, // Dynamic HR question count
      currentStep: 'Initializing simplified RAG HR analysis...',
      jobData: {
        startTime: Date.now(),
        analysisType: 'simplified_rag_hr',
        ragEnabled: true,
        questionCount: this.getHRQuestions()?.length || 12,
        expectedLayers: this.getHRQuestions()?.length || 12 // Dynamic question count × 1 direct search each
      },
      startedAt: new Date()
    });

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

      // FORCE CLEAR existing analysis data and reset job to 0% - IDENTICAL to Legal
      console.log(`🧹 FORCE CLEARING existing HR analysis data for deal ${dealId}`);
      try {
        await db
          .delete(agentAnalyses)
          .where(and(
            eq(agentAnalyses.dealId, dealId),
            eq(agentAnalyses.agentType, 'HR')
          ));
        console.log(`✅ Successfully cleared existing HR analysis for deal ${dealId}`);
      } catch (error) {
        console.log(`⚠️ No existing HR analysis to clear for deal ${dealId}: ${error.message}`);
      }

      // Reset job progress to 0% - IDENTICAL to Legal
      await db
        .update(backgroundJobs)
        .set({
          progress: 0,
          processedDocuments: 0,
          currentStep: 'Restarting HR analysis from beginning...',
        })
        .where(eq(backgroundJobs.jobId, jobId));

      // Start fresh analysis process
      await this.processHRAnalysis(dealId, jobId);

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
        currentQuestionIndex: Math.floor(startProgress / 100 * (this.getHRQuestions()?.length || 12)), // Dynamic total questions
        totalQuestions: this.getHRQuestions()?.length || 12,
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

      // Create RAG-powered HR agent instance - EXACT SAME AS LEGAL AGENT
      const { RAGPoweredHRAgent } = await import('./ragPoweredHRAgent');
      const ragHRAgent = new RAGPoweredHRAgent(dealId, jobId);
      
      // ⚡ STAGGERED STARTUP - HR agent waits 45s to avoid API conflicts
      const { AgentStaggeringService } = await import('./agentStaggeringService');
      const staggeringService = AgentStaggeringService.getInstance();
      await staggeringService.waitForAgentStartup('HR');

      // Call the RAG-powered HR analysis service - FIXED: No setProgressCallback, no return value
      await ragHRAgent.runComprehensiveAnalysis();

      // Mark as completed
      jobState.progress = 100;
      jobState.currentStep = 'RAG HR analysis completed';
      
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