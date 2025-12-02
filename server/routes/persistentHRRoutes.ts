/**
 * Persistent HR Analysis Routes
 * API endpoints for managing persistent HR analysis jobs
 * MATCHES Clinical/Legal architecture for Force Rerun Queue support
 */

import { Router, Request, Response } from 'express';
import { agentRunCoordinator } from '../services/agentRunCoordinator';
import { db } from '../db';
import { backgroundJobs } from '../../shared/schema';
import { eq, and, like } from 'drizzle-orm';

export const persistentHRRoutes = Router();

/**
 * Execute HR force-rerun-all - called by AgentRunCoordinator when it's HR's turn
 */
async function executeHRForceRerunAll(dealId: number): Promise<void> {
  const { comprehensiveHRAnalysisService, HR_QUESTIONS } = await import('../comprehensiveHRAnalysisService');
  const { storage } = await import('../storage');
  
  const masterJobId = `force-rerun-all-hr-${dealId}`;
  
  // CRITICAL: Delete ALL existing HR background jobs (including old completed ones)
  // This ensures the frontend shows fresh 0% progress instead of stale 100%
  await db
    .delete(backgroundJobs)
    .where(
      and(
        eq(backgroundJobs.dealId, dealId),
        eq(backgroundJobs.agentType, 'HR')
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
    jobType: 'force_rerun_all_hr',
    dealId,
    status: 'processing',
    progress: 0,
    currentStep: 'Starting sequential force rerun of all HR questions',
    agentType: 'HR'
  });
  
  await db
    .delete(backgroundJobs)
    .where(
      and(
        eq(backgroundJobs.dealId, dealId),
        like(backgroundJobs.jobId, 'hr-question-rerun-%')
      )
    );
  
  let completedCount = 0;
  const errors: string[] = [];
  
  try {
    for (let i = 0; i < HR_QUESTIONS.length; i++) {
      const question = HR_QUESTIONS[i];
      const questionNumber = i + 1;
      const startTime = Date.now();
      
      const overallProgress = Math.round((i / HR_QUESTIONS.length) * 100);
      await storage.updateBackgroundJob(masterJobId, {
        progress: overallProgress,
        currentStep: `Processing question ${questionNumber}/${HR_QUESTIONS.length}: ${question.id}`
      });
      
      await agentRunCoordinator.updateProgress(
        dealId, 
        'hr', 
        completedCount,
        `Question ${questionNumber}/${HR_QUESTIONS.length}: ${question.id}`
      );
      
      try {
        console.log(`👥 [${questionNumber}/${HR_QUESTIONS.length}] SEQUENTIAL: Starting HR question ${question.id}`);
        await comprehensiveHRAnalysisService.rerunSingleQuestion(dealId, question.id);
        const duration = Math.round((Date.now() - startTime) / 1000);
        completedCount++;
        console.log(`✅ [${questionNumber}/${HR_QUESTIONS.length}] Completed ${question.id} in ${duration}s`);
        
        if (i < HR_QUESTIONS.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        console.error(`❌ [${questionNumber}/${HR_QUESTIONS.length}] Failed ${question.id} after ${duration}s:`, error);
        errors.push(`${question.id}: ${error.message}`);
        
        if (i < HR_QUESTIONS.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    await storage.updateBackgroundJob(masterJobId, {
      status: 'completed',
      progress: 100,
      currentStep: `Completed: ${completedCount}/${HR_QUESTIONS.length} questions analyzed`
    });
    
    console.log(`🎉 HR FORCE RERUN COMPLETE: ${completedCount}/${HR_QUESTIONS.length} questions`);
    
  } catch (fatalError: any) {
    console.error(`🚨 FATAL ERROR in HR force rerun:`, fatalError);
    await storage.updateBackgroundJob(masterJobId, {
      status: 'failed',
      progress: Math.round((completedCount / HR_QUESTIONS.length) * 100),
      currentStep: `Failed after ${completedCount} questions: ${fatalError.message}`
    });
    throw fatalError;
  }
}

// Register HR callback with AgentRunCoordinator
agentRunCoordinator.registerAgentCallback('hr', executeHRForceRerunAll);

/**
 * Get comprehensive HR analysis results
 */
persistentHRRoutes.get('/api/deals/:dealId/hr-analysis/comprehensive/results', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const { storage } = await import('../storage');
    
    const analysis = await storage.getAgentAnalysis(dealId, 'hr');
    
    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'No HR analysis found'
      });
    }

    console.log(`✅ Found comprehensive HR analysis - ${Object.keys(analysis.hrAnswers || {}).length} questions, ${analysis.findings?.length || 0} findings, ${analysis.recommendations?.length || 0} recommendations`);

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
        hrAnswers: analysis.hrAnswers || {}
      }
    });
    
  } catch (error) {
    console.error('Error getting comprehensive HR analysis results:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get HR analysis results' 
    });
  }
});

