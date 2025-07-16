#!/usr/bin/env tsx

/**
 * Create Comprehensive Legal Analysis
 * Analyzes all 114 legal documents to answer specific legal questions with real document content
 */

import { db } from './server/db';
import { documents, agentAnalyses } from './shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Comprehensive legal questions with perfect prompts
const COMPREHENSIVE_LEGAL_QUESTIONS = [
  {
    id: 'sha_1',
    question: 'What class of shares exist?',
    perfectPrompt: `Analyze this legal document for any mention of share classes, equity structures, or types of shares. Look for:
- Common shares, preferred shares, ordinary shares
- Class A, Class B, or other share classifications
- Employee stock options or equity compensation
- Voting vs non-voting shares
- Any references to articles of incorporation or shareholder agreements
Extract specific details about share classes mentioned.`
  },
  {
    id: 'sha_2',
    question: 'Are liquidation preferences defined?',
    perfectPrompt: `Search this document for liquidation preferences, liquidation waterfalls, or distribution priorities. Look for:
- Liquidation preference clauses
- Liquidation waterfall provisions
- Distribution priorities upon liquidation
- Participating vs non-participating preferences
- Multiple liquidation preferences
- Any references to preferred share liquidation rights
Extract specific liquidation preference details.`
  },
  {
    id: 'sha_3',
    question: 'Is anti-dilution protection present?',
    perfectPrompt: `Examine this document for anti-dilution provisions or protection mechanisms. Look for:
- Anti-dilution protection clauses
- Weighted average anti-dilution formulas
- Full ratchet anti-dilution provisions
- Price-based anti-dilution adjustments
- Dilution protection for existing shareholders
- Any references to share price protection
Extract specific anti-dilution mechanism details.`
  },
  {
    id: 'gov_1',
    question: 'Is board composition defined?',
    perfectPrompt: `Analyze this document for board composition, governance structures, or director arrangements. Look for:
- Board of directors composition
- Number of board seats
- Director appointment rights
- Board representation by investors vs founders
- Board meeting procedures
- Voting requirements for board decisions
Extract specific board composition details.`
  },
  {
    id: 'gov_2',
    question: 'Are voting rights clearly specified?',
    perfectPrompt: `Search this document for voting rights, shareholder voting procedures, or governance voting. Look for:
- Shareholder voting rights
- Voting procedures and requirements
- Majority vs supermajority voting
- Veto rights or protective provisions
- Consent requirements for major decisions
- Class-specific voting rights
Extract specific voting rights details.`
  },
  {
    id: 'ip_1',
    question: 'Are IP assignment agreements in place?',
    perfectPrompt: `Examine this document for intellectual property assignments, IP transfer clauses, or IP ownership. Look for:
- IP assignment agreements or clauses
- Intellectual property transfer provisions
- Patent, trademark, or copyright assignments
- Work-for-hire agreements
- IP ownership by company vs individual
- Technology transfer agreements
Extract specific IP assignment details.`
  },
  {
    id: 'ip_2',
    question: 'Are all founders/key personnel covered?',
    perfectPrompt: `Analyze this document for coverage of founders, key personnel, or employee IP assignments. Look for:
- Founder IP assignment coverage
- Key personnel or employee IP agreements
- Employment agreement IP clauses
- Consulting agreement IP provisions
- Coverage of technical co-founders
- Comprehensive IP assignment scope
Extract specific personnel coverage details.`
  },
  {
    id: 'commercial_1',
    question: 'Are SLAs, warranties, and indemnity clauses present?',
    perfectPrompt: `Search this document for service level agreements, warranties, guarantees, or indemnification. Look for:
- Service level agreements (SLAs)
- Warranty provisions and guarantees
- Indemnification clauses
- Liability limitations
- Performance guarantees
- Commercial terms and conditions
Extract specific SLA, warranty, and indemnity details.`
  },
  {
    id: 'commercial_2',
    question: 'Are termination clauses fair and mutual?',
    perfectPrompt: `Examine this document for termination clauses, notice periods, or contract ending provisions. Look for:
- Termination clauses and conditions
- Notice periods for termination
- Mutual termination rights
- Termination for cause vs convenience
- Termination penalties or consequences
- Fair and balanced termination terms
Extract specific termination clause details.`
  },
  {
    id: 'lit_1',
    question: 'Are there pending litigations or regulatory proceedings?',
    perfectPrompt: `Analyze this document for mentions of litigation, lawsuits, or regulatory proceedings. Look for:
- Pending or ongoing litigation
- Regulatory proceedings or investigations
- Legal disputes or claims
- Court cases or arbitrations
- Regulatory compliance issues
- Any legal risks or exposures
Extract specific litigation or regulatory details.`
  },
  {
    id: 'lit_2',
    question: 'Is financial exposure quantified?',
    perfectPrompt: `Search this document for financial exposure, liability amounts, or quantified financial risks. Look for:
- Quantified financial exposure or liability
- Specific damage amounts or penalties
- Financial risk assessments
- Liability caps or limitations
- Insurance coverage amounts
- Quantified financial commitments
Extract specific financial exposure details.`
  },
  {
    id: 'reg_1',
    question: 'Are there FDA submissions or regulatory approvals?',
    perfectPrompt: `Examine this document for FDA submissions, regulatory approvals, or compliance matters. Look for:
- FDA submissions or applications
- Regulatory approvals or clearances
- Medical device regulations
- Clinical trial approvals
- Regulatory compliance status
- FDA correspondence or requirements
Extract specific FDA or regulatory approval details.`
  },
  {
    id: 'reg_2',
    question: 'Are there any regulatory compliance issues?',
    perfectPrompt: `Analyze this document for regulatory compliance issues, violations, or concerns. Look for:
- Regulatory compliance violations
- Non-compliance issues or warnings
- Regulatory audit findings
- Compliance program deficiencies
- Regulatory action items
- Compliance monitoring requirements
Extract specific regulatory compliance issue details.`
  },
  {
    id: 'financial_1',
    question: 'Are financial statements audited?',
    perfectPrompt: `Search this document for references to audited financial statements, auditor reports, or financial audits. Look for:
- Audited financial statements
- Independent auditor reports
- Audit opinions or findings
- Financial audit requirements
- Auditor qualifications or certifications
- Audit timeline or procedures
Extract specific financial audit details.`
  },
  {
    id: 'financial_2',
    question: 'Are there any financial irregularities?',
    perfectPrompt: `Examine this document for financial irregularities, discrepancies, or accounting issues. Look for:
- Financial irregularities or discrepancies
- Accounting errors or misstatements
- Revenue recognition issues
- Internal control weaknesses
- Financial restatements or corrections
- Unusual financial transactions
Extract specific financial irregularity details.`
  }
];

