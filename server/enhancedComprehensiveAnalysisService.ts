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

  constructor(agentType: string, questions: any[]) {
    this.agentType = agentType;
    this.questions = questions;
  }

  /**
   * Run enhanced comprehensive analysis for a deal
   */
  async runEnhancedAnalysis(dealId: number): Promise<void> {
    console.log(`🔬 Starting enhanced ${this.agentType} analysis for deal ${dealId}`);
    
    // Create background job for tracking
    const jobId = `enhanced_${this.agentType.toLowerCase()}_analysis_${dealId}_${Date.now()}`;
    await storage.createBackgroundJob({
      jobId,
      dealId,
      jobType: `enhanced_${this.agentType.toLowerCase()}_analysis`,
      agentType: this.agentType,
      status: 'processing',
      progress: 5,
      currentStep: `Starting enhanced ${this.agentType} analysis`
    });

    try {
      // Step 1: Get all assigned documents
      await this.updateProgress(jobId, 10, 'Finding assigned documents');
      const assignedDocuments = await this.getAssignedDocuments(dealId);
      console.log(`📄 Found ${assignedDocuments.length} documents assigned to ${this.agentType}`);

      if (assignedDocuments.length === 0) {
        throw new Error(`No documents assigned to ${this.agentType} agent`);
      }

      // Step 2: Analyze each question across ALL assigned documents
      const comprehensiveAnswers: Record<string, ComprehensiveAnswer> = {};
      const totalQuestions = this.questions.length;
      
      for (let i = 0; i < totalQuestions; i++) {
        const question = this.questions[i];
        const progressPercent = Math.floor(10 + ((i / totalQuestions) * 70));
        
        await this.updateProgress(jobId, progressPercent, `Analyzing: ${question.question}`);
        console.log(`🔍 Question ${i + 1}/${totalQuestions}: ${question.question}`);

        // Extract evidence from ALL assigned documents for this specific question
        const documentEvidence = await this.extractComprehensiveEvidence(
          assignedDocuments, 
          question
        );

        // Compile comprehensive answer using cross-document analysis
        const answer = await this.compileEnhancedAnswer(question, documentEvidence);
        comprehensiveAnswers[question.id] = answer;

        console.log(`✅ Completed question ${i + 1}/${totalQuestions} with ${documentEvidence.length} evidence pieces`);
        
        // Brief delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Step 3: Generate cross-analysis insights
      await this.updateProgress(jobId, 85, 'Generating comprehensive insights');
      const insights = await this.generateCrossAnalysisInsights(comprehensiveAnswers);

      // Step 4: Store enhanced results
      await this.updateProgress(jobId, 95, 'Storing enhanced analysis results');
      await this.storeEnhancedResults(dealId, comprehensiveAnswers, insights, assignedDocuments);

      // Complete
      await this.updateProgress(jobId, 100, 'Enhanced analysis completed', 'completed');
      console.log(`✅ Enhanced ${this.agentType} analysis completed for deal ${dealId}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error in enhanced ${this.agentType} analysis:`, error);
      await storage.updateBackgroundJob(jobId, {
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
    
    // Process documents in batches to manage API rate limits
    const batchSize = 5;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      console.log(`🔎 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)}`);
      
      const batchPromises = batch.map(doc => this.extractEvidenceFromDocument(doc, question));
      const batchResults = await Promise.all(batchPromises);
      
      // Filter valid evidence
      const validEvidence = batchResults.filter((ev): ev is DocumentEvidence => 
        ev !== null && ev.relevantQuotes.length > 0
      );
      evidence.push(...validEvidence);
      
      console.log(`✅ Batch completed: ${validEvidence.length}/${batch.length} documents had relevant evidence`);
    }

    console.log(`📋 Total evidence pieces extracted: ${evidence.length} from ${documents.length} documents`);
    return evidence;
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

    // Store in agent_analyses table using storage service
    await storage.storeAgentAnalysis(dealId, this.agentType.toLowerCase(), analysisData);

    console.log(`💾 Stored enhanced ${this.agentType} analysis results for deal ${dealId}`);
  }

  /**
   * Update progress
   */
  private async updateProgress(
    jobId: string, 
    progress: number, 
    currentStep: string, 
    status: string = 'processing'
  ): Promise<void> {
    await storage.updateBackgroundJob(jobId, {
      progress,
      currentStep,
      status
    });
  }
}