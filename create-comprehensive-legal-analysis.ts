#!/usr/bin/env tsx

/**
 * Create Comprehensive Legal Analysis
 * Analyzes all 114 legal documents to answer specific legal questions with real document content
 */

import { db } from './server/db';
import { documents, agentAnalyses } from './shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Legal questions that need real answers from document analysis
const legalQuestions = [
  {
    id: 'sha_1',
    category: 'Shareholders Agreement',
    question: 'What class of shares exist?',
    analysisPrompt: 'Identify all classes of shares mentioned in the documents (common shares, preferred shares, etc.). Provide specific details about each class.'
  },
  {
    id: 'sha_2',
    category: 'Shareholders Agreement',
    question: 'Are liquidation preferences defined?',
    analysisPrompt: 'Look for liquidation preference terms, participation rights, and liquidation waterfalls. Specify the preference multiple (1x, 2x, etc.) and participation type.'
  },
  {
    id: 'sha_3',
    category: 'Shareholders Agreement',
    question: 'Is anti-dilution protection present?',
    analysisPrompt: 'Search for anti-dilution clauses, weighted average provisions, and protection mechanisms for investors against dilution.'
  },
  {
    id: 'gov_1',
    category: 'Corporate Governance',
    question: 'Is board composition defined?',
    analysisPrompt: 'Find board composition details including number of seats, investor representation, founder representation, and independent directors.'
  },
  {
    id: 'gov_2',
    category: 'Corporate Governance',
    question: 'Are voting rights clearly specified?',
    analysisPrompt: 'Identify voting rights for different share classes, special voting provisions, and consent requirements.'
  },
  {
    id: 'ip_1',
    category: 'IP Assignment Agreements',
    question: 'Are IP assignment agreements in place?',
    analysisPrompt: 'Look for intellectual property assignment agreements, invention assignment clauses, and IP ownership transfers.'
  },
  {
    id: 'ip_2',
    category: 'IP Assignment Agreements',
    question: 'Are all founders/key personnel covered?',
    analysisPrompt: 'Verify that IP assignment agreements cover all founders, key employees, and contractors who contribute to IP.'
  },
  {
    id: 'commercial_1',
    category: 'Commercial Agreements',
    question: 'Are SLAs, warranties, and indemnity clauses present?',
    analysisPrompt: 'Search for service level agreements, warranty provisions, and indemnification clauses in commercial contracts.'
  },
  {
    id: 'commercial_2',
    category: 'Commercial Agreements',
    question: 'Are termination clauses fair and mutual?',
    analysisPrompt: 'Analyze termination clauses for fairness, notice periods, and mutual termination rights.'
  },
  {
    id: 'lit_1',
    category: 'Litigation Documents',
    question: 'Are there pending litigations or regulatory proceedings?',
    analysisPrompt: 'Search for any pending litigation, regulatory proceedings, disputes, or legal challenges.'
  },
  {
    id: 'lit_2',
    category: 'Litigation Documents',
    question: 'Is financial exposure quantified?',
    analysisPrompt: 'Look for quantified financial exposure, potential damages, settlement amounts, or financial risks from legal matters.'
  },
  {
    id: 'reg_1',
    category: 'Regulatory Compliance',
    question: 'Are there FDA submissions or regulatory approvals?',
    analysisPrompt: 'Search for FDA submissions, regulatory approvals, compliance documentation, and regulatory strategy.'
  },
  {
    id: 'reg_2',
    category: 'Regulatory Compliance',
    question: 'Are there any regulatory compliance issues?',
    analysisPrompt: 'Identify any regulatory compliance issues, violations, or areas of concern mentioned in the documents.'
  },
  {
    id: 'financial_1',
    category: 'Financial Documents',
    question: 'Are financial statements audited?',
    analysisPrompt: 'Look for audited financial statements, audit opinions, and financial audit documentation.'
  },
  {
    id: 'financial_2',
    category: 'Financial Documents',
    question: 'Are there any financial irregularities?',
    analysisPrompt: 'Search for any financial irregularities, accounting issues, or financial red flags mentioned in the documents.'
  }
];

