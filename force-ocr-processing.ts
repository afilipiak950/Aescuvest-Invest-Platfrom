import { db } from './server/db';
import { documents } from './shared/schema';
import { eq, and, isNull, or } from 'drizzle-orm';
import { Anthropic } from '@anthropic-ai/sdk';
import OpenAI from "openai";
import * as fs from 'fs';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function extractOCRText(filePath: string, fileName: string): Promise<string | null> {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      return null;
    }

    console.log(`Extracting OCR from: ${fileName}`);
    
    // Use Mistral for OCR as per the original system
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "pixtral-12b-2409",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all text from this document. Return only the extracted text, no additional formatting or commentary."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${fs.readFileSync(filePath).toString('base64')}`
                }
              }
            ]
          }
        ],
        max_tokens: 4000
      })
    });

    const result = await response.json();
    
    if (result.choices && result.choices[0] && result.choices[0].message) {
      const extractedText = result.choices[0].message.content;
      console.log(`Extracted ${extractedText.length} characters`);
      return extractedText;
    }
    
    return null;
  } catch (error) {
    console.error(`OCR extraction failed for ${fileName}:`, error);
    return null;
  }
}

async function generateAISummary(ocrText: string, fileName: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert investment analyst specializing in due diligence document analysis. Analyze the provided document and create a comprehensive, well-structured summary.

Format your response as JSON with this structure:
{
  "executiveSummary": "High-level overview in 2-3 sentences",
  "criticalFindings": ["array of critical investment-impacting points"],
  "neutralFindings": ["array of general business information"],  
  "keyFinancialData": ["array of financial metrics and numbers"],
  "riskAssessment": ["array of identified risks"],
  "strategicImplications": "How this affects investment thesis",
  "documentType": "Document category",
  "confidenceScore": 0.8
}`
        },
        {
          role: "user",
          content: `Analyze document "${fileName}":\n\n${ocrText.substring(0, 15000)}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  } catch (error) {
    console.error(`AI summary failed for ${fileName}:`, error);
    throw error;
  }
}

async function forceOCRProcessing() {
  console.log('Force processing OCR and AI for remaining documents...');
  
  const pendingDocs = await db.select()
    .from(documents)
    .where(
      and(
        eq(documents.dealId, 22),
        or(
          isNull(documents.ocrText),
          eq(documents.ocrText, '')
        )
      )
    );
  
  console.log(`Found ${pendingDocs.length} documents without OCR text`);
  
  let successCount = 0;
  
  for (let i = 0; i < pendingDocs.length; i++) {
    const doc = pendingDocs[i];
    
    try {
      console.log(`\nProcessing ${i + 1}/${pendingDocs.length}: ${doc.name}`);
      
      // Extract OCR text
      const ocrText = await extractOCRText(doc.path, doc.name);
      
      if (!ocrText || ocrText.trim().length === 0) {
        console.log('No text extracted, skipping');
        continue;
      }
      
      // Update document with OCR text
      await db.update(documents)
        .set({ 
          ocrText: ocrText,
          status: 'Analyzed',
          processedAt: new Date(),
          aiSummaryStatus: 'processing'
        })
        .where(eq(documents.id, doc.id));
      
      // Generate AI summary with rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const aiSummary = await generateAISummary(ocrText, doc.name);
      
      // Save AI summary
      await db.update(documents)
        .set({
          aiSummary: aiSummary,
          aiSummaryStatus: 'completed',
          aiSummaryGeneratedAt: new Date()
        })
        .where(eq(documents.id, doc.id));
      
      successCount++;
      console.log(`Success! Completed: ${doc.name}`);
      
    } catch (error) {
      console.error(`Failed processing ${doc.name}:`, error);
      
      await db.update(documents)
        .set({ aiSummaryStatus: 'failed' })
        .where(eq(documents.id, doc.id));
    }
  }
  
  console.log(`\nProcessing complete: ${successCount}/${pendingDocs.length} successful`);
  
  // Final verification
  const finalStats = await db.select()
    .from(documents)
    .where(eq(documents.dealId, 22));
  
  const completedCount = finalStats.filter(d => d.aiSummary && d.aiSummaryStatus === 'completed').length;
  const totalCount = finalStats.length;
  const completionRate = Math.round(completedCount / totalCount * 100);
  
  console.log(`\nFinal Results:`);
  console.log(`Total documents: ${totalCount}`);
  console.log(`Completed AI summaries: ${completedCount}`);
  console.log(`Completion rate: ${completionRate}%`);
  
  if (completionRate === 100) {
    console.log('🎉 All documents now have AI summaries!');
  } else {
    console.log(`${totalCount - completedCount} documents still need processing`);
  }
}

forceOCRProcessing().catch(console.error);