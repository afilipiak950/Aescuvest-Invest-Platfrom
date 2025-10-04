/**
 * Persistent Clinical Analysis Routes
 * Provides API endpoints for managing persistent clinical analysis jobs
 */

import { Router, Request, Response } from 'express';
import { persistentClinicalAnalysisService } from '../services/persistentClinicalAnalysis';
import { storage } from '../storage';

const router = Router();

/**
 * Start or resume clinical analysis for a deal
 * ALWAYS deletes old results to force fresh analysis
 */
router.post('/api/deals/:dealId/clinical-analysis/persistent/start', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    console.log(`🧬 Starting persistent clinical analysis for deal ${dealId}`);
    
    // UNCONDITIONALLY DELETE ALL OLD CLINICAL ANALYSIS DATA to force fresh re-run
    console.log(`🧹 Purging ALL old clinical analysis data for deal ${dealId} to force fresh run`);
    
    const oldJobId = `clinical-analysis-${dealId}`;
    
    // Stop any running persistent job (clears in-memory job state)
    try {
      await persistentClinicalAnalysisService.stopClinicalAnalysis(oldJobId);
      console.log(`🛑 Stopped any running clinical analysis job`);
    } catch (error) {
      console.log(`ℹ️ No running job to stop (expected for first run)`);
    }
    
    // Delete agent analysis records + in-memory cache
    await storage.clearAgentAnalysis(dealId, 'clinical');
    
    // Delete comprehensive analysis rows (where clinicalAnswers are stored)
    await storage.deleteComprehensiveAnalysesByDealId(dealId);
    
    // Delete background job from DB to reset progress to 0%
    await storage.deleteBackgroundJob(oldJobId);
    
    console.log(`✅ All clinical data purged (persistent job state, agent records, comprehensive analysis, background job, caches) - starting fresh at 0%`);
    
    const jobId = await persistentClinicalAnalysisService.startClinicalAnalysis(dealId);
    
    res.json({
      success: true,
      message: 'Persistent clinical analysis started',
      jobId,
      dealId
    });
    
  } catch (error) {
    console.error('❌ Error starting persistent clinical analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start persistent clinical analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Stop clinical analysis for a deal
 */
router.post('/api/deals/:dealId/clinical-analysis/persistent/stop', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const jobId = `clinical-analysis-${dealId}`;
    
    console.log(`🛑 Stopping persistent clinical analysis for deal ${dealId}`);
    
    await persistentClinicalAnalysisService.stopClinicalAnalysis(jobId);
    
    res.json({
      success: true,
      message: 'Persistent clinical analysis stopped',
      jobId,
      dealId
    });
    
  } catch (error) {
    console.error('❌ Error stopping persistent clinical analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop persistent clinical analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get status of clinical analysis job
 */
router.get('/api/deals/:dealId/clinical-analysis/persistent/status', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const jobId = `clinical-analysis-${dealId}`;
    
    const jobStatus = persistentClinicalAnalysisService.getJobStatus(jobId);
    
    res.json({
      success: true,
      jobId,
      dealId,
      status: jobStatus
    });
    
  } catch (error) {
    console.error('❌ Error getting clinical analysis status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get clinical analysis status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get all active clinical analysis jobs
 */
router.get('/api/clinical-analysis/persistent/jobs', async (req: Request, res: Response) => {
  try {
    const activeJobs = persistentClinicalAnalysisService.getAllActiveJobs();
    
    const jobsArray = Array.from(activeJobs.entries()).map(([jobId, jobState]) => ({
      jobId,
      ...jobState
    }));
    
    res.json({
      success: true,
      activeJobs: jobsArray,
      count: jobsArray.length
    });
    
  } catch (error) {
    console.error('❌ Error getting active clinical analysis jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active clinical analysis jobs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;