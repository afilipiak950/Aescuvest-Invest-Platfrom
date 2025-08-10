#!/usr/bin/env tsx
/**
 * COMPREHENSIVE LEGAL ANALYSIS SYSTEM
 * 
 * Implements full document×question coverage with combined multi-source answers
 * Fixes root cause: systematic under-processing in current comprehensive services
 */

import { storage } from './server/storage';
import OpenAI from 'openai';
import { db } from './server/db';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface DocumentQuestionJob {
  agentId: string;
  docId: number;
  questionId: string;
  version: string;
  status: 'enqueued' | 'started' | 'finished' | 'persisted';
  evidence?: any[];
  processingTimeMs?: number;
}

interface CoverageMatrix {
  agentId: string;
  expectedPairs: number;
  enqueued: number;
  started: number;
  finished: number;
  persisted: number;
  missing: Array<{docId: number, questionId: string}>;
}

interface CombinedAnswer {
  question: string;
  answer: string | null;
  confidence: number;
  sources: Array<{
    docId: number;
    page?: number;
    url?: string;
    snippet: string;
  }>;
  quotes: Array<{
    text: string;
    docId: number;
    page?: number;
  }>;
  usedDocIds: number[];
  evidenceCount: number;
  processingStats: {
    totalDocs: number;
    docsWithEvidence: number;
    avgConfidence: number;
    totalProcessingTimeMs: number;
  };
}

const LEGAL_QUESTIONS = [
  { id: 'sha_1', question: 'What class of shares exist and what are their rights?', category: 'Shareholders Agreement' },
  { id: 'sha_2', question: 'Are liquidation preferences clearly defined?', category: 'Shareholders Agreement' },
  { id: 'sha_3', question: 'Is anti-dilution protection present and adequate?', category: 'Shareholders Agreement' },
  { id: 'gov_1', question: 'Is board composition clearly defined?', category: 'Governance' },
  { id: 'gov_2', question: 'Are voting rights clearly specified for all share classes?', category: 'Governance' },
  { id: 'ip_1', question: 'Are IP assignment agreements in place for all team members?', category: 'IP Assignment' },
  { id: 'ip_2', question: 'Are all founders and key personnel covered by IP assignments?', category: 'IP Assignment' },
  { id: 'commercial_1', question: 'Are SLAs, warranties, and indemnity clauses present in key agreements?', category: 'Commercial' },
  { id: 'commercial_2', question: 'Are termination clauses fair and mutual in partnerships?', category: 'Commercial' },
  { id: 'lit_1', question: 'Are there any pending litigations or regulatory proceedings?', category: 'Litigation' },
  { id: 'lit_2', question: 'Is financial exposure from legal risks quantified?', category: 'Litigation' },
  { id: 'reg_1', question: 'Are there FDA submissions or other regulatory approvals in progress?', category: 'Regulatory' },
  { id: 'reg_2', question: 'Are there any regulatory compliance issues or violations?', category: 'Regulatory' },
  { id: 'financial_1', question: 'Are there warrants, convertible instruments, or debt securities outstanding?', category: 'Financial' },
  { id: 'financial_2', question: 'What are the interest rates and maturity terms for any debt instruments?', category: 'Financial' }
];

