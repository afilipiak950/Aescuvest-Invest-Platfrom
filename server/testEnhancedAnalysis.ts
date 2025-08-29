/**
 * Test script for enhanced analysis system
 */

import { startEnhancedLegalAnalysis } from './enhancedLegalAnalysisService';

async function testEnhancedAnalysis() {
  try {
    console.log('🧪 Testing enhanced legal analysis with deal 22...');
    await startEnhancedLegalAnalysis(22);
    console.log('✅ Enhanced legal analysis test completed!');
  } catch (error) {
    console.error('❌ Enhanced analysis test failed:', error);
  }
}

// Run the test
testEnhancedAnalysis();