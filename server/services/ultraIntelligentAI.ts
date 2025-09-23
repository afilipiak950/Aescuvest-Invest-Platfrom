/**
 * ULTRA-INTELLIGENT AI SERVICE
 * Advanced AI orchestration with smart model selection and optimization
 * Maximum intelligence and performance for investment analysis
 */

import OpenAI from 'openai';
import { intelligentModelManager, AnalysisRequirements, ModelCapabilities } from './intelligentModelManager';

export interface UltraIntelligentConfig {
  domain: 'legal' | 'clinical' | 'commercial' | 'research' | 'financial' | 'general';
  complexity: 'low' | 'medium' | 'high' | 'ultra';
  speedPriority: 'fastest' | 'balanced' | 'quality';
  qualityThreshold: number; // 0-1 scale
  contextSize?: number;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: { type: "json_object" | "text" };
}

export interface IntelligentResponse {
  content: string;
  model: string;
  tokensUsed: number;
  responseTime: number;
  qualityScore: number;
  intelligenceLevel: string;
}

class UltraIntelligentAIService {
  private openai: OpenAI;
  private performanceCache: Map<string, number> = new Map();

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * ULTRA-INTELLIGENT COMPLETION
   * Automatically selects optimal model and parameters for maximum intelligence
   */
  async createUltraIntelligentCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    config: UltraIntelligentConfig
  ): Promise<IntelligentResponse> {
    const startTime = Date.now();

    // Step 1: Analyze requirements and select optimal model
    const requirements: AnalysisRequirements = {
      complexity: config.complexity,
      domain: config.domain,
      speedPriority: config.speedPriority,
      qualityThreshold: config.qualityThreshold,
      tokenBudget: config.maxTokens
    };

    const selectedModel = intelligentModelManager.selectOptimalModel(requirements);
    const capabilities = intelligentModelManager.getModelCapabilities(selectedModel);

    if (!capabilities) {
      throw new Error(`Model capabilities not found for ${selectedModel}`);
    }

    // Step 2: Optimize token allocation
    const contextSize = this.calculateContextSize(messages);
    const optimizedTokens = config.maxTokens || 
      intelligentModelManager.optimizeTokenAllocation(selectedModel, config.domain, contextSize);

    // Step 3: Enhance prompt for maximum intelligence
    const enhancedMessages = this.enhanceMessagesForIntelligence(messages, selectedModel, requirements);

    // Step 4: Optimize parameters based on model type
    const optimizedTemperature = this.optimizeTemperature(config, selectedModel);

    console.log(`🚀 Ultra-Intelligent AI: ${selectedModel} | Tokens: ${optimizedTokens} | ${selectedModel.startsWith('gpt-5') ? 'GPT-5 Mode' : `Temp: ${optimizedTemperature}`}`);

    // Step 5: Execute with intelligence monitoring and GPT-5 compatibility
    try {
      // GPT-5 doesn't support temperature parameter (released August 7, 2025)
      const requestOptions: any = {
        model: selectedModel,
        messages: enhancedMessages,
      };

      // GPT-5 uses max_completion_tokens instead of max_tokens
      if (selectedModel.startsWith('gpt-5')) {
        requestOptions.max_completion_tokens = optimizedTokens;
      } else {
        requestOptions.max_tokens = optimizedTokens;
      }

      // GPT-5 optimized parameters for maximum factual accuracy (45% fewer errors, 80% fewer hallucinations)
      if (selectedModel.startsWith('gpt-5')) {
        // GPT-5 doesn't support top_p parameter
        // No penalties for GPT-5 to maintain factual integrity
      } else {
        requestOptions.top_p = 0.95; // Standard for other models
        requestOptions.frequency_penalty = 0.1; // Reduce repetition
        requestOptions.presence_penalty = 0.1; // Encourage diverse content
      }

      // Only add temperature for non-GPT-5 models
      if (!selectedModel.startsWith('gpt-5')) {
        requestOptions.temperature = optimizedTemperature;
      }

      // Add response format if specified (for JSON mode)
      if (config.responseFormat) {
        requestOptions.response_format = config.responseFormat;
      }

      // Debug GPT-5 parameter issue - log exact parameters being sent
      if (selectedModel.startsWith('gpt-5')) {
        console.log(`🐛 DEBUG GPT-5 Request Options:`, JSON.stringify(requestOptions, null, 2));
      }
      
      const completion = await this.openai.chat.completions.create(requestOptions);

      const responseTime = Date.now() - startTime;
      const content = completion.choices[0]?.message?.content || '';
      const tokensUsed = completion.usage?.total_tokens || 0;

      // Step 6: Enhanced JSON response sanitization with fallback
      let finalContent = this.sanitizeJSONResponse(content, config);
      
      // Extra safety: if content starts with plain text instead of JSON, wrap it
      if (config.responseFormat?.type === 'json_object' && !finalContent.trim().startsWith('{') && !finalContent.trim().startsWith('[')) {
        console.log(`⚠️ AI returned plain text instead of JSON. Wrapping response...`);
        finalContent = `{"error": "AI_RESPONSE_NOT_JSON", "content": ${JSON.stringify(finalContent)}}`;
      }

      // Step 7: Assess quality and record performance
      const qualityScore = this.assessResponseQuality(finalContent, config);
      
      intelligentModelManager.recordPerformanceMetrics(
        selectedModel,
        responseTime,
        qualityScore,
        tokensUsed,
        optimizedTokens,
        true
      );

      const intelligenceLevel = this.determineIntelligenceLevel(capabilities, qualityScore);

      console.log(`✨ Ultra-Intelligent Response: ${intelligenceLevel} | Quality: ${qualityScore.toFixed(3)} | Time: ${responseTime}ms`);

      return {
        content: finalContent,
        model: selectedModel,
        tokensUsed,
        responseTime,
        qualityScore,
        intelligenceLevel
      };

    } catch (error) {
      console.error(`❌ Ultra-Intelligent AI Error with ${selectedModel}:`, error);
      
      // Intelligent fallback to backup model
      const fallbackModel = this.getFallbackModel(selectedModel, config.domain);
      if (fallbackModel && fallbackModel !== selectedModel) {
        console.log(`🔄 Falling back to ${fallbackModel}`);
        
        // GPT-5 compatibility for fallback models
        const fallbackOptions: any = {
          model: fallbackModel,
          messages: enhancedMessages,
        };

        // GPT-5 uses max_completion_tokens instead of max_tokens
        if (fallbackModel.startsWith('gpt-5')) {
          fallbackOptions.max_completion_tokens = Math.min(optimizedTokens, 16384);
        } else {
          fallbackOptions.max_tokens = Math.min(optimizedTokens, 16384);
        }

        // Optimize parameters based on fallback model type
        if (fallbackModel.startsWith('gpt-5')) {
          // GPT-5 doesn't support top_p parameter
          fallbackOptions.temperature = 0.1; // Low temperature for accuracy
        } else {
          fallbackOptions.temperature = optimizedTemperature;
          fallbackOptions.top_p = 0.95;
          fallbackOptions.frequency_penalty = 0.1;
          fallbackOptions.presence_penalty = 0.1;
        }

        // Add response format for fallback too
        if (config.responseFormat) {
          fallbackOptions.response_format = config.responseFormat;
        }

        const fallbackCompletion = await this.openai.chat.completions.create(fallbackOptions);

        const responseTime = Date.now() - startTime;
        const content = fallbackCompletion.choices[0]?.message?.content || '';
        const tokensUsed = fallbackCompletion.usage?.total_tokens || 0;
        
        // Sanitize JSON response for fallback too
        const finalContent = this.sanitizeJSONResponse(content, config);
        const qualityScore = this.assessResponseQuality(finalContent, config);

        return {
          content: finalContent,
          model: fallbackModel,
          tokensUsed,
          responseTime,
          qualityScore,
          intelligenceLevel: 'fallback'
        };
      }

      throw error;
    }
  }

  /**
   * ENHANCE MESSAGES FOR MAXIMUM INTELLIGENCE
   * GPT-5 gets additional factuality instructions for 45% fewer errors, 80% fewer hallucinations
   */
  private enhanceMessagesForIntelligence(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    model: string,
    requirements: AnalysisRequirements
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const enhanced = [...messages];
    
    // Add GPT-5 specific factuality instructions at the beginning
    if (model.startsWith('gpt-5')) {
      enhanced.unshift({
        role: 'system',
        content: `You are GPT-5, the latest and most accurate AI model. Your core principles:

1. ABSOLUTE FACTUAL ACCURACY: Only state information you can verify from provided documents or universally accepted facts
2. EVIDENCE-BASED RESPONSES: Always cite specific sources, document sections, or data points
3. UNCERTAINTY ACKNOWLEDGMENT: Explicitly state "I don't have sufficient evidence" or "Unknown based on available data" when information is unclear
4. NO FABRICATION: Never generate plausible-sounding but unverified details, statistics, or claims
5. SOURCE ATTRIBUTION: Reference specific documents, studies, or data points for all factual claims
6. PRECISION OVER CREATIVITY: Prioritize accuracy and precision over creative or elaborate responses

When analyzing documents or data, provide:
- Direct quotes or specific references from source materials
- Clear distinction between verified facts and reasonable inferences
- Explicit statements when information is incomplete or unavailable

Remember: Your accuracy directly impacts critical investment decisions. Err on the side of stating "insufficient data" rather than making unsupported claims.`
      });
    }
    
    // Find the main prompt (usually the last user message)
    const lastUserMessageIndex = enhanced.findLastIndex(msg => msg.role === 'user');
    
    if (lastUserMessageIndex !== -1) {
      const lastMessage = enhanced[lastUserMessageIndex];
      if (typeof lastMessage.content === 'string') {
        // Enhance with intelligence boosters
        const optimizedPrompt = intelligentModelManager.optimizePrompt(
          lastMessage.content,
          model,
          requirements
        );
        
        enhanced[lastUserMessageIndex] = {
          ...lastMessage,
          content: optimizedPrompt
        };
      }
    }

    return enhanced;
  }

  /**
   * INTELLIGENT TEMPERATURE OPTIMIZATION
   * GPT-5 doesn't support temperature (released August 7, 2025)
   */
  private optimizeTemperature(config: UltraIntelligentConfig, model?: string): number | undefined {
    // GPT-5 models don't support temperature parameter
    if (model && model.startsWith('gpt-5')) {
      return undefined;
    }

    let baseTemp = config.temperature || 0.1;

    // Adjust based on task type
    switch (config.domain) {
      case 'legal':
      case 'clinical':
        baseTemp = 0.05; // Maximum precision for critical analysis
        break;
      case 'commercial':
        baseTemp = 0.15; // Slight creativity for market insights
        break;
      case 'research':
        baseTemp = 0.1; // Balanced for accuracy
        break;
      default:
        baseTemp = 0.1;
    }

    // Adjust based on complexity
    if (config.complexity === 'ultra') {
      baseTemp *= 0.8; // Reduce for ultra-complex tasks
    } else if (config.complexity === 'low') {
      baseTemp *= 1.2; // Allow slight variation for simple tasks
    }

    return Math.max(0.01, Math.min(0.3, baseTemp));
  }

  /**
   * ASSESS RESPONSE QUALITY
   */
  private assessResponseQuality(content: string, config: UltraIntelligentConfig): number {
    let score = 0.5; // Base score

    // Length and completeness
    if (content.length > 500) score += 0.1;
    if (content.length > 1500) score += 0.1;
    if (content.length > 3000) score += 0.1;

    // Structured analysis indicators
    const structureIndicators = [
      'Analysis:', 'Conclusion:', 'Risk:', 'Evidence:', 'Summary:',
      '1.', '2.', '3.', '##', '**', 'Key', 'Important', 'Critical'
    ];
    const structureScore = structureIndicators.filter(indicator => 
      content.includes(indicator)
    ).length / structureIndicators.length;
    score += structureScore * 0.2;

    // Domain-specific quality indicators
    const domainKeywords = {
      legal: ['regulation', 'compliance', 'contract', 'liability', 'statute', 'precedent'],
      clinical: ['patient', 'medical', 'safety', 'efficacy', 'clinical', 'adverse'],
      commercial: ['market', 'revenue', 'growth', 'competitive', 'strategy', 'ROI'],
      research: ['data', 'methodology', 'evidence', 'study', 'analysis', 'findings'],
      financial: ['revenue', 'cost', 'profit', 'valuation', 'cash flow', 'risk']
    };

    const keywords = domainKeywords[config.domain] || [];
    const keywordScore = keywords.filter(keyword => 
      content.toLowerCase().includes(keyword)
    ).length / keywords.length;
    score += keywordScore * 0.2;

    return Math.min(1.0, score);
  }

  /**
   * DETERMINE INTELLIGENCE LEVEL
   */
  private determineIntelligenceLevel(capabilities: ModelCapabilities, qualityScore: number): string {
    if (capabilities.reasoning === 'ultra' && qualityScore > 0.9) {
      return 'ULTRA-GENIUS';
    } else if (capabilities.reasoning === 'expert' && qualityScore > 0.8) {
      return 'EXPERT-LEVEL';
    } else if (capabilities.reasoning === 'advanced' && qualityScore > 0.7) {
      return 'ADVANCED';
    } else if (qualityScore > 0.6) {
      return 'PROFESSIONAL';
    } else {
      return 'STANDARD';
    }
  }

  /**
   * GET FALLBACK MODEL
   * Updated for GPT-5 release (August 7, 2025)
   */
  private getFallbackModel(failedModel: string, domain: string): string {
    const fallbacks = {
      'gpt-5': 'gpt-4o', // Fallback from GPT-5 to best GPT-4 variant
      'gpt-5-mini': 'gpt-4', // Fallback from GPT-5 Mini to GPT-4
      'gpt-4o': 'gpt-4',
      'gpt-4': 'gpt-4o'
    };

    const fallback = fallbacks[failedModel];
    console.log(`🔄 Fallback mapping: ${failedModel} → ${fallback || 'gpt-4o'}`);
    
    return fallback || 'gpt-4o';
  }

  /**
   * CALCULATE CONTEXT SIZE
   */
  private calculateContextSize(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): number {
    return messages.reduce((size, msg) => {
      if (typeof msg.content === 'string') {
        return size + msg.content.length;
      }
      return size;
    }, 0);
  }

  /**
   * SANITIZE JSON RESPONSE
   * Removes markdown code fences and ensures clean JSON for parsing
   */
  private sanitizeJSONResponse(content: string, config: UltraIntelligentConfig): string {
    if (!config.responseFormat || config.responseFormat.type !== 'json_object') {
      return content; // No sanitization needed for text responses
    }

    // Remove markdown code fences if present
    let sanitized = content.trim();
    
    // Remove opening code fence
    if (sanitized.startsWith('```json') || sanitized.startsWith('```')) {
      const lines = sanitized.split('\n');
      lines.shift(); // Remove first line (opening fence)
      sanitized = lines.join('\n');
    }
    
    // Remove closing code fence
    if (sanitized.endsWith('```')) {
      const lines = sanitized.split('\n');
      lines.pop(); // Remove last line (closing fence)
      sanitized = lines.join('\n');
    }
    
    return sanitized.trim();
  }

  /**
   * BATCH ULTRA-INTELLIGENT PROCESSING
   * For processing multiple requests with optimal resource utilization
   */
  async processBatch(
    requests: Array<{
      messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
      config: UltraIntelligentConfig;
      id: string;
    }>
  ): Promise<Array<{ id: string; response: IntelligentResponse }>> {
    console.log(`🔥 Processing ${requests.length} requests with Ultra-Intelligent batch processing`);

    // Group by optimal model for efficiency
    const groupedByModel = new Map<string, typeof requests>();
    
    for (const request of requests) {
      const requirements: AnalysisRequirements = {
        complexity: request.config.complexity,
        domain: request.config.domain,
        speedPriority: request.config.speedPriority,
        qualityThreshold: request.config.qualityThreshold
      };
      
      const model = intelligentModelManager.selectOptimalModel(requirements);
      
      if (!groupedByModel.has(model)) {
        groupedByModel.set(model, []);
      }
      groupedByModel.get(model)!.push(request);
    }

    // Process each model group concurrently
    const results: Array<{ id: string; response: IntelligentResponse }> = [];
    
    for (const [model, modelRequests] of Array.from(groupedByModel)) {
      console.log(`🎯 Processing ${modelRequests.length} requests with ${model}`);
      
      const modelResults = await Promise.all(
        modelRequests.map(async (request) => ({
          id: request.id,
          response: await this.createUltraIntelligentCompletion(request.messages, request.config)
        }))
      );
      
      results.push(...modelResults);
    }

    return results;
  }
}

// Export singleton instance
export const ultraIntelligentAI = new UltraIntelligentAIService();