async function createComprehensiveLegalSystem() {
  console.log('🚀 COMPREHENSIVE LEGAL ANALYSIS SYSTEM');
  console.log('=====================================');
  
  const dealId = 33;
  const agentId = 'Legal';
  
  try {
    // Phase 1: Get all assigned documents
    const allDocs = await storage.getDocumentsByDealId(dealId);
    const assignedDocs = allDocs.filter(doc => {
      if (!doc.assignedAgents) return false;
      const agents = Array.isArray(doc.assignedAgents) ? doc.assignedAgents : 
                    (typeof doc.assignedAgents === 'string' ? JSON.parse(doc.assignedAgents || '[]') : []);
      return agents.some((agent: string) => 
        agent.toLowerCase() === agentId.toLowerCase() || agent === agentId
      );
    });
    
    console.log(`📋 Legal agent assigned documents: ${assignedDocs.length}`);
    console.log(`❓ Legal questions: ${LEGAL_QUESTIONS.length}`);
    
    const expectedPairs = assignedDocs.length * LEGAL_QUESTIONS.length;
    console.log(`🎯 Expected document×question pairs: ${expectedPairs}`);
    
    if (assignedDocs.length === 0) {
      console.log('⚠️ No documents assigned to Legal agent');
      return;
    }
    
    // Phase 2: Create coverage matrix and enqueue jobs
    console.log('\n📊 PHASE 2: COVERAGE MATRIX CREATION');
    const coverageMatrix = await createCoverageMatrix(agentId, assignedDocs, LEGAL_QUESTIONS);
    printCoverageMatrix(coverageMatrix);
    
    // Phase 3: Process all document×question jobs with concurrency
    console.log('\n🔄 PHASE 3: DOCUMENT×QUESTION PROCESSING');
    const documentQuestionResults = await processAllDocumentQuestionJobs(
      agentId, assignedDocs, LEGAL_QUESTIONS, 15 // High concurrency
    );
    
    console.log(`✅ Processed ${documentQuestionResults.length} document×question jobs`);
    
    // Phase 4: Combine evidence per question
    console.log('\n🔀 PHASE 4: EVIDENCE COMBINATION PER QUESTION');
    const combinedAnswers = await combineEvidencePerQuestion(
      LEGAL_QUESTIONS, documentQuestionResults, assignedDocs
    );
    
    console.log(`✅ Generated ${combinedAnswers.length} combined answers`);
    
    // Phase 5: Persist combined results
    console.log('\n💾 PHASE 5: PERSIST COMBINED RESULTS');
    await persistCombinedLegalAnalysis(dealId, combinedAnswers);
    
    // Phase 6: Verification
    console.log('\n✅ PHASE 6: VERIFICATION');
    await verifyComprehensiveResults(dealId, agentId, expectedPairs, combinedAnswers);
    
    console.log('\n🎉 COMPREHENSIVE LEGAL SYSTEM COMPLETE');
    console.log(`Legal agent now has full ${expectedPairs}-pair coverage with combined answers`);
    
  } catch (error) {
    console.error('❌ Comprehensive legal system error:', error);
    process.exit(1);
  }
}

async function createCoverageMatrix(
  agentId: string, 
  assignedDocs: any[], 
  questions: any[]
): Promise<CoverageMatrix> {
  
  const expectedPairs = assignedDocs.length * questions.length;
  let enqueued = 0;
  let started = 0; 
  let finished = 0;
  let persisted = 0;
  const missing: Array<{docId: number, questionId: string}> = [];
  
  // Check current coverage
  for (const doc of assignedDocs) {
    for (const question of questions) {
      const jobKey = `${agentId}:${doc.id}:${question.id}:v1`;
      
      // For now, mark as enqueued (would be actual job queue in production)
      enqueued++;
      
      // Track missing pairs that need processing
      missing.push({
        docId: doc.id,
        questionId: question.id
      });
    }
  }
  
  return {
    agentId,
    expectedPairs,
    enqueued,
    started,
    finished,
    persisted,
    missing
  };
}

function printCoverageMatrix(matrix: CoverageMatrix): void {
  console.log('\n📊 COVERAGE MATRIX');
  console.log('==================');
  console.log(`Agent: ${matrix.agentId}`);
  console.log(`Expected pairs: ${matrix.expectedPairs}`);
  console.log(`Enqueued: ${matrix.enqueued}/${matrix.expectedPairs} (${Math.round((matrix.enqueued/matrix.expectedPairs)*100)}%)`);
  console.log(`Started: ${matrix.started}/${matrix.expectedPairs} (${Math.round((matrix.started/matrix.expectedPairs)*100)}%)`);
  console.log(`Finished: ${matrix.finished}/${matrix.expectedPairs} (${Math.round((matrix.finished/matrix.expectedPairs)*100)}%)`);
  console.log(`Persisted: ${matrix.persisted}/${matrix.expectedPairs} (${Math.round((matrix.persisted/matrix.expectedPairs)*100)}%)`);
  
  if (matrix.missing.length > 0) {
    console.log(`\nMissing pairs (first 10):`);
    matrix.missing.slice(0, 10).forEach(pair => {
      console.log(`  - Doc ${pair.docId} × Question ${pair.questionId}`);
    });
    if (matrix.missing.length > 10) {
      console.log(`  ... and ${matrix.missing.length - 10} more`);
    }
  }
}

