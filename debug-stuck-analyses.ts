#!/usr/bin/env tsx

// Debug why Legal and Financial analyses are stuck and not progressing

import fetch from 'node-fetch';

const DEAL_ID = 22;
const BASE_URL = 'http://localhost:5000';

async function debugStuckAnalyses() {
  console.log('🔍 DEBUGGING STUCK ANALYSES');
  console.log('='.repeat(50));
  
  // Check background jobs
  console.log('\n1. Background Jobs Status:');
  const jobsResponse = await fetch(`${BASE_URL}/api/background-jobs/${DEAL_ID}`);
  const jobsData = await jobsResponse.json() as any;
  
  if (jobsData.jobs) {
    jobsData.jobs.forEach((job: any) => {
      console.log(`   ${job.agentType}:`);
      console.log(`     Progress: ${job.progress}%`);
      console.log(`     Status: ${job.status}`);
      console.log(`     Start Time: ${job.metadata?.startTime}`);
      console.log(`     Last Update: ${job.metadata?.lastUpdate}`);
      
      // Calculate time since last update
      if (job.metadata?.lastUpdate) {
        const lastUpdate = new Date(job.metadata.lastUpdate);
        const now = new Date();
        const minutesStuck = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60));
        console.log(`     Minutes Stuck: ${minutesStuck}`);
        
        if (minutesStuck > 5) {
          console.log(`     ⚠️  STUCK - No progress for ${minutesStuck} minutes`);
        }
      }
      console.log('');
    });
  }
  
  // Test if services are responding
  console.log('2. Service Health Check:');
  
  try {
    // Test Legal progress endpoint
    const legalProgress = await fetch(`${BASE_URL}/api/deals/${DEAL_ID}/legal-analysis/comprehensive/progress`);
    const legalData = await legalProgress.json() as any;
    console.log(`   Legal Progress API: ${legalProgress.status} - Running: ${legalData.isRunning}`);
  } catch (error) {
    console.log(`   Legal Progress API: ERROR - ${error}`);
  }
  
  try {
    // Test Financial progress endpoint
    const financialProgress = await fetch(`${BASE_URL}/api/deals/${DEAL_ID}/financial-analysis/comprehensive/progress`);
    const financialData = await financialProgress.json() as any;
    console.log(`   Financial Progress API: ${financialProgress.status} - Running: ${financialData.isRunning}`);
  } catch (error) {
    console.log(`   Financial Progress API: ERROR - ${error}`);
  }
  
  // Check if we can restart the analyses
  console.log('\n3. Attempting to Clear Stuck Jobs and Restart:');
  
  try {
    const clearResponse = await fetch(`${BASE_URL}/api/background-jobs/clear-stuck`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId: DEAL_ID })
    });
    const clearData = await clearResponse.json() as any;
    console.log(`   Clear Stuck Jobs: ${clearResponse.status} - ${clearData.message}`);
    console.log(`   Cleared Jobs: ${clearData.clearedJobs || 0}`);
  } catch (error) {
    console.log(`   Clear Stuck Jobs: ERROR - ${error}`);
  }
  
  // Wait a moment then restart
  console.log('\n4. Restarting Analyses:');
  
  try {
    const legalRestart = await fetch(`${BASE_URL}/api/deals/${DEAL_ID}/legal-analysis/comprehensive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const legalRestartData = await legalRestart.json() as any;
    console.log(`   Legal Restart: ${legalRestart.status} - ${legalRestartData.message}`);
  } catch (error) {
    console.log(`   Legal Restart: ERROR - ${error}`);
  }
  
  try {
    const financialRestart = await fetch(`${BASE_URL}/api/deals/${DEAL_ID}/financial-analysis/comprehensive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const financialRestartData = await financialRestart.json() as any;
    console.log(`   Financial Restart: ${financialRestart.status} - ${financialRestartData.message}`);
  } catch (error) {
    console.log(`   Financial Restart: ERROR - ${error}`);
  }
  
  // Check new status
  console.log('\n5. New Status After Restart:');
  setTimeout(async () => {
    try {
      const newJobsResponse = await fetch(`${BASE_URL}/api/background-jobs/${DEAL_ID}`);
      const newJobsData = await newJobsResponse.json() as any;
      
      if (newJobsData.jobs) {
        newJobsData.jobs.forEach((job: any) => {
          console.log(`   ${job.agentType}: ${job.progress}% (${job.status})`);
        });
      } else {
        console.log('   No active jobs found');
      }
    } catch (error) {
      console.log(`   Status check failed: ${error}`);
    }
  }, 3000);
}

debugStuckAnalyses().catch(console.error);