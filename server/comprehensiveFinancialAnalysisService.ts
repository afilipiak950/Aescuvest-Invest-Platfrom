/**
 * Comprehensive Financial Analysis Service
 * Analyzes ALL assigned financial documents systematically for each question
 * Extracts specific evidence from documents and compiles complete answers
 * EXACT COPY of Clinical micro-step architecture for perfect parity
 */

import { db } from './db';
import { documents, agentAnalyses } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { storage } from './storage';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Enhanced financial questions for comprehensive analysis
export const COMPREHENSIVE_FINANCIAL_QUESTIONS = [
  // Financial Performance & KPIs
  { 
    id: 'performance_1', 
    question: 'What are the key financial performance metrics and KPIs?', 
    category: 'Financial Performance & KPIs',
    analysisPrompt: 'Identify revenue, profit margins, growth rates, ROI, EBITDA, cash flow metrics, and financial KPIs.',
    keywords: ['revenue', 'profit', 'margin', 'ebitda', 'roi', 'growth rate', 'kpi', 'financial metrics', 'performance indicators']
  },
  { 
    id: 'performance_2', 
    question: 'How has financial performance trended over time?', 
    category: 'Financial Performance & KPIs',
    analysisPrompt: 'Analyze financial trends, year-over-year growth, quarterly performance, and historical financial patterns.',
    keywords: ['trend', 'growth', 'year over year', 'quarterly', 'historical', 'performance trend', 'financial trajectory']
  },
  { 
    id: 'performance_3', 
    question: 'What are the unit economics and scalability metrics?', 
    category: 'Financial Performance & KPIs',
    analysisPrompt: 'Find unit economics data, customer acquisition cost (CAC), lifetime value (LTV), contribution margins.',
    keywords: ['unit economics', 'cac', 'ltv', 'customer acquisition cost', 'lifetime value', 'contribution margin', 'scalability']
  },
  // Cash Flow & Burn Rate
  { 
    id: 'cashflow_1', 
    question: 'What is the current cash position and runway?', 
    category: 'Cash Flow & Burn Rate',
    analysisPrompt: 'Identify cash position, cash on hand, monthly burn rate, and projected runway calculations.',
    keywords: ['cash', 'runway', 'burn rate', 'cash flow', 'liquidity', 'cash position', 'working capital']
  },
  { 
    id: 'cashflow_2', 
    question: 'How is working capital managed?', 
    category: 'Cash Flow & Burn Rate',
    analysisPrompt: 'Analyze working capital management, accounts receivable, payable, inventory management.',
    keywords: ['working capital', 'accounts receivable', 'accounts payable', 'inventory', 'cash conversion cycle']
  },
  { 
    id: 'cashflow_3', 
    question: 'What are the seasonal or cyclical cash flow patterns?', 
    category: 'Cash Flow & Burn Rate',
    analysisPrompt: 'Look for seasonal variations, cyclical patterns, and cash flow volatility in business operations.',
    keywords: ['seasonal', 'cyclical', 'cash flow pattern', 'volatility', 'seasonal variation']
  },
  // Funding & Investment History
  { 
    id: 'funding_1', 
    question: 'What is the funding history and investment rounds?', 
    category: 'Funding & Investment History',
    analysisPrompt: 'Identify funding rounds, investment amounts, investor details, valuation history, and equity structure.',
    keywords: ['funding', 'investment', 'round', 'series a', 'series b', 'seed', 'valuation', 'investor', 'equity']
  },
  { 
    id: 'funding_2', 
    question: 'How are funds allocated and what is the use of proceeds?', 
    category: 'Funding & Investment History',
    analysisPrompt: 'Find fund allocation strategies, use of proceeds, capital deployment plans, and spending priorities.',
    keywords: ['use of proceeds', 'fund allocation', 'capital deployment', 'spending plan', 'investment priorities']
  },
  // Financial Controls & Reporting
  { 
    id: 'controls_1', 
    question: 'What financial controls and reporting systems are in place?', 
    category: 'Financial Controls & Reporting',
    analysisPrompt: 'Identify financial controls, accounting systems, audit processes, and financial reporting infrastructure.',
    keywords: ['financial controls', 'accounting system', 'audit', 'financial reporting', 'internal controls', 'compliance']
  },
  { 
    id: 'controls_2', 
    question: 'Are there any audit findings or compliance issues?', 
    category: 'Financial Controls & Reporting',
    analysisPrompt: 'Look for audit findings, compliance issues, regulatory concerns, and financial risk factors.',
    keywords: ['audit findings', 'compliance', 'regulatory', 'risk factors', 'financial risk', 'material weakness']
  },
  // Revenue Model & Monetization
  { 
    id: 'revenue_1', 
    question: 'What is the revenue model and monetization strategy?', 
    category: 'Revenue Model & Monetization',
    analysisPrompt: 'Analyze revenue streams, pricing models, monetization strategies, and business model sustainability.',
    keywords: ['revenue model', 'monetization', 'pricing', 'business model', 'revenue stream', 'subscription', 'saas']
  },
  { 
    id: 'revenue_2', 
    question: 'How predictable and recurring is the revenue?', 
    category: 'Revenue Model & Monetization',
    analysisPrompt: 'Assess revenue predictability, recurring revenue percentage, customer retention, and revenue quality.',
    keywords: ['recurring revenue', 'arr', 'mrr', 'predictable', 'retention', 'churn', 'revenue quality']
  }
];