async function analyzeLegalDocuments(): Promise<void> {
  console.log('🔍 Starting comprehensive legal analysis of all 114 documents...');

  try {
    // Get all documents for deal 22 that might contain legal information
    const allDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, 22));

    // Filter for legal-related documents based on filename and content
    const legalDocuments = allDocuments.filter(doc => {
      const filename = doc.name.toLowerCase();
      const hasLegalKeywords = filename.includes('legal') || 
                              filename.includes('contract') || 
                              filename.includes('agreement') || 
                              filename.includes('share') || 
                              filename.includes('ip') || 
                              filename.includes('patent') || 
                              filename.includes('license') ||
                              filename.includes('terms') ||
                              filename.includes('governance') ||
                              filename.includes('compliance') ||
                              filename.includes('regulatory') ||
                              filename.includes('litigation') ||
                              filename.includes('nda') ||
                              filename.includes('confidential');
      
      return hasLegalKeywords || (doc.ocrText && doc.ocrText.toLowerCase().includes('legal'));
    });

    console.log(`📄 Found ${legalDocuments.length} legal documents to analyze`);

    if (legalDocuments.length === 0) {
      console.log('❌ No legal documents found for analysis');
      return;
    }

    // Analyze each document's content for all legal questions
    const documentAnalyses: { [documentId: number]: any } = {};
    
    for (const doc of legalDocuments) {
      if (!doc.ocrText || doc.ocrText.trim().length === 0) {
        console.log(`⚠️  Skipping ${doc.name} - no OCR text available`);
        continue;
      }

      console.log(`📖 Analyzing document: ${doc.name}`);
      
      // Analyze this document for all legal questions
      const documentAnalysis = await analyzeDocumentForLegalQuestions(doc);
      documentAnalyses[doc.id] = documentAnalysis;
    }

    // Compile comprehensive answers from all documents
    const comprehensiveAnswers = await compileComprehensiveAnswers(documentAnalyses, legalDocuments);

    // Store the comprehensive legal analysis
    await storeLegalAnalysis(comprehensiveAnswers);

    console.log('✅ Comprehensive legal analysis completed successfully!');

  } catch (error) {
    console.error('❌ Error in legal analysis:', error);
    throw error;
  }
}

async function analyzeDocumentForLegalQuestions(document: any): Promise<any> {
  try {
    const prompt = `
You are a legal expert analyzing investment documents. Analyze the following document and answer specific legal questions based on the content.

Document: ${document.name}
Content: ${document.ocrText?.substring(0, 10000)}

For each legal question below, provide:
1. A specific answer based on the document content
2. Confidence level (0-100)
3. Relevant quotes or references from the document
4. "not_found" if the information is not in this document

Legal Questions:
${legalQuestions.map(q => `- ${q.id}: ${q.question}`).join('\n')}

Respond in JSON format:
{
  "question_id": {
    "answer": "specific answer based on document content",
    "confidence": 85,
    "quotes": ["relevant quote from document"],
    "found": true/false
  }
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a legal expert analyzing investment documents. Provide precise, factual analysis based only on the document content. Do not make assumptions or provide generic answers."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const analysis = JSON.parse(response.choices[0].message.content || '{}');
    return {
      documentId: document.id,
      documentName: document.name,
      analysis: analysis
    };

  } catch (error) {
    console.error(`❌ Error analyzing document ${document.name}:`, error);
    return {
      documentId: document.id,
      documentName: document.name,
      analysis: {}
    };
  }
}

async function compileComprehensiveAnswers(documentAnalyses: any, legalDocuments: any[]): Promise<any> {
  console.log('🔄 Compiling comprehensive answers from all documents...');

  const comprehensiveAnswers: any = {};

  for (const question of legalQuestions) {
    const questionId = question.id;
    const relevantFindings: any[] = [];

    // Collect all relevant findings for this question from all documents
    for (const docId in documentAnalyses) {
      const docAnalysis = documentAnalyses[docId];
      const questionAnalysis = docAnalysis.analysis[questionId];

      if (questionAnalysis && questionAnalysis.found && questionAnalysis.answer !== "not_found") {
        relevantFindings.push({
          documentName: docAnalysis.documentName,
          answer: questionAnalysis.answer,
          confidence: questionAnalysis.confidence,
          quotes: questionAnalysis.quotes || []
        });
      }
    }

    // Compile comprehensive answer
    if (relevantFindings.length > 0) {
      const bestFinding = relevantFindings.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );

      const sources = relevantFindings.map(f => f.documentName);
      const allAnswers = relevantFindings.map(f => f.answer).join('; ');

      comprehensiveAnswers[questionId] = {
        question: question.question,
        answer: allAnswers.length > 200 ? bestFinding.answer : allAnswers,
        confidence: Math.max(...relevantFindings.map(f => f.confidence)),
        sources: [...new Set(sources)], // Remove duplicates
        foundInDocuments: relevantFindings.length,
        totalDocuments: legalDocuments.length
      };
    } else {
      comprehensiveAnswers[questionId] = {
        question: question.question,
        answer: "No relevant information found in the analyzed legal documents",
        confidence: 0,
        sources: [],
        foundInDocuments: 0,
        totalDocuments: legalDocuments.length
      };
    }
  }

  return comprehensiveAnswers;
}

async function storeLegalAnalysis(comprehensiveAnswers: any): Promise<void> {
  console.log('💾 Storing comprehensive legal analysis...');

  try {
    // Update the existing legal analysis with comprehensive answers
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

    console.log('✅ Legal analysis stored successfully');

  } catch (error) {
    console.error('❌ Error storing legal analysis:', error);
    throw error;
  }
}

// Run the analysis
analyzeLegalDocuments()
  .then(() => {
    console.log('🎉 Comprehensive legal analysis completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Legal analysis failed:', error);
    process.exit(1);
  });