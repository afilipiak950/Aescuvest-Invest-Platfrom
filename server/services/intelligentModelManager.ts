/**
 * ULTRA-INTELLIGENT MODEL MANAGEMENT SYSTEM
 * Advanced AI model selection, optimization, and performance management
 * Designed for seamless GPT-5/GPT-5 Mini migration and maximum intelligence
 */

import OpenAI from 'openai';

export interface ModelCapabilities {
  maxTokens: number;
  contextWindow: number;
  reasoning: 'basic' | 'advanced' | 'expert' | 'ultra';
  speed: 'fast' | 'balanced' | 'comprehensive';
  specialties: string[];
  costPerToken: number;
}

export interface AnalysisRequirements {
  complexity: 'low' | 'medium' | 'high' | 'ultra';
  domain: 'legal' | 'clinical' | 'commercial' | 'research' | 'financial' | 'general';
  speedPriority: 'fastest' | 'balanced' | 'quality';
  tokenBudget?: number;
  qualityThreshold: number; // 0-1 scale
}

export interface ModelPerformanceMetrics {
  avgResponseTime: number;
  qualityScore: number;
  tokenEfficiency: number;
  errorRate: number;
  costEfficiency: number;
  lastUpdated: Date;
}

class UltraIntelligentModelManager {
  private static instance: UltraIntelligentModelManager;
  private modelRegistry: Map<string, ModelCapabilities> = new Map();
  private performanceMetrics: Map<string, ModelPerformanceMetrics> = new Map();
  private openai: OpenAI;

  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.initializeModelRegistry();
    this.startPerformanceMonitoring();
  }

  public static getInstance(): UltraIntelligentModelManager {
    if (!UltraIntelligentModelManager.instance) {
      UltraIntelligentModelManager.instance = new UltraIntelligentModelManager();
    }
    return UltraIntelligentModelManager.instance;
  }

  private initializeModelRegistry(): void {
    // Current Models
    this.modelRegistry.set('gpt-4o', {
      maxTokens: 16384,
      contextWindow: 128000,
      reasoning: 'expert',
      speed: 'balanced',
      specialties: ['analysis', 'reasoning', 'synthesis', 'medical', 'legal'],
      costPerToken: 0.00003
    });

    this.modelRegistry.set('gpt-4', {
      maxTokens: 16384,
      contextWindow: 128000,
      reasoning: 'advanced',
      speed: 'comprehensive',
      specialties: ['complex-reasoning', 'analysis'],
      costPerToken: 0.00006
    });

    // GPT-5 Models (Released August 7, 2025 - Latest AI Technology)
    // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    this.modelRegistry.set('gpt-5', {
      maxTokens: 32768, // Production spec
      contextWindow: 256000, // Enhanced context window
      reasoning: 'ultra',
      speed: 'comprehensive',
      specialties: ['ultra-analysis', 'complex-reasoning', 'medical', 'legal', 'research', 'institutional-grade'],
      costPerToken: 0.00005 // Production pricing
    });

    this.modelRegistry.set('gpt-5-mini', {
      maxTokens: 16384, // Optimized for speed
      contextWindow: 128000, // Standard context window
      reasoning: 'expert',
      speed: 'fast',
      specialties: ['quick-analysis', 'commercial', 'general', 'balanced-performance'],
      costPerToken: 0.00001 // Cost-effective pricing
    });

    console.log('🧠 Ultra-Intelligent Model Registry initialized with', this.modelRegistry.size, 'models');
  }

  /**
   * ULTRA-SMART MODEL SELECTION
   * Automatically selects optimal model based on requirements and performance
   */
  public selectOptimalModel(requirements: AnalysisRequirements): string {
    console.log(`🎯 Ultra-Smart Model Selection for ${requirements.domain} (${requirements.complexity} complexity)`);

    const candidates = this.getCandidateModels(requirements);
    const scoredModels = candidates.map(model => ({
      model,
      score: this.calculateIntelligenceScore(model, requirements)
    }));

    // Sort by intelligence score (highest first)
    scoredModels.sort((a, b) => b.score - a.score);

    const selectedModel = scoredModels[0]?.model || this.getDefaultModel(requirements.domain);
    
    console.log(`🚀 Selected model: ${selectedModel} (Intelligence Score: ${scoredModels[0]?.score.toFixed(3)})`);
    
    return selectedModel;
  }

  private getCandidateModels(requirements: AnalysisRequirements): string[] {
    const available = Array.from(this.modelRegistry.keys());
    
    // GPT-5 models are available by default (Released August 7, 2025)
    return available.filter(model => {
      if (model.startsWith('gpt-5')) {
        return process.env.ENABLE_GPT5_MODELS !== 'false'; // Default to true
      }
      return true;
    });
  }

  private calculateIntelligenceScore(model: string, requirements: AnalysisRequirements): number {
    const capabilities = this.modelRegistry.get(model);
    const performance = this.performanceMetrics.get(model);
    
    if (!capabilities) return 0;

    let score = 0;

    // Domain Specialization Score (40%)
    const domainMatch = capabilities.specialties.some(specialty => 
      specialty.includes(requirements.domain) || 
      (requirements.complexity === 'ultra' && specialty.includes('ultra')) ||
      (requirements.complexity === 'high' && specialty.includes('complex'))
    );
    score += domainMatch ? 0.4 : 0.2;

    // Reasoning Capability Score (30%)
    const reasoningScores = { basic: 0.1, advanced: 0.2, expert: 0.25, ultra: 0.3 };
    score += reasoningScores[capabilities.reasoning];

    // Speed vs Quality Balance (20%)
    if (requirements.speedPriority === 'fastest' && capabilities.speed === 'fast') {
      score += 0.2;
    } else if (requirements.speedPriority === 'quality' && capabilities.speed === 'comprehensive') {
      score += 0.2;
    } else if (requirements.speedPriority === 'balanced' && capabilities.speed === 'balanced') {
      score += 0.2;
    } else {
      score += 0.1;
    }

    // Performance History Score (10%)
    if (performance) {
      const qualityBonus = performance.qualityScore * 0.05;
      const efficiencyBonus = performance.tokenEfficiency * 0.03;
      const reliabilityBonus = (1 - performance.errorRate) * 0.02;
      score += qualityBonus + efficiencyBonus + reliabilityBonus;
    }

    return Math.min(score, 1.0); // Cap at 1.0
  }

  private getDefaultModel(domain: string): string {
    // GPT-5 as primary defaults (Released August 7, 2025)
    const defaults = {
      legal: process.env.LEGAL_MODEL || 'gpt-5',
      clinical: process.env.CLINICAL_MODEL || 'gpt-5',
      commercial: process.env.COMMERCIAL_MODEL || 'gpt-5-mini',
      research: process.env.RESEARCH_MODEL || 'gpt-5',
      financial: process.env.FINANCIAL_MODEL || 'gpt-5',
      general: process.env.DEFAULT_MODEL || 'gpt-5'
    };

    return defaults[domain] || defaults.general;
  }

  /**
   * ADAPTIVE TOKEN OPTIMIZATION
   * Intelligently adjusts token allocation for maximum output quality
   */
  public optimizeTokenAllocation(model: string, analysisType: string, contextSize: number): number {
    const capabilities = this.modelRegistry.get(model);
    if (!capabilities) return 16384;

    const baseTokens = capabilities.maxTokens;
    const contextRatio = contextSize / capabilities.contextWindow;

    // Ultra-intelligent token allocation based on analysis type and context
    let optimizedTokens = baseTokens;

    // Reduce tokens if context is very large to prevent truncation
    if (contextRatio > 0.7) {
      optimizedTokens = Math.floor(baseTokens * 0.8);
    } else if (contextRatio > 0.5) {
      optimizedTokens = Math.floor(baseTokens * 0.9);
    }

    // Increase for synthesis tasks that need comprehensive output
    if (analysisType.includes('synthesis') || analysisType.includes('comprehensive')) {
      optimizedTokens = Math.min(optimizedTokens * 1.1, baseTokens);
    }

    console.log(`🎛️ Optimized tokens for ${model}: ${optimizedTokens} (context ratio: ${(contextRatio * 100).toFixed(1)}%)`);
    
    return Math.floor(optimizedTokens);
  }

  /**
   * ULTRA-INTELLIGENT PROMPT OPTIMIZATION
   * Enhances prompts for maximum AI performance and quality
   */
  public optimizePrompt(basePrompt: string, model: string, requirements: AnalysisRequirements): string {
    const capabilities = this.modelRegistry.get(model);
    if (!capabilities) return basePrompt;

    let optimizedPrompt = basePrompt;

    // Add model-specific intelligence boosters
    if (capabilities.reasoning === 'ultra') {
      optimizedPrompt = `ULTRA-INTELLIGENT ANALYSIS MODE: Apply maximum cognitive depth and multi-layered reasoning.\n\n${optimizedPrompt}`;
    } else if (capabilities.reasoning === 'expert') {
      optimizedPrompt = `EXPERT-LEVEL ANALYSIS: Use advanced reasoning and comprehensive evaluation.\n\n${optimizedPrompt}`;
    }

    // Add domain-specific intelligence enhancers
    const domainEnhancers = {
      legal: '\nApply legal expertise with regulatory precision and risk assessment depth.',
      clinical: '\nUtilize medical expertise with patient safety focus and regulatory compliance.',
      commercial: '\nEmploy business intelligence with market analysis and strategic insight.',
      research: '\nLeverage research methodology with evidence-based analysis and citation accuracy.',
      financial: '\nApply financial analysis expertise with quantitative rigor and risk evaluation.'
    };

    if (domainEnhancers[requirements.domain]) {
      optimizedPrompt += domainEnhancers[requirements.domain];
    }

    // Add quality instructions based on threshold
    if (requirements.qualityThreshold >= 0.9) {
      optimizedPrompt += '\n\nQUALITY REQUIREMENT: Deliver institutional-grade analysis with maximum precision and depth.';
    } else if (requirements.qualityThreshold >= 0.8) {
      optimizedPrompt += '\n\nQUALITY REQUIREMENT: Provide professional-grade analysis with high accuracy and detail.';
    }

    console.log(`✨ Prompt optimized for ${model} with ${capabilities.reasoning} reasoning`);
    
    return optimizedPrompt;
  }

  /**
   * PERFORMANCE MONITORING & AUTO-OPTIMIZATION
   */
  private startPerformanceMonitoring(): void {
    // Initialize performance metrics for known models
    this.modelRegistry.forEach((_, model) => {
      if (!this.performanceMetrics.has(model)) {
        this.performanceMetrics.set(model, {
          avgResponseTime: 0,
          qualityScore: 0.8, // Default baseline
          tokenEfficiency: 0.75,
          errorRate: 0.02,
          costEfficiency: 0.8,
          lastUpdated: new Date()
        });
      }
    });

    console.log('📊 Performance monitoring initialized for', this.performanceMetrics.size, 'models');
  }

  public recordPerformanceMetrics(
    model: string, 
    responseTime: number, 
    qualityScore: number, 
    tokensUsed: number, 
    tokensRequested: number,
    success: boolean
  ): void {
    const current = this.performanceMetrics.get(model);
    if (!current) return;

    // Exponential moving average for smooth updates
    const alpha = 0.1;
    
    const updated: ModelPerformanceMetrics = {
      avgResponseTime: current.avgResponseTime * (1 - alpha) + responseTime * alpha,
      qualityScore: current.qualityScore * (1 - alpha) + qualityScore * alpha,
      tokenEfficiency: current.tokenEfficiency * (1 - alpha) + (tokensUsed / tokensRequested) * alpha,
      errorRate: current.errorRate * (1 - alpha) + (success ? 0 : 1) * alpha,
      costEfficiency: current.costEfficiency * (1 - alpha) + (qualityScore / (tokensUsed * this.modelRegistry.get(model)?.costPerToken || 1)) * alpha,
      lastUpdated: new Date()
    };

    this.performanceMetrics.set(model, updated);
    
    console.log(`📈 Updated performance metrics for ${model}: Quality=${updated.qualityScore.toFixed(3)}, Efficiency=${updated.tokenEfficiency.toFixed(3)}`);
  }

  /**
   * INTELLIGENT MODEL HEALTH CHECK
   */
  public async checkModelHealth(model: string): Promise<boolean> {
    try {
      // GPT-5 doesn't support temperature parameter (released August 7, 2025)
      const requestOptions: any = {
        model: model,
        messages: [{ role: 'user', content: 'Test health check. Respond with: HEALTHY' }],
        max_tokens: 10
      };

      // Only add temperature for non-GPT-5 models
      if (!model.startsWith('gpt-5')) {
        requestOptions.temperature = 0;
      }

      const testResponse = await this.openai.chat.completions.create(requestOptions);

      const isHealthy = testResponse.choices[0]?.message?.content?.includes('HEALTHY') || false;
      console.log(`🏥 Model ${model} health check: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
      
      return isHealthy;
    } catch (error) {
      console.error(`❌ Model ${model} health check failed:`, error);
      return false;
    }
  }

  /**
   * GET MODEL CAPABILITIES
   */
  public getModelCapabilities(model: string): ModelCapabilities | undefined {
    return this.modelRegistry.get(model);
  }

  /**
   * GET PERFORMANCE METRICS
   */
  public getPerformanceMetrics(model: string): ModelPerformanceMetrics | undefined {
    return this.performanceMetrics.get(model);
  }

  /**
   * LIST AVAILABLE MODELS
   */
  public getAvailableModels(): string[] {
    return Array.from(this.modelRegistry.keys());
  }
}

// Export singleton instance
export const intelligentModelManager = UltraIntelligentModelManager.getInstance();