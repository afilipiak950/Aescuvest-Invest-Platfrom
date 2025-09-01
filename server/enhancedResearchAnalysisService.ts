/**
 * Enhanced Research Analysis Service
 * Provides deep, evidence-based research analysis with comprehensive source attribution
 * Uses the same architecture as Legal analysis for consistent data structure
 */

import { EnhancedComprehensiveAnalysisService } from './enhancedComprehensiveAnalysisService';

// Comprehensive research questions matching frontend RESEARCH_QUESTIONS array for consistency
const ENHANCED_RESEARCH_QUESTIONS = [
  // Market Research Reports
  {
    id: 'market_1',
    category: 'Market Research Reports',
    question: 'Are TAM/SAM/SOM defined with assumptions?',
    keywords: ['market size', 'TAM', 'SAM', 'SOM', 'addressable market', 'market opportunity', 'revenue potential', 'assumptions']
  },
  {
    id: 'market_2',
    category: 'Market Research Reports',
    question: 'What competitive landscape analysis is provided?',
    keywords: ['competitive landscape', 'competitors', 'market share', 'competitive analysis', 'industry analysis']
  },
  {
    id: 'market_3',
    category: 'Market Research Reports',
    question: 'Are market growth projections validated?',
    keywords: ['market growth', 'projections', 'validation', 'growth rates', 'market trends', 'forecasts']
  },
  // Technical Whitepapers
  {
    id: 'technical_1',
    category: 'Technical Whitepapers',
    question: 'What technical approach/architecture is described?',
    keywords: ['technical approach', 'architecture', 'technology stack', 'implementation', 'system design']
  },
  {
    id: 'technical_2',
    category: 'Technical Whitepapers',
    question: 'Are technical risks and mitigation strategies outlined?',
    keywords: ['technical risks', 'mitigation strategies', 'risk assessment', 'technical challenges', 'risk management']
  },
  {
    id: 'technical_3',
    category: 'Technical Whitepapers',
    question: 'What scalability and performance benchmarks are provided?',
    keywords: ['scalability', 'performance', 'benchmarks', 'load testing', 'performance metrics', 'capacity']
  },
  // Academic Publications
  {
    id: 'academic_1',
    category: 'Academic Publications',
    question: 'What peer-reviewed research supports the technology?',
    keywords: ['peer-reviewed', 'research', 'academic validation', 'publications', 'scientific evidence', 'studies']
  },
  {
    id: 'academic_2',
    category: 'Academic Publications',
    question: 'Are there collaborations with research institutions?',
    keywords: ['research collaborations', 'university partnerships', 'academic institutions', 'research partnerships']
  },
  {
    id: 'academic_3',
    category: 'Academic Publications',
    question: 'What scientific evidence validates the approach?',
    keywords: ['scientific evidence', 'validation', 'research methodology', 'experimental results', 'clinical data']
  },
  // Patent Landscape
  {
    id: 'patent_1',
    category: 'Patent Landscape',
    question: 'What patent portfolio exists and what gaps are identified?',
    keywords: ['patent portfolio', 'intellectual property', 'IP gaps', 'patent protection', 'IP strategy']
  },
  {
    id: 'patent_2',
    category: 'Patent Landscape',
    question: 'Are there freedom-to-operate risks?',
    keywords: ['freedom to operate', 'FTO', 'patent risks', 'IP infringement', 'patent landscape analysis']
  }
];

class EnhancedResearchAnalysisService extends EnhancedComprehensiveAnalysisService {
  constructor() {
    super('Research', ENHANCED_RESEARCH_QUESTIONS);
  }
}

export const enhancedResearchAnalysisService = new EnhancedResearchAnalysisService();

// Export the start function for route integration
export async function startEnhancedResearchAnalysis(dealId: number): Promise<void> {
  return enhancedResearchAnalysisService.runEnhancedAnalysis(dealId);
}