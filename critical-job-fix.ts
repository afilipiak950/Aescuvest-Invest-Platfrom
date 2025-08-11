/**
 * CRITICAL JOB PROCESSING FIX
 * 
 * Issues identified:
 * 1. Progress shows 1% despite 25 completed jobs (should be ~1.4%)
 * 2. 18 failed jobs need investigation 
 * 3. Database queries taking 500-700ms per job (too slow)
 * 4. Jobs not persisting results to database
 */

import { storage } from './server/storage';
import { jobBasedEngine } from './server/services/jobBasedAnalysisEngine';

async function criticalJobFix() {
  console.log('🚨 CRITICAL JOB PROCESSING FIX');
  console.log('================================');
  
  const dealId = 33;
  
  try {
    // 1. Check current run status
    console.log('\n1. CURRENT RUN STATUS');
    const activeRun = jobBasedEngine.getActiveRunForDeal(dealId);
    console.log(`Active run: ${activeRun}`);
    
    if (activeRun) {
      const progress = jobBasedEngine.getRunProgress(activeRun);
      console.log('Progress details:', JSON.stringify(progress, null, 2));
      
      const legalAgent = progress?.agentProgress?.find(a => a.agentType === 'legal');
      if (legalAgent) {
        console.log('\n2. LEGAL AGENT ANALYSIS');
        console.log(`Completed: ${legalAgent.completedJobs}/${legalAgent.totalJobs}`);
        console.log(`Failed: ${legalAgent.failedJobs}`);
        console.log(`Expected progress: ${Math.round((legalAgent.completedJobs / legalAgent.totalJobs) * 100)}%`);
        console.log(`Actual progress: ${legalAgent.progress}%`);
        
        // Calculate success rate
        const totalProcessed = legalAgent.completedJobs + legalAgent.failedJobs;
        const successRate = totalProcessed > 0 ? (legalAgent.completedJobs / totalProcessed * 100) : 0;
        console.log(`Success rate: ${successRate.toFixed(1)}%`);
        
        if (legalAgent.failedJobs > 0) {
          console.log('\n❌ FAILED JOBS DETECTED');
          console.log(`${legalAgent.failedJobs} jobs have failed - this is blocking progress`);
        }
      }
    }
    
    // 2. Check if results are being saved
    console.log('\n3. DATABASE RESULT CHECK');
    const analyses = await storage.getAnalysesByDealId(dealId);
    console.log(`Analyses in database: ${analyses.length}`);
    
    if (analyses.length === 0) {
      console.log('❌ CRITICAL ISSUE: No analyses being saved to database');
      console.log('Jobs are running but results are not persisting');
    }
    
    // 3. Performance test - single document query
    console.log('\n4. DATABASE PERFORMANCE TEST');
    const perfStart = Date.now();
    const documents = await storage.getDocumentsByDealId(dealId);
    const perfTime = Date.now() - perfStart;
    console.log(`Document query: ${perfTime}ms for ${documents.length} documents`);
    
    if (perfTime > 500) {
      console.log('⚠️ Database performance issue - queries too slow');
    }
    
    // 4. Check document OCR content
    console.log('\n5. OCR CONTENT CHECK');
    const docsWithOcr = documents.filter(d => d.ocrText && d.ocrText.length > 0);
    console.log(`Documents with OCR: ${docsWithOcr.length}/${documents.length}`);
    
    if (docsWithOcr.length < documents.length * 0.7) {
      console.log('⚠️ Many documents missing OCR content');
    }
    
    // 5. Recommend fixes
    console.log('\n6. RECOMMENDED FIXES');
    console.log('==================');
    
    if (activeRun && progress) {
      const legalAgent = progress.agentProgress.find(a => a.agentType === 'legal');
      
      if (legalAgent && legalAgent.failedJobs > 0) {
        console.log('🔧 FIX 1: Address failed jobs');
        console.log('   - Check OpenAI API key validity');
        console.log('   - Add retry mechanism for failed jobs');
        console.log('   - Implement better error handling');
      }
      
      if (analyses.length === 0) {
        console.log('🔧 FIX 2: Fix result persistence');
        console.log('   - Check storage.createAnalysis function');
        console.log('   - Ensure job results are saved after OpenAI response');
        console.log('   - Add transaction handling for database writes');
      }
      
      if (perfTime > 500) {
        console.log('🔧 FIX 3: Optimize database queries');
        console.log('   - Cache document data between jobs');
        console.log('   - Use bulk queries instead of per-job queries');
        console.log('   - Add database indexing');
      }
      
      const expectedProgress = Math.round((legalAgent.completedJobs / legalAgent.totalJobs) * 100);
      if (legalAgent.progress !== expectedProgress) {
        console.log('🔧 FIX 4: Fix progress calculation');
        console.log(`   - Progress should be ${expectedProgress}% not ${legalAgent.progress}%`);
        console.log('   - Update runTracker progress calculation logic');
      }
    }
    
  } catch (error) {
    console.error('❌ Critical fix analysis failed:', error);
  }
}

// Run the fix analysis
criticalJobFix().then(() => {
  console.log('\n✅ Critical fix analysis complete');
}).catch(error => {
  console.error('❌ Fix analysis error:', error);
});