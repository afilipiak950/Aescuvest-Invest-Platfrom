#!/usr/bin/env tsx

// Final comprehensive test to verify all analysis tabs are working properly

import fetch from 'node-fetch';

const DEAL_ID = 22;
const BASE_URL = 'http://localhost:5000';

interface TabStatus {
  agent: string;
  working: boolean;
  hasStructuredData: boolean;
  hasFindings: boolean;
  dataCount: number;
  issues: string[];
}

async function checkTabStatus(agent: string): Promise<TabStatus> {
  const result: TabStatus = {
    agent,
    working: false,
    hasStructuredData: false,
    hasFindings: false,
    dataCount: 0,
    issues: []
  };

  try {
    const response = await fetch(`${BASE_URL}/api/deals/${DEAL_ID}/agents/${agent.toLowerCase()}/results`);
    const data = await response.json() as any;
    
    if (!response.ok || !data.success) {
      result.issues.push('API request failed');
      return result;
    }

    if (!data.analysis) {
      result.issues.push('No analysis data available');
      return result;
    }

    const analysis = data.analysis;
    
    // Check for structured answers
    const answerField = `${agent.toLowerCase()}Answers`;
    if (analysis[answerField] && typeof analysis[answerField] === 'object') {
      const answerCount = Object.keys(analysis[answerField]).length;
      if (answerCount > 0) {
        result.hasStructuredData = true;
        result.dataCount = answerCount;
      }
    }
    
    // Check for findings
    if (analysis.findings && Array.isArray(analysis.findings) && analysis.findings.length > 0) {
      result.hasFindings = true;
      if (!result.hasStructuredData) {
        result.dataCount = analysis.findings.length;
      }
    }
    
    result.working = result.hasStructuredData || result.hasFindings;
    
    if (!result.working) {
      result.issues.push('No usable data structure found');
    }
    
  } catch (error) {
    result.issues.push(`Error: ${error}`);
  }

  return result;
}

async function main() {
  console.log('🔍 Final Analysis Tab Verification');
  console.log('='.repeat(50));
  
  const agents = ['Clinical', 'Legal', 'Commercial', 'HR', 'Financial', 'IP', 'Research'];
  const results: TabStatus[] = [];
  
  for (const agent of agents) {
    const status = await checkTabStatus(agent);
    results.push(status);
    
    const icon = status.working ? '✅' : '❌';
    console.log(`${icon} ${agent}:`);
    console.log(`   Working: ${status.working}`);
    console.log(`   Data Type: ${status.hasStructuredData ? 'Structured Answers' : status.hasFindings ? 'Findings' : 'None'}`);
    console.log(`   Data Count: ${status.dataCount}`);
    
    if (status.issues.length > 0) {
      status.issues.forEach(issue => console.log(`   ⚠️  ${issue}`));
    }
    console.log('');
  }
  
  const workingCount = results.filter(r => r.working).length;
  const brokenCount = results.filter(r => !r.working).length;
  
  console.log('📊 FINAL STATUS:');
  console.log(`✅ Working Tabs: ${workingCount}/7`);
  console.log(`❌ Broken Tabs: ${brokenCount}/7`);
  
  if (workingCount === 7) {
    console.log('\n🎉 ALL ANALYSIS TABS ARE WORKING! 🎉');
  } else {
    console.log('\n🔧 Still need fixes for:', results.filter(r => !r.working).map(r => r.agent).join(', '));
  }
}

main().catch(console.error);