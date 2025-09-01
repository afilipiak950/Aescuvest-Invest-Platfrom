/**
 * Enhanced Research Analysis Service
 * Provides deep, evidence-based research analysis with comprehensive source attribution
 * Uses the same architecture as Legal analysis for consistent data structure
 */

import { EnhancedComprehensiveAnalysisService } from './enhancedComprehensiveAnalysisService';

// Comprehensive research questions for thorough analysis
const ENHANCED_RESEARCH_QUESTIONS = [
  {
    id: 'market_1',
    category: 'Market Analysis',
    question: 'What is the total addressable market (TAM) and serviceable addressable market (SAM)?',
    keywords: ['market size', 'TAM', 'SAM', 'addressable market', 'market opportunity', 'revenue potential']
  },
  {
    id: 'competitive_1',
    category: 'Competitive Analysis',
    question: 'Who are the main competitors and what are their competitive advantages?',
    keywords: ['competitors', 'competitive landscape', 'market share', 'competitive advantage', 'differentiation']
  },
  {
    id: 'competitive_2',
    category: 'Competitive Analysis',
    question: 'What are the key competitive threats and how significant are they?',
    keywords: ['competitive threats', 'market risks', 'disruption', 'barriers to entry', 'threat analysis']
  },
  {
    id: 'technology_1',
    category: 'Technology Assessment',
    question: 'What is the technological differentiation and competitive moat?',
    keywords: ['technology', 'differentiation', 'innovation', 'moat', 'technical advantage', 'proprietary']
  },
  {
    id: 'business_1',
    category: 'Business Model',
    question: 'How scalable and sustainable is the business model?',
    keywords: ['business model', 'scalability', 'sustainability', 'revenue model', 'unit economics']
  },
  {
    id: 'growth_1',
    category: 'Growth Potential',
    question: 'What are the growth drivers and expansion opportunities?',
    keywords: ['growth drivers', 'expansion', 'market expansion', 'growth potential', 'scaling']
  },
  {
    id: 'risk_1',
    category: 'Risk Assessment',
    question: 'What are the primary business and market risks?',
    keywords: ['business risks', 'market risks', 'operational risks', 'regulatory risks', 'strategic risks']
  },
  {
    id: 'customer_1',
    category: 'Customer Analysis',
    question: 'Who is the target customer and what is the customer acquisition strategy?',
    keywords: ['target customer', 'customer acquisition', 'customer segments', 'customer strategy']
  },
  {
    id: 'partnerships_1',
    category: 'Strategic Partnerships',
    question: 'What strategic partnerships and alliances exist or are planned?',
    keywords: ['partnerships', 'alliances', 'strategic relationships', 'joint ventures', 'collaborations']
  },
  {
    id: 'regulatory_1',
    category: 'Regulatory Environment',
    question: 'What regulatory requirements and compliance obligations apply?',
    keywords: ['regulatory', 'compliance', 'regulations', 'legal requirements', 'industry standards']
  },
  {
    id: 'innovation_1',
    category: 'Innovation & R&D',
    question: 'What is the innovation pipeline and R&D capabilities?',
    keywords: ['innovation', 'R&D', 'research', 'development', 'pipeline', 'future products']
  },
  {
    id: 'exit_1',
    category: 'Exit Strategy',
    question: 'What are the potential exit strategies and strategic acquirers?',
    keywords: ['exit strategy', 'acquisition', 'strategic buyers', 'IPO', 'exit opportunities']
  },
  {
    id: 'esg_1',
    category: 'ESG & Sustainability',
    question: 'What ESG considerations and sustainability factors are relevant?',
    keywords: ['ESG', 'sustainability', 'environmental', 'social impact', 'governance', 'responsible investing']
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