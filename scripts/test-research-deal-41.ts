#!/usr/bin/env tsx

// Test script to trigger research for deal 41 and check document extraction
import { authenticResearchService } from '../server/services/authenticResearchService';
import { storage } from '../server/storage';

async function testResearchForDeal41() {
  console.log('=========================================');
  console.log('TESTING RESEARCH FOR DEAL 41');
  console.log('=========================================\n');
  
  const dealId = 41;
  
  try {
    // First check if deal 41 exists and has documents
    console.log('📋 Checking deal 41 status...');
    const deal = await storage.getDealById(dealId);
    
    if (!deal) {
      console.error('❌ Deal 41 not found!');
      return;
    }
    
    console.log(`✅ Deal found: ${deal.companyName}`);
    console.log(`📧 Website: ${deal.website || 'None'}`);
    
    // Check documents
    const documents = await storage.getDocumentsByDealId(dealId);
    console.log(`📄 Documents count: ${documents.length}`);
    
    if (documents.length > 0) {
      console.log('\n📚 Documents in deal:');
      documents.slice(0, 5).forEach((doc, i) => {
        console.log(`  ${i + 1}. ${doc.name}`);
        console.log(`     - Has OCR: ${doc.ocrText ? 'YES' : 'NO'}`);
        console.log(`     - OCR Length: ${doc.ocrText?.length || 0} chars`);
        console.log(`     - Has AI Summary: ${doc.aiSummary ? 'YES' : 'NO'}`);
      });
    }
    
    // Now trigger the research
    console.log('\n🔬 Starting research extraction...\n');
    const researchData = await authenticResearchService.conductComprehensiveResearch(dealId);
    
    console.log('\n=========================================');
    console.log('RESEARCH RESULTS');
    console.log('=========================================\n');
    
    console.log(`Company Name: ${researchData.companyName}`);
    console.log(`Sources: ${researchData.sources}`);
    console.log(`Confidence Score: ${researchData.aiConfidenceScore}`);
    
    console.log('\n👤 CEO Profile:');
    if (researchData.ceoProfile) {
      console.log(`  Name: ${researchData.ceoProfile.name}`);
      console.log(`  Background: ${researchData.ceoProfile.background}`);
    } else {
      console.log('  No CEO data extracted');
    }
    
    console.log('\n👥 Key Team Members:');
    if (researchData.keyTeamMembers && researchData.keyTeamMembers.length > 0) {
      researchData.keyTeamMembers.forEach((member, i) => {
        console.log(`  ${i + 1}. ${member.name} - ${member.role}`);
        console.log(`     Background: ${member.background}`);
      });
    } else {
      console.log('  No team members extracted');
    }
    
    console.log('\n💰 Financial Data:');
    if (researchData.financialData) {
      console.log(`  Revenue: ${researchData.financialData.revenue || 'Not found'}`);
      console.log(`  Employee Count: ${researchData.financialData.employeeCount || 'Not found'}`);
      if (researchData.financialData.fundingHistory && researchData.financialData.fundingHistory.length > 0) {
        console.log('  Funding History:');
        researchData.financialData.fundingHistory.forEach((round: any) => {
          console.log(`    - ${round.round}: ${round.amount} on ${round.date}`);
        });
      } else {
        console.log('  No funding history found');
      }
    } else {
      console.log('  No financial data extracted');
    }
    
    console.log('\n🤝 Business Intelligence:');
    if (researchData.businessIntelligence) {
      console.log(`  Partnerships: ${researchData.businessIntelligence.partnerships?.join(', ') || 'None'}`);
      console.log(`  Patents: ${researchData.businessIntelligence.patents || 0}`);
      console.log(`  Technology Stack: ${researchData.businessIntelligence.technologyStack?.join(', ') || 'None'}`);
    } else {
      console.log('  No business intelligence extracted');
    }
    
    console.log('\n=========================================\n');
    
    // Check if the extracted data matches what we expect
    const expectedCEO = 'Sarah Johnson';
    const expectedFunding = '$5M';
    
    console.log('📊 VALIDATION:');
    
    const ceoMatch = researchData.ceoProfile?.name?.includes(expectedCEO) || 
                      researchData.keyTeamMembers?.some(m => m.name.includes(expectedCEO));
    console.log(`  ✅ CEO Sarah Johnson found: ${ceoMatch ? 'YES ✅' : 'NO ❌'}`);
    
    const fundingMatch = JSON.stringify(researchData.financialData).includes('5M') || 
                         JSON.stringify(researchData.financialData).includes('5 million');
    console.log(`  ✅ $5M funding found: ${fundingMatch ? 'YES ✅' : 'NO ❌'}`);
    
    const companyNameMatch = researchData.companyName.includes('TechVentures') || 
                             researchData.companyName.includes('AI Inc');
    console.log(`  ✅ Company name correct: ${companyNameMatch ? 'YES ✅' : 'NO ❌'}`);
    
    console.log('\n✨ Test completed!\n');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    process.exit(0);
  }
}

// Run the test
testResearchForDeal41();