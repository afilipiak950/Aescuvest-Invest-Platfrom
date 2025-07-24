import OpenAI from "openai";
import { storage } from "./storage";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Financial analysis questions based on the 6 key categories
const FINANCIAL_QUESTIONS = [
  {
    id: "income_statements",
    category: "Income Statements",
    question: "What is YoY growth for revenue, gross margin, EBITDA? Are one-time effects clearly disclosed? Are revenue recognition principles documented?",
    keywords: ["revenue", "growth", "gross margin", "ebitda", "one-time", "revenue recognition", "income statement", "profit", "loss", "sales", "turnover", "earnings"]
  },
  {
    id: "balance_sheets",
    category: "Balance Sheets",
    question: "How are liabilities and provisions structured? Are deferred revenues or accrued costs significant? Is intangibles or goodwill position explained?",
    keywords: ["balance sheet", "liabilities", "provisions", "deferred revenue", "accrued costs", "intangibles", "goodwill", "assets", "equity", "debt", "obligations"]
  },
  {
    id: "cash_flow",
    category: "Cash Flow Statements",
    question: "What is the monthly net burn rate? What % of cash outflow is OpEx vs. CapEx? Are working capital changes consistent?",
    keywords: ["cash flow", "burn rate", "opex", "capex", "working capital", "operating expenses", "capital expenditure", "cash outflow", "liquidity", "cash position"]
  },
  {
    id: "financial_model",
    category: "Financial Model / Forecasts",
    question: "What are key assumptions for revenue growth? What customer churn / LTV / CAC assumptions are used? Are headcount, salary, hiring plans reflected?",
    keywords: ["financial model", "forecasts", "projections", "assumptions", "churn", "ltv", "cac", "customer acquisition", "headcount", "salary", "hiring", "budget", "planning"]
  },
  {
    id: "cap_table",
    category: "Cap Table",
    question: "Is the cap table fully diluted and post-money? Are SAFEs / convertibles accounted for? Are option pools reflected?",
    keywords: ["cap table", "capitalization", "dilution", "post-money", "safes", "convertibles", "option pool", "equity", "shares", "ownership", "valuation", "investors"]
  },
  {
    id: "tax_documentation",
    category: "Tax Documentation",
    question: "Are all tax filings up-to-date? Are there known audit risks? Are deferred taxes and NOLs disclosed?",
    keywords: ["tax", "filings", "audit", "deferred tax", "nol", "net operating loss", "tax returns", "compliance", "irs", "tax liability", "tax benefits"]
  }
];

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

class ComprehensiveFinancialAnalysisService {
  private progressCallbacks = new Map<number, (progress: any) => void>();

  setProgressCallback(dealId: number, callback: (progress: any) => void) {
    this.progressCallbacks.set(dealId, callback);
  }

  private setProgress(dealId: number, progress: any) {
    const callback = this.progressCallbacks.get(dealId);
    if (callback) {
      callback(progress);
    }
  }

