/**
 * Complete Real Analysis Test with Full Results Display
 */

import { storage } from './server/storage';
import { realAnalysisEngine } from './server/services/realAnalysisEngine';

async function showCompleteResults() {
  const dealId = 30;
  
  console.log(`🎯 COMPLETE REAL ANALYSIS RESULTS - Deal ${dealId}`);
  console.log('='.repeat(80));
  
  try {
    // Get all analyses
    const analyses = await storage.getAnalysesByDealId(dealId);
    console.log(`\n📊 Total Analyses: ${analyses.length}`);
    
    for (const analysis of analyses) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🤖 ${analysis.agentType.toUpperCase()} AGENT ANALYSIS`);
      console.log(`${'='.repeat(60)}`);
      console.log(`Status: ${analysis.status}`);
      console.log(`Progress: ${analysis.progress}%`);
      console.log(`Created: ${analysis.createdAt}`);
      
      // Check findings
      const findings = Array.isArray(analysis.findings) ? analysis.findings : JSON.parse(analysis.findings || '[]');
      console.log(`\n📋 FINDINGS: ${findings.length}`);
      
      findings.forEach((finding, index) => {
        console.log(`\n${index + 1}. ${finding.content}`);
        if (finding.sources) {
          console.log(`   📄 Sources: ${finding.sources.join(', ')}`);
        }
        if (finding.evidence) {
          console.log(`   🔍 Evidence: ${finding.evidence.substring(0, 200)}...`);
        }
      });
      
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
        const answerKeys = Object.keys(agentAnswers);
        console.log(`\n💬 STRUCTURED ANSWERS: ${answerKeys.length}`);
        
        answerKeys.forEach((questionKey, index) => {
          const answer = agentAnswers[questionKey];
          console.log(`\n${index + 1}. Question: ${questionKey}`);
          console.log(`   Answer: ${answer.answer}`);
          if (answer.sources) {
            console.log(`   📄 Sources: ${answer.sources.length} documents`);
            answer.sources.forEach(source => {
              console.log(`     - ${source.document} (page ${source.page})`);
            });
          }
          if (answer.quotes) {
            console.log(`   💬 Quotes: ${answer.quotes.length}`);
            answer.quotes.forEach(quote => {
              console.log(`     "${quote.text}" - ${quote.source}`);
            });
          }
          if (answer.confidence) {
            console.log(`   🎯 Confidence: ${answer.confidence}%`);
          }
        });
      }
    }
    
    // Generate acceptance report
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📋 ACCEPTANCE REPORT`);
    console.log(`${'='.repeat(80)}`);
    
    const report = await realAnalysisEngine.generateAcceptanceReport(dealId);
    console.log(report);
    
  } catch (error) {
    console.error(`❌ Test failed:`, error);
  }
}

// Run immediately
showCompleteResults().then(() => {
  console.log(`\n✅ Test complete`);
  process.exit(0);
}).catch(error => {
  console.error(`❌ Test failed:`, error);
  process.exit(1);
});