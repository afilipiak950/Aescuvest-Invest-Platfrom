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
      comprehensiveClinicalAnalysisService.rerunSingleQuestion(dealId, questionId)
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

/**
 * Force rerun ALL clinical questions (including already answered ones)
 * Uses COMPREHENSIVE ANALYSIS with evidence extraction from ALL documents
 * This is the REAL analysis that takes hours - same as manual run
 */
router.post('/api/deals/:dealId/clinical-analysis/force-rerun-all', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🔥 FORCE RERUN: Checking if sequential analysis is already running for deal ${dealId}`);
    
    // Import comprehensive service and questions
    const { comprehensiveClinicalAnalysisService, COMPREHENSIVE_CLINICAL_QUESTIONS } = await import('../comprehensiveClinicalAnalysisService');
    const { storage } = await import('../storage');
    const { db } = await import('../db');
    const { backgroundJobs } = await import('../../shared/schema');
    const { and, eq, like } = await import('drizzle-orm');
    
    // CRITICAL MUTUAL EXCLUSION: Check if force-rerun-all is already in progress
    const masterJobId = `force-rerun-all-clinical-${dealId}`;
    const existingMasterJob = await storage.getBackgroundJobById(masterJobId);
    
    if (existingMasterJob && existingMasterJob.status === 'processing') {
      console.log(`⚠️ Force rerun already in progress for deal ${dealId} (started ${existingMasterJob.createdAt})`);
      return res.status(409).json({
        success: false,
        error: 'Force rerun already in progress',
        message: 'A sequential force rerun is already running for this deal. Please wait for it to complete.',
        startedAt: existingMasterJob.createdAt,
        jobId: masterJobId
      });
    }
    
    // Clean up old master job if it exists (from previous completed/failed runs)
    if (existingMasterJob) {
      console.log(`🧹 Cleaning up previous force-rerun job with status: ${existingMasterJob.status}`);
      await storage.deleteBackgroundJob(masterJobId);
      console.log(`✅ Deleted old force-rerun master job`);
    }
    
    console.log(`🔥 FORCE RERUN: Starting SEQUENTIAL COMPREHENSIVE analysis for ALL clinical questions on deal ${dealId}`);
    
    // Create master job to act as mutex lock
    await storage.createBackgroundJob({
      jobId: masterJobId,
      jobType: 'force_rerun_all_clinical',
      dealId,
      status: 'processing',
      progress: 0,
      currentStep: 'Starting sequential force rerun of all clinical questions'
    });
    console.log(`🔒 Created master lock job: ${masterJobId}`);
    
    // CRITICAL: Cancel all existing clinical question rerun jobs before starting fresh
    console.log(`🧹 Cleaning up any existing clinical question rerun jobs for deal ${dealId}`);
    
    await db
      .delete(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.dealId, dealId),
          like(backgroundJobs.jobId, 'clinical-question-rerun-%')
        )
      );
    console.log(`✅ Cleaned up existing clinical question rerun jobs`);
    
    // Respond immediately to user, then process questions sequentially in background
    res.json({
      success: true,
      message: `Force rerun: Started sequential comprehensive analysis - questions will run one after another`,
      startedCount: COMPREHENSIVE_CLINICAL_QUESTIONS.length,
      totalQuestions: COMPREHENSIVE_CLINICAL_QUESTIONS.length,
      dealId,
      estimatedTime: `${Math.round(COMPREHENSIVE_CLINICAL_QUESTIONS.length * 10 / 60)} hours (10 min average per question)`
    });
    
    // Run questions SEQUENTIALLY in background (one finishes before next starts)
    (async () => {
      let completedCount = 0;
      const errors: string[] = [];
      
      try {
        for (let i = 0; i < COMPREHENSIVE_CLINICAL_QUESTIONS.length; i++) {
          const question = COMPREHENSIVE_CLINICAL_QUESTIONS[i];
          const questionNumber = i + 1;
          const startTime = Date.now();
          
          // Update master job progress
          const overallProgress = Math.round((i / COMPREHENSIVE_CLINICAL_QUESTIONS.length) * 100);
          await storage.updateBackgroundJob(masterJobId, {
            progress: overallProgress,
            currentStep: `Processing question ${questionNumber}/${COMPREHENSIVE_CLINICAL_QUESTIONS.length}: ${question.id}`
          });
          
          try {
            console.log(`🎯 [${questionNumber}/${COMPREHENSIVE_CLINICAL_QUESTIONS.length}] SEQUENTIAL: Starting question ${question.id}`);
            console.log(`⏰ Timestamp: ${new Date().toISOString()} - Ensuring previous question completed before starting this one`);
            
            // AWAIT each question - ensures it fully completes or times out before next starts
            await comprehensiveClinicalAnalysisService.rerunSingleQuestion(dealId, question.id);
            const duration = Math.round((Date.now() - startTime) / 1000);
            
            completedCount++;
            console.log(`✅ [${questionNumber}/${COMPREHENSIVE_CLINICAL_QUESTIONS.length}] Completed ${question.id} in ${duration}s`);
            
            // Add 2-second delay between questions to ensure sequential execution
            if (i < COMPREHENSIVE_CLINICAL_QUESTIONS.length - 1) {
              console.log(`⏸️ 2-second delay before next question...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
          } catch (error) {
            const duration = Math.round((Date.now() - startTime) / 1000);
            console.error(`❌ [${questionNumber}/${COMPREHENSIVE_CLINICAL_QUESTIONS.length}] Failed ${question.id} after ${duration}s:`, error);
            errors.push(`${question.id}: ${error.message}`);
            
            // Even on error, add delay to prevent rapid parallel execution
            if (i < COMPREHENSIVE_CLINICAL_QUESTIONS.length - 1) {
              console.log(`⏸️ 2-second delay before next question (after error)...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }
        
        // Mark master job as completed
        await storage.updateBackgroundJob(masterJobId, {
          status: 'completed',
          progress: 100,
          currentStep: `Completed: ${completedCount}/${COMPREHENSIVE_CLINICAL_QUESTIONS.length} questions analyzed`
        });
        
        console.log(`🎉 SEQUENTIAL FORCE RERUN COMPLETE: ${completedCount}/${COMPREHENSIVE_CLINICAL_QUESTIONS.length} questions analyzed`);
        if (errors.length > 0) {
          console.log(`⚠️ ${errors.length} questions failed:`, errors);
        }
        
      } catch (fatalError) {
        // Mark master job as failed
        console.error(`🚨 FATAL ERROR in force rerun loop:`, fatalError);
        await storage.updateBackgroundJob(masterJobId, {
          status: 'failed',
          progress: Math.round((completedCount / COMPREHENSIVE_CLINICAL_QUESTIONS.length) * 100),
          currentStep: `Failed after ${completedCount} questions: ${fatalError.message}`
        });
      }
    })();
    
  } catch (error) {
    console.error('Error force rerunning all clinical questions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to force rerun all questions' 
    });
  }
});

/**
 * Get queue status for clinical analysis
 */
router.get('/api/deals/:dealId/clinical-analysis/queue-status', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const { storage } = await import('../storage');
    const masterJobId = `force-rerun-all-clinical-${dealId}`;
    
    // Get master job status
    const masterJob = await storage.getBackgroundJobById(masterJobId);
    
    // Get individual question jobs
    const allJobs = await storage.getBackgroundJobsByDealId(dealId);
    const questionJobs = allJobs.filter(job => job.jobType === 'clinical_question_rerun');
    
    const pending = questionJobs.filter(j => j.status === 'pending').length;
    const running = questionJobs.filter(j => j.status === 'processing').length;
    const completed = questionJobs.filter(j => j.status === 'completed').length;
    const failed = questionJobs.filter(j => j.status === 'failed').length;
    const cancelled = questionJobs.filter(j => j.status === 'cancelled').length;
    
    const total = masterJob ? masterJob.totalDocuments || questionJobs.length : questionJobs.length;
    const progress = masterJob ? masterJob.progress : 0;
    const isProcessing = masterJob?.status === 'processing' || running > 0;
    
    res.json({
      success: true,
      status: {
        total,
        pending,
        running,
        completed,
        failed,
        cancelled,
        progress,
        currentQuestion: masterJob?.currentDocumentName || null,
        currentQuestionId: null,
        isProcessing
      }
    });
    
  } catch (error) {
    console.error('Error getting clinical queue status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get queue status' 
    });
  }
});

/**
 * Cancel clinical queue processing
 */
router.post('/api/deals/:dealId/clinical-analysis/cancel-queue', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🛑 Cancelling clinical question queue for deal ${dealId}`);
    
    const { storage } = await import('../storage');
    const { db } = await import('../db');
    const { backgroundJobs } = await import('../../shared/schema');
    const { and, eq, like } = await import('drizzle-orm');
    
    const masterJobId = `force-rerun-all-clinical-${dealId}`;
    
    // Update master job to cancelled
    const masterJob = await storage.getBackgroundJobById(masterJobId);
    if (masterJob) {
      await storage.updateBackgroundJob(masterJobId, {
        status: 'cancelled',
        currentStep: 'Cancelled by user'
      });
    }
    
    // Cancel all pending/running question jobs by deleting them
    await db
      .delete(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.dealId, dealId),
          like(backgroundJobs.jobId, 'clinical-question-rerun-%')
        )
      );
    
    res.json({
      success: true,
      message: 'Clinical queue cancelled successfully'
    });
    
  } catch (error) {
    console.error('Error cancelling clinical queue:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to cancel queue' 
    });
  }
});

export default router;