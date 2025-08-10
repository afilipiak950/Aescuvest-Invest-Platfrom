import express, { Request, Response } from 'express';
import { z } from 'zod';
import { enterpriseJobQueue } from '../services/enterpriseJobQueue';

const router = express.Router();

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

export default router;