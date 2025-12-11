import { storage } from '../storage';

const ORPHAN_TIMEOUT_MINUTES = 5; // Consider job orphaned if no heartbeat for 5 minutes
const RECOVERY_CHECK_INTERVAL = 60 * 1000; // Check every 60 seconds

export class MemoJobRecoveryService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  
  async initialize(): Promise<void> {
    console.log('🔄 Initializing Memo Job Recovery Service...');
    
    // Run immediate check for orphaned jobs on startup
    await this.recoverOrphanedJobs();
    
    // Start periodic checking
    this.intervalId = setInterval(() => {
      this.recoverOrphanedJobs().catch(err => {
        console.error('❌ Error in memo job recovery check:', err);
      });
    }, RECOVERY_CHECK_INTERVAL);
    
    console.log('✅ Memo Job Recovery Service initialized');
  }
  
  async recoverOrphanedJobs(): Promise<void> {
    if (this.isRunning) {
      console.log('⏳ Recovery already in progress, skipping...');
      return;
    }
    
    this.isRunning = true;
    
    try {
      // Find orphaned memo generation jobs
      const orphanedJobs = await this.findOrphanedMemoJobs();
      
      if (orphanedJobs.length === 0) {
        return;
      }
      
      console.log(`🔍 Found ${orphanedJobs.length} orphaned memo generation job(s)`);
      
      for (const job of orphanedJobs) {
        await this.handleOrphanedJob(job);
      }
    } catch (error) {
      console.error('❌ Error in memo job recovery:', error);
    } finally {
      this.isRunning = false;
    }
  }
  
  private async findOrphanedMemoJobs(): Promise<any[]> {
    try {
      // Query for memo jobs that are "processing" but haven't had a heartbeat recently
      const cutoffTime = new Date(Date.now() - ORPHAN_TIMEOUT_MINUTES * 60 * 1000);
      
      const jobs = await storage.findOrphanedMemoJobs(cutoffTime);
      return jobs;
    } catch (error) {
      console.error('❌ Error finding orphaned memo jobs:', error);
      return [];
    }
  }
  
  private async handleOrphanedJob(job: any): Promise<void> {
    console.log(`🔧 Handling orphaned memo job ${job.jobId} for deal ${job.dealId}`);
    console.log(`   Status: ${job.status}, Progress: ${job.progress}%, Completed Sections: ${job.completedSections || 0}/${job.totalSections || 0}`);
    
    const dealId = job.dealId;
    if (!dealId) {
      console.log(`⚠️ Job ${job.jobId} has no deal ID, marking as failed`);
      await storage.updateBackgroundJob(job.jobId, {
        status: 'failed',
        error: 'No deal ID associated with job',
        updatedAt: new Date()
      });
      return;
    }
    
    // Check if memo has any content already (partial completion)
    const existingMemo = await storage.getMemoByDealId(dealId);
    const hasSavedContent = existingMemo?.memo && Object.keys(existingMemo.memo).length > 0;
    
    if (hasSavedContent) {
      // Memo has partial content - mark job as completed (resume not supported yet)
      console.log(`✅ Job ${job.jobId} has saved content, marking as completed`);
      await storage.updateBackgroundJob(job.jobId, {
        status: 'completed',
        progress: 100,
        currentStep: 'Recovered - memo content preserved',
        completedAt: new Date(),
        updatedAt: new Date()
      });
    } else {
      // No content saved - mark as failed so user can restart
      console.log(`❌ Job ${job.jobId} has no saved content, marking as failed for restart`);
      await storage.updateBackgroundJob(job.jobId, {
        status: 'failed',
        error: 'Server restarted during processing - please regenerate memo',
        updatedAt: new Date()
      });
    }
  }
  
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const memoJobRecoveryService = new MemoJobRecoveryService();
