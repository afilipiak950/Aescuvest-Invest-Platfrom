/**
 * GLOBAL QUOTA COORDINATOR
 * Prevents multiple agents from competing for OpenAI quota simultaneously
 * Implements intelligent agent scheduling and rate limiting
 */

class GlobalQuotaCoordinator {
  private runningAgents: Set<string> = new Set();
  private queuedAgents: Array<{ agentType: string; dealId: number; priority: number }> = [];
  private quotaExhausted: boolean = false;
  private lastQuotaCheck: Date = new Date();
  private maxConcurrentAgents: number = 1; // Only 1 agent can use OpenAI at a time

  /**
   * Request permission to start an agent
   */
  async requestAgentStart(agentType: string, dealId: number, priority: number = 5): Promise<boolean> {
    console.log(`🎯 Agent ${agentType} requesting to start for deal ${dealId}`);

    // Check if quota is exhausted
    if (this.quotaExhausted && this.shouldWaitForQuotaReset()) {
      console.log(`🚫 OpenAI quota exhausted, denying start for ${agentType}`);
      return false;
    }

    // Check if we can start immediately
    if (this.runningAgents.size < this.maxConcurrentAgents) {
      this.runningAgents.add(`${agentType}-${dealId}`);
      console.log(`✅ Agent ${agentType} authorized to start (${this.runningAgents.size}/${this.maxConcurrentAgents})`);
      return true;
    }

    // Queue the agent if we're at capacity
    console.log(`⏳ Agent ${agentType} queued (${this.runningAgents.size}/${this.maxConcurrentAgents} running)`);
    this.queuedAgents.push({ agentType, dealId, priority });
    this.queuedAgents.sort((a, b) => b.priority - a.priority); // Higher priority first
    return false;
  }

  /**
   * Notify that an agent has completed or failed
   */
  async notifyAgentComplete(agentType: string, dealId: number, success: boolean): Promise<void> {
    const agentKey = `${agentType}-${dealId}`;
    this.runningAgents.delete(agentKey);
    
    console.log(`🏁 Agent ${agentType} completed (success: ${success}). Running: ${this.runningAgents.size}/${this.maxConcurrentAgents}`);

    // Start next queued agent if any
    await this.processQueue();
  }

  /**
   * Mark quota as exhausted (called when 429 errors occur)
   */
  markQuotaExhausted(): void {
    this.quotaExhausted = true;
    this.lastQuotaCheck = new Date();
    console.log(`🚫 OpenAI quota marked as exhausted at ${this.lastQuotaCheck.toISOString()}`);
  }

  /**
   * Check if we should wait for quota reset (wait 1 hour)
   */
  private shouldWaitForQuotaReset(): boolean {
    const hoursSinceLastCheck = (Date.now() - this.lastQuotaCheck.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastCheck < 1; // Wait 1 hour before trying again
  }

  /**
   * Process the queue to start next agent
   */
  private async processQueue(): Promise<void> {
    if (this.queuedAgents.length === 0 || this.runningAgents.size >= this.maxConcurrentAgents) {
      return;
    }

    // Check if quota is still exhausted
    if (this.quotaExhausted && this.shouldWaitForQuotaReset()) {
      console.log(`⏳ Quota still exhausted, not processing queue`);
      return;
    }

    // Reset quota status if enough time has passed
    if (this.quotaExhausted && !this.shouldWaitForQuotaReset()) {
      console.log(`🔄 Quota reset timeout passed, allowing new agents`);
      this.quotaExhausted = false;
    }

    const nextAgent = this.queuedAgents.shift();
    if (nextAgent) {
      this.runningAgents.add(`${nextAgent.agentType}-${nextAgent.dealId}`);
      console.log(`🚀 Starting queued agent ${nextAgent.agentType} for deal ${nextAgent.dealId}`);
      
      // Notify the agent to start (this would need to be implemented per agent)
      await this.triggerAgentStart(nextAgent.agentType, nextAgent.dealId);
    }
  }

  /**
   * Trigger agent start (placeholder - would need agent-specific implementation)
   */
  private async triggerAgentStart(agentType: string, dealId: number): Promise<void> {
    // This would need to be implemented to actually start the agent
    console.log(`🎯 Would trigger ${agentType} start for deal ${dealId}`);
  }

  /**
   * Get current status
   */
  getStatus(): { running: number; queued: number; quotaExhausted: boolean } {
    return {
      running: this.runningAgents.size,
      queued: this.queuedAgents.length,
      quotaExhausted: this.quotaExhausted
    };
  }

  /**
   * Force clear all running agents (for debugging)
   */
  clearAll(): void {
    this.runningAgents.clear();
    this.queuedAgents.length = 0;
    this.quotaExhausted = false;
    console.log(`🧹 Global quota coordinator cleared`);
  }
}

// Global singleton instance
export const globalQuotaCoordinator = new GlobalQuotaCoordinator();