import { Router, Request, Response } from 'express';
import { backgroundJobManager } from '../services/backgroundJobManager';

const router = Router();

// Get active jobs for a deal
router.get('/api/background-jobs/:dealId', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    // Get in-memory jobs first (primary source)
    const inMemoryJobs = [];
    if (global.activeJobs) {
      for (const [jobId, job] of global.activeJobs.entries()) {
        if (job.dealId === dealId && job.status === 'processing') {
          inMemoryJobs.push({
            jobId: job.id,
            progress: job.progress,
            status: job.status,
            currentStep: `${job.currentStep}/${job.totalSteps}`,
            documentName: job.currentDocumentName,
            agentType: job.agentType,
            metadata: job.metadata
          });
        }
      }
    }
    
    if (inMemoryJobs.length > 0) {
      console.log(`📊 Found ${inMemoryJobs.length} active in-memory jobs for deal ${dealId}`);
      return res.json({ success: true, jobs: inMemoryJobs });
    }
    
    // Fallback to database jobs
    const { db } = await import('../db');
    const { backgroundJobs } = await import('../../shared/schema');
    const { eq, and } = await import('drizzle-orm');
    
    const dbJobs = await db.select().from(backgroundJobs)
      .where(and(
        eq(backgroundJobs.dealId, dealId),
        eq(backgroundJobs.status, 'processing')
      ));
    
    console.log(`📊 Found ${dbJobs.length} database jobs for deal ${dealId}`);
    
    const jobs = await backgroundJobManager.getActiveJobs(dealId);
    
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

// Cancel a specific job (numeric ID)
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

// Stop a specific job (string ID like legal_analysis_22_1752937740692)
router.post('/api/background-jobs/:jobId/stop', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId;
    
    if (!jobId) {
      return res.status(400).json({ success: false, error: 'Job ID is required' });
    }
    
    console.log(`🛑 Attempting to stop job: ${jobId}`);
    
    // Get the job from database using string jobId
    const { db } = await import('../db');
    const { backgroundJobs } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const [job] = await db.select().from(backgroundJobs)
      .where(eq(backgroundJobs.jobId, jobId));
    
    if (!job) {
      return res.status(404).json({ 
        success: false, 
        error: `Job ${jobId} not found` 
      });
    }
    
    if (job.status !== 'processing') {
      return res.status(400).json({ 
        success: false, 
        error: `Job ${jobId} is not running (status: ${job.status})` 
      });
    }
    
    // Update job status to cancelled
    await db.update(backgroundJobs)
      .set({ 
        status: 'cancelled',
        currentStep: 'Cancelled by user',
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(backgroundJobs.jobId, jobId));
    
    // Clear from in-memory active jobs if it exists
    if (global.activeJobs) {
      for (const [key, activeJob] of global.activeJobs.entries()) {
        if (activeJob.id === jobId || activeJob.jobId === jobId) {
          global.activeJobs.delete(key);
          break;
        }
      }
    }
    
    console.log(`🛑 Job ${jobId} stopped successfully`);
    res.json({ 
      success: true, 
      message: `Job ${jobId} has been stopped`,
      jobId 
    });
    
  } catch (error) {
    console.error('Error stopping background job:', error);
    res.status(500).json({ success: false, error: 'Failed to stop background job' });
  }
});

// Clear stuck jobs for a deal (jobs that haven't made progress in 10 minutes)
router.post('/api/background-jobs/deal/:dealId/clear-stuck', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ success: false, error: 'Invalid deal ID' });
    }
    
    console.log(`🧹 Clearing stuck jobs for deal ${dealId}`);
    
    const { db } = await import('../db');
    const { backgroundJobs } = await import('../../shared/schema');
    const { eq, and, lt } = await import('drizzle-orm');
    
    // Find jobs that are processing but haven't been updated in 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    const stuckJobs = await db.select().from(backgroundJobs)
      .where(and(
        eq(backgroundJobs.dealId, dealId),
        eq(backgroundJobs.status, 'processing'),
        lt(backgroundJobs.updatedAt, tenMinutesAgo)
      ));
    
    if (stuckJobs.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No stuck jobs found',
        clearedJobs: [] 
      });
    }
    
    console.log(`🧹 Found ${stuckJobs.length} stuck jobs for deal ${dealId}`);
    
    // Stop all stuck jobs
    const clearedJobs = [];
    for (const job of stuckJobs) {
      console.log(`🧹 Clearing stuck job: ${job.jobId} (stuck since ${job.updatedAt})`);
      
      // Update job status to cancelled
      await db.update(backgroundJobs)
        .set({ 
          status: 'cancelled',
          currentStep: 'Cleared as stuck job',
          error: `Job was stuck for more than 10 minutes (last update: ${job.updatedAt})`,
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(backgroundJobs.jobId, job.jobId));
      
      // Clear from in-memory active jobs if it exists
      if (global.activeJobs) {
        for (const [key, activeJob] of global.activeJobs.entries()) {
          if (activeJob.id === job.jobId || activeJob.jobId === job.jobId) {
            global.activeJobs.delete(key);
            break;
          }
        }
      }
      
      clearedJobs.push({
        jobId: job.jobId,
        agentType: job.agentType,
        progress: job.progress,
        stuckSince: job.updatedAt
      });
    }
    
    console.log(`✅ Cleared ${clearedJobs.length} stuck jobs for deal ${dealId}`);
    
    res.json({ 
      success: true, 
      message: `Cleared ${clearedJobs.length} stuck job(s)`,
      clearedJobs
    });
    
  } catch (error) {
    console.error('Error clearing stuck jobs:', error);
    res.status(500).json({ success: false, error: 'Failed to clear stuck jobs' });
  }
});

export default router;