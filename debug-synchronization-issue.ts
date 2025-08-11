/**
 * DEBUG SYNCHRONIZATION ISSUE
 * 
 * Check the API endpoints to understand why there's a disconnect
 * between visible progress and saved results
 */

async function debugSynchronizationIssue() {
  console.log('🔍 DEBUGGING SYNCHRONIZATION ISSUE');
  console.log('==================================');
  
  const dealId = 33;
  
  try {
    // Test the actual API endpoint being used by the frontend
    const response = await fetch(`http://localhost:5000/api/analysis/deal-progress/${dealId}`);
    const progressData = await response.json();
    
    console.log('📊 PROGRESS API RESPONSE:');
    console.log(JSON.stringify(progressData, null, 2));
    
    if (progressData.success && progressData.progress) {
      const progress = progressData.progress;
      const legalAgent = progress.agentProgress.find(a => a.agentType === 'legal');
      
      if (legalAgent) {
        console.log('\n🔍 LEGAL AGENT STATUS:');
        console.log(`Completed: ${legalAgent.completedJobs}`);
        console.log(`Failed: ${legalAgent.failedJobs}`);
        console.log(`Total: ${legalAgent.totalJobs}`);
        console.log(`Status: ${legalAgent.status}`);
        
        // Check modulo for incremental saves
        const completedJobs = legalAgent.completedJobs;
        const mod50 = completedJobs % 50;
        const shouldSave = (completedJobs > 0 && mod50 === 0);
        
        console.log('\n🧮 INCREMENTAL SAVE LOGIC:');
        console.log(`Completed jobs: ${completedJobs}`);
        console.log(`${completedJobs} % 50 = ${mod50}`);
        console.log(`Should trigger save: ${shouldSave ? 'YES' : 'NO'}`);
        
        if (completedJobs >= 150 && !shouldSave) {
          console.log('\n⚠️  POTENTIAL ISSUE:');
          console.log('Jobs have passed multiple save thresholds but modulo is not 0');
          console.log('This suggests saves are only triggered at exact multiples of 50');
          
          // Calculate when next save will trigger
          const nextSaveAt = Math.ceil(completedJobs / 50) * 50;
          console.log(`Next save will trigger at: ${nextSaveAt} completed jobs`);
          console.log(`Jobs remaining until save: ${nextSaveAt - completedJobs}`);
        }
      }
    }
    
    // Also check the analyses endpoint
    const analysesResponse = await fetch(`http://localhost:5000/api/analyses/${dealId}`);
    const analyses = await analysesResponse.json();
    
    console.log('\n💾 CURRENT ANALYSES IN DATABASE:');
    console.log(`Count: ${analyses.length}`);
    
    if (analyses.length === 0) {
      console.log('❌ CONFIRMED: No incremental saves have occurred yet');
    } else {
      console.log('✅ Analyses found:');
      analyses.forEach((analysis, i) => {
        console.log(`  ${i + 1}. ${analysis.agentType}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
debugSynchronizationIssue().then(() => {
  console.log('\n✅ Debug complete');
}).catch(error => {
  console.error('❌ Debug error:', error);
});