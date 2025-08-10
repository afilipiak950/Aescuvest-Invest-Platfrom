import { storage } from '../storage';
import { InsertBackgroundJob, BackgroundJob } from '@shared/schema';

export class PersistentJobManager {
  private static instance: PersistentJobManager;
  private activeJobs = new Map<string, any>();
  private jobIntervals = new Map<string, NodeJS.Timeout>();

  static getInstance(): PersistentJobManager {
    if (!PersistentJobManager.instance) {
      PersistentJobManager.instance = new PersistentJobManager();
    }
    return PersistentJobManager.instance;
  }

  async startAgentAnalysis(dealId: number, agentType: string, totalDocuments: number): Promise<string> {
    // Skip regular analysis for Legal agents - they use comprehensive analysis only
    if (agentType.toLowerCase() === 'legal') {
      console.log(`⏭️ Skipping regular analysis for Legal agent - use comprehensive analysis instead`);
      throw new Error('Legal agents use comprehensive analysis only. Use /api/deals/:dealId/legal-analysis/comprehensive instead.');
    }

    const jobId = `${agentType}-analysis-${dealId}`;
    
    try {
      // Create persistent job in database
      await storage.createBackgroundJob({
        jobId,
        jobType: 'agent_analysis',
        dealId,
        agentType,
        status: 'processing',
        progress: 0,
        totalDocuments,
        processedDocuments: 0,
        startedAt: new Date()
      });

      // Track in memory for active processing
      this.activeJobs.set(jobId, {
        dealId,
        agentType,
        status: 'processing',
        progress: 0,
        totalDocuments,
        processedDocuments: 0,
        startTime: new Date()
      });

      console.log(`🚀 Started persistent background job ${jobId}`);
      return jobId;
    } catch (error) {
      console.error(`❌ Failed to start background job ${jobId}:`, error);
      throw error;
    }
  }

  async updateJobProgress(jobId: string, progress: number, processedDocuments: number, currentDocumentName?: string): Promise<void> {
    try {
      // Update database
      await storage.updateBackgroundJob(jobId, {
        progress,
        processedDocuments,
        currentDocumentName,
        updatedAt: new Date()
      });

      // Update in-memory tracking
      const job = this.activeJobs.get(jobId);
      if (job) {
        job.progress = progress;
        job.processedDocuments = processedDocuments;
        job.currentDocumentName = currentDocumentName;
        job.lastUpdate = new Date();
      }

      console.log(`📊 Updated job progress: ${jobId} ${progress}% (${processedDocuments} docs)`);
    } catch (error) {
      console.error(`❌ Failed to update job progress ${jobId}:`, error);
    }
  }

  async completeJob(jobId: string, results: any): Promise<void> {
    try {
      // Mark as completed in database
      await storage.completeBackgroundJob(jobId, results);

      // Remove from active tracking
      this.activeJobs.delete(jobId);
      
      // Clear any intervals
      const interval = this.jobIntervals.get(jobId);
      if (interval) {
        clearInterval(interval);
        this.jobIntervals.delete(jobId);
      }

      console.log(`✅ Completed background job ${jobId}`);
    } catch (error) {
      console.error(`❌ Failed to complete job ${jobId}:`, error);
    }
  }

  async failJob(jobId: string, errorMessage: string): Promise<void> {
    try {
      // Mark as failed in database
      await storage.failBackgroundJob(jobId, errorMessage);

      // Remove from active tracking
      this.activeJobs.delete(jobId);
      
      // Clear any intervals
      const interval = this.jobIntervals.get(jobId);
      if (interval) {
        clearInterval(interval);
        this.jobIntervals.delete(jobId);
      }

      console.log(`❌ Failed background job ${jobId}: ${errorMessage}`);
    } catch (error) {
      console.error(`❌ Failed to mark job as failed ${jobId}:`, error);
    }
  }

  async getActiveJobsForDeal(dealId: number): Promise<BackgroundJob[]> {
    try {
      // Get from database (persistent source of truth)
      const dbJobs = await storage.getActiveBackgroundJobsForDeal(dealId);
      
      // Merge with in-memory state for real-time updates
      return dbJobs.map(dbJob => {
        const memoryJob = this.activeJobs.get(dbJob.jobId);
        if (memoryJob) {
          return {
            ...dbJob,
            progress: memoryJob.progress,
            processedDocuments: memoryJob.processedDocuments,
            currentDocumentName: memoryJob.currentDocumentName
          };
        }
        return dbJob;
      });
    } catch (error) {
      console.error(`❌ Failed to get active jobs for deal ${dealId}:`, error);
      return [];
    }
  }

