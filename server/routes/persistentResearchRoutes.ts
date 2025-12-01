/**
 * Persistent Research Analysis Routes
 * Based on the proven Legal analysis routes architecture
 * INCLUDES: Force Rerun All queue system (identical to Legal/Clinical/HR/IP)
 */

import { Router } from 'express';
import { persistentResearchAnalysisService } from '../services/persistentResearchAnalysis';
import { storage } from '../storage';
import { db } from '../db';
import { backgroundJobs } from '../../shared/schema';
import { and, eq, like } from 'drizzle-orm';

export const persistentResearchRoutes = Router();

/**
 * WebSocket broadcast helper for Research queue progress
 * EXACT MATCH to IP/Legal pattern
 */
async function broadcastResearchQueueProgress(
  dealId: number, 
  currentQuestionId: string | null, 
  completed: number, 
  total: number, 
  isProcessing: boolean
) {
  try {
    const { websocketManager } = await import('../services/websocketManager');
    websocketManager.broadcast('research_queue_progress', {
      dealId,
      currentQuestionId,
      completed,
      total,
      isProcessing,
      progress: Math.round((completed / total) * 100)
    }, dealId);
  } catch (error) {
    console.error('Error broadcasting research queue progress:', error);
  }
}

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
 * Uses COMPREHENSIVE ANALYSIS with evidence extraction from ALL documents
 * EXACT MATCH to IP/Legal/Clinical/HR Force Rerun All architecture
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

    console.log(`🔥 FORCE RERUN: Checking if sequential analysis is already running for deal ${dealId}`);
    
    const { RESEARCH_QUESTIONS, ComprehensiveResearchAnalysisService } = await import('../comprehensiveResearchAnalysisService');
    const comprehensiveResearchAnalysisService = new ComprehensiveResearchAnalysisService();
    
    const masterJobId = `force-rerun-all-research-${dealId}`;
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
    
    if (existingMasterJob) {
      console.log(`🧹 Cleaning up previous force-rerun job with status: ${existingMasterJob.status}`);
      await storage.deleteBackgroundJob(masterJobId);
      console.log(`✅ Deleted old force-rerun master job`);
    }
    
    console.log(`🔥 FORCE RERUN: Starting SEQUENTIAL COMPREHENSIVE analysis for ALL research questions on deal ${dealId}`);
    
    await storage.createBackgroundJob({
      jobId: masterJobId,
      jobType: 'force_rerun_all_research',
      dealId,
      status: 'processing',
      progress: 0,
      currentStep: 'Starting sequential force rerun of all research questions'
    });
    console.log(`🔒 Created master lock job: ${masterJobId}`);
    
    console.log(`🧹 Cleaning up any existing research question rerun jobs for deal ${dealId}`);
    
    await db
      .delete(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.dealId, dealId),
          like(backgroundJobs.jobId, 'research-question-rerun-%')
        )
      );
    console.log(`✅ Cleaned up existing research question rerun jobs`);
    
    res.json({
      success: true,
      message: `Force rerun: Started sequential comprehensive analysis - questions will run one after another`,
      startedCount: RESEARCH_QUESTIONS.length,
      totalQuestions: RESEARCH_QUESTIONS.length,
      dealId,
      estimatedTime: `${Math.round(RESEARCH_QUESTIONS.length * 10 / 60)} hours (10 min average per question)`
    });
    
    setImmediate(async () => {
      let completedCount = 0;
      const errors: string[] = [];
      
      try {
        for (let i = 0; i < RESEARCH_QUESTIONS.length; i++) {
          const question = RESEARCH_QUESTIONS[i];
          const questionNumber = i + 1;
          const startTime = Date.now();
          
          const baseProgress = Math.round((i / RESEARCH_QUESTIONS.length) * 100);
          const questionProgressIncrement = Math.round(100 / RESEARCH_QUESTIONS.length);
          let currentQuestionProgress = 10;
          
          await storage.updateBackgroundJob(masterJobId, {
            progress: baseProgress,
            currentStep: `Processing question ${questionNumber}/${RESEARCH_QUESTIONS.length}: ${question.id}`
          });
          
          await broadcastResearchQueueProgress(dealId, question.id, completedCount, RESEARCH_QUESTIONS.length, true);
          
          try {
            console.log(`🎯 [${questionNumber}/${RESEARCH_QUESTIONS.length}] SEQUENTIAL: Starting question ${question.id}`);
            console.log(`⏰ Timestamp: ${new Date().toISOString()} - Ensuring previous question completed before starting this one`);
            
            let progressInterval: ReturnType<typeof setInterval> | null = null;
            let questionCompleted = false;
            
            progressInterval = setInterval(async () => {
              if (questionCompleted) {
                if (progressInterval) clearInterval(progressInterval);
                return;
              }
              try {
                const questionJobId = `research-question-rerun-${dealId}-${question.id}`;
                const questionJob = await storage.getBackgroundJobById(questionJobId);
                
                if (questionJob && questionJob.progress !== null && questionJob.progress > currentQuestionProgress) {
                  currentQuestionProgress = questionJob.progress;
                  const combinedProgress = baseProgress + Math.round((currentQuestionProgress / 100) * questionProgressIncrement);
                  await storage.updateBackgroundJob(masterJobId, {
                    progress: Math.min(99, combinedProgress),
                    currentStep: `Processing question ${questionNumber}/${RESEARCH_QUESTIONS.length}: ${question.id}`
                  });
                  console.log(`📊 [Research] Question ${question.id} progress: ${currentQuestionProgress}%, overall: ${combinedProgress}%`);
                }
              } catch (err) {
                // Ignore errors in progress tracking
              }
            }, 2000);
            
            await comprehensiveResearchAnalysisService.rerunSingleQuestion(dealId, question.id);
            
            questionCompleted = true;
            if (progressInterval) clearInterval(progressInterval);
            
            const duration = Math.round((Date.now() - startTime) / 1000);
            
            completedCount++;
            console.log(`✅ [${questionNumber}/${RESEARCH_QUESTIONS.length}] Completed ${question.id} in ${duration}s`);
            
            await broadcastResearchQueueProgress(dealId, null, completedCount, RESEARCH_QUESTIONS.length, i < RESEARCH_QUESTIONS.length - 1);
            
            if (i < RESEARCH_QUESTIONS.length - 1) {
              console.log(`⏸️ 2-second delay before next question...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
          } catch (error: any) {
            const duration = Math.round((Date.now() - startTime) / 1000);
            console.error(`❌ [${questionNumber}/${RESEARCH_QUESTIONS.length}] Failed ${question.id} after ${duration}s:`, error);
            errors.push(`${question.id}: ${error.message}`);
            
            if (i < RESEARCH_QUESTIONS.length - 1) {
              console.log(`⏸️ 2-second delay before next question (after error)...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }
        
        await storage.updateBackgroundJob(masterJobId, {
          status: 'completed',
          progress: 100,
          currentStep: `Completed: ${completedCount}/${RESEARCH_QUESTIONS.length} questions analyzed`,
          completedAt: new Date()
        });
        
        // 🔥 CRITICAL: Update the Research analysis record to show 100% progress - LEGAL PATTERN
        const analysis = await storage.getAgentAnalysis(dealId, 'Research');
        if (analysis) {
          await storage.updateAgentAnalysis(analysis.id, {
            status: 'completed',
            progress: 100
          });
          console.log(`✅ [Force Rerun] Updated Research analysis progress to 100%`);
        }
        
        console.log(`🎉 SEQUENTIAL FORCE RERUN COMPLETE: ${completedCount}/${RESEARCH_QUESTIONS.length} questions analyzed`);
        if (errors.length > 0) {
          console.log(`⚠️ ${errors.length} questions failed:`, errors);
        }
        
      } catch (fatalError: any) {
        console.error(`🚨 FATAL ERROR in force rerun loop:`, fatalError);
        await storage.updateBackgroundJob(masterJobId, {
          status: 'failed',
          progress: Math.round((completedCount / RESEARCH_QUESTIONS.length) * 100),
          currentStep: `Failed after ${completedCount} questions: ${fatalError.message}`
        });
      } finally {
        setTimeout(async () => {
          try {
            console.log(`🧹 [1-hour cleanup] Deleting master job: ${masterJobId}`);
            await storage.deleteBackgroundJob(masterJobId);
            console.log(`✅ [1-hour cleanup] Deleted master job: ${masterJobId}`);
          } catch (cleanupError) {
            console.error(`❌ [1-hour cleanup] Failed to delete master job:`, cleanupError);
          }
        }, 60 * 60 * 1000);
      }
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
 * EXACT MATCH to IP/HR/Financial implementation with proper total calculation
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
    const masterJobId = `force-rerun-all-research-${dealId}`;
    
    const masterJob = await storage.getBackgroundJobById(masterJobId);
    
    const allJobs = await storage.getBackgroundJobsByDealId(dealId);
    const questionJobs = allJobs.filter(job => job.jobType === 'research_question_rerun');
    
    const pending = questionJobs.filter(j => j.status === 'pending').length;
    const running = questionJobs.filter(j => j.status === 'processing').length;
    const completed = questionJobs.filter(j => j.status === 'completed').length;
    const failed = questionJobs.filter(j => j.status === 'failed').length;
    const cancelled = questionJobs.filter(j => j.status === 'cancelled').length;
    
    const total = masterJob ? RESEARCH_QUESTIONS.length : questionJobs.length;
    const progress = masterJob ? masterJob.progress : 0;
    const isProcessing = masterJob?.status === 'processing' || running > 0;
    
    const effectiveCompleted = masterJob && masterJob.status === 'processing' 
      ? Math.floor((masterJob.progress / 100) * RESEARCH_QUESTIONS.length)
      : completed;
    
    let currentQuestionId: string | null = null;
    if (masterJob?.currentStep) {
      const match = masterJob.currentStep.match(/:\s*([\w_]+)$/);
      if (match) {
        currentQuestionId = match[1];
      }
    }
    
    const effectiveIsProcessing = isProcessing || (masterJob && currentQuestionId && masterJob.progress < 100);
    
    console.log(`📊 Research queue-status for deal ${dealId}: masterJob=${!!masterJob}, status=${masterJob?.status}, progress=${progress}%, isProcessing=${isProcessing}, effectiveIsProcessing=${effectiveIsProcessing}, total=${total}, currentQuestionId=${currentQuestionId}`);
    
    res.json({
      success: true,
      status: {
        total,
        pending,
        running: effectiveIsProcessing ? 1 : 0,
        completed: effectiveCompleted,
        failed,
        cancelled,
        progress,
        currentQuestion: masterJob?.currentStep || null,
        currentQuestionId,
        isProcessing: effectiveIsProcessing
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
    
    const masterJobId = `force-rerun-all-research-${dealId}`;
    
    const masterJob = await storage.getBackgroundJobById(masterJobId);
    if (masterJob) {
      await storage.updateBackgroundJob(masterJobId, {
        status: 'cancelled',
        currentStep: 'Cancelled by user'
      });
    }
    
    await db
      .delete(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.dealId, dealId),
          like(backgroundJobs.jobId, 'research-question-rerun-%')
        )
      );
    
    res.json({
      success: true,
      message: 'Research queue cancelled successfully'
    });
    
  } catch (error) {
    console.error('Error cancelling research queue:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to cancel queue' 
    });
  }
});