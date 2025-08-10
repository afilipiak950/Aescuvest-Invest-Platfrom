#!/usr/bin/env tsx

import { storage } from './server/storage';

async function triggerIPAnalysis() {
  try {
    console.log('🚀 Starting IP agent analysis for deal 33...');
    
    // Reset IP analysis first
    await storage.deleteAgentAnalysis(33, 'IP');
    console.log('🧹 Cleared existing IP analysis');
    
    // Get documents for the deal  
    const documents = await storage.getDocuments(33);
    console.log(`📄 Found ${documents.length} documents for deal 33`);
    
    if (documents.length === 0) {
      console.log('❌ No documents found - cannot run IP analysis');
      return;
    }
    
    // Create a new IP analysis record
    const analysisId = await storage.createAgentAnalysis({
      dealId: 33,
      agentType: 'IP',
      status: 'Started',
      progress: 0,
      findings: [],
      recommendations: []
    });
    
    console.log(`✅ Created IP analysis record with ID: ${analysisId}`);
    console.log('📊 IP analysis has been initiated. The enterprise job queue will process the documents.');
    console.log('🔄 You can monitor progress in the UI by checking the IP tab.');
    
  } catch (error) {
    console.error('❌ Failed to trigger IP analysis:', error);
  }
}

// Run the function
triggerIPAnalysis();