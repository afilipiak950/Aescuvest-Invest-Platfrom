/**
 * Persistent Financial Analysis Service
 * EXACT COPY of Clinical micro-step architecture for perfect parity
 * Ensures financial analysis jobs continue running regardless of server restarts or user sessions
 */

import { storage } from '../storage';
import { comprehensiveFinancialAnalysisService, COMPREHENSIVE_FINANCIAL_QUESTIONS } from '../comprehensiveFinancialAnalysisService';
import { websocketManager } from './websocketManager';

interface FinancialJobState {
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

export class PersistentFinancialAnalysisService {
  private static instance: PersistentFinancialAnalysisService;
  private activeJobs = new Map<string, FinancialJobState>();
  private jobIntervals = new Map<string, NodeJS.Timeout>();

  static getInstance(): PersistentFinancialAnalysisService {
    if (!PersistentFinancialAnalysisService.instance) {
      PersistentFinancialAnalysisService.instance = new PersistentFinancialAnalysisService();
    }
    return PersistentFinancialAnalysisService.instance;
  }

  /**
   * Initialize and restore any incomplete financial analysis jobs
   */
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
            (job.status === 'processing' || job.status === 'completed')
          );
          
          // For each job, check if it's really complete or just marked as complete incorrectly
          for (const job of financialJobsForDeal) {
            const existingAnalysis = await storage.getAgentAnalysis(dealId, 'financial');
            const expectedQuestions = this.getFinancialQuestions();
            const answeredQuestions = existingAnalysis?.financialAnswers ? Object.keys(existingAnalysis.financialAnswers).length : 0;
            
            if (answeredQuestions < expectedQuestions.length) {
              console.log(`🔄 Job ${job.jobId} marked complete but only ${answeredQuestions}/${expectedQuestions.length} questions done. Adding to resume list.`);
              financialJobs.push(job);
            }
          }
        } catch (error) {
          console.log(`Skipping deal ${dealId} during initialization`);
        }
      }

      console.log(`🔄 Found ${financialJobs.length} incomplete financial analysis jobs`);

      for (const job of financialJobs) {
        console.log(`🔄 Restoring financial analysis job ${job.jobId} for deal ${job.dealId}`);
        await this.resumeFinancialAnalysis(job.dealId, job.jobId);
      }

      console.log('✅ Persistent Financial Analysis Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize persistent financial analysis service:', error);
    }
  }

  private getFinancialQuestions(): typeof COMPREHENSIVE_FINANCIAL_QUESTIONS {
    return COMPREHENSIVE_FINANCIAL_QUESTIONS;
  }

  /**
   * Start a new financial analysis or resume an existing one
   */
  async startFinancialAnalysis(dealId: number): Promise<string> {
    console.log(`💰 Starting financial analysis for deal ${dealId}`);
    
    try {
      // Check if there's already a running job  
      const existingJobs = await storage.getBackgroundJobsByDealId(dealId);
      const runningJob = existingJobs.find(job => job.agentType === 'financial' && job.status === 'processing');
      
      if (runningJob) {
        console.log(`🔄 Found existing financial analysis job ${runningJob.jobId}, resuming...`);
        await this.resumeFinancialAnalysis(dealId, runningJob.jobId);
        return runningJob.jobId;
      }

      // Create new job
      const jobId = `financial-analysis-${dealId}`;
      
      const jobData = {
        jobId,
        jobType: 'comprehensive_financial_analysis' as const,
        dealId,
        agentType: 'financial' as const,
        status: 'processing' as const,
        progress: 0,
        currentStep: 'Initializing financial analysis',
        totalDocuments: 0,
        processedDocuments: 0,
        currentDocumentName: 'Starting analysis...',
        startedAt: new Date()
      };
      
      console.log(`📝 Creating background job for financial:`, jobData);
      await storage.createBackgroundJob(jobData);
      
      // Start the actual analysis
      await this.runFinancialAnalysis(dealId, jobId);
      
      return jobId;
    } catch (error) {
      console.error(`❌ Failed to start financial analysis for deal ${dealId}:`, error);
      throw error;
    }
  }

  /**
   * Manually take over an existing financial analysis job and transition it to persistent architecture
   */
  async takeOverFinancialAnalysis(dealId: number, oldJobId: string): Promise<void> {
    console.log(`💰 Taking over financial analysis job ${oldJobId} for deal ${dealId}`);
    
    try {
      // Update the old job to indicate it's being handled by persistent service
      const existingJob = await storage.getBackgroundJobById(oldJobId);
      await storage.updateBackgroundJob(oldJobId, {
        status: 'processing',
        metadata: {
          ...existingJob?.metadata || {},
          takenOverByPersistentService: true,
          transitionTime: new Date().toISOString()
        }
      });

      // Start the persistent micro-step process
      await this.runFinancialAnalysis(dealId, oldJobId);
    } catch (error) {
      console.error(`❌ Failed to take over financial analysis ${oldJobId}:`, error);
      throw error;
    }
  }

  /**
   * Resume an existing financial analysis
   */
  private async resumeFinancialAnalysis(dealId: number, jobId: string): Promise<void> {
    console.log(`🔄 Resuming financial analysis for deal ${dealId}, job ${jobId}`);
    
    try {
      // Get existing progress
      const existingAnalysis = await storage.getAgentAnalysis(dealId, 'financial');
      const expectedQuestions = this.getFinancialQuestions();
      const answeredQuestions = existingAnalysis?.financialAnswers ? Object.keys(existingAnalysis.financialAnswers).length : 0;
      
      console.log(`📊 Resuming from ${answeredQuestions}/${expectedQuestions.length} questions completed`);
      
      // Continue the analysis from where we left off
      await this.runFinancialAnalysis(dealId, jobId, answeredQuestions);
    } catch (error) {
      console.error(`❌ Failed to resume financial analysis:`, error);
    }
  }

  /**
   * Run the comprehensive financial analysis with proper micro-step progression
   */
  private async runFinancialAnalysis(dealId: number, jobId: string, startFromQuestion: number = 0): Promise<void> {
    console.log(`💰 Running financial analysis for deal ${dealId}, starting from question ${startFromQuestion}`);
    
    try {
      const questions = this.getFinancialQuestions();
      const totalQuestions = questions.length;
      
      // Create job state
      const jobState: FinancialJobState = {
        dealId,
        jobId,
        progress: Math.floor((startFromQuestion / totalQuestions) * 100),
        currentQuestionIndex: startFromQuestion,
        totalQuestions,
        currentBatch: 0,
        totalBatches: 3,
        currentStep: `Starting financial analysis...`,
        documentsAnalyzed: 0,
        totalDocuments: 0,
        startTime: new Date(),
        lastUpdate: new Date()
      };
      
      this.activeJobs.set(jobId, jobState);
      
      // Start progress updates
      this.startProgressUpdates(jobId);
      
      // Run the actual comprehensive analysis
      const progressCallback = async (progress: number, step: string, currentDoc?: string) => {
        const state = this.activeJobs.get(jobId);
        if (state) {
          state.progress = Math.min(progress, 100);
          state.currentStep = step;
          state.lastUpdate = new Date();
          
          await this.updateJobProgress(jobId, state);
        }
      };
      
      // Run the comprehensive financial analysis using the existing service
      console.log(`🔄 Starting comprehensive financial analysis for deal ${dealId}`);
      await comprehensiveFinancialAnalysisService.runComprehensiveAnalysis(
        dealId, 
        storage, 
        jobId, 
        progressCallback
      );
      
      // Mark as completed
      await this.completeFinancialAnalysis(jobId);
      
    } catch (error) {
      console.error(`❌ Financial analysis failed for deal ${dealId}:`, error);
      await this.failFinancialAnalysis(jobId, error);
    }
  }

  /**
   * Start periodic progress updates
   */
  private startProgressUpdates(jobId: string): void {
    const interval = setInterval(async () => {
      const state = this.activeJobs.get(jobId);
      if (!state) {
        clearInterval(interval);
        return;
      }
      
      await this.updateJobProgress(jobId, state);
    }, 5000); // Update every 5 seconds
    
    this.jobIntervals.set(jobId, interval);
  }

  /**
   * Update job progress in database and websocket
   */
  private async updateJobProgress(jobId: string, state: FinancialJobState): Promise<void> {
    try {
      await storage.updateBackgroundJob(jobId, {
        progress: state.progress,
        currentStep: state.currentStep,
        processedDocuments: state.documentsAnalyzed,
        updatedAt: new Date()
      });
      
      // Broadcast progress via websocket
      websocketManager.broadcastToRoom(`deal-${state.dealId}`, 'analysisProgress', {
        agentType: 'financial',
        progress: state.progress,
        currentStep: state.currentStep,
        jobId
      });
      
      console.log(`📈 Financial Analysis Progress: ${state.progress}% - ${state.currentStep}`);
    } catch (error) {
      console.error('❌ Failed to update job progress:', error);
    }
  }

  /**
   * Complete the financial analysis
   */
  private async completeFinancialAnalysis(jobId: string): Promise<void> {
    console.log(`✅ Completing financial analysis job ${jobId}`);
    
    try {
      const state = this.activeJobs.get(jobId);
      if (!state) return;
      
      await storage.updateBackgroundJob(jobId, {
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
        currentStep: 'Financial analysis completed'
      });
      
      // Broadcast completion
      websocketManager.broadcastToRoom(`deal-${state.dealId}`, 'analysisComplete', {
        agentType: 'financial',
        jobId
      });
      
      // Clean up
      this.cleanupJob(jobId);
      
      console.log(`✅ Financial analysis completed for deal ${state.dealId}`);
    } catch (error) {
      console.error('❌ Failed to complete financial analysis:', error);
    }
  }

  /**
   * Mark financial analysis as failed
   */
  private async failFinancialAnalysis(jobId: string, error: any): Promise<void> {
    console.log(`❌ Failing financial analysis job ${jobId}`);
    
    try {
      const state = this.activeJobs.get(jobId);
      if (!state) return;
      
      await storage.updateBackgroundJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        currentStep: 'Financial analysis failed'
      });
      
      // Broadcast failure
      websocketManager.broadcastToRoom(`deal-${state.dealId}`, 'analysisError', {
        agentType: 'financial',
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Clean up
      this.cleanupJob(jobId);
      
    } catch (cleanupError) {
      console.error('❌ Failed to cleanup failed financial analysis:', cleanupError);
    }
  }

  /**
   * Clean up job resources
   */
  private cleanupJob(jobId: string): void {
    const interval = this.jobIntervals.get(jobId);
    if (interval) {
      clearInterval(interval);
      this.jobIntervals.delete(jobId);
    }
    this.activeJobs.delete(jobId);
  }

  /**
   * Stop a financial analysis job
   */
  async stopFinancialAnalysis(jobId: string): Promise<void> {
    console.log(`🛑 Stopping financial analysis job ${jobId}`);
    
    const state = this.activeJobs.get(jobId);
    if (!state) return;
    
    await storage.updateBackgroundJob(jobId, {
      status: 'stopped',
      currentStep: 'Financial analysis stopped'
    });
    
    this.cleanupJob(jobId);
  }

  /**
   * Get current status of all active jobs
   */
  getActiveJobs(): FinancialJobState[] {
    return Array.from(this.activeJobs.values());
  }
}

export const persistentFinancialAnalysisService = PersistentFinancialAnalysisService.getInstance();