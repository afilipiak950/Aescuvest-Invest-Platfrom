import openaiService from './openai';
import { storage } from '../storage';
import { LEGAL_QUESTIONS } from '../legalAnalysisService';

// Clinical questions from the UI
const CLINICAL_QUESTIONS = [
  { id: 'trial_design', category: 'Trial Design', question: 'What is the study design and methodology?' },
  { id: 'endpoints', category: 'Endpoints', question: 'What are the primary and secondary endpoints?' },
  { id: 'patient_population', category: 'Patient Population', question: 'What is the target patient population?' },
  { id: 'safety_profile', category: 'Safety', question: 'What is the safety and tolerability profile?' },
  { id: 'regulatory_pathway', category: 'Regulatory', question: 'What is the regulatory pathway and timeline?' },
  { id: 'competitive_landscape', category: 'Competition', question: 'How does this compare to existing treatments?' }
];

// Commercial questions  
const COMMERCIAL_QUESTIONS = [
  { id: 'market_size', category: 'Market', question: 'What is the total addressable market size?' },
  { id: 'business_model', category: 'Business Model', question: 'What is the revenue model and pricing strategy?' },
  { id: 'go_to_market', category: 'Go-to-Market', question: 'What is the go-to-market strategy?' },
  { id: 'competitive_positioning', category: 'Competition', question: 'What is the competitive positioning?' }
];

// HR questions
const HR_QUESTIONS = [
  { id: 'key_personnel', category: 'Team', question: 'Who are the key personnel and their backgrounds?' },
  { id: 'employment_agreements', category: 'Employment', question: 'What employment agreements are in place?' },
  { id: 'retention_strategy', category: 'Retention', question: 'What is the talent retention strategy?' }
];

// Financial questions
const FINANCIAL_QUESTIONS = [
  { id: 'financial_projections', category: 'Projections', question: 'What are the financial projections and assumptions?' },
  { id: 'funding_history', category: 'Funding', question: 'What is the funding history and burn rate?' },
  { id: 'revenue_model', category: 'Revenue', question: 'What is the revenue model and unit economics?' }
];

// IP questions  
const IP_QUESTIONS = [
  { id: 'patent_portfolio', category: 'Patents', question: 'What is the patent portfolio and strategy?' },
  { id: 'ip_freedom', category: 'Freedom to Operate', question: 'Is there freedom to operate?' },
  { id: 'ip_risks', category: 'IP Risks', question: 'What are the IP litigation risks?' }
];

// Research questions
const RESEARCH_QUESTIONS = [
  { id: 'market_research', category: 'Market Research', question: 'What market research supports the opportunity?' },
  { id: 'industry_trends', category: 'Industry', question: 'What are the key industry trends?' },
  { id: 'competitive_analysis', category: 'Competition', question: 'What does the competitive analysis show?' }
];

const AGENT_QUESTIONS = {
  Legal: LEGAL_QUESTIONS,
  Clinical: CLINICAL_QUESTIONS,
  Commercial: COMMERCIAL_QUESTIONS,
  HR: HR_QUESTIONS,
  Financial: FINANCIAL_QUESTIONS,
  IP: IP_QUESTIONS,
  Research: RESEARCH_QUESTIONS
};

interface DocumentChunk {
  content: string;
  metadata: {
    documentId: number;
    documentName: string;
    page?: number;
    url?: string;
    snippet: string;
  };
}

interface QuestionAnswer {
  answer: string;
  confidence: number;
  sources: Array<{
    title: string;
    url?: string;
    docId: number;
    page?: number;
    snippet: string;
  }>;
  quotes: Array<{
    text: string;
    docId: number;
    page?: number;
    document: string;
    relevance: string;
  }>;
  keyFindings?: string[];
  evidenceSummary?: string;
  recommendations?: string[];
  detailedEvidence?: Array<{
    documentName: string;
    relevantContent: string[];
    keyFindings: string[];
    documentSummary: string;
  }>;
}

