#!/usr/bin/env tsx

// Comprehensive test to verify all analysis tabs work correctly with unique data

import fetch from 'node-fetch';

const DEAL_ID = 22;
const BASE_URL = 'http://localhost:5000';

interface AnalysisContent {
  agent: string;
  status: 'working' | 'empty' | 'error';
  dataType: string;
  contentSample: string;
  uniqueIdentifier: string;
  dataCount: number;
}

async function testAnalysisTab(agent: string): Promise<AnalysisContent> {
  try {
    const response = await fetch(`${BASE_URL}/api/deals/${DEAL_ID}/agents/${agent.toLowerCase()}/results`);
    const data = await response.json() as any;
    
    if (!response.ok || !data.success || !data.analysis) {
      return {
        agent,
        status: 'empty',
        dataType: 'none',
        contentSample: 'No data available',
        uniqueIdentifier: 'none',
        dataCount: 0
      };
    }

    const analysis = data.analysis;
    const answerField = `${agent.toLowerCase()}Answers`;
    
    // Check for structured answers first
    if (analysis[answerField] && typeof analysis[answerField] === 'object') {
      const answers = analysis[answerField];
      const answerKeys = Object.keys(answers);
      
      if (answerKeys.length > 0) {
        const firstKey = answerKeys[0];
        const firstAnswer = answers[firstKey];
        const contentSample = typeof firstAnswer === 'object' 
          ? (firstAnswer.answer || firstAnswer.content || JSON.stringify(firstAnswer).substring(0, 100))
          : firstAnswer.toString().substring(0, 100);
        
        return {
          agent,
          status: 'working',
          dataType: 'structured_answers',
          contentSample: contentSample + '...',
          uniqueIdentifier: `${agent}_answers_${answerKeys.length}_${firstKey}`,
          dataCount: answerKeys.length
        };
      }
    }
    
    // Check for findings fallback
    if (analysis.findings && Array.isArray(analysis.findings) && analysis.findings.length > 0) {
      const firstFinding = analysis.findings[0];
      const contentSample = (firstFinding.content || firstFinding.description || firstFinding.title || '').substring(0, 100);
      
      return {
        agent,
        status: 'working',
        dataType: 'findings',
        contentSample: contentSample + '...',
        uniqueIdentifier: `${agent}_findings_${analysis.findings.length}`,
        dataCount: analysis.findings.length
      };
    }
    
    return {
      agent,
      status: 'empty',
      dataType: 'none',
      contentSample: 'Analysis completed but no usable data structure found',
      uniqueIdentifier: 'empty',
      dataCount: 0
    };
    
  } catch (error) {
    return {
      agent,
      status: 'error',
      dataType: 'error',
      contentSample: error.toString(),
      uniqueIdentifier: 'error',
      dataCount: 0
    };
  }
}

async function main() {
  console.log('🧪 COMPREHENSIVE ANALYSIS TAB TESTING');
  console.log('='.repeat(60));
  
  const agents = ['Clinical', 'Legal', 'Commercial', 'HR', 'Financial', 'IP', 'Research'];
  const results: AnalysisContent[] = [];
  
  console.log('Testing all analysis endpoints...\n');
  
  for (const agent of agents) {
    const result = await testAnalysisTab(agent);
    results.push(result);
    
    const statusIcon = result.status === 'working' ? '✅' : result.status === 'empty' ? '⚪' : '❌';
    console.log(`${statusIcon} ${agent} Tab:`);
    console.log(`   Status: ${result.status.toUpperCase()}`);
    console.log(`   Data Type: ${result.dataType}`);
    console.log(`   Data Count: ${result.dataCount}`);
    console.log(`   Content Sample: ${result.contentSample}`);
    console.log(`   Unique ID: ${result.uniqueIdentifier}`);
    console.log('');
  }
  
  // Check for duplicate content (which would indicate a bug)
  console.log('🔍 DUPLICATE CONTENT CHECK:');
  const uniqueIds = new Set();
  const duplicates: string[] = [];
  
  results.forEach(result => {
    if (result.status === 'working') {
      if (uniqueIds.has(result.uniqueIdentifier)) {
        duplicates.push(result.agent);
      } else {
        uniqueIds.add(result.uniqueIdentifier);
      }
    }
  });
  
  if (duplicates.length > 0) {
    console.log(`❌ Found duplicate content in: ${duplicates.join(', ')}`);
  } else {
    console.log('✅ All working tabs have unique content');
  }
  
  // Summary
  const working = results.filter(r => r.status === 'working').length;
  const empty = results.filter(r => r.status === 'empty').length;
  const errors = results.filter(r => r.status === 'error').length;
  
  console.log('\n📊 FINAL TEST RESULTS:');
  console.log(`✅ Working Tabs: ${working}/7`);
  console.log(`⚪ Empty Tabs: ${empty}/7`);
  console.log(`❌ Error Tabs: ${errors}/7`);
  
  if (working >= 5 && errors === 0) {
    console.log('\n🎉 SYSTEM READY - All major analysis tabs working with unique content!');
  } else if (working >= 3) {
    console.log('\n⚠️  SYSTEM PARTIALLY READY - Some tabs need completion');
  } else {
    console.log('\n❌ SYSTEM NEEDS FIXES - Multiple tabs not working');
  }
  
  // Show which tabs are currently running
  console.log('\n🔄 Currently Processing:');
  if (empty > 0) {
    const emptyTabs = results.filter(r => r.status === 'empty').map(r => r.agent);
    console.log(`   Waiting for completion: ${emptyTabs.join(', ')}`);
  } else {
    console.log('   All analyses completed');
  }
}

main().catch(console.error);