/**
 * Get progress for ALL active question reruns for a deal
 */
persistentHRRoutes.get('/api/deals/:dealId/hr-analysis/questions/progress', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const { comprehensiveHRAnalysisService } = await import('../comprehensiveHRAnalysisService');
    
    const allProgress = await comprehensiveHRAnalysisService.getAllQuestionProgress(dealId);
    
    res.json({
      success: true,
      progress: allProgress
    });
    
  } catch (error) {
    console.error('Error getting all HR question rerun progress:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get progress' 
    });
  }
});

/**
 * Re-run a single HR question
 */
persistentHRRoutes.post('/api/deals/:dealId/hr-analysis/question/:questionId/rerun', async (req, res) => {
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

    console.log(`🔄 Re-running HR question ${questionId} for deal ${dealId} (BACKGROUND MODE)`);
    
    const { comprehensiveHRAnalysisService } = await import('../comprehensiveHRAnalysisService');
    
    // ATOMIC REGISTRATION: Check and register the job in one step to prevent race conditions
    if (await comprehensiveHRAnalysisService.isQuestionRunning(dealId, questionId)) {
      console.log(`⚠️ HR question ${questionId} for deal ${dealId} is already being rerun`);
      return res.status(409).json({ 
        success: false, 
        error: `Question ${questionId} is already being rerun. Please wait for it to complete.` 
      });
    }
    
    // Immediately initialize progress to 0 (atomically registers the job)
    await comprehensiveHRAnalysisService.updateQuestionRerunProgress(dealId, questionId, 0);
    
    // Schedule background job execution on next event loop tick
    setImmediate(() => {
      comprehensiveHRAnalysisService.rerunSingleQuestion(dealId, questionId)
        .then(() => {
          console.log(`✅ Background HR rerun completed for question ${questionId} on deal ${dealId}`);
        })
        .catch(async error => {
          console.error(`❌ Background HR rerun failed for question ${questionId} on deal ${dealId}:`, error);
        });
    });
    
    // Return immediately - client will poll for progress
    res.json({
      success: true,
      message: 'HR question rerun started in background',
      questionId,
      dealId
    });
    
  } catch (error) {
    console.error('Error re-running HR question:', error);
    
    if (error.message && error.message.includes('already being rerun')) {
      return res.status(409).json({ 
        success: false, 
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to re-run HR question analysis' 
    });
  }
});

/**
 * Force rerun ALL HR questions (including already answered ones)
 * Uses AgentRunCoordinator for cross-agent sequential execution
 */
persistentHRRoutes.post('/api/deals/:dealId/hr-analysis/force-rerun-all', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const { HR_QUESTIONS } = await import('../comprehensiveHRAnalysisService');
    
    console.log(`🔥 FORCE RERUN: Enqueueing HR analysis via AgentRunCoordinator for deal ${dealId}`);
    
    const result = await agentRunCoordinator.enqueueAndStart(
      dealId,
      'hr',
      HR_QUESTIONS.length,
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
        ? `HR analysis started immediately`
        : `HR analysis queued at position ${result.queuePosition}`,
      queuePosition: result.queuePosition,
      isRunning: result.isRunning,
      totalQuestions: HR_QUESTIONS.length,
      dealId
    });
    
  } catch (error: any) {
    console.error('Error force rerunning all HR questions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to force rerun all questions' 
    });
  }
});

