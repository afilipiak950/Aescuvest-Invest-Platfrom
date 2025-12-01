/**
 * Persistent Research Analysis Routes
 * Based on the proven Legal analysis routes architecture
 * INCLUDES: Force Rerun All queue system (BULLETPROOF - identical to Legal)
 */

import { Router } from 'express';
import { persistentResearchAnalysisService } from '../services/persistentResearchAnalysis';
import { storage } from '../storage';
import { db } from '../db';
import { backgroundJobs } from '../../shared/schema';
import { and, eq, like } from 'drizzle-orm';
import { researchQuestionQueue } from '../services/researchQuestionQueue';
import { agentRunCoordinator } from '../services/agentRunCoordinator';

export const persistentResearchRoutes = Router();

/**
 * Execute Research force-rerun-all - called by AgentRunCoordinator when it's Research's turn
 */
async function executeResearchForceRerunAll(dealId: number): Promise<void> {
  const { comprehensiveResearchAnalysisService, RESEARCH_QUESTIONS } = await import('../comprehensiveResearchAnalysisService');
  
  const masterJobId = `force-rerun-all-research-${dealId}`;
  
  const existingMasterJob = await storage.getBackgroundJobById(masterJobId);
  if (existingMasterJob) {
    await storage.deleteBackgroundJob(masterJobId);
  }
  
  await storage.createBackgroundJob({
    jobId: masterJobId,
    jobType: 'force_rerun_all_research',
    dealId,
    status: 'processing',
    progress: 0,
    currentStep: 'Starting sequential force rerun of all research questions'
  });
  
  await db
    .delete(backgroundJobs)
    .where(
      and(
        eq(backgroundJobs.dealId, dealId),
        like(backgroundJobs.jobId, 'research-question-rerun-%')
      )
    );
  
  let completedCount = 0;
  const errors: string[] = [];
  
  try {
    for (let i = 0; i < RESEARCH_QUESTIONS.length; i++) {
      const question = RESEARCH_QUESTIONS[i];
      const questionNumber = i + 1;
      const startTime = Date.now();
      
      const overallProgress = Math.round((i / RESEARCH_QUESTIONS.length) * 100);
      await storage.updateBackgroundJob(masterJobId, {
        progress: overallProgress,
        currentStep: `Processing question ${questionNumber}/${RESEARCH_QUESTIONS.length}: ${question.id}`
      });
      
      await agentRunCoordinator.updateProgress(
        dealId, 
        'research', 
        completedCount,
        `Question ${questionNumber}/${RESEARCH_QUESTIONS.length}: ${question.id}`
      );
      
      try {
        console.log(`🔬 [${questionNumber}/${RESEARCH_QUESTIONS.length}] SEQUENTIAL: Starting research question ${question.id}`);
        await comprehensiveResearchAnalysisService.rerunSingleQuestion(dealId, question.id);
        const duration = Math.round((Date.now() - startTime) / 1000);
        completedCount++;
        console.log(`✅ [${questionNumber}/${RESEARCH_QUESTIONS.length}] Completed ${question.id} in ${duration}s`);
        
        if (i < RESEARCH_QUESTIONS.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        console.error(`❌ [${questionNumber}/${RESEARCH_QUESTIONS.length}] Failed ${question.id} after ${duration}s:`, error);
        errors.push(`${question.id}: ${error.message}`);
        
        if (i < RESEARCH_QUESTIONS.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    await storage.updateBackgroundJob(masterJobId, {
      status: 'completed',
      progress: 100,
      currentStep: `Completed: ${completedCount}/${RESEARCH_QUESTIONS.length} questions analyzed`
    });
    
    console.log(`🎉 RESEARCH FORCE RERUN COMPLETE: ${completedCount}/${RESEARCH_QUESTIONS.length} questions`);
    
  } catch (fatalError: any) {
    console.error(`🚨 FATAL ERROR in research force rerun:`, fatalError);
    await storage.updateBackgroundJob(masterJobId, {
      status: 'failed',
      progress: Math.round((completedCount / RESEARCH_QUESTIONS.length) * 100),
      currentStep: `Failed after ${completedCount} questions: ${fatalError.message}`
    });
    throw fatalError;
  }
}

// Register Research callback with AgentRunCoordinator
agentRunCoordinator.registerAgentCallback('research', executeResearchForceRerunAll);

/**
 * Start Research Analysis - EXACT Legal approach
 */
persistentResearchRoutes.post('/api/deals/:dealId/research-analysis/start', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);

    console.log(`🔬 Starting persistent research analysis for deal ${dealId}`);

    // Check if there's already an active job - EXACT Legal approach
    const existingJob = await storage.getBackgroundJobsByDealAndType(dealId, 'research_analysis');
    if (existingJob && existingJob.status === 'running') {
      console.log(`⚠️ Research analysis already running for deal ${dealId} (Job: ${existingJob.jobId})`);
      return res.json({ 
        success: false, 
        message: `Research analysis already in progress (${Math.round(existingJob.progress || 0)}% complete)`,
        alreadyRunning: true,
        progress: existingJob.progress || 0
      });
    }

    // Start the persistent research analysis
    const jobId = await persistentResearchAnalysisService.startResearchAnalysis(dealId);

    res.json({
      success: true,
      message: 'Research analysis started successfully',
      jobId,
      started: true
    });

  } catch (error) {
    console.error('❌ Error starting research analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start research analysis',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get Research Analysis Status - EXACT Legal approach
 */
persistentResearchRoutes.get('/api/deals/:dealId/research-analysis/status', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);

    // Check for active job
    const job = await storage.getBackgroundJobsByDealAndType(dealId, 'research_analysis');
    
    if (!job) {
      return res.json({
        success: true,
        status: 'not_started',
        progress: 0,
        message: 'No research analysis job found'
      });
    }

    // Get detailed status from persistent service
    const jobStatus = await persistentResearchAnalysisService.getJobStatus(job.jobId);

    res.json({
      success: true,
      status: job.status,
      progress: job.progress || 0,
      currentStep: job.currentStep || 'Processing',
      jobId: job.jobId,
      isActive: jobStatus.isActive,
      createdAt: job.createdAt,
      completedAt: job.completedAt
    });

  } catch (error) {
    console.error('❌ Error getting research analysis status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get research analysis status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Cancel Research Analysis - EXACT Legal approach
 */
persistentResearchRoutes.post('/api/deals/:dealId/research-analysis/cancel', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);

    // Find active job
    const job = await storage.getBackgroundJobsByDealAndType(dealId, 'research_analysis');
    
    if (!job || job.status !== 'running') {
      return res.json({
        success: false,
        message: 'No active research analysis found to cancel'
      });
    }

    // Cancel the job
    await persistentResearchAnalysisService.cancelJob(job.jobId);

    res.json({
      success: true,
      message: 'Research analysis cancelled successfully'
    });

  } catch (error) {
    console.error('❌ Error canceling research analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel research analysis',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get Research Results - EXACT Legal approach
 */
persistentResearchRoutes.get('/api/deals/:dealId/research-analysis/results', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    console.log(`🔬 Fetching research analysis results for deal ${dealId}`);

    // Get the analysis from storage - EXACT Legal approach
    const analysis = await storage.getAgentAnalysis(dealId, 'Research');
    
    if (!analysis) {
      return res.json({
        success: true,
        analysis: null,
        message: 'No research analysis found'
      });
    }

    // Parse research answers if they exist - EXACT Legal approach
    let researchAnswers = {};
    if (analysis.research_answers) {
      try {
        researchAnswers = typeof analysis.research_answers === 'string' 
          ? JSON.parse(analysis.research_answers) 
          : analysis.research_answers;
      } catch (error) {
        console.error('Error parsing research answers:', error);
        researchAnswers = {};
      }
    }
    
    console.log(`🔬 Research Analysis Data:`, {
      hasAnswers: !!analysis.research_answers,
      answersType: typeof analysis.research_answers,
      parsedAnswersKeys: Object.keys(researchAnswers)
    });

    // Parse findings and recommendations - EXACT Legal approach
    let findings = [];
    let recommendations = [];
    
    if (analysis.findings) {
      try {
        findings = typeof analysis.findings === 'string' 
          ? JSON.parse(analysis.findings) 
          : analysis.findings;
      } catch (error) {
        console.error('Error parsing findings:', error);
        findings = [];
      }
    }
    
    if (analysis.recommendations) {
      try {
        recommendations = typeof analysis.recommendations === 'string' 
          ? JSON.parse(analysis.recommendations) 
          : analysis.recommendations;
      } catch (error) {
        console.error('Error parsing recommendations:', error);
        recommendations = [];
      }
    }

    res.json({
      success: true,
      analysis: {
        id: analysis.id,
        dealId: analysis.dealId,
        agentType: analysis.agentType,
        status: analysis.status,
        progress: analysis.progress,
        research_answers: researchAnswers,
        findings: findings,
        recommendations: recommendations,
        documentSources: analysis.documentSources,
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ Error fetching research analysis results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch research analysis results',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get comprehensive research analysis results - EXACT Legal match
 */
persistentResearchRoutes.get('/api/deals/:dealId/research-analysis/comprehensive/results', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const analysis = await storage.getAgentAnalysis(dealId, 'Research');
    
    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'No research analysis found'
      });
    }

    console.log(`✅ Found comprehensive research analysis - ${Object.keys(analysis.research_answers || {}).length} questions, ${analysis.findings?.length || 0} findings, ${analysis.recommendations?.length || 0} recommendations`);

    // EXACT LEGAL PATTERN: Use 'analysis' wrapper like Legal does
    res.json({
      success: true,
      analysis: {
        dealId,
        agentType: analysis.agentType,
        status: analysis.status,
        progress: analysis.progress || 100,
        findings: analysis.findings || [],
        recommendations: analysis.recommendations || [],
        confidence: analysis.confidence || 0,
        completedAt: analysis.completedAt,
        researchAnswers: analysis.research_answers || {},
        research_answers: analysis.research_answers || {}
      }
    });
    
  } catch (error) {
    console.error('Error getting comprehensive research analysis results:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get research analysis results' 
    });
  }
});

/**
 * Get progress for ALL active question reruns for a deal
 */
persistentResearchRoutes.get('/api/deals/:dealId/research-analysis/questions/progress', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const { ComprehensiveResearchAnalysisService } = await import('../comprehensiveResearchAnalysisService');
    const service = new ComprehensiveResearchAnalysisService();
    
    const allProgress = service.getAllQuestionProgress(dealId);
    
    res.json({
      success: true,
      progress: allProgress
    });
    
  } catch (error) {
    console.error('Error getting all research question rerun progress:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get progress' 
    });
  }
});

/**
 * Get progress for a single question rerun
 */
persistentResearchRoutes.get('/api/deals/:dealId/research-analysis/question/:questionId/progress', async (req, res) => {
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

    const { ComprehensiveResearchAnalysisService } = await import('../comprehensiveResearchAnalysisService');
    const service = new ComprehensiveResearchAnalysisService();
    
    const progress = await service.getQuestionRerunProgress(dealId, questionId);
    
    res.json({
      success: true,
      progress
    });
    
  } catch (error) {
    console.error('Error getting research question rerun progress:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get progress' 
    });
  }
});

