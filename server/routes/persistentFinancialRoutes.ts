/**
 * Persistent Financial Analysis Routes
 * Matches Clinical routes architecture exactly for consistent behavior
 */

import { Router } from 'express';
import { persistentFinancialAnalysisService } from '../services/persistentFinancialAnalysis';
import { agentRunCoordinator } from '../services/agentRunCoordinator';
import { db } from '../db';
import { backgroundJobs } from '../../shared/schema';
import { eq, and, like } from 'drizzle-orm';

const router = Router();

/**
 * Execute Financial force-rerun-all - called by AgentRunCoordinator when it's Financial's turn
 */
async function executeFinancialForceRerunAll(dealId: number): Promise<void> {
  const { comprehensiveFinancialAnalysisService, COMPREHENSIVE_FINANCIAL_QUESTIONS } = await import('../comprehensiveFinancialAnalysisService');
  const { storage } = await import('../storage');
  
  const masterJobId = `force-rerun-all-financial-${dealId}`;
  
  const existingMasterJob = await storage.getBackgroundJobById(masterJobId);
  if (existingMasterJob) {
    await storage.deleteBackgroundJob(masterJobId);
  }
  
  await storage.createBackgroundJob({
    jobId: masterJobId,
    jobType: 'force_rerun_all_financial',
    dealId,
    status: 'processing',
    progress: 0,
    currentStep: 'Starting sequential force rerun of all financial questions'
  });
  
  await db
    .delete(backgroundJobs)
    .where(
      and(
        eq(backgroundJobs.dealId, dealId),
        like(backgroundJobs.jobId, 'financial-question-rerun-%')
      )
    );
  
  let completedCount = 0;
  const errors: string[] = [];
  
  try {
    for (let i = 0; i < COMPREHENSIVE_FINANCIAL_QUESTIONS.length; i++) {
      const question = COMPREHENSIVE_FINANCIAL_QUESTIONS[i];
      const questionNumber = i + 1;
      const startTime = Date.now();
      
      const overallProgress = Math.round((i / COMPREHENSIVE_FINANCIAL_QUESTIONS.length) * 100);
      await storage.updateBackgroundJob(masterJobId, {
        progress: overallProgress,
        currentStep: `Processing question ${questionNumber}/${COMPREHENSIVE_FINANCIAL_QUESTIONS.length}: ${question.id}`
      });
      
      await agentRunCoordinator.updateProgress(
        dealId, 
        'financial', 
        completedCount,
        `Question ${questionNumber}/${COMPREHENSIVE_FINANCIAL_QUESTIONS.length}: ${question.id}`
      );
      
      try {
        console.log(`💰 [${questionNumber}/${COMPREHENSIVE_FINANCIAL_QUESTIONS.length}] SEQUENTIAL: Starting financial question ${question.id}`);
        await comprehensiveFinancialAnalysisService.rerunSingleQuestion(dealId, question.id);
        const duration = Math.round((Date.now() - startTime) / 1000);
        completedCount++;
        console.log(`✅ [${questionNumber}/${COMPREHENSIVE_FINANCIAL_QUESTIONS.length}] Completed ${question.id} in ${duration}s`);
        
        if (i < COMPREHENSIVE_FINANCIAL_QUESTIONS.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        console.error(`❌ [${questionNumber}/${COMPREHENSIVE_FINANCIAL_QUESTIONS.length}] Failed ${question.id} after ${duration}s:`, error);
        errors.push(`${question.id}: ${error.message}`);
        
        if (i < COMPREHENSIVE_FINANCIAL_QUESTIONS.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    await storage.updateBackgroundJob(masterJobId, {
      status: 'completed',
      progress: 100,
      currentStep: `Completed: ${completedCount}/${COMPREHENSIVE_FINANCIAL_QUESTIONS.length} questions analyzed`
    });
    
    console.log(`🎉 FINANCIAL FORCE RERUN COMPLETE: ${completedCount}/${COMPREHENSIVE_FINANCIAL_QUESTIONS.length} questions`);
    
  } catch (fatalError: any) {
    console.error(`🚨 FATAL ERROR in financial force rerun:`, fatalError);
    await storage.updateBackgroundJob(masterJobId, {
      status: 'failed',
      progress: Math.round((completedCount / COMPREHENSIVE_FINANCIAL_QUESTIONS.length) * 100),
      currentStep: `Failed after ${completedCount} questions: ${fatalError.message}`
    });
    throw fatalError;
  }
}

// Register Financial callback with AgentRunCoordinator
agentRunCoordinator.registerAgentCallback('financial', executeFinancialForceRerunAll);

// Start persistent financial analysis - EXACTLY like Clinical
router.post('/api/deals/:dealId/financial-analysis/persistent/start', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ error: 'Invalid deal ID' });
    }

    console.log(`💰 API: Starting persistent financial analysis for deal ${dealId}`);
    
    const jobId = await persistentFinancialAnalysisService.startFinancialAnalysis(dealId);
    
    res.json({ 
      success: true, 
      jobId,
      message: 'Persistent financial analysis started successfully'
    });

  } catch (error) {
    console.error('❌ Failed to start persistent financial analysis:', error);
    
    if (error instanceof Error && error.message.includes('already running')) {
      return res.status(409).json({ 
        error: 'Financial analysis already running for this deal',
        code: 'ALREADY_RUNNING'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to start persistent financial analysis',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Stop persistent financial analysis - EXACTLY like Clinical
router.post('/api/deals/:dealId/financial-analysis/persistent/stop', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ error: 'Invalid deal ID' });
    }

    console.log(`🛑 API: Stopping persistent financial analysis for deal ${dealId}`);
    
    const success = await persistentFinancialAnalysisService.stopFinancialAnalysis(dealId);
    
    if (success) {
      res.json({ 
        success: true, 
        message: 'Persistent financial analysis stopped successfully'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to stop persistent financial analysis'
      });
    }

  } catch (error) {
    console.error('❌ Failed to stop persistent financial analysis:', error);
    res.status(500).json({ 
      error: 'Failed to stop persistent financial analysis',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get persistent financial analysis status - EXACTLY like Clinical
router.get('/api/deals/:dealId/financial-analysis/persistent/status', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ error: 'Invalid deal ID' });
    }

    const status = await persistentFinancialAnalysisService.getJobStatus(dealId);
    
    res.json({ 
      success: true, 
      status: status || null
    });

  } catch (error) {
    console.error('❌ Failed to get persistent financial analysis status:', error);
    res.status(500).json({ 
      error: 'Failed to get persistent financial analysis status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get comprehensive financial analysis results - EXACTLY like Legal agent
 */
router.get('/api/deals/:dealId/financial-analysis/comprehensive/results', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    // Import storage here to avoid circular dependency
    const { storage } = await import('../storage');
    
    const analysis = await storage.getAgentAnalysis(dealId, 'Financial');
    
    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'No financial analysis found'
      });
    }

    console.log(`✅ Found comprehensive financial analysis - ${Object.keys(analysis.financialAnswers || {}).length} questions, ${analysis.findings?.length || 0} findings, ${analysis.recommendations?.length || 0} recommendations`);

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
        financialAnswers: analysis.financialAnswers || {}
      }
    });
    
  } catch (error) {
    console.error('Error getting comprehensive financial analysis results:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get financial analysis results' 
    });
  }
});

