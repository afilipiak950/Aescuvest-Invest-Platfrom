/**
 * COMPREHENSIVE ANALYSIS ROUTES
 * 
 * API endpoints for full document×question matrix processing
 */

import { Router, Request, Response } from 'express';
import { comprehensiveAnalysisEngine } from '../services/comprehensiveAnalysisEngine';

const router = Router();

/**
 * COMPREHENSIVE ANALYSIS ENDPOINT (Frontend Compatible)
 * Endpoint that matches frontend expectations: /api/analyses/comprehensive
 */
router.post('/api/analyses/comprehensive', async (req: Request, res: Response) => {
  const { dealId } = req.body;
  
  try {
    console.log(`🚀 Starting comprehensive analysis for deal ${dealId} using new engine`);
    
    // Step 1: Perform full reset - DELETE ALL PREVIOUS ANSWERS
    await comprehensiveAnalysisEngine.resetAnalyses(dealId);
    console.log(`✅ Reset completed - all previous answers deleted for deal ${dealId}`);
    
    // Step 2: Start comprehensive analysis - GENERATE ALL NEW ANSWERS
    await comprehensiveAnalysisEngine.runComprehensiveAnalysis(dealId);
    console.log(`✅ Comprehensive analysis completed for deal ${dealId}`);
    
    res.json({
      success: true,
      message: 'Comprehensive analysis completed',
      dealId: dealId,
      resetCompleted: true,
      analysisCompleted: true
    });
    
  } catch (error) {
    console.error(`❌ Comprehensive analysis failed:`, error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * RESET & START COMPREHENSIVE ANALYSIS (Legacy)
 * Clears all previous outputs and starts fresh processing
 */
router.post('/api/deals/:dealId/comprehensive-reset-and-start', async (req: Request, res: Response) => {
  const dealId = parseInt(req.params.dealId);
  
  try {
    console.log(`🔄 Starting comprehensive reset and analysis for deal ${dealId}`);
    
    // Step 1: Perform full reset - DELETE ALL PREVIOUS ANSWERS
    await comprehensiveAnalysisEngine.resetAnalyses(dealId);
    console.log(`✅ Reset completed - all previous answers deleted for deal ${dealId}`);
    
    // Step 2: Start comprehensive analysis - GENERATE ALL NEW ANSWERS
    await comprehensiveAnalysisEngine.runComprehensiveAnalysis(dealId);
    console.log(`✅ Comprehensive analysis completed for deal ${dealId}`);
    
    res.json({
      success: true,
      message: 'Comprehensive analysis completed',
      dealId: dealId,
      resetCompleted: true,
      analysisCompleted: true
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
    // Get basic analysis status from storage
    const { storage } = await import('../storage');
    const analyses = await storage.getAnalysesByDealId(dealId);
    
    const status = {
      totalAgents: 7,
      completedAgents: analyses.filter(a => a.status === 'Completed').length,
      inProgressAgents: analyses.filter(a => a.status === 'In Progress').length,
      analyses: analyses.map(a => ({
        agentType: a.agentType,
        status: a.status,
        progress: a.progress,
        hasAnswers: !!(a as any)[`${a.agentType.toLowerCase()}Answers`] || !!(a as any)[`${a.agentType.toLowerCase()}_answers`]
      }))
    };
    
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
    // Get analysis completion report from storage
    const { storage } = await import('../storage');
    const analyses = await storage.getAnalysesByDealId(dealId);
    
    const report = {
      dealId,
      totalAgents: 7,
      completedAnalyses: analyses.length,
      timestamp: new Date().toISOString(),
      analyses: analyses.map(analysis => ({
        agentType: analysis.agentType,
        status: analysis.status,
        progress: analysis.progress,
        findingsCount: analysis.findings?.length || 0,
        recommendationsCount: analysis.recommendations?.length || 0,
        lastUpdated: analysis.updatedAt || analysis.createdAt
      }))
    };
    
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