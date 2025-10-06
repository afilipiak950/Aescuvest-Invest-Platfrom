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
          
          // Extract evidence from ALL documents for this question - EXACT Clinical approach
          const documentEvidence = await this.extractEvidenceFromAllDocuments(
            assignedDocuments, // Process ALL documents with AI summaries
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
   * Extract evidence from ALL documents for a specific question - BATCH PROCESSING
   * Processes documents in batches of 10 to avoid overwhelming the system
   * EXACT MATCH to Legal/Clinical approach
   */
  private async extractEvidenceFromAllDocuments(
    documents: any[], 
    question: any
  ): Promise<any[]> {
    console.log(`📄 Starting evidence extraction from ${documents.length} documents for: ${question.question}`);
    
    // Process documents in batches to avoid overwhelming the system
    const batchSize = 10;
    const evidence = [];
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)} (${batch.length} documents)`);
      
      const batchResults = await Promise.all(
        batch.map(async (doc) => {
          console.log(`🔎 Extracting commercial evidence from: ${doc.name}`);
          return this.extractEvidenceFromDocument(doc, question);
        })
      );
      
      // Filter out null results and add to evidence
      const validEvidence = batchResults.filter(docEvidence => 
        docEvidence && docEvidence.relevantContent.length > 0
      );
      evidence.push(...validEvidence);
      
      console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} completed: ${validEvidence.length}/${batch.length} documents had relevant commercial evidence`);
    }
    
    console.log(`📋 Extracted commercial evidence from ${evidence.length}/${documents.length} documents`);
    return evidence;
  }

  /**
   * Extract specific commercial evidence from a single document
   * Makes ONE API call per document to extract relevant commercial information
   * Uses AI summaries ONLY - handles both string and object formats
   */
  private async extractEvidenceFromDocument(document: any, question: any): Promise<any> {
    // Use ONLY AI summary - handle BOTH string and object formats
    const aiSummary = document.aiSummary;
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
    
    const prompt = `You are an expert commercial due diligence analyst conducting comprehensive investment analysis. Your task is to EXHAUSTIVELY EXTRACT ALL SPECIFIC COMMERCIAL DETAILS from this document.

DOCUMENT: ${document.name}
AI SUMMARY (COMPLETE): ${content}

QUESTION: "${question.question}"
CATEGORY: ${question.category}

CRITICAL EXTRACTION REQUIREMENTS - YOU MUST EXTRACT EVERY DETAIL:

1. EXTRACT SPECIFIC COMMERCIAL DATA:
   - Pricing models (e.g., "Usage-based pricing at $0.50/unit", "Tiered pricing: $999/month starter")
   - Sales metrics (e.g., "Q4 revenue $2.3M", "150 customers acquired", "Win rate 35%")
   - Customer data (e.g., "Top 10 customers represent 60% revenue", "Churn rate 5% annually")
   - Competitive positioning (e.g., "20% market share in SMB segment", "3x cheaper than CompetitorX")
   - Market data (e.g., "TAM $5B growing 25% YoY", "60% market penetration in region")

2. EXTRACT SALES & PIPELINE DETAILS:
   - Sales cycle length (e.g., "Average sales cycle 90 days", "Enterprise deals: 180 days")
   - Conversion rates (e.g., "Demo-to-close rate 25%", "Trial conversion 15%")
   - Deal sizes (e.g., "Average deal size $50K", "Enterprise deals $200K+")
   - Pipeline metrics (e.g., "$10M in qualified pipeline", "120 active opportunities")

3. EXTRACT GROWTH & RETENTION METRICS:
   - Revenue growth (e.g., "150% YoY revenue growth", "MRR grew from $500K to $1.2M")
   - Customer retention (e.g., "NRR 120%", "Gross retention 95%")
   - Expansion revenue (e.g., "40% of revenue from upsells", "Average expansion 35%")

4. DO NOT PARAPHRASE - COPY VERBATIM:
   - If the summary says "Win rate 35%", copy it EXACTLY
   - If it says "$2.3M ARR", copy it EXACTLY
   - Do NOT convert to generic summaries like "strong sales" or "good growth"

5. EXTRACT EVERYTHING RELEVANT:
   - If this document mentions pricing, extract EVERY pricing detail
   - If it mentions customers, extract EVERY customer metric
   - If it mentions sales, extract EVERY sales data point
   - Include ALL numbers, percentages, dates, dollar amounts

Your relevantContent array should contain 5-20+ detailed extractions per document (not 1-2 generic quotes).

Respond in JSON format:
{
  "relevantContent": ["DETAILED commercial extraction 1 with specific metrics", "DETAILED extraction 2 with numbers", "DETAILED extraction 3...", ...],
  "hasRelevantInfo": true/false,
  "confidence": 0-100,
  "keyFindings": ["Specific commercial finding with data", "Specific finding with numbers", ...],
  "documentSummary": "COMPREHENSIVE breakdown of ALL relevant commercial information from this document",
  "commercialContext": "How this document relates to commercial aspects with SPECIFIC details"
}

REMEMBER: Extract EVERYTHING - more is better! A thorough extraction should be 500-2000+ characters per document.`;

    try {
      // Add 60-second timeout for OpenAI calls
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI API timeout after 60s')), 60000)
      );
      
      const apiPromise = openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 8000
      });
      
      const response = await Promise.race([apiPromise, timeoutPromise]) as any;
      
      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        documentName: document.name,
        documentId: document.id,
        relevantContent: analysis.relevantContent || [],
        hasRelevantInfo: analysis.hasRelevantInfo || false,
        confidence: analysis.confidence || 0,
        keyFindings: analysis.keyFindings || [],
        documentSummary: analysis.documentSummary || '',
        commercialContext: analysis.commercialContext || '',
        fullContent: content
      };
      
    } catch (error) {
      console.error(`Error extracting commercial evidence from ${document.name}:`, error);
      // Return partial data even on timeout - use AI summary directly
      return {
        documentName: document.name,
        documentId: document.id,
        relevantContent: [content.substring(0, 500)],
        hasRelevantInfo: true,
        confidence: 50,
        keyFindings: ['Partial analysis - timeout occurred'],
        documentSummary: 'Analysis timeout - using AI summary excerpt',
        commercialContext: 'Timeout occurred',
        fullContent: content || ''
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
        temperature: 0.2,
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
        commercialAnswers: JSON.stringify(commercialAnswers),
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
   * Re-run a single commercial question with full persistence
   * EXACT MATCH to Legal/Clinical rerun architecture
   */
  async rerunSingleQuestion(dealId: number, questionId: string): Promise<any> {
    console.log(`🔄 Re-running single commercial question ${questionId} for deal ${dealId}`);
    const jobId = `commercial-question-rerun-${dealId}-${questionId}`;
    
    // Check if already initialized by route (atomic registration pattern)
    const { backgroundJobs } = await import('../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const existingJob = await db.query.backgroundJobs.findFirst({
      where: eq(backgroundJobs.jobId, jobId)
    });
    const alreadyInitialized = existingJob !== undefined;
    
    // Only check for duplicates if not already initialized
    if (!alreadyInitialized && await this.isQuestionRunning(dealId, questionId)) {
      throw new Error(`Question ${questionId} is already being rerun`);
    }
    
    try {
      // Initialize progress only if not already set by route
      if (!alreadyInitialized) {
        await this.updateQuestionRerunProgress(dealId, questionId, 0);
      }
      
      // Find the question
      const question = COMMERCIAL_QUESTIONS.find(q => q.id === questionId);
      if (!question) {
        throw new Error(`Question ${questionId} not found`);
      }
      await this.updateQuestionRerunProgress(dealId, questionId, 10);
      
      // Get commercial documents
      const assignedDocuments = await this.getAssignedCommercialDocuments(dealId);
      console.log(`📄 Found ${assignedDocuments.length} documents for question re-run`);
      
      if (assignedDocuments.length === 0) {
        throw new Error('No documents available for commercial analysis');
      }
      await this.updateQuestionRerunProgress(dealId, questionId, 20);
      
      // Extract evidence for this specific question
      console.log(`📊 Extracting evidence for: ${question.question}`);
      await this.updateQuestionRerunProgress(dealId, questionId, 30);
      
      const documentEvidence = await this.extractEvidenceFromAllDocuments(
        assignedDocuments, 
        question
      );
      console.log(`📊 Evidence extraction completed: ${documentEvidence.length} pieces of evidence`);
      await this.updateQuestionRerunProgress(dealId, questionId, 60);
      
      // Compile answer
      console.log(`🤖 Compiling answer for: ${question.question}`);
      await this.updateQuestionRerunProgress(dealId, questionId, 70);
      
      const answer = await this.compileComprehensiveAnswer(question, documentEvidence);
      console.log(`✅ Answer compiled successfully`);
      await this.updateQuestionRerunProgress(dealId, questionId, 85);
      
      // Get existing analysis to update
      const existingAnalysis = await db.query.agentAnalyses.findFirst({
        where: and(
          eq(agentAnalyses.dealId, dealId),
          eq(agentAnalyses.agentType, 'commercial')
        )
      });
      
      if (existingAnalysis) {
        const commercialAnswers = existingAnalysis.commercialAnswers 
          ? JSON.parse(existingAnalysis.commercialAnswers as string)
          : {};
        
        commercialAnswers[questionId] = answer;
        
        await db
          .update(agentAnalyses)
          .set({
            commercialAnswers: JSON.stringify(commercialAnswers),
            updatedAt: new Date()
          })
          .where(eq(agentAnalyses.id, existingAnalysis.id));
        
        console.log(`✅ Updated commercial analysis with new answer for question ${questionId}`);
      } else {
        const commercialAnswers = { [questionId]: answer };
        await db.insert(agentAnalyses).values({
          dealId,
          agentType: 'commercial',
          status: 'completed',
          progress: 100,
          commercialAnswers: JSON.stringify(commercialAnswers),
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`✅ Created new commercial analysis with answer for question ${questionId}`);
      }
      
      await this.updateQuestionRerunProgress(dealId, questionId, 100);
      
      return {
        success: true,
        questionId,
        answer
      };
      
    } catch (error) {
      console.error(`❌ Failed to rerun commercial question ${questionId}:`, error);
      await this.updateQuestionRerunProgress(dealId, questionId, 100);
      throw error;
    }
  }

  /**
   * Check if a question is currently being rerun
   */
  async isQuestionRunning(dealId: number, questionId: string): Promise<boolean> {
    const jobId = `commercial-question-rerun-${dealId}-${questionId}`;
    const jobs = await storage.getBackgroundJobsByDealId(dealId);
    return jobs.some(job => 
      job.jobId === jobId && 
      job.status === 'processing' && 
      job.progress < 100
    );
  }

  /**
   * Update progress for a specific question rerun in database
   * EXACT MATCH to Legal implementation with proper persistence
   */
  async updateQuestionRerunProgress(dealId: number, questionId: string, progress: number): Promise<void> {
    const jobId = `commercial-question-rerun-${dealId}-${questionId}`;
    const { backgroundJobs } = await import('../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    // Check if job exists
    const existingJob = await db.query.backgroundJobs.findFirst({
      where: eq(backgroundJobs.jobId, jobId)
    });
    
    if (existingJob) {
      // Update existing job
      await db.update(backgroundJobs)
        .set({ 
          progress,
          status: progress === 100 ? 'completed' : (progress === 0 ? 'pending' : 'processing'),
          updatedAt: new Date(),
          completedAt: progress === 100 ? new Date() : null
        })
        .where(eq(backgroundJobs.jobId, jobId));
    } else {
      // Create new job with full database persistence
      await db.insert(backgroundJobs).values({
        jobId,
        jobType: 'commercial_question_rerun',
        dealId,
        status: progress === 0 ? 'pending' : 'processing',
        progress,
        runId: questionId,
        currentStep: `Rerunning commercial question: ${questionId}`
      });
    }
    
    console.log(`📊 Commercial Progress update (DB): ${questionId} = ${progress}%`);
  }

  /**
   * Get progress for a single question rerun from database
   */
  async getQuestionRerunProgress(dealId: number, questionId: string): Promise<number> {
    const jobId = `commercial-question-rerun-${dealId}-${questionId}`;
    const { backgroundJobs } = await import('../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const job = await db.query.backgroundJobs.findFirst({
      where: eq(backgroundJobs.jobId, jobId)
    });
    return job?.progress || 0;
  }

  /**
   * Get all active question progress for a deal from database
   * EXACT MATCH to Legal implementation
   */
  async getAllQuestionProgress(dealId: number): Promise<Record<string, number>> {
    const { backgroundJobs } = await import('../shared/schema');
    const { and, eq } = await import('drizzle-orm');
    
    const jobs = await db.query.backgroundJobs.findMany({
      where: and(
        eq(backgroundJobs.dealId, dealId),
        eq(backgroundJobs.jobType, 'commercial_question_rerun')
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