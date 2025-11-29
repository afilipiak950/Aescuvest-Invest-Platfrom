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
import { persistentIpAnalysisService } from '../services/persistentIpAnalysis';
import { storage } from '../storage';
import { websocketManager } from '../services/websocketManager';

// Helper function to broadcast IP queue progress via WebSocket (MATCH Legal pattern)
async function broadcastIpQueueProgress(dealId: number, currentQuestionId: string | null, completed: number, total: number, isProcessing: boolean) {
  try {
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    const status = {
      total,
      pending: Math.max(0, total - completed - (isProcessing ? 1 : 0)),
      running: isProcessing ? 1 : 0,
      completed,
      failed: 0,
      cancelled: 0,
      progress,
      currentQuestion: currentQuestionId ? `Processing question ${completed + 1}/${total}: ${currentQuestionId}` : null,
      currentQuestionId,
      isProcessing
    };
    
    websocketManager.broadcast('ip_queue_progress', status, dealId);
    console.log(`📡 [IP Queue] Broadcast progress: question=${currentQuestionId}, completed=${completed}/${total}, progress=${progress}%`);
  } catch (error) {
    console.error('Error broadcasting IP queue progress:', error);
  }
}

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
      ipAnswers: ipAnalysis.ip_answers || {},
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
      categories: Array.from(new Set(COMPREHENSIVE_IP_QUESTIONS.map(q => q.category)))
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

    // Start analysis asynchronously using persistent service - EXACT Financial pattern
    persistentIpAnalysisService.startAnalysis(dealIdNum, jobId)
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
    const progressData = comprehensiveIpAnalysisService.getProgress();

    res.json({
      isRunning: ipJob.status === 'processing',
      progress: ipJob.progress || 0,
      message: ipJob.currentStep || progressData.message,
      currentStep: ipJob.currentStep,
      status: ipJob.status,
      startTime: ipJob.createdAt,
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
    const ipAnswers = ipAnalysis.ip_answers || {};

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

// CRITICAL MISSING ENDPOINT: Start IP agent analysis - EXACT Financial pattern
// This is the endpoint called by the frontend "Re-run Analysis" button
router.post('/deals/:dealId/agents/ip/analyze', async (req, res) => {
  try {
    const { dealId } = req.params;
    const dealIdNum = parseInt(dealId);
    
    if (isNaN(dealIdNum)) {
      return res.status(400).json({ error: 'Invalid deal ID' });
    }

    console.log(`🔬 CRITICAL: Starting FRESH IP analysis for deal ${dealId} - DELETING previous data...`);
    
    // CRITICAL: Start persistent IP analysis which includes deletion logic
    const jobId = await persistentIpAnalysisService.startIpAnalysis(dealIdNum);
    
    res.json({
      success: true,
      message: 'IP analysis started successfully',
      jobId,
      status: 'processing'
    });

  } catch (error) {
    console.error(`💥 Error starting IP agent analysis for deal ${req.params.dealId}:`, error);
    res.status(500).json({ 
      error: 'Failed to start IP analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get IP agent results - EXACT pattern for EnhancedAgentCard
router.get('/deals/:dealId/agents/ip/results', async (req, res) => {
  try {
    const { dealId } = req.params;
    const dealIdNum = parseInt(dealId);
    
    if (isNaN(dealIdNum)) {
      return res.status(400).json({ error: 'Invalid deal ID' });
    }

    console.log(`🔐 Fetching comprehensive IP analysis results for deal ${dealId}`);

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
      console.log(`❌ No IP analysis found for deal ${dealId}`);
      return res.json({
        success: true,
        analysis: {
          hasAnswers: false,
          status: 'not_started',
          findings: [],
          recommendations: [],
          ipAnswers: {}
        }
      });
    }

    const ipAnalysis = analysis[0];
    const ipAnswers = ipAnalysis.ip_answers || {};
    
    // Check if we have comprehensive answers
    const hasAnswers = Object.keys(ipAnswers).length > 0;
    const answersType = typeof ipAnswers;
    const parsedAnswersKeys = hasAnswers ? Object.keys(ipAnswers) : [];
    
    console.log(`🔐 IP Analysis Data: {
  hasAnswers: ${hasAnswers},
  answersType: '${answersType}',
  parsedAnswersKeys: ${JSON.stringify(parsedAnswersKeys)}
}`);

    if (hasAnswers) {
      console.log(`✅ Found IP analysis for deal ${dealId}: {
  id: ${ipAnalysis.id},
  agentType: '${ipAnalysis.agentType}',
  status: '${ipAnalysis.status}',
  findingsLength: ${ipAnalysis.findings?.length || 0},
  recommendationsLength: ${ipAnalysis.recommendations?.length || 0},
  totalRecordsFound: ${analysis.length},
  lowercaseCount: ${analysis.filter(a => a.agentType === 'ip').length},
  capitalizedCount: ${analysis.filter(a => a.agentType === 'IP').length},
  allRecordStatuses: ${JSON.stringify(analysis.map(a => ({ id: a.id, agentType: a.agentType, status: a.status })))}
}`);
      
      // Format questions with answers for comprehensive display
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
          recommendations: answer?.recommendations || []
        };
      });
      
      console.log(`✅ Found comprehensive IP analysis - ${questionsWithAnswers.length} questions, ${ipAnalysis.findings?.length || 0} findings, ${questionsWithAnswers.filter(q => q.recommendations && q.recommendations.length > 0).length} recommendations`);
      
      res.json({
        success: true,
        analysis: {
          hasAnswers: true,
          status: ipAnalysis.status,
          findings: ipAnalysis.findings || [],
          recommendations: questionsWithAnswers.flatMap(q => q.recommendations || []),
          ipAnswers,
          questions: questionsWithAnswers,
          createdAt: ipAnalysis.createdAt,
          updatedAt: ipAnalysis.updatedAt
        }
      });
    } else {
      console.log(`❌ No IP analysis found for deal ${dealId}`);
      res.json({
        success: true,
        analysis: {
          hasAnswers: false,
          status: 'not_started',
          findings: [],
          recommendations: [],
          ipAnswers: {}
        }
      });
    }

  } catch (error) {
    console.error(`💥 Error fetching IP agent results for deal ${req.params.dealId}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch IP agent results',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get progress for ALL active question reruns for a deal
 */
router.get('/api/deals/:dealId/ip-analysis/questions/progress', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const { comprehensiveIpAnalysisService } = await import('../comprehensiveIpAnalysisService');
    
    const allProgress = comprehensiveIpAnalysisService.getAllQuestionProgress(dealId);
    
    res.json({
      success: true,
      progress: allProgress
    });
    
  } catch (error) {
    console.error('Error getting all IP question rerun progress:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get progress' 
    });
  }
});

/**
 * Get progress for a single question rerun
 */
router.get('/api/deals/:dealId/ip-analysis/question/:questionId/progress', async (req, res) => {
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

    const { comprehensiveIpAnalysisService } = await import('../comprehensiveIpAnalysisService');
    
    const progress = await comprehensiveIpAnalysisService.getQuestionRerunProgress(dealId, questionId);
    
    res.json({
      success: true,
      progress
    });
    
  } catch (error) {
    console.error('Error getting IP question rerun progress:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get progress' 
    });
  }
});

/**
 * Re-run a single IP question with database-backed persistence
 */
router.post('/api/deals/:dealId/ip-analysis/question/:questionId/rerun', async (req, res) => {
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

    console.log(`🔄 Re-running IP question ${questionId} for deal ${dealId} (BACKGROUND MODE)`);
    
    const { comprehensiveIpAnalysisService } = await import('../comprehensiveIpAnalysisService');
    
    // Check if already running
    if (await comprehensiveIpAnalysisService.isQuestionRunning(dealId, questionId)) {
      console.log(`⚠️ IP question ${questionId} for deal ${dealId} is already being rerun`);
      return res.status(409).json({ 
        success: false, 
        error: `Question ${questionId} is already being rerun. Please wait for it to complete.` 
      });
    }
    
    // Immediately initialize progress to 0 (atomically registers the job)
    await comprehensiveIpAnalysisService.updateQuestionRerunProgress(dealId, questionId, 0);
    
    // Schedule background job execution
    setImmediate(() => {
      comprehensiveIpAnalysisService.rerunSingleQuestion(dealId, questionId, customInstructions || '')
        .then(() => {
          console.log(`✅ Background IP rerun completed for question ${questionId} on deal ${dealId}`);
        })
        .catch(async error => {
          console.error(`❌ Background IP rerun failed for question ${questionId} on deal ${dealId}:`, error);
        });
    });
    
    // Return immediately - client will poll for progress
    res.json({
      success: true,
      message: 'IP question rerun started in background',
      questionId,
      dealId
    });
    
  } catch (error) {
    console.error('Error re-running IP question:', error);
    
    if (error.message && error.message.includes('already being rerun')) {
      return res.status(409).json({ 
        success: false, 
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to re-run IP question analysis' 
    });
  }
});

/**
 * Force rerun ALL IP questions (including already answered ones)
 * Uses COMPREHENSIVE ANALYSIS with evidence extraction from ALL documents
 * EXACT MATCH to Legal/Clinical/HR/Financial implementation
 */
router.post('/api/deals/:dealId/ip-analysis/force-rerun-all', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🔥 FORCE RERUN: Checking if sequential IP analysis is already running for deal ${dealId}`);
    
    const { comprehensiveIpAnalysisService, COMPREHENSIVE_IP_QUESTIONS } = await import('../comprehensiveIpAnalysisService');
    const { storage } = await import('../storage');
    const { db } = await import('../db');
    const { backgroundJobs } = await import('../../shared/schema');
    const { and: drizzleAnd, eq: drizzleEq, like: drizzleLike } = await import('drizzle-orm');
    
    const masterJobId = `force-rerun-all-ip-${dealId}`;
    const existingMasterJob = await storage.getBackgroundJobById(masterJobId);
    
    if (existingMasterJob && existingMasterJob.status === 'processing') {
      console.log(`⚠️ Force rerun already in progress for deal ${dealId} (started ${existingMasterJob.createdAt})`);
      return res.status(409).json({
        success: false,
        error: 'Force rerun already in progress',
        message: 'A sequential force rerun is already running for this deal. Please wait for it to complete.',
        startedAt: existingMasterJob.createdAt,
        jobId: masterJobId
      });
    }
    
    if (existingMasterJob) {
      console.log(`🧹 Cleaning up previous force-rerun job with status: ${existingMasterJob.status}`);
      await storage.deleteBackgroundJob(masterJobId);
      console.log(`✅ Deleted old force-rerun master job`);
    }
    
    console.log(`🔥 FORCE RERUN: Starting SEQUENTIAL COMPREHENSIVE analysis for ALL IP questions on deal ${dealId}`);
    
    await storage.createBackgroundJob({
      jobId: masterJobId,
      jobType: 'force_rerun_all_ip',
      dealId,
      status: 'processing',
      progress: 0,
      currentStep: 'Starting sequential force rerun of all IP questions'
    });
    console.log(`🔒 Created master lock job: ${masterJobId}`);
    
    console.log(`🧹 Cleaning up any existing IP question rerun jobs for deal ${dealId}`);
    
    const existingQuestionJobs = await db.query.backgroundJobs.findMany({
      where: drizzleAnd(
        drizzleEq(backgroundJobs.dealId, dealId),
        drizzleLike(backgroundJobs.jobId, 'ip-question-rerun-%')
      )
    });
    
    for (const job of existingQuestionJobs) {
      await storage.deleteBackgroundJob(job.jobId);
    }
    console.log(`✅ Cleaned up ${existingQuestionJobs.length} existing IP question rerun jobs`);
    
    res.json({
      success: true,
      message: `Force rerun: Started sequential comprehensive analysis - questions will run one after another`,
      startedCount: COMPREHENSIVE_IP_QUESTIONS.length,
      totalQuestions: COMPREHENSIVE_IP_QUESTIONS.length,
      dealId,
      estimatedTime: `${Math.round(COMPREHENSIVE_IP_QUESTIONS.length * 10 / 60)} hours (10 min average per question)`
    });
    
    setImmediate(async () => {
      let completedCount = 0;
      const errors: string[] = [];
      
      try {
        for (let i = 0; i < COMPREHENSIVE_IP_QUESTIONS.length; i++) {
          const question = COMPREHENSIVE_IP_QUESTIONS[i];
          const questionNumber = i + 1;
          const startTime = Date.now();
          
          const overallProgress = Math.round((i / COMPREHENSIVE_IP_QUESTIONS.length) * 100);
          await storage.updateBackgroundJob(masterJobId, {
            progress: overallProgress,
            currentStep: `Processing question ${questionNumber}/${COMPREHENSIVE_IP_QUESTIONS.length}: ${question.id}`
          });
          
          // CRITICAL: Broadcast progress via WebSocket for per-question progress bar (MATCH Legal pattern)
          await broadcastIpQueueProgress(dealId, question.id, completedCount, COMPREHENSIVE_IP_QUESTIONS.length, true);
          
          try {
            console.log(`🎯 [${questionNumber}/${COMPREHENSIVE_IP_QUESTIONS.length}] SEQUENTIAL: Starting question ${question.id}`);
            console.log(`⏰ Timestamp: ${new Date().toISOString()} - Ensuring previous question completed before starting this one`);
            
            await comprehensiveIpAnalysisService.rerunSingleQuestion(dealId, question.id);
            const duration = Math.round((Date.now() - startTime) / 1000);
            
            completedCount++;
            console.log(`✅ [${questionNumber}/${COMPREHENSIVE_IP_QUESTIONS.length}] Completed ${question.id} in ${duration}s`);
            
            // CRITICAL: Broadcast completion via WebSocket (MATCH Legal pattern)
            await broadcastIpQueueProgress(dealId, null, completedCount, COMPREHENSIVE_IP_QUESTIONS.length, i < COMPREHENSIVE_IP_QUESTIONS.length - 1);
            
            if (i < COMPREHENSIVE_IP_QUESTIONS.length - 1) {
              console.log(`⏸️ 2-second delay before next question...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
          } catch (error: any) {
            const duration = Math.round((Date.now() - startTime) / 1000);
            console.error(`❌ [${questionNumber}/${COMPREHENSIVE_IP_QUESTIONS.length}] Failed ${question.id} after ${duration}s:`, error);
            errors.push(`${question.id}: ${error.message}`);
            
            if (i < COMPREHENSIVE_IP_QUESTIONS.length - 1) {
              console.log(`⏸️ 2-second delay before next question (after error)...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }
        
        await storage.updateBackgroundJob(masterJobId, {
          status: 'completed',
          progress: 100,
          currentStep: `Completed: ${completedCount}/${COMPREHENSIVE_IP_QUESTIONS.length} questions analyzed`,
          completedAt: new Date()
        });
        
        console.log(`🎉 SEQUENTIAL FORCE RERUN COMPLETE: ${completedCount}/${COMPREHENSIVE_IP_QUESTIONS.length} questions analyzed`);
        if (errors.length > 0) {
          console.log(`⚠️ ${errors.length} questions failed:`, errors);
        }
        
      } catch (fatalError: any) {
        console.error(`🚨 FATAL ERROR in force rerun loop:`, fatalError);
        await storage.updateBackgroundJob(masterJobId, {
          status: 'failed',
          progress: Math.round((completedCount / COMPREHENSIVE_IP_QUESTIONS.length) * 100),
          currentStep: `Failed after ${completedCount} questions: ${fatalError.message}`
        });
      } finally {
        setTimeout(async () => {
          try {
            console.log(`🧹 [1-hour cleanup] Deleting master job: ${masterJobId}`);
            await storage.deleteBackgroundJob(masterJobId);
            console.log(`✅ [1-hour cleanup] Deleted master job: ${masterJobId}`);
          } catch (cleanupError) {
            console.error(`❌ [1-hour cleanup] Failed to delete master job:`, cleanupError);
          }
        }, 60 * 60 * 1000);
      }
    });
    
  } catch (error: any) {
    console.error('Error force rerunning all IP questions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to force rerun all questions' 
    });
  }
});

/**
 * Get queue status for IP analysis
 * EXACT MATCH to HR/Financial implementation with proper total calculation
 */
router.get('/api/deals/:dealId/ip-analysis/queue-status', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    const { storage } = await import('../storage');
    const { COMPREHENSIVE_IP_QUESTIONS } = await import('../comprehensiveIpAnalysisService');
    const masterJobId = `force-rerun-all-ip-${dealId}`;
    
    const masterJob = await storage.getBackgroundJobById(masterJobId);
    
    const allJobs = await storage.getBackgroundJobsByDealId(dealId);
    const questionJobs = allJobs.filter(job => job.jobType === 'ip_question_rerun');
    
    const pending = questionJobs.filter(j => j.status === 'pending').length;
    const running = questionJobs.filter(j => j.status === 'processing').length;
    const completed = questionJobs.filter(j => j.status === 'completed').length;
    const failed = questionJobs.filter(j => j.status === 'failed').length;
    const cancelled = questionJobs.filter(j => j.status === 'cancelled').length;
    
    const total = masterJob ? COMPREHENSIVE_IP_QUESTIONS.length : questionJobs.length;
    const progress = masterJob ? masterJob.progress : 0;
    const isProcessing = masterJob?.status === 'processing' || running > 0;
    
    const effectiveCompleted = masterJob && masterJob.status === 'processing' 
      ? Math.floor((masterJob.progress / 100) * COMPREHENSIVE_IP_QUESTIONS.length)
      : completed;
    
    // Extract currentQuestionId from currentStep - format is "Processing question X/Y: question_id"
    let currentQuestionId: string | null = null;
    if (masterJob?.currentStep && isProcessing) {
      const match = masterJob.currentStep.match(/:\s*(\w+)$/);
      if (match) {
        currentQuestionId = match[1];
      }
    }
    
    console.log(`📊 IP queue-status for deal ${dealId}: masterJob=${!!masterJob}, status=${masterJob?.status}, progress=${progress}%, isProcessing=${isProcessing}, total=${total}, currentQuestionId=${currentQuestionId}`);
    
    res.json({
      success: true,
      status: {
        total,
        pending,
        running: isProcessing ? 1 : 0,  // If processing, at least 1 question is running
        completed: effectiveCompleted,
        failed,
        cancelled,
        progress,
        currentQuestion: masterJob?.currentStep || null,
        currentQuestionId,  // CRITICAL: Add this field to match Legal's contract
        isProcessing
      }
    });
    
  } catch (error) {
    console.error('Error getting IP queue status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get queue status' 
    });
  }
});

/**
 * Cancel queue processing for IP analysis
 */
router.post('/api/deals/:dealId/ip-analysis/cancel-queue', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid deal ID' 
      });
    }

    console.log(`🛑 Cancelling IP question queue for deal ${dealId}`);
    
    const { storage } = await import('../storage');
    const { db } = await import('../db');
    const { backgroundJobs } = await import('../../shared/schema');
    const { and: drizzleAnd, eq: drizzleEq, like: drizzleLike, or: drizzleOr } = await import('drizzle-orm');
    
    const masterJobId = `force-rerun-all-ip-${dealId}`;
    
    await storage.deleteBackgroundJob(masterJobId);
    console.log(`✅ Deleted master job: ${masterJobId}`);
    
    const existingQuestionJobs = await db.query.backgroundJobs.findMany({
      where: drizzleAnd(
        drizzleEq(backgroundJobs.dealId, dealId),
        drizzleOr(
          drizzleLike(backgroundJobs.jobId, 'ip-question-rerun-%'),
          drizzleLike(backgroundJobs.jobType, 'ip_question_rerun')
        )
      )
    });
    
    for (const job of existingQuestionJobs) {
      await storage.deleteBackgroundJob(job.jobId);
    }
    console.log(`✅ Cleaned up ${existingQuestionJobs.length} IP question rerun jobs`);
    
    res.json({
      success: true,
      message: 'Queue cancelled successfully'
    });
    
  } catch (error) {
    console.error('Error cancelling IP queue:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to cancel queue' 
    });
  }
});

console.log('🔬 Persistent IP analysis routes registered');
export default router;