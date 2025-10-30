/**
 * Persistent Research Analysis Routes
 * Based on the proven Legal analysis routes architecture
 */

import { Router } from 'express';
import { persistentResearchAnalysisService } from '../services/persistentResearchAnalysis';
import { storage } from '../storage';

export const persistentResearchRoutes = Router();

/**
 * Start Research Analysis - EXACT Legal approach
 */
persistentResearchRoutes.post('/api/deals/:dealId/research-analysis/start', async (req, res) => {
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
persistentResearchRoutes.get('/api/deals/:dealId/research-analysis/status', async (req, res) => {
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
persistentResearchRoutes.post('/api/deals/:dealId/research-analysis/cancel', async (req, res) => {
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
persistentResearchRoutes.get('/api/deals/:dealId/research-analysis/results', async (req, res) => {
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

/**
 * Get comprehensive research analysis results - EXACT Legal match
 */
persistentResearchRoutes.get('/api/deals/:dealId/research-analysis/comprehensive/results', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const analysis = await storage.getAgentAnalysis(dealId, 'research');
    
    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'No research analysis found'
      });
    }

    console.log(`✅ Found comprehensive research analysis - ${Object.keys(analysis.research_answers || {}).length} questions, ${analysis.findings?.length || 0} findings, ${analysis.recommendations?.length || 0} recommendations`);

    res.json({
      success: true,
      results: {
        dealId,
        agentType: analysis.agentType,
        status: analysis.status,
        findings: analysis.findings || [],
        recommendations: analysis.recommendations || [],
        confidence: analysis.confidence || 0,
        completedAt: analysis.completedAt,
        researchAnswers: analysis.research_answers || {}
      }
    });
    
  } catch (error) {
    console.error('Error getting comprehensive research analysis results:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get research analysis results' 
    });
  }
});

/**
 * Get progress for ALL active question reruns for a deal
 */
persistentResearchRoutes.get('/api/deals/:dealId/research-analysis/questions/progress', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const { ComprehensiveResearchAnalysisService } = await import('../comprehensiveResearchAnalysisService');
    const service = new ComprehensiveResearchAnalysisService();
    
    const allProgress = service.getAllQuestionProgress(dealId);
    
    res.json({
      success: true,
      progress: allProgress
    });
    
  } catch (error) {
    console.error('Error getting all research question rerun progress:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get progress' 
    });
  }
});

/**
 * Get progress for a single question rerun
 */
persistentResearchRoutes.get('/api/deals/:dealId/research-analysis/question/:questionId/progress', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const questionId = req.params.questionId;
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    if (!questionId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Question ID is required' 
      });
    }

    const { ComprehensiveResearchAnalysisService } = await import('../comprehensiveResearchAnalysisService');
    const service = new ComprehensiveResearchAnalysisService();
    
    const progress = await service.getQuestionRerunProgress(dealId, questionId);
    
    res.json({
      success: true,
      progress
    });
    
  } catch (error) {
    console.error('Error getting research question rerun progress:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get progress' 
    });
  }
});

/**
 * Re-run a single research question with database-backed persistence
 */
persistentResearchRoutes.post('/api/deals/:dealId/research-analysis/question/:questionId/rerun', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const questionId = req.params.questionId;
    const { customInstructions } = req.body;
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    if (!questionId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Question ID is required' 
      });
    }

    console.log(`🔄 Re-running research question ${questionId} for deal ${dealId} (BACKGROUND MODE)`);
    
    const { ComprehensiveResearchAnalysisService } = await import('../comprehensiveResearchAnalysisService');
    const service = new ComprehensiveResearchAnalysisService();
    
    // Check if already running
    if (await service.isQuestionRunning(dealId, questionId)) {
      console.log(`⚠️ Research question ${questionId} for deal ${dealId} is already being rerun`);
      return res.status(409).json({ 
        success: false, 
        error: `Question ${questionId} is already being rerun. Please wait for it to complete.` 
      });
    }
    
    // Immediately initialize progress to 0 (atomically registers the job)
    await service.updateQuestionRerunProgress(dealId, questionId, 0);
    
    // Schedule background job execution
    setImmediate(() => {
      service.rerunSingleQuestion(dealId, questionId, customInstructions || '')
        .then(() => {
          console.log(`✅ Background research rerun completed for question ${questionId} on deal ${dealId}`);
        })
        .catch(async error => {
          console.error(`❌ Background research rerun failed for question ${questionId} on deal ${dealId}:`, error);
        });
    });
    
    // Return immediately - client will poll for progress
    res.json({
      success: true,
      message: 'Research question rerun started in background',
      questionId,
      dealId
    });
    
  } catch (error) {
    console.error('Error re-running research question:', error);
    
    if (error.message && error.message.includes('already being rerun')) {
      return res.status(409).json({ 
        success: false, 
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to re-run research question analysis' 
    });
  }
});