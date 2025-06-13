import { websocketManager } from './websocketManager';

interface JobProgress {
  jobId: number;
  progress: number;
  status: string;
  currentStep: string;
  documentName?: string;
  error?: string;
}

interface JobData {
  id: number;
  jobType: string;
  dealId?: number | null;
  documentId?: number | null;
  documentName?: string;
  progress: number;
  status: string;
  currentStep: string;
  metadata?: any;
  createdAt: Date;
  error?: string;
}

class BackgroundJobManager {
  private activeJobs = new Map<number, JobData>();
  private jobIdCounter = 1;

  async createJob(data: {
    jobType: string;
    dealId?: number | null;
    documentId?: number | null;
    jobData?: any;
  }): Promise<number> {
    // Save job to database first
    const { db } = await import('../db');
    const { backgroundJobs } = await import('../../shared/schema');
    
    const [dbJob] = await db.insert(backgroundJobs).values({
      jobType: data.jobType,
      dealId: data.dealId,
      documentId: data.documentId,
      status: 'processing',
      progress: 0,
      currentStep: 'Starting...',
      jobData: data.jobData || null
    }).returning();

    const jobId = dbJob.id;
    
    const job: JobData = {
      id: jobId,
      jobType: data.jobType,
      dealId: data.dealId,
      documentId: data.documentId,
      documentName: data.jobData?.documentName || data.jobData?.fileName || 'Processing...',
      progress: 0,
      status: 'processing',
      currentStep: 'Starting...',
      metadata: data.jobData,
      createdAt: new Date()
    };

    this.activeJobs.set(jobId, job);

    // Broadcast job creation immediately
    this.broadcastProgress({
      jobId,
      progress: 0,
      status: 'processing',
      currentStep: 'Starting...',
      documentName: job.documentName
    }, data.dealId);

    console.log(`📋 Created background job ${jobId} for ${data.jobType} and saved to database`);
    return jobId;
  }

  async updateProgress(jobId: number, progress: number, currentStep: string, documentName?: string) {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      console.error(`Job ${jobId} not found for progress update`);
      return;
    }

    job.progress = Math.min(100, Math.max(0, progress));
    job.currentStep = currentStep;
    if (documentName) {
      job.documentName = documentName;
    }

    // Update database
    try {
      const { db } = await import('../db');
      const { backgroundJobs } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');
      
      await db.update(backgroundJobs)
        .set({
          progress: job.progress,
          currentStep: job.currentStep,
          updatedAt: new Date()
        })
        .where(eq(backgroundJobs.id, jobId));
    } catch (dbError) {
      console.error(`Failed to update job ${jobId} in database:`, dbError);
    }

    this.broadcastProgress({
      jobId,
      progress: job.progress,
      status: job.status,
      currentStep,
      documentName: job.documentName
    }, job.dealId);

    console.log(`📊 Job ${jobId} progress: ${progress}% - ${currentStep}`);
  }

  async completeJob(jobId: number, result?: any, error?: string) {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      console.error(`Job ${jobId} not found for completion`);
      return;
    }

    job.status = error ? 'failed' : 'completed';
    job.progress = error ? job.progress : 100;
    job.error = error;

    // Update database with completion
    try {
      const { db } = await import('../db');
      const { backgroundJobs } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');
      
      await db.update(backgroundJobs)
        .set({
          status: job.status,
          progress: job.progress,
          error: error || null,
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(backgroundJobs.id, jobId));
    } catch (dbError) {
      console.error(`Failed to complete job ${jobId} in database:`, dbError);
    }

    this.broadcastProgress({
      jobId,
      progress: job.progress,
      status: job.status,
      currentStep: error ? 'Failed' : 'Completed',
      documentName: job.documentName,
      error
    }, job.dealId);

    // Broadcast completion
    websocketManager.broadcastJobComplete(jobId, result, job.dealId);

    console.log(`✅ Job ${jobId} ${error ? 'failed' : 'completed'}`);

    // Remove job after delay
    setTimeout(() => {
      this.activeJobs.delete(jobId);
    }, 30000); // Keep for 30 seconds after completion
  }

  private broadcastProgress(update: JobProgress, dealId?: number) {
    console.log(`🚀 Broadcasting progress for job ${update.jobId}: ${update.progress}% - ${update.currentStep}`);
    websocketManager.broadcastJobProgress(update, dealId);
  }

  async getActiveJobs(dealId?: number): Promise<JobData[]> {
    // Load active jobs from database to handle server restarts
    const { db } = await import('../db');
    const { backgroundJobs } = await import('../../shared/schema');
    const { eq, and } = await import('drizzle-orm');
    
    try {
      let dbJobs;
      if (dealId) {
        dbJobs = await db.select().from(backgroundJobs)
          .where(and(
            eq(backgroundJobs.dealId, dealId),
            eq(backgroundJobs.status, 'processing')
          ));
      } else {
        dbJobs = await db.select().from(backgroundJobs)
          .where(eq(backgroundJobs.status, 'processing'));
      }
      
      console.log(`📊 Found ${dbJobs.length} active jobs in database for deal ${dealId || 'all'}`);
      
      // Convert database jobs to JobData format and sync with memory
      const jobs: JobData[] = [];
      for (const dbJob of dbJobs) {
        const jobData: JobData = {
          jobId: dbJob.id,
          jobType: dbJob.jobType,
          dealId: dbJob.dealId || 0,
          documentName: (dbJob.jobData as any)?.fileName || 'Processing ZIP...',
          progress: dbJob.progress || 0,
          status: dbJob.status || 'processing',
          currentStep: dbJob.currentStep || 'Processing...',
          metadata: dbJob.jobData,
          createdAt: dbJob.createdAt || new Date(),
          error: dbJob.error
        };
        
        jobs.push(jobData);
        // Sync with memory cache
        this.activeJobs.set(dbJob.id, jobData);
      }
      
      return jobs;
    } catch (error) {
      console.error('Error loading jobs from database:', error);
      // Fallback to memory cache
      const jobs = Array.from(this.activeJobs.values());
      if (dealId) {
        return jobs.filter(job => job.dealId === dealId);
      }
      return jobs;
    }
  }

  async cancelJob(jobId: number): Promise<boolean> {
    try {
      const { db } = await import('../db');
      const { backgroundJobs } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');
      const { websocketManager } = await import('./websocketManager');
      
      // Check if job exists and is still processing
      const [job] = await db.select().from(backgroundJobs)
        .where(eq(backgroundJobs.id, jobId));
      
      if (!job) {
        console.log(`🛑 Job ${jobId} not found`);
        return false;
      }
      
      if (job.status !== 'processing') {
        console.log(`🛑 Job ${jobId} is not in processing state (status: ${job.status})`);
        return false;
      }
      
      // Update job status to cancelled in database
      await db.update(backgroundJobs)
        .set({ 
          status: 'cancelled',
          currentStep: 'Cancelled by user',
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(backgroundJobs.id, jobId));
      
      // Remove from memory cache
      this.activeJobs.delete(jobId);
      
      // Notify via WebSocket about cancellation
      websocketManager.broadcastJobCancellation(jobId, job.dealId || 0);
      
      console.log(`🛑 Job ${jobId} successfully cancelled`);
      return true;
      
    } catch (error) {
      console.error(`Error cancelling job ${jobId}:`, error);
      return false;
    }
  }
}

export const backgroundJobManager = new BackgroundJobManager();