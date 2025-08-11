/**
 * FORCE INCREMENTAL SAVE TEST
 * 
 * Manually trigger the incremental save logic to see if it works
 */

import { storage } from './server/storage';
import { jobBasedEngine } from './server/services/jobBasedAnalysisEngine';

async function forceIncrementalSaveTest() {
  console.log('🧪 FORCE INCREMENTAL SAVE TEST');
  console.log('===============================');
  
  const dealId = 33;
  
  try {
    // Get current active run
    const activeRun = jobBasedEngine.getActiveRunForDeal(dealId);
    console.log(`Active run: ${activeRun}`);
    
    if (!activeRun) {
      console.log('❌ No active run found');
      return;
    }
    
    // Get progress to see exact numbers
    const progress = jobBasedEngine.getRunProgress(activeRun);
    console.log('Current progress:', JSON.stringify(progress, null, 2));
    
    if (progress && progress.agentProgress.length > 0) {
      const legalAgent = progress.agentProgress.find(a => a.agentType === 'legal');
      if (legalAgent) {
        console.log('\n🔍 LEGAL AGENT ANALYSIS');
        console.log(`Completed jobs: ${legalAgent.completedJobs}`);
        console.log(`Failed jobs: ${legalAgent.failedJobs}`);
        console.log(`Total jobs: ${legalAgent.totalJobs}`);
        console.log(`Progress: ${legalAgent.progress}%`);
        
        // Check if we should have triggered incremental saves
        const shouldHaveSaved50 = legalAgent.completedJobs >= 50;
        const shouldHaveSaved100 = legalAgent.completedJobs >= 100;
        const shouldHaveSaved150 = legalAgent.completedJobs >= 150;
        
        console.log(`\n📊 INCREMENTAL SAVE TRIGGERS`);
        console.log(`Should have saved at 50: ${shouldHaveSaved50 ? 'YES' : 'NO'}`);
        console.log(`Should have saved at 100: ${shouldHaveSaved100 ? 'YES' : 'NO'}`);
        console.log(`Should have saved at 150: ${shouldHaveSaved150 ? 'YES' : 'NO'}`);
        
        // Check modulo logic
        const mod50 = legalAgent.completedJobs % 50;
        console.log(`\n🔢 MODULO LOGIC`);
        console.log(`${legalAgent.completedJobs} % 50 = ${mod50}`);
        console.log(`Should trigger incremental save: ${mod50 === 0 && legalAgent.completedJobs > 0 ? 'YES' : 'NO'}`);
        
        if (legalAgent.completedJobs >= 150 && mod50 !== 0) {
          console.log('\n🚨 ISSUE IDENTIFIED');
          console.log('We have enough completed jobs but modulo logic is not triggering saves');
          console.log('This suggests the incremental save condition needs adjustment');
        }
      }
    }
    
    // Check database to confirm no saves
    const analyses = await storage.getAnalysesByDealId(dealId);
    console.log(`\n💾 DATABASE CHECK`);
    console.log(`Analyses in database: ${analyses.length}`);
    
    if (analyses.length === 0) {
      console.log('❌ CONFIRMED: No incremental saves have occurred');
      console.log('The save trigger logic is not working as expected');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
forceIncrementalSaveTest().then(() => {
  console.log('\n✅ Test complete');
}).catch(error => {
  console.error('❌ Test error:', error);
});