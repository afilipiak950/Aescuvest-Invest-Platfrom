#!/usr/bin/env tsx

/**
 * Background Legal Analysis - Run real AI analysis with perfect queries
 * Process documents in small batches to avoid timeouts
 */

import { db } from './server/db';
import { documents, agentAnalyses } from './shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Priority legal questions with optimized prompts
const LEGAL_QUESTIONS = [
  {
    id: 'sha_1',
    question: 'What class of shares exist?',
    prompt: `Analyze for share classes: common shares, preferred shares, Class A/B shares, employee stock options, voting rights. Extract specific share class details.`
  },
  {
    id: 'sha_2',
    question: 'Are liquidation preferences defined?',
    prompt: `Look for liquidation preferences, liquidation waterfalls, distribution priorities, participating/non-participating preferences. Extract liquidation details.`
  },
  {
    id: 'sha_3',
    question: 'Is anti-dilution protection present?',
    prompt: `Search for anti-dilution provisions, weighted average formulas, full ratchet provisions, price protection mechanisms. Extract anti-dilution details.`
  },
  {
    id: 'gov_1',
    question: 'Is board composition defined?',
    prompt: `Analyze board composition, number of seats, director appointments, investor vs founder representation, board procedures. Extract board details.`
  },
  {
    id: 'gov_2',
    question: 'Are voting rights clearly specified?',
    prompt: `Look for voting rights, procedures, majority/supermajority requirements, veto rights, consent requirements. Extract voting details.`
  },
  {
    id: 'ip_1',
    question: 'Are IP assignment agreements in place?',
    prompt: `Search for IP assignments, patent/trademark transfers, work-for-hire agreements, technology transfers. Extract IP assignment details.`
  },
  {
    id: 'ip_2',
    question: 'Are all founders/key personnel covered?',
    prompt: `Analyze founder/employee IP coverage, employment IP clauses, consulting IP provisions, comprehensive scope. Extract personnel coverage.`
  },
  {
    id: 'commercial_1',
    question: 'Are SLAs, warranties, and indemnity clauses present?',
    prompt: `Look for SLAs, warranties, guarantees, indemnification, liability limitations, performance guarantees. Extract commercial terms.`
  },
  {
    id: 'commercial_2',
    question: 'Are termination clauses fair and mutual?',
    prompt: `Analyze termination clauses, notice periods, mutual rights, cause vs convenience, penalties, fairness. Extract termination details.`
  },
  {
    id: 'lit_1',
    question: 'Are there pending litigations or regulatory proceedings?',
    prompt: `Search for litigation, lawsuits, regulatory proceedings, disputes, court cases, arbitrations, legal risks. Extract litigation details.`
  },
  {
    id: 'reg_1',
    question: 'Are there FDA submissions or regulatory approvals?',
    prompt: `Look for FDA submissions, regulatory approvals, medical device regulations, clinical trials, compliance status. Extract regulatory details.`
  },
  {
    id: 'financial_1',
    question: 'Are financial statements audited?',
    prompt: `Search for audited financial statements, auditor reports, audit opinions, requirements, procedures. Extract audit details.`
  }
];

