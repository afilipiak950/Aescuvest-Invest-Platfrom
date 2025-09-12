/**
 * Global cache service for managing document caches across all routes
 */

// In-memory cache for paginated documents
const paginatedDocumentCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Clear paginated document cache for a specific deal
 */
export function clearPaginatedDocumentCache(dealId: number): void {
  const cacheKey = `documents_deal_${dealId}`;
  const deleted = paginatedDocumentCache.delete(cacheKey);
  if (deleted) {
    console.log(`🧹 Cleared paginated document cache for deal ${dealId}`);
  } else {
    console.log(`📭 No paginated cache to clear for deal ${dealId}`);
  }
}

/**
 * Get from paginated document cache
 */
export function getPaginatedDocumentCache(dealId: number): any | null {
  const cacheKey = `documents_deal_${dealId}`;
  const cached = paginatedDocumentCache.get(cacheKey);
  
  if (cached) {
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_TTL) {
      console.log(`✅ Paginated cache hit for deal ${dealId} (age: ${(age/1000).toFixed(1)}s)`);
      return cached.data;
    } else {
      console.log(`⏰ Paginated cache expired for deal ${dealId} (age: ${(age/1000).toFixed(1)}s)`);
      paginatedDocumentCache.delete(cacheKey);
    }
  }
  
  return null;
}

/**
 * Set paginated document cache
 */
export function setPaginatedDocumentCache(dealId: number, data: any): void {
  const cacheKey = `documents_deal_${dealId}`;
  paginatedDocumentCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
  console.log(`💾 Cached paginated documents for deal ${dealId}`);
}

/**
 * Clear all caches for a deal (both paginated and storage)
 */
export async function clearAllDocumentCaches(dealId: number): Promise<void> {
  // Clear paginated cache
  clearPaginatedDocumentCache(dealId);
  
  // Clear storage cache
  try {
    const { storage } = await import('../storage');
    await storage.invalidateDocumentCache(dealId);
    console.log(`🧹 Cleared storage cache for deal ${dealId}`);
  } catch (error) {
    console.error(`❌ Failed to clear storage cache for deal ${dealId}:`, error);
  }
}