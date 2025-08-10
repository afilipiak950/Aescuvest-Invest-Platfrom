import { createHash } from 'crypto';
import pLimit from 'p-limit';
import pQueue from 'p-queue';
import openaiService from './openai';

// Document processing cache with hash-based deduplication
class DocumentCache {
  private static instance: DocumentCache | null = null;
  private extractionCache = new Map<string, string>();
  private summaryCache = new Map<string, any>();
  private chunkCache = new Map<string, string[]>();

  static getInstance(): DocumentCache {
    if (!DocumentCache.instance) {
      DocumentCache.instance = new DocumentCache();
    }
    return DocumentCache.instance;
  }

  // Generate hash for document content deduplication
  private generateDocumentHash(content: string, name: string): string {
    return createHash('sha256').update(content + name).digest('hex').substring(0, 16);
  }

  // Cache extracted document text
  cacheExtraction(content: string, name: string, extractedText: string): string {
    const hash = this.generateDocumentHash(content, name);
    this.extractionCache.set(hash, extractedText);
    return hash;
  }

  // Get cached extraction
  getCachedExtraction(content: string, name: string): string | null {
    const hash = this.generateDocumentHash(content, name);
    return this.extractionCache.get(hash) || null;
  }

  // Cache document summary
  cacheSummary(content: string, name: string, summary: any): void {
    const hash = this.generateDocumentHash(content, name);
    this.summaryCache.set(hash, summary);
  }

  // Get cached summary
  getCachedSummary(content: string, name: string): any | null {
    const hash = this.generateDocumentHash(content, name);
    return this.summaryCache.get(hash) || null;
  }

  // Cache document chunks
  cacheChunks(content: string, name: string, chunks: string[]): void {
    const hash = this.generateDocumentHash(content, name);
    this.chunkCache.set(hash, chunks);
  }

  // Get cached chunks
  getCachedChunks(content: string, name: string): string[] | null {
    const hash = this.generateDocumentHash(content, name);
    return this.chunkCache.get(hash) || null;
  }

  // Clear cache for memory management
  clearCache(): void {
    this.extractionCache.clear();
    this.summaryCache.clear();
    this.chunkCache.clear();
    console.log('📝 Document cache cleared');
  }

  // Get cache stats
  getCacheStats(): { extractions: number, summaries: number, chunks: number } {
    return {
      extractions: this.extractionCache.size,
      summaries: this.summaryCache.size,
      chunks: this.chunkCache.size
    };
  }
}

// Optimized document processor with two-stage LLM pipeline
export class OptimizedDocumentProcessor {
  private cache = DocumentCache.getInstance();
  private summaryQueue = new pQueue({ concurrency: 10 });
  private agentQueue = new pQueue({ concurrency: 15 });
  private documentLimit = pLimit(8); // Process 8 documents in parallel

  // Stage 1: Generate lightweight summaries for all documents
  async generateDocumentSummaries(documents: any[]): Promise<Map<number, any>> {
    console.log(`📋 Stage 1: Generating summaries for ${documents.length} documents with ${this.summaryQueue.concurrency}x concurrency`);
    
    const summaryPromises = documents.map(doc => 
      this.documentLimit(() => this.summaryQueue.add(() => this.generateDocumentSummary(doc)))
    );

    const summaries = await Promise.allSettled(summaryPromises);
    const summaryMap = new Map<number, any>();

    summaries.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        summaryMap.set(documents[index].id, result.value);
      } else {
        console.error(`❌ Summary failed for document ${documents[index].name}:`, result.reason);
      }
    });

    console.log(`✅ Stage 1 complete: ${summaryMap.size}/${documents.length} summaries generated`);
    return summaryMap;
  }

  // Stage 2: Run all agents in parallel using summaries
  async runAllAgentsInParallel(
    documents: any[], 
    summaryMap: Map<number, any>, 
    agentTypes: string[]
  ): Promise<Map<string, any>> {
    console.log(`🤖 Stage 2: Running ${agentTypes.length} agents in parallel with ${this.agentQueue.concurrency}x concurrency`);

    const agentPromises = agentTypes.map(agentType =>
      this.agentQueue.add(() => this.runAgentAnalysis(documents, summaryMap, agentType))
    );

    const agentResults = await Promise.allSettled(agentPromises);
    const resultsMap = new Map<string, any>();

    agentResults.forEach((result, index) => {
      const agentType = agentTypes[index];
      if (result.status === 'fulfilled' && result.value) {
        resultsMap.set(agentType, result.value);
      } else {
        console.error(`❌ Agent ${agentType} analysis failed:`, result.reason);
        resultsMap.set(agentType, { findings: [], recommendations: [], error: result.reason });
      }
    });

    console.log(`✅ Stage 2 complete: ${resultsMap.size}/${agentTypes.length} agents completed`);
    return resultsMap;
  }

  // Generate lightweight document summary (Stage 1)
  private async generateDocumentSummary(document: any): Promise<any> {
    const content = document.extractedText || document.ocrText || '';
    
    // Check cache first
    const cachedSummary = this.cache.getCachedSummary(content, document.name);
    if (cachedSummary) {
      console.log(`💨 Using cached summary for ${document.name}`);
      return cachedSummary;
    }

    // Generate optimized summary prompt (much shorter than full analysis)
    const summaryPrompt = `
    Analyze this ${document.name} document and provide a structured summary for multi-agent due diligence analysis.

    Document Content:
    ${content.substring(0, 4000)} ${content.length > 4000 ? '...[TRUNCATED]' : ''}

    Return a JSON object with:
    {
      "documentType": "contract|financial|clinical|legal|commercial|hr|ip|research|other",
      "keyTopics": ["topic1", "topic2", "topic3"],
      "criticalFindings": ["finding1", "finding2", "finding3"],
      "keyFinancialData": ["data1", "data2"],
      "executiveSummary": "2-3 sentence summary focusing on investment relevance",
      "agentRelevance": {
        "clinical": 0-100,
        "legal": 0-100,
        "commercial": 0-100,
        "financial": 0-100,
        "hr": 0-100,
        "ip": 0-100,
        "research": 0-100
      }
    }

    Focus on investment-relevant insights. Be concise but comprehensive.`;

    try {
      const summary = await openaiService.analyzeDocument(
        content,
        summaryPrompt,
        { 
          jsonResponse: true, 
          temperature: 0.1,
          model: "gpt-4o-mini", // Use faster, cheaper model for summaries
          maxTokens: 1500 // Much smaller response
        }
      );

      // Cache the summary
      this.cache.cacheSummary(content, document.name, summary);
      console.log(`📋 Generated summary for ${document.name}`);
      return summary;

    } catch (error) {
      console.error(`❌ Summary generation failed for ${document.name}:`, error);
      return {
        documentType: "other",
        keyTopics: [],
        criticalFindings: [],
        keyFinancialData: [],
        executiveSummary: "Summary generation failed",
        agentRelevance: {}
      };
    }
  }

  // Run specific agent analysis using pre-generated summaries (Stage 2)
  private async runAgentAnalysis(
    documents: any[], 
    summaryMap: Map<number, any>, 
    agentType: string
  ): Promise<any> {
    console.log(`🤖 Running ${agentType} agent analysis on ${documents.length} documents`);

    // Filter documents by agent relevance (from summaries)
    const relevantDocuments = documents.filter(doc => {
      const summary = summaryMap.get(doc.id);
      if (!summary?.agentRelevance) return true; // Include if no relevance data
      
      const relevance = summary.agentRelevance[agentType.toLowerCase()] || 0;
      return relevance > 20; // Only analyze documents with >20% relevance
    });

    console.log(`📊 ${agentType} agent: analyzing ${relevantDocuments.length}/${documents.length} relevant documents`);

    let allFindings: any[] = [];
    let allRecommendations: string[] = [];

    // Process relevant documents with optimized prompts
    for (const doc of relevantDocuments) {
      try {
        const summary = summaryMap.get(doc.id);
        const docAnalysis = await this.generateAgentAnalysis(doc, summary, agentType);
        
        if (docAnalysis?.findings) {
          allFindings.push(...docAnalysis.findings);
        }
        if (docAnalysis?.recommendations) {
          allRecommendations.push(...docAnalysis.recommendations);
        }

      } catch (error) {
        console.error(`❌ ${agentType} analysis failed for ${doc.name}:`, error);
      }
    }

    return {
      findings: allFindings,
      recommendations: allRecommendations,
      documentsAnalyzed: relevantDocuments.length,
      totalDocuments: documents.length
    };
  }

  // Generate agent-specific analysis using document summary
  private async generateAgentAnalysis(document: any, summary: any, agentType: string): Promise<any> {
    // Use summary data instead of full document content for efficiency
    const analysisPrompt = `
    You are a ${agentType} specialist conducting due diligence analysis.
    
    DOCUMENT SUMMARY:
    - Type: ${summary.documentType}
    - Key Topics: ${summary.keyTopics?.join(', ')}
    - Critical Findings: ${summary.criticalFindings?.join(', ')}
    - Executive Summary: ${summary.executiveSummary}
    
    FULL DOCUMENT: ${document.extractedText?.substring(0, 2000) || 'Not available'}...

    Generate 5-10 ${agentType}-specific findings and 3-5 recommendations.
    
    Return JSON:
    {
      "findings": [
        {
          "id": 1,
          "content": "Detailed finding relevant to ${agentType} analysis",
          "type": "Positive|Negative|Warning|Info",
          "confidence": "High|Medium|Low",
          "evidence": "Specific evidence from document"
        }
      ],
      "recommendations": [
        "Actionable recommendation based on ${agentType} analysis"
      ]
    }

    Focus on quality over quantity. Be specific and investment-relevant.`;

    try {
      return await openaiService.analyzeDocument(
        summary.executiveSummary, // Use summary instead of full content
        analysisPrompt,
        { 
          jsonResponse: true, 
          temperature: 0.2,
          model: "gpt-4o", // Use full model for analysis
          maxTokens: 3000 // Reduced from 8000
        }
      );
    } catch (error) {
      console.error(`❌ ${agentType} analysis failed for ${document.name}:`, error);
      throw error;
    }
  }

  // Get processing stats
  getStats(): any {
    const cacheStats = this.cache.getCacheStats();
    return {
      cache: cacheStats,
      queues: {
        summaryQueue: this.summaryQueue.size,
        agentQueue: this.agentQueue.size,
        summaryPending: this.summaryQueue.pending,
        agentPending: this.agentQueue.pending
      }
    };
  }

  // Clear all caches
  clearCaches(): void {
    this.cache.clearCache();
  }
}

export default OptimizedDocumentProcessor;