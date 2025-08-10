import express from 'express';
import { storage } from '../storage';
import { ComprehensiveAnalysisEngine } from '../../comprehensive-e2e-analysis-engine';

const router = express.Router();

/**
 * POST /api/deals/:dealId/comprehensive-analysis/reset-and-run
 * Reset all analysis outputs and run complete E2E analysis
 */
router.post('/deals/:dealId/comprehensive-analysis/reset-and-run', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }
    
    console.log(`🚀 Starting comprehensive E2E analysis for deal ${dealId}`);
    
    // Create analysis engine
    const engine = new ComprehensiveAnalysisEngine(dealId);
    
    // Start analysis in background
    engine.runCompleteAnalysis().catch(error => {
      console.error('❌ Background E2E analysis failed:', error);
    });
    
    res.json({
      success: true,
      message: 'Comprehensive E2E analysis started',
      dealId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error starting comprehensive analysis:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/deals/:dealId/comprehensive-analysis/coverage
 * Get coverage matrix for all agents
 */
router.get('/deals/:dealId/comprehensive-analysis/coverage', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }
    
    const engine = new ComprehensiveAnalysisEngine(dealId);
    const matrices = await engine.computeCoverageMatrix();
    
    res.json({
      success: true,
      coverage: matrices,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error computing coverage matrix:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/deals/:dealId/comprehensive-analysis/status
 * Get real-time analysis status
 */
router.get('/deals/:dealId/comprehensive-analysis/status', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }
    
    // Get current analysis status from storage
    const analyses = await storage.getAgentAnalysisByDeal(dealId);
    
    const status = analyses.map((analysis: any) => ({
      agentType: analysis.agentType,
      status: analysis.status,
      progress: analysis.progress,
      hasAnswers: !!(analysis.legalAnswers || analysis.clinicalAnswers || 
                     analysis.commercialAnswers || analysis.hrAnswers ||
                     analysis.financialAnswers || analysis.ipAnswers || 
                     analysis.researchAnswers),
      updatedAt: analysis.updatedAt
    }));
    
    res.json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error getting analysis status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;