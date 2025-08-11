/**
 * FORCE CACHE REFRESH
 * 
 * Clear all caches and force fresh data retrieval to show the legal analysis answers
 */

import { storage } from './server/storage';

async function forceCacheRefresh() {
  console.log('🧹 FORCING CACHE REFRESH');
  console.log('========================');
  
  const dealId = 33;
  
  try {
    // 1. Clear all possible caches
    console.log('\n1. CLEARING ALL CACHES:');
    
    // Clear analysis cache
    await storage.invalidateAnalysisCache(dealId);
    console.log('✅ Cleared analysis cache');
    
    // Clear document cache  
    await storage.invalidateDocumentCache(dealId);
    console.log('✅ Cleared document cache');
    
    // 2. Verify current database state
    console.log('\n2. VERIFYING DATABASE STATE:');
    
    const analysis = await storage.getAnalysisByDealAndAgent(dealId, 'Legal');
    if (analysis) {
      console.log(`✅ Legal analysis found (ID: ${analysis.id})`);
      console.log(`Status: ${analysis.status}`);
      console.log(`Progress: ${analysis.progress}%`);
      
      // Check legal_answers field specifically
      if (analysis.legal_answers && typeof analysis.legal_answers === 'object') {
        const answerKeys = Object.keys(analysis.legal_answers);
        console.log(`✅ Legal answers field has ${answerKeys.length} questions: ${answerKeys.join(', ')}`);
        
        // Show sample answer
        if (answerKeys.length > 0) {
          const firstAnswer = analysis.legal_answers[answerKeys[0]];
          console.log(`Sample answer length: ${firstAnswer?.answer?.length || 0} characters`);
          console.log(`Sample confidence: ${firstAnswer?.confidence || 0}%`);
        }
      } else {
        console.log('❌ Legal answers field is null or invalid');
      }
      
      // Check other fields
      const findingsCount = analysis.findings ? (Array.isArray(analysis.findings) ? analysis.findings.length : String(analysis.findings).length) : 0;
      const recommendationsCount = analysis.recommendations ? (Array.isArray(analysis.recommendations) ? analysis.recommendations.length : String(analysis.recommendations).length) : 0;
      
      console.log(`Findings: ${findingsCount} items/chars`);
      console.log(`Recommendations: ${recommendationsCount} items/chars`);
    } else {
      console.log('❌ No legal analysis found');
      return;
    }
    
    // 3. Test fresh API calls
    console.log('\n3. TESTING FRESH API CALLS:');
    
    // Get fresh analysis data
    const freshAnalyses = await storage.getAnalysesByDealId(dealId);
    console.log(`Fresh analyses query returned: ${freshAnalyses.length} analyses`);
    
    const freshLegalAnalysis = freshAnalyses.find(a => a.agentType === 'Legal');
    if (freshLegalAnalysis) {
      console.log('✅ Fresh legal analysis retrieved');
      
      // Check if legal_answers is properly returned
      const hasLegalAnswers = freshLegalAnalysis.legal_answers && 
        typeof freshLegalAnalysis.legal_answers === 'object' &&
        Object.keys(freshLegalAnalysis.legal_answers).length > 0;
        
      console.log(`Has legal_answers: ${hasLegalAnswers}`);
      
      if (hasLegalAnswers) {
        console.log('🎉 SUCCESS: Legal answers are available in fresh API call!');
        const questionCount = Object.keys(freshLegalAnalysis.legal_answers).length;
        console.log(`Question count: ${questionCount}`);
      } else {
        console.log('❌ Legal answers still not available in fresh API call');
      }
    }
    
    console.log('\n✅ CACHE REFRESH COMPLETE');
    console.log('The UI should now refresh and show the legal analysis answers.');
    
  } catch (error) {
    console.error('❌ Cache refresh failed:', error);
  }
}

// Run cache refresh
forceCacheRefresh()
  .then(() => console.log('\n🎉 Cache refresh completed'))
  .catch(error => console.error('❌ Cache refresh error:', error));