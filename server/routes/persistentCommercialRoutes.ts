/**
 * Persistent Commercial Analysis Routes
 * API endpoints for managing persistent commercial analysis question reruns
 */

import { Router } from 'express';
import { db } from '../db';
import { backgroundJobs } from '../../shared/schema';
import { eq, and, like } from 'drizzle-orm';

export const persistentCommercialRoutes = Router();

/**
 * Get comprehensive commercial analysis results
 */
persistentCommercialRoutes.get('/api/deals/:dealId/commercial-analysis/comprehensive/results', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const { storage } = await import('../storage');
    
    const analysis = await storage.getAgentAnalysis(dealId, 'commercial');
    
    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'No commercial analysis found'
      });
    }

    console.log(`✅ Found comprehensive commercial analysis - ${Object.keys(analysis.commercialAnswers || {}).length} questions, ${analysis.findings?.length || 0} findings, ${analysis.recommendations?.length || 0} recommendations`);

    res.json({
      success: true,
      analysis: {
        dealId,
        agentType: analysis.agentType,
        status: analysis.status,
        findings: analysis.findings || [],
        recommendations: analysis.recommendations || [],
        confidence: analysis.confidence || 0,
        completedAt: analysis.completedAt,
        commercialAnswers: analysis.commercialAnswers || {}
      }
    });
    
  } catch (error) {
    console.error('Error getting comprehensive commercial analysis results:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get commercial analysis results' 
    });
  }
});

/**
 * Get progress for ALL active question reruns for a deal
 */
persistentCommercialRoutes.get('/api/deals/:dealId/commercial-analysis/questions/progress', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const { comprehensiveCommercialAnalysisService } = await import('../comprehensiveCommercialAnalysisService');
    
    const allProgress = await comprehensiveCommercialAnalysisService.getAllQuestionProgress(dealId);
    
    res.json({
      success: true,
      progress: allProgress
    });
    
  } catch (error) {
    console.error('Error getting all commercial question rerun progress:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get progress' 
    });
  }
});

/**
 * Get progress for a single question rerun
 */
persistentCommercialRoutes.get('/api/deals/:dealId/commercial-analysis/question/:questionId/progress', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const questionId = req.params.questionId;
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    if (!questionId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Question ID is required' 
      });
    }

    const { comprehensiveCommercialAnalysisService } = await import('../comprehensiveCommercialAnalysisService');
    
    const progress = await comprehensiveCommercialAnalysisService.getQuestionRerunProgress(dealId, questionId);
    
    res.json({
      success: true,
      progress
    });
    
  } catch (error) {
    console.error('Error getting commercial question rerun progress:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get progress' 
    });
  }
});

/**
 * Re-run a single commercial question with database-backed persistence
 * Uses background processing with real-time WebSocket updates
 */
persistentCommercialRoutes.post('/api/deals/:dealId/commercial-analysis/question/:questionId/rerun', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const questionId = req.params.questionId;
    const { customInstructions } = req.body;
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    if (!questionId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Question ID is required' 
      });
    }

    console.log(`🔄 Re-running commercial question ${questionId} for deal ${dealId} (BACKGROUND MODE)`);
    
    const { comprehensiveCommercialAnalysisService } = await import('../comprehensiveCommercialAnalysisService');
    
    // ATOMIC REGISTRATION: Check and register the job in one step to prevent race conditions
    if (await comprehensiveCommercialAnalysisService.isQuestionRunning(dealId, questionId)) {
      console.log(`⚠️ Commercial question ${questionId} for deal ${dealId} is already being rerun`);
      return res.status(409).json({ 
        success: false, 
        error: `Question ${questionId} is already being rerun. Please wait for it to complete.` 
      });
    }
    
    // Immediately initialize progress to 0 (atomically registers the job)
    // This prevents concurrent requests from bypassing the duplicate check
    await comprehensiveCommercialAnalysisService.updateQuestionRerunProgress(dealId, questionId, 0);
    
    // Schedule background job execution on next event loop tick
    // HTTP response will be sent BEFORE the heavy database/AI work begins
    setImmediate(() => {
      comprehensiveCommercialAnalysisService.rerunSingleQuestion(dealId, questionId, customInstructions || '')
        .then(() => {
          console.log(`✅ Background commercial rerun completed for question ${questionId} on deal ${dealId}`);
        })
        .catch(async error => {
          console.error(`❌ Background commercial rerun failed for question ${questionId} on deal ${dealId}:`, error);
          // Error is logged but doesn't affect the HTTP response (already sent)
        });
    });
    
    // Return immediately - client will poll for progress
    res.json({
      success: true,
      message: 'Commercial question rerun started in background',
      questionId,
      dealId
    });
    
  } catch (error) {
    console.error('Error re-running commercial question:', error);
    
    // Check if it's a duplicate rerun error
    if (error.message && error.message.includes('already being rerun')) {
      return res.status(409).json({ 
        success: false, 
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to re-run commercial question analysis' 
    });
  }
});

