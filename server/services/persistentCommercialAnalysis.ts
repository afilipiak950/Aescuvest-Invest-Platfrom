/**
 * Persistent Commercial Analysis Service
 * Ensures commercial analysis jobs continue running regardless of server restarts or user sessions
 * Based on the proven clinical and legal analysis architecture
 */

import { storage } from '../storage';
import { RAGPoweredCommercialAgent, RAG_COMMERCIAL_QUESTIONS } from './ragPoweredCommercialAgent';
import { websocketManager } from './websocketManager';
import { db } from '../db';
import { agentAnalyses, backgroundJobs } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface CommercialJobState {
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

export class PersistentCommercialAnalysisService {
  private static instance: PersistentCommercialAnalysisService;
  private activeJobs = new Map<string, CommercialJobState>();
  private jobIntervals = new Map<string, NodeJS.Timeout>();
  private websocketManager: any;

  static getInstance(): PersistentCommercialAnalysisService {
    if (!PersistentCommercialAnalysisService.instance) {
      PersistentCommercialAnalysisService.instance = new PersistentCommercialAnalysisService();
    }
    return PersistentCommercialAnalysisService.instance;
  }

  /**
   * Initialize and restore any incomplete commercial analysis jobs
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing RAG-Powered Commercial Analysis Service...');
      
      // Check for incomplete RAG commercial analysis jobs
      const incompleteJobs = await db
        .select()
        .from(backgroundJobs)
        .where(and(
          eq(backgroundJobs.agentType, 'Commercial'),
          eq(backgroundJobs.status, 'processing')
        ));

      console.log(`🔄 Found ${incompleteJobs.length} incomplete RAG commercial analysis jobs`);

      for (const job of incompleteJobs) {
        await this.resumeCommercialAnalysis(job.dealId, job.jobId);
      }
      
      console.log('✅ RAG-Powered Commercial Analysis Service initialized');
    } catch (error) {
      console.error('❌ Error initializing RAG Commercial Analysis Service:', error);
    }
  }

  /**
   * Start a new persistent commercial analysis job - FORCES fresh start like Clinical
   */
  async startCommercialAnalysis(dealId: number): Promise<string> {
    const jobId = `rag_commercial_analysis_${dealId}_${Date.now()}`;
    
    console.log(`🚀 Starting FRESH RAG-powered commercial analysis for deal ${dealId}`);

    // ALWAYS delete existing job to force fresh start - EXACT Clinical behavior
    const existingJobs = await db
      .select()
      .from(backgroundJobs)
      .where(and(
        eq(backgroundJobs.dealId, dealId),
        eq(backgroundJobs.agentType, 'Commercial')
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

    // Create new background job record using storage service (like Financial/IP agents)
    try {
      await storage.createBackgroundJob({
        jobId,
        jobType: 'rag_commercial_analysis',
        dealId,
        agentType: 'Commercial',
        status: 'processing',
        progress: 0,
        totalDocuments: 12, // 12 commercial questions
        processedDocuments: 0,
        currentStep: 'Initializing RAG commercial analysis...',
        startedAt: new Date()
      });
      console.log(`✅ Created background job ${jobId} for Commercial analysis`);
    } catch (error) {
      // Handle duplicate key errors specifically
      if (error instanceof Error && error.message.includes('duplicate key')) {
        console.log(`⚠️ Duplicate job key detected, attempting force cleanup for ${jobId}`);
        await storage.deleteBackgroundJob(jobId);
        await new Promise(resolve => setTimeout(resolve, 200));
        
        await storage.createBackgroundJob({
          jobId,
          jobType: 'rag_commercial_analysis',
          dealId,
          agentType: 'Commercial',
          status: 'processing',
          progress: 0,
          totalDocuments: 12,
          processedDocuments: 0,
          currentStep: 'Initializing RAG commercial analysis after cleanup...',
          startedAt: new Date()
        });
        console.log(`✅ Successfully created job ${jobId} after cleanup`);
      } else {
        throw error;
      }
    }

    // CRITICAL FIX: Clear existing analysis data before starting fresh analysis
    console.log(`🧹 Clearing existing commercial analysis data for deal ${dealId}`);
    await db
      .delete(agentAnalyses)
      .where(and(
        eq(agentAnalyses.dealId, dealId),
        eq(agentAnalyses.agentType, 'Commercial')
      ));

    // Process the analysis
    await this.processCommercialAnalysis(dealId, jobId);

    return jobId;
  }

  /**
   * Resume existing commercial analysis job
   */
  async resumeCommercialAnalysis(dealId: number, jobId: string): Promise<void> {
    try {
      console.log(`♻️ Resuming RAG commercial analysis for deal ${dealId}, job ${jobId}`);

      // Get current job status
      const job = await db
        .select()
        .from(backgroundJobs)
        .where(eq(backgroundJobs.jobId, jobId))
        .limit(1);

      if (job.length === 0) {
        console.log(`❌ Job ${jobId} not found, cannot resume`);
        return;
      }

      const currentJob = job[0];

      // Check if all commercial questions are answered by examining the commercialAnswers data
      const analysis = await db
        .select()
        .from(agentAnalyses)
        .where(and(
          eq(agentAnalyses.dealId, dealId),
          eq(agentAnalyses.agentType, 'Commercial')
        ))
        .limit(1);

      if (analysis.length > 0 && analysis[0].commercialAnswers) {
        const answeredQuestions = Object.keys(analysis[0].commercialAnswers).length;
        const expectedQuestions = RAG_COMMERCIAL_QUESTIONS;
        
        console.log(`📊 Commercial resumption check: ${answeredQuestions}/${expectedQuestions.length} questions answered`);
        
        if (answeredQuestions >= expectedQuestions.length) {
          console.log(`✅ Commercial analysis already complete for deal ${dealId}, marking job as completed`);
          
          // Mark job as completed in database
          await storage.completeBackgroundJob(jobId, { commercialAnalysisComplete: true });
          return;
        }
      }

      // Analysis is incomplete, continue from where we left off
      console.log(`🔄 Commercial analysis incomplete. Continuing...`);
      
      const currentProgress = currentJob.progress || 0;
      console.log(`🔄 Resuming RAG commercial analysis at ${currentProgress}% completion`);

      // Continue processing from current state
      await this.processCommercialAnalysis(dealId, jobId, currentProgress);

    } catch (error) {
      console.error(`❌ Failed to resume commercial analysis for deal ${dealId}:`, error);
      // Mark job as failed
      await storage.failBackgroundJob(jobId, error.message);
    }
  }

  /**
   * Process commercial analysis with persistent state tracking - IDENTICAL to Clinical
   */
  private async processCommercialAnalysis(dealId: number, jobId: string, startProgress: number = 0): Promise<void> {
    try {
      // Track job in memory for real-time updates - EXACTLY like Clinical
      const jobState: CommercialJobState = {
        dealId,
        jobId,
        progress: startProgress,
        currentQuestionIndex: Math.floor(startProgress / 100 * RAG_COMMERCIAL_QUESTIONS.length), // Use actual question count
        totalQuestions: RAG_COMMERCIAL_QUESTIONS.length,
        currentBatch: 0,
        totalBatches: 0,
        currentStep: 'Processing commercial analysis...',
        documentsAnalyzed: 0,
        totalDocuments: 0,
        startTime: new Date(),
        lastUpdate: new Date()
      };

      this.activeJobs.set(jobId, jobState);

      // Set up progress monitoring interval - EXACTLY like Clinical
      const progressInterval = setInterval(async () => {
        console.log(`🔄 Commercial progress monitoring tick for job ${jobId}`);
        await this.broadcastProgress(jobId, jobState);
      }, 2000);

      this.jobIntervals.set(jobId, progressInterval);

      // Delegate to RAG-powered commercial analysis agent - EXACTLY like Clinical
      console.log(`🔍 Delegating to RAG-powered commercial analysis agent...`);
      
      // Hook into the new RAG service but with persistent tracking - EXACTLY like Clinical
      await this.runPersistentAnalysis(dealId, jobId, jobState);

    } catch (error) {
      console.error(`❌ Commercial analysis failed for deal ${dealId}:`, error);
      
      // Clean up - EXACTLY like Clinical
      const interval = this.jobIntervals.get(jobId);
      if (interval) {
        clearInterval(interval);
        this.jobIntervals.delete(jobId);
      }
      this.activeJobs.delete(jobId);

      // Mark as failed - EXACTLY like Clinical
      await storage.failBackgroundJob(jobId, error.message);

      throw error;
    }
  }

  /**
   * Run the actual analysis with persistent state updates - IDENTICAL to Clinical
   */
  private async runPersistentAnalysis(dealId: number, jobId: string, jobState: CommercialJobState): Promise<void> {
    try {
      // Update job state - EXACTLY like Clinical
      jobState.currentStep = 'Running comprehensive commercial analysis...';
      await this.updateJobProgress(jobId, jobState.progress, jobState.currentStep);

      // Call the RAG-powered commercial analysis agent
      const ragAgent = new RAGPoweredCommercialAgent(dealId, jobId);
      await ragAgent.runComprehensiveAnalysis();

      // Mark as completed - EXACTLY like Clinical
      jobState.progress = 100;
      jobState.currentStep = 'RAG commercial analysis completed';
      
      await storage.completeBackgroundJob(jobId, { 
        commercialAnalysisComplete: true,
        currentStep: 'RAG commercial analysis completed' 
      });

      // Clean up - EXACTLY like Clinical
      const interval = this.jobIntervals.get(jobId);
      if (interval) {
        clearInterval(interval);
        this.jobIntervals.delete(jobId);
      }
      this.activeJobs.delete(jobId);
      
      // Final progress broadcast to show 100% completion
      console.log(`📡 Broadcasting FINAL commercial progress: 100% - Commercial analysis completed`);
      if (this.websocketManager) {
        try {
          this.websocketManager.broadcastJobProgress({
            jobId: parseInt(jobId.replace('commercial-analysis-', '')),
            progress: 100,
            status: 'completed',
            currentStep: 'Commercial analysis completed',
            documentName: ''
          }, jobState.dealId);
        } catch (wsError) {
          console.log(`⚠️ Final WebSocket broadcast failed: ${wsError.message}`);
        }
      }

      console.log(`✅ Commercial analysis completed for deal ${dealId}`);

    } catch (error) {
      console.error(`❌ Persistent commercial analysis failed:`, error);
      throw error;
    }
  }

  /**
   * Update job progress in database - IDENTICAL to Clinical
   */
  private async updateJobProgress(jobId: string, progress: number, currentStep: string): Promise<void> {
    try {
      await storage.updateBackgroundJob(jobId, {
        progress,
        currentStep
      });
    } catch (error) {
      console.error(`❌ Failed to update job progress for ${jobId}:`, error);
    }
  }

  /**
   * Broadcast progress updates via WebSocket - ENHANCED for incremental saves tracking
   */
  private async broadcastProgress(jobId: string, jobState: CommercialJobState): Promise<void> {
    try {
      // Get current progress from database (the source of truth)
      const currentJob = await db
        .select()
        .from(backgroundJobs)
        .where(eq(backgroundJobs.jobId, jobId))
        .limit(1);

      if (currentJob.length > 0 && currentJob[0].status === 'processing' && this.activeJobs.has(jobId)) {
        const jobData = this.activeJobs.get(jobId);
        if (jobData) {
          jobData.lastUpdate = new Date();
          
          // 🎯 ENHANCED: Check actual question completion from incremental saves
          let realProgress = currentJob[0].progress || 0;
          let questionsCompleted = 0;
          let currentQuestionStep = 'Processing commercial analysis...';

          // Check commercialAnswers to get real question completion status
          const analysis = await db
            .select()
            .from(agentAnalyses)
            .where(and(
              eq(agentAnalyses.dealId, jobState.dealId),
              eq(agentAnalyses.agentType, 'Commercial')
            ))
            .limit(1);

          if (analysis.length > 0 && analysis[0].commercialAnswers) {
            questionsCompleted = Object.keys(analysis[0].commercialAnswers).length;
            realProgress = Math.round((questionsCompleted / RAG_COMMERCIAL_QUESTIONS.length) * 100);
            
            if (questionsCompleted > 0) {
              const latestQuestionId = Object.keys(analysis[0].commercialAnswers).pop();
              const latestQuestion = RAG_COMMERCIAL_QUESTIONS.find(q => q.id === latestQuestionId);
              if (latestQuestion) {
                currentQuestionStep = `Completed: ${latestQuestion.question}`;
              }
            }
          }
          
          // Update job state with real data
          jobState.progress = realProgress;
          jobState.currentStep = currentQuestionStep;
          jobState.currentQuestionIndex = questionsCompleted;
          jobState.documentsAnalyzed = questionsCompleted;
          jobState.totalDocuments = RAG_COMMERCIAL_QUESTIONS.length;
          
          // Broadcast enhanced progress to WebSocket clients
          try {
            if (this.websocketManager) {
              this.websocketManager.broadcastJobProgress({
                jobId: parseInt(jobId.replace('commercial-analysis-', '')),
                progress: realProgress,
                status: 'processing',
                currentStep: currentQuestionStep,
                documentName: `Question ${questionsCompleted}/${RAG_COMMERCIAL_QUESTIONS.length}`,
                questionsCompleted: questionsCompleted,
                totalQuestions: RAG_COMMERCIAL_QUESTIONS.length
              }, jobState.dealId);
            }
          } catch (wsError) {
            console.log(`⚠️ WebSocket broadcast failed, continuing with progress update`);
          }
          
          console.log(`📡 Broadcasting ENHANCED commercial progress: ${realProgress}% (${questionsCompleted}/${RAG_COMMERCIAL_QUESTIONS.length} questions) - ${currentQuestionStep}`);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to broadcast progress for ${jobId}:`, error);
    }
  }

  /**
   * Set WebSocket manager reference
   */
  setWebSocketManager(websocketManager: any): void {
    this.websocketManager = websocketManager;
  }

  /**
   * Clean up job resources
   */
  private cleanup(jobId: string): void {
    const interval = this.jobIntervals.get(jobId);
    if (interval) {
      clearInterval(interval);
      this.jobIntervals.delete(jobId);
    }
    this.activeJobs.delete(jobId);
  }

  /**
   * Stop commercial analysis
   */
  async stopCommercialAnalysis(jobId: string): Promise<void> {
    try {
      console.log(`🛑 Stopping commercial analysis job ${jobId}`);

      // Clean up intervals
      const interval = this.jobIntervals.get(jobId);
      if (interval) {
        clearInterval(interval);
        this.jobIntervals.delete(jobId);
      }

      // Remove from active jobs
      this.activeJobs.delete(jobId);

      // Update database
      await db
        .update(backgroundJobs)
        .set({
          status: 'cancelled',
          updatedAt: new Date()
        })
        .where(eq(backgroundJobs.jobId, jobId));

      console.log(`✅ Commercial analysis job ${jobId} stopped`);

    } catch (error) {
      console.error(`❌ Failed to stop commercial analysis job ${jobId}:`, error);
    }
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): CommercialJobState | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Get all active commercial analysis jobs
   */
  getAllActiveJobs(): Map<string, CommercialJobState> {
    return this.activeJobs;
  }

  /**
   * Get the standard commercial questions for analysis
   */
  getCommercialQuestions() {
    return RAG_COMMERCIAL_QUESTIONS;
  }
}

export const persistentCommercialAnalysisService = PersistentCommercialAnalysisService.getInstance();