/**
 * Get progress for ALL active question reruns for a deal
 */
router.get('/api/deals/:dealId/financial-analysis/questions/progress', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const { comprehensiveFinancialAnalysisService } = await import('../comprehensiveFinancialAnalysisService');
    
    const allProgress = comprehensiveFinancialAnalysisService.getAllQuestionProgress(dealId);
    
    res.json({
      success: true,
      progress: allProgress
    });
    
  } catch (error) {
    console.error('Error getting all financial question rerun progress:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get progress' 
    });
  }
});

/**
 * Get progress for a single question rerun
 */
router.get('/api/deals/:dealId/financial-analysis/question/:questionId/progress', async (req, res) => {
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

    const { comprehensiveFinancialAnalysisService } = await import('../comprehensiveFinancialAnalysisService');
    
    const progress = await comprehensiveFinancialAnalysisService.getQuestionRerunProgress(dealId, questionId);
    
    res.json({
      success: true,
      progress
    });
    
  } catch (error) {
    console.error('Error getting financial question rerun progress:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get progress' 
    });
  }
});

/**
 * Re-run a single financial question with database-backed persistence
 */
router.post('/api/deals/:dealId/financial-analysis/question/:questionId/rerun', async (req, res) => {
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

    console.log(`🔄 Re-running financial question ${questionId} for deal ${dealId} (BACKGROUND MODE)`);
    
    const { comprehensiveFinancialAnalysisService } = await import('../comprehensiveFinancialAnalysisService');
    
    // Check if already running
    if (await comprehensiveFinancialAnalysisService.isQuestionRunning(dealId, questionId)) {
      console.log(`⚠️ Financial question ${questionId} for deal ${dealId} is already being rerun`);
      return res.status(409).json({ 
        success: false, 
        error: `Question ${questionId} is already being rerun. Please wait for it to complete.` 
      });
    }
    
    // Immediately initialize progress to 0 (atomically registers the job)
    await comprehensiveFinancialAnalysisService.updateQuestionRerunProgress(dealId, questionId, 0);
    
    // Schedule background job execution
    setImmediate(() => {
      comprehensiveFinancialAnalysisService.rerunSingleQuestion(dealId, questionId, customInstructions || '')
        .then(() => {
          console.log(`✅ Background financial rerun completed for question ${questionId} on deal ${dealId}`);
        })
        .catch(async error => {
          console.error(`❌ Background financial rerun failed for question ${questionId} on deal ${dealId}:`, error);
        });
    });
    
    // Return immediately - client will poll for progress
    res.json({
      success: true,
      message: 'Financial question rerun started in background',
      questionId,
      dealId
    });
    
  } catch (error) {
    console.error('Error re-running financial question:', error);
    
    if (error.message && error.message.includes('already being rerun')) {
      return res.status(409).json({ 
        success: false, 
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to re-run financial question analysis' 
    });
  }
});

