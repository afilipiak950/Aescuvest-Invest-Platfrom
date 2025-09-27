/**
 * Unified Persistent Agent Analysis Service
 * Replaces 7 agent-specific services with one generic service
 */

import { db } from "../db";
import { 
  unifiedAgentRuns,
  unifiedAgentAnswers,
  unifiedBackgroundJobs,
  UnifiedAgentRun,
  UnifiedBackgroundJob,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { orchestrateAgentAnalysis, OrchestratorResult } from "./agent-core/orchestrator";
import { websocketManager } from "./websocketManager";
import { v4 as uuidv4 } from "uuid";

export interface UnifiedAnalysisOptions {
  dealId: number;
  agentType: string;
  forceRerun?: boolean;
  priority?: number;
}

export interface UnifiedAnalysisResult {
  success: boolean;
  runId: string;
  jobId?: string;
  message: string;
  status?: string;
}

export class PersistentUnifiedAgentService {
  private static instances = new Map<string, PersistentUnifiedAgentService>();
  private processingJobs = new Map<string, boolean>();
  
  private constructor(private agentType: string) {}
  
  /**
   * Get or create a service instance for an agent type
   */
  static getInstance(agentType: string): PersistentUnifiedAgentService {
    if (!this.instances.has(agentType)) {
      this.instances.set(agentType, new PersistentUnifiedAgentService(agentType));
    }
    return this.instances.get(agentType)!;
  }
  
  /**
   * Start a new analysis or resume existing one
   */
  async startAnalysis(options: UnifiedAnalysisOptions): Promise<UnifiedAnalysisResult> {
    const { dealId, agentType, forceRerun = false, priority = 0 } = options;
    
    console.log(`\n🚀 Starting ${agentType} analysis for deal ${dealId}`);
    
    try {
      // Check for existing run
      if (!forceRerun) {
        const existingRun = await this.getActiveRun(dealId, agentType);
        
        if (existingRun) {
          console.log(`📋 Found existing ${agentType} run: ${existingRun.runId} (${existingRun.status})`);
          
          if (existingRun.status === "completed") {
            return {
              success: true,
              runId: existingRun.runId,
              message: `${agentType} analysis already completed`,
              status: "completed",
            };
          }
          
          if (existingRun.status === "processing") {
            return {
              success: true,
              runId: existingRun.runId,
              message: `${agentType} analysis already in progress`,
              status: "processing",
            };
          }
          
          // Resume failed or cancelled run
          console.log(`🔄 Resuming ${agentType} run: ${existingRun.runId}`);
          return this.resumeAnalysis(existingRun.runId, dealId);
        }
      }
      
      // Delete existing runs if force rerun
      if (forceRerun) {
        await this.deleteAnalysis(dealId, agentType);
      }
      
      // Create new run
      const runId = uuidv4();
      const jobId = `unified_${agentType}_${dealId}_${Date.now()}`;
      
      // Create run record
      await db.insert(unifiedAgentRuns).values({
        runId,
        dealId,
        agentType,
        status: "initializing",
        progress: 0,
        totalQuestions: 0,
        completedQuestions: 0,
        failedQuestions: 0,
        startedAt: new Date(),
      });
      
      // Create background job
      await db.insert(unifiedBackgroundJobs).values({
        jobId,
        type: "unified_agent_analysis",
        agentType,
        runId,
        status: "pending",
        priority,
        dealId,
        payload: { dealId, agentType, runId },
      });
      
      // Process the job asynchronously
      this.processJobAsync(jobId, runId, dealId, agentType);
      
      // Broadcast start event
      websocketManager.broadcast({
        type: "unified_agent_started",
        dealId,
        agentType,
        runId,
        jobId,
      });
      
      return {
        success: true,
        runId,
        jobId,
        message: `${agentType} analysis started`,
        status: "processing",
      };
      
    } catch (error: any) {
      console.error(`❌ Failed to start ${agentType} analysis:`, error);
      
      return {
        success: false,
        runId: "",
        message: error.message || "Failed to start analysis",
        status: "failed",
      };
    }
  }
  
  /**
   * Resume a paused or failed analysis
   */
  async resumeAnalysis(runId: string, dealId: number): Promise<UnifiedAnalysisResult> {
    try {
      const run = await db
        .select()
        .from(unifiedAgentRuns)
        .where(eq(unifiedAgentRuns.runId, runId))
        .limit(1);
      
      if (!run || run.length === 0) {
        throw new Error(`Run ${runId} not found`);
      }
      
      const existingRun = run[0];
      
      // Update status to processing
      await db.update(unifiedAgentRuns)
        .set({
          status: "processing",
          updatedAt: new Date(),
        })
        .where(eq(unifiedAgentRuns.runId, runId));
      
      // Find or create job
      const jobs = await db
        .select()
        .from(unifiedBackgroundJobs)
        .where(
          and(
            eq(unifiedBackgroundJobs.runId, runId),
            eq(unifiedBackgroundJobs.status, "running")
          )
        )
        .limit(1);
      
      let jobId: string;
      
      if (jobs.length > 0) {
        jobId = jobs[0].jobId;
      } else {
        jobId = `unified_${existingRun.agentType}_${dealId}_${Date.now()}`;
        
        await db.insert(unifiedBackgroundJobs).values({
          jobId,
          type: "unified_agent_analysis",
          agentType: existingRun.agentType,
          runId,
          status: "pending",
          dealId,
          payload: { dealId, agentType: existingRun.agentType, runId },
        });
      }
      
      // Process the job asynchronously
      this.processJobAsync(jobId, runId, dealId, existingRun.agentType);
      
      return {
        success: true,
        runId,
        jobId,
        message: `Resumed ${existingRun.agentType} analysis`,
        status: "processing",
      };
      
    } catch (error: any) {
      console.error(`❌ Failed to resume analysis:`, error);
      
      return {
        success: false,
        runId,
        message: error.message || "Failed to resume analysis",
        status: "failed",
      };
    }
  }
  
  /**
   * Process job asynchronously
   */
  private async processJobAsync(
    jobId: string,
    runId: string,
    dealId: number,
    agentType: string
  ): Promise<void> {
    // Prevent duplicate processing
    if (this.processingJobs.has(jobId)) {
      console.log(`⏭️ Job ${jobId} already processing, skipping`);
      return;
    }
    
    this.processingJobs.set(jobId, true);
    
    try {
      console.log(`🔄 Processing job ${jobId} for ${agentType} analysis`);
      
      // Update job status
      await db.update(unifiedBackgroundJobs)
        .set({
          status: "running",
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(unifiedBackgroundJobs.jobId, jobId));
      
      // Run the orchestrator
      const result = await orchestrateAgentAnalysis({
        dealId,
        agentType,
        runId,
        broadcastProgress: true,
        maxRetries: 2,
      });
      
      // Update job with results
      await db.update(unifiedBackgroundJobs)
        .set({
          status: result.success ? "completed" : "failed",
          result: result as any,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(unifiedBackgroundJobs.jobId, jobId));
      
      console.log(`✅ Job ${jobId} completed successfully`);
      
    } catch (error: any) {
      console.error(`❌ Job ${jobId} failed:`, error);
      
      // Update job status to failed
      await db.update(unifiedBackgroundJobs)
        .set({
          status: "failed",
          lastError: error.message || "Unknown error",
          errorCount: 1,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(unifiedBackgroundJobs.jobId, jobId));
      
      // Update run status to failed
      await db.update(unifiedAgentRuns)
        .set({
          status: "failed",
          updatedAt: new Date(),
        })
        .where(eq(unifiedAgentRuns.runId, runId));
      
    } finally {
      this.processingJobs.delete(jobId);
    }
  }
  
  /**
   * Get active run for a deal/agent combination
   */
  async getActiveRun(dealId: number, agentType: string): Promise<UnifiedAgentRun | null> {
    const runs = await db
      .select()
      .from(unifiedAgentRuns)
      .where(
        and(
          eq(unifiedAgentRuns.dealId, dealId),
          eq(unifiedAgentRuns.agentType, agentType)
        )
      )
      .orderBy(desc(unifiedAgentRuns.createdAt))
      .limit(1);
    
    return runs.length > 0 ? runs[0] : null;
  }
  
  /**
   * Get analysis status
   */
  async getStatus(dealId: number, agentType: string): Promise<UnifiedAgentRun | null> {
    return this.getActiveRun(dealId, agentType);
  }
  
  /**
   * Get analysis results
   */
  async getResults(dealId: number, agentType: string): Promise<{
    run: UnifiedAgentRun | null;
    answers: any[];
  }> {
    const run = await this.getActiveRun(dealId, agentType);
    
    if (!run) {
      return { run: null, answers: [] };
    }
    
    const answers = await db
      .select()
      .from(unifiedAgentAnswers)
      .where(
        and(
          eq(unifiedAgentAnswers.dealId, dealId),
          eq(unifiedAgentAnswers.runId, run.runId),
          eq(unifiedAgentAnswers.agentType, agentType)
        )
      )
      .orderBy(unifiedAgentAnswers.createdAt);
    
    return { run, answers };
  }
  
  /**
   * Cancel an analysis
   */
  async cancelAnalysis(dealId: number, agentType: string): Promise<boolean> {
    try {
      const run = await this.getActiveRun(dealId, agentType);
      
      if (!run) {
        console.log(`⚠️ No active run found for ${agentType} on deal ${dealId}`);
        return false;
      }
      
      // Update run status
      await db.update(unifiedAgentRuns)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(eq(unifiedAgentRuns.runId, run.runId));
      
      // Cancel associated jobs
      await db.update(unifiedBackgroundJobs)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(unifiedBackgroundJobs.runId, run.runId),
            eq(unifiedBackgroundJobs.status, "running")
          )
        );
      
      // Broadcast cancellation
      websocketManager.broadcast({
        type: "unified_agent_cancelled",
        dealId,
        agentType,
        runId: run.runId,
      });
      
      console.log(`✅ Cancelled ${agentType} analysis for deal ${dealId}`);
      return true;
      
    } catch (error: any) {
      console.error(`❌ Failed to cancel analysis:`, error);
      return false;
    }
  }
  
  /**
   * Delete analysis and all associated data
   */
  async deleteAnalysis(dealId: number, agentType: string): Promise<boolean> {
    try {
      const run = await this.getActiveRun(dealId, agentType);
      
      if (!run) {
        console.log(`⚠️ No run found for ${agentType} on deal ${dealId}`);
        return true;
      }
      
      // Delete answers
      await db.delete(unifiedAgentAnswers)
        .where(
          and(
            eq(unifiedAgentAnswers.dealId, dealId),
            eq(unifiedAgentAnswers.runId, run.runId),
            eq(unifiedAgentAnswers.agentType, agentType)
          )
        );
      
      // Delete jobs
      await db.delete(unifiedBackgroundJobs)
        .where(eq(unifiedBackgroundJobs.runId, run.runId));
      
      // Delete run
      await db.delete(unifiedAgentRuns)
        .where(eq(unifiedAgentRuns.runId, run.runId));
      
      console.log(`✅ Deleted ${agentType} analysis for deal ${dealId}`);
      return true;
      
    } catch (error: any) {
      console.error(`❌ Failed to delete analysis:`, error);
      return false;
    }
  }
  
  /**
   * Get all running jobs
   */
  async getRunningJobs(): Promise<UnifiedBackgroundJob[]> {
    return await db
      .select()
      .from(unifiedBackgroundJobs)
      .where(
        and(
          eq(unifiedBackgroundJobs.agentType, this.agentType),
          eq(unifiedBackgroundJobs.status, "running")
        )
      );
  }
}

/**
 * Singleton service for managing all agent types
 */
export class UnifiedAgentManager {
  private static instance: UnifiedAgentManager;
  
  private constructor() {}
  
  static getInstance(): UnifiedAgentManager {
    if (!this.instance) {
      this.instance = new UnifiedAgentManager();
    }
    return this.instance;
  }
  
  /**
   * Start analysis for any agent type
   */
  async startAnalysis(
    dealId: number,
    agentType: string,
    forceRerun: boolean = false
  ): Promise<UnifiedAnalysisResult> {
    const service = PersistentUnifiedAgentService.getInstance(agentType);
    return service.startAnalysis({ dealId, agentType, forceRerun });
  }
  
  /**
   * Get status for any agent type
   */
  async getStatus(dealId: number, agentType: string): Promise<UnifiedAgentRun | null> {
    const service = PersistentUnifiedAgentService.getInstance(agentType);
    return service.getStatus(dealId, agentType);
  }
  
  /**
   * Get results for any agent type
   */
  async getResults(dealId: number, agentType: string): Promise<any> {
    const service = PersistentUnifiedAgentService.getInstance(agentType);
    return service.getResults(dealId, agentType);
  }
  
  /**
   * Cancel analysis for any agent type
   */
  async cancelAnalysis(dealId: number, agentType: string): Promise<boolean> {
    const service = PersistentUnifiedAgentService.getInstance(agentType);
    return service.cancelAnalysis(dealId, agentType);
  }
  
  /**
   * Delete analysis for any agent type
   */
  async deleteAnalysis(dealId: number, agentType: string): Promise<boolean> {
    const service = PersistentUnifiedAgentService.getInstance(agentType);
    return service.deleteAnalysis(dealId, agentType);
  }
  
  /**
   * Start all agent analyses for a deal
   */
  async startAllAnalyses(dealId: number, forceRerun: boolean = false): Promise<Map<string, UnifiedAnalysisResult>> {
    const agentTypes = ["legal", "clinical", "commercial", "hr", "financial", "ip", "research"];
    const results = new Map<string, UnifiedAnalysisResult>();
    
    for (const agentType of agentTypes) {
      const result = await this.startAnalysis(dealId, agentType, forceRerun);
      results.set(agentType, result);
    }
    
    return results;
  }
  
  /**
   * Get status for all agent types
   */
  async getAllStatuses(dealId: number): Promise<Map<string, UnifiedAgentRun | null>> {
    const agentTypes = ["legal", "clinical", "commercial", "hr", "financial", "ip", "research"];
    const statuses = new Map<string, UnifiedAgentRun | null>();
    
    for (const agentType of agentTypes) {
      const status = await this.getStatus(dealId, agentType);
      statuses.set(agentType, status);
    }
    
    return statuses;
  }
}

// Export singleton instance
export const unifiedAgentManager = UnifiedAgentManager.getInstance();