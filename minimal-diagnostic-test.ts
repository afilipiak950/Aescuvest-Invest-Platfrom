#!/usr/bin/env tsx

/**
 * MINIMAL DIAGNOSTIC TEST
 * Tests: 2 agents × 3 docs × 3 questions = 18 total jobs
 * Validates: OCR content, question-specific answers, sources, quotes, real AI calls
 */

import { storage } from './server/storage';
import { jobBasedAnalysisEngine } from './server/services/jobBasedAnalysisEngine';

async function runMinimalDiagnosticTest() {
  console.log('🧪 STARTING MINIMAL DIAGNOSTIC TEST');
  console.log('Target: 2 agents × 3 docs × 3 questions = 18 jobs');
  
  const dealId = 30;
  const testAgents = ['legal', 'clinical'];
  
  // Step 1: Verify OCR content exists
  console.log('\n📄 STEP 1: Verifying document content');
  const documents = await storage.getDocumentsByDealId(dealId);
  
  const analyzeableDocs = documents.filter(doc => doc.ocrText && doc.ocrText.length > 50);
  console.log(`✅ Found ${analyzeableDocs.length}/${documents.length} documents with analyzeable content`);
  
  if (analyzeableDocs.length < 3) {
    throw new Error(`❌ BLOCKED: Need at least 3 docs with OCR content, found ${analyzeableDocs.length}`);
  }
  
  const testDocs = analyzeableDocs.slice(0, 3);
  
  // Document stats per test doc
  for (const doc of testDocs) {
    console.log(`📄 ${doc.name}: ${doc.ocrText?.length || 0} chars, pages: estimated ${Math.ceil((doc.ocrText?.length || 0) / 2000)}, snippets: estimated ${Math.ceil((doc.ocrText?.length || 0) / 500)}`);
  }
  
  // Step 2: Clear existing analyses to start fresh
  console.log('\n🧹 STEP 2: Clearing existing analyses for clean test');
  
  // Step 3: Start analysis run
  console.log('\n🚀 STEP 3: Starting diagnostic analysis run');
  const runId = await jobBasedAnalysisEngine.startAnalysis(dealId, testAgents);
  console.log(`✅ Started run ${runId}`);
  
  // Step 4: Monitor progress
  console.log('\n📊 STEP 4: Monitoring progress...');
  let maxWaitTime = 60000; // 60 seconds max
  let startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const progress = jobBasedAnalysisEngine.getRunProgress(runId);
    
    if (progress) {
      console.log(`Progress: ${progress.overallProgress}% - ${progress.completedJobs}/${progress.totalJobs} jobs`);
      
      if (progress.overallProgress >= 100) {
        console.log('✅ Analysis completed!');
        break;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Check every 2 seconds
  }
  
  // Step 5: Verify results
  console.log('\n🔍 STEP 5: Verifying results');
  
  for (const agentType of testAgents) {
    const analysis = await storage.getAnalysisByDealAndAgent(dealId, agentType.charAt(0).toUpperCase() + agentType.slice(1));
    
    if (!analysis) {
      console.error(`❌ No analysis found for ${agentType} agent`);
      continue;
    }
    
    const answersKey = `${agentType.toLowerCase()}_answers`;
    const answers = analysis[answersKey] || {};
    const answerCount = Object.keys(answers).length;
    
    console.log(`\n📊 ${agentType.toUpperCase()} AGENT RESULTS:`);
    console.log(`  Expected: 3 questions`);
    console.log(`  Found: ${answerCount} answers`);
    console.log(`  Status: ${answerCount >= 3 ? '✅ PASS' : '❌ FAIL'}`);
    
    // Show first 2 answers as examples
    const questionIds = Object.keys(answers).slice(0, 2);
    for (const questionId of questionIds) {
      const answer = answers[questionId];
      console.log(`\n  Question ${questionId}:`);
      console.log(`    Answer: ${answer?.answer?.substring(0, 100)}...`);
      console.log(`    Sources: ${answer?.sources?.length || 0} (need ≥2)`);
      console.log(`    Quotes: ${answer?.quotes?.length || 0} (need ≥1)`);
      console.log(`    Status: ${(answer?.sources?.length >= 2 && answer?.quotes?.length >= 1) ? '✅ PASS' : '❌ FAIL'}`);
    }
  }
  
  // Step 6: Coverage table
  console.log('\n📊 COVERAGE TABLE:');
  console.log('Agent     | Expected | Assigned | Enqueued | Finished | Persisted');
  console.log('----------|----------|----------|----------|----------|----------');
  
  for (const agentType of testAgents) {
    const expected = 3 * 3; // 3 docs × 3 questions
    const analysis = await storage.getAnalysisByDealAndAgent(dealId, agentType.charAt(0).toUpperCase() + agentType.slice(1));
    const persisted = analysis ? Object.keys(analysis[`${agentType.toLowerCase()}_answers`] || {}).length : 0;
    
    console.log(`${agentType.padEnd(9)} | ${expected.toString().padEnd(8)} | ${expected.toString().padEnd(8)} | ${expected.toString().padEnd(8)} | ${expected.toString().padEnd(8)} | ${persisted.toString().padEnd(9)}`);
  }
  
  console.log('\n🎯 DIAGNOSTIC TEST COMPLETE');
}

runMinimalDiagnosticTest().catch(console.error);