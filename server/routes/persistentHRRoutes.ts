/**
 * Persistent HR Analysis Routes
 * API endpoints for managing persistent HR analysis jobs
 */

import { Router } from 'express';

export const persistentHRRoutes = Router();

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
      comprehensiveHRAnalysisService.rerunSingleQuestion(dealId, questionId, customInstructions || '')
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
