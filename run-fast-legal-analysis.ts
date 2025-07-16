#!/usr/bin/env tsx

/**
 * Fast Legal Analysis - Analyze the most relevant legal documents for structured questions
 */

import { db } from './server/db';
import { documents, agentAnalyses } from './shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function runFastLegalAnalysis(): Promise<void> {
  console.log('🔍 Starting fast legal analysis with focused document selection...');

  try {
    // Get all documents for deal 22
    const allDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, 22));

    // Filter for the most relevant legal documents (limit to 20 for faster processing)
    const legalDocuments = allDocuments
      .filter(doc => {
        const filename = doc.name.toLowerCase();
        return filename.includes('share') || 
               filename.includes('agreement') || 
               filename.includes('contract') || 
               filename.includes('ip') || 
               filename.includes('patent') || 
               filename.includes('license') ||
               filename.includes('governance') ||
               filename.includes('compliance') ||
               filename.includes('regulatory') ||
               filename.includes('nda') ||
               filename.includes('legal');
      })
      .filter(doc => doc.ocrText && doc.ocrText.trim().length > 100) // Must have substantial content
      .slice(0, 20); // Limit to 20 most relevant documents

    console.log(`📄 Selected ${legalDocuments.length} most relevant legal documents`);

    if (legalDocuments.length === 0) {
      console.log('❌ No relevant legal documents found');
      return;
    }

    // Analyze all documents together in a single AI call for efficiency
    const comprehensiveAnalysis = await analyzeDocumentsBatch(legalDocuments);

    // Store the analysis results
    await storeLegalAnalysis(comprehensiveAnalysis);

    console.log('✅ Fast legal analysis completed successfully!');

  } catch (error) {
    console.error('❌ Error in fast legal analysis:', error);
    throw error;
  }
}

async function analyzeDocumentsBatch(documents: any[]): Promise<any> {
  console.log('🔄 Analyzing batch of documents for legal questions...');

  const documentContent = documents.map(doc => ({
    name: doc.name,
    content: doc.ocrText?.substring(0, 3000) // Limit content to prevent token limits
  }));

  const prompt = `
You are a legal expert analyzing investment documents. Based on the following documents, answer the specific legal questions with real information found in the documents.

Documents:
${documentContent.map(doc => `
Document: ${doc.name}
Content: ${doc.content}
---
`).join('\n')}

Legal Questions (answer each based on the document content):
1. sha_1: What class of shares exist?
2. sha_2: Are liquidation preferences defined?
3. sha_3: Is anti-dilution protection present?
4. gov_1: Is board composition defined?
5. gov_2: Are voting rights clearly specified?
6. ip_1: Are IP assignment agreements in place?
7. ip_2: Are all founders/key personnel covered?
8. commercial_1: Are SLAs, warranties, and indemnity clauses present?
9. commercial_2: Are termination clauses fair and mutual?
10. lit_1: Are there pending litigations or regulatory proceedings?
11. lit_2: Is financial exposure quantified?
12. reg_1: Are there FDA submissions or regulatory approvals?
13. reg_2: Are there any regulatory compliance issues?
14. financial_1: Are financial statements audited?
15. financial_2: Are there any financial irregularities?

For each question, provide:
- A specific answer based on the document content
- Confidence level (0-100)
- Source document names that contain the information

Respond in JSON format:
{
  "question_id": {
    "question": "question text",
    "answer": "specific answer based on document content",
    "confidence": 85,
    "sources": ["document1.pdf", "document2.pdf"]
  }
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a legal expert analyzing investment documents. Provide precise, factual analysis based only on the document content. Do not make assumptions or provide generic answers. If information is not found in the documents, clearly state that."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 3000
    });

    const analysis = JSON.parse(response.choices[0].message.content || '{}');
    
    console.log('✅ Batch analysis completed');
    return analysis;

  } catch (error) {
    console.error('❌ Error in batch analysis:', error);
    throw error;
  }
}

async function storeLegalAnalysis(analysisResults: any): Promise<void> {
  console.log('💾 Storing comprehensive legal analysis...');

  try {
    // Update the existing legal analysis with new results
    await db
      .update(agentAnalyses)
      .set({
        status: 'completed',
        progress: 100,
        legalAnswers: analysisResults,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(agentAnalyses.dealId, 22),
          eq(agentAnalyses.agentType, 'legal')
        )
      );

    console.log('✅ Legal analysis stored successfully');
    console.log('📊 Analysis results:', Object.keys(analysisResults).length, 'questions answered');

  } catch (error) {
    console.error('❌ Error storing legal analysis:', error);
    throw error;
  }
}

// Run the analysis
runFastLegalAnalysis()
  .then(() => {
    console.log('🎉 Fast legal analysis completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Legal analysis failed:', error);
    process.exit(1);
  });