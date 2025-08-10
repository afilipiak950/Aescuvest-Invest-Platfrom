import pRetry from 'p-retry';
import pLimit from 'p-limit';
import { z } from 'zod';
import { websocketManager } from './websocketManager';
import { storage } from '../storage';

// Environment configuration with fallbacks
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '5');
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // Base delay in ms for exponential backoff

// In-memory job queue for Replit environment (Redis replacement)
interface QueuedJob {
  id: string;
  data: AgentJobData;
  priority: number;
  attempts: number;
  maxAttempts: number;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'retrying';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedReason?: string;
  result?: any;
  progress: number;
}

// Job data schema validation
const AgentJobDataSchema = z.object({
  dealId: z.number(),
  agentType: z.string(),
  documentId: z.number().optional(),
  forceRefresh: z.boolean().default(false),
  priority: z.number().default(1),
  timeout: z.number().default(300000), // 5 minutes default timeout
  metadata: z.record(z.any()).optional()
});

type AgentJobData = z.infer<typeof AgentJobDataSchema>;

interface JobProgress {
  dealId: number;
  agentType: string;
  progress: number;
  processedDocuments: number;
  totalDocuments: number;
  currentDocument?: string;
  currentStep: string;
  status: 'processing' | 'completed' | 'failed' | 'retrying';
  startTime: Date;
  error?: string;
}

