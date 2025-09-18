/**
 * COMPREHENSIVE AI CLIENT WRAPPER WITH RATE LIMITING & RETRY LOGIC
 * Prevents empty AI summaries by enforcing proper rate limits and retries
 */

import OpenAI from 'openai';
import { Mistral } from '@mistralai/mistralai';
import { bulletproofRateLimiter } from './bulletproofRateLimiter';

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY || '',
});

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryOn429: boolean;
  retryOn5xx: boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelay: 1000,  // 1 second
  maxDelay: 16000,  // 16 seconds max
  retryOn429: true,
  retryOn5xx: true
};

class AIClientWrapper {
  
  /**
   * Call OpenAI API with rate limiting and retry logic
   */
  async callOpenAI<T>(
    apiCall: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    
    // Wait for rate limit clearance
    await bulletproofRateLimiter.waitForRateLimit('openai');
    
    return this.executeWithRetry(apiCall, 'OpenAI', retryConfig);
  }

  /**
   * Call Mistral API with rate limiting and retry logic
   */
  async callMistral<T>(
    apiCall: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    // Use longer delays for Mistral due to stricter rate limits
    const mistralConfig = { 
      ...DEFAULT_RETRY_CONFIG, 
      baseDelay: 3000,  // 3 seconds base delay for Mistral
      maxDelay: 30000,  // 30 seconds max delay for Mistral
      ...config 
    };
    
    // Wait for rate limit clearance
    await bulletproofRateLimiter.waitForRateLimit('mistral');
    
    return this.executeWithRetry(apiCall, 'Mistral', mistralConfig);
  }

  /**
   * Execute API call with exponential backoff retry logic
   */
  private async executeWithRetry<T>(
    apiCall: () => Promise<T>,
    serviceName: string,
    config: RetryConfig
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        console.log(`🤖 ${serviceName} API call attempt ${attempt + 1}/${config.maxRetries + 1}`);
        
        const result = await apiCall();
        
        if (attempt > 0) {
          console.log(`✅ ${serviceName} API call succeeded after ${attempt} retries`);
        }
        
        return result;
        
      } catch (error: any) {
        lastError = error;
        const isRetryableError = this.isRetryableError(error, config);
        
        console.error(`❌ ${serviceName} API call failed (attempt ${attempt + 1}):`, {
          message: error.message,
          status: error.status || error.code,
          isRetryable: isRetryableError,
          willRetry: attempt < config.maxRetries && isRetryableError
        });
        
        // Don't retry on last attempt or non-retryable errors
        if (attempt >= config.maxRetries || !isRetryableError) {
          break;
        }
        
        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateRetryDelay(attempt, error, config);
        console.log(`⏳ ${serviceName} retrying in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // All retries exhausted
    const errorMessage = `${serviceName} API failed after ${config.maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`;
    console.error(`💥 ${errorMessage}`);
    throw new Error(errorMessage);
  }

  /**
   * Determine if an error is retryable based on configuration
   */
  private isRetryableError(error: any, config: RetryConfig): boolean {
    const status = error.status || error.code;
    
    // Always retry on network errors or timeouts
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }
    
    // Handle HTTP status codes
    if (typeof status === 'number') {
      // Rate limit errors (429)
      if (status === 429 && config.retryOn429) {
        return true;
      }
      
      // Server errors (5xx)
      if (status >= 500 && status < 600 && config.retryOn5xx) {
        return true;
      }
      
      // Don't retry client errors (4xx except 429)
      if (status >= 400 && status < 500 && status !== 429) {
        return false;
      }
    }
    
    return false;
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(attempt: number, error: any, config: RetryConfig): number {
    // Check for Retry-After header
    const retryAfter = error.headers?.['retry-after'] || error.response?.headers?.['retry-after'];
    if (retryAfter) {
      const retryAfterMs = parseInt(retryAfter) * 1000;
      if (!isNaN(retryAfterMs) && retryAfterMs > 0) {
        console.log(`🔄 Using Retry-After header: ${retryAfter}s`);
        return Math.min(retryAfterMs, config.maxDelay);
      }
    }
    
    // Exponential backoff: delay = baseDelay * 2^attempt
    const exponentialDelay = config.baseDelay * Math.pow(2, attempt);
    
    // Add jitter (random component to prevent thundering herd)
    const jitter = Math.random() * 0.5 * exponentialDelay;
    const totalDelay = exponentialDelay + jitter;
    
    // Cap at max delay
    return Math.min(totalDelay, config.maxDelay);
  }

  /**
   * Generate response using OpenAI with proper rate limiting
   */
  async generateOpenAIResponse(
    systemPrompt: string,
    userMessage: string,
    options: {
      model?: string;
      temperature?: number;
      jsonResponse?: boolean;
    } = {}
  ): Promise<string> {
    const { model = "gpt-4o", temperature = 0.7, jsonResponse = false } = options;
    
    return this.callOpenAI(async () => {
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ];
      
      const apiOptions: any = {
        model,
        messages,
        temperature
      };
      
      if (jsonResponse) {
        apiOptions.response_format = { type: "json_object" };
      }
      
      const response = await openai.chat.completions.create(apiOptions);
      const content = response.choices[0].message.content;
      
      // CRITICAL: Never return empty content - throw error instead
      if (!content || content.trim().length === 0) {
        throw new Error('OpenAI returned empty content - this would create empty summary');
      }
      
      return content;
    });
  }

  /**
   * Extract text using Mistral with proper rate limiting
   */
  async extractTextWithMistral(
    prompt: string,
    model: string = "mistral-large-latest"
  ): Promise<string> {
    return this.callMistral(async () => {
      const response = await mistral.chat.complete({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1
      });
      
      const content = response.choices?.[0]?.message?.content;
      
      // CRITICAL: Never return empty content
      if (!content || content.trim().length === 0) {
        throw new Error('Mistral returned empty content - this would create empty summary');
      }
      
      return content;
    });
  }

  /**
   * Get rate limit status for monitoring
   */
  getRateLimitStatus() {
    return {
      openai: bulletproofRateLimiter.getStatus('openai'),
      mistral: bulletproofRateLimiter.getStatus('mistral'),
      embeddings: bulletproofRateLimiter.getStatus('embeddings')
    };
  }

  /**
   * Check if any service is near rate limit
   */
  isNearRateLimit(threshold: number = 0.8): boolean {
    const status = this.getRateLimitStatus();
    
    for (const [service, stats] of Object.entries(status)) {
      const usage = stats.used / stats.limit;
      if (usage >= threshold) {
        console.warn(`⚠️ ${service} near rate limit: ${stats.used}/${stats.limit} (${Math.round(usage * 100)}%)`);
        return true;
      }
    }
    
    return false;
  }
}

// Export singleton instance
export const aiClientWrapper = new AIClientWrapper();