/**
 * Structured Question Answering Service
 * 
 * Generates agent-specific Q&A with proper sources and quotes
 * Ensures unique caching per agent+question+document combination
 */
export class StructuredQuestionAnswering {
  private answerCache = new Map<string, QuestionAnswer>();

  // Generate unique cache key to prevent "last write wins"
  private getCacheKey(agentType: string, questionId: string, documentHashes: string[]): string {
    const hashString = documentHashes.sort().join(',');
    return `${agentType}:${questionId}:${hashString.substring(0, 16)}`;
  }

  // Generate document hash for deduplication
  private async getDocumentHash(document: any): Promise<string> {
    const content = document.extractedText || document.ocrText || '';
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(content + document.name).digest('hex').substring(0, 16);
  }

  // Extract relevant chunks with metadata for RAG pipeline
  private extractRelevantChunks(documents: any[], question: string, maxChunks = 5): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    
    for (const doc of documents) {
      const content = doc.extractedText || doc.ocrText || '';
      if (!content) continue;

      // Split document into chunks (simple sentence-based splitting)
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
      
      // Score sentences by relevance to question 
      const questionWords = question.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      
      const scoredChunks = sentences.map((sentence, index) => {
        const sentenceLower = sentence.toLowerCase();
        const score = questionWords.reduce((acc, word) => {
          return acc + (sentenceLower.includes(word) ? 1 : 0);
        }, 0);
        
        return {
          content: sentence.trim(),
          score,
          index,
          metadata: {
            documentId: doc.id,
            documentName: doc.name,
            page: Math.floor(index / 10) + 1, // Estimate page
            snippet: sentence.trim().substring(0, 200) + (sentence.length > 200 ? '...' : '')
          }
        };
      });

      // Take top chunks from this document
      scoredChunks
        .filter(chunk => chunk.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .forEach(chunk => chunks.push(chunk));
    }

    // Return top chunks overall
    return chunks
      .sort((a, b) => b.score - a.score)
      .slice(0, maxChunks);
  }

