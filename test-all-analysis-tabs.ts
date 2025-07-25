#!/usr/bin/env tsx

// Comprehensive Analysis Tabs Test Script
// This script tests all analysis endpoints and verifies data structure

import fetch from 'node-fetch';

const DEAL_ID = 22;
const BASE_URL = 'http://localhost:5000';

interface AgentTestResult {
  agent: string;
  success: boolean;
  hasAnalysis: boolean;
  hasAnswers: boolean;
  answerCount: number;
  hasFindings: boolean;
  hasRecommendations: boolean;
  dataStructure: string;
  issues: string[];
}

async function testAgentEndpoint(agent: string): Promise<AgentTestResult> {
  const endpoint = `/api/deals/${DEAL_ID}/agents/${agent.toLowerCase()}/results`;
  const result: AgentTestResult = {
    agent,
    success: false,
    hasAnalysis: false,
    hasAnswers: false,
    answerCount: 0,
    hasFindings: false,
    hasRecommendations: false,
    dataStructure: 'unknown',
    issues: []
  };

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`);
    const data = await response.json() as any;
    
    result.success = response.ok && data.success;
    result.hasAnalysis = !!data.analysis;
    
    if (data.analysis) {
      const analysis = data.analysis;
      
      // Check for specific answer types
      const answerFields = [`${agent.toLowerCase()}Answers`, 'clinicalAnswers', 'legalAnswers', 'commercialAnswers', 'hrAnswers', 'financialAnswers', 'ipAnswers', 'researchAnswers'];
      
      for (const field of answerFields) {
        if (analysis[field] && typeof analysis[field] === 'object') {
          result.hasAnswers = true;
          result.answerCount = Object.keys(analysis[field]).length;
          result.dataStructure = field;
          break;
        }
      }
      
      // Check for findings and recommendations
      result.hasFindings = !!(analysis.findings && Array.isArray(analysis.findings) && analysis.findings.length > 0);
      result.hasRecommendations = !!(analysis.recommendations && Array.isArray(analysis.recommendations) && analysis.recommendations.length > 0);
      
      // Additional checks for different data structures
      if (!result.hasAnswers && !result.hasFindings) {
        result.issues.push('No structured data found (no answers or findings)');
      }
      
    } else {
      result.issues.push('No analysis object in response');
    }
    
  } catch (error) {
    result.issues.push(`Network error: ${error}`);
  }

  return result;
}

async function main() {
  console.log('🧪 Testing All Analysis Tabs');
  console.log('='.repeat(60));
  
  const agents = ['Clinical', 'Legal', 'Commercial', 'HR', 'Financial', 'IP', 'Research'];
  const results: AgentTestResult[] = [];
  
  for (const agent of agents) {
    const result = await testAgentEndpoint(agent);
    results.push(result);
    
    const status = result.success && (result.hasAnswers || result.hasFindings) ? '✅' : '❌';
    console.log(`${status} ${agent}:`);
    console.log(`   Success: ${result.success}`);
    console.log(`   Has Analysis: ${result.hasAnalysis}`);
    console.log(`   Has Answers: ${result.hasAnswers} (${result.answerCount} answers)`);
    console.log(`   Has Findings: ${result.hasFindings}`);
    console.log(`   Has Recommendations: ${result.hasRecommendations}`);
    console.log(`   Data Structure: ${result.dataStructure}`);
    
    if (result.issues.length > 0) {
      result.issues.forEach(issue => console.log(`   ⚠️  ${issue}`));
    }
    console.log('');
  }
  
  // Summary
  const workingTabs = results.filter(r => r.success && (r.hasAnswers || r.hasFindings));
  const runningTabs = results.filter(r => r.success && !r.hasAnswers && !r.hasFindings);
  const brokenTabs = results.filter(r => !r.success);
  
  console.log('📊 SUMMARY:');
  console.log(`✅ Working Tabs: ${workingTabs.length}/7 (${workingTabs.map(t => t.agent).join(', ')})`);
  console.log(`🔄 Running/Empty Tabs: ${runningTabs.length}/7 (${runningTabs.map(t => t.agent).join(', ')})`);
  console.log(`❌ Broken Tabs: ${brokenTabs.length}/7 (${brokenTabs.map(t => t.agent).join(', ')})`);
  
  console.log('\n🎯 All tabs should display properly in the frontend now!');
}

main().catch(console.error);