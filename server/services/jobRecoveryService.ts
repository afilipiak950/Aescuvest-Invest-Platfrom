/**
 * Job Recovery Service
 * Handles recovery of background jobs that get stuck when users navigate away
 * Implements aggressive monitoring and auto-restart patterns
 */

import { db } from '../db';
import { backgroundJobs } from '../../shared/schema';
import { eq, and, lt } from 'drizzle-orm';
import { websocketManager } from './websocketManager';

interface RecoveryConfig {
  stuckThreshold: number; // Time before job is considered stuck (2 minutes)
  recoveryInterval: number; // Check every 30 seconds
  maxRecoveries: number; // Maximum recovery attempts per job
}

class JobRecoveryService {
  private config: RecoveryConfig = {
    stuckThreshold: 2 * 60 * 1000, // 2 minutes
    recoveryInterval: 30 * 1000, // 30 seconds
    maxRecoveries: 3
  };
  
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private recoveryAttempts = new Map<string, number>();

  /**
   * Start the job recovery monitoring service
   */
  start(): void {
    if (this.isRunning) {
      console.log('🔄 Job Recovery Service already running');
      return;
    }

    console.log('🚀 Starting Job Recovery Service');
    console.log(`⏰ Stuck threshold: ${this.config.stuckThreshold / (60 * 1000)} minutes`);
    console.log(`🔄 Recovery interval: ${this.config.recoveryInterval / 1000} seconds`);

    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.checkForStuckJobs().catch(error => {
        console.error('❌ Error in job recovery check:', error);
      });
    }, this.config.recoveryInterval);

    // Run immediate check
    this.checkForStuckJobs().catch(error => {
      console.error('❌ Error in initial job recovery check:', error);
    });
  }

  /**
   * Stop the job recovery monitoring service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.recoveryAttempts.clear();
    console.log('⏹️ Job Recovery Service stopped');
  }

  /**
   * Check for stuck jobs and attempt recovery
   */
  async checkForStuckJobs(): Promise<void> {
    console.log('🔍 Checking for stuck background jobs...');
    
    try {
      // Find jobs that haven't been updated recently
      const stuckThreshold = new Date(Date.now() - this.config.stuckThreshold);
      
      const stuckJobs = await db
        .select()
        .from(backgroundJobs)
        .where(
          and(
            eq(backgroundJobs.status, 'processing'),
            lt(backgroundJobs.updatedAt, stuckThreshold)
          )
        );

      console.log(`🔄 Found ${stuckJobs.length} potentially stuck jobs`);

      for (const job of stuckJobs) {
        await this.attemptJobRecovery(job);
      }

    } catch (error) {
      console.error('❌ Error checking for stuck jobs:', error);
    }
  }

  /**
   * Attempt to recover a stuck job
   */
  private async attemptJobRecovery(job: any): Promise<void> {
    const recoveryCount = this.recoveryAttempts.get(job.jobId) || 0;
    const jobAge = Date.now() - new Date(job.updatedAt).getTime();
    const minutesStuck = Math.round(jobAge / (60 * 1000) * 10) / 10;
    
    console.log(`🔄 Attempting recovery for stuck job ${job.jobId} (${job.jobType})`);
    console.log(`⏰ Job has been stuck for ${minutesStuck} minutes (attempt ${recoveryCount + 1}/${this.config.maxRecoveries})`);

    if (recoveryCount >= this.config.maxRecoveries) {
      console.log(`❌ Job ${job.jobId} exceeded maximum recovery attempts, forcing completion`);
      await this.forceCompleteJob(job);
      return;
    }

    try {
      // Increment recovery attempt counter
      this.recoveryAttempts.set(job.jobId, recoveryCount + 1);

      // Try to restart the job based on its type
      const recovered = await this.restartJobByType(job);
      
      if (recovered) {
        console.log(`✅ Successfully recovered job ${job.jobId}`);
        // Reset recovery counter on successful restart
        this.recoveryAttempts.delete(job.jobId);
      } else {
        console.log(`⚠️ Failed to recover job ${job.jobId}, will retry later`);
      }

    } catch (error) {
      console.error(`❌ Error recovering job ${job.jobId}:`, error);
      
      // If recovery fails multiple times, force complete
      if (recoveryCount >= this.config.maxRecoveries - 1) {
        await this.forceCompleteJob(job);
      }
    }
  }

  /**
   * Restart a job based on its type
   */
  private async restartJobByType(job: any): Promise<boolean> {
    try {
      // Cancel the stuck job first
      await this.cancelStuckJob(job);

      // Restart based on job type
      if (job.jobId.includes('ip-analysis')) {
        console.log(`🔄 Restarting IP analysis for deal ${job.dealId}`);
        return await this.restartIpAnalysis(job.dealId);
      } else if (job.jobId.includes('clinical-analysis')) {
        console.log(`🔄 Restarting Clinical analysis for deal ${job.dealId}`);
        return await this.restartClinicalAnalysis(job.dealId);
      } else if (job.jobId.includes('legal-analysis')) {
        console.log(`🔄 Restarting Legal analysis for deal ${job.dealId}`);
        return await this.restartLegalAnalysis(job.dealId);
      } else if (job.jobId.includes('financial-analysis')) {
        console.log(`🔄 Restarting Financial analysis for deal ${job.dealId}`);
        return await this.restartFinancialAnalysis(job.dealId);
      } else if (job.jobId.includes('commercial-analysis')) {
        console.log(`🔄 Restarting Commercial analysis for deal ${job.dealId}`);
        return await this.restartCommercialAnalysis(job.dealId);
      } else if (job.jobId.includes('hr-analysis')) {
        console.log(`🔄 Restarting HR analysis for deal ${job.dealId}`);
        return await this.restartHrAnalysis(job.dealId);
      }

      return false;
    } catch (error) {
      console.error(`❌ Error restarting job ${job.jobId}:`, error);
      return false;
    }
  }

  /**
   * Cancel a stuck job
   */
  private async cancelStuckJob(job: any): Promise<void> {
    await db
      .update(backgroundJobs)
      .set({
        status: 'cancelled',
        error: 'Job was stuck and cancelled for recovery',
        updatedAt: new Date()
      })
      .where(eq(backgroundJobs.id, job.id));

    console.log(`🛑 Cancelled stuck job ${job.jobId}`);
  }

  /**
   * Force complete a job that can't be recovered
   */
  private async forceCompleteJob(job: any): Promise<void> {
    await db
      .update(backgroundJobs)
      .set({
        status: 'completed',
        progress: 100,
        currentStep: 'Auto-completed after recovery failure',
        error: 'Job was force-completed due to recovery failure',
        updatedAt: new Date()
      })
      .where(eq(backgroundJobs.id, job.id));

    // Remove from recovery tracking
    this.recoveryAttempts.delete(job.jobId);

    // Send WebSocket update
    if (job.dealId) {
      websocketManager.notifyJobUpdate(job.dealId, {
        jobId: job.jobId,
        status: 'completed',
        progress: 100,
        currentStep: 'Auto-completed after recovery failure',
        message: 'Job completed automatically after recovery failure'
      });
    }

    console.log(`✅ Force-completed job ${job.jobId} after recovery failure`);
  }

  /**
   * Restart specific analysis types
   */
  private async restartIpAnalysis(dealId: number): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:5000/api/deals/${dealId}/ip-analysis/comprehensive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.ok;
    } catch (error) {
      console.error('Error restarting IP analysis:', error);
      return false;
    }
  }

  private async restartClinicalAnalysis(dealId: number): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:5000/api/deals/${dealId}/clinical-analysis/comprehensive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.ok;
    } catch (error) {
      console.error('Error restarting Clinical analysis:', error);
      return false;
    }
  }

  private async restartLegalAnalysis(dealId: number): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:5000/api/deals/${dealId}/legal-analysis/comprehensive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.ok;
    } catch (error) {
      console.error('Error restarting Legal analysis:', error);
      return false;
    }
  }

  private async restartFinancialAnalysis(dealId: number): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:5000/api/deals/${dealId}/financial-analysis/comprehensive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.ok;
    } catch (error) {
      console.error('Error restarting Financial analysis:', error);
      return false;
    }
  }

  private async restartCommercialAnalysis(dealId: number): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:5000/api/deals/${dealId}/commercial-analysis/comprehensive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.ok;
    } catch (error) {
      console.error('Error restarting Commercial analysis:', error);
      return false;
    }
  }

  private async restartHrAnalysis(dealId: number): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:5000/api/deals/${dealId}/hr-analysis/comprehensive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.ok;
    } catch (error) {
      console.error('Error restarting HR analysis:', error);
      return false;
    }
  }

  /**
   * Get recovery statistics
   */
  async getRecoveryStats(): Promise<any> {
    try {
      const totalStuckJobs = await db
        .select()
        .from(backgroundJobs)
        .where(eq(backgroundJobs.status, 'processing'));

      return {
        activeRecoveries: this.recoveryAttempts.size,
        totalProcessingJobs: totalStuckJobs.length,
        recoveryAttempts: Object.fromEntries(this.recoveryAttempts),
        isRunning: this.isRunning,
        config: this.config
      };
    } catch (error) {
      console.error('Error getting recovery stats:', error);
      return { error: error.message };
    }
  }
}

// Create singleton instance
export const jobRecoveryService = new JobRecoveryService();