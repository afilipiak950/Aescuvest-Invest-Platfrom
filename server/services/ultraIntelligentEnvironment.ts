/**
 * ULTRA-INTELLIGENT ENVIRONMENT CONFIGURATION
 * Environment setup for seamless GPT-5/GPT-5 Mini migration
 * Smart configuration management for maximum AI intelligence
 */

export interface UltraIntelligentEnvironmentConfig {
  // Model Selection Environment Variables
  ENABLE_GPT5_MODELS?: string;
  LEGAL_MODEL?: string;
  CLINICAL_MODEL?: string;
  COMMERCIAL_MODEL?: string;
  RESEARCH_MODEL?: string;
  FINANCIAL_MODEL?: string;
  DEFAULT_MODEL?: string;
  
  // Ultra-Intelligence Settings
  ULTRA_INTELLIGENCE_MODE?: string;
  MAX_QUALITY_THRESHOLD?: string;
  PERFORMANCE_MONITORING?: string;
  
  // Future GPT-5 Configuration
  GPT5_API_KEY?: string;
  GPT5_ENDPOINT?: string;
  GPT5_MINI_ENDPOINT?: string;
}

class UltraIntelligentEnvironment {
  private static instance: UltraIntelligentEnvironment;
  private config: UltraIntelligentEnvironmentConfig;

