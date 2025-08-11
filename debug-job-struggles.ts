/**
 * DEEP JOB STRUGGLE DIAGNOSIS
 * 
 * Investigate where the job processing is struggling:
 * - Legal agent showing 0% progress despite 11-12 completed jobs
 * - Jobs seem to be running but progress not reflecting properly
 * - Need to check job queue health and progress calculation
 */

import { storage } from './server/storage';
import { jobBasedEngine } from './server/services/jobBasedAnalysisEngine';

async function diagnoseJobStruggles() {
  console.log('🔍 DEEP JOB STRUGGLE DIAGNOSIS');
  console.log('=====================================');
  
  const dealId = 33;
  
  try {
    // 1. Check current job queue status
    console.log('\n📊 1. CURRENT JOB QUEUE STATUS');
    const activeRun = jobBasedEngine.getActiveRunForDeal(dealId);
    console.log(`Active run ID: ${activeRun}`);
    
    if (activeRun) {
      const progress = jobBasedEngine.getRunProgress(activeRun);
      console.log('Current progress:', JSON.stringify(progress, null, 2));
    }
    
    // 2. Check queue metrics directly
    console.log('\n📈 2. QUEUE METRICS');
    const metrics = await jobBasedEngine.getQueueMetrics();
    console.log('Queue metrics:', JSON.stringify(metrics, null, 2));
    
    // 3. Check job details for legal agent
    console.log('\n⚖️ 3. LEGAL AGENT JOB DETAILS');
    if (activeRun) {
      const runDetails = jobBasedEngine.getRunDetails(activeRun);
      console.log('Run details:', JSON.stringify(runDetails, null, 2));
      
      // Check specific legal agent progress
      const legalProgress = progress?.agentProgress?.find(a => a.agentType === 'legal');
      if (legalProgress) {
        console.log('\nLegal agent specific details:');
        console.log(`- Assigned docs: ${legalProgress.assignedDocs}`);
        console.log(`- Questions: ${legalProgress.questionsCount}`);
        console.log(`- Total jobs: ${legalProgress.totalJobs}`);
        console.log(`- Completed: ${legalProgress.completedJobs}`);
        console.log(`- Failed: ${legalProgress.failedJobs}`);
        console.log(`- Progress: ${legalProgress.progress}%`);
        console.log(`- Status: ${legalProgress.status}`);
        
        // Calculate expected progress
        const expectedProgress = Math.round((legalProgress.completedJobs / legalProgress.totalJobs) * 100);
        console.log(`- Expected progress: ${expectedProgress}%`);
        console.log(`- Actual progress: ${legalProgress.progress}%`);
        console.log(`- Progress discrepancy: ${expectedProgress !== legalProgress.progress ? 'YES' : 'NO'}`);
      }
    }
    
    // 4. Check for stuck jobs
    console.log('\n🔄 4. STUCK JOB ANALYSIS');
    const now = Date.now();
    const runStartTime = activeRun ? jobBasedEngine.getRunStartTime(activeRun) : null;
    if (runStartTime) {
      const runDuration = now - runStartTime;
      console.log(`Run duration: ${Math.round(runDuration / 1000)}s`);
      console.log(`Expected job completion rate: ~1 job per 3-5 seconds`);
      
      if (progress) {
        const totalCompleted = progress.agentProgress.reduce((sum, agent) => sum + agent.completedJobs, 0);
        const totalJobs = progress.agentProgress.reduce((sum, agent) => sum + agent.totalJobs, 0);
        const averageJobTime = runDuration / totalCompleted;
        console.log(`Total completed jobs: ${totalCompleted}/${totalJobs}`);
        console.log(`Average job time: ${Math.round(averageJobTime)}ms`);
        
        if (averageJobTime > 10000) {
          console.log('⚠️ ISSUE: Jobs taking too long (>10s each)');
        }
      }
    }
    
    // 5. Check for OpenAI API issues
    console.log('\n🤖 5. OPENAI API HEALTH CHECK');
    const recentErrors = jobBasedEngine.getRecentErrors();
    if (recentErrors && recentErrors.length > 0) {
      console.log('Recent errors found:');
      recentErrors.slice(0, 5).forEach((error, i) => {
        console.log(`  ${i + 1}. ${error.message} (${error.timestamp})`);
      });
    } else {
      console.log('No recent errors found');
    }
    
    // 6. Check database performance
    console.log('\n💾 6. DATABASE PERFORMANCE CHECK');
    const dbStart = Date.now();
    const documents = await storage.getDocumentsByDealId(dealId);
    const dbTime = Date.now() - dbStart;
    console.log(`Document query time: ${dbTime}ms for ${documents.length} documents`);
    
    if (dbTime > 1000) {
      console.log('⚠️ ISSUE: Database queries are slow (>1s)');
    }
    
    // 7. Check memory usage
    console.log('\n🧠 7. MEMORY USAGE');
    const memUsage = process.memoryUsage();
    console.log(`Memory usage:`);
    console.log(`  RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);
    console.log(`  Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    console.log(`  Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
    console.log(`  External: ${Math.round(memUsage.external / 1024 / 1024)}MB`);
    
    if (memUsage.heapUsed > 512 * 1024 * 1024) {
      console.log('⚠️ ISSUE: High memory usage (>512MB)');
    }
    
    // 8. Recommendations
    console.log('\n💡 8. DIAGNOSTIC SUMMARY & RECOMMENDATIONS');
    console.log('=====================================');
    
    if (activeRun && progress) {
      const legalAgent = progress.agentProgress.find(a => a.agentType === 'legal');
      if (legalAgent) {
        if (legalAgent.completedJobs > 0 && legalAgent.progress === 0) {
          console.log('🚨 CRITICAL ISSUE: Progress calculation bug');
          console.log('   - Jobs are completing but progress shows 0%');
          console.log('   - Fix: Update progress calculation logic in jobBasedAnalysisEngine');
        }
        
        if (legalAgent.status === 'processing' && legalAgent.completedJobs < 20) {
          console.log('🐌 PERFORMANCE ISSUE: Slow job processing');
          console.log('   - Jobs completing slowly (should be ~20+ by now)');
          console.log('   - Check: OpenAI API rate limits, database performance, memory leaks');
        }
        
        if (legalAgent.failedJobs > 0) {
          console.log('❌ ERROR ISSUE: Failed jobs detected');
          console.log(`   - ${legalAgent.failedJobs} jobs have failed`);
          console.log('   - Check: Error logs, API key validity, network connectivity');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
  }
}

// Run the diagnosis
diagnoseJobStruggles().then(() => {
  console.log('\n✅ Diagnosis complete');
}).catch(error => {
  console.error('❌ Diagnosis error:', error);
});