/**
 * Re-run a single research question with database-backed persistence
 */
persistentResearchRoutes.post('/api/deals/:dealId/research-analysis/question/:questionId/rerun', async (req, res) => {
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

    console.log(`🔄 Re-running research question ${questionId} for deal ${dealId} (BACKGROUND MODE)`);
    
    const { ComprehensiveResearchAnalysisService } = await import('../comprehensiveResearchAnalysisService');
    const service = new ComprehensiveResearchAnalysisService();
    
    // Check if already running
    if (await service.isQuestionRunning(dealId, questionId)) {
      console.log(`⚠️ Research question ${questionId} for deal ${dealId} is already being rerun`);
      return res.status(409).json({ 
        success: false, 
        error: `Question ${questionId} is already being rerun. Please wait for it to complete.` 
      });
    }
    
    // Immediately initialize progress to 0 (atomically registers the job)
    await service.updateQuestionRerunProgress(dealId, questionId, 0);
    
    // Schedule background job execution - LEGAL PATTERN (2 args only)
    setImmediate(() => {
      service.rerunSingleQuestion(dealId, questionId)
        .then(() => {
          console.log(`✅ Background research rerun completed for question ${questionId} on deal ${dealId}`);
        })
        .catch(async error => {
          console.error(`❌ Background research rerun failed for question ${questionId} on deal ${dealId}:`, error);
        });
    });
    
    // Return immediately - client will poll for progress
    res.json({
      success: true,
      message: 'Research question rerun started in background',
      questionId,
      dealId
    });
    
  } catch (error) {
    console.error('Error re-running research question:', error);
    
    if (error.message && error.message.includes('already being rerun')) {
      return res.status(409).json({ 
        success: false, 
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to re-run research question analysis' 
    });
  }
});