  private constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
    this.logConfiguration();
  }

  public static getInstance(): UltraIntelligentEnvironment {
    if (!UltraIntelligentEnvironment.instance) {
      UltraIntelligentEnvironment.instance = new UltraIntelligentEnvironment();
    }
    return UltraIntelligentEnvironment.instance;
  }

  private loadConfiguration(): UltraIntelligentEnvironmentConfig {
    return {
      // Current Model Selection (Ready for GPT-5 Migration)
      ENABLE_GPT5_MODELS: process.env.ENABLE_GPT5_MODELS || 'false',
      LEGAL_MODEL: process.env.LEGAL_MODEL || 'gpt-4o',
      CLINICAL_MODEL: process.env.CLINICAL_MODEL || 'gpt-4o',
      COMMERCIAL_MODEL: process.env.COMMERCIAL_MODEL || 'gpt-4',
      RESEARCH_MODEL: process.env.RESEARCH_MODEL || 'gpt-4o',
      FINANCIAL_MODEL: process.env.FINANCIAL_MODEL || 'gpt-4o',
      DEFAULT_MODEL: process.env.DEFAULT_MODEL || 'gpt-4o',
      
      // Ultra-Intelligence Configuration
      ULTRA_INTELLIGENCE_MODE: process.env.ULTRA_INTELLIGENCE_MODE || 'true',
      MAX_QUALITY_THRESHOLD: process.env.MAX_QUALITY_THRESHOLD || '0.95',
      PERFORMANCE_MONITORING: process.env.PERFORMANCE_MONITORING || 'true',
      
      // Future GPT-5 Settings (Ready for Migration)
      GPT5_API_KEY: process.env.GPT5_API_KEY,
      GPT5_ENDPOINT: process.env.GPT5_ENDPOINT,
      GPT5_MINI_ENDPOINT: process.env.GPT5_MINI_ENDPOINT
    };
  }

  private validateConfiguration(): void {
    // Validate ultra-intelligence mode
    if (this.config.ULTRA_INTELLIGENCE_MODE === 'true') {
      console.log('🧠 Ultra-Intelligence Mode: ENABLED');
    }

    // Validate quality threshold
    const qualityThreshold = parseFloat(this.config.MAX_QUALITY_THRESHOLD || '0.95');
    if (qualityThreshold < 0.8) {
      console.warn('⚠️ Quality threshold below recommended minimum (0.8)');
    }

    // Check GPT-5 readiness
    if (this.config.ENABLE_GPT5_MODELS === 'true') {
      console.log('🚀 GPT-5 Models: ENABLED for ultra-intelligent analysis');
      
      if (!this.config.GPT5_API_KEY) {
        console.warn('⚠️ GPT-5 enabled but GPT5_API_KEY not configured');
      }
    } else {
      console.log('📋 GPT-5 Models: Ready for migration (currently disabled)');
    }
  }

  private logConfiguration(): void {
    console.log('🌟 Ultra-Intelligent Environment Configuration:');
    console.log(`   Legal Model: ${this.config.LEGAL_MODEL}`);
    console.log(`   Clinical Model: ${this.config.CLINICAL_MODEL}`);
    console.log(`   Commercial Model: ${this.config.COMMERCIAL_MODEL}`);
    console.log(`   Quality Threshold: ${this.config.MAX_QUALITY_THRESHOLD}`);
    console.log(`   GPT-5 Ready: ${this.config.ENABLE_GPT5_MODELS === 'true' ? 'YES' : 'STANDBY'}`);
  }

  /**
   * GET ENVIRONMENT CONFIGURATION
   */
  public getConfig(): UltraIntelligentEnvironmentConfig {
    return { ...this.config };
  }

  /**
   * CHECK GPT-5 READINESS
   */
  public isGPT5Ready(): boolean {
    return this.config.ENABLE_GPT5_MODELS === 'true' && !!this.config.GPT5_API_KEY;
  }

  /**
   * GET MODEL FOR DOMAIN
   */
  public getModelForDomain(domain: string): string {
    const models = {
      legal: this.config.LEGAL_MODEL,
      clinical: this.config.CLINICAL_MODEL,
      commercial: this.config.COMMERCIAL_MODEL,
      research: this.config.RESEARCH_MODEL,
      financial: this.config.FINANCIAL_MODEL,
      general: this.config.DEFAULT_MODEL
    };

    return models[domain] || this.config.DEFAULT_MODEL || 'gpt-4o';
  }

  /**
   * GET QUALITY THRESHOLD
   */
  public getQualityThreshold(): number {
    return parseFloat(this.config.MAX_QUALITY_THRESHOLD || '0.95');
  }

  /**
   * IS ULTRA-INTELLIGENCE MODE ENABLED
   */
  public isUltraIntelligenceEnabled(): boolean {
    return this.config.ULTRA_INTELLIGENCE_MODE === 'true';
  }

  /**
   * GET RECOMMENDED GPT-5 MIGRATION SETTINGS
   */
  public getGPT5MigrationPlan(): {
    legalModel: string;
    clinicalModel: string;
    commercialModel: string;
    migrationStrategy: string;
  } {
    return {
      legalModel: this.isGPT5Ready() ? 'gpt-5' : 'gpt-4o',
      clinicalModel: this.isGPT5Ready() ? 'gpt-5' : 'gpt-4o',
      commercialModel: this.isGPT5Ready() ? 'gpt-5-mini' : 'gpt-4',
      migrationStrategy: this.isGPT5Ready() ? 'active' : 'standby'
    };
  }

  /**
   * UPDATE CONFIGURATION FOR GPT-5 MIGRATION
   */
  public enableGPT5Migration(apiKey: string): void {
    process.env.ENABLE_GPT5_MODELS = 'true';
    process.env.GPT5_API_KEY = apiKey;
    process.env.LEGAL_MODEL = 'gpt-5';
    process.env.CLINICAL_MODEL = 'gpt-5';
    process.env.COMMERCIAL_MODEL = 'gpt-5-mini';
    
    this.config = this.loadConfiguration();
    console.log('🚀 GPT-5 Migration: ACTIVATED - Ultra-intelligence level unlocked');
  }
}

// Export singleton instance
export const ultraIntelligentEnvironment = UltraIntelligentEnvironment.getInstance();

// Environment configuration helper functions
export function isUltraIntelligenceEnabled(): boolean {
  return ultraIntelligentEnvironment.isUltraIntelligenceEnabled();
}

export function getModelForDomain(domain: string): string {
  return ultraIntelligentEnvironment.getModelForDomain(domain);
}

export function getQualityThreshold(): number {
  return ultraIntelligentEnvironment.getQualityThreshold();
}

export function isGPT5Ready(): boolean {
  return ultraIntelligentEnvironment.isGPT5Ready();
}