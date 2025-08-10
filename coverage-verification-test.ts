#!/usr/bin/env tsx

/**
 * COVERAGE VERIFICATION TEST
 * Tests the fixed system to verify enterprise-scale coverage
 */

import fetch from 'node-fetch';

interface AgentCoverageResult {
  agentType: string;
  answersCount: number;
  uniqueSources: number;
  defaultAnswers: number;
  latencyMs: number;
  status: 'PASS' | 'FAIL' | 'WARNING';
  issues: string[];
}

async function runCoverageVerification(): Promise<void> {
  console.log(`🔍 COVERAGE VERIFICATION TEST`);
  console.log(`═══════════════════════════════════════════════════`);
  
  const dealId = 33;
  const agents = ['Legal', 'Commercial', 'Clinical', 'Financial', 'HR', 'IP', 'Research'];
  const results: AgentCoverageResult[] = [];
  
  // First, check assignment stats
  console.log(`\n📊 CHECKING ASSIGNMENT STATISTICS...`);
  try {
    const assignmentResponse = await fetch(`http://localhost:5000/api/deals/${dealId}/assignment-stats`);
    const assignmentData = await assignmentResponse.json();
    
    if (assignmentData.success) {
      console.log(`✅ Assignment Stats:`);
      Object.entries(assignmentData.stats.agentCounts).forEach(([agent, count]) => {
        console.log(`   • ${agent}: ${count} assigned documents`);
      });
    }
  } catch (error) {
    console.error(`❌ Failed to get assignment stats:`, error);
  }
  
  console.log(`\n🎯 TESTING ALL 7 AGENTS...`);
  
  // Test each agent
  for (const agentType of agents) {
    console.log(`\n📋 Testing ${agentType} Agent...`);
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(`http://localhost:5000/api/enterprise/deals/${dealId}/agent/${agentType}/comprehensive`);
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      const data = await response.json();
      
      if (data.success && data.analysis) {
        const answers = data.analysis[`${agentType.toLowerCase()}Answers`];
        const answersCount = answers ? Object.keys(answers).length : 0;
        
        // Count unique sources
        const sources = new Set<string>();
        let defaultAnswers = 0;
        
        if (answers) {
          Object.values(answers).forEach((answer: any) => {
            // Count sources
            if (answer.sources && Array.isArray(answer.sources)) {
              answer.sources.forEach((source: any) => {
                if (source.title) sources.add(source.title);
              });
            }
            
            // Check for default answers
            if (answer.answer && typeof answer.answer === 'string') {
              const answerText = answer.answer.toLowerCase();
              if (answerText.includes('no specific evidence found') ||
                  answerText.includes('no relevant information found') ||
                  answerText.includes('information not available')) {
                defaultAnswers++;
              }
            }
          });
        }
        
        const uniqueSources = sources.size;
        
        // Determine status
        let status: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
        const issues: string[] = [];
        
        if (answersCount === 0) {
          status = 'FAIL';
          issues.push('No answers generated');
        } else if (answersCount < 5) {
          status = 'WARNING';
          issues.push(`Low answer count: ${answersCount}`);
        }
        
        if (uniqueSources < 3) {
          status = uniqueSources === 0 ? 'FAIL' : 'WARNING';
          issues.push(`Low source diversity: ${uniqueSources} sources`);
        }
        
        if (defaultAnswers > answersCount * 0.5) {
          status = 'FAIL';
          issues.push(`High default answer rate: ${defaultAnswers}/${answersCount}`);
        }
        
        if (latency < 100 && answersCount > 5) {
          status = 'WARNING';
          issues.push(`Suspiciously fast: ${latency}ms for ${answersCount} answers`);
        }
        
        const result: AgentCoverageResult = {
          agentType,
          answersCount,
          uniqueSources,
          defaultAnswers,
          latencyMs: latency,
          status,
          issues
        };
        
        results.push(result);
        
        // Print result
        const statusIcon = status === 'PASS' ? '✅' : status === 'WARNING' ? '⚠️' : '❌';
        console.log(`   ${statusIcon} ${agentType}: ${answersCount} answers, ${uniqueSources} sources, ${latency}ms`);
        
        if (issues.length > 0) {
          issues.forEach(issue => console.log(`      • ${issue}`));
        }
        
      } else {
        console.log(`   ❌ ${agentType}: API call failed`);
        results.push({
          agentType,
          answersCount: 0,
          uniqueSources: 0,
          defaultAnswers: 0,
          latencyMs: latency,
          status: 'FAIL',
          issues: ['API call failed']
        });
      }
      
    } catch (error) {
      console.error(`   ❌ ${agentType}: Error - ${error}`);
    }
  }
  
  // Generate final report
  console.log(`\n📋 FINAL COVERAGE REPORT`);
  console.log(`═══════════════════════════════════════════════════`);
  
  const totalAnswers = results.reduce((sum, r) => sum + r.answersCount, 0);
  const totalSources = results.reduce((sum, r) => sum + r.uniqueSources, 0);
  const totalDefaults = results.reduce((sum, r) => sum + r.defaultAnswers, 0);
  const avgLatency = results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length;
  
  const passCount = results.filter(r => r.status === 'PASS').length;
  const warningCount = results.filter(r => r.status === 'WARNING').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  
  console.log(`\n📊 SUMMARY METRICS:`);
  console.log(`   • Total Answers Generated: ${totalAnswers}`);
  console.log(`   • Total Unique Sources: ${totalSources}`);
  console.log(`   • Total Default Answers: ${totalDefaults}`);
  console.log(`   • Average Latency: ${avgLatency.toFixed(0)}ms`);
  
  console.log(`\n🎯 AGENT STATUS:`);
  console.log(`   • PASS: ${passCount}/7 agents`);
  console.log(`   • WARNING: ${warningCount}/7 agents`);
  console.log(`   • FAIL: ${failCount}/7 agents`);
  
  // Overall assessment
  if (failCount === 0 && warningCount <= 2) {
    console.log(`\n✅ COVERAGE VERIFICATION: PASS`);
    console.log(`   Enterprise-scale coverage achieved!`);
  } else if (failCount <= 2) {
    console.log(`\n⚠️ COVERAGE VERIFICATION: WARNING`);
    console.log(`   Partial coverage achieved, some issues remain`);
  } else {
    console.log(`\n❌ COVERAGE VERIFICATION: FAIL`);
    console.log(`   Significant coverage gaps detected`);
  }
  
  // Detailed breakdown
  console.log(`\n📋 DETAILED BREAKDOWN:`);
  results.forEach(result => {
    const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'WARNING' ? '⚠️' : '❌';
    console.log(`   ${statusIcon} ${result.agentType}:`);
    console.log(`      Answers: ${result.answersCount}, Sources: ${result.uniqueSources}, Latency: ${result.latencyMs}ms`);
    if (result.issues.length > 0) {
      result.issues.forEach(issue => console.log(`      Issue: ${issue}`));
    }
  });
}

// Run the verification
runCoverageVerification().catch(console.error);