/**
 * Agent Run Coordinator Service
 * Manages sequential execution of agent force-rerun operations across all 7 agents
 * 
 * When user clicks "Force Rerun All" on Legal, then Clinical:
 * 1. Legal gets enqueued → starts immediately (nothing running)
 * 2. Clinical gets enqueued → waits for Legal to complete
 * 3. When Legal completes → Clinical automatically starts
 * 
 * This ensures agents run one at a time, preventing parallel execution
 */

import { storage } from '../storage';
import { websocketManager } from './websocketManager';
import { AgentRunQueue } from '../../shared/schema';

type AgentType = 'legal' | 'clinical' | 'commercial' | 'hr' | 'financial' | 'ip' | 'research';

interface AgentRunCallback {
  (dealId: number): Promise<void>;
}

class AgentRunCoordinatorService {
  private static instance: AgentRunCoordinatorService;
  private agentCallbacks: Map<AgentType, AgentRunCallback> = new Map();
  private processingDeals: Set<number> = new Set(); // Guards startNextAgent from concurrent calls
  private cancelledDeals: Set<number> = new Set(); // Tracks deals where stop-all was called

  static getInstance(): AgentRunCoordinatorService {
    if (!AgentRunCoordinatorService.instance) {
      AgentRunCoordinatorService.instance = new AgentRunCoordinatorService();
    }
    return AgentRunCoordinatorService.instance;
  }

  /**
   * Register a callback function for an agent type
   * This callback will be called when it's the agent's turn to run
   */
  registerAgentCallback(agentType: AgentType, callback: AgentRunCallback): void {
    this.agentCallbacks.set(agentType, callback);
    console.log(`📝 Registered callback for agent: ${agentType}`);
  }

