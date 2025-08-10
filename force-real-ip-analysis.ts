#!/usr/bin/env tsx

/**
 * FORCE REAL IP ANALYSIS
 * Creates granular document×question jobs for actual AI processing
 */

import { storage } from './server/storage';
import { addEnterpriseJob } from './server/services/enterpriseJobQueue';

async function forceRealIPAnalysis() {
  const dealId = 33;
  const agentType = 'IP';
  
  try {
    console.log('🚀 FORCING REAL IP ANALYSIS - No more fallbacks!');
    
    // 1. Get all documents for the deal
    const documents = await storage.getDocuments(dealId);
    const assignedDocs = documents.filter(doc => 
      doc.assignedAgents?.includes(agentType) || 
      doc.assignedAgents?.includes(agentType.toLowerCase())
    );
    
    console.log(`📄 Found ${assignedDocs.length} documents assigned to IP agent out of ${documents.length} total`);
    
    if (assignedDocs.length === 0) {
      console.log('❌ No documents assigned to IP agent - cannot run analysis');
      return;
    }
    
    // 2. Define all IP questions (matching frontend)
    const IP_QUESTIONS = [
      { id: 'patents_1', category: 'Patents', question: 'In what jurisdictions are patents filed (US, EU, China, Japan)?' },
      { id: 'patents_2', category: 'Patents', question: 'What is the status of patent applications (granted, pending, abandoned)?' },
      { id: 'patents_3', category: 'Patents', question: 'What is the remaining duration of patent protection?' },
      { id: 'patents_4', category: 'Patents', question: 'Has a freedom to operate (FTO) analysis been conducted?' },
      { id: 'trademarks_1', category: 'Trademarks', question: 'What Nice classes do the trademarks cover for protection?' },
      { id: 'trademarks_2', category: 'Trademarks', question: 'Have there been any opposition proceedings or disputes filed?' },
      { id: 'trademarks_3', category: 'Trademarks', question: 'What are the renewal and maintenance requirements?' },
      { id: 'trademarks_4', category: 'Trademarks', question: 'Are there plans for brand extension or geographical expansion?' },
      { id: 'licenses_1', category: 'Licenses', question: 'Are the licenses exclusive or non-exclusive?' },
      { id: 'licenses_2', category: 'Licenses', question: 'What are the royalty rates and payment terms?' },
      { id: 'licenses_3', category: 'Licenses', question: 'Are sublicensing rights granted or restricted?' },
      { id: 'licenses_4', category: 'Licenses', question: 'What are the termination clauses and conditions?' },
      { id: 'source_code_1', category: 'Source Code Ownership', question: 'What percentage of code is developed in-house vs third-party components?' },
      { id: 'source_code_2', category: 'Source Code Ownership', question: 'What open-source licenses are used (GPL, MIT, Apache)?' },
      { id: 'source_code_3', category: 'Source Code Ownership', question: 'Are there clear policies for employee-created IP?' },
      { id: 'source_code_4', category: 'Source Code Ownership', question: 'Are all code contributions properly documented and assigned?' }
    ];
    
    console.log(`🎯 Creating granular jobs for ${IP_QUESTIONS.length} questions × ${assignedDocs.length} documents = ${IP_QUESTIONS.length * assignedDocs.length} jobs`);
    
    // 3. Delete existing IP analysis to force fresh start
    const existingAnalyses = await storage.getAnalysesByDealId(dealId);
    for (const analysis of existingAnalyses) {
      if (analysis.agentType === agentType) {
        await storage.deleteAnalysis(analysis.id);
        console.log(`🗑️ Deleted existing IP analysis ${analysis.id}`);
      }
    }
    
    // 4. Create new IP analysis record
    const analysisId = await storage.createAgentAnalysis({
      dealId,
      agentType,
      status: 'Processing',
      progress: 0,
      findings: [],
      recommendations: []
    });
    console.log(`✅ Created new IP analysis record: ${analysisId}`);
    
    // 5. Create granular document×question jobs
    let jobsCreated = 0;
    for (const doc of assignedDocs) {
      for (const question of IP_QUESTIONS) {
        const jobData = {
          dealId,
          agentType,
          documentId: doc.id,
          questionId: question.id,
          question: question.question,
          category: question.category,
          analysisId,
          priority: 'high',
          timestamp: Date.now()
        };
        
        try {
          await addEnterpriseJob('document_question_analysis', jobData, {
            priority: 1,
            attempts: 3,
            backoff: 'exponential'
          });
          jobsCreated++;
        } catch (error) {
          console.error(`❌ Failed to create job for doc ${doc.id} question ${question.id}:`, error);
        }
      }
    }
    
    console.log(`🎯 Successfully created ${jobsCreated} granular analysis jobs`);
    console.log(`📊 Coverage: ${assignedDocs.length} docs × ${IP_QUESTIONS.length} questions = ${jobsCreated} jobs`);
    console.log('🔄 Jobs will process with real document analysis - no more fallbacks!');
    console.log('💡 Monitor progress in the IP tab - you should see real analysis results');
    
  } catch (error) {
    console.error('❌ Failed to force real IP analysis:', error);
  }
}

// Run the analysis
forceRealIPAnalysis();