/**
 * Force rerun ALL financial questions (including already answered ones)
 * Uses AgentRunCoordinator for cross-agent sequential execution
 */
router.post('/api/deals/:dealId/financial-analysis/force-rerun-all', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const { COMPREHENSIVE_FINANCIAL_QUESTIONS } = await import('../comprehensiveFinancialAnalysisService');
    
    console.log(`🔥 FORCE RERUN: Enqueueing Financial analysis via AgentRunCoordinator for deal ${dealId}`);
    
    const result = await agentRunCoordinator.enqueueAndStart(
      dealId,
      'financial',
      COMPREHENSIVE_FINANCIAL_QUESTIONS.length
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
        ? `Financial analysis started immediately`
        : `Financial analysis queued at position ${result.queuePosition}`,
      queuePosition: result.queuePosition,
      isRunning: result.isRunning,
      totalQuestions: COMPREHENSIVE_FINANCIAL_QUESTIONS.length,
      dealId
    });
    
  } catch (error: any) {
    console.error('Error force rerunning all Financial questions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to force rerun all questions' 
    });
  }
});

/**
 * Get queue status for Financial analysis
 * EXACT MATCH to HR/Clinical implementation with proper total calculation
 */
router.get('/api/deals/:dealId/financial-analysis/queue-status', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const { storage } = await import('../storage');
    const { COMPREHENSIVE_FINANCIAL_QUESTIONS } = await import('../comprehensiveFinancialAnalysisService');
    const masterJobId = `force-rerun-all-financial-${dealId}`;
    
    const masterJob = await storage.getBackgroundJobById(masterJobId);
    
    const allJobs = await storage.getBackgroundJobsByDealId(dealId);
    const questionJobs = allJobs.filter(job => job.jobType === 'financial_question_rerun');
    
    const pending = questionJobs.filter(j => j.status === 'pending').length;
    const running = questionJobs.filter(j => j.status === 'processing').length;
    const completed = questionJobs.filter(j => j.status === 'completed').length;
    const failed = questionJobs.filter(j => j.status === 'failed').length;
    const cancelled = questionJobs.filter(j => j.status === 'cancelled').length;
    
    // Use constants length for total when master job exists (individual jobs get cleaned up)
    const total = masterJob ? COMPREHENSIVE_FINANCIAL_QUESTIONS.length : questionJobs.length;
    const progress = masterJob ? masterJob.progress : 0;
    const isProcessing = masterJob?.status === 'processing' || running > 0;
    
    // Calculate completed from progress when master job exists (individual jobs get cleaned up)
    const effectiveCompleted = masterJob && masterJob.status === 'processing' 
      ? Math.floor((masterJob.progress / 100) * COMPREHENSIVE_FINANCIAL_QUESTIONS.length)
      : completed;
    
    console.log(`📊 Financial queue-status for deal ${dealId}: masterJob=${!!masterJob}, status=${masterJob?.status}, progress=${progress}%, isProcessing=${isProcessing}, total=${total}`);
    
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
    console.error('Error getting Financial queue status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get queue status' 
    });
  }
});

/**
 * Cancel Financial queue processing
 * EXACT MATCH to HR/Clinical implementation
 */
router.post('/api/deals/:dealId/financial-analysis/cancel-queue', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🛑 Cancelling Financial question queue for deal ${dealId}`);
    
    const { storage } = await import('../storage');
    const { db } = await import('../db');
    const { backgroundJobs } = await import('../../shared/schema');
    const { and, eq, like } = await import('drizzle-orm');
    
    const masterJobId = `force-rerun-all-financial-${dealId}`;
    
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
        like(backgroundJobs.jobId, 'financial-question-rerun-%')
      )
    });
    
    for (const job of questionJobs) {
      await storage.deleteBackgroundJob(job.jobId);
    }
    console.log(`✅ Deleted ${questionJobs.length} Financial question rerun jobs`);
    
    res.json({
      success: true,
      message: 'Financial queue cancelled successfully'
    });
    
  } catch (error) {
    console.error('Error cancelling Financial queue:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to cancel queue' 
    });
  }
});

export default router;