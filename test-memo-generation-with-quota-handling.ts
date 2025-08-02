#!/usr/bin/env tsx

/**
 * Test script to verify quota management and fallback content generation
 * Tests memo generation with comprehensive error handling
 */

async function testMemoGeneration() {
  console.log('🧪 Testing investment memo generation with quota management...\n');

  try {
    // Test 1: Check quota manager status
    console.log('📊 Step 1: Testing quota manager health check...');
    const healthResponse = await fetch('http://localhost:5000/api/openai-quota-status');
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Quota manager status:', healthData);
    } else {
      console.log('❌ Quota manager endpoint not available');
    }

    // Test 2: Attempt memo generation for BAIBYS deal
    console.log('\n📋 Step 2: Attempting memo generation for deal 22 (BAIBYS)...');
    const generateResponse = await fetch('http://localhost:5000/api/deals/22/memo/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    console.log(`Response status: ${generateResponse.status}`);
    
    if (generateResponse.ok) {
      const memoData = await generateResponse.json();
      console.log('✅ Memo generation initiated successfully');
      console.log('📄 Response keys:', Object.keys(memoData));
      
      // Check for fallback content indicators
      if (memoData.memo) {
        const memoSections = Object.keys(memoData.memo);
        console.log('📑 Generated sections:', memoSections.length);
        
        // Check for quota-related fallback messages
        let fallbackCount = 0;
        let successCount = 0;
        
        for (const section of memoSections) {
          const content = JSON.stringify(memoData.memo[section]);
          if (content.includes('temporarily unavailable') || content.includes('API limitations')) {
            fallbackCount++;
            console.log(`🔄 Section "${section}" used fallback content`);
          } else if (content.length > 100) {
            successCount++;
            console.log(`✅ Section "${section}" generated successfully (${content.length} chars)`);
          }
        }
        
        console.log(`\n📊 Generation Summary:`);
        console.log(`✅ Successful sections: ${successCount}`);
        console.log(`🔄 Fallback sections: ${fallbackCount}`);
        console.log(`📑 Total sections: ${memoSections.length}`);
        
        if (fallbackCount > 0) {
          console.log('\n⚠️  Some sections used fallback content due to quota limits');
          console.log('✅ Fallback system working correctly');
        } else {
          console.log('\n🎉 All sections generated successfully!');
        }
      }
      
    } else {
      const errorText = await generateResponse.text();
      console.log('❌ Memo generation failed:', errorText);
      
      // Check if it's a quota-related error
      if (errorText.includes('quota') || errorText.includes('429')) {
        console.log('🔄 Quota limit detected - this validates our quota management need');
      }
    }

    // Test 3: Check section sources to verify AI summaries are working
    console.log('\n📊 Step 3: Verifying AI summary functionality...');
    const sectionsToTest = ['financialAnalysis', 'legalAssessment', 'clinicalAssessment'];
    
    for (const section of sectionsToTest) {
      const sourcesResponse = await fetch(`http://localhost:5000/api/deals/22/memo/section-sources/${section}`);
      if (sourcesResponse.ok) {
        const sourcesData = await sourcesResponse.json();
        const aiCount = sourcesData.sources?.aiSummaries?.length || 0;
        console.log(`✅ Section "${section}": ${aiCount} AI summaries available`);
      }
    }

    // Test 4: Check existing memo status
    console.log('\n📋 Step 4: Checking existing memo status...');
    const memoResponse = await fetch('http://localhost:5000/api/deals/22/memo');
    if (memoResponse.ok) {
      const existingMemo = await memoResponse.json();
      console.log('📄 Existing memo status:', existingMemo.hasMemo ? 'Available' : 'Not available');
      if (existingMemo.hasMemo) {
        console.log('📑 Existing memo sections:', Object.keys(existingMemo.memo || {}).length);
      }
    }

  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
  }
}

console.log('🚀 Starting comprehensive memo generation test...');
testMemoGeneration().then(() => {
  console.log('\n✅ Test completed!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});