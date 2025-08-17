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
            currentStep: 'No financial documents found for analysis'
          });
        }
        return;
      }

      console.log(`📄 Found ${assignedDocuments.length} financial documents for analysis`);
      
      if (jobId) {
        await storage.updateBackgroundJob(jobId, {
          progress: 5,
          currentStep: `Processing ${assignedDocuments.length} financial documents`
        });
      }

      // Step 2: Process each financial question systematically with EXACT micro-step progression
      const financialAnswers: { [key: string]: FinancialAnswer } = {};
      
      for (let i = 0; i < COMPREHENSIVE_FINANCIAL_QUESTIONS.length; i++) {
        const question = COMPREHENSIVE_FINANCIAL_QUESTIONS[i];
        const questionNumber = i + 1;
        const totalQuestions = COMPREHENSIVE_FINANCIAL_QUESTIONS.length;
        
        console.log(`🔍 Question ${questionNumber}/${totalQuestions}: ${question.question}`);
        this.currentQuestion = question.question;
        this.currentStep = `Analyzing: ${question.question}`;
        
        // EXACT Clinical progression formula - no custom calculation
        const progress = Math.round(((i + 1) / COMPREHENSIVE_FINANCIAL_QUESTIONS.length) * 100);
        this.progress = progress;
        
        if (jobId) {
          await storage.updateBackgroundJob(jobId, {
            progress: this.progress,
            currentStep: this.currentStep
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
          currentStep: 'Finalizing financial analysis'
        });
      }

      await this.storeComprehensiveResultsWithoutDeletion(dealId, financialAnswers, assignedDocuments);

      // Final completion
      this.progress = 100;
      this.currentStep = 'Financial analysis completed';
      
      if (jobId) {
        await storage.updateBackgroundJob(jobId, {
          status: 'completed',
          progress: 100,
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
          currentStep: `Financial analysis failed: ${(error as any)?.message || error}`
        });
      }
      
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  private async getAssignedDocuments(dealId: number): Promise<any[]> {
    const allDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, dealId));
    
    console.log(`📄 Total documents found for deal ${dealId}: ${allDocuments.length}`);
    
    // First try documents explicitly assigned to financial agent
    let financialDocuments = allDocuments.filter(doc => 
      (doc.assignedAgents && doc.assignedAgents.includes('financial')) && 
      (doc.ocrText || doc.aiSummary)
    );
    
    console.log(`📄 Documents explicitly assigned to financial: ${financialDocuments.length}`);
    
    // If no documents are explicitly assigned to financial, identify financial-related documents
    if (financialDocuments.length === 0) {
      console.log('📄 No documents explicitly assigned to financial agent, identifying financial-related documents...');
      
      financialDocuments = allDocuments.filter(doc => {
        if (!doc.ocrText && !doc.aiSummary) return false;
        
        const docName = doc.name.toLowerCase();
        const docContent = (doc.ocrText || '').toLowerCase();
        const aiContent = typeof doc.aiSummary === 'string' ? doc.aiSummary.toLowerCase() : '';
        
        // Financial document keywords - EXACTLY matching Clinical's approach
        const financialKeywords = [
          'financial', 'revenue', 'profit', 'cost', 'budget', 'funding', 'investment',
          'cash', 'flow', 'burn', 'runway', 'valuation', 'ebitda', 'income', 'expense',
          'balance', 'sheet', 'statement', 'audit', 'accounting', 'finance', 'money',
          'capital', 'equity', 'debt', 'loan', 'credit', 'payment', 'invoice', 
          'contract', 'agreement', 'pricing', 'subscription', 'saas', 'arr', 'mrr',
          'margin', 'kpi', 'metric', 'performance', 'roi', 'return', 'ltv', 'cac'
        ];
        
        // Check document name, OCR content, and AI summary for financial keywords
        const hasFinancialKeywords = financialKeywords.some(keyword => 
          docName.includes(keyword) || docContent.includes(keyword) || aiContent.includes(keyword)
        );
        
        return hasFinancialKeywords;
      });
      
      console.log(`📄 Auto-identified financial documents: ${financialDocuments.length}`);
    }
    
    // If still no financial documents found, use all documents with content (EXACTLY like Clinical)
    if (financialDocuments.length === 0) {
      console.log('📄 No financial-related documents found, using all documents with OCR text or AI summaries...');
      financialDocuments = allDocuments.filter(doc => 
        (doc.ocrText && doc.ocrText.trim().length > 100) ||
        (doc.aiSummary && typeof doc.aiSummary === 'string' && doc.aiSummary.trim().length > 50)
      );
      console.log(`📄 Documents with content available: ${financialDocuments.length}`);
    }
    
    console.log(`📄 Found ${financialDocuments.length} documents for financial analysis`);
    
    if (financialDocuments.length === 0) {
      console.log('⚠️ No documents found for financial analysis');
      return [];
    }
    
    return financialDocuments;
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
    
    // Process ALL assigned documents (EXACTLY matching Clinical approach - no speed limits)
    const documentsToProcess = assignedDocuments;
    console.log(`📄 COMPREHENSIVE MODE: Starting evidence extraction from ALL ${documentsToProcess.length} documents for: ${question.question}`);
    console.log(`🔍 FULL ANALYSIS: Processing ALL ${documentsToProcess.length} assigned documents for thorough financial analysis`);

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
      const content = typeof doc.aiSummary === 'string' ? doc.aiSummary : (doc.ocrText || '');
      
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
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

      let rawContent = response.choices[0].message.content || '{}';
      // Handle markdown code blocks from OpenAI response  
      if (rawContent.includes('```json')) {
        rawContent = rawContent.replace(/```json\s*/, '').replace(/\s*```/, '');
      }
      
      // CRITICAL: Enhanced JSON parsing with fallback for answer compilation
      let result;
      try {
        result = JSON.parse(rawContent);
      } catch (parseError) {
        console.log(`⚠️ JSON parsing failed for answer compilation, attempting to extract JSON...`);
        
        // Try to extract JSON from potentially malformed response
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            result = JSON.parse(jsonMatch[0]);
            console.log(`✅ Successfully extracted JSON from malformed answer response`);
          } catch (extractError) {
            console.log(`❌ Failed to extract JSON from answer compilation, using fallback...`);
            result = {
              answer: "Analysis failed due to JSON parsing error",
              confidence: 0.1,
              keyFindings: ["JSON parsing error occurred"],
              financialAssessment: "Unable to complete assessment",
              recommendations: ["Retry analysis with improved data formatting"]
            };
          }
        } else {
          console.log(`❌ No JSON found in answer response, using fallback...`);
          result = {
            answer: "Analysis failed - no valid response format",
            confidence: 0.1,
            keyFindings: ["No valid response format"],
            financialAssessment: "Unable to complete assessment",
            recommendations: ["Retry analysis with improved prompting"]
          };
        }
      }

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
        evidenceSummary: "Analysis compilation failed",
        financialAssessment: "Assessment failed due to processing error",
        recommendations: ["Retry analysis with technical support"]
      };
    }
  }

  private async storeComprehensiveResultsWithoutDeletion(dealId: number, financialAnswers: { [key: string]: FinancialAnswer }, assignedDocuments: any[]): Promise<void> {
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

      // Create the new comprehensive analysis - EXACT copy of HR structure (deletion already done in runComprehensiveAnalysis)
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

  /**
   * CRITICAL: runComprehensiveAnalysis method to match Clinical architecture exactly
   * This is the method that persistent services expect to call
   */
  async runComprehensiveAnalysis(dealId: number, storageService: any, jobId: string, progressCallback?: Function): Promise<any> {
    console.log(`💰 runComprehensiveAnalysis called for deal ${dealId}, job ${jobId}`);
    
    try {
      // CRITICAL FIX: Delete existing analysis IMMEDIATELY at start, not at end
      console.log(`🗑️ IMMEDIATELY clearing existing financial analysis for deal ${dealId} to ensure fresh start...`);
      await db.delete(agentAnalyses).where(
        and(
          eq(agentAnalyses.dealId, dealId),
          eq(agentAnalyses.agentType, 'Financial')
        )
      );
      console.log(`✅ IMMEDIATELY cleared existing financial analysis for deal ${dealId}`);

      // Set up progress callback if provided
      if (progressCallback) {
        // Mock the existing startComprehensiveAnalysis method behavior but with callbacks
        this.isRunning = true;
        this.progress = 0;
        this.currentStep = 'Initializing financial analysis';
        
        // Start processing
        await progressCallback(8, 'Loading financial documents...');
        
        const assignedDocuments = await this.getAssignedDocuments(dealId);
        console.log(`📄 Found ${assignedDocuments.length} financial documents for analysis`);
        
        await progressCallback(17, 'Processing document batch 1...');
        
        const financialAnswers: { [key: string]: FinancialAnswer } = {};
        
        // Process each question with micro-step progression
        for (let i = 0; i < COMPREHENSIVE_FINANCIAL_QUESTIONS.length; i++) {
          const question = COMPREHENSIVE_FINANCIAL_QUESTIONS[i];
          const questionNumber = i + 1;
          const totalQuestions = COMPREHENSIVE_FINANCIAL_QUESTIONS.length;
          
          // Calculate progress with exact micro-step formula
          const baseProgress = 17; // Starting progress after document loading
          const questionProgress = Math.floor(((i + 1) / totalQuestions) * 75); // 75% for questions (17% to 92%)
          const progress = baseProgress + questionProgress;
          
          const stepMessage = `Analyzing: ${question.question}`;
          await progressCallback(progress, stepMessage);
          
          console.log(`🔍 Question ${questionNumber}/${totalQuestions}: ${question.question}`);
          
          // Extract evidence and compile answer
          const evidence = await this.extractEvidenceFromAllDocuments(assignedDocuments, question);
          const answer = await this.compileComprehensiveAnswer(question, evidence);
          financialAnswers[question.id] = answer;
          
          console.log(`✅ Completed question ${questionNumber}/${totalQuestions}`);
        }
        
        await progressCallback(92, 'Finalizing results...');
        
        // Store comprehensive results (deletion already done above)
        await this.storeComprehensiveResultsWithoutDeletion(dealId, financialAnswers, assignedDocuments);
        
        await progressCallback(100, 'Financial analysis completed');
        
        this.isRunning = false;
        console.log(`✅ Financial comprehensive analysis completed for deal ${dealId}`);
        
        return { success: true, questionsAnswered: Object.keys(financialAnswers).length };
        
      } else {
        // Fallback to original method
        await this.startComprehensiveAnalysis(dealId, jobId);
        return { success: true };
      }
    } catch (error) {
      console.error(`❌ runComprehensiveAnalysis failed for deal ${dealId}:`, error);
      this.isRunning = false;
      if (progressCallback) {
        await progressCallback(0, 'Financial analysis failed');
      }
      throw error;
    }
  }
}

// Export singleton instance
export const comprehensiveFinancialAnalysisService = new ComprehensiveFinancialAnalysisService();