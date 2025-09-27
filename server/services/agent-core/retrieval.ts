import { db } from "../../db";
import { documentEmbeddings } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface RetrievalOptions {
  dealId: number;
  queries: string[];
  topK?: number;
  minSimilarity?: number;
  useMMR?: boolean;
  diversityLambda?: number;
}

export interface EvidenceChunk {
  documentId: number;
  documentName: string;
  chunkId: string;
  chunkText: string;
  similarity: number;
  page?: number;
  metadata?: any;
}

export interface EvidencePack {
  query: string;
  chunks: EvidenceChunk[];
  totalChunks: number;
  averageSimilarity: number;
}

/**
 * Multi-query expansion for better retrieval
 * Expands a single query into multiple related queries
 */
export async function expandQuery(query: string, agentType: string): Promise<string[]> {
  const domainContext = {
    legal: "legal contracts, agreements, terms, liabilities, compliance",
    clinical: "clinical trials, medical data, FDA approval, patient outcomes",
    commercial: "market size, revenue, customers, competition, growth",
    hr: "employees, compensation, culture, management, organizational structure",
    financial: "revenue, expenses, burn rate, valuation, financial metrics",
    ip: "patents, trademarks, intellectual property, licensing, freedom to operate",
    research: "market research, industry trends, competitive landscape, technology",
  };

  const context = domainContext[agentType as keyof typeof domainContext] || "";
  
  // Generate 3-5 related queries for better coverage
  const prompt = `Given this investment due diligence question in the ${agentType} domain (${context}):
"${query}"

Generate 3 alternative search queries that would help find relevant information. 
Return only the queries, one per line, no numbering or explanations.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    });

    const expandedQueries = response.choices[0]?.message?.content
      ?.split("\n")
      .filter(q => q.trim().length > 0)
      .map(q => q.trim()) || [];

    return [query, ...expandedQueries].slice(0, 5); // Original + up to 4 expansions
  } catch (error) {
    console.error("Query expansion failed, using original query:", error);
    return [query];
  }
}

/**
 * Generate embedding for a query
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error("Embedding generation failed:", error);
    throw error;
  }
}

/**
 * Retrieve relevant documents using semantic search
 */
async function semanticSearch(
  dealId: number,
  query: string,
  topK: number = 10,
  minSimilarity: number = 0.3
): Promise<EvidenceChunk[]> {
  const embedding = await generateEmbedding(query);
  
  // Use pgvector for similarity search
  const results = await db.execute(sql`
    SELECT 
      de.id,
      de.document_id,
      de.chunk_index,
      de.chunk_text,
      de.metadata,
      d.file_name,
      1 - (de.embedding <=> ${JSON.stringify(embedding)}::vector) as similarity
    FROM document_embeddings de
    JOIN documents d ON de.document_id = d.id
    WHERE de.deal_id = ${dealId}
      AND 1 - (de.embedding <=> ${JSON.stringify(embedding)}::vector) > ${minSimilarity}
    ORDER BY similarity DESC
    LIMIT ${topK}
  `);

  return results.map((row: any) => ({
    documentId: row.document_id,
    documentName: row.file_name,
    chunkId: `${row.document_id}_${row.chunk_index}`,
    chunkText: row.chunk_text,
    similarity: row.similarity,
    page: row.metadata?.page,
    metadata: row.metadata,
  }));
}

/**
 * Apply Maximum Marginal Relevance (MMR) for diversity
 */
function applyMMR(
  chunks: EvidenceChunk[],
  lambda: number = 0.7,
  topK: number = 10
): EvidenceChunk[] {
  if (chunks.length <= topK) return chunks;

  const selected: EvidenceChunk[] = [];
  const remaining = [...chunks];

  // Select the most relevant document first
  selected.push(remaining.shift()!);

  while (selected.length < topK && remaining.length > 0) {
    let bestScore = -Infinity;
    let bestIndex = -1;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      
      // Relevance score (similarity to query)
      const relevance = candidate.similarity;
      
      // Diversity score (minimum similarity to selected documents)
      let minSimilarity = 1;
      for (const selectedChunk of selected) {
        // Simple text overlap as similarity proxy
        const overlap = calculateTextOverlap(candidate.chunkText, selectedChunk.chunkText);
        minSimilarity = Math.min(minSimilarity, overlap);
      }
      
      // MMR score = λ * relevance - (1 - λ) * max_similarity
      const mmrScore = lambda * relevance - (1 - lambda) * (1 - minSimilarity);
      
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0) {
      selected.push(remaining.splice(bestIndex, 1)[0]);
    } else {
      break;
    }
  }

  return selected;
}

/**
 * Calculate text overlap between two chunks (simplified Jaccard similarity)
 */
function calculateTextOverlap(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Main retrieval function with multi-query expansion and MMR
 */
export async function retrieveEvidence(options: RetrievalOptions): Promise<EvidencePack[]> {
  const {
    dealId,
    queries,
    topK = 10,
    minSimilarity = 0.3,
    useMMR = true,
    diversityLambda = 0.7,
  } = options;

  const evidencePacks: EvidencePack[] = [];

  for (const query of queries) {
    try {
      // Retrieve chunks for this query
      let chunks = await semanticSearch(dealId, query, topK * 2, minSimilarity);
      
      // Apply MMR for diversity if requested
      if (useMMR && chunks.length > 0) {
        chunks = applyMMR(chunks, diversityLambda, topK);
      } else {
        chunks = chunks.slice(0, topK);
      }

      // Calculate average similarity
      const avgSimilarity = chunks.length > 0
        ? chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length
        : 0;

      evidencePacks.push({
        query,
        chunks,
        totalChunks: chunks.length,
        averageSimilarity: avgSimilarity,
      });

      console.log(`✅ Retrieved ${chunks.length} chunks for query: "${query.substring(0, 50)}..."`);
      console.log(`📊 Average similarity: ${avgSimilarity.toFixed(3)}`);
    } catch (error) {
      console.error(`❌ Retrieval failed for query "${query}":`, error);
      evidencePacks.push({
        query,
        chunks: [],
        totalChunks: 0,
        averageSimilarity: 0,
      });
    }
  }

  return evidencePacks;
}

/**
 * Retrieve evidence with query expansion
 */
export async function retrieveWithExpansion(
  dealId: number,
  baseQuery: string,
  agentType: string,
  topK: number = 10
): Promise<EvidencePack[]> {
  // Expand the query
  const expandedQueries = await expandQuery(baseQuery, agentType);
  
  console.log(`🔍 Expanded query into ${expandedQueries.length} queries:`, expandedQueries);
  
  // Retrieve evidence for all expanded queries
  const evidencePacks = await retrieveEvidence({
    dealId,
    queries: expandedQueries,
    topK: Math.ceil(topK / expandedQueries.length), // Distribute topK across queries
    useMMR: true,
  });

  // Merge and deduplicate chunks from all queries
  const allChunks = new Map<string, EvidenceChunk>();
  
  for (const pack of evidencePacks) {
    for (const chunk of pack.chunks) {
      const existing = allChunks.get(chunk.chunkId);
      if (!existing || chunk.similarity > existing.similarity) {
        allChunks.set(chunk.chunkId, chunk);
      }
    }
  }

  // Sort by similarity and take top K
  const mergedChunks = Array.from(allChunks.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  // Return a single merged evidence pack
  return [{
    query: baseQuery,
    chunks: mergedChunks,
    totalChunks: mergedChunks.length,
    averageSimilarity: mergedChunks.length > 0
      ? mergedChunks.reduce((sum, c) => sum + c.similarity, 0) / mergedChunks.length
      : 0,
  }];
}