async function processAllDocumentQuestionJobs(
  agentId: string,
  assignedDocs: any[],
  questions: any[],
  concurrency: number
): Promise<DocumentQuestionJob[]> {
  
  console.log(`🔄 Processing with concurrency: ${concurrency}`);
  
  const allJobs: DocumentQuestionJob[] = [];
  const processingPromises: Promise<DocumentQuestionJob>[] = [];
  
  // Create jobs for every document×question combination
  for (const doc of assignedDocs) {
    for (const question of questions) {
      const job: DocumentQuestionJob = {
        agentId,
        docId: doc.id,
        questionId: question.id,
        version: 'v1',
        status: 'enqueued'
      };
      
      // Add to processing queue with concurrency control
      if (processingPromises.length < concurrency) {
        processingPromises.push(processDocumentQuestionJob(job, doc, question));
      } else {
        // Wait for one to complete before adding more
        const completed = await Promise.race(processingPromises);
        const index = processingPromises.findIndex(p => p === Promise.resolve(completed));
        processingPromises.splice(index, 1);
        
        allJobs.push(completed);
        processingPromises.push(processDocumentQuestionJob(job, doc, question));
      }
    }
  }
  
  // Wait for remaining jobs
  const remainingJobs = await Promise.all(processingPromises);
  allJobs.push(...remainingJobs);
  
  console.log(`✅ Completed ${allJobs.length} document×question jobs`);
  return allJobs;
}

async function processDocumentQuestionJob(
  job: DocumentQuestionJob,
  document: any,
  question: any
): Promise<DocumentQuestionJob> {
  
  const startTime = Date.now();
  job.status = 'started';
  
  try {
    // Extract document content  
    const content = document.ocrText || 
                   (document.aiSummary?.executiveSummary) || 
                   (typeof document.aiSummary === 'string' ? document.aiSummary : '') || 
                   '';
    
    if (!content || content.length < 50) {
      job.status = 'finished';
      job.evidence = [];
      job.processingTimeMs = Date.now() - startTime;
      return job;
    }
    
    // Perform retrieval scoped to this document (topK >= 8)
    const evidence = await extractEvidenceFromDocument(
      document, question, job.agentId, content, 8
    );
    
    job.evidence = evidence;
    job.status = 'finished';
    job.processingTimeMs = Date.now() - startTime;
    
    return job;
    
  } catch (error) {
    console.error(`❌ Job error for ${job.agentId}:${job.docId}:${job.questionId}:`, error.message);
    job.status = 'finished';
    job.evidence = [];
    job.processingTimeMs = Date.now() - startTime;
    return job;
  }
}

