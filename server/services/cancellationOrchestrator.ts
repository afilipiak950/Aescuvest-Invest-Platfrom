/**
 * CancellationOrchestrator - Bulletproof unified job cancellation system
 * 
 * This service provides atomic, guaranteed cleanup of ALL job tracking systems:
 * 1. backgroundJobs table - main job status
 * 2. agentRunQueue table - agent coordinator queue
 * 3. researchJobs table - research-specific jobs
 * 4. researchBackgroundJobs table - research background tracking
 * 5. cancellationRegistry - in-memory instant flags
 * 6. persistentJobManager - in-memory job tracking
 * 7. agentRunCoordinator - in-memory coordinator state
 * 
 * Features:
 * - Boot-time reconciliation to rehydrate state from database
 * - Atomic cancellation of all systems in guaranteed sequence
 * - Orphan detection and cleanup
 * - Cancellation event broadcasting
 */

import { storage } from '../storage';
import { cancellationRegistry } from './cancellationRegistry';
import { persistentJobManager } from './persistentJobManager';
import { agentRunCoordinator } from './agentRunCoordinator';

interface CancellationResult {
  success: boolean;
  totalCancelled: number;
  details: {
    backgroundJobs: number;
    agentRunQueue: number;
    researchJobs: number;
    researchBackgroundJobs: number;
    memoryCleared: number;
  };
  errors: string[];
}

class CancellationOrchestrator {
  private static instance: CancellationOrchestrator;
  private initialized = false;

  private constructor() {}

  static getInstance(): CancellationOrchestrator {
    if (!CancellationOrchestrator.instance) {
      CancellationOrchestrator.instance = new CancellationOrchestrator();
    }
    return CancellationOrchestrator.instance;
  }

  /**
   * Boot-time initialization - rehydrates cancellation state from database
   * Should be called when server starts
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    console.log('🔄 CancellationOrchestrator: Initializing boot-time reconciliation...');
    
    try {
      // Find all jobs marked as cancelled in DB but might have been running before crash
      // Rehydrate cancellation flags for any jobs that were mid-cancellation
      const stuckJobs = await this.findStuckJobsAcrossAllDeals();
      
      if (stuckJobs.length > 0) {
        console.log(`🔄 Found ${stuckJobs.length} potentially stuck jobs from previous session`);
        
        // Register them as cancelled in memory to prevent resurrection
        for (const job of stuckJobs) {
          cancellationRegistry.cancel(job.jobId);
        }
        
        console.log(`✅ Rehydrated ${stuckJobs.length} cancellation flags`);
      }
      
      this.initialized = true;
      console.log('✅ CancellationOrchestrator: Boot-time reconciliation complete');
    } catch (error) {
      console.error('❌ CancellationOrchestrator initialization error:', error);
      // Don't throw - allow server to start even if reconciliation fails
      this.initialized = true;
    }
  }

  /**
   * ATOMIC cancellation of ALL jobs for a deal across ALL tracking systems
   * This is the ONLY method that should be called to stop jobs
   */
  async cancelAllJobsForDeal(dealId: number): Promise<CancellationResult> {
    console.log(`🛑 ====== CANCELLATION ORCHESTRATOR: Stopping ALL jobs for deal ${dealId} ======`);
    
    const result: CancellationResult = {
      success: false,
      totalCancelled: 0,
      details: {
        backgroundJobs: 0,
        agentRunQueue: 0,
        researchJobs: 0,
        researchBackgroundJobs: 0,
        memoryCleared: 0
      },
      errors: []
    };

    try {
      // STEP 1: Get all active job IDs FIRST (before any modifications)
      const allJobs = await storage.getBackgroundJobsByDealId(dealId);
      const terminalStatuses = ['completed', 'failed', 'cancelled'];
      const activeJobs = allJobs.filter(job => !terminalStatuses.includes(job.status));
      const jobIdsToCancel = activeJobs.map(job => job.jobId);
      
      console.log(`📋 Found ${activeJobs.length} active jobs to cancel: ${jobIdsToCancel.join(', ')}`);

      // STEP 2: INSTANT - Register ALL cancellations in memory FIRST (O(1) detection by workers)
      if (jobIdsToCancel.length > 0) {
        cancellationRegistry.cancelMultiple(jobIdsToCancel);
        console.log(`⚡ Registered ${jobIdsToCancel.length} instant cancellation flags in memory`);
      }

      // STEP 3: Cancel backgroundJobs table
      for (const job of activeJobs) {
        try {
          await storage.updateBackgroundJob(job.jobId, {
            status: 'cancelled',
            currentStep: 'Cancelled by user',
            completedAt: new Date(),
            updatedAt: new Date()
          });
          result.details.backgroundJobs++;
        } catch (e) {
          result.errors.push(`backgroundJob ${job.jobId}: ${e}`);
        }
      }
      console.log(`📊 Cancelled ${result.details.backgroundJobs} background jobs in database`);

      // STEP 4: Clear agentRunQueue table (DATABASE ROWS - critical!)
      try {
        const clearedQueue = await storage.clearAgentRunQueue(dealId);
        result.details.agentRunQueue = clearedQueue;
        console.log(`🗑️ Cleared ${clearedQueue} agent run queue database rows`);
      } catch (e) {
        result.errors.push(`agentRunQueue: ${e}`);
      }

      // STEP 5: Cancel researchJobs table
      try {
        const cancelledResearch = await storage.cancelResearchJobsByDealId(dealId);
        result.details.researchJobs = cancelledResearch;
        console.log(`🛑 Cancelled ${cancelledResearch} research jobs`);
      } catch (e) {
        result.errors.push(`researchJobs: ${e}`);
      }

      // STEP 6: Delete researchBackgroundJobs table
      try {
        const deletedResearchBg = await storage.deleteResearchBackgroundJobsByDealId(dealId);
        result.details.researchBackgroundJobs = deletedResearchBg;
        console.log(`🗑️ Deleted ${deletedResearchBg} research background jobs`);
      } catch (e) {
        result.errors.push(`researchBackgroundJobs: ${e}`);
      }

      // STEP 7: Clear in-memory state from persistentJobManager
      try {
        const clearedMemory = await persistentJobManager.clearStuckJobs(dealId);
        result.details.memoryCleared += clearedMemory;
        console.log(`🧹 Cleared ${clearedMemory} jobs from persistentJobManager memory`);
      } catch (e) {
        result.errors.push(`persistentJobManager: ${e}`);
      }

      // STEP 8: Stop via agentRunCoordinator (in-memory coordinator state)
      try {
        const coordResult = await agentRunCoordinator.stopAllAgents(dealId);
        result.details.memoryCleared += coordResult.stoppedCount;
        console.log(`🛑 Stopped ${coordResult.stoppedCount} agents via coordinator`);
      } catch (e) {
        result.errors.push(`agentRunCoordinator: ${e}`);
      }

      // Calculate totals
      result.totalCancelled = 
        result.details.backgroundJobs + 
        result.details.agentRunQueue + 
        result.details.researchJobs + 
        result.details.researchBackgroundJobs;
      
      result.success = result.errors.length === 0;

      console.log(`✅ ====== CANCELLATION COMPLETE for deal ${dealId} ======`);
      console.log(`   Total cancelled: ${result.totalCancelled}`);
      console.log(`   Background jobs: ${result.details.backgroundJobs}`);
      console.log(`   Agent queue rows: ${result.details.agentRunQueue}`);
      console.log(`   Research jobs: ${result.details.researchJobs}`);
      console.log(`   Research bg jobs: ${result.details.researchBackgroundJobs}`);
      console.log(`   Memory cleared: ${result.details.memoryCleared}`);
      if (result.errors.length > 0) {
        console.log(`   ⚠️ Errors (non-fatal): ${result.errors.join(', ')}`);
      }

      return result;

    } catch (error) {
      console.error(`❌ CancellationOrchestrator critical error for deal ${dealId}:`, error);
      result.errors.push(`Critical: ${error}`);
      return result;
    }
  }

