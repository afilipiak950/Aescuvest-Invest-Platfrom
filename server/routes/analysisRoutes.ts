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
      error: error.message 
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
      error: error.message 
    });
  }
});

// Reset & Run All Analyses (clear previous and start fresh)
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
      error: error.message 
    });
  }
});

export { router as analysisRoutes };