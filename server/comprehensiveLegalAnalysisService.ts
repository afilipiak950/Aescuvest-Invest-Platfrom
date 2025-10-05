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
}

class ComprehensiveLegalAnalysisService {
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
            new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI analysis timeout')), 60000)) // 60 second timeout
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
  
  // Progress tracking for individual question reruns
  public questionRerunProgress: Map<string, number> = new Map();
  
  /**
   * Get progress for a specific question rerun
   */
  getQuestionRerunProgress(dealId: number, questionId: string): number {
    const key = `${dealId}-${questionId}`;
    return this.questionRerunProgress.get(key) || 0;
  }
  
  /**
   * Update progress for a specific question rerun
   */
  public updateQuestionRerunProgress(dealId: number, questionId: string, progress: number): void {
    const key = `${dealId}-${questionId}`;
    this.questionRerunProgress.set(key, progress);
    console.log(`📊 Progress update: ${questionId} = ${progress}%`);
  }
  
  /**
   * Get all active question progress for a deal
   */
  getAllQuestionProgress(dealId: number): Record<string, number> {
    const dealPrefix = `${dealId}-`;
    const result: Record<string, number> = {};
    
    // Convert iterator to array to avoid downlevelIteration issues
    const entries = Array.from(this.questionRerunProgress.entries());
    for (const [key, progress] of entries) {
      if (key.startsWith(dealPrefix)) {
        const questionId = key.substring(dealPrefix.length);
        result[questionId] = progress;
      }
    }
    
    return result;
  }
  
  /**
   * Check if a question is currently being rerun
   */
  isQuestionRunning(dealId: number, questionId: string): boolean {
    const key = `${dealId}-${questionId}`;
    const progress = this.questionRerunProgress.get(key);
    // Consider it running if progress exists and is not 100
    return progress !== undefined && progress < 100;
  }
  
  /**
   * Re-run a single legal question analysis
   * Useful for retrying failed/timeout questions without re-running entire analysis
   */
  async rerunSingleQuestion(dealId: number, questionId: string): Promise<any> {
    console.log(`🔄 Re-running single legal question ${questionId} for deal ${dealId}`);
    const progressKey = `${dealId}-${questionId}`;
    
    // Check if already initialized by route (atomic registration pattern)
    const alreadyInitialized = this.questionRerunProgress.has(progressKey);
    
    // Only check for duplicates if not already initialized
    if (!alreadyInitialized && this.isQuestionRunning(dealId, questionId)) {
      throw new Error(`Question ${questionId} is already being rerun`);
    }
    
    try {
      // Initialize progress only if not already set by route
      if (!alreadyInitialized) {
        this.updateQuestionRerunProgress(dealId, questionId, 0);
      }
      
      // Find the question
      const question = COMPREHENSIVE_LEGAL_QUESTIONS.find(q => q.id === questionId);
      if (!question) {
        throw new Error(`Question ${questionId} not found`);
      }
      this.updateQuestionRerunProgress(dealId, questionId, 10);
      
      // Get legal documents
      const assignedDocuments = await this.getAssignedLegalDocuments(dealId);
      console.log(`📄 Found ${assignedDocuments.length} documents for question re-run`);
      
      if (assignedDocuments.length === 0) {
        throw new Error('No documents available for legal analysis');
      }
      this.updateQuestionRerunProgress(dealId, questionId, 20);
      
      // Extract evidence for this specific question
      console.log(`📊 Extracting evidence for: ${question.question}`);
      this.updateQuestionRerunProgress(dealId, questionId, 30);
      
      const documentEvidence = await this.extractEvidenceFromAllDocuments(
        assignedDocuments, 
        question
      );
      console.log(`📊 Evidence extraction completed: ${documentEvidence.length} pieces of evidence`);
      this.updateQuestionRerunProgress(dealId, questionId, 60);
      
      // Compile answer
      console.log(`🤖 Compiling answer for: ${question.question}`);
      this.updateQuestionRerunProgress(dealId, questionId, 70);
      
      const answer = await this.compileComprehensiveAnswer(question, documentEvidence);
      console.log(`✅ Answer compiled successfully`);
      this.updateQuestionRerunProgress(dealId, questionId, 85);
      
      // Get existing analysis to update
      const existingAnalysis = await storage.getAgentAnalysis(dealId, 'Legal');
      if (!existingAnalysis) {
        throw new Error('No existing legal analysis found. Run full analysis first.');
      }
      
      // Update only this question's answer in the legal analysis
      const updatedLegalAnswers = {
        ...existingAnalysis.legalAnswers,
        [questionId]: answer
      };
      
      // Regenerate findings and recommendations with updated answers
      const findings = this.generateComprehensiveLegalFindings(updatedLegalAnswers);
      const recommendations = this.generateComprehensiveLegalRecommendations(updatedLegalAnswers);
      this.updateQuestionRerunProgress(dealId, questionId, 95);
      
      // Update the database with new answer
      await this.storeComprehensiveLegalResults(
        dealId, 
        updatedLegalAnswers, 
        findings, 
        recommendations, 
        assignedDocuments
      );
      
      console.log(`✅ Successfully updated question ${questionId} in legal analysis`);
      this.updateQuestionRerunProgress(dealId, questionId, 100);
      
      return answer;
    } catch (error) {
      console.error(`❌ Error re-running question ${questionId}:`, error);
      throw error;
    } finally {
      // Clean up progress after 5 seconds (for both success and error)
      setTimeout(() => {
        this.questionRerunProgress.delete(progressKey);
        console.log(`🧹 Cleaned up progress tracking for question ${questionId}`);
      }, 5000);
    }
  }
  
