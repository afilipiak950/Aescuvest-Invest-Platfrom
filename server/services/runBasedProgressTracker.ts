/**
 * RUN-BASED PROGRESS TRACKER
 * 
 * Implements proper Run ID-based job tracking for true progress bars (0% → 100%)
 * Each analysis run gets a unique Run ID with dedicated job counting and progress tracking
 */

import { storage } from '../storage';
import { randomUUID } from 'crypto';

export interface AnalysisRun {
  runId: string;
  dealId: number;
  startTime: Date;
  agentJobs: AgentJobTracker[];
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  status: 'running' | 'completed' | 'failed';
}

export interface AgentJobTracker {
  agentType: string;
  assignedDocs: number;
  questionsCount: number;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  progress: number; // 0-100
  status: 'idle' | 'processing' | 'completed' | 'failed';
}

export interface JobProgress {
  runId: string;
  dealId: number;
  overallProgress: number;
  agentProgress: AgentJobTracker[];
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  runningJobs: number;
}

class RunBasedProgressTracker {
  private activeRuns = new Map<string, AnalysisRun>();

  /**
   * Create a new analysis run with proper job counting
   */
  async createAnalysisRun(dealId: number, agentTypes: string[]): Promise<string> {
    const runId = randomUUID();
    console.log(`🆔 Creating new analysis run: ${runId} for deal ${dealId}`);

    // Get document assignments for each agent
    const agentJobs: AgentJobTracker[] = [];
    let totalJobs = 0;

    for (const agentType of agentTypes) {
      // Get document assignments - using a reasonable count for now
      const assignedDocs = await this.getAssignedDocumentCount(dealId, agentType);
      const questionsCount = this.getQuestionsCountForAgent(agentType);
      const agentTotalJobs = assignedDocs * questionsCount;

      agentJobs.push({
        agentType,
        assignedDocs,
        questionsCount,
        totalJobs: agentTotalJobs,
        completedJobs: 0,
        failedJobs: 0,
        progress: 0,
        status: 'idle'
      });

      totalJobs += agentTotalJobs;
    }

    const analysisRun: AnalysisRun = {
      runId,
      dealId,
      startTime: new Date(),
      agentJobs,
      totalJobs,
      completedJobs: 0,
      failedJobs: 0,
      status: 'running'
    };

    this.activeRuns.set(runId, analysisRun);

    console.log(`✅ Created run ${runId}: ${totalJobs} total jobs across ${agentTypes.length} agents`);
    return runId;
  }

  /**
   * Update job completion for a specific agent
   */
  updateJobProgress(runId: string, agentType: string, completedJobs: number, failedJobs: number = 0): JobProgress | null {
    const run = this.activeRuns.get(runId);
    if (!run) {
      console.error(`❌ Run ${runId} not found`);
      return null;
    }

    const agentTracker = run.agentJobs.find(agent => agent.agentType === agentType);
    if (!agentTracker) {
      console.error(`❌ Agent ${agentType} not found in run ${runId}`);
      return null;
    }

    // Update agent progress
    agentTracker.completedJobs = completedJobs;
    agentTracker.failedJobs = failedJobs;
    agentTracker.progress = Math.floor((completedJobs / agentTracker.totalJobs) * 100);
    
    if (completedJobs >= agentTracker.totalJobs) {
      agentTracker.status = 'completed';
    } else if (completedJobs > 0) {
      agentTracker.status = 'processing';
    }

    // Update overall run progress
    run.completedJobs = run.agentJobs.reduce((sum, agent) => sum + agent.completedJobs, 0);
    run.failedJobs = run.agentJobs.reduce((sum, agent) => sum + agent.failedJobs, 0);

    const overallProgress = Math.floor((run.completedJobs / run.totalJobs) * 100);
    const runningJobs = run.totalJobs - run.completedJobs - run.failedJobs;

    // Check if run is complete
    if (run.completedJobs >= run.totalJobs) {
      run.status = 'completed';
    }

    console.log(`📊 Run ${runId} progress: ${overallProgress}% (${run.completedJobs}/${run.totalJobs})`);

    return {
      runId,
      dealId: run.dealId,
      overallProgress,
      agentProgress: [...run.agentJobs],
      totalJobs: run.totalJobs,
      completedJobs: run.completedJobs,
      failedJobs: run.failedJobs,
      runningJobs
    };
  }

