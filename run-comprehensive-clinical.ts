/**
 * Direct runner for comprehensive clinical analysis
 * Ensures all 11 clinical questions are properly generated
 */

import { comprehensiveClinicalAnalysisService } from './server/comprehensiveClinicalAnalysisService';

async function runComprehensiveClinicalAnalysis() {
  const dealId = 33;
  
  console.log(`🧬 Starting comprehensive clinical analysis for deal ${dealId}`);
  console.log(`🎯 This will analyze ALL assigned documents and generate answers for 11 clinical questions`);
  
  try {
    const result = await comprehensiveClinicalAnalysisService.startComprehensiveAnalysis(dealId);
    
    console.log(`✅ Analysis completed successfully:`);
    console.log(`   - Documents analyzed: ${result.documentsAnalyzed}`);
    console.log(`   - Questions answered: ${result.questionsAnswered}`);
    console.log(`   - Findings generated: ${result.findings}`);
    console.log(`   - Recommendations: ${result.recommendations}`);
    
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error running comprehensive clinical analysis:`, error);
    process.exit(1);
  }
}

runComprehensiveClinicalAnalysis();