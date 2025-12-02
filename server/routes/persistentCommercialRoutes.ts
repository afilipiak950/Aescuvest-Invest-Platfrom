/**
 * Persistent Commercial Analysis Routes
 * API endpoints for managing persistent commercial analysis question reruns
 */

import { Router } from 'express';
import { db } from '../db';
import { backgroundJobs } from '../../shared/schema';
import { eq, and, like } from 'drizzle-orm';
import { agentRunCoordinator } from '../services/agentRunCoordinator';

export const persistentCommercialRoutes = Router();

/**
 * Execute Commercial force-rerun-all - called by AgentRunCoordinator when it's Commercial's turn
 */
async function executeCommercialForceRerunAll(dealId: number): Promise<void> {
  const { comprehensiveCommercialAnalysisService, COMMERCIAL_QUESTIONS } = await import('../comprehensiveCommercialAnalysisService');
  const { storage } = await import('../storage');
  
  const masterJobId = `force-rerun-all-commercial-${dealId}`;
  
  // CRITICAL: Delete ALL existing Commercial background jobs (including old completed ones)
  // This ensures the frontend shows fresh 0% progress instead of stale 100%
  await db
    .delete(backgroundJobs)
    .where(
      and(
        eq(backgroundJobs.dealId, dealId),
        eq(backgroundJobs.agentType, 'Commercial')
      )
    );
  
  // Also clean up old master job by ID if it exists (belt and suspenders)
  const existingMasterJob = await storage.getBackgroundJobById(masterJobId);
  if (existingMasterJob) {
    await storage.deleteBackgroundJob(masterJobId);
  }
  
  // Create master job for progress tracking - CRITICAL: include agentType for frontend matching
  await storage.createBackgroundJob({
    jobId: masterJobId,
    jobType: 'force_rerun_all_commercial',
    dealId,
    status: 'processing',
    progress: 0,
    currentStep: 'Starting sequential force rerun of all commercial questions',
    agentType: 'Commercial'
  });
  
  await db
    .delete(backgroundJobs)
    .where(
      and(
        eq(backgroundJobs.dealId, dealId),
        like(backgroundJobs.jobId, 'commercial-question-rerun-%')
      )
    );
  
  let completedCount = 0;
  const errors: string[] = [];
  
  try {
    for (let i = 0; i < COMMERCIAL_QUESTIONS.length; i++) {
      // CANCELLATION CHECK: Stop early if deal was cancelled (Stop All Jobs)
      if (agentRunCoordinator.isDealCancelled(dealId)) {
        console.log(`🚫 COMMERCIAL FORCE RERUN CANCELLED for deal ${dealId} after ${completedCount} questions`);
        await storage.updateBackgroundJob(masterJobId, {
          status: 'cancelled',
          progress: Math.round((completedCount / COMMERCIAL_QUESTIONS.length) * 100),
          currentStep: `Cancelled after ${completedCount} questions`
        });
        return; // Exit the callback early
      }
      
      const question = COMMERCIAL_QUESTIONS[i];
      const questionNumber = i + 1;
      const startTime = Date.now();
      
      const overallProgress = Math.round((i / COMMERCIAL_QUESTIONS.length) * 100);
      await storage.updateBackgroundJob(masterJobId, {
        progress: overallProgress,
        currentStep: `Processing question ${questionNumber}/${COMMERCIAL_QUESTIONS.length}: ${question.id}`
      });
      
      await agentRunCoordinator.updateProgress(
        dealId, 
        'commercial', 
        completedCount,
        `Question ${questionNumber}/${COMMERCIAL_QUESTIONS.length}: ${question.id}`
      );
      
      try {
        console.log(`📊 [${questionNumber}/${COMMERCIAL_QUESTIONS.length}] SEQUENTIAL: Starting commercial question ${question.id}`);
        await comprehensiveCommercialAnalysisService.rerunSingleQuestion(dealId, question.id);
        const duration = Math.round((Date.now() - startTime) / 1000);
        completedCount++;
        console.log(`✅ [${questionNumber}/${COMMERCIAL_QUESTIONS.length}] Completed ${question.id} in ${duration}s`);
        
        if (i < COMMERCIAL_QUESTIONS.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        console.error(`❌ [${questionNumber}/${COMMERCIAL_QUESTIONS.length}] Failed ${question.id} after ${duration}s:`, error);
        errors.push(`${question.id}: ${error.message}`);
        
        if (i < COMMERCIAL_QUESTIONS.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    await storage.updateBackgroundJob(masterJobId, {
      status: 'completed',
      progress: 100,
      currentStep: `Completed: ${completedCount}/${COMMERCIAL_QUESTIONS.length} questions analyzed`
    });
    
    console.log(`🎉 COMMERCIAL FORCE RERUN COMPLETE: ${completedCount}/${COMMERCIAL_QUESTIONS.length} questions`);
    
  } catch (fatalError: any) {
    console.error(`🚨 FATAL ERROR in commercial force rerun:`, fatalError);
    await storage.updateBackgroundJob(masterJobId, {
      status: 'failed',
      progress: Math.round((completedCount / COMMERCIAL_QUESTIONS.length) * 100),
      currentStep: `Failed after ${completedCount} questions: ${fatalError.message}`
    });
    throw fatalError;
  }
}

// Register Commercial callback with AgentRunCoordinator
agentRunCoordinator.registerAgentCallback('commercial', executeCommercialForceRerunAll);

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
 * Uses AgentRunCoordinator for cross-agent sequential execution
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

    const { COMMERCIAL_QUESTIONS } = await import('../comprehensiveCommercialAnalysisService');
    
    console.log(`🔥 FORCE RERUN: Enqueueing Commercial analysis via AgentRunCoordinator for deal ${dealId}`);
    
    const result = await agentRunCoordinator.enqueueAndStart(
      dealId,
      'commercial',
      COMMERCIAL_QUESTIONS.length,
      true  // forceRestart - cancel existing and restart fresh
    );
    
    if (!result.success && result.queuePosition > 0) {
      return res.status(409).json({
        success: false,
        error: result.message,
        queuePosition: result.queuePosition,
        isRunning: result.isRunning
      });
    }
    
    res.json({
      success: true,
      message: result.isRunning 
        ? `Commercial analysis started immediately`
        : `Commercial analysis queued at position ${result.queuePosition}`,
      queuePosition: result.queuePosition,
      isRunning: result.isRunning,
      totalQuestions: COMMERCIAL_QUESTIONS.length,
      dealId
    });
    
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
