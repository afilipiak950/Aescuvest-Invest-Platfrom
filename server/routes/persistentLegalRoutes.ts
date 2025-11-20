/**
 * Persistent Legal Analysis Routes
 * API endpoints for managing persistent legal analysis jobs and question queues
 */

import { Router } from 'express';
import { persistentLegalAnalysisService } from '../services/persistentLegalAnalysis';
import { legalQuestionQueue } from '../services/legalQuestionQueue';
import { db } from '../db';

export const persistentLegalRoutes = Router();

/**
 * Start legal analysis for a deal
 */
persistentLegalRoutes.post('/api/deals/:dealId/legal-analysis/start', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🚀 Starting legal analysis for deal ${dealId}`);
    
    const jobId = await persistentLegalAnalysisService.startLegalAnalysis(dealId);
    
    res.json({
      success: true,
      message: 'Persistent legal analysis started',
      jobId,
      dealId
    });
    
  } catch (error) {
    console.error('Error starting legal analysis:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to start legal analysis' 
    });
  }
});

/**
 * Stop legal analysis for a deal
 */
persistentLegalRoutes.post('/api/deals/:dealId/legal-analysis/stop', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const jobId = `legal-analysis-${dealId}`;
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🛑 Stopping legal analysis for deal ${dealId}`);
    
    await persistentLegalAnalysisService.stopLegalAnalysis(jobId);
    
    res.json({
      success: true,
      message: 'Legal analysis stopped'
    });
    
  } catch (error) {
    console.error('Error stopping legal analysis:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to stop legal analysis' 
    });
  }
});

/**
 * Get legal analysis status
 */
persistentLegalRoutes.get('/api/deals/:dealId/legal-analysis/status', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const jobId = `legal-analysis-${dealId}`;
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const jobStatus = persistentLegalAnalysisService.getJobStatus(jobId);
    
    res.json({
      success: true,
      status: jobStatus
    });
    
  } catch (error) {
    console.error('Error getting legal analysis status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get legal analysis status' 
    });
  }
});

/**
 * Get comprehensive legal analysis results
 */
persistentLegalRoutes.get('/api/deals/:dealId/legal-analysis/comprehensive/results', async (req, res) => {
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
    
    const analysis = await storage.getAgentAnalysis(dealId, 'Legal');
    

    
    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'No legal analysis found'
      });
    }

    console.log(`✅ Found comprehensive legal analysis - ${Object.keys(analysis.legalAnswers || {}).length} questions, ${analysis.findings?.length || 0} findings, ${analysis.recommendations?.length || 0} recommendations`);

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
        legalAnswers: analysis.legalAnswers || {}
      }
    });
    
  } catch (error) {
    console.error('Error getting comprehensive legal analysis results:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get legal analysis results' 
    });
  }
});

/**
 * Get progress for ALL active question reruns for a deal
 */
persistentLegalRoutes.get('/api/deals/:dealId/legal-analysis/questions/progress', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    // Import the comprehensive service
    const { comprehensiveLegalAnalysisService } = await import('../comprehensiveLegalAnalysisService');
    
    // Get all active progress for this deal
    const allProgress = await comprehensiveLegalAnalysisService.getAllQuestionProgress(dealId);
    
    res.json({
      success: true,
      progress: allProgress
    });
    
  } catch (error) {
    console.error('Error getting all question rerun progress:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get progress' 
    });
  }
});

/**
 * Get progress for a question rerun
 */
persistentLegalRoutes.get('/api/deals/:dealId/legal-analysis/question/:questionId/progress', async (req, res) => {
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

    // Import the comprehensive service
    const { comprehensiveLegalAnalysisService } = await import('../comprehensiveLegalAnalysisService');
    
    // Get progress
    const progress = comprehensiveLegalAnalysisService.getQuestionRerunProgress(dealId, questionId);
    
    res.json({
      success: true,
      progress
    });
    
  } catch (error) {
    console.error('Error getting question rerun progress:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get progress' 
    });
  }
});

/**
 * Re-run a single legal question using the QUEUE SYSTEM
 * Now integrated with queue-based processing for consistency
 */
persistentLegalRoutes.post('/api/deals/:dealId/legal-analysis/question/:questionId/rerun', async (req, res) => {
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

    console.log(`🔄 Re-running legal question ${questionId} for deal ${dealId} (QUEUE MODE)`);
    
    // Use the queue-based rerun method for consistency
    const result = await legalQuestionQueue.rerunSingleQuestion(
      dealId, 
      questionId, 
      customInstructions
    );
    
    // Return immediately - client will receive WebSocket updates
    res.json({
      success: result.success,
      message: result.message,
      questionId,
      dealId
    });
    
  } catch (error) {
    console.error('Error re-running legal question:', error);
    
    // Check if it's a duplicate rerun error
    if (error.message && error.message.includes('already')) {
      return res.status(409).json({ 
        success: false, 
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to re-run question analysis' 
    });
  }
});
/**
 * ===================================================================
 * QUESTION QUEUE ENDPOINTS - Sequential processing of legal questions
 * ===================================================================
 */

