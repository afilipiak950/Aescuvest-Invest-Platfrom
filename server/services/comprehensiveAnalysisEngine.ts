/**
 * COMPREHENSIVE ANALYSIS ENGINE - GPT-5 POWERED
 * 
 * Implements full document×question matrix processing for all 7 agents
 * with real evidence-based answers, combined results, and zero fallback text
 */

import { storage } from '../storage';
import OpenAI from 'openai';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
});

interface QuestionDefinition {
  id: string;
  question: string;
  category: string;
}

interface DocumentQuestionResult {
  docId: number;
  questionId: string;
  answer: string;
  confidence: number;
  evidence: Array<{
    text: string;
    page: number;
    relevance: string;
  }>;
  sources: string[];
  processingTime: number;
}

interface CombinedQuestionAnswer {
  questionId: string;
  finalAnswer: string;
  combinedConfidence: number;
  allSources: Array<{
    docId: number;
    docName: string;
    page: number;
  }>;
  quotes: Array<{
    text: string;
    docName: string;
    page: number;
  }>;
  evidenceSummary: string;
  documentsAnalyzed: number;
}

// Question definitions for all 7 agents
const AGENT_QUESTIONS: Record<string, QuestionDefinition[]> = {
  legal: [
    { id: 'legal_1', question: 'What are the key corporate governance structures and board composition?', category: 'Corporate Structure' },
    { id: 'legal_2', question: 'What intellectual property rights, patents, and licensing agreements exist?', category: 'Intellectual Property' },
    { id: 'legal_3', question: 'What are the regulatory compliance requirements and current status?', category: 'Regulatory Compliance' },
    { id: 'legal_4', question: 'What litigation risks, disputes, or legal proceedings are documented?', category: 'Legal Risks' },
    { id: 'legal_5', question: 'What are the employment law considerations and HR policies?', category: 'Employment Law' },
    { id: 'legal_6', question: 'What are the contract obligations and key commercial agreements?', category: 'Contracts' }
  ],
  clinical: [
    { id: 'clinical_1', question: 'What is the regulatory pathway and FDA approval status?', category: 'Regulatory Status' },
    { id: 'clinical_2', question: 'What clinical trial data and outcomes are available?', category: 'Clinical Evidence' },
    { id: 'clinical_3', question: 'What are the safety profile and adverse events recorded?', category: 'Safety Data' },
    { id: 'clinical_4', question: 'What quality management systems and manufacturing processes exist?', category: 'Quality Systems' },
    { id: 'clinical_5', question: 'What are the reimbursement strategies and market access plans?', category: 'Market Access' },
    { id: 'clinical_6', question: 'What post-market surveillance and real-world evidence exists?', category: 'Post-Market' }
  ],
  commercial: [
    { id: 'commercial_1', question: 'What is the total addressable market size and growth projections?', category: 'Market Size' },
    { id: 'commercial_2', question: 'Who are the key competitors and what is the competitive landscape?', category: 'Competition' },
    { id: 'commercial_3', question: 'What are the customer segments and value propositions?', category: 'Customer Analysis' },
    { id: 'commercial_4', question: 'What are the sales channels and go-to-market strategies?', category: 'Sales Strategy' },
    { id: 'commercial_5', question: 'What pricing models and revenue projections are documented?', category: 'Pricing & Revenue' },
    { id: 'commercial_6', question: 'What partnerships and strategic alliances are established?', category: 'Partnerships' }
  ],
  hr: [
    { id: 'hr_1', question: 'Who are the key personnel and what are their backgrounds?', category: 'Team' },
    { id: 'hr_2', question: 'What employment agreements and compensation structures exist?', category: 'Employment' },
    { id: 'hr_3', question: 'What talent retention and recruitment strategies are documented?', category: 'Retention' },
    { id: 'hr_4', question: 'What organizational structure and reporting lines are established?', category: 'Organization' },
    { id: 'hr_5', question: 'What employee equity and incentive programs are in place?', category: 'Incentives' },
    { id: 'hr_6', question: 'What HR policies and workplace culture initiatives exist?', category: 'Culture' }
  ],
  financial: [
    { id: 'financial_1', question: 'What are the financial projections and revenue assumptions?', category: 'Projections' },
    { id: 'financial_2', question: 'What is the funding history and current burn rate?', category: 'Funding' },
    { id: 'financial_3', question: 'What revenue model and unit economics are documented?', category: 'Revenue Model' },
    { id: 'financial_4', question: 'What are the key financial risks and mitigation strategies?', category: 'Financial Risks' },
    { id: 'financial_5', question: 'What cash flow projections and runway analysis exist?', category: 'Cash Flow' },
    { id: 'financial_6', question: 'What financial controls and audit processes are in place?', category: 'Controls' }
  ],
  ip: [
    { id: 'ip_1', question: 'What is the patent portfolio and filing strategy?', category: 'Patents' },
    { id: 'ip_2', question: 'What freedom to operate analysis has been conducted?', category: 'Freedom to Operate' },
    { id: 'ip_3', question: 'What IP litigation risks and prior art exist?', category: 'IP Risks' },
    { id: 'ip_4', question: 'What trade secrets and know-how protection exists?', category: 'Trade Secrets' },
    { id: 'ip_5', question: 'What licensing agreements and IP partnerships are established?', category: 'Licensing' },
    { id: 'ip_6', question: 'What IP valuation and monetization strategies exist?', category: 'IP Value' }
  ],
  research: [
    { id: 'research_1', question: 'What market research supports the business opportunity?', category: 'Market Research' },
    { id: 'research_2', question: 'What are the key industry trends and market dynamics?', category: 'Industry Trends' },
    { id: 'research_3', question: 'What competitive analysis and positioning research exists?', category: 'Competitive Analysis' },
    { id: 'research_4', question: 'What customer research and validation studies are available?', category: 'Customer Research' },
    { id: 'research_5', question: 'What technology research and development activities exist?', category: 'R&D' },
    { id: 'research_6', question: 'What regulatory and policy research impacts the business?', category: 'Regulatory Research' }
  ]
};

