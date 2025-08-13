/**
 * Persistent Legal Analysis Routes
 * API endpoints for managing persistent legal analysis jobs
 */

import { Router } from 'express';
import { persistentLegalAnalysisService } from '../services/persistentLegalAnalysis';

export const persistentLegalRoutes = Router();

/**
 * Start legal analysis for a deal
 */
persistentLegalRoutes.post('/api/deals/:dealId/legal-analysis/start', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🚀 Starting legal analysis for deal ${dealId}`);
    
    const jobId = await persistentLegalAnalysisService.startLegalAnalysis(dealId);
    
    res.json({
      success: true,
      message: 'Persistent legal analysis started',
      jobId,
      dealId
    });
    
  } catch (error) {
    console.error('Error starting legal analysis:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to start legal analysis' 
    });
  }
});

/**
 * Stop legal analysis for a deal
 */
persistentLegalRoutes.post('/api/deals/:dealId/legal-analysis/stop', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const jobId = `legal-analysis-${dealId}`;
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🛑 Stopping legal analysis for deal ${dealId}`);
    
    await persistentLegalAnalysisService.stopLegalAnalysis(jobId);
    
    res.json({
      success: true,
      message: 'Legal analysis stopped'
    });
    
  } catch (error) {
    console.error('Error stopping legal analysis:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to stop legal analysis' 
    });
  }
});

/**
 * Get legal analysis status
 */
persistentLegalRoutes.get('/api/deals/:dealId/legal-analysis/status', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const jobId = `legal-analysis-${dealId}`;
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const jobStatus = persistentLegalAnalysisService.getJobStatus(jobId);
    
    res.json({
      success: true,
      status: jobStatus
    });
    
  } catch (error) {
    console.error('Error getting legal analysis status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get legal analysis status' 
    });
  }
});

/**
 * Get comprehensive legal analysis results
 */
persistentLegalRoutes.get('/deals/:dealId/legal-analysis/comprehensive/results', async (req, res) => {
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
    
    // Check if comprehensive analysis is actively running
    const runningJobs = await storage.getBackgroundJobsByDeal(dealId, 'processing');
    const isLegalAnalysisRunning = runningJobs.some(job => 
      job.jobId.startsWith('legal-analysis-') && job.agentType === 'legal'
    );

    const analysis = await storage.getAgentAnalysis(dealId, 'Legal');
    
    // If analysis is running and existing analysis has incomplete questions, return progress status
    if (isLegalAnalysisRunning && analysis && analysis.legalAnswers) {
      const questionCount = Object.keys(analysis.legalAnswers).length;
      if (questionCount < 13) {
        console.log(`🔄 Legal analysis running - returning incomplete analysis (${questionCount}/13 questions) with processing status`);
        return res.json({
          success: true,
          analysis: {
            dealId,
            agentType: 'Legal',
            status: 'processing', // Override status to show it's still running
            findings: analysis.findings || [],
            recommendations: analysis.recommendations || [],
            confidence: analysis.confidence || 0,
            completedAt: null, // Clear completion time since it's still running
            legalAnswers: analysis.legalAnswers || {},
            isIncomplete: true,
            expectedQuestions: 13,
            currentQuestions: questionCount
          }
        });
      }
    }
    
    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'No legal analysis found'
      });
    }

    console.log(`✅ Found comprehensive legal analysis - ${Object.keys(analysis.legalAnswers || {}).length} questions, ${analysis.findings?.length || 0} findings, ${analysis.recommendations?.length || 0} recommendations`);

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
        legalAnswers: analysis.legalAnswers || {}
      }
    });
    
  } catch (error) {
    console.error('Error getting comprehensive legal analysis results:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get legal analysis results' 
    });
  }
});