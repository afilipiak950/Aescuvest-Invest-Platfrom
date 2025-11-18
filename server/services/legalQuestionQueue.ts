/**
 * Legal Question Queue Service
 * Sequential processing of legal analysis questions with persistence
 * Processes one question at a time per deal to ensure quality and avoid rate limits
 */

import { db } from '../db';
import { agentQuestionQueue, agentAnalyses } from '../../shared/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { storage } from '../storage';
import { COMPREHENSIVE_LEGAL_QUESTIONS } from '../comprehensiveLegalAnalysisService';
import OpenAI from 'openai';
import { websocketManager } from './websocketManager';

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

export class LegalQuestionQueueService {
  private static instance: LegalQuestionQueueService;
  private processingQueues = new Map<number, boolean>(); // Track which deals are currently processing
  private activeProcessors = new Map<number, AbortController>(); // For cancellation

  static getInstance(): LegalQuestionQueueService {
    if (!LegalQuestionQueueService.instance) {
      LegalQuestionQueueService.instance = new LegalQuestionQueueService();
    }
    return LegalQuestionQueueService.instance;
  }

  /**
   * Initialize service and resume any pending queues
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing Legal Question Queue Service...');
      
      // Find all deals with pending/running questions
      const pendingQueues = await db
        .select({ dealId: agentQuestionQueue.dealId })
        .from(agentQuestionQueue)
        .where(
          and(
            eq(agentQuestionQueue.agentType, 'legal'),
            eq(agentQuestionQueue.status, 'pending')
          )
        )
        .groupBy(agentQuestionQueue.dealId);

      console.log(`📋 Found ${pendingQueues.length} deals with pending legal questions`);

      // Resume processing for each deal
      for (const { dealId } of pendingQueues) {
        console.log(`🔄 Resuming legal question queue for deal ${dealId}`);
        this.processQueue(dealId).catch(err => 
          console.error(`❌ Error resuming queue for deal ${dealId}:`, err)
        );
      }

      console.log('✅ Legal Question Queue Service initialized');
    } catch (error) {
      console.error('❌ Error initializing Legal Question Queue Service:', error);
    }
  }

  /**
   * Start processing all legal questions for a deal
   */
  async startAllQuestions(dealId: number): Promise<{ success: boolean; queuedCount: number }> {
    try {
      console.log(`🚀 Starting all legal questions for deal ${dealId}`);

      // Clear any existing pending/failed questions for this deal
      await db
        .delete(agentQuestionQueue)
        .where(
          and(
            eq(agentQuestionQueue.dealId, dealId),
            eq(agentQuestionQueue.agentType, 'legal')
          )
        );

      // Get existing analysis to check which questions are already answered
      const existingAnalysis = await storage.getAgentAnalysis(dealId, 'legal');
      const answeredQuestions = existingAnalysis?.legalAnswers ? Object.keys(existingAnalysis.legalAnswers) : [];

      console.log(`📊 Existing analysis has ${answeredQuestions.length} answered questions`);

      // Queue all legal questions
      let queuedCount = 0;
      for (const question of COMPREHENSIVE_LEGAL_QUESTIONS) {
        // Skip already answered questions unless forcing rerun
        if (answeredQuestions.includes(question.id)) {
          console.log(`⏭️ Skipping already answered question: ${question.id}`);
          continue;
        }

        await db.insert(agentQuestionQueue).values({
          dealId,
          agentType: 'legal',
          questionKey: question.id,
          questionText: question.question,
          prompt: question.analysisPrompt,
          status: 'pending',
          priority: 0, // Normal priority
        });

        queuedCount++;
      }

      console.log(`✅ Queued ${queuedCount} legal questions for deal ${dealId}`);

      // Start processing the queue
      this.processQueue(dealId);

      return { success: true, queuedCount };
    } catch (error) {
      console.error(`❌ Error starting legal questions for deal ${dealId}:`, error);
      throw error;
    }
  }