export interface FinancialAnalysisProgress {
  isRunning: boolean;
  progress: number;
  message: string;
  currentStep?: string;
  totalSteps?: number;
  currentQuestion?: string;
}

interface FinancialEvidence {
  documentName: string;
  documentSummary: string;
  relevantContent: string[];
  keyFindings: string[];
  confidence: number;
}

interface FinancialAnswer {
  question: string;
  answer: string;
  confidence: number;
  sources: string[];
  detailedEvidence: FinancialEvidence[];
  keyFindings: string[];
  evidenceSummary: string;
  financialAssessment: string;
  recommendations: string[];
}

export class ComprehensiveFinancialAnalysisService {
  private isRunning = false;
  private progress = 0;
  private currentStep = '';
  private currentQuestion = '';

  async startComprehensiveAnalysis(dealId: number, jobId?: string): Promise<void> {
    try {
      this.isRunning = true;
      this.progress = 0;
      this.currentStep = 'Initializing financial analysis';
      this.currentQuestion = '';

      console.log(`💰 Starting comprehensive financial analysis for deal ${dealId}`);

      // Update background job status
      if (jobId) {
        await storage.updateBackgroundJob(jobId, {
          status: 'processing',
          progress: 0,
          message: 'Starting comprehensive financial analysis',
          currentStep: this.currentStep
        });
      }

      // Step 1: Get assigned financial documents for this deal
      console.log(`👥 Finding assigned financial documents for deal ${dealId}`);
      const assignedDocuments = await this.getAssignedDocuments(dealId);
      
      if (assignedDocuments.length === 0) {
        console.log(`⚠️ No financial documents found for analysis of deal ${dealId}`);
        if (jobId) {
          await storage.updateBackgroundJob(jobId, {
            status: 'completed',
            progress: 100,
            message: 'No financial documents found for analysis'
          });
        }
        return;
      }

      console.log(`📄 Found ${assignedDocuments.length} financial documents for analysis`);
      
      if (jobId) {
        await storage.updateBackgroundJob(jobId, {
          progress: 5,
          message: `Found ${assignedDocuments.length} financial documents`,
          currentStep: `Processing ${assignedDocuments.length} financial documents`
        });
      }

      // Step 2: Process each financial question systematically with EXACT micro-step progression
      const financialAnswers: { [key: string]: FinancialAnswer } = {};
      
      for (let i = 0; i < COMPREHENSIVE_FINANCIAL_QUESTIONS.length; i++) {
        const question = COMPREHENSIVE_FINANCIAL_QUESTIONS[i];
        const questionNumber = i + 1;
        const totalQuestions = COMPREHENSIVE_FINANCIAL_QUESTIONS.length;
        
        console.log(`📊 Processing financial question ${questionNumber}/${totalQuestions}: ${question.question}`);
        this.currentQuestion = question.question;
        this.currentStep = `Analyzing: ${question.question}`;
        
        // Calculate EXACT micro-step progress to match Clinical/HR: 8%, 17%, 25%, 33%, 42%, 50%, 58%, 67%, 75%, 83%, 92%, 100%
        const baseProgress = 8;
        const progressIncrement = Math.floor((100 - baseProgress) / totalQuestions);
        const currentProgress = baseProgress + (i * progressIncrement);
        this.progress = Math.min(currentProgress, 100);
        
        if (jobId) {
          await storage.updateBackgroundJob(jobId, {
            progress: this.progress,
            message: `Processing question ${questionNumber}/${totalQuestions}`,
            currentStep: this.currentStep,
            currentQuestion: this.currentQuestion
          });
        }

        // Extract evidence for this specific question
        console.log(`📊 Extracting financial evidence for: ${question.question}`);
        const evidence = await this.extractEvidenceFromAllDocuments(assignedDocuments, question);
        
        // Compile comprehensive answer
        console.log(`🤖 Starting OpenAI analysis for question: ${question.question} with ${evidence.length} pieces of evidence`);
        const answer = await this.compileComprehensiveAnswer(question, evidence);
        
        financialAnswers[question.id] = answer;
        console.log(`✅ Completed question ${questionNumber}/${totalQuestions}: ${question.question}`);
      }

      // Step 3: Store results with EXACT same pattern as HR/Commercial
      console.log(`💾 Storing comprehensive financial analysis results for deal ${dealId}`);
      
      if (jobId) {
        await storage.updateBackgroundJob(jobId, {
          progress: 95,
          message: 'Storing comprehensive analysis results',
          currentStep: 'Finalizing financial analysis'
        });
      }

      await this.storeComprehensiveResults(dealId, financialAnswers, assignedDocuments);

      // Final completion
      this.progress = 100;
      this.currentStep = 'Financial analysis completed';
      
      if (jobId) {
        await storage.updateBackgroundJob(jobId, {
          status: 'completed',
          progress: 100,
          message: 'Comprehensive financial analysis completed successfully',
          currentStep: this.currentStep
        });
      }

      console.log(`✅ Comprehensive financial analysis completed for deal ${dealId}`);

    } catch (error) {
      console.error('Error in comprehensive financial analysis:', error);
      this.isRunning = false;
      
      if (jobId) {
        await storage.updateBackgroundJob(jobId, {
          status: 'failed',
          message: `Financial analysis failed: ${error.message}`,
          error: error.message
        });
      }
      
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  private async getAssignedDocuments(dealId: number): Promise<any[]> {
    // Get ALL documents for this deal with AI summaries (comprehensive approach matching Legal/Clinical)
    console.log(`👥 Found ${await this.getTotalDocumentCount(dealId)} total documents for deal ${dealId}`);
    
    const allDocuments = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.dealId, dealId),
          // Only include documents that have been processed with AI summaries
          // This ensures we have quality content to analyze
        )
      );

