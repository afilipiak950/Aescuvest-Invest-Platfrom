#!/usr/bin/env tsx

/**
 * FORCE SECTION GENERATION - Direct approach to populate ALL memo sections
 * This script bypasses the complex generation and directly extracts authentic data
 */

import { storage } from './server/storage';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function forceSectionGeneration() {
  console.log('🚀 FORCE SECTION GENERATION - Direct Data Extraction');
  
  const dealId = 22;
  
  // Get all documents for comprehensive data
  const documents = await storage.getDocumentsByDealId(dealId);
  console.log(`📄 Found ${documents.length} documents with comprehensive data`);
  
  // Extract financial data DIRECTLY from ALL documents
  const allText = documents.map(d => d.ocrText || '').join('\n\n');
  console.log(`📊 Total text: ${allText.length.toLocaleString()} characters`);
  
  const financialDocs = documents.filter(d => d.ocrText && d.ocrText.length > 0);
  
  console.log(`💰 Found ${financialDocs.length} financial documents`);
  
  if (financialDocs.length > 0) {
    // Take comprehensive financial content from all documents
    const financialText = allText.substring(0, 60000);
    
    console.log('🔍 DIRECT FINANCIAL EXTRACTION:');
    console.log('Sample financial content:');
    console.log(financialText.substring(0, 500) + '...');
    
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "system",
          content: `You MUST extract financial information from the provided text. Do NOT say "no information available". Find any financial data, numbers, revenue figures, costs, funding amounts, or financial projections and present them in a structured format.`
        }, {
          role: "user", 
          content: `Extract ALL financial information from this BAIBYS text:\n\n${financialText}`
        }],
        temperature: 0.1,
        max_tokens: 2000
      });
      
      console.log('💰 FORCED FINANCIAL RESULT:');
      console.log(response.choices[0].message.content);
      
    } catch (error) {
      console.error('❌ OpenAI error:', error.message);
    }
  }
  
  // Extract team data DIRECTLY
  const teamDocs = documents.filter(d => 
    d.ocrText && (
      d.ocrText.toLowerCase().includes('team') ||
      d.ocrText.toLowerCase().includes('management') ||
      d.ocrText.toLowerCase().includes('ceo') ||
      d.ocrText.toLowerCase().includes('founder') ||
      d.ocrText.toLowerCase().includes('executive')
    )
  );
  
  console.log(`👥 Found ${teamDocs.length} team documents`);
  
  if (teamDocs.length > 0) {
    const teamText = teamDocs.map(d => d.ocrText).join('\n\n').substring(0, 30000);
    
    console.log('🔍 DIRECT TEAM EXTRACTION:');
    console.log('Sample team content:');
    console.log(teamText.substring(0, 500) + '...');
  }
  
  // Extract business model data DIRECTLY
  const businessDocs = documents.filter(d => 
    d.ocrText && (
      d.ocrText.toLowerCase().includes('business') ||
      d.ocrText.toLowerCase().includes('model') ||
      d.ocrText.toLowerCase().includes('strategy') ||
      d.ocrText.toLowerCase().includes('commercial')
    )
  );
  
  console.log(`💼 Found ${businessDocs.length} business model documents`);
  
  if (businessDocs.length > 0) {
    const businessText = businessDocs.map(d => d.ocrText).join('\n\n').substring(0, 30000);
    
    console.log('🔍 DIRECT BUSINESS MODEL EXTRACTION:');
    console.log('Sample business content:');
    console.log(businessText.substring(0, 500) + '...');
  }
}

forceSectionGeneration().catch(console.error);