#!/usr/bin/env tsx

/**
 * Emergency fix for stuck AI processing jobs
 * This script will:
 * 1. Identify stuck jobs (older than 5 minutes with no progress)
 * 2. Cancel stuck jobs
 * 3. Restart fresh AI analysis for Deal 33
 */

import { storage } from './server/storage';

async function fixStuckJobs() {
  try {
    console.log('🔄 Starting stuck job recovery...');
    
    const dealId = 33;
    
    // 1. Get current stuck jobs
    const stuckJobs = await storage.getActiveBackgroundJobsForDeal(dealId);
    console.log(`📊 Found ${stuckJobs.length} active jobs for deal ${dealId}`);
    
    // 2. Cancel all stuck jobs
    for (const job of stuckJobs) {
      console.log(`❌ Cancelling stuck job: ${job.jobId} (${job.agentType})`);
      await storage.failBackgroundJob(job.jobId, 'Job stuck - manually cancelled for restart');
    }
    
    // 3. Start fresh analysis using the persistent analysis system
    console.log('🚀 Starting fresh AI analysis...');
    
    const response = await fetch('http://localhost:5000/api/deals/33/start-all-analyses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Fresh analysis started:', result);
    } else {
      const error = await response.text();
      console.error('❌ Failed to start fresh analysis:', error);
    }
    
    console.log('🎉 Stuck job recovery completed!');
    
  } catch (error) {
    console.error('❌ Recovery failed:', error);
  }
}

// Run the fix
fixStuckJobs();