/**
 * Force rerun ALL commercial questions (including already answered ones)
 * Uses COMPREHENSIVE ANALYSIS with evidence extraction from ALL documents
 * This is the REAL analysis that takes hours - same as manual run
 */
persistentCommercialRoutes.post('/api/deals/:dealId/commercial-analysis/force-rerun-all', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🔥 FORCE RERUN: Checking if sequential commercial analysis is already running for deal ${dealId}`);
    
    // Import comprehensive service and questions
    const { comprehensiveCommercialAnalysisService, COMMERCIAL_QUESTIONS } = await import('../comprehensiveCommercialAnalysisService');
    const { storage } = await import('../storage');
    
    // CRITICAL MUTUAL EXCLUSION: Check if force-rerun-all is already in progress
    const masterJobId = `force-rerun-all-commercial-${dealId}`;
    const existingMasterJob = await storage.getBackgroundJobById(masterJobId);
    
    if (existingMasterJob && existingMasterJob.status === 'processing') {
      console.log(`⚠️ Commercial force rerun already in progress for deal ${dealId} (started ${existingMasterJob.createdAt})`);
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
      console.log(`🧹 Cleaning up previous commercial force-rerun job with status: ${existingMasterJob.status}`);
      await storage.deleteBackgroundJob(masterJobId);
      console.log(`✅ Deleted old commercial force-rerun master job`);
    }
    
    console.log(`🔥 FORCE RERUN: Starting SEQUENTIAL COMPREHENSIVE analysis for ALL commercial questions on deal ${dealId}`);
    
    // Create master job to act as mutex lock
    await storage.createBackgroundJob({
      jobId: masterJobId,
      jobType: 'force_rerun_all_commercial',
      dealId,
      status: 'processing',
      progress: 0,
      currentStep: 'Starting sequential force rerun of all commercial questions'
    });
    console.log(`🔒 Created master lock job: ${masterJobId}`);
    
    // CRITICAL: Cancel all existing commercial question rerun jobs before starting fresh
    console.log(`🧹 Cleaning up any existing commercial question rerun jobs for deal ${dealId}`);
    
    await db
      .delete(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.dealId, dealId),
          like(backgroundJobs.jobId, 'commercial-question-rerun-%')
        )
      );
    console.log(`✅ Cleaned up existing commercial question rerun jobs`);
    
    // Respond immediately to user, then process questions sequentially in background
    res.json({
      success: true,
      message: `Force rerun: Started sequential comprehensive commercial analysis - questions will run one after another`,
      startedCount: COMMERCIAL_QUESTIONS.length,
      totalQuestions: COMMERCIAL_QUESTIONS.length,
      dealId,
      estimatedTime: `${Math.round(COMMERCIAL_QUESTIONS.length * 10 / 60)} hours (10 min average per question)`
    });
    
    // Run questions SEQUENTIALLY in background (one finishes before next starts)
    (async () => {
      let completedCount = 0;
      const errors: string[] = [];
      
      try {
        for (let i = 0; i < COMMERCIAL_QUESTIONS.length; i++) {
          const question = COMMERCIAL_QUESTIONS[i];
          const questionNumber = i + 1;
          const startTime = Date.now();
          
          // Update master job progress
          const overallProgress = Math.round((i / COMMERCIAL_QUESTIONS.length) * 100);
          await storage.updateBackgroundJob(masterJobId, {
            progress: overallProgress,
            currentStep: `Processing question ${questionNumber}/${COMMERCIAL_QUESTIONS.length}: ${question.id}`
          });
          
          try {
            console.log(`🎯 [${questionNumber}/${COMMERCIAL_QUESTIONS.length}] SEQUENTIAL COMMERCIAL: Starting question ${question.id}`);
            console.log(`⏰ Timestamp: ${new Date().toISOString()} - Ensuring previous question completed before starting this one`);
            
            // AWAIT each question - ensures it fully completes or times out before next starts
            await comprehensiveCommercialAnalysisService.rerunSingleQuestion(dealId, question.id);
            const duration = Math.round((Date.now() - startTime) / 1000);
            
            completedCount++;
            console.log(`✅ [${questionNumber}/${COMMERCIAL_QUESTIONS.length}] Completed ${question.id} in ${duration}s`);
            
            // Add 2-second delay between questions to ensure sequential execution
            if (i < COMMERCIAL_QUESTIONS.length - 1) {
              console.log(`⏸️ 2-second delay before next commercial question...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
          } catch (error) {
            const duration = Math.round((Date.now() - startTime) / 1000);
            console.error(`❌ [${questionNumber}/${COMMERCIAL_QUESTIONS.length}] Failed ${question.id} after ${duration}s:`, error);
            errors.push(`${question.id}: ${error.message}`);
            
            // Even on error, add delay to prevent rapid parallel execution
            if (i < COMMERCIAL_QUESTIONS.length - 1) {
              console.log(`⏸️ 2-second delay before next commercial question (after error)...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }
        
        // Mark master job as completed
        await storage.updateBackgroundJob(masterJobId, {
          status: 'completed',
          progress: 100,
          currentStep: `Completed: ${completedCount}/${COMMERCIAL_QUESTIONS.length} commercial questions analyzed`
        });
        
        console.log(`🎉 SEQUENTIAL COMMERCIAL FORCE RERUN COMPLETE: ${completedCount}/${COMMERCIAL_QUESTIONS.length} questions analyzed`);
        if (errors.length > 0) {
          console.log(`⚠️ ${errors.length} commercial questions failed:`, errors);
        }
        
      } catch (fatalError) {
        // Mark master job as failed
        console.error(`🚨 FATAL ERROR in commercial force rerun loop:`, fatalError);
        await storage.updateBackgroundJob(masterJobId, {
          status: 'failed',
          progress: Math.round((completedCount / COMMERCIAL_QUESTIONS.length) * 100),
          currentStep: `Failed after ${completedCount} questions: ${fatalError.message}`
        });
      }
    })();
    
  } catch (error) {
    console.error('Error force rerunning all commercial questions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to force rerun all commercial questions' 
    });
  }
});

/**
 * Get queue status for commercial analysis
 */
persistentCommercialRoutes.get('/api/deals/:dealId/commercial-analysis/queue-status', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const { storage } = await import('../storage');
    const { COMMERCIAL_QUESTIONS } = await import('../comprehensiveCommercialAnalysisService');
    const masterJobId = `force-rerun-all-commercial-${dealId}`;
    
    // Get master job status
    const masterJob = await storage.getBackgroundJobById(masterJobId);
    
    // Get individual question jobs
    const allJobs = await storage.getBackgroundJobsByDealId(dealId);
    const questionJobs = allJobs.filter(job => job.jobType === 'commercial_question_rerun');
    
    const pending = questionJobs.filter(j => j.status === 'pending').length;
    const running = questionJobs.filter(j => j.status === 'processing').length;
    const completed = questionJobs.filter(j => j.status === 'completed').length;
    const failed = questionJobs.filter(j => j.status === 'failed').length;
    const cancelled = questionJobs.filter(j => j.status === 'cancelled').length;
    
    const total = masterJob ? COMMERCIAL_QUESTIONS.length : questionJobs.length;
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
        currentQuestion: masterJob?.currentStep || null,
        currentQuestionId: null,
        isProcessing
      }
    });
    
  } catch (error) {
    console.error('Error getting commercial queue status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get queue status' 
    });
  }
});

/**
 * Cancel commercial queue processing
 */
persistentCommercialRoutes.post('/api/deals/:dealId/commercial-analysis/cancel-queue', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🛑 Cancelling commercial question queue for deal ${dealId}`);
    
    const { storage } = await import('../storage');
    
    const masterJobId = `force-rerun-all-commercial-${dealId}`;
    
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
          like(backgroundJobs.jobId, 'commercial-question-rerun-%')
        )
      );
    
    res.json({
      success: true,
      message: 'Commercial queue cancelled successfully'
    });
    
  } catch (error) {
    console.error('Error cancelling commercial queue:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to cancel queue' 
    });
  }
});
