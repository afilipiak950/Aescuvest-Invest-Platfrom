/**
 * Persistent HR Analysis Routes
 * Provides API endpoints for managing persistent HR analysis jobs
 */

import { Router, Request, Response } from 'express';
import { persistentHRAnalysisService } from '../services/persistentHRAnalysis';

const router = Router();

/**
 * Start or resume HR analysis for a deal
 */
router.post('/api/deals/:dealId/hr-analysis/persistent/start', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    console.log(`👥 Starting persistent HR analysis for deal ${dealId}`);
    
    const jobId = await persistentHRAnalysisService.startHRAnalysis(dealId);
    
    res.json({
      success: true,
      message: 'Persistent HR analysis started',
      jobId,
      dealId
    });
    
  } catch (error) {
    console.error('❌ Error starting persistent HR analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start persistent HR analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Stop HR analysis for a deal
 */
router.post('/api/deals/:dealId/hr-analysis/persistent/stop', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const jobId = `hr-analysis-${dealId}`;
    
    console.log(`🛑 Stopping persistent HR analysis for deal ${dealId}`);
    
    await persistentHRAnalysisService.stopHRAnalysis(jobId);
    
    res.json({
      success: true,
      message: 'Persistent HR analysis stopped',
      jobId,
      dealId
    });
    
  } catch (error) {
    console.error('❌ Error stopping persistent HR analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop persistent HR analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get status of HR analysis job
 */
router.get('/api/deals/:dealId/hr-analysis/persistent/status', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const jobId = `hr-analysis-${dealId}`;
    
    const jobStatus = persistentHRAnalysisService.getJobStatus(jobId);
    
    if (!jobStatus) {
      return res.status(404).json({
        success: false,
        error: 'HR analysis job not found'
      });
    }
    
    res.json({
      success: true,
      jobStatus: {
        dealId: jobStatus.dealId,
        jobId: jobStatus.jobId,
        progress: jobStatus.progress,
        currentQuestionIndex: jobStatus.currentQuestionIndex,
        totalQuestions: jobStatus.totalQuestions,
        currentStep: jobStatus.currentStep,
        documentsAnalyzed: jobStatus.documentsAnalyzed,
        totalDocuments: jobStatus.totalDocuments,
        startTime: jobStatus.startTime,
        lastUpdate: jobStatus.lastUpdate
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting HR analysis status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get HR analysis status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get all active HR analysis jobs
 */
router.get('/api/hr-analysis/persistent/jobs', async (req: Request, res: Response) => {
  try {
    const activeJobs = persistentHRAnalysisService.getAllActiveJobs();
    
    const jobsList = Array.from(activeJobs.entries()).map(([jobId, jobState]) => ({
      jobId,
      dealId: jobState.dealId,
      progress: jobState.progress,
      currentStep: jobState.currentStep,
      startTime: jobState.startTime,
      lastUpdate: jobState.lastUpdate
    }));
    
    res.json({
      success: true,
      activeJobs: jobsList,
      count: jobsList.length
    });
    
  } catch (error) {
    console.error('❌ Error getting active HR analysis jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active HR analysis jobs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

console.log('✅ Persistent HR Routes loaded');