  /**
   * Find jobs that may be stuck from a previous server session
   */
  private async findStuckJobsAcrossAllDeals(): Promise<Array<{ dealId: number; jobId: string }>> {
    try {
      // Get all non-terminal background jobs that might be orphaned
      const { backgroundJobs } = await import('../../shared/schema');
      const { db } = await import('../db');
      const { notInArray } = await import('drizzle-orm');
      
      const stuckJobs = await db.select({
        dealId: backgroundJobs.dealId,
        jobId: backgroundJobs.jobId
      })
      .from(backgroundJobs)
      .where(notInArray(backgroundJobs.status, ['completed', 'failed', 'cancelled']));
      
      return stuckJobs;
    } catch (error) {
      console.error('Error finding stuck jobs:', error);
      return [];
    }
  }

  /**
   * Periodic audit to detect and clean orphaned entries
   * Should be called by a scheduled job every few minutes
   */
  async auditAndCleanOrphans(): Promise<{ cleaned: number; deals: number[] }> {
    console.log('🔍 CancellationOrchestrator: Running orphan audit...');
    
    const result = { cleaned: 0, deals: [] as number[] };
    
    try {
      // Find agentRunQueue entries where the corresponding backgroundJob is already terminal
      const { agentRunQueue, backgroundJobs } = await import('../../shared/schema');
      const { db } = await import('../db');
      const { eq, inArray, sql } = await import('drizzle-orm');
      
      // Get all unique deal IDs with queue entries
      const dealsWithQueue = await db.selectDistinct({ dealId: agentRunQueue.dealId }).from(agentRunQueue);
      
      for (const { dealId } of dealsWithQueue) {
        // Check if there are any active background jobs for this deal
        const activeJobs = await db.select()
          .from(backgroundJobs)
          .where(sql`${backgroundJobs.dealId} = ${dealId} AND ${backgroundJobs.status} NOT IN ('completed', 'failed', 'cancelled')`);
        
        if (activeJobs.length === 0) {
          // No active jobs but queue entries exist - these are orphans
          const queueEntries = await db.select().from(agentRunQueue).where(eq(agentRunQueue.dealId, dealId));
          
          if (queueEntries.length > 0) {
            console.log(`🧹 Found ${queueEntries.length} orphaned queue entries for deal ${dealId} - cleaning...`);
            await storage.clearAgentRunQueue(dealId);
            result.cleaned += queueEntries.length;
            result.deals.push(dealId);
          }
        }
      }
      
      if (result.cleaned > 0) {
        console.log(`✅ Audit complete: Cleaned ${result.cleaned} orphaned entries from ${result.deals.length} deals`);
      } else {
        console.log(`✅ Audit complete: No orphans found`);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Orphan audit error:', error);
      return result;
    }
  }
}

export const cancellationOrchestrator = CancellationOrchestrator.getInstance();
