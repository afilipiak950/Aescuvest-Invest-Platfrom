#!/usr/bin/env tsx

// Complete System Check - Verify all analysis tabs, errors, and background processes

import fetch from 'node-fetch';

const DEAL_ID = 22;
const BASE_URL = 'http://localhost:5000';

interface SystemStatus {
  backgroundJobs: any[];
  analysisResults: Record<string, any>;
  apiEndpoints: Record<string, boolean>;
  progressEndpoints: Record<string, any>;
  errors: string[];
}

async function checkSystemHealth(): Promise<SystemStatus> {
  const status: SystemStatus = {
    backgroundJobs: [],
    analysisResults: {},
    apiEndpoints: {},
    progressEndpoints: {},
    errors: []
  };

  try {
    // 1. Check background jobs
    console.log('🔄 Checking background jobs...');
    const jobsResponse = await fetch(`${BASE_URL}/api/background-jobs/${DEAL_ID}`);
    const jobsData = await jobsResponse.json() as any;
    status.backgroundJobs = jobsData.jobs || [];
    console.log(`   Found ${status.backgroundJobs.length} active jobs`);

    // 2. Check all analysis endpoints
    console.log('📊 Checking analysis endpoints...');
    const agents = ['clinical', 'legal', 'commercial', 'hr', 'financial', 'ip', 'research'];
    
    for (const agent of agents) {
      try {
        const endpoint = `/api/deals/${DEAL_ID}/agents/${agent}/results`;
        const response = await fetch(`${BASE_URL}${endpoint}`);
        const data = await response.json() as any;
        
        status.apiEndpoints[agent] = response.ok && data.success;
        status.analysisResults[agent] = {
          hasData: !!data.analysis,
          hasAnswers: !!(data.analysis && data.analysis[`${agent}Answers`] && Object.keys(data.analysis[`${agent}Answers`]).length > 0),
          hasFindings: !!(data.analysis && data.analysis.findings && data.analysis.findings.length > 0),
          hasRecommendations: !!(data.analysis && data.analysis.recommendations && data.analysis.recommendations.length > 0),
          dataCount: data.analysis && data.analysis[`${agent}Answers`] ? Object.keys(data.analysis[`${agent}Answers`]).length : 
                    (data.analysis && data.analysis.findings ? data.analysis.findings.length : 0)
        };
        
        console.log(`   ${agent}: ${status.apiEndpoints[agent] ? '✅' : '❌'} (${status.analysisResults[agent].dataCount} items)`);
      } catch (error) {
        status.errors.push(`${agent} endpoint error: ${error}`);
        status.apiEndpoints[agent] = false;
      }
    }

    // 3. Check comprehensive analysis progress endpoints
    console.log('📈 Checking progress endpoints...');
    for (const agent of agents) {
      try {
        const progressEndpoint = `/api/deals/${DEAL_ID}/${agent}-analysis/comprehensive/progress`;
        const response = await fetch(`${BASE_URL}${progressEndpoint}`);
        const data = await response.json() as any;
        
        status.progressEndpoints[agent] = {
          accessible: response.ok,
          isRunning: data.isRunning || false,
          progress: data.progress || 0,
          currentStep: data.currentStep || null
        };
        
        if (data.isRunning) {
          console.log(`   ${agent}: 🔄 ${data.progress}% - ${data.currentStep || 'Processing...'}`);
        }
      } catch (error) {
        status.progressEndpoints[agent] = { accessible: false, error: error.toString() };
      }
    }

    // 4. Check comprehensive analysis results endpoints
    console.log('🔬 Checking comprehensive results...');
    for (const agent of agents) {
      try {
        const resultsEndpoint = `/api/deals/${DEAL_ID}/${agent}-analysis/comprehensive/results`;
        const response = await fetch(`${BASE_URL}${resultsEndpoint}`);
        const data = await response.json() as any;
        
        if (response.ok && data.success && data.analysis) {
          console.log(`   ${agent} comprehensive: ✅ Available`);
        }
      } catch (error) {
        // Comprehensive not available, which is normal for non-running analyses
      }
    }

  } catch (error) {
    status.errors.push(`System check error: ${error}`);
  }

  return status;
}

async function main() {
  console.log('🔍 COMPLETE SYSTEM CHECK');
  console.log('='.repeat(60));
  
  const status = await checkSystemHealth();
  
  console.log('\n📊 SYSTEM STATUS SUMMARY');
  console.log('='.repeat(40));
  
  // Background Jobs Summary
  console.log(`\n🔄 Background Jobs: ${status.backgroundJobs.length} active`);
  status.backgroundJobs.forEach(job => {
    console.log(`   ${job.agentType}: ${job.progress}% (${job.status})`);
  });
  
  // Analysis Results Summary
  console.log('\n📈 Analysis Results:');
  const workingAnalyses = Object.entries(status.analysisResults).filter(([_, result]) => 
    result.hasData && (result.hasAnswers || result.hasFindings)
  );
  const emptyAnalyses = Object.entries(status.analysisResults).filter(([_, result]) => !result.hasData);
  
  console.log(`   ✅ Working: ${workingAnalyses.length}/7`);
  workingAnalyses.forEach(([agent, result]) => {
    const dataType = result.hasAnswers ? 'Structured Answers' : 'Findings';
    console.log(`      ${agent}: ${dataType} (${result.dataCount} items)`);
  });
  
  console.log(`   ❌ Empty: ${emptyAnalyses.length}/7`);
  emptyAnalyses.forEach(([agent]) => {
    console.log(`      ${agent}: No data available`);
  });
  
  // Running Analyses
  const runningAnalyses = Object.entries(status.progressEndpoints).filter(([_, progress]) => 
    progress.accessible && progress.isRunning
  );
  
  if (runningAnalyses.length > 0) {
    console.log('\n🔄 Currently Running:');
    runningAnalyses.forEach(([agent, progress]) => {
      console.log(`   ${agent}: ${progress.progress}% - ${progress.currentStep || 'Processing...'}`);
    });
  }
  
  // Errors
  if (status.errors.length > 0) {
    console.log('\n❌ Errors Found:');
    status.errors.forEach(error => console.log(`   • ${error}`));
  } else {
    console.log('\n✅ No system errors detected');
  }
  
  // Final Assessment
  console.log('\n🎯 FINAL ASSESSMENT:');
  if (workingAnalyses.length >= 5 && status.errors.length === 0) {
    console.log('✅ SYSTEM IS HEALTHY - All major components working');
  } else if (workingAnalyses.length >= 3) {
    console.log('⚠️  SYSTEM PARTIALLY WORKING - Some issues detected');
  } else {
    console.log('❌ SYSTEM NEEDS ATTENTION - Major issues found');
  }
  
  console.log(`\nWorking Analyses: ${workingAnalyses.length}/7`);
  console.log(`Running Analyses: ${runningAnalyses.length}/7`);
  console.log(`System Errors: ${status.errors.length}`);
}

main().catch(console.error);