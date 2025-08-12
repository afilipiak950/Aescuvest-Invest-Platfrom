/**
 * Comprehensive Financial Analysis Service
 * Analyzes financial documents for statements, projections, and accounting practices
 */

import { storage } from './storage';
import { db } from './db';
import { documents, agentAnalyses } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const FINANCIAL_QUESTIONS = [
  // Financial Statements
  { 
    id: 'statements_1', 
    question: 'Are financial statements audited and current?', 
    category: 'Financial Statements',
    keywords: ['financial statements', 'income statement', 'balance sheet', 'cash flow', 'audited financials']
  },
  { 
    id: 'statements_2', 
    question: 'What is the revenue growth trajectory?', 
    category: 'Financial Statements',
    keywords: ['revenue', 'sales', 'income', 'growth', 'recurring revenue', 'arr', 'mrr']
  },
  { 
    id: 'statements_3', 
    question: 'Are profit margins sustainable?', 
    category: 'Financial Statements',
    keywords: ['profit margin', 'gross margin', 'ebitda', 'profitability', 'operating margin']
  },
  // Revenue Models
  { 
    id: 'revenue_1', 
    question: 'Is the revenue model clearly defined?', 
    category: 'Revenue Models',
    keywords: ['revenue model', 'business model', 'pricing strategy', 'monetization', 'subscription']
  },
  { 
    id: 'revenue_2', 
    question: 'Are revenue streams diversified?', 
    category: 'Revenue Models',
    keywords: ['revenue streams', 'diversification', 'customer segments', 'market segments']
  },
  // Financial Projections
  { 
    id: 'projections_1', 
    question: 'Are financial projections realistic?', 
    category: 'Financial Projections',
    keywords: ['financial projections', 'forecast', 'budget', 'financial plan', 'projections']
  },
  { 
    id: 'projections_2', 
    question: 'What assumptions drive the projections?', 
    category: 'Financial Projections',
    keywords: ['assumptions', 'financial assumptions', 'growth assumptions', 'market assumptions']
  }
];

interface FinancialAnalysisProgress {
  isRunning: boolean;
  progress: number;
  message: string;
  currentStep?: string;
  totalSteps?: number;
  currentQuestion?: string;
}

class ComprehensiveFinancialAnalysisService {
  private progressData: Map<number, FinancialAnalysisProgress> = new Map();

  getProgress(dealId: number): FinancialAnalysisProgress {
    return this.progressData.get(dealId) || { 
      isRunning: false, 
      progress: 0, 
      message: 'No financial analysis running' 
    };
  }

  private async setProgress(dealId: number, progress: Partial<FinancialAnalysisProgress>, jobId?: string) {
    const current = this.getProgress(dealId);
    this.progressData.set(dealId, { ...current, ...progress });
    
    if (jobId && progress.progress !== undefined) {
      try {
        await storage.updateBackgroundJob(jobId, {
          progress: progress.progress,
          currentStep: progress.currentStep || current.currentStep || 'Processing financial analysis'
        });
      } catch (error) {
        console.error(`Error updating background job ${jobId}:`, error);
      }
    }
  }

  async getAssignedFinancialDocuments(dealId: number) {
    try {
      const allDocuments = await db.select().from(documents).where(eq(documents.dealId, dealId));
      
      // Filter documents relevant to financial analysis
      const financialDocuments = allDocuments.filter(doc => {
        const name = doc.name.toLowerCase();
        const summary = typeof doc.aiSummary === 'string' ? doc.aiSummary.toLowerCase() : 
                       (doc.aiSummary?.executiveSummary || '').toLowerCase();
        
        return FINANCIAL_QUESTIONS.some(q => 
          q.keywords.some((keyword: string) => 
            name.includes(keyword) || summary.includes(keyword)
          )
        );
      });
      
      console.log(`💰 Financial document filtering: ${financialDocuments.length}/${allDocuments.length} documents selected for financial analysis`);
      return financialDocuments;
    } catch (error) {
      console.error('Error getting financial documents:', error);
      return [];
    }
  }

