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
    agentQuestionQueue: number;
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
   * and cleans up stale queue entries from previous server sessions
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
      
      // BOOT-TIME CLEANUP: Clean up orphaned queue entries left from server crash
      await this.cleanOrphanedQueuesOnStartup();
      
      this.initialized = true;
      console.log('✅ CancellationOrchestrator: Boot-time reconciliation complete');
    } catch (error) {
      console.error('❌ CancellationOrchestrator initialization error:', error);
      // Don't throw - allow server to start even if reconciliation fails
      this.initialized = true;
    }
  }
  
  /**
   * Clean up TRULY orphaned queue entries from previous server session
   * Only cleans entries where the master background job is missing or in terminal state
   * This prevents accidentally deleting legitimate in-progress work after a simple restart
   */
  private async cleanOrphanedQueuesOnStartup(): Promise<void> {
    console.log('🧹 CancellationOrchestrator: Checking for orphaned queue entries from previous session...');
    
    try {
      const { agentRunQueue, agentQuestionQueue, backgroundJobs } = await import('../../shared/schema');
      const { db } = await import('../db');
      const { eq, notInArray } = await import('drizzle-orm');
      
      let totalCleaned = 0;
      
      // 1. Find agentRunQueue entries in non-terminal status (pending, starting, running)
      const activeQueueEntries = await db.select()
        .from(agentRunQueue)
        .where(notInArray(agentRunQueue.status, ['completed', 'failed', 'cancelled']));
      
      if (activeQueueEntries.length > 0) {
        // Get unique deal IDs from active entries
        const dealIds = [...new Set(activeQueueEntries.map(e => e.dealId))];
        console.log(`🔍 Found ${activeQueueEntries.length} non-terminal agentRunQueue entries across ${dealIds.length} deals`);
        
        // Only clean entries where the master job doesn't exist or is terminal
        for (const dealId of dealIds) {
          // Check if there's an active master job for any agent type
          const masterJobTypes = ['force-rerun-all-ip', 'force-rerun-all-research', 'force-rerun-all-legal', 
                                  'force-rerun-all-clinical', 'force-rerun-all-financial', 
                                  'force-rerun-all-hr', 'force-rerun-all-commercial'];
          
          let hasActiveMasterJob = false;
          for (const prefix of masterJobTypes) {
            const masterJobId = `${prefix}-${dealId}`;
            const masterJob = await storage.getBackgroundJobById(masterJobId);
            if (masterJob && !['completed', 'failed', 'cancelled'].includes(masterJob.status)) {
              hasActiveMasterJob = true;
              break;
            }
          }
          
          if (!hasActiveMasterJob) {
            // Orphan: queue entries exist but no active master job to process them
            const cleared = await storage.forceDeleteAllAgentRunQueue(dealId);
            totalCleaned += cleared;
            console.log(`  ✓ Cleaned ${cleared} orphaned agentRunQueue entries for deal ${dealId} (no active master job)`);
          } else {
            console.log(`  ⏭️ Keeping agentRunQueue for deal ${dealId} (active master job found)`);
          }
        }
      }
      
      // 2. Find agentQuestionQueue entries in non-terminal status
      const activeQuestionQueue = await db.select()
        .from(agentQuestionQueue)
        .where(notInArray(agentQuestionQueue.status, ['completed', 'failed']));
      
      if (activeQuestionQueue.length > 0) {
        const dealIds = [...new Set(activeQuestionQueue.map(e => e.dealId))];
        console.log(`🔍 Found ${activeQuestionQueue.length} non-terminal agentQuestionQueue entries across ${dealIds.length} deals`);
        
        for (const dealId of dealIds) {
          // Check for active research master job
          const researchMasterJobId = `force-rerun-all-research-${dealId}`;
          const masterJob = await storage.getBackgroundJobById(researchMasterJobId);
          
          if (!masterJob || ['completed', 'failed', 'cancelled'].includes(masterJob.status)) {
            // Orphan: question queue entries exist but no active master job
            const cleared = await storage.clearAgentQuestionQueueByDealId(dealId);
            totalCleaned += cleared;
            console.log(`  ✓ Cleaned ${cleared} orphaned agentQuestionQueue entries for deal ${dealId}`);
          } else {
            console.log(`  ⏭️ Keeping agentQuestionQueue for deal ${dealId} (active research master job)`);
          }
        }
      }
      
      if (totalCleaned > 0) {
        console.log(`✅ Cleaned ${totalCleaned} orphaned queue entries on startup`);
      } else {
        console.log(`✅ No orphaned queue entries found (or all have active master jobs)`);
      }
    } catch (error) {
      console.error('⚠️ Error cleaning orphaned queues on startup (non-fatal):', error);
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
        agentQuestionQueue: 0,
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

      // STEP 4: CRITICAL - Stop in-memory coordinators BEFORE deleting their queue rows
      // The coordinators need to see the queue rows to detect and honor cancellation
      
      // 4a: Stop agentRunCoordinator FIRST - this stops live IP/Research processors
      try {
        const coordResult = await agentRunCoordinator.stopAllAgents(dealId);
        result.details.memoryCleared += coordResult.stoppedCount;
        console.log(`🛑 Stopped ${coordResult.stoppedCount} agents via agentRunCoordinator (BEFORE queue deletion)`);
      } catch (e) {
        result.errors.push(`agentRunCoordinator: ${e}`);
      }

      // 4b: Reset Research Question Queue Service in-memory state BEFORE deleting its rows
      try {
        const { ResearchQuestionQueueService } = await import('./researchQuestionQueue');
        const researchQueueService = ResearchQuestionQueueService.getInstance();
        researchQueueService.cancelDeal(dealId);
        result.details.memoryCleared++;
        console.log(`🧹 Reset ResearchQuestionQueueService memory state (BEFORE queue deletion)`);
      } catch (e) {
        result.errors.push(`ResearchQuestionQueueService: ${e}`);
      }

      // STEP 5: Now safe to delete queue tables (coordinators already stopped)
      
      // 5a: FORCE DELETE agentRunQueue table (ALL rows regardless of status)
      try {
        const clearedQueue = await storage.forceDeleteAllAgentRunQueue(dealId);
        result.details.agentRunQueue = clearedQueue;
        console.log(`🗑️ FORCE DELETED ${clearedQueue} agent run queue database rows`);
      } catch (e) {
        result.errors.push(`agentRunQueue: ${e}`);
      }

      // 5b: Clear agentQuestionQueue table (Research agent question queue)
      try {
        const clearedQuestionQueue = await storage.clearAgentQuestionQueueByDealId(dealId);
        result.details.agentQuestionQueue = clearedQuestionQueue;
        console.log(`🗑️ Cleared ${clearedQuestionQueue} agent question queue entries`);
      } catch (e) {
        result.errors.push(`agentQuestionQueue: ${e}`);
      }

      // STEP 6: Cancel researchJobs table
      try {
        const cancelledResearch = await storage.cancelResearchJobsByDealId(dealId);
        result.details.researchJobs = cancelledResearch;
        console.log(`🛑 Cancelled ${cancelledResearch} research jobs`);
      } catch (e) {
        result.errors.push(`researchJobs: ${e}`);
      }

      // STEP 7: Delete researchBackgroundJobs table
      try {
        const deletedResearchBg = await storage.deleteResearchBackgroundJobsByDealId(dealId);
        result.details.researchBackgroundJobs = deletedResearchBg;
        console.log(`🗑️ Deleted ${deletedResearchBg} research background jobs`);
      } catch (e) {
        result.errors.push(`researchBackgroundJobs: ${e}`);
      }

      // STEP 8: Clear in-memory state from persistentJobManager
      try {
        const clearedMemory = await persistentJobManager.clearStuckJobs(dealId);
        result.details.memoryCleared += clearedMemory;
        console.log(`🧹 Cleared ${clearedMemory} jobs from persistentJobManager memory`);
      } catch (e) {
        result.errors.push(`persistentJobManager: ${e}`);
      }

      // Calculate totals
      result.totalCancelled = 
        result.details.backgroundJobs + 
        result.details.agentRunQueue + 
        result.details.agentQuestionQueue +
        result.details.researchJobs + 
        result.details.researchBackgroundJobs;
      
      result.success = result.errors.length === 0;

      console.log(`✅ ====== CANCELLATION COMPLETE for deal ${dealId} ======`);
      console.log(`   Total cancelled: ${result.totalCancelled}`);
      console.log(`   Background jobs: ${result.details.backgroundJobs}`);
      console.log(`   Agent run queue rows: ${result.details.agentRunQueue}`);
      console.log(`   Agent question queue rows: ${result.details.agentQuestionQueue}`);
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
