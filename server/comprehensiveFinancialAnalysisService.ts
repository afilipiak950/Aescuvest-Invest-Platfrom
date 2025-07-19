/**
 * Comprehensive Financial Analysis Service
 * Provides comprehensive financial analysis for all assigned financial documents
 */

import { storage } from './storage';
import { db } from './db';
import { documents } from '@shared/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Comprehensive financial questions covering all financial due diligence areas
const FINANCIAL_QUESTIONS = [
  {
    id: 'revenue_1',
    category: 'Revenue & Growth',
    question: 'What are the current revenue streams and growth trajectory?',
    analysisPrompt: 'Find revenue data, sales figures, recurring revenue, growth rates, and revenue projections.'
  },
  {
    id: 'revenue_2',
    category: 'Revenue & Growth',
    question: 'What is the revenue quality and sustainability?',
    analysisPrompt: 'Analyze customer concentration, contract terms, churn rates, and revenue predictability.'
  },
  {
    id: 'profitability_1',
    category: 'Profitability & Margins',
    question: 'What are the gross margins and unit economics?',
    analysisPrompt: 'Calculate gross margins, contribution margins, customer acquisition cost, lifetime value.'
  },
  {
    id: 'profitability_2',
    category: 'Profitability & Margins',
    question: 'What is the path to profitability?',
    analysisPrompt: 'Analyze burn rate, runway, break-even point, and profitability timeline.'
  },
  {
    id: 'cash_1',
    category: 'Cash Flow & Working Capital',
    question: 'What is the current cash position and burn rate?',
    analysisPrompt: 'Find cash balances, monthly burn rate, cash runway, and working capital needs.'
  },
  {
    id: 'cash_2',
    category: 'Cash Flow & Working Capital',
    question: 'Are there any cash flow timing issues?',
    analysisPrompt: 'Analyze accounts receivable, payment terms, seasonal fluctuations, and cash conversion cycle.'
  },
  {
    id: 'funding_1',
    category: 'Funding & Capital Structure',
    question: 'What is the complete funding history?',
    analysisPrompt: 'Identify all funding rounds, investors, valuations, and terms.'
  },
  {
    id: 'funding_2',
    category: 'Funding & Capital Structure',
    question: 'What are the future funding requirements?',
    analysisPrompt: 'Assess capital needs, use of proceeds, and dilution scenarios.'
  },
  {
    id: 'costs_1',
    category: 'Cost Structure & Efficiency',
    question: 'What is the cost structure breakdown?',
    analysisPrompt: 'Analyze fixed vs variable costs, personnel costs, technology costs, and operational efficiency.'
  },
  {
    id: 'costs_2',
    category: 'Cost Structure & Efficiency',
    question: 'Are there cost optimization opportunities?',
    analysisPrompt: 'Identify potential cost savings, scalability factors, and efficiency improvements.'
  },
  {
    id: 'metrics_1',
    category: 'Key Financial Metrics',
    question: 'What are the key SaaS/business metrics?',
    analysisPrompt: 'Find metrics like ARR, MRR, CAC, LTV, churn rate, NPS, and retention rates.'
  },
  {
    id: 'metrics_2',
    category: 'Key Financial Metrics',
    question: 'How do metrics compare to industry benchmarks?',
    analysisPrompt: 'Compare financial metrics to industry standards and competitive benchmarks.'
  },
  {
    id: 'risks_1',
    category: 'Financial Risks & Dependencies',
    question: 'What are the major financial risks?',
    analysisPrompt: 'Identify concentration risks, market risks, operational risks, and financial dependencies.'
  },
  {
    id: 'risks_2',
    category: 'Financial Risks & Dependencies',
    question: 'Are there any accounting or reporting issues?',
    analysisPrompt: 'Review accounting practices, audit findings, financial controls, and reporting quality.'
  }
];

export class ComprehensiveFinancialAnalysisService {
  private progressData = new Map<number, any>();

  getProgress(dealId: number) {
    return this.progressData.get(dealId) || {
      isRunning: false,
      progress: 0,
      message: 'No comprehensive financial analysis running'
    };
  }

  private setProgress(dealId: number, progress: any) {
    const current = this.getProgress(dealId);
    this.progressData.set(dealId, { ...current, ...progress });
  }

