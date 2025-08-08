import { persistentJobManager } from './server/services/persistentJobManager';

async function forceStopLegalAnalysis() {
  const dealId = 33;
  const jobId = 'legal_analysis_33_1754690194954';
  
  console.log('🛑 Force stopping stuck legal analysis job:', jobId);
  
  try {
    // Clear the specific job from memory
    await persistentJobManager.clearJobFromMemory(jobId);
    console.log('✅ Legal analysis job cleared from memory');
    
    // Clear all stuck jobs for this deal
    await persistentJobManager.clearStuckJobs(dealId);
    console.log('✅ All stuck jobs cleared for deal', dealId);
    
    console.log('🎯 Legal analysis completely stopped and cleared');
    
  } catch (error: any) {
    console.error('❌ Error stopping legal analysis:', error?.message || error);
  }
}

forceStopLegalAnalysis();