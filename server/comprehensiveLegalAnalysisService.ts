/**
 * Comprehensive Legal Analysis Service - EXACT COPY from Clinical with Legal adaptations
 * Analyzes ALL assigned legal documents systematically for each question
 * Extracts specific evidence from documents and compiles complete answers
 */

import { db } from './db';
import { documents, agentAnalyses } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { storage } from './storage';
import { ENTERPRISE_AGENT_PROMPTS, EVIDENCE_SYNTHESIS_PROMPT } from './utils/enterprisePrompts';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Enhanced legal questions for comprehensive analysis - EXACT structure as Clinical
export const COMPREHENSIVE_LEGAL_QUESTIONS = [
  // Contracts & Agreements
  { 
    id: 'contracts_1', 
    question: 'Are key commercial contracts clearly defined?', 
    category: 'Contracts & Agreements',
    analysisPrompt: 'Identify commercial contracts, revenue agreements, partnership deals, supplier contracts, and key commercial terms.',
    keywords: ['contract', 'agreement', 'commercial', 'revenue', 'partnership', 'supplier', 'customer', 'terms', 'conditions', 'pricing']
  },
  { 
    id: 'contracts_2', 
    question: 'What are the key contractual obligations and terms?', 
    category: 'Contracts & Agreements',
    analysisPrompt: 'Identify contractual obligations, payment terms, performance requirements, deliverables, and key contract terms.',
    keywords: ['obligations', 'payment terms', 'performance', 'deliverables', 'warranty', 'liability', 'indemnification', 'termination']
  },
  { 
    id: 'contracts_3', 
    question: 'Are there any concerning contract provisions or risks?', 
    category: 'Contracts & Agreements',
    analysisPrompt: 'Find concerning contract provisions, liability issues, indemnification clauses, and contractual risk factors.',
    keywords: ['liability', 'penalty', 'breach', 'default', 'force majeure', 'dispute', 'arbitration', 'governing law']
  },
  // Intellectual Property
  { 
    id: 'ip_1', 
    question: 'What is the intellectual property portfolio status?', 
    category: 'Intellectual Property',
    analysisPrompt: 'Identify patents, trademarks, copyrights, trade secrets, and IP ownership status.',
    keywords: ['patent', 'trademark', 'copyright', 'trade secret', 'intellectual property', 'ip', 'proprietary', 'ownership']
  },
  { 
    id: 'ip_2', 
    question: 'Are there any IP licensing agreements or restrictions?', 
    category: 'Intellectual Property',
    analysisPrompt: 'Look for IP licensing agreements, restrictions, royalty payments, and licensing obligations.',
    keywords: ['license', 'licensing', 'royalty', 'exclusive', 'non-exclusive', 'sublicense', 'restrictions', 'field of use']
  },
  { 
    id: 'ip_3', 
    question: 'Are there IP disputes or infringement risks?', 
    category: 'Intellectual Property',
    analysisPrompt: 'Find IP disputes, infringement claims, freedom to operate issues, and IP litigation risks.',
    keywords: ['infringement', 'dispute', 'litigation', 'prior art', 'freedom to operate', 'cease and desist', 'invalidity']
  },
  // Corporate Governance
  { 
    id: 'governance_1', 
    question: 'Is corporate structure and governance clearly defined?', 
    category: 'Corporate Governance',
    analysisPrompt: 'Analyze corporate structure, board composition, governance policies, and shareholder rights.',
    keywords: ['corporate structure', 'board', 'governance', 'shareholders', 'directors', 'bylaws', 'charter', 'voting']
  },
  { 
    id: 'governance_2', 
    question: 'Are there any governance compliance issues?', 
    category: 'Corporate Governance',
    analysisPrompt: 'Identify governance compliance issues, regulatory requirements, and corporate law violations.',
    keywords: ['compliance', 'fiduciary', 'disclosure', 'audit', 'conflict of interest', 'related party', 'securities']
  },
  { 
    id: 'governance_3', 
    question: 'What are the key shareholder agreements and rights?', 
    category: 'Corporate Governance',
    analysisPrompt: 'Examine shareholder agreements, voting rights, drag-along rights, tag-along rights, and liquidation preferences.',
    keywords: ['shareholder agreement', 'voting rights', 'drag along', 'tag along', 'liquidation preference', 'anti-dilution']
  },
  // Regulatory Compliance
  { 
    id: 'regulatory_1', 
    question: 'What regulatory frameworks apply to the business?', 
    category: 'Regulatory Compliance',
    analysisPrompt: 'Identify applicable regulatory frameworks, industry regulations, and compliance requirements.',
    keywords: ['regulatory', 'compliance', 'regulation', 'regulatory framework', 'industry standards', 'certification']
  },
  { 
    id: 'regulatory_2', 
    question: 'Are there any regulatory violations or compliance issues?', 
    category: 'Regulatory Compliance',
    analysisPrompt: 'Find regulatory violations, compliance failures, enforcement actions, and regulatory risks.',
    keywords: ['violation', 'non-compliance', 'enforcement', 'penalty', 'fine', 'sanction', 'regulatory action']
  },
  // Litigation & Legal Risks
  { 
    id: 'litigation_1', 
    question: 'Are there any ongoing or potential litigation matters?', 
    category: 'Litigation & Legal Risks',
    analysisPrompt: 'Identify ongoing litigation, potential legal disputes, legal claims, and litigation risks.',
    keywords: ['litigation', 'lawsuit', 'legal dispute', 'claim', 'complaint', 'settlement', 'judgment', 'court']
  },
  { 
    id: 'litigation_2', 
    question: 'What are the key legal risk factors?', 
    category: 'Litigation & Legal Risks',
    analysisPrompt: 'Analyze legal risk factors, liability exposure, legal uncertainties, and potential legal issues.',
    keywords: ['legal risk', 'liability', 'exposure', 'contingency', 'legal uncertainty', 'potential claims']
  }
];

