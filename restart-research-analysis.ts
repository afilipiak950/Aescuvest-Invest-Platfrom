import { persistentJobManager } from './server/services/persistentJobManager';
import { comprehensiveResearchAnalysisService } from './server/comprehensiveResearchAnalysisService';

async function restartResearchAnalysis() {
  const dealId = 33;
  
  console.log('🔬 Starting new Research analysis for deal', dealId);
  
  try {
    // Clear any stuck jobs first
    await persistentJobManager.clearStuckJobs(dealId);
    
    // Start research analysis with improved fallback method using the persistent job manager
    const jobId = await persistentJobManager.startAnalysisJob(
      dealId,
      'Research',
      comprehensiveResearchAnalysisService
    );
    
    console.log(`✅ Research analysis started successfully with job ID: ${jobId}`);
    console.log('📊 Analysis will now use improved content-based answers instead of generic templates');
    
  } catch (error: any) {
    console.error('❌ Error starting research analysis:', error?.message || error);
  }
}

restartResearchAnalysis();