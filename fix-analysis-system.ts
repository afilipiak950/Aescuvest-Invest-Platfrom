#!/usr/bin/env tsx

// Comprehensive Analysis System Fix Script
// This script will test and fix all analysis tabs systematically

import fetch from 'node-fetch';

const DEAL_ID = 22;
const BASE_URL = 'http://localhost:5000';

interface TestResult {
  agent: string;
  endpoint: string;
  success: boolean;
  hasData: boolean;
  issues: string[];
}

async function testAnalysisEndpoint(agent: string): Promise<TestResult> {
  const endpoint = `/api/deals/${DEAL_ID}/agents/${agent.toLowerCase()}/results`;
  const result: TestResult = {
    agent,
    endpoint,
    success: false,
    hasData: false,
    issues: []
  };

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`);
    const data = await response.json() as any;
    
    result.success = response.ok && data.success;
    
    if (data.analysis) {
      const analysis = data.analysis;
      result.hasData = !!(
        analysis.findings?.length > 0 ||
        analysis.recommendations?.length > 0 ||
        analysis.clinicalAnswers ||
        analysis.hrAnswers ||
        analysis.legalAnswers ||
        analysis.financialAnswers ||
        analysis.ipAnswers ||
        analysis.researchAnswers ||
        analysis.commercialAnswers
      );
      
      if (!result.hasData) {
        result.issues.push('No analysis data found');
      }
    } else {
      result.issues.push('No analysis object in response');
    }
    
  } catch (error) {
    result.issues.push(`Network error: ${error}`);
  }

  return result;
}

async function runComprehensiveAnalysis(agent: string): Promise<boolean> {
  try {
    const endpoint = `/api/deals/${DEAL_ID}/${agent.toLowerCase()}-analysis/comprehensive`;
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json() as any;
    console.log(`✅ Started ${agent} comprehensive analysis:`, data.message);
    return true;
  } catch (error) {
    console.log(`❌ Failed to start ${agent} analysis:`, error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Comprehensive Analysis System Fix');
  console.log('='.repeat(50));
  
  // Test all analysis endpoints
  const agents = ['Clinical', 'Legal', 'Commercial', 'HR', 'Financial', 'IP', 'Research'];
  const results: TestResult[] = [];
  
  console.log('\n📊 Testing Current Analysis Status:');
  for (const agent of agents) {
    const result = await testAnalysisEndpoint(agent);
    results.push(result);
    
    const status = result.success && result.hasData ? '✅' : '❌';
    console.log(`${status} ${agent}: ${result.success ? 'OK' : 'FAIL'} - ${result.hasData ? 'Has Data' : 'No Data'}`);
    
    if (result.issues.length > 0) {
      result.issues.forEach(issue => console.log(`   ⚠️  ${issue}`));
    }
  }
  
  // Start comprehensive analyses for failed ones
  console.log('\n🔄 Starting Missing Analyses:');
  const failedAgents = results.filter(r => !r.success || !r.hasData).map(r => r.agent);
  
  if (failedAgents.length > 0) {
    console.log(`Starting comprehensive analysis for: ${failedAgents.join(', ')}`);
    
    for (const agent of failedAgents) {
      await runComprehensiveAnalysis(agent);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    }
  } else {
    console.log('All analyses already have data!');
  }
  
  console.log('\n✅ Analysis system fix completed');
  console.log('Monitor progress at: http://localhost:3000/due-diligence/22');
}

main().catch(console.error);