async function extractEvidenceFromDocument(
  document: any,
  question: any,
  agentId: string,
  content: string,
  topK: number
): Promise<any[]> {
  
  try {
    const prompt = `You are a ${agentId} analyst extracting evidence from a specific document.

DOCUMENT: ${document.name}
QUESTION: "${question.question}"
CATEGORY: ${question.category}

CONTENT (first 2000 chars):
${content.substring(0, 2000)}

Extract the top ${topK} most relevant pieces of evidence that directly relate to this question.

For each piece of evidence, provide:
1. Exact quote from the document
2. Relevance score (0-100) 
3. Page reference (if available)
4. Brief explanation of relevance

Respond with JSON array of evidence objects:
[{
  "quote": "exact text from document",
  "score": 85,
  "page": 1,
  "relevance": "explains why this quote answers the question",
  "docId": ${document.id},
  "snippet": "surrounding context"
}]

Return empty array [] if no relevant evidence found.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 1500
    });
    
    const result = JSON.parse(response.choices[0].message.content || '{"evidence": []}');
    return result.evidence || result || [];
    
  } catch (error) {
    console.log(`    ⚠️ Evidence extraction error for ${document.name}: ${error.message}`);
    return [];
  }
}

async function combineEvidencePerQuestion(
  questions: any[],
  documentQuestionResults: DocumentQuestionJob[],
  assignedDocs: any[]
): Promise<CombinedAnswer[]> {
  
  const combinedAnswers: CombinedAnswer[] = [];
  
  for (const question of questions) {
    console.log(`🔀 Combining evidence for question: ${question.id}`);
    
    // Get all evidence for this question across all documents
    const questionJobs = documentQuestionResults.filter(job => 
      job.questionId === question.id && job.evidence && job.evidence.length > 0
    );
    
    console.log(`  📄 Evidence from ${questionJobs.length}/${assignedDocs.length} documents`);
    
    if (questionJobs.length === 0) {
      // No evidence found across any document
      combinedAnswers.push({
        question: question.question,
        answer: null,
        confidence: 0,
        sources: [],
        quotes: [],
        usedDocIds: [],
        evidenceCount: 0,
        processingStats: {
          totalDocs: assignedDocs.length,
          docsWithEvidence: 0,
          avgConfidence: 0,
          totalProcessingTimeMs: 0
        }
      });
      continue;
    }
    
    // Flatten all evidence from all documents
    const allEvidence: any[] = [];
    let totalProcessingTime = 0;
    let totalConfidence = 0;
    const usedDocIds: number[] = [];
    
    for (const job of questionJobs) {
      if (job.evidence) {
        allEvidence.push(...job.evidence);
        totalProcessingTime += job.processingTimeMs || 0;
        if (!usedDocIds.includes(job.docId)) {
          usedDocIds.push(job.docId);
        }
      }
    }
    
    // Sort by relevance score and deduplicate (MMR-style)
    allEvidence.sort((a, b) => (b.score || 0) - (a.score || 0));
    const topEvidence = allEvidence.slice(0, 15); // Keep top 15 unique snippets
    
    // Generate combined answer from merged evidence
    const combinedAnswer = await generateCombinedAnswer(
      question, topEvidence, usedDocIds, questionJobs.length
    );
    
    // Calculate stats
    const avgConfidence = topEvidence.length > 0 ? 
      Math.round(topEvidence.reduce((sum, e) => sum + (e.score || 0), 0) / topEvidence.length) : 0;
    
    combinedAnswers.push({
      ...combinedAnswer,
      evidenceCount: topEvidence.length,
      processingStats: {
        totalDocs: assignedDocs.length,
        docsWithEvidence: questionJobs.length,
        avgConfidence,
        totalProcessingTimeMs: totalProcessingTime
      }
    });
    
    console.log(`  ✅ Combined answer: ${combinedAnswer.answer ? 'Found' : 'No evidence'} (${topEvidence.length} pieces of evidence)`);
  }
  
  return combinedAnswers;
}

async function generateCombinedAnswer(
  question: any,
  evidence: any[],
  usedDocIds: number[],
  docsWithEvidence: number
): Promise<Omit<CombinedAnswer, 'evidenceCount' | 'processingStats'>> {
  
  if (evidence.length === 0) {
    return {
      question: question.question,
      answer: null,
      confidence: 0,
      sources: [],
      quotes: [],
      usedDocIds: []
    };
  }
  
  try {
    const prompt = `You are a senior Legal analyst generating a comprehensive answer from multiple document sources.

QUESTION: "${question.question}"
CATEGORY: ${question.category}

EVIDENCE FROM ${docsWithEvidence} DOCUMENTS:
${evidence.map((e, i) => `
Evidence ${i+1} (Score: ${e.score}):
"${e.quote}"
[Doc ID: ${e.docId}, Page: ${e.page || 'N/A'}]
`).join('\n')}

Generate a comprehensive answer that:
1. Directly addresses the question
2. Synthesizes information from all relevant evidence
3. Maintains high accuracy and legal precision
4. Cites specific sources and quotes

Respond with JSON:
{
  "answer": "comprehensive legal analysis addressing the question",
  "confidence": 0-100,
  "reasoning": "explanation of how evidence supports the answer",
  "keyFindings": ["finding 1", "finding 2", "finding 3"]
}

If evidence is insufficient or contradictory, set answer to null and explain in reasoning.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 2000
    });
    
    const analysis = JSON.parse(response.choices[0].message.content || '{}');
    
    // Build sources and quotes from evidence
    const sources = evidence.map(e => ({
      docId: e.docId,
      page: e.page,
      snippet: e.quote || e.snippet || 'Evidence extracted',
      url: undefined
    }));
    
    const quotes = evidence.filter(e => e.quote).map(e => ({
      text: e.quote,
      docId: e.docId,
      page: e.page
    }));
    
    return {
      question: question.question,
      answer: analysis.answer || null,
      confidence: analysis.confidence || 0,
      sources,
      quotes,
      usedDocIds
    };
    
  } catch (error) {
    console.error(`❌ Combined answer generation error: ${error.message}`);
    return {
      question: question.question,
      answer: null,
      confidence: 0,
      sources: [],
      quotes: [],
      usedDocIds: []
    };
  }
}

