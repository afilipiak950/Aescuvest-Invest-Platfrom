/**
 * Persistent Analysis Routes - Ensures all background analyses complete autonomously
 */

import { Router, Request, Response } from 'express';
import { persistentJobManager } from '../PersistentJobManager';
import { storage } from '../storage';

const router = Router();

/**
 * Start comprehensive analysis for all 7 agents with guaranteed completion
 */
router.post('/api/deals/:dealId/start-all-analyses', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    console.log(`🚀 Starting persistent analysis for all 7 agents on deal ${dealId}`);
    
    // Clear any stuck jobs first
    await persistentJobManager.clearStuckJobs(dealId);
    
    // Define all 7 agent types
    const agentTypes = [
      'Clinical',
      'Legal', 
      'Commercial',
      'HR',
      'Financial',
      'IP',
      'Research'
    ];
    
    const startedJobs = [];
    
    // Start each analysis with persistent job manager
    for (const agentType of agentTypes) {
      try {
        const analysisService = getAnalysisServiceForAgent(agentType);
        const jobId = await persistentJobManager.startAnalysisJob(
          dealId,
          agentType,
          analysisService
        );
        
        startedJobs.push({
          agentType,
          jobId,
          status: 'started'
        });
        
        console.log(`✅ Started ${agentType} analysis job: ${jobId}`);
      } catch (error) {
        console.error(`❌ Failed to start ${agentType} analysis:`, error);
        startedJobs.push({
          agentType,
          jobId: null,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      message: `Started ${startedJobs.filter(job => job.status === 'started').length}/7 analyses`,
      jobs: startedJobs
    });
    
  } catch (error) {
    console.error('❌ Error starting all analyses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start analyses',
      details: error.message
    });
  }
});

/**
 * Get status of all persistent jobs for a deal
 */
router.get('/api/deals/:dealId/persistent-jobs-status', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    // Get status from persistent job manager
    const activeJobs = persistentJobManager.getActiveJobsStatus()
      .filter(job => job.dealId === dealId);
    
    // Also get database status
    const dbJobs = await storage.getActiveBackgroundJobsForDeal(dealId);
    
    res.json({
      success: true,
      activeJobs,
      dbJobs,
      totalActiveJobs: activeJobs.length
    });
    
  } catch (error) {
    console.error('❌ Error getting persistent jobs status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get jobs status'
    });
  }
});

/**
 * Stop a specific persistent job
 */
router.post('/api/persistent-jobs/:jobId/stop', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId;
    
    const stopped = await persistentJobManager.stopJob(jobId);
    
    res.json({
      success: stopped,
      message: stopped ? 'Job stopped successfully' : 'Job not found or already stopped'
    });
    
  } catch (error) {
    console.error(`❌ Error stopping job ${req.params.jobId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop job'
    });
  }
});

/**
 * Clear all stuck jobs for a deal
 */
router.post('/api/deals/:dealId/clear-stuck-jobs', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    const clearedCount = await persistentJobManager.clearStuckJobs(dealId);
    
    res.json({
      success: true,
      message: `Cleared ${clearedCount} stuck jobs`,
      clearedCount
    });
    
  } catch (error) {
    console.error(`❌ Error clearing stuck jobs for deal ${req.params.dealId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear stuck jobs'
    });
  }
});

/**
 * Delete ALL background job records for a deal (comprehensive cleanup)
 */
