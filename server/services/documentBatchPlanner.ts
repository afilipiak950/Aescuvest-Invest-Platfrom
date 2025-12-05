/**
 * Document Batch Planner Service
 * 
 * Handles efficient document loading for large datarooms (1000+ documents)
 * Uses pagination, intelligent sampling, and token budgeting to prevent
 * memory exhaustion and API token limits from being exceeded.
 */

import { storage } from '../storage';

export interface DocumentChunk {
  id: number;
  name: string;
  type: string;
  category: string;
  summary: string;
  ocrText: string;
  charCount: number;
}

export interface BatchPlan {
  totalDocuments: number;
  batchCount: number;
  documentsPerBatch: number;
  estimatedTokens: number;
  samplingStrategy: 'all' | 'priority' | 'sampled';
}

export interface DocumentBatch {
  batchNumber: number;
  totalBatches: number;
  documents: DocumentChunk[];
  totalChars: number;
  estimatedTokens: number;
}

export interface AgentDocumentContext {
  contextText: string;
  documentCount: number;
  totalChars: number;
  estimatedTokens: number;
  sampledDocuments: number;
  skippedDocuments: number;
  strategy: string;
}

export class DocumentBatchPlanner {
  private static instance: DocumentBatchPlanner;
  
  // Token limits for GPT-4o (128k context window)
  private readonly MAX_CONTEXT_TOKENS = 90000; // Reserve ~38k for prompts/responses
  private readonly CHARS_PER_TOKEN = 4; // Average estimate
  private readonly MAX_CONTEXT_CHARS = 360000; // 90k tokens * 4 chars
  
  // Batch processing settings
  private readonly MAX_DOCS_PER_BATCH = 100;
  private readonly PRIORITY_DOC_CHAR_LIMIT = 2000; // More chars for priority docs
  private readonly SAMPLED_DOC_CHAR_LIMIT = 500; // Less chars for sampled docs
  private readonly SUMMARY_CHAR_LIMIT = 300;
  
  // Document priority scoring by type/category
  private readonly PRIORITY_TYPES: Record<string, number> = {
    'legal': 10, 'contract': 10, 'agreement': 10,
    'financial': 9, 'term_sheet': 9, 'cap_table': 9,
    'clinical': 8, 'regulatory': 8, 'fda': 8,
    'patent': 8, 'ip': 8, 'trademark': 8,
    'hr': 7, 'employee': 7, 'compensation': 7,
    'commercial': 7, 'market': 7, 'customer': 7,
    'research': 6, 'publication': 6, 'study': 6,
    'pitch': 5, 'presentation': 5, 'deck': 5
  };

  static getInstance(): DocumentBatchPlanner {
    if (!DocumentBatchPlanner.instance) {
      DocumentBatchPlanner.instance = new DocumentBatchPlanner();
    }
    return DocumentBatchPlanner.instance;
  }

  /**
   * Calculate batch plan for a deal's documents
   */
  async calculateBatchPlan(dealId: number): Promise<BatchPlan> {
    const countResult = await storage.getDocumentsByDealIdPaginated(dealId, 1, 1, true);
    const totalDocuments = countResult.total;

    let samplingStrategy: 'all' | 'priority' | 'sampled' = 'all';
    let documentsPerBatch = Math.min(totalDocuments, this.MAX_DOCS_PER_BATCH);

    if (totalDocuments > 500) {
      samplingStrategy = 'sampled';
      documentsPerBatch = 100;
    } else if (totalDocuments > 200) {
      samplingStrategy = 'priority';
      documentsPerBatch = 50;
    }

    const batchCount = Math.ceil(totalDocuments / documentsPerBatch);
    const estimatedTokens = Math.min(totalDocuments * 500, this.MAX_CONTEXT_TOKENS);

    console.log(`📊 Batch Plan for deal ${dealId}: ${totalDocuments} docs, ${batchCount} batches, strategy: ${samplingStrategy}`);

    return {
      totalDocuments,
      batchCount,
      documentsPerBatch,
      estimatedTokens,
      samplingStrategy
    };
  }

