/**
 * Comprehensive Legal Analysis Service
 * Analyzes ALL assigned legal documents systematically for each question
 * Extracts specific evidence from documents and compiles complete answers
 */

import { db } from './db';
import { documents, agentAnalyses } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { storage } from './storage';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Enhanced legal questions for comprehensive analysis
export const COMPREHENSIVE_LEGAL_QUESTIONS = [
  // Corporate Structure & Governance
  { 
    id: 'corporate_1', 
    question: 'What is the corporate structure and ownership?', 
    category: 'Corporate Structure & Governance',
    analysisPrompt: 'Identify corporate structure, ownership percentages, shareholder agreements, and governance frameworks.',
    keywords: ['corporate structure', 'ownership', 'shareholders', 'board of directors', 'governance', 'equity', 'shares', 'voting rights']
  },
  { 
    id: 'corporate_2', 
    question: 'Are there any board resolutions or governance issues?', 
    category: 'Corporate Structure & Governance',
    analysisPrompt: 'Find board resolutions, director appointments, governance policies, and any corporate governance concerns.',
    keywords: ['board resolution', 'board meeting', 'director', 'governance', 'corporate policy', 'fiduciary duty', 'conflicts of interest']
  },
  // Intellectual Property
  { 
    id: 'ip_1', 
    question: 'What intellectual property assets exist?', 
    category: 'Intellectual Property',
    analysisPrompt: 'Identify patents, trademarks, copyrights, trade secrets, and IP ownership status.',
    keywords: ['patent', 'trademark', 'copyright', 'trade secret', 'intellectual property', 'ip', 'proprietary', 'licensing']
  },
  { 
    id: 'ip_2', 
    question: 'Are there IP licensing agreements or disputes?', 
    category: 'Intellectual Property',
    analysisPrompt: 'Find IP licensing deals, royalty agreements, IP disputes, or infringement claims.',
    keywords: ['license agreement', 'licensing', 'royalty', 'ip dispute', 'infringement', 'patent litigation', 'trademark dispute']
  },
  // Contracts & Agreements
  { 
    id: 'contracts_1', 
    question: 'What are the key commercial contracts and terms?', 
    category: 'Contracts & Agreements',
    analysisPrompt: 'Analyze major commercial agreements, contract terms, revenue commitments, and obligations.',
    keywords: ['commercial agreement', 'contract', 'terms and conditions', 'service agreement', 'supply agreement', 'distribution']
  },
  { 
    id: 'contracts_2', 
    question: 'Are there any contract disputes or breaches?', 
    category: 'Contracts & Agreements',
    analysisPrompt: 'Identify contract disputes, breach claims, penalty clauses, or termination risks.',
    keywords: ['contract dispute', 'breach', 'default', 'penalty', 'termination', 'litigation', 'arbitration', 'dispute resolution']
  },
  // Regulatory & Compliance
  { 
    id: 'regulatory_1', 
    question: 'What regulatory approvals and compliance requirements exist?', 
    category: 'Regulatory & Compliance',
    analysisPrompt: 'Find regulatory licenses, compliance requirements, industry regulations, and approval status.',
    keywords: ['regulatory approval', 'license', 'permit', 'compliance', 'regulation', 'regulatory body', 'certification']
  },
  { 
    id: 'regulatory_2', 
    question: 'Are there any regulatory violations or investigations?', 
    category: 'Regulatory & Compliance',
    analysisPrompt: 'Identify regulatory violations, investigations, fines, or compliance issues.',
    keywords: ['regulatory violation', 'investigation', 'fine', 'penalty', 'compliance issue', 'regulatory action', 'enforcement']
  }
];

interface LegalEvidence {
  documentId: number;
  documentName: string;
  relevantText: string;
  confidence: number;
  keyFindings: string[];
}

interface LegalAnswer {
  question: string;
  answer: string;
  evidence: LegalEvidence[];
  keyFindings: string[];
  confidence: number;
}

