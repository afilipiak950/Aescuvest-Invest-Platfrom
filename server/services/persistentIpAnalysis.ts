import { comprehensiveIpAnalysisService } from '../comprehensiveIpAnalysisService';
import { storage } from '../storage';

class PersistentIpAnalysisService {
  private activeJobs = new Map<string, boolean>();
  private jobIntervals = new Map<string, NodeJS.Timeout>();

  /**
   * CRITICAL: Start persistent IP analysis with EXACT Financial template behavior
   * - Delete existing analysis data FIRST (not at completion) 
   * - Delete existing job to force fresh start
   * - Proper job management with intervals
   */
  async startAnalysis(dealId: number, jobId: string): Promise<void> {
    console.log(`🔬 Starting persistent IP analysis for deal ${dealId}, job ${jobId}`);

    // CRITICAL FIX: Delete existing analysis data first - EXACTLY like Clinical template 
    console.log(`🧹 DELETING existing IP analysis data for deal ${dealId} to ensure fresh start...`);
    await comprehensiveIpAnalysisService.deleteExistingAnalysis(dealId);
    
    // ALWAYS delete existing job to force fresh start - EXACT Clinical behavior
    const existingJob = await storage.getBackgroundJobById(jobId);
    if (existingJob) {
      console.log(`🧹 FORCE DELETING existing job for deal ${dealId} with status ${existingJob.status} to start fresh...`);
      await storage.deleteBackgroundJob(jobId);
      
      // Also clear from memory if running
      if (this.activeJobs.has(jobId)) {
        this.activeJobs.delete(jobId);
      }
      
      const interval = this.jobIntervals.get(jobId);
      if (interval) {
        clearInterval(interval);
        this.jobIntervals.delete(jobId);
      }
      
      // Add small delay to ensure database deletion is committed
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Mark job as active
    this.activeJobs.set(jobId, true);

    try {
      // Create a progress callback that updates the background job
      const progressCallback = async (progress: number, message: string) => {
        try {
          await storage.updateBackgroundJob(jobId, {
            progress,
            currentStep: message,
            status: progress >= 100 ? 'completed' : 'processing'
          });
          console.log(`📊 Updated IP job ${jobId}: ${progress}% - ${message}`);
        } catch (error) {
          console.error(`Error updating job progress for ${jobId}:`, error);
        }
      };

      // Start the analysis with progress callback
      console.log(`🤖 Delegating to comprehensive IP analysis service...`);
      await comprehensiveIpAnalysisService.runComprehensiveAnalysis(dealId, storage, jobId, progressCallback);
      
      console.log(`✅ IP analysis completed for deal ${dealId}`);
      
    } catch (error) {
      console.error(`💥 Error in IP analysis for deal ${dealId}:`, error);
      
      // Update job status to failed
      try {
        await storage.updateBackgroundJob(jobId, {
          status: 'failed',
          progress: 0,
          currentStep: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      } catch (updateError) {
        console.error(`Error updating failed job status for ${jobId}:`, updateError);
      }
      
      throw error;
    } finally {
      // Clean up
      this.activeJobs.delete(jobId);
      const interval = this.jobIntervals.get(jobId);
      if (interval) {
        clearInterval(interval);
        this.jobIntervals.delete(jobId);
      }
    }
  }

  /**
   * Get status of active jobs for a deal
   */
  async getJobStatus(dealId: number): Promise<any> {
    try {
      const jobs = await storage.getBackgroundJobsByDealId(dealId);
      const ipJob = jobs.find(job => job.agentType === 'IP');
      
      if (!ipJob) {
        return null;
      }

      const isActiveInMemory = this.activeJobs.has(ipJob.jobId);
      
      return {
        jobId: ipJob.jobId,
        status: ipJob.status,
        progress: ipJob.progress || 0,
        currentStep: ipJob.currentStep,
        startTime: ipJob.createdAt,
        lastUpdate: ipJob.updatedAt,
        isActiveInMemory
      };
    } catch (error) {
      console.error(`Error getting IP job status for deal ${dealId}:`, error);
      return null;
    }
  }

  /**
   * Stop a running analysis job
   */
  async stopAnalysis(jobId: string): Promise<void> {
    console.log(`🛑 Stopping IP analysis job ${jobId}`);
    
    try {
      // Remove from active jobs
      this.activeJobs.delete(jobId);
      
      // Clear interval if exists
      const interval = this.jobIntervals.get(jobId);
      if (interval) {
        clearInterval(interval);
        this.jobIntervals.delete(jobId);
      }
      
      // Update job status in database
      await storage.updateBackgroundJob(jobId, {
        status: 'cancelled',
        currentStep: 'Analysis cancelled by user'
      });
      
      console.log(`✅ Stopped IP analysis job ${jobId}`);
    } catch (error) {
      console.error(`Error stopping IP analysis job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Get all active jobs (for monitoring)
   */
  getActiveJobs(): string[] {
    return Array.from(this.activeJobs.keys());
  }

  /**
   * Clean up stuck jobs for a specific deal
   */
  async clearStuckJobs(dealId: number): Promise<void> {
    try {
      const jobs = await storage.getBackgroundJobsByDealId(dealId);
      const stuckJobs = jobs.filter(job => 
        job.agentType === 'IP' && 
        job.status === 'processing' && 
        job.updatedAt < new Date(Date.now() - 45 * 60 * 1000) // 45 minutes ago
      );

      for (const job of stuckJobs) {
        console.log(`🧹 Clearing stuck IP job ${job.jobId} for deal ${dealId}`);
        await storage.updateBackgroundJob(job.jobId, {
          status: 'failed',
          currentStep: 'Job timed out and was cleared'
        });
      }

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
}

// Export singleton instance
export const persistentIpAnalysisService = new PersistentIpAnalysisService();
export default persistentIpAnalysisService;