  // Generate structured answer for a specific question
  async generateAnswerForQuestion(
    agentType: string, 
    questionId: string, 
    documents: any[]
  ): Promise<QuestionAnswer | null> {
    
    if (!documents.length) return null;
    
    // Get question definition
    const questions = AGENT_QUESTIONS[agentType as keyof typeof AGENT_QUESTIONS];
    const question = questions?.find(q => q.id === questionId);
    if (!question) return null;

    // Check cache with unique key
    const documentHashes = await Promise.all(documents.map(doc => this.getDocumentHash(doc)));
    const cacheKey = this.getCacheKey(agentType, questionId, documentHashes);
    
    if (this.answerCache.has(cacheKey)) {
      console.log(`💨 Using cached answer for ${agentType}.${questionId}`);
      return this.answerCache.get(cacheKey)!;
    }

    console.log(`🔍 Generating new answer for ${agentType}.${questionId} with ${documents.length} documents`);

    try {
      // Extract relevant chunks with metadata
      const relevantChunks = this.extractRelevantChunks(documents, question.question);
      
      if (relevantChunks.length === 0) {
        return null;
      }

      // Build context from relevant chunks
      const context = relevantChunks.map((chunk, index) => 
        `[Doc: ${chunk.metadata.documentName}] ${chunk.content}`
      ).join('\n\n');
      
      if (!context.trim()) {
        console.log(`⚠️ No relevant context found for ${agentType}.${questionId}`);
        return null;
      }

      // Generate structured answer using GPT-4o
      const prompt = `
      You are a ${agentType} specialist conducting due diligence analysis.
      
      QUESTION: ${question.question}
      
      RELEVANT DOCUMENT EXCERPTS:
      ${context}
      
      Provide a comprehensive answer with specific evidence and sources. Return JSON with:
      {
        "answer": "Detailed answer based on the evidence (200-400 words)",
        "confidence": 0.85,
        "keyFindings": ["Key finding 1", "Key finding 2", "Key finding 3"],
        "evidenceSummary": "Summary of the supporting evidence",
        "recommendations": ["Recommendation 1", "Recommendation 2"],
        "quotes": [
          {
            "text": "Exact quote from document",
            "document": "Document name",
            "relevance": "Why this quote is relevant"
          }
        ],
        "sources": [
          {
            "title": "Document name",
            "docId": 123,
            "snippet": "Relevant excerpt from document"
          }
        ]
      }
      
      Requirements:
      - Base answer ONLY on provided document excerpts
      - Include at least 2-3 specific quotes from the documents
      - Ensure all sources map to provided documents
      - If insufficient evidence, return null
      - Be specific and investment-focused`;

      const response = await openaiService.analyzeDocument(
        context.substring(0, 8000), // Ensure content is not too long
        prompt,
        {
          jsonResponse: true,
          temperature: 0.1,
          model: "gpt-4o",
          maxTokens: 2000
        }
      );

      if (!response || !response.answer) {
        return null;
      }

      // Enrich response with document metadata
      const enrichedAnswer: QuestionAnswer = {
        answer: response.answer,
        confidence: response.confidence || 0.8,
        keyFindings: response.keyFindings || [],
        evidenceSummary: response.evidenceSummary || '',
        recommendations: response.recommendations || [],
        quotes: (response.quotes || []).map((quote: any, index: number) => ({
          text: quote.text,
          docId: relevantChunks[index]?.metadata.documentId || documents[0].id,
          document: quote.document || relevantChunks[index]?.metadata.documentName || 'Unknown',
          page: relevantChunks[index]?.metadata.page,
          relevance: quote.relevance || 'Supporting evidence'
        })),
        sources: (response.sources || []).map((source: any, index: number) => ({
          title: source.title || relevantChunks[index]?.metadata.documentName || 'Unknown',
          docId: source.docId || relevantChunks[index]?.metadata.documentId || documents[0].id,
          page: relevantChunks[index]?.metadata.page,
          snippet: source.snippet || relevantChunks[index]?.metadata.snippet || ''
        })),
        detailedEvidence: relevantChunks.map(chunk => ({
          documentName: chunk.metadata.documentName,
          relevantContent: [chunk.content],
          keyFindings: response.keyFindings?.slice(0, 2) || [],
          documentSummary: chunk.metadata.snippet
        }))
      };

      // Cache the result
      this.answerCache.set(cacheKey, enrichedAnswer);
      console.log(`✅ Generated structured answer for ${agentType}.${questionId}: ${enrichedAnswer.sources.length} sources, ${enrichedAnswer.quotes.length} quotes`);
      
      return enrichedAnswer;

    } catch (error) {
      console.error(`❌ Failed to generate answer for ${agentType}.${questionId}:`, error);
      return null;
    }
  }

  // Generate all answers for an agent
  async generateAllAnswersForAgent(agentType: string, documents: any[]): Promise<{ [key: string]: QuestionAnswer }> {
    const questions = AGENT_QUESTIONS[agentType as keyof typeof AGENT_QUESTIONS] || [];
    const answers: { [key: string]: QuestionAnswer } = {};

    console.log(`🤖 Generating ${questions.length} structured answers for ${agentType} agent`);

    // Process questions in parallel but limit concurrency
    const pLimit = await import('p-limit');
    const limit = pLimit.default(3);
    const promises = questions.map(question => 
      limit(async () => {
        const answer = await this.generateAnswerForQuestion(agentType, question.id, documents);
        if (answer) {
          answers[question.id] = answer;
        }
      })
    );

    await Promise.all(promises);
    
    console.log(`✅ Generated ${Object.keys(answers).length}/${questions.length} answers for ${agentType}`);
    return answers;
  }

  // Clear cache
  clearCache(): void {
    this.answerCache.clear();
    console.log('🧹 Cleared structured Q&A cache');
  }

  // Get cache stats
  getCacheStats(): { size: number, keys: string[] } {
    return {
      size: this.answerCache.size,
      keys: Array.from(this.answerCache.keys()).slice(0, 10)
    };
  }
}

export default StructuredQuestionAnswering;