  async startComprehensiveAnalysis(dealId: number): Promise<void> {
    console.log(`💰 Starting comprehensive financial analysis for deal ${dealId}`);
    
    // Create background job for progress tracking (same as Legal)
    const jobId = `financial_analysis_${dealId}_${Date.now()}`;
    
    try {
      await storage.createBackgroundJob({
        jobId,
        jobType: 'comprehensive_financial_analysis',
        dealId,
        agentType: 'Financial',
        status: 'processing',
        progress: 0,
        totalDocuments: 0,
        processedDocuments: 0,
        startedAt: new Date()
      });
    } catch (error) {
      console.error(`❌ Failed to create background job for deal ${dealId}:`, error);
      throw new Error(`Failed to initialize comprehensive financial analysis: ${error.message}`);
    }
    
    this.setProgress(dealId, {
      isRunning: true,
      progress: 5,
      message: 'Initializing comprehensive financial analysis...',
      currentStep: 'Finding financial documents',
      totalSteps: FINANCIAL_QUESTIONS.length
    });

    try {
      // Get all documents suitable for financial analysis
      const financialDocs = await this.getAssignedFinancialDocuments(dealId);
      console.log(`💰 Found ${financialDocs.length} financial documents for analysis`);

      if (financialDocs.length === 0) {
        await storage.updateBackgroundJob(jobId, {
          status: 'completed',
          progress: 100,
          error: 'No financial documents available for analysis'
        });
        this.setProgress(dealId, {
          isRunning: false,
          progress: 100,
          message: 'No financial documents found for analysis'
        });
        throw new Error('No documents available for financial analysis');
      }
      
      // Update job with total questions to process
      await storage.updateBackgroundJob(jobId, {
        totalDocuments: FINANCIAL_QUESTIONS.length,
        currentStep: 'Analyzing financial documents across 14 question categories'
      });

      // Process each question comprehensively
      const financialAnswers: Record<string, any> = {};
      
      for (let i = 0; i < FINANCIAL_QUESTIONS.length; i++) {
        const question = FINANCIAL_QUESTIONS[i];
        console.log(`💰 Processing question ${i + 1}/${FINANCIAL_QUESTIONS.length}: ${question.question}`);
        
        try {
          // Update progress with error handling (both internal and background job)
          const progress = Math.round((i / FINANCIAL_QUESTIONS.length) * 100);
          await storage.updateBackgroundJob(jobId, {
            progress,
            processedDocuments: i,
            currentDocumentName: question.question,
            currentStep: `Analyzing: ${question.category}`
          });
          
          this.setProgress(dealId, {
            progress,
            currentStep: `Analyzing: ${question.category}`,
            currentQuestion: question.question
          });

          // Extract evidence from ALL assigned documents for this question
          console.log(`💰 Processing ${financialDocs.length} documents for question: ${question.question}`);
          const documentEvidence = await this.extractEvidenceFromAllDocuments(financialDocs, question);

          // Generate comprehensive answer using AI
          const answer = await this.generateComprehensiveAnswer(question, documentEvidence);
          financialAnswers[question.id] = answer;

          console.log(`✅ Completed question ${i + 1}/${FINANCIAL_QUESTIONS.length}: ${question.question}`);

        } catch (questionError) {
          console.error(`💰 Error processing question ${question.question}:`, questionError);
          // Continue with other questions even if one fails
          financialAnswers[question.id] = {
            question: question.question,
            answer: "Error processing this question. Please review manually.",
            confidence: 0,
            sources: [],
            evidenceCount: 0,
            documentsCovered: 0
          };
        }
      }

      // Store results in database (same format as legal analysis)
      await storage.updateBackgroundJob(jobId, {
        progress: 95,
        currentStep: 'Storing financial analysis results...'
      });
      
      this.setProgress(dealId, {
        progress: 95,
        currentStep: 'Storing financial analysis results...'
      });

      // Generate findings and recommendations from financial answers
      const findings = [];
      const recommendations = [];
      
      for (const [questionId, answer] of Object.entries(financialAnswers)) {
        if (answer.keyFindings && answer.keyFindings.length > 0) {
          findings.push(...answer.keyFindings.map(finding => ({
            id: findings.length + 1,
            type: 'positive',
            content: finding,
            source: answer.sources?.[0] || 'Financial Analysis',
            confidence: answer.confidence || 85,
            category: questionId,
            evidenceCount: answer.evidenceCount || 0
          })));
        }
        
        if (answer.recommendations && answer.recommendations.length > 0) {
          recommendations.push(...answer.recommendations.map(rec => ({
            id: recommendations.length + 1,
            type: 'financial',
            content: rec,
            source: 'Financial Analysis',
            confidence: answer.confidence || 85,
            category: questionId
          })));
        }
      }

      const existingAnalysis = await storage.getAnalysisByDealAndAgent(dealId, 'financial');
      
      if (existingAnalysis) {
        await storage.updateAnalysis(existingAnalysis.id, {
          ...existingAnalysis,
          financialAnswers: JSON.stringify(financialAnswers),
          findings: JSON.stringify(findings),
          recommendations: JSON.stringify(recommendations),
          status: 'completed',
          progress: 100,
          questionsAnswered: Object.keys(financialAnswers).length,
          totalQuestions: FINANCIAL_QUESTIONS.length,
          completionRate: Math.round((Object.keys(financialAnswers).length / FINANCIAL_QUESTIONS.length) * 100)
        });
      } else {
        await storage.createAnalysis({
          dealId,
          agentType: 'financial',
          status: 'completed',
          progress: 100,
          financialAnswers: JSON.stringify(financialAnswers),
          findings: JSON.stringify(findings),
          recommendations: JSON.stringify(recommendations),
          questionsAnswered: Object.keys(financialAnswers).length,
          totalQuestions: FINANCIAL_QUESTIONS.length,
          completionRate: Math.round((Object.keys(financialAnswers).length / FINANCIAL_QUESTIONS.length) * 100),
          createdAt: new Date()
        });
      }

      // Complete the job
      await storage.updateBackgroundJob(jobId, {
        status: 'completed',
        progress: 100,
        currentStep: `Financial analysis completed - ${Object.keys(financialAnswers).length} questions analyzed`,
        completedAt: new Date()
      });
      
      this.setProgress(dealId, {
        isRunning: false,
        progress: 100,
        message: `Comprehensive financial analysis completed - ${Object.keys(financialAnswers).length} questions answered`
      });

      console.log(`💰 Comprehensive financial analysis completed for deal ${dealId}`);
      
    } catch (error) {
      console.error(`💰 Error in comprehensive financial analysis:`, error);
      
      // Update background job status to failed
      await storage.updateBackgroundJob(jobId, {
        status: 'failed',
        currentStep: `Error: ${error.message}`,
        error: error.message
      });
      
      this.setProgress(dealId, {
        isRunning: false,
        progress: 0,
        message: 'Financial analysis failed: ' + (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Extract evidence from ALL documents for a specific question
   */
  private async extractEvidenceFromAllDocuments(documents: any[], question: any): Promise<any[]> {
    console.log(`💰 Starting evidence extraction from ${documents.length} documents for question: ${question.question}`);
    
    const evidence: any[] = [];
    const batchSize = 10;
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(documents.length / batchSize);
      
      console.log(`💰 Processing batch ${batchNumber}/${totalBatches} (${batch.length} documents)`);
      
      const batchPromises = batch.map(async (doc) => {
        try {
          return await this.extractEvidenceFromDocument(doc, question);
        } catch (error) {
          console.error(`💰 Error processing document ${doc.name}:`, error);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      const validEvidence = batchResults.filter(docEvidence => 
        docEvidence && docEvidence.relevantContent.length > 0
      );
      evidence.push(...validEvidence);
      
      console.log(`✅ Batch ${batchNumber} completed: ${validEvidence.length}/${batch.length} documents had relevant evidence`);
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
    
    const prompt = `You are a financial analyst. Analyze this document for specific financial information.

Question: ${question.question}
Analysis Focus: ${question.analysisPrompt}

Document: ${document.name}
Content: ${content.substring(0, 2000)}

Extract relevant financial information, numbers, data points, or statements that directly address this question.
Return ONLY specific quotes, figures, or facts - no interpretation.
If no relevant information exists, return "No relevant content found."

Format your response as specific evidence quotes.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.1
    });

    const relevantContent = response.choices[0].message.content?.trim() || '';
    
    if (relevantContent === "No relevant content found." || relevantContent.length < 10) {
      return null;
    }

    return {
      documentName: document.name,
      relevantContent: [relevantContent],
      confidence: 0.85
    };
  }

  /**
   * Generate comprehensive answer using AI analysis
   */
  private async generateComprehensiveAnswer(question: any, evidence: any[]): Promise<any> {
    if (evidence.length === 0) {
      return {
        question: question.question,
        answer: "No relevant information found in the assigned financial documents for this question.",
        confidence: 10,
        sources: [],
        evidenceCount: 0,
        documentsCovered: 0
      };
    }

    const evidenceText = evidence.map(e => 
      `${e.documentName}: ${e.relevantContent.join('; ')}`
    ).join('\n\n');

    const prompt = `You are a financial due diligence expert. Based on the evidence extracted from documents, provide a comprehensive answer to this financial question.

Question: ${question.question}
Category: ${question.category}
Analysis Focus: ${question.analysisPrompt}

Evidence from Documents:
${evidenceText}

Provide a comprehensive financial analysis including:
1. Direct answer to the question based on evidence
2. Key financial findings and insights
3. Specific recommendations for investors
4. Assessment of financial health and risks

Format as JSON:
{
  "question": "${question.question}",
  "answer": "comprehensive answer based on evidence",
  "confidence": confidence_score_0_to_100,
  "sources": ["document names"],
  "keyFindings": ["finding1", "finding2"],
  "recommendations": ["rec1", "rec2"],
  "evidenceCount": ${evidence.length},
  "documentsCovered": ${evidence.length}
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.2
    });

    try {
      return JSON.parse(response.choices[0].message.content);
    } catch (parseError) {
      console.error(`💰 Error parsing AI response for question ${question.question}:`, parseError);
      return {
        question: question.question,
        answer: response.choices[0].message.content,
        confidence: 75,
        sources: evidence.map(e => e.documentName),
        keyFindings: [],
        recommendations: [],
        evidenceCount: evidence.length,
        documentsCovered: evidence.length
      };
    }
  }

  /**
   * Get documents assigned to financial analysis
   */
  private async getAssignedFinancialDocuments(dealId: number): Promise<any[]> {
    console.log(`💰 Getting financial documents for deal ${dealId}`);
    
    // Financial keywords for document identification
    const financialKeywords = [
      'financial', 'finance', 'budget', 'revenue', 'income', 'cash', 'profit', 'loss',
      'balance', 'sheet', 'statement', 'audit', 'accounting', 'cost', 'expense', 'funding',
      'investment', 'valuation', 'pricing', 'forecast', 'projection', 'burn', 'runway',
      'metrics', 'kpi', 'arr', 'mrr', 'ltv', 'cac', 'churn', 'margin', 'ebitda',
      'capex', 'opex', 'working capital', 'debt', 'equity', 'shares', 'dilution'
    ];
    
    const allDocuments = await db.select()
      .from(documents)
      .where(eq(documents.dealId, dealId));

    // Filter documents that contain financial-related content
    const financialDocs = allDocuments.filter(doc => {
      const docName = doc.name.toLowerCase();
      const aiSummary = typeof doc.aiSummary === 'string' 
        ? doc.aiSummary 
        : doc.aiSummary?.executiveSummary || '';
      const content = (docName + ' ' + aiSummary).toLowerCase();
      
      return financialKeywords.some(keyword => content.includes(keyword));
    });

    // If no specific financial documents found, use all documents
    if (financialDocs.length === 0) {
      console.log(`💰 No specific financial documents found, using all ${allDocuments.length} documents`);
      return allDocuments;
    }

    console.log(`💰 Found ${financialDocs.length} financial documents out of ${allDocuments.length} total`);
    return financialDocs;
  }
}

export const comprehensiveFinancialAnalysisService = new ComprehensiveFinancialAnalysisService();

/**
 * Get comprehensive financial analysis results
 */
export async function getComprehensiveFinancialAnalysisResults(dealId: number) {
  try {
    const analysis = await storage.getAgentAnalysis(dealId, 'financial');
    
    if (!analysis) {
      return {
        success: false,
        error: 'No financial analysis found for this deal'
      };
    }

    return {
      success: true,
      financialAnswers: analysis.financialAnswers ? JSON.parse(analysis.financialAnswers) : {},
      findings: analysis.findings ? JSON.parse(analysis.findings) : [],
      recommendations: analysis.recommendations ? JSON.parse(analysis.recommendations) : [],
      questionsAnswered: analysis.questionsAnswered || 0,
      totalQuestions: analysis.totalQuestions || FINANCIAL_QUESTIONS.length,
      completionRate: analysis.completionRate || 0
    };
  } catch (error) {
    console.error(`💰 Error getting financial analysis results:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}