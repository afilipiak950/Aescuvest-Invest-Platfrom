import { Router } from 'express';
import { jobBasedEngine } from '../services/jobBasedAnalysisEngine';

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

    console.log(`🚀 Starting comprehensive analysis for deal ${dealId}`);
    
    const runId = await jobBasedEngine.startComprehensiveAnalysis(dealId);
    
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

export { router as analysisRoutes };