import { db } from "../../db";
import { 
  unifiedAgentRuns, 
  unifiedAgentAnswers,
  unifiedAgentQuestions,
  UnifiedAgentRun,
  UnifiedAgentAnswer,
  UnifiedAgentQuestion,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { retrieveWithExpansion, EvidencePack } from "./retrieval";
import { 
  generateSystemPrompt, 
  generateAnalysisPrompt, 
  calculateConfidence as calculatePromptConfidence 
} from "./prompts";
import { generateAgentAnswer } from "./llmClient";
import { 
  validateAgentAnswer, 
  calibrateConfidence, 
  selfCheckAnswer,
  getAgentSchema 
} from "./validator";
import { websocketManager } from "../websocketManager";
import { v4 as uuidv4 } from "uuid";

export interface OrchestratorOptions {
  dealId: number;
  agentType: string;
  runId?: string;
  broadcastProgress?: boolean;
  maxRetries?: number;
}

export interface QuestionResult {
  questionId: string;
  success: boolean;
  answer?: UnifiedAgentAnswer;
  error?: string;
  processingTime: number;
}

export interface OrchestratorResult {
  runId: string;
  success: boolean;
  completedQuestions: number;
  failedQuestions: number;
  averageConfidence: number;
  results: QuestionResult[];
  errors: string[];
}

/**
 * Get questions for a specific agent type
 */
async function getAgentQuestions(agentType: string): Promise<UnifiedAgentQuestion[]> {
  const questions = await db
    .select()
    .from(unifiedAgentQuestions)
    .where(
      and(
        eq(unifiedAgentQuestions.agentType, agentType),
        eq(unifiedAgentQuestions.isActive, true)
      )
    )
    .orderBy(unifiedAgentQuestions.priority);
    
  return questions;
}

/**
 * Process a single question
 */
async function processQuestion(
  question: UnifiedAgentQuestion,
  dealId: number,
  agentType: string,
  runId: string
): Promise<QuestionResult> {
  const startTime = Date.now();
  console.log(`\n📝 Processing question: ${question.question}`);
  
  try {
    // Step 1: Retrieve evidence using multi-query expansion
    console.log(`🔍 Retrieving evidence for question ${question.questionId}...`);
    const evidencePacks = await retrieveWithExpansion(
      dealId,
      question.question,
      agentType,
      15 // Top 15 chunks
    );
    
    if (!evidencePacks || evidencePacks.length === 0 || evidencePacks[0].chunks.length === 0) {
      console.warn(`⚠️ No evidence found for question ${question.questionId}`);
      
      // Create low-confidence answer
      const lowConfAnswer: Partial<UnifiedAgentAnswer> = {
        dealId,
        runId,
        agentType,
        questionId: question.questionId,
        answer: "Insufficient evidence available to provide a comprehensive answer. Additional documentation may be required.",
        confidence: 0.2,
        sources: [],
        keyFindings: [],
        recommendations: ["Obtain additional documentation relevant to this question"],
        riskScore: 5,
        processingTime: Date.now() - startTime,
      };
      
      const [insertedAnswer] = await db.insert(unifiedAgentAnswers).values(lowConfAnswer).returning();
      
      return {
        questionId: question.questionId,
        success: true,
        answer: insertedAnswer,
        processingTime: Date.now() - startTime,
      };
    }
    
    const evidencePack = evidencePacks[0];
    
    // Step 2: Prepare evidence text
    const evidenceText = evidencePack.chunks
      .map((chunk, idx) => 
        `[Source ${idx + 1}: ${chunk.documentName}]\n${chunk.chunkText}\n`
      )
      .join("\n---\n");
    
    // Step 3: Generate prompts
    const systemPrompt = generateSystemPrompt(agentType);
    const analysisPrompt = generateAnalysisPrompt({
      agentType,
      question: question.question,
      subQuestions: question.subQuestions || [],
      evidence: evidenceText,
      documentCount: evidencePack.chunks.length,
      averageSimilarity: evidencePack.averageSimilarity,
    });
    
    // Step 4: Generate answer with LLM
    console.log(`🤖 Generating ${agentType} answer...`);
    const schema = getAgentSchema(agentType);
    const llmResponse = await generateAgentAnswer(
      systemPrompt,
      analysisPrompt,
      agentType,
      schema
    );
    
    if (!llmResponse.success || !llmResponse.data) {
      throw new Error(llmResponse.error || "Failed to generate answer");
    }
    
    // Step 5: Validate answer
    console.log(`✅ Validating answer...`);
    const validation = validateAgentAnswer(llmResponse.data, agentType);
    
    if (!validation.isValid) {
      console.warn(`⚠️ Validation failed:`, validation.errors);
      // Continue with warnings rather than failing
    }
    
    const validatedData = validation.data || llmResponse.data;
    
    // Step 6: Self-check and calibrate confidence
    const selfCheck = await selfCheckAnswer(validatedData, question.question, agentType);
    
    if (!selfCheck.passed) {
      console.warn(`⚠️ Self-check issues:`, selfCheck.issues);
    }
    
    // Calculate evidence factors for confidence calibration
    const hasSpecificData = /\d+/.test(validatedData.answer); // Has numbers
    const sourceConsistency = calculateSourceConsistency(evidencePack.chunks);
    const answerCompleteness = calculateAnswerCompleteness(validatedData);
    
    const calibratedConfidence = calibrateConfidence(
      validatedData.confidence * selfCheck.confidenceAdjustment,
      {
        documentCount: evidencePack.chunks.length,
        averageSimilarity: evidencePack.averageSimilarity,
        hasSpecificData,
        sourceConsistency,
        answerCompleteness,
      }
    );
    
    // Step 7: Prepare answer for storage
    const answerData: Partial<UnifiedAgentAnswer> = {
      dealId,
      runId,
      agentType,
      questionId: question.questionId,
      answer: validatedData.answer,
      confidence: calibratedConfidence,
      sources: evidencePack.chunks.map(chunk => ({
        documentId: chunk.documentId,
        documentName: chunk.documentName,
        page: chunk.page,
        chunkId: chunk.chunkId,
        snippet: chunk.chunkText.substring(0, 200),
        relevance: chunk.similarity,
      })),
      keyFindings: validatedData.keyFindings || [],
      recommendations: validatedData.recommendations || [],
      riskScore: validatedData.riskScore,
      metrics: validatedData.metrics,
      processingTime: Date.now() - startTime,
      modelUsed: llmResponse.model,
      tokenCount: llmResponse.usage?.totalTokens,
    };
    
    // Step 8: Save to database
    const [insertedAnswer] = await db.insert(unifiedAgentAnswers).values(answerData).returning();
    
    console.log(`✅ Question ${question.questionId} completed with confidence ${(calibratedConfidence * 100).toFixed(1)}%`);
    
    return {
      questionId: question.questionId,
      success: true,
      answer: insertedAnswer,
      processingTime: Date.now() - startTime,
    };
    
  } catch (error: any) {
    console.error(`❌ Failed to process question ${question.questionId}:`, error);
    
    return {
      questionId: question.questionId,
      success: false,
      error: error.message || "Unknown error",
      processingTime: Date.now() - startTime,
    };
  }
}

/**
 * Calculate source consistency score
 */
function calculateSourceConsistency(chunks: any[]): number {
  if (chunks.length < 2) return 0.5;
  
  // Check how many unique documents contribute
  const uniqueDocs = new Set(chunks.map(c => c.documentId)).size;
  const docDiversity = Math.min(uniqueDocs / 3, 1); // Normalize to 0-1
  
  // Check similarity spread
  const similarities = chunks.map(c => c.similarity);
  const avgSimilarity = similarities.reduce((sum, s) => sum + s, 0) / similarities.length;
  const minSimilarity = Math.min(...similarities);
  const spread = avgSimilarity - minSimilarity;
  
  // Lower spread = more consistent
  const consistency = 1 - Math.min(spread * 2, 1);
  
  return (docDiversity + consistency) / 2;
}

/**
 * Calculate answer completeness score
 */
function calculateAnswerCompleteness(answer: any): number {
  let score = 0;
  let factors = 0;
  
  // Check answer length
  if (answer.answer && answer.answer.length > 200) {
    score += 1;
  }
  factors++;
  
  // Check for findings
  if (answer.keyFindings && answer.keyFindings.length > 0) {
    score += Math.min(answer.keyFindings.length / 3, 1);
  }
  factors++;
  
  // Check for recommendations
  if (answer.recommendations && answer.recommendations.length > 0) {
    score += Math.min(answer.recommendations.length / 3, 1);
  }
  factors++;
  
  // Check for metrics
  if (answer.metrics && answer.metrics.length > 0) {
    score += 1;
  }
  factors++;
  
  // Check for risk assessment
  if (answer.riskScore !== undefined && answer.riskScore !== null) {
    score += 1;
  }
  factors++;
  
  return score / factors;
}

/**
 * Main orchestrator function
 */
export async function orchestrateAgentAnalysis(
  options: OrchestratorOptions
): Promise<OrchestratorResult> {
  const {
    dealId,
    agentType,
    runId = uuidv4(),
    broadcastProgress = true,
    maxRetries = 2,
  } = options;
  
  console.log(`\n🎯 Starting ${agentType} analysis for deal ${dealId}`);
  console.log(`📋 Run ID: ${runId}`);
  
  const startTime = Date.now();
  const results: QuestionResult[] = [];
  const errors: string[] = [];
  
  try {
    // Get questions for this agent type
    const questions = await getAgentQuestions(agentType);
    
    if (!questions || questions.length === 0) {
      throw new Error(`No questions found for agent type: ${agentType}`);
    }
    
    console.log(`📊 Found ${questions.length} questions to process`);
    
    // Create or update run record
    const runData: Partial<UnifiedAgentRun> = {
      runId,
      dealId,
      agentType,
      status: "processing",
      progress: 0,
      totalQuestions: questions.length,
      completedQuestions: 0,
      failedQuestions: 0,
      startedAt: new Date(),
    };
    
    await db.insert(unifiedAgentRuns)
      .values(runData)
      .onConflictDoUpdate({
        target: unifiedAgentRuns.runId,
        set: runData,
      });
    
    // Process each question
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const progress = Math.floor(((i + 1) / questions.length) * 100);
      
      // Update run progress
      await db.update(unifiedAgentRuns)
        .set({
          progress,
          currentQuestion: question.question,
          updatedAt: new Date(),
        })
        .where(eq(unifiedAgentRuns.runId, runId));
      
      // Broadcast progress via WebSocket
      if (broadcastProgress) {
        websocketManager.broadcast({
          type: "unified_agent_progress",
          dealId,
          agentType,
          runId,
          progress,
          currentQuestion: question.question,
          questionNumber: i + 1,
          totalQuestions: questions.length,
        });
      }
      
      // Process the question with retry logic
      let result: QuestionResult | null = null;
      let attempts = 0;
      
      while (attempts < maxRetries && !result?.success) {
        attempts++;
        
        if (attempts > 1) {
          console.log(`🔄 Retry attempt ${attempts}/${maxRetries} for question ${question.questionId}`);
          await new Promise(resolve => setTimeout(resolve, 2000 * attempts)); // Exponential backoff
        }
        
        result = await processQuestion(question, dealId, agentType, runId);
        
        if (!result.success && attempts < maxRetries) {
          console.log(`⏳ Will retry question ${question.questionId}...`);
        }
      }
      
      if (result) {
        results.push(result);
        
        if (!result.success) {
          errors.push(`Question ${question.questionId}: ${result.error}`);
        }
      }
    }
    
    // Calculate summary statistics
    const completedQuestions = results.filter(r => r.success).length;
    const failedQuestions = results.filter(r => !r.success).length;
    
    const successfulAnswers = results
      .filter(r => r.success && r.answer)
      .map(r => r.answer!);
    
    const averageConfidence = successfulAnswers.length > 0
      ? successfulAnswers.reduce((sum, a) => sum + (a.confidence || 0), 0) / successfulAnswers.length
      : 0;
    
    // Aggregate findings and recommendations
    const allFindings: any[] = [];
    const allRecommendations: any[] = [];
    
    for (const answer of successfulAnswers) {
      if (answer.keyFindings) {
        allFindings.push(...answer.keyFindings.map((f, idx) => ({
          id: allFindings.length + idx + 1,
          type: agentType,
          content: f,
          confidence: answer.confidence,
          category: question.category || "general",
          sources: answer.sources?.map(s => s.documentName) || [],
        })));
      }
      
      if (answer.recommendations) {
        allRecommendations.push(...answer.recommendations.map((r, idx) => ({
          id: allRecommendations.length + idx + 1,
          title: r,
          description: r,
          priority: answer.riskScore && answer.riskScore > 7 ? "high" : 
                   answer.riskScore && answer.riskScore > 4 ? "medium" : "low",
          impact: "moderate",
          category: agentType,
        })));
      }
    }
    
    // Update run with final results
    await db.update(unifiedAgentRuns)
      .set({
        status: failedQuestions === questions.length ? "failed" : "completed",
        progress: 100,
        completedQuestions,
        failedQuestions,
        averageConfidence,
        findings: allFindings,
        recommendations: allRecommendations,
        errors: errors.length > 0 ? errors.map(e => ({
          questionId: "unknown",
          error: e,
          timestamp: new Date().toISOString(),
          retryCount: maxRetries,
        })) : null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(unifiedAgentRuns.runId, runId));
    
    // Final broadcast
    if (broadcastProgress) {
      websocketManager.broadcast({
        type: "unified_agent_complete",
        dealId,
        agentType,
        runId,
        success: failedQuestions < questions.length,
        completedQuestions,
        failedQuestions,
        averageConfidence,
        totalTime: Date.now() - startTime,
      });
    }
    
    console.log(`\n✅ ${agentType} analysis complete!`);
    console.log(`📊 Results: ${completedQuestions}/${questions.length} successful`);
    console.log(`📈 Average confidence: ${(averageConfidence * 100).toFixed(1)}%`);
    console.log(`⏱️ Total time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    
    return {
      runId,
      success: failedQuestions < questions.length,
      completedQuestions,
      failedQuestions,
      averageConfidence,
      results,
      errors,
    };
    
  } catch (error: any) {
    console.error(`❌ Orchestrator failed:`, error);
    
    // Update run status to failed
    await db.update(unifiedAgentRuns)
      .set({
        status: "failed",
        errors: [{
          questionId: "orchestrator",
          error: error.message || "Unknown orchestrator error",
          timestamp: new Date().toISOString(),
          retryCount: 0,
        }],
        updatedAt: new Date(),
      })
      .where(eq(unifiedAgentRuns.runId, runId));
    
    return {
      runId,
      success: false,
      completedQuestions: 0,
      failedQuestions: 0,
      averageConfidence: 0,
      results: [],
      errors: [error.message || "Unknown error"],
    };
  }
}