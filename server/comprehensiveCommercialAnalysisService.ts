import { storage } from './storage';
import { db } from './db';
import { documents } from '@shared/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const COMMERCIAL_QUESTIONS = [
  // Competitive Analysis Decks
  { 
    id: 'competitive_1', 
    question: 'Is the differentiation clearly articulated?', 
    category: 'Competitive Analysis Decks',
    keywords: ['competitive', 'differentiation', 'competitive advantage', 'unique value', 'positioning', 'competitor', 'comparison', 'market position', 'value prop', 'usp']
  },
  { 
    id: 'competitive_2', 
    question: 'Are comparison matrices based on price/features?', 
    category: 'Competitive Analysis Decks',
    keywords: ['comparison matrix', 'price comparison', 'feature comparison', 'competitive matrix', 'pricing table', 'feature set', 'competitive analysis', 'benchmark']
  },
  { 
    id: 'competitive_3', 
    question: 'Is switching cost vs. competitors assessed?', 
    category: 'Competitive Analysis Decks',
    keywords: ['switching cost', 'migration cost', 'switching barrier', 'customer retention', 'lock-in', 'stickiness', 'churn prevention', 'switching friction']
  },
  // Pricing Models
  { 
    id: 'pricing_1', 
    question: 'What pricing logic is used (usage-based, tiered, per-seat)?', 
    category: 'Pricing Models',
    keywords: ['pricing model', 'usage-based', 'tiered pricing', 'per-seat', 'subscription', 'freemium', 'pricing strategy', 'pricing tier', 'billing model']
  },
  { 
    id: 'pricing_2', 
    question: 'Are discount policies documented?', 
    category: 'Pricing Models',
    keywords: ['discount policy', 'pricing discount', 'volume discount', 'enterprise discount', 'promotional pricing', 'pricing flexibility', 'discount structure']
  },
  { 
    id: 'pricing_3', 
    question: 'Is net revenue retention tracked?', 
    category: 'Pricing Models',
    keywords: ['net revenue retention', 'nrr', 'revenue retention', 'expansion revenue', 'upsell', 'cross-sell', 'customer growth', 'retention rate']
  },
  // Sales Pipeline & CRM Data
  { 
    id: 'sales_1', 
    question: 'What are win/loss rates?', 
    category: 'Sales Pipeline & CRM Data',
    keywords: ['win rate', 'loss rate', 'conversion rate', 'close rate', 'win/loss', 'sales conversion', 'deal closure', 'sales performance']
  },
  { 
    id: 'sales_2', 
    question: 'What\'s the sales cycle per segment?', 
    category: 'Sales Pipeline & CRM Data',
    keywords: ['sales cycle', 'sales process', 'deal cycle', 'time to close', 'sales velocity', 'pipeline velocity', 'segment analysis', 'sales funnel']
  },
  { 
    id: 'sales_3', 
    question: 'Are conversion rates stable or improving?', 
    category: 'Sales Pipeline & CRM Data',
    keywords: ['conversion rate', 'conversion trend', 'sales trend', 'performance trend', 'improvement', 'optimization', 'sales metrics', 'kpi trend']
  },
  // Customer Lists / Key Account Summaries
  { 
    id: 'customer_1', 
    question: 'What share of revenue is concentrated on top 10 customers?', 
    category: 'Customer Lists / Key Account Summaries',
    keywords: ['customer concentration', 'revenue concentration', 'top customers', 'key accounts', 'customer dependence', 'revenue distribution', 'customer risk']
  },
  { 
    id: 'customer_2', 
    question: 'What is churn over last 12 months?', 
    category: 'Customer Lists / Key Account Summaries',
    keywords: ['churn', 'churn rate', 'customer churn', 'attrition', 'customer retention', 'customer loss', 'retention rate', 'customer lifetime']
  },
  { 
    id: 'customer_3', 
    question: 'Are customer satisfaction/NPS tracked?', 
    category: 'Customer Lists / Key Account Summaries',
    keywords: ['customer satisfaction', 'nps', 'net promoter score', 'customer feedback', 'satisfaction score', 'customer survey', 'customer experience', 'csat']
  }
];

export interface CommercialAnalysisProgress {
  isRunning: boolean;
  progress: number;
  message: string;
  currentStep?: string;
  totalSteps?: number;
  currentQuestion?: string;
}

interface CommercialEvidence {
  documentName: string;
  documentSummary: string;
  relevantContent: string[];
  keyFindings: string[];
  confidence: number;
}

interface CommercialAnswer {
  question: string;
  answer: string;
  confidence: number;
  sources: string[];
  detailedEvidence: CommercialEvidence[];
  keyFindings: string[];
  evidenceSummary: string;
  commercialAssessment: string;
  recommendations: string[];
}

