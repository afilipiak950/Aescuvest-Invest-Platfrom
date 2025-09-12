// Test script to trigger document-based research extraction
import { DocumentBasedResearchService } from './server/services/documentBasedResearchService.js';
import { storage } from './server/storage.js';

async function testResearchExtraction() {
  const dealId = 41;
  console.log(`\n=== TESTING DOCUMENT-BASED RESEARCH EXTRACTION FOR DEAL ${dealId} ===\n`);
  
  try {
    // Get deal information
    const deal = await storage.getDealById(dealId);
    if (!deal) {
      console.error(`Deal ${dealId} not found`);
      return;
    }
    console.log(`Deal: ${deal.companyName}`);
    
    // Get documents for the deal
    const documents = await storage.getDocumentsWithOCRByDealId(dealId);
    console.log(`Found ${documents.length} documents with OCR content\n`);
    
    // Extract research from documents
    const researchService = DocumentBasedResearchService.getInstance();
    const researchData = await researchService.extractResearchFromDocuments(dealId);
    
    console.log('\n=== EXTRACTED RESEARCH DATA ===\n');
    console.log(`Company Name: ${researchData.companyName}`);
    console.log(`Extracted from Documents: ${researchData.extractedFromDocuments}`);
    console.log(`Document Count: ${researchData.documentCount}`);
    
    console.log(`\nExecutives (${researchData.executives.length}):`);
    researchData.executives.forEach(exec => {
      console.log(`  - ${exec.name}: ${exec.title} (from: ${exec.source})`);
    });
    
    console.log(`\nAdvisory Board (${researchData.advisoryBoard.length}):`);
    researchData.advisoryBoard.forEach(advisor => {
      console.log(`  - ${advisor.name}: ${advisor.role} (from: ${advisor.source})`);
    });
    
    console.log(`\nPartners (${researchData.partners.length}):`);
    researchData.partners.forEach(partner => {
      console.log(`  - ${partner.name}: ${partner.type} (from: ${partner.source})`);
    });
    
    console.log(`\nFinancial Information:`);
    if (researchData.financialInfo.fundingRounds) {
      console.log(`  Funding Rounds:`);
      researchData.financialInfo.fundingRounds.forEach(round => {
        console.log(`    - ${round.amount} on ${round.date} (from: ${round.source})`);
      });
    }
    if (researchData.financialInfo.revenue) {
      console.log(`  Revenue: ${researchData.financialInfo.revenue}`);
    }
    if (researchData.financialInfo.employeeCount) {
      console.log(`  Employee Count: ${researchData.financialInfo.employeeCount}`);
    }
    
    console.log(`\nTechnology:`);
    if (researchData.technology.products) {
      console.log(`  Products: ${researchData.technology.products.join(', ')}`);
    }
    if (researchData.technology.technologies) {
      console.log(`  Technologies: ${researchData.technology.technologies.join(', ')}`);
    }
    if (researchData.technology.patents) {
      console.log(`  Patents: ${researchData.technology.patents.join(', ')}`);
    }
    
    console.log(`\nLegal:`);
    if (researchData.legal.incorporationDetails) {
      console.log(`  Incorporation: ${researchData.legal.incorporationDetails}`);
    }
    if (researchData.legal.legalStructure) {
      console.log(`  Legal Structure: ${researchData.legal.legalStructure}`);
    }
    
    // Save research to database
    console.log('\n=== SAVING RESEARCH TO DATABASE ===\n');
    await storage.createOrUpdateCompanyResearch(dealId, {
      ...researchData,
      researchStatus: 'completed',
      researchCompletedAt: new Date()
    });
    console.log('Research saved successfully!');
    
    // Verify it was saved
    const savedResearch = await storage.getCompanyResearchByDealId(dealId);
    if (savedResearch) {
      console.log(`\n✅ VERIFICATION: Research successfully saved for ${savedResearch.companyName}`);
      console.log(`   Status: ${savedResearch.researchStatus}`);
    }
    
  } catch (error) {
    console.error('Error during research extraction:', error);
  } finally {
    process.exit(0);
  }
}

// Run the test
testResearchExtraction();