/**
 * Start processing all legal questions in a queue (one by one, FIFO)
 */
persistentLegalRoutes.post('/api/deals/:dealId/legal-analysis/run-all-questions', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🚀 Starting legal question queue for deal ${dealId}`);
    
    const result = await legalQuestionQueue.startAllQuestions(dealId);
    
    res.json({
      success: true,
      message: `Queued ${result.queuedCount} legal questions for sequential processing`,
      queuedCount: result.queuedCount,
      dealId
    });
    
  } catch (error) {
    console.error('Error starting legal question queue:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to start question queue' 
    });
  }
});

/**
 * Force rerun ALL legal questions (including already answered ones)
 * Uses COMPREHENSIVE ANALYSIS with evidence extraction from ALL documents
 * This is the REAL analysis that takes hours - same as manual run
 */
persistentLegalRoutes.post('/api/deals/:dealId/legal-analysis/force-rerun-all', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🔥 FORCE RERUN: Starting SEQUENTIAL COMPREHENSIVE analysis for ALL legal questions on deal ${dealId}`);
    
    // Import comprehensive service and questions
    const { comprehensiveLegalAnalysisService, COMPREHENSIVE_LEGAL_QUESTIONS } = await import('../comprehensiveLegalAnalysisService');
    
    // CRITICAL: Cancel all existing legal question rerun jobs before starting fresh
    console.log(`🧹 Cleaning up any existing legal question rerun jobs for deal ${dealId}`);
    const { backgroundJobs } = await import('../shared/schema');
    const { eq, and, like } = await import('drizzle-orm');
    
    await db
      .delete(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.dealId, dealId),
          like(backgroundJobs.jobId, 'legal-question-rerun-%')
        )
      );
    console.log(`✅ Cleaned up existing legal question rerun jobs`);
    
    // Respond immediately to user, then process questions sequentially in background
    res.json({
      success: true,
      message: `Force rerun: Started sequential comprehensive analysis - questions will run one after another`,
      startedCount: COMPREHENSIVE_LEGAL_QUESTIONS.length,
      totalQuestions: COMPREHENSIVE_LEGAL_QUESTIONS.length,
      dealId,
      estimatedTime: `${Math.round(COMPREHENSIVE_LEGAL_QUESTIONS.length * 10 / 60)} hours (10 min average per question)`
    });
    
    // Run questions SEQUENTIALLY in background (one finishes before next starts)
    (async () => {
      let completedCount = 0;
      const errors: string[] = [];
      
      for (const question of COMPREHENSIVE_LEGAL_QUESTIONS) {
        try {
          console.log(`🎯 [${completedCount + 1}/${COMPREHENSIVE_LEGAL_QUESTIONS.length}] Starting COMPREHENSIVE analysis for question ${question.id}`);
          
          // AWAIT each question - next one won't start until this finishes
          await comprehensiveLegalAnalysisService.rerunSingleQuestion(dealId, question.id);
          
          completedCount++;
          console.log(`✅ [${completedCount}/${COMPREHENSIVE_LEGAL_QUESTIONS.length}] Completed comprehensive analysis for ${question.id}`);
          
        } catch (error) {
          console.error(`❌ Error in comprehensive analysis for question ${question.id}:`, error);
          errors.push(`${question.id}: ${error.message}`);
          // Continue with next question even if one fails
        }
      }
      
      console.log(`🎉 Force rerun COMPLETE: ${completedCount}/${COMPREHENSIVE_LEGAL_QUESTIONS.length} questions analyzed successfully`);
      if (errors.length > 0) {
        console.log(`⚠️ ${errors.length} questions failed:`, errors);
      }
    })();
    
  } catch (error) {
    console.error('Error force rerunning all legal questions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to force rerun all questions' 
    });
  }
});

/**
 * Get queue status for a deal
 */
persistentLegalRoutes.get('/api/deals/:dealId/legal-analysis/queue-status', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const status = await legalQuestionQueue.getQueueStatus(dealId);
    
    res.json({
      success: true,
      status
    });
    
  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get queue status' 
    });
  }
});

/**
 * Cancel queue processing for a deal
 */
persistentLegalRoutes.post('/api/deals/:dealId/legal-analysis/cancel-queue', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🛑 Cancelling legal question queue for deal ${dealId}`);
    
    await legalQuestionQueue.cancelQueue(dealId);
    
    res.json({
      success: true,
      message: 'Queue cancelled successfully'
    });
    
  } catch (error) {
    console.error('Error cancelling queue:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to cancel queue' 
    });
  }
});