/**
 * Get queue status for HR analysis
 * EXACT MATCH to Financial implementation with proper total calculation
 */
persistentHRRoutes.get('/api/deals/:dealId/hr-analysis/queue-status', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const { storage } = await import('../storage');
    const { HR_QUESTIONS } = await import('../comprehensiveHRAnalysisService');
    const masterJobId = `force-rerun-all-hr-${dealId}`;
    
    const masterJob = await storage.getBackgroundJobById(masterJobId);
    
    const allJobs = await storage.getBackgroundJobsByDealId(dealId);
    const questionJobs = allJobs.filter(job => job.jobType === 'hr_question_rerun');
    
    const pending = questionJobs.filter(j => j.status === 'pending').length;
    const running = questionJobs.filter(j => j.status === 'processing').length;
    const completed = questionJobs.filter(j => j.status === 'completed').length;
    const failed = questionJobs.filter(j => j.status === 'failed').length;
    const cancelled = questionJobs.filter(j => j.status === 'cancelled').length;
    
    // Use constants length for total when master job exists (individual jobs get cleaned up)
    const total = masterJob ? HR_QUESTIONS.length : questionJobs.length;
    const progress = masterJob ? masterJob.progress : 0;
    const isProcessing = masterJob?.status === 'processing' || running > 0;
    
    // Calculate completed from progress when master job exists (individual jobs get cleaned up)
    const effectiveCompleted = masterJob && masterJob.status === 'processing' 
      ? Math.floor((masterJob.progress / 100) * HR_QUESTIONS.length)
      : completed;
    
    console.log(`📊 HR queue-status for deal ${dealId}: masterJob=${!!masterJob}, status=${masterJob?.status}, progress=${progress}%, isProcessing=${isProcessing}, total=${total}`);
    
    res.json({
      success: true,
      status: {
        total,
        pending,
        running,
        completed: effectiveCompleted,
        failed,
        cancelled,
        progress,
        currentQuestion: masterJob?.currentStep || null,
        currentQuestionId: null,
        isProcessing
      }
    });
    
  } catch (error) {
    console.error('Error getting HR queue status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get queue status' 
    });
  }
});

/**
 * Cancel HR queue processing
 * EXACT MATCH to Clinical implementation
 */
persistentHRRoutes.post('/api/deals/:dealId/hr-analysis/cancel-queue', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🛑 Cancelling HR question queue for deal ${dealId}`);
    
    const { storage } = await import('../storage');
    const { db } = await import('../db');
    const { backgroundJobs } = await import('../../shared/schema');
    const { and, eq, like } = await import('drizzle-orm');
    
    const masterJobId = `force-rerun-all-hr-${dealId}`;
    
    const masterJob = await storage.getBackgroundJobById(masterJobId);
    if (masterJob) {
      await storage.updateBackgroundJob(masterJobId, {
        status: 'cancelled',
        currentStep: 'Cancelled by user'
      });
    }
    
    const questionJobs = await db.query.backgroundJobs.findMany({
      where: and(
        eq(backgroundJobs.dealId, dealId),
        like(backgroundJobs.jobId, 'hr-question-rerun-%')
      )
    });
    
    for (const job of questionJobs) {
      await storage.deleteBackgroundJob(job.jobId);
    }
    console.log(`✅ Deleted ${questionJobs.length} HR question rerun jobs`);
    
    res.json({
      success: true,
      message: 'HR queue cancelled successfully'
    });
    
  } catch (error) {
    console.error('Error cancelling HR queue:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to cancel queue' 
    });
  }
});