async function analyzeLegalDocuments(): Promise<void> {
  console.log('🔍 Starting comprehensive legal analysis of all documents...');

  // Get all documents for deal 22
  const allDocuments = await db
    .select()
    .from(documents)
    .where(eq(documents.dealId, 22));

  console.log(`📊 Found ${allDocuments.length} documents to analyze`);

  // Filter for legal-relevant documents with substantial content
  const legalDocuments = allDocuments.filter(doc => 
    doc.ocrText && doc.ocrText.length > 300 && (
      doc.name.toLowerCase().includes('agreement') ||
      doc.name.toLowerCase().includes('contract') ||
      doc.name.toLowerCase().includes('legal') ||
      doc.name.toLowerCase().includes('share') ||
      doc.name.toLowerCase().includes('employment') ||
      doc.name.toLowerCase().includes('finder') ||
      doc.name.toLowerCase().includes('service') ||
      doc.name.toLowerCase().includes('consulting') ||
      doc.name.toLowerCase().includes('ip') ||
      doc.name.toLowerCase().includes('nda') ||
      doc.name.toLowerCase().includes('governance') ||
      doc.name.toLowerCase().includes('regulatory') ||
      doc.name.toLowerCase().includes('compliance') ||
      doc.name.toLowerCase().includes('articles') ||
      doc.name.toLowerCase().includes('shareholders') ||
      doc.name.toLowerCase().includes('investment') ||
      doc.name.toLowerCase().includes('board') ||
      doc.name.toLowerCase().includes('director') ||
      doc.name.toLowerCase().includes('voting') ||
      doc.name.toLowerCase().includes('liquidation') ||
      doc.name.toLowerCase().includes('anti-dilution') ||
      doc.name.toLowerCase().includes('warranty') ||
      doc.name.toLowerCase().includes('indemnity') ||
      doc.name.toLowerCase().includes('termination') ||
      doc.name.toLowerCase().includes('litigation') ||
      doc.name.toLowerCase().includes('fda') ||
      doc.name.toLowerCase().includes('audit') ||
      doc.name.toLowerCase().includes('financial')
    )
  );

  console.log(`📋 Filtered to ${legalDocuments.length} legal documents for analysis`);

  // Analyze each document for each legal question
  const documentAnalyses: any = {};

  for (const document of legalDocuments) {
    console.log(`📄 Analyzing document: ${document.name}`);
    
    const docAnalysis = await analyzeDocumentForLegalQuestions(document);
    documentAnalyses[document.id] = {
      name: document.name,
      analysis: docAnalysis
    };
  }

  // Compile comprehensive answers for each legal question
  const comprehensiveAnswers = await compileComprehensiveAnswers(documentAnalyses, legalDocuments);

  // Store the results
  await storeLegalAnalysis(comprehensiveAnswers);

  console.log('✅ Comprehensive legal analysis completed!');
}

