/**
 * VERIFY INCREMENTAL SAVES
 * 
 * Check if the incremental save fix is working:
 * - Should save results every 50 completed jobs
 * - Should show analyses in database after first save
 */

import { storage } from './server/storage';

async function verifyIncrementalSaves() {
  console.log('🔍 VERIFYING INCREMENTAL SAVES');
  console.log('==============================');
  
  const dealId = 33;
  
  try {
    // Check current analyses count
    const analyses = await storage.getAnalysesByDealId(dealId);
    console.log(`📊 Current analyses in database: ${analyses.length}`);
    
    if (analyses.length > 0) {
      console.log('✅ SUCCESS: Incremental saves are working!');
      
      analyses.forEach((analysis, i) => {
        const agent = analysis.agentType;
        const answers = analysis[`${agent.toLowerCase()}_answers`] || {};
        const answerCount = Object.keys(answers).length;
        
        console.log(`  ${i + 1}. ${agent} Agent: ${answerCount} answers`);
        console.log(`     Status: ${analysis.status}`);
        console.log(`     Completed at: ${analysis.completedAt}`);
        console.log(`     Run ID: ${analysis.runId}`);
      });
      
      // Show sample answers
      if (analyses.length > 0) {
        const firstAnalysis = analyses[0];
        const agent = firstAnalysis.agentType.toLowerCase();
        const answers = firstAnalysis[`${agent}_answers`] || {};
        const firstQuestionKey = Object.keys(answers)[0];
        
        if (firstQuestionKey) {
          const firstAnswer = answers[firstQuestionKey];
          console.log('\n📝 Sample answer:');
          console.log(`Question: ${firstQuestionKey}`);
          console.log(`Answer: ${firstAnswer?.answer?.substring(0, 100)}...`);
          console.log(`Confidence: ${firstAnswer?.confidence}%`);
          console.log(`Sources: ${firstAnswer?.sources?.length || 0}`);
        }
      }
      
    } else {
      console.log('❌ ISSUE: No analyses saved yet');
      console.log('Expected: At least 1 analysis after 120+ completed jobs');
      console.log('Status: Incremental saves may still be processing or failing');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// Run every 10 seconds to track saves
async function continuousMonitoring() {
  let previousCount = 0;
  
  for (let i = 0; i < 6; i++) { // Run for 1 minute
    console.log(`\n--- Check ${i + 1}/6 ---`);
    
    try {
      const analyses = await storage.getAnalysesByDealId(33);
      const currentCount = analyses.length;
      
      if (currentCount > previousCount) {
        console.log(`🎉 NEW SAVE DETECTED! ${previousCount} → ${currentCount} analyses`);
        previousCount = currentCount;
        
        // Show the new analysis
        const newAnalysis = analyses[currentCount - 1];
        const agent = newAnalysis.agentType;
        const answers = newAnalysis[`${agent.toLowerCase()}_answers`] || {};
        console.log(`New analysis: ${agent} with ${Object.keys(answers).length} answers`);
      } else if (currentCount === 0) {
        console.log(`⏳ Still waiting... (${currentCount} analyses)`);
      } else {
        console.log(`✅ Stable: ${currentCount} analyses saved`);
      }
      
    } catch (error) {
      console.error('Monitor error:', error);
    }
    
    if (i < 5) await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
  }
}

// Run verification
verifyIncrementalSaves()
  .then(() => continuousMonitoring())
  .then(() => console.log('\n✅ Monitoring complete'))
  .catch(error => console.error('❌ Error:', error));