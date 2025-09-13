import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { jobProcessor } from '../services/jobProcessor';

const router = Router();

// Get active jobs for a deal
router.get('/api/background-jobs/:dealId', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    console.log(`📊 Found 0 running background jobs for deal ${dealId}`);
    
    // Get from database jobs (primary source for new system)
    const { db } = await import('../db');
    const { backgroundJobs } = await import('../../shared/schema');
    const { eq, and, or } = await import('drizzle-orm');
    
    const dbJobs = await db.select().from(backgroundJobs)
      .where(and(
        eq(backgroundJobs.dealId, dealId),
        or(
          eq(backgroundJobs.status, 'processing'),
          eq(backgroundJobs.status, 'queued'),
          eq(backgroundJobs.status, 'pending')
        )
      ));
    
    console.log(`📊 Found ${dbJobs.length} background jobs for deal ${dealId}`);
    console.log('🔍 Raw database jobs:', JSON.stringify(dbJobs.slice(0, 2), null, 2));
    
    // Transform database jobs to expected format
    const jobs = dbJobs.map(job => {
      const jobData = job.jobData as any || {};
      return {
        jobId: job.jobId,
        jobType: job.jobType,
        agentType: job.agentType,
        progress: job.progress || 0,
        status: job.status,
        currentStep: job.currentStep || 'Processing...',
        currentDocument: job.currentDocumentName || 'Processing',
        totalDocuments: job.totalDocuments || 0,
        processedDocuments: job.processedDocuments || 0,
        runId: job.runId,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        metadata: {
          agentType: job.agentType,
          startTime: job.createdAt,
          lastUpdate: job.updatedAt,
          processedDocuments: job.processedDocuments || 0,
          totalDocuments: job.totalDocuments || 0,
          currentDocument: job.currentDocumentName || 'Processing',
          agentDocumentCounts: jobData.agentDocumentCounts || {}
        }
      };
    });
    
    res.json({ success: true, jobs });
  } catch (error) {
    console.error('Error fetching background jobs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch background jobs' });
  }
});

// Get all active jobs
router.get('/api/background-jobs', async (req: Request, res: Response) => {
  try {
    // Get from database jobs (unified with jobProcessor system)
    const { db } = await import('../db');
    const { backgroundJobs } = await import('../../shared/schema');
    const { or, eq } = await import('drizzle-orm');
    
    const allJobs = await db.select().from(backgroundJobs)
      .where(or(
        eq(backgroundJobs.status, 'processing'),
        eq(backgroundJobs.status, 'queued'),
        eq(backgroundJobs.status, 'pending')
      ));
    
    const jobs = allJobs.map(job => {
      const jobData = job.jobData as any || {};
      return {
        jobId: job.jobId,
        jobType: job.jobType,
        agentType: job.agentType,
        progress: job.progress || 0,
        status: job.status,
        currentStep: job.currentStep || 'Processing...',
        currentDocument: job.currentDocumentName || 'Processing',
        totalDocuments: job.totalDocuments || 0,
        processedDocuments: job.processedDocuments || 0,
        runId: job.runId,
        dealId: job.dealId,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        metadata: {
          agentType: job.agentType,
          startTime: job.createdAt,
          lastUpdate: job.updatedAt,
          processedDocuments: job.processedDocuments || 0,
          totalDocuments: job.totalDocuments || 0,
          currentDocument: job.currentDocumentName || 'Processing',
          agentDocumentCounts: jobData.agentDocumentCounts || {}
        }
      };
    });
    
    res.json({ success: true, jobs });
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
    
    // Cancel the job via database update
    const { db } = await import('../db');
    const { backgroundJobs } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    // Update job status to cancelled
    const result = await db.update(backgroundJobs)
      .set({ 
        status: 'cancelled' as any,
        currentStep: 'Cancelled by user',
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(backgroundJobs.id, jobId))
      .returning();
    
    const success = result.length > 0;
    
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
        status: 'cancelled' as any,
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

/**
 * Stop ALL background jobs for a deal
 */
router.post('/api/deals/:dealId/stop-all-jobs', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid deal ID'
      });
    }

    console.log(`🛑 STOPPING ALL JOBS for deal ${dealId}`);
    
    // Get all active jobs for this deal from database
    const { db } = await import('../db');
    const { backgroundJobs } = await import('../../shared/schema');
    const { eq, and, or } = await import('drizzle-orm');
    
    const activeJobs = await db.select().from(backgroundJobs)
      .where(and(
        eq(backgroundJobs.dealId, dealId),
        or(
          eq(backgroundJobs.status, 'processing'),
          eq(backgroundJobs.status, 'queued')
        )
      ));
    const processingJobs = activeJobs.filter((job: any) => job.status === 'processing');
    
    let stoppedCount = 0;
    
    for (const job of processingJobs) {
      try {
        // Update job status to cancelled
        await db.update(backgroundJobs)
          .set({ 
            status: 'cancelled' as any,
            currentStep: 'Cancelled by user',
            completedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(backgroundJobs.jobId, job.jobId));
        
        stoppedCount++;
        console.log(`🛑 Stopped job: ${job.jobId} (${job.agentType})`);
      } catch (error) {
        console.error(`❌ Error stopping job ${job.jobId}:`, error);
      }
    }
    
    console.log(`✅ Stopped ${stoppedCount} jobs for deal ${dealId}`);
    
    res.json({
      success: true,
      message: `Stopped ${stoppedCount} jobs for deal ${dealId}`,
      stoppedCount
    });
    
  } catch (error) {
    console.error(`❌ Error stopping all jobs for deal ${req.params.dealId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop all jobs'
    });
  }
});

export default router;