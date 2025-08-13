/**
 * Persistent Analysis Routes - Ensures all background analyses complete autonomously
 */

import { Router, Request, Response } from 'express';
import { persistentJobManager } from '../services/persistentJobManager';
import { storage } from '../storage';
import { comprehensiveLegalAnalysisService } from '../comprehensiveLegalAnalysisService';

const router = Router();

/**
 * Start comprehensive analysis for all 7 agents with guaranteed completion
 */
router.post('/api/deals/:dealId/start-all-analyses', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    console.log(`🚀 COMPREHENSIVE ANALYSIS START - Deal ${dealId} - Route Hit Successfully`);
    
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
        const analysisService = await getAnalysisServiceForAgent(agentType);
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
          error: error instanceof Error ? error.message : 'Unknown error'
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
      details: error instanceof Error ? error.message : 'Unknown error'
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
 * Clear all stuck jobs for a deal - NOW ALSO STOPS RUNNING JOBS
 */
router.post('/api/deals/:dealId/clear-stuck-jobs', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    console.log(`🛑 CLEARING/STOPPING ALL JOBS for deal ${dealId}`);
    
    // Get all active jobs for this deal from storage
    const activeJobs = await storage.getBackgroundJobsByDealId(dealId);
    const processingJobs = activeJobs.filter(job => job.status === 'processing');
    
    console.log(`🔍 Found ${activeJobs.length} total jobs, ${processingJobs.length} processing jobs for deal ${dealId}`);
    
    let stoppedCount = 0;
    
    // First, update database status to cancelled
    for (const job of processingJobs) {
      try {
        // Update job status to cancelled in database
        await storage.updateBackgroundJob(job.jobId, {
          status: 'cancelled',
          currentStep: 'Stopped by user',
          completedAt: new Date(),
          updatedAt: new Date()
        });
        
        stoppedCount++;
        console.log(`🛑 Database: Cancelled job ${job.jobId} (${job.agentType})`);
      } catch (error) {
        console.error(`❌ Error updating job ${job.jobId}:`, error);
      }
    }
    
    // Then clear from memory using persistent job manager  
    const clearedFromMemory = await persistentJobManager.clearStuckJobs(dealId);
    
    console.log(`✅ Stopped ${stoppedCount} jobs in database, cleared ${clearedFromMemory} from memory for deal ${dealId}`);
    
    res.json({
      success: true,
      message: `Cleared ${stoppedCount} stuck jobs`,
      clearedCount: stoppedCount
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
 * Stop ALL jobs for a deal immediately
 */
router.post('/api/deals/:dealId/stop-all-jobs', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    console.log(`🛑 STOPPING ALL JOBS for deal ${dealId}`);
    
    // Get all active jobs for this deal from storage
    const activeJobs = await storage.getBackgroundJobs(dealId);
    const processingJobs = activeJobs.filter(job => job.status === 'processing');
    
    let stoppedCount = 0;
    
    for (const job of processingJobs) {
      try {
        // Update job status to cancelled
        await storage.updateBackgroundJob(job.jobId, {
          status: 'cancelled',
          currentStep: 'Cancelled by user',
          completedAt: new Date(),
          updatedAt: new Date()
        });
        
        stoppedCount++;
        console.log(`🛑 Stopped job: ${job.jobId} (${job.agentType})`);
      } catch (error) {
        console.error(`❌ Error stopping job ${job.jobId}:`, error);
      }
    }
    
    console.log(`✅ Stopped ${stoppedCount} jobs for deal ${dealId}`);
    
    res.json({
      success: true,
      message: `Stopped ${stoppedCount} jobs for deal ${dealId}`,
      stoppedCount
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
        const analysisService = await getAnalysisServiceForAgent(agentType);
        
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
async function getAnalysisServiceForAgent(agentType: string): Promise<any> {
  console.log(`🔧 Getting analysis service for agent: ${agentType}`);
  switch (agentType.toLowerCase()) {
    case 'legal':
      console.log(`✅ Returning legal analysis service`);
      const { comprehensiveLegalAnalysisService } = await import('../comprehensiveLegalAnalysisService.js');
      return comprehensiveLegalAnalysisService;
      
    case 'clinical':
      const { comprehensiveClinicalAnalysisService } = await import('../comprehensiveClinicalAnalysisService.js');
      return comprehensiveClinicalAnalysisService;
      
    case 'commercial':
      const { comprehensiveCommercialAnalysisService } = await import('../comprehensiveCommercialAnalysisService.js');
      return comprehensiveCommercialAnalysisService;
      
    case 'hr':
      const { comprehensiveHrAnalysisService } = await import('../comprehensiveHrAnalysisService.js');
      return comprehensiveHrAnalysisService;
      
    case 'financial':
      const { comprehensiveFinancialAnalysisService } = await import('../comprehensiveFinancialAnalysisService.js');
      return comprehensiveFinancialAnalysisService;
      
    case 'ip':
      const { comprehensiveIpAnalysisService } = await import('../comprehensiveIpAnalysisService.js');
      return comprehensiveIpAnalysisService;
      
    case 'research':
      const { comprehensiveResearchAnalysisService } = await import('../comprehensiveResearchAnalysisService.js');
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