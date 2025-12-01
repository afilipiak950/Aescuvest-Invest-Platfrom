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
import OpenAI from 'openai';
import { websocketManager } from './websocketManager';

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
          priority: 0
        });

        queuedCount++;
      }

      console.log(`✅ FORCE RERUN: Queued ALL ${queuedCount} research questions for deal ${dealId}`);

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

          console.log(`✅ Completed research question ${question.questionKey}`);

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

    } catch (error) {
      console.error(`❌ Research queue processor error for deal ${dealId}:`, error);
    } finally {
      this.processingQueues.delete(dealId);
      this.activeProcessors.delete(dealId);
      await this.broadcastQueueProgress(dealId);
    }
  }

  private async processQuestion(dealId: number, question: QueueItem): Promise<any> {
    try {
      console.log(`🔬 Analyzing research question: ${question.questionText}`);

      const documentsResult = await storage.getDocumentsByDealIdPaginated(dealId, 1, 10000);
      const dealDocuments = documentsResult.documents || [];

      console.log(`📄 Found ${dealDocuments.length} documents for research analysis`);

      if (dealDocuments.length === 0) {
        const noDocsResult = {
          question: question.questionText,
          answer: 'No documents available for analysis',
          confidence: 0,
          sources: [],
          keyFindings: [],
          quotes: [],
          recommendations: []
        };
        await this.saveAnswer(dealId, question.questionKey, question.questionText, noDocsResult);
        return noDocsResult;
      }

      const MAX_CONTEXT_CHARS = 360000;
      const MAX_CHARS_PER_DOC = 800;
      
      let contextChars = 0;
      const documentContext = dealDocuments
        .map((doc: any, idx: number) => {
          let summaryText = 'No summary';
          if (doc.aiSummary) {
            summaryText = typeof doc.aiSummary === 'string' ? doc.aiSummary : JSON.stringify(doc.aiSummary);
          } else if (doc.summary) {
            summaryText = typeof doc.summary === 'string' ? doc.summary : JSON.stringify(doc.summary);
          }
          const summary = summaryText.substring(0, 500);
          
          const textContent = doc.ocrText || doc.text || '';
          const text = (typeof textContent === 'string' ? textContent : String(textContent)).substring(0, MAX_CHARS_PER_DOC);
          
          const docContent = `Document ${idx + 1}: ${doc.name}\nSummary: ${summary}\n${text ? `Content: ${text}...` : ''}`;
          
          if (contextChars + docContent.length > MAX_CONTEXT_CHARS) {
            return null;
          }
          
          contextChars += docContent.length;
          return docContent;
        })
        .filter(Boolean)
        .join('\n\n---\n\n');
      
      console.log(`📊 Using ${contextChars.toLocaleString()} characters from ${dealDocuments.length} documents`);

      const fullPrompt = `You are a research analyst conducting comprehensive due diligence. Analyze the following documents and answer this specific question:

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
            content: 'You are an expert research analyst specializing in investment due diligence. Provide thorough, evidence-based analysis.'
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

      const answerData = {
        question: question.questionText,
        answer: analysisResult.answer || 'No answer generated',
        confidence: analysisResult.confidence || 50,
        sources: analysisResult.sources || [],
        keyFindings: analysisResult.keyFindings || [],
        evidence: analysisResult.evidence || [],
        risks: analysisResult.risks || []
      };

      await this.saveAnswer(dealId, question.questionKey, question.questionText, answerData);

      return analysisResult;

    } catch (error) {
      console.error(`❌ Error processing research question:`, error);
      throw error;
    }
  }

  private async saveAnswer(dealId: number, questionKey: string, questionText: string, answerData: any): Promise<void> {
    const existingAnalysis = await storage.getAgentAnalysis(dealId, 'research');
    const research_answers = existingAnalysis?.research_answers || {};
    
    research_answers[questionKey] = answerData;

    if (existingAnalysis) {
      console.log(`💾 Saving research answer for question "${questionKey}" to analysis ID ${existingAnalysis.id}`);
      await storage.updateAgentAnalysisByDealAndType(dealId, 'research', {
        research_answers,
        updatedAt: new Date()
      });
      console.log(`✅ Successfully saved research answer for question "${questionKey}"`);
    } else {
      console.log(`💾 Creating new research analysis for deal ${dealId} with first answer`);
      await storage.createAgentAnalysis({
        dealId,
        agentType: 'research',
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

    await db
      .update(agentQuestionQueue)
      .set({
        status: 'cancelled',
        updatedAt: new Date()
      })
      .where(
        and(
          eq(agentQuestionQueue.dealId, dealId),
          eq(agentQuestionQueue.agentType, 'research'),
          eq(agentQuestionQueue.status, 'pending')
        )
      );
  }

  isProcessing(dealId: number): boolean {
    return this.processingQueues.get(dealId) || false;
  }
}

export const researchQuestionQueue = ResearchQuestionQueueService.getInstance();
