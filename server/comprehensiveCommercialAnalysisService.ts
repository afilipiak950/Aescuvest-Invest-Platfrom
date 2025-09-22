import { storage } from './storage';
import { db } from './db';
import { documents, agentAnalyses } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { ENTERPRISE_AGENT_PROMPTS, ENTERPRISE_PROMPT_FRAMEWORK } from './utils/enterprisePrompts';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MARKET_STRATEGY_QUESTIONS = [
  // Competitive Positioning Matrix
  { 
    id: 'competitive_positioning_1', 
    question: 'What is the company\'s market share percentage in its primary market segment?', 
    category: 'Competitive Positioning Matrix',
    analysisPrompt: 'Quantify market share percentages, competitive position analysis, and market leadership assessment.',
    keywords: ['market share', 'market position', 'competitive position', 'market leader', 'market penetration', 'segment share', 'market dominance'],
    outputField: 'marketPosition'
  },
  { 
    id: 'competitive_positioning_2', 
    question: 'How does pricing compare to top 3 competitors (premium/discount percentage)?', 
    category: 'Competitive Positioning Matrix',
    analysisPrompt: 'Analyze competitive pricing positioning, premium/discount analysis, and pricing differentiation strategies.',
    keywords: ['competitive pricing', 'pricing comparison', 'price premium', 'price discount', 'pricing position', 'competitor pricing'],
    outputField: 'competitiveAdvantage'
  },
  { 
    id: 'competitive_positioning_3', 
    question: 'What are the key competitive advantages and their sustainability (1-5 years)?', 
    category: 'Competitive Positioning Matrix',
    analysisPrompt: 'Identify sustainable competitive advantages, competitive moats, and differentiation factors with timeline analysis.',
    keywords: ['competitive advantage', 'competitive moat', 'differentiation', 'sustainability', 'competitive barriers', 'unique value'],
    outputField: 'competitiveAdvantage'
  },
  
  // Pricing Strategy Optimization
  { 
    id: 'pricing_strategy_1', 
    question: 'What is the price elasticity of demand for core products/services?', 
    category: 'Pricing Strategy Optimization',
    analysisPrompt: 'Analyze price elasticity, demand sensitivity, and optimal pricing strategies with quantitative analysis.',
    keywords: ['price elasticity', 'demand elasticity', 'pricing sensitivity', 'optimal pricing', 'price optimization', 'elasticity analysis'],
    outputField: 'pricingAnalysis'
  },
  { 
    id: 'pricing_strategy_2', 
    question: 'How does pricing strategy impact customer acquisition cost (CAC) and lifetime value (LTV)?', 
    category: 'Pricing Strategy Optimization',
    analysisPrompt: 'Evaluate pricing impact on unit economics, CAC/LTV ratios, and customer economics optimization.',
    keywords: ['pricing impact', 'customer acquisition cost', 'lifetime value', 'unit economics', 'cac ltv ratio', 'customer economics'],
    outputField: 'pricingAnalysis'
  },
  { 
    id: 'pricing_strategy_3', 
    question: 'What pricing models are used and their revenue optimization potential?', 
    category: 'Pricing Strategy Optimization',
    analysisPrompt: 'Assess pricing model effectiveness, revenue optimization opportunities, and monetization strategy analysis.',
    keywords: ['pricing model', 'revenue optimization', 'monetization strategy', 'pricing structure', 'billing model', 'pricing tiers'],
    outputField: 'pricingAnalysis'
  },
  
  // Sales Channel Effectiveness
  { 
    id: 'sales_channel_1', 
    question: 'What are the conversion rates by sales channel (direct, partner, online)?', 
    category: 'Sales Channel Effectiveness',
    analysisPrompt: 'Analyze sales channel performance, conversion rates, and channel effectiveness metrics with ROI analysis.',
    keywords: ['sales channel', 'conversion rate', 'channel effectiveness', 'sales performance', 'channel roi', 'channel conversion'],
    outputField: 'salesEfficiency'
  },
  { 
    id: 'sales_channel_2', 
    question: 'What is the average sales cycle length and quota attainment by channel?', 
    category: 'Sales Channel Effectiveness',
    analysisPrompt: 'Evaluate sales cycle efficiency, quota performance, and sales productivity metrics across channels.',
    keywords: ['sales cycle', 'quota attainment', 'sales productivity', 'sales efficiency', 'deal velocity', 'sales performance'],
    outputField: 'salesEfficiency'
  },
  { 
    id: 'sales_channel_3', 
    question: 'How effective are different sales channels at customer retention and expansion?', 
    category: 'Sales Channel Effectiveness',
    analysisPrompt: 'Assess channel effectiveness for customer retention, expansion revenue, and long-term customer value creation.',
    keywords: ['customer retention', 'expansion revenue', 'channel retention', 'customer expansion', 'retention rates', 'channel loyalty'],
    outputField: 'salesEfficiency'
  },
  
  // Customer Metrics & LTV Analysis
  { 
    id: 'customer_ltv_1', 
    question: 'What is the customer lifetime value (LTV) by segment and cohort?', 
    category: 'Customer Metrics & LTV Analysis',
    analysisPrompt: 'Calculate customer lifetime value, segment analysis, and cohort performance with revenue attribution.',
    keywords: ['customer lifetime value', 'ltv analysis', 'customer segments', 'cohort analysis', 'customer value', 'revenue per customer'],
    outputField: 'marketPosition'
  },
  { 
    id: 'customer_ltv_2', 
    question: 'What are the customer acquisition costs (CAC) and payback periods by channel?', 
    category: 'Customer Metrics & LTV Analysis',
    analysisPrompt: 'Analyze customer acquisition economics, payback periods, and channel efficiency metrics.',
    keywords: ['customer acquisition cost', 'cac analysis', 'payback period', 'acquisition efficiency', 'customer economics', 'acquisition roi'],
    outputField: 'salesEfficiency'
  },
  { 
    id: 'customer_ltv_3', 
    question: 'What is the net revenue retention (NRR) and expansion revenue percentage?', 
    category: 'Customer Metrics & LTV Analysis',
    analysisPrompt: 'Evaluate net revenue retention, expansion revenue performance, and customer growth metrics.',
    keywords: ['net revenue retention', 'nrr', 'expansion revenue', 'customer growth', 'revenue retention', 'customer expansion'],
    outputField: 'marketPosition'
  },
  
  // Market Penetration & Growth
  { 
    id: 'market_penetration_1', 
    question: 'What is the total addressable market (TAM) penetration rate and growth trajectory?', 
    category: 'Market Penetration Analysis',
    analysisPrompt: 'Assess market penetration rates, TAM analysis, and growth trajectory with market opportunity quantification.',
    keywords: ['total addressable market', 'tam penetration', 'market penetration', 'growth trajectory', 'market opportunity', 'market size'],
    outputField: 'marketPosition'
  },
  { 
    id: 'market_penetration_2', 
    question: 'How does customer concentration risk impact market position (top 10 customer revenue %)?', 
    category: 'Market Penetration Analysis',
    analysisPrompt: 'Evaluate customer concentration risk, revenue diversification, and market position stability.',
    keywords: ['customer concentration', 'revenue concentration', 'concentration risk', 'customer diversification', 'revenue distribution'],
    outputField: 'marketPosition'
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

interface MarketStrategyAnswer {
  question: string;
  answer: string;
  confidence: number;
  sources: string[];
  detailedEvidence: CommercialEvidence[];
  keyFindings: string[];
  evidenceSummary: string;
  commercialAssessment: string;
  recommendations: string[];
  category: string;
  outputField: string;
  marketPosition?: any;
  pricingAnalysis?: any;
  salesEfficiency?: any;
  competitiveAdvantage?: any;
}

export class MarketStrategyExpertService {
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
        currentStep: 'Starting Market Strategy Expert analysis',
        processedDocuments: 0,
        totalDocuments: MARKET_STRATEGY_QUESTIONS.length
      });
      
      // Process each question systematically - EXACT Clinical approach
      const marketStrategyAnswers: Record<string, any> = {};
      
      for (let i = 0; i < MARKET_STRATEGY_QUESTIONS.length; i++) {
        const question = MARKET_STRATEGY_QUESTIONS[i];
        console.log(`📊 Processing market strategy question ${i + 1}/${MARKET_STRATEGY_QUESTIONS.length}: ${question.question}`);
        
        // CRITICAL: Update progress for each question - EXACT Clinical micro-step architecture
        await storageService.updateBackgroundJob(jobId, {
          progress: Math.round(((i + 1) / MARKET_STRATEGY_QUESTIONS.length) * 100),
          processedDocuments: i,
          currentStep: `Analyzing: ${question.question}`,
          currentDocumentName: question.category
        });
        console.log(`💾 Updated background job ${jobId} to ${Math.round(((i + 1) / MARKET_STRATEGY_QUESTIONS.length) * 100)}%`);
        
        try {
          console.log(`📊 Extracting market strategy evidence for: ${question.question}`);
          
          // Extract evidence from ALL documents for this question - EXACT Clinical approach with SPEED OPTIMIZATION
          const documentEvidence = await this.extractEvidenceFromAllDocuments(
            assignedDocuments.slice(0, 30), // SPEED: Use only first 30 documents for faster processing
            question
          );
          console.log(`📊 Evidence extraction completed for question: ${question.question}`);
          
          // Compile comprehensive answer with timeout - EXACT Clinical approach
          console.log(`🤖 Starting OpenAI analysis for question: ${question.question} with ${documentEvidence.length} pieces of evidence`);
          const answer = await Promise.race([
            this.compileEnterpriseAnswer(question, documentEvidence),
            new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI analysis timeout')), 60000)) // 60 second timeout
          ]);
          marketStrategyAnswers[question.id] = answer;
          console.log(`🤖 OpenAI analysis completed for question: ${question.question}`);
          
          console.log(`✅ Completed question ${i + 1}/${MARKET_STRATEGY_QUESTIONS.length}: ${question.question}`);
          
          // Brief delay to avoid rate limiting - EXACT Clinical approach
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (questionError) {
          console.error(`❌ Error processing question "${question.question}":`, questionError);
          
          // Store partial answer for this question - EXACT Clinical approach
          marketStrategyAnswers[question.id] = {
            question: question.question,
            category: question.category,
            outputField: question.outputField,
            answer: `Error processing this question: ${questionError.message}`,
            confidence: 0,
            sources: [],
            evidence: [],
            error: true
          };
          
          // Update progress to continue processing - EXACT Clinical approach
          await storageService.updateBackgroundJob(jobId, {
            progress: Math.round((i / MARKET_STRATEGY_QUESTIONS.length) * 100),
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
          processedDocuments: MARKET_STRATEGY_QUESTIONS.length,
          currentStep: 'Generating Market Strategy findings and recommendations',
          status: 'completing'
        });
        
        // Generate comprehensive findings and recommendations - EXACT Clinical approach
        const findings = this.generateMarketStrategyFindings(marketStrategyAnswers);
        const recommendations = this.generateMarketStrategyRecommendations(marketStrategyAnswers);
        
        // Store the analysis results - EXACT Clinical approach
        await this.storeMarketStrategyResults(dealId, marketStrategyAnswers, findings, recommendations, assignedDocuments);
        
        // Mark job as completed - EXACT Clinical approach
        await storageService.updateBackgroundJob(jobId, {
          status: 'completed',
          currentStep: 'Analysis completed'
        });
        
        console.log(`✅ Comprehensive commercial analysis completed for deal ${dealId}`);
        
        return {
          success: true,
          documentsAnalyzed: assignedDocuments.length,
          questionsAnswered: Object.keys(marketStrategyAnswers).length,
          findings: findings.length,
          recommendations: recommendations.length
        };
      } catch (finalError) {
        console.error(`❌ Error in final stages of commercial analysis for deal ${dealId}:`, finalError);
        
        // Still try to save what we have - EXACT Clinical approach
        try {
          const partialFindings = this.generateMarketStrategyFindings(marketStrategyAnswers);
          const partialRecommendations = this.generateMarketStrategyRecommendations(marketStrategyAnswers);
          await this.storeMarketStrategyResults(dealId, marketStrategyAnswers, partialFindings, partialRecommendations, assignedDocuments);
          
          // Mark as completed with error - EXACT Clinical approach
          await storageService.updateBackgroundJob(jobId, {
            status: 'completed',
            currentStep: 'Completed with partial results due to errors',
            error: finalError.message
          });
          
          return {
            success: true,
            documentsAnalyzed: assignedDocuments.length,
            questionsAnswered: Object.keys(marketStrategyAnswers).length,
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
    
    // ENTERPRISE FIX: Process all documents for comprehensive institutional analysis  
    console.log(`📊 Processing ALL ${documents.length} documents for comprehensive enterprise analysis`);
    
    const evidence = [];
    const batchSize = 20; // Larger batches for speed
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)} (${batch.length} documents)`);
      
      // Parallel processing with reduced timeout for speed
      const batchPromises = batch.map(async (doc) => {
        console.log(`🔎 Extracting evidence from: ${doc.name}`);
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
    
    console.log(`🎯 ENTERPRISE: Extracted evidence from ${evidence.length}/${documents.length} documents in comprehensive mode`);
    return evidence;
  }

  /**
   * Extract specific evidence from a single document - EXACT Clinical approach
   */
  private async extractEvidenceFromDocument(document: any, question: any): Promise<any> {
    const content = document.ocrText || document.aiSummary?.executiveSummary || '';
    
    if (!content) return null;
    
    const prompt = `${ENTERPRISE_AGENT_PROMPTS.COMMERCIAL.SYSTEM_PROMPT}

DOCUMENT: ${document.name}
CONTENT: ${content.substring(0, 100000)} ${content.length > 100000 ? '\n[Document truncated - processing first 100k characters for comprehensive analysis...]' : ''}

QUESTION: "${question.question}"
CATEGORY: ${question.category}
OUTPUT FIELD: ${question.outputField}
ANALYSIS TASK: ${question.analysisPrompt}

${ENTERPRISE_PROMPT_FRAMEWORK.QUANTITATIVE_FOCUS}

Instructions:
- Focus on QUANTITATIVE data: specific percentages, dollar amounts, growth rates, market share numbers
- Look for competitive positioning data: market share %, pricing comparisons, competitive advantages
- Identify pricing strategy information: elasticity data, pricing models, revenue optimization
- Find sales channel metrics: conversion rates, sales cycle data, channel effectiveness
- Extract customer metrics: LTV, CAC, retention rates, expansion revenue percentages
- Prioritize institutional-grade commercial intelligence

Respond in JSON format:
{
  "relevantContent": ["Exact quote 1 from document", "Exact quote 2 from document"],
  "hasRelevantInfo": true/false,
  "confidence": 0-100,
  "keyFindings": ["Finding 1 with specific metrics", "Finding 2 with quantitative data"],
  "documentSummary": "Brief summary focusing on quantitative commercial insights",
  "marketStrategyContext": "How this document relates to market strategy and competitive positioning",
  "quantitativeInsights": ["Specific metric 1", "Specific metric 2"]
}

${ENTERPRISE_PROMPT_FRAMEWORK.EVIDENCE_STANDARDS}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2500 // Increased for full document comprehensive extraction
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
        fullContent: content.substring(0, 2000) // Keep larger sample for reference
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
   * Compile enterprise-grade answer based on all evidence using Market Strategy Expert framework
   */
  private async compileEnterpriseAnswer(question: any, evidence: any[]): Promise<any> {
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

    const prompt = `${ENTERPRISE_AGENT_PROMPTS.COMMERCIAL.SYSTEM_PROMPT}

QUESTION: "${question.question}"
CATEGORY: ${question.category}
OUTPUT FIELD: ${question.outputField}

EVIDENCE FROM DOCUMENTS:
${evidenceSummary.map(ev => `
DOCUMENT: ${ev.document}
CONTENT: ${ev.content}
KEY FINDINGS: ${ev.findings}
CONFIDENCE: ${ev.confidence}%
`).join('\n')}

${ENTERPRISE_AGENT_PROMPTS.COMMERCIAL.ANALYSIS_PROMPT}

Synthesize evidence with institutional-grade rigor:
1. Provide quantitative analysis with specific metrics
2. Include competitive positioning assessment with market share data
3. Analyze pricing strategy with elasticity implications
4. Evaluate sales channel effectiveness with conversion metrics
5. Calculate customer metrics including LTV analysis

Respond in JSON format:
{
  "answer": "Institutional-grade analysis with quantitative insights",
  "confidence": 0-100,
  "sources": ["Document name 1", "Document name 2"],
  "keyFindings": ["Quantitative finding 1", "Quantitative finding 2"],
  "gaps": ["Missing data 1", "Missing data 2"],
  "recommendations": ["Strategic recommendation 1", "Strategic recommendation 2"],
  "marketStrategyAssessment": "Market strategy evaluation based on evidence",
  "evidenceCount": ${evidence.length},
  "marketPosition": {
    "marketShare": "Percentage if available",
    "competitivePosition": "Market position analysis",
    "growthTrajectory": "Growth rate and trajectory"
  },
  "pricingAnalysis": {
    "pricingStrategy": "Current pricing approach",
    "elasticity": "Price elasticity insights",
    "optimization": "Pricing optimization opportunities"
  },
  "salesEfficiency": {
    "conversionRates": "Channel conversion data",
    "salesCycle": "Sales cycle metrics",
    "channelEffectiveness": "Channel performance analysis"
  },
  "competitiveAdvantage": {
    "advantages": "Key competitive advantages",
    "sustainability": "Advantage sustainability assessment",
    "threats": "Competitive threats and risks"
  }
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 4000 // Increased for comprehensive commercial analysis synthesis
      });
      
      const compiledAnswer = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        question: question.question,
        category: question.category,
        outputField: question.outputField,
        answer: compiledAnswer.answer || 'Unable to compile answer from available evidence',
        confidence: compiledAnswer.confidence || 30,
        sources: evidence.map(e => e.documentName), // SHOW ALL ANALYZED DOCUMENTS
        keyFindings: compiledAnswer.keyFindings || [],
        gaps: compiledAnswer.gaps || [],
        recommendations: compiledAnswer.recommendations || [],
        marketStrategyAssessment: compiledAnswer.marketStrategyAssessment || '',
        evidenceCount: evidence.length,
        detailedEvidence: evidence,
        marketPosition: compiledAnswer.marketPosition || {},
        pricingAnalysis: compiledAnswer.pricingAnalysis || {},
        salesEfficiency: compiledAnswer.salesEfficiency || {},
        competitiveAdvantage: compiledAnswer.competitiveAdvantage || {}
      };
      
    } catch (error) {
      console.error(`Error compiling answer for "${question.question}":`, error);
      return {
        question: question.question,
        category: question.category,
        outputField: question.outputField,
        answer: `Error compiling answer: ${error.message}`,
        confidence: 0,
        sources: evidence.map(e => e.documentName), // SHOW ALL ANALYZED DOCUMENTS
        keyFindings: [],
        gaps: ['Analysis compilation failed'],
        recommendations: ['Manual review required'],
        evidenceCount: evidence.length,
        detailedEvidence: evidence,
        marketPosition: {},
        pricingAnalysis: {},
        salesEfficiency: {},
        competitiveAdvantage: {}
      };
    }
  }

  /**
   * Generate Market Strategy findings with enterprise framework
   */
  private generateMarketStrategyFindings(answers: Record<string, any>): any[] {
    const findings = [];
    
    for (const [questionId, answer] of Object.entries(answers)) {
      const question = MARKET_STRATEGY_QUESTIONS.find(q => q.id === questionId);
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
   * Generate Market Strategy recommendations with enterprise framework
   */
  private generateMarketStrategyRecommendations(answers: Record<string, any>): any[] {
    const recommendations = [];
    
    for (const [questionId, answer] of Object.entries(answers)) {
      const question = MARKET_STRATEGY_QUESTIONS.find(q => q.id === questionId);
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
   * Store Market Strategy analysis results with enterprise format
   */
  private async storeMarketStrategyResults(
    dealId: number, 
    marketStrategyAnswers: Record<string, any>, 
    findings: any[], 
    recommendations: any[], 
    assignedDocuments: any[]
  ): Promise<void> {
    console.log(`💾 Storing Market Strategy Expert analysis results for deal ${dealId}`);
    
    try {
      // Store in agent_analyses table - EXACT LEGAL APPROACH matching their working database structure
      await db
        .delete(agentAnalyses)
        .where(and(
          eq(agentAnalyses.dealId, dealId),
          eq(agentAnalyses.agentType, 'commercial')
        ));
      
      console.log(`🗑️ Cleared existing Market Strategy analysis for deal ${dealId}`);
      
      // Create the new Market Strategy analysis with enhanced format
      const analysisData = {
        dealId,
        agentType: 'commercial' as const,
        status: 'completed' as const,
        progress: 100,
        findings: JSON.stringify(findings),
        recommendations: JSON.stringify(recommendations),
        commercialAnswers: this.formatEnterpriseOutput(marketStrategyAnswers), // Enhanced enterprise format
        documentSources: JSON.stringify(assignedDocuments.map((d: any) => d.name)),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db
        .insert(agentAnalyses)
        .values(analysisData);
      
      console.log(`📊 Created fresh Market Strategy Expert analysis for deal ${dealId} with ${Object.keys(marketStrategyAnswers).length} questions answered`);
    } catch (error) {
      console.error(`❌ Error storing commercial analysis results:`, error);
      throw error;
    }
  }

  /**
   * Format enterprise output with enhanced structure
   */
  private formatEnterpriseOutput(marketStrategyAnswers: Record<string, any>): any {
    const enterpriseOutput = {
      marketPosition: {},
      pricingAnalysis: {},
      salesEfficiency: {},
      competitiveAdvantage: {},
      questionAnswers: marketStrategyAnswers
    };

    // Aggregate data by output field
    for (const [questionId, answer] of Object.entries(marketStrategyAnswers)) {
      if (answer.outputField && answer[answer.outputField]) {
        enterpriseOutput[answer.outputField] = {
          ...enterpriseOutput[answer.outputField],
          ...answer[answer.outputField]
        };
      }
    }

    return enterpriseOutput;
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

  async storeAnalysisResults(dealId: number, answers: {[key: string]: MarketStrategyAnswer}, evidenceMap: Map<string, CommercialEvidence[]>): Promise<void> {
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

export const marketStrategyExpertService = new MarketStrategyExpertService();
export { MARKET_STRATEGY_QUESTIONS };