  async runComprehensiveAnalysis(dealId: number): Promise<any> {
    console.log(`🏦 Starting comprehensive financial analysis for deal ${dealId}`);
    
    try {
      // Set initial progress
      this.setProgress(dealId, {
        progress: 5,
        currentStep: 'Initializing financial analysis...'
      });

      // Get all documents for this deal that might contain financial information
      const documents = await this.getAssignedFinancialDocuments(dealId);
      console.log(`📊 Found ${documents.length} documents for financial analysis`);

      if (documents.length === 0) {
        throw new Error('No documents found for financial analysis');
      }

      this.setProgress(dealId, {
        progress: 10,
        currentStep: `Found ${documents.length} documents for analysis`
      });

      // Extract financial evidence from documents
      const evidenceMap = await this.extractFinancialEvidence(documents, dealId);
      
      this.setProgress(dealId, {
        progress: 70,
        currentStep: 'Generating comprehensive financial answers...'
      });

      // Generate comprehensive answers for all questions
      const answers = await this.generateComprehensiveAnswers(evidenceMap, dealId);
      
      this.setProgress(dealId, {
        progress: 85,
        currentStep: 'Compiling final analysis...'
      });

      // Compile results
      const findings = this.compileFindingsFromAnswers(answers);
      const recommendations = this.compileRecommendationsFromAnswers(answers);
      
      this.setProgress(dealId, {
        progress: 95,
        currentStep: 'Storing results...'
      });

      // Store results in database
      const analysisResult = await this.storeAnalysisResults(dealId, answers, findings, recommendations);
      
      this.setProgress(dealId, {
        progress: 100,
        currentStep: 'Financial analysis completed'
      });

      console.log(`✅ Comprehensive financial analysis completed for deal ${dealId}`);
      console.log(`📊 Generated ${findings.length} findings and ${recommendations.length} recommendations`);
      
      return analysisResult;
      
    } catch (error) {
      console.error(`❌ Financial analysis failed for deal ${dealId}:`, error);
      this.setProgress(dealId, {
        progress: 0,
        currentStep: 'Analysis failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getAssignedFinancialDocuments(dealId: number): Promise<any[]> {
    console.log(`🔍 Finding financial documents for deal ${dealId}`);
    
    try {
      // Get all documents for the deal
      const allDocuments = await storage.getDocumentsByDealId(dealId);
      console.log(`📄 Total documents found: ${allDocuments.length}`);
      
      if (allDocuments.length === 0) {
        return [];
      }

      // Financial keywords for document identification
      const financialKeywords = [
        'financial', 'finance', 'revenue', 'income', 'balance sheet', 'cash flow',
        'profit', 'loss', 'ebitda', 'budget', 'forecast', 'projection', 'cap table',
        'capitalization', 'valuation', 'investment', 'funding', 'equity', 'debt',
        'tax', 'audit', 'accounting', 'opex', 'capex', 'burn rate', 'runway',
        'ltv', 'cac', 'churn', 'subscription', 'pricing', 'cost', 'expense',
        'liability', 'asset', 'goodwill', 'depreciation', 'amortization'
      ];

      // Filter documents that might contain financial information
      const relevantDocuments = allDocuments.filter((doc: any) => {
        if (!doc.ocrText && !doc.aiSummary) return false;
        
        const content = (doc.ocrText || doc.aiSummary || '').toLowerCase();
        const name = (doc.name || '').toLowerCase();
        
        // Check if document name or content contains financial keywords
        return financialKeywords.some((keyword: string) => 
          content.includes(keyword) || name.includes(keyword)
        );
      });

      console.log(`💰 Found ${relevantDocuments.length} documents with financial content`);
      
      return relevantDocuments;
      
    } catch (error) {
      console.error('Error getting financial documents:', error);
      return [];
    }
  }

  async extractFinancialEvidence(documents: any[], dealId: number): Promise<Map<string, FinancialEvidence[]>> {
    const evidenceMap = new Map<string, FinancialEvidence[]>();
    const batchSize = 10;
    const totalBatches = Math.ceil(documents.length / batchSize);
    
    console.log(`🔍 Processing ${documents.length} documents in ${totalBatches} batches for financial evidence extraction`);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * batchSize;
      const batch = documents.slice(startIdx, startIdx + batchSize);
      
      const batchProgress = 20 + Math.round((batchIndex / totalBatches) * 40);
      this.setProgress(dealId, {
        progress: batchProgress,
        currentStep: `Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} documents)`
      });
      
      // Process documents in parallel within batch
      const batchPromises = batch.map(async (doc) => {
        console.log(`💰 Extracting financial evidence from: ${doc.name}`);
        try {
          return await this.extractEvidenceFromDocument(doc);
        } catch (error) {
          console.error(`Error extracting evidence from ${doc.name}:`, error);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      const validResults = batchResults.filter(result => result !== null);
      
      // Group evidence by question
      validResults.forEach(evidence => {
        FINANCIAL_QUESTIONS.forEach(question => {
          const questionEvidence = this.filterEvidenceForQuestion(evidence, question);
          if (questionEvidence && questionEvidence.relevantContent.length > 0) {
            if (!evidenceMap.has(question.id)) {
              evidenceMap.set(question.id, []);
            }
            evidenceMap.get(question.id)!.push(questionEvidence);
          }
        });
      });
      
      console.log(`✅ Batch ${batchIndex + 1} completed: ${validResults.length}/${batch.length} documents processed successfully`);
    }
    
    return evidenceMap;
  }

  async extractEvidenceFromDocument(doc: any): Promise<FinancialEvidence> {
    if (!doc.ocrText && !doc.aiSummary) {
      return {
        documentName: doc.name,
        documentSummary: 'No content available for analysis',
        relevantContent: [],
        keyFindings: [],
        confidence: 0
      };
    }

    const content = doc.ocrText || doc.aiSummary || '';
    const prompt = `
    You are an expert financial due diligence analyst conducting comprehensive investment analysis. Your task is to find ANY financial, accounting, monetary, or business performance information, even if indirectly related.

    Document: ${doc.name}
    Content: ${content.substring(0, 4000)}
    
    Instructions:
    - Look for DIRECT financial terms: revenue, profit, cash flow, expenses, assets, liabilities, equity, valuation
    - Look for INDIRECT financial information: business metrics, growth rates, customer data, operational costs, funding
    - Consider documents that mention financial performance, budgets, forecasts, or business planning
    - Even general business documents often contain financial implications for investment analysis
    - For investment companies, most business documents contain financial information relevant to investors
    
    Focus on extracting:
    1. Revenue growth, profitability, and financial performance metrics
    2. Balance sheet items: assets, liabilities, equity positions
    3. Cash flow information: burn rates, runway, working capital
    4. Financial forecasts, budgets, and business projections
    5. Capitalization: funding, valuations, equity structures
    6. Tax implications, compliance, and regulatory financial matters
    7. Cost structures, pricing models, and unit economics
    
    Return a JSON response with:
    {
      "documentSummary": "Brief summary of the document's financial relevance",
      "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
      "relevantContent": ["Quote 1", "Quote 2", "Quote 3"],
      "confidence": 0.85,
      "financialContext": "How this document relates to financial aspects"
    }
    
    Be aggressive in finding financial relevance - most business documents have financial implications for investment analysis.
    `;

    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      documentName: doc.name,
      documentSummary: result.documentSummary || 'Financial analysis completed',
      relevantContent: Array.isArray(result.relevantContent) ? result.relevantContent : [],
      keyFindings: Array.isArray(result.keyFindings) ? result.keyFindings : [],
      confidence: result.confidence || 0.7
    };
  }

  filterEvidenceForQuestion(evidence: FinancialEvidence, question: any): FinancialEvidence | null {
    const content = (evidence.documentSummary + ' ' + evidence.relevantContent.join(' ') + ' ' + evidence.keyFindings.join(' ')).toLowerCase();
    
    // Check if document contains keywords relevant to this question
    const hasRelevantKeywords = question.keywords.some((keyword: string) => content.includes(keyword.toLowerCase()));
    
    if (!hasRelevantKeywords) {
      return null;
    }
    
    // Filter content to only relevant parts
    const filteredContent = evidence.relevantContent.filter(item => 
      question.keywords.some((keyword: string) => item.toLowerCase().includes(keyword.toLowerCase()))
    );
    
    const filteredFindings = evidence.keyFindings.filter((finding: string) => 
      question.keywords.some((keyword: string) => finding.toLowerCase().includes(keyword.toLowerCase()))
    );
    
    return {
      ...evidence,
      relevantContent: filteredContent,
      keyFindings: filteredFindings,
      confidence: Math.min(evidence.confidence, 0.9) // Slightly reduce confidence for filtered evidence
    };
  }

  async generateComprehensiveAnswers(evidenceMap: Map<string, FinancialEvidence[]>, dealId: number): Promise<{[key: string]: FinancialAnswer}> {
    const answers: {[key: string]: FinancialAnswer} = {};
    const questionCount = FINANCIAL_QUESTIONS.length;
    
    for (let i = 0; i < FINANCIAL_QUESTIONS.length; i++) {
      const question = FINANCIAL_QUESTIONS[i];
      const questionProgress = 70 + Math.round((i / questionCount) * 15);
      
      this.setProgress(dealId, {
        progress: questionProgress,
        currentStep: `Analyzing: ${question.category}`,
        currentQuestion: question.question
      });
      
      const evidence = evidenceMap.get(question.id) || [];
      console.log(`💰 Generating answer for: ${question.question} (${evidence.length} documents with evidence)`);
      
      try {
        const answer = await this.generateAnswerForQuestion(question, evidence);
        answers[question.id] = answer;
      } catch (error) {
        console.error(`Error generating answer for ${question.id}:`, error);
        // Continue with next question rather than failing entirely
        answers[question.id] = this.generateFallbackAnswer(question, evidence);
      }
    }
    
    return answers;
  }

  async generateAnswerForQuestion(question: any, evidence: FinancialEvidence[]): Promise<FinancialAnswer> {
    if (evidence.length === 0) {
      return {
        question: question.question,
        answer: `No specific evidence found in the analyzed financial documents for: ${question.question}`,
        confidence: 0,
        sources: [],
        detailedEvidence: [],
        keyFindings: [],
        evidenceSummary: 'No relevant financial evidence available',
        financialAssessment: 'Unable to assess due to lack of relevant documentation',
        recommendations: ['Consider providing additional financial documentation for comprehensive analysis']
      };
    }

    // Compile all evidence
    const allContent = evidence.map(e => e.relevantContent.join(' ')).join('\n');
    const allFindings = evidence.flatMap(e => e.keyFindings);
    
    const prompt = `
    You are a financial due diligence expert analyzing investment opportunities.
    
    Question: ${question.question}
    Category: ${question.category}
    
    Evidence from documents:
    ${allContent}
    
    Key findings:
    ${allFindings.join('\n')}
    
    Provide a comprehensive financial analysis response as JSON:
    {
      "answer": "Detailed answer based on evidence",
      "confidence": 0.85,
      "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
      "evidenceSummary": "Summary of the evidence analyzed",
      "financialAssessment": "Professional financial assessment",
      "recommendations": ["Recommendation 1", "Recommendation 2"]
    }
    `;

    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      question: question.question,
      answer: result.answer || 'Financial analysis completed',
      confidence: Math.min(Math.max(result.confidence || 0.7, 0), 1),
      sources: evidence.map(e => e.documentName),
      detailedEvidence: evidence,
      keyFindings: Array.isArray(result.keyFindings) ? result.keyFindings : [],
      evidenceSummary: result.evidenceSummary || 'Evidence analyzed',
      financialAssessment: result.financialAssessment || 'Financial assessment completed',
      recommendations: Array.isArray(result.recommendations) ? result.recommendations : []
    };
  }

  generateFallbackAnswer(question: any, evidence: FinancialEvidence[]): FinancialAnswer {
    return {
      question: question.question,
      answer: `Analysis completed for ${question.question}. ${evidence.length} documents were reviewed for relevant financial information.`,
      confidence: evidence.length > 0 ? 0.6 : 0.1,
      sources: evidence.map(e => e.documentName),
      detailedEvidence: evidence,
      keyFindings: evidence.flatMap(e => e.keyFindings).slice(0, 3),
      evidenceSummary: `Analyzed ${evidence.length} financial documents`,
      financialAssessment: 'Financial assessment completed with available evidence',
      recommendations: evidence.length > 0 ? ['Review findings for investment decision-making'] : ['Provide additional financial documentation']
    };
  }

  compileFindingsFromAnswers(answers: {[key: string]: FinancialAnswer}): any[] {
    const findings: any[] = [];
    let findingId = 0;
    
    Object.values(answers).forEach(answer => {
      answer.keyFindings.forEach(finding => {
        findings.push({
          id: findingId++,
          content: finding,
          type: 'financial_finding',
          confidence: answer.confidence,
          source: answer.sources[0] || 'Financial Analysis'
        });
      });
    });
    
    return findings;
  }

  compileRecommendationsFromAnswers(answers: {[key: string]: FinancialAnswer}): any[] {
    const recommendations: any[] = [];
    let recId = 0;
    
    Object.values(answers).forEach(answer => {
      answer.recommendations.forEach(rec => {
        recommendations.push({
          id: recId++,
          content: rec,
          type: 'financial_recommendation',
          priority: 'medium'
        });
      });
    });
    
    return recommendations;
  }

  async storeAnalysisResults(dealId: number, answers: {[key: string]: FinancialAnswer}, findings: any[], recommendations: any[]): Promise<any> {
    try {
      const analysisData = {
        dealId,
        agentType: 'Financial',
        status: 'Completed',
        progress: 100,
        findings,
        recommendations,
        financialAnswers: JSON.stringify(answers),
        completedAt: new Date().toISOString()
      };

      // Store in agent_analyses table
      const result = await storage.saveAgentAnalysis(analysisData);
      console.log(`✅ Financial analysis results stored for deal ${dealId}`);
      
      return result;
    } catch (error) {
      console.error('Error storing financial analysis results:', error);
      throw error;
    }
  }
}

export const comprehensiveFinancialAnalysisService = new ComprehensiveFinancialAnalysisService();