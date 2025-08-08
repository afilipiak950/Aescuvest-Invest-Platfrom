import { Router, Request, Response } from 'express';
import { db } from '../db';
import { backgroundJobs } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Force stop all fragmented jobs for a deal and prevent new ones
router.post('/api/deals/:dealId/force-stop-all-jobs', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    if (isNaN(dealId)) {
      return res.status(400).json({ success: false, error: 'Invalid deal ID' });
    }

    console.log(`🛑 Force stopping ALL fragmented jobs for deal ${dealId}`);

    // Delete ALL background job records for this deal
    const deletedJobs = await db
      .delete(backgroundJobs)
      .where(eq(backgroundJobs.dealId, dealId))
      .returning();

    console.log(`✅ Deleted ${deletedJobs.length} background job records for deal ${dealId}`);

    res.json({
      success: true,
      message: `Stopped and deleted ${deletedJobs.length} fragmented jobs`,
      deletedJobs: deletedJobs.length,
      jobIds: deletedJobs.map(job => job.jobId)
    });

  } catch (error) {
    console.error('❌ Error force stopping fragmented jobs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to stop fragmented jobs' 
    });
  }
});

export default router;