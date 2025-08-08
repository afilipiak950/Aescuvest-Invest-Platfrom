import { persistentJobManager } from './server/services/persistentJobManager';

async function stopAllJobs() {
  const dealId = 33;
  
  console.log('🛑 Stopping all background jobs for deal', dealId);
  
  try {
    // Clear all jobs for this deal
    await persistentJobManager.clearStuckJobs(dealId);
    console.log('✅ All jobs cleared successfully');
    
    // Force stop all background processes
    process.exit(0);
    
  } catch (error: any) {
    console.error('❌ Error stopping jobs:', error?.message || error);
    process.exit(1);
  }
}

stopAllJobs();