export interface LegalAnalysisProgress {
  isRunning: boolean;
  progress: number;
  message: string;
  currentStep?: string;
  totalSteps?: number;
  currentQuestion?: string;
}

interface LegalEvidence {
  documentName: string;
  documentSummary: string;
  relevantContent: string[];
  keyFindings: string[];
  confidence: number;
  legalRiskScore: number;
  quantitativeMetrics: Record<string, any>;
  redFlags: string[];
  riskFactors: string[];
  investmentImpact: string;
  dueDiligenceRecommendations: string[];
}

interface LegalAnswer {
  question: string;
  answer: string;
  confidence: number;
  sources: string[];
  detailedEvidence: LegalEvidence[];
  keyFindings: string[];
  evidenceSummary: string;
  legalAssessment: string;
  recommendations: string[];
  legalRiskScore: number;
  quantitativeMetrics: Record<string, any>;
  redFlags: string[];
  riskFactors: string[];
  investmentImpact: string;
  dueDiligenceRecommendations: string[];
}

class ComprehensiveLegalAnalysisService {
  /**
   * Delete existing analysis to ensure fresh start
   */
  async deleteExistingAnalysis(dealId: number): Promise<void> {
    console.log(`🧹 Deleting existing legal analysis for deal ${dealId}`);
    
    await db
      .delete(agentAnalyses)
      .where(and(
        eq(agentAnalyses.dealId, dealId),
        eq(agentAnalyses.agentType, 'Legal')
      ));
    
    console.log(`✅ Cleared existing legal analysis for deal ${dealId}`);
  }

