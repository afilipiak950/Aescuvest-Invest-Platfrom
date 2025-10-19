import { storage } from './storage';
import { db } from './db';
import { documents, agentAnalyses, backgroundJobs } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { resilientOpenAI } from './utils/resilientOpenAI';

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
          
          // Extract evidence from ALL documents for this question - EXACT Clinical approach
          const documentEvidence = await this.extractEvidenceFromAllDocuments(
            assignedDocuments, // Process ALL documents (no limit)
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
   * Extract evidence from ALL documents for a specific question - EXACT Financial approach
   */
  private async extractEvidenceFromAllDocuments(
    documents: any[], 
    question: any
  ): Promise<any[]> {
    const evidence: any[] = [];
    
    // Process ALL assigned documents (EXACTLY matching Financial approach - no speed limits)
    const documentsToProcess = documents;
    console.log(`📄 COMPREHENSIVE MODE: Starting evidence extraction from ALL ${documentsToProcess.length} documents for: ${question.question}`);
    console.log(`🔍 FULL ANALYSIS: Processing ALL ${documentsToProcess.length} assigned documents for thorough HR analysis`);

    // Process documents in batches with timeout for speed
    const batchSize = 20;
    const batches = [];
    for (let i = 0; i < documentsToProcess.length; i += batchSize) {
      batches.push(documentsToProcess.slice(i, i + batchSize));
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`📦 FAST Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} documents)`);
      
      const batchPromises = batch.map(async (doc) => {
        return this.extractEvidenceFromDocument(doc, question);
      });

      // CRITICAL FIX: Wrap Promise.allSettled with batch-level timeout (3 minutes per batch)
      const BATCH_TIMEOUT = 180000; // 3 minutes
      const batchTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Batch timeout after ${BATCH_TIMEOUT}ms`)), BATCH_TIMEOUT);
      });
      
      let results;
      try {
        results = await Promise.race([
          Promise.allSettled(batchPromises),
          batchTimeoutPromise
        ]) as PromiseSettledResult<any>[];
      } catch (batchTimeoutError) {
        console.warn(`⏰ Batch ${batchIndex + 1} timed out, continuing with next batch...`);
        results = []; // Empty results for timed-out batch
      }

      const validResults = results
        .filter((result): result is PromiseFulfilledResult<any> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value);

      evidence.push(...validResults);
      
      console.log(`✅ Batch ${batchIndex + 1} completed: ${validResults.length}/${batch.length} documents had relevant evidence`);
    }

    console.log(`🎯 SPEED MODE: Extracted evidence from ${evidence.length}/${documentsToProcess.length} documents in FAST mode`);
    console.log(`📊 Evidence extraction completed for question: ${question.question}`);
    
    return evidence;
  }

  /**
   * Extract specific evidence from a single document - EXACT Financial approach
   */
  private async extractEvidenceFromDocument(doc: any, question: any): Promise<any> {
    try {
      console.log(`🔎 FAST Extracting evidence from: ${doc.name}`);
      
      // Use ONLY AI summary - handle BOTH string and object formats (like Legal/Clinical)
      const aiSummary = doc.aiSummary;
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
        if (!content || content.trim().length === 0) {
          content = JSON.stringify(aiSummary);
        }
      }
      // Fallback: stringify anything else
      else {
        content = String(aiSummary);
      }
      
      if (!content || content.trim().length === 0) return null;

      // Quick keyword check first (for speed)
      const hasRelevantKeywords = question.keywords.some((keyword: string) =>
        content.toLowerCase().includes(keyword.toLowerCase())
      );

      if (!hasRelevantKeywords) {
        return null;
      }

      // Extract specific evidence using resilientOpenAI with focused prompt
      const response = await resilientOpenAI.createChatCompletion({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an HR analysis expert. Extract specific evidence related to the given question from the document content. Focus on employee data, organizational structure, compensation, and people metrics.`
          },
          {
            role: "user",
            content: `Document: "${doc.name}"
            Content: ${content.substring(0, 4000)}
            
            Question: ${question.question}
            Analysis Focus: ${question.analysisPrompt}
            
            Extract specific evidence, HR data, and key findings related to this question. Return in JSON format:
            {
              "relevantContent": ["specific quotes or data points"],
              "keyFindings": ["key HR insights"],
              "confidence": 0.0-1.0
            }`
          }
        ],
        temperature: 0.1,
        max_tokens: 8000
      }, {
        maxRetries: 3,
        timeout: 90000
      });

      let rawContent = response.choices[0].message.content || '{}';
      // Handle markdown code blocks from OpenAI response
      if (rawContent.includes('```json')) {
        rawContent = rawContent.replace(/```json\s*/, '').replace(/\s*```/, '');
      }
      
      // CRITICAL: Enhanced JSON parsing with fallback for malformed responses
      let result;
      try {
        result = JSON.parse(rawContent);
      } catch (parseError) {
        console.log(`⚠️ JSON parsing failed for document ${doc.name}, attempting to extract JSON from response...`);
        
        // Try to extract JSON from potentially malformed response
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            result = JSON.parse(jsonMatch[0]);
            console.log(`✅ Successfully extracted JSON from malformed response for ${doc.name}`);
          } catch (extractError) {
            console.log(`❌ Failed to extract JSON from ${doc.name}, skipping...`);
            return null;
          }
        } else {
          console.log(`❌ No JSON found in response for ${doc.name}, skipping...`);
          return null;
        }
      }
      
      return {
        documentName: doc.name,
        documentSummary: typeof doc.aiSummary === 'string' ? doc.aiSummary : 'No summary available',
        relevantContent: result.relevantContent || [],
        keyFindings: result.keyFindings || [],
        confidence: result.confidence || 0.5
      };

    } catch (error) {
      console.error(`Error extracting evidence from ${doc.name}:`, error);
      return null;
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

CRITICAL: Extract ALL specific details from the AI SUMMARY CONTENT above (employee counts, compensation data, turnover rates, benefits). Respond in JSON:
{
  "answer": "Detailed extraction with specific HR data and metrics from the AI summaries",
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

FORMAT REQUIREMENTS FOR "answer" FIELD:
- Use markdown bullets (•) for lists of evidence/findings
- Use **bold** for key terms, employee counts, compensation figures, and key personnel
- Structure with clear sections if multiple topics
- Example: "• **Team Size**: **45 employees** including **12 engineers**, **$120K average salary** with **15% turnover**"

Respond in JSON:
{
  "answer": "Comprehensive synthesis with ALL specific HR details formatted with markdown bullets and bold for key metrics",
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
        timeout: 300000, // 5 minutes for synthesis (increased for large document sets)
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
      
      // Create the new comprehensive analysis - Fixed to use correct Drizzle property names without JSON.stringify
      const analysisData = {
        dealId,
        agentType: 'HR' as const,
        status: 'completed' as const,
        progress: 100,
        findings: findings,
        recommendations: recommendations,
        hr_answers: hrAnswers,
        documentSources: assignedDocuments.map((d: any) => d.name),
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
        hr_answers: answers
      });
    } else {
      await storage.createAgentAnalysis({
        dealId,
        agentType: 'HR',
        status: 'Completed',
        progress: 100,
        findings,
        recommendations,
        hr_answers: answers
      });
    }

    console.log(`✅ Stored HR analysis: ${findings.length} findings, ${recommendations.length} recommendations`);
  }

  async getAnalysisResults(dealId: number): Promise<any> {
    try {
      const analysis = await storage.getAnalysisByDealAndAgent(dealId, 'HR');
      
      if (!analysis || !analysis.hr_answers) {
        return null;
      }
      
      return {
        hr_answers: analysis.hr_answers,
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

  /**
   * Check if a question is currently being rerun
   */
  async isQuestionRunning(dealId: number, questionId: string): Promise<boolean> {
    const { backgroundJobs } = await import('../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    await this.cleanupStuckJob(dealId, questionId);
    
    const jobId = `hr-question-rerun-${dealId}-${questionId}`;
    const job = await db.query.backgroundJobs.findFirst({
      where: eq(backgroundJobs.jobId, jobId)
    });
    return job !== undefined && job.progress < 100;
  }

  /**
   * Auto-cleanup stuck or failed jobs
   */
  private async cleanupStuckJob(dealId: number, questionId: string): Promise<void> {
    const jobId = `hr-question-rerun-${dealId}-${questionId}`;
    const job = await db.query.backgroundJobs.findFirst({
      where: eq(backgroundJobs.jobId, jobId)
    });
    
    if (!job) return;
    
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const isStuck = job.updatedAt < thirtyMinutesAgo && job.status !== 'completed';
    const isFailed = job.status === 'failed';
    
    if (isFailed || isStuck) {
      console.log(`🧹 Auto-cleaning ${isFailed ? 'failed' : 'stuck'} job: ${jobId}`);
      await db.delete(backgroundJobs).where(eq(backgroundJobs.jobId, jobId));
    }
  }

  /**
   * Update progress for a specific question rerun
   */
  async updateQuestionRerunProgress(dealId: number, questionId: string, progress: number): Promise<void> {
    const jobId = `hr-question-rerun-${dealId}-${questionId}`;
    
    const existingJob = await db.query.backgroundJobs.findFirst({
      where: eq(backgroundJobs.jobId, jobId)
    });
    
    if (existingJob) {
      // Use storage service to update - matches commercial service pattern
      await storage.updateBackgroundJob(jobId, {
        progress,
        status: progress === 100 ? 'completed' : (progress === 0 ? 'pending' : 'processing'),
        completedAt: progress === 100 ? new Date() : undefined
      });
    } else {
      // Use storage service to create - matches commercial service pattern  
      await storage.createBackgroundJob({
        jobId,
        jobType: 'hr_question_rerun',
        dealId,
        status: progress === 0 ? 'pending' : 'processing',
        progress,
        runId: questionId,
        currentStep: `Rerunning HR question: ${questionId}`
      });
    }
    
    console.log(`📊 HR Progress update: ${questionId} = ${progress}%`);
  }

  /**
   * Get all active question progress for a deal
   */
  async getAllQuestionProgress(dealId: number): Promise<Record<string, number>> {
    const jobs = await db.query.backgroundJobs.findMany({
      where: and(
        eq(backgroundJobs.dealId, dealId),
        eq(backgroundJobs.jobType, 'hr_question_rerun')
      )
    });
    
    const result: Record<string, number> = {};
    for (const job of jobs) {
      if (job.runId) {
        result[job.runId] = job.progress;
      }
    }
    
    return result;
  }

  /**
   * Re-run a single HR question
   */
  async rerunSingleQuestion(dealId: number, questionId: string): Promise<any> {
    console.log(`🔄 Re-running HR question ${questionId} for deal ${dealId}`);
    const jobId = `hr-question-rerun-${dealId}-${questionId}`;
    
    const existingJob = await db.query.backgroundJobs.findFirst({
      where: eq(backgroundJobs.jobId, jobId)
    });
    const alreadyInitialized = existingJob !== undefined;
    
    if (!alreadyInitialized && await this.isQuestionRunning(dealId, questionId)) {
      throw new Error(`Question ${questionId} is already being rerun`);
    }
    
    try {
      if (!alreadyInitialized) {
        await this.updateQuestionRerunProgress(dealId, questionId, 0);
      }
      
      const question = HR_QUESTIONS.find(q => q.id === questionId);
      if (!question) {
        throw new Error(`Question ${questionId} not found`);
      }
      await this.updateQuestionRerunProgress(dealId, questionId, 10);
      
      const assignedDocuments = await this.getAssignedHRDocuments(dealId);
      console.log(`📄 Found ${assignedDocuments.length} documents for HR question re-run`);
      
      if (assignedDocuments.length === 0) {
        throw new Error('No documents available for HR analysis');
      }
      await this.updateQuestionRerunProgress(dealId, questionId, 20);
      
      console.log(`📊 Extracting evidence for: ${question.question}`);
      await this.updateQuestionRerunProgress(dealId, questionId, 30);
      
      const documentEvidence = await this.extractEvidenceFromAllDocuments(assignedDocuments, question);
      console.log(`📊 Evidence extraction completed: ${documentEvidence.length} pieces`);
      await this.updateQuestionRerunProgress(dealId, questionId, 60);
      
      console.log(`🤖 Compiling answer for: ${question.question}`);
      await this.updateQuestionRerunProgress(dealId, questionId, 70);
      
      const answer = await this.compileComprehensiveAnswer(question, documentEvidence);
      console.log(`✅ Answer compiled successfully`);
      await this.updateQuestionRerunProgress(dealId, questionId, 85);
      
      const existingAnalysis = await db.query.agentAnalyses.findFirst({
        where: and(
          eq(agentAnalyses.dealId, dealId),
          eq(agentAnalyses.agentType, 'hr')
        )
      });
      
      // Use delete + insert pattern like storeComprehensiveResults for reliability
      const hrAnswers = existingAnalysis?.hr_answers 
        ? (typeof existingAnalysis.hr_answers === 'string' 
            ? JSON.parse(existingAnalysis.hr_answers) 
            : existingAnalysis.hr_answers)
        : {};
      
      hrAnswers[questionId] = answer;
      
      // Delete existing analysis if present
      if (existingAnalysis) {
        await db
          .delete(agentAnalyses)
          .where(eq(agentAnalyses.id, existingAnalysis.id));
      }
      
      // Insert fresh data with updated answer
      const analysisData = {
        dealId,
        agentType: 'HR' as const,
        status: 'completed' as const,
        progress: 100,
        hr_answers: hrAnswers,
        findings: existingAnalysis?.findings || [],
        recommendations: existingAnalysis?.recommendations || [],
        documentSources: existingAnalysis?.documentSources || [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await db.insert(agentAnalyses).values(analysisData);
      
      console.log(`✅ Updated HR analysis with new answer for question ${questionId}`);
      
      await this.updateQuestionRerunProgress(dealId, questionId, 100);
      console.log(`✅ Successfully updated question ${questionId} in HR analysis`);
      
      return answer;
    } catch (error) {
      console.error(`❌ Error re-running question ${questionId}:`, error);
      throw error;
    }
  }
}

export const comprehensiveHRAnalysisService = new ComprehensiveHRAnalysisService();
export { HR_QUESTIONS };