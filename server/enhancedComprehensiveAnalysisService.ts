/**
 * Enhanced Comprehensive Analysis Service
 * Provides deep, evidence-based analysis with proper source attribution
 * Each question is analyzed across ALL assigned documents with detailed quotes and references
 */

import { db } from './db';
import { documents, agentAnalyses } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { storage } from './storage';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface DocumentEvidence {
  documentId: number;
  documentName: string;
  relevantQuotes: string[];
  keyFindings: string[];
  confidence: number;
  pageReferences: string[];
  analysis: string;
  fullContent: string;
}

interface ComprehensiveAnswer {
  question: string;
  category: string;
  answer: string;
  confidence: number;
  sources: string[];
  evidence: DocumentEvidence[];
  keyFindings: string[];
  recommendations: string[];
  gaps: string[];
  crossReferences: string[];
}

export class EnhancedComprehensiveAnalysisService {
  private agentType: string;
  private questions: any[];
  private jobId: string = '';

  constructor(agentType: string, questions: any[]) {
    this.agentType = agentType;
    this.questions = questions;
  }

  /**
   * Run enhanced comprehensive analysis for a deal
   */
  async runEnhancedAnalysis(dealId: number): Promise<void> {
    console.log(`🔬 Starting enhanced ${this.agentType} analysis for deal ${dealId}`);
    
    // Create background job for tracking using unified pattern with timestamp for uniqueness
    const timestamp = Date.now();
    this.jobId = `${this.agentType.toLowerCase()}-analysis-${dealId}-${timestamp}`;
    
    // Check for existing ACTIVE jobs to prevent duplicates
    const existingJobs = await storage.getBackgroundJobsByDealId(dealId);
    const activeJob = existingJobs.find(job => 
      job.agentType && job.agentType.toLowerCase() === this.agentType.toLowerCase() && 
      (job.status === 'processing' || job.status === 'pending')
    );
    
    if (activeJob) {
      console.log(`🔄 Found existing active ${this.agentType} analysis job: ${activeJob.jobId}, skipping duplicate creation`);
      throw new Error(`${this.agentType} analysis already running for deal ${dealId}`);
    }
    
    // Clear any completed jobs for this agent to allow fresh restart
    const completedJob = existingJobs.find(job => 
      job.agentType && job.agentType.toLowerCase() === this.agentType.toLowerCase() && 
      (job.status === 'completed' || job.status === 'failed')
    );
    
    if (completedJob) {
      console.log(`🧹 Clearing previous ${this.agentType} analysis job: ${completedJob.jobId} (status: ${completedJob.status})`);
      await storage.updateBackgroundJob(completedJob.jobId, {
        status: 'cancelled',
        updatedAt: new Date()
      });
    }
    
    await storage.createBackgroundJob({
      jobId: this.jobId,
      dealId,
      jobType: 'agent_analysis',
      agentType: this.agentType.toLowerCase(),
      status: 'processing',
      progress: 1,
      currentStep: `Starting enhanced ${this.agentType} analysis`
    });

    try {
      // Step 1: Get all assigned documents
      await this.updateProgress(2, 'Finding assigned documents');
      const assignedDocuments = await this.getAssignedDocuments(dealId);
      console.log(`📄 Found ${assignedDocuments.length} documents assigned to ${this.agentType}`);

      if (assignedDocuments.length === 0) {
        console.log(`⚠️ No documents assigned to ${this.agentType} agent - completing with empty results`);
        await this.storeEmptyResults(dealId);
        await this.updateProgress(100, 'Analysis completed - no documents to analyze', 'completed');
        return;
      }

      // Step 2: Analyze each question across ALL assigned documents
      const comprehensiveAnswers: Record<string, ComprehensiveAnswer> = {};
      const totalQuestions = this.questions.length;
      
      for (let i = 0; i < totalQuestions; i++) {
        const question = this.questions[i];
        // Progress from 3% to 85% across all questions
        const progressPercent = Math.floor(3 + ((i / totalQuestions) * 82));
        
        await this.updateProgress(progressPercent, `Analyzing: ${question.question}`);
        console.log(`🔍 Question ${i + 1}/${totalQuestions}: ${question.question}`);

        try {
          // Extract evidence from ALL assigned documents for this specific question
          const documentEvidence = await this.extractComprehensiveEvidence(
            assignedDocuments, 
            question
          );

          // Compile comprehensive answer using cross-document analysis
          const answer = await this.compileEnhancedAnswer(question, documentEvidence);
          comprehensiveAnswers[question.id] = answer;

          console.log(`✅ Completed question ${i + 1}/${totalQuestions} with ${documentEvidence.length} evidence pieces`);
        } catch (error) {
          console.error(`❌ Error processing question ${i + 1}: ${error}`);
          // Continue with empty answer instead of getting stuck
          comprehensiveAnswers[question.id] = {
            question: question.question,
            category: question.category,
            answer: 'Analysis temporarily unavailable due to processing error.',
            confidence: 10,
            sources: [],
            evidence: [],
            keyFindings: [],
            recommendations: [],
            gaps: [`Processing error for: ${question.question}`],
            crossReferences: []
          };
        }
        
        // Small delay to allow progress updates to be visible (reduced from 3000ms)
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Step 3: Generate cross-analysis insights
      await this.updateProgress(86, 'Generating comprehensive insights');
      const insights = await this.generateCrossAnalysisInsights(comprehensiveAnswers);

      // Step 4: Store enhanced results
      await this.updateProgress(95, 'Storing enhanced analysis results');
      await this.storeEnhancedResults(dealId, comprehensiveAnswers, insights, assignedDocuments);

      // Complete
      await this.updateProgress(100, 'Enhanced analysis completed', 'completed');
      console.log(`✅ Enhanced ${this.agentType} analysis completed for deal ${dealId}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error in enhanced ${this.agentType} analysis:`, error);
      await storage.updateBackgroundJob(this.jobId, {
        status: 'failed',
        error: errorMessage
      });
      throw error;
    }
  }

  /**
   * Get documents assigned to this agent
   */
  private async getAssignedDocuments(dealId: number): Promise<any[]> {
    const allDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, dealId));

