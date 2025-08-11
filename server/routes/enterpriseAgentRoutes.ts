import express, { Request, Response } from 'express';
import { z } from 'zod';
import { enterpriseJobQueue } from '../services/enterpriseJobQueue';

const router = express.Router();

/**
 * GET /api/enterprise/system-notice
 * Information about system optimization and the new Combined OCR approach
 */
router.get('/system-notice', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    notice: {
      title: "System Performance Optimization Available",
      message: "A new Combined OCR analysis system is now available for significantly improved performance",
      currentSystem: {
        name: "Granular Job Processing",
        approach: "Individual document×question pairs",
        estimatedJobsForFullAnalysis: "1000+ jobs",
        averageCompletionTime: "20-30 minutes",
        status: "Legacy - Still supported but not recommended"
      },
      optimizedSystem: {
        name: "Combined OCR Processing", 
        approach: "Agent-level document analysis",
        estimatedJobsForFullAnalysis: "7 jobs (one per agent)",
        averageCompletionTime: "3-5 minutes",
        performanceImprovement: "5-10x faster",
        status: "Recommended - Production ready",
        apiEndpoint: "/api/combined-ocr/"
      },
      migration: {
        recommended: true,
        backwardCompatible: true,
        benefits: [
          "90%+ reduction in background job count",
          "Faster processing with better resource utilization",
          "Improved answer quality through combined context analysis",
          "Stronger source citations and evidence linking",
          "Simplified error handling and recovery"
        ],
        howToMigrate: {
          "Single Agent": "POST /api/combined-ocr/analyze",
          "All Agents": "POST /api/combined-ocr/reset-and-run", 
          "Custom Selection": "POST /api/combined-ocr/analyze-bulk"
        }
      }
    },
    recommendation: "For optimal performance, please consider using the Combined OCR system at /api/combined-ocr/"
  });
});

// Request schemas for validation
const AnalysisRequestSchema = z.object({
  dealId: z.number(),
  agentType: z.string(),
  forceRefresh: z.boolean().default(false),
  priority: z.number().min(1).max(10).default(5),
  timeout: z.number().min(30000).max(600000).default(300000), // 30s to 10min
});

const BulkAnalysisRequestSchema = z.object({
  dealId: z.number(),
  agentTypes: z.array(z.string()).min(1).max(7),
  forceRefresh: z.boolean().default(false),
  priority: z.number().min(1).max(10).default(5),
  concurrency: z.number().min(1).max(10).default(3),
});

/**
 * POST /api/enterprise/analyze
 * Non-blocking endpoint that returns 202 + jobId immediately
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    console.log('🚀 Enterprise analyze request:', req.body);

    const validatedData = AnalysisRequestSchema.parse(req.body);
    const { dealId, agentType, forceRefresh, priority, timeout } = validatedData;

    // Validate agent type
    const validAgentTypes = ['Clinical', 'Legal', 'Commercial', 'HR', 'Financial', 'IP', 'Research'];
    if (!validAgentTypes.includes(agentType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid agent type. Must be one of: ${validAgentTypes.join(', ')}`
      });
    }

    // Enqueue job and return immediately
    const jobId = await enterpriseJobQueue.enqueueAgentAnalysis(dealId, agentType, {
      priority,
      timeout,
      forceRefresh,
      metadata: {
        requestedAt: new Date(),
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    // Return 202 Accepted with job tracking info
    return res.status(202).json({
      success: true,
      message: `${agentType} analysis queued successfully`,
      jobId,
      dealId,
      agentType,
      statusUrl: `/api/enterprise/status/${jobId}`,
      resultsUrl: `/api/enterprise/results/${jobId}`,
      estimatedCompletionTime: new Date(Date.now() + timeout)
    });

  } catch (error) {
    console.error('❌ Failed to queue analysis:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to queue analysis',
      message: error.message
    });
  }
});

/**
 * POST /api/enterprise/analyze-bulk
 * Queue multiple agents for analysis, returns 202 + multiple jobIds
 */
