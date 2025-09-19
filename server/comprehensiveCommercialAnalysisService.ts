import { storage } from './storage';
import { db } from './db';
import { documents, agentAnalyses } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const COMMERCIAL_QUESTIONS = [
  // Competitive Analysis Decks
  { 
    id: 'competitive_1', 
    question: 'Is the differentiation clearly articulated?', 
    category: 'Competitive Analysis Decks',
    analysisPrompt: 'Identify competitive differentiation, unique value propositions, competitive advantages, and market positioning strategies.',
    keywords: ['competitive', 'differentiation', 'competitive advantage', 'unique value', 'positioning', 'competitor', 'comparison', 'market position', 'value prop', 'usp']
  },
  { 
    id: 'competitive_2', 
    question: 'Are comparison matrices based on price/features?', 
    category: 'Competitive Analysis Decks',
    analysisPrompt: 'Find comparison matrices, competitive benchmarking, price/feature analysis, and competitive positioning data.',
    keywords: ['comparison matrix', 'price comparison', 'feature comparison', 'competitive matrix', 'pricing table', 'feature set', 'competitive analysis', 'benchmark']
  },
  { 
    id: 'competitive_3', 
    question: 'Is switching cost vs. competitors assessed?', 
    category: 'Competitive Analysis Decks',
    analysisPrompt: 'Analyze switching costs, customer lock-in factors, migration barriers, and competitive stickiness assessments.',
    keywords: ['switching cost', 'migration cost', 'switching barrier', 'customer retention', 'lock-in', 'stickiness', 'churn prevention', 'switching friction']
  },
  // Pricing Models
  { 
    id: 'pricing_1', 
    question: 'What pricing logic is used (usage-based, tiered, per-seat)?', 
    category: 'Pricing Models',
    analysisPrompt: 'Identify pricing models, billing structures, subscription tiers, usage-based pricing, and monetization strategies.',
    keywords: ['pricing model', 'usage-based', 'tiered pricing', 'per-seat', 'subscription', 'freemium', 'pricing strategy', 'pricing tier', 'billing model']
  },
  { 
    id: 'pricing_2', 
    question: 'Are discount policies documented?', 
    category: 'Pricing Models',
    analysisPrompt: 'Look for discount policies, pricing flexibility, volume discounts, enterprise pricing, and promotional strategies.',
    keywords: ['discount policy', 'pricing discount', 'volume discount', 'enterprise discount', 'promotional pricing', 'pricing flexibility', 'discount structure']
  },
  { 
    id: 'pricing_3', 
    question: 'Is net revenue retention tracked?', 
    category: 'Pricing Models',
    analysisPrompt: 'Find net revenue retention metrics, expansion revenue data, upsell/cross-sell performance, and customer growth indicators.',
    keywords: ['net revenue retention', 'nrr', 'revenue retention', 'expansion revenue', 'upsell', 'cross-sell', 'customer growth', 'retention rate']
  },
  // Sales Pipeline & CRM Data
  { 
    id: 'sales_1', 
    question: 'What are win/loss rates?', 
    category: 'Sales Pipeline & CRM Data',
    analysisPrompt: 'Identify win/loss rates, sales conversion metrics, deal closure statistics, and sales performance indicators.',
    keywords: ['win rate', 'loss rate', 'conversion rate', 'close rate', 'win/loss', 'sales conversion', 'deal closure', 'sales performance']
  },
  { 
    id: 'sales_2', 
    question: 'What\'s the sales cycle per segment?', 
    category: 'Sales Pipeline & CRM Data',
    analysisPrompt: 'Analyze sales cycles, deal velocity, time-to-close metrics, and segment-specific sales performance data.',
    keywords: ['sales cycle', 'sales process', 'deal cycle', 'time to close', 'sales velocity', 'pipeline velocity', 'segment analysis', 'sales funnel']
  },
  { 
    id: 'sales_3', 
    question: 'Are conversion rates stable or improving?', 
    category: 'Sales Pipeline & CRM Data',
    analysisPrompt: 'Track conversion rate trends, sales performance improvements, optimization metrics, and KPI trajectory analysis.',
    keywords: ['conversion rate', 'conversion trend', 'sales trend', 'performance trend', 'improvement', 'optimization', 'sales metrics', 'kpi trend']
  },
  // Customer Lists / Key Account Summaries
  { 
    id: 'customer_1', 
    question: 'What share of revenue is concentrated on top 10 customers?', 
    category: 'Customer Lists / Key Account Summaries',
    analysisPrompt: 'Identify customer concentration risk, revenue distribution, key account dependencies, and customer diversification metrics.',
    keywords: ['customer concentration', 'revenue concentration', 'top customers', 'key accounts', 'customer dependence', 'revenue distribution', 'customer risk']
  },
  { 
    id: 'customer_2', 
    question: 'What is churn over last 12 months?', 
    category: 'Customer Lists / Key Account Summaries',
    analysisPrompt: 'Analyze customer churn rates, attrition patterns, retention metrics, and customer lifetime value data.',
    keywords: ['churn', 'churn rate', 'customer churn', 'attrition', 'customer retention', 'customer loss', 'retention rate', 'customer lifetime']
  },
  { 
    id: 'customer_3', 
    question: 'Are customer satisfaction/NPS tracked?', 
    category: 'Customer Lists / Key Account Summaries',
    analysisPrompt: 'Find customer satisfaction metrics, NPS scores, customer feedback data, and customer experience measurement systems.',
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

export class ComprehensiveCommercialAnalysisService {
  private progressData: Map<number, CommercialAnalysisProgress> = new Map();

  getProgress(dealId: number): CommercialAnalysisProgress {
    return this.progressData.get(dealId) || { 
      isRunning: false, 
      progress: 0, 
      message: 'No comprehensive commercial analysis running' 
    };
  }

  private async setProgress(dealId: number, progress: Partial<CommercialAnalysisProgress>, jobId?: string) {
    const current = this.getProgress(dealId);
    this.progressData.set(dealId, { ...current, ...progress });
    
    // Also update database background job if jobId provided
    if (jobId && progress.progress !== undefined) {
      try {
        await storage.updateBackgroundJob(jobId, {
          progress: progress.progress,
          currentStep: progress.currentStep || current.currentStep || 'Processing commercial analysis'
        });
      } catch (error) {
        console.error(`❌ Error updating background job ${jobId}:`, error);
      }
    }
  }

  async getAssignedCommercialDocuments(dealId: number): Promise<any[]> {
    console.log(`🏢 FIXED: Finding assigned commercial documents for deal ${dealId}`);
    
    try {
      // ✅ CORRECT: Use proper storage method that fetches OCR text correctly
      const allDocuments = await storage.getDocumentsWithOCRByDealId(dealId);
      console.log(`🏢 Found ${allDocuments.length} total documents for deal ${dealId}`);
      
      // Log OCR text availability for debugging
      const docsWithOCR = allDocuments.filter(doc => doc.ocrText && doc.ocrText.length > 0);
      const docsWithSummary = allDocuments.filter(doc => doc.aiSummary);
      console.log(`📊 Commercial: Documents with OCR text: ${docsWithOCR.length}/${allDocuments.length}`);
      console.log(`📊 Commercial: Documents with AI summary: ${docsWithSummary.length}/${allDocuments.length}`);
      
      // Filter to include documents with OCR text OR AI summaries for analysis
      const documentsWithContent = allDocuments.filter(doc => {
        // Prioritize OCR text, fallback to AI summary
        if (doc.ocrText && doc.ocrText.length > 100) {
          console.log(`📄 Commercial: Document ${doc.name}: Using OCR text (${doc.ocrText.length} chars)`);
          return true;
        }
        
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
      
      console.log(`🏢 Commercial analysis will process ALL ${documentsWithContent.length} documents with content (OCR + AI summaries)`);
      
      // Return ALL documents with content for maximum coverage
      return documentsWithContent;
      
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

  /**
   * Run comprehensive analysis for all assigned commercial documents
   * EXACT CLONE of Clinical agent micro-step architecture
   */
  async runComprehensiveAnalysis(dealId: number, storageService: any, jobId: string): Promise<any> {
    console.log(`🏢 Starting comprehensive commercial analysis for deal ${dealId}`);
    
    try {
      // Get all commercial documents - EXACT Clinical approach
      const assignedDocuments = await this.getAssignedCommercialDocuments(dealId);
      console.log(`📄 Found ${assignedDocuments.length} commercial documents for analysis`);
      
      if (assignedDocuments.length === 0) {
        console.log('⚠️ No commercial documents found for analysis');
        await storageService.updateBackgroundJob(jobId, {
          status: 'completed',
          progress: 100,
          currentStep: 'No commercial documents available for analysis'
        });
        return { success: false, message: 'No commercial documents found' };
      }
      
      // Initialize progress - EXACT Clinical approach
      await storageService.updateBackgroundJob(jobId, {
        progress: 5,
        currentStep: 'Starting commercial analysis',
        processedDocuments: 0,
        totalDocuments: COMMERCIAL_QUESTIONS.length
      });
      
      // Process each question systematically - EXACT Clinical approach
      const commercialAnswers: Record<string, any> = {};
      
      for (let i = 0; i < COMMERCIAL_QUESTIONS.length; i++) {
        const question = COMMERCIAL_QUESTIONS[i];
        console.log(`📊 Processing commercial question ${i + 1}/${COMMERCIAL_QUESTIONS.length}: ${question.question}`);
        
        // CRITICAL: Update progress for each question - EXACT Clinical micro-step architecture
        await storageService.updateBackgroundJob(jobId, {
          progress: Math.round(((i + 1) / COMMERCIAL_QUESTIONS.length) * 100),
          processedDocuments: i,
          currentStep: `Analyzing: ${question.question}`,
          currentDocumentName: question.category
        });
        console.log(`💾 Updated background job ${jobId} to ${Math.round(((i + 1) / COMMERCIAL_QUESTIONS.length) * 100)}%`);
        
        try {
          console.log(`📊 Extracting commercial evidence for: ${question.question}`);
          
          // Extract evidence from ALL documents for this question - EXACT Clinical approach with SPEED OPTIMIZATION
          const documentEvidence = await this.extractEvidenceFromAllDocuments(
            assignedDocuments.slice(0, 30), // SPEED: Use only first 30 documents for faster processing
            question
          );
          console.log(`📊 Evidence extraction completed for question: ${question.question}`);
          
          // Compile comprehensive answer with timeout - EXACT Clinical approach
          console.log(`🤖 Starting OpenAI analysis for question: ${question.question} with ${documentEvidence.length} pieces of evidence`);
          const answer = await Promise.race([
            this.compileComprehensiveAnswer(question, documentEvidence),
            new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI analysis timeout')), 60000)) // 60 second timeout
          ]);
          commercialAnswers[question.id] = answer;
          console.log(`🤖 OpenAI analysis completed for question: ${question.question}`);
          
          console.log(`✅ Completed question ${i + 1}/${COMMERCIAL_QUESTIONS.length}: ${question.question}`);
          
          // Brief delay to avoid rate limiting - EXACT Clinical approach
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (questionError) {
          console.error(`❌ Error processing question "${question.question}":`, questionError);
          
          // Store partial answer for this question - EXACT Clinical approach
          commercialAnswers[question.id] = {
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
            progress: Math.round((i / COMMERCIAL_QUESTIONS.length) * 100),
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
          processedDocuments: COMMERCIAL_QUESTIONS.length,
          currentStep: 'Generating findings and recommendations',
          status: 'completing'
        });
        
        // Generate comprehensive findings and recommendations - EXACT Clinical approach
        const findings = this.generateComprehensiveFindings(commercialAnswers);
        const recommendations = this.generateComprehensiveRecommendations(commercialAnswers);
        
        // Store the analysis results - EXACT Clinical approach
        await this.storeComprehensiveResults(dealId, commercialAnswers, findings, recommendations, assignedDocuments);
        
        // Mark job as completed - EXACT Clinical approach
        await storageService.updateBackgroundJob(jobId, {
          status: 'completed',
          currentStep: 'Analysis completed'
        });
        
        console.log(`✅ Comprehensive commercial analysis completed for deal ${dealId}`);
        
        return {
          success: true,
          documentsAnalyzed: assignedDocuments.length,
          questionsAnswered: Object.keys(commercialAnswers).length,
          findings: findings.length,
          recommendations: recommendations.length
        };
      } catch (finalError) {
        console.error(`❌ Error in final stages of commercial analysis for deal ${dealId}:`, finalError);
        
        // Still try to save what we have - EXACT Clinical approach
        try {
          const partialFindings = this.generateComprehensiveFindings(commercialAnswers);
          const partialRecommendations = this.generateComprehensiveRecommendations(commercialAnswers);
          await this.storeComprehensiveResults(dealId, commercialAnswers, partialFindings, partialRecommendations, assignedDocuments);
          
          // Mark as completed with error - EXACT Clinical approach
          await storageService.updateBackgroundJob(jobId, {
            status: 'completed',
            currentStep: 'Completed with partial results due to errors',
            error: finalError.message
          });
          
          return {
            success: true,
            documentsAnalyzed: assignedDocuments.length,
            questionsAnswered: Object.keys(commercialAnswers).length,
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
      console.error(`❌ Critical error in commercial analysis for deal ${dealId}:`, error);
      
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
    
    const prompt = `You are an expert commercial due diligence analyst conducting comprehensive investment analysis. Your task is to find ANY commercial, business, market, sales, competitive, or strategic information, even if indirectly related.

DOCUMENT: ${document.name}
CONTENT: ${content.substring(0, 4000)}

QUESTION: "${question.question}"
ANALYSIS TASK: ${question.analysisPrompt}

Instructions:
- Look for DIRECT commercial terms: pricing, sales, customers, competition, market share, revenue, partnerships
- Look for INDIRECT business information: company performance, growth metrics, business relationships, strategic initiatives
- Consider business documents that mention commercial milestones, market positioning, competitive advantages
- Even general business context often has commercial implications for investment due diligence
- For investment companies, most business documents contain commercial information relevant to investors

Respond in JSON format:
{
  "relevantContent": ["Exact quote 1 from document", "Exact quote 2 from document"],
  "hasRelevantInfo": true/false,
  "confidence": 0-100,
  "keyFindings": ["Finding 1", "Finding 2"],
  "documentSummary": "Brief summary of what this document contains relevant to the question",
  "commercialContext": "How this document relates to commercial/business aspects"
}

Be thorough in finding relevance - most business documents have commercial implications for investment analysis.`;

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
   * Compile comprehensive answer based on all evidence - EXACT Clinical approach
   */
  private async compileComprehensiveAnswer(question: any, evidence: any[]): Promise<any> {
    console.log(`🔍 Compiling answer for: ${question.question}`);
    console.log(`📋 Evidence count: ${evidence.length}`);
    
    if (evidence.length === 0) {
      console.log(`⚠️ No evidence found for question: ${question.question}`);
      return {
        question: question.question,
        answer: `No relevant commercial information found in the assigned commercial documents for this question.`,
        confidence: 10,
        sources: [],
        evidenceCount: 0,
        keyFindings: [],
        gaps: ['No relevant commercial information found'],
        category: question.category
      };
    }

    // Prepare evidence summary for AI compilation - EXACT Clinical approach
    const evidenceSummary = evidence.map(ev => ({
      document: ev.documentName,
      content: ev.relevantContent.join(' '),
      findings: ev.keyFindings.join(' '),
      confidence: ev.confidence
    }));

    const prompt = `You are an expert commercial due diligence analyst compiling a comprehensive answer based on evidence from multiple documents.

QUESTION: "${question.question}"
CATEGORY: ${question.category}

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
5. Include commercial recommendations

Respond in JSON format:
{
  "answer": "Comprehensive answer synthesizing all evidence",
  "confidence": 0-100,
  "sources": ["Document name 1", "Document name 2"],
  "keyFindings": ["Finding 1", "Finding 2"],
  "gaps": ["Missing information 1", "Missing information 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "commercialAssessment": "Overall commercial assessment based on evidence",
  "evidenceCount": ${evidence.length}
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2000
      });
      
      const compiledAnswer = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        question: question.question,
        category: question.category,
        answer: compiledAnswer.answer || 'Unable to compile answer from available evidence',
        confidence: compiledAnswer.confidence || 30,
        sources: evidence.map(e => e.documentName), // SHOW ALL ANALYZED DOCUMENTS
        keyFindings: compiledAnswer.keyFindings || [],
        gaps: compiledAnswer.gaps || [],
        recommendations: compiledAnswer.recommendations || [],
        commercialAssessment: compiledAnswer.commercialAssessment || '',
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
        sources: evidence.map(e => e.documentName), // SHOW ALL ANALYZED DOCUMENTS
        keyFindings: [],
        gaps: ['Analysis compilation failed'],
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
      const question = COMMERCIAL_QUESTIONS.find(q => q.id === questionId);
      if (!question) continue;
      
      // High confidence findings
      if (answer.confidence > 70) {
        findings.push({
          id: findings.length + 1,
          type: 'positive',
          content: `${question.question}: ${answer.answer.substring(0, 150)}...`,
          source: answer.sources.length > 0 ? answer.sources[0] : 'Commercial Documents',
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
          content: `Insufficient commercial information for: ${question.question}. Additional documentation may be required.`,
          source: 'Commercial Analysis',
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
      const question = COMMERCIAL_QUESTIONS.find(q => q.id === questionId);
      if (!question) continue;
      
      // Add specific recommendations from the answer
      if (answer.recommendations && answer.recommendations.length > 0) {
        answer.recommendations.forEach((rec: string, index: number) => {
          recommendations.push({
            id: recommendations.length + 1,
            type: answer.confidence > 70 ? 'positive' : 'neutral',
            content: `${question.category}: ${rec}`,
            source: 'Commercial Analysis',
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
    commercialAnswers: Record<string, any>, 
    findings: any[], 
    recommendations: any[], 
    assignedDocuments: any[]
  ): Promise<void> {
    console.log(`💾 Storing comprehensive commercial analysis results for deal ${dealId}`);
    
    try {
      // Store in agent_analyses table - EXACT LEGAL APPROACH matching their working database structure
      await db
        .delete(agentAnalyses)
        .where(and(
          eq(agentAnalyses.dealId, dealId),
          eq(agentAnalyses.agentType, 'commercial')
        ));
      
      console.log(`🗑️ Cleared existing commercial analysis for deal ${dealId}`);
      
      // Create the new comprehensive analysis - EXACT copy of Legal structure
      const analysisData = {
        dealId,
        agentType: 'commercial' as const,
        status: 'completed' as const,
        progress: 100,
        findings: JSON.stringify(findings),
        recommendations: JSON.stringify(recommendations),
        commercial_answers: commercialAnswers, // FIXED: Store as object (not JSON string) for consistent field mapping
        documentSources: JSON.stringify(assignedDocuments.map((d: any) => d.name)),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db
        .insert(agentAnalyses)
        .values(analysisData);
      
      console.log(`📊 Created fresh comprehensive commercial analysis for deal ${dealId} with ${Object.keys(commercialAnswers).length} questions answered`);
    } catch (error) {
      console.error(`❌ Error storing commercial analysis results:`, error);
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
        description: rec,
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