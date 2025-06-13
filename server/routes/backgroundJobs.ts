import { Router, Request, Response } from 'express';
import { backgroundJobManager } from '../services/backgroundJobManager';

const router = Router();

// Get active jobs for a deal
router.get('/api/background-jobs/:dealId', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    // Direct database query to debug
    const { db } = await import('../db');
    const { backgroundJobs } = await import('../../shared/schema');
    const { eq, and } = await import('drizzle-orm');
    
    const dbJobs = await db.select().from(backgroundJobs)
      .where(and(
        eq(backgroundJobs.dealId, dealId),
        eq(backgroundJobs.status, 'processing')
      ));
    
    console.log(`📊 Direct DB query found ${dbJobs.length} processing jobs for deal ${dealId}`);
    if (dbJobs.length > 0) {
      console.log('Job details:', dbJobs[0]);
    }
    
    const jobs = await backgroundJobManager.getActiveJobs(dealId);
    console.log(`📊 BackgroundJobManager returned ${jobs.length} jobs for deal ${dealId}`);
    
    res.json({ success: true, jobs });
  } catch (error) {
    console.error('Error fetching background jobs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch background jobs' });
  }
});

// Get all active jobs
router.get('/api/background-jobs', async (req: Request, res: Response) => {
  try {
    const jobs = await backgroundJobManager.getActiveJobs();
    res.json({ success: true, jobs: Array.from(jobs.values()) });
  } catch (error) {
    console.error('Error fetching all background jobs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch background jobs' });
  }
});

// Cancel a specific job
router.post('/api/background-jobs/:jobId/cancel', async (req: Request, res: Response) => {
  try {
    const jobId = parseInt(req.params.jobId);
    
    if (isNaN(jobId)) {
      return res.status(400).json({ success: false, error: 'Invalid job ID' });
    }
    
    // Cancel the job via background job manager
    const success = await backgroundJobManager.cancelJob(jobId);
    
    if (success) {
      console.log(`🛑 Job ${jobId} cancelled successfully`);
      res.json({ 
        success: true, 
        message: `Job ${jobId} has been cancelled`,
        jobId 
      });
    } else {
      res.status(404).json({ 
        success: false, 
        error: `Job ${jobId} not found or already completed` 
      });
    }
  } catch (error) {
    console.error('Error cancelling background job:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel background job' });
  }
});

export default router;