router.post('/analyze-bulk', async (req: Request, res: Response) => {
  try {
    console.log('🚀 Enterprise bulk analyze request:', req.body);

    const validatedData = BulkAnalysisRequestSchema.parse(req.body);
    const { dealId, agentTypes, forceRefresh, priority, concurrency } = validatedData;

    // Validate all agent types
    const validAgentTypes = ['Clinical', 'Legal', 'Commercial', 'HR', 'Financial', 'IP', 'Research'];
    const invalidAgents = agentTypes.filter(type => !validAgentTypes.includes(type));
    if (invalidAgents.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid agent types: ${invalidAgents.join(', ')}. Must be one of: ${validAgentTypes.join(', ')}`
      });
    }

    // Queue all agents with staggered priorities for concurrency control
    const jobs = [];
    for (let i = 0; i < agentTypes.length; i++) {
      const agentType = agentTypes[i];
      const adjustedPriority = priority + (i % concurrency); // Stagger priorities

      try {
        const jobId = await enterpriseJobQueue.enqueueAgentAnalysis(dealId, agentType, {
          priority: adjustedPriority,
          timeout: 300000, // 5 minutes default
          forceRefresh,
          metadata: {
            bulkRequest: true,
            requestedAt: new Date(),
            batchSize: agentTypes.length,
            batchIndex: i
          }
        });

        jobs.push({
          agentType,
          jobId,
          statusUrl: `/api/enterprise/status/${jobId}`,
          resultsUrl: `/api/enterprise/results/${jobId}`,
          priority: adjustedPriority
        });

        console.log(`✅ Queued ${agentType} analysis with job ID: ${jobId}`);
      } catch (error) {
        console.error(`❌ Failed to queue ${agentType} analysis:`, error);
        jobs.push({
          agentType,
          jobId: null,
          error: error.message
        });
      }
    }

    return res.status(202).json({
      success: true,
      message: `Queued ${jobs.filter(j => j.jobId).length}/${agentTypes.length} analyses`,
      dealId,
      jobs,
      overallStatusUrl: `/api/enterprise/bulk-status/${dealId}`,
      estimatedCompletionTime: new Date(Date.now() + 300000) // 5 minutes
    });

  } catch (error) {
    console.error('❌ Failed to queue bulk analysis:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to queue bulk analysis',
      message: error.message
    });
  }
});

/**
 * GET /api/enterprise/status/:jobId
 * Get detailed status of a specific job
 */
router.get('/status/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'Job ID is required'
      });
    }

    const status = await enterpriseJobQueue.getJobStatus(jobId);
    
    if (status.status === 'not_found') {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    return res.status(200).json({
      success: true,
      jobId,
      ...status,
      resultsUrl: status.status === 'completed' ? `/api/enterprise/results/${jobId}` : null
    });

  } catch (error) {
    console.error(`❌ Failed to get job status for ${req.params.jobId}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get job status',
      message: error.message
    });
  }
});

/**
 * GET /api/enterprise/results/:jobId
 * Get results of a completed job
 */
router.get('/results/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'Job ID is required'
      });
    }

    const results = await enterpriseJobQueue.getJobResults(jobId);
    
    if (!results.success) {
      const statusCode = results.error === 'Job not found' ? 404 : 
                        results.error === 'Job not completed yet' ? 202 : 500;
      
      return res.status(statusCode).json({
        success: false,
        error: results.error,
        status: results.status || 'unknown'
      });
    }

    return res.status(200).json({
      success: true,
      jobId,
      results: results.results,
      completedAt: new Date()
    });

  } catch (error) {
    console.error(`❌ Failed to get job results for ${req.params.jobId}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get job results',
      message: error.message
    });
  }
});

/**
 * GET /api/enterprise/bulk-status/:dealId
 * Get status of all jobs for a deal
 */
router.get('/bulk-status/:dealId', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid deal ID'
      });
    }

    // This would require extending the enterprise queue to track jobs by dealId
    // For now, return basic metrics
    const metrics = await enterpriseJobQueue.getQueueMetrics();
    
    return res.status(200).json({
      success: true,
      dealId,
      queueMetrics: metrics,
      message: 'Use individual job status endpoints for detailed tracking'
    });

  } catch (error) {
    console.error(`❌ Failed to get bulk status for deal ${req.params.dealId}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get bulk status',
      message: error.message
    });
  }
});