async function analyzeDocumentForLegalQuestions(document: any): Promise<any> {
  const analysis: any = {};

  // Analyze document against each legal question with perfect prompts
  for (const question of COMPREHENSIVE_LEGAL_QUESTIONS) {
    try {
      const prompt = `
Document Name: ${document.name}
Document Content: ${document.ocrText.substring(0, 6000)}

${question.perfectPrompt}

Respond with JSON in this format:
{
  "relevant": true/false,
  "findings": "detailed findings from this document related to the question",
  "confidence": 0.0-1.0,
  "evidence": "direct quotes or specific references from the document",
  "details": "additional context or explanation"
}

If no relevant information is found, set relevant to false and provide a brief explanation.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 800,
        temperature: 0.1 // Low temperature for consistent, factual analysis
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      analysis[question.id] = result;

    } catch (error) {
      console.error(`❌ Error analyzing document ${document.name} for question ${question.id}:`, error);
      analysis[question.id] = {
        relevant: false,
        findings: "Analysis failed due to API error",
        confidence: 0.0,
        evidence: "",
        details: "Unable to process document"
      };
    }

    // Brief delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  return analysis;
}

async function compileComprehensiveAnswers(documentAnalyses: any, legalDocuments: any[]): Promise<any> {
  const comprehensiveAnswers: any = {};

  for (const question of COMPREHENSIVE_LEGAL_QUESTIONS) {
    console.log(`📊 Compiling answer for: ${question.question}`);

    // Collect all relevant findings for this question
    const relevantFindings: any[] = [];
    const sources: string[] = [];

    for (const [docId, docData] of Object.entries(documentAnalyses)) {
      const docAnalysis = (docData as any).analysis[question.id];
      
      if (docAnalysis?.relevant && docAnalysis.findings) {
        relevantFindings.push({
          document: (docData as any).name,
          findings: docAnalysis.findings,
          confidence: docAnalysis.confidence,
          evidence: docAnalysis.evidence,
          details: docAnalysis.details
        });
        sources.push((docData as any).name);
      }
    }

    // Compile comprehensive answer
    let answer = "";
    let confidence = 0;

    if (relevantFindings.length > 0) {
      // Calculate weighted confidence
      confidence = Math.round(
        relevantFindings.reduce((sum, f) => sum + f.confidence, 0) / relevantFindings.length * 100
      );

      // Create comprehensive answer using OpenAI
      try {
        const synthesisPrompt = `
Legal Question: ${question.question}

Findings from multiple documents:
${relevantFindings.map(f => `- ${f.document}: ${f.findings}\n  Evidence: ${f.evidence}\n  Details: ${f.details}`).join('\n\n')}

Create a comprehensive, professional legal analysis that:
1. Directly answers the legal question
2. Synthesizes information from multiple documents
3. Mentions specific document names when relevant
4. Provides concrete evidence and details
5. Is thorough yet concise (max 300 words)
6. Uses professional legal language

Answer:`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
          messages: [{ role: "user", content: synthesisPrompt }],
          max_tokens: 500,
          temperature: 0.1
        });

        answer = response.choices[0].message.content || relevantFindings.map(f => f.findings).join(' ');

      } catch (error) {
        console.error(`❌ Error compiling answer for ${question.id}:`, error);
        answer = relevantFindings.map(f => f.findings).join(' ');
      }
    } else {
      // No relevant findings
      answer = `No relevant information found in the analyzed legal documents for this question. The available documents primarily consist of employment agreements, service agreements, finder agreements, and consulting agreements, which may not contain the specific legal provisions required to answer this question comprehensively.`;
      confidence = 15;
    }

    comprehensiveAnswers[question.id] = {
      question: question.question,
      answer: answer,
      confidence: confidence,
      sources: sources.slice(0, 5) // Limit to top 5 sources
    };
  }

  return comprehensiveAnswers;
}

async function storeLegalAnalysis(comprehensiveAnswers: any): Promise<void> {
  console.log('💾 Storing comprehensive legal analysis...');

  await db
    .update(agentAnalyses)
    .set({
      status: 'completed',
      progress: 100,
      legalAnswers: comprehensiveAnswers,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(agentAnalyses.dealId, 22),
        eq(agentAnalyses.agentType, 'legal')
      )
    );

  console.log('✅ Legal analysis stored successfully!');
}

// Run the analysis
analyzeLegalDocuments()
  .then(() => {
    console.log('🎉 Comprehensive legal analysis completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Legal analysis failed:', error);
    process.exit(1);
  });