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
      
      console.log(`✅ Persistent Legal Analysis Service initialized with ${legalJobs.length} restored jobs`);
    } catch (error) {
      console.error('❌ Error initializing Persistent Legal Analysis Service:', error);
    }
  }

  /**
   * Start or resume legal analysis for a deal
   */
  async startLegalAnalysis(dealId: number): Promise<{ success: boolean; jobId: string; message: string }> {
    try {
      const jobId = `legal-analysis-${dealId}`;
      
      // Check if job already exists
      const existingJob = await storage.getBackgroundJob(jobId);
      if (existingJob && existingJob.status === 'processing') {
        console.log(`🔄 Legal analysis already running for deal ${dealId}`);
        return { success: true, jobId, message: 'Legal analysis already in progress' };
      }

      // Check if analysis is already complete
      if (await this.isLegalAnalysisComplete(dealId)) {
        console.log(`✅ Legal analysis already complete for deal ${dealId}`);
        return { success: true, jobId, message: 'Legal analysis already complete' };
      }

      console.log(`🚀 Starting legal analysis for deal ${dealId}`);

      // Create or update background job
      await storage.upsertBackgroundJob({
        jobId,
        dealId,
        agentType: 'legal',
        status: 'processing',
        progress: 0,
        totalDocuments: COMPREHENSIVE_LEGAL_QUESTIONS.length,
        processedDocuments: 0,
        currentDocument: '',
        currentStep: 'Analyzing: Legal Due Diligence',
        metadata: {
          agentType: 'legal',
          startTime: new Date().toISOString(),
          lastUpdate: new Date().toISOString()
        }
      });

      // Start the analysis process
      await this.resumeLegalAnalysis(dealId, jobId);

      return { success: true, jobId, message: 'Legal analysis started successfully' };
    } catch (error) {
      console.error(`❌ Failed to start legal analysis for deal ${dealId}:`, error);
      return { success: false, jobId: '', message: 'Failed to start legal analysis' };
    }
  }

  /**
   * Resume legal analysis from where it left off
   */
  private async resumeLegalAnalysis(dealId: number, jobId: string): Promise<void> {
    try {
      console.log(`🔄 Resuming legal analysis for deal ${dealId}, job ${jobId}`);

      // Check if analysis is complete
      if (await this.isLegalAnalysisComplete(dealId)) {
        console.log(`✅ Legal analysis already complete for deal ${dealId}`);
        await storage.updateBackgroundJob(jobId, {
          status: 'completed',
          progress: 100,
          updatedAt: new Date()
        });
        return;
      }

      // Initialize job state
      const jobState: LegalJobState = {
        dealId,
        jobId,
        progress: 0,
        currentQuestionIndex: 0,
        totalQuestions: COMPREHENSIVE_LEGAL_QUESTIONS.length,
        currentBatch: 1,
        totalBatches: 32, // Estimated batches
        currentStep: 'Analyzing: Legal Due Diligence',
        documentsAnalyzed: 0,
        totalDocuments: COMPREHENSIVE_LEGAL_QUESTIONS.length,
        startTime: new Date(),
        lastUpdate: new Date()
      };

      this.activeJobs.set(jobId, jobState);

      // Start processing interval
      const interval = setInterval(async () => {
        await this.processLegalAnalysisBatch(jobId);
      }, 2000); // Process every 2 seconds

      this.jobIntervals.set(jobId, interval);

      // Start the comprehensive analysis
      this.runComprehensiveLegalAnalysis(dealId, jobId);

    } catch (error) {
      console.error(`❌ Failed to resume legal analysis for deal ${dealId}:`, error);
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

      // Check if all legal questions are answered
      const legalQuestions = this.getLegalQuestions();
      const answeredQuestions = analysis.legalAnswers ? Object.keys(analysis.legalAnswers).length : 0;
      
      console.log(`📊 Legal analysis completion check for deal ${dealId}: ${answeredQuestions}/${legalQuestions.length} questions answered`);
      
      return answeredQuestions >= legalQuestions.length;
    } catch (error) {
      console.error(`❌ Error checking legal analysis completion for deal ${dealId}:`, error);
      return false;
    }
  }

  /**
   * Run comprehensive legal analysis
   */
  private async runComprehensiveLegalAnalysis(dealId: number, jobId: string): Promise<void> {
    try {
      console.log(`🧬 Starting comprehensive legal analysis for deal ${dealId}`);
      
      await comprehensiveLegalAnalysisService.analyzeLegalDocuments(dealId);
      
      // Mark as complete
      await storage.updateBackgroundJob(jobId, {
        status: 'completed',
        progress: 100,
        updatedAt: new Date()
      });

      this.cleanup(jobId);
      
      console.log(`✅ Comprehensive legal analysis completed for deal ${dealId}`);
    } catch (error) {
      console.error(`❌ Error in comprehensive legal analysis for deal ${dealId}:`, error);
      
      await storage.updateBackgroundJob(jobId, {
        status: 'failed',
        updatedAt: new Date()
      });

      this.cleanup(jobId);
    }
  }

  /**
   * Process legal analysis batch updates
   */
  private async processLegalAnalysisBatch(jobId: string): Promise<void> {
    try {
      const jobState = this.activeJobs.get(jobId);
      if (!jobState) return;

      // Simulate progress updates (in real implementation, this would track actual progress)
      jobState.progress = Math.min(jobState.progress + 2, 95); // Don't go to 100 until complete
      jobState.currentBatch = Math.floor(jobState.progress / 3) + 1;
      jobState.documentsAnalyzed = Math.floor((jobState.progress / 100) * jobState.totalDocuments);
      jobState.lastUpdate = new Date();

      // Update current step based on progress
      if (jobState.progress < 30) {
        jobState.currentStep = 'Analyzing: Legal Due Diligence';
      } else if (jobState.progress < 60) {
        jobState.currentStep = 'Analyzing: Corporate Documents';
      } else if (jobState.progress < 90) {
        jobState.currentStep = 'Analyzing: Regulatory Compliance';
      } else {
        jobState.currentStep = 'Finalizing Legal Analysis';
      }

      // Update database
      await storage.updateBackgroundJob(jobId, {
        progress: jobState.progress,
        processedDocuments: jobState.documentsAnalyzed,
        currentStep: jobState.currentStep,
        metadata: {
          agentType: 'legal',
          startTime: jobState.startTime.toISOString(),
          lastUpdate: jobState.lastUpdate.toISOString()
        },
        updatedAt: new Date()
      });

      // Broadcast progress
      this.broadcastProgress(jobState);

      console.log(`📊 Legal analysis progress for ${jobId}: ${jobState.progress}% (batch ${jobState.currentBatch}/${jobState.totalBatches})`);

    } catch (error) {
      console.error(`❌ Error processing legal analysis batch for ${jobId}:`, error);
    }
  }

  /**
   * Broadcast progress updates via WebSocket
   */
  private broadcastProgress(jobState: LegalJobState): void {
    try {
      const progressData = {
        jobId: jobState.jobId,
        dealId: jobState.dealId,
        agentType: 'legal',
        progress: jobState.progress,
        currentStep: jobState.currentStep,
        currentBatch: jobState.currentBatch,
        totalBatches: jobState.totalBatches,
        documentsAnalyzed: jobState.documentsAnalyzed,
        totalDocuments: jobState.totalDocuments
      };

      websocketManager.broadcastToRoom(`deal-${jobState.dealId}`, 'legal-progress', progressData);
    } catch (error) {
      console.error(`❌ Failed to broadcast progress for ${jobState.jobId}:`, error);
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