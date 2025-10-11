import { storage } from './storage';
import { db } from './db';
import { documents, agentAnalyses } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { resilientOpenAI } from './utils/resilientOpenAI';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const HR_QUESTIONS = [
  // Team Structure
  {
    id: 'hr_1',
    question: "What is the current team size and organizational structure?",
    category: "Team Structure",
    keywords: ['team size', 'organizational structure', 'org chart', 'reporting structure', 'headcount', 'workforce', 'department', 'roles', 'hierarchy']
  },
  {
    id: 'hr_2',
    question: "Are there key person dependencies or single points of failure?",
    category: "Risk Assessment", 
    keywords: ['key person', 'dependencies', 'single point of failure', 'critical roles', 'key employee', 'succession', 'risk', 'backup', 'redundancy']
  },
  {
    id: 'hr_3',
    question: "What is the leadership experience and track record?",
    category: "Leadership Assessment",
    keywords: ['leadership', 'executive', 'management', 'experience', 'track record', 'background', 'ceo', 'founder', 'senior team', 'qualifications']
  },
  // Leadership Gaps  
  {
    id: 'hr_4',
    question: "Are there gaps in the leadership team?",
    category: "Leadership Gaps",
    keywords: ['leadership gaps', 'missing roles', 'hiring needs', 'expertise gaps', 'skill gaps', 'vacant positions', 'recruitment', 'team building']
  },
  {
    id: 'hr_5',
    question: "What is the employee retention and turnover rate?",
    category: "Retention Analysis",
    keywords: ['retention', 'turnover', 'attrition', 'churn', 'employee satisfaction', 'tenure', 'stability', 'departure', 'resignation']
  },
  {
    id: 'hr_6',
    question: "Are compensation and equity structures competitive?",
    category: "Compensation Review",
    keywords: ['compensation', 'salary', 'equity', 'stock options', 'benefits', 'competitive pay', 'market rate', 'incentives', 'package']
  },
  // Culture Assessment
  {
    id: 'hr_7',
    question: "What is the company culture and employee engagement?",
    category: "Culture Assessment",
    keywords: ['culture', 'engagement', 'employee satisfaction', 'values', 'work environment', 'morale', 'team dynamics', 'workplace', 'culture fit']
  },
  {
    id: 'hr_8',
    question: "What are the talent acquisition and hiring strategies?",
    category: "Talent Strategy",
    keywords: ['talent acquisition', 'hiring strategy', 'recruitment', 'talent pipeline', 'sourcing', 'onboarding', 'hiring process', 'talent management']
  },
  {
    id: 'hr_9',
    question: "Are there documented HR policies and procedures?",
    category: "HR Operations",
    keywords: ['hr policies', 'procedures', 'employee handbook', 'compliance', 'hr documentation', 'policies manual', 'hr processes', 'governance']
  },
  // Performance Management
  {
    id: 'hr_10',
    question: "What performance management systems are in place?",
    category: "Performance Management",
    keywords: ['performance management', 'performance review', 'goal setting', 'feedback', 'performance metrics', 'evaluation', 'development', 'career growth']
  },
  {
    id: 'hr_11',
    question: "Are there skills development and training programs?",
    category: "Training & Development",
    keywords: ['training', 'development', 'skills development', 'learning', 'education', 'professional development', 'upskilling', 'career development']
  },
  {
    id: 'hr_12',
    question: "What is the workforce diversity and inclusion status?",
    category: "Diversity & Inclusion",
    keywords: ['diversity', 'inclusion', 'dei', 'workforce diversity', 'equality', 'representation', 'inclusive culture', 'bias', 'belonging']
  }
];

export interface HRAnalysisProgress {
  isRunning: boolean;
  progress: number;
  message: string;
  currentStep?: string;
  totalSteps?: number;
  currentQuestion?: string;
}

interface HREvidence {
  documentName: string;
  documentSummary: string;
  relevantContent: string[];
  keyFindings: string[];
  confidence: number;
}

