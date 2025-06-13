import { db } from './server/db';
import { documents, backgroundJobs } from './shared/schema';
import { eq } from 'drizzle-orm';
import OpenAI from "openai";

async function completeFinalDocument() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const docId = 799;
  const jobId = 30;
  const name = "Intellywave_Unternehmensübersicht.pdf";
  
  try {
    console.log(`Processing final AI summary for document ${docId}: ${name}`);
    
    const [document] = await db.select()
      .from(documents)
      .where(eq(documents.id, docId));
    
    if (!document || !document.ocrText) {
      console.log(`Skipping document ${docId} - no OCR text`);
      return;
    }
    
    await db.update(documents)
      .set({ aiSummaryStatus: 'processing' })
      .where(eq(documents.id, docId));
    
    await db.update(backgroundJobs)
      .set({ 
        status: 'processing',
        progress: 75,
        currentStep: 'Generating final comprehensive investment analysis...',
        startedAt: new Date()
      })
      .where(eq(backgroundJobs.id, jobId));
    
    const prompt = `Analyze this investment document and provide a comprehensive structured summary in JSON format:

DOCUMENT TEXT:
${document.ocrText}

Provide a detailed investment analysis in this exact JSON format:
{
  "executiveSummary": "3-4 sentence comprehensive overview of the document's investment significance and key insights",
  "criticalFindings": ["Array of 3-5 critical issues, red flags, or major concerns that could impact investment decisions"],
  "keyFinancialData": ["Array of 3-5 specific financial metrics, valuations, revenue figures, or growth projections"],
  "riskAssessment": ["Array of 3-5 potential risks, market challenges, or operational concerns"],
  "neutralFindings": ["Array of 5-7 factual background information points, company details, or market context"],
  "strategicImplications": "3-4 sentences analyzing what this document means for investment strategy and decision-making",
  "documentType": "Precise classification (e.g., Case Study, Financial Report, Pitch Deck, Due Diligence Report)",
  "confidenceScore": 0.88
}

Focus on investment-relevant insights, financial implications, and strategic considerations. Be specific and actionable.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a senior investment analyst with expertise in venture capital due diligence. Provide comprehensive, investment-focused analysis in valid JSON format."
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 2500
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
        currentStep: 'Investment analysis completed successfully',
        completedAt: new Date(),
        result: { success: true, aiSummary }
      })
      .where(eq(backgroundJobs.id, jobId));

    console.log(`✅ Completed final AI summary for document ${docId} (${name})`);

  } catch (error) {
    console.error(`❌ Failed processing document ${docId}:`, error);
    
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
  
  console.log('All AI summary processing completed');
}

completeFinalDocument();