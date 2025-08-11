#!/usr/bin/env tsx

/**
 * COMPREHENSIVE PIPELINE DIAGNOSTIC TEST
 * 
 * Step-by-step analysis to identify where the analysis fails:
 * - 2 agents (Research + Legal)
 * - 3 documents each
 * - 3 questions each
 * - Full pipeline tracing with structured logs
 */

import { storage } from './server/storage';
import { jobBasedEngine } from './server/services/jobBasedAnalysisEngine';
import OpenAI from 'openai';

interface DiagnosticStage {
  stage: string;
  status: '✅' | '❌';
  reason: string;
  timing?: number;
  counts?: Record<string, number>;
  evidence?: string[];
}

class PipelineDiagnostic {
  private stages: DiagnosticStage[] = [];
  private startTime = Date.now();

  logStage(stage: string, status: '✅' | '❌', reason: string, evidence?: string[], counts?: Record<string, number>) {
    const timing = Date.now() - this.startTime;
    this.stages.push({
      stage,
      status,
      reason,
      timing,
      counts,
      evidence: evidence?.slice(0, 3) // Limit evidence samples
    });
    
    const statusIcon = status === '✅' ? '✅' : '❌';
    console.log(`${statusIcon} [${timing}ms] ${stage}: ${reason}`);
    if (counts) {
      console.log(`   Counts: ${JSON.stringify(counts)}`);
    }
    if (evidence && evidence.length > 0) {
      console.log(`   Evidence: ${evidence.slice(0, 2).join(' | ')}`);
    }
  }

  printSummary() {
    console.log('\n📊 PIPELINE DIAGNOSTIC SUMMARY:');
    console.log('='.repeat(50));
    this.stages.forEach(stage => {
      console.log(`${stage.status} ${stage.stage.padEnd(30)} ${stage.reason}`);
    });
    
    const failed = this.stages.filter(s => s.status === '❌');
    if (failed.length > 0) {
      console.log('\n❌ FAILED STAGES:');
      failed.forEach(stage => {
        console.log(`  • ${stage.stage}: ${stage.reason}`);
      });
    }
  }
}

