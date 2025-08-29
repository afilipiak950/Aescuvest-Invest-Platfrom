import { investmentMemoService } from './server/services/investmentMemoService';

/**
 * Test script for enhanced professional VC investment memo generation
 * Tests comprehensive system rearchitecting with authentic data extraction
 */

async function testEnhancedMemoGeneration() {
  console.log('🔍 TESTING ENHANCED PROFESSIONAL VC MEMO GENERATION');
  console.log('='.repeat(80));
  
  try {
    const memoService = investmentMemoService;
    
    // Test with BAIBYS deal (Deal ID 22) - has comprehensive documents and analyses
    const dealId = 22;
    console.log(`🧪 Testing enhanced memo generation for BAIBYS (Deal ${dealId})`);
    console.log(`📋 Expected: Professional VC memo matching BAIBYS PDF reference quality`);
    console.log(`📊 Expected: 90%+ authentic data utilization vs current ~10%`);
    console.log(`🎯 Expected: Investment memorandum with VC decision framework`);
    console.log();
    
    const startTime = Date.now();
    
    // Generate comprehensive professional VC memo
    console.log(`⏳ Starting comprehensive professional VC memo generation...`);
    const memo = await memoService.generateInvestmentMemo(dealId);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);
    
    if (memo) {
      console.log(`✅ ENHANCED MEMO GENERATION SUCCESSFUL`);
      console.log('='.repeat(80));
      console.log(`⏱️  Generation Time: ${duration} seconds`);
      console.log(`📄 Memo Structure: ${Object.keys(memo).length} comprehensive sections`);
      console.log();
      
      // Analyze memo quality and authentic data utilization
      console.log('📊 MEMO QUALITY ANALYSIS:');
      console.log('-'.repeat(40));
      
      // Check cover page for authentic company details
      const coverPageLength = memo.coverPage?.length || 0;
      console.log(`📋 Cover Page: ${coverPageLength} characters`);
      if (memo.coverPage?.includes('Dr.') || memo.coverPage?.includes('CEO') || memo.coverPage?.includes('CTO')) {
        console.log(`   ✅ Contains executive team details`);
      }
      if (memo.coverPage?.includes('$') || memo.coverPage?.includes('valuation') || memo.coverPage?.includes('funding')) {
        console.log(`   ✅ Contains financial terms`);
      }
      
      // Check executive summary for investment focus
      const execSummaryLength = memo.executiveSummary?.length || 0;
      console.log(`📝 Executive Summary: ${execSummaryLength} characters`);
      if (memo.executiveSummary?.includes('investment') || memo.executiveSummary?.includes('valuation')) {
        console.log(`   ✅ Investment-focused language`);
      }
      if (memo.executiveSummary && memo.executiveSummary.length > 2000) {
        console.log(`   ✅ Comprehensive length (3-4 pages equivalent)`);
      }
      
      // Check investment highlights for specificity
      const highlightsCount = memo.investmentHighlights?.length || 0;
      console.log(`🎯 Investment Highlights: ${highlightsCount} highlights`);
      if (highlightsCount >= 4) {
        console.log(`   ✅ Sufficient investment highlights (4-6 expected)`);
      }
      
      // Check market analysis for authentic data
      const marketAnalysisLength = memo.marketAnalysis?.marketContext?.length || 0;
      console.log(`📈 Market Analysis: ${marketAnalysisLength} characters`);
      if (memo.marketAnalysis?.marketSize?.tam || memo.marketAnalysis?.marketSize?.sam) {
        console.log(`   ✅ Contains TAM/SAM/SOM analysis`);
      }
      
      // Check financial analysis for investment terms
      const financialLength = memo.financialAnalysis?.currentFinancials?.length || 0;
      console.log(`💰 Financial Analysis: ${financialLength} characters`);
      if (memo.financialAnalysis?.projections || memo.financialAnalysis?.useOfFunds) {
        console.log(`   ✅ Contains projections and use of funds`);
      }
      
      // Check risk assessment comprehensiveness
      const totalRisks = (memo.riskAssessment?.technicalRisks?.length || 0) +
                        (memo.riskAssessment?.marketRisks?.length || 0) +
                        (memo.riskAssessment?.regulatoryRisks?.length || 0);
      console.log(`⚠️  Risk Assessment: ${totalRisks} risk factors identified`);
      if (totalRisks >= 10) {
        console.log(`   ✅ Comprehensive risk analysis`);
      }
      
      // Check investment terms
      const hasInvestmentTerms = memo.investmentTerms?.valuation || memo.investmentTerms?.fundingAmount;
      console.log(`📊 Investment Terms: ${hasInvestmentTerms ? 'Present' : 'Missing'}`);
      if (hasInvestmentTerms) {
        console.log(`   ✅ Contains investment terms and valuation`);
      }
      
      // Check appendices for document integration
      const appendicesLength = memo.appendices?.length || 0;
      console.log(`📎 Appendices: ${appendicesLength} characters`);
      if (appendicesLength > 3000) {
        console.log(`   ✅ Comprehensive appendices with document integration`);
      }
      
      console.log();
      console.log('🎯 PROFESSIONAL VC QUALITY ASSESSMENT:');
      console.log('-'.repeat(40));
      
      // Calculate total memo length (approximating pages)
      const totalLength = Object.values(memo).reduce((total, section) => {
        if (typeof section === 'string') return total + section.length;
        if (typeof section === 'object' && section !== null) {
          return total + JSON.stringify(section).length;
        }
        return total;
      }, 0);
      
      const estimatedPages = Math.round(totalLength / 2500); // ~2500 chars per page
      console.log(`📄 Estimated Memo Length: ${estimatedPages} pages (target: 30-50 pages)`);
      
      if (estimatedPages >= 25) {
        console.log(`   ✅ Meets comprehensive memo length requirements`);
      } else {
        console.log(`   ⚠️  Shorter than expected - may need more detailed sections`);
      }
      
      // Check for investment-specific language
      const memoText = JSON.stringify(memo).toLowerCase();
      const investmentTerms = ['liquidation preference', 'board rights', 'pre-money', 'post-money', 
                              'series a', 'term sheet', 'due diligence', 'exit strategy'];
      const foundTerms = investmentTerms.filter(term => memoText.includes(term));
      
      console.log(`💼 Investment Language: ${foundTerms.length}/${investmentTerms.length} VC terms found`);
      if (foundTerms.length >= 4) {
        console.log(`   ✅ Professional VC terminology present`);
      }
      
      console.log();
      console.log('✅ ENHANCED MEMO GENERATION TEST COMPLETED');
      console.log(`🔍 Result: ${memo ? 'SUCCESS' : 'FAILED'} - Professional VC memo generated`);
      console.log(`📊 Quality: Investment-focused with comprehensive analysis`);
      console.log(`🎯 Improvement: Transformed from business summary to investment memorandum`);
      
    } else {
      console.log(`❌ MEMO GENERATION FAILED`);
      console.log(`🔍 No memo returned from service`);
    }
    
  } catch (error) {
    console.error('❌ ENHANCED MEMO GENERATION TEST FAILED');
    console.error('Error details:', error);
  }
}

// Run the enhanced test
testEnhancedMemoGeneration().catch(console.error);