/**
 * Force rerun ALL research questions (including already answered ones)
 * Uses AgentRunCoordinator for cross-agent sequential execution
 */
persistentResearchRoutes.post('/api/deals/:dealId/research-analysis/force-rerun-all', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const { RESEARCH_QUESTIONS } = await import('../comprehensiveResearchAnalysisService');
    
    console.log(`🔥 FORCE RERUN: Enqueueing Research analysis via AgentRunCoordinator for deal ${dealId}`);
    
    const result = await agentRunCoordinator.enqueueAndStart(
      dealId,
      'research',
      RESEARCH_QUESTIONS.length,
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
        ? `Research analysis started immediately`
        : `Research analysis queued at position ${result.queuePosition}`,
      queuePosition: result.queuePosition,
      isRunning: result.isRunning,
      totalQuestions: RESEARCH_QUESTIONS.length,
      dealId
    });
    
  } catch (error: any) {
    console.error('Error force rerunning all research questions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to force rerun all questions' 
    });
  }
});

/**
 * Get queue status for Research analysis
 * DATABASE-BACKED: Uses master job like IP - stable progress bar that doesn't flicker
 */
persistentResearchRoutes.get('/api/deals/:dealId/research-analysis/queue-status', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const { RESEARCH_QUESTIONS } = await import('../comprehensiveResearchAnalysisService');
    
    // Check for master job first (like IP does) - this is the source of truth
    const masterJobId = `force-rerun-all-research-${dealId}`;
    const masterJob = await storage.getBackgroundJobById(masterJobId);
    
    // Get all background jobs for this deal
    const allJobs = await storage.getBackgroundJobsByDealId(dealId);
    const questionJobs = allJobs.filter(job => job.jobType === 'research_question_rerun');
    
    const pending = questionJobs.filter(j => j.status === 'pending').length;
    const running = questionJobs.filter(j => j.status === 'processing').length;
    const completed = questionJobs.filter(j => j.status === 'completed').length;
    const failed = questionJobs.filter(j => j.status === 'failed').length;
    const cancelled = questionJobs.filter(j => j.status === 'cancelled').length;
    
    const total = RESEARCH_QUESTIONS.length;
    const progress = masterJob ? masterJob.progress : (total > 0 ? Math.round((completed / total) * 100) : 0);
    
    // Extract currentQuestionId from master job's currentStep
    let currentQuestionId: string | null = null;
    let currentQuestion: string | null = null;
    
    if (masterJob?.currentStep) {
      // Match question ID like "research_1", "research_2", etc. from the currentStep
      const match = masterJob.currentStep.match(/research_\d+/);
      if (match) {
        currentQuestionId = match[0];
      }
      currentQuestion = masterJob.currentStep;
    }
    
    // If no master job currentStep, check individual running jobs
    if (!currentQuestion) {
      const runningJob = questionJobs.find(j => j.status === 'processing');
      if (runningJob?.currentStep) {
        const match = runningJob.currentStep.match(/research_\d+/);
        if (match) {
          currentQuestionId = match[0];
        }
        currentQuestion = runningJob.currentStep;
      }
    }
    
    // isProcessing is true if master job is processing (stable, no flicker between questions)
    const isProcessing = masterJob?.status === 'processing' || running > 0;
    
    // Effective processing: true if master job exists and not completed
    const effectiveIsProcessing = isProcessing || (masterJob && masterJob.progress < 100 && masterJob.status !== 'completed');
    
    console.log(`📊 Research queue-status for deal ${dealId}: masterJob=${!!masterJob}, status=${masterJob?.status}, progress=${progress}%, isProcessing=${isProcessing}, effectiveIsProcessing=${effectiveIsProcessing}, currentQuestionId=${currentQuestionId}`);
    
    res.json({
      success: true,
      status: {
        total,
        pending,
        running: effectiveIsProcessing ? Math.max(1, running) : 0,  // If processing, at least 1 question is running
        completed,
        failed,
        cancelled,
        progress,
        currentQuestion,
        currentQuestionId,
        isProcessing: effectiveIsProcessing  // Use effective to prevent flicker
      }
    });
    
  } catch (error) {
    console.error('Error getting research queue status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get queue status' 
    });
  }
});

