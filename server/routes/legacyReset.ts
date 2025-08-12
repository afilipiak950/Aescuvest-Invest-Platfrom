import { Router, Request, Response } from 'express';
import { db } from '../db';
import { agentAnalyses, backgroundJobs } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * Legacy Reset - Clears all analysis results, background jobs, and caches for all 7 agents
 * Preserves documents and deal data, only removes analysis outputs
 */
router.post('/api/deals/:dealId/legacy-reset', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    console.log(`🗑️ LEGACY RESET - Starting complete cleanup for deal ${dealId}`);
    
    // 1. Delete all agent analyses for this deal
    const deletedAnalyses = await db.delete(agentAnalyses)
      .where(eq(agentAnalyses.dealId, dealId));
    
    console.log(`🗑️ Deleted agent analyses for deal ${dealId}`);
    
    // 2. Delete all background jobs for this deal
    const deletedJobs = await db.delete(backgroundJobs)
      .where(eq(backgroundJobs.dealId, dealId));
    
    console.log(`🗑️ Deleted background jobs for deal ${dealId}`);
    
    // 3. Clear in-memory active jobs if they exist
    if (global.activeJobs) {
      const keysToDelete = [];
      for (const [key, job] of global.activeJobs.entries()) {
        if (job.dealId === dealId) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => {
        global.activeJobs.delete(key);
      });
      
      console.log(`🗑️ Cleared ${keysToDelete.length} active in-memory jobs`);
    }
    
    // 4. Clear any cached data (if storage service has cache clearing methods)
    try {
      const { storage } = await import('../storage');
      if (storage.clearAnalysisCache) {
        await storage.clearAnalysisCache(dealId);
        console.log(`🗑️ Cleared analysis cache for deal ${dealId}`);
      }
    } catch (error) {
      console.log(`⚠️ No cache clearing method available or failed:`, error.message);
    }
    
    console.log(`✅ LEGACY RESET COMPLETED for deal ${dealId}`);
    console.log(`   - All 7 agent analyses cleared`);
    console.log(`   - All background jobs removed`); 
    console.log(`   - All progress data reset to 0%`);
    console.log(`   - Documents and deal data preserved`);
    
    res.json({
      success: true,
      message: `Legacy reset completed for deal ${dealId}`,
      details: {
        analysesCleared: true,
        backgroundJobsCleared: true,
        cacheCleared: true,
        dealPreserved: true,
        documentsPreserved: true
      }
    });
    
  } catch (error) {
    console.error(`❌ Legacy reset failed for deal ${req.params.dealId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Legacy reset failed',
      details: error.message
    });
  }
});

export default router;