async function runBackgroundLegalAnalysis(): Promise<void> {
  console.log('🚀 Starting background legal analysis with real AI...');

  // Get legal documents
  const allDocuments = await db
    .select()
    .from(documents)
    .where(eq(documents.dealId, 22));

  const legalDocuments = allDocuments.filter(doc => 
    doc.ocrText && doc.ocrText.length > 500 && (
      doc.name.toLowerCase().includes('agreement') ||
      doc.name.toLowerCase().includes('employment') ||
      doc.name.toLowerCase().includes('finder') ||
      doc.name.toLowerCase().includes('service') ||
      doc.name.toLowerCase().includes('consulting') ||
      doc.name.toLowerCase().includes('contract') ||
      doc.name.toLowerCase().includes('legal')
    )
  );

  console.log(`📋 Processing ${legalDocuments.length} legal documents`);

  // Process in small batches to avoid timeouts
  const batchSize = 5;
  const results: any = {};

  for (let i = 0; i < legalDocuments.length; i += batchSize) {
    const batch = legalDocuments.slice(i, i + batchSize);
    console.log(`📄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(legalDocuments.length/batchSize)}`);
    
    const batchResults = await processBatch(batch);
    Object.assign(results, batchResults);
    
    // Brief pause between batches
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Compile final answers
  const finalAnswers = await compileAnswers(results, legalDocuments);
  
  // Store results
  await storeResults(finalAnswers);
  
  console.log('✅ Background legal analysis completed!');
}

async function processBatch(documents: any[]): Promise<any> {
  const batchResults: any = {};

  for (const question of LEGAL_QUESTIONS) {
    const relevantDocs = documents.filter(doc => {
      const text = doc.ocrText.toLowerCase();
      const keywords = question.id.startsWith('sha') ? ['share', 'equity', 'stock'] :
                      question.id.startsWith('gov') ? ['board', 'voting', 'director'] :
                      question.id.startsWith('ip') ? ['ip', 'intellectual', 'property', 'patent'] :
                      question.id.startsWith('commercial') ? ['sla', 'warranty', 'indemnity', 'termination'] :
                      question.id.startsWith('lit') ? ['litigation', 'lawsuit', 'dispute'] :
                      question.id.startsWith('reg') ? ['fda', 'regulatory', 'approval'] :
                      ['audit', 'financial', 'statement'];
      
      return keywords.some(keyword => text.includes(keyword));
    });

    if (relevantDocs.length === 0) {
      batchResults[question.id] = { relevant: false, findings: [], sources: [] };
      continue;
    }

    const findings = [];
    const sources = [];

    for (const doc of relevantDocs.slice(0, 3)) { // Max 3 docs per question
      try {
        const prompt = `Document: ${doc.name}
Content: ${doc.ocrText.substring(0, 4000)}

${question.prompt}

Respond with JSON:
{
  "relevant": true/false,
  "findings": "specific findings from document",
  "confidence": 0.0-1.0,
  "evidence": "direct quotes if any"
}`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 400,
          temperature: 0.1
        });

        const result = JSON.parse(response.choices[0].message.content || '{}');
        
        if (result.relevant) {
          findings.push({
            document: doc.name,
            findings: result.findings,
            confidence: result.confidence,
            evidence: result.evidence
          });
          sources.push(doc.name);
        }

      } catch (error) {
        console.error(`Error analyzing ${doc.name}:`, error.message);
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    batchResults[question.id] = { relevant: findings.length > 0, findings, sources };
  }

  return batchResults;
}

async function compileAnswers(results: any, documents: any[]): Promise<any> {
  const compiledAnswers: any = {};

  for (const question of LEGAL_QUESTIONS) {
    const questionResults = results[question.id];
    
    if (!questionResults?.relevant || questionResults.findings.length === 0) {
      compiledAnswers[question.id] = {
        question: question.question,
        answer: `No relevant information found in the analyzed legal documents for this question. The available documents consist primarily of employment agreements, service agreements, finder agreements, and consulting agreements.`,
        confidence: 20,
        sources: []
      };
      continue;
    }

    // Create comprehensive answer from findings
    const findings = questionResults.findings;
    const confidence = Math.round(
      findings.reduce((sum: number, f: any) => sum + f.confidence, 0) / findings.length * 100
    );

    try {
      const synthesisPrompt = `Legal Question: ${question.question}

Findings from documents:
${findings.map((f: any) => `- ${f.document}: ${f.findings}`).join('\n')}

Create a comprehensive legal analysis that:
1. Directly answers the question
2. Synthesizes information from multiple documents
3. Mentions specific documents when relevant
4. Is professional and concise (max 200 words)

Answer:`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: synthesisPrompt }],
        max_tokens: 300,
        temperature: 0.1
      });

      const answer = response.choices[0].message.content || findings.map((f: any) => f.findings).join(' ');

      compiledAnswers[question.id] = {
        question: question.question,
        answer: answer,
        confidence: confidence,
        sources: questionResults.sources.slice(0, 3)
      };

    } catch (error) {
      console.error(`Error compiling answer for ${question.id}:`, error);
      compiledAnswers[question.id] = {
        question: question.question,
        answer: findings.map((f: any) => f.findings).join(' '),
        confidence: confidence,
        sources: questionResults.sources.slice(0, 3)
      };
    }
  }

  return compiledAnswers;
}

async function storeResults(answers: any): Promise<void> {
  console.log('💾 Storing real AI legal analysis results...');

  await db
    .update(agentAnalyses)
    .set({
      status: 'completed',
      progress: 100,
      legalAnswers: answers,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(agentAnalyses.dealId, 22),
        eq(agentAnalyses.agentType, 'legal')
      )
    );

  console.log('✅ Results stored successfully!');
}

// Run the analysis
runBackgroundLegalAnalysis()
  .then(() => {
    console.log('🎉 Background legal analysis completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Background legal analysis failed:', error);
    process.exit(1);
  });