/**
 * Cancel queue processing for Research analysis
 * DATABASE-BACKED: Deletes background jobs like IP does - actually stops the queue
 */
persistentResearchRoutes.post('/api/deals/:dealId/research-analysis/cancel-queue', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🛑 Cancelling research question queue for deal ${dealId}`);
    
    const { db } = await import('../db');
    const { backgroundJobs } = await import('../../shared/schema');
    const { and: drizzleAnd, eq: drizzleEq, or: drizzleOr } = await import('drizzle-orm');
    
    // Clear in-memory state first
    await researchQuestionQueue.cancelQueue(dealId);
    
    // Delete master job first
    const masterJobId = `force-rerun-all-research-${dealId}`;
    await storage.deleteBackgroundJob(masterJobId);
    console.log(`✅ Deleted master job: ${masterJobId}`);
    
    // Delete all research question background jobs for this deal
    const existingJobs = await db.query.backgroundJobs.findMany({
      where: drizzleAnd(
        drizzleEq(backgroundJobs.dealId, dealId),
        drizzleEq(backgroundJobs.jobType, 'research_question_rerun')
      )
    });
    
    for (const job of existingJobs) {
      await storage.deleteBackgroundJob(job.jobId);
    }
    console.log(`✅ Deleted ${existingJobs.length} research question background jobs`);
    
    res.json({
      success: true,
      message: 'Research queue cancelled successfully',
      deletedJobs: existingJobs.length
    });
    
  } catch (error) {
    console.error('Error cancelling research queue:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to cancel queue' 
    });
  }
});