export class ComprehensiveAnalysisEngine {
  
  /**
   * Main entry point: Generate comprehensive Q&A analysis for all agents
   */
  async runComprehensiveAnalysis(dealId: number): Promise<void> {
    console.log(`🚀 Starting comprehensive analysis for deal ${dealId}`);
    
    // Get all documents for this deal
    const documents = await storage.getDocumentsByDealId(dealId);
    if (documents.length === 0) {
      throw new Error('No documents found for analysis');
    }

    console.log(`📄 Processing ${documents.length} documents across 7 agents`);

    // Process each agent type
    for (const [agentType, questions] of Object.entries(AGENT_QUESTIONS)) {
      console.log(`🤖 Processing ${agentType} agent with ${questions.length} questions`);
      
      const agentAnswers = await this.processAgentQuestions(
        dealId, 
        agentType, 
        questions, 
        documents
      );
      
      // Store the results
      await this.storeAgentResults(dealId, agentType, agentAnswers);
    }

    console.log(`✅ Comprehensive analysis completed for deal ${dealId}`);
  }

  /**
   * Process all questions for a specific agent
   */
  private async processAgentQuestions(
    dealId: number,
    agentType: string,
    questions: QuestionDefinition[],
    documents: any[]
  ): Promise<Record<string, CombinedQuestionAnswer>> {
    
    const agentAnswers: Record<string, CombinedQuestionAnswer> = {};
    
    for (const question of questions) {
      console.log(`❓ Processing question: ${question.question}`);
      
      const combinedAnswer = await this.processQuestionAcrossDocuments(
        question,
        documents,
        agentType
      );
      
      agentAnswers[question.id] = combinedAnswer;
    }

    return agentAnswers;
  }

