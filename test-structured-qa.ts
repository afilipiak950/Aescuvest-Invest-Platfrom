/**
 * Test Script: Structured Q&A Regression Fix
 * 
 * Tests the fix for duplicated answers, missing sources & quotes
 * Verifies that each agent generates unique Q&A with proper metadata
 */

import { StructuredQuestionAnswering } from './server/services/structuredQuestionAnswering';

const testDocuments = [
  {
    id: 1,
    name: 'Legal_Shareholders_Agreement.pdf',
    extractedText: `
      SHAREHOLDERS AGREEMENT
      
      This agreement defines the following share classes:
      - Class A Common Shares: Voting rights, 1 vote per share
      - Class B Preferred Shares: Liquidation preference 2x, anti-dilution protection
      
      LIQUIDATION PREFERENCES:
      In the event of liquidation, Class B shareholders receive 2x their investment before
      any distributions to Class A shareholders.
      
      ANTI-DILUTION PROTECTION:
      Class B shares include weighted-average anti-dilution protection in case of
      down rounds or dilutive events.
      
      BOARD COMPOSITION:
      The board shall consist of 5 directors:
      - 2 appointed by Class A shareholders
      - 2 appointed by Class B shareholders  
      - 1 independent director
    `
  },
  {
    id: 2, 
    name: 'Clinical_Trial_Protocol.pdf',
    extractedText: `
      PHASE II CLINICAL TRIAL PROTOCOL
      
      STUDY DESIGN:
      Randomized, double-blind, placebo-controlled study evaluating safety and efficacy
      of Drug X in patients with chronic condition Y.
      
      PRIMARY ENDPOINTS:
      - Safety: Incidence of treatment-emergent adverse events (TEAEs)
      - Efficacy: 30% reduction in symptom score from baseline at week 12
      
      PATIENT POPULATION:
      Target enrollment: 200 patients aged 18-65 with confirmed diagnosis of condition Y
      and failed response to standard therapy.
      
      INCLUSION CRITERIA:
      - Age 18-65 years
      - Confirmed diagnosis of condition Y
      - Stable on standard therapy for ≥3 months
      
      EXCLUSION CRITERIA:
      - Pregnancy or nursing
      - Significant cardiac, hepatic, or renal disease
      - Participation in another clinical trial within 30 days
    `
  },
  {
    id: 3,
    name: 'Financial_Projections.pdf', 
    extractedText: `
      FINANCIAL PROJECTIONS 2024-2027
      
      REVENUE MODEL:
      - SaaS subscription: $50-200/month per user
      - Enterprise licenses: $10,000-50,000/year
      - Professional services: $150/hour
      
      MARKET SIZE:
      Total Addressable Market (TAM): $2.5B
      Serviceable Addressable Market (SAM): $500M
      Serviceable Obtainable Market (SOM): $50M by 2027
      
      FUNDING HISTORY:
      - Seed round: $2M (2022)
      - Series A: $8M (2023) 
      - Current burn rate: $500K/month
      - Runway: 18 months
      
      KEY ASSUMPTIONS:
      - Customer acquisition cost (CAC): $1,500
      - Lifetime value (LTV): $12,000
      - LTV/CAC ratio: 8:1
    `
  }
];

async function testStructuredQA() {
  console.log('🧪 Testing Structured Q&A Regression Fix\n');
  
  const qaService = new StructuredQuestionAnswering();
  
  // Test different agents to ensure no duplication
  const agents = ['Legal', 'Clinical', 'Financial'];
  
  for (const agentType of agents) {
    console.log(`\n🤖 Testing ${agentType} Agent:`);
    console.log('='.repeat(40));
    
    try {
      const answers = await qaService.generateAllAnswersForAgent(agentType, testDocuments);
      
      console.log(`✅ Generated ${Object.keys(answers).length} answers for ${agentType}`);
      
      // Verify each answer has required components
      for (const [questionId, answer] of Object.entries(answers)) {
        console.log(`\n📝 Question ${questionId}:`);
        console.log(`   Answer: ${answer.answer.substring(0, 100)}...`);
        console.log(`   Sources: ${answer.sources.length} (${answer.sources.map(s => s.title).join(', ')})`);
        console.log(`   Quotes: ${answer.quotes.length}`);
        console.log(`   Confidence: ${Math.round(answer.confidence * 100)}%`);
        
        // Validate schema
        if (!answer.answer || answer.sources.length === 0) {
          console.error(`❌ VALIDATION FAILED for ${agentType}.${questionId}: Missing answer or sources`);
        } else {
          console.log(`   ✅ Schema valid`);
        }
        
        // Check for unique sources per answer
        const uniqueSources = new Set(answer.sources.map(s => s.title));
        if (uniqueSources.size !== answer.sources.length) {
          console.warn(`⚠️ Duplicate sources found in ${agentType}.${questionId}`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Failed to test ${agentType} agent:`, error);
    }
  }
  
  // Test cache isolation between agents
  console.log('\n🔒 Testing Cache Isolation:');
  console.log('='.repeat(40));
  
  const legalAnswers1 = await qaService.generateAllAnswersForAgent('Legal', testDocuments);
  const legalAnswers2 = await qaService.generateAllAnswersForAgent('Legal', testDocuments);
  const clinicalAnswers = await qaService.generateAllAnswersForAgent('Clinical', testDocuments);
  
  console.log(`Legal answers 1: ${Object.keys(legalAnswers1).length}`);
  console.log(`Legal answers 2: ${Object.keys(legalAnswers2).length} (should be cached)`);
  console.log(`Clinical answers: ${Object.keys(clinicalAnswers).length} (should be different)`);
  
  // Check that legal answers are identical (cached) but clinical are different
  const legal1Keys = Object.keys(legalAnswers1).sort();
  const legal2Keys = Object.keys(legalAnswers2).sort();
  const clinicalKeys = Object.keys(clinicalAnswers).sort();
  
  if (JSON.stringify(legal1Keys) === JSON.stringify(legal2Keys)) {
    console.log('✅ Legal cache working correctly');
  } else {
    console.error('❌ Legal cache broken - different question sets');
  }
  
  if (JSON.stringify(legal1Keys) !== JSON.stringify(clinicalKeys)) {
    console.log('✅ Agent isolation working - different question sets');
  } else {
    console.warn('⚠️ Possible agent question overlap');
  }
  
  // Cache stats
  console.log('\n📊 Cache Stats:');
  const stats = qaService.getCacheStats();
  console.log(`Cache size: ${stats.size}`);
  console.log(`Sample keys: ${stats.keys.slice(0, 3).join(', ')}`);
  
  console.log('\n🎉 Test completed!');
}

// Run the test
testStructuredQA().catch(console.error);