  /**
   * Enqueue an agent run and start processing if nothing is running
   * Returns queue status for immediate frontend feedback
   * 
   * @param forceRestart - If true, cancel any existing run and restart fresh
   */
  async enqueueAndStart(
    dealId: number, 
    agentType: AgentType, 
    totalQuestions: number,
    forceRestart: boolean = false
  ): Promise<{ 
    success: boolean; 
    queuePosition: number; 
    isRunning: boolean;
    message: string;
    currentRunningAgent?: string;
  }> {
    try {
      console.log(`📥 AgentRunCoordinator: Enqueueing ${agentType} for deal ${dealId} (forceRestart=${forceRestart})`);
      
      // NOTE: Do NOT clear cancellation here - it will be cleared in startNextAgent
      // after confirming no callback is still running. This prevents a race where
      // the old callback checks the flag after we clear it.
      
      // Check if agent is already queued or running (database check)
      const isAlreadyQueued = await storage.isAgentQueued(dealId, agentType);
      if (isAlreadyQueued) {
        const queue = await storage.getAgentRunQueue(dealId);
        const existingEntry = queue.find(q => q.agentType === agentType);
        const isRunning = existingEntry?.status === 'running';
        
        // FORCE RESTART: Delete existing entry and re-queue at SAME position
        if (forceRestart && existingEntry) {
          const oldPosition = existingEntry.position;
          const wasRunning = isRunning;
          
          console.log(`🔥 FORCE RESTART: Cancelling existing ${agentType} (status: ${existingEntry.status}, position: ${oldPosition}) for deal ${dealId}`);
          
          // Delete the existing queue entry
          await storage.deleteAgentRunEntry(existingEntry.id);
          
          // Release the processing lock if this agent was running
          if (wasRunning) {
            this.processingDeals.delete(dealId);
          }
          
          console.log(`✅ Deleted existing ${agentType} queue entry, will re-enqueue at position ${wasRunning ? 1 : oldPosition}`);
          
          // Re-enqueue at the SAME position (or position 1 if was running)
          const targetPosition = wasRunning ? 1 : oldPosition;
          const newEntry = await storage.enqueueAgentRunAtPosition(dealId, agentType, totalQuestions, targetPosition);
          
          this.broadcastQueueUpdate(dealId);
          
          // If was running, start processing immediately
          if (wasRunning) {
            console.log(`🚀 Force restarting ${agentType} immediately (was running)`);
            await this.startNextAgent(dealId);
            return {
              success: true,
              queuePosition: 1,
              isRunning: true,
              message: `Force restarted ${agentType} analysis`
            };
          } else {
            // Was queued, return the new queue position
            return {
              success: true,
              queuePosition: targetPosition,
              isRunning: false,
              message: `Force restarted ${agentType}, queued at position ${targetPosition}`
            };
          }
        } else {
          // Not forcing restart - return existing status
          console.log(`ℹ️ ${agentType} already ${isRunning ? 'running' : 'queued'} for deal ${dealId} (position ${existingEntry?.position})`);
          return {
            success: true, // Idempotent success - agent is already in queue
            queuePosition: existingEntry?.position || 0,
            isRunning: isRunning,
            message: `${agentType} is already ${isRunning ? 'running' : 'queued at position ' + existingEntry?.position}`
          };
        }
      }

      // Enqueue the agent (storage also has duplicate protection for race conditions)
      const queueEntry = await storage.enqueueAgentRun(dealId, agentType, totalQuestions);
      
      // Broadcast queue update via WebSocket
      this.broadcastQueueUpdate(dealId);
      
      // Check if we should start processing
      const currentRunning = await storage.getCurrentRunningAgent(dealId);
      
      if (!currentRunning) {
        // Nothing running, start this agent immediately
        console.log(`🚀 No agent running for deal ${dealId}, starting ${agentType} immediately`);
        await this.startNextAgent(dealId);
        return {
          success: true,
          queuePosition: 1,
          isRunning: true,
          message: `Started ${agentType} analysis`
        };
      } else {
        // Something is running, this agent is queued
        console.log(`⏳ Agent ${currentRunning.agentType} running for deal ${dealId}, ${agentType} queued at position ${queueEntry.position}`);
        return {
          success: true,
          queuePosition: queueEntry.position,
          isRunning: false,
          message: `${agentType} queued (position ${queueEntry.position}), waiting for ${currentRunning.agentType} to complete`,
          currentRunningAgent: currentRunning.agentType
        };
      }
    } catch (error: any) {
      console.error(`❌ Error enqueueing agent ${agentType} for deal ${dealId}:`, error);
      return {
        success: false,
        queuePosition: 0,
        isRunning: false,
        message: error.message || 'Failed to enqueue agent'
      };
    }
  }