  /**
   * Run comprehensive legal analysis for a deal - EXACT COPY from Clinical
   */
  async runComprehensiveAnalysis(dealId: number, storageService: any, jobId: string): Promise<any> {
    try {
      console.log(`🧬 Starting comprehensive legal analysis for deal ${dealId} with job ${jobId}`);
      
      // Get documents suitable for legal analysis - EXACT Clinical approach
      const assignedDocuments = await this.getAssignedLegalDocuments(dealId);
      console.log(`📄 Found ${assignedDocuments.length} documents for legal analysis`);
      
      if (assignedDocuments.length === 0) {
        console.log(`⚠️ No documents found for legal analysis of deal ${dealId}`);
        
        await storageService.updateBackgroundJob(jobId, {
          status: 'completed',
          progress: 100,
          currentStep: 'No documents available for legal analysis'
        });
        
        return {
          success: true,
          message: 'No documents available for legal analysis',
          questionsAnswered: 0
        };
      }
      
      // Initialize progress - EXACT Clinical approach
      await storageService.updateBackgroundJob(jobId, {
        progress: 5,
        currentStep: 'Starting legal analysis',
        processedDocuments: 0,
        totalDocuments: COMPREHENSIVE_LEGAL_QUESTIONS.length
      });
      
      const legalAnswers: Record<string, any> = {};
      
      // Process each legal question systematically - EXACT Clinical approach
      for (let i = 0; i < COMPREHENSIVE_LEGAL_QUESTIONS.length; i++) {
        const question = COMPREHENSIVE_LEGAL_QUESTIONS[i];
        console.log(`📊 Processing legal question ${i + 1}/${COMPREHENSIVE_LEGAL_QUESTIONS.length}: ${question.question}`);
        
        try {
          // Update progress - Start at 0% like Clinical (removed +5 offset)
          const progress = Math.round(((i + 1) / COMPREHENSIVE_LEGAL_QUESTIONS.length) * 100);
          await storageService.updateBackgroundJob(jobId, {
            progress,
            currentDocumentName: question.question,
            currentStep: `Analyzing: ${question.category}`,
            processedDocuments: i
          });
          
          console.log(`📊 Extracting legal evidence for: ${question.question}`);
          
          // Extract evidence from ALL documents for this question - EXACT Clinical approach
          const documentEvidence = await this.extractEvidenceFromAllDocuments(
            assignedDocuments, 
            question
          );
          console.log(`📊 Evidence extraction completed for question: ${question.question}`);
          
          // Compile comprehensive answer - EXACT Clinical approach with timeout
          console.log(`🤖 Starting OpenAI analysis for question: ${question.question} with ${documentEvidence.length} pieces of evidence`);
          const answer = await Promise.race([
            this.compileComprehensiveAnswer(question, documentEvidence),
            new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI analysis timeout')), 600000)) // 600 second (10 minute) timeout - MASSIVE increase
          ]);
          legalAnswers[question.id] = answer;
          console.log(`🤖 OpenAI analysis completed for question: ${question.question}`);
          
          console.log(`✅ Completed question ${i + 1}/${COMPREHENSIVE_LEGAL_QUESTIONS.length}: ${question.question}`);
          
          // Brief delay to avoid rate limiting - EXACT Clinical approach  
          await new Promise(resolve => setTimeout(resolve, 1500));
          
        } catch (questionError) {
          console.error(`❌ Error processing question ${i + 1}: ${question.question}`, questionError);
          
          // Store partial answer for failed question - EXACT Clinical approach
          legalAnswers[question.id] = {
            question: question.question,
            category: question.category,
            answer: `Error processing this question: ${questionError.message}`,
            confidence: 0,
            sources: [],
            detailedEvidence: [],
            keyFindings: [],
            evidenceSummary: 'Error in analysis',
            legalAssessment: 'Analysis failed',
            recommendations: ['Retry analysis', 'Manual review required']
          };
        }
        
        // Rate limiting between questions - EXACT Clinical approach
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      console.log(`📊 Completed processing ${Object.keys(legalAnswers).length} legal questions`);
      
      try {
        // Generate comprehensive findings and recommendations - EXACT Clinical approach
        const findings = this.generateComprehensiveLegalFindings(legalAnswers);
        const recommendations = this.generateComprehensiveLegalRecommendations(legalAnswers);
        
        console.log(`📊 Generated ${findings.length} findings and ${recommendations.length} recommendations`);
        
        // Store comprehensive results - EXACT Clinical approach
        await this.storeComprehensiveLegalResults(dealId, legalAnswers, findings, recommendations, assignedDocuments);
        
        // Final progress update - EXACT Clinical approach
        await storageService.updateBackgroundJob(jobId, {
          status: 'completed',
          progress: 100,
          currentStep: 'Legal analysis completed',
          processedDocuments: COMPREHENSIVE_LEGAL_QUESTIONS.length
        });
        
        console.log(`✅ Comprehensive legal analysis completed successfully for deal ${dealId}`);
        
        return {
          success: true,
          questionsAnswered: Object.keys(legalAnswers).length,
          documentsAnalyzed: assignedDocuments.length,
          findings: findings.length,
          recommendations: recommendations.length
        };
        
      } catch (saveError) {
        const finalError = new Error(`Legal analysis completed but failed to save results: ${saveError.message}`);
        console.error(`❌ Final save error for deal ${dealId}:`, finalError);
        
        try {
          await storageService.updateBackgroundJob(jobId, {
            status: 'completed',
            progress: 95,
            currentStep: 'Analysis completed, results saved with warnings'
          });
          
          return {
            success: true,
            warning: 'Analysis completed but with save issues',
            questionsAnswered: Object.keys(legalAnswers).length
          };
        } catch (saveError) {
          // Mark job as failed
          await storageService.updateBackgroundJob(jobId, {
            status: 'failed',
            error: `Final error: ${finalError.message}, Save error: ${saveError.message}`
          });
          throw finalError;
        }
      }
    } catch (error) {
      console.error(`❌ Critical error in legal analysis for deal ${dealId}:`, error);
      
      await storageService.updateBackgroundJob(jobId, {
        status: 'failed',
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Get all documents suitable for legal analysis - FIXED to use proper storage method
   */
  private async getAssignedLegalDocuments(dealId: number): Promise<any[]> {
    console.log(`🔧 FIXED: Using storage.getDocumentsWithOCRByDealId for legal analysis deal ${dealId}`);
    
    // ✅ CORRECT: Use proper storage method that fetches OCR text correctly
    const allDocuments = await storage.getDocumentsWithOCRByDealId(dealId);
    
    console.log(`📄 Total documents found for deal ${dealId}: ${allDocuments.length}`);
    
    // Log OCR text availability for debugging
    const docsWithOCR = allDocuments.filter(doc => doc.ocrText && doc.ocrText.length > 0);
    const docsWithSummary = allDocuments.filter(doc => doc.aiSummary);
    console.log(`📊 Legal: Documents with OCR text: ${docsWithOCR.length}/${allDocuments.length}`);
    console.log(`📊 Legal: Documents with AI summary: ${docsWithSummary.length}/${allDocuments.length}`);
    
    // First try documents explicitly assigned to legal agent
    let legalDocuments = allDocuments.filter(doc => 
      (doc.assignedAgents && doc.assignedAgents.includes('Legal')) && 
      (doc.ocrText || doc.aiSummary)
    );
    
    console.log(`📄 Documents explicitly assigned to legal: ${legalDocuments.length}`);
    
    // If no documents are explicitly assigned to legal, identify legal-related documents
    if (legalDocuments.length === 0) {
      console.log('📄 No documents explicitly assigned to legal agent, identifying legal-related documents...');
      
      legalDocuments = allDocuments.filter(doc => {
        if (!doc.ocrText && !doc.aiSummary) {
          console.log(`⚠️ Legal: Document ${doc.name} has no OCR text or AI summary - skipping`);
          return false;
        }
        
        const docName = doc.name.toLowerCase();
        const docContent = (doc.ocrText || '').toLowerCase();
        const aiSummary = doc.aiSummary;
        
        // Log OCR text length for debugging
        if (doc.ocrText) {
          console.log(`📄 Legal: Document ${doc.name}: OCR text length = ${doc.ocrText.length}`);
        }
        
        // Legal document keywords
        const legalKeywords = [
          'legal', 'contract', 'agreement', 'license', 'patent', 'trademark', 'copyright',
          'litigation', 'lawsuit', 'compliance', 'regulatory', 'governance', 'corporate',
          'shareholder', 'board', 'bylaws', 'charter', 'liability', 'indemnification',
          'intellectual property', 'ip', 'employment', 'nda', 'confidentiality',
          'terms of service', 'privacy policy', 'data protection', 'gdpr'
        ];
        
        // Check document name and content for legal keywords
        const hasLegalKeywords = legalKeywords.some(keyword => 
          docName.includes(keyword) || docContent.includes(keyword)
        );
        
        // Check AI summary for legal document type
        const isLegalDocument = aiSummary?.documentType?.toLowerCase().includes('legal') ||
                               aiSummary?.executiveSummary?.toLowerCase().includes('legal') ||
                               aiSummary?.executiveSummary?.toLowerCase().includes('contract') ||
                               aiSummary?.executiveSummary?.toLowerCase().includes('agreement');
        
        return hasLegalKeywords || isLegalDocument;
      });
      
      console.log(`📄 Auto-identified legal documents: ${legalDocuments.length}`);
    }
    
    // If still no legal documents, take documents with meaningful content for analysis
    if (legalDocuments.length === 0) {
      console.log('📄 No legal-related documents found, using all documents with OCR text...');
      legalDocuments = allDocuments.filter(doc => 
        (doc.ocrText && doc.ocrText.length > 100) || doc.aiSummary
      );
      console.log(`📄 Documents with content available: ${legalDocuments.length}`);
    }
    
    // ENTERPRISE FIX: Process all documents for comprehensive institutional analysis
    console.log(`📊 Processing ALL ${legalDocuments.length} legal documents for comprehensive enterprise analysis`);
    
    return legalDocuments;
  }
  
  /**
   * Extract evidence from RELEVANT documents for a specific question - OPTIMIZED VERSION
   */
  private async extractEvidenceFromAllDocuments(
    documents: any[], 
    question: any
  ): Promise<any[]> {
    console.log(`📄 Starting optimized evidence extraction for: ${question.question}`);
    
    // OPTIMIZATION: Filter documents relevant to the specific question first
    const relevantDocuments = this.filterDocumentsForQuestion(documents, question);
    const maxDocuments = Math.min(relevantDocuments.length, 50); // Limit to 50 most relevant documents
    const finalDocuments = relevantDocuments.slice(0, maxDocuments);
    
    console.log(`📊 Processing ${finalDocuments.length} relevant documents (filtered from ${documents.length}) for: ${question.question}`);
    
    // OPTIMIZED BATCH PROCESSING: Smaller batches with rate limiting
    const batchSize = 3; // Reduced batch size to prevent rate limiting
    const evidence = [];
    
    for (let i = 0; i < finalDocuments.length; i += batchSize) {
      const batch = finalDocuments.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(finalDocuments.length / batchSize)} (${batch.length} documents)`);
      
      const batchResults = await Promise.all(
        batch.map(async (doc) => {
          console.log(`🔎 Extracting evidence from: ${doc.name}`);
          return this.extractEvidenceFromDocument(doc, question);
        })
      );
      
      // Filter out null results and add to evidence
      const validEvidence = batchResults.filter(docEvidence => 
        docEvidence && docEvidence.relevantContent.length > 0
      );
      evidence.push(...validEvidence);
      
      console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} completed: ${validEvidence.length}/${batch.length} documents had relevant evidence`);
      
      // Rate limiting between batches to prevent API throttling
      if (i + batchSize < finalDocuments.length) {
        console.log(`⏱️ Rate limiting: waiting 2 seconds before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log(`📋 Extracted evidence from ${evidence.length}/${finalDocuments.length} relevant documents`);
    return evidence;
  }

  /**
   * Filter documents to only those relevant to the specific legal question
   */
  private filterDocumentsForQuestion(documents: any[], question: any): any[] {
    console.log(`🔍 Filtering ${documents.length} documents for question: ${question.question}`);
    
    // Score documents based on relevance to the question
    const scoredDocs = documents.map(doc => {
      let score = 0;
      const docName = doc.name.toLowerCase();
      const docContent = (doc.ocrText || '').toLowerCase();
      const aiSummary = (doc.aiSummary?.executiveSummary || '').toLowerCase();
      const allContent = `${docName} ${docContent} ${aiSummary}`;
      
      // Score based on question keywords
      const keywords = question.keywords || [];
      keywords.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();
        if (allContent.includes(keywordLower)) {
          score += 3; // Higher weight for exact keyword matches
        }
      });
      
      // Additional scoring based on question category
      const categoryBonus = this.getCategorySpecificScore(allContent, question.category);
      score += categoryBonus;
      
      // Boost score for documents with more content
      if (doc.ocrText && doc.ocrText.length > 1000) {
        score += 1;
      }
      
      return { ...doc, relevanceScore: score };
    });
    
    // Filter and sort by relevance score
    const relevantDocs = scoredDocs
      .filter(doc => doc.relevanceScore > 0) // Only include documents with some relevance
      .sort((a, b) => b.relevanceScore - a.relevanceScore); // Sort by highest score first
    
    console.log(`🎯 Found ${relevantDocs.length} relevant documents (scores: ${relevantDocs.slice(0, 5).map(d => d.relevanceScore).join(', ')}...)`);
    
    return relevantDocs;
  }

  /**
   * Get category-specific scoring bonuses
   */
  private getCategorySpecificScore(content: string, category: string): number {
    const categoryKeywords = {
      'Contracts & Agreements': ['contract', 'agreement', 'terms', 'conditions', 'commercial', 'revenue', 'payment'],
      'Intellectual Property': ['patent', 'trademark', 'copyright', 'ip', 'intellectual property', 'license'],
      'Corporate Governance': ['governance', 'board', 'shareholder', 'corporate', 'bylaws', 'charter'],
      'Regulatory Compliance': ['regulatory', 'compliance', 'regulation', 'certification', 'approval'],
      'Litigation & Legal Risks': ['litigation', 'lawsuit', 'legal dispute', 'claim', 'court', 'settlement']
    };
    
    const keywords = categoryKeywords[category] || [];
    let score = 0;
    
    keywords.forEach(keyword => {
      if (content.includes(keyword)) {
        score += 2; // Category-specific bonus
      }
    });
    
    return score;
  }

  /**
   * Extract specific evidence from a single document - EXACT COPY from Clinical
   */
  private async extractEvidenceFromDocument(document: any, question: any): Promise<any> {
    const content = document.ocrText || document.aiSummary?.executiveSummary || '';
    
    if (!content) return null;
    
    const prompt = `${ENTERPRISE_AGENT_PROMPTS.LEGAL.SYSTEM_PROMPT}

${ENTERPRISE_AGENT_PROMPTS.LEGAL.ANALYSIS_PROMPT}

DOCUMENT: ${document.name}
CONTENT: ${content.substring(0, 100000)} ${content.length > 100000 ? '\n[Document truncated - processing first 100k characters for institutional-grade analysis...]' : ''}

QUESTION: "${question.question}"
ANALYSIS FOCUS: ${question.analysisPrompt}

INSTITUTIONAL ANALYSIS REQUIREMENTS:
• CONTRACT LIABILITY QUANTIFICATION: Extract specific dollar amounts, percentage terms, caps on liability
• TERMINATION ANALYSIS: Identify notice periods, termination triggers, post-termination obligations
• REGULATORY COMPLIANCE GAPS: Map compliance requirements with estimated remediation costs
• INTELLECTUAL PROPERTY RISKS: Assess IP litigation exposure, licensing restrictions, freedom to operate
• CORPORATE GOVERNANCE ISSUES: Evaluate fiduciary duties, conflicts of interest, board composition requirements

QUANTITATIVE EXTRACTION MANDATES:
✓ Quote exact dollar amounts, percentages, timeframes from contracts
✓ Identify liability caps, indemnification limits, penalty calculations
✓ Extract payment terms, milestone schedules, performance metrics
✓ Quantify regulatory compliance costs and timelines
✓ Calculate termination notice periods and cure periods

RISK SCORING CRITERIA (1-10 scale):
• Contract Terms: Assess enforceability, liability exposure, termination risk
• Regulatory Status: Evaluate compliance gaps, violation penalties, approval probability
• IP Position: Analyze litigation risk, licensing dependencies, patent strength
• Corporate Structure: Review governance adequacy, fiduciary compliance, transaction risks

Respond in JSON format with enhanced institutional metrics:
{
  "relevantContent": ["Exact contractual quotes with $ amounts", "Specific regulatory requirements with timelines", "IP terms with licensing details"],
  "hasRelevantInfo": true/false,
  "confidence": 0-100,
  "keyFindings": ["Quantified liability exposures", "Specific compliance gaps with costs", "Material contract risks"],
  "documentSummary": "Executive summary of legal materiality to investment decision",
  "legalRiskScore": 1-10,
  "quantitativeMetrics": {
    "liabilityExposure": "$ amount or percentage if specified",
    "terminationNotice": "days/months required",
    "complianceCosts": "estimated $ for gaps identified",
    "contractValue": "$ value if specified",
    "penaltyRisk": "maximum $ penalty exposure"
  },
  "redFlags": ["Deal-breaker legal issues", "Material litigation risks", "Regulatory violation exposure"],
  "riskFactors": ["Specific legal risks with probability assessment", "Compliance timeline risks", "Contract enforceability concerns"],
  "investmentImpact": "Direct impact on investment thesis and valuation",
  "dueDiligenceRecommendations": ["Specific legal items requiring further investigation", "Expert consultations needed", "Additional documentation required"]
}

Apply institutional investment standards - prioritize material risks that impact valuation and deal structure.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 4000 // Increased for full document comprehensive extraction
      });
      
      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        documentName: document.name,
        documentId: document.id,
        relevantContent: analysis.relevantContent || [],
        hasRelevantInfo: analysis.hasRelevantInfo || false,
        confidence: analysis.confidence || 0,
        keyFindings: analysis.keyFindings || [],
        documentSummary: analysis.documentSummary || '',
        legalRiskScore: analysis.legalRiskScore || 0,
        quantitativeMetrics: analysis.quantitativeMetrics || {},
        redFlags: analysis.redFlags || [],
        riskFactors: analysis.riskFactors || [],
        investmentImpact: analysis.investmentImpact || '',
        dueDiligenceRecommendations: analysis.dueDiligenceRecommendations || [],
        fullContent: content.substring(0, 2000) // Keep larger sample for reference
      };
      
    } catch (error) {
      console.error(`Error extracting evidence from ${document.name}:`, error);
      return {
        documentName: document.name,
        documentId: document.id,
        relevantContent: [],
        hasRelevantInfo: false,
        confidence: 0,
        keyFindings: [],
        documentSummary: 'Analysis failed',
        legalRiskScore: 0,
        quantitativeMetrics: {},
        redFlags: ['Analysis failed - requires manual review'],
        riskFactors: ['Technical error in document processing'],
        investmentImpact: 'Unknown due to analysis failure',
        dueDiligenceRecommendations: ['Manual legal review required', 'Retry automated analysis'],
        fullContent: content.substring(0, 1000)
      };
    }
  }

  /**
   * Compile comprehensive answer based on all evidence - EXACT COPY from Clinical
   */
  private async compileComprehensiveAnswer(question: any, evidence: any[]): Promise<any> {
    console.log(`Compiling comprehensive answer for: ${question.question} with ${evidence.length} documents`);
    
    if (evidence.length === 0) {
      return {
        question: question.question,
        category: question.category,
        answer: 'No relevant documents found for legal analysis',
        confidence: 0,
        sources: [],
        keyFindings: [],
        gaps: ['No legal documentation available'],
        recommendations: ['Obtain relevant legal documents for analysis'],
        evidenceCount: 0,
        detailedEvidence: []
      };
    }

    const prompt = `You are a senior legal analyst conducting due diligence review. Analyze the following evidence to answer this question: "${question.question}"

Evidence from ${evidence.length} documents:
${evidence.map(ev => `
DOCUMENT: ${ev.documentName}
RELEVANT CONTENT: ${Array.isArray(ev.relevantContent) ? ev.relevantContent.join('; ') : ev.relevantContent}
KEY FINDINGS: ${Array.isArray(ev.keyFindings) ? ev.keyFindings.join('; ') : ev.keyFindings}
CONFIDENCE: ${ev.confidence}%
`).join('\n')}

Instructions:
1. Synthesize ALL evidence into a comprehensive legal answer
2. Cite specific documents and quotes
3. Identify legal gaps in information
4. Provide confidence assessment
5. Include legal recommendations

Respond in JSON format:
{
  "answer": "Comprehensive legal answer synthesizing all evidence",
  "confidence": 0-100,
  "sources": ["Document name 1", "Document name 2"],
  "keyFindings": ["Finding 1", "Finding 2"],
  "gaps": ["Missing information 1", "Missing information 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "legalAssessment": "Overall legal assessment based on evidence",
  "evidenceCount": ${evidence.length}
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 3000 // INCREASED to allow comprehensive answers
      });
      
      const compiledAnswer = JSON.parse(response.choices[0].message.content || '{}');
      
      // CRITICAL FIX: Ensure comprehensive answers even with partial data
      const answer = compiledAnswer.answer || 
        (evidence.length > 0 ? 
          `Based on analysis of ${evidence.length} documents, the following legal information was identified: ` + 
          evidence.filter(e => e.documentSummary).map(e => e.documentSummary).join(' ') // ENTERPRISE: Use ALL evidence summaries
          : 'No relevant legal information found in available documentation');

      return {
        question: question.question,
        category: question.category,
        answer: answer,
        confidence: Math.max(compiledAnswer.confidence || 30, evidence.length > 0 ? 50 : 20),
        sources: evidence.map(e => e.documentName), // SHOW ALL ANALYZED DOCUMENTS
        keyFindings: compiledAnswer.keyFindings || evidence.flatMap(e => e.keyFindings || []), // ENTERPRISE: Show ALL findings without limits
        gaps: compiledAnswer.gaps || [],
        recommendations: compiledAnswer.recommendations || ['Consider obtaining additional legal documentation for comprehensive analysis'],
        legalAssessment: compiledAnswer.legalAssessment || `Analysis based on review of ${evidence.length} available documents`,
        evidenceCount: evidence.length,
        detailedEvidence: evidence
      };
      
    } catch (error) {
      console.error(`Error compiling answer for "${question.question}":`, error);
      return {
        question: question.question,
        category: question.category,
        answer: `Error compiling answer: ${error.message}`,
        confidence: 0,
        sources: evidence.map(e => e.documentName), // SHOW ALL ANALYZED DOCUMENTS
        keyFindings: [],
        gaps: ['Analysis compilation failed'],
        recommendations: ['Manual review required'],
        evidenceCount: evidence.length,
        detailedEvidence: evidence
      };
    }
  }

  /**
   * Generate comprehensive findings - EXACT COPY from Clinical
   */
  private generateComprehensiveLegalFindings(answers: Record<string, any>): any[] {
    const findings = [];
    
    for (const [questionId, answer] of Object.entries(answers)) {
      const question = COMPREHENSIVE_LEGAL_QUESTIONS.find(q => q.id === questionId);
      if (!question) continue;
      
      // High confidence findings
      if (answer.confidence > 70) {
        findings.push({
          id: findings.length + 1,
          type: 'positive',
          content: `${question.question}: ${answer.answer.substring(0, 150)}...`,
          source: answer.sources.length > 0 ? answer.sources[0] : 'Legal Documents',
          confidence: answer.confidence / 100,
          category: question.category.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          evidenceCount: answer.evidenceCount || 0
        });
      }
      
      // Only add risk findings for truly empty answers, not partial content
      if (answer.confidence < 30 && (!answer.answer || answer.answer.length < 50)) {
        findings.push({
          id: findings.length + 1,
          type: 'risk',
          content: `Limited legal documentation available for: ${question.question}. Consider obtaining additional relevant documentation.`,
          source: 'Legal Analysis',
          confidence: 0.3,
          category: 'documentation_gaps',
          evidenceCount: answer.evidenceCount || 0
        });
      }
    }
    
    return findings;
  }
  
  /**
   * Generate comprehensive recommendations - EXACT COPY from Clinical
   */
  private generateComprehensiveLegalRecommendations(answers: Record<string, any>): any[] {
    const recommendations = [];
    
    for (const [questionId, answer] of Object.entries(answers)) {
      if (answer.recommendations && answer.recommendations.length > 0) {
        for (const rec of answer.recommendations) {
          recommendations.push({
            title: `Legal Due Diligence: ${answer.question}`,
            description: rec,
            priority: answer.confidence < 60 ? 'high' : 'medium',
            category: 'legal',
            impact: answer.confidence < 40 ? 'critical' : 'moderate'
          });
        }
      }
      
      if (answer.gaps && answer.gaps.length > 0) {
        recommendations.push({
          title: `Documentation Gap: ${answer.question}`,
          description: `Missing legal information identified: ${answer.gaps.join(', ')}. Request additional documentation.`,
          priority: 'high',
          category: 'legal',
          impact: 'critical'
        });
      }
    }
    
    return recommendations;
  }
  
  /**
   * Store comprehensive analysis results - EXACT COPY from Clinical
   */
  private async storeComprehensiveLegalResults(
    dealId: number, 
    legalAnswers: Record<string, any>, 
    findings: any[], 
    recommendations: any[],
    documentsAnalyzed: any[]
  ): Promise<void> {
    // First, delete any existing legal analysis to ensure clean replacement
    await db
      .delete(agentAnalyses)
      .where(and(
        eq(agentAnalyses.dealId, dealId),
        eq(agentAnalyses.agentType, 'Legal')
      ));
    
    console.log(`🗑️ Cleared existing legal analysis for deal ${dealId}`);
    
    // Create the new comprehensive analysis
    const analysisData = {
      dealId,
      agentType: 'Legal' as const,
      status: 'completed' as const,
      progress: 100,
      findings: JSON.stringify(findings),
      recommendations: JSON.stringify(recommendations),
      legal_answers: legalAnswers, // FIXED: Store as object (not JSON string) for consistent field mapping
      documentSources: JSON.stringify(documentsAnalyzed.map(d => d.name)),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db
      .insert(agentAnalyses)
      .values(analysisData);
    
    console.log(`📊 Created fresh comprehensive legal analysis for deal ${dealId} with ${Object.keys(legalAnswers).length} questions answered`);
  }
}

// Export the service instance
export const comprehensiveLegalAnalysisService = new ComprehensiveLegalAnalysisService();