class ComprehensiveLegalAnalysisService {
  /**
   * Analyze all legal documents for a deal
   */
  async analyzeLegalDocuments(dealId: number): Promise<void> {
    try {
      console.log(`🧬 Starting comprehensive legal analysis for deal ${dealId}`);
      
      // Get all documents for the deal
      const allDocuments = await storage.getDocumentsByDealId(dealId);
      
      // Filter for legal-relevant documents
      const legalDocuments = allDocuments.filter(doc => 
        doc.assignedAgents?.includes('Legal') ||
        doc.category?.toLowerCase() === 'legal' ||
        doc.documentType?.toLowerCase().includes('legal') ||
        doc.documentType?.toLowerCase().includes('contract') ||
        doc.documentType?.toLowerCase().includes('agreement') ||
        doc.name.toLowerCase().includes('contract') ||
        doc.name.toLowerCase().includes('agreement') ||
        doc.name.toLowerCase().includes('legal')
      );

      console.log(`📄 Found ${legalDocuments.length} legal documents to analyze`);

      const legalAnswers: Record<string, LegalAnswer> = {};

      // Process each legal question
      for (const question of COMPREHENSIVE_LEGAL_QUESTIONS) {
        console.log(`🔍 Processing legal question: ${question.question}`);
        
        const answer = await this.analyzeDocumentsForQuestion(
          legalDocuments,
          question,
          dealId
        );
        
        legalAnswers[question.id] = answer;
      }

      // Save comprehensive analysis
      await this.saveLegalAnalysis(dealId, legalAnswers);
      
      console.log(`✅ Comprehensive legal analysis completed for deal ${dealId}`);
      
    } catch (error) {
      console.error(`❌ Error in comprehensive legal analysis for deal ${dealId}:`, error);
      throw error;
    }
  }

