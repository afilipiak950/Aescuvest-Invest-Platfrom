/**
 * AGENT STAGGERING SERVICE
 * Prevents parallel execution bottlenecks by staggering agent startup times
 * and managing shared OpenAI API rate limits across all agents
 */

interface AgentStartupConfig {
  Legal: number;      // Start immediately
  Clinical: number;   // Start after 15 seconds
  Commercial: number; // Start after 30 seconds  
  HR: number;         // Start after 45 seconds
  Financial: number;  // Start after 60 seconds
  IP: number;         // Start after 75 seconds
  Research: number;   // Start after 90 seconds
}

interface RateLimitConfig {
  openaiCallsPerMinute: number;
  mistralCallsPerMinute: number;
  currentOpenAICalls: number;
  currentMistralCalls: number;
  lastResetTime: number;
}

export class AgentStaggeringService {
  private static instance: AgentStaggeringService;
  
  // Staggered startup delays (in milliseconds)
  private readonly AGENT_DELAYS: AgentStartupConfig = {
    Legal: 0,          // Start immediately - gets first access to APIs
    Clinical: 15000,   // 15 second delay
    Commercial: 30000, // 30 second delay
    HR: 45000,         // 45 second delay  
    Financial: 60000,  // 60 second delay
    IP: 75000,         // 75 second delay
    Research: 90000    // 90 second delay
  };

  // Shared API rate limiting
  private rateLimits: RateLimitConfig = {
    openaiCallsPerMinute: 25,     // Conservative limit (OpenAI allows 30)
    mistralCallsPerMinute: 40,    // Conservative limit (Mistral allows 50)
    currentOpenAICalls: 0,
    currentMistralCalls: 0,
    lastResetTime: Date.now()
  };

  private constructor() {
    // Reset rate limits every minute
    setInterval(() => {
      this.rateLimits.currentOpenAICalls = 0;
      this.rateLimits.currentMistralCalls = 0;
      this.rateLimits.lastResetTime = Date.now();
      console.log(`🔄 Rate limits reset: OpenAI: 0/${this.rateLimits.openaiCallsPerMinute}, Mistral: 0/${this.rateLimits.mistralCallsPerMinute}`);
    }, 60000);
  }

  static getInstance(): AgentStaggeringService {
    if (!AgentStaggeringService.instance) {
      AgentStaggeringService.instance = new AgentStaggeringService();
    }
    return AgentStaggeringService.instance;
  }

  /**
   * STAGGERED STARTUP - Add delay before agent starts analysis
   * This prevents all agents from hitting OpenAI API simultaneously
   */
  async waitForAgentStartup(agentType: keyof AgentStartupConfig): Promise<void> {
    const delay = this.AGENT_DELAYS[agentType];
    
    if (delay === 0) {
      console.log(`⚡ ${agentType} agent starting immediately (priority agent)`);
      return;
    }

    console.log(`⏰ ${agentType} agent waiting ${delay / 1000}s before startup (staggered launch)`);
    await new Promise(resolve => setTimeout(resolve, delay));
    console.log(`🚀 ${agentType} agent startup delay complete - beginning analysis`);
  }

  /**
   * SHARED RATE LIMITER - Check if API call is allowed
   * Prevents any agent from exceeding shared OpenAI/Mistral limits
   */
  async checkRateLimit(apiType: 'openai' | 'mistral'): Promise<boolean> {
    const now = Date.now();
    
    // Auto-reset if more than 60 seconds have passed
    if (now - this.rateLimits.lastResetTime > 60000) {
      this.rateLimits.currentOpenAICalls = 0;
      this.rateLimits.currentMistralCalls = 0;
      this.rateLimits.lastResetTime = now;
    }

    if (apiType === 'openai') {
      const canCall = this.rateLimits.currentOpenAICalls < this.rateLimits.openaiCallsPerMinute;
      if (canCall) {
        this.rateLimits.currentOpenAICalls++;
        console.log(`✅ OpenAI API call approved: ${this.rateLimits.currentOpenAICalls}/${this.rateLimits.openaiCallsPerMinute} calls used`);
      } else {
        console.log(`🚫 OpenAI rate limit reached: ${this.rateLimits.currentOpenAICalls}/${this.rateLimits.openaiCallsPerMinute} calls used`);
      }
      return canCall;
    } else {
      const canCall = this.rateLimits.currentMistralCalls < this.rateLimits.mistralCallsPerMinute;
      if (canCall) {
        this.rateLimits.currentMistralCalls++;
        console.log(`✅ Mistral API call approved: ${this.rateLimits.currentMistralCalls}/${this.rateLimits.mistralCallsPerMinute} calls used`);
      } else {
        console.log(`🚫 Mistral rate limit reached: ${this.rateLimits.currentMistralCalls}/${this.rateLimits.mistralCallsPerMinute} calls used`);
      }
      return canCall;
    }
  }

  /**
   * WAIT FOR API AVAILABILITY - If rate limited, wait for reset
   */
  async waitForApiAvailability(apiType: 'openai' | 'mistral'): Promise<void> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const canCall = await this.checkRateLimit(apiType);
      if (canCall) {
        return; // API is available
      }

      // Wait 10 seconds before trying again
      attempts++;
      console.log(`⏱️ ${apiType.toUpperCase()} API rate limited - waiting 10s (attempt ${attempts}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    console.log(`⚠️ ${apiType.toUpperCase()} API still rate limited after ${maxAttempts} attempts - proceeding anyway`);
  }

  /**
   * Get current rate limit status for debugging
   */
  getRateLimitStatus(): RateLimitConfig {
    return { ...this.rateLimits };
  }
}