  /**
   * Start the next queued agent for a deal
   * BULLETPROOF: Lock is held until callback fully completes, preventing all interleaving
   */
  private async startNextAgent(dealId: number): Promise<void> {
    try {
      // CRITICAL: Check lock SYNCHRONOUSLY before any work
      if (this.processingDeals.has(dealId)) {
        console.log(`⚠️ Already processing queue for deal ${dealId}, skipping`);
        return;
      }
      
      // Set the lock IMMEDIATELY - this is synchronous so no race window
      this.processingDeals.add(dealId);
      
      // CRITICAL: Clear cancellation flag now that we have the lock
      // This ensures the previous callback has fully exited before clearing
      if (this.cancelledDeals.has(dealId)) {
        console.log(`🔓 Clearing cancellation flag for deal ${dealId} - new agent about to start`);
        this.clearCancellation(dealId);
      }

      // Use atomic promotion with SKIP LOCKED to prevent concurrent promotions
      const nextAgent = await storage.promoteNextQueuedAgent(dealId);
      if (!nextAgent) {
        console.log(`✅ No more queued agents for deal ${dealId}`);
        this.processingDeals.delete(dealId);
        this.broadcastQueueUpdate(dealId);
        return;
      }
      
      console.log(`🚀 Starting agent ${nextAgent.agentType} for deal ${dealId}`);
      this.broadcastQueueUpdate(dealId);

      // Get the callback for this agent type
      const callback = this.agentCallbacks.get(nextAgent.agentType as AgentType);
      
      if (!callback) {
        console.error(`❌ No callback registered for agent ${nextAgent.agentType}`);
        await storage.failAgentRun(nextAgent.id, `No callback registered for agent ${nextAgent.agentType}`);
        this.processingDeals.delete(dealId);
        // Try next agent
        await this.startNextAgent(dealId);
        return;
      }

      // BULLETPROOF: Execute callback and AWAIT completion before releasing lock
      // This ensures only one agent runs at a time per deal
      let wasCancelled = false;
      try {
        await callback(dealId);
        
        // CHECK CANCELLATION: If deal was cancelled during callback, don't complete the agent
        if (this.cancelledDeals.has(dealId)) {
          console.log(`🚫 Deal ${dealId} was cancelled, not completing agent ${nextAgent.agentType}`);
          wasCancelled = true;
        } else {
          console.log(`✅ Agent ${nextAgent.agentType} completed for deal ${dealId}`);
          await storage.completeAgentRun(nextAgent.id);
        }
      } catch (error: any) {
        // CHECK CANCELLATION: Don't log as failure if deal was cancelled
        if (this.cancelledDeals.has(dealId)) {
          console.log(`🚫 Deal ${dealId} was cancelled, ignoring error`);
          wasCancelled = true;
        } else {
          console.error(`❌ Agent ${nextAgent.agentType} failed for deal ${dealId}:`, error);
          await storage.failAgentRun(nextAgent.id, error.message || 'Unknown error');
        }
      }
      
      // Only release lock AFTER callback fully completes
      this.processingDeals.delete(dealId);
      this.broadcastQueueUpdate(dealId);
      
      // IMPORTANT: Even if cancelled, try to start next agent
      // (new agents may have been queued during the stop-all + re-enqueue flow)
      // The cancellation flag will be cleared at the start of startNextAgent
      // before promoting the new agent
      await this.startNextAgent(dealId);

    } catch (error) {
      console.error(`❌ Error starting next agent for deal ${dealId}:`, error);
      this.processingDeals.delete(dealId);
    }
  }

  /**
   * Mark an agent as complete and trigger next agent
   * Called by individual agent services when they finish
   */
  async markAgentComplete(dealId: number, agentType: AgentType): Promise<void> {
    try {
      console.log(`✅ AgentRunCoordinator: Marking ${agentType} complete for deal ${dealId}`);
      
      const queue = await storage.getAgentRunQueue(dealId);
      const runningAgent = queue.find(q => q.agentType === agentType && q.status === 'running');
      
      if (runningAgent) {
        await storage.completeAgentRun(runningAgent.id);
      }
      
      this.processingDeals.delete(dealId);
      this.broadcastQueueUpdate(dealId);
      
      // Start next agent
      await this.startNextAgent(dealId);
    } catch (error) {
      console.error(`❌ Error marking agent ${agentType} complete for deal ${dealId}:`, error);
    }
  }

  /**
   * Mark an agent as failed and trigger next agent
   */
  async markAgentFailed(dealId: number, agentType: AgentType, error: string): Promise<void> {
    try {
      console.log(`❌ AgentRunCoordinator: Marking ${agentType} failed for deal ${dealId}: ${error}`);
      
      const queue = await storage.getAgentRunQueue(dealId);
      const runningAgent = queue.find(q => q.agentType === agentType && q.status === 'running');
      
      if (runningAgent) {
        await storage.failAgentRun(runningAgent.id, error);
      }
      
      this.processingDeals.delete(dealId);
      this.broadcastQueueUpdate(dealId);
      
      // Start next agent (don't stop queue because one failed)
      await this.startNextAgent(dealId);
    } catch (err) {
      console.error(`❌ Error marking agent ${agentType} failed for deal ${dealId}:`, err);
    }
  }

  /**
   * Update progress for a running agent
   */
  async updateProgress(
    dealId: number, 
    agentType: AgentType, 
    completedQuestions: number, 
    currentStep: string
  ): Promise<void> {
    try {
      const queue = await storage.getAgentRunQueue(dealId);
      const runningAgent = queue.find(q => q.agentType === agentType && q.status === 'running');
      
      if (runningAgent) {
        await storage.updateAgentRunStatus(runningAgent.id, 'running', {
          completedQuestions,
          currentStep
        });
        this.broadcastQueueUpdate(dealId);
      }
    } catch (error) {
      console.error(`Error updating progress for ${agentType}:`, error);
    }
  }

