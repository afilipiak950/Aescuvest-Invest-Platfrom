#!/usr/bin/env tsx

// Frontend Display Test - Check all analysis tabs for display issues

import fetch from 'node-fetch';

const DEAL_ID = 22;
const BASE_URL = 'http://localhost:5000';

interface TabTestResult {
  agent: string;
  endpoint: string;
  success: boolean;
  hasData: boolean;
  dataType: string;
  displayIssues: string[];
  recommendations: string[];
}

async function testTabDisplay(agent: string): Promise<TabTestResult> {
  const endpoint = `/api/deals/${DEAL_ID}/agents/${agent.toLowerCase()}/results`;
  const result: TabTestResult = {
    agent,
    endpoint,
    success: false,
    hasData: false,
    dataType: 'none',
    displayIssues: [],
    recommendations: []
  };

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`);
    const data = await response.json() as any;
    
    result.success = response.ok && data.success;
    
    if (data.analysis) {
      const analysis = data.analysis;
      result.hasData = true;
      
      // Check data structure for each agent type
      if (agent === 'Clinical') {
        if (analysis.clinicalAnswers) {
          result.dataType = 'structured_answers';
          const answerCount = Object.keys(analysis.clinicalAnswers).length;
          if (answerCount === 0) {
            result.displayIssues.push('No clinical answers found');
          }
        } else if (analysis.findings) {
          result.dataType = 'findings_only';
          result.recommendations.push('Should display findings as fallback for clinical questions');
        } else {
          result.displayIssues.push('No clinical data structure found');
        }
      } else if (agent === 'Legal') {
        if (analysis.legalAnswers) {
          result.dataType = 'structured_answers';
        } else {
          result.displayIssues.push('Legal analysis not yet complete');
        }
      } else if (agent === 'Commercial') {
        if (analysis.commercialAnswers) {
          result.dataType = 'structured_answers';
          const answerCount = Object.keys(analysis.commercialAnswers).length;
          if (answerCount < 5) {
            result.displayIssues.push(`Only ${answerCount} commercial answers available`);
          }
        } else {
          result.displayIssues.push('No commercial answers structure');
        }
      } else if (agent === 'HR') {
        if (analysis.hrAnswers) {
          result.dataType = 'structured_answers';
          const answerCount = Object.keys(analysis.hrAnswers).length;
          if (answerCount < 10) {
            result.displayIssues.push(`Only ${answerCount} HR answers available`);
          }
        } else {
          result.displayIssues.push('No HR answers structure');
        }
      } else if (agent === 'Financial') {
        if (analysis.financialAnswers) {
          result.dataType = 'structured_answers';
        } else {
          result.displayIssues.push('Financial analysis not yet complete');
        }
      } else if (agent === 'IP') {
        if (analysis.ipAnswers) {
          result.dataType = 'structured_answers';
        } else if (analysis.findings) {
          result.dataType = 'findings_only';
          result.recommendations.push('Should display IP findings properly');
        } else {
          result.displayIssues.push('No IP data structure found');
        }
      } else if (agent === 'Research') {
        if (analysis.researchAnswers) {
          result.dataType = 'structured_answers';
          const answerCount = Object.keys(analysis.researchAnswers).length;
          if (answerCount < 8) {
            result.displayIssues.push(`Only ${answerCount} research answers available`);
          }
        } else {
          result.displayIssues.push('No research answers structure');
        }
      }
      
      // General data quality checks
      if (analysis.findings && analysis.findings.length === 0) {
        result.displayIssues.push('Empty findings array');
      }
      if (analysis.recommendations && analysis.recommendations.length === 0) {
        result.displayIssues.push('Empty recommendations array');
      }
      
    } else {
      result.displayIssues.push('No analysis object in response');
    }
    
  } catch (error) {
    result.displayIssues.push(`Network error: ${error}`);
  }

  return result;
}

async function main() {
  console.log('🖥️  Testing Frontend Display for All Analysis Tabs');
  console.log('='.repeat(60));
  
  const agents = ['Clinical', 'Legal', 'Commercial', 'HR', 'Financial', 'IP', 'Research'];
  const results: TabTestResult[] = [];
  
  for (const agent of agents) {
    const result = await testTabDisplay(agent);
    results.push(result);
    
    const status = result.success && result.hasData && result.displayIssues.length === 0 ? '✅' : '⚠️';
    console.log(`${status} ${agent} Tab:`);
    console.log(`   Success: ${result.success}`);
    console.log(`   Has Data: ${result.hasData}`);
    console.log(`   Data Type: ${result.dataType}`);
    
    if (result.displayIssues.length > 0) {
      console.log(`   Issues:`);
      result.displayIssues.forEach(issue => console.log(`     • ${issue}`));
    }
    
    if (result.recommendations.length > 0) {
      console.log(`   Recommendations:`);
      result.recommendations.forEach(rec => console.log(`     ⚡ ${rec}`));
    }
    console.log('');
  }
  
  // Summary
  const workingTabs = results.filter(r => r.success && r.hasData && r.displayIssues.length === 0);
  const tabsWithIssues = results.filter(r => r.displayIssues.length > 0);
  
  console.log('📊 DISPLAY STATUS SUMMARY:');
  console.log(`✅ Perfect Tabs: ${workingTabs.length}/7 (${workingTabs.map(t => t.agent).join(', ')})`);
  console.log(`⚠️  Tabs with Issues: ${tabsWithIssues.length}/7 (${tabsWithIssues.map(t => t.agent).join(', ')})`);
  
  if (tabsWithIssues.length > 0) {
    console.log('\n🔧 Required Fixes:');
    tabsWithIssues.forEach(tab => {
      if (tab.displayIssues.length > 0) {
        console.log(`   ${tab.agent}: ${tab.displayIssues.join(', ')}`);
      }
    });
  }
}

main().catch(console.error);