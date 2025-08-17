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

export default router;