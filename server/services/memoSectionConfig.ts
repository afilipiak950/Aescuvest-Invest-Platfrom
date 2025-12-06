/**
 * Memo Section Configuration
 * 
 * Defines the required agents, categories, and minimum metrics for each
 * memo section to ensure bulletproof quality with real data.
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

export const MEMO_SECTION_CONFIGS: SectionConfig[] = [
  {
    sectionName: 'executive_summary',
    displayName: 'Executive Summary',
    requiredAgents: ['financial', 'commercial', 'clinical', 'legal'],
    requiredCategories: ['funding', 'valuation', 'market_size', 'regulatory'],
    minMetrics: 8,
    minHighConfidenceMetrics: 4,
    requiredMetricTypes: ['currency', 'percentage'],
    qualityThreshold: 85,
    description: 'High-level overview requiring key financial, market, and regulatory data',
    orderIndex: 1,
    isRequired: true
  },
  {
    sectionName: 'company_overview',
    displayName: 'Company Overview',
    requiredAgents: ['legal', 'hr', 'commercial'],
    requiredCategories: ['corporate_structure', 'team', 'customers'],
    minMetrics: 6,
    minHighConfidenceMetrics: 3,
    requiredMetricTypes: ['count', 'date'],
    qualityThreshold: 85,
    description: 'Corporate structure, founding date, team size, and customer base',
    orderIndex: 2,
    isRequired: true
  },
  {
    sectionName: 'financial_overview',
    displayName: 'Financial Overview',
    requiredAgents: ['financial'],
    requiredCategories: ['funding', 'valuation', 'revenue', 'burn_rate'],
    minMetrics: 10,
    minHighConfidenceMetrics: 5,
    requiredMetricTypes: ['currency', 'percentage', 'duration'],
    qualityThreshold: 90,
    description: 'Comprehensive financial data: funding rounds, valuation, revenue, burn rate',
    orderIndex: 3,
    isRequired: true
  },
  {
    sectionName: 'market_analysis',
    displayName: 'Market Analysis',
    requiredAgents: ['commercial'],
    requiredCategories: ['market_size', 'customers', 'go_to_market'],
    minMetrics: 6,
    minHighConfidenceMetrics: 3,
    requiredMetricTypes: ['currency', 'percentage'],
    qualityThreshold: 85,
    description: 'TAM/SAM/SOM, market growth rates, customer segments',
    orderIndex: 4,
    isRequired: true
  },
  {
    sectionName: 'competitive_landscape',
    displayName: 'Competitive Landscape',
    requiredAgents: ['commercial', 'ip'],
    requiredCategories: ['competitive_landscape', 'patents'],
    minMetrics: 5,
    minHighConfidenceMetrics: 2,
    requiredMetricTypes: ['count', 'percentage'],
    qualityThreshold: 85,
    description: 'Competitor analysis, market share, differentiation factors',
    orderIndex: 5,
    isRequired: true
  },
  {
    sectionName: 'clinical_regulatory',
    displayName: 'Clinical & Regulatory',
    requiredAgents: ['clinical', 'legal'],
    requiredCategories: ['clinical_trials', 'regulatory', 'efficacy'],
    minMetrics: 8,
    minHighConfidenceMetrics: 4,
    requiredMetricTypes: ['count', 'percentage', 'date'],
    qualityThreshold: 85,
    description: 'Clinical trial data, regulatory pathway, FDA milestones',
    orderIndex: 6,
    isRequired: false  // Only for healthcare/biotech deals
  },
  {
    sectionName: 'technology_ip',
    displayName: 'Technology & IP',
    requiredAgents: ['ip', 'research'],
    requiredCategories: ['patents', 'trade_secrets', 'technology'],
    minMetrics: 5,
    minHighConfidenceMetrics: 2,
    requiredMetricTypes: ['count', 'date'],
    qualityThreshold: 85,
    description: 'Patent portfolio, technology differentiation, R&D pipeline',
    orderIndex: 7,
    isRequired: true
  },
  {
    sectionName: 'team_assessment',
    displayName: 'Team Assessment',
    requiredAgents: ['hr'],
    requiredCategories: ['executive_team', 'team', 'advisors_board'],
    minMetrics: 5,
    minHighConfidenceMetrics: 2,
    requiredMetricTypes: ['count'],
    qualityThreshold: 85,
    description: 'Founder backgrounds, team composition, advisors',
    orderIndex: 8,
    isRequired: true
  },
  {
    sectionName: 'risk_factors',
    displayName: 'Risk Factors',
    requiredAgents: ['legal', 'financial', 'clinical', 'commercial'],
    requiredCategories: ['litigation', 'regulatory_compliance', 'burn_rate'],
    minMetrics: 5,
    minHighConfidenceMetrics: 2,
    requiredMetricTypes: ['currency', 'percentage', 'duration'],
    qualityThreshold: 85,
    description: 'Legal risks, financial runway, regulatory hurdles',
    orderIndex: 9,
    isRequired: true
  },
  {
    sectionName: 'investment_thesis',
    displayName: 'Investment Thesis',
    requiredAgents: ['financial', 'commercial', 'clinical', 'ip'],
    requiredCategories: ['valuation', 'market_size', 'competitive_landscape', 'patents'],
    minMetrics: 8,
    minHighConfidenceMetrics: 4,
    requiredMetricTypes: ['currency', 'percentage', 'ratio'],
    qualityThreshold: 85,
    description: 'Key investment merits backed by quantitative data',
    orderIndex: 10,
    isRequired: true
  }
];

/**
 * Get section config by name
 */
export function getSectionConfig(sectionName: string): SectionConfig | undefined {
  return MEMO_SECTION_CONFIGS.find(c => c.sectionName === sectionName);
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
