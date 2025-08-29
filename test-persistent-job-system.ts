/**
 * Test script to verify persistent job manager functionality
 */

import { storage } from './server/storage';
import { persistentJobManager } from './server/PersistentJobManager';

async function testPersistentJobSystem() {
  console.log('🧪 Testing Persistent Job Manager System');
  console.log('=====================================');
  
  try {
    // Test 1: Initialize persistent job manager
    console.log('\n1. Initializing persistent job manager...');
    await persistentJobManager.initialize();
    console.log('✅ Persistent job manager initialized');
    
    // Test 2: Check existing background jobs
    console.log('\n2. Checking existing background jobs...');
    const runningJobs = await storage.getRunningBackgroundJobs();
    console.log(`📊 Found ${runningJobs.length} running background jobs`);
    
    for (const job of runningJobs) {
      console.log(`  - Job ${job.jobId}: ${job.agentType} (${job.progress}%)`);
    }
    
    // Test 3: Test job status retrieval
    console.log('\n3. Testing job status retrieval...');
    const activeJobsStatus = persistentJobManager.getActiveJobsStatus();
    console.log(`📋 Active jobs in manager: ${activeJobsStatus.length}`);
    
    // Test 4: Check database connection
    console.log('\n4. Testing database connection...');
    const testDeals = await storage.getAllDeals();
    console.log(`📁 Found ${testDeals.length} deals in database`);
    
    // Test 5: Test clearing stuck jobs for a specific deal
    if (testDeals.length > 0) {
      const testDealId = testDeals[0].id;
      console.log(`\n5. Testing stuck job clearing for deal ${testDealId}...`);
      
      const clearedCount = await persistentJobManager.clearStuckJobs(testDealId);
      console.log(`🧹 Cleared ${clearedCount} stuck jobs for deal ${testDealId}`);
    }
    
    // Test 6: Test job manager health check
    console.log('\n6. Running job manager health check...');
    const healthCheck = await persistentJobManager.performHealthCheck();
    console.log('💚 Health check results:', healthCheck);
    
    console.log('\n✅ All persistent job system tests passed!');
    console.log('🚀 System is ready for integration with EnhancedAgentCard');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
testPersistentJobSystem()
  .then(() => {
    console.log('\n🎉 Persistent job system testing completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Testing failed:', error);
    process.exit(1);
  });