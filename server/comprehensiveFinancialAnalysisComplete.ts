/**
 * Comprehensive Financial Analysis Service
 * Analyzes ALL assigned financial documents systematically for each question
 * Extracts specific evidence from documents and compiles complete answers
 */

import { db } from './db';
import { documents, agentAnalyses } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { storage } from './storage';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Enhanced financial questions for comprehensive analysis - covering all 6 key categories
export const COMPREHENSIVE_FINANCIAL_QUESTIONS = [
  {
    id: "income_statements",
    category: "Income Statements",
    question: "What is YoY growth for revenue, gross margin, EBITDA? Are one-time effects clearly disclosed? Are revenue recognition principles documented?",
    analysisPrompt: "Analyze income statement metrics including year-over-year growth rates, margin analysis, one-time items disclosure, and revenue recognition practices.",
    keywords: ["revenue", "growth", "gross margin", "ebitda", "one-time", "revenue recognition", "income statement", "profit", "loss", "sales", "turnover", "earnings"]
  },
  {
    id: "balance_sheets",
    category: "Balance Sheets",
    question: "How are liabilities and provisions structured? Are deferred revenues or accrued costs significant? Is intangibles or goodwill position explained?",
    analysisPrompt: "Review balance sheet structure, liability composition, deferred revenue accounting, accrued expenses, and intangible asset valuations.",
    keywords: ["balance sheet", "liabilities", "provisions", "deferred revenue", "accrued costs", "intangibles", "goodwill", "assets", "equity", "debt", "obligations"]
  },
  {
    id: "cash_flow",
    category: "Cash Flow Statements",
    question: "What is the monthly net burn rate? What % of cash outflow is OpEx vs. CapEx? Are working capital changes consistent?",
    analysisPrompt: "Analyze cash flow patterns, burn rate calculations, operational vs. capital expenditure breakdown, and working capital dynamics.",
    keywords: ["cash flow", "burn rate", "opex", "capex", "working capital", "operating expenses", "capital expenditure", "cash outflow", "liquidity", "cash position"]
  },
  {
    id: "financial_model",
    category: "Financial Model / Forecasts",
    question: "What are key assumptions for revenue growth? What customer churn / LTV / CAC assumptions are used? Are headcount, salary, hiring plans reflected?",
    analysisPrompt: "Evaluate financial model assumptions, revenue projections, customer metrics (LTV/CAC), churn rates, and human capital planning.",
    keywords: ["financial model", "forecasts", "projections", "assumptions", "churn", "ltv", "cac", "customer acquisition", "headcount", "salary", "hiring", "budget", "planning"]
  },
  {
    id: "cap_table",
    category: "Cap Table",
    question: "Is the cap table fully diluted and post-money? Are SAFEs / convertibles accounted for? Are option pools reflected?",
    analysisPrompt: "Review capitalization table structure, dilution calculations, convertible securities treatment, and equity compensation pools.",
    keywords: ["cap table", "capitalization", "dilution", "post-money", "safes", "convertibles", "option pool", "equity", "shares", "ownership", "valuation", "investors"]
  },
  {
    id: "tax_documentation",
    category: "Tax Documentation",
    question: "Are all tax filings up-to-date? Are there known audit risks? Are deferred taxes and NOLs disclosed?",
    analysisPrompt: "Assess tax compliance status, audit risks, deferred tax positions, net operating losses, and tax optimization strategies.",
    keywords: ["tax", "filings", "audit", "deferred tax", "nol", "net operating loss", "tax returns", "compliance", "irs", "tax liability", "tax benefits"]
  },
  {
    id: "unit_economics",
    category: "Unit Economics",
    question: "Are unit economics clearly defined and profitable? What is the payback period for customer acquisition?",
    analysisPrompt: "Analyze unit economics, customer acquisition costs, lifetime value calculations, contribution margins, and payback periods.",
    keywords: ["unit economics", "customer acquisition cost", "lifetime value", "contribution margin", "payback period", "unit profitability"]
  },
  {
    id: "kpis_metrics",
    category: "KPIs & Metrics",
    question: "What are the key business metrics tracked? Are SaaS metrics (ARR, MRR, NRR) properly calculated?",
    analysisPrompt: "Review key performance indicators, SaaS metrics calculations, recurring revenue tracking, and business performance measurement.",
    keywords: ["kpi", "metrics", "arr", "mrr", "nrr", "saas metrics", "recurring revenue", "performance indicators"]
  }
];

export class ComprehensiveFinancialAnalysisService {
  
  /**
   * Run comprehensive analysis for all assigned financial documents
   */
  async runComprehensiveAnalysis(dealId: number, storageService: any, jobId: string): Promise<any> {
    console.log(`💰 Starting comprehensive financial analysis for deal ${dealId}`);
    
    try {
      // Get all financial documents
      const assignedDocuments = await this.getAssignedFinancialDocuments(dealId);
      console.log(`📄 Found ${assignedDocuments.length} financial documents for analysis`);
      
      if (assignedDocuments.length === 0) {
        console.log('⚠️ No financial documents found for analysis');
        await storageService.updateBackgroundJob(jobId, {
          status: 'completed',
          progress: 100,
          currentStep: 'No financial documents available for analysis'
        });
        return { success: false, message: 'No financial documents found' };
      }
      
      // Initialize progress
      await storageService.updateBackgroundJob(jobId, {
        progress: 5,
        currentStep: 'Starting financial analysis',
        processedDocuments: 0,
        totalDocuments: COMPREHENSIVE_FINANCIAL_QUESTIONS.length
      });
      
      // Process each question systematically
      const financialAnswers: Record<string, any> = {};
      
      for (let i = 0; i < COMPREHENSIVE_FINANCIAL_QUESTIONS.length; i++) {
        const question = COMPREHENSIVE_FINANCIAL_QUESTIONS[i];
        console.log(`🔍 Processing financial question ${i + 1}/${COMPREHENSIVE_FINANCIAL_QUESTIONS.length}: ${question.question}`);
        
        // Update progress based on completed questions (i) not current question (i+1)
        const progress = Math.round((i / COMPREHENSIVE_FINANCIAL_QUESTIONS.length) * 90) + 5;
        await storageService.updateBackgroundJob(jobId, {
          progress,
          currentDocumentName: question.question,
          currentStep: `Analyzing: ${question.category}`,
          processedDocuments: i
        });
        
        try {
          console.log(`📊 Extracting financial evidence for: ${question.question}`);
          
          // Extract evidence from ALL documents for this question
          const documentEvidence = await this.extractEvidenceFromAllDocuments(
            assignedDocuments, 
            question
          );
          console.log(`📊 Evidence extraction completed for question: ${question.question}`);
          
          // Compile comprehensive answer based on all evidence
          const answer = await this.compileComprehensiveAnswer(question, documentEvidence);
          financialAnswers[question.id] = answer;
          
          console.log(`✅ Completed question ${i + 1}/${COMPREHENSIVE_FINANCIAL_QUESTIONS.length}: ${question.question}`);
          
          // Brief delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (questionError) {
          console.error(`❌ Error processing question "${question.question}":`, questionError);
          
          // Store partial answer for this question
          financialAnswers[question.id] = {
            question: question.question,
            category: question.category,
            answer: `Error processing this question: ${questionError.message}`,
            confidence: 0,
            sources: [],
            evidence: [],
            error: true
          };
          continue;
        }
      }
      
      // Update progress to completion
      await storageService.updateBackgroundJob(jobId, {
        progress: 100,
        processedDocuments: COMPREHENSIVE_FINANCIAL_QUESTIONS.length,
        currentStep: 'Generating findings and recommendations',
        status: 'completing'
      });
      
      // Generate comprehensive findings and recommendations
      const findings = this.generateComprehensiveFindings(financialAnswers);
      const recommendations = this.generateComprehensiveRecommendations(financialAnswers);
      
      // Store the analysis results
      await this.storeComprehensiveResults(dealId, financialAnswers, findings, recommendations, assignedDocuments);
      
      // Mark job as completed
      await storageService.updateBackgroundJob(jobId, {
        status: 'completed',
        currentStep: 'Analysis completed'
      });
      
      console.log(`✅ Comprehensive financial analysis completed for deal ${dealId}`);
      
      return {
        success: true,
        documentsAnalyzed: assignedDocuments.length,
        questionsAnswered: Object.keys(financialAnswers).length,
        findings: findings.length,
        recommendations: recommendations.length
      };
      
    } catch (error) {
      console.error(`❌ Critical error in financial analysis for deal ${dealId}:`, error);
      
      await storageService.updateBackgroundJob(jobId, {
        status: 'failed',
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Get all documents suitable for financial analysis
   */
  private async getAssignedFinancialDocuments(dealId: number): Promise<any[]> {
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
    
    // If no documents are explicitly assigned, identify financial-related documents
    if (financialDocuments.length === 0) {
      console.log('📄 No documents explicitly assigned to financial agent, identifying financial-related documents...');
      
      financialDocuments = allDocuments.filter(doc => {
        if (!doc.ocrText && !doc.aiSummary) return false;
        
        const docName = doc.name.toLowerCase();
        const docContent = (doc.ocrText || '').toLowerCase();
        const aiSummary = doc.aiSummary;
        
        // Financial document keywords
        const financialKeywords = [
          'financial', 'revenue', 'income', 'profit', 'loss', 'balance', 'cash',
          'statement', 'budget', 'forecast', 'projection', 'p&l', 'pl',
          'capex', 'opex', 'ebitda', 'margin', 'kpi', 'metric', 'arr', 'mrr',
          'burn', 'runway', 'valuation', 'cap table', 'equity', 'investment',
          'funding', 'tax', 'audit', 'accounting', 'gaap', 'ifrs', 'model'
        ];
        
        // Check document name and content for financial keywords
        const hasFinancialKeywords = financialKeywords.some(keyword => 
          docName.includes(keyword) || docContent.includes(keyword)
        );
        
        // Check AI summary for financial document type
        const isFinancialDocument = aiSummary?.documentType?.toLowerCase().includes('financial') ||
                                  aiSummary?.executiveSummary?.toLowerCase().includes('financial') ||
                                  aiSummary?.executiveSummary?.toLowerCase().includes('revenue') ||
                                  aiSummary?.executiveSummary?.toLowerCase().includes('budget');
        
        return hasFinancialKeywords || isFinancialDocument;
      });
      
      console.log(`📄 Auto-identified financial documents: ${financialDocuments.length}`);
    }
    
    // If still no financial documents, take documents with meaningful content for analysis
    if (financialDocuments.length === 0) {
      console.log('📄 No financial-related documents found, using all documents with OCR text...');
      financialDocuments = allDocuments.filter(doc => 
        (doc.ocrText && doc.ocrText.length > 100) || doc.aiSummary
      );
      console.log(`📄 Documents with content available: ${financialDocuments.length}`);
    }
    
    return financialDocuments;
  }
  
  /**
   * Extract evidence from ALL documents for a specific question
   */
  private async extractEvidenceFromAllDocuments(
    documents: any[], 
    question: any
  ): Promise<any[]> {
    console.log(`📄 Starting evidence extraction from ${documents.length} documents for: ${question.question}`);
    
    const batchSize = 10;
    const evidence = [];
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)} (${batch.length} documents)`);
      
      const batchResults = await Promise.all(
        batch.map(async (doc) => {
          console.log(`🔎 Extracting evidence from: ${doc.name}`);
          return this.extractEvidenceFromDocument(doc, question);
        })
      );
      
      const validEvidence = batchResults.filter(docEvidence => 
        docEvidence && docEvidence.relevantContent.length > 0
      );
      evidence.push(...validEvidence);
      
      console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} completed: ${validEvidence.length}/${batch.length} documents had relevant evidence`);
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
    
    const prompt = `You are an expert financial analyst conducting comprehensive investment analysis. Your task is to find ANY financial, accounting, or business metrics information, even if indirectly related.

DOCUMENT: ${document.name}
CONTENT: ${content.substring(0, 4000)}

QUESTION: "${question.question}"
ANALYSIS TASK: ${question.analysisPrompt}

Instructions:
- Look for DIRECT financial terms, numbers, revenue data, financial statements, metrics
- Look for INDIRECT references to business performance, growth metrics, profitability indicators
- Consider business documents that mention financial milestones, budgets, forecasts, valuations
- Even general business context often has financial implications for investment due diligence
- For startups and growing companies, most business documents contain financial information relevant to investors

Respond in JSON format:
{
  "relevantContent": ["Exact quote 1 from document", "Exact quote 2 from document"],
  "hasRelevantInfo": true/false,
  "confidence": 0-100,
  "keyFindings": ["Finding 1", "Finding 2"],
  "documentSummary": "Brief summary of what this document contains relevant to the question",
  "financialContext": "How this document relates to financial/business performance aspects"
}

Be thorough in finding relevance - most business documents have financial implications for investment analysis.`;

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
        fullContent: content.substring(0, 1000)
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
   * Compile comprehensive answer based on all evidence
   */
  private async compileComprehensiveAnswer(question: any, evidence: any[]): Promise<any> {
    console.log(`🔍 Compiling answer for: ${question.question}`);
    console.log(`📋 Evidence count: ${evidence.length}`);
    
    if (evidence.length === 0) {
      console.log(`⚠️ No evidence found for question: ${question.question}`);
      return {
        question: question.question,
        answer: `No relevant financial information found in the assigned financial documents for this question.`,
        confidence: 10,
        sources: [],
        evidenceCount: 0,
        keyFindings: [],
        gaps: ['No relevant financial information found'],
        category: question.category
      };
    }

    const evidenceSummary = evidence.map(ev => ({
      document: ev.documentName,
      content: ev.relevantContent.join(' '),
      findings: ev.keyFindings.join(' '),
      confidence: ev.confidence
    }));

    const prompt = `You are an expert financial analyst compiling a comprehensive answer based on evidence from multiple documents.

QUESTION: "${question.question}"
CATEGORY: ${question.category}
ANALYSIS TASK: ${question.analysisPrompt}

EVIDENCE FROM DOCUMENTS:
${evidenceSummary.map(ev => `
DOCUMENT: ${ev.document}
CONTENT: ${ev.content}
KEY FINDINGS: ${ev.findings}
CONFIDENCE: ${ev.confidence}%
`).join('\n')}

Instructions:
1. Synthesize ALL evidence into a comprehensive answer
2. Cite specific documents and quotes
3. Identify gaps in information
4. Provide confidence assessment
5. Include financial recommendations

Respond in JSON format:
{
  "answer": "Comprehensive answer synthesizing all evidence",
  "confidence": 0-100,
  "sources": ["Document name 1", "Document name 2"],
  "keyFindings": ["Finding 1", "Finding 2"],
  "gaps": ["Missing information 1", "Missing information 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "financialAssessment": "Overall financial assessment based on evidence",
  "evidenceCount": ${evidence.length}
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 2000
      });
      
      const compiledAnswer = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        question: question.question,
        category: question.category,
        answer: compiledAnswer.answer || 'Unable to compile answer from available evidence',
        confidence: compiledAnswer.confidence || 30,
        sources: compiledAnswer.sources || evidence.map(e => e.documentName),
        keyFindings: compiledAnswer.keyFindings || [],
        gaps: compiledAnswer.gaps || [],
        recommendations: compiledAnswer.recommendations || [],
        financialAssessment: compiledAnswer.financialAssessment || '',
        evidenceCount: evidence.length,
        detailedEvidence: evidence
      };
      
    } catch (error) {
      console.error(`Error compiling answer for "${question.question}":`, error);
      return {
        question: question.question,
        category: question.category,
        answer: `Error compiling answer: ${error.message}`,
        confidence: 0,
        sources: evidence.map(e => e.documentName),
        keyFindings: [],
        gaps: ['Analysis compilation failed'],
        recommendations: ['Manual review required'],
        evidenceCount: evidence.length,
        detailedEvidence: evidence
      };
    }
  }

  /**
   * Generate comprehensive findings
   */
  private generateComprehensiveFindings(answers: Record<string, any>): any[] {
    const findings = [];
    
    for (const [questionId, answer] of Object.entries(answers)) {
      const question = COMPREHENSIVE_FINANCIAL_QUESTIONS.find(q => q.id === questionId);
      if (!question) continue;
      
      // High confidence findings
      if (answer.confidence > 70) {
        findings.push({
          id: findings.length + 1,
          type: 'positive',
          content: `${question.question}: ${answer.answer.substring(0, 150)}...`,
          source: answer.sources.length > 0 ? answer.sources[0] : 'Financial Documents',
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
          content: `Insufficient financial information for: ${question.question}. Additional documentation may be required.`,
          source: 'Financial Analysis',
          confidence: 0.3,
          category: 'gaps',
          evidenceCount: answer.evidenceCount || 0
        });
      }
    }
    
    return findings;
  }
  
  /**
   * Generate comprehensive recommendations
   */
  private generateComprehensiveRecommendations(answers: Record<string, any>): any[] {
    const recommendations = [];
    
    for (const [questionId, answer] of Object.entries(answers)) {
      if (answer.recommendations && answer.recommendations.length > 0) {
        for (const rec of answer.recommendations) {
          recommendations.push({
            title: `Financial Due Diligence: ${answer.question}`,
            description: rec,
            priority: answer.confidence < 60 ? 'high' : 'medium',
            category: 'financial',
            impact: answer.confidence < 40 ? 'critical' : 'moderate'
          });
        }
      }
      
      if (answer.gaps && answer.gaps.length > 0) {
        recommendations.push({
          title: `Documentation Gap: ${answer.question}`,
          description: `Missing financial information identified: ${answer.gaps.join(', ')}. Request additional documentation.`,
          priority: 'high',
          category: 'financial',
          impact: 'critical'
        });
      }
    }
    
    return recommendations;
  }
  
  /**
   * Store comprehensive analysis results
   */
  private async storeComprehensiveResults(
    dealId: number, 
    financialAnswers: Record<string, any>, 
    findings: any[], 
    recommendations: any[],
    documentsAnalyzed: any[]
  ): Promise<void> {
    // First, delete any existing financial analysis to ensure clean replacement
    await db
      .delete(agentAnalyses)
      .where(and(
        eq(agentAnalyses.dealId, dealId),
        eq(agentAnalyses.agentType, 'financial')
      ));
    
    console.log(`🗑️ Cleared existing financial analysis for deal ${dealId}`);
    
    // Create the new comprehensive analysis
    const analysisData = {
      dealId,
      agentType: 'financial' as const,
      status: 'completed' as const,
      progress: 100,
      findings: JSON.stringify(findings),
      recommendations: JSON.stringify(recommendations),
      financial_answers: JSON.stringify(financialAnswers),
      documentSources: JSON.stringify(documentsAnalyzed.map(d => d.name)),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db
      .insert(agentAnalyses)
      .values(analysisData);
    
    console.log(`📊 Created fresh comprehensive financial analysis for deal ${dealId} with ${Object.keys(financialAnswers).length} questions answered`);
  }
}

// Export the service instance
export const comprehensiveFinancialAnalysisService = new ComprehensiveFinancialAnalysisService();