  /**
   * Get current progress for a run
   */
  getRunProgress(runId: string): JobProgress | null {
    const run = this.activeRuns.get(runId);
    if (!run) return null;

    const overallProgress = Math.floor((run.completedJobs / run.totalJobs) * 100);
    const runningJobs = run.totalJobs - run.completedJobs - run.failedJobs;

    return {
      runId,
      dealId: run.dealId,
      overallProgress,
      agentProgress: [...run.agentJobs],
      totalJobs: run.totalJobs,
      completedJobs: run.completedJobs,
      failedJobs: run.failedJobs,
      runningJobs
    };
  }

  /**
   * Get active run for a deal (if any)
   */
  getActiveRunForDeal(dealId: number): string | null {
    for (const [runId, run] of this.activeRuns.entries()) {
      if (run.dealId === dealId && run.status === 'running') {
        return runId;
      }
    }
    return null;
  }

  /**
   * Get all active runs for debugging/recovery purposes
   */
  getAllActiveRuns(): Array<[string, AnalysisRun]> {
    return Array.from(this.activeRuns.entries());
  }

  /**
   * Find any run for a deal (including ones with progress but wrong status)
   */
  findAnyRunForDeal(dealId: number): string | null {
    for (const [runId, run] of this.activeRuns.entries()) {
      if (run.dealId === dealId && (run.status === 'running' || run.completedJobs > 0)) {
        return runId;
      }
    }
    return null;
  }

  /**
   * Complete a run
   */
  completeRun(runId: string) {
    const run = this.activeRuns.get(runId);
    if (run) {
      run.status = 'completed';
      console.log(`✅ Completed analysis run: ${runId}`);
    }
  }

  /**
   * Cancel/clear a run
   */
  cancelRun(runId: string) {
    this.activeRuns.delete(runId);
    console.log(`🗑️ Cancelled analysis run: ${runId}`);
  }

  /**
   * Get questions count for agent type
   */
  private getQuestionsCountForAgent(agentType: string): number {
    const questionsMap: Record<string, number> = {
      'legal': 6,
      'clinical': 6, 
      'commercial': 6,
      'hr': 6,
      'financial': 6,
      'ip': 6,
      'research': 6
    };
    
    return questionsMap[agentType.toLowerCase()] || 6;
  }

  /**
   * Get assigned document count for an agent (helper method)
   */
  private async getAssignedDocumentCount(dealId: number, agentType: string): Promise<number> {
    try {
      // Try to get from storage if method exists
      if (typeof (storage as any).getAssignedDocumentCount === 'function') {
        return await (storage as any).getAssignedDocumentCount(dealId, agentType);
      }
      
      // Fallback: get document assignments from analyses table
      const analyses = await storage.getAnalysesByDealId(dealId);
      const agentAnalysis = analyses.find(a => a.agentType.toLowerCase() === agentType.toLowerCase());
      
      if (agentAnalysis?.documentSources && Array.isArray(agentAnalysis.documentSources)) {
        return agentAnalysis.documentSources.length;
      }
      
      // Final fallback: use reasonable estimate based on total documents
      const documents = await storage.getDocumentsByDealId(dealId);
      const totalDocs = documents.length;
      
      // Different agents get different percentages of documents
      const agentPercentages: Record<string, number> = {
        'legal': 0.8,
        'clinical': 0.7,
        'commercial': 0.6,
        'hr': 0.5,
        'financial': 0.7,
        'ip': 0.6,
        'research': 0.9
      };
      
      const percentage = agentPercentages[agentType.toLowerCase()] || 0.7;
      return Math.floor(totalDocs * percentage);
      
    } catch (error) {
      console.error(`Error getting assigned docs for ${agentType}:`, error);
      return 100; // Safe fallback
    }
  }

  /**
   * Get all active runs (for debugging)
   */
  getAllActiveRuns(): AnalysisRun[] {
    const runs: AnalysisRun[] = [];
    for (const run of this.activeRuns.values()) {
      runs.push(run);
    }
    return runs;
  }
}

export const runTracker = new RunBasedProgressTracker();