  async extractEvidenceFromAllDocuments(documents: any[], question: any) {
    const documentEvidence = [];
    
    for (const doc of documents) {
      try {
        const content = typeof doc.aiSummary === 'string' ? doc.aiSummary : 
                       doc.aiSummary?.executiveSummary || doc.aiSummary?.content || '';
        
        if (!content || content.length < 50) continue;
        
        // Check if document contains relevant keywords
        const hasRelevantContent = question.keywords.some((keyword: string) =>
          content.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (hasRelevantContent) {
          // Extract specific evidence using OpenAI
          const prompt = `
Analyze this document for financial question: "${question.question}"

Document: ${doc.name}
Content: ${content}

Extract specific evidence that answers the question. If no relevant information is found, respond with "No specific evidence found for this question."

Format your response as:
- Evidence: [specific quotes or data points]
- Source: [document name]  
- Relevance: [how this relates to the question]
`;

          const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 1500
          });

          const evidence = response.choices[0]?.message?.content || 'No evidence extracted';
          
          if (!evidence.toLowerCase().includes('no specific evidence found')) {
            documentEvidence.push({
              document: doc.name,
              evidence,
              content: content.substring(0, 500)
            });
          }
        }
      } catch (error) {
        console.error(`Error extracting evidence from ${doc.name}:`, error);
      }
    }
    
