/**
 * Memo Section Configuration
 * 
 * Defines the required agents, categories, and minimum metrics for each
 * memo section to ensure bulletproof quality with real data.
 * 
 * IMPORTANT: Section names use camelCase to match the InvestmentMemoSections interface
 * Categories match those emitted by AgentDataFusionService.categorizeQuestion()
 */

export interface SectionConfig {
  sectionName: string;
  displayName: string;
  requiredAgents: string[];
  requiredCategories: string[];
  minMetrics: number;
  minHighConfidenceMetrics: number;
  requiredMetricTypes: string[];
  qualityThreshold: number;
  description: string;
  orderIndex: number;
  isRequired: boolean;
}

/**
 * The 12 core memo sections with their requirements
 * Section names use camelCase to match InvestmentMemoSections interface
 */
export const MEMO_SECTION_CONFIGS: SectionConfig[] = [
  {
    sectionName: 'coverPage',
    displayName: 'Cover Page',
    requiredAgents: ['financial', 'commercial', 'legal'],
    requiredCategories: ['funding_history', 'valuation', 'corporate_structure'],
    minMetrics: 3,
    minHighConfidenceMetrics: 1,
    requiredMetricTypes: ['currency'],
    qualityThreshold: 85,
    description: 'Professional cover page with company info and investment highlights',
    orderIndex: 1,
    isRequired: true
  },
  {
    sectionName: 'executiveSummary',
    displayName: 'Executive Summary',
    requiredAgents: ['financial', 'commercial', 'clinical', 'legal'],
    requiredCategories: ['funding_history', 'valuation', 'market_analysis', 'regulatory_pathway'],
    minMetrics: 5,
    minHighConfidenceMetrics: 2,
    requiredMetricTypes: ['currency', 'percentage'],
    qualityThreshold: 85,
    description: 'High-level overview requiring key financial, market, and regulatory data',
    orderIndex: 2,
    isRequired: true
  },
  {
    sectionName: 'financialAnalysis',
    displayName: 'Financial Analysis',
    requiredAgents: ['financial'],
    requiredCategories: ['funding_history', 'valuation', 'revenue_metrics', 'burn_rate', 'cap_table'],
    minMetrics: 8,
    minHighConfidenceMetrics: 4,
    requiredMetricTypes: ['currency', 'percentage', 'duration'],
    qualityThreshold: 90,
    description: 'Comprehensive financial data: funding rounds, valuation, revenue, burn rate',
    orderIndex: 3,
    isRequired: true
  },
  {
    sectionName: 'teamAssessment',
    displayName: 'Team Assessment',
    requiredAgents: ['hr'],
    requiredCategories: ['executive_team', 'team_composition', 'advisors_board', 'organizational_culture'],
    minMetrics: 4,
    minHighConfidenceMetrics: 2,
    requiredMetricTypes: ['count'],
    qualityThreshold: 85,
    description: 'Founder backgrounds, team composition, advisors',
    orderIndex: 4,
    isRequired: true
  },
  {
    sectionName: 'marketAnalysis',
    displayName: 'Market Analysis',
    requiredAgents: ['commercial'],
    requiredCategories: ['market_analysis', 'customer_validation', 'go_to_market'],
    minMetrics: 5,
    minHighConfidenceMetrics: 2,
    requiredMetricTypes: ['currency', 'percentage'],
    qualityThreshold: 85,
    description: 'TAM/SAM/SOM, market growth rates, customer segments',
    orderIndex: 5,
    isRequired: true
  },
  {
    sectionName: 'riskAnalysis',
    displayName: 'Risk Analysis',
    requiredAgents: ['legal', 'financial', 'clinical', 'commercial'],
    requiredCategories: ['litigation', 'regulatory_compliance', 'burn_rate', 'competitive_landscape'],
    minMetrics: 4,
    minHighConfidenceMetrics: 2,
    requiredMetricTypes: ['currency', 'percentage', 'duration'],
    qualityThreshold: 85,
    description: 'Legal risks, financial runway, regulatory hurdles',
    orderIndex: 6,
    isRequired: true
  },
  {
    sectionName: 'regulatoryPathway',
    displayName: 'Regulatory Pathway',
    requiredAgents: ['clinical', 'legal'],
    requiredCategories: ['regulatory_pathway', 'regulatory_compliance', 'clinical_trials'],
    minMetrics: 4,
    minHighConfidenceMetrics: 2,
    requiredMetricTypes: ['count', 'date'],
    qualityThreshold: 85,
    description: 'FDA/regulatory pathway and compliance status',
    orderIndex: 7,
    isRequired: false
  },
  {
    sectionName: 'clinicalEvidence',
    displayName: 'Clinical Evidence',
    requiredAgents: ['clinical'],
    requiredCategories: ['clinical_trials', 'safety_data', 'efficacy_data'],
    minMetrics: 5,
    minHighConfidenceMetrics: 2,
    requiredMetricTypes: ['count', 'percentage', 'date'],
    qualityThreshold: 85,
    description: 'Clinical trial data, safety, and efficacy results',
    orderIndex: 8,
    isRequired: false
  },
  {
    sectionName: 'intellectualProperty',
    displayName: 'Intellectual Property',
    requiredAgents: ['ip', 'research'],
    requiredCategories: ['patents', 'trademarks', 'trade_secrets', 'licensing'],
    minMetrics: 4,
    minHighConfidenceMetrics: 2,
    requiredMetricTypes: ['count', 'date'],
    qualityThreshold: 85,
    description: 'Patent portfolio, technology differentiation, R&D pipeline',
    orderIndex: 9,
    isRequired: true
  },
  {
    sectionName: 'investmentTerms',
    displayName: 'Investment Terms',
    requiredAgents: ['financial', 'legal'],
    requiredCategories: ['valuation', 'funding_history', 'cap_table', 'governance'],
    minMetrics: 4,
    minHighConfidenceMetrics: 2,
    requiredMetricTypes: ['currency', 'percentage'],
    qualityThreshold: 85,
    description: 'Valuation, deal terms, board rights, liquidation preferences',
    orderIndex: 10,
    isRequired: true
  },
  {
    sectionName: 'competitiveAnalysis',
    displayName: 'Competitive Analysis',
    requiredAgents: ['commercial', 'ip'],
    requiredCategories: ['competitive_landscape', 'market_analysis', 'patents'],
    minMetrics: 4,
    minHighConfidenceMetrics: 2,
    requiredMetricTypes: ['count', 'percentage'],
    qualityThreshold: 85,
    description: 'Competitor analysis, market share, differentiation factors',
    orderIndex: 11,
    isRequired: true
  },
  {
    sectionName: 'technologyAssessment',
    displayName: 'Technology Assessment',
    requiredAgents: ['ip', 'research'],
    requiredCategories: ['technology', 'rd_pipeline', 'patents', 'trade_secrets'],
    minMetrics: 4,
    minHighConfidenceMetrics: 2,
    requiredMetricTypes: ['count'],
    qualityThreshold: 85,
    description: 'Technology stack, R&D roadmap, technical differentiation',
    orderIndex: 12,
    isRequired: true
  }
];

