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
      // HR analysis service (to be implemented)
      return createGenericAnalysisService('HR', [
        'Analyzing employment contracts',
        'Reviewing compensation structures',
        'Assessing organizational hierarchy',
        'Evaluating HR policies'
      ]);
      
    case 'financial':
      // Financial analysis service (to be implemented)  
      return createGenericAnalysisService('Financial', [
        'Analyzing financial statements',
        'Reviewing revenue models',
        'Assessing financial projections',
        'Evaluating accounting practices'
      ]);
      
    case 'ip':
      // IP analysis service (to be implemented)
      return createGenericAnalysisService('IP', [
        'Analyzing patent portfolios',
        'Reviewing IP assignments',
        'Assessing trademark protections',
        'Evaluating technology licensing'
      ]);
      
    case 'research':
      // Research analysis service (to be implemented)
      return createGenericAnalysisService('Research', [
        'Conducting market research',
        'Analyzing technical whitepapers',
        'Reviewing research reports',
        'Assessing technology trends'
      ]);
      
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