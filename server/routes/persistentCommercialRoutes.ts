/**
 * Persistent Commercial Analysis Routes
 * API endpoints for managing persistent commercial analysis jobs
 */

import { Router } from 'express';
import { persistentCommercialAnalysisService } from '../services/persistentCommercialAnalysis';

export const persistentCommercialRoutes = Router();

/**
 * Start commercial analysis for a deal
 */
persistentCommercialRoutes.post('/api/deals/:dealId/commercial-analysis/start', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🚀 Starting commercial analysis for deal ${dealId}`);
    
    const jobId = await persistentCommercialAnalysisService.startCommercialAnalysis(dealId);
    
    res.json({
      success: true,
      message: 'Persistent commercial analysis started',
      jobId,
      dealId
    });
    
  } catch (error) {
    console.error('Error starting commercial analysis:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to start commercial analysis' 
    });
  }
});

/**
 * Stop commercial analysis for a deal
 */
persistentCommercialRoutes.post('/api/deals/:dealId/commercial-analysis/stop', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const jobId = `commercial-analysis-${dealId}`;
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🛑 Stopping commercial analysis for deal ${dealId}`);
    
    await persistentCommercialAnalysisService.stopCommercialAnalysis(jobId);
    
    res.json({
      success: true,
      message: 'Commercial analysis stopped'
    });
    
  } catch (error) {
    console.error('Error stopping commercial analysis:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to stop commercial analysis' 
    });
  }
});

/**
 * Get commercial analysis status
 */
persistentCommercialRoutes.get('/api/deals/:dealId/commercial-analysis/status', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const jobId = `commercial-analysis-${dealId}`;
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const jobStatus = persistentCommercialAnalysisService.getJobStatus(jobId);
    
    res.json({
      success: true,
      status: jobStatus
    });
    
  } catch (error) {
    console.error('Error getting commercial analysis status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get commercial analysis status' 
    });
  }
});

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

    // Import storage here to avoid circular dependency
    const { storage } = await import('../storage');
    
    const analysis = await storage.getAgentAnalysis(dealId, 'Commercial');
    
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