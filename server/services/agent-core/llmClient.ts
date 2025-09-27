import OpenAI from "openai";
import { z } from "zod";
import { cleanJsonResponse } from "./prompts";
import { sleep } from "../../utils/helpers";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  structuredOutput?: boolean;
  responseSchema?: z.ZodSchema<any>;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface LLMResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  processingTime?: number;
}

/**
 * Exponential backoff with jitter
 */
function calculateBackoff(attempt: number, baseDelay: number = 1000): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 1000; // 0-1000ms jitter
  return Math.min(exponentialDelay + jitter, 60000); // Max 60 seconds
}

/**
 * Main LLM completion function with structured outputs and retry logic
 */
export async function generateCompletion<T = any>(
  systemPrompt: string,
  userPrompt: string,
  options: LLMOptions = {}
): Promise<LLMResponse<T>> {
  const {
    model = "gpt-4o",
    temperature = 0.1,
    maxTokens = 4000,
    structuredOutput = true,
    responseSchema,
    retryAttempts = 3,
    retryDelay = 1000,
  } = options;

  const startTime = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retryAttempts; attempt++) {
    try {
      // Add delay between retries with exponential backoff
      if (attempt > 0) {
        const delay = calculateBackoff(attempt - 1, retryDelay);
        console.log(`⏳ Retry attempt ${attempt + 1}/${retryAttempts} after ${delay}ms delay...`);
        await sleep(delay);
      }

      // Prepare the request
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];

      // Use structured output if available (GPT-4o supports it)
      const requestOptions: OpenAI.ChatCompletionCreateParams = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      };

      // Add structured output format if requested
      if (structuredOutput) {
        requestOptions.response_format = { type: "json_object" };
      }

      // Make the API call
      const response = await openai.chat.completions.create(requestOptions);
      
      const rawContent = response.choices[0]?.message?.content || "";
      const usage = response.usage;

      // Parse the response
      let parsedData: T;
      
      if (structuredOutput || responseSchema) {
        // Clean any markdown that might have slipped through
        const cleanedContent = cleanJsonResponse(rawContent);
        
        try {
          parsedData = JSON.parse(cleanedContent);
          
          // Validate against schema if provided
          if (responseSchema) {
            parsedData = responseSchema.parse(parsedData);
          }
        } catch (parseError: any) {
          console.error(`❌ JSON parsing error on attempt ${attempt + 1}:`, parseError);
          
          // Try to extract JSON from the response
          const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsedData = JSON.parse(jsonMatch[0]);
              if (responseSchema) {
                parsedData = responseSchema.parse(parsedData);
              }
              console.log(`✅ Recovered JSON from malformed response`);
            } catch (recoveryError) {
              throw new Error(`Failed to parse JSON response: ${parseError.message}`);
            }
          } else {
            throw new Error(`No valid JSON found in response: ${rawContent.substring(0, 200)}`);
          }
        }
      } else {
        // Plain text response
        parsedData = rawContent as any;
      }

      // Success!
      return {
        success: true,
        data: parsedData,
        usage: usage ? {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        } : undefined,
        model,
        processingTime: Date.now() - startTime,
      };

    } catch (error: any) {
      lastError = error;
      
      // Check if it's a rate limit error
      if (error?.status === 429 || error?.code === 'rate_limit_exceeded') {
        console.warn(`⚠️ Rate limit hit on attempt ${attempt + 1}, backing off...`);
        // Use longer backoff for rate limits
        if (attempt < retryAttempts - 1) {
          await sleep(calculateBackoff(attempt, 5000));
        }
        continue;
      }
      
      // Check if it's a timeout or network error
      if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT') {
        console.warn(`⚠️ Network error on attempt ${attempt + 1}: ${error.message}`);
        continue;
      }
      
      // Check if it's an API error we should retry
      if (error?.status >= 500) {
        console.warn(`⚠️ API error ${error.status} on attempt ${attempt + 1}`);
        continue;
      }
      
      // Non-retryable error, break immediately
      console.error(`❌ Non-retryable error on attempt ${attempt + 1}:`, error);
      break;
    }
  }

  // All retries failed
  return {
    success: false,
    error: lastError?.message || "Unknown error occurred",
    model,
    processingTime: Date.now() - startTime,
  };
}

/**
 * Specialized function for generating structured agent answers
 */
export async function generateAgentAnswer(
  systemPrompt: string,
  analysisPrompt: string,
  agentType: string,
  responseSchema?: z.ZodSchema<any>
): Promise<LLMResponse<any>> {
  console.log(`🤖 Generating ${agentType} agent answer with model: gpt-4o`);
  
  // Always use structured output for agent answers
  const response = await generateCompletion(systemPrompt, analysisPrompt, {
    model: "gpt-4o",
    temperature: 0.1, // Low temperature for consistency
    maxTokens: 4000,
    structuredOutput: true,
    responseSchema,
    retryAttempts: 3,
    retryDelay: 2000, // 2 second base delay for retries
  });

  if (!response.success) {
    console.error(`❌ Failed to generate ${agentType} answer:`, response.error);
    
    // Try a simplified fallback
    console.log(`🔄 Attempting simplified fallback for ${agentType}...`);
    const fallbackPrompt = `Provide a brief, conservative analysis. Respond with pure JSON only.`;
    
    const fallbackResponse = await generateCompletion(systemPrompt, fallbackPrompt, {
      model: "gpt-4o-mini", // Use smaller model for fallback
      temperature: 0,
      maxTokens: 1000,
      structuredOutput: true,
      retryAttempts: 1,
    });
    
    if (fallbackResponse.success) {
      console.log(`✅ Fallback succeeded for ${agentType}`);
      return {
        ...fallbackResponse,
        data: {
          ...fallbackResponse.data,
          confidence: Math.min((fallbackResponse.data as any)?.confidence || 0.3, 0.3),
          error: "Simplified analysis due to processing issues",
        },
      };
    }
  }

  return response;
}

/**
 * Stream completion for real-time responses (optional, for future use)
 */
export async function* streamCompletion(
  systemPrompt: string,
  userPrompt: string,
  options: Omit<LLMOptions, 'structuredOutput' | 'responseSchema'> = {}
): AsyncGenerator<string, void, unknown> {
  const {
    model = "gpt-4o",
    temperature = 0.1,
    maxTokens = 4000,
  } = options;

  try {
    const stream = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  } catch (error: any) {
    console.error("❌ Streaming error:", error);
    throw error;
  }
}

/**
 * Helper to estimate token count (rough approximation)
 */
export function estimateTokenCount(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

/**
 * Check if we have enough token budget
 */
export function hasTokenBudget(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 4000,
  modelLimit: number = 8192
): boolean {
  const promptTokens = estimateTokenCount(systemPrompt + userPrompt);
  const totalRequired = promptTokens + maxTokens;
  return totalRequired <= modelLimit;
}