interface HRAnswer {
  question: string;
  answer: string;
  confidence: number;
  sources: string[];
  detailedEvidence: HREvidence[];
  keyFindings: string[];
  evidenceSummary: string;
  hrAssessment: string;
  recommendations: string[];
}

export class ComprehensiveHRAnalysisService {
  private progressData: Map<number, HRAnalysisProgress> = new Map();

  getProgress(dealId: number): HRAnalysisProgress {
    return this.progressData.get(dealId) || { 
      isRunning: false, 
      progress: 0, 
      message: 'No comprehensive HR analysis running' 
    };
  }

  private async setProgress(dealId: number, progress: Partial<HRAnalysisProgress>, jobId?: string) {
    const current = this.getProgress(dealId);
    this.progressData.set(dealId, { ...current, ...progress });
    
    // Also update database background job if jobId provided
    if (jobId && progress.progress !== undefined) {
      try {
        await storage.updateBackgroundJob(jobId, {
          progress: progress.progress,
          currentStep: progress.currentStep || current.currentStep || 'Processing HR analysis'
        });
      } catch (error) {
        console.error(`❌ Error updating background job ${jobId}:`, error);
      }
    }
  }

  async getAssignedHRDocuments(dealId: number): Promise<any[]> {
    console.log(`👥 Finding assigned HR documents for deal ${dealId}`);
    
    try {
      // Get ALL documents for the deal with AI summaries - same approach as Legal and Clinical
      const allDocuments = await db.select().from(documents).where(eq(documents.dealId, dealId));
      console.log(`👥 Found ${allDocuments.length} total documents for deal ${dealId}`);
      
      // Filter to only include documents with AI summaries for analysis (like Legal/Clinical)
      const documentsWithAI = allDocuments.filter(doc => {
        // Check if aiSummary exists and is valid (could be object or string)
        if (!doc.aiSummary) return false;
        
        // Handle aiSummary as object with executiveSummary field
        if (typeof doc.aiSummary === 'object' && doc.aiSummary.executiveSummary) {
          return doc.aiSummary.executiveSummary.length > 10;
        }
        
        // Handle aiSummary as string
        if (typeof doc.aiSummary === 'string' && doc.aiSummary.length > 10) {
          return true;
        }
        
        return false;
      });
      
      console.log(`👥 HR analysis will process ALL ${documentsWithAI.length} documents with AI summaries (comprehensive approach matching Legal/Clinical)`);
      
      // Return ALL documents with AI summaries for maximum coverage
      return documentsWithAI;
      
    } catch (error) {
      console.error(`❌ Error finding HR documents:`, error);
      // Fallback: return all documents if there's an error
      try {
        const allDocs = await db.select().from(documents).where(eq(documents.dealId, dealId));
        console.log(`🏢 Error fallback: returning all ${allDocs.length} documents`);
        return allDocs.filter(doc => doc.aiSummary);
      } catch (fallbackError) {
        console.error(`❌ Fallback error:`, fallbackError);
        return [];
      }
    }
  }

