/**
 * CHECK DATABASE CONTENTS
 * 
 * Verify what's actually in the database after the emergency save
 */

import { storage } from './server/storage';

async function checkDatabaseContents() {
  console.log('🔍 CHECKING DATABASE CONTENTS');
  console.log('============================');
  
  const dealId = 33;
  
  try {
    // Get all analyses for the deal
    const analyses = await storage.getAnalysesByDealId(dealId);
    console.log(`📊 Total analyses found: ${analyses.length}`);
    
    if (analyses.length > 0) {
      console.log('\n📋 ANALYSIS DETAILS:');
      
      analyses.forEach((analysis, i) => {
        console.log(`\n${i + 1}. Analysis ID: ${analysis.id}`);
        console.log(`   Agent Type: ${analysis.agentType}`);
        console.log(`   Status: ${analysis.status}`);
        console.log(`   Completed At: ${analysis.completedAt}`);
        console.log(`   Run ID: ${analysis.runId}`);
        
        // Check the answers field
        const agentType = analysis.agentType.toLowerCase();
        const answersField = `${agentType}_answers`;
        const answers = analysis[answersField];
        
        if (answers && typeof answers === 'object') {
          const answerKeys = Object.keys(answers);
          console.log(`   Answers Field: ${answersField}`);
          console.log(`   Answer Count: ${answerKeys.length}`);
          
          if (answerKeys.length > 0) {
            console.log(`   Questions: ${answerKeys.join(', ')}`);
            
            // Show first answer sample
            const firstAnswer = answers[answerKeys[0]];
            if (firstAnswer && firstAnswer.answer) {
              console.log(`   Sample Answer: ${firstAnswer.answer.substring(0, 100)}...`);
              console.log(`   Sample Confidence: ${firstAnswer.confidence}%`);
              console.log(`   Sample Sources: ${firstAnswer.sources?.length || 0}`);
            }
          }
        } else {
          console.log(`   ❌ No answers found in field: ${answersField}`);
        }
      });
      
      // Test the Legal agent specifically
      console.log('\n🏛️ LEGAL AGENT SPECIFIC CHECK:');
      const legalAnalysis = await storage.getAnalysisByDealAndAgent(dealId, 'Legal');
      
      if (legalAnalysis) {
        console.log(`✅ Legal analysis found (ID: ${legalAnalysis.id})`);
        console.log(`Status: ${legalAnalysis.status}`);
        
        const legalAnswers = legalAnalysis.legal_answers;
        if (legalAnswers) {
          const questionCount = Object.keys(legalAnswers).length;
          console.log(`Legal answers: ${questionCount} questions`);
          
          if (questionCount > 0) {
            console.log('✅ SUCCESS: Legal analysis has answers in database!');
            Object.keys(legalAnswers).forEach(questionId => {
              const answer = legalAnswers[questionId];
              console.log(`  ${questionId}: ${answer.answer?.length || 0} chars`);
            });
          } else {
            console.log('❌ Legal analysis exists but has no answers');
          }
        } else {
          console.log('❌ Legal analysis has no legal_answers field');
        }
      } else {
        console.log('❌ No Legal analysis found');
      }
      
    } else {
      console.log('❌ No analyses found in database');
    }
    
  } catch (error) {
    console.error('❌ Database check failed:', error);
  }
}

// Run check
checkDatabaseContents()
  .then(() => console.log('\n✅ Database check complete'))
  .catch(error => console.error('❌ Check error:', error));