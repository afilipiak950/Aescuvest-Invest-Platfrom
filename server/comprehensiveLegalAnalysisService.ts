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
  {
    id: 'sha_1',
    category: 'Shareholders Agreement / Articles of Association',
    question: 'What class of shares exist?',
    analysisPrompt: 'Identify all types of shares mentioned in this document. Look for: common shares, preferred shares, class A/B shares, voting rights, non-voting shares, etc.'
  },
  {
    id: 'sha_2',
    category: 'Shareholders Agreement / Articles of Association',
    question: 'Are liquidation preferences defined?',
    analysisPrompt: 'Find any mentions of liquidation preferences, distribution priorities, liquidation multiples, participation rights, or liquidation procedures.'
  },
  {
    id: 'sha_3',
    category: 'Shareholders Agreement / Articles of Association',
    question: 'Is anti-dilution protection present?',
    analysisPrompt: 'Look for anti-dilution provisions, weighted average adjustments, full ratchet protection, or price adjustment mechanisms.'
  },
  {
    id: 'gov_1',
    category: 'Governance & Voting',
    question: 'Is board composition defined?',
    analysisPrompt: 'Identify board structure, number of directors, appointment procedures, investor representation, and board meeting requirements.'
  },
  {
    id: 'gov_2',
    category: 'Governance & Voting',
    question: 'Are voting rights clearly specified?',
    analysisPrompt: 'Find voting procedures, majority requirements, veto rights, consent requirements, and shareholder voting agreements.'
  },
  {
    id: 'ip_1',
    category: 'IP Assignment & Key Personnel',
    question: 'Are IP assignment agreements in place?',
    analysisPrompt: 'Look for intellectual property assignments, invention assignments, work-for-hire clauses, and IP ownership provisions.'
  },
  {
    id: 'ip_2',
    category: 'IP Assignment & Key Personnel',
    question: 'Are all founders/key personnel covered?',
    analysisPrompt: 'Identify which founders and key employees have signed IP assignments, employment agreements, or confidentiality agreements.'
  },
  {
    id: 'commercial_1',
    category: 'Commercial Agreements',
    question: 'Are SLAs, warranties, and indemnity clauses present?',
    analysisPrompt: 'Find service level agreements, warranty provisions, indemnification clauses, and liability limitations in commercial contracts.'
  },
  {
    id: 'commercial_2',
    category: 'Commercial Agreements',
    question: 'Are termination clauses fair and mutual?',
    analysisPrompt: 'Analyze termination provisions, notice periods, breach conditions, cure periods, and post-termination obligations.'
  },
  {
    id: 'lit_1',
    category: 'Litigation & Regulatory',
    question: 'Are there pending litigations or regulatory proceedings?',
    analysisPrompt: 'Look for mentions of lawsuits, disputes, regulatory investigations, compliance issues, or legal proceedings.'
  },
  {
    id: 'lit_2',
    category: 'Litigation & Regulatory',
    question: 'Is financial exposure quantified?',
    analysisPrompt: 'Find any quantification of legal costs, potential damages, settlement amounts, or financial exposure from legal matters.'
  },
  {
    id: 'reg_1',
    category: 'Regulatory Compliance',
    question: 'Are there FDA submissions or regulatory approvals?',
    analysisPrompt: 'Identify FDA submissions, regulatory approvals, licenses, permits, or compliance certifications.'
  },
  {
    id: 'reg_2',
    category: 'Regulatory Compliance',
    question: 'Are there any regulatory compliance issues?',
    analysisPrompt: 'Look for compliance violations, regulatory warnings, audit findings, or non-compliance issues.'
  },
  {
    id: 'financial_1',
    category: 'Financial Instruments',
    question: 'Are there warrants or convertible instruments?',
    analysisPrompt: 'Find warrants, convertible notes, convertible preferred shares, or other convertible securities.'
  },
  {
    id: 'financial_2',
    category: 'Financial Instruments',
    question: 'What are the interest rates and maturity for debt instruments?',
    analysisPrompt: 'Identify interest rates, maturity dates, conversion terms, and payment schedules for debt instruments.'
  }
];

export class ComprehensiveLegalAnalysisService {
  
