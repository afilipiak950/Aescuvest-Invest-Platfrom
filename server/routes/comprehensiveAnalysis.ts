/**
 * COMPREHENSIVE ANALYSIS ROUTES
 * 
 * API endpoints for full document×question matrix processing
 */

import { Router, Request, Response } from 'express';
import { comprehensiveAnalysisEngine } from '../services/comprehensiveAnalysisEngine';

const router = Router();

/**
 * RESET & START COMPREHENSIVE ANALYSIS
 * Clears all previous outputs and starts fresh processing
 */
router.post('/api/deals/:dealId/comprehensive-reset-and-start', async (req: Request, res: Response) => {
  const dealId = parseInt(req.params.dealId);
  
  try {
    console.log(`🔄 Starting comprehensive reset and analysis for deal ${dealId}`);
    
    // Step 1: Perform full reset
    await comprehensiveAnalysisEngine.performFullReset(dealId);
    
    // Step 2: Start comprehensive analysis
    const result = await comprehensiveAnalysisEngine.startComprehensiveAnalysis(dealId);
    
    res.json({
      message: 'Comprehensive analysis started successfully',
      resetCompleted: true,
      analysisStarted: true,
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error(`❌ Comprehensive reset and start failed:`, error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET PROCESSING STATUS
 * Returns current progress for all agents
 */
router.get('/api/deals/:dealId/comprehensive-status', async (req: Request, res: Response) => {
  const dealId = parseInt(req.params.dealId);
  
  try {
    const status = await comprehensiveAnalysisEngine.getProcessingStatus(dealId);
    res.json({
      success: true,
      ...status
    });
    
  } catch (error) {
    console.error(`❌ Failed to get processing status:`, error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET COMPLETION REPORT
 * Returns detailed completion report with examples
 */
router.get('/api/deals/:dealId/completion-report', async (req: Request, res: Response) => {
  const dealId = parseInt(req.params.dealId);
  
  try {
    const report = await comprehensiveAnalysisEngine.getCompletionReport(dealId);
    res.json({
      success: true,
      ...report
    });
    
  } catch (error) {
    console.error(`❌ Failed to get completion report:`, error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET AGENT SPECIFIC RESULTS
 * Returns structured answers for a specific agent
 */
router.get('/api/deals/:dealId/agents/:agentType/comprehensive-results', async (req: Request, res: Response) => {
  const dealId = parseInt(req.params.dealId);
  const agentType = req.params.agentType.toLowerCase();
  
  try {
    const { storage } = await import('../storage');
    const analyses = await storage.getAnalysesByDealId(dealId);
    const analysis = analyses.find(a => a.agentType.toLowerCase() === agentType);
    
    if (!analysis) {
      return res.json({
        success: false,
        message: `No analysis found for ${agentType} agent`
      });
    }
    
    const answers = (analysis as any)[`${agentType}Answers`] || {};
    
    res.json({
      success: true,
      analysis: {
        status: analysis.status,
        progress: analysis.progress,
        findings: analysis.findings,
        recommendations: analysis.recommendations,
        [`${agentType}_answers`]: answers,
        answersCount: Object.keys(answers).length,
        lastUpdated: analysis.updatedAt || analysis.createdAt
      }
    });
    
  } catch (error) {
    console.error(`❌ Failed to get agent results:`, error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

export { router as comprehensiveAnalysisRouter };