/**
 * GET /api/enterprise/metrics
 * Get overall queue performance metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await enterpriseJobQueue.getQueueMetrics();
    
    const performanceData = {
      ...metrics,
      throughput: {
        completedJobs: metrics.completed,
        failedJobs: metrics.failed,
        successRate: metrics.completed + metrics.failed > 0 
          ? (metrics.completed / (metrics.completed + metrics.failed) * 100).toFixed(2) + '%'
          : 'N/A'
      },
      currentLoad: {
        activeJobs: metrics.active,
        queuedJobs: metrics.waiting,
        utilization: metrics.concurrency > 0 
          ? (metrics.active / metrics.concurrency * 100).toFixed(2) + '%'
          : '0%'
      },
      health: {
        redis: metrics.redis_status,
        overall: metrics.redis_status === 'ready' && metrics.failed < metrics.completed ? 'healthy' : 'degraded'
      }
    };

    return res.status(200).json({
      success: true,
      metrics: performanceData,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('❌ Failed to get queue metrics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get metrics',
      message: error.message
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const metrics = await enterpriseJobQueue.getQueueMetrics();
    
    const isHealthy = metrics.redis_status === 'ready';
    
    return res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      status: isHealthy ? 'healthy' : 'unhealthy',
      redis: metrics.redis_status,
      uptime: process.uptime(),
      timestamp: new Date()
    });

  } catch (error) {
    console.error('❌ Health check failed:', error);
    return res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date()
    });
  }
});

// Clear enterprise jobs for hard reset
router.post('/clear-jobs', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.body;
    
    if (!dealId) {
      return res.status(400).json({ 
        success: false, 
        error: 'dealId is required' 
      });
    }

    console.log(`🧹 Clearing all enterprise jobs for deal ${dealId}`);
    
    // Clear from enterprise job queue
    const cleared = await enterpriseJobQueue.clearJobsForDeal(dealId);
    
    console.log(`✅ Cleared ${cleared} enterprise jobs for deal ${dealId}`);
    
    res.json({ 
      success: true, 
      message: `Cleared ${cleared} enterprise jobs for deal ${dealId}`,
      clearedJobs: cleared
    });
  } catch (error) {
    console.error('❌ Error clearing enterprise jobs:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to clear jobs' 
    });
  }
});

// Progress endpoint for UI progress bars
router.get('/progress/:dealId', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    
    if (!dealId) {
      return res.status(400).json({ 
        success: false, 
        error: 'dealId is required' 
      });
    }

    console.log(`📊 Getting enterprise job progress for deal ${dealId}`);
    
    // Get all active jobs for this deal from enterprise queue
    const activeJobs = enterpriseJobQueue.getActiveJobsForDeal(parseInt(dealId));
    
    // Format jobs for UI compatibility
    const formattedJobs = activeJobs.map(job => ({
      jobId: job.jobId,
      agentType: job.agentType,
      progress: job.progress || 0,
      status: job.status,
      currentStep: job.currentStep || 'Processing...',
      currentDocument: job.currentDocument || '',
      processedDocuments: job.processedDocuments || 0,
      totalDocuments: job.totalDocuments || 0,
      startTime: job.startTime,
    }));
    
    console.log(`📊 Found ${formattedJobs.length} active enterprise jobs for deal ${dealId}`);
    
    res.json({ 
      success: true, 
      jobs: formattedJobs,
      totalJobs: formattedJobs.length
    });
  } catch (error) {
    console.error('❌ Error getting enterprise job progress:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get progress',
      jobs: []
    });
  }
});

/**
 * GET /api/enterprise/deals/:dealId/agent/:agentType/comprehensive
 * Get comprehensive analysis results including structured Q&A
 */
router.get('/deals/:dealId/agent/:agentType/comprehensive', async (req: Request, res: Response) => {
  try {
    const { dealId, agentType } = req.params;
    const dealIdNum = parseInt(dealId);

    if (isNaN(dealIdNum)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid deal ID'
      });
    }

    const validAgentTypes = ['Clinical', 'Legal', 'Commercial', 'HR', 'Financial', 'IP', 'Research'];
    if (!validAgentTypes.includes(agentType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid agent type. Must be one of: ${validAgentTypes.join(', ')}`
      });
    }

    console.log(`🔍 Fetching comprehensive ${agentType} analysis for deal ${dealIdNum}`);

    // Get analysis from database
    const { storage } = await import('../storage');
    const analysis = await storage.getAnalysisByDealAndAgent(dealIdNum, agentType);
    
    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'Analysis not found',
        message: `No ${agentType} analysis found for deal ${dealIdNum}`
      });
    }

    // **CRITICAL FIX**: Parse structured Q&A from proper database columns (handle both camelCase and snake_case)
    let structuredAnswers = {};
    try {
      if (agentType === 'Legal') {
        const legalAnswers = (analysis as any).legal_answers;
        if (legalAnswers) {
          structuredAnswers = typeof legalAnswers === 'string' 
            ? JSON.parse(legalAnswers) 
            : legalAnswers;
        }
      } else if (agentType === 'Clinical') {
        const clinicalAnswers = (analysis as any).clinical_answers;
        if (clinicalAnswers) {
          structuredAnswers = typeof clinicalAnswers === 'string' 
            ? JSON.parse(clinicalAnswers) 
            : clinicalAnswers;
        }
      } else if (agentType === 'Commercial') {
        const commercialAnswers = (analysis as any).commercial_answers;
        if (commercialAnswers) {
          structuredAnswers = typeof commercialAnswers === 'string' 
            ? JSON.parse(commercialAnswers) 
            : commercialAnswers;
        }
      } else if (agentType === 'IP') {
        const ipAnswers = (analysis as any).ip_answers;
        if (ipAnswers) {
          structuredAnswers = typeof ipAnswers === 'string' 
            ? JSON.parse(ipAnswers) 
            : ipAnswers;
        }
      } else if (agentType === 'HR') {
        const hrAnswers = (analysis as any).hr_answers;
        if (hrAnswers) {
          structuredAnswers = typeof hrAnswers === 'string' 
            ? JSON.parse(hrAnswers) 
            : hrAnswers;
        }
      } else if (agentType === 'Financial') {
        const financialAnswers = (analysis as any).financial_answers;
        if (financialAnswers) {
          structuredAnswers = typeof financialAnswers === 'string' 
            ? JSON.parse(financialAnswers) 
            : financialAnswers;
        }
      } else if (agentType === 'Research') {
        const researchAnswers = (analysis as any).research_answers;
        if (researchAnswers) {
          structuredAnswers = typeof researchAnswers === 'string' 
            ? JSON.parse(researchAnswers) 
            : researchAnswers;
        }
      }
    } catch (error) {
      console.warn(`⚠️ Failed to parse ${agentType} structured answers:`, error);
    }

    // Build comprehensive response
    const comprehensiveResult = {
      analysis: {
        findings: typeof analysis.findings === 'string' 
          ? JSON.parse(analysis.findings) 
          : analysis.findings || [],
        recommendations: typeof analysis.recommendations === 'string' 
          ? JSON.parse(analysis.recommendations) 
          : analysis.recommendations || [],
        documentsAnalyzed: (analysis as any).documents_analyzed || 0,
        // **CRITICAL**: Include structured Q&A answers in both formats for compatibility
        [`${agentType.toLowerCase()}Answers`]: structuredAnswers,
        [`${agentType.toLowerCase()}_answers`]: structuredAnswers,
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt
      },
      metadata: {
        dealId: dealIdNum,
        agentType,
        hasStructuredAnswers: Object.keys(structuredAnswers).length > 0,
        questionCount: Object.keys(structuredAnswers).length,
        version: '2.0-structured-qa'
      }
    };

    console.log(`✅ Retrieved ${agentType} analysis with ${Object.keys(structuredAnswers).length} Q&A answers`);

    return res.json({
      success: true,
      ...comprehensiveResult
    });

  } catch (error) {
    console.error('❌ Failed to fetch comprehensive analysis:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch comprehensive analysis',
      message: error.message
    });
  }
});

export default router;