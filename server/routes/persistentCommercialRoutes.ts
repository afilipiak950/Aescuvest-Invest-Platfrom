/**
 * Persistent Commercial Analysis Routes
 * API endpoints for managing persistent commercial analysis question reruns
 */

import { Router } from 'express';

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
      comprehensiveCommercialAnalysisService.rerunSingleQuestion(dealId, questionId)
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
