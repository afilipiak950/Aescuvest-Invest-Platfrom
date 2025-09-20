import OpenAI from 'openai';
import { db } from '../db';
import { sql } from 'drizzle-orm';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface CacheEntry {
  id: string;
  dealId: number;
  queryEmbedding: number[];
  query: string;
  response: string;
  language: string;
  contextHash: string; // Hash of context used for invalidation
  similarity?: number;
  createdAt: Date;
  expiresAt: Date;
}

// In-memory cache for ultra-fast access
const memoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_HOURS = 24; // 24 hour cache TTL
const SIMILARITY_THRESHOLD = 0.85; // High threshold for cache hits
const MAX_CACHE_SIZE = 1000; // Memory cache size limit

export class SemanticCacheService {
  private static instance: SemanticCacheService;
  
  static getInstance(): SemanticCacheService {
    if (!this.instance) {
      this.instance = new SemanticCacheService();
    }
    return this.instance;
  }

  /**
   * Check for semantically similar cached response
   */
  async checkCache(
    query: string, 
    dealId: number, 
    contextHash: string,
    language: string = 'English'
  ): Promise<CacheEntry | null> {
    console.log(`🔍 Checking semantic cache for query: "${query.substring(0, 50)}..."`);
    
    try {
      // Generate embedding for incoming query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // First check memory cache
      const memoryCacheHit = this.checkMemoryCache(queryEmbedding, dealId, contextHash, language);
      if (memoryCacheHit) {
        console.log(`⚡ Memory cache HIT with similarity: ${memoryCacheHit.similarity?.toFixed(3)}`);
        return memoryCacheHit;
      }
      
      // Check database cache with vector similarity
      const dbCacheHit = await this.checkDatabaseCache(queryEmbedding, dealId, contextHash, language);
      if (dbCacheHit) {
        console.log(`💾 Database cache HIT with similarity: ${dbCacheHit.similarity?.toFixed(3)}`);
        
        // Add to memory cache for future ultra-fast access
        const cacheKey = this.getCacheKey(dealId, dbCacheHit.id);
        memoryCache.set(cacheKey, dbCacheHit);
        this.cleanupMemoryCache();
        
        return dbCacheHit;
      }
      
      console.log(`❌ Cache MISS - no similar queries found`);
      return null;
    } catch (error) {
      console.error('❌ Semantic cache check failed:', error);
      return null;
    }
  }

  /**
   * Store successful response in cache
   */
  async storeResponse(
    query: string,
    response: string,
    dealId: number,
    contextHash: string,
    language: string = 'English'
  ): Promise<void> {
    try {
      console.log(`💾 Storing response in semantic cache for deal ${dealId}`);
      
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);
      
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + CACHE_TTL_HOURS);
      
      const cacheEntry: CacheEntry = {
        id: this.generateId(),
        dealId,
        queryEmbedding,
        query,
        response,
        language,
        contextHash,
        createdAt: new Date(),
        expiresAt
      };
      
      // Store in database for persistence
      await this.storeDatabaseCache(cacheEntry);
      
      // Store in memory for ultra-fast access
      const cacheKey = this.getCacheKey(dealId, cacheEntry.id);
      memoryCache.set(cacheKey, cacheEntry);
      this.cleanupMemoryCache();
      