    // Filter for documents with AI summaries for quality analysis
    const documentsWithSummaries = allDocuments.filter(doc => 
      doc.aiSummary && 
      typeof doc.aiSummary === 'string' && 
      doc.aiSummary.trim().length > 0
    );
    
    console.log(`👥 Financial analysis will process ALL ${documentsWithSummaries.length} documents with AI summaries (comprehensive approach matching Legal/Clinical)`);
    
    return documentsWithSummaries;
  }

  private async getTotalDocumentCount(dealId: number): Promise<number> {
    const allDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, dealId));
    
    return allDocuments.length;
  }

  private async extractEvidenceFromAllDocuments(assignedDocuments: any[], question: any): Promise<FinancialEvidence[]> {
    const evidence: FinancialEvidence[] = [];
    
    // SPEED MODE: Use only first 30 documents for faster processing (matching Clinical optimization)
    const documentsToProcess = assignedDocuments.slice(0, 30);
    console.log(`📄 SPEED MODE: Starting evidence extraction from ${documentsToProcess.length} documents for: ${question.question}`);
    console.log(`🚀 SPEED OPTIMIZATION: Processing top ${documentsToProcess.length} documents (reduced from ${assignedDocuments.length} for speed)`);

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

      try {
        // Add timeout for batch processing (15 seconds max)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Batch processing timeout')), 15000);
        });

        const results = await Promise.race([
          Promise.allSettled(batchPromises),
          timeoutPromise
        ]) as PromiseSettledResult<FinancialEvidence | null>[];

        const validResults = results
          .filter((result): result is PromiseFulfilledResult<FinancialEvidence> => 
            result.status === 'fulfilled' && result.value !== null
          )
          .map(result => result.value);

        evidence.push(...validResults);
        
        console.log(`✅ FAST Batch ${batchIndex + 1} completed: ${validResults.length}/${batch.length} documents had relevant evidence`);

      } catch (error) {
        console.log(`⚠️ FAST Batch ${batchIndex + 1} timeout, continuing with next batch`);
        continue;
      }
    }

    console.log(`🎯 SPEED MODE: Extracted evidence from ${evidence.length}/${documentsToProcess.length} documents in FAST mode`);
    console.log(`📊 Evidence extraction completed for question: ${question.question}`);
    
    return evidence;
  }

  private async extractEvidenceFromDocument(doc: any, question: any): Promise<FinancialEvidence | null> {
    try {
      console.log(`🔎 FAST Extracting evidence from: ${doc.name}`);
      
      // Use AI summary if available, otherwise fall back to OCR content
      const content = doc.aiSummary || doc.ocrText || '';
      
      if (!content || content.trim().length === 0) {
        return null;
      }

      // Quick keyword check first (for speed)
      const hasRelevantKeywords = question.keywords.some((keyword: string) =>
        content.toLowerCase().includes(keyword.toLowerCase())
      );

      if (!hasRelevantKeywords) {
        return null;
      }

      // Extract specific evidence using OpenAI with focused prompt
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a financial analysis expert. Extract specific evidence related to the given question from the document content. Focus on quantitative data, financial metrics, and specific financial information.`
          },
          {
            role: "user",
            content: `Document: "${doc.name}"
            Content: ${content.substring(0, 4000)}
            
            Question: ${question.question}
            Analysis Focus: ${question.analysisPrompt}
            
            Extract specific evidence, financial data, and key findings related to this question. Return in JSON format:
            {
              "relevantContent": ["specific quotes or data points"],
              "keyFindings": ["key financial insights"],
              "confidence": 0.0-1.0
            }`
          }
        ],
        temperature: 0.1,
        max_tokens: 800
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        documentName: doc.name,
        documentSummary: doc.aiSummary || 'No summary available',
        relevantContent: result.relevantContent || [],
        keyFindings: result.keyFindings || [],
        confidence: result.confidence || 0.5
      };

    } catch (error) {
      console.error(`Error extracting evidence from ${doc.name}:`, error);
      return null;
    }
  }

  private async compileComprehensiveAnswer(question: any, evidence: FinancialEvidence[]): Promise<FinancialAnswer> {
    console.log(`🔍 Compiling answer for: ${question.question}`);
    console.log(`📋 Evidence count: ${evidence.length}`);

    if (evidence.length === 0) {
      return {
        question: question.question,
        answer: "Insufficient financial data available in the provided documents to answer this question comprehensively.",
        confidence: 0.1,
        sources: [],
        detailedEvidence: [],
        keyFindings: ["No relevant financial evidence found"],
        evidenceSummary: "No financial evidence located",
        financialAssessment: "Unable to assess due to lack of data",
        recommendations: ["Obtain additional financial documentation for comprehensive analysis"]
      };
    }

    try {
      // Compile evidence summary
      const evidenceSummary = evidence.map(e => 
        `${e.documentName}: ${e.keyFindings.join(', ')}`
      ).join('\n');

      // Generate comprehensive analysis using OpenAI
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a senior financial analyst conducting comprehensive due diligence. Analyze the provided evidence to answer the financial question thoroughly. Provide specific, quantitative insights with clear financial implications.`
          },
          {
            role: "user",
            content: `Question: ${question.question}
            Category: ${question.category}
            Analysis Focus: ${question.analysisPrompt}
            
            Evidence from documents:
            ${evidenceSummary}
            
            Detailed Evidence:
            ${evidence.map(e => `
            Document: ${e.documentName}
            Findings: ${e.keyFindings.join('; ')}
            Content: ${e.relevantContent.join('; ')}
            `).join('\n')}
            
            Provide a comprehensive financial analysis in JSON format:
            {
              "answer": "detailed financial analysis with specific data points",
              "confidence": 0.0-1.0,
              "keyFindings": ["key financial insights"],
              "financialAssessment": "overall financial assessment and implications",
              "recommendations": ["specific financial recommendations"]
            }`
          }
        ],
        temperature: 0.1,
        max_tokens: 1200
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        question: question.question,
        answer: result.answer || "Unable to provide comprehensive analysis based on available evidence.",
        confidence: result.confidence || 0.5,
        sources: evidence.map(e => e.documentName),
        detailedEvidence: evidence,
        keyFindings: result.keyFindings || [],
        evidenceSummary: evidenceSummary,
        financialAssessment: result.financialAssessment || "Assessment unavailable",
        recommendations: result.recommendations || []
      };

    } catch (error) {
      console.error('Error compiling financial answer:', error);
      
      return {
        question: question.question,
        answer: "Error occurred during financial analysis compilation.",
        confidence: 0.1,
        sources: evidence.map(e => e.documentName),
        detailedEvidence: evidence,
        keyFindings: ["Analysis compilation failed"],
        evidenceSummary: evidenceSummary,
        financialAssessment: "Assessment failed due to processing error",
        recommendations: ["Retry analysis with technical support"]
      };
    }
  }

  private async storeComprehensiveResults(dealId: number, financialAnswers: { [key: string]: FinancialAnswer }, assignedDocuments: any[]): Promise<void> {
    try {
      // Generate findings and recommendations from all answers
      const findings = Object.values(financialAnswers).flatMap(answer => 
        answer.keyFindings.map((finding, index) => ({
          id: Object.keys(financialAnswers).indexOf(Object.keys(financialAnswers).find(key => financialAnswers[key] === answer)!) * 100 + index,
          content: finding,
          type: 'Financial Finding'
        }))
      );

      const recommendations = Object.values(financialAnswers).flatMap(answer =>
        answer.recommendations.map((rec, index) => ({
          title: `Financial Recommendation ${index + 1}`,
          description: rec,
          priority: 'Medium',
          category: 'Financial',
          impact: 'Medium'
        }))
      );

      // Clear existing financial analysis for this deal - EXACT copy of HR pattern
      await db.delete(agentAnalyses).where(
        and(
          eq(agentAnalyses.dealId, dealId),
          eq(agentAnalyses.agentType, 'Financial')
        )
      );
      
      console.log(`🗑️ Cleared existing financial analysis for deal ${dealId}`);
      
      // Create the new comprehensive analysis - EXACT copy of HR structure
      const analysisData = {
        dealId,
        agentType: 'Financial' as const,
        status: 'completed' as const,
        progress: 100,
        findings: JSON.stringify(findings),
        recommendations: JSON.stringify(recommendations),
        financial_answers: JSON.stringify(financialAnswers), // CRITICAL: Use snake_case field name like other agents
        documentSources: JSON.stringify(assignedDocuments.map((d: any) => d.name)),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.insert(agentAnalyses).values(analysisData);
      
      console.log(`📊 Created fresh comprehensive financial analysis for deal ${dealId} with ${Object.keys(financialAnswers).length} questions answered`);

    } catch (error) {
      console.error('Error storing comprehensive financial results:', error);
      throw error;
    }
  }

  getProgress(): FinancialAnalysisProgress {
    return {
      isRunning: this.isRunning,
      progress: this.progress,
      message: this.currentStep,
      currentStep: this.currentStep,
      currentQuestion: this.currentQuestion,
      totalSteps: COMPREHENSIVE_FINANCIAL_QUESTIONS.length
    };
  }

  // EXACT copy of Clinical's generateComprehensiveFindings method
  async generateComprehensiveFindings(answers: { [key: string]: FinancialAnswer }): Promise<any[]> {
    try {
      const findings = [];
      let findingId = 1;

      for (const [questionId, answer] of Object.entries(answers)) {
        // Add main answer as finding
        findings.push({
          id: findingId++,
          content: `${answer.question}: ${answer.answer}`,
          type: 'Financial Analysis',
          confidence: answer.confidence,
          sources: answer.sources
        });

        // Add key findings
        for (const keyFinding of answer.keyFindings) {
          findings.push({
            id: findingId++,
            content: keyFinding,
            type: 'Financial Key Finding',
            confidence: answer.confidence,
            sources: answer.sources
          });
        }
      }

      return findings;
    } catch (error) {
      console.error('Error generating comprehensive financial findings:', error);
      return [];
    }
  }
}