  async restoreJobsFromDatabase(): Promise<void> {
    try {
      console.log('🔄 Restoring background jobs from database...');
      
      // Get all processing jobs from database
      const allJobs = await storage.getBackgroundJobsByDealId(0); // Get all deals
      const activeJobs = allJobs.filter(job => job.status === 'processing');
      
      for (const job of activeJobs) {
        if (job.jobType === 'agent_analysis' && job.agentType && job.dealId) {
          console.log(`🔄 Restoring ${job.agentType} analysis job for deal ${job.dealId}`);
          
          // Restore to in-memory tracking
          this.activeJobs.set(job.jobId, {
            dealId: job.dealId,
            agentType: job.agentType,
            status: job.status,
            progress: job.progress || 0,
            totalDocuments: job.totalDocuments || 0,
            processedDocuments: job.processedDocuments || 0,
            currentDocumentName: job.currentDocumentName,
            startTime: job.startedAt || new Date(),
            lastUpdate: job.updatedAt || new Date()
          });
        }
      }
      
      console.log(`🔄 Restored ${activeJobs.length} background jobs from database`);
    } catch (error) {
      console.error('❌ Failed to restore jobs from database:', error);
    }
  }

  async resetAllJobsForDeal(dealId: number): Promise<void> {
    try {
      console.log(`🔄 Resetting all background jobs for deal ${dealId}`);
      
      // Get all jobs for this deal
      const jobs = await storage.getBackgroundJobsByDealId(dealId);
      
      // Mark all as completed or failed
      for (const job of jobs) {
        if (job.status === 'processing') {
          await storage.updateBackgroundJob(job.jobId, {
            status: 'cancelled',
            completedAt: new Date(),
            updatedAt: new Date()
          });
          
          // Remove from memory
          this.activeJobs.delete(job.jobId);
          
          // Clear intervals
          const interval = this.jobIntervals.get(job.jobId);
          if (interval) {
            clearInterval(interval);
            this.jobIntervals.delete(job.jobId);
          }
        }
      }
      
      console.log(`✅ Reset ${jobs.length} background jobs for deal ${dealId}`);
    } catch (error) {
      console.error(`❌ Failed to reset jobs for deal ${dealId}:`, error);
    }
  }

  getInMemoryJob(jobId: string): any {
    return this.activeJobs.get(jobId);
  }

  getAllActiveJobs(): Map<string, any> {
    return this.activeJobs;
  }

  async clearStuckJobsForAgent(dealId: number, agentType: string): Promise<void> {
    try {
      console.log(`🧹 Clearing stuck jobs for ${agentType} agent on deal ${dealId}`);
      
      // Clear from in-memory tracking
      const jobKeysToDelete = [];
      for (const [jobId, job] of this.activeJobs.entries()) {
        if (job.dealId === dealId && job.agentType === agentType) {
          jobKeysToDelete.push(jobId);
          
          // Clear any intervals
          const interval = this.jobIntervals.get(jobId);
          if (interval) {
            clearInterval(interval);
            this.jobIntervals.delete(jobId);
          }
        }
      }
      
      jobKeysToDelete.forEach(jobId => {
        this.activeJobs.delete(jobId);
        console.log(`🗑️ Cleared stuck ${agentType} job: ${jobId}`);
      });
      
      // Update database to mark as failed
      await storage.markStuckJobsAsFailed(dealId, agentType);
      
      console.log(`✅ Cleared ${jobKeysToDelete.length} stuck ${agentType} jobs for deal ${dealId}`);
    } catch (error) {
      console.error(`❌ Error clearing stuck ${agentType} jobs:`, error);
    }
  }

  async clearStuckJobs(dealId: number): Promise<void> {
    try {
      console.log(`🧹 Clearing stuck jobs for deal ${dealId} from persistent job manager`);
      
      // Get all jobs for this deal
      const jobs = await storage.getBackgroundJobsByDealId(dealId);
      const stuckJobs = jobs.filter(job => job.status === 'processing');
      
      // Clear stuck jobs from memory and intervals
      for (const job of stuckJobs) {
        this.activeJobs.delete(job.jobId);
        
        const interval = this.jobIntervals.get(job.jobId);
        if (interval) {
          clearInterval(interval);
          this.jobIntervals.delete(job.jobId);
        }
      }
      
      console.log(`🧹 Cleared ${stuckJobs.length} stuck jobs from memory for deal ${dealId}`);
    } catch (error) {
      console.error(`Error clearing stuck jobs for deal ${dealId}:`, error);
    }
  }

  async stopJob(jobId: string): Promise<void> {
    try {
      console.log(`🛑 Stopping job ${jobId} in persistent manager`);
      
      // Update database to cancelled status
      await storage.updateBackgroundJob(jobId, {
        status: 'cancelled',
        completedAt: new Date(),
        updatedAt: new Date()
      });
      
      // Remove from memory
      this.activeJobs.delete(jobId);
      
      // Clear interval
      const interval = this.jobIntervals.get(jobId);
      if (interval) {
        clearInterval(interval);
        this.jobIntervals.delete(jobId);
      }
      
      console.log(`✅ Successfully stopped job ${jobId}`);
    } catch (error) {
      console.error(`Error stopping job ${jobId}:`, error);
      throw error;
    }
  }
}

export const persistentJobManager = PersistentJobManager.getInstance();