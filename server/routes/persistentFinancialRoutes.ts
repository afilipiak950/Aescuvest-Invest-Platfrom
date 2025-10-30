/**
 * Persistent Financial Analysis Routes
 * Matches Clinical routes architecture exactly for consistent behavior
 */

import { Router } from 'express';
import { persistentFinancialAnalysisService } from '../services/persistentFinancialAnalysis';

const router = Router();

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

export default router;