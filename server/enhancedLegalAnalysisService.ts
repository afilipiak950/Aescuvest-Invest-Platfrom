/**
 * Enhanced Legal Analysis Service
 * Provides deep, evidence-based legal analysis with comprehensive source attribution
 */

import { EnhancedComprehensiveAnalysisService } from './enhancedComprehensiveAnalysisService';

// Comprehensive legal questions for thorough analysis
const ENHANCED_LEGAL_QUESTIONS = [
  {
    id: 'sha_1',
    category: 'Shareholders Agreement / Articles of Association',
    question: 'What class of shares exist and what are their respective rights?',
    keywords: ['shares', 'equity', 'class', 'rights', 'voting', 'preferred', 'common', 'series']
  },
  {
    id: 'sha_2',
    category: 'Shareholders Agreement / Articles of Association',
    question: 'Are liquidation preferences clearly defined and what are the terms?',
    keywords: ['liquidation', 'preference', 'distribution', 'priority', 'multiple', 'waterfall']
  },
  {
    id: 'sha_3',
    category: 'Shareholders Agreement / Articles of Association',
    question: 'Is anti-dilution protection present and how does it work?',
    keywords: ['anti-dilution', 'protection', 'weighted average', 'full ratchet', 'adjustment']
  },
  {
    id: 'gov_1',
    category: 'Governance & Voting',
    question: 'How is board composition defined and what are the appointment procedures?',
    keywords: ['board', 'composition', 'directors', 'appointment', 'representation', 'meetings']
  },
  {
    id: 'gov_2',
    category: 'Governance & Voting',
    question: 'What voting rights and procedures are specified?',
    keywords: ['voting', 'rights', 'procedures', 'majority', 'veto', 'consent', 'quorum']
  },
  {
    id: 'ip_1',
    category: 'IP Assignment & Key Personnel',
    question: 'Are IP assignment agreements properly executed and comprehensive?',
    keywords: ['ip assignment', 'intellectual property', 'invention', 'assignment', 'work for hire']
  },
  {
    id: 'ip_2',
    category: 'IP Assignment & Key Personnel',
    question: 'Are all founders and key personnel covered by appropriate agreements?',
    keywords: ['founders', 'key personnel', 'employment', 'confidentiality', 'non-compete']
  },
  {
    id: 'commercial_1',
    category: 'Commercial Agreements',
    question: 'What SLAs, warranties, and indemnity provisions exist in commercial contracts?',
    keywords: ['sla', 'warranties', 'indemnity', 'liability', 'service level', 'guarantee']
  },
  {
    id: 'commercial_2',
    category: 'Commercial Agreements',
    question: 'How are termination clauses structured and are they balanced?',
    keywords: ['termination', 'breach', 'cure period', 'notice', 'post-termination', 'obligations']
  },
  {
    id: 'compliance_1',
    category: 'Litigation & Regulatory',
    question: 'Are there any pending litigations, disputes, or regulatory proceedings?',
    keywords: ['litigation', 'disputes', 'regulatory', 'proceedings', 'compliance', 'investigations']
  },
  {
    id: 'compliance_2',
    category: 'Litigation & Regulatory',
    question: 'What regulatory compliance frameworks and licenses are in place?',
    keywords: ['regulatory', 'compliance', 'licenses', 'permits', 'framework', 'certification']
  },
  {
    id: 'financial_1',
    category: 'Financial & Tax',
    question: 'What financial reporting and audit obligations exist?',
    keywords: ['financial reporting', 'audit', 'obligations', 'accounting', 'standards', 'disclosure']
  },
  {
    id: 'contracts_1',
    category: 'Key Contracts',
    question: 'What are the material terms of key customer and supplier contracts?',
    keywords: ['customer contracts', 'supplier', 'material terms', 'key agreements', 'commercial']
  },
  {
    id: 'employment_1',
    category: 'Employment & HR',
    question: 'What employment law compliance measures are documented?',
    keywords: ['employment law', 'compliance', 'hr policies', 'labor', 'employee rights']
  },
  {
    id: 'data_1',
    category: 'Data Protection & Privacy',
    question: 'What data protection and privacy compliance measures exist?',
    keywords: ['data protection', 'privacy', 'gdpr', 'ccpa', 'personal data', 'compliance']
  }
];

class EnhancedLegalAnalysisService extends EnhancedComprehensiveAnalysisService {
  constructor() {
    super('Legal', ENHANCED_LEGAL_QUESTIONS);
  }
}

export const enhancedLegalAnalysisService = new EnhancedLegalAnalysisService();

// Export the start function for route integration
export async function startEnhancedLegalAnalysis(dealId: number): Promise<void> {
  return enhancedLegalAnalysisService.runEnhancedAnalysis(dealId);
}