  /**
   * Get current queue status for a deal
   */
  async getQueueStatus(dealId: number): Promise<{
    queue: AgentRunQueue[];
    currentRunning: AgentRunQueue | null;
    nextQueued: AgentRunQueue | null;
    totalQueued: number;
  }> {
    try {
      const queue = await storage.getAgentRunQueue(dealId);
      const currentRunning = await storage.getCurrentRunningAgent(dealId);
      const nextQueued = await storage.getNextQueuedAgent(dealId);
      
      // Filter to only show active entries (queued or running)
      const activeQueue = queue.filter(q => q.status === 'queued' || q.status === 'running');
      
      return {
        queue: activeQueue,
        currentRunning: currentRunning || null,
        nextQueued: nextQueued || null,
        totalQueued: activeQueue.length
      };
    } catch (error) {
      console.error(`Error getting queue status for deal ${dealId}:`, error);
      return {
        queue: [],
        currentRunning: null,
        nextQueued: null,
        totalQueued: 0
      };
    }
  }

  /**
   * Cancel a queued agent (only if not already running)
   */
  async cancelQueuedAgent(dealId: number, agentType: AgentType): Promise<boolean> {
    try {
      const queue = await storage.getAgentRunQueue(dealId);
      const queuedAgent = queue.find(q => q.agentType === agentType && q.status === 'queued');
      
      if (!queuedAgent) {
        console.log(`⚠️ Agent ${agentType} not found in queue or already running`);
        return false;
      }
      
      await storage.failAgentRun(queuedAgent.id, 'Cancelled by user');
      this.broadcastQueueUpdate(dealId);
      
      console.log(`🚫 Cancelled queued agent ${agentType} for deal ${dealId}`);
      return true;
    } catch (error) {
      console.error(`Error cancelling agent ${agentType} for deal ${dealId}:`, error);
      return false;
    }
  }

  /**
   * Check if a deal has been cancelled (stop-all was called)
   * Running callbacks should check this and abort gracefully
   */
  isDealCancelled(dealId: number): boolean {
    return this.cancelledDeals.has(dealId);
  }

  /**
   * Clear the cancellation flag for a deal (called when new agent is enqueued)
   */
  clearCancellation(dealId: number): void {
    if (this.cancelledDeals.has(dealId)) {
      this.cancelledDeals.delete(dealId);
      console.log(`🔄 Cleared cancellation flag for deal ${dealId}`);
    }
  }

  /**
   * STOP ALL AGENTS for a deal - clears the entire queue and processing lock
   * Use this when user clicks "Stop All Jobs"
   */
  async stopAllAgents(dealId: number): Promise<{ success: boolean; stoppedCount: number }> {
    try {
      console.log(`🛑 STOP ALL AGENTS: Clearing queue for deal ${dealId}`);
      
      // 1. FIRST: Set cancellation flag so running callbacks will abort
      this.cancelledDeals.add(dealId);
      console.log(`🚫 Set cancellation flag for deal ${dealId}`);
      
      const { agentRunQueue: arq } = await import('../../shared/schema');
      const { db } = await import('../db');
      const { eq } = await import('drizzle-orm');
      
      // 2. Get all queue entries for this deal (for counting)
      const allEntries = await db.select().from(arq).where(eq(arq.dealId, dealId));
      const stoppedCount = allEntries.length;
      
      // 3. DELETE ALL entries from agentRunQueue for this deal (regardless of status)
      await db.delete(arq).where(eq(arq.dealId, dealId));
      console.log(`🗑️ Deleted ${stoppedCount} queue entries for deal ${dealId}`);
      
      // 4. NOTE: Do NOT clear the processingDeals lock here!
      // The running callback will check isDealCancelled(), exit early, and 
      // the lock will be released naturally in startNextAgent's try/finally.
      // Clearing it here would create a race where new agents start before
      // the old callback has exited.
      console.log(`⚠️ Processing lock for deal ${dealId} will be released when callback exits`);
      
      // 5. Broadcast the empty queue state
      this.broadcastQueueUpdate(dealId);
      
      console.log(`✅ STOP ALL AGENTS complete for deal ${dealId}: ${stoppedCount} agents stopped`);
      
      return { success: true, stoppedCount };
    } catch (error) {
      console.error(`❌ Error stopping all agents for deal ${dealId}:`, error);
      // On error, still try to clear locks to prevent deadlock
      this.processingDeals.delete(dealId);
      return { success: false, stoppedCount: 0 };
    }
  }

