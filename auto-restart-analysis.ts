#!/usr/bin/env tsx

/**
 * Automatic analysis restart system
 * This script will automatically start AI analysis for deals that have documents but no running jobs
 */

import { storage } from './server/storage';
import { persistentJobManager } from './server/services/persistentJobManager';

// Import analysis services
async function getAnalysisServiceForAgent(agentType: string) {
  switch (agentType.toLowerCase()) {
    case 'legal':
      const { legalAnalysisService } = await import('./server/legalAnalysisService');
      return legalAnalysisService;
    case 'clinical':
      const { clinicalAnalysisService } = await import('./server/services/clinicalAnalysisService');
      return clinicalAnalysisService;
    case 'commercial':
      const { commercialAnalysisService } = await import('./server/services/commercialAnalysisService');
      return commercialAnalysisService;
    case 'hr':
      const { hrAnalysisService } = await import('./server/services/hrAnalysisService');
      return hrAnalysisService;
    case 'financial':
      const { financialAnalysisService } = await import('./server/services/financialAnalysisService');
      return financialAnalysisService;
    case 'ip':
      const { ipAnalysisService } = await import('./server/services/ipAnalysisService');
      return ipAnalysisService;
    case 'research':
      const { researchAnalysisService } = await import('./server/services/researchAnalysisService');
      return researchAnalysisService;
    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
}

async function autoRestartAnalysis() {
  try {
    console.log('🤖 Starting automatic analysis restart system...');
    
    const dealId = 33;
    
    // Check if deal has documents
    const documents = await storage.getDocumentsByDeal(dealId);
    console.log(`📄 Found ${documents.length} documents for deal ${dealId}`);
    
    if (documents.length === 0) {
      console.log('❌ No documents found, skipping analysis restart');
      return;
    }
    
    // Check for existing running jobs
    const activeJobs = await storage.getActiveBackgroundJobsForDeal(dealId);
    console.log(`📊 Found ${activeJobs.length} active jobs for deal ${dealId}`);
    
    if (activeJobs.length > 0) {
      console.log('✅ Jobs already running, no restart needed');
      return;
    }
    
    // Start fresh analyses using the persistent job manager
    console.log('🚀 Starting fresh AI analyses...');
    
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
    
    for (const agentType of agentTypes) {
      try {
        console.log(`🔄 Starting ${agentType} analysis...`);
        
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
          error: error.message
        });
      }
    }
    
    const successCount = startedJobs.filter(job => job.status === 'started').length;
    console.log(`🎉 Auto-restart completed: ${successCount}/7 analyses started`);
    
    if (successCount > 0) {
      console.log('✅ AI processing will now continue automatically in the background');
    }
    
  } catch (error) {
    console.error('❌ Auto-restart failed:', error);
  }
}

// Run the auto-restart
autoRestartAnalysis();