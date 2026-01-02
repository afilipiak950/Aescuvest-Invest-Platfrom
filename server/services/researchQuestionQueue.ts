/**
 * Research Question Queue Service
 * Sequential processing of research analysis questions with persistence
 * EXACT MIRROR of Legal Question Queue Service for bulletproof reliability
 * Processes one question at a time per deal to ensure quality and avoid rate limits
 */

import { db } from '../db';
import { agentQuestionQueue, agentAnalyses } from '../../shared/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { storage } from '../storage';
import { RESEARCH_QUESTIONS } from '../comprehensiveResearchAnalysisService';
import { resilientOpenAI } from '../utils/resilientOpenAI';
import { websocketManager } from './websocketManager';
import { formatAgentAnswer } from '../utils/textFormatting';
import { documentBatchPlanner } from './documentBatchPlanner';

interface ResearchEvidence {
  documentName: string;
  documentId?: number;
  documentSummary: string;
  relevantContent: string[];
  keyFindings: string[];
  confidence: number;
  hasRelevantInfo?: boolean;
  fullContent?: string;
}

interface QueueItem {
  id: number;
  dealId: number;
  agentType: string;
  questionKey: string;
  questionText: string;
  prompt: string;
  status: string;
  priority: number;
  result: any;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ResearchQuestionQueueService {
  private static instance: ResearchQuestionQueueService;
  private processingQueues = new Map<number, boolean>();
  private activeProcessors = new Map<number, AbortController>();

  static getInstance(): ResearchQuestionQueueService {
    if (!ResearchQuestionQueueService.instance) {
      ResearchQuestionQueueService.instance = new ResearchQuestionQueueService();
    }
    return ResearchQuestionQueueService.instance;
  }

  async initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing Research Question Queue Service...');
      
      // 🔥 AUTO-RETRY: Reset BOTH failed AND stuck "running" questions back to pending
      // This handles cases where jobs failed or were interrupted by server restart
      await db
        .update(agentQuestionQueue)
        .set({ 
          status: 'pending', 
          errorMessage: null,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(agentQuestionQueue.agentType, 'research'),
            eq(agentQuestionQueue.status, 'failed')
          )
        );
      console.log(`🔄 Reset failed research questions to pending for automatic retry`);
      
      // Also reset "running" status questions that are orphaned from server restart
      await db
        .update(agentQuestionQueue)
        .set({ 
          status: 'pending', 
          errorMessage: null,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(agentQuestionQueue.agentType, 'research'),
            eq(agentQuestionQueue.status, 'running')
          )
        );
      console.log(`🔄 Reset orphaned running research questions to pending for automatic retry`);
      
      const pendingQueues = await db
        .select({ dealId: agentQuestionQueue.dealId })
        .from(agentQuestionQueue)
        .where(
          and(
            eq(agentQuestionQueue.agentType, 'research'),
            eq(agentQuestionQueue.status, 'pending')
          )
        )
        .groupBy(agentQuestionQueue.dealId);

      console.log(`📋 Found ${pendingQueues.length} deals with pending research questions`);

      for (const { dealId } of pendingQueues) {
        console.log(`🔄 Resuming research question queue for deal ${dealId}`);
        this.processQueue(dealId).catch(err => 
          console.error(`❌ Error resuming queue for deal ${dealId}:`, err)
        );
      }

      console.log('✅ Research Question Queue Service initialized');
    } catch (error) {
      console.error('❌ Error initializing Research Question Queue Service:', error);
    }
  }

  /**
   * Cancel all research processing for a deal and reset in-memory state
   * Called by CancellationOrchestrator during Stop All Jobs
   */
  cancelDeal(dealId: number): void {
    console.log(`🛑 ResearchQuestionQueueService: Cancelling deal ${dealId}`);
    
    // Stop any active processing for this deal
    this.processingQueues.delete(dealId);
    
    // Abort any active processor
    const controller = this.activeProcessors.get(dealId);
    if (controller) {
      controller.abort();
      this.activeProcessors.delete(dealId);
      console.log(`🛑 Aborted active research processor for deal ${dealId}`);
    }
    
    console.log(`✅ ResearchQuestionQueueService: Deal ${dealId} cancelled, memory state reset`);
  }

  async forceRerunAllQuestions(dealId: number): Promise<{ success: boolean; queuedCount: number }> {
    try {
      console.log(`🔥 FORCE RERUN: Starting ALL research questions for deal ${dealId} (no skipping)`);

      await db
        .delete(agentQuestionQueue)
        .where(
          and(
            eq(agentQuestionQueue.dealId, dealId),
            eq(agentQuestionQueue.agentType, 'research')
          )
        );

      let queuedCount = 0;
      for (const question of RESEARCH_QUESTIONS) {
        await db.insert(agentQuestionQueue).values({
          dealId,
          agentType: 'research',
          questionKey: question.id,
          questionText: question.question,
          prompt: question.analysisPrompt,
          status: 'pending',
          priority: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        queuedCount++;
      }

      console.log(`✅ FORCE RERUN: Queued ALL ${queuedCount} research questions for deal ${dealId}`);

      // Create master job to track overall progress (like IP does)
      const masterJobId = `force-rerun-all-research-${dealId}`;
      const existingMaster = await storage.getBackgroundJobById(masterJobId);
      if (existingMaster) {
        await storage.updateBackgroundJob(masterJobId, {
          status: 'processing',
          progress: 0,
          currentStep: `Starting research queue: 0/${RESEARCH_QUESTIONS.length} questions`
        });
      } else {
        await storage.createBackgroundJob({
          jobId: masterJobId,
          dealId,
          jobType: 'research_force_rerun_master',
          status: 'processing',
          progress: 0,
          currentStep: `Starting research queue: 0/${RESEARCH_QUESTIONS.length} questions`,
          agentType: 'Research',
          metadata: {
            agentType: 'Research',
            totalQuestions: RESEARCH_QUESTIONS.length,
            startTime: new Date().toISOString()
          }
        });
      }
      console.log(`✅ Created master job ${masterJobId} for research queue`);

      this.processQueue(dealId);

      return { success: true, queuedCount };
    } catch (error) {
      console.error(`❌ Error force rerunning research questions for deal ${dealId}:`, error);
      throw error;
    }
  }

  private async processQueue(dealId: number): Promise<void> {
    if (this.processingQueues.get(dealId)) {
      console.log(`⏸️ Research queue already processing for deal ${dealId}`);
      return;
    }

    this.processingQueues.set(dealId, true);
    const abortController = new AbortController();
    this.activeProcessors.set(dealId, abortController);
    
    const masterJobId = `force-rerun-all-research-${dealId}`;
    let completedCount = 0;
    const totalQuestions = RESEARCH_QUESTIONS.length;

    try {
      console.log(`▶️ Starting research queue processor for deal ${dealId}`);

      while (!abortController.signal.aborted) {
        const nextQuestion = await db
          .select()
          .from(agentQuestionQueue)
          .where(
            and(
              eq(agentQuestionQueue.dealId, dealId),
              eq(agentQuestionQueue.agentType, 'research'),
              eq(agentQuestionQueue.status, 'pending')
            )
          )
          .orderBy(
            desc(agentQuestionQueue.priority),
            asc(agentQuestionQueue.createdAt)
          )
          .limit(1);

        if (nextQuestion.length === 0) {
          console.log(`✅ No more pending research questions for deal ${dealId}`);
          break;
        }

        const question = nextQuestion[0] as QueueItem;
        console.log(`🔍 Processing research question ${question.id}: "${question.questionText}"`);

        await db
          .update(agentQuestionQueue)
          .set({ 
            status: 'running',
            updatedAt: new Date()
          })
          .where(eq(agentQuestionQueue.id, question.id));

        const jobId = `research-question-rerun-${dealId}-${question.questionKey}`;
        
        const existingJob = await storage.getBackgroundJobById(jobId);
        if (existingJob) {
          await storage.updateBackgroundJob(jobId, {
            status: 'processing',
            progress: 10,
            currentStep: `Analyzing: ${question.questionText.substring(0, 50)}...`
          });
        } else {
          await storage.createBackgroundJob({
            jobId,
            dealId,
            jobType: 'research_question_rerun',
            status: 'processing',
            progress: 10,
            currentStep: `Analyzing: ${question.questionText.substring(0, 50)}...`,
            runId: question.questionKey,
            metadata: {
              agentType: 'research',
              startTime: new Date().toISOString(),
              questionId: question.questionKey
            }
          });
        }

        await this.broadcastQueueProgress(dealId);

        try {
          await storage.updateBackgroundJob(jobId, {
            progress: 30,
            currentStep: `Processing documents for: ${question.questionKey}`
          });

          const result = await this.processQuestion(dealId, question);

          await storage.updateBackgroundJob(jobId, {
            status: 'completed',
            progress: 100,
            currentStep: `Completed: ${question.questionKey}`
          });

          await db
            .update(agentQuestionQueue)
            .set({
              status: 'completed',
              result,
              processedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(agentQuestionQueue.id, question.id));

          completedCount++;
          
          // Update master job progress (keeps isProcessing=true between questions)
          const masterProgress = Math.round((completedCount / totalQuestions) * 100);
          await storage.updateBackgroundJob(masterJobId, {
            status: 'processing',
            progress: masterProgress,
            currentStep: `Processing question ${completedCount + 1}/${totalQuestions}: ${question.questionKey}`
          });

          console.log(`✅ Completed research question ${question.questionKey} (${completedCount}/${totalQuestions})`);
          
          // 🔥 INSTANT DISPLAY: Broadcast question completion with answer data
          websocketManager.broadcast('research_question_completed', {
            questionId: question.questionKey,
            questionText: question.questionText,
            answer: result,
            completedCount,
            totalQuestions,
            progress: Math.round((completedCount / totalQuestions) * 100)
          }, dealId);

        } catch (error: any) {
          console.error(`❌ Error processing research question ${question.id}:`, error);

          await storage.updateBackgroundJob(jobId, {
            status: 'failed',
            progress: 0,
            currentStep: `Failed: ${error.message || 'Unknown error'}`
          });

          await db
            .update(agentQuestionQueue)
            .set({
              status: 'failed',
              errorMessage: error.message || 'Unknown error',
              updatedAt: new Date()
            })
            .where(eq(agentQuestionQueue.id, question.id));
        }

        await this.broadcastQueueProgress(dealId);

        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log(`🏁 Research queue processing completed for deal ${dealId}`);
      
      // Mark master job as completed
      await storage.updateBackgroundJob(masterJobId, {
        status: 'completed',
        progress: 100,
        currentStep: `Completed all ${totalQuestions} research questions`
      });
      console.log(`✅ Master job ${masterJobId} marked as completed`);

    } catch (error) {
      console.error(`❌ Research queue processor error for deal ${dealId}:`, error);
      
      // Mark master job as failed on error
      await storage.updateBackgroundJob(masterJobId, {
        status: 'failed',
        currentStep: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      this.processingQueues.delete(dealId);
      this.activeProcessors.delete(dealId);
      await this.broadcastQueueProgress(dealId);
    }
  }

  /**
   * Process a single research question using MULTI-PASS ARCHITECTURE (EXACT IP pattern)
   * Step 1: Extract evidence from each document individually (paginated for large datarooms)
   * Step 2: Compile comprehensive answer using token-based batching
   */
  private async processQuestion(dealId: number, question: QueueItem): Promise<any> {
    try {
      console.log(`🔬 [MULTI-PASS] Analyzing research question: ${question.questionText}`);

      // Get batch plan to understand dataroom size
      const batchPlan = await documentBatchPlanner.calculateBatchPlan(dealId);
      console.log(`📄 Found ${batchPlan.totalDocuments} documents for research analysis (strategy: ${batchPlan.samplingStrategy})`);

      if (batchPlan.totalDocuments === 0) {
        const noDocsResult = {
          question: question.questionText,
          answer: 'No documents available for analysis',
          confidence: 0,
          sources: [],
          keyFindings: [],
          evidence: [],
          risks: [],
          detailedEvidence: []
        };
        await this.saveAnswer(dealId, question.questionKey, question.questionText, noDocsResult);
        return noDocsResult;
      }

      // STEP 1: Extract evidence using paginated document loading for large datarooms
      console.log(`📊 [MULTI-PASS] Step 1: Extracting evidence using ${batchPlan.samplingStrategy} strategy`);
      const evidence = await this.extractEvidenceWithPagination(dealId, question, batchPlan);
      console.log(`📋 [MULTI-PASS] Extracted evidence from ${evidence.length} documents`);

      // STEP 2: Compile comprehensive answer using batched synthesis (EXACT IP pattern)
      console.log(`🔄 [MULTI-PASS] Step 2: Compiling comprehensive answer from ${evidence.length} evidence pieces`);
      const answer = await this.compileComprehensiveAnswer(question, evidence);

      const answerData = {
        question: question.questionText,
        answer: answer.answer || 'No answer generated',
        confidence: answer.confidence || 50,
        sources: answer.sources || [],
        keyFindings: answer.keyFindings || [],
        evidence: answer.keyFindings || [], // For backwards compatibility
        risks: answer.recommendations || [],
        detailedEvidence: answer.detailedEvidence || [],
        evidenceSummary: answer.evidenceSummary || '',
        researchAssessment: answer.researchAssessment || ''
      };

      await this.saveAnswer(dealId, question.questionKey, question.questionText, answerData);
      console.log(`✅ [MULTI-PASS] Completed research question: ${question.questionKey}`);

      return answerData;

    } catch (error) {
      console.error(`❌ Error processing research question:`, error);
      throw error;
    }
  }

  /**
   * Extract evidence using paginated document loading for large datarooms
   * Processes documents in pages to avoid memory exhaustion
   */
  private async extractEvidenceWithPagination(
    dealId: number, 
    question: QueueItem, 
    batchPlan: { totalDocuments: number; samplingStrategy: string }
  ): Promise<ResearchEvidence[]> {
    const evidence: ResearchEvidence[] = [];
    const pageSize = 100; // Load 100 documents at a time
    const maxPages = batchPlan.samplingStrategy === 'sampled' ? 10 : Math.ceil(batchPlan.totalDocuments / pageSize);
    const totalPages = Math.min(maxPages, Math.ceil(batchPlan.totalDocuments / pageSize));
    
    console.log(`📄 [PAGINATED] Processing ${batchPlan.totalDocuments} documents in ${totalPages} pages (strategy: ${batchPlan.samplingStrategy})`);
    
    for (let page = 1; page <= totalPages; page++) {
      console.log(`📦 [PAGINATED] Loading page ${page}/${totalPages}...`);
      
      // For sampled strategy, distribute pages across the dataroom
      let actualPage = page;
      if (batchPlan.samplingStrategy === 'sampled') {
        const pageSpacing = Math.floor(Math.ceil(batchPlan.totalDocuments / pageSize) / maxPages);
        actualPage = 1 + ((page - 1) * Math.max(1, pageSpacing));
      }
      
      const result = await storage.getDocumentsByDealIdPaginated(dealId, actualPage, pageSize, false);
      const documents = result.documents || [];
      
      if (documents.length === 0) {
        console.log(`⚠️ [PAGINATED] No documents on page ${actualPage}, stopping pagination`);
        break;
      }
      
      console.log(`📄 [PAGINATED] Processing ${documents.length} documents from page ${actualPage}`);
      
      // Process this page of documents using the existing batch extraction
      const pageEvidence = await this.extractEvidenceFromAllDocuments(documents, question);
      evidence.push(...pageEvidence);
      
      console.log(`✅ [PAGINATED] Page ${page}: ${pageEvidence.length}/${documents.length} documents had evidence (total: ${evidence.length})`);
      
      // For large datarooms, limit total evidence to prevent synthesis overload
      if (evidence.length >= 200) {
        console.log(`📊 [PAGINATED] Evidence limit reached (200), stopping early`);
        break;
      }
    }
    
    console.log(`📋 [PAGINATED] Total evidence extracted: ${evidence.length} documents`);
    return evidence;
  }

  /**
   * Extract evidence from ALL documents in batches (EXACT IP pattern)
   * Processes documents in parallel batches with individual GPT calls per document
   */
  private async extractEvidenceFromAllDocuments(documents: any[], question: QueueItem): Promise<ResearchEvidence[]> {
    console.log(`📄 [MULTI-PASS] Starting evidence extraction from ${documents.length} documents`);
    
    const batchSize = 40; // Same as IP
    const evidence: ResearchEvidence[] = [];
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(documents.length / batchSize);
      console.log(`📦 Processing document batch ${batchNum}/${totalBatches} (${batch.length} documents)`);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (doc) => this.extractEvidenceFromDocument(doc, question))
      );
      
      const validEvidence = batchResults
        .filter((result): result is PromiseFulfilledResult<ResearchEvidence> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value)
        .filter(docEvidence => 
          docEvidence && docEvidence.relevantContent && docEvidence.relevantContent.length > 0
        );
      
      evidence.push(...validEvidence);
      console.log(`✅ Batch ${batchNum} completed: ${validEvidence.length}/${batch.length} documents had relevant evidence`);
    }
    
    console.log(`📋 [MULTI-PASS] Total evidence extracted: ${evidence.length}/${documents.length} documents`);
    return evidence;
  }

  /**
   * Extract specific evidence from a single document (EXACT IP pattern)
   * Makes individual GPT-4o call per document for thorough extraction
   */
  private async extractEvidenceFromDocument(doc: any, question: QueueItem): Promise<ResearchEvidence | null> {
    try {
      // Use ONLY AI summary - handle BOTH string and object formats
      const aiSummary = doc.aiSummary;
      if (!aiSummary) return null;
      
      let content: string;
      
      if (typeof aiSummary === 'string') {
        content = aiSummary;
      } else if (typeof aiSummary === 'object') {
        content = [
          aiSummary.executiveSummary || '',
          aiSummary.documentType ? `Document Type: ${aiSummary.documentType}` : '',
          aiSummary.criticalFindings?.length ? `Critical Findings: ${aiSummary.criticalFindings.join('; ')}` : '',
          aiSummary.keyFinancialData?.length ? `Financial Data: ${aiSummary.keyFinancialData.join('; ')}` : '',
          aiSummary.riskAssessment?.length ? `Risk Assessment: ${aiSummary.riskAssessment.join('; ')}` : '',
          aiSummary.neutralFindings?.length ? `Neutral Findings: ${aiSummary.neutralFindings.join('; ')}` : '',
          aiSummary.strategicImplications || ''
        ].filter(s => s).join('\n\n');
        
        if (!content || content.trim().length === 0) {
          content = JSON.stringify(aiSummary);
        }
      } else {
        content = String(aiSummary);
      }
      
      if (!content || content.trim().length === 0) {
        return null;
      }

      const prompt = `You are an expert research analyst conducting comprehensive investment analysis. Your task is to EXHAUSTIVELY EXTRACT ALL SPECIFIC DETAILS from this document.

DOCUMENT: ${doc.name}
AI SUMMARY (COMPLETE): ${content}

QUESTION: "${question.questionText}"
ANALYSIS TASK: ${question.prompt}

CRITICAL EXTRACTION REQUIREMENTS - YOU MUST EXTRACT EVERY DETAIL:

1. EXTRACT MARKET & COMPETITIVE DATA:
   - Market size figures (TAM, SAM, SOM)
   - Growth rates and projections
   - Competitor names and market positions
   - Competitive advantages and differentiators
   - Market share data

2. EXTRACT TECHNOLOGY & PRODUCT DATA:
   - Technology descriptions and capabilities
   - Product features and specifications
   - Technical advantages and innovations
   - Scalability and maturity indicators
   - Development stage and roadmap

3. EXTRACT STRATEGIC INFORMATION:
   - Business model details
   - Revenue streams and monetization
   - Partnership and expansion opportunities
   - Risk factors and challenges
   - Growth strategies

4. EXTRACT VALIDATION DATA:
   - Customer testimonials and case studies
   - Traction metrics (users, revenue, growth)
   - Regulatory approvals and compliance
   - Industry certifications and standards

5. DO NOT PARAPHRASE - COPY VERBATIM:
   - If the summary says "TAM of $50B growing at 15% CAGR", copy it EXACTLY
   - If it mentions "3 major competitors: CompanyA, CompanyB, CompanyC", copy it EXACTLY
   - Include ALL specific details found

Your relevantContent array should contain 5-20+ detailed extractions per document.

Respond in JSON format:
{
  "relevantContent": ["DETAILED extraction 1 with specific data", "DETAILED extraction 2 with metrics", "DETAILED extraction 3...", ...],
  "hasRelevantInfo": true/false,
  "confidence": 0-100,
  "keyFindings": ["Specific finding with data", "Specific finding with metrics", ...],
  "documentSummary": "COMPREHENSIVE breakdown of ALL relevant research information from this document"
}

REMEMBER: Extract EVERYTHING research-relevant - more is better!`;

      try {
        const response = await resilientOpenAI.createChatCompletion({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 8000
        }, {
          maxRetries: 3,
          timeout: 90000,
          onRetry: (attempt: number, error: Error) => {
            console.warn(`🔄 Retrying evidence extraction for ${doc.name} (attempt ${attempt}): ${error.message}`);
          }
        });
        
        const analysis = JSON.parse(response.choices[0].message.content || '{}');
        
        return {
          documentName: doc.name,
          documentId: doc.id,
          relevantContent: analysis.relevantContent || [],
          hasRelevantInfo: analysis.hasRelevantInfo || false,
          confidence: analysis.confidence || 0,
          keyFindings: analysis.keyFindings || [],
          documentSummary: analysis.documentSummary || '',
          fullContent: content
        };
        
      } catch (extractError) {
        console.error(`Error extracting evidence from ${doc.name}:`, extractError);
        return {
          documentName: doc.name,
          documentId: doc.id,
          relevantContent: [],
          hasRelevantInfo: false,
          confidence: 0,
          keyFindings: [],
          documentSummary: 'Analysis timeout - using AI summary excerpt',
          fullContent: content
        };
      }

    } catch (error) {
      console.error(`⚠️ Error extracting evidence from ${doc.name}:`, error);
      return null;
    }
  }

  /**
   * Compile comprehensive answer from evidence using TOKEN-BASED BATCHING (EXACT IP pattern)
   * Step 1: Get partial answers from each batch
   * Step 2: Synthesize all partial answers into final comprehensive answer
   */
  private async compileComprehensiveAnswer(question: QueueItem, evidence: ResearchEvidence[]): Promise<any> {
    console.log(`🔄 [BATCHED COMPILATION] Starting research analysis for "${question.questionText}" with ${evidence.length} documents`);
    
    if (evidence.length === 0) {
      return {
        question: question.questionText,
        answer: 'No relevant information found in the available documents.',
        confidence: 0,
        sources: [],
        detailedEvidence: [],
        keyFindings: [],
        evidenceSummary: 'No evidence available',
        researchAssessment: 'Unable to assess due to lack of relevant documentation',
        recommendations: ['Obtain relevant documentation for comprehensive analysis']
      };
    }

    // TOKEN-BASED BATCHING (EXACT IP pattern)
    const MAX_BATCH_TOKENS = 6000;
    const batches: ResearchEvidence[][] = [];
    let currentBatch: ResearchEvidence[] = [];
    let currentBatchTokens = 0;
    
    for (const ev of evidence) {
      const evTokens = resilientOpenAI.countBatchTokens([ev]);
      
      if (currentBatchTokens + evTokens > MAX_BATCH_TOKENS && currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [ev];
        currentBatchTokens = evTokens;
      } else {
        currentBatch.push(ev);
        currentBatchTokens += evTokens;
      }
    }
    
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }
    
    console.log(`📦 Processing ${evidence.length} documents in ${batches.length} token-optimized batches`);
    
    // Step 1: Get partial answers from each batch
    const partialAnswers: any[] = [];
    const partialResultsKey = `research-partial-${question.questionKey}`;
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`📦 Processing research batch ${i + 1}/${batches.length} (${batch.length} documents)`);
      
      const batchPrompt = `You are a senior research analyst. Analyze evidence from ${batch.length} documents to answer: "${question.questionText}"

Evidence:
${batch.map(ev => {
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

CRITICAL: Extract ALL specific research details from the AI SUMMARY CONTENT above (market data, competitive analysis, technology details, validation metrics). Respond in JSON:
{
  "answer": "Detailed extraction with specific research data and details from the AI summaries",
  "confidence": 0-100,
  "keyFindings": ["Specific finding 1", "Specific finding 2"],
  "sources": ["doc1", "doc2"]
}`;

      try {
        const response = await resilientOpenAI.createChatCompletion({
          model: "gpt-4o",
          messages: [{ role: "user", content: batchPrompt }],
          response_format: { type: "json_object" },
          temperature: 0.2,
          max_tokens: 8000
        }, {
          maxRetries: 4,
          timeout: 120000,
          onRetry: (attempt, error) => {
            console.warn(`🔄 Retrying research batch ${i + 1}/${batches.length} (attempt ${attempt}): ${error.message}`);
          }
        });
        
        const batchAnswer = JSON.parse(response.choices[0].message.content || '{}');
        partialAnswers.push(batchAnswer);
        
        // Save partial results for recovery
        if (!(global as any)[partialResultsKey]) {
          (global as any)[partialResultsKey] = [];
        }
        (global as any)[partialResultsKey].push(batchAnswer);
        
        console.log(`✅ Research Batch ${i + 1}/${batches.length} completed`);
      } catch (error: any) {
        console.error(`❌ Error in research batch ${i + 1}:`, error);
        const errorAnswer = {
          answer: `Error processing batch ${i + 1}: ${error.message}`,
          confidence: 0,
          keyFindings: [],
          sources: batch.map(e => e.documentName)
        };
        partialAnswers.push(errorAnswer);
      }
    }
    
    // Step 2: Synthesize all partial answers into final comprehensive answer
    console.log(`🔄 Synthesizing ${partialAnswers.length} research partial answers into final answer`);
    
    const synthesisPrompt = `You are a senior research analyst. Synthesize these partial analyses into ONE comprehensive answer for: "${question.questionText}"

Partial Analyses:
${partialAnswers.map((pa, i) => `
BATCH ${i + 1}:
${pa.answer}
KEY FINDINGS: ${pa.keyFindings?.join('; ') || 'None'}
`).join('\n')}

CRITICAL: Create ONE comprehensive answer that:
1. Extracts ALL specific details (market data, competitive analysis, technology details) from all batches
2. Lists ALL relevant findings with complete details
3. Provides exhaustive analysis of the research question
4. Cites specific document sections and data points

FORMAT REQUIREMENTS FOR "answer" FIELD:
- CRITICAL: Each bullet point MUST be on its own line - NEVER put multiple bullets on the same line
- Use markdown bullets (•) for lists of evidence/findings
- Use **bold** for key terms, metrics, company names, and important data
- Structure with clear sections if multiple topics

CORRECT BULLET FORMAT (each on separate line):
"The research analysis reveals the following:

• **Market Size**: TAM of **$50B** with **15% CAGR** growth rate

• **Key Competitors**: **CompanyA** (**35% market share**), **CompanyB** (**25% share**)

• **Technology Advantage**: **Proprietary AI** with **3 granted patents**"

WRONG (inline bullets - NEVER DO THIS):
"• Market: $50B • CAGR: 15% • Patents: 3"

Respond in JSON:
{
  "answer": "Comprehensive synthesis with ALL specific research details formatted with markdown bullets and bold for key terms",
  "confidence": 0-100,
  "keyFindings": ["All key findings combined"],
  "evidenceSummary": "Summary of all evidence",
  "researchAssessment": "Overall research assessment",
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}`;

    try {
      const response = await resilientOpenAI.createChatCompletion({
        model: "gpt-4o",
        messages: [{ role: "user", content: synthesisPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 16000
      }, {
        maxRetries: 5,
        timeout: 300000,
        onRetry: (attempt, error) => {
          console.warn(`🔄 Retrying research final synthesis (attempt ${attempt}): ${error.message}`);
        }
      });

      const compiledAnswer = JSON.parse(response.choices[0].message.content || '{}');
      
      console.log(`✅ Research final synthesis completed for "${question.questionText}"`);
      
      // Cleanup partial results cache
      if ((global as any)[partialResultsKey]) {
        delete (global as any)[partialResultsKey];
      }
      
      return {
        question: question.questionText,
        answer: formatAgentAnswer(compiledAnswer.answer || 'Unable to compile answer from available evidence'),
        confidence: compiledAnswer.confidence || 30,
        sources: evidence.map(e => e.documentName),
        detailedEvidence: evidence,
        keyFindings: compiledAnswer.keyFindings || [],
        evidenceSummary: compiledAnswer.evidenceSummary || 'Evidence compiled from multiple sources',
        researchAssessment: compiledAnswer.researchAssessment || 'Assessment completed',
        recommendations: compiledAnswer.recommendations || []
      };
      
    } catch (synthesisError: any) {
      console.error(`❌ Research synthesis failed:`, synthesisError);
      
      // Fallback: recover from partial results
      const cachedPartials = (global as any)[partialResultsKey];
      if (cachedPartials && cachedPartials.length > 0) {
        console.log(`📦 Synthesis failed, recovering from ${cachedPartials.length} cached partial results`);
        
        const combinedAnswer = cachedPartials
          .map((pa: any) => pa.answer || '')
          .filter((a: string) => a.trim().length > 0)
          .join('\n\n');
        
        const combinedFindings = cachedPartials
          .flatMap((pa: any) => pa.keyFindings || [])
          .filter((f: string) => f && f.trim().length > 0);
        
        return {
          question: question.questionText,
          answer: combinedAnswer || 'Partial research analysis recovered from cached results',
          confidence: 60,
          sources: evidence.map(e => e.documentName),
          detailedEvidence: evidence,
          keyFindings: combinedFindings,
          evidenceSummary: `Recovery from ${cachedPartials.length} partial analyses`,
          researchAssessment: 'Partial assessment from cached results',
          recommendations: ['Complete re-analysis recommended']
        };
      }
      
      return {
        question: question.questionText,
        answer: 'Error occurred during research analysis synthesis',
        confidence: 0,
        sources: evidence.map(e => e.documentName),
        detailedEvidence: evidence,
        keyFindings: [],
        evidenceSummary: 'Error in analysis compilation',
        researchAssessment: 'Unable to complete assessment',
        recommendations: ['Manual research review recommended']
      };
    }
  }

  private async saveAnswer(dealId: number, questionKey: string, questionText: string, answerData: any): Promise<void> {
    const existingAnalysis = await storage.getAgentAnalysis(dealId, 'Research');
    const research_answers = existingAnalysis?.research_answers || {};
    
    research_answers[questionKey] = answerData;

    if (existingAnalysis) {
      console.log(`💾 Saving research answer for question "${questionKey}" to analysis ID ${existingAnalysis.id}`);
      await storage.updateAgentAnalysisByDealAndType(dealId, 'Research', {
        research_answers,
        updatedAt: new Date()
      });
      console.log(`✅ Successfully saved research answer for question "${questionKey}"`);
    } else {
      console.log(`💾 Creating new research analysis for deal ${dealId} with first answer`);
      await storage.createAgentAnalysis({
        dealId,
        agentType: 'Research',
        status: 'In Progress',
        research_answers
      });
      console.log(`✅ Created new research analysis for deal ${dealId}`);
    }
  }

  async getQueueStatus(dealId: number): Promise<{
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
    progress: number;
    currentQuestion: string | null;
    currentQuestionId: string | null;
    isProcessing: boolean;
  }> {
    const questions = await db
      .select()
      .from(agentQuestionQueue)
      .where(
        and(
          eq(agentQuestionQueue.dealId, dealId),
          eq(agentQuestionQueue.agentType, 'research'),
          sql`${agentQuestionQueue.status} != 'cancelled'`
        )
      );

    const total = questions.length;
    const pending = questions.filter(q => q.status === 'pending').length;
    const running = questions.filter(q => q.status === 'running').length;
    const completed = questions.filter(q => q.status === 'completed').length;
    const failed = questions.filter(q => q.status === 'failed').length;
    
    const cancelledResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentQuestionQueue)
      .where(
        and(
          eq(agentQuestionQueue.dealId, dealId),
          eq(agentQuestionQueue.agentType, 'research'),
          eq(agentQuestionQueue.status, 'cancelled')
        )
      );
    const cancelled = Number(cancelledResult[0]?.count || 0);

    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    const runningQuestion = questions.find(q => q.status === 'running');
    const currentQuestion = runningQuestion?.questionText || null;
    const currentQuestionId = runningQuestion?.questionKey || null;
    const isProcessing = this.processingQueues.get(dealId) || false;

    return {
      total,
      pending,
      running,
      completed,
      failed,
      cancelled,
      progress,
      currentQuestion,
      currentQuestionId,
      isProcessing
    };
  }

  private async broadcastQueueProgress(dealId: number): Promise<void> {
    try {
      const status = await this.getQueueStatus(dealId);
      
      websocketManager.broadcast('research_queue_progress', status, dealId);
    } catch (error) {
      console.error('Error broadcasting research queue progress:', error);
    }
  }

  async cancelQueue(dealId: number): Promise<void> {
    const abortController = this.activeProcessors.get(dealId);
    if (abortController) {
      abortController.abort();
      console.log(`🛑 Cancelled research queue processing for deal ${dealId}`);
    }
    
    // Clear processing state - EXACT Legal pattern
    this.processingQueues.delete(dealId);
    this.activeProcessors.delete(dealId);

    // Mark ALL pending/running questions as cancelled - EXACT Legal pattern
    await db
      .update(agentQuestionQueue)
      .set({
        status: 'cancelled',
        updatedAt: new Date()
      })
      .where(
        and(
          eq(agentQuestionQueue.dealId, dealId),
          eq(agentQuestionQueue.agentType, 'research')
        )
      );
      
    console.log(`✅ Research queue cancelled and processing state cleared for deal ${dealId}`);
  }

  isProcessing(dealId: number): boolean {
    return this.processingQueues.get(dealId) || false;
  }
}

export const researchQuestionQueue = ResearchQuestionQueueService.getInstance();