  /**
   * Broadcast queue update via WebSocket
   */
  private async broadcastQueueUpdate(dealId: number): Promise<void> {
    try {
      const status = await this.getQueueStatus(dealId);
      websocketManager.broadcast('agent_queue_update', {
        dealId,
        ...status
      }, dealId);
    } catch (error) {
      console.error(`Error broadcasting queue update for deal ${dealId}:`, error);
    }
  }

  /**
   * Initialize service on server start
   * Resume any running agents that got interrupted
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing AgentRunCoordinator...');
      
      const { agentRunQueue: arq } = await import('../../shared/schema');
      const { db } = await import('../db');
      const { eq, and, lt, or, inArray } = await import('drizzle-orm');
      
      // CLEANUP 1: Remove old completed/failed entries (older than 6 hours)
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const deletedOld = await db.delete(arq)
        .where(
          and(
            or(eq(arq.status, 'completed'), eq(arq.status, 'failed')),
            lt(arq.triggeredAt, sixHoursAgo)
          )
        );
      console.log(`🧹 Cleaned up old completed/failed queue entries older than 6 hours`);
      
      // CLEANUP 2: For each deal, remove duplicate queued entries for same agent type (keep most recent)
      const allQueued = await db.select().from(arq).where(eq(arq.status, 'queued'));
      const seenAgents = new Map<string, number>(); // key: "dealId-agentType", value: most recent ID
      const idsToDelete: number[] = [];
      
      // Sort by triggeredAt desc to keep most recent
      allQueued.sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime());
      
      for (const entry of allQueued) {
        const key = `${entry.dealId}-${entry.agentType}`;
        if (seenAgents.has(key)) {
          // This is a duplicate (older entry), mark for deletion
          idsToDelete.push(entry.id);
        } else {
          // This is the most recent entry, keep it
          seenAgents.set(key, entry.id);
        }
      }
      
      if (idsToDelete.length > 0) {
        await db.delete(arq).where(inArray(arq.id, idsToDelete));
        console.log(`🧹 Removed ${idsToDelete.length} duplicate queued entries`);
      }
      
      // Find all "running" entries that might be stuck from server restart
      const stuckRunning = await db.select()
        .from(arq)
        .where(eq(arq.status, 'running'));
      
      for (const stuck of stuckRunning) {
        console.log(`🔄 Found stuck running agent: ${stuck.agentType} for deal ${stuck.dealId}`);
        // Reset to queued so it will be picked up again
        await storage.updateAgentRunStatus(stuck.id, 'queued', {
          currentStep: 'Resuming after server restart...'
        });
      }
      
      // Find all deals with queued agents and start processing
      const dealsWithQueue = await db
        .selectDistinct({ dealId: arq.dealId })
        .from(arq)
        .where(eq(arq.status, 'queued'));
      
      for (const { dealId } of dealsWithQueue) {
        console.log(`🔄 Resuming queue processing for deal ${dealId}`);
        this.startNextAgent(dealId).catch(err => 
          console.error(`Error resuming queue for deal ${dealId}:`, err)
        );
      }
      
      console.log('✅ AgentRunCoordinator initialized');
    } catch (error) {
      console.error('❌ Error initializing AgentRunCoordinator:', error);
    }
  }
}

export const agentRunCoordinator = AgentRunCoordinatorService.getInstance();