class EnterpriseJobQueue {
  private static instance: EnterpriseJobQueue | null = null;
  private jobQueue: QueuedJob[] = [];
  private completedJobs: QueuedJob[] = [];
  private failedJobs: QueuedJob[] = [];
  private activeJobs = new Map<string, JobProgress>();
  private isShuttingDown = false;
  private isProcessing = false;
  private limit = pLimit(CONCURRENCY);
  private jobIdCounter = 0;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    console.log(`🚀 Initializing enterprise job queue with concurrency: ${CONCURRENCY}`);
    this.startProcessing();
  }

  static getInstance(): EnterpriseJobQueue {
    if (!EnterpriseJobQueue.instance) {
      EnterpriseJobQueue.instance = new EnterpriseJobQueue();
    }
    return EnterpriseJobQueue.instance;
  }

  private startProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    // Process queue every 100ms for responsiveness
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 100);
    
    console.log(`✅ Enterprise job queue processor started`);
  }

  private async processQueue() {
    if (this.isProcessing || this.isShuttingDown) {
      return;
    }

    // Sort by priority (higher number = higher priority)
    this.jobQueue.sort((a, b) => b.priority - a.priority);
    
    // Find waiting jobs and process them within concurrency limits
    const waitingJobs = this.jobQueue.filter(job => job.status === 'waiting');
    const activeCount = this.jobQueue.filter(job => job.status === 'active').length;
    
    if (waitingJobs.length > 0 && activeCount < CONCURRENCY) {
      const jobsToProcess = waitingJobs.slice(0, CONCURRENCY - activeCount);
      
      for (const job of jobsToProcess) {
        this.limit(() => this.processJob(job));
      }
    }
  }

  private async processJob(job: QueuedJob): Promise<void> {
    job.status = 'active';
    job.startedAt = new Date();
    
    console.log(`🎯 Processing job ${job.id}: ${job.data.agentType} analysis for deal ${job.data.dealId}`);
    
    try {
      const result = await this.executeJobWithRetry(job);
      
      job.status = 'completed';
      job.completedAt = new Date();
      job.result = result;
      job.progress = 100;
      
      // Move to completed jobs
      this.completedJobs.push(job);
      this.jobQueue = this.jobQueue.filter(j => j.id !== job.id);
      
      // Clean up tracking
      this.activeJobs.delete(job.id);
      
      console.log(`✅ Job ${job.id} completed successfully`);
      
    } catch (error) {
      job.attempts++;
      
      if (job.attempts >= job.maxAttempts) {
        job.status = 'failed';
        job.failedReason = error.message;
        job.completedAt = new Date();
        
        // Move to failed jobs
        this.failedJobs.push(job);
        this.jobQueue = this.jobQueue.filter(j => j.id !== job.id);
        
        console.log(`❌ Job ${job.id} failed permanently: ${error.message}`);
      } else {
        job.status = 'retrying';
        console.log(`🔄 Job ${job.id} retrying (attempt ${job.attempts}/${job.maxAttempts})`);
        
        // Add exponential backoff delay
        setTimeout(() => {
          if (job.status === 'retrying') {
            job.status = 'waiting';
          }
        }, RETRY_DELAY * Math.pow(2, job.attempts - 1));
      }
    }
  }

  async startWorker() {
    // In-memory implementation doesn't need separate worker initialization
    console.log(`✅ Enterprise job worker ready with concurrency ${CONCURRENCY}`);
  }

  async enqueueAgentAnalysis(
    dealId: number,
    agentType: string,
    options: {
      priority?: number;
      timeout?: number;
      forceRefresh?: boolean;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<string> {
    try {
      // Validate input data
      const jobData = AgentJobDataSchema.parse({
        dealId,
        agentType,
        priority: options.priority || 1,
        timeout: options.timeout || 300000,
        forceRefresh: options.forceRefresh || false,
        metadata: options.metadata || {}
      });

      // Create unique job ID
      this.jobIdCounter++;
      const jobId = `${agentType.toLowerCase()}-${dealId}-${this.jobIdCounter}-${Date.now()}`;

      // Create job object
      const job: QueuedJob = {
        id: jobId,
        data: jobData,
        priority: jobData.priority,
        attempts: 0,
        maxAttempts: MAX_RETRIES,
        status: 'waiting',
        createdAt: new Date(),
        progress: 0
      };

      // Add to queue
      this.jobQueue.push(job);

      // Initialize progress tracking
      this.activeJobs.set(jobId, {
        dealId,
        agentType,
        progress: 0,
        processedDocuments: 0,
        totalDocuments: 0,
        currentStep: 'Queued for processing',
        status: 'processing',
        startTime: new Date(),
      });

      console.log(`📋 Enqueued ${agentType} analysis for deal ${dealId} with job ID: ${jobId}`);
      return jobId;

    } catch (error) {
      console.error(`❌ Failed to enqueue ${agentType} analysis for deal ${dealId}:`, error);
      throw new Error(`Failed to enqueue job: ${error.message}`);
    }
  }

  private async executeJobWithRetry(job: QueuedJob): Promise<any> {
    const { dealId, agentType, forceRefresh } = job.data;
    const jobId = job.id;

    console.log(`🎯 Executing ${agentType} analysis for deal ${dealId} (Job: ${jobId})`);

    // Update progress tracking
    const progress: JobProgress = {
      dealId,
      agentType,
      progress: 0,
      processedDocuments: 0,
      totalDocuments: 0,
      currentStep: 'Initializing analysis',
      status: 'processing',
      startTime: new Date(),
    };
    
    this.activeJobs.set(jobId, progress);
    job.progress = 10;
    this.broadcastProgress(jobId, progress);

    // Get documents for the deal
    progress.currentStep = 'Fetching documents';
    job.progress = 20;
    this.broadcastProgress(jobId, progress);
    
    const documents = await storage.getDocumentsByDealId(dealId);
    progress.totalDocuments = documents.length;
    
    console.log(`📄 Found ${documents.length} documents for ${agentType} analysis`);

    if (documents.length === 0) {
      progress.currentStep = 'No documents found';
      progress.status = 'completed';
      progress.progress = 100;
      job.progress = 100;
      this.broadcastProgress(jobId, progress);
      return { message: 'No documents to analyze', findings: [], recommendations: [] };
    }

    // Process documents with retry logic
    progress.currentStep = 'Processing documents with AI analysis';
    const analysisResult = await this.processDocumentsWithRetry(
      job,
      documents,
      agentType,
      progress
    );

    // Save results to database
    progress.currentStep = 'Saving analysis results';
    job.progress = 90;
    this.broadcastProgress(jobId, progress);
    
    await this.saveAnalysisResults(dealId, agentType, analysisResult);
    
    progress.currentStep = 'Analysis completed';
    progress.status = 'completed';
    progress.progress = 100;
    job.progress = 100;
    this.broadcastProgress(jobId, progress);

    console.log(`✅ Completed ${agentType} analysis for deal ${dealId}`);
    return analysisResult;
  }

  private async processDocumentsWithRetry(
    job: QueuedJob,
    documents: any[],
    agentType: string,
    progress: JobProgress
  ): Promise<any> {
    const { analyzeDocument } = await import('./dueDiligence');
    
    let allFindings: any[] = [];
    let allRecommendations: string[] = [];
    let processedCount = 0;

    for (const doc of documents) {
      try {
        progress.currentDocument = doc.name;
        progress.currentStep = `Analyzing: ${doc.name}`;
        
        // Retry individual document analysis with exponential backoff
        const docAnalysis = await pRetry(
          async () => {
            console.log(`🔍 Analyzing document: ${doc.name} with ${agentType} agent`);
            return analyzeDocument(doc.extractedText || doc.ocrText || '', doc.name, agentType as any);
          },
          {
            retries: MAX_RETRIES,
            factor: 2,
            minTimeout: RETRY_DELAY,
            maxTimeout: 30000,
            onFailedAttempt: (error) => {
              console.log(`⚠️ Attempt ${error.attemptNumber} failed for ${doc.name}: ${error.message}`);
            },
          }
        );

        // Accumulate results
        if (docAnalysis.findings) {
          allFindings.push(...docAnalysis.findings);
        }
        if (docAnalysis.recommendations) {
          allRecommendations.push(...docAnalysis.recommendations);
        }

        processedCount++;
        progress.processedDocuments = processedCount;
        progress.progress = Math.round((processedCount / documents.length) * 80) + 10; // 10-90%
        
        job.progress = progress.progress;
        this.broadcastProgress(job.id, progress);

      } catch (error) {
        console.error(`❌ Failed to analyze document ${doc.name}:`, error);
        // Continue with other documents rather than failing the entire job
      }
    }

    return {
      findings: allFindings,
      recommendations: [...new Set(allRecommendations)], // Remove duplicates
      documentsProcessed: processedCount,
      totalDocuments: documents.length,
    };
  }

  private async saveAnalysisResults(dealId: number, agentType: string, results: any): Promise<void> {
    try {
      // Use the existing createAgentAnalysis function
      const { createAgentAnalysis } = await import('./dueDiligence');
      await createAgentAnalysis(dealId, agentType as any, results);
      console.log(`💾 Saved ${agentType} analysis results for deal ${dealId}`);
    } catch (error) {
      console.error(`❌ Failed to save ${agentType} analysis results:`, error);
      throw error;
    }
  }

  private broadcastProgress(jobId: string, progress: any) {
    try {
      websocketManager.broadcastJobProgress(progress.dealId, {
        jobId,
        agentType: progress.agentType,
        progress: progress.progress || 0,
        status: progress.status,
        processedDocuments: progress.processedDocuments || 0,
        totalDocuments: progress.totalDocuments || 0,
        currentDocument: progress.currentDocument || '',
        currentStep: progress.currentStep || '',
        metadata: {
          agentType: progress.agentType,
          startTime: progress.startTime,
          lastUpdate: new Date(),
        },
      });
    } catch (error) {
      console.error('❌ Failed to broadcast progress:', error);
    }
  }

  async getJobStatus(jobId: string): Promise<any> {
    try {
      // Check active queue
      let job = this.jobQueue.find(j => j.id === jobId);
      
      // Check completed jobs
      if (!job) {
        job = this.completedJobs.find(j => j.id === jobId);
      }
      
      // Check failed jobs
      if (!job) {
        job = this.failedJobs.find(j => j.id === jobId);
      }
      
      if (!job) {
        return { status: 'not_found' };
      }

      const progress = this.activeJobs.get(jobId);
      
      return {
        id: job.id,
        status: job.status,
        progress: job.progress || 0,
        processedOn: job.startedAt,
        finishedOn: job.completedAt,
        failedReason: job.failedReason,
        returnvalue: job.result,
        data: job.data,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        createdAt: job.createdAt,
        currentProgress: progress,
      };
    } catch (error) {
      console.error(`❌ Failed to get job status for ${jobId}:`, error);
      return { status: 'error', error: error.message };
    }
  }

  async getJobResults(jobId: string): Promise<any> {
    try {
      // Check completed jobs first
      let job = this.completedJobs.find(j => j.id === jobId);
      
      if (!job) {
        // Check failed jobs
        job = this.failedJobs.find(j => j.id === jobId);
        
        if (!job) {
          // Check active queue
          job = this.jobQueue.find(j => j.id === jobId);
          
          if (!job) {
            return { success: false, error: 'Job not found' };
          }
        }
      }

      if (job.status === 'completed') {
        return { success: true, results: job.result };
      } else if (job.status === 'failed') {
        return { success: false, error: job.failedReason };
      } else {
        return { success: false, error: 'Job not completed yet', status: job.status };
      }
    } catch (error) {
      console.error(`❌ Failed to get job results for ${jobId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async getQueueMetrics(): Promise<any> {
    try {
      const waiting = this.jobQueue.filter(j => j.status === 'waiting').length;
      const active = this.jobQueue.filter(j => j.status === 'active').length;
      const retrying = this.jobQueue.filter(j => j.status === 'retrying').length;
      const completed = this.completedJobs.length;
      const failed = this.failedJobs.length;

      return {
        waiting,
        active,
        retrying,
        completed,
        failed,
        totalJobs: waiting + active + retrying + completed + failed,
        concurrency: CONCURRENCY,
        redis_status: 'ready', // In-memory mode
        queueSize: this.jobQueue.length,
        completedSize: this.completedJobs.length,
        failedSize: this.failedJobs.length,
      };
    } catch (error) {
      console.error('❌ Failed to get queue metrics:', error);
      return { error: error.message };
    }
  }

  async clearJobsForDeal(dealId: number): Promise<number> {
    try {
      console.log(`🧹 Clearing all enterprise jobs for deal ${dealId}`);
      
      let clearedCount = 0;
      
      // Remove from active queue
      const beforeQueueSize = this.jobQueue.length;
      this.jobQueue = this.jobQueue.filter(job => {
        if (job.data.dealId === dealId) {
          clearedCount++;
          return false;
        }
        return true;
      });
      
      // Remove from completed jobs
      const beforeCompletedSize = this.completedJobs.length;
      this.completedJobs = this.completedJobs.filter(job => {
        if (job.data.dealId === dealId) {
          clearedCount++;
          return false;
        }
        return true;
      });
      
      // Remove from failed jobs
      const beforeFailedSize = this.failedJobs.length;
      this.failedJobs = this.failedJobs.filter(job => {
        if (job.data.dealId === dealId) {
          clearedCount++;
          return false;
        }
        return true;
      });
      
      // Clear active job progress tracking
      const activeJobKeys = Array.from(this.activeJobs.keys());
      activeJobKeys.forEach(jobId => {
        const progress = this.activeJobs.get(jobId);
        if (progress && progress.dealId === dealId) {
          this.activeJobs.delete(jobId);
          clearedCount++;
        }
      });
      
      console.log(`✅ Cleared ${clearedCount} enterprise jobs for deal ${dealId}`);
      console.log(`📊 Queue sizes: active ${beforeQueueSize} → ${this.jobQueue.length}, completed ${beforeCompletedSize} → ${this.completedJobs.length}, failed ${beforeFailedSize} → ${this.failedJobs.length}`);
      
      return clearedCount;
    } catch (error) {
      console.error(`❌ Failed to clear jobs for deal ${dealId}:`, error);
      throw error;
    }
  }

  async gracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    console.log('🛑 Starting graceful shutdown of enterprise job queue...');

    try {
      // Stop processing interval
      if (this.processingInterval) {
        clearInterval(this.processingInterval);
        this.processingInterval = null;
        console.log('✅ Processing interval stopped');
      }

      // Wait for active jobs to complete (with timeout)
      const timeout = 30000; // 30 seconds
      const startTime = Date.now();
      
      while (this.jobQueue.some(j => j.status === 'active') && Date.now() - startTime < timeout) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('✅ Enterprise job queue shutdown completed');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }
}

export const enterpriseJobQueue = EnterpriseJobQueue.getInstance();
export default enterpriseJobQueue;