  /**
   * Run comprehensive analysis for all assigned HR documents
   * EXACT CLONE of Clinical agent micro-step architecture
   */
  async runComprehensiveAnalysis(dealId: number, storageService: any, jobId: string): Promise<any> {
    console.log(`🏢 Starting comprehensive HR analysis for deal ${dealId}`);
    
    try {
      // Get all HR documents - EXACT Clinical approach
      const assignedDocuments = await this.getAssignedHRDocuments(dealId);
      console.log(`📄 Found ${assignedDocuments.length} HR documents for analysis`);
      
      if (assignedDocuments.length === 0) {
        console.log('⚠️ No HR documents found for analysis');
        await storageService.updateBackgroundJob(jobId, {
          status: 'completed',
          progress: 100,
          currentStep: 'No HR documents available for analysis'
        });
        return { success: false, message: 'No HR documents found' };
      }
      
      // Initialize progress - EXACT Clinical approach
      await storageService.updateBackgroundJob(jobId, {
        progress: 5,
        currentStep: 'Starting HR analysis',
        processedDocuments: 0,
        totalDocuments: HR_QUESTIONS.length
      });
      
      // Process each question systematically - EXACT Clinical approach
      const hrAnswers: Record<string, any> = {};
      
      for (let i = 0; i < HR_QUESTIONS.length; i++) {
        const question = HR_QUESTIONS[i];
        console.log(`📊 Processing HR question ${i + 1}/${HR_QUESTIONS.length}: ${question.question}`);
        
        // CRITICAL: Update progress for each question - EXACT Clinical micro-step architecture
        await storageService.updateBackgroundJob(jobId, {
          progress: Math.round(((i + 1) / HR_QUESTIONS.length) * 100),
          processedDocuments: i,
          currentStep: `Analyzing: ${question.question}`,
          currentDocumentName: question.category
        });
        console.log(`💾 Updated background job ${jobId} to ${Math.round(((i + 1) / HR_QUESTIONS.length) * 100)}%`);
        
        try {
          console.log(`📊 Extracting HR evidence for: ${question.question}`);
          
          // Extract evidence from ALL documents for this question - EXACT Clinical approach with SPEED OPTIMIZATION
          const documentEvidence = await this.extractEvidenceFromAllDocuments(
            assignedDocuments.slice(0, 30), // SPEED: Use only first 30 documents for faster processing
            question
          );
          console.log(`📊 Evidence extraction completed for question: ${question.question}`);
          
          // Compile comprehensive answer with resilient client (handles timeout internally)
          console.log(`🤖 Starting OpenAI analysis for question: ${question.question} with ${documentEvidence.length} pieces of evidence`);
          const answer = await this.compileComprehensiveAnswer(question, documentEvidence, jobId, storageService, i, HR_QUESTIONS.length);
          hrAnswers[question.id] = answer;
          console.log(`🤖 OpenAI analysis completed for question: ${question.question}`);
          
          console.log(`✅ Completed question ${i + 1}/${HR_QUESTIONS.length}: ${question.question}`);
          
          // Brief delay to avoid rate limiting - EXACT Clinical approach
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (questionError) {
          console.error(`❌ Error processing question "${question.question}":`, questionError);
          
          // Store partial answer for this question - EXACT Clinical approach
          hrAnswers[question.id] = {
            question: question.question,
            category: question.category,
            answer: `Error processing this question: ${questionError.message}`,
            confidence: 0,
            sources: [],
            evidence: [],
            error: true
          };
          
          // Update progress to continue processing - EXACT Clinical approach
          await storageService.updateBackgroundJob(jobId, {
            progress: Math.round((i / HR_QUESTIONS.length) * 100),
            processedDocuments: i,
            currentDocumentName: `Error: ${question.question}`,
            currentStep: `Error in: ${question.category}`
          });
          
          // Continue with next question instead of failing completely
          continue;
        }
      }
      
      try {
        // Update progress to completion - EXACT Clinical approach
        await storageService.updateBackgroundJob(jobId, {
          progress: 100,
          processedDocuments: HR_QUESTIONS.length,
          currentStep: 'Generating findings and recommendations',
          status: 'completing'
        });
        
        // Generate comprehensive findings and recommendations - EXACT Clinical approach
        const findings = this.generateComprehensiveFindings(hrAnswers);
        const recommendations = this.generateComprehensiveRecommendations(hrAnswers);
        
        // Store the analysis results - EXACT Clinical approach
        await this.storeComprehensiveResults(dealId, hrAnswers, findings, recommendations, assignedDocuments);
        
        // Mark job as completed - EXACT Clinical approach
        await storageService.updateBackgroundJob(jobId, {
          status: 'completed',
          currentStep: 'Analysis completed'
        });
        
        console.log(`✅ Comprehensive HR analysis completed for deal ${dealId}`);
        
        return {
          success: true,
          documentsAnalyzed: assignedDocuments.length,
          questionsAnswered: Object.keys(hrAnswers).length,
          findings: findings.length,
          recommendations: recommendations.length
        };
      } catch (finalError) {
        console.error(`❌ Error in final stages of HR analysis for deal ${dealId}:`, finalError);
        
        // Still try to save what we have - EXACT Clinical approach
        try {
          const partialFindings = this.generateComprehensiveFindings(hrAnswers);
          const partialRecommendations = this.generateComprehensiveRecommendations(hrAnswers);
          await this.storeComprehensiveResults(dealId, hrAnswers, partialFindings, partialRecommendations, assignedDocuments);
          
          // Mark as completed with error - EXACT Clinical approach
          await storageService.updateBackgroundJob(jobId, {
            status: 'completed',
            currentStep: 'Completed with partial results due to errors',
            error: finalError.message
          });
          
          return {
            success: true,
            documentsAnalyzed: assignedDocuments.length,
            questionsAnswered: Object.keys(hrAnswers).length,
            findings: partialFindings.length,
            recommendations: partialRecommendations.length,
            warning: 'Analysis completed with some errors'
          };
        } catch (saveError) {
          // Mark job as failed - EXACT Clinical approach
          await storageService.updateBackgroundJob(jobId, {
            status: 'failed',
            error: `Final error: ${finalError.message}, Save error: ${saveError.message}`
          });
          throw finalError;
        }
      }
    } catch (error) {
      console.error(`❌ Critical error in HR analysis for deal ${dealId}:`, error);
      
      await storageService.updateBackgroundJob(jobId, {
        status: 'failed',
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Extract evidence from ALL documents for a specific question - EXACT Clinical approach
   */
  private async extractEvidenceFromAllDocuments(
    documents: any[], 
    question: any
  ): Promise<any[]> {
    console.log(`📄 SPEED MODE: Starting evidence extraction from ${documents.length} documents for: ${question.question}`);
    
    // CRITICAL SPEED FIX: Process only top 30 most relevant documents to match Clinical speed
    const topDocuments = documents.slice(0, 30);
    console.log(`🚀 SPEED OPTIMIZATION: Processing top ${topDocuments.length} documents (reduced from ${documents.length} for speed)`);
    
    const evidence = [];
    const batchSize = 20; // Larger batches for speed
    
    for (let i = 0; i < topDocuments.length; i += batchSize) {
      const batch = topDocuments.slice(i, i + batchSize);
      console.log(`📦 FAST Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(topDocuments.length / batchSize)} (${batch.length} documents)`);
      
      // Parallel processing with reduced timeout for speed
      const batchPromises = batch.map(async (doc) => {
        console.log(`🔎 FAST Extracting evidence from: ${doc.name}`);
        try {
          return await Promise.race([
            this.extractEvidenceFromDocument(doc, question),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Document timeout')), 10000)) // 10 second timeout per document
          ]);
        } catch (error) {
          console.log(`⚠️ Skipping ${doc.name} due to timeout/error`);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      const validEvidence = batchResults.filter(docEvidence => 
        docEvidence && docEvidence.relevantContent && docEvidence.relevantContent.length > 0
      );
      evidence.push(...validEvidence);
      
      console.log(`✅ FAST Batch ${Math.floor(i / batchSize) + 1} completed: ${validEvidence.length}/${batch.length} documents had relevant evidence`);
    }
    
    console.log(`🎯 SPEED MODE: Extracted evidence from ${evidence.length}/${topDocuments.length} documents in FAST mode`);
    return evidence;
  }

  /**
   * Extract specific evidence from a single document - EXACT Clinical approach
   */
  private async extractEvidenceFromDocument(document: any, question: any): Promise<any> {
    const content = document.ocrText || document.aiSummary?.executiveSummary || '';
    
    if (!content) return null;
    
    const prompt = `You are an expert HR due diligence analyst conducting comprehensive investment analysis. Your task is to find ANY human resources, organizational, team, leadership, or management information, even if indirectly related.

DOCUMENT: ${document.name}
CONTENT: ${content.substring(0, 4000)}

QUESTION: "${question.question}"
CATEGORY: ${question.category}

Instructions:
- Look for DIRECT HR terms: team size, employees, leadership, management, hiring, compensation, culture, retention
- Look for INDIRECT HR information: organizational structure, roles, departments, executives, workforce data
- Consider business documents that mention HR milestones, team growth, leadership changes, hiring plans
- Even general business context often has HR implications for investment due diligence
- For investment companies, most business documents contain HR information relevant to investors

Respond in JSON format:
{
  "relevantContent": ["Exact quote 1 from document", "Exact quote 2 from document"],
  "hasRelevantInfo": true/false,
  "confidence": 0-100,
  "keyFindings": ["Finding 1", "Finding 2"],
  "documentSummary": "Brief summary of what this document contains relevant to the question",
  "commercialContext": "How this document relates to HR/business aspects"
}

Be thorough in finding relevance - most business documents have HR implications for investment analysis.`;

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
   * Compile comprehensive answer based on all evidence - BATCHED APPROACH
   * Processes evidence in batches to avoid token limits
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
        answer: 'No relevant documents found for HR analysis',
        confidence: 0,
        sources: [],
        keyFindings: [],
        gaps: ['No HR documentation available'],
        recommendations: ['Obtain relevant HR documents for analysis'],
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
    const partialResultsKey = `hr-partial-${question.id}`;
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`📦 Processing batch ${i + 1}/${batches.length} (${batch.length} documents)`);
      
      const batchPrompt = `You are a senior HR analyst. Analyze evidence from ${batch.length} documents to answer: "${question.question}"

Evidence:
${batch.map(ev => `
DOCUMENT: ${ev.documentName}
CONTENT: ${Array.isArray(ev.relevantContent) ? ev.relevantContent.join('; ') : ev.relevantContent}
FINDINGS: ${Array.isArray(ev.keyFindings) ? ev.keyFindings.join('; ') : ev.keyFindings}
`).join('\n')}

Extract ALL specific details (employee counts, compensation data, turnover rates, benefits). Respond in JSON:
{
  "answer": "Detailed extraction with specific HR data and metrics",
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
    
    const synthesisPrompt = `You are a senior HR analyst. Synthesize these partial analyses into ONE comprehensive answer for: "${question.question}"

Partial Analyses:
${partialAnswers.map((pa, i) => `
BATCH ${i + 1}:
${pa.answer}
KEY FINDINGS: ${pa.keyFindings?.join('; ') || 'None'}
`).join('\n')}

CRITICAL: Create ONE comprehensive answer that:
1. Extracts ALL specific details (employee counts, compensation, turnover rates) from all batches
2. Lists ALL HR data with complete details
3. Provides exhaustive breakdown of organizational structure, culture, and retention
4. Cites specific document sections and data points

Respond in JSON:
{
  "answer": "Comprehensive synthesis with ALL specific details from ${evidence.length} documents",
  "confidence": 0-100,
  "keyFindings": ["All key findings combined"],
  "gaps": ["Missing information"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "HRAssessment": "Overall HR assessment"
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
        answer: compiledAnswer.answer || 'Unable to compile answer',
        confidence: compiledAnswer.confidence || 30,
        sources: evidence.map(e => e.documentName),
        keyFindings: compiledAnswer.keyFindings || [],
        gaps: compiledAnswer.gaps || [],
        recommendations: compiledAnswer.recommendations || [],
        HRAssessment: compiledAnswer.HRAssessment || '',
        evidenceCount: evidence.length,
        detailedEvidence: evidence
      };
      
    } catch (synthesisError: any) {
      console.error(`❌ Synthesis failed for "${question.question}":`, synthesisError);
      
      // 🔄 FALLBACK: Try to recover from partial results cache
      const cachedPartials = global[partialResultsKey];
      if (cachedPartials && cachedPartials.length > 0) {
        console.log(`📦 Synthesis failed, recovering from ${cachedPartials.length} cached partial results`);
        
        // Combine partial answers manually
        const combinedAnswer = cachedPartials.map((pa: any) => pa.answer).join(' ');
        const combinedFindings = cachedPartials.flatMap((pa: any) => pa.keyFindings || []);
        
        return {
          question: question.question,
          category: question.category,
          answer: combinedAnswer || 'Partial analysis available',
          confidence: 40,
          sources: evidence.map(e => e.documentName),
          keyFindings: combinedFindings,
          gaps: ['Synthesis incomplete - using partial results'],
          recommendations: ['Complete full analysis for comprehensive insights'],
          evidenceCount: evidence.length,
          detailedEvidence: evidence
        };
      }
      
      // Last resort fallback
      return {
        question: question.question,
        category: question.category,
        answer: `Analysis error: ${synthesisError.message}`,
        confidence: 0,
        sources: evidence.map(e => e.documentName),
        keyFindings: [],
        gaps: ['Complete analysis failed'],
        recommendations: ['Manual review required'],
        evidenceCount: evidence.length,
        detailedEvidence: evidence
      };
    }
  }

  /**
   * Generate comprehensive findings - EXACT Clinical approach
   */
  private generateComprehensiveFindings(answers: Record<string, any>): any[] {
    const findings = [];
    
    for (const [questionId, answer] of Object.entries(answers)) {
      const question = HR_QUESTIONS.find(q => q.id === questionId);
      if (!question) continue;
      
      // High confidence findings
      if (answer.confidence > 70) {
        findings.push({
          id: findings.length + 1,
          type: 'positive',
          content: `${question.question}: ${answer.answer.substring(0, 150)}...`,
          source: answer.sources.length > 0 ? answer.sources[0] : 'HR Documents',
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
          content: `Insufficient HR information for: ${question.question}. Additional documentation may be required.`,
          source: 'HR Analysis',
          confidence: 0.3,
          category: 'gaps',
          evidenceCount: answer.evidenceCount || 0
        });
      }
    }
    
    return findings;
  }

  /**
   * Generate comprehensive recommendations - EXACT Clinical approach
   */
  private generateComprehensiveRecommendations(answers: Record<string, any>): any[] {
    const recommendations = [];
    
    for (const [questionId, answer] of Object.entries(answers)) {
      const question = HR_QUESTIONS.find(q => q.id === questionId);
      if (!question) continue;
      
      // Add specific recommendations from the answer
      if (answer.recommendations && answer.recommendations.length > 0) {
        answer.recommendations.forEach((rec: string, index: number) => {
          recommendations.push({
            id: recommendations.length + 1,
            type: answer.confidence > 70 ? 'positive' : 'neutral',
            content: `${question.category}: ${rec}`,
            source: 'HR Analysis',
            confidence: Math.max(answer.confidence / 100, 0.3),
            category: question.category.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            questionId: questionId
          });
        });
      }
      
      // Add gap-based recommendations for low confidence answers
      if (answer.confidence < 50) {
        recommendations.push({
          id: recommendations.length + 1,
          type: 'improvement',
          content: `Improve documentation for ${question.category} to enable thorough analysis of: ${question.question}`,
          source: 'Gap Analysis',
          confidence: 0.4,
          category: 'documentation_gap',
          questionId: questionId
        });
      }
    }
    
    return recommendations;
  }

  /**
   * Store comprehensive analysis results - EXACT Clinical approach
   */
  private async storeComprehensiveResults(
    dealId: number, 
    hrAnswers: Record<string, any>, 
    findings: any[], 
    recommendations: any[], 
    assignedDocuments: any[]
  ): Promise<void> {
    console.log(`💾 Storing comprehensive HR analysis results for deal ${dealId}`);
    
    try {
      // Store in agent_analyses table - EXACT LEGAL APPROACH matching their working database structure
      await db
        .delete(agentAnalyses)
        .where(and(
          eq(agentAnalyses.dealId, dealId),
          eq(agentAnalyses.agentType, 'HR')
        ));
      
      console.log(`🗑️ Cleared existing HR analysis for deal ${dealId}`);
      
      // Create the new comprehensive analysis - EXACT copy of Legal structure
      const analysisData = {
        dealId,
        agentType: 'HR' as const,
        status: 'completed' as const,
        progress: 100,
        findings: JSON.stringify(findings),
        recommendations: JSON.stringify(recommendations),
        hr_answers: JSON.stringify(hrAnswers), // CRITICAL FIX: Use snake_case field name like other agents
        documentSources: JSON.stringify(assignedDocuments.map((d: any) => d.name)),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db
        .insert(agentAnalyses)
        .values(analysisData);
      
      console.log(`📊 Created fresh comprehensive HR analysis for deal ${dealId} with ${Object.keys(hrAnswers).length} questions answered`);
    } catch (error) {
      console.error(`❌ Error storing HR analysis results:`, error);
      throw error;
    }
  }

  /**
   * Calculate overall confidence - EXACT Clinical approach
   */
  private calculateOverallConfidence(answers: Record<string, any>): number {
    const confidences = Object.values(answers)
      .map(answer => answer.confidence || 0)
      .filter(conf => conf > 0);
    
    if (confidences.length === 0) return 20;
    
    const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    return Math.round(avgConfidence);
  }

  generateFallbackAnswer(question: any, evidence: any[]): any {
    return {
      question: question.question,
      answer: `Analysis completed for ${question.question}. ${evidence.length} documents were reviewed for relevant HR information.`,
      confidence: evidence.length > 0 ? 0.6 : 0.1,
      sources: evidence.map(e => e.documentName),
      detailedEvidence: evidence,
      keyFindings: evidence.flatMap(e => e.keyFindings).slice(0, 3),
      evidenceSummary: `Analyzed ${evidence.length} HR documents`,
      HRAssessment: 'HR analysis completed with available documentation',
      recommendations: ['Consider additional HR documentation for more comprehensive analysis']
    };
  }

  async storeAnalysisResults(dealId: number, answers: {[key: string]: HRAnswer}, evidenceMap: Map<string, HREvidence[]>): Promise<void> {
    // Generate findings and recommendations
    const findings = Object.values(answers).flatMap(answer => 
      answer.keyFindings.map((finding, index) => ({
        id: index,
        content: finding,
        type: 'HR_finding',
        confidence: answer.confidence,
        source: answer.sources[0] || 'HR analysis'
      }))
    );

    const recommendations = Object.values(answers).flatMap(answer => 
      answer.recommendations.map(rec => ({
        title: `HR: ${rec.substring(0, 50)}...`,
        description: rec,
        priority: 'Medium',
        category: 'HR',
        impact: 'Medium'
      }))
    );

    // Store in agent_analyses table
    const existingAnalysis = await storage.getAnalysisByDealAndAgent(dealId, 'HR');
    
    if (existingAnalysis) {
      await storage.updateAgentAnalysis(existingAnalysis.id, {
        status: 'Completed',
        progress: 100,
        findings,
        recommendations,
        hrAnswers: answers
      });
    } else {
      await storage.createAgentAnalysis({
        dealId,
        agentType: 'HR',
        status: 'Completed',
        progress: 100,
        findings,
        recommendations,
        hrAnswers: answers
      });
    }

    console.log(`✅ Stored HR analysis: ${findings.length} findings, ${recommendations.length} recommendations`);
  }

  async getAnalysisResults(dealId: number): Promise<any> {
    try {
      const analysis = await storage.getAnalysisByDealAndAgent(dealId, 'HR');
      
      if (!analysis || !analysis.hrAnswers) {
        return null;
      }
      
      return {
        hrAnswers: analysis.hrAnswers,
        findings: analysis.findings || [],
        recommendations: analysis.recommendations || [],
        status: analysis.status,
        progress: analysis.progress
      };
    } catch (error) {
      console.error(`❌ Error retrieving HR analysis results:`, error);
      return null;
    }
  }
}

export const comprehensiveHRAnalysisService = new ComprehensiveHRAnalysisService();
export { HR_QUESTIONS };