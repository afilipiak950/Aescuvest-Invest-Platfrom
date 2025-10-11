/**
 * Resilient OpenAI Client Wrapper
 * Provides retry logic, exponential backoff, and timeout handling
 * Prevents hard failures on GPT-4o slowdowns and rate limits
 */

import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface RetryConfig {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  timeout?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

interface RateLimitState {
  lastCallTime: number;
  callCount: number;
  windowStart: number;
}

class ResilientOpenAIClient {
  private rateLimitState: RateLimitState = {
    lastCallTime: 0,
    callCount: 0,
    windowStart: Date.now()
  };

  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly MAX_CALLS_PER_WINDOW = 50; // Conservative limit
  private readonly MIN_DELAY_BETWEEN_CALLS = 1000; // 1 second minimum

  /**
   * Make a resilient OpenAI API call with retry logic and timeout handling
   */
  async createChatCompletion(
    params: OpenAI.Chat.ChatCompletionCreateParams,
    config: RetryConfig = {}
  ): Promise<OpenAI.Chat.ChatCompletion> {
    const {
      maxRetries = 5,
      initialDelay = 2000,
      maxDelay = 60000,
      timeout = 120000, // 2 minutes default
      onRetry
    } = config;

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Apply rate limiting
        await this.applyRateLimit();
        
        // Create timeout promise with clearable timer
        let timeoutId: NodeJS.Timeout;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout);
        });
        
        // Race API call against timeout
        const apiCallPromise = openai.chat.completions.create(params);
        
        try {
          const response = await Promise.race([
            apiCallPromise,
            timeoutPromise
          ]) as OpenAI.Chat.ChatCompletion;
          
          // Clear timeout on success
          clearTimeout(timeoutId);
          
          // Success - update rate limit tracking
          this.updateRateLimitState();
          
          return response;
        } catch (error) {
          // Clear timeout on error too
          clearTimeout(timeoutId);
          throw error;
        }
        
      } catch (error: any) {
        lastError = error;
        
        // Check if this is the last attempt
        if (attempt === maxRetries) {
          console.error(`❌ OpenAI call failed after ${maxRetries + 1} attempts:`, error.message);
          throw error;
        }
        
        // Determine if we should retry
        const shouldRetry = this.shouldRetryError(error);
        if (!shouldRetry) {
          console.error(`❌ Non-retryable error:`, error.message);
          throw error;
        }
        
        // Calculate delay with exponential backoff and jitter
        const baseDelay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
        const jitter = Math.random() * baseDelay * 0.3; // 30% jitter
        const delay = baseDelay + jitter;
        
        // Check for rate limit specific backoff
        const rateLimitDelay = this.getRateLimitDelay(error);
        const finalDelay = Math.max(delay, rateLimitDelay);
        
        console.warn(`⚠️ OpenAI call failed (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}`);
        console.warn(`🔄 Retrying in ${Math.round(finalDelay / 1000)}s...`);
        
        // Call retry callback if provided
        if (onRetry) {
          onRetry(attempt + 1, error);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, finalDelay));
      }
    }
    
    throw lastError || new Error('OpenAI call failed after retries');
  }

  /**
   * Determine if an error is retryable
   */
  private shouldRetryError(error: any): boolean {
    // Timeout errors - always retry
    if (error.message?.includes('timeout') || error.message?.includes('Request timeout')) {
      return true;
    }
    
    // Rate limit errors - always retry with backoff
    if (error.status === 429 || error.message?.includes('rate_limit')) {
      return true;
    }
    
    // Server errors (5xx) - retry
    if (error.status >= 500 && error.status < 600) {
      return true;
    }
    
    // Network errors - retry
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }
    
    // Client errors (4xx except rate limit) - don't retry
    if (error.status >= 400 && error.status < 500) {
      return false;
    }
    
    // Unknown errors - retry to be safe
    return true;
  }

  /**
   * Get specific delay for rate limit errors from response headers
   */
  private getRateLimitDelay(error: any): number {
    // Check for Retry-After header
    if (error.headers && error.headers['retry-after']) {
      const retryAfter = parseInt(error.headers['retry-after'], 10);
      if (!isNaN(retryAfter)) {
        return retryAfter * 1000; // Convert to milliseconds
      }
    }
    
    // Default rate limit backoff
    if (error.status === 429) {
      return 30000; // 30 seconds for rate limits
    }
    
    return 0;
  }

  /**
   * Apply rate limiting to prevent hitting API limits
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset window if needed
    if (now - this.rateLimitState.windowStart >= this.RATE_LIMIT_WINDOW) {
      this.rateLimitState.windowStart = now;
      this.rateLimitState.callCount = 0;
    }
    
    // Check if we're approaching rate limit
    if (this.rateLimitState.callCount >= this.MAX_CALLS_PER_WINDOW) {
      const waitTime = this.RATE_LIMIT_WINDOW - (now - this.rateLimitState.windowStart);
      if (waitTime > 0) {
        console.warn(`⏳ Rate limit approaching - waiting ${Math.round(waitTime / 1000)}s`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Reset after waiting
        this.rateLimitState.windowStart = Date.now();
        this.rateLimitState.callCount = 0;
      }
    }
    
    // Enforce minimum delay between calls
    const timeSinceLastCall = now - this.rateLimitState.lastCallTime;
    if (timeSinceLastCall < this.MIN_DELAY_BETWEEN_CALLS) {
      const delay = this.MIN_DELAY_BETWEEN_CALLS - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  /**
   * Update rate limit state after successful call
   */
  private updateRateLimitState(): void {
    this.rateLimitState.lastCallTime = Date.now();
    this.rateLimitState.callCount++;
  }

  /**
   * Token estimation helper (approximate)
   */
  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    // More accurate would use tiktoken library, but this is good enough
    return Math.ceil(text.length / 4);
  }

  /**
   * Truncate text to fit within token limit
   */
  truncateToTokenLimit(text: string, maxTokens: number): string {
    const estimatedTokens = this.estimateTokens(text);
    if (estimatedTokens <= maxTokens) {
      return text;
    }
    
    const ratio = maxTokens / estimatedTokens;
    const targetLength = Math.floor(text.length * ratio * 0.9); // 90% to be safe
    
    return text.substring(0, targetLength) + '... [truncated]';
  }

  /**
   * Count tokens in a batch of evidence
   */
  countBatchTokens(evidence: any[]): number {
    let totalTokens = 0;
    
    for (const ev of evidence) {
      // Document name
      totalTokens += this.estimateTokens(ev.documentName || '');
      
      // Relevant content
      if (Array.isArray(ev.relevantContent)) {
        for (const content of ev.relevantContent) {
          totalTokens += this.estimateTokens(content);
        }
      }
      
      // Key findings
      if (Array.isArray(ev.keyFindings)) {
        for (const finding of ev.keyFindings) {
          totalTokens += this.estimateTokens(finding);
        }
      }
      
      // Document summary
      totalTokens += this.estimateTokens(ev.documentSummary || '');
    }
    
    return totalTokens;
  }
}

// Export singleton instance
export const resilientOpenAI = new ResilientOpenAIClient();
