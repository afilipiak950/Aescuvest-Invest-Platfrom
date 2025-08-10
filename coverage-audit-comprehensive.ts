#!/usr/bin/env tsx
/**
 * COMPREHENSIVE AGENT COVERAGE AUDIT
 * 
 * Hard coverage audit computing per agent:
 * - expected = assignedDocs.length × questionIds.length
 * - Print enqueued/started/finished/persisted
 * - Missing (docId, questionId) matrix
 * - Fail with exit code ≠ 0 if persisted !== expected
 */

import { storage } from './server/storage';
import { spawn } from 'child_process';

interface CoverageMetrics {
  agentType: string;
  assignedDocs: number[];
  questionIds: string[];
  expected: number;
  enqueued: number;
  started: number;
  finished: number;
  persisted: number;
  missing: Array<{docId: number, questionId: string}>;
  hitCounts: {[key: string]: number};
  processingTimes: {[key: string]: number};
}

interface DocumentAnalysis {
  docId: number;
  docName: string;
  chunkCount: number;
  tokenCount: number;
  embeddingRows: number;
  namespace: string;
  dimension: number;
}

async function runComprehensiveCoverageAudit() {
  console.log('🚀 Starting comprehensive agent coverage audit...');
  console.log('='.repeat(60));
  
  const dealId = 33; // Using the current active deal
  const agentTypes = ['Legal', 'Clinical', 'Commercial', 'HR', 'Financial', 'IP', 'Research'];
  
  try {
    // Get all documents for the deal
    const allDocs = await storage.getDocumentsByDealId(dealId);
    console.log(`📄 Found ${allDocs.length} total documents for deal ${dealId}`);
    
    const coverageResults: CoverageMetrics[] = [];
    let totalFailures = 0;
    
    // Analyze each agent
    for (const agentType of agentTypes) {
      console.log(`\n🔍 ANALYZING ${agentType.toUpperCase()} AGENT`);
      console.log('-'.repeat(40));
      
      // Get assigned documents for this agent (assigned_agents is JSON array)
      const assignedDocs = allDocs.filter(doc => {
        if (!doc.assignedAgents) return false;
        
        const agents = Array.isArray(doc.assignedAgents) ? doc.assignedAgents : 
                      (typeof doc.assignedAgents === 'string' ? JSON.parse(doc.assignedAgents || '[]') : []);
        
        return agents.some((agent: string) => 
          agent.toLowerCase() === agentType.toLowerCase() || agent === agentType
        );
      });
      
      console.log(`📋 Assigned documents: ${assignedDocs.length}`);
      
      // Get agent's question set (hardcoded for audit - these should match actual questions)
      const questionIds = getQuestionIdsForAgent(agentType);
      console.log(`❓ Question set size: ${questionIds.length}`);
      
      // Calculate expected coverage
      const expected = assignedDocs.length * questionIds.length;
      console.log(`🎯 Expected coverage: ${assignedDocs.length} docs × ${questionIds.length} questions = ${expected} pairs`);
      
      // Get actual analysis results
      const analysis = await storage.getAgentAnalysis(dealId, agentType.toLowerCase());
      
      let persisted = 0;
      let hitCounts: {[key: string]: number} = {};
      let missing: Array<{docId: number, questionId: string}> = [];
      
      // Check for structured answers
      if (analysis) {
        const answersField = getAnswersFieldForAgent(agentType);
        const answers = analysis[answersField];
        
        if (answers && typeof answers === 'object') {
          persisted = Object.keys(answers).length;
          
          // Check hit counts
          Object.entries(answers).forEach(([questionId, answerData]: [string, any]) => {
            if (answerData && answerData.sources) {
              hitCounts[questionId] = answerData.sources.length;
            } else {
              hitCounts[questionId] = 0;
            }
          });
          
          // Find missing pairs
          for (const doc of assignedDocs) {
            for (const questionId of questionIds) {
              if (!answers[questionId]) {
                missing.push({ docId: doc.id, questionId });
              }
            }
          }
        }
      }
      
      const coverage: CoverageMetrics = {
        agentType,
        assignedDocs: assignedDocs.map(d => d.id),
        questionIds,
        expected,
        enqueued: 0, // Would need job queue data
        started: 0,  // Would need job queue data
        finished: 0, // Would need job queue data
        persisted,
        missing,
        hitCounts,
        processingTimes: {}
      };
      
      coverageResults.push(coverage);
      
      // Report results
      console.log(`✅ Persisted: ${persisted}/${expected} (${((persisted/expected)*100).toFixed(1)}%)`);
      console.log(`❌ Missing pairs: ${missing.length}`);
      
      // Hit distribution analysis
      const hitCountValues = Object.values(hitCounts);
      const avgHits = hitCountValues.length > 0 ? hitCountValues.reduce((a, b) => a + b, 0) / hitCountValues.length : 0;
      const highHitQuestions = hitCountValues.filter(count => count >= 5).length;
      const hitCoverage = hitCountValues.length > 0 ? (highHitQuestions / hitCountValues.length) * 100 : 0;
      
      console.log(`📊 Hit distribution: avg=${avgHits.toFixed(1)}, ≥5 hits=${highHitQuestions}/${hitCountValues.length} (${hitCoverage.toFixed(1)}%)`);
      
      // Failure check
      if (persisted < expected) {
        console.log(`❌ FAILURE: Agent ${agentType} has ${persisted}/${expected} coverage`);
        totalFailures++;
        
        // Print first 10 missing pairs
        console.log(`Missing pairs (first 10):`);
        missing.slice(0, 10).forEach(({docId, questionId}) => {
          const doc = assignedDocs.find(d => d.id === docId);
          console.log(`  - Doc ${docId} (${doc?.name?.substring(0, 50)}...) × Question ${questionId}`);
        });
      }
    }
    
    // Final summary
    console.log(`\n📊 COMPREHENSIVE AUDIT SUMMARY`);
    console.log('='.repeat(60));
    
    coverageResults.forEach(result => {
      const coveragePercent = ((result.persisted / result.expected) * 100).toFixed(1);
      const hitStats = Object.values(result.hitCounts);
      const avgHits = hitStats.length > 0 ? (hitStats.reduce((a, b) => a + b, 0) / hitStats.length).toFixed(1) : '0';
      const highHitPercent = hitStats.length > 0 ? ((hitStats.filter(h => h >= 5).length / hitStats.length) * 100).toFixed(1) : '0';
      
      console.log(`${result.agentType.padEnd(12)} | ${result.persisted.toString().padStart(3)}/${result.expected.toString().padEnd(3)} (${coveragePercent.padStart(5)}%) | avg hits: ${avgHits.padStart(4)} | ≥5 hits: ${highHitPercent.padStart(4)}%`);
    });
    
    if (totalFailures > 0) {
      console.log(`\n❌ AUDIT FAILED: ${totalFailures} agents have incomplete coverage`);
      console.log('Blocking deployment until all agents achieve expected coverage.');
      process.exit(1);
    } else {
      console.log(`\n✅ AUDIT PASSED: All agents have complete coverage`);
    }
    
  } catch (error) {
    console.error('❌ Coverage audit failed:', error);
    process.exit(1);
  }
}