  /**
   * Run comprehensive analysis for all assigned legal documents
   */
  async runComprehensiveAnalysis(dealId: number, storageService: any): Promise<any> {
    console.log(`🚀 Starting comprehensive legal analysis for deal ${dealId}`);
    
    // Create background job for progress tracking
    const jobId = `legal_analysis_${dealId}_${Date.now()}`;
    await storageService.createBackgroundJob({
      jobId,
      jobType: 'comprehensive_legal_analysis',
      dealId,
      agentType: 'Legal',
      status: 'processing',
      progress: 0,
      totalDocuments: 0,
      processedDocuments: 0,
      startedAt: new Date()
    });
    
    // Get all documents suitable for legal analysis
    const assignedDocuments = await this.getAssignedLegalDocuments(dealId);
    console.log(`📄 Found ${assignedDocuments.length} documents suitable for legal analysis`);
    
    if (assignedDocuments.length === 0) {
      await storageService.updateBackgroundJob(jobId, {
        status: 'completed',
        progress: 100,
        error: 'No documents available for legal analysis'
      });
      throw new Error('No documents available for legal analysis');
    }
    
    // Update job with total questions to process
    await storageService.updateBackgroundJob(jobId, {
      totalDocuments: COMPREHENSIVE_LEGAL_QUESTIONS.length,
      currentStep: 'Analyzing legal documents across 15 question categories'
    });
    
    // Process each question comprehensively
    const legalAnswers: Record<string, any> = {};
    
    for (let i = 0; i < COMPREHENSIVE_LEGAL_QUESTIONS.length; i++) {
      const question = COMPREHENSIVE_LEGAL_QUESTIONS[i];
      console.log(`🔍 Processing: ${question.question}`);
      
      // Update progress
      const progress = Math.round((i / COMPREHENSIVE_LEGAL_QUESTIONS.length) * 100);
      await storageService.updateBackgroundJob(jobId, {
        progress,
        processedDocuments: i,
        currentDocumentName: question.question,
        currentStep: `Analyzing: ${question.category}`
      });
      
      // Extract evidence from ALL assigned documents for this question
      const documentEvidence = await this.extractEvidenceFromAllDocuments(
        assignedDocuments, 
        question
      );
      
      // Compile comprehensive answer based on all evidence
      const answer = await this.compileComprehensiveAnswer(question, documentEvidence);
      legalAnswers[question.id] = answer;
      
      console.log(`✅ Completed: ${question.question}`);
      
      // Brief delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    // Update progress to completion
    await storageService.updateBackgroundJob(jobId, {
      progress: 100,
      processedDocuments: COMPREHENSIVE_LEGAL_QUESTIONS.length,
      currentStep: 'Generating findings and recommendations',
      status: 'completing'
    });
    
    // Generate comprehensive findings and recommendations
    const findings = this.generateComprehensiveFindings(legalAnswers);
    const recommendations = this.generateComprehensiveRecommendations(legalAnswers);
    
    // Store the analysis results
    await this.storeComprehensiveResults(dealId, legalAnswers, findings, recommendations, assignedDocuments);
    
    // Mark job as completed
    await storageService.updateBackgroundJob(jobId, {
      status: 'completed',
      currentStep: 'Analysis completed'
    });
    
    console.log(`✅ Comprehensive legal analysis completed for deal ${dealId}`);
    
    return {
      success: true,
      documentsAnalyzed: assignedDocuments.length,
      questionsAnswered: Object.keys(legalAnswers).length,
      findings: findings.length,
      recommendations: recommendations.length
    };
  }
  
  /**
   * Get all documents suitable for legal analysis
   */
  private async getAssignedLegalDocuments(dealId: number): Promise<any[]> {
    const allDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, dealId));
    
    console.log(`📄 Total documents found for deal ${dealId}: ${allDocuments.length}`);
    
    // First try documents explicitly assigned to legal agent
    let legalDocuments = allDocuments.filter(doc => 
      (doc.assignedAgents && doc.assignedAgents.includes('legal')) && 
      (doc.ocrText || doc.aiSummary)
    );
    
    console.log(`📄 Documents explicitly assigned to legal: ${legalDocuments.length}`);
    