  /**
   * Process queue for a specific deal (FIFO with priority)
   */
  private async processQueue(dealId: number): Promise<void> {
    // Check if already processing
    if (this.processingQueues.get(dealId)) {
      console.log(`⏸️ Queue already processing for deal ${dealId}`);
      return;
    }

    this.processingQueues.set(dealId, true);
    const abortController = new AbortController();
    this.activeProcessors.set(dealId, abortController);

    try {
      console.log(`▶️ Starting queue processor for deal ${dealId}`);

      while (!abortController.signal.aborted) {
        // Get next question to process (highest priority first, then FIFO)
        const nextQuestion = await db
          .select()
          .from(agentQuestionQueue)
          .where(
            and(
              eq(agentQuestionQueue.dealId, dealId),
              eq(agentQuestionQueue.agentType, 'legal'),
              eq(agentQuestionQueue.status, 'pending')
            )
          )
          .orderBy(
            desc(agentQuestionQueue.priority), // Higher priority first
            asc(agentQuestionQueue.createdAt)   // Then FIFO
          )
          .limit(1);

        if (nextQuestion.length === 0) {
          console.log(`✅ No more pending questions for deal ${dealId}`);
          break;
        }

        const question = nextQuestion[0] as QueueItem;
        console.log(`🔍 Processing question ${question.id}: "${question.questionText}"`);

        // Mark as running
        await db
          .update(agentQuestionQueue)
          .set({ 
            status: 'running',
            updatedAt: new Date()
          })
          .where(eq(agentQuestionQueue.id, question.id));

        // Broadcast progress update
        await this.broadcastQueueProgress(dealId);

        try {
          // Process the question
          const result = await this.processQuestion(dealId, question);

          // Mark as completed
          await db
            .update(agentQuestionQueue)
            .set({
              status: 'completed',
              result,
              processedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(agentQuestionQueue.id, question.id));

          console.log(`✅ Completed question ${question.id}`);

        } catch (error) {
          console.error(`❌ Error processing question ${question.id}:`, error);

          // Mark as failed
          await db
            .update(agentQuestionQueue)
            .set({
              status: 'failed',
              errorMessage: error.message || 'Unknown error',
              updatedAt: new Date()
            })
            .where(eq(agentQuestionQueue.id, question.id));
        }

        // Broadcast progress update
        await this.broadcastQueueProgress(dealId);

        // Small delay between questions to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`🏁 Queue processing completed for deal ${dealId}`);

    } catch (error) {
      console.error(`❌ Queue processor error for deal ${dealId}:`, error);
    } finally {
      this.processingQueues.delete(dealId);
      this.activeProcessors.delete(dealId);
    }
  }

  /**
   * Process a single question
   */
  private async processQuestion(dealId: number, question: QueueItem): Promise<any> {
    try {
      console.log(`🔬 Analyzing question: ${question.questionText}`);

      // Get all legal documents for this deal
      const documentsResult = await storage.getDocumentsByDealIdPaginated(dealId, 1, 10000);
      const dealDocuments = documentsResult.documents || [];

      console.log(`📄 Found ${dealDocuments.length} documents for analysis`);

      if (dealDocuments.length === 0) {
        return {
          question: question.questionText,
          answer: 'No documents available for analysis',
          confidence: 0,
          sources: [],
          keyFindings: []
        };
      }

      // Build the analysis prompt with intelligent token limiting
      // GPT-4o max context: 128k tokens (~96k words or ~384k characters)
      // Reserve ~30k tokens for question, system prompt, and response
      // Use ~90k tokens (~360k chars) for documents
      const MAX_CONTEXT_CHARS = 360000;
      const MAX_CHARS_PER_DOC = 800; // Reduced from 2000 to fit more docs
      
      let contextChars = 0;
      const documentContext = dealDocuments
        .map((doc, idx) => {
          // Handle aiSummary/summary that might be objects or strings
          let summaryText = 'No summary';
          if (doc.aiSummary) {
            summaryText = typeof doc.aiSummary === 'string' ? doc.aiSummary : JSON.stringify(doc.aiSummary);
          } else if (doc.summary) {
            summaryText = typeof doc.summary === 'string' ? doc.summary : JSON.stringify(doc.summary);
          }
          const summary = summaryText.substring(0, 500);
          
          // Handle text/ocrText
          const textContent = doc.ocrText || doc.text || '';
          const text = (typeof textContent === 'string' ? textContent : String(textContent)).substring(0, MAX_CHARS_PER_DOC);
          
          const docContent = `Document ${idx + 1}: ${doc.name}\nSummary: ${summary}\n${text ? `Content: ${text}...` : ''}`;
          
          // Check if adding this doc would exceed limit
          if (contextChars + docContent.length > MAX_CONTEXT_CHARS) {
            return null; // Skip this document
          }
          
          contextChars += docContent.length;
          return docContent;
        })
        .filter(Boolean)
        .join('\n\n---\n\n');
      
      console.log(`📊 Using ${contextChars.toLocaleString()} characters from ${dealDocuments.length} documents (est. ${Math.round(contextChars / 4)} tokens)`);

      const fullPrompt = `You are a legal analyst conducting due diligence. Analyze the following documents and answer this specific question:

QUESTION: ${question.questionText}

ANALYSIS FOCUS: ${question.prompt}

DOCUMENTS:
${documentContext}

Provide a detailed, evidence-based answer with:
1. Direct answer to the question
2. Key findings from the documents
3. Specific evidence and document references
4. Confidence level (0-100%)
5. Any risks or concerns identified

Format your response as JSON:
{
  "answer": "Your detailed answer here",
  "confidence": 85,
  "keyFindings": ["Finding 1", "Finding 2"],
  "evidence": ["Evidence from Document 1", "Evidence from Document 2"],
  "sources": ["Document name 1", "Document name 2"],
  "risks": ["Risk 1 if any"]
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert legal analyst specializing in due diligence. Provide thorough, evidence-based analysis.'
          },
          {
            role: 'user',
            content: fullPrompt
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const analysisResult = JSON.parse(response.choices[0].message.content || '{}');

      // Save result to agent_analyses table
      const existingAnalysis = await storage.getAgentAnalysis(dealId, 'legal');
      const legalAnswers = existingAnalysis?.legalAnswers || {};
      
      legalAnswers[question.questionKey] = {
        question: question.questionText,
        answer: analysisResult.answer || 'No answer generated',
        confidence: analysisResult.confidence || 50,
        sources: analysisResult.sources || [],
        keyFindings: analysisResult.keyFindings || [],
        evidence: analysisResult.evidence || [],
        risks: analysisResult.risks || []
      };

      if (existingAnalysis) {
        console.log(`💾 Saving legal answer for question "${question.questionKey}" to analysis ID ${existingAnalysis.id}`);
        await storage.updateAgentAnalysisByDealAndType(dealId, 'legal', {
          legalAnswers,
          updatedAt: new Date()
        });
        console.log(`✅ Successfully saved legal answer for question "${question.questionKey}"`);
      } else {
        console.log(`💾 Creating new legal analysis for deal ${dealId} with first answer`);
        await storage.createAgentAnalysis({
          dealId,
          agentType: 'legal',
          status: 'In Progress',
          legalAnswers
        });
        console.log(`✅ Created new legal analysis for deal ${dealId}`);
      }

      return analysisResult;

    } catch (error) {
      console.error(`❌ Error processing question:`, error);
      throw error;
    }
  }

  /**
   * Get queue status for a deal
   */
  async getQueueStatus(dealId: number): Promise<{
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    progress: number;
    currentQuestion: string | null;
    isProcessing: boolean;
  }> {
    const questions = await db
      .select()
      .from(agentQuestionQueue)
      .where(
        and(
          eq(agentQuestionQueue.dealId, dealId),
          eq(agentQuestionQueue.agentType, 'legal')
        )
      );

    const total = questions.length;
    const pending = questions.filter(q => q.status === 'pending').length;
    const running = questions.filter(q => q.status === 'running').length;
    const completed = questions.filter(q => q.status === 'completed').length;
    const failed = questions.filter(q => q.status === 'failed').length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    const currentQuestion = questions.find(q => q.status === 'running')?.questionText || null;
    const isProcessing = this.processingQueues.get(dealId) || false;

    return {
      total,
      pending,
      running,
      completed,
      failed,
      progress,
      currentQuestion,
      isProcessing
    };
  }

  /**
   * Broadcast queue progress via WebSocket
   */
  private async broadcastQueueProgress(dealId: number): Promise<void> {
    try {
      const status = await this.getQueueStatus(dealId);
      
      websocketManager.broadcast('legal_queue_progress', status, dealId);
    } catch (error) {
      console.error('Error broadcasting queue progress:', error);
    }
  }

  /**
   * Cancel queue processing for a deal
   */
  async cancelQueue(dealId: number): Promise<void> {
    const abortController = this.activeProcessors.get(dealId);
    if (abortController) {
      abortController.abort();
      console.log(`🛑 Cancelled queue processing for deal ${dealId}`);
    }

    // Mark all pending/running questions as cancelled
    await db
      .update(agentQuestionQueue)
      .set({ 
        status: 'cancelled',
        updatedAt: new Date()
      })
      .where(
        and(
          eq(agentQuestionQueue.dealId, dealId),
          eq(agentQuestionQueue.agentType, 'legal')
        )
      );
  }
}

// Export singleton instance
export const legalQuestionQueue = LegalQuestionQueueService.getInstance();
