import { comprehensiveClaudeResearch } from './server/services/comprehensiveClaudeResearch';

async function testAescuvestResearch() {
  try {
    console.log('🔍 Testing comprehensive Claude research for Aescuvest...');
    
    const researchData = await comprehensiveClaudeResearch.conductDeepResearch(
      22,
      'Aescuvest',
      'https://www.aescuvest.vc/'
    );
    
    console.log('\n✅ Research completed successfully!');
    console.log('📊 CEO Profile:', JSON.stringify(researchData.ceoProfile, null, 2));
    console.log('💰 Financial Data:', JSON.stringify(researchData.financialInsights, null, 2));
    console.log('🔗 External Sources:', JSON.stringify(researchData.externalSources, null, 2));
    console.log('🏢 Business Intelligence:', JSON.stringify(researchData.businessIntelligence, null, 2));
    console.log('⚡ Investment Highlights:', JSON.stringify(researchData.investmentHighlights, null, 2));
    console.log('⚠️ Risk Assessment:', JSON.stringify(researchData.riskAssessment, null, 2));
    
  } catch (error) {
    console.error('❌ Research test failed:', error);
    console.error('Error details:', error instanceof Error ? error.stack : error);
  }
}

testAescuvestResearch();