import { db } from './server/db';
import { documents } from './shared/schema';
import { eq, and, isNull, or } from 'drizzle-orm';
import OpenAI from "openai";
import { Anthropic } from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

// Initialize AI clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function extractTextFromDocument(doc: any): Promise<string | null> {
  try {
    const filePath = path.join(process.cwd(), doc.path);
    
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      return null;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');
    
    console.log(`Extracting OCR text from: ${doc.name}`);
    
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please extract all text content from this document. Return only the extracted text, no additional commentary or formatting. If the document contains tables, preserve the structure as much as possible using plain text formatting.`
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: doc.type.includes('pdf') ? "application/pdf" : "image/jpeg",
                data: base64Data
              }
            }
          ]
        }
      ]
    });
    
    const extractedText = response.content[0].text;
    console.log(`Extracted ${extractedText.length} characters from ${doc.name}`);
    return extractedText;
    
  } catch (error) {
    console.error(`OCR extraction failed for ${doc.name}:`, error);
    return null;
  }
}

async function generateAISummary(doc: any): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert investment analyst specializing in due diligence document analysis. Analyze the provided document and create a comprehensive, well-structured summary with the following sections:

1. **Executive Summary** - High-level overview in 2-3 sentences
2. **Critical Information** - Key points that could significantly impact investment decisions
3. **Neutral Information** - General business information, background details
4. **Key Financial Data** - Extract any numbers, metrics, financial projections
5. **Risk Assessment** - Identify potential risks or concerns
6. **Strategic Implications** - How this information affects the investment thesis

Format your response as JSON with this structure:
{
  "executiveSummary": "string",
  "criticalFindings": ["array of critical points"],
  "neutralFindings": ["array of neutral points"],  
  "keyFinancialData": ["array of financial metrics"],
  "riskAssessment": ["array of risks"],
  "strategicImplications": "string",
  "documentType": "string",
  "confidenceScore": 0.8
}`
        },
        {
          role: "user",
          content: `Analyze this document titled "${doc.name}":

${doc.ocrText.substring(0, 15000)}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  } catch (error) {
    console.error(`AI summary generation failed for ${doc.name}:`, error);
    throw error;
  }
}

async function completeMissingAnalysis() {
  console.log('Starting complete missing analysis for deal 22...');
  
  // Get documents without AI summaries
  const pendingDocs = await db.select()
    .from(documents)
    .where(
      and(
        eq(documents.dealId, 22),
        isNull(documents.aiSummary)
      )
    );
  
  console.log(`Found ${pendingDocs.length} documents needing analysis`);
  
  let processedCount = 0;
  let successCount = 0;
  
  for (const doc of pendingDocs) {
    try {
      processedCount++;
      console.log(`\nProcessing ${processedCount}/${pendingDocs.length}: ${doc.name}`);
      
      // Step 1: Extract OCR text if missing
      let ocrText = doc.ocrText;
      if (!ocrText || ocrText.trim().length === 0) {
        console.log('Extracting OCR text...');
        ocrText = await extractTextFromDocument(doc);
        
        if (!ocrText) {
          console.log('Skipping - no text could be extracted');
          continue;
        }
        
        // Update document with OCR text
        await db.update(documents)
          .set({ 
            ocrText: ocrText,
            status: 'Analyzed',
            processedAt: new Date()
          })
          .where(eq(documents.id, doc.id));
      }
      
      // Step 2: Generate AI summary
      console.log('Generating AI summary...');
      await db.update(documents)
        .set({ aiSummaryStatus: 'processing' })
        .where(eq(documents.id, doc.id));
      
      const aiSummary = await generateAISummary({ ...doc, ocrText });
      
      // Step 3: Save AI summary
      await db.update(documents)
        .set({
          aiSummary: aiSummary,
          aiSummaryStatus: 'completed',
          aiSummaryGeneratedAt: new Date()
        })
        .where(eq(documents.id, doc.id));
      
      successCount++;
      console.log(`Success! Completed analysis for: ${doc.name}`);
      
      // Rate limiting - wait between requests
      if (processedCount < pendingDocs.length) {
        console.log('Waiting 3 seconds for rate limiting...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
    } catch (error) {
      console.error(`Failed to process ${doc.name}:`, error);
      
      // Mark as failed
      await db.update(documents)
        .set({ aiSummaryStatus: 'failed' })
        .where(eq(documents.id, doc.id));
    }
  }
  
  console.log(`\nCompleted! Successfully processed ${successCount}/${pendingDocs.length} documents`);
  
  // Final verification
  const remainingDocs = await db.select()
    .from(documents)
    .where(
      and(
        eq(documents.dealId, 22),
        isNull(documents.aiSummary)
      )
    );
  
  console.log(`Final check: ${remainingDocs.length} documents still need processing`);
  
  // Summary stats
  const totalDocs = await db.select().from(documents).where(eq(documents.dealId, 22));
  const completedDocs = totalDocs.filter(d => d.aiSummary && d.aiSummaryStatus === 'completed');
  
  console.log(`\nFinal Statistics:`);
  console.log(`Total documents: ${totalDocs.length}`);
  console.log(`Completed AI summaries: ${completedDocs.length}`);
  console.log(`Completion rate: ${Math.round(completedDocs.length / totalDocs.length * 100)}%`);
}

completeMissingAnalysis().catch(console.error);