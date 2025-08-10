/**
 * COMPREHENSIVE E2E ANALYSIS TEST
 * 
 * This script tests the new comprehensive analysis system 
 * to ensure all agents get proper document×question coverage
 */

import { runSimplifiedComprehensiveAnalysis } from './server/services/simplifiedComprehensiveAnalysis';

async function testComprehensiveAnalysis() {
  console.log('🧪 Testing comprehensive E2E analysis system...');
  
  const testDealId = 33; // Deal with 377 documents
  
  try {
    console.log(`🚀 Starting comprehensive analysis test for deal ${testDealId}`);
    await runSimplifiedComprehensiveAnalysis(testDealId);
    
    console.log('✅ Comprehensive analysis test completed successfully!');
    
  } catch (error) {
    console.error('❌ Comprehensive analysis test failed:', error);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  testComprehensiveAnalysis()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test script failed:', error);
      process.exit(1);
    });
}

export { testComprehensiveAnalysis };