    return documentEvidence;
  }

  async compileComprehensiveAnswer(question: any, documentEvidence: any[]) {
    if (documentEvidence.length === 0) {
      return {
        question: question.question,
        category: question.category,
        answer: 'No specific evidence found in the available documents for this financial question.',
        confidence: 0,
        sources: [],
        evidence: [],
        documentCount: 0
      };
    }

    try {
      const evidenceText = documentEvidence.map(ev => 
        `Document: ${ev.document}\nEvidence: ${ev.evidence}`
      ).join('\n\n');

      const prompt = `
Based on the following evidence from multiple documents, provide a comprehensive answer to: "${question.question}"

Evidence from documents:
${evidenceText}

Provide a detailed, well-structured answer that:
1. Synthesizes information from all sources
2. Identifies key financial metrics and data points
3. Notes any patterns or trends
4. Highlights important financial indicators
5. Maintains objectivity and accuracy

Answer:`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000
      });

      return {
        question: question.question,
        category: question.category,
        answer: response.choices[0]?.message?.content || 'Unable to compile comprehensive answer',
        confidence: Math.min(documentEvidence.length * 20, 100),
        sources: documentEvidence.map(ev => ev.document),
        evidence: documentEvidence,
        documentCount: documentEvidence.length
      };
    } catch (error) {
      console.error('Error compiling comprehensive answer:', error);
      return {
        question: question.question,
        category: question.category,
        answer: `Error compiling answer: ${error.message}`,
        confidence: 0,
        sources: documentEvidence.map(ev => ev.document),
        evidence: documentEvidence,
        documentCount: documentEvidence.length,
        error: true
      };
    }
  }

  async runComprehensiveAnalysis(
    dealId: number, 
    storageService: any, 
    jobId: string, 
    progressCallback: Function
  ) {
    console.log(`💰 Starting comprehensive financial analysis for deal ${dealId}`);
    
    try {
      // Update job status
      await storageService.updateBackgroundJob(jobId, {
        status: 'processing',
        progress: 0,
        currentStep: 'Initializing financial analysis'
      });
    } catch (error) {
      console.error('Error updating background job status:', error);
    }
    
    // Get all documents suitable for financial analysis
    const assignedDocuments = await this.getAssignedFinancialDocuments(dealId);
    console.log(`📄 Found ${assignedDocuments.length} documents suitable for financial analysis`);
    
    if (assignedDocuments.length === 0) {
      await storageService.updateBackgroundJob(jobId, {
        status: 'completed',
        progress: 100,
        error: 'No documents available for financial analysis'
      });
      throw new Error('No documents available for financial analysis');
    }
    
    // Update job with total questions to process
    await storageService.updateBackgroundJob(jobId, {
      totalDocuments: FINANCIAL_QUESTIONS.length,
      currentStep: 'Analyzing financial documents across 7 question categories'
    });
    
    // Process each question comprehensively with enhanced error handling
    const financialAnswers: Record<string, any> = {};
    
    for (let i = 0; i < FINANCIAL_QUESTIONS.length; i++) {
      const question = FINANCIAL_QUESTIONS[i];
      console.log(`🔍 Processing question ${i + 1}/${FINANCIAL_QUESTIONS.length}: ${question.question}`);
      
      try {
        // Update progress with error handling
        const progress = Math.round((i / FINANCIAL_QUESTIONS.length) * 100);
        await storageService.updateBackgroundJob(jobId, {
          progress,
          processedDocuments: i,
          currentDocumentName: question.question,
          currentStep: `Analyzing: ${question.category}`
        });
        
        // Extract evidence from ALL assigned documents for this question
        console.log(`📄 Processing ${assignedDocuments.length} documents for question: ${question.question}`);
        const documentEvidence = await this.extractEvidenceFromAllDocuments(
          assignedDocuments, 
          question
        );
        console.log(`📊 Evidence extraction completed for question: ${question.question}`);
        
        // Compile comprehensive answer based on all evidence
        const answer = await this.compileComprehensiveAnswer(question, documentEvidence);
        financialAnswers[question.id] = answer;
        
        console.log(`✅ Completed question ${i + 1}/${FINANCIAL_QUESTIONS.length}: ${question.question}`);
        
        // Brief delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (questionError) {
        console.error(`❌ Error processing question "${question.question}":`, questionError);
        
        // Store partial answer for this question
        financialAnswers[question.id] = {
          question: question.question,
          category: question.category,
          answer: `Error processing this question: ${(questionError as Error).message}`,
          confidence: 0,
          sources: [],
          evidence: [],
          error: true
        };
        
        // Continue with next question instead of failing completely
        continue;
      }
    }
    
    try {
      // Update progress to completion
      await storageService.updateBackgroundJob(jobId, {
        progress: 100,
        processedDocuments: FINANCIAL_QUESTIONS.length,
        currentStep: 'Generating findings and recommendations',
        status: 'completing'
      });
      
      // Generate comprehensive findings and recommendations
      const findings = [];
      const recommendations = [];
      
      // Extract findings from answers
      Object.values(financialAnswers).forEach((answer: any) => {
        if (answer.confidence > 0 && !answer.error) {
          findings.push(`${answer.category}: ${answer.answer.substring(0, 200)}...`);
          
          if (answer.category === 'Financial Statements') {
            recommendations.push('Review financial statement accuracy and completeness');
          } else if (answer.category === 'Revenue Models') {
            recommendations.push('Validate revenue model sustainability and scalability');
          } else if (answer.category === 'Financial Projections') {
            recommendations.push('Verify projection assumptions and scenarios');
          }
        }
      });
      
      // Store the comprehensive analysis in agent_analyses table
      const analysisData = {
        findings,
        recommendations,
        financial_answers: financialAnswers,
        financialAnswers: financialAnswers, // Also store in the expected format
        documentCount: assignedDocuments.length,
        questionsAnalyzed: FINANCIAL_QUESTIONS.length,
        completionRate: Math.round((Object.values(financialAnswers).filter((a: any) => !a.error).length / FINANCIAL_QUESTIONS.length) * 100)
      };
      
      await storageService.saveAgentAnalysis(dealId, 'Financial', analysisData);
      console.log(`💾 Saved financial analysis to database for deal ${dealId}`);
      
      // Final completion
      await storageService.updateBackgroundJob(jobId, {
        status: 'completed',
        progress: 100,
        currentStep: 'Financial analysis completed',
        completedAt: new Date()
      });
      
      console.log(`✅ Financial analysis completed for deal ${dealId}`);
      return analysisData;
      
    } catch (error) {
      console.error(`❌ Error completing financial analysis for deal ${dealId}:`, error);
      await storageService.updateBackgroundJob(jobId, {
        status: 'failed',
        progress: 100,
        error: (error as Error).message,
        currentStep: 'Analysis failed'
      });
      throw error;
    }
  }

  async getAnalysisResults(dealId: number) {
    try {
      const analysis = await db.select()
        .from(agentAnalyses)
        .where(and(
          eq(agentAnalyses.dealId, dealId),
          eq(agentAnalyses.agentType, 'Financial')
        ))
        .orderBy(agentAnalyses.createdAt)
        .limit(1);

      if (analysis.length === 0) {
        return null;
      }

      const result = analysis[0];
      return {
        findings: result.findings || [],
        recommendations: result.recommendations || [],
        status: result.status,
        progress: 100,
        createdAt: result.createdAt,
        documentSources: [],
        financial_answers: result.financial_answers || null,
        financialAnswers: result.financialAnswers || null
      };
    } catch (error) {
      console.error(`❌ Error retrieving financial analysis results:`, error);
      return null;
    }
  }
}

export const comprehensiveFinancialAnalysisService = new ComprehensiveFinancialAnalysisService();

// Simple wrapper function that matches the pattern used by other analysis services
export async function startComprehensiveAnalysis(dealId: number) {
  const jobId = `financial_analysis_${dealId}_${Date.now()}`;
  
  // Create background job
  const job = {
    jobId,
    dealId,
    jobType: 'comprehensive_financial_analysis',
    agentType: 'Financial' as const,
    status: 'processing' as const,
    progress: 0,
    startTime: new Date()
  };

  await storage.createBackgroundJob(job);

  // Progress callback function
  const progressCallback = async (progress: number, step: string) => {
    try {
      await storage.updateBackgroundJob(jobId, {
        progress,
        currentStep: step
      });
    } catch (error) {
      console.error(`Error updating Financial job progress:`, error);
    }
  };

  // Run the analysis
  return await comprehensiveFinancialAnalysisService.runComprehensiveAnalysis(dealId, storage, jobId, progressCallback);
}