    // If no documents are explicitly assigned to legal, identify legal-related documents
    if (legalDocuments.length === 0) {
      console.log('📄 No documents explicitly assigned to legal agent, identifying legal-related documents...');
      
      legalDocuments = allDocuments.filter(doc => {
        if (!doc.ocrText && !doc.aiSummary) return false;
        
        const docName = doc.name.toLowerCase();
        const docContent = (doc.ocrText || '').toLowerCase();
        const aiSummary = doc.aiSummary;
        
        // Legal document keywords
        const legalKeywords = [
          'contract', 'agreement', 'legal', 'license', 'patent', 'trademark', 
          'copyright', 'litigation', 'compliance', 'regulatory', 'terms', 
          'conditions', 'confidential', 'nda', 'employment', 'consulting', 
          'executed', 'signed', 'shareholder', 'investor', 'funding', 
          'liquidation', 'preference', 'anti-dilution', 'voting', 'board',
          'ip assignment', 'intellectual property', 'governance', 'bylaws',
          'articles', 'incorporation', 'memorandum', 'constitution'
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
    
    return legalDocuments;
  }
  
  /**
   * Extract evidence from ALL documents for a specific question
   */
  private async extractEvidenceFromAllDocuments(
    documents: any[], 
    question: any
  ): Promise<any[]> {
    const evidence = [];
    
    for (const doc of documents) {
      console.log(`🔎 Extracting evidence from: ${doc.name}`);
      
      const docEvidence = await this.extractEvidenceFromDocument(doc, question);
      if (docEvidence && docEvidence.relevantContent.length > 0) {
        evidence.push(docEvidence);
      }
    }
    
    console.log(`📋 Extracted evidence from ${evidence.length}/${documents.length} documents`);
    return evidence;
  }
  
  /**
   * Extract specific evidence from a single document
   */
  private async extractEvidenceFromDocument(document: any, question: any): Promise<any> {
    const content = document.ocrText || document.aiSummary?.executiveSummary || '';
    
    if (!content) return null;
    
    const prompt = `You are a legal document analyst. Analyze this document for specific information.

DOCUMENT: ${document.name}
CONTENT: ${content.substring(0, 4000)}

ANALYSIS TASK: ${question.analysisPrompt}

Extract specific evidence that answers the question: "${question.question}"

Respond in JSON format:
{
  "relevantContent": ["Exact quote 1 from document", "Exact quote 2 from document"],
  "hasRelevantInfo": true/false,
  "confidence": 0-100,
  "keyFindings": ["Finding 1", "Finding 2"],
  "documentSummary": "Brief summary of what this document contains relevant to the question"
}

Only extract actual content from the document. If no relevant information is found, set hasRelevantInfo to false.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 1500
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
        fullContent: content.substring(0, 1000) // Keep sample for reference
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
        fullContent: content.substring(0, 1000)
      };
    }
  }
  
  /**
   * Compile comprehensive answer based on all evidence
   */
  private async compileComprehensiveAnswer(question: any, evidence: any[]): Promise<any> {
    if (evidence.length === 0) {
      return {
        question: question.question,
        answer: `No relevant information found in the assigned legal documents for this question.`,
        confidence: 10,
        sources: [],
        evidenceCount: 0,
        documentsCovered: 0
      };
    }
    
    // Filter evidence with relevant information
    const relevantEvidence = evidence.filter(e => e.hasRelevantInfo);
    
    const prompt = `You are a senior legal analyst compiling a comprehensive answer based on evidence from multiple documents.

QUESTION: ${question.question}
CATEGORY: ${question.category}

EVIDENCE FROM DOCUMENTS:
${relevantEvidence.map((ev, idx) => `
Document ${idx + 1}: ${ev.documentName}
Key Findings: ${ev.keyFindings.join('; ')}
Relevant Content: ${ev.relevantContent.join(' | ')}
Document Summary: ${ev.documentSummary}
Confidence: ${ev.confidence}%
`).join('\n')}

Based on ALL the evidence above, provide a comprehensive legal analysis:

1. Synthesize information from all documents
2. Provide a complete answer to the question
3. Identify which specific documents support each part of your answer
4. Assess overall confidence based on the quality and consistency of evidence
5. Note any conflicts or gaps in the information

Respond in JSON format:
{
  "answer": "Comprehensive answer synthesizing all evidence",
  "confidence": 0-100,
  "sources": ["Document1.pdf", "Document2.pdf"],
  "keyFindings": ["Finding 1", "Finding 2"],
  "evidenceSummary": "Summary of the evidence found",
  "gaps": ["Gap 1", "Gap 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2000
      });
      
      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        question: question.question,
        answer: analysis.answer || 'Unable to compile comprehensive answer',
        confidence: analysis.confidence || 50,
        sources: relevantEvidence.map(e => e.documentName),
        keyFindings: analysis.keyFindings || [],
        evidenceSummary: analysis.evidenceSummary || '',
        gaps: analysis.gaps || [],
        recommendations: analysis.recommendations || [],
        evidenceCount: relevantEvidence.length,
        documentsCovered: evidence.length,
        detailedEvidence: relevantEvidence
      };
      
    } catch (error) {
      console.error(`Error compiling answer for ${question.id}:`, error);
      return {
        question: question.question,
        answer: `Analysis temporarily unavailable. Please try again.`,
        confidence: 10,
        sources: relevantEvidence.map(e => e.documentName),
        evidenceCount: relevantEvidence.length,
        documentsCovered: evidence.length
      };
    }
  }
  
  /**
   * Generate comprehensive findings
   */
  private generateComprehensiveFindings(answers: Record<string, any>): any[] {
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
      
      // Risk findings for low confidence or gaps
      if (answer.confidence < 50 || (answer.gaps && answer.gaps.length > 0)) {
        findings.push({
          id: findings.length + 1,
          type: 'risk',
          content: `Insufficient information for: ${question.question}. Additional documentation may be required.`,
          source: 'Legal Analysis',
          confidence: 0.3,
          category: 'gaps',
          evidenceCount: answer.evidenceCount || 0
        });
      }
    }
    
    return findings;
  }
  
  /**
   * Generate comprehensive recommendations
   */
  private generateComprehensiveRecommendations(answers: Record<string, any>): any[] {
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
          description: `Missing information identified: ${answer.gaps.join(', ')}. Request additional documentation.`,
          priority: 'high',
          category: 'legal',
          impact: 'critical'
        });
      }
    }
    
    return recommendations;
  }
  
  /**
   * Store comprehensive analysis results
   */
  private async storeComprehensiveResults(
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
        eq(agentAnalyses.agentType, 'legal')
      ));
    
    console.log(`🗑️ Cleared existing legal analysis for deal ${dealId}`);
    
    // Create the new comprehensive analysis
    const analysisData = {
      dealId,
      agentType: 'legal' as const,
      status: 'completed' as const,
      progress: 100,
      findings: JSON.stringify(findings),
      recommendations: JSON.stringify(recommendations),
      legalAnswers: JSON.stringify(legalAnswers),
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