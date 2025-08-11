/**
 * RUN-BASED PROGRESS API ROUTES
 * 
 * Provides API endpoints for Run ID-based progress tracking
 */

import { Router, Request, Response } from 'express';
import { jobBasedEngine } from '../services/jobBasedAnalysisEngine';
import { runTracker } from '../services/runBasedProgressTracker';

const router = Router();

/**
 * Start comprehensive analysis with job-based progress tracking
 */
router.post('/api/analysis/comprehensive/:dealId', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    console.log(`🚀 API: Starting comprehensive analysis for deal ${dealId}`);
    
    const runId = await jobBasedEngine.startComprehensiveAnalysis(dealId);
    
    res.json({
      success: true,
      runId,
      message: 'Comprehensive analysis started with job-based progress tracking'
    });
    
  } catch (error) {
    console.error('Error starting comprehensive analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start comprehensive analysis'
    });
  }
});

/**
 * Start legacy analysis with job-based progress tracking
 */
router.post('/api/analysis/legacy/:dealId', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    console.log(`🔄 API: Starting legacy analysis for deal ${dealId}`);
    
    const runId = await jobBasedEngine.startLegacyAnalysis(dealId);
    
    res.json({
      success: true,
      runId,
      message: 'Legacy analysis started with job-based progress tracking'
    });
    
  } catch (error) {
    console.error('Error starting legacy analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start legacy analysis'
    });
  }
});

/**
 * Get progress for a specific run
 */
router.get('/api/analysis/progress/:runId', async (req: Request, res: Response) => {
  try {
    const runId = req.params.runId;
    
    const progress = jobBasedEngine.getRunProgress(runId);
    
    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Run not found'
      });
    }
    
    res.json({
      success: true,
      progress
    });
    
  } catch (error) {
    console.error('Error getting run progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get run progress'
    });
  }
});

/**
 * Get progress for a deal (finds active run)
 */
router.get('/api/analysis/deal-progress/:dealId', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    const runId = jobBasedEngine.getActiveRunForDeal(dealId);
    
    if (!runId) {
      return res.json({
        success: true,
        progress: null,
        message: 'No active run for this deal'
      });
    }
    
    const progress = jobBasedEngine.getRunProgress(runId);
    
    res.json({
      success: true,
      runId,
      progress
    });
    
  } catch (error) {
    console.error('Error getting deal progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get deal progress'
    });
  }
});

/**
 * Get all active runs (for debugging)
 */
router.get('/api/analysis/active-runs', async (req: Request, res: Response) => {
  try {
    const activeRuns = runTracker.getAllActiveRuns();
    
    res.json({
      success: true,
      activeRuns: activeRuns.map(run => ({
        runId: run.runId,
        dealId: run.dealId,
        status: run.status,
        totalJobs: run.totalJobs,
        completedJobs: run.completedJobs,
        progress: Math.floor((run.completedJobs / run.totalJobs) * 100),
        agentCount: run.agentJobs.length
      }))
    });
    
  } catch (error) {
    console.error('Error getting active runs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active runs'
    });
  }
});

export default router;