function getQuestionIdsForAgent(agentType: string): string[] {
  // These should match the actual question IDs used in the comprehensive services
  const questionSets = {
    'Legal': [
      'sha_1', 'sha_2', 'sha_3', 'gov_1', 'gov_2', 'ip_1', 'ip_2', 
      'commercial_1', 'commercial_2', 'lit_1', 'lit_2', 'reg_1', 'reg_2', 
      'financial_1', 'financial_2'
    ],
    'Clinical': [
      'clin_1', 'clin_2', 'clin_3', 'clin_4', 'clin_5',
      'clin_6', 'clin_7', 'clin_8', 'clin_9', 'clin_10'
    ],
    'Commercial': [
      'market_size', 'competition', 'business_model', 'pricing_strategy', 'customer_segments',
      'revenue_streams', 'partnerships', 'sales_strategy', 'market_position', 'growth_potential'
    ],
    'HR': [
      'hr_1', 'hr_2', 'hr_3', 'hr_4', 'hr_5',
      'hr_6', 'hr_7', 'hr_8', 'hr_9', 'hr_10'
    ],
    'Financial': [
      'fin_1', 'fin_2', 'fin_3', 'fin_4', 'fin_5',
      'fin_6', 'fin_7', 'fin_8', 'fin_9', 'fin_10'
    ],
    'IP': [
      'ip_1', 'ip_2', 'ip_3', 'ip_4', 'ip_5',
      'ip_6', 'ip_7', 'ip_8', 'ip_9', 'ip_10'
    ],
    'Research': [
      'research_1', 'research_2', 'research_3', 'research_4', 'research_5',
      'research_6', 'research_7', 'research_8', 'research_9', 'research_10'
    ]
  };
  
  return questionSets[agentType] || [];
}

function getAnswersFieldForAgent(agentType: string): string {
  const fieldMapping = {
    'Legal': 'legalAnswers',
    'Clinical': 'clinicalAnswers', 
    'Commercial': 'commercialAnswers',
    'HR': 'hr_answers',
    'Financial': 'financial_answers',
    'IP': 'ip_answers',
    'Research': 'research_answers'
  };
  
  return fieldMapping[agentType] || `${agentType.toLowerCase()}Answers`;
}

// Run the audit
runComprehensiveCoverageAudit().catch(console.error);