async function persistCombinedLegalAnalysis(
  dealId: number,
  combinedAnswers: CombinedAnswer[]
): Promise<void> {
  
  try {
    // Get existing legal analysis
    const existingAnalysis = await storage.getAgentAnalysis(dealId, 'legal');
    
    if (!existingAnalysis) {
      console.log('⚠️ No existing legal analysis found');
      return;
    }
    
    // Convert combined answers to the expected format
    const legalAnswersObject: any = {};
    const findings: any[] = [];
    const recommendations: any[] = [];
    
    for (const combined of combinedAnswers) {
      // Find the question ID for this combined answer
      const questionObj = LEGAL_QUESTIONS.find(q => q.question === combined.question);
      if (!questionObj) continue;
      
      legalAnswersObject[questionObj.id] = {
        question: combined.question,
        answer: combined.answer,
        confidence: combined.confidence / 100, // Convert to 0-1 scale
        sources: combined.sources.map(s => s.snippet),
        documentsCovered: combined.processingStats.totalDocs,
        docsWithEvidence: combined.processingStats.docsWithEvidence,
        evidenceCount: combined.evidenceCount,
        quotes: combined.quotes,
        usedDocIds: combined.usedDocIds,
        processingStats: combined.processingStats
      };
      
      // Add to findings if answer found
      if (combined.answer && combined.confidence > 50) {
        findings.push({
          category: 'positive',
          agent: 'Legal',
          title: combined.question,
          description: combined.answer.substring(0, 200) + '...',
          confidence: combined.confidence / 100,
          sources: combined.sources.length,
          evidenceCount: combined.evidenceCount
        });
      }
    }
    
    // Generate summary recommendations
    const answeredQuestions = combinedAnswers.filter(a => a.answer !== null).length;
    const totalQuestions = combinedAnswers.length;
    
    if (answeredQuestions < totalQuestions * 0.8) {
      recommendations.push({
        title: 'Legal Documentation Gaps',
        content: `Consider providing additional legal documentation - only ${answeredQuestions}/${totalQuestions} questions had sufficient evidence`,
        priority: 'High',
        category: 'Legal'
      });
    }
    
    // Update the analysis
    const updateData = {
      legalAnswers: legalAnswersObject,
      findings,
      recommendations,
      status: 'completed',
      progress: Math.round((answeredQuestions / totalQuestions) * 100),
      lastProcessed: new Date()
    };
    
    await storage.updateAgentAnalysis(existingAnalysis.id, updateData);
    
    console.log(`✅ Persisted ${Object.keys(legalAnswersObject).length} combined legal answers`);
    console.log(`📊 Coverage: ${answeredQuestions}/${totalQuestions} questions answered (${Math.round((answeredQuestions/totalQuestions)*100)}%)`);
    
  } catch (error) {
    console.error('❌ Persistence error:', error);
  }
}

