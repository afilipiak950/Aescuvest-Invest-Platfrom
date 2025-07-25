#!/usr/bin/env tsx

// Monitor the progress of Legal and Financial analyses to ensure they complete

import fetch from 'node-fetch';

const DEAL_ID = 22;
const BASE_URL = 'http://localhost:5000';

async function monitorProgress() {
  console.log('📊 MONITORING ANALYSIS PROGRESS');
  console.log('='.repeat(50));
  
  const startTime = Date.now();
  let iterations = 0;
  const maxIterations = 20; // Monitor for up to 10 minutes (30s intervals)
  
  while (iterations < maxIterations) {
    iterations++;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    
    try {
      const response = await fetch(`${BASE_URL}/api/background-jobs/${DEAL_ID}`);
      const data = await response.json() as any;
      
      console.log(`\n⏰ Check ${iterations} (${elapsed}s elapsed):`);
      
      if (!data.jobs || data.jobs.length === 0) {
        console.log('✅ All analyses completed! No background jobs running.');
        break;
      }
      
      let allCompleted = true;
      data.jobs.forEach((job: any) => {
        console.log(`   ${job.agentType}: ${job.progress}% (${job.status})`);
        if (job.status === 'processing' && job.progress < 100) {
          allCompleted = false;
        }
      });
      
      if (allCompleted) {
        console.log('✅ All analyses completed!');
        break;
      }
      
      // Wait 30 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 30000));
      
    } catch (error) {
      console.log(`❌ Error checking progress: ${error}`);
      break;
    }
  }
  
  // Final verification
  console.log('\n🔍 FINAL VERIFICATION:');
  
  const agents = ['legal', 'financial'];
  for (const agent of agents) {
    try {
      const response = await fetch(`${BASE_URL}/api/deals/${DEAL_ID}/agents/${agent}/results`);
      const data = await response.json() as any;
      
      if (data.success && data.analysis) {
        const answerField = `${agent}Answers`;
        if (data.analysis[answerField] && Object.keys(data.analysis[answerField]).length > 0) {
          console.log(`✅ ${agent.charAt(0).toUpperCase() + agent.slice(1)}: Analysis completed with ${Object.keys(data.analysis[answerField]).length} answers`);
        } else if (data.analysis.findings && data.analysis.findings.length > 0) {
          console.log(`✅ ${agent.charAt(0).toUpperCase() + agent.slice(1)}: Analysis completed with ${data.analysis.findings.length} findings`);
        } else {
          console.log(`⚪ ${agent.charAt(0).toUpperCase() + agent.slice(1)}: Analysis data structure unclear`);
        }
      } else {
        console.log(`❌ ${agent.charAt(0).toUpperCase() + agent.slice(1)}: No analysis data available`);
      }
    } catch (error) {
      console.log(`❌ ${agent.charAt(0).toUpperCase() + agent.slice(1)}: Error checking results - ${error}`);
    }
  }
}

monitorProgress().catch(console.error);