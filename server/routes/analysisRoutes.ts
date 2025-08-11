import { Router } from 'express';
import { jobBasedEngine } from '../services/jobBasedAnalysisEngine';
import { realAnalysisEngine } from '../services/realAnalysisEngine';

const router = Router();

// Start comprehensive analysis for a deal
router.post('/api/deals/:dealId/analyze', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🚀 Starting REAL comprehensive analysis for deal ${dealId}`);
    
    // Use the new real analysis engine
    const runId = await realAnalysisEngine.startComprehensiveAnalysis(dealId);
    
    res.json({ 
      success: true, 
      runId,
      message: `Comprehensive analysis started for deal ${dealId}` 
    });

  } catch (error) {
    console.error('Analysis start error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get analysis progress for a deal
router.get('/api/deals/:dealId/analyze/progress', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const runId = jobBasedEngine.getActiveRunForDeal(dealId);
    
    if (!runId) {
      return res.json({ 
        success: false, 
        error: 'No active analysis run found for this deal' 
      });
    }

    const progress = jobBasedEngine.getRunProgress(runId);
    
    res.json({ 
      success: true, 
      runId,
      progress 
    });

  } catch (error) {
    console.error('Progress check error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Reset & Run All Analyses (clear previous and start fresh)
// Comprehensive Analysis endpoint - Reset first, then run real OCR analysis
router.post('/api/deals/:dealId/comprehensive-analysis', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🚀 Starting Comprehensive Analysis (Real OCR) for deal ${dealId}`);
    
    // First reset all previous analysis results
    await realAnalysisEngine.resetAnalysisResults(dealId);
    console.log(`✅ Reset completed for deal ${dealId}`);
    
    // Then start comprehensive analysis using Combined OCR per agent
    const runId = await realAnalysisEngine.startComprehensiveAnalysis(dealId);
    
    res.json({ 
      success: true, 
      runId,
      message: 'Comprehensive Analysis started with real OCR processing' 
    });
  } catch (error) {
    console.error('Error in comprehensive analysis:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Legacy Reset endpoint - Clear all results
router.post('/api/deals/:dealId/reset', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🔄 Legacy Reset - Clearing all results for deal ${dealId}`);
    
    // Clear all answers, progress, caches for all agents (keep documents/OCR)
    await realAnalysisEngine.resetAnalysisResults(dealId);
    
    res.json({ 
      success: true, 
      message: 'All analysis results cleared successfully',
      dealId
    });
  } catch (error) {
    console.error('Error in legacy reset:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/deals/:dealId/reset-and-analyze', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🔄 Reset & Run All Analyses for deal ${dealId}`);
    
    // Use the real analysis engine with fresh start
    const runId = await realAnalysisEngine.startComprehensiveAnalysis(dealId);
    
    res.json({ 
      success: true, 
      runId,
      message: 'Reset completed and comprehensive analysis started' 
    });
  } catch (error) {
    console.error('Error in reset and analyze:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get acceptance report for a deal
router.get('/deals/:dealId/acceptance-report', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const report = await realAnalysisEngine.generateAcceptanceReport(dealId);
    
    res.json({ 
      success: true, 
      report 
    });
  } catch (error) {
    console.error('Error generating acceptance report:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as analysisRoutes };