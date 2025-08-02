import OpenAI from "openai";

interface QuotaManagerConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  fallbackEnabled: boolean;
}

interface QuotaStatus {
  isExceeded: boolean;
  retryAfter?: number;
  estimatedResetTime?: Date;
}

export class OpenAIQuotaManager {
  private config: QuotaManagerConfig;
  private quotaStatus: QuotaStatus;
  private failedRequestCount: number = 0;
  private lastQuotaCheck: Date;

  constructor(config: Partial<QuotaManagerConfig> = {}) {
    this.config = {
      maxRetries: 3,
      baseDelay: 5000, // 5 seconds
      maxDelay: 300000, // 5 minutes
      fallbackEnabled: true,
      ...config
    };
    
    this.quotaStatus = { isExceeded: false };
    this.lastQuotaCheck = new Date();
  }

  async makeRequest<T>(
    requestFn: () => Promise<T>,
    options: {
      fallbackContent?: string;
      priority?: 'high' | 'medium' | 'low';
      description?: string;
    } = {}
  ): Promise<T | string> {
    const { fallbackContent, priority = 'medium', description = 'OpenAI request' } = options;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`🤖 Attempting ${description} (attempt ${attempt}/${this.config.maxRetries})`);
        
        // Check quota status before making request
        if (this.quotaStatus.isExceeded && this.shouldWaitForQuota()) {
          console.log(`⏳ Quota exceeded, waiting...`);
          await this.waitForQuotaReset();
        }

        const result = await requestFn();
        
        // Reset failure count on success
        this.failedRequestCount = 0;
        this.quotaStatus.isExceeded = false;
        
        console.log(`✅ ${description} completed successfully`);
        return result;

      } catch (error: any) {
        const isQuotaError = this.isQuotaError(error);
        const isRateLimitError = this.isRateLimitError(error);
        
        console.log(`❌ ${description} failed (attempt ${attempt}): ${error.message}`);
        
        if (isQuotaError) {
          this.handleQuotaExceeded(error);
        } else if (isRateLimitError) {
          this.handleRateLimit(error);
        }

        // If this is the last attempt and we have fallback content
        if (attempt === this.config.maxRetries) {
          this.failedRequestCount++;
          
          if (this.config.fallbackEnabled && fallbackContent) {
            console.log(`🔄 Using fallback content for ${description} after ${this.config.maxRetries} attempts`);
            return fallbackContent;
          } else {
            console.log(`💥 All attempts failed for ${description}, no fallback available`);
            throw new Error(`OpenAI request failed after ${this.config.maxRetries} attempts: ${error.message}`);
          }
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, isQuotaError || isRateLimitError);
        console.log(`⏳ Waiting ${delay/1000}s before retry...`);
        await this.sleep(delay);
      }
    }

    throw new Error(`Unexpected error in quota manager for ${description}`);
  }

  private isQuotaError(error: any): boolean {
    return error?.status === 429 && 
           (error?.message?.includes('quota') || 
            error?.message?.includes('insufficient_quota') ||
            error?.code === 'insufficient_quota');
  }

  private isRateLimitError(error: any): boolean {
    return error?.status === 429 && !this.isQuotaError(error);
  }

  private handleQuotaExceeded(error: any): void {
    this.quotaStatus.isExceeded = true;
    this.quotaStatus.retryAfter = this.extractRetryAfter(error) || 3600; // Default 1 hour
    this.quotaStatus.estimatedResetTime = new Date(Date.now() + (this.quotaStatus.retryAfter * 1000));
    
    console.log(`🚫 OpenAI quota exceeded. Estimated reset: ${this.quotaStatus.estimatedResetTime?.toISOString()}`);
  }

  private handleRateLimit(error: any): void {
    const retryAfter = this.extractRetryAfter(error) || 60; // Default 1 minute
    console.log(`⚡ Rate limit hit, retry after ${retryAfter}s`);
  }

  private extractRetryAfter(error: any): number | null {
    // Try to extract retry-after from error headers or response
    return error?.headers?.['retry-after'] || 
           error?.response?.headers?.['retry-after'] ||
           null;
  }

  private shouldWaitForQuota(): boolean {
    if (!this.quotaStatus.estimatedResetTime) return false;
    return new Date() < this.quotaStatus.estimatedResetTime;
  }

  private async waitForQuotaReset(): Promise<void> {
    if (!this.quotaStatus.estimatedResetTime) return;
    
    const waitTime = Math.min(
      this.quotaStatus.estimatedResetTime.getTime() - Date.now(),
      this.config.maxDelay
    );
    
    if (waitTime > 0) {
      console.log(`⏳ Waiting ${waitTime/1000}s for quota reset...`);
      await this.sleep(waitTime);
    }
  }

  private calculateDelay(attempt: number, isQuotaRelated: boolean): number {
    if (isQuotaRelated) {
      // Longer delays for quota/rate limit issues
      return Math.min(this.config.baseDelay * Math.pow(2, attempt), this.config.maxDelay);
    } else {
      // Shorter delays for other errors
      return Math.min(this.config.baseDelay * attempt, this.config.maxDelay / 2);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Status methods
  getQuotaStatus(): QuotaStatus {
    return { ...this.quotaStatus };
  }

  getFailedRequestCount(): number {
    return this.failedRequestCount;
  }

  isHealthy(): boolean {
    return !this.quotaStatus.isExceeded && this.failedRequestCount < 5;
  }

  reset(): void {
    this.quotaStatus = { isExceeded: false };
    this.failedRequestCount = 0;
    console.log(`🔄 OpenAI quota manager reset`);
  }
}

// Global quota manager instance
export const openaiQuotaManager = new OpenAIQuotaManager({
  maxRetries: 3,
  baseDelay: 5000,
  maxDelay: 300000,
  fallbackEnabled: true
});