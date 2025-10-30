/**
 * Persistent Clinical Analysis Routes
 * Provides API endpoints for managing persistent clinical analysis jobs
 */

import { Router, Request, Response } from 'express';
import { persistentClinicalAnalysisService } from '../services/persistentClinicalAnalysis';

const router = Router();

/**
 * Start or resume clinical analysis for a deal
 */
router.post('/api/deals/:dealId/clinical-analysis/persistent/start', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    console.log(`🧬 Starting persistent clinical analysis for deal ${dealId}`);
    
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

/**
 * POST /api/deals/:dealId/clinical-analysis/question/:questionId/rerun
 * Re-run a single Clinical question with database-backed progress tracking
 * Response time: <50ms (background processing)
 */
router.post('/api/deals/:dealId/clinical-analysis/question/:questionId/rerun', async (req: Request, res: Response) => {
  try {
    const { rerunSingleClinicalQuestion, comprehensiveClinicalAnalysisService } = await import('../comprehensiveClinicalAnalysisService');
    const { storage } = await import('../storage');
    
    const dealId = parseInt(req.params.dealId);
    const questionId = req.params.questionId;
    const { customInstructions } = req.body;
    const jobId = `clinical-question-rerun-${dealId}-${questionId}`;
    
    console.log(`🎯 Clinical question rerun requested: ${questionId} for deal ${dealId}`);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ success: false, error: 'Invalid deal ID' });
    }
    
    if (!questionId) {
      return res.status(400).json({ success: false, error: 'Question ID is required' });
    }
    
    // Check if this question is already being rerun (prevent duplicates)
    if (await comprehensiveClinicalAnalysisService.isQuestionRunning(dealId, questionId)) {
      console.log(`⏭️ Clinical question ${questionId} already running for deal ${dealId}`);
      return res.status(409).json({ 
        success: false, 
        error: 'Question is already being rerun',
        jobId 
      });
    }
    
    // Register job in database immediately (atomic operation)
    await comprehensiveClinicalAnalysisService.updateQuestionRerunProgress(dealId, questionId, 0);
    
    console.log(`✅ Clinical job registered: ${jobId}`);
    
    // Defer actual processing to next event loop tick (non-blocking)
    // This ensures we respond to the client in <50ms
    setImmediate(() => {
      comprehensiveClinicalAnalysisService.rerunSingleQuestion(dealId, questionId, customInstructions || '')
        .then(() => {
          console.log(`✅ Background Clinical rerun completed for question ${questionId}`);
        })
        .catch(error => {
          console.error(`❌ Background Clinical rerun failed for question ${questionId}:`, error);
        });
    });
    
    // Return immediate success response
    res.json({
      success: true,
      message: `Clinical question ${questionId} rerun started`,
      jobId,
      questionId,
      dealId
    });
    
  } catch (error) {
    console.error('Error starting Clinical question rerun:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * GET /api/deals/:dealId/clinical-analysis/questions/progress
 * Get progress for ALL active question reruns for a deal
 */
router.get('/api/deals/:dealId/clinical-analysis/questions/progress', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    // Import the comprehensive service
    const { comprehensiveClinicalAnalysisService } = await import('../comprehensiveClinicalAnalysisService');
    
    // Get all active progress for this deal
    const allProgress = await comprehensiveClinicalAnalysisService.getAllQuestionProgress(dealId);
    
    res.json({
      success: true,
      progress: allProgress
    });
    
  } catch (error) {
    console.error('Error getting Clinical question progress:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router;