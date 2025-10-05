/**
 * Persistent Legal Analysis Routes
 * API endpoints for managing persistent legal analysis jobs
 */

import { Router } from 'express';
import { persistentLegalAnalysisService } from '../services/persistentLegalAnalysis';

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
 * Re-run a single legal question
 */
persistentLegalRoutes.post('/api/deals/:dealId/legal-analysis/question/:questionId/rerun', async (req, res) => {
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

    console.log(`🔄 Re-running legal question ${questionId} for deal ${dealId} (BACKGROUND MODE)`);
    
    // Import the comprehensive service
    const { comprehensiveLegalAnalysisService } = await import('../comprehensiveLegalAnalysisService');
    
    // ATOMIC REGISTRATION: Check and register the job in one step to prevent race conditions
    if (await comprehensiveLegalAnalysisService.isQuestionRunning(dealId, questionId)) {
      console.log(`⚠️ Question ${questionId} for deal ${dealId} is already being rerun`);
      return res.status(409).json({ 
        success: false, 
        error: `Question ${questionId} is already being rerun. Please wait for it to complete.` 
      });
    }
    
    // Immediately initialize progress to 0 (atomically registers the job)
    // This prevents concurrent requests from bypassing the duplicate check
    await comprehensiveLegalAnalysisService.updateQuestionRerunProgress(dealId, questionId, 0);
    
    // Schedule background job execution on next event loop tick
    // HTTP response will be sent BEFORE the heavy database/AI work begins
    setImmediate(() => {
      comprehensiveLegalAnalysisService.rerunSingleQuestion(dealId, questionId)
        .then(() => {
          console.log(`✅ Background rerun completed for question ${questionId} on deal ${dealId}`);
        })
        .catch(async error => {
          console.error(`❌ Background rerun failed for question ${questionId} on deal ${dealId}:`, error);
          // Error is logged but doesn't affect the HTTP response (already sent)
        });
    });
    
    // Return immediately - client will poll for progress
    res.json({
      success: true,
      message: 'Question rerun started in background',
      questionId,
      dealId
    });
    
  } catch (error) {
    console.error('Error re-running legal question:', error);
    
    // Check if it's a duplicate rerun error
    if (error.message && error.message.includes('already being rerun')) {
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