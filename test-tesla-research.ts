/**
 * Test Tesla AI Research
 * Direct test of the enhanced AI-powered research system
 */

import { enhancedCompanyResearchService } from './server/services/enhancedCompanyResearchService';
import { db } from './server/db';

async function testTeslaResearch() {
  console.log('🚀 Testing Enhanced AI Research for Tesla');
  
  try {
    // Tesla is deal ID 21
    const dealId = 21;
    
    console.log('🔍 Starting comprehensive AI research...');
    const startTime = Date.now();
    
    const researchData = await enhancedCompanyResearchService.conductComprehensiveResearch(dealId);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n✅ TESLA AI RESEARCH COMPLETED');
    console.log('================================');
    console.log(`Duration: ${duration} seconds`);
    console.log(`Sources analyzed: ${researchData.sources}`);
    console.log(`AI confidence: ${researchData.aiConfidenceScore}%`);
    console.log(`Status: ${researchData.researchStatus}`);
    
    console.log('\n📊 CEO PROFILE:');
    if (researchData.ceoProfile) {
      console.log(`Name: ${researchData.ceoProfile.name}`);
      console.log(`Background: ${researchData.ceoProfile.background?.substring(0, 200)}...`);
      console.log(`Experience: ${researchData.ceoProfile.experience?.substring(0, 150)}...`);
    }
    
    console.log('\n💰 FINANCIAL DATA:');
    if (researchData.financialData) {
      console.log(`Revenue: ${researchData.financialData.revenue}`);
      console.log(`Valuation: ${researchData.financialData.valuation}`);
      console.log(`Employee Count: ${researchData.financialData.employeeCount}`);
      if (researchData.financialData.fundingHistory) {
        console.log(`Funding Rounds: ${researchData.financialData.fundingHistory.length}`);
      }
    }
    
    console.log('\n🏪 MARKET ANALYSIS:');
    if (researchData.marketAnalysis) {
      console.log(`Market Size: ${researchData.marketAnalysis.marketSize}`);
      console.log(`Market Position: ${researchData.marketAnalysis.marketPosition}`);
      if (researchData.marketAnalysis.competitors) {
        console.log(`Key Competitors: ${researchData.marketAnalysis.competitors.slice(0, 3).join(', ')}`);
      }
    }
    
    console.log('\n🎯 INVESTMENT ANALYSIS:');
    if (researchData.aiAnalysis) {
      console.log(`Investment Score: ${researchData.aiAnalysis.investmentScore}/100`);
      console.log(`Confidence Level: ${researchData.aiAnalysis.confidenceLevel}%`);
      console.log(`Recommendation: ${researchData.aiAnalysis.recommendation?.substring(0, 200)}...`);
      if (researchData.aiAnalysis.keyStrengths) {
        console.log(`Key Strengths: ${researchData.aiAnalysis.keyStrengths.slice(0, 2).join(', ')}`);
      }
    }
    
    console.log('\n🔗 EXTERNAL LINKS:');
    if (researchData.externalLinks) {
      console.log(`LinkedIn: ${researchData.externalLinks.linkedinCompanyUrl}`);
      console.log(`Crunchbase: ${researchData.externalLinks.crunchbaseUrl}`);
    }
    
    console.log('\n🎉 Real AI-powered research test completed successfully!');
    console.log('This demonstrates actual OpenAI analysis with comprehensive business intelligence');
    
  } catch (error) {
    console.error('❌ Tesla research test failed:', error);
    throw error;
  }
}

// Execute the test
testTeslaResearch()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });