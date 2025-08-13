/**
 * Persistent Legal Analysis Service
 * Ensures legal analysis jobs continue running regardless of server restarts or user sessions
 * Based on the proven clinical analysis architecture
 */

import { storage } from '../storage';
import { comprehensiveLegalAnalysisService, COMPREHENSIVE_LEGAL_QUESTIONS } from '../comprehensiveLegalAnalysisService';
import { websocketManager } from './websocketManager';

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
      console.log('🔄 Initializing Persistent Legal Analysis Service...');
      
      // Find all incomplete legal analysis jobs by checking each known deal
      const knownDealIds = [33, 30, 29, 28, 27, 22]; // Add more deal IDs as needed
      const legalJobs = [];
      
      for (const dealId of knownDealIds) {
        try {
          const dealJobs = await storage.getBackgroundJobsByDealId(dealId);
          const legalJobsForDeal = dealJobs.filter(job => 
            job.agentType === 'legal' && 
            job.jobType === 'comprehensive_legal_analysis' &&
            (job.status === 'processing' || job.status === 'completed')
          );
          
          // For each job, check if it's really complete or just marked as complete incorrectly
          for (const job of legalJobsForDeal) {
            const existingAnalysis = await storage.getAgentAnalysis(dealId, 'legal');
            const expectedQuestions = COMPREHENSIVE_LEGAL_QUESTIONS;
            const answeredQuestions = existingAnalysis?.legalAnswers ? Object.keys(existingAnalysis.legalAnswers).length : 0;
            
            if (answeredQuestions < expectedQuestions.length) {
              console.log(`🔄 Job ${job.jobId} marked complete but only ${answeredQuestions}/${expectedQuestions.length} questions done. Adding to resume list.`);
              legalJobs.push(job);
            }
          }
        } catch (error) {
          console.log(`Skipping deal ${dealId} during initialization`);
        }
      }

      console.log(`🔄 Found ${legalJobs.length} incomplete legal analysis jobs`);

      for (const job of legalJobs) {
        await this.resumeLegalAnalysis(job.dealId, job.jobId);
      }
      
      console.log('✅ Persistent Legal Analysis Service initialized');
    } catch (error) {
      console.error('❌ Error initializing Persistent Legal Analysis Service:', error);
    }
  }

  /**
   * Start a new persistent legal analysis job - IDENTICAL to Clinical
   */
  async startLegalAnalysis(dealId: number): Promise<string> {
    const jobId = `legal-analysis-${dealId}`;
    
    console.log(`🔍 Starting persistent legal analysis for deal ${dealId}`);

    // Check if job already exists and is running
    const existingJob = await storage.getBackgroundJobById(jobId);
    if (existingJob && existingJob.status === 'processing') {
      console.log(`🔄 Legal analysis already running for deal ${dealId}, resuming...`);
      await this.resumeLegalAnalysis(dealId, jobId);
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
      jobType: 'comprehensive_legal_analysis',
      dealId,
      agentType: 'legal',
      status: 'processing',
      progress: 0,
      totalDocuments: 0,
      processedDocuments: 0,
      currentStep: 'Initializing legal analysis...',
      startedAt: new Date()
    });

    // Start the analysis process
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
      const existingAnalysis = await storage.getAgentAnalysis(dealId, 'legal');
      const expectedQuestions = COMPREHENSIVE_LEGAL_QUESTIONS;
      const answeredQuestions = existingAnalysis?.legalAnswers ? Object.keys(existingAnalysis.legalAnswers).length : 0;
      
      if (existingAnalysis && answeredQuestions >= expectedQuestions.length) {
        console.log(`✅ Legal analysis fully completed for deal ${dealId} (${answeredQuestions}/${expectedQuestions.length} questions)`);
        await storage.updateBackgroundJob(jobId, {
          status: 'completed',
          progress: 100,
          updatedAt: new Date()
        });
        return;
      }

      // Analysis is incomplete, continue from where we left off
      console.log(`🔄 Legal analysis incomplete: ${answeredQuestions}/${expectedQuestions.length} questions answered. Continuing...`);
      
      const currentProgress = job.progress || 0;
      console.log(`🔄 Resuming legal analysis at ${currentProgress}% completion`);

      // Continue processing from current state
      await this.processLegalAnalysis(dealId, jobId, currentProgress);

    } catch (error) {
      console.error(`❌ Failed to resume legal analysis for deal ${dealId}:`, error);
      // Mark job as failed
      await storage.updateBackgroundJob(jobId, {
        status: 'failed',
        error: error.message,
        updatedAt: new Date()
      });
    }
  }

  /**
   * Process legal analysis with persistent state tracking - IDENTICAL to Clinical
   */
  private async processLegalAnalysis(dealId: number, jobId: string, startProgress: number = 0): Promise<void> {
    try {
      console.log(`🔍 Delegating to comprehensive legal analysis service...`);

      // Update job status to show we're starting 
      await storage.updateBackgroundJob(jobId, {
        status: 'processing',
        progress: startProgress,
        currentStep: 'Starting comprehensive legal analysis...',
        updatedAt: new Date()
      });

      // Delegate to the existing comprehensive service
      const result = await comprehensiveLegalAnalysisService.analyzeLegalDocuments(dealId);

      // Update final job status
      await storage.updateBackgroundJob(jobId, {
        status: 'completed',
        progress: 100,
        currentStep: 'Legal analysis completed',
        updatedAt: new Date(),
        completedAt: new Date()
      });

      console.log(`✅ Legal analysis completed for deal ${dealId}`);
      
    } catch (error) {
      console.error(`❌ Legal analysis failed for deal ${dealId}:`, error);
      
      // Mark job as failed
      await storage.updateBackgroundJob(jobId, {
        status: 'failed', 
        error: error.message,
        updatedAt: new Date()
      });
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
      
      // If complete but not marked as such, force finalization
      if (isComplete && analysis.status !== 'completed') {
        console.log(`🎯 Legal analysis complete! Forcing final findings generation for deal ${dealId}`);
        
        // Force completion by regenerating findings with structured format
        await comprehensiveLegalAnalysisService.forceFinalizeAnalysis(dealId, analysis.legalAnswers);
        
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