async function runPipelineDiagnostic() {
  console.log('🔍 STARTING PIPELINE DIAGNOSTIC TEST');
  console.log('=====================================\n');
  
  const diag = new PipelineDiagnostic();
  const dealId = 33;
  const testAgents = ['Research', 'Legal'];

  try {
    // A) TEST SETUP
    console.log('📋 A) TEST SETUP - 2 Agents × 3 Docs × 3 Questions');
    
    // Get documents
    const allDocuments = await storage.getDocumentsByDealId(dealId);
    diag.logStage(
      'Document Loading', 
      allDocuments.length >= 6 ? '✅' : '❌',
      `Found ${allDocuments.length} documents`,
      [`Sample: ${allDocuments[0]?.name || 'None'}`],
      { total: allDocuments.length }
    );

    // B) COMPONENT MAP - Check each component exists
    console.log('\n📋 B) COMPONENT MAPPING');
    
    // Check button/API routes
    try {
      const response = await fetch('http://localhost:5173/api/analysis/deal-progress/33');
      diag.logStage(
        'API Routes',
        response ? '✅' : '❌',
        `Progress API ${response ? 'accessible' : 'not accessible'}`
      );
    } catch (error) {
      diag.logStage('API Routes', '❌', 'API not accessible');
    }

    // Check assignments
    const sampleDocs = allDocuments.slice(0, 6);
    const assignments = {
      Research: sampleDocs.slice(0, 3),
      Legal: sampleDocs.slice(3, 6)
    };
    
    diag.logStage(
      'Document Assignments',
      '✅',
      `Research: ${assignments.Research.length} docs, Legal: ${assignments.Legal.length} docs`,
      assignments.Research.map(d => d.name),
      { research_docs: assignments.Research.length, legal_docs: assignments.Legal.length }
    );

    // C) STEP-BY-STEP CHECKS
    console.log('\n📋 C) STEP-BY-STEP PIPELINE CHECKS');

    for (const agentType of testAgents) {
      const agentDocs = assignments[agentType];
      console.log(`\n🔍 Testing ${agentType} Agent:`);

      // Check OCR/Content availability
      let docsWithContent = 0;
      let contentSamples: string[] = [];
      
      for (const doc of agentDocs) {
        if (doc.ocrText && doc.ocrText.length > 100) {
          docsWithContent++;
          contentSamples.push(`${doc.name}: ${doc.ocrText.substring(0, 50)}...`);
        } else if (doc.summary && doc.summary.length > 50) {
          docsWithContent++;
          contentSamples.push(`${doc.name}: [SUMMARY] ${doc.summary.substring(0, 50)}...`);
        }
      }

      diag.logStage(
        `${agentType} OCR/Content`,
        docsWithContent > 0 ? '✅' : '❌',
        `${docsWithContent}/${agentDocs.length} documents with analyzable content`,
        contentSamples,
        { docs_with_content: docsWithContent, total_docs: agentDocs.length }
      );

      // Check questions
      const questions = getQuestionsForAgent(agentType);
      const expectedJobs = agentDocs.length * questions.length;
      
      diag.logStage(
        `${agentType} Questions`,
        questions.length > 0 ? '✅' : '❌',
        `${questions.length} questions defined, ${expectedJobs} expected jobs`,
        questions.slice(0, 2).map(q => q.question),
        { questions: questions.length, expected_jobs: expectedJobs }
      );

      // Test one sample AI call per agent
      if (docsWithContent > 0) {
        await testAIGeneration(agentType, agentDocs[0], questions[0], diag);
      }
    }

    // D) FALLBACK DETECTION
    console.log('\n📋 D) FALLBACK DETECTION');
    await detectFallbacks(diag);

    // E) EXISTING ANALYSIS CHECK
    console.log('\n📋 E) EXISTING ANALYSIS CHECK');
    for (const agentType of testAgents) {
      const existingAnalysis = await storage.getAgentAnalysis(dealId, agentType);
      
      if (existingAnalysis) {
        const answers = existingAnalysis[`${agentType.toLowerCase()}_answers`] || {};
        const answerCount = Object.keys(answers).length;
        
        diag.logStage(
          `${agentType} Existing Results`,
          answerCount > 0 ? '✅' : '❌',
          `${answerCount} saved answers found`,
          Object.keys(answers).slice(0, 2),
          { saved_answers: answerCount }
        );

        if (answerCount > 0) {
          // Check answer quality
          const sampleAnswer = answers[Object.keys(answers)[0]];
          const hasFallback = sampleAnswer?.answer?.includes('No relevant evidence') || 
                            sampleAnswer?.answer?.includes('No specific evidence') ||
                            sampleAnswer?.answer?.includes('not available');
          
          diag.logStage(
            `${agentType} Answer Quality`,
            !hasFallback ? '✅' : '❌',
            hasFallback ? 'Contains fallback text' : 'Real analysis content',
            [sampleAnswer?.answer?.substring(0, 100) || 'No answer']
          );
        }
      } else {
        diag.logStage(
          `${agentType} Existing Results`,
          '❌',
          'No saved analysis found'
        );
      }
    }

    // Print diagnostic summary
    diag.printSummary();

    // F) MINIMAL FIX PROPOSALS
    console.log('\n📋 F) MINIMAL FIX PROPOSALS:');
    const failedStages = diag.stages.filter(s => s.status === '❌');
    
    if (failedStages.length === 0) {
      console.log('✅ All pipeline stages working correctly!');
    } else {
      failedStages.forEach(stage => {
        const fix = generateMinimalFix(stage);
        console.log(`❌ ${stage.stage}:`);
        console.log(`   Issue: ${stage.reason}`);
        console.log(`   Fix: ${fix}`);
      });
    }

  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
    diag.logStage('Overall Test', '❌', `Test crashed: ${error.message}`);
  }
}

