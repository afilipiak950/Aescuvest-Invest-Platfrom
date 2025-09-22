/**
 * Persistent Legal Analysis Service
 * Ensures legal analysis jobs continue running regardless of server restarts or user sessions
 * Based on the proven clinical analysis architecture
 */

import { RAGPoweredLegalAgent, RAG_LEGAL_QUESTIONS } from './ragPoweredLegalAgent';
import { db } from '../db';
import { agentAnalyses, backgroundJobs } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface LegalJobState {
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

export class PersistentLegalAnalysisService {
  private static instance: PersistentLegalAnalysisService;
  private activeJobs = new Map<string, LegalJobState>();
  private jobIntervals = new Map<string, NodeJS.Timeout>();

  static getInstance(): PersistentLegalAnalysisService {
    if (!PersistentLegalAnalysisService.instance) {
      PersistentLegalAnalysisService.instance = new PersistentLegalAnalysisService();
    }
    return PersistentLegalAnalysisService.instance;
  }

  /**
   * Initialize and restore any incomplete legal analysis jobs
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing RAG-Powered Legal Analysis Service...');
      
      // Check for incomplete RAG legal analysis jobs
      const incompleteJobs = await db
        .select()
        .from(backgroundJobs)
        .where(and(
          eq(backgroundJobs.agentType, 'Legal'),
          eq(backgroundJobs.status, 'processing')
        ));

      console.log(`🔄 Found ${incompleteJobs.length} incomplete RAG legal analysis jobs`);

      for (const job of incompleteJobs) {
        await this.resumeLegalAnalysis(job.dealId, job.jobId);
      }
      
      console.log('✅ RAG-Powered Legal Analysis Service initialized');
    } catch (error) {
      console.error('❌ Error initializing RAG Legal Analysis Service:', error);
    }
  }

  /**
   * Start a new persistent legal analysis job - FORCES fresh start like Clinical
   */
  async startLegalAnalysis(dealId: number): Promise<string> {
    const jobId = `rag_legal_analysis_${dealId}_${Date.now()}`;
    
    console.log(`⚖️ Starting FRESH RAG-powered legal analysis for deal ${dealId}`);

    // ALWAYS delete existing job to force fresh start - EXACT Clinical behavior
    const existingJobs = await db
      .select()
      .from(backgroundJobs)
      .where(and(
        eq(backgroundJobs.dealId, dealId),
        eq(backgroundJobs.agentType, 'Legal')
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

    // Create new background job record
    await db.insert(backgroundJobs).values({
      jobId,
      dealId,
      jobType: 'rag_legal_analysis',
      agentType: 'Legal',
      status: 'processing',
      progress: 0,
      processedDocuments: 0,
      totalDocuments: 13, // 13 legal questions
      currentStep: 'Initializing RAG legal analysis...',
      metadata: JSON.stringify({
        startTime: Date.now(),
        analysisType: 'comprehensive_rag_legal',
        ragEnabled: true,
        questionCount: 13,
        expectedLayers: 52 // 13 questions × 4 RAG layers each
      }),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // CRITICAL FIX: Clear existing analysis data before starting fresh analysis
    console.log(`🧹 Clearing existing legal analysis data for deal ${dealId}`);
    try {
      await db
        .delete(agentAnalyses)
        .where(and(
          eq(agentAnalyses.dealId, dealId),
          eq(agentAnalyses.agentType, 'Legal')
        ));
      console.log(`✅ Successfully cleared existing legal analysis for deal ${dealId}`);
    } catch (error) {
      console.log(`⚠️ No existing legal analysis to clear for deal ${dealId}: ${error.message}`);
    }

    // Start the RAG analysis process
    await this.processLegalAnalysis(dealId, jobId);
    
    return jobId;
  }

  /**
   * Resume an interrupted legal analysis job - IDENTICAL to Clinical
   */
  private async resumeLegalAnalysis(dealId: number, jobId: string): Promise<void> {
    try {
      console.log(`🔄 Resuming legal analysis job ${jobId} for deal ${dealId}`);

      // Get job state from database
      const job = await storage.getBackgroundJobById(jobId);
      if (!job) {
        console.error(`❌ Job ${jobId} not found in database`);
        return;
      }

      // Check if analysis is FULLY completed (all questions answered)
      const existingAnalysis = await db
        .select()
        .from(agentAnalyses)
        .where(and(
          eq(agentAnalyses.dealId, dealId),
          eq(agentAnalyses.agentType, 'Legal')
        ))
        .orderBy(agentAnalyses.createdAt)
        .limit(1);
      
      const expectedQuestions = RAG_LEGAL_QUESTIONS;
      const answeredQuestions = existingAnalysis.length > 0 && existingAnalysis[0].legalAnswers ? 
        Object.keys(existingAnalysis[0].legalAnswers).length : 0;
      
      if (existingAnalysis.length > 0 && answeredQuestions >= expectedQuestions.length) {
        console.log(`✅ Legal analysis fully completed for deal ${dealId} (${answeredQuestions}/${expectedQuestions.length} questions)`);
        await db
          .update(backgroundJobs)
          .set({
            status: 'completed',
            progress: 100,
            updatedAt: new Date()
          })
          .where(eq(backgroundJobs.jobId, jobId));
        return;
      }

      // Analysis is incomplete, continue from where we left off
      console.log(`🔄 Legal analysis incomplete: ${answeredQuestions}/${expectedQuestions.length} questions answered. Continuing...`);
      
      const currentProgress = job.progress || 0;
      console.log(`🔄 Resuming RAG legal analysis at ${currentProgress}% completion`);

      // Continue processing from current state
      await this.processLegalAnalysis(dealId, jobId, currentProgress);

    } catch (error) {
      console.error(`❌ Failed to resume legal analysis for deal ${dealId}:`, error);
      // Mark job as failed
      await db
        .update(backgroundJobs)
        .set({
          status: 'failed',
          error: error.message,
          updatedAt: new Date()
        })
        .where(eq(backgroundJobs.jobId, jobId));
    }
  }

  /**
   * Process legal analysis with persistent state tracking - IDENTICAL to Clinical
   */
  private async processLegalAnalysis(dealId: number, jobId: string, startProgress: number = 0): Promise<void> {
    try {
      // Track job in memory for real-time updates - EXACTLY like Clinical
      const jobState: LegalJobState = {
        dealId,
        jobId,
        progress: startProgress,
        currentQuestionIndex: Math.floor(startProgress / 100 * RAG_LEGAL_QUESTIONS.length), // Use actual question count
        totalQuestions: RAG_LEGAL_QUESTIONS.length,
        currentBatch: 0,
        totalBatches: 0,
        currentStep: 'Processing legal analysis...',
        documentsAnalyzed: 0,
        totalDocuments: 0,
        startTime: new Date(),
        lastUpdate: new Date()
      };

      this.activeJobs.set(jobId, jobState);

      // Set up progress monitoring interval - EXACTLY like Clinical
      const progressInterval = setInterval(async () => {
        console.log(`🔄 Legal progress monitoring tick for job ${jobId}`);
        await this.broadcastProgress(jobId, jobState);
      }, 2000);

      this.jobIntervals.set(jobId, progressInterval);

      // Delegate to RAG-powered legal analysis agent - EXACTLY like Clinical
      console.log(`🔍 Delegating to RAG-powered legal analysis agent...`);
      
      // Hook into the new RAG service but with persistent tracking - EXACTLY like Clinical
      await this.runPersistentAnalysis(dealId, jobId, jobState);

    } catch (error) {
      console.error(`❌ Legal analysis failed for deal ${dealId}:`, error);
      
      // Clean up - EXACTLY like Clinical
      const interval = this.jobIntervals.get(jobId);
      if (interval) {
        clearInterval(interval);
        this.jobIntervals.delete(jobId);
      }
      this.activeJobs.delete(jobId);

      // Mark as failed - EXACTLY like Clinical
      await db
        .update(backgroundJobs)
        .set({
          status: 'failed',
          error: error.message,
          updatedAt: new Date()
        })
        .where(eq(backgroundJobs.jobId, jobId));

      throw error;
    }
  }

  /**
   * Run the actual analysis with persistent state updates - IDENTICAL to Clinical
   */
  private async runPersistentAnalysis(dealId: number, jobId: string, jobState: LegalJobState): Promise<void> {
    try {
      // Update job state - EXACTLY like Clinical
      jobState.currentStep = 'Running comprehensive legal analysis...';
      await this.updateJobProgress(jobId, jobState.progress, jobState.currentStep);

      // Call the new RAG-powered legal analysis agent
      const ragAgent = new RAGPoweredLegalAgent(dealId, jobId);
      await ragAgent.runComprehensiveAnalysis();

      // Mark as completed - EXACTLY like Clinical
      jobState.progress = 100;
      jobState.currentStep = 'RAG legal analysis completed';
      
      await db
        .update(backgroundJobs)
        .set({
          status: 'completed',
          progress: 100,
          currentStep: 'RAG legal analysis completed',
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(backgroundJobs.jobId, jobId));

      // Clean up - EXACTLY like Clinical
      const interval = this.jobIntervals.get(jobId);
      if (interval) {
        clearInterval(interval);
        this.jobIntervals.delete(jobId);
      }
      this.activeJobs.delete(jobId);
      
      // Final progress broadcast to show 100% completion
      console.log(`📡 Broadcasting FINAL legal progress: 100% - Legal analysis completed`);
      if (this.websocketManager) {
        try {
          this.websocketManager.broadcastJobProgress({
            jobId: parseInt(jobId.replace('legal-analysis-', '')),
            progress: 100,
            status: 'completed',
            currentStep: 'Legal analysis completed',
            documentName: ''
          }, jobState.dealId);
        } catch (wsError) {
          console.log(`⚠️ Final WebSocket broadcast failed: ${wsError.message}`);
        }
      }

      console.log(`✅ Legal analysis completed for deal ${dealId}`);

    } catch (error) {
      console.error(`❌ Persistent legal analysis failed:`, error);
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
        currentStep,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error(`❌ Failed to update job progress for ${jobId}:`, error);
    }
  }

  /**
   * Broadcast progress updates via WebSocket - READS real progress from database
   */
  private async broadcastProgress(jobId: string, jobState: LegalJobState): Promise<void> {
    try {
      // Get current progress from database (the source of truth)
      const currentJob = await storage.getBackgroundJobById(jobId);
      if (currentJob && currentJob.status === 'processing' && this.activeJobs.has(jobId)) {
        const jobData = this.activeJobs.get(jobId);
        if (jobData) {
          jobData.lastUpdate = new Date();
          
          // Use REAL progress from database, not our stale memory
          const realProgress = currentJob.progress || 0;
          const realCurrentStep = currentJob.currentStep || jobState.currentStep;
          const realCurrentDocumentName = currentJob.currentDocumentName || '';
          const realProcessedDocuments = currentJob.processedDocuments || 0;
          const realTotalDocuments = currentJob.totalDocuments || 0;
          
          // Update our memory with real values from comprehensive service
          jobState.progress = realProgress;
          jobState.currentStep = realCurrentStep;
          jobState.documentsAnalyzed = realProcessedDocuments;
          jobState.totalDocuments = realTotalDocuments;
          
          // Broadcast via WebSocket with REAL progress from comprehensive service
          const progressData = {
            jobId,
            dealId: jobState.dealId,
            agentType: 'legal',
            progress: realProgress,
            currentStep: realCurrentStep,
            currentDocumentName: realCurrentDocumentName,
            documentsAnalyzed: realProcessedDocuments,
            totalDocuments: realTotalDocuments,
            processedDocuments: realProcessedDocuments
          };

          // Broadcast real progress to WebSocket clients
          try {
            if (this.websocketManager) {
              // Use the correct method name and format to match WebSocket manager interface
              this.websocketManager.broadcastJobProgress({
                jobId: parseInt(jobId.replace('legal-analysis-', '')),
                progress: realProgress,
                status: 'processing',
                currentStep: realCurrentStep,
                documentName: realCurrentDocumentName
              }, jobState.dealId);
            }
          } catch (wsError) {
            console.log(`⚠️ WebSocket broadcast failed, continuing with progress update`);
          }
          console.log(`📡 Broadcasting REAL legal progress: ${realProgress}% - ${realCurrentStep}`);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to broadcast progress for ${jobId}:`, error);
    }
  }

  /**
   * Check if legal analysis is complete by verifying all questions are answered
   */
  private async isLegalAnalysisComplete(dealId: number): Promise<boolean> {
    try {
      const analysis = await storage.getAgentAnalysis(dealId, 'Legal');
      if (!analysis) {
        return false;
      }

      // Check if analysis is already marked as completed
      if (analysis.status === 'completed') {
        console.log(`✅ Legal analysis already completed for deal ${dealId}`);
        return true;
      }

      // Check if all legal questions are answered
      const legalQuestions = COMPREHENSIVE_LEGAL_QUESTIONS;
      const answeredQuestions = analysis.legalAnswers ? Object.keys(analysis.legalAnswers).length : 0;
      
      console.log(`📊 Legal analysis completion check for deal ${dealId}: ${answeredQuestions}/${legalQuestions.length} questions answered`);
      
      const isComplete = answeredQuestions >= legalQuestions.length;
      
      // If complete but not marked as such, mark as completed
      if (isComplete && analysis.status !== 'completed') {
        console.log(`🎯 Legal analysis complete! Marking as finalized for deal ${dealId}`);
        
        // Mark as completed in database using the analysis ID
        await storage.updateAgentAnalysis(analysis.id, {
          status: 'completed',
          progress: 100,
          updatedAt: new Date()
        });
        
        return true;
      }
      
      return isComplete;
    } catch (error) {
      console.error(`❌ Error checking legal analysis completion for deal ${dealId}:`, error);
      return false;
    }
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
   * Stop legal analysis
   */
  async stopLegalAnalysis(jobId: string): Promise<void> {
    try {
      console.log(`🛑 Stopping legal analysis job ${jobId}`);

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

      console.log(`✅ Legal analysis job ${jobId} stopped`);

    } catch (error) {
      console.error(`❌ Failed to stop legal analysis job ${jobId}:`, error);
    }
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): LegalJobState | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Get all active legal analysis jobs
   */
  getAllActiveJobs(): Map<string, LegalJobState> {
    return this.activeJobs;
  }

  /**
   * Get the standard legal questions for analysis
   */
  getLegalQuestions() {
    return COMPREHENSIVE_LEGAL_QUESTIONS;
  }
}

export const persistentLegalAnalysisService = PersistentLegalAnalysisService.getInstance();