  /**
   * Get all documents suitable for legal analysis - AI SUMMARY ONLY VERSION
   * Uses ONLY AI summaries (not OCR) and processes ALL documents (no 50 doc limit)
   */
  private async getAssignedLegalDocuments(dealId: number): Promise<any[]> {
    const allDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, dealId));
    
    console.log(`📄 Total documents found for deal ${dealId}: ${allDocuments.length}`);
    
    // First try documents explicitly assigned to legal agent - AI SUMMARY ONLY
    let legalDocuments = allDocuments.filter(doc => 
      (doc.assignedAgents && doc.assignedAgents.includes('Legal')) && 
      doc.aiSummary  // ONLY documents with AI summaries
    );
    
    console.log(`📄 Documents explicitly assigned to legal (with AI summaries): ${legalDocuments.length}`);
    
    // If no documents are explicitly assigned to legal, identify legal-related documents
    if (legalDocuments.length === 0) {
      console.log('📄 No documents explicitly assigned to legal agent, identifying legal-related documents...');
      
      legalDocuments = allDocuments.filter(doc => {
        if (!doc.aiSummary) return false;  // ONLY AI summaries
        
        const docName = doc.name.toLowerCase();
        const aiSummary = doc.aiSummary;
        
        // Legal document keywords - AI summary based identification
        const legalKeywords = [
          'legal', 'contract', 'agreement', 'license', 'patent', 'trademark', 'copyright',
          'litigation', 'lawsuit', 'compliance', 'regulatory', 'governance', 'corporate',
          'shareholder', 'board', 'bylaws', 'charter', 'liability', 'indemnification',
          'intellectual property', 'ip', 'employment', 'nda', 'confidentiality',
          'terms of service', 'privacy policy', 'data protection', 'gdpr'
        ];
        
        // Check document name for legal keywords
        const hasLegalKeywords = legalKeywords.some(keyword => 
          docName.includes(keyword)
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
    
    // If still no legal documents, use ALL documents with AI summaries
    if (legalDocuments.length === 0) {
      console.log('📄 No legal-related documents found, using ALL documents with AI summaries...');
      legalDocuments = allDocuments.filter(doc => doc.aiSummary);
      console.log(`📄 Documents with AI summaries available: ${legalDocuments.length}`);
    }
    
    // NO DOCUMENT LIMIT - Process ALL documents with AI summaries
    console.log(`📄 Processing ALL ${legalDocuments.length} documents with AI summaries for comprehensive legal analysis`);
    
    return legalDocuments;
  }
  
  /**
   * Extract evidence from ALL documents for a specific question - EXACT COPY from Clinical
   */
  private async extractEvidenceFromAllDocuments(
    documents: any[], 
    question: any
  ): Promise<any[]> {
    console.log(`📄 Starting evidence extraction from ${documents.length} documents for: ${question.question}`);
    
    // Process documents in batches to avoid overwhelming the system - EXACT Clinical approach
    const batchSize = 10;
    const evidence = [];
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)} (${batch.length} documents)`);
      
      const batchResults = await Promise.all(
        batch.map(async (doc) => {
          console.log(`🔎 Extracting evidence from: ${doc.name}`);
          return this.extractEvidenceFromDocument(doc, question);
        })
      );
      
      // Filter out null results and add to evidence - EXACT Clinical approach
      const validEvidence = batchResults.filter(docEvidence => 
        docEvidence && docEvidence.relevantContent.length > 0
      );
      evidence.push(...validEvidence);
      
      console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} completed: ${validEvidence.length}/${batch.length} documents had relevant evidence`);
    }
    
    console.log(`📋 Extracted evidence from ${evidence.length}/${documents.length} documents`);
    return evidence;
  }

  /**
   * Extract specific evidence from a single document - AI SUMMARY ONLY VERSION
   */
  private async extractEvidenceFromDocument(document: any, question: any): Promise<any> {
    // Use ONLY AI summary - combine ALL fields for complete context
    const aiSummary = document.aiSummary;
    if (!aiSummary) return null;
    
    const content = [
      aiSummary.executiveSummary || '',
      aiSummary.documentType ? `Document Type: ${aiSummary.documentType}` : '',
      aiSummary.criticalFindings?.length ? `Critical Findings: ${aiSummary.criticalFindings.join('; ')}` : '',
      aiSummary.keyFinancialData?.length ? `Financial Data: ${aiSummary.keyFinancialData.join('; ')}` : '',
      aiSummary.riskAssessment?.length ? `Risk Assessment: ${aiSummary.riskAssessment.join('; ')}` : '',
      aiSummary.neutralFindings?.length ? `Neutral Findings: ${aiSummary.neutralFindings.join('; ')}` : '',
      aiSummary.strategicImplications || ''
    ].filter(s => s).join('\n\n');
    
    if (!content) return null;
    
    const prompt = `You are an expert legal analyst conducting comprehensive investment analysis. Your task is to EXHAUSTIVELY EXTRACT ALL SPECIFIC DETAILS from this document.

DOCUMENT: ${document.name}
AI SUMMARY (COMPLETE): ${content}

QUESTION: "${question.question}"
ANALYSIS TASK: ${question.analysisPrompt}

CRITICAL EXTRACTION REQUIREMENTS - YOU MUST EXTRACT EVERY DETAIL:

1. EXTRACT SPECIFIC NUMBERS & AMOUNTS:
   - Payment amounts (e.g., "$50,000 annual fee", "4,000 warrants at $18.0777")
   - Vesting schedules (e.g., "333 warrants quarterly over 36 months")
   - Percentages (e.g., "15% commission", "51% ownership")
   - Deadlines and dates (e.g., "Due by Q4 2024", "Signed January 15, 2023")

2. EXTRACT COMPLETE CONTRACTUAL TERMS:
   - Party names (EXACT legal entity names, not abbreviations)
   - All payment structures (base + milestone + equity + warrants)
   - All deliverables and performance obligations
   - Termination clauses (notice periods, conditions, penalties)
   - Intellectual property terms (what's licensed, exclusive vs non-exclusive)
   - Liability limits and indemnification caps
   - Governing law and jurisdiction

3. EXTRACT COMPLIANCE & REGULATORY DETAILS:
   - Specific regulations referenced (e.g., "FDA 510(k)", "ISO 13485")
   - Compliance requirements and deadlines
   - Regulatory approvals obtained or pending
   - Audit rights and inspection provisions

4. DO NOT PARAPHRASE - COPY VERBATIM:
   - If the summary says "4,000 warrants at $18.0777", copy it EXACTLY
   - If it says "Vesting 333 every 3 months", copy it EXACTLY
   - Do NOT convert to summaries like "stock-based compensation" or "vesting schedule"

5. EXTRACT EVERYTHING RELEVANT:
   - If this document mentions contracts, extract EVERY contract detail
   - If it mentions payments, extract EVERY payment amount
   - If it mentions dates, extract EVERY date
   - Include ALL parties, ALL amounts, ALL deadlines

Your relevantContent array should contain 5-20+ detailed extractions per document (not 1-2 generic quotes).

Respond in JSON format:
{
  "relevantContent": ["DETAILED extraction 1 with specific amounts and dates", "DETAILED extraction 2 with party names and terms", "DETAILED extraction 3...", ...],
  "hasRelevantInfo": true/false,
  "confidence": 0-100,
  "keyFindings": ["Specific finding with amounts", "Specific finding with dates", ...],
  "documentSummary": "COMPREHENSIVE breakdown of ALL relevant information from this document",
  "legalContext": "How this document relates to legal/regulatory aspects with SPECIFIC details"
}

REMEMBER: Extract EVERYTHING - more is better! A thorough extraction should be 500-2000+ characters per document.`;

    try {
      // Add 60-second timeout for OpenAI calls
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI API timeout after 60s')), 60000)
      );
      
      const apiPromise = openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 8000 // INCREASED: Prevent any truncation of evidence extraction
      });
      
      const response = await Promise.race([apiPromise, timeoutPromise]) as any;
      
      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        documentName: document.name,
        documentId: document.id,
        relevantContent: analysis.relevantContent || [],
        hasRelevantInfo: analysis.hasRelevantInfo || false,
        confidence: analysis.confidence || 0,
        keyFindings: analysis.keyFindings || [],
        documentSummary: analysis.documentSummary || '',
        fullContent: content // Keep full AI summary for reference
      };
      
    } catch (error) {
      console.error(`Error extracting evidence from ${document.name}:`, error);
      // Return partial data even on timeout - use AI summary directly
      return {
        documentName: document.name,
        documentId: document.id,
        relevantContent: [content.substring(0, 500)], // Use first 500 chars of AI summary as fallback
        hasRelevantInfo: true,
        confidence: 50,
        keyFindings: ['Partial analysis - timeout occurred'],
        documentSummary: 'Analysis timeout - using AI summary excerpt',
        fullContent: content || ''
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

CRITICAL INSTRUCTIONS - YOU MUST EXTRACT EVERY SPECIFIC DETAIL:
1. EXTRACT GRANULAR CONTRACT DETAILS: For every contract mentioned, extract:
   - Exact payment amounts (e.g., "$50,000 per year", "4,000 warrants at $18.0777")
   - Specific vesting schedules (e.g., "333 warrants every 3 months over 36 months")
   - Precise dates and deadlines (e.g., "Agreement dated June 15, 2023")
   - Exact deliverables and milestones (e.g., "Phase 1: System design by Q1 2024")
   - Specific termination clauses and notice periods (e.g., "90 days written notice required")
   - Exact liability limits (e.g., "Limited to $1M per incident, $3M aggregate")
   - Precise intellectual property terms (e.g., "Exclusive license to Field A, non-exclusive to Field B")

2. COMPREHENSIVE BREAKDOWN BY DOCUMENT: For each document, provide a complete breakdown:
   - Document name and date
   - All parties involved with exact legal names
   - Complete payment structures (base fees, milestones, equity, warrants, stock options)
   - All key obligations of each party
   - All rights granted or restricted
   - All termination and renewal provisions

3. DO NOT SUMMARIZE - EXTRACT VERBATIM DETAILS:
   - Instead of "advisory agreements with stock compensation", write:
     "Dan Ginzburg Advisory Agreement (May 2, 2022): 4,000 warrants at $18.0777 per share, vesting 333 warrants quarterly over 36 months; Rhonda Binda Advisory Agreement (Oct 18, 2020): [specific terms]"
   - Instead of "distribution agreement with commercial terms", write:
     "Artech Distribution Agreement: Artech receives [exact commission %], exclusive rights to [specific territories], minimum purchase obligation of [exact units/amount], termination requires [exact notice period]"

4. CITE SPECIFIC SECTIONS: Reference exact contract sections (e.g., "Section 3.2 Payment Terms states...")

5. PROVIDE EXHAUSTIVE LISTS: If there are 10 contracts, list ALL 10 with complete details for each

Your answer must be a COMPREHENSIVE, DETAILED extraction of ALL specific terms, amounts, dates, and obligations found in the evidence. A proper answer should be 3-10x longer than a summary.

Respond in JSON format:
{
  "answer": "ULTRA-DETAILED extraction with every specific contract term, amount, date, obligation, and deliverable from ALL documents - minimum 2000+ characters for complex questions",
  "confidence": 0-100,
  "sources": ["Document name 1", "Document name 2"],
  "keyFindings": ["Finding 1 with specific details", "Finding 2 with exact amounts"],
  "gaps": ["Missing information 1", "Missing information 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "legalAssessment": "Overall legal assessment based on evidence",
  "evidenceCount": ${evidence.length}
}`;

    try {
      // Add 90-second timeout for final answer compilation (longer than evidence extraction)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI compilation timeout after 90s')), 90000)
      );
      
      const apiPromise = openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 16000 // MASSIVELY INCREASED: Ensure comprehensive answers with NO truncation
      });
      
      const response = await Promise.race([apiPromise, timeoutPromise]) as any;
      
      const compiledAnswer = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        question: question.question,
        category: question.category,
        answer: compiledAnswer.answer || 'Unable to compile answer from available evidence',
        confidence: compiledAnswer.confidence || 30,
        sources: evidence.map(e => e.documentName), // SHOW ALL ANALYZED DOCUMENTS
        keyFindings: compiledAnswer.keyFindings || [],
        gaps: compiledAnswer.gaps || [],
        recommendations: compiledAnswer.recommendations || [],
        legalAssessment: compiledAnswer.legalAssessment || '',
        evidenceCount: evidence.length,
        detailedEvidence: evidence
      };
      
    } catch (error) {
      const isTimeout = error.message?.includes('timeout');
      console.error(`Error compiling answer for "${question.question}":`, error);
      
      // For timeouts, try to create a basic answer from evidence
      if (isTimeout && evidence.length > 0) {
        const basicAnswer = evidence
          .slice(0, 10) // Use first 10 documents
          .map(e => `${e.documentName}: ${e.documentSummary || e.relevantContent.join('; ')}`)
          .join('\n\n');
        
        return {
          question: question.question,
          category: question.category,
          answer: `Analysis timeout - Partial results from ${evidence.length} documents:\n\n${basicAnswer}`,
          confidence: 60,
          sources: evidence.map(e => e.documentName),
          keyFindings: evidence.slice(0, 5).flatMap(e => e.keyFindings || []),
          gaps: ['Analysis incomplete due to timeout'],
          recommendations: ['Complete analysis manually', 'Review partial evidence provided'],
          evidenceCount: evidence.length,
          detailedEvidence: evidence
        };
      }
      
      return {
        question: question.question,
        category: question.category,
        answer: `Error processing this question: ${isTimeout ? 'OpenAI analysis timeout' : error.message}`,
        confidence: 0,
        sources: evidence.map(e => e.documentName),
        keyFindings: [],
        gaps: ['Analysis compilation failed'],
        recommendations: ['Retry analysis', 'Manual review required'],
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
      
      // Risk findings for low confidence or gaps
      if (answer.confidence < 50 || (answer.gaps && answer.gaps.length > 0)) {
        findings.push({
          id: findings.length + 1,
          type: 'risk',
          content: `Insufficient legal information for: ${question.question}. Additional documentation may be required.`,
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

// Export the service instance
export const comprehensiveLegalAnalysisService = new ComprehensiveLegalAnalysisService();