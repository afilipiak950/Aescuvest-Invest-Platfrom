import OpenAI from 'openai';
import { db } from '../db';
import { documentEmbeddings, queryCache } from '@shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Optimized chunk size for legal content analysis
const CHUNK_SIZE = 300; // tokens - smaller chunks for precise legal clause matching
const CHUNK_OVERLAP = 100; // tokens - higher overlap to preserve clause context
const EMBEDDING_MODEL = 'text-embedding-3-large'; // Higher-quality embeddings for better legal recall
const TOP_K_RESULTS = 50; // Increased retrieval for source diversity (15-25 unique sources)

interface ChunkMetadata {
  documentId: number;
  documentName: string;
  documentType?: string;
  chunkIndex: number;
  totalChunks: number;
  dealId: number;
}

export class EmbeddingService {
  // Split text into chunks with overlap
  static splitIntoChunks(text: string, maxTokens = CHUNK_SIZE): string[] {
    // Simple word-based chunking (approximation of tokens)
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    
    for (let i = 0; i < words.length; i += (maxTokens - CHUNK_OVERLAP)) {
      const chunk = words.slice(i, i + maxTokens).join(' ');
      if (chunk.trim()) {
        chunks.push(chunk);
      }
    }
    
    return chunks;
  }

  // Generate embedding for text
  static async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text,
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  // Process and embed a document
  static async embedDocument(
    documentId: number,
    dealId: number,
    documentName: string,
    text: string,
    documentType?: string
  ): Promise<void> {
    console.log(`🔄 Embedding document: ${documentName} (ID: ${documentId})`);
    
    // Check if embeddings already exist for this document using raw SQL
    const existing = await db.execute(sql`
      SELECT id FROM document_embeddings 
      WHERE document_id = ${documentId} 
      LIMIT 1
    `);
    
    if (existing.rows && existing.rows.length > 0) {
      console.log(`✅ Embeddings already exist for document ${documentId}`);
      return;
    }
    
    // Split into chunks
    const chunks = this.splitIntoChunks(text);
    console.log(`📄 Split document into ${chunks.length} chunks`);
    
    // Generate embeddings for each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await this.generateEmbedding(chunk);
      
      const metadata: ChunkMetadata = {
        documentId,
        documentName,
        documentType,
        chunkIndex: i,
        totalChunks: chunks.length,
        dealId,
      };
      
      // Store in database using raw SQL since Drizzle doesn't support pgvector natively
      // pgvector expects a string format like '[0.1, 0.2, 0.3, ...]'
      const embeddingString = `[${embedding.join(',')}]`;
      const tokenCount = chunk.split(/\s+/).length;
      
      // Use raw SQL for pgvector insertion
      await db.execute(sql`
        INSERT INTO document_embeddings (
          document_id, 
          deal_id, 
          chunk_index, 
          chunk_text, 
          embedding, 
          token_count, 
          metadata
        ) VALUES (
          ${documentId},
          ${dealId},
          ${i},
          ${chunk},
          ${embeddingString}::vector,
          ${tokenCount},
          ${JSON.stringify(metadata)}::jsonb
        )
      `);
      
      console.log(`✅ Embedded chunk ${i + 1}/${chunks.length} for ${documentName}`);
    }
  }

  // Calculate cosine similarity between two vectors
  static cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Search for relevant chunks using semantic similarity with optional intent-based filtering
  static async searchSimilarChunks(
    query: string,
    dealId: number | null,
    topK = TOP_K_RESULTS,
    agentTypes?: string[] // Optional intent-based filtering
  ): Promise<Array<{ chunk: string; metadata: ChunkMetadata; similarity: number; content?: string; documentName?: string }>> {
    const intentFilter = agentTypes && agentTypes.length > 0 ? ` (filtering by ${agentTypes.join(', ')})` : '';
    console.log(`🔍 Searching for relevant chunks for query: "${query.substring(0, 50)}..." (dealId: ${dealId || 'global'})${intentFilter}`);
    
    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);
    const embeddingString = `[${queryEmbedding.join(',')}]`;
    
    // Build the intent-based filter condition
    let agentTypeFilter = '';
    let agentTypeParams: any[] = [];
    
    if (agentTypes && agentTypes.length > 0) {
      agentTypeFilter = `AND d.agent_type = ANY($${agentTypeParams.length + 1})`;
      agentTypeParams.push(agentTypes);
    }
    
    // Use PostgreSQL's native vector similarity search with pgvector
    // Join with documents table to filter by agent type if specified
    let results;
    
    if (dealId === null) {
      // Global search across all deals with optional intent filtering
      if (agentTypes && agentTypes.length > 0) {
        results = await db.execute(sql`
          SELECT 
            de.chunk_text,
            de.metadata,
            de.deal_id,
            1 - (de.embedding <=> ${embeddingString}::vector) as similarity
          FROM document_embeddings de
          JOIN documents d ON de.document_id = d.id
          WHERE d.agent_type = ANY(${agentTypes}::text[])
          ORDER BY de.embedding <=> ${embeddingString}::vector
          LIMIT ${topK}
        `);
      } else {
        results = await db.execute(sql`
          SELECT 
            chunk_text,
            metadata,
            deal_id,
            1 - (embedding <=> ${embeddingString}::vector) as similarity
          FROM document_embeddings
          ORDER BY embedding <=> ${embeddingString}::vector
          LIMIT ${topK}
        `);
      }
    } else {
      // Deal-specific search with optional intent filtering
      if (agentTypes && agentTypes.length > 0) {
        results = await db.execute(sql`
          SELECT 
            de.chunk_text,
            de.metadata,
            de.deal_id,
            1 - (de.embedding <=> ${embeddingString}::vector) as similarity
          FROM document_embeddings de
          JOIN documents d ON de.document_id = d.id
          WHERE de.deal_id = ${dealId}
          AND d.agent_type = ANY(${agentTypes}::text[])
          ORDER BY de.embedding <=> ${embeddingString}::vector
          LIMIT ${topK}
        `);
      } else {
        results = await db.execute(sql`
          SELECT 
            chunk_text,
            metadata,
            deal_id,
            1 - (embedding <=> ${embeddingString}::vector) as similarity
          FROM document_embeddings
          WHERE deal_id = ${dealId}
          ORDER BY embedding <=> ${embeddingString}::vector
          LIMIT ${topK}
        `);
      }
    }
    
    const topResults = results.rows.map((row: any) => ({
      chunk: row.chunk_text,
      content: row.chunk_text, // Add content field for compatibility
      documentName: row.metadata?.documentName || 'Unknown Document',
      metadata: row.metadata as ChunkMetadata,
      similarity: row.similarity,
      dealId: row.deal_id
    }));
    
    console.log(`✅ Found ${topResults.length} relevant chunks`);
    if (topResults.length > 0) {
      console.log(`📊 Top similarity scores: ${topResults.slice(0, 3).map(r => r.similarity?.toFixed(3) || 'N/A').join(', ')}`);
      console.log(`📄 Top documents: ${topResults.slice(0, 3).map(r => r.documentName).join(', ')}`);
    } else {
      console.log(`⚠️ No relevant chunks found for query`);
    }
    
    // Apply MMR (Maximal Marginal Relevance) for source diversity
    const diverseResults = this.applyMMRDiversity(topResults, queryEmbedding, {
      lambda: 0.7, // Balance relevance vs diversity (0.7 = 70% relevance, 30% diversity)
      maxPerDocument: 3, // Maximum 3 chunks per document for source diversity
      targetSources: 25 // Target 15-25 unique sources
    });

    console.log(`🎯 MMR Diversity applied: ${diverseResults.length} chunks from ${new Set(diverseResults.map(r => r.documentName)).size} unique sources`);
    console.log(`📊 Filtered similarity scores: ${diverseResults.slice(0, 3).map(r => r.similarity?.toFixed(3) || 'N/A').join(', ')}`);

    return diverseResults;
  }

  // Apply Maximal Marginal Relevance (MMR) for source diversity
  static applyMMRDiversity(
    results: Array<{ chunk: string; metadata: ChunkMetadata; similarity: number; content?: string; documentName?: string; dealId?: number }>,
    queryEmbedding: number[],
    options: { lambda: number; maxPerDocument: number; targetSources: number }
  ): Array<{ chunk: string; metadata: ChunkMetadata; similarity: number; content?: string; documentName?: string; dealId?: number }> {
    if (results.length === 0) return results;

    const { lambda, maxPerDocument, targetSources } = options;
    const selected: typeof results = [];
    const remaining = [...results];
    const documentCounts = new Map<string, number>();

    // Select first result (highest similarity)
    if (remaining.length > 0) {
      const first = remaining.shift()!;
      selected.push(first);
      documentCounts.set(first.documentName || 'Unknown', 1);
    }

    // Iteratively select results balancing relevance and diversity
    while (selected.length < targetSources && remaining.length > 0) {
      let bestScore = -1;
      let bestIndex = -1;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const docName = candidate.documentName || 'Unknown';
        
        // Skip if document already has max chunks
        if ((documentCounts.get(docName) || 0) >= maxPerDocument) {
          continue;
        }

        // Calculate relevance score (similarity to query)
        const relevanceScore = candidate.similarity || 0;

        // Calculate diversity score (minimum similarity to already selected chunks)
        let minSimilarityToSelected = 1.0;
        
        for (const selectedChunk of selected) {
          try {
            // For diversity calculation, we approximate with a simple text overlap metric
            // In a full implementation, you'd compare embeddings directly
            const textOverlap = this.calculateTextOverlap(candidate.chunk, selectedChunk.chunk);
            if (textOverlap < minSimilarityToSelected) {
              minSimilarityToSelected = textOverlap;
            }
          } catch (error) {
            // Fallback to document name comparison if text comparison fails
            minSimilarityToSelected = docName === (selectedChunk.documentName || 'Unknown') ? 0.5 : 0.1;
          }
        }

        const diversityScore = 1 - minSimilarityToSelected;

        // MMR score: λ * relevance + (1-λ) * diversity
        const mmrScore = lambda * relevanceScore + (1 - lambda) * diversityScore;

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIndex = i;
        }
      }

      // Add best result
      if (bestIndex >= 0) {
        const selected_result = remaining.splice(bestIndex, 1)[0];
        selected.push(selected_result);
        const docName = selected_result.documentName || 'Unknown';
        documentCounts.set(docName, (documentCounts.get(docName) || 0) + 1);
      } else {
        break; // No more valid candidates
      }
    }

    return selected;
  }

  // Simple text overlap calculation for diversity scoring
  static calculateTextOverlap(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;
    
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    
    if (words1.size === 0 || words2.size === 0) return 0;
    
    let intersection = 0;
    for (const word of Array.from(words1)) {
      if (words2.has(word)) intersection++;
    }
    
    return intersection / Math.min(words1.size, words2.size);
  }

  // Check if a similar query has been cached
  static async getCachedResponse(
    query: string,
    dealId: number,
    similarityThreshold = 0.95
  ): Promise<string | null> {
    const queryEmbedding = await this.generateEmbedding(query);
    
    // Get recent cached queries for this deal
    const cachedQueries = await db
      .select()
      .from(queryCache)
      .where(
        and(
          eq(queryCache.dealId, dealId),
          sql`${queryCache.expiresAt} > NOW()`
        )
      )
      .orderBy(desc(queryCache.createdAt))
      .limit(50);
    
    // Find most similar cached query
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const cached of cachedQueries) {
      const similarity = this.cosineSimilarity(
        queryEmbedding,
        cached.queryEmbedding as number[]
      );
      
      if (similarity > bestSimilarity && similarity >= similarityThreshold) {
        bestMatch = cached;
        bestSimilarity = similarity;
      }
    }
    
    if (bestMatch) {
      console.log(`🎯 Found cached response with similarity: ${bestSimilarity.toFixed(3)}`);
      return bestMatch.response;
    }
    
    return null;
  }

  // Cache a query response
  static async cacheResponse(
    query: string,
    response: string,
    dealId: number,
    ttlMinutes = 60
  ): Promise<void> {
    const queryEmbedding = await this.generateEmbedding(query);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    
    await db.insert(queryCache).values({
      dealId,
      queryText: query,
      queryEmbedding: queryEmbedding as any,
      response,
      expiresAt,
    });
    
    console.log(`💾 Cached response for query (expires in ${ttlMinutes} minutes)`);
  }

  // SIMPLIFIED: Non-blocking embedding for instant analysis start
  static async embedMissingDocuments(dealId: number): Promise<void> {
    try {
      console.log(`⚡ Quick check: embedding status for deal ${dealId}...`);
      
      // Just count missing embeddings without blocking
      const missingCount = await db.execute(sql`
        SELECT COUNT(*) as missing
        FROM documents d
        LEFT JOIN document_embeddings de ON d.id = de.document_id
        WHERE d.deal_id = ${dealId}
        AND de.document_id IS NULL 
        AND d.ocr_text IS NOT NULL 
        AND LENGTH(d.ocr_text) > 100
      `);
      
      const missing = (missingCount.rows[0] as any)?.missing || 0;
      
      if (missing === 0) {
        console.log(`✅ All documents already embedded for deal ${dealId}`);
        return;
      }

      console.log(`⚡ ${missing} documents need embedding - starting background process`);
      
      // Start background embedding WITHOUT blocking analysis
      this.startBackgroundEmbedding(dealId).catch(error => {
        console.error(`❌ Background embedding failed for deal ${dealId}:`, error);
      });
      
      console.log(`✅ Analysis can proceed immediately with existing embeddings`);
    } catch (error) {
      console.error(`❌ Embedding check failed for deal ${dealId}:`, error);
      // Don't throw - allow analysis to continue even if embedding check fails
    }
  }

  // Background embedding process - non-blocking
  private static async startBackgroundEmbedding(dealId: number): Promise<void> {
    console.log(`🔄 Background embedding started for deal ${dealId}`);
    
    const documentsToEmbed = await db.execute(sql`
      SELECT d.id, d.deal_id, d.name, d.ocr_text, d.agent_type
      FROM documents d
      LEFT JOIN document_embeddings de ON d.id = de.document_id
      WHERE d.deal_id = ${dealId}
      AND de.document_id IS NULL 
      AND d.ocr_text IS NOT NULL 
      AND LENGTH(d.ocr_text) > 100
      ORDER BY d.id
      LIMIT 20
    `);
    
    // Process only first 20 documents to avoid overwhelming the system
    for (const doc of documentsToEmbed.rows) {
      try {
        await this.embedDocument(
          doc.id as number,
          doc.deal_id as number,
          doc.name as string,
          doc.ocr_text as string,
          doc.agent_type as string
        );
        
        // Shorter delay for background processing
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Background embed failed for document ${doc.id}:`, error);
      }
    }
    
    console.log(`✅ Background embedding batch completed for deal ${dealId}`);
  }

  // Get embedding statistics for a deal
  static async getEmbeddingStats(dealId: number) {
    const embeddings = await db
      .select()
      .from(documentEmbeddings)
      .where(eq(documentEmbeddings.dealId, dealId));
    
    const uniqueDocuments = new Set(embeddings.map(e => e.documentId));
    const totalTokens = embeddings.reduce((sum, e) => sum + e.tokenCount, 0);
    
    return {
      totalChunks: embeddings.length,
      uniqueDocuments: uniqueDocuments.size,
      totalTokens,
      averageChunkSize: totalTokens / embeddings.length || 0,
    };
  }
}