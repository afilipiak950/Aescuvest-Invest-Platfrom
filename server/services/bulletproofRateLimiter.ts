/**
 * ENHANCED BULLETPROOF RATE LIMITER SERVICE
 * Token-bucket algorithm with adaptive backoff for maximum throughput
 * Prevents OCR and AI processing from getting stuck in production
 * Handles rate limits for OpenAI, Mistral, and other APIs
 */

interface TokenBucket {
  tokens: number;
  maxTokens: number;
  refillRate: number; // tokens per second
  lastRefill: number;
}

interface RateLimitConfig {
  tokensPerMinute: number;
  burstCapacity: number;
  refillRate: number; // tokens per second
}

class EnhancedBulletproofRateLimiter {
  private tokenBuckets: Map<string, TokenBucket> = new Map();
  private rateLimitConfigs: Map<string, RateLimitConfig> = new Map();
  private backoffTracking: Map<string, { hits: number; lastHit: number }> = new Map();
  
  constructor() {
    // Configure token bucket rate limits for different services
    this.rateLimitConfigs.set('openai', {
      tokensPerMinute: 50,  // 50 calls per minute
      burstCapacity: 10,    // Allow bursts of 10 calls
      refillRate: 50 / 60   // 0.83 tokens per second
    });
    
    this.rateLimitConfigs.set('mistral', {
      tokensPerMinute: 50,  // 50 calls per minute
      burstCapacity: 8,     // Allow bursts of 8 calls
      refillRate: 50 / 60   // 0.83 tokens per second
    });
    
    this.rateLimitConfigs.set('embeddings', {
      tokensPerMinute: 100, // 100 calls per minute
      burstCapacity: 15,    // Allow bursts of 15 calls
      refillRate: 100 / 60  // 1.67 tokens per second
    });
    
    // Initialize token buckets
    for (const [service, config] of this.rateLimitConfigs.entries()) {
      this.tokenBuckets.set(service, {
        tokens: config.burstCapacity, // Start with full burst capacity
        maxTokens: config.burstCapacity,
        refillRate: config.refillRate,
        lastRefill: Date.now()
      });
    }
  }
  
  /**
   * Refill tokens in the bucket based on elapsed time
   */
  private refillTokens(service: string): void {
    const bucket = this.tokenBuckets.get(service);
    const config = this.rateLimitConfigs.get(service);
    
    if (!bucket || !config) return;
    
    const now = Date.now();
    const timeDelta = (now - bucket.lastRefill) / 1000; // seconds
    
    // Calculate tokens to add
    const tokensToAdd = timeDelta * bucket.refillRate;
    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }
  
  /**
   * Check if tokens are available and consume one if possible
   */
  private tryConsumeToken(service: string): boolean {
    this.refillTokens(service);
    
    const bucket = this.tokenBuckets.get(service);
    if (!bucket) return true; // No limit configured
    
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    
    return false;
  }
  
  /**
   * Calculate wait time until next token is available
   */
  private getWaitTime(service: string): number {
    const bucket = this.tokenBuckets.get(service);
    if (!bucket) return 0;
    
    if (bucket.tokens >= 1) return 0;
    
    // Time to refill at least 1 token
    const timeForOneToken = 1000 / bucket.refillRate; // milliseconds
    return Math.ceil(timeForOneToken);
  }
  
  /**
   * Adaptive exponential backoff with jitter for rate limit hits
   */
  private getAdaptiveBackoff(service: string): number {
    const tracking = this.backoffTracking.get(service) || { hits: 0, lastHit: 0 };
    const now = Date.now();
    
    // Reset hit count if it's been more than 5 minutes since last hit
    if (now - tracking.lastHit > 5 * 60 * 1000) {
      tracking.hits = 0;
    }
    
    tracking.hits += 1;
    tracking.lastHit = now;
    this.backoffTracking.set(service, tracking);
    
    // Exponential backoff: 2^hits seconds, max 60 seconds
    const baseDelay = Math.min(Math.pow(2, tracking.hits), 60) * 1000;
    
    // Add jitter (±25% randomization) to prevent thundering herd
    const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
    const finalDelay = Math.max(1000, baseDelay + jitter); // Minimum 1 second
    
    console.log(`🔄 Rate limit backoff for ${service}: ${Math.ceil(finalDelay/1000)}s (hit #${tracking.hits})`);
    return finalDelay;
  }
  
  /**
   * Enhanced rate limit with token bucket algorithm and adaptive backoff
   * @param service - The service being called (openai, mistral, etc)
   * @returns Promise that resolves when it's safe to make the API call
   */
  async waitForRateLimit(service: string): Promise<void> {
    // Try to consume a token immediately
    if (this.tryConsumeToken(service)) {
      // Reset backoff tracking on successful token consumption
      const tracking = this.backoffTracking.get(service);
      if (tracking && tracking.hits > 0) {
        tracking.hits = Math.max(0, tracking.hits - 1); // Slowly recover
      }
      return;
    }
    
    // No tokens available - calculate optimal wait time
    const tokenWaitTime = this.getWaitTime(service);
    const backoffTime = this.getAdaptiveBackoff(service);
    
    // Use the longer of token wait time or adaptive backoff
    const waitTime = Math.max(tokenWaitTime, backoffTime);
    
    console.log(`⏳ Token bucket rate limit for ${service}: waiting ${Math.ceil(waitTime/1000)}s (tokens: ${this.getAvailableTokens(service)}, backoff: ${backoffTime > tokenWaitTime})`);
    
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // Recursive call to try again after waiting
    return this.waitForRateLimit(service);
  }
  
