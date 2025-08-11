/**
 * DIRECT REAL ANALYSIS DEMO
 * Run this to test the complete pipeline
 */

import { storage } from './server/storage';
import { realAnalysisEngine } from './server/services/realAnalysisEngine';

async function runRealAnalysisDemo() {
  const dealId = 30;
  
  console.log(`🎯 REAL ANALYSIS DEMO - Deal ${dealId}`);
  console.log('='.repeat(50));
  
  try {
    // Step 1: Check initial state
    console.log(`\n📋 STEP 1: Checking initial data for Deal ${dealId}...`);
    const documents = await storage.getDocumentsByDealId(dealId);
    const existingAnalyses = await storage.getAnalysesByDealId(dealId);
    
    console.log(`📄 Documents: ${documents.length}`);
    documents.forEach(doc => {
      const ocrLength = (doc.ocrText || '').length;
      console.log(`  - ${doc.name}: ${ocrLength} chars OCR`);
    });
    
    console.log(`🔍 Existing analyses: ${existingAnalyses.length}`);
    existingAnalyses.forEach(analysis => {
      console.log(`  - ${analysis.agentType}: ${analysis.status} (${analysis.progress}%)`);
    });
    
    // Step 2: Run real analysis
    console.log(`\n🚀 STEP 2: Running REAL comprehensive analysis...`);
    const runId = await realAnalysisEngine.startComprehensiveAnalysis(dealId);
    console.log(`✅ Analysis started with run ID: ${runId}`);
    
    // Step 3: Check final results
    console.log(`\n📊 STEP 3: Checking results...`);
    const newAnalyses = await storage.getAnalysesByDealId(dealId);
    console.log(`🔍 Total analyses after run: ${newAnalyses.length}`);
    
    for (const analysis of newAnalyses) {
      console.log(`\n🤖 ${analysis.agentType} Agent Analysis:`);
      console.log(`   Status: ${analysis.status}`);
      console.log(`   Progress: ${analysis.progress}%`);
      
      // Check findings
      const findings = Array.isArray(analysis.findings) ? analysis.findings : JSON.parse(analysis.findings || '[]');
      console.log(`   Findings: ${findings.length}`);
      
      if (findings.length > 0) {
        console.log(`   Sample Finding: ${findings[0]?.content?.substring(0, 150)}...`);
        if (findings[0]?.sources) {
          console.log(`   Sources: ${findings[0].sources.join(', ')}`);
        }
      }
      
      // Check agent-specific answers
      const agentAnswers = 
        analysis.legal_answers || 
        analysis.clinical_answers || 
        analysis.commercial_answers || 
        analysis.hr_answers || 
        analysis.financial_answers || 
        analysis.ip_answers || 
        analysis.research_answers;
        
      if (agentAnswers) {
        const answerCount = Object.keys(agentAnswers).length;
        console.log(`   Agent Answers: ${answerCount}`);
        
        // Show first answer
        const firstAnswerKey = Object.keys(agentAnswers)[0];
        if (firstAnswerKey && agentAnswers[firstAnswerKey]) {
          const firstAnswer = agentAnswers[firstAnswerKey];
          console.log(`   Sample Answer (${firstAnswerKey}):`);
          console.log(`     ${firstAnswer.answer?.substring(0, 200)}...`);
          if (firstAnswer.sources) {
            console.log(`     Sources: ${firstAnswer.sources.length} docs`);
          }
          if (firstAnswer.quotes) {
            console.log(`     Quotes: ${firstAnswer.quotes.length}`);
          }
        }
      }
    }
    
    // Step 4: Generate acceptance report
    console.log(`\n📋 STEP 4: Generating acceptance report...`);
    const report = await realAnalysisEngine.generateAcceptanceReport(dealId);
    console.log(report);
    
    console.log(`\n🎯 DEMO COMPLETED SUCCESSFULLY!`);
    
  } catch (error) {
    console.error(`❌ Demo failed:`, error);
    console.error(error.stack);
  }
}

// Run if called directly
runRealAnalysisDemo().then(() => {
  console.log(`\n✅ Demo complete`);
  process.exit(0);
}).catch(error => {
  console.error(`❌ Demo failed:`, error);
  process.exit(1);
});

export { runRealAnalysisDemo };