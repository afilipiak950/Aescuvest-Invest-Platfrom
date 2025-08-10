#!/usr/bin/env tsx
/**
 * DEBUG EVIDENCE EXTRACTION
 * 
 * Root cause: 0% hit rate in comprehensive legal system
 * Need to debug why extractEvidenceFromDocument returns empty arrays
 */

import { storage } from './server/storage';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function debugEvidenceExtraction() {
  console.log('🔍 DEBUGGING EVIDENCE EXTRACTION');
  console.log('================================');
  
  const dealId = 33;
  
  try {
    // Get sample documents
    const allDocs = await storage.getDocumentsByDealId(dealId);
    const assignedDocs = allDocs.filter(doc => {
      if (!doc.assignedAgents) return false;
      const agents = Array.isArray(doc.assignedAgents) ? doc.assignedAgents : 
                    (typeof doc.assignedAgents === 'string' ? JSON.parse(doc.assignedAgents || '[]') : []);
      return agents.some((agent: string) => 
        agent.toLowerCase() === 'legal' || agent === 'Legal'
      );
    });
    
    console.log(`📋 Legal documents: ${assignedDocs.length}`);
    
    // Sample 5 documents for debugging
    const sampleDocs = assignedDocs.slice(0, 5);
    console.log(`🔍 Debugging ${sampleDocs.length} sample documents:`);
    
    for (const doc of sampleDocs) {
      console.log(`\n📄 Document: ${doc.name} (ID: ${doc.id})`);
      
      // Check content availability
      const ocrText = doc.ocrText || '';
      const aiSummary = doc.aiSummary;
      const content = ocrText || 
                     (aiSummary?.executiveSummary) || 
                     (typeof aiSummary === 'string' ? aiSummary : '') || 
                     '';
      
      console.log(`  📝 OCR text length: ${ocrText.length}`);
      console.log(`  🤖 AI summary type: ${typeof aiSummary}`);
      console.log(`  📊 Total content length: ${content.length}`);
      
      if (content.length > 0) {
        console.log(`  📖 Content preview: "${content.substring(0, 200)}..."`);
      }
      
      // Test evidence extraction with a simple legal question
      if (content.length > 50) {
        const testQuestion = {
          id: 'test',
          question: 'What class of shares exist and what are their rights?',
          category: 'Shareholders Agreement'
        };
        
        console.log(`  🔍 Testing evidence extraction...`);
        const evidence = await testEvidenceExtraction(doc, testQuestion, content);
        console.log(`  📊 Evidence found: ${evidence.length} pieces`);
        
        if (evidence.length > 0) {
          console.log(`  ✅ Sample evidence: "${evidence[0].quote?.substring(0, 100)}..."`);
        } else {
          console.log(`  ❌ No evidence found - investigating why...`);
          await debugWhyNoEvidence(doc, testQuestion, content);
        }
      } else {
        console.log(`  ⚠️ Insufficient content for extraction`);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

async function testEvidenceExtraction(document: any, question: any, content: string): Promise<any[]> {
  try {
    const prompt = `You are a Legal analyst extracting evidence from a specific document.

DOCUMENT: ${document.name}
QUESTION: "${question.question}"

CONTENT (first 1500 chars):
${content.substring(0, 1500)}

Extract the top 5 most relevant pieces of evidence that directly relate to this question.

Respond with JSON:
{
  "evidence": [
    {
      "quote": "exact text from document",
      "score": 85,
      "page": 1,
      "relevance": "why this quote answers the question",
      "docId": ${document.id}
    }
  ]
}

If no relevant evidence found, return {"evidence": []}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 1000
    });
    
    const result = JSON.parse(response.choices[0].message.content || '{"evidence": []}');
    return result.evidence || [];
    
  } catch (error) {
    console.error(`❌ Extraction error: ${error.message}`);
    return [];
  }
}

async function debugWhyNoEvidence(document: any, question: any, content: string): Promise<void> {
  try {
    const debugPrompt = `You are debugging why no evidence was found for a legal question.

DOCUMENT: ${document.name}
QUESTION: "${question.question}"

CONTENT (first 1000 chars):
${content.substring(0, 1000)}

Analyze this content and explain:
1. Is this document relevant to the question?
2. What type of content is this (financial, technical, legal, etc.)?
3. Why might no evidence be found?
4. What questions would this document answer well?

Respond with JSON:
{
  "isRelevant": true/false,
  "contentType": "description of content",
  "reasonForNoEvidence": "explanation",
  "betterQuestions": ["question 1", "question 2"]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: debugPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 800
    });
    
    const analysis = JSON.parse(response.choices[0].message.content || '{}');
    console.log(`    🔍 Debug analysis:`);
    console.log(`      Relevant: ${analysis.isRelevant}`);
    console.log(`      Content type: ${analysis.contentType}`);
    console.log(`      No evidence reason: ${analysis.reasonForNoEvidence}`);
    if (analysis.betterQuestions?.length > 0) {
      console.log(`      Better questions: ${analysis.betterQuestions.slice(0, 2).join(', ')}`);
    }
    
  } catch (error) {
    console.log(`    ❌ Debug analysis failed: ${error.message}`);
  }
}

// Run debug
debugEvidenceExtraction().catch(console.error);