  /**
   * Analyze documents for a specific legal question
   */
  private async analyzeDocumentsForQuestion(
    documents: any[],
    question: any,
    dealId: number
  ): Promise<LegalAnswer> {
    const evidence: LegalEvidence[] = [];
    
    // Process documents in batches
    const batchSize = 10;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(documents.length/batchSize)} (${batch.length} documents)`);
      
      for (const doc of batch) {
        if (!doc.aiSummary) continue;
        
        console.log(`🔎 Extracting evidence from: ${doc.name}`);
        
        const docEvidence = await this.extractEvidenceFromDocument(
          doc,
          question
        );
        
        if (docEvidence) {
          evidence.push(docEvidence);
        }
      }
    }

    // Compile final answer from all evidence
    const finalAnswer = await this.compileQuestionAnswer(question, evidence);
    
    console.log(`✅ Question "${question.question}" completed with ${evidence.length} pieces of evidence`);
    
    return finalAnswer;
  }

  /**
   * Extract evidence from a single document for a question
   */
  private async extractEvidenceFromDocument(
    document: any,
    question: any
  ): Promise<LegalEvidence | null> {
    try {
      if (!document.aiSummary) return null;

      // Check if document contains relevant keywords
      const textToAnalyze = `${document.name} ${document.aiSummary}`.toLowerCase();
      const hasRelevantKeywords = question.keywords.some(keyword => 
        textToAnalyze.includes(keyword.toLowerCase())
      );

      if (!hasRelevantKeywords) return null;

      const prompt = `
As a legal analyst, analyze this document for the following question:

QUESTION: ${question.question}
ANALYSIS FOCUS: ${question.analysisPrompt}

DOCUMENT: ${document.name}
CONTENT: ${document.aiSummary}

Extract specific legal evidence that answers the question. Focus on:
- Specific facts, terms, and provisions
- Legal implications and risks
- Contractual obligations or rights
- Regulatory requirements or compliance status

Provide your analysis in this JSON format:
{
  "hasRelevantInfo": boolean,
  "relevantText": "specific quotes or paraphrases from the document",
  "keyFindings": ["finding 1", "finding 2", "finding 3"],
  "confidence": number (0-100),
  "legalImplications": "summary of legal implications"
}
`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      if (!analysis.hasRelevantInfo) return null;

      return {
        documentId: document.id,
        documentName: document.name,
        relevantText: analysis.relevantText,
        keyFindings: analysis.keyFindings || [],
        confidence: analysis.confidence || 50
      };

    } catch (error) {
      console.error(`Error extracting evidence from document ${document.name}:`, error);
      return null;
    }
  }

  /**
   * Compile final answer from all evidence
   */
  private async compileQuestionAnswer(
    question: any,
    evidence: LegalEvidence[]
  ): Promise<LegalAnswer> {
    if (evidence.length === 0) {
      return {
        question: question.question,
        answer: "No relevant legal information found in the analyzed documents.",
        evidence: [],
        keyFindings: [],
        confidence: 0
      };
    }

    try {
      const evidenceText = evidence.map(e => 
        `Document: ${e.documentName}\nFindings: ${e.keyFindings.join(', ')}\nText: ${e.relevantText}`
      ).join('\n\n');

      const prompt = `
As a senior legal analyst, synthesize the following evidence to answer this legal question:

QUESTION: ${question.question}
CATEGORY: ${question.category}

EVIDENCE FROM DOCUMENTS:
${evidenceText}

Provide a comprehensive legal analysis in this JSON format:
{
  "answer": "detailed answer incorporating all relevant evidence",
  "keyFindings": ["key finding 1", "key finding 2", "key finding 3"],
  "legalRisks": ["risk 1", "risk 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "confidence": number (0-100)
}

Focus on:
- Legal accuracy and completeness
- Risk identification and assessment
- Practical implications for the business
- Regulatory compliance considerations
`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1500
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');

      return {
        question: question.question,
        answer: analysis.answer || "Analysis could not be completed.",
        evidence,
        keyFindings: analysis.keyFindings || [],
        confidence: analysis.confidence || 50
      };

    } catch (error) {
      console.error(`Error compiling answer for question ${question.question}:`, error);
      
      // Fallback answer
      const keyFindings = evidence.flatMap(e => e.keyFindings).slice(0, 5);
      
      return {
        question: question.question,
        answer: `Based on analysis of ${evidence.length} documents, key findings include: ${keyFindings.join(', ')}`,
        evidence,
        keyFindings,
        confidence: 60
      };
    }
  }

  /**
   * Save legal analysis to database
   */
  private async saveLegalAnalysis(
    dealId: number,
    legalAnswers: Record<string, LegalAnswer>
  ): Promise<void> {
    try {
      // Generate summary findings and recommendations
      const allFindings = Object.values(legalAnswers).flatMap(a => a.keyFindings);
      const findings = allFindings.slice(0, 15); // Top 15 findings
      
      const recommendations = [
        "Review all identified legal risks with legal counsel",
        "Ensure regulatory compliance requirements are met",
        "Validate IP ownership and licensing agreements",
        "Assess contract terms and potential dispute risks"
      ];

      const analysisData = {
        dealId,
        agentType: 'Legal' as const,
        status: 'completed' as const,
        findings,
        recommendations,
        riskLevel: 'medium' as const,
        completedAt: new Date(),
        legalAnswers,
        confidence: Math.round(
          Object.values(legalAnswers).reduce((sum, a) => sum + a.confidence, 0) / 
          Object.values(legalAnswers).length
        )
      };

      // Check if analysis already exists
      const existingAnalysis = await storage.getAgentAnalysis(dealId, 'Legal');
      if (existingAnalysis) {
        await storage.updateAgentAnalysis(existingAnalysis.id, analysisData);
      } else {
        await storage.createAgentAnalysis(analysisData);
      }
      
      console.log(`✅ Saved legal analysis for deal ${dealId} with ${Object.keys(legalAnswers).length} questions`);
      
    } catch (error) {
      console.error(`❌ Error saving legal analysis for deal ${dealId}:`, error);
      throw error;
    }
  }
}

export const comprehensiveLegalAnalysisService = new ComprehensiveLegalAnalysisService();