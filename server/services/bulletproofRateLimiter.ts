/**
 * BULLETPROOF RATE LIMITER SERVICE
 * Prevents OCR and AI processing from getting stuck in production
 * Handles rate limits for OpenAI, Mistral, and other APIs
 */

class BulletproofRateLimiter {
  private apiCallTimestamps: Map<string, number[]> = new Map();
  private rateLimits: Map<string, { calls: number; window: number }> = new Map();
  
  constructor() {
    // Configure rate limits for different services
    this.rateLimits.set('openai', { 
      calls: 30,  // 30 calls per minute (safe limit, actual is 60)
      window: 60000 
    });
    
    this.rateLimits.set('mistral', { 
      calls: 10,  // REDUCED: Mistral has stricter limits than documented
      window: 60000 
    });
    
    this.rateLimits.set('embeddings', { 
      calls: 100,  // 100 calls per minute
      window: 60000 
    });
  }
  
  /**
   * Wait if necessary to respect rate limits
   * @param service - The service being called (openai, mistral, etc)
   * @returns Promise that resolves when it's safe to make the API call
   */
  async waitForRateLimit(service: string): Promise<void> {
    const limit = this.rateLimits.get(service);
    if (!limit) return; // No limit configured
    
    const now = Date.now();
    const timestamps = this.apiCallTimestamps.get(service) || [];
    
    // Remove timestamps outside the window
    const validTimestamps = timestamps.filter(t => now - t < limit.window);
    
    if (validTimestamps.length >= limit.calls) {
      // We've hit the rate limit, calculate wait time
      const oldestCall = validTimestamps[0];
      const waitTime = limit.window - (now - oldestCall) + 1000; // Add 1 second buffer
      
      console.log(`⏳ Rate limit approaching for ${service}, waiting ${Math.ceil(waitTime/1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Recursive call to re-check after waiting
      return this.waitForRateLimit(service);
    }
    
    // Record this API call
    validTimestamps.push(now);
    this.apiCallTimestamps.set(service, validTimestamps);
  }
  
  /**
   * Get suggested batch size based on current rate limit status
   * @param service - The service being called
   * @returns Suggested batch size
   */
  getSuggestedBatchSize(service: string): number {
    const limit = this.rateLimits.get(service);
    if (!limit) return 10; // Default batch size
    
    const now = Date.now();
    const timestamps = this.apiCallTimestamps.get(service) || [];
    const validTimestamps = timestamps.filter(t => now - t < limit.window);
    
    const remainingCalls = limit.calls - validTimestamps.length;
    
    // Suggest conservative batch sizes
    if (remainingCalls > 20) return 5;
    if (remainingCalls > 10) return 3;
    if (remainingCalls > 5) return 2;
    return 1;
  }
  
  /**
   * Reset rate limit tracking for a service
   * @param service - The service to reset
   */
  reset(service: string): void {
    this.apiCallTimestamps.delete(service);
  }
  
  /**
   * Get current rate limit status
   * @param service - The service to check
   * @returns Status object with usage information
   */
  getStatus(service: string): { used: number; limit: number; resetIn: number } {
    const limit = this.rateLimits.get(service);
    if (!limit) return { used: 0, limit: 0, resetIn: 0 };
    
    const now = Date.now();
    const timestamps = this.apiCallTimestamps.get(service) || [];
    const validTimestamps = timestamps.filter(t => now - t < limit.window);
    
    const oldestCall = validTimestamps[0] || now;
    const resetIn = Math.max(0, limit.window - (now - oldestCall));
    
    return {
      used: validTimestamps.length,
      limit: limit.calls,
      resetIn: Math.ceil(resetIn / 1000)
    };
  }
}

// Export singleton instance
export const bulletproofRateLimiter = new BulletproofRateLimiter();