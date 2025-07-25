#!/usr/bin/env tsx

/**
 * Test IP Analysis Progress Tracking Fix
 * 
 * This script tests the enhanced IP analysis system with comprehensive error handling
 * and job completion mechanisms to prevent stuck background jobs.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const DEAL_ID = 22;
const BASE_URL = 'http://localhost:5000';

async function makeRequest(endpoint: string, method: 'GET' | 'POST' = 'GET'): Promise<any> {
  const url = `${BASE_URL}${endpoint}`;
  console.log(`📡 ${method} ${url}`);
  
  try {
    const { stdout } = await execAsync(`curl -s -X ${method} "${url}"`);
    return JSON.parse(stdout);
  } catch (error) {
    console.error(`❌ Request failed:`, error);
    return null;
  }
}

async function testIpAnalysisTracking() {
  console.log('🧪 Testing IP Analysis Progress Tracking Fix');
  console.log('=' .repeat(50));
  
  // Step 1: Check current background jobs
  console.log('\n📊 Step 1: Check current background jobs');
  const currentJobs = await makeRequest(`/api/background-jobs/${DEAL_ID}`);
  console.log('Current background jobs:', currentJobs?.jobs?.length || 0);
  
  // Step 2: Check current IP analysis status
  console.log('\n🔐 Step 2: Check current IP analysis status');
  const currentStatus = await makeRequest(`/api/deals/${DEAL_ID}/agents/ip/results`);
  console.log('IP Analysis Status:', currentStatus?.analysis?.status);
  
  // Step 3: Start new IP analysis
  console.log('\n🚀 Step 3: Starting new IP analysis');
  const startResult = await makeRequest(`/api/deals/${DEAL_ID}/ip-analysis/comprehensive`, 'POST');
  console.log('Start Result:', startResult?.success ? 'SUCCESS' : 'FAILED');
  console.log('Job ID:', startResult?.jobId);
  
  if (!startResult?.success) {
    console.log('❌ Failed to start IP analysis');
    return;
  }
  
  // Step 4: Monitor progress with enhanced logging
  console.log('\n📈 Step 4: Monitoring progress (will show enhanced logging)');
  
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    const progress = await makeRequest(`/api/deals/${DEAL_ID}/ip-analysis/comprehensive/progress`);
    const jobs = await makeRequest(`/api/background-jobs/${DEAL_ID}`);
    
    console.log(`📊 Progress Check ${i + 1}:`);
    console.log(`  - Progress: ${progress?.progress || 0}%`);
    console.log(`  - Step: ${progress?.currentStep || 'Unknown'}`);
    console.log(`  - Is Running: ${progress?.isRunning || false}`);
    console.log(`  - Background Jobs: ${jobs?.jobs?.length || 0}`);
    
    // Check if analysis completed
    if (!progress?.isRunning && progress?.progress === 0) {
      console.log('✅ Analysis completed or no longer running');
      break;
    }
    
    // Check for stuck job
    if (progress?.progress >= 100 && progress?.isRunning) {
      console.log('🚨 DETECTED: Job stuck at 100% - this should be fixed now!');
      
      // Wait a bit more to see if automatic cleanup kicks in
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const finalCheck = await makeRequest(`/api/deals/${DEAL_ID}/ip-analysis/comprehensive/progress`);
      console.log(`🔍 Final check after 5s: isRunning=${finalCheck?.isRunning}, progress=${finalCheck?.progress}%`);
      break;
    }
  }
  
  // Step 5: Final verification
  console.log('\n✅ Step 5: Final verification');
  const finalJobs = await makeRequest(`/api/background-jobs/${DEAL_ID}`);
  const finalStatus = await makeRequest(`/api/deals/${DEAL_ID}/agents/ip/results`);
  
  console.log('Final Results:');
  console.log(`  - Background Jobs: ${finalJobs?.jobs?.length || 0}`);
  console.log(`  - IP Analysis Status: ${finalStatus?.analysis?.status}`);
  console.log(`  - Has IP Results: ${!!finalStatus?.analysis?.findings}`);
  
  // Check if any IP jobs are still stuck
  const ipJobs = finalJobs?.jobs?.filter((job: any) => job.agentType === 'IP') || [];
  if (ipJobs.length > 0) {
    console.log('🚨 WARNING: Still have IP background jobs:');
    ipJobs.forEach((job: any) => {
      console.log(`  - Job ${job.jobId}: ${job.progress}% (${job.status})`);
    });
  } else {
    console.log('✅ SUCCESS: No stuck IP background jobs found!');
  }
}

// Run the test
testIpAnalysisTracking().catch(console.error);