/**
 * Get section config by name (supports both camelCase and snake_case for backwards compatibility)
 */
export function getSectionConfig(sectionName: string): SectionConfig | undefined {
  const config = MEMO_SECTION_CONFIGS.find(c => c.sectionName === sectionName);
  if (config) return config;
  
  const camelCaseName = sectionName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  return MEMO_SECTION_CONFIGS.find(c => c.sectionName === camelCaseName);
}

/**
 * Get all required sections in order
 */
export function getRequiredSections(): SectionConfig[] {
  return MEMO_SECTION_CONFIGS
    .filter(c => c.isRequired)
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

/**
 * Get all sections in order (both required and optional)
 */
export function getAllSections(): SectionConfig[] {
  return [...MEMO_SECTION_CONFIGS].sort((a, b) => a.orderIndex - b.orderIndex);
}

/**
 * Get sections that require specific agent types
 */
export function getSectionsForAgent(agentType: string): SectionConfig[] {
  return MEMO_SECTION_CONFIGS.filter(c => 
    c.requiredAgents.includes(agentType.toLowerCase())
  );
}

/**
 * Calculate minimum total metrics needed across all sections
 */
export function getTotalMinMetrics(): number {
  return MEMO_SECTION_CONFIGS
    .filter(c => c.isRequired)
    .reduce((sum, c) => sum + c.minMetrics, 0);
}

/**
 * Check if a deal has sufficient evidence for a quality memo
 */
export function assessDealReadiness(evidenceCounts: Record<string, number>): {
  isReady: boolean;
  coverage: Record<string, boolean>;
  missingData: string[];
  score: number;
} {
  const coverage: Record<string, boolean> = {};
  const missingData: string[] = [];
  let score = 0;
  let maxScore = 0;

  for (const section of MEMO_SECTION_CONFIGS.filter(c => c.isRequired)) {
    const sectionEvidence = section.requiredCategories.reduce((sum, cat) => 
      sum + (evidenceCounts[cat] || 0), 0
    );
    
    const isCovered = sectionEvidence >= section.minMetrics;
    coverage[section.sectionName] = isCovered;
    
    if (!isCovered) {
      missingData.push(`${section.displayName}: needs ${section.minMetrics - sectionEvidence} more metrics`);
    }
    
    score += Math.min(sectionEvidence / section.minMetrics, 1) * section.qualityThreshold;
    maxScore += section.qualityThreshold;
  }

  return {
    isReady: missingData.length === 0,
    coverage,
    missingData,
    score: Math.round((score / maxScore) * 100)
  };
}

/**
 * Get the section key for the memo object based on section config
 */
export function getMemoSectionKey(sectionName: string): string {
  return sectionName;
}

/**
 * Map categories from evidence to sections that need them
 */
export function getSectionsNeedingCategory(category: string): string[] {
  return MEMO_SECTION_CONFIGS
    .filter(c => c.requiredCategories.includes(category))
    .map(c => c.sectionName);
}