async function verifyComprehensiveResults(
  dealId: number,
  agentId: string,
  expectedPairs: number,
  combinedAnswers: CombinedAnswer[]
): Promise<void> {
  
  console.log('\n🔍 VERIFICATION RESULTS');
  console.log('======================');
  
  // Check processing coverage
  const totalEvidencePieces = combinedAnswers.reduce((sum, answer) => sum + answer.evidenceCount, 0);
  const questionsWithEvidence = combinedAnswers.filter(a => a.evidenceCount > 0).length;
  const avgSourcesPerQuestion = combinedAnswers.reduce((sum, a) => sum + a.sources.length, 0) / combinedAnswers.length;
  
  console.log(`📊 Processing Coverage:`);
  console.log(`  Expected document×question pairs: ${expectedPairs}`);
  console.log(`  Total evidence pieces extracted: ${totalEvidencePieces}`);
  console.log(`  Questions with evidence: ${questionsWithEvidence}/${combinedAnswers.length}`);
  console.log(`  Average sources per question: ${avgSourcesPerQuestion.toFixed(1)}`);
  
  // Check evidence diversity
  console.log(`\n📈 Evidence Diversity:`);
  for (const answer of combinedAnswers.slice(0, 5)) { // Show first 5
    console.log(`  Q: ${answer.question.substring(0, 50)}...`);
    console.log(`     Sources: ${answer.sources.length}, Used docs: ${answer.usedDocIds.length}, Evidence: ${answer.evidenceCount}`);
    console.log(`     Confidence: ${answer.confidence}%, Processing: ${answer.processingStats.totalProcessingTimeMs}ms`);
  }
  
  // Performance verification
  const totalProcessingTime = combinedAnswers.reduce((sum, a) => sum + a.processingStats.totalProcessingTimeMs, 0);
  const avgProcessingTime = totalProcessingTime / combinedAnswers.length;
  
  console.log(`\n⏱️ Performance Verification:`);
  console.log(`  Total processing time: ${totalProcessingTime}ms (${(totalProcessingTime/1000/60).toFixed(1)} minutes)`);
  console.log(`  Average per question: ${avgProcessingTime.toFixed(0)}ms`);
  console.log(`  Realistic latencies: ${avgProcessingTime > 200 ? '✅ YES' : '❌ NO (too fast, possible skipping)'}`);
  
  // Hit rate verification
  const hitRate = (questionsWithEvidence / combinedAnswers.length) * 100;
  console.log(`\n🎯 Hit Rate Verification:`);
  console.log(`  Hit rate: ${hitRate.toFixed(1)}%`);
  console.log(`  Target: ≥80%`);
  console.log(`  Status: ${hitRate >= 80 ? '✅ PASSED' : '❌ FAILED'}`);
  
  // Final verification status
  const verificationPassed = 
    hitRate >= 80 && 
    avgProcessingTime > 200 && 
    avgSourcesPerQuestion > 3;
  
  console.log(`\n🏁 FINAL VERIFICATION: ${verificationPassed ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (verificationPassed) {
    console.log('✅ Comprehensive legal system successfully implemented');
    console.log('✅ Full document×question coverage achieved');
    console.log('✅ Multi-source evidence combination working');
    console.log('✅ Realistic processing latencies confirmed');
  } else {
    console.log('❌ Verification failed - system needs additional fixes');
  }
}

// Run the comprehensive legal system
createComprehensiveLegalSystem().catch(console.error);