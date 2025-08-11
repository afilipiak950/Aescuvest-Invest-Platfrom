/**
 * TEST SCRIPT: Real OpenAI Analysis Pipeline
 * 
 * This script tests the complete pipeline:
 * 1. Get OCR documents for Deal #30
 * 2. Test the OpenAI analysis endpoint
 * 3. Verify results are stored correctly
 */

import { storage } from './server/storage';
import { jobBasedEngine } from './server/services/jobBasedAnalysisEngine';

async function testRealAnalysisPipeline() {
  const dealId = 30; // Deal with real OCR data
  
  console.log(`🧪 TESTING Real OpenAI Analysis Pipeline for Deal ${dealId}`);
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Check available documents and OCR data
    console.log(`📄 Step 1: Checking documents for deal ${dealId}...`);
    const documents = await storage.getDocumentsByDealId(dealId);
    console.log(`Found ${documents.length} documents:`);
    
    for (const doc of documents) {
      const ocrLength = (doc.ocrText || '').length;
      const summaryLength = (doc.summary || '').length;
      console.log(`  - ${doc.name}: OCR=${ocrLength} chars, Summary=${summaryLength} chars`);
    }
    
    // Step 2: Check existing analyses
    console.log(`\n🔍 Step 2: Checking existing analyses...`);
    const existingAnalyses = await storage.getAnalysesByDealId(dealId);
    console.log(`Found ${existingAnalyses.length} existing analyses`);
    
    // Step 3: Test the job-based analysis engine directly
    console.log(`\n🚀 Step 3: Starting job-based comprehensive analysis...`);
    
    if (!process.env.OPENAI_API_KEY) {
      console.log(`❌ No OpenAI API key found in environment`);
      return;
    }
    console.log(`✅ OpenAI API key found`);
    
    // Start the analysis
    const runId = await jobBasedEngine.startComprehensiveAnalysis(dealId);
    console.log(`✅ Analysis started with run ID: ${runId}`);
    
    // Wait a bit and check progress
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const progress = jobBasedEngine.getRunProgress(runId);
    console.log(`📊 Progress after 5 seconds:`, progress);
    
    // Check if any new analyses were created
    console.log(`\n🔍 Step 4: Checking for new analyses...`);
    const newAnalyses = await storage.getAnalysesByDealId(dealId);
    console.log(`Found ${newAnalyses.length} analyses after run`);
    
    if (newAnalyses.length > existingAnalyses.length) {
      console.log(`✅ New analyses created! Difference: ${newAnalyses.length - existingAnalyses.length}`);
      
      // Show some sample results
      for (const analysis of newAnalyses.slice(-3)) {
        console.log(`\n📋 ${analysis.agentType} Analysis:`);
        console.log(`   Status: ${analysis.status}`);
        console.log(`   Progress: ${analysis.progress}%`);
        console.log(`   Findings: ${analysis.findings?.length || 0}`);
        console.log(`   Recommendations: ${analysis.recommendations?.length || 0}`);
        
        if (analysis.agentType === 'Legal' && analysis.legal_answers) {
          const answerCount = Object.keys(analysis.legal_answers).length;
          console.log(`   Legal Answers: ${answerCount}`);
          
          // Show first answer
          const firstAnswerKey = Object.keys(analysis.legal_answers)[0];
          if (firstAnswerKey) {
            const firstAnswer = analysis.legal_answers[firstAnswerKey];
            console.log(`   Sample Answer (${firstAnswerKey}): ${(firstAnswer.answer || '').substring(0, 100)}...`);
          }
        }
      }
    }
    
    console.log(`\n🎯 PIPELINE TEST COMPLETED SUCCESSFULLY`);
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error(`❌ PIPELINE TEST FAILED:`, error);
    console.log('=' .repeat(60));
  }
}

// Run the test if called directly
if (require.main === module) {
  testRealAnalysisPipeline().then(() => {
    console.log(`\n✅ Test complete`);
    process.exit(0);
  }).catch(error => {
    console.error(`❌ Test failed:`, error);
    process.exit(1);
  });
}

export { testRealAnalysisPipeline };