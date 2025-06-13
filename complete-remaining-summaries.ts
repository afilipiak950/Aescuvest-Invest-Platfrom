import { db } from './server/db';
import { documents, backgroundJobs } from './shared/schema';
import { eq } from 'drizzle-orm';
import OpenAI from "openai";

async function completeRemainingSummaries() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const remainingDocs = [
    { docId: 793, jobId: 23, name: "Case Study - Personify Health (LG).pdf" },
    { docId: 794, jobId: 24, name: "Case Study - Primeyachts (LG).pdf" },
    { docId: 795, jobId: 25, name: "Intellywave_Unternehmensübersicht.pdf" }
  ];
  
  for (const { docId, jobId, name } of remainingDocs) {
    try {
      console.log(`Processing AI summary for document ${docId}: ${name}`);
      
      const [document] = await db.select()
        .from(documents)
        .where(eq(documents.id, docId));
      
      if (!document || !document.ocrText) {
        console.log(`Skipping document ${docId} - no OCR text`);
        continue;
      }
      
      await db.update(documents)
        .set({ aiSummaryStatus: 'processing' })
        .where(eq(documents.id, docId));
      
      await db.update(backgroundJobs)
        .set({ 
          status: 'processing',
          progress: 50,
          currentStep: 'Generating AI summary...',
          startedAt: new Date()
        })
        .where(eq(backgroundJobs.id, jobId));
      
      const prompt = `Analyze this investment document and provide a structured summary in JSON format:

TEXT TO ANALYZE:
${document.ocrText}

Return ONLY valid JSON in this exact format:
{
  "executiveSummary": "2-3 sentence overview of the document's main purpose and content",
  "criticalFindings": ["Array of 2-4 critical issues, risks, or red flags"],
  "keyFinancialData": ["Array of 2-4 important financial metrics, numbers, or projections"],
  "riskAssessment": ["Array of 2-4 potential risks or concerns identified"],
  "neutralFindings": ["Array of 4-6 factual background information points"],
  "strategicImplications": "2-3 sentences about what this means for investment decisions",
  "documentType": "Classification of document type (e.g., Financial Statement, Pitch Deck, Legal Document, etc.)",
  "confidenceScore": 0.85
}

Focus on investment-relevant information. Be concise but comprehensive. Only include factual information from the document.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert investment analyst. Analyze documents for venture capital due diligence. Provide structured, factual analysis in valid JSON format."
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2000
      });

      const aiSummary = JSON.parse(response.choices[0].message.content || '{}');
      
      await db.update(documents)
        .set({
          aiSummary: aiSummary,
          aiSummaryStatus: 'completed',
          aiSummaryGeneratedAt: new Date()
        })
        .where(eq(documents.id, docId));

      await db.update(backgroundJobs)
        .set({
          status: 'completed',
          progress: 100,
          currentStep: 'AI summary generation completed',
          completedAt: new Date(),
          result: { success: true, aiSummary }
        })
        .where(eq(backgroundJobs.id, jobId));

      console.log(`✅ Completed AI summary for document ${docId} (${name})`);

    } catch (error) {
      console.error(`❌ Failed for document ${docId}:`, error);
      
      await db.update(documents)
        .set({ aiSummaryStatus: 'failed' })
        .where(eq(documents.id, docId));
      
      await db.update(backgroundJobs)
        .set({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date()
        })
        .where(eq(backgroundJobs.id, jobId));
    }
  }
  
  console.log('All remaining AI summary jobs completed');
}

completeRemainingSummaries();