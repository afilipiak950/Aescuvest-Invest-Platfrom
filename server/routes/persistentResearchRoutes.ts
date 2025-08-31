/**
 * Persistent Research Analysis Routes
 * Based on the proven Legal analysis routes architecture
 */

import { Router } from 'express';
import { persistentResearchAnalysisService } from '../services/persistentResearchAnalysis';
import { storage } from '../storage';

const router = Router();

/**
 * Start Research Analysis - EXACT Legal approach
 */
router.post('/deals/:dealId/research-analysis/start', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);

    console.log(`🔬 Starting persistent research analysis for deal ${dealId}`);

    // Check if there's already an active job - EXACT Legal approach
    const existingJob = await storage.getBackgroundJobsByDealAndType(dealId, 'research_analysis');
    if (existingJob && existingJob.status === 'running') {
      console.log(`⚠️ Research analysis already running for deal ${dealId} (Job: ${existingJob.jobId})`);
      return res.json({ 
        success: false, 
        message: `Research analysis already in progress (${Math.round(existingJob.progress || 0)}% complete)`,
        alreadyRunning: true,
        progress: existingJob.progress || 0
      });
    }

    // Start the persistent research analysis
    const jobId = await persistentResearchAnalysisService.startResearchAnalysis(dealId);

    res.json({
      success: true,
      message: 'Research analysis started successfully',
      jobId,
      started: true
    });

  } catch (error) {
    console.error('❌ Error starting research analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start research analysis',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get Research Analysis Status - EXACT Legal approach
 */
router.get('/deals/:dealId/research-analysis/status', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);

    // Check for active job
    const job = await storage.getBackgroundJobsByDealAndType(dealId, 'research_analysis');
    
    if (!job) {
      return res.json({
        success: true,
        status: 'not_started',
        progress: 0,
        message: 'No research analysis job found'
      });
    }

    // Get detailed status from persistent service
    const jobStatus = await persistentResearchAnalysisService.getJobStatus(job.jobId);

    res.json({
      success: true,
      status: job.status,
      progress: job.progress || 0,
      currentStep: job.currentStep || 'Processing',
      jobId: job.jobId,
      isActive: jobStatus.isActive,
      createdAt: job.createdAt,
      completedAt: job.completedAt
    });

  } catch (error) {
    console.error('❌ Error getting research analysis status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get research analysis status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Cancel Research Analysis - EXACT Legal approach
 */
router.post('/deals/:dealId/research-analysis/cancel', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);

    // Find active job
    const job = await storage.getBackgroundJobsByDealAndType(dealId, 'research_analysis');
    
    if (!job || job.status !== 'running') {
      return res.json({
        success: false,
        message: 'No active research analysis found to cancel'
      });
    }

    // Cancel the job
    await persistentResearchAnalysisService.cancelJob(job.jobId);

    res.json({
      success: true,
      message: 'Research analysis cancelled successfully'
    });

  } catch (error) {
    console.error('❌ Error canceling research analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel research analysis',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get Research Results - EXACT Legal approach
 */
router.get('/deals/:dealId/research-analysis/results', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    console.log(`🔬 Fetching research analysis results for deal ${dealId}`);

    // Get the analysis from storage - EXACT Legal approach
    const analysis = await storage.getAgentAnalysis(dealId, 'research');
    
    if (!analysis) {
      return res.json({
        success: true,
        analysis: null,
        message: 'No research analysis found'
      });
    }

    // Parse research answers if they exist - EXACT Legal approach
    let researchAnswers = {};
    if (analysis.research_answers) {
      try {
        researchAnswers = typeof analysis.research_answers === 'string' 
          ? JSON.parse(analysis.research_answers) 
          : analysis.research_answers;
      } catch (error) {
        console.error('Error parsing research answers:', error);
        researchAnswers = {};
      }
    }
    
    console.log(`🔬 Research Analysis Data:`, {
      hasAnswers: !!analysis.research_answers,
      answersType: typeof analysis.research_answers,
      parsedAnswersKeys: Object.keys(researchAnswers)
    });

    // Parse findings and recommendations - EXACT Legal approach
    let findings = [];
    let recommendations = [];
    
    if (analysis.findings) {
      try {
        findings = typeof analysis.findings === 'string' 
          ? JSON.parse(analysis.findings) 
          : analysis.findings;
      } catch (error) {
        console.error('Error parsing findings:', error);
        findings = [];
      }
    }
    
    if (analysis.recommendations) {
      try {
        recommendations = typeof analysis.recommendations === 'string' 
          ? JSON.parse(analysis.recommendations) 
          : analysis.recommendations;
      } catch (error) {
        console.error('Error parsing recommendations:', error);
        recommendations = [];
      }
    }

    res.json({
      success: true,
      analysis: {
        id: analysis.id,
        dealId: analysis.dealId,
        agentType: analysis.agentType,
        status: analysis.status,
        progress: analysis.progress,
        research_answers: researchAnswers,
        findings: findings,
        recommendations: recommendations,
        documentSources: analysis.documentSources,
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ Error fetching research analysis results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch research analysis results',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;