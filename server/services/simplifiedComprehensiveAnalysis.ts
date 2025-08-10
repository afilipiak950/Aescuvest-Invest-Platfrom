import { storage } from '../storage';

/**
 * SIMPLIFIED COMPREHENSIVE ANALYSIS
 * 
 * Implements the core E2E analysis functionality by triggering proper
 * individual agent analyses for all assigned documents
 */

export async function runSimplifiedComprehensiveAnalysis(dealId: number) {
  console.log(`🚀 Starting simplified comprehensive analysis for deal ${dealId}`);
  
  try {
    // 1. Clear existing analysis results (truth reset)
    await performTruthReset(dealId);
    
    // 2. Get all documents for the deal
    const documents = await storage.getDocumentsByDealId(dealId);
    console.log(`📄 Found ${documents.length} documents for deal ${dealId}`);
    
    // 3. Trigger proper analysis for each agent with the correct question mapping
    const agents = ['Legal', 'Clinical', 'Commercial', 'HR', 'Financial', 'IP', 'Research'];
    
    for (const agentType of agents) {
      console.log(`🔄 Starting ${agentType} analysis...`);
      
      try {
        // Generate proper structured answers using the existing service
        const { generateStructuredQuestionAnswers } = await import('./structuredQuestionAnswering');
        
        const structuredAnswers = await generateStructuredQuestionAnswers(
          dealId,
          agentType,
          documents.map(doc => ({
            content: doc.ocrText || doc.extractedText || '',
            score: 1.0,
            index: doc.id,
            metadata: {
              documentId: doc.id,
              documentName: doc.name,
              snippet: (doc.ocrText || doc.extractedText || '').substring(0, 200)
            }
          }))
        );
        
        // Update agent analysis with the structured answers
        const existingAnalysis = await storage.getAnalysesByDealId(dealId);
        const agentAnalysis = existingAnalysis.find(a => a.agentType === agentType);
        
        const answersField = `${agentType.toLowerCase()}Answers`;
        const updateData: any = {
          status: 'Completed',
          progress: 100,
          combinedAnswers: JSON.stringify(structuredAnswers)
        };
        updateData[answersField] = JSON.stringify(structuredAnswers);
        
        if (agentAnalysis) {
          await storage.updateAnalysis(agentAnalysis.id, updateData);
        } else {
          await storage.createAnalysis({
            dealId,
            agentType,
            findings: '[]',
            recommendations: '[]',
            status: 'Completed',
            progress: 100,
            ...updateData
          });
        }
        
        console.log(`✅ ${agentType} analysis completed with structured answers`);
        
      } catch (error) {
        console.error(`❌ ${agentType} analysis failed:`, error);
        
        // Update status to reflect failure
        const existingAnalysis = await storage.getAnalysesByDealId(dealId);
        const agentAnalysis = existingAnalysis.find(a => a.agentType === agentType);
        
        if (agentAnalysis) {
          await storage.updateAnalysis(agentAnalysis.id, {
            status: 'Failed',
            progress: 0
          });
        }
      }
    }
    
    console.log('🎉 Simplified comprehensive analysis completed!');
    
  } catch (error) {
    console.error('❌ Comprehensive analysis failed:', error);
    throw error;
  }
}

async function performTruthReset(dealId: number) {
  console.log(`🔥 Truth reset: Clearing analysis outputs for deal ${dealId}`);
  
  const existingAnalyses = await storage.getAnalysesByDealId(dealId);
  
  for (const analysis of existingAnalyses) {
    await storage.updateAnalysis(analysis.id, {
      findings: '[]',
      recommendations: '[]',
      status: 'Waiting',
      progress: 0,
      legalAnswers: null,
      clinicalAnswers: null,
      commercialAnswers: null,
      hrAnswers: null,
      financialAnswers: null,
      ipAnswers: null,
      researchAnswers: null,
      combinedAnswers: null
    });
  }
  
  console.log(`✅ Truth reset completed for ${existingAnalyses.length} analyses`);
}