class ComprehensiveCommercialAnalysisService {
  private progressData: Map<number, CommercialAnalysisProgress> = new Map();

  getProgress(dealId: number): CommercialAnalysisProgress {
    return this.progressData.get(dealId) || { 
      isRunning: false, 
      progress: 0, 
      message: 'No comprehensive commercial analysis running' 
    };
  }

  private setProgress(dealId: number, progress: Partial<CommercialAnalysisProgress>) {
    const current = this.getProgress(dealId);
    this.progressData.set(dealId, { ...current, ...progress });
  }

  async getAssignedCommercialDocuments(dealId: number): Promise<any[]> {
    console.log(`🏢 Finding assigned commercial documents for deal ${dealId}`);
    
    try {
      // Get ALL documents for the deal with AI summaries - same approach as Legal and Clinical
      const allDocuments = await db.select().from(documents).where(eq(documents.dealId, dealId));
      console.log(`🏢 Found ${allDocuments.length} total documents for deal ${dealId}`);
      
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
      
      console.log(`🏢 Commercial analysis will process ALL ${documentsWithAI.length} documents with AI summaries (comprehensive approach matching Legal/Clinical)`);
      
      // Return ALL documents with AI summaries for maximum coverage
      return documentsWithAI;
      
    } catch (error) {
      console.error(`❌ Error finding commercial documents:`, error);
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

  async startComprehensiveAnalysis(dealId: number): Promise<void> {
    console.log(`🏢 Starting comprehensive commercial analysis for deal ${dealId}`);
    
    this.setProgress(dealId, {
      isRunning: true,
      progress: 5,
      message: 'Starting comprehensive commercial analysis',
      currentStep: 'Initializing commercial analysis'
    });

    try {
      // Check for existing background job - if exists, analysis is already running
      const existingJob = await storage.getBackgroundJobsByDealAndType(dealId, 'comprehensive_commercial_analysis');
      if (existingJob) {
        console.log(`🏢 Commercial analysis already running for deal ${dealId} (Job: ${existingJob.jobId})`);
        this.setProgress(dealId, {
          isRunning: true,
          progress: existingJob.progress || 0,
          message: `Commercial analysis already in progress (${Math.round(existingJob.progress || 0)}% complete)`
        });
        return;
      }

      // Create unique background job ID
      const jobId = `commercial-analysis-${dealId}-${Date.now()}`;
      await storage.createBackgroundJob({
        jobId,
        jobType: 'comprehensive_commercial_analysis',
        dealId,
        agentType: 'Commercial',
        status: 'processing',
        progress: 5,
        currentStep: 'Starting commercial analysis'
      });

      // Find assigned commercial documents
      this.setProgress(dealId, {
        progress: 10,
        currentStep: 'Finding assigned commercial documents'
      });

      const documents = await this.getAssignedCommercialDocuments(dealId);
      console.log(`🏢 Found ${documents.length} assigned commercial documents`);

      if (documents.length === 0) {
        throw new Error('No commercial documents assigned for analysis');
      }

      // Extract evidence from all documents
      this.setProgress(dealId, {
        progress: 20,
        currentStep: 'Extracting evidence from commercial documents'
      });

      const evidenceResults = await this.extractEvidenceFromAllDocuments(documents, dealId);
      
      // Generate comprehensive answers for all questions
      this.setProgress(dealId, {
        progress: 70,
        currentStep: 'Generating comprehensive commercial analysis'
      });

      const commercialAnswers = await this.generateComprehensiveAnswers(evidenceResults, dealId);
      
      // Store results
      this.setProgress(dealId, {
        progress: 90,
        currentStep: 'Storing commercial analysis results'
      });

      await this.storeAnalysisResults(dealId, commercialAnswers, evidenceResults);
      
      // Complete
      this.setProgress(dealId, {
        isRunning: false,
        progress: 100,
        message: 'Commercial analysis completed successfully'
      });

      // Update background job
      await storage.updateBackgroundJob(jobId, {
        status: 'completed',
        progress: 100,
        currentStep: 'Commercial analysis completed'
      });

      console.log(`✅ Comprehensive commercial analysis completed for deal ${dealId}`);

    } catch (error) {
      console.error(`❌ Error in comprehensive commercial analysis:`, error);
      
      this.setProgress(dealId, {
        isRunning: false,
        progress: 0,
        message: `Commercial analysis failed: ${error.message}`
      });

      // Find and update any existing background jobs as failed
      try {
        const existingJob = await storage.getBackgroundJobsByDealAndType(dealId, 'comprehensive_commercial_analysis');
        if (existingJob) {
          await storage.updateBackgroundJob(existingJob.jobId, {
            status: 'failed',
            progress: 0,
            error: error.message
          });
        }
      } catch (jobError) {
        console.error(`❌ Error updating background job:`, jobError);
      }
    }
  }

  async extractEvidenceFromAllDocuments(documents: any[], dealId: number): Promise<Map<string, CommercialEvidence[]>> {
    const evidenceMap = new Map<string, CommercialEvidence[]>();
    const BATCH_SIZE = 10;
    const totalBatches = Math.ceil(documents.length / BATCH_SIZE);
    
    console.log(`🏢 Processing ${documents.length} documents in ${totalBatches} batches`);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * BATCH_SIZE;
      const batch = documents.slice(startIdx, startIdx + BATCH_SIZE);
      
      console.log(`🏢 Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} documents)`);
      
      // Update progress
      const batchProgress = 20 + Math.round((batchIndex / totalBatches) * 40);
      this.setProgress(dealId, {
        progress: batchProgress,
        currentStep: `Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} documents)`
      });
      
      // Process documents in parallel within batch
      const batchPromises = batch.map(async (doc) => {
        console.log(`🔎 Extracting evidence from: ${doc.name}`);
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
        COMMERCIAL_QUESTIONS.forEach(question => {
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

  async extractEvidenceFromDocument(doc: any): Promise<CommercialEvidence> {
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
    You are a commercial due diligence expert. Analyze this document and extract key commercial information.
    
    Focus on:
    1. Competitive positioning and differentiation
    2. Pricing models and discount policies
    3. Sales performance metrics (win rates, conversion rates, sales cycles)
    4. Customer concentration and retention data
    5. Market positioning and business strategy
    
    Document: ${doc.name}
    Content: ${content.substring(0, 4000)}
    
    Return a JSON response with:
    {
      "documentSummary": "Brief summary of the document's commercial relevance",
      "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
      "relevantContent": ["Quote 1", "Quote 2", "Quote 3"],
      "confidence": 0.85
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
      documentName: doc.name,
      documentSummary: result.documentSummary || 'Commercial analysis completed',
      relevantContent: Array.isArray(result.relevantContent) ? result.relevantContent : [],
      keyFindings: Array.isArray(result.keyFindings) ? result.keyFindings : [],
      confidence: result.confidence || 0.7
    };
  }

  filterEvidenceForQuestion(evidence: CommercialEvidence, question: any): CommercialEvidence | null {
    const content = (evidence.documentSummary + ' ' + evidence.relevantContent.join(' ') + ' ' + evidence.keyFindings.join(' ')).toLowerCase();
    
    // Check if document contains keywords relevant to this question
    const hasRelevantKeywords = question.keywords.some(keyword => content.includes(keyword.toLowerCase()));
    
    if (!hasRelevantKeywords) {
      return null;
    }
    
    // Filter content to only relevant parts
    const filteredContent = evidence.relevantContent.filter(item => 
      question.keywords.some(keyword => item.toLowerCase().includes(keyword.toLowerCase()))
    );
    
    const filteredFindings = evidence.keyFindings.filter(finding => 
      question.keywords.some(keyword => finding.toLowerCase().includes(keyword.toLowerCase()))
    );
    
    return {
      ...evidence,
      relevantContent: filteredContent,
      keyFindings: filteredFindings,
      confidence: Math.min(evidence.confidence, 0.9) // Slightly reduce confidence for filtered evidence
    };
  }

  async generateComprehensiveAnswers(evidenceMap: Map<string, CommercialEvidence[]>, dealId: number): Promise<{[key: string]: CommercialAnswer}> {
    const answers: {[key: string]: CommercialAnswer} = {};
    const questionCount = COMMERCIAL_QUESTIONS.length;
    
    for (let i = 0; i < COMMERCIAL_QUESTIONS.length; i++) {
      const question = COMMERCIAL_QUESTIONS[i];
      const questionProgress = 70 + Math.round((i / questionCount) * 15);
      
      this.setProgress(dealId, {
        progress: questionProgress,
        currentStep: `Analyzing: ${question.category}`,
        currentQuestion: question.question
      });
      
      const evidence = evidenceMap.get(question.id) || [];
      console.log(`🏢 Generating answer for: ${question.question} (${evidence.length} documents with evidence)`);
      
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

  async generateAnswerForQuestion(question: any, evidence: CommercialEvidence[]): Promise<CommercialAnswer> {
    if (evidence.length === 0) {
      return {
        question: question.question,
        answer: `No specific evidence found in the analyzed commercial documents for: ${question.question}`,
        confidence: 0,
        sources: [],
        detailedEvidence: [],
        keyFindings: [],
        evidenceSummary: 'No relevant commercial evidence available',
        commercialAssessment: 'Unable to assess due to lack of relevant documentation',
        recommendations: ['Consider providing additional commercial documentation for comprehensive analysis']
      };
    }

    // Compile all evidence
    const allContent = evidence.map(e => e.relevantContent.join(' ')).join('\n');
    const allFindings = evidence.flatMap(e => e.keyFindings);
    
    const prompt = `
    You are a commercial due diligence expert analyzing investment opportunities.
    
    Question: ${question.question}
    Category: ${question.category}
    
    Evidence from documents:
    ${allContent}
    
    Key findings:
    ${allFindings.join('\n')}
    
    Provide a comprehensive commercial analysis response as JSON:
    {
      "answer": "Detailed answer based on evidence",
      "confidence": 0.85,
      "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
      "evidenceSummary": "Summary of the evidence analyzed",
      "commercialAssessment": "Professional commercial assessment",
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
      answer: result.answer || 'Commercial analysis completed',
      confidence: Math.min(Math.max(result.confidence || 0.7, 0), 1),
      sources: evidence.map(e => e.documentName),
      detailedEvidence: evidence,
      keyFindings: Array.isArray(result.keyFindings) ? result.keyFindings : [],
      evidenceSummary: result.evidenceSummary || 'Evidence analyzed',
      commercialAssessment: result.commercialAssessment || 'Commercial assessment completed',
      recommendations: Array.isArray(result.recommendations) ? result.recommendations : []
    };
  }

  generateFallbackAnswer(question: any, evidence: CommercialEvidence[]): CommercialAnswer {
    return {
      question: question.question,
      answer: `Analysis completed for ${question.question}. ${evidence.length} documents were reviewed for relevant commercial information.`,
      confidence: evidence.length > 0 ? 0.6 : 0.1,
      sources: evidence.map(e => e.documentName),
      detailedEvidence: evidence,
      keyFindings: evidence.flatMap(e => e.keyFindings).slice(0, 3),
      evidenceSummary: `Analyzed ${evidence.length} commercial documents`,
      commercialAssessment: 'Commercial analysis completed with available documentation',
      recommendations: ['Consider additional commercial documentation for more comprehensive analysis']
    };
  }

  async storeAnalysisResults(dealId: number, answers: {[key: string]: CommercialAnswer}, evidenceMap: Map<string, CommercialEvidence[]>): Promise<void> {
    // Generate findings and recommendations
    const findings = Object.values(answers).flatMap(answer => 
      answer.keyFindings.map((finding, index) => ({
        id: index,
        content: finding,
        type: 'commercial_finding',
        confidence: answer.confidence,
        source: answer.sources[0] || 'Commercial analysis'
      }))
    );

    const recommendations = Object.values(answers).flatMap(answer => 
      answer.recommendations.map(rec => ({
        title: `Commercial: ${rec.substring(0, 50)}...`,
        content: rec,
        priority: 'Medium',
        category: 'Commercial',
        impact: 'Medium'
      }))
    );

    // Store in agent_analyses table
    const existingAnalysis = await storage.getAnalysisByDealAndAgent(dealId, 'Commercial');
    
    if (existingAnalysis) {
      await storage.updateAgentAnalysis(existingAnalysis.id, {
        status: 'Completed',
        progress: 100,
        findings,
        recommendations,
        commercialAnswers: answers
      });
    } else {
      await storage.createAgentAnalysis({
        dealId,
        agentType: 'Commercial',
        status: 'Completed',
        progress: 100,
        findings,
        recommendations,
        commercialAnswers: answers
      });
    }

    console.log(`✅ Stored commercial analysis: ${findings.length} findings, ${recommendations.length} recommendations`);
  }

  async getAnalysisResults(dealId: number): Promise<any> {
    try {
      const analysis = await storage.getAnalysisByDealAndAgent(dealId, 'Commercial');
      
      if (!analysis || !analysis.commercialAnswers) {
        return null;
      }
      
      return {
        commercialAnswers: analysis.commercialAnswers,
        findings: analysis.findings || [],
        recommendations: analysis.recommendations || [],
        status: analysis.status,
        progress: analysis.progress
      };
    } catch (error) {
      console.error(`❌ Error retrieving commercial analysis results:`, error);
      return null;
    }
  }
}

export const comprehensiveCommercialAnalysisService = new ComprehensiveCommercialAnalysisService();
export { COMMERCIAL_QUESTIONS };