    // Filter documents assigned to this agent (case-insensitive matching)
    const agentTypeLower = this.agentType.toLowerCase();
    const assignedDocs = allDocuments.filter(doc => 
      doc.assignedAgents && 
      doc.assignedAgents.some((agent: string) => agent.toLowerCase() === agentTypeLower) &&
      (doc.ocrText || doc.aiSummary)
    );

    console.log(`📄 Found ${assignedDocs.length} documents explicitly assigned to ${this.agentType}`);
    return assignedDocs;
  }

  /**
   * Extract comprehensive evidence from all documents for a specific question
   */
  private async extractComprehensiveEvidence(
    documents: any[], 
    question: any
  ): Promise<DocumentEvidence[]> {
    console.log(`🔎 Extracting evidence for: ${question.question}`);
    const evidence: DocumentEvidence[] = [];
    
    // Process documents in batches to manage API rate limits and prevent timeouts
    const batchSize = 3; // Reduced batch size for faster processing
    const maxDocuments = Math.min(documents.length, 50); // Limit to 50 documents for research analysis to prevent timeout
    const documentsToProcess = documents.slice(0, maxDocuments);
    
    for (let i = 0; i < documentsToProcess.length; i += batchSize) {
      const batch = documentsToProcess.slice(i, i + batchSize);
      console.log(`🔎 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documentsToProcess.length / batchSize)} (${i + 1}-${Math.min(i + batchSize, documentsToProcess.length)} of ${documentsToProcess.length})`);
      
      // Update progress during processing
      const progress = Math.round(((i + batchSize) / documentsToProcess.length) * 85); // Leave 15% for synthesis
      await this.updateProgress(progress, `Processing batch ${Math.floor(i / batchSize) + 1}`, 'processing');
      
      // Process each document with timeout and error handling
      const batchPromises = batch.map(doc => 
        this.extractEvidenceFromDocumentWithTimeout(doc, question, 10000) // 10 second timeout
      );
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Filter valid evidence from settled promises
      const validEvidence = batchResults
        .filter((result): result is PromiseFulfilledResult<DocumentEvidence> => 
          result.status === 'fulfilled' && 
          result.value !== null && 
          result.value.relevantQuotes.length > 0
        )
        .map(result => result.value);
      evidence.push(...validEvidence);
      
      console.log(`✅ Batch completed: ${validEvidence.length}/${batch.length} documents had relevant evidence`);
      
      // Add small delay between batches to prevent rate limiting
      if (i + batchSize < documentsToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`📋 Total evidence pieces extracted: ${evidence.length} from ${documents.length} documents`);
    return evidence;
  }

  /**
   * Extract evidence from document with timeout protection
   */
  private async extractEvidenceFromDocumentWithTimeout(
    document: any, 
    question: any, 
    timeoutMs: number = 10000
  ): Promise<DocumentEvidence | null> {
    return Promise.race([
      this.extractEvidenceFromDocument(document, question),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      )
    ]).catch(error => {
      console.warn(`⚠️ Evidence extraction failed for ${document.name}: ${error.message}`);
      return null;
    });
  }

  /**
   * Extract detailed evidence from a single document
   */
  private async extractEvidenceFromDocument(document: any, question: any): Promise<DocumentEvidence | null> {
    // Use full OCR text or AI summary for analysis
    const content = document.ocrText || document.aiSummary?.executiveSummary || '';
    
    if (!content || content.length < 50) return null;

    // Use more content for better analysis (up to 8000 characters instead of 4000)
    const analysisContent = content.substring(0, 8000);
    
    const prompt = `You are an expert ${this.agentType.toLowerCase()} analyst conducting comprehensive due diligence analysis. 

DOCUMENT: "${document.name}"
CONTENT: ${analysisContent}

QUESTION: "${question.question}"
CATEGORY: ${question.category}

Your task:
1. Find ALL relevant information in this document that relates to the question
2. Extract specific quotes that directly answer or relate to the question
3. Identify key findings and insights
4. Provide detailed analysis of how this document addresses the question
5. Look for both direct answers and indirect/contextual information

Instructions:
- Extract verbatim quotes (minimum 3-5 quotes if relevant content exists)
- Identify specific findings and data points
- Note any page numbers, sections, or references mentioned
- Provide confidence score based on relevance and clarity
- Consider both explicit information and implicit business context

Respond in JSON format:
{
  "relevantQuotes": ["Exact quote 1 from document", "Exact quote 2", "Exact quote 3"],
  "keyFindings": ["Specific finding 1", "Specific finding 2"],
  "confidence": 0-100,
  "pageReferences": ["Page 5", "Section 2.3"],
  "analysis": "Detailed analysis of how this document addresses the question",
  "hasRelevantInfo": true/false
}

Be thorough - extract ALL relevant information, not just the most obvious points.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2000
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      if (!analysis.hasRelevantInfo) return null;

      return {
        documentId: document.id,
        documentName: document.name,
        relevantQuotes: analysis.relevantQuotes || [],
        keyFindings: analysis.keyFindings || [],
        confidence: analysis.confidence || 0,
        pageReferences: analysis.pageReferences || [],
        analysis: analysis.analysis || '',
        fullContent: analysisContent
      };

    } catch (error) {
      console.error(`Error extracting evidence from ${document.name}:`, error);
      return null;
    }
  }

  /**
   * Compile enhanced answer using cross-document analysis
   */
  private async compileEnhancedAnswer(
    question: any, 
    evidence: DocumentEvidence[]
  ): Promise<ComprehensiveAnswer> {
    console.log(`🔍 Compiling enhanced answer for: ${question.question}`);
    console.log(`📋 Evidence from ${evidence.length} documents`);

    if (evidence.length === 0) {
      return {
        question: question.question,
        category: question.category,
        answer: `No relevant information found in the assigned ${this.agentType.toLowerCase()} documents for this question.`,
        confidence: 5,
        sources: [],
        evidence: [],
        keyFindings: [],
        recommendations: [`Obtain additional documentation related to ${question.category.toLowerCase()}`],
        gaps: [`No information available for: ${question.question}`],
        crossReferences: []
      };
    }

    // Sort evidence by confidence
    const sortedEvidence = evidence.sort((a, b) => b.confidence - a.confidence);
    
    const prompt = `You are a senior ${this.agentType.toLowerCase()} analyst compiling a comprehensive answer based on evidence from multiple documents.

QUESTION: ${question.question}
CATEGORY: ${question.category}

EVIDENCE FROM DOCUMENTS:
${sortedEvidence.map((ev, idx) => `
Document ${idx + 1}: ${ev.documentName}
Analysis: ${ev.analysis}
Key Findings: ${ev.keyFindings.join('; ')}
Relevant Quotes: ${ev.relevantQuotes.join(' | ')}
Page References: ${ev.pageReferences.join(', ')}
Confidence: ${ev.confidence}%
`).join('\n')}

Your task:
1. Synthesize ALL evidence into a comprehensive, detailed answer
2. Provide specific document references and quotes
3. Identify patterns and insights across documents
4. Note any contradictions or gaps
5. Make specific recommendations based on findings

Create a thorough analysis that:
- Directly answers the question using all available evidence
- Shows specific sources for each claim
- Provides actionable insights
- Identifies areas needing further investigation

Respond in JSON format:
{
  "answer": "Comprehensive, detailed answer synthesizing all evidence",
  "confidence": 0-100,
  "keyFindings": ["Key finding 1 with source", "Key finding 2 with source"],
  "recommendations": ["Specific recommendation 1", "Specific recommendation 2"],
  "gaps": ["Information gap 1", "Information gap 2"],
  "crossReferences": ["Connection between doc A and doc B", "Pattern across documents"]
}

Provide a thorough analysis with specific source attribution.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 3000
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');

      return {
        question: question.question,
        category: question.category,
        answer: analysis.answer || 'Unable to compile comprehensive answer',
        confidence: analysis.confidence || 50,
        sources: sortedEvidence.map(e => e.documentName),
        evidence: sortedEvidence,
        keyFindings: analysis.keyFindings || [],
        recommendations: analysis.recommendations || [],
        gaps: analysis.gaps || [],
        crossReferences: analysis.crossReferences || []
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error compiling answer for ${question.id}:`, error);
      return {
        question: question.question,
        category: question.category,
        answer: `Analysis temporarily unavailable: ${errorMessage}`,
        confidence: 10,
        sources: sortedEvidence.map(e => e.documentName),
        evidence: sortedEvidence,
        keyFindings: [],
        recommendations: [],
        gaps: [`Analysis error for: ${question.question}`],
        crossReferences: []
      };
    }
  }

  /**
   * Generate cross-analysis insights
   */
  private async generateCrossAnalysisInsights(answers: Record<string, ComprehensiveAnswer>): Promise<any> {
    const allFindings = Object.values(answers).flatMap(a => a.keyFindings);
    const allRecommendations = Object.values(answers).flatMap(a => a.recommendations);
    const allGaps = Object.values(answers).flatMap(a => a.gaps);
    
    return {
      overallConfidence: Math.round(
        Object.values(answers).reduce((sum, a) => sum + a.confidence, 0) / 
        Object.values(answers).length
      ),
      totalQuestions: Object.keys(answers).length,
      questionsWithEvidence: Object.values(answers).filter(a => a.evidence.length > 0).length,
      keyInsights: allFindings.slice(0, 10),
      criticalRecommendations: allRecommendations.slice(0, 5),
      informationGaps: allGaps.slice(0, 5)
    };
  }

  /**
   * Store enhanced results
   */
  private async storeEnhancedResults(
    dealId: number, 
    answers: Record<string, ComprehensiveAnswer>,
    insights: any,
    documents: any[]
  ): Promise<void> {
    const analysisData = {
      agentType: this.agentType.toLowerCase(),
      questions: answers,
      insights,
      metadata: {
        documentsAnalyzed: documents.length,
        questionsAnswered: Object.keys(answers).length,
        totalEvidence: Object.values(answers).reduce((sum, a) => sum + a.evidence.length, 0),
        analysisDate: new Date().toISOString(),
        analysisVersion: 'enhanced_v2'
      }
    };

    // Find existing agent analysis record to update
    const existingAnalysis = await storage.getAgentAnalysis(dealId, this.agentType.toLowerCase());
    
    if (existingAnalysis) {
      // Update existing record with research answers
      const updateData: any = {
        status: 'Completed',
        updatedAt: new Date()
      };
      
      // Set the correct answers field based on agent type
      if (this.agentType.toLowerCase() === 'research') {
        updateData.research_answers = JSON.stringify(answers);
      } else if (this.agentType.toLowerCase() === 'clinical') {
        updateData.clinicalAnswers = JSON.stringify(answers);
      } else if (this.agentType.toLowerCase() === 'legal') {
        updateData.legalAnswers = JSON.stringify(answers);
      } else if (this.agentType.toLowerCase() === 'commercial') {
        updateData.commercialAnswers = JSON.stringify(answers);
      } else if (this.agentType.toLowerCase() === 'financial') {
        updateData.financial_answers = JSON.stringify(answers);
      } else if (this.agentType.toLowerCase() === 'hr') {
        updateData.hr_answers = JSON.stringify(answers);
      } else if (this.agentType.toLowerCase() === 'ip') {
        updateData.ip_answers = JSON.stringify(answers);
      }
      
      // Get the ID from existing analysis record
      const analysisRecord = await storage.getAgentAnalysisByDealAndType(dealId, this.agentType.toLowerCase());
      if (analysisRecord && analysisRecord.id) {
        await storage.updateAgentAnalysis(analysisRecord.id, updateData);
        console.log(`💾 Updated enhanced ${this.agentType} analysis results for deal ${dealId} (ID: ${analysisRecord.id})`);
      } else {
        console.error(`❌ Could not find analysis ID for deal ${dealId}, agent ${this.agentType}`);
      }
    } else {
      // Create new record if none exists  
      await storage.createAgentAnalysis({
        dealId,
        agentType: this.agentType.toLowerCase(),
        status: 'Completed'
      });
      console.log(`💾 Created new enhanced ${this.agentType} analysis results for deal ${dealId}`);
    }
  }

  /**
   * Store empty results when no documents are available
   */
  private async storeEmptyResults(dealId: number): Promise<void> {
    const emptyAnalysisData = {
      agentType: this.agentType.toLowerCase(),
      questions: {},
      insights: {
        overallConfidence: 0,
        totalQuestions: this.questions.length,
        questionsWithEvidence: 0,
        keyInsights: [],
        criticalRecommendations: [`No documents available for ${this.agentType} analysis`],
        informationGaps: [`${this.agentType} analysis requires document upload`]
      },
      metadata: {
        documentsAnalyzed: 0,
        questionsAnswered: 0,
        totalEvidence: 0,
        analysisDate: new Date().toISOString(),
        analysisVersion: 'enhanced_v2',
        reason: 'no_documents'
      }
    };

    // Store empty results in agent_analyses table
    await storage.createAgentAnalysis({
      dealId,
      agentType: this.agentType.toLowerCase(),
      status: 'Completed'
    });

    console.log(`💾 Stored empty ${this.agentType} analysis results for deal ${dealId} (no documents)`);
  }

  /**
   * Update progress
   */
  private async updateProgress(
    progress: number, 
    currentStep: string, 
    status: string = 'processing'
  ): Promise<void> {
    try {
      await storage.updateBackgroundJob(this.jobId, {
        progress,
        currentStep,
        status
      });
    } catch (error) {
      console.warn(`⚠️ Failed to update progress for job ${this.jobId}:`, error);
    }
  }
}

/**
 * Main export function to start enhanced comprehensive analysis
 */
export async function startEnhancedComprehensiveAnalysis(dealId: number, agentType: string): Promise<void> {
  console.log(`🚀 Starting enhanced comprehensive analysis for ${agentType} agent on deal ${dealId}`);
  
  // Get questions for the specific agent type
  const questions = await getAgentQuestions(agentType);
  
  // Create and run the enhanced analysis service
  const analysisService = new EnhancedComprehensiveAnalysisService(agentType, questions);
  await analysisService.runEnhancedAnalysis(dealId);
}

/**
 * Get questions for specific agent type
 */
async function getAgentQuestions(agentType: string): Promise<any[]> {
  // Generate questions based on agent type
  switch (agentType.toLowerCase()) {
    case 'clinical':
      return [
        { id: 'cli_1', question: 'What clinical evidence supports the efficacy of this intervention?', category: 'Evidence' },
        { id: 'cli_2', question: 'What are the regulatory pathways and requirements?', category: 'Regulatory' },
        { id: 'cli_3', question: 'What safety concerns or adverse events are documented?', category: 'Safety' },
        { id: 'cli_4', question: 'What is the clinical trial design and methodology?', category: 'Design' },
        { id: 'cli_5', question: 'What are the competitive clinical advantages?', category: 'Competitive' }
      ];
    case 'legal':
      return [
        { id: 'leg_1', question: 'What legal risks and liabilities are present?', category: 'Risk' },
        { id: 'leg_2', question: 'What is the corporate structure and governance?', category: 'Structure' },
        { id: 'leg_3', question: 'What contracts and agreements are in place?', category: 'Contracts' },
        { id: 'leg_4', question: 'What intellectual property protections exist?', category: 'IP' },
        { id: 'leg_5', question: 'What regulatory compliance issues are present?', category: 'Compliance' }
      ];
    case 'commercial':
      return [
        { id: 'com_1', question: 'What is the market size and opportunity?', category: 'Market' },
        { id: 'com_2', question: 'What is the competitive landscape and positioning?', category: 'Competition' },
        { id: 'com_3', question: 'What is the go-to-market strategy?', category: 'Strategy' },
        { id: 'com_4', question: 'What are the revenue model and pricing strategy?', category: 'Revenue' },
        { id: 'com_5', question: 'What are the customer acquisition and retention metrics?', category: 'Customers' }
      ];
    case 'hr':
      return [
        { id: 'hr_1', question: 'What is the quality and experience of the management team?', category: 'Leadership' },
        { id: 'hr_2', question: 'What key employee retention risks exist?', category: 'Retention' },
        { id: 'hr_3', question: 'What compensation and equity structures are in place?', category: 'Compensation' },
        { id: 'hr_4', question: 'What organizational culture and values are present?', category: 'Culture' },
        { id: 'hr_5', question: 'What hiring plans and talent acquisition strategies exist?', category: 'Talent' }
      ];
    case 'financial':
      return [
        { id: 'fin_1', question: 'What is the financial performance and projections?', category: 'Performance' },
        { id: 'fin_2', question: 'What are the burn rate and cash runway?', category: 'Cash' },
        { id: 'fin_3', question: 'What are the unit economics and scalability?', category: 'Economics' },
        { id: 'fin_4', question: 'What debt obligations and financial commitments exist?', category: 'Obligations' },
        { id: 'fin_5', question: 'What are the funding history and investor relations?', category: 'Funding' }
      ];
    case 'ip':
      return [
        { id: 'ip_1', question: 'What patents and patent applications exist?', category: 'Patents' },
        { id: 'ip_2', question: 'What IP ownership and assignment clarity exists?', category: 'Ownership' },
        { id: 'ip_3', question: 'What freedom to operate analysis has been conducted?', category: 'Freedom' },
        { id: 'ip_4', question: 'What licensing agreements and IP partnerships exist?', category: 'Licensing' },
        { id: 'ip_5', question: 'What IP litigation risks and disputes are present?', category: 'Litigation' }
      ];
    case 'research':
      return [
        // Technical Methodology
        { id: 'res_1', question: 'What research methodology and scientific approach is used?', category: 'Technical Methodology' },
        { id: 'res_4', question: 'What data quality and validation has been performed?', category: 'Technical Methodology' },
        
        // Academic Publications  
        { id: 'res_2', question: 'What peer-reviewed publications and citations exist?', category: 'Academic Publications' },
        { id: 'res_3', question: 'What research partnerships and collaborations are present?', category: 'Academic Publications' },
        { id: 'res_6', question: 'Are there citations in high-impact journals (Nature, Science, Cell)?', category: 'Academic Publications' },
        { id: 'res_7', question: 'What is the h-index and citation count of key publications?', category: 'Academic Publications' },
        { id: 'res_8', question: 'Are there collaborations with leading academic institutions?', category: 'Academic Publications' },
        
        // Technical Innovation
        { id: 'res_5', question: 'What research competitive advantages exist?', category: 'Technical Innovation' },
        
        // Market Research
        { id: 'res_9', question: 'What is the total addressable market (TAM) size?', category: 'Market Research' },
        { id: 'res_10', question: 'Who are the main competitors and what is their market share?', category: 'Market Research' },
        { id: 'res_11', question: 'What are the market growth projections and key drivers?', category: 'Market Research' },
        
        // Patent Landscape
        { id: 'res_12', question: 'What is the freedom-to-operate (FTO) analysis result?', category: 'Patent Landscape' },
        { id: 'res_13', question: 'Are there any patent disputes or prior art challenges?', category: 'Patent Landscape' }
      ];
    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
}