  /**
   * Process a single question across all documents and combine results
   */
  private async processQuestionAcrossDocuments(
    question: QuestionDefinition,
    documents: any[],
    agentType: string
  ): Promise<CombinedQuestionAnswer> {
    
    const documentResults: DocumentQuestionResult[] = [];
    const batchSize = 8; // Process 8 documents in parallel
    
    // Process documents in batches
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      
      const batchPromises = batch.map(doc => 
        this.analyzeDocumentForQuestion(doc, question, agentType)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Collect successful results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          documentResults.push(result.value);
        } else {
          console.warn(`⚠️ Failed to process document ${batch[index].name}: ${result.status === 'rejected' ? result.reason : 'Unknown error'}`);
        }
      });
    }

    // Combine all document results into final answer
    return this.combineDocumentResults(question, documentResults);
  }

  /**
   * Analyze a single document for a specific question
   */
  private async analyzeDocumentForQuestion(
    document: any,
    question: QuestionDefinition,
    agentType: string
  ): Promise<DocumentQuestionResult | null> {
    
    try {
      const startTime = Date.now();
      
      // Get OCR text
      if (!document.ai_summary || document.ai_summary.length < 50) {
        console.log(`⏭️ Skipping document ${document.name} - insufficient OCR content`);
        return null;
      }

      const prompt = `You are analyzing investment documents for ${agentType} due diligence.

DOCUMENT: ${document.name}
QUESTION: ${question.question}

DOCUMENT CONTENT:
${document.ai_summary}

Analyze this document and provide a JSON response with:
{
  "hasRelevantContent": true/false,
  "answer": "Specific answer to the question based on document content",
  "confidence": 0-100,
  "evidence": [
    {
      "text": "Direct quote from document",
      "page": estimated_page_number,
      "relevance": "high/medium/low"
    }
  ],
  "sources": ["Document name and relevant sections"]
}

Requirements:
- Only answer if document contains relevant information
- Use direct quotes as evidence
- Be specific and factual
- No generic or template responses
- Estimate page numbers when available`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are an expert investment analyst. Provide factual, evidence-based analysis with direct quotes. Never use generic text."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
        temperature: 0.2
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      if (!result.hasRelevantContent) {
        return null;
      }

      return {
        docId: document.id,
        questionId: question.id,
        answer: result.answer,
        confidence: result.confidence,
        evidence: result.evidence || [],
        sources: result.sources || [document.name],
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error(`❌ Error analyzing document ${document.name}:`, error);
      return null;
    }
  }

  /**
   * Combine results from multiple documents into a comprehensive answer
   */
  private async combineDocumentResults(
    question: QuestionDefinition,
    results: DocumentQuestionResult[]
  ): Promise<CombinedQuestionAnswer> {
    
    if (results.length === 0) {
      return {
        questionId: question.id,
        finalAnswer: "No relevant information found in the assigned documents for this question. The analysis system requires specific evidence from document content to provide answers.",
        combinedConfidence: 0,
        allSources: [],
        quotes: [],
        evidenceSummary: "No evidence found",
        documentsAnalyzed: 0
      };
    }

    // Collect all evidence and sources
    const allEvidence = results.flatMap(r => r.evidence);
    const allSources = results.flatMap(r => r.sources);
    const allQuotes = allEvidence.map(e => ({
      text: e.text,
      docName: results.find(r => r.evidence.includes(e))?.sources[0] || 'Unknown',
      page: e.page
    }));

    // Create synthesis prompt
    const synthesisPrompt = `Synthesize the following evidence into a comprehensive answer for: "${question.question}"

EVIDENCE FROM DOCUMENTS:
${results.map((r, i) => `
Document ${i + 1}: ${r.sources[0]}
Answer: ${r.answer}
Confidence: ${r.confidence}%
Evidence: ${r.evidence.map(e => `"${e.text}"`).join(', ')}
`).join('\n')}

Create a comprehensive, factual answer that:
1. Directly addresses the question
2. Synthesizes information from all sources
3. Includes specific quotes and references
4. Maintains factual accuracy
5. Provides source attribution

Format as JSON:
{
  "finalAnswer": "Comprehensive answer with source references",
  "combinedConfidence": 0-100,
  "evidenceSummary": "Summary of key evidence found"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are an expert investment analyst synthesizing evidence from multiple documents. Provide factual, well-sourced analysis."
          },
          {
            role: "user",
            content: synthesisPrompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
        temperature: 0.1
      });

      const synthesis = JSON.parse(response.choices[0].message.content || '{}');

      return {
        questionId: question.id,
        finalAnswer: synthesis.finalAnswer,
        combinedConfidence: synthesis.combinedConfidence,
        allSources: results.map(r => ({
          docId: r.docId,
          docName: r.sources[0] || 'Unknown',
          page: r.evidence[0]?.page || 1
        })),
        quotes: allQuotes.slice(0, 5), // Top 5 quotes
        evidenceSummary: synthesis.evidenceSummary,
        documentsAnalyzed: results.length
      };

    } catch (error) {
      console.error('❌ Error synthesizing results:', error);
      
      // Fallback to simple combination
      return {
        questionId: question.id,
        finalAnswer: `Based on ${results.length} documents: ${results.map(r => r.answer).join('. ')}`,
        combinedConfidence: Math.round(results.reduce((sum, r) => sum + r.confidence, 0) / results.length),
        allSources: results.map(r => ({
          docId: r.docId,
          docName: r.sources[0] || 'Unknown',
          page: r.evidence[0]?.page || 1
        })),
        quotes: allQuotes,
        evidenceSummary: `Evidence from ${results.length} documents`,
        documentsAnalyzed: results.length
      };
    }
  }

  /**
   * Store agent results in database
   */
  private async storeAgentResults(
    dealId: number,
    agentType: string,
    answers: Record<string, CombinedQuestionAnswer>
  ): Promise<void> {
    
    try {
      // Check if analysis exists
      const existing = await storage.getAgentAnalysis(dealId, agentType);
      
      const analysisData = {
        dealId,
        agentType,
        status: 'Completed' as const,
        progress: 100,
        findings: [], // Empty findings - we use answers now
        recommendations: [],
        [`${agentType.toLowerCase()}_answers`]: answers
      };

      if (existing) {
        await storage.updateAgentAnalysis(existing.id, analysisData);
        console.log(`✅ Updated ${agentType} analysis for deal ${dealId}`);
      } else {
        await storage.createAgentAnalysis(analysisData);
        console.log(`✅ Created ${agentType} analysis for deal ${dealId}`);
      }

    } catch (error) {
      console.error(`❌ Error storing ${agentType} results:`, error);
      throw error;
    }
  }

  /**
   * Reset all analyses for a deal
   */
  async resetAnalyses(dealId: number): Promise<void> {
    console.log(`🔄 Resetting all analyses for deal ${dealId}`);
    
    try {
      // Delete all existing agent analyses
      const analyses = await storage.getAnalysesByDealId(dealId);
      
      for (const analysis of analyses) {
        await storage.deleteAgentAnalysis(analysis.id);
      }
      
      console.log(`✅ Reset completed: deleted ${analyses.length} analyses`);
      
    } catch (error) {
      console.error(`❌ Error resetting analyses:`, error);
      throw error;
    }
  }
}

export const comprehensiveAnalysisEngine = new ComprehensiveAnalysisEngine();