  /**
   * Non-blocking check if a token is available
   * @param service - The service to check
   * @returns true if a token is immediately available
   */
  isTokenAvailable(service: string): boolean {
    this.refillTokens(service);
    const bucket = this.tokenBuckets.get(service);
    return !bucket || bucket.tokens >= 1;
  }
  
  /**
   * Get the number of available tokens
   * @param service - The service to check
   * @returns Number of tokens currently available
   */
  getAvailableTokens(service: string): number {
    this.refillTokens(service);
    const bucket = this.tokenBuckets.get(service);
    return bucket ? Math.floor(bucket.tokens) : 0;
  }
  
  /**
   * Enhanced batch size suggestion based on token availability and system load
   * @param service - The service being called
   * @param currentQueueSize - Current number of pending jobs
   * @returns Suggested batch size for optimal throughput
   */
  getSuggestedBatchSize(service: string, currentQueueSize: number = 0): number {
    this.refillTokens(service);
    const availableTokens = this.getAvailableTokens(service);
    const config = this.rateLimitConfigs.get(service);
    
    if (!config) return 12; // Default max batch size
    
    // Calculate suggested batch size based on available tokens
    let suggestedSize = Math.min(availableTokens, 12); // Cap at 12 for memory management
    
    // Adjust based on queue pressure
    if (currentQueueSize > 100) {
      // High queue pressure - be more aggressive
      suggestedSize = Math.min(suggestedSize + 2, 12);
    } else if (currentQueueSize < 20) {
      // Low queue pressure - be more conservative
      suggestedSize = Math.max(Math.floor(suggestedSize * 0.7), 1);
    }
    
    // Ensure minimum batch size of 1
    return Math.max(suggestedSize, 1);
  }
  
  /**
   * Get optimal stagger delay between parallel job starts
   * @param service - The service being called
   * @param jobIndex - Index of the job in the batch (0-based)
   * @returns Delay in milliseconds with adaptive jitter
   */
  getOptimalStaggerDelay(service: string, jobIndex: number): number {
    if (jobIndex === 0) return 0; // First job starts immediately
    
    const availableTokens = this.getAvailableTokens(service);
    const tracking = this.backoffTracking.get(service);
    
    // Base delay: 50-150ms with jitter
    const baseDelay = 50 + Math.random() * 100;
    
    // Increase delay if we have fewer tokens available
    let tokenPenalty = 0;
    if (availableTokens < 3) {
      tokenPenalty = (3 - availableTokens) * 100; // 100ms penalty per missing token
    }
    
    // Increase delay if we've had recent rate limit hits
    let backoffPenalty = 0;
    if (tracking && tracking.hits > 0) {
      backoffPenalty = tracking.hits * 50; // 50ms penalty per recent hit
    }
    
    const totalDelay = Math.min(baseDelay + tokenPenalty + backoffPenalty, 1000); // Cap at 1 second
    
    return Math.floor(totalDelay);
  }
  
  /**
   * Reset rate limit tracking for a service
   * @param service - The service to reset
   */
  reset(service: string): void {
    const config = this.rateLimitConfigs.get(service);
    if (config) {
      this.tokenBuckets.set(service, {
        tokens: config.burstCapacity,
        maxTokens: config.burstCapacity,
        refillRate: config.refillRate,
        lastRefill: Date.now()
      });
    }
    this.backoffTracking.delete(service);
  }
  
  /**
   * Get comprehensive rate limit status with token bucket information
   * @param service - The service to check
   * @returns Detailed status object with token and timing information
   */
  getStatus(service: string): { 
    availableTokens: number; 
    maxTokens: number; 
    refillRate: number;
    nextTokenIn: number;
    recentHits: number;
    estimatedWait: number;
  } {
    this.refillTokens(service);
    
    const bucket = this.tokenBuckets.get(service);
    const config = this.rateLimitConfigs.get(service);
    const tracking = this.backoffTracking.get(service) || { hits: 0, lastHit: 0 };
    
    if (!bucket || !config) {
      return {
        availableTokens: 0,
        maxTokens: 0,
        refillRate: 0,
        nextTokenIn: 0,
        recentHits: 0,
        estimatedWait: 0
      };
    }
    
    const nextTokenIn = bucket.tokens >= 1 ? 0 : Math.ceil(1000 / bucket.refillRate);
    const estimatedWait = this.isTokenAvailable(service) ? 0 : this.getWaitTime(service);
    
    return {
      availableTokens: Math.floor(bucket.tokens),
      maxTokens: bucket.maxTokens,
      refillRate: bucket.refillRate,
      nextTokenIn,
      recentHits: tracking.hits,
      estimatedWait
    };
  }
  
  /**
   * Log current rate limit status for monitoring
   */
  logStatus(): void {
    console.log('🔧 Rate Limiter Status:');
    for (const service of this.rateLimitConfigs.keys()) {
      const status = this.getStatus(service);
      console.log(`  ${service.toUpperCase()}: ${status.availableTokens}/${status.maxTokens} tokens, ${status.recentHits} recent hits, ${status.estimatedWait}ms wait`);
    }
  }
}

// Export singleton instance
export const bulletproofRateLimiter = new EnhancedBulletproofRateLimiter();