router.delete('/api/background-jobs/deal/:dealId', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid deal ID'
      });
    }
    
    console.log(`🗑️ Deleting ALL background job records for deal ${dealId}`);
    
    // Use the existing storage method that properly deletes all background jobs for a deal
    const deletedCount = await storage.deleteBackgroundJobsByDealId(dealId);
    
    console.log(`✅ Deleted ${deletedCount} background job records for deal ${dealId}`);
    
    res.json({
      success: true,
      message: `Deleted ${deletedCount} background job records`,
      deletedCount
    });
    
  } catch (error) {
    console.error(`❌ Error deleting background job records for deal ${req.params.dealId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete background job records'
    });
  }
});

// Clean up background job records for a deal to prevent duplicate key errors
router.post('/api/deals/:dealId/cleanup-background-jobs', async (req: Request, res: Response) => {
  try {
    console.log(`🧹 CLEANUP ENDPOINT HIT - Deal ID: ${req.params.dealId}`);
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      console.error(`❌ Invalid deal ID: ${req.params.dealId}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid deal ID'
      });
    }
    
    console.log(`🧹 Cleaning up background job records for deal ${dealId}`);
    
    // Clean up any existing background job records for this deal
    const cleanupResult = await storage.cleanupBackgroundJobsForDeal(dealId);
    console.log(`✅ Cleanup completed:`, cleanupResult);
    
    res.json({
      success: true,
      message: `Cleaned up background job records for deal ${dealId}`,
      cleanedCount: cleanupResult.cleanedCount
    });
    
  } catch (error) {
    console.error(`❌ Error cleaning up background job records for deal ${req.params.dealId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup background job records'
    });
  }
});

/**
 * Stop ALL jobs for a deal immediately
 */
router.post('/api/deals/:dealId/stop-all-jobs', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    console.log(`🛑 STOPPING ALL JOBS for deal ${dealId}`);
    
    // Get all jobs for this deal
    const allJobs = await storage.getBackgroundJobsByDealId(dealId);
    let stoppedCount = 0;
    
    for (const job of allJobs) {
      try {
        // Check if job is still running
        if (job.status === 'processing' || job.status === 'pending') {
          // Try persistent job manager first
          try {
            await persistentJobManager.stopJob(job.jobId);
            stoppedCount++;
            console.log(`🛑 Stopped job via persistentJobManager: ${job.jobId} (${job.agentType})`);
          } catch (managerError) {
            console.warn(`⚠️ persistentJobManager failed for ${job.jobId}, using direct database update:`, managerError);
            
            // Fallback to direct database update
            await storage.updateBackgroundJob(job.jobId, {
              status: 'cancelled',
              currentStep: 'Cancelled by user',
              completedAt: new Date(),
              updatedAt: new Date()
            });
            stoppedCount++;
            console.log(`🛑 Stopped job via database: ${job.jobId} (${job.agentType})`);
          }
        }
      } catch (error) {
        console.error(`❌ Error stopping job ${job.jobId}:`, error);
      }
    }
    
    // Also clear any stuck jobs (with error handling)
    let clearedCount = 0;
    try {
      clearedCount = await persistentJobManager.clearStuckJobs(dealId);
    } catch (clearError) {
      console.warn(`⚠️ clearStuckJobs failed, continuing:`, clearError);
    }
    
    console.log(`✅ Stopped ${stoppedCount} jobs and cleared ${clearedCount} stuck jobs for deal ${dealId}`);
    
    res.json({
      success: true,
      message: `Stopped ${stoppedCount} jobs and cleared ${clearedCount} stuck jobs`,
      stoppedCount,
      clearedCount
    });
    
  } catch (error) {
    console.error(`❌ Error stopping all jobs for deal ${req.params.dealId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop all jobs'
    });
  }
});

/**
 * Start all 7 specialized agents with correct analysis techniques
 */
