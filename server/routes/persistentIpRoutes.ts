/**
 * Persistent IP Routes
 * EXACT COPY of Financial Routes architecture for perfect parity
 * Provides comprehensive IP analysis endpoints with structured question answering
 */

import { Router } from 'express';
import { db } from '../db';
import { agentAnalyses, backgroundJobs, deals } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { comprehensiveIpAnalysisService, COMPREHENSIVE_IP_QUESTIONS } from '../comprehensiveIpAnalysisService';
import { storage } from '../storage';

const router = Router();

// Get IP analysis for a deal - EXACT Financial pattern
router.get('/deals/:dealId/ip-analysis', async (req, res) => {
  try {
    const { dealId } = req.params;
    console.log(`🔬 Fetching IP analysis for deal ${dealId}`);

    const dealIdNum = parseInt(dealId);
    if (isNaN(dealIdNum)) {
      return res.status(400).json({ error: 'Invalid deal ID' });
    }

    // Get latest IP analysis
    const analysis = await db
      .select()
      .from(agentAnalyses)
      .where(and(
        eq(agentAnalyses.dealId, dealIdNum),
        eq(agentAnalyses.agentType, 'IP')
      ))
      .orderBy(desc(agentAnalyses.createdAt))
      .limit(1);

    if (analysis.length === 0) {
      console.log(`⚠️ No IP analysis found for deal ${dealId}`);
      return res.json({
        hasAnalysis: false,
        status: 'not_started',
        message: 'No IP analysis available for this deal'
      });
    }

    const ipAnalysis = analysis[0];
    console.log(`✅ Found IP analysis for deal ${dealId}, status: ${ipAnalysis.status}`);

    res.json({
      hasAnalysis: true,
      status: ipAnalysis.status,
      findings: ipAnalysis.findings || [],
      recommendations: ipAnalysis.recommendations || [],
      ipAnswers: ipAnalysis.ipAnswers || {},
      createdAt: ipAnalysis.createdAt,
      lastUpdate: ipAnalysis.updatedAt
    });

  } catch (error) {
    console.error(`💥 Error fetching IP analysis for deal ${req.params.dealId}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch IP analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get IP questions - EXACT Financial pattern
router.get('/ip-questions', async (req, res) => {
  try {
    console.log(`📋 Fetching IP questions (${COMPREHENSIVE_IP_QUESTIONS.length} questions)`);
    
    res.json({
      questions: COMPREHENSIVE_IP_QUESTIONS,
      totalQuestions: COMPREHENSIVE_IP_QUESTIONS.length,
      categories: [...new Set(COMPREHENSIVE_IP_QUESTIONS.map(q => q.category))]
    });
  } catch (error) {
    console.error('💥 Error fetching IP questions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch IP questions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Start IP analysis - EXACT Financial pattern
router.post('/deals/:dealId/start-ip-analysis', async (req, res) => {
  try {
    const { dealId } = req.params;
    console.log(`🔬 Starting IP analysis for deal ${dealId}`);

    const dealIdNum = parseInt(dealId);
    if (isNaN(dealIdNum)) {
      return res.status(400).json({ error: 'Invalid deal ID' });
    }

    // Check if deal exists
    const dealExists = await db
      .select()
      .from(deals)
      .where(eq(deals.id, dealIdNum))
      .limit(1);

    if (dealExists.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Delete any existing IP analysis for this deal - CRITICAL for preventing stale data
    console.log(`🗑️ Deleting existing IP analysis for deal ${dealId} to prevent stale data`);
    await db
      .delete(agentAnalyses)
      .where(and(
        eq(agentAnalyses.dealId, dealIdNum),
        eq(agentAnalyses.agentType, 'IP')
      ));

    // Create background job
    const jobId = `ip_analysis_${dealIdNum}_${Date.now()}`;
    const job = {
      jobId,
      dealId: dealIdNum,
      jobType: 'ip_analysis' as const,
      agentType: 'IP' as const,
      status: 'queued' as const,
      progress: 0,
      startTime: new Date(),
      metadata: {
        agentType: 'IP',
        questionsTotal: COMPREHENSIVE_IP_QUESTIONS.length,
        questionsCompleted: 0
      }
    };

    await storage.createBackgroundJob(job);
    console.log(`✅ Created background job ${jobId} for IP analysis`);

    // Start analysis asynchronously
    comprehensiveIpAnalysisService.startComprehensiveAnalysis(dealIdNum, jobId)
      .catch(error => {
        console.error(`💥 Error in background IP analysis for deal ${dealIdNum}:`, error);
      });

    res.json({
      success: true,
      jobId,
      message: 'IP analysis started successfully',
      status: 'queued'
    });

  } catch (error) {
    console.error(`💥 Error starting IP analysis for deal ${req.params.dealId}:`, error);
    res.status(500).json({ 
      error: 'Failed to start IP analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get IP analysis progress - EXACT Financial pattern
router.get('/deals/:dealId/ip-analysis/progress', async (req, res) => {
  try {
    const { dealId } = req.params;
    const dealIdNum = parseInt(dealId);

    if (isNaN(dealIdNum)) {
      return res.status(400).json({ error: 'Invalid deal ID' });
    }

    // Get background job for this deal
    const jobs = await storage.getBackgroundJobsByDealId(dealIdNum);
    const ipJob = jobs.find(job => job.agentType === 'IP');

    if (!ipJob) {
      return res.json({
        isRunning: false,
        progress: 0,
        message: 'No IP analysis running',
        status: 'not_started'
      });
    }

    // Get progress from service
    const progressData = comprehensiveIpAnalysisService.getProgressData(dealIdNum);

    res.json({
      isRunning: ipJob.status === 'processing',
      progress: ipJob.progress || 0,
      message: ipJob.currentStep || progressData.message,
      currentStep: ipJob.currentStep,
      status: ipJob.status,
      startTime: ipJob.startTime,
      lastUpdate: ipJob.updatedAt,
      jobId: ipJob.jobId
    });

  } catch (error) {
    console.error(`💥 Error getting IP analysis progress for deal ${req.params.dealId}:`, error);
    res.status(500).json({ 
      error: 'Failed to get IP analysis progress',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get comprehensive IP results - EXACT Financial pattern  
router.get('/deals/:dealId/ip-analysis/comprehensive', async (req, res) => {
  try {
    const { dealId } = req.params;
    console.log(`🔬 Fetching comprehensive IP results for deal ${dealId}`);

    const dealIdNum = parseInt(dealId);
    if (isNaN(dealIdNum)) {
      return res.status(400).json({ error: 'Invalid deal ID' });
    }

    // Get latest IP analysis with comprehensive answers
    const analysis = await db
      .select()
      .from(agentAnalyses)
      .where(and(
        eq(agentAnalyses.dealId, dealIdNum),
        eq(agentAnalyses.agentType, 'IP')
      ))
      .orderBy(desc(agentAnalyses.createdAt))
      .limit(1);

    if (analysis.length === 0) {
      console.log(`⚠️ No comprehensive IP analysis found for deal ${dealId}`);
      return res.json({
        hasResults: false,
        questions: COMPREHENSIVE_IP_QUESTIONS.map(q => ({
          id: q.id,
          question: q.question,
          category: q.category,
          answer: '',
          confidence: 0,
          sources: [],
          keyFindings: [],
          evidenceSummary: '',
          ipAssessment: '',
          recommendations: []
        }))
      });
    }

    const ipAnalysis = analysis[0];
    const ipAnswers = ipAnalysis.ipAnswers || {};

    // Format questions with answers
    const questionsWithAnswers = COMPREHENSIVE_IP_QUESTIONS.map(question => {
      const answer = ipAnswers[question.id];
      return {
        id: question.id,
        question: question.question,
        category: question.category,
        answer: answer?.answer || '',
        confidence: answer?.confidence || 0,
        sources: answer?.sources || [],
        keyFindings: answer?.keyFindings || [],
        evidenceSummary: answer?.evidenceSummary || '',
        ipAssessment: answer?.ipAssessment || '',
        recommendations: answer?.recommendations || [],
        detailedEvidence: answer?.detailedEvidence || []
      };
    });

    console.log(`✅ Returning ${questionsWithAnswers.length} IP questions with answers for deal ${dealId}`);

    res.json({
      hasResults: true,
      questions: questionsWithAnswers,
      summary: {
        totalQuestions: COMPREHENSIVE_IP_QUESTIONS.length,
        answeredQuestions: questionsWithAnswers.filter(q => q.answer && q.answer.trim()).length,
        overallFindings: ipAnalysis.findings || [],
        overallRecommendations: ipAnalysis.recommendations || [],
        analysisStatus: ipAnalysis.status,
        lastUpdate: ipAnalysis.updatedAt,
        createdAt: ipAnalysis.createdAt
      }
    });

  } catch (error) {
    console.error(`💥 Error fetching comprehensive IP results for deal ${req.params.dealId}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch comprehensive IP results',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

console.log('🔬 Persistent IP analysis routes registered');
export default router;