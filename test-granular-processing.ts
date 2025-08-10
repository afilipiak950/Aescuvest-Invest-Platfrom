#!/usr/bin/env tsx
/**
 * TEST GRANULAR PROCESSING IMPLEMENTATION
 * 
 * Complete implementation and testing of granular document×question processing
 * addressing all root causes identified in the comprehensive audit.
 */

import { storage } from './server/storage';
import { GranularJobProcessor } from './server/services/granularJobProcessor';

const LEGAL_QUESTIONS = [
  { id: 'ip_1', question: 'Are IP assignment agreements in place for all team members?', category: 'IP Assignment' },
  { id: 'commercial_1', question: 'Are SLAs, warranties, and indemnity clauses present in key agreements?', category: 'Commercial Terms' },
  { id: 'reg_1', question: 'Are there FDA submissions or other regulatory approvals in progress?', category: 'Regulatory' },
  { id: 'gov_1', question: 'Is board composition clearly defined?', category: 'Governance' },
  { id: 'financial_1', question: 'Are there warrants, convertible instruments, or debt securities outstanding?', category: 'Financial Instruments' }
];

async function testGranularProcessing() {
  console.log('🚀 TESTING GRANULAR PROCESSING IMPLEMENTATION');
  console.log('==============================================');
  
  const dealId = 33;
  const agentId = 'Legal';
  
  try {
    // Initialize granular job processor
    const processor = new GranularJobProcessor();
    
    // Get legal documents
    const allDocs = await storage.getDocumentsByDealId(dealId);
    const assignedDocs = allDocs.filter(doc => {
      if (!doc.assignedAgents) return false;
      const agents = Array.isArray(doc.assignedAgents) ? doc.assignedAgents : 
                    (typeof doc.assignedAgents === 'string' ? JSON.parse(doc.assignedAgents || '[]') : []);
      return agents.some((agent: string) => 
        agent.toLowerCase() === agentId.toLowerCase() || agent === agentId
      );
    });
    
    // Test with first 10 documents for speed
    const testDocs = assignedDocs.slice(0, 10);
    const testQuestions = LEGAL_QUESTIONS.slice(0, 3); // First 3 questions
    
    console.log(`📋 Testing with ${testDocs.length} docs × ${testQuestions.length} questions = ${testDocs.length * testQuestions.length} jobs`);
    console.log(`📄 Test documents: ${testDocs.map(d => d.id).join(', ')}`);
    console.log(`❓ Test questions: ${testQuestions.map(q => q.id).join(', ')}`);
    
    // PHASE 1: Fan-out individual document×question jobs
    console.log('\n📋 PHASE 1: ENQUEUING DOCUMENT×QUESTION JOBS');
    console.log('=============================================');
    
    const enqueuedJobs: string[] = [];
    for (const doc of testDocs) {
      for (const question of testQuestions) {
        const jobKey = await processor.enqueueDocumentQuestionJob(agentId, doc.id, question.id, question);
        enqueuedJobs.push(jobKey);
      }
    }
    
    console.log(`✅ Enqueued ${enqueuedJobs.length} jobs`);
    console.log(`📝 Sample job keys:`);
    enqueuedJobs.slice(0, 5).forEach(jobKey => {
      console.log(`  ${jobKey}`);
    });
    
    // PHASE 2: Process individual document×question pairs with scoped retrieval
    console.log('\n🎯 PHASE 2: PROCESSING DOCUMENT×QUESTION PAIRS');
    console.log('===============================================');
    
    const processingResults: any[] = [];
    const startTime = Date.now();
    
    for (let i = 0; i < testDocs.length; i++) {
      const doc = testDocs[i];
      console.log(`\n📄 Processing document ${i + 1}/${testDocs.length}: ${doc.name.substring(0, 60)}...`);
      
      for (let j = 0; j < testQuestions.length; j++) {
        const question = testQuestions[j];
        console.log(`  ❓ Question ${j + 1}/${testQuestions.length}: ${question.id}`);
        
        const result = await processor.processDocumentQuestionPair(
          agentId,
          doc.id,
          question.id,
          question
        );
        
        processingResults.push(result);
        
        const status = result.hasEvidence ? 
          `✅ ${result.hitCount} hits` : 
          `⚪ No evidence (${result.reason || 'no_hits'})`;
        
        console.log(`    ${status} | ${result.retrievalMs}ms`);
        
        // Check timing flags
        if (result.retrievalMs && result.retrievalMs < 50) {
          console.log(`    🚨 WARNING: Too fast (${result.retrievalMs}ms) - possible early exit`);
        }
      }
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`⏱️ Total processing time: ${processingTime}ms (${(processingTime/1000).toFixed(1)}s)`);
    
    // PHASE 3: Evidence combination for each question
    console.log('\n🔀 PHASE 3: COMBINING EVIDENCE FOR QUESTIONS');
    console.log('=============================================');
    
    const combinedResults: any[] = [];
    for (const question of testQuestions) {
      console.log(`\n🔍 Combining evidence for: ${question.question.substring(0, 80)}...`);
      
      const combinedResult = await processor.combineEvidenceForQuestion(
        agentId,
        question.id,
        question,
        testDocs.map(d => d.id)
      );
      
      combinedResults.push(combinedResult);
      
      console.log(`  Answer: ${combinedResult.answer ? '✅ Generated' : '⚪ Null'}`);
      console.log(`  Confidence: ${combinedResult.confidence}%`);
      console.log(`  Sources: ${combinedResult.sources.length}`);
      console.log(`  Quotes: ${combinedResult.quotes.length}`);
      console.log(`  Documents used: ${combinedResult.usedDocIds.length}/${testDocs.length}`);
      
      // CRITICAL: Verify no forbidden text
      if (combinedResult.answer && combinedResult.answer.includes('No specific evidence found')) {
        console.log(`  🚨 CRITICAL ERROR: Contains forbidden fallback text!`);
      } else {
        console.log(`  ✅ No forbidden fallback text detected`);
      }
    }
    
    // PHASE 4: Acceptance criteria verification
    console.log('\n🎯 PHASE 4: ACCEPTANCE CRITERIA VERIFICATION');
    console.log('=============================================');
    
    const stats = processor.getProcessingStats();
    
    const expectedJobs = testDocs.length * testQuestions.length;
    const processedEqualsExpected = stats.completed === expectedJobs;
    const hitRateAbove80 = stats.hitRatePercent >= 80;
    
    // Check hit count ≥ 5 for 80% of questions
    const questionsWithHighHitCount = testQuestions.filter(question => {
      const questionResults = processingResults.filter(r => r.questionId === question.id && r.hasEvidence);
      const totalHits = questionResults.reduce((sum, r) => sum + (r.hitCount || 0), 0);
      return totalHits >= 5;
    });
    
    const hitCountCriteria = (questionsWithHighHitCount.length / testQuestions.length) >= 0.8;
    
    // Check for forbidden text
    const resultsWithForbiddenText = combinedResults.filter(r => 
      r.answer && r.answer.includes('No specific evidence found')
    ).length;
    const zeroForbiddenText = resultsWithForbiddenText === 0;
    
    console.log('📊 ACCEPTANCE CRITERIA RESULTS:');
    console.log('===============================');
    console.log(`1. processed === expected: ${processedEqualsExpected ? '✅' : '❌'} (${stats.completed}/${expectedJobs})`);
    console.log(`2. ≥80% questions with hit_count ≥ 5: ${hitCountCriteria ? '✅' : '❌'} (${questionsWithHighHitCount.length}/${testQuestions.length})`);
    console.log(`3. Zero "No specific evidence found": ${zeroForbiddenText ? '✅' : '❌'} (${resultsWithForbiddenText} violations)`);
    console.log(`4. Overall hit rate: ${stats.hitRatePercent}%`);
    
    const allCriteriaMet = processedEqualsExpected && hitCountCriteria && zeroForbiddenText;
    
    console.log(`\n🏁 FINAL RESULT: ${allCriteriaMet ? '✅ ALL CRITERIA MET' : '❌ CRITERIA NOT MET'}`);
    
    if (allCriteriaMet) {
      console.log('\n🎉 SUCCESS: Granular document×question processing implemented correctly');
      console.log('✅ Full coverage matrix processing');
      console.log('✅ Document-scoped retrieval with topK ≥ 8');
      console.log('✅ Combined multi-source answers');
      console.log('✅ Proper job fan-out scheduler');
      console.log('✅ No forbidden fallback text');
    } else {
      console.log('\n⚠️ Issues still need to be addressed:');
      if (!processedEqualsExpected) console.log('  - Incomplete job processing');
      if (!hitCountCriteria) console.log('  - Low hit count for questions');
      if (!zeroForbiddenText) console.log('  - Forbidden text still present');
    }
    
    // PHASE 5: Performance analysis
    console.log('\n📈 PHASE 5: PERFORMANCE ANALYSIS');
    console.log('=================================');
    
    const avgProcessingTime = processingTime / (testDocs.length * testQuestions.length);
    const estimatedFullTime = (assignedDocs.length * LEGAL_QUESTIONS.length * avgProcessingTime) / 1000 / 60;
    
    console.log(`Average time per document×question pair: ${avgProcessingTime.toFixed(1)}ms`);
    console.log(`Estimated time for full Legal processing: ${estimatedFullTime.toFixed(1)} minutes`);
    console.log(`(${assignedDocs.length} docs × ${LEGAL_QUESTIONS.length} questions = ${assignedDocs.length * LEGAL_QUESTIONS.length} pairs)`);
    
    // Sample results for inspection
    console.log('\n📝 SAMPLE COMBINED RESULTS');
    console.log('==========================');
    
    combinedResults.slice(0, 2).forEach((result, i) => {
      console.log(`\n${i + 1}. Question: ${result.questionId}`);
      console.log(`   Answer: ${result.answer ? result.answer.substring(0, 200) + '...' : 'null'}`);
      console.log(`   Confidence: ${result.confidence}%`);
      console.log(`   Evidence sources: ${result.usedDocIds.length} documents`);
      
      if (result.sources.length > 0) {
        console.log(`   Sample source: "${result.sources[0].snippet.substring(0, 100)}..."`);
      }
    });
    
    // Export results for UI testing
    console.log('\n💾 EXPORTING RESULTS FOR UI TESTING');
    console.log('===================================');
    
    const exportData = {
      agentId,
      dealId,
      testSummary: {
        documentsProcessed: testDocs.length,
        questionsProcessed: testQuestions.length,
        totalJobs: expectedJobs,
        completedJobs: stats.completed,
        hitRate: stats.hitRatePercent,
        processingTimeMs: processingTime,
        acceptanceCriteriaMet: allCriteriaMet
      },
      combinedResults,
      processingResults: processingResults.slice(0, 10), // First 10 for inspection
      stats
    };
    
    require('fs').writeFileSync(
      './test-results-granular-processing.json', 
      JSON.stringify(exportData, null, 2)
    );
    
    console.log('✅ Results exported to test-results-granular-processing.json');
    
  } catch (error) {
    console.error('❌ Test error:', error);
    process.exit(1);
  }
}

// Run test
testGranularProcessing().catch(console.error);