      console.log(`✅ Cached response with ID: ${cacheEntry.id}`);
    } catch (error) {
      console.error('❌ Failed to store cache entry:', error);
    }
  }

  /**
   * Convert cached response to streaming tokens for consistent UX
   */
  async *streamCachedResponse(cacheEntry: CacheEntry): AsyncIterable<string> {
    console.log(`⚡ Streaming cached response (${cacheEntry.response.length} chars)`);
    
    const response = cacheEntry.response;
    const words = response.split(' ');
    
    // Stream response in word chunks for realistic token-like streaming
    for (let i = 0; i < words.length; i++) {
      const token = (i === 0 ? '' : ' ') + words[i];
      
      // Add slight delay for realistic streaming feel (much faster than OpenAI)
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 50)); // 50ms every 10 words
      }
      
      yield token;
    }
    
    console.log(`✅ Finished streaming cached response`);
  }

  /**
   * Generate embedding for query using OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.substring(0, 8000) // Limit input size
    });
    
    return response.data[0].embedding;
  }

  /**
   * Check memory cache for similar queries
   */
  private checkMemoryCache(
    queryEmbedding: number[], 
    dealId: number, 
    contextHash: string,
    language: string
  ): CacheEntry | null {
    const now = new Date();
    
    for (const [key, entry] of Array.from(memoryCache.entries())) {
      // Skip expired entries
      if (entry.expiresAt < now) {
        memoryCache.delete(key);
        continue;
      }
      
      // Must match deal, context, and language
      if (entry.dealId !== dealId || entry.contextHash !== contextHash || entry.language !== language) {
        continue;
      }
      
      // Calculate cosine similarity
      const similarity = this.cosineSimilarity(queryEmbedding, entry.queryEmbedding);
      
      if (similarity >= SIMILARITY_THRESHOLD) {
        return { ...entry, similarity };
      }
    }
    
    return null;
  }

  /**
   * Check database cache using pgvector similarity
   */
  private async checkDatabaseCache(
    queryEmbedding: number[], 
    dealId: number, 
    contextHash: string,
    language: string
  ): Promise<CacheEntry | null> {
    try {
      // Convert embedding to pgvector format
      const embeddingVector = `[${queryEmbedding.join(',')}]`;
      
      const result = await db.execute(sql`
        SELECT 
          id, deal_id, query, response, language, context_hash, 
          created_at, expires_at, query_embedding,
          1 - (query_embedding <=> ${embeddingVector}::vector) as similarity
        FROM ai_query_cache 
        WHERE deal_id = ${dealId} 
          AND context_hash = ${contextHash}
          AND language = ${language}
          AND expires_at > NOW()
          AND 1 - (query_embedding <=> ${embeddingVector}::vector) >= ${SIMILARITY_THRESHOLD}
        ORDER BY similarity DESC 
        LIMIT 1
      `);
      
      if (result.rows.length > 0) {
        const row = result.rows[0] as any;
        return {
          id: row.id,
          dealId: row.deal_id,
          queryEmbedding: typeof row.query_embedding === 'string' 
            ? row.query_embedding.replace(/\[|\]/g, '').split(',').map((n: string) => parseFloat(n.trim()))
            : row.query_embedding,
          query: row.query,
          response: row.response,
          language: row.language,
          contextHash: row.context_hash,
          similarity: row.similarity,
          createdAt: row.created_at,
          expiresAt: row.expires_at
        };
      }
    } catch (error) {
      console.error('Database cache check failed:', error);
    }
    
    return null;
  }

  /**
   * Store cache entry in database
   */
  private async storeDatabaseCache(entry: CacheEntry): Promise<void> {
    const embeddingVector = `[${entry.queryEmbedding.join(',')}]`;
    
    await db.execute(sql`
      INSERT INTO ai_query_cache (
        id, deal_id, query_embedding, query, response, 
        language, context_hash, created_at, expires_at
      ) VALUES (
        ${entry.id}, ${entry.dealId}, ${embeddingVector}::vector, 
        ${entry.query}, ${entry.response}, ${entry.language}, 
        ${entry.contextHash}, ${entry.createdAt.toISOString()}, 
        ${entry.expiresAt.toISOString()}
      )
      ON CONFLICT (id) DO UPDATE SET
        response = EXCLUDED.response,
        expires_at = EXCLUDED.expires_at
    `);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
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

  /**
   * Cleanup memory cache to prevent memory leaks
   */
  private cleanupMemoryCache(): void {
    const now = new Date();
    
    // Remove expired entries
    for (const [key, entry] of Array.from(memoryCache.entries())) {
      if (entry.expiresAt < now) {
        memoryCache.delete(key);
      }
    }
    
    // Remove oldest entries if cache is too large
    if (memoryCache.size > MAX_CACHE_SIZE) {
      const entries = Array.from(memoryCache.entries());
      entries.sort((a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime());
      
      const toRemove = entries.slice(0, memoryCache.size - MAX_CACHE_SIZE);
      for (const [key] of toRemove) {
        memoryCache.delete(key);
      }
    }
  }

  /**
   * Generate cache key
   */
  private getCacheKey(dealId: number, id: string): string {
    return `${dealId}:${id}`;
  }

  /**
   * Generate unique ID for cache entry
   */
  private generateId(): string {
    return `cache_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    const now = new Date();
    const validEntries = Array.from(memoryCache.values()).filter(entry => entry.expiresAt > now);
    
    return {
      memoryCacheSize: validEntries.length,
      totalMemoryEntries: memoryCache.size,
      cacheThreshold: SIMILARITY_THRESHOLD,
      maxCacheSize: MAX_CACHE_SIZE,
      ttlHours: CACHE_TTL_HOURS
    };
  }

  /**
   * Clear cache for a specific deal (useful for testing)
   */
  async clearDealCache(dealId: number): Promise<void> {
    // Clear memory cache
    for (const [key, entry] of Array.from(memoryCache.entries())) {
      if (entry.dealId === dealId) {
        memoryCache.delete(key);
      }
    }
    
    // Clear database cache
    await db.execute(sql`
      DELETE FROM ai_query_cache WHERE deal_id = ${dealId}
    `);
    
    console.log(`🗑️ Cleared cache for deal ${dealId}`);
  }

  /**
   * Cleanup expired cache entries from database
   * Should be called periodically (e.g., daily cron job)
   */
  async cleanupExpiredEntries(): Promise<{ deletedCount: number }> {
    try {
      const result = await db.execute(sql`
        DELETE FROM ai_query_cache WHERE expires_at < NOW()
      `);
      
      const deletedCount = result.rowCount || 0;
      console.log(`🧹 Cleaned up ${deletedCount} expired cache entries`);
      
      return { deletedCount };
    } catch (error) {
      console.error('❌ Failed to cleanup expired cache entries:', error);
      return { deletedCount: 0 };
    }
  }

  /**
   * Get detailed cache statistics including database metrics
   */
  async getDetailedCacheStats() {
    try {
      const [totalEntries, validEntries, expiredEntries] = await Promise.all([
        db.execute(sql`SELECT COUNT(*) as count FROM ai_query_cache`),
        db.execute(sql`SELECT COUNT(*) as count FROM ai_query_cache WHERE expires_at > NOW()`),
        db.execute(sql`SELECT COUNT(*) as count FROM ai_query_cache WHERE expires_at <= NOW()`)
      ]);

      const basicStats = this.getCacheStats();
      
      return {
        ...basicStats,
        databaseStats: {
          totalEntries: (totalEntries.rows[0] as any)?.count || 0,
          validEntries: (validEntries.rows[0] as any)?.count || 0,
          expiredEntries: (expiredEntries.rows[0] as any)?.count || 0
        }
      };
    } catch (error) {
      console.error('Failed to get detailed cache stats:', error);
      return this.getCacheStats();
    }
  }
}

export const semanticCacheService = SemanticCacheService.getInstance();