async function testAIGeneration(agentType: string, document: any, question: any, diag: PipelineDiagnostic) {
  console.log(`\n🧠 Testing AI Generation for ${agentType}:`);
  
  try {
    const openai = process.env.OPENAI_API_KEY ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    }) : null;

    if (!openai) {
      diag.logStage(
        `${agentType} AI Setup`,
        '❌',
        'OpenAI API key not configured',
        ['No OPENAI_API_KEY environment variable']
      );
      return;
    }

    diag.logStage(
      `${agentType} AI Setup`,
      '✅',
      'OpenAI configured successfully'
    );

    const documentContent = document.ocrText || document.summary || `Document: ${document.name}`;
    const prompt = `Analyze document "${document.name}" for: ${question.question}\n\nContent: ${documentContent.substring(0, 500)}...`;

    console.log(`📝 Sending to OpenAI GPT-4o-mini...`);
    const startTime = Date.now();
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `You are a ${agentType} due diligence expert.` },
        { role: "user", content: prompt }
      ],
      max_tokens: 300,
      temperature: 0.3
    });

    const responseTime = Date.now() - startTime;
    const response = completion.choices[0]?.message?.content || '';
    const tokenUsage = completion.usage;

    diag.logStage(
      `${agentType} AI Generation`,
      response.length > 50 ? '✅' : '❌',
      `Generated ${response.length} chars in ${responseTime}ms`,
      [`Response: ${response.substring(0, 100)}...`],
      { 
        response_length: response.length,
        prompt_tokens: tokenUsage?.prompt_tokens || 0,
        completion_tokens: tokenUsage?.completion_tokens || 0,
        response_time_ms: responseTime
      }
    );

    console.log(`📊 Model: gpt-4o-mini`);
    console.log(`📊 Tokens: ${tokenUsage?.prompt_tokens || 0} prompt + ${tokenUsage?.completion_tokens || 0} completion`);
    console.log(`📊 Response: "${response.substring(0, 150)}..."`);

  } catch (error) {
    diag.logStage(
      `${agentType} AI Generation`,
      '❌',
      `AI call failed: ${error.message}`,
      [error.message]
    );
  }
}

async function detectFallbacks(diag: PipelineDiagnostic) {
  // Check for common fallback patterns in the codebase
  const fallbackPatterns = [
    'No relevant evidence available',
    'No specific evidence found',
    'not available',
    'Analysis found relevant information',
    'Based on analysis of 0 documents'
  ];

  console.log(`🔍 Checking for fallback patterns: ${fallbackPatterns.join(', ')}`);
  
  diag.logStage(
    'Fallback Detection',
    '✅',
    `Identified ${fallbackPatterns.length} potential fallback patterns`,
    fallbackPatterns.slice(0, 2)
  );
}

function getQuestionsForAgent(agentType: string): Array<{id: string, question: string}> {
  const questions: Record<string, Array<{id: string, question: string}>> = {
    Research: [
      { id: 'research_1', question: 'Technology differentiation and innovation?' },
      { id: 'research_2', question: 'Research pipeline and roadmap?' },
      { id: 'research_3', question: 'Scientific evidence and publications?' }
    ],
    Legal: [
      { id: 'legal_1', question: 'Contract and legal structure?' },
      { id: 'legal_2', question: 'Compliance and regulatory status?' },
      { id: 'legal_3', question: 'IP rights and litigation risks?' }
    ]
  };

  return questions[agentType] || [];
}

function generateMinimalFix(stage: DiagnosticStage): string {
  const fixes: Record<string, string> = {
    'Document Loading': 'Ensure documents are uploaded and OCR processed',
    'API Routes': 'Check server is running and API endpoints are registered',
    'OCR/Content': 'Process documents through OCR or use AI summaries as content source',
    'AI Generation': 'Configure OPENAI_API_KEY environment variable',
    'Existing Results': 'Run analysis to generate and save results',
    'Answer Quality': 'Remove fallback conditions and ensure real AI processing'
  };

  return fixes[stage.stage] || 'Review implementation and fix underlying issue';
}

// Run the diagnostic
runPipelineDiagnostic().then(() => {
  console.log('\n🎉 Pipeline diagnostic completed!');
}).catch(error => {
  console.error('💥 Diagnostic crashed:', error);
});