router.post('/api/deals/:dealId/start-all-specialized-agents', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    console.log(`🚀 STARTING ALL 7 SPECIALIZED AGENTS for deal ${dealId}`);
    
    const agentTypes = ['legal', 'clinical', 'commercial', 'hr', 'financial', 'ip', 'research'];
    const startedJobs: string[] = [];
    
    for (const agentType of agentTypes) {
      try {
        const jobId = `${agentType}_analysis_${dealId}_${Date.now()}`;
        console.log(`🚀 Starting ${agentType} agent with specialized analysis technique`);
        
        // Get the specialized analysis service
        const analysisService = getAnalysisServiceForAgent(agentType);
        
        // Start the background job with proper service
        await storage.createBackgroundJob({
          jobId,
          jobType: `comprehensive_${agentType}_analysis`,
          dealId,
          agentType: agentType.charAt(0).toUpperCase() + agentType.slice(1),
          status: 'processing',
          progress: 0,
          currentStep: `Initializing ${agentType} analysis with specialized technique`,
          totalDocuments: 0,
          processedDocuments: 0
        });
        
        // Start the analysis in background
        setImmediate(async () => {
          try {
            const progressCallback = async (progress: number, step: string) => {
              await storage.updateBackgroundJob(jobId, {
                progress,
                currentStep: step,
                updatedAt: new Date()
              });
            };
            
            await analysisService.runComprehensiveAnalysis(dealId, storage, jobId, progressCallback);
            
            await storage.updateBackgroundJob(jobId, {
              status: 'completed',
              progress: 100,
              completedAt: new Date(),
              currentStep: `${agentType} analysis completed with specialized technique`
            });
            
          } catch (error) {
            console.error(`❌ Error in ${agentType} analysis:`, error);
            await storage.updateBackgroundJob(jobId, {
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
              currentStep: `${agentType} analysis failed`
            });
          }
        });
        
        startedJobs.push(`${agentType} (${jobId})`);
        
      } catch (error) {
        console.error(`❌ Error starting ${agentType} agent:`, error);
      }
    }
    
    console.log(`✅ Started ${startedJobs.length}/7 specialized agents for deal ${dealId}`);
    
    res.json({
      success: true,
      message: `Started ${startedJobs.length}/7 specialized agents`,
      startedJobs
    });
    
  } catch (error) {
    console.error(`❌ Error starting specialized agents for deal ${req.params.dealId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to start specialized agents'
    });
  }
});

/**
 * Get analysis service for specific agent type
 */
function getAnalysisServiceForAgent(agentType: string): any {
  switch (agentType.toLowerCase()) {
    case 'legal':
      const { comprehensiveLegalAnalysisService } = require('../comprehensiveLegalAnalysisService');
      return comprehensiveLegalAnalysisService;
      
    case 'clinical':
      const { comprehensiveClinicalAnalysisService } = require('../comprehensiveClinicalAnalysisService');
      return comprehensiveClinicalAnalysisService;
      
    case 'commercial':
      const { comprehensiveCommercialAnalysisService } = require('../comprehensiveCommercialAnalysisService');
      return comprehensiveCommercialAnalysisService;
      
    case 'hr':
      const { comprehensiveHrAnalysisService } = require('../comprehensiveHrAnalysisService');
      return comprehensiveHrAnalysisService;
      
    case 'financial':
      const { comprehensiveFinancialAnalysisService } = require('../comprehensiveFinancialAnalysisService');
      return comprehensiveFinancialAnalysisService;
      
    case 'ip':
      const { comprehensiveIpAnalysisService } = require('../comprehensiveIpAnalysisService');
      return comprehensiveIpAnalysisService;
      
    case 'research':
      const { comprehensiveResearchAnalysisService } = require('../comprehensiveResearchAnalysisService');
      return comprehensiveResearchAnalysisService;
      
    default:
      return createGenericAnalysisService(agentType, [
        'Initializing analysis',
        'Processing documents',
        'Generating insights'
      ]);
  }
}

/**
 * Create a generic analysis service for agent types without specific implementations
 */
function createGenericAnalysisService(agentType: string, specificSteps: string[]): any {
  return {
    runComprehensiveAnalysis: async (
      dealId: number, 
      storage: any, 
      jobId: string, 
      progressCallback: Function
    ) => {
      console.log(`🔄 Running ${agentType} analysis for deal ${dealId} (generic service)`);
      
      const steps = [
        'Initializing analysis',
        ...specificSteps,
        'Finalizing results'
      ];
      
      for (let i = 0; i < steps.length; i++) {
        const progress = Math.round((i / steps.length) * 100);
        await progressCallback(progress, steps[i]);
        
        // Simulate processing time (varies by agent type)
        const processingTime = agentType === 'Legal' ? 2000 : 1200;
        await new Promise(resolve => setTimeout(resolve, processingTime));
      }
      
      // Final completion
      await progressCallback(100, `${agentType} analysis completed`);
      
      return {
        status: 'completed',
        agentType,
        findings: [`${agentType} finding 1`, `${agentType} finding 2`],
        recommendations: [`${agentType} recommendation 1`]
      };
    }
  };
}

export default router;