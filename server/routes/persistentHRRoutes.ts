/**
 * Persistent HR Analysis Routes
 * API endpoints for managing RAG-powered HR analysis jobs
 */

import { Router } from 'express';
import { RagPoweredHRAgent } from '../services/ragPoweredHRAgent';
import { persistentJobManager } from '../services/persistentJobManager';
import { db } from '../db';
import { agentAnalyses } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export const persistentHRRoutes = Router();

/**
 * Start comprehensive RAG-powered HR analysis for a deal
 */
persistentHRRoutes.post('/api/deals/:dealId/hr-analysis/comprehensive/start', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🚀 Starting RAG-powered HR analysis for deal ${dealId}`);
    
    // Create the job ID for this analysis
    const jobId = `rag_hr_analysis_${dealId}_${Date.now()}`;
    
    // Start the analysis in background with progress tracking
    setImmediate(async () => {
      try {
        const hrAgent = new RagPoweredHRAgent(dealId);
        
        // Set up progress callback for background job tracking
        hrAgent.setProgressCallback(async (progress) => {
          await persistentJobManager.updateJobProgress(jobId, progress);
        });
        
        // Run the comprehensive analysis
        const result = await hrAgent.runComprehensiveAnalysis();
        
        // Mark job as completed
        await persistentJobManager.markJobCompleted(jobId, result);
        
        console.log(`✅ RAG-powered HR analysis completed for deal ${dealId}`);
        
      } catch (error) {
        console.error(`❌ RAG-powered HR analysis failed for deal ${dealId}:`, error);
        await persistentJobManager.markJobFailed(jobId, error instanceof Error ? error.message : 'Unknown error');
      }
    });
    
    res.json({
      success: true,
      message: 'RAG-powered HR analysis started',
      jobId,
      dealId,
      analysisType: 'comprehensive',
      estimatedTime: '5-10 minutes'
    });
    
  } catch (error) {
    console.error('Error starting HR analysis:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to start HR analysis' 
    });
  }
});

/**
 * Get progress of HR analysis
 */
persistentHRRoutes.get('/api/deals/:dealId/hr-analysis/comprehensive/progress', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    // Get the latest HR analysis job for this deal
    const latestJob = await persistentJobManager.getLatestJobForDeal(dealId, 'rag_hr_analysis');
    
    if (!latestJob) {
      return res.json({
        success: true,
        progress: 0,
        status: 'not_started',
        message: 'No HR analysis found for this deal'
      });
    }
    
    res.json({
      success: true,
      progress: latestJob.progress || 0,
      status: latestJob.status,
      currentStep: latestJob.currentStep || 'Starting HR analysis...',
      jobId: latestJob.jobId,
      startedAt: latestJob.startedAt,
      estimatedTimeRemaining: latestJob.estimatedTimeRemaining
    });
    
  } catch (error) {
    console.error('Error getting HR analysis progress:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get HR analysis progress' 
    });
  }
});

/**
 * Get HR analysis results
 */
persistentHRRoutes.get('/api/deals/:dealId/hr-analysis/results', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    // Get HR analysis from database
    const hrAnalysis = await db
      .select()
      .from(agentAnalyses)
      .where(and(
        eq(agentAnalyses.dealId, dealId),
        eq(agentAnalyses.agentType, 'HR')
      ))
      .limit(1);
    
    if (hrAnalysis.length === 0) {
      return res.json({
        success: true,
        analysis: null,
        message: 'No HR analysis found for this deal'
      });
    }
    
    const analysis = hrAnalysis[0];
    
    res.json({
      success: true,
      analysis: {
        dealId: analysis.dealId,
        agentType: analysis.agentType,
        status: analysis.status,
        progress: analysis.progress,
        findings: analysis.findings ? JSON.parse(analysis.findings) : [],
        recommendations: analysis.recommendations ? JSON.parse(analysis.recommendations) : [],
        hrAnswers: analysis.hr_answers || {},
        documentSources: analysis.documentSources ? JSON.parse(analysis.documentSources) : [],
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt
      }
    });
    
  } catch (error) {
    console.error('Error getting HR analysis results:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get HR analysis results' 
    });
  }
});

/**
 * Stop HR analysis for a deal
 */
persistentHRRoutes.post('/api/deals/:dealId/hr-analysis/stop', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🛑 Stopping HR analysis for deal ${dealId}`);
    
    // Stop any running HR analysis jobs for this deal
    await persistentJobManager.stopJobsForDeal(dealId, 'rag_hr_analysis');
    
    res.json({
      success: true,
      message: 'HR analysis stopped'
    });
    
  } catch (error) {
    console.error('Error stopping HR analysis:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to stop HR analysis' 
    });
  }
});

/**
 * Reset HR analysis for a deal
 */
persistentHRRoutes.post('/api/deals/:dealId/hr-analysis/reset', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🔄 Resetting HR analysis for deal ${dealId}`);
    
    // Stop any running jobs
    await persistentJobManager.stopJobsForDeal(dealId, 'rag_hr_analysis');
    
    // Delete existing HR analysis
    await db
      .delete(agentAnalyses)
      .where(and(
        eq(agentAnalyses.dealId, dealId),
        eq(agentAnalyses.agentType, 'HR')
      ));
    
    res.json({
      success: true,
      message: 'HR analysis reset successfully'
    });
    
  } catch (error) {
    console.error('Error resetting HR analysis:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to reset HR analysis' 
    });
  }
});

console.log('✅ Persistent HR Routes loaded');