  /**
   * Get document priority score based on name, type, and category
   */
  private getDocumentPriority(doc: { name: string; type: string; category?: string }): number {
    const nameLower = doc.name.toLowerCase();
    const typeLower = (doc.type || '').toLowerCase();
    const categoryLower = (doc.category || '').toLowerCase();

    let maxScore = 0;

    for (const [keyword, score] of Object.entries(this.PRIORITY_TYPES)) {
      if (nameLower.includes(keyword) || typeLower.includes(keyword) || categoryLower.includes(keyword)) {
        maxScore = Math.max(maxScore, score);
      }
    }

    return maxScore || 3; // Default priority for unclassified docs
  }

  /**
   * Build optimized context for agent analysis
   * Uses intelligent sampling and token budgeting for large datarooms
   */
  async buildAgentContext(
    dealId: number,
    agentType: string,
    maxChars: number = this.MAX_CONTEXT_CHARS
  ): Promise<AgentDocumentContext> {
    const startTime = Date.now();
    
    console.log(`🔧 Building ${agentType} agent context for deal ${dealId} (max ${(maxChars / 1000).toFixed(0)}k chars)`);

    // Get batch plan to understand document scale
    const plan = await this.calculateBatchPlan(dealId);
    
    // For small datarooms, load all documents
    if (plan.totalDocuments <= 100) {
      return this.buildContextSmallDataroom(dealId, agentType, maxChars, plan);
    }
    
    // For medium datarooms (100-500), use priority-based loading
    if (plan.totalDocuments <= 500) {
      return this.buildContextMediumDataroom(dealId, agentType, maxChars, plan);
    }
    
    // For large datarooms (500+), use intelligent sampling
    return this.buildContextLargeDataroom(dealId, agentType, maxChars, plan);
  }

  /**
   * Build context for small datarooms (<= 100 docs)
   * Loads all documents but limits per-doc character usage
   */
  private async buildContextSmallDataroom(
    dealId: number,
    agentType: string,
    maxChars: number,
    plan: BatchPlan
  ): Promise<AgentDocumentContext> {
    const startTime = Date.now();
    console.log(`📚 Small dataroom strategy: Loading all ${plan.totalDocuments} documents`);

    const result = await storage.getDocumentsByDealIdPaginated(dealId, 1, 200, false);
    const documents = result.documents || [];

    let contextParts: string[] = [];
    let totalChars = 0;
    let docCount = 0;

    // Sort by priority
    const sortedDocs = documents.sort((a, b) => 
      this.getDocumentPriority(b) - this.getDocumentPriority(a)
    );

    for (const doc of sortedDocs) {
      if (totalChars >= maxChars) break;

      const docContext = this.formatDocumentContext(doc, this.PRIORITY_DOC_CHAR_LIMIT);
      
      if (totalChars + docContext.length > maxChars) {
        // Try with smaller limit
        const smallerContext = this.formatDocumentContext(doc, this.SAMPLED_DOC_CHAR_LIMIT);
        if (totalChars + smallerContext.length <= maxChars) {
          contextParts.push(smallerContext);
          totalChars += smallerContext.length;
          docCount++;
        }
        break;
      }

      contextParts.push(docContext);
      totalChars += docContext.length;
      docCount++;
    }

    const elapsed = Date.now() - startTime;
    console.log(`✅ Small dataroom context: ${docCount} docs, ${(totalChars / 1000).toFixed(1)}k chars in ${elapsed}ms`);

    return {
      contextText: contextParts.join('\n\n---\n\n'),
      documentCount: docCount,
      totalChars,
      estimatedTokens: Math.round(totalChars / this.CHARS_PER_TOKEN),
      sampledDocuments: docCount,
      skippedDocuments: plan.totalDocuments - docCount,
      strategy: 'all'
    };
  }

  /**
   * Build context for medium datarooms (100-500 docs)
   * Uses priority-based loading with intelligent batching
   */
  private async buildContextMediumDataroom(
    dealId: number,
    agentType: string,
    maxChars: number,
    plan: BatchPlan
  ): Promise<AgentDocumentContext> {
    const startTime = Date.now();
    console.log(`📚 Medium dataroom strategy: Priority loading from ${plan.totalDocuments} documents`);

    const contextParts: string[] = [];
    let totalChars = 0;
    let docCount = 0;
    let page = 1;
    const pageSize = 50;

    // Agent-specific keywords for priority filtering
    const agentKeywords = this.getAgentKeywords(agentType);

    while (totalChars < maxChars && page <= Math.ceil(plan.totalDocuments / pageSize)) {
      const result = await storage.getDocumentsByDealIdPaginated(dealId, page, pageSize, false);
      
      if (!result.documents?.length) break;

      // Filter and prioritize documents for this agent
      const prioritizedDocs = result.documents
        .map(doc => ({
          doc,
          priority: this.getDocumentPriority(doc),
          agentRelevance: this.calculateAgentRelevance(doc, agentKeywords)
        }))
        .sort((a, b) => (b.priority + b.agentRelevance) - (a.priority + a.agentRelevance));

      for (const { doc } of prioritizedDocs) {
        if (totalChars >= maxChars) break;

        const charLimit = totalChars < maxChars * 0.6 ? this.PRIORITY_DOC_CHAR_LIMIT : this.SAMPLED_DOC_CHAR_LIMIT;
        const docContext = this.formatDocumentContext(doc, charLimit);
        
        if (totalChars + docContext.length > maxChars) continue;

        contextParts.push(docContext);
        totalChars += docContext.length;
        docCount++;
      }

      page++;
    }

    console.log(`✅ Medium dataroom context: ${docCount}/${plan.totalDocuments} docs, ${(totalChars / 1000).toFixed(1)}k chars`);

    return {
      contextText: contextParts.join('\n\n---\n\n'),
      documentCount: docCount,
      totalChars,
      estimatedTokens: Math.round(totalChars / this.CHARS_PER_TOKEN),
      sampledDocuments: docCount,
      skippedDocuments: plan.totalDocuments - docCount,
      strategy: 'priority'
    };
  }

  /**
   * Build context for large datarooms (500+ docs)
   * Uses intelligent sampling with summary-based context
   */
  private async buildContextLargeDataroom(
    dealId: number,
    agentType: string,
    maxChars: number,
    plan: BatchPlan
  ): Promise<AgentDocumentContext> {
    console.log(`📚 Large dataroom strategy: Intelligent sampling from ${plan.totalDocuments} documents`);

    const agentKeywords = this.getAgentKeywords(agentType);
    const contextParts: string[] = [];
    let totalChars = 0;
    let sampledCount = 0;

    // Phase 1: Get high-priority documents with full content (first 50)
    const highPriorityResult = await storage.getDocumentsByDealIdPaginated(dealId, 1, 50, false);
    
    if (highPriorityResult.documents?.length) {
      const prioritized = highPriorityResult.documents
        .map(doc => ({
          doc,
          score: this.getDocumentPriority(doc) + this.calculateAgentRelevance(doc, agentKeywords)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 30); // Top 30 high-priority docs

      for (const { doc } of prioritized) {
        const docContext = this.formatDocumentContext(doc, this.PRIORITY_DOC_CHAR_LIMIT);
        if (totalChars + docContext.length <= maxChars * 0.5) {
          contextParts.push(docContext);
          totalChars += docContext.length;
          sampledCount++;
        }
      }
    }

    // Phase 2: Sample remaining documents with summaries only
    const remainingBudget = maxChars - totalChars;
    const totalPages = Math.ceil(plan.totalDocuments / 100);
    const pagesToSample = Math.min(10, totalPages);
    const pageSpacing = Math.floor(totalPages / pagesToSample);

    for (let i = 0; i < pagesToSample && totalChars < maxChars; i++) {
      const pageNum = 1 + (i * pageSpacing);
      const result = await storage.getDocumentsByDealIdPaginated(dealId, pageNum, 20, true);
      
      if (!result.documents?.length) continue;

      for (const doc of result.documents) {
        if (totalChars >= maxChars) break;

        const summaryContext = this.formatSummaryContext(doc);
        if (totalChars + summaryContext.length <= maxChars) {
          contextParts.push(summaryContext);
          totalChars += summaryContext.length;
          sampledCount++;
        }
      }
    }

    console.log(`✅ Large dataroom context: ${sampledCount}/${plan.totalDocuments} docs sampled, ${(totalChars / 1000).toFixed(1)}k chars`);

    return {
      contextText: contextParts.join('\n\n---\n\n'),
      documentCount: sampledCount,
      totalChars,
      estimatedTokens: Math.round(totalChars / this.CHARS_PER_TOKEN),
      sampledDocuments: sampledCount,
      skippedDocuments: plan.totalDocuments - sampledCount,
      strategy: 'sampled'
    };
  }

  /**
   * Get agent-specific keywords for relevance scoring
   */
  private getAgentKeywords(agentType: string): string[] {
    const keywordMap: Record<string, string[]> = {
      'legal': ['contract', 'agreement', 'legal', 'terms', 'license', 'compliance', 'regulatory', 'nda', 'mou', 'amendment'],
      'clinical': ['clinical', 'trial', 'fda', 'study', 'patient', 'safety', 'efficacy', 'protocol', 'regulatory', 'approval'],
      'commercial': ['market', 'customer', 'sales', 'revenue', 'pricing', 'competition', 'growth', 'strategy', 'commercial'],
      'hr': ['employee', 'team', 'compensation', 'equity', 'vesting', 'hiring', 'org', 'personnel', 'talent', 'hr'],
      'financial': ['financial', 'revenue', 'budget', 'forecast', 'cap table', 'valuation', 'funding', 'burn', 'p&l', 'balance'],
      'ip': ['patent', 'trademark', 'ip', 'intellectual', 'invention', 'copyright', 'trade secret', 'license', 'portfolio'],
      'research': ['research', 'publication', 'study', 'data', 'analysis', 'technology', 'innovation', 'scientific', 'academic']
    };

    return keywordMap[agentType.toLowerCase()] || [];
  }

  /**
   * Calculate relevance score for a document to a specific agent
   */
  private calculateAgentRelevance(doc: any, keywords: string[]): number {
    const searchText = `${doc.name} ${doc.category || ''} ${doc.type || ''} ${doc.aiSummary || ''}`.toLowerCase();
    let score = 0;

    for (const keyword of keywords) {
      if (searchText.includes(keyword)) {
        score += 2;
      }
    }

    return Math.min(score, 10); // Cap at 10
  }

  /**
   * Format a document for context with character limit
   */
  private formatDocumentContext(doc: any, charLimit: number): string {
    const name = doc.name || 'Unnamed document';
    const category = doc.category || 'General';
    
    let summary = 'No summary available';
    if (doc.aiSummary) {
      summary = typeof doc.aiSummary === 'string' ? doc.aiSummary : JSON.stringify(doc.aiSummary);
    } else if (doc.summary) {
      summary = typeof doc.summary === 'string' ? doc.summary : JSON.stringify(doc.summary);
    }
    summary = summary.substring(0, this.SUMMARY_CHAR_LIMIT);

    let content = '';
    if (doc.ocrText) {
      content = typeof doc.ocrText === 'string' ? doc.ocrText : String(doc.ocrText);
      content = content.substring(0, charLimit);
    }

    return `Document: ${name} (${category})
Summary: ${summary}
${content ? `Content: ${content}...` : ''}`;
  }

  /**
   * Format a document with summary only (for large datarooms)
   */
  private formatSummaryContext(doc: any): string {
    const name = doc.name || 'Unnamed document';
    const category = doc.category || 'General';
    
    let summary = 'No summary';
    if (doc.aiSummary) {
      summary = typeof doc.aiSummary === 'string' ? doc.aiSummary : JSON.stringify(doc.aiSummary);
    } else if (doc.summary) {
      summary = typeof doc.summary === 'string' ? doc.summary : JSON.stringify(doc.summary);
    }
    summary = summary.substring(0, this.SUMMARY_CHAR_LIMIT);

    return `Doc: ${name} (${category}) - ${summary}`;
  }
}

export const documentBatchPlanner = DocumentBatchPlanner.getInstance();
