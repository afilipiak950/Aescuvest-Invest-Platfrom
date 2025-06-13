import { evaluateCompanyByDeal } from './server/services/aiEvaluation.js';

async function testAIEvaluation() {
  try {
    console.log('🤖 Testing enhanced AI evaluation for deal 23 (Healthily)...');
    
    const evaluation = await evaluateCompanyByDeal(23);
    
    console.log('✅ Evaluation completed successfully!');
    console.log('Overall Score:', evaluation.overallScore);
    console.log('Recommendation:', evaluation.recommendation);
    console.log('Summary:', evaluation.summary);
    console.log('Criterion Scores:', evaluation.criterionScores.map(c => ({
      criterion: c.criterion,
      score: c.score,
      reasoning: c.reasoning.substring(0, 100) + '...'
    })));
    console.log('Key Findings:', evaluation.keyFindings);
    console.log('Red Flags:', evaluation.redFlags);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAIEvaluation();