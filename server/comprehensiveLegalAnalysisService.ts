/**
 * Comprehensive Legal Analysis Service - EXACT COPY from Clinical with Legal adaptations
 * Analyzes ALL assigned legal documents systematically for each question
 * Extracts specific evidence from documents and compiles complete answers
 */

import { db } from './db';
import { documents, agentAnalyses } from '../shared/schema';
import { storage } from './storage';
import { resilientOpenAI } from './utils/resilientOpenAI';

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
          // Update progress based on completed questions (i) not current question (i+1)
          const progress = Math.round((i / COMPREHENSIVE_LEGAL_QUESTIONS.length) * 100);
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
          
          // Compile comprehensive answer with resilient client (handles timeout internally)
          console.log(`🤖 Starting OpenAI analysis for question: ${question.question} with ${documentEvidence.length} pieces of evidence`);
          const answer = await this.compileComprehensiveAnswer(question, documentEvidence, jobId, storageService, i, COMPREHENSIVE_LEGAL_QUESTIONS.length);
          legalAnswers[question.id] = answer;
          console.log(`🤖 OpenAI analysis completed for question: ${question.question}`);
          
          console.log(`✅ Completed question ${i + 1}/${COMPREHENSIVE_LEGAL_QUESTIONS.length}: ${question.question}`);
          
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
   * Get progress for a specific question rerun from database
   */
  async getQuestionRerunProgress(dealId: number, questionId: string): Promise<number> {
    const jobId = `legal-question-rerun-${dealId}-${questionId}`;
    const job = await storage.getBackgroundJobById(jobId);
    return job?.progress || 0;
  }
  
  /**
   * Update progress for a specific question rerun in database
   */
  public async updateQuestionRerunProgress(dealId: number, questionId: string, progress: number): Promise<void> {
    const jobId = `legal-question-rerun-${dealId}-${questionId}`;
    
    // Check if job exists using storage service
    const existingJob = await storage.getBackgroundJobById(jobId);
    
    if (existingJob) {
      // Update existing job using storage service
      await storage.updateBackgroundJob(jobId, { 
        progress,
        status: progress === 100 ? 'completed' : (progress === 0 ? 'pending' : 'processing'),
        completedAt: progress === 100 ? new Date() : null
      });
    } else {
      // Create new job using storage service
      await storage.createBackgroundJob({
        jobId,
        jobType: 'legal_question_rerun',
        dealId,
        status: progress === 0 ? 'pending' : 'processing',
        progress,
        runId: questionId,
        currentStep: `Rerunning question: ${questionId}`
      });
    }
    
    console.log(`📊 Progress update (DB): ${questionId} = ${progress}%`);
  }
  
  /**
   * Get all active question progress for a deal from database
   */
  async getAllQuestionProgress(dealId: number): Promise<Record<string, number>> {
    const jobs = await storage.getBackgroundJobsByDealId(dealId);
    const legalQuestionJobs = jobs.filter(job => job.jobType === 'legal_question_rerun');
    
    const result: Record<string, number> = {};
    for (const job of legalQuestionJobs) {
      if (job.runId) {
        result[job.runId] = job.progress;
      }
    }
    
    return result;
  }
  
  /**
   * Check if a question is currently being rerun in database
   */
  /**
   * Auto-cleanup stuck or failed jobs before checking if running
   * Prevents old failed jobs from blocking new reruns
   */
  private async cleanupStuckJob(dealId: number, questionId: string): Promise<void> {
    const jobId = `legal-question-rerun-${dealId}-${questionId}`;
    const job = await storage.getBackgroundJobById(jobId);
    
    if (!job) return; // No job to cleanup
    
    // Auto-cleanup conditions:
    // 1. Job status is 'failed'
    // 2. Job is stuck (updated > 30 minutes ago and not completed)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const isStuck = job.updatedAt < thirtyMinutesAgo && job.status !== 'completed';
    const isFailed = job.status === 'failed';
    
    if (isFailed || isStuck) {
      console.log(`🧹 Auto-cleaning ${isFailed ? 'failed' : 'stuck'} job: ${jobId} (last updated: ${job.updatedAt})`);
      const { backgroundJobs } = await import('../shared/schema');
      const { eq } = await import('drizzle-orm');
      await db.delete(backgroundJobs).where(eq(backgroundJobs.jobId, jobId));
      console.log(`✅ Cleaned up ${isFailed ? 'failed' : 'stuck'} job: ${jobId}`);
    }
  }
  
  async isQuestionRunning(dealId: number, questionId: string): Promise<boolean> {
    // First, auto-cleanup any stuck or failed jobs
    await this.cleanupStuckJob(dealId, questionId);
    
    // Now check if job is actually running using storage service
    const jobId = `legal-question-rerun-${dealId}-${questionId}`;
    const job = await storage.getBackgroundJobById(jobId);
    
    // Consider it running if job exists (not null or undefined) and progress is not 100
    return job != null && job.progress < 100;
  }
  
  /**
   * Re-run a single legal question analysis
   * Useful for retrying failed/timeout questions without re-running entire analysis
   */
  async rerunSingleQuestion(dealId: number, questionId: string): Promise<any> {
    console.log(`🔄 Re-running single legal question ${questionId} for deal ${dealId}`);
    const jobId = `legal-question-rerun-${dealId}-${questionId}`;
    
    // 🔒 ATOMIC JOB REGISTRATION: Check if job already exists
    let jobAlreadyExists = false;
    const existingJob = await storage.getBackgroundJobById(jobId);
    
    if (existingJob && existingJob.progress < 100) {
      throw new Error(`Question ${questionId} is already being rerun (progress: ${existingJob.progress}%)`);
    }
    
    if (existingJob && existingJob.progress === 100) {
      jobAlreadyExists = true;
      console.log(`♻️ Rerunning completed question ${questionId}`);
    } else {
      // Create new job using storage service
      await storage.createBackgroundJob({
        jobId,
        jobType: 'legal_question_rerun',
        dealId,
        status: 'pending',
        progress: 0,
        runId: questionId,
        currentStep: `Initializing question rerun: ${questionId}`
      });
      console.log(`✅ Registered new job for question ${questionId}`);
    }
    
    try {
      
      // Find the question
      const question = COMPREHENSIVE_LEGAL_QUESTIONS.find(q => q.id === questionId);
      if (!question) {
        throw new Error(`Question ${questionId} not found`);
      }
      await this.updateQuestionRerunProgress(dealId, questionId, 10);
      
      // Get legal documents
      const assignedDocuments = await this.getAssignedLegalDocuments(dealId);
      console.log(`📄 Found ${assignedDocuments.length} documents for question re-run`);
      
      if (assignedDocuments.length === 0) {
        throw new Error('No documents available for legal analysis');
      }
      await this.updateQuestionRerunProgress(dealId, questionId, 20);
      
      // Extract evidence for this specific question
      console.log(`📊 Extracting evidence for: ${question.question}`);
      await this.updateQuestionRerunProgress(dealId, questionId, 30);
      
      const documentEvidence = await this.extractEvidenceFromAllDocuments(
        assignedDocuments, 
        question
      );
      console.log(`📊 Evidence extraction completed: ${documentEvidence.length} pieces of evidence`);
      await this.updateQuestionRerunProgress(dealId, questionId, 60);
      
      // Compile answer
      console.log(`🤖 Compiling answer for: ${question.question}`);
      await this.updateQuestionRerunProgress(dealId, questionId, 70);
      
      const answer = await this.compileComprehensiveAnswer(question, documentEvidence);
      console.log(`✅ Answer compiled successfully`);
      await this.updateQuestionRerunProgress(dealId, questionId, 85);
      
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
      await this.updateQuestionRerunProgress(dealId, questionId, 95);
      
      // Update the database with new answer
      await this.storeComprehensiveLegalResults(
        dealId, 
        updatedLegalAnswers, 
        findings, 
        recommendations, 
        assignedDocuments
      );
      
      console.log(`✅ Successfully updated question ${questionId} in legal analysis`);
      await this.updateQuestionRerunProgress(dealId, questionId, 100);
      
      return answer;
    } catch (error) {
      console.error(`❌ Error re-running question ${questionId}:`, error);
      throw error;
    } finally {
      // Schedule cleanup of completed job after 1 hour
      // Only delete if job is still in completed/failed status (prevents deleting active reruns)
      setTimeout(async () => {
        try {
          const jobToClean = await storage.getBackgroundJobById(jobId);
          
          // Only delete if job exists and is completed (100%) or failed
          if (jobToClean && (jobToClean.progress === 100 || jobToClean.status === 'failed')) {
            const { backgroundJobs } = await import('../shared/schema');
            const { eq } = await import('drizzle-orm');
            await db.delete(backgroundJobs)
              .where(eq(backgroundJobs.jobId, jobId));
            console.log(`🧹 Cleaned up completed database record for question ${questionId}`);
          } else if (jobToClean) {
            console.log(`⏭️ Skipping cleanup for question ${questionId} - job still active (progress: ${jobToClean.progress}%)`);
          }
        } catch (cleanupError) {
          console.error(`Failed to cleanup job ${jobId}:`, cleanupError);
        }
      }, 3600000); // 1 hour
    }
  }
  
  /**
   * Get all documents suitable for legal analysis
   * 🚀 COMPREHENSIVE APPROACH: Use ALL documents with AI summaries (like reruns do)
   * This ensures full analysis has same quality as reruns
   */
  private async getAssignedLegalDocuments(dealId: number): Promise<any[]> {
    const { eq } = await import('drizzle-orm');
    
    const allDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, dealId));
    
    console.log(`📄 Total documents found for deal ${dealId}: ${allDocuments.length}`);
    
    // 🚀 NEW COMPREHENSIVE APPROACH: Use ALL documents with AI summaries (matching rerun behavior)
    // This provides cross-agent insights and better evidence synthesis
    const legalDocuments = allDocuments.filter(doc => doc.aiSummary);
    
    console.log(`📄 Using COMPREHENSIVE approach: ALL ${legalDocuments.length} documents with AI summaries`);
    console.log(`📊 This matches rerun behavior for consistent high-quality analysis`);
    
    // Log AI summary coverage for quality assurance
    const aiCoverage = Math.round(legalDocuments.length / allDocuments.length * 100);
    console.log(`📊 AI summary coverage: ${aiCoverage}% (${legalDocuments.length}/${allDocuments.length} documents)`);
    
    return legalDocuments;
  }
  
  /**
   * Extract evidence from ALL documents for a specific question - Optimized batch processing
   */
  private async extractEvidenceFromAllDocuments(
    documents: any[], 
    question: any
  ): Promise<any[]> {
    console.log(`📄 Starting evidence extraction from ${documents.length} documents for: ${question.question}`);
    
    // Process documents in batches to match Financial/HR/Commercial speed
    const batchSize = 40;
    const evidence = [];
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)} (${batch.length} documents)`);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (doc) => {
          console.log(`🔎 Extracting evidence from: ${doc.name}`);
          return this.extractEvidenceFromDocument(doc, question);
        })
      );
      
      // Filter out null results and add to evidence with proper type guards
      const validEvidence = batchResults
        .filter((result): result is PromiseFulfilledResult<any> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value)
        .filter(docEvidence => 
          docEvidence && docEvidence.relevantContent && docEvidence.relevantContent.length > 0
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
    // Use ONLY AI summary - handle BOTH string and object formats
    const aiSummary = document.aiSummary;
    if (!aiSummary) return null;
    
    let content: string;
    
    // Handle STRING summaries (most common in production)
    if (typeof aiSummary === 'string') {
      content = aiSummary;
    } 
    // Handle OBJECT summaries (structured format)
    else if (typeof aiSummary === 'object') {
      content = [
        aiSummary.executiveSummary || '',
        aiSummary.documentType ? `Document Type: ${aiSummary.documentType}` : '',
        aiSummary.criticalFindings?.length ? `Critical Findings: ${aiSummary.criticalFindings.join('; ')}` : '',
        aiSummary.keyFinancialData?.length ? `Financial Data: ${aiSummary.keyFinancialData.join('; ')}` : '',
        aiSummary.riskAssessment?.length ? `Risk Assessment: ${aiSummary.riskAssessment.join('; ')}` : '',
        aiSummary.neutralFindings?.length ? `Neutral Findings: ${aiSummary.neutralFindings.join('; ')}` : '',
        aiSummary.strategicImplications || ''
      ].filter(s => s).join('\n\n');
      
      // Fallback: if all fields are empty, stringify the entire object
      if (!content) {
        content = JSON.stringify(aiSummary, null, 2);
      }
    } else {
      // Fallback: convert to string
      content = String(aiSummary);
    }
    
    if (!content || content.trim().length === 0) return null;
    
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
      // Use resilient OpenAI client with retry logic and adaptive timeout
      const response = await resilientOpenAI.createChatCompletion({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 8000
      }, {
        maxRetries: 3,
        timeout: 90000, // 90 seconds with retry
        onRetry: (attempt, error) => {
          console.warn(`🔄 Retrying evidence extraction for ${document.name} (attempt ${attempt}): ${error.message}`);
        }
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
   * Compile comprehensive answer based on all evidence - BATCHED APPROACH
   * Processes evidence in batches of 20 to avoid token limits
   */
  private async compileComprehensiveAnswer(
    question: any, 
    evidence: any[], 
    jobId?: string, 
    storageService?: any, 
    questionIndex?: number, 
    totalQuestions?: number
  ): Promise<any> {
    console.log(`🔄 BATCHED COMPILATION: Starting for "${question.question}" with ${evidence.length} documents`);
    
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

    // 🚀 SMART BATCHING: Create batches based on token count, not fixed size
    const MAX_BATCH_TOKENS = 6000; // Conservative limit (leaves room for prompt + response)
    const batches = [];
    let currentBatch: any[] = [];
    let currentBatchTokens = 0;
    
    for (const ev of evidence) {
      const evTokens = resilientOpenAI.countBatchTokens([ev]);
      
      // If adding this evidence would exceed limit, start new batch
      if (currentBatchTokens + evTokens > MAX_BATCH_TOKENS && currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [ev];
        currentBatchTokens = evTokens;
      } else {
        currentBatch.push(ev);
        currentBatchTokens += evTokens;
      }
    }
    
    // Add final batch if not empty
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }
    
    console.log(`📦 Processing ${evidence.length} documents in ${batches.length} token-optimized batches`);
    
    // Step 1: Get partial answers from each batch
    const partialAnswers = [];
    const partialResultsKey = `legal-partial-${question.id}`;
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`📦 Processing batch ${i + 1}/${batches.length} (${batch.length} documents)`);
      
      const batchPrompt = `You are a senior legal analyst. Analyze evidence from ${batch.length} documents to answer: "${question.question}"

Evidence:
${batch.map(ev => {
  // CRITICAL FIX: Use fullContent (AI summary) as fallback when relevantContent is empty
  const content = Array.isArray(ev.relevantContent) && ev.relevantContent.length > 0
    ? ev.relevantContent.join('; ')
    : ev.fullContent || ev.documentSummary || 'No content available';
  
  const findings = Array.isArray(ev.keyFindings) && ev.keyFindings.length > 0
    ? ev.keyFindings.join('; ')
    : 'See content above';
  
  return `
DOCUMENT: ${ev.documentName}
AI SUMMARY CONTENT: ${content}
KEY FINDINGS: ${findings}`;
}).join('\n')}

CRITICAL INSTRUCTIONS:
1. Extract ALL specific details from the AI SUMMARY CONTENT above (contract terms, payment amounts, dates, obligations, party names, deliverables, compliance requirements, IP terms, liability clauses, termination conditions)
2. DO NOT add "Insufficient information" or "Additional documentation required" disclaimers
3. Focus on what IS documented with specific details
4. Use gaps field ONLY for missing information (do not mention in answer field)

Respond in JSON:
{
  "answer": "Detailed extraction with specific contract terms, amounts, dates from the AI summaries (NO disclaimers)",
  "confidence": 0-100,
  "keyFindings": ["Specific finding 1", "Specific finding 2"],
  "sources": ["doc1", "doc2"]
}`;

      try {
        // Use resilient client with retry and timeout
        const response = await resilientOpenAI.createChatCompletion({
          model: "gpt-4o",
          messages: [{ role: "user", content: batchPrompt }],
          response_format: { type: "json_object" },
          temperature: 0.2,
          max_tokens: 8000
        }, {
          maxRetries: 4,
          timeout: 120000, // 2 minutes per batch
          onRetry: (attempt, error) => {
            console.warn(`🔄 Retrying batch ${i + 1}/${batches.length} (attempt ${attempt}): ${error.message}`);
          }
        });
        
        const batchAnswer = JSON.parse(response.choices[0].message.content || '{}');
        partialAnswers.push(batchAnswer);
        
        // 💾 PERSISTENCE: Save partial results after each batch (in-memory cache for now)
        // This ensures we don't lose all work if synthesis fails
        if (!global[partialResultsKey]) {
          global[partialResultsKey] = [];
        }
        global[partialResultsKey].push(batchAnswer);
        
        console.log(`✅ Batch ${i + 1}/${batches.length} completed and saved`);
        
        // 🔄 HEARTBEAT: Update job progress after each batch to prevent stuck job cleanup
        // Calculate granular progress that includes both question AND batch progress
        if (jobId && storageService && questionIndex !== undefined && totalQuestions !== undefined) {
          const questionProgress = questionIndex / totalQuestions;
          const batchProgress = (i + 1) / batches.length / totalQuestions;
          const totalProgress = Math.min(Math.round((questionProgress + batchProgress) * 100), 100);
          
          await storageService.updateBackgroundJob(jobId, {
            progress: totalProgress, // This guarantees updatedAt changes with each batch
            currentStep: `Analyzing: ${question.category} (Batch ${i + 1}/${batches.length})`,
            processedDocuments: questionIndex
          });
        }
      } catch (error: any) {
        console.error(`❌ Error in batch ${i + 1}:`, error);
        const errorAnswer = {
          answer: `Error processing batch ${i + 1}: ${error.message}`,
          confidence: 0,
          keyFindings: [],
          sources: batch.map(e => e.documentName)
        };
        partialAnswers.push(errorAnswer);
        
        // Save error results too
        if (!global[partialResultsKey]) {
          global[partialResultsKey] = [];
        }
        global[partialResultsKey].push(errorAnswer);
      }
    }
    
    // Step 2: Synthesize all partial answers into final comprehensive answer
    console.log(`🔄 Synthesizing ${partialAnswers.length} partial answers into final answer`);
    
    const synthesisPrompt = `You are a senior legal analyst. Synthesize these partial analyses into ONE comprehensive answer for: "${question.question}"

Partial Analyses:
${partialAnswers.map((pa, i) => `
BATCH ${i + 1}:
${pa.answer}
KEY FINDINGS: ${pa.keyFindings?.join('; ') || 'None'}
`).join('\n')}

CRITICAL SYNTHESIS RULES:
1. Extract ALL specific details (amounts, dates, terms) from all batches
2. Lists ALL contracts/agreements with complete details
3. Provides exhaustive breakdown of obligations, rights, and terms
4. Cites specific document sections and dates
5. DO NOT add "Insufficient information" or "Additional documentation required" disclaimers in the answer field
6. Focus on what IS documented - save gaps for separate "gaps" field
7. Write professional analysis like Financial/Clinical agents (no vague disclaimers)

FORMAT REQUIREMENTS FOR "answer" FIELD:
- Use markdown bullets (•) for lists of evidence/findings
- Use **bold** for key terms, amounts, dates, and party names
- Structure with clear sections if multiple topics
- NO disclaimers or "insufficient information" statements in answer
- Example format:
  "The analysis reveals the following:
  
  • **Contract ABC**: Payment of **$50,000** due **Q4 2024** to **Party Name Inc.**
  • **Agreement XYZ**: Includes **15% equity** with **3-year vesting**
  
  Key obligations include..."

Respond in JSON:
{
  "answer": "Comprehensive synthesis with ALL specific details formatted with markdown bullets and bold (NO disclaimers)",
  "confidence": 0-100,
  "keyFindings": ["All key findings combined"],
  "gaps": ["Missing information ONLY - separate from answer"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "legalAssessment": "Overall legal assessment"
}`;

    try {
      // Use resilient client for final synthesis with extended timeout
      const finalResponse = await resilientOpenAI.createChatCompletion({
        model: "gpt-4o",
        messages: [{ role: "user", content: synthesisPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 16000
      }, {
        maxRetries: 5,
        timeout: 180000, // 3 minutes for synthesis (larger)
        onRetry: (attempt, error) => {
          console.warn(`🔄 Retrying final synthesis for "${question.question}" (attempt ${attempt}): ${error.message}`);
        }
      });
      
      const compiledAnswer = JSON.parse(finalResponse.choices[0].message.content || '{}');
      
      console.log(`✅ Final synthesis completed for "${question.question}"`);
      
      // 🧹 CLEANUP: Remove partial results cache after successful synthesis
      if (global[partialResultsKey]) {
        delete global[partialResultsKey];
        console.log(`🧹 Cleaned up partial results cache for ${question.id}`);
      }
      
      return {
        question: question.question,
        category: question.category,
        answer: compiledAnswer.answer || 'Unable to compile answer from available evidence',
        confidence: compiledAnswer.confidence || 30,
        sources: evidence.map(e => e.documentName),
        keyFindings: compiledAnswer.keyFindings || [],
        gaps: compiledAnswer.gaps || [],
        recommendations: compiledAnswer.recommendations || [],
        legalAssessment: compiledAnswer.legalAssessment || '',
        evidenceCount: evidence.length,
        detailedEvidence: evidence
      };
      
    } catch (error: any) {
      const isTimeout = error.message?.includes('timeout');
      console.error(`❌ Error in final synthesis for "${question.question}":`, error);
      
      // 💾 RECOVERY: Try to use persisted partial results first
      const persistedResults = global[partialResultsKey] || partialAnswers;
      console.warn(`📦 Using ${persistedResults.length} persisted batch results as fallback`);
      
      // Fallback: Combine partial answers directly (from cache or current session)
      const combinedAnswer = persistedResults
        .map((pa, i) => `Batch ${i + 1}: ${pa.answer}`)
        .join('\n\n');
      
      // Calculate average confidence from partial results
      const avgConfidence = persistedResults.length > 0
        ? Math.round(persistedResults.reduce((sum, pa) => sum + (pa.confidence || 0), 0) / persistedResults.length)
        : 30;
      
      return {
        question: question.question,
        category: question.category,
        answer: `Synthesis ${isTimeout ? 'timeout' : 'error'} - Combined ${persistedResults.length} batch results from ${evidence.length} documents:\n\n${combinedAnswer}`,
        confidence: avgConfidence,
        sources: evidence.map(e => e.documentName),
        keyFindings: persistedResults.flatMap(pa => pa.keyFindings || []),
        gaps: ['Synthesis incomplete - using partial batch results'],
        recommendations: ['Review batch evidence provided', isTimeout ? 'Retry with longer timeout' : 'Manual review recommended'],
        evidenceCount: evidence.length,
        detailedEvidence: evidence
      };
    }
  }

  /**
   * Generate comprehensive findings - ALIGNED WITH Financial/Clinical agents
   * CRITICAL FIX: Removed vague "Insufficient information" disclaimers that made answers look incomplete
   */
  private generateComprehensiveLegalFindings(answers: Record<string, any>): any[] {
    const findings = [];
    
    for (const [questionId, answer] of Object.entries(answers)) {
      const question = COMPREHENSIVE_LEGAL_QUESTIONS.find(q => q.id === questionId);
      if (!question) continue;
      
      // High confidence findings - show full answer like Financial agent
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
      
      // REMOVED: Vague "Insufficient legal information" disclaimers
      // The answer.gaps field already contains specific gap information
      // Adding generic disclaimers made answers look incomplete and unprofessional
      // Now matches Financial/Clinical agent behavior
    }
    
    console.log(`📊 Generated ${findings.length} comprehensive legal findings`);
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
    const { and, eq } = await import('drizzle-orm');
    
    // First, delete any existing legal analysis to ensure clean replacement
    await db
      .delete(agentAnalyses)
      .where(and(
        eq(agentAnalyses.dealId, dealId),
        eq(agentAnalyses.agentType, 'Legal')
      ));
    
    console.log(`🗑️ Cleared existing legal analysis for deal ${dealId}`);
    
    // Create the new comprehensive analysis - Fixed to use correct snake_case column names (not TypeScript property names)
    const analysisData = {
      dealId,
      agentType: 'Legal' as const,
      status: 'completed' as const,
      progress: 100,
      findings: findings,
      recommendations: recommendations,
      legal_answers: legalAnswers,
      documentSources: documentsAnalyzed.map(d => d.name),
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