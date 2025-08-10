#!/usr/bin/env tsx
/**
 * INTELLIGENT DOCUMENT ASSIGNMENT
 * 
 * Root cause: Documents assigned to Legal agent don't contain relevant legal share information
 * Solution: Analyze document content and intelligently assign to appropriate questions
 */

import { storage } from './server/storage';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface DocumentAnalysis {
  docId: number;
  name: string;
  contentType: string;
  relevantAgents: string[];
  suggestedQuestions: string[];
  legalRelevance: number; // 0-100
  commercialRelevance: number;
  clinicalRelevance: number;
  content: string;
}

const LEGAL_QUESTIONS = [
  { id: 'sha_1', question: 'What class of shares exist and what are their rights?', keywords: ['shares', 'equity', 'class', 'rights', 'common', 'preferred'] },
  { id: 'sha_2', question: 'Are liquidation preferences clearly defined?', keywords: ['liquidation', 'preference', 'waterfall', 'distribution'] },
  { id: 'sha_3', question: 'Is anti-dilution protection present and adequate?', keywords: ['anti-dilution', 'dilution', 'protection', 'adjustment'] },
  { id: 'gov_1', question: 'Is board composition clearly defined?', keywords: ['board', 'directors', 'composition', 'governance'] },
  { id: 'gov_2', question: 'Are voting rights clearly specified for all share classes?', keywords: ['voting', 'rights', 'shares', 'control'] },
  { id: 'ip_1', question: 'Are IP assignment agreements in place for all team members?', keywords: ['intellectual property', 'IP', 'assignment', 'agreements'] },
  { id: 'commercial_1', question: 'Are SLAs, warranties, and indemnity clauses present in key agreements?', keywords: ['SLA', 'warranty', 'indemnity', 'agreement'] },
  { id: 'lit_1', question: 'Are there any pending litigations or regulatory proceedings?', keywords: ['litigation', 'legal', 'proceedings', 'lawsuit'] },
  { id: 'reg_1', question: 'Are there FDA submissions or other regulatory approvals in progress?', keywords: ['FDA', 'regulatory', 'approval', 'compliance'] },
  { id: 'financial_1', question: 'Are there warrants, convertible instruments, or debt securities outstanding?', keywords: ['warrants', 'convertible', 'debt', 'securities'] }
];

async function createIntelligentDocumentAssignment() {
  console.log('🧠 INTELLIGENT DOCUMENT ASSIGNMENT');
  console.log('==================================');
  
  const dealId = 33;
  
  try {
    // Get all documents
    const allDocs = await storage.getDocumentsByDealId(dealId);
    console.log(`📄 Total documents: ${allDocs.length}`);
    
    // Analyze first 50 documents to understand content distribution
    const sampleSize = Math.min(50, allDocs.length);
    const sampleDocs = allDocs.slice(0, sampleSize);
    console.log(`🔍 Analyzing ${sampleSize} documents for intelligent assignment...`);
    
    const documentAnalyses: DocumentAnalysis[] = [];
    
    for (let i = 0; i < sampleDocs.length; i++) {
      const doc = sampleDocs[i];
      console.log(`📋 ${i+1}/${sampleSize}: ${doc.name}`);
      
      const analysis = await analyzeDocumentForRelevance(doc);
      documentAnalyses.push(analysis);
      
      // Show progress every 10 documents
      if ((i + 1) % 10 === 0) {
        console.log(`  ✅ Processed ${i + 1}/${sampleSize} documents`);
      }
    }
    
    // Categorize documents by relevance
    console.log('\n📊 DOCUMENT CATEGORIZATION RESULTS');
    console.log('==================================');
    
    const legalDocs = documentAnalyses.filter(d => d.legalRelevance > 50);
    const commercialDocs = documentAnalyses.filter(d => d.commercialRelevance > 50);
    const clinicalDocs = documentAnalyses.filter(d => d.clinicalRelevance > 50);
    
    console.log(`📚 Legal-relevant documents: ${legalDocs.length}/${documentAnalyses.length}`);
    console.log(`💼 Commercial-relevant documents: ${commercialDocs.length}/${documentAnalyses.length}`);
    console.log(`🧬 Clinical-relevant documents: ${clinicalDocs.length}/${documentAnalyses.length}`);
    
    // Show top legal documents
    const topLegalDocs = legalDocs.sort((a, b) => b.legalRelevance - a.legalRelevance).slice(0, 10);
    console.log('\n🏆 TOP 10 LEGAL-RELEVANT DOCUMENTS:');
    topLegalDocs.forEach((doc, i) => {
      console.log(`  ${i+1}. ${doc.name} (${doc.legalRelevance}% legal relevance)`);
      console.log(`     Type: ${doc.contentType}`);
      console.log(`     Suggested questions: ${doc.suggestedQuestions.slice(0, 2).join(', ')}`);
    });
    
    // Find documents with actual share/equity information
    console.log('\n🔍 SEARCHING FOR SHARE/EQUITY DOCUMENTS:');
    const shareRelevantDocs = documentAnalyses.filter(d => 
      d.content.toLowerCase().includes('shares') || 
      d.content.toLowerCase().includes('equity') ||
      d.content.toLowerCase().includes('shareholder') ||
      d.content.toLowerCase().includes('stock')
    );
    
    console.log(`📈 Documents with share/equity content: ${shareRelevantDocs.length}`);
    shareRelevantDocs.forEach(doc => {
      console.log(`  • ${doc.name} (${doc.legalRelevance}% legal relevance)`);
      const shareContent = doc.content.toLowerCase();
      if (shareContent.includes('shares')) console.log(`    → Contains 'shares'`);
      if (shareContent.includes('equity')) console.log(`    → Contains 'equity'`);
      if (shareContent.includes('shareholder')) console.log(`    → Contains 'shareholder'`);
    });
    
    // Generate recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (legalDocs.length < 10) {
      console.log('⚠️  Very few legal-relevant documents found');
      console.log('   → Consider uploading legal documents (articles of incorporation, shareholder agreements, etc.)');
    }
    
    if (shareRelevantDocs.length === 0) {
      console.log('⚠️  No documents contain share/equity information');
      console.log('   → Share-related questions will have no evidence');
      console.log('   → Focus on questions about agreements, compliance, IP instead');
    }
    
    // Create optimized question-document mapping
    console.log('\n🎯 OPTIMIZED QUESTION-DOCUMENT MAPPING:');
    await createOptimizedQuestionMapping(documentAnalyses, dealId);
    
  } catch (error) {
    console.error('❌ Intelligent assignment error:', error);
  }
}

async function analyzeDocumentForRelevance(document: any): Promise<DocumentAnalysis> {
  
  // Get document content
  const content = document.ocrText || 
                 (document.aiSummary?.executiveSummary) || 
                 (typeof document.aiSummary === 'string' ? document.aiSummary : '') || 
                 '';
  
  if (!content || content.length < 50) {
    return {
      docId: document.id,
      name: document.name,
      contentType: 'insufficient_content',
      relevantAgents: [],
      suggestedQuestions: [],
      legalRelevance: 0,
      commercialRelevance: 0,
      clinicalRelevance: 0,
      content: content
    };
  }
  
  try {
    const prompt = `Analyze this document and determine its relevance for different types of analysis.

DOCUMENT: ${document.name}
CONTENT: ${content.substring(0, 1500)}

Analyze and score this document's relevance (0-100) for:
1. Legal analysis (shares, governance, IP, compliance, contracts)
2. Commercial analysis (market, business model, partnerships)  
3. Clinical analysis (medical devices, trials, regulatory)

Also identify the document type and suggest which specific questions it could answer.

Respond with JSON:
{
  "contentType": "brief description of document type",
  "legalRelevance": 0-100,
  "commercialRelevance": 0-100, 
  "clinicalRelevance": 0-100,
  "relevantAgents": ["Legal", "Commercial", "Clinical"],
  "suggestedQuestions": ["specific question 1", "specific question 2"],
  "keyTopics": ["topic1", "topic2", "topic3"],
  "containsShareInfo": true/false,
  "containsFinancialInfo": true/false,
  "containsIPInfo": true/false
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 800
    });
    
    const analysis = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      docId: document.id,
      name: document.name,
      contentType: analysis.contentType || 'unknown',
      relevantAgents: analysis.relevantAgents || [],
      suggestedQuestions: analysis.suggestedQuestions || [],
      legalRelevance: analysis.legalRelevance || 0,
      commercialRelevance: analysis.commercialRelevance || 0,
      clinicalRelevance: analysis.clinicalRelevance || 0,
      content: content
    };
    
  } catch (error) {
    console.error(`❌ Analysis error for ${document.name}: ${error.message}`);
    return {
      docId: document.id,
      name: document.name,
      contentType: 'analysis_failed',
      relevantAgents: [],
      suggestedQuestions: [],
      legalRelevance: 0,
      commercialRelevance: 0,
      clinicalRelevance: 0,
      content: content
    };
  }
}

async function createOptimizedQuestionMapping(
  documentAnalyses: DocumentAnalysis[], 
  dealId: number
): Promise<void> {
  
  console.log('Creating optimized question-document mapping...');
  
  // For each legal question, find the most relevant documents
  for (const question of LEGAL_QUESTIONS) {
    console.log(`\n❓ ${question.question}`);
    
    // Find documents that mention question keywords
    const relevantDocs = documentAnalyses.filter(doc => {
      const contentLower = doc.content.toLowerCase();
      const keywordMatches = question.keywords.filter(keyword => 
        contentLower.includes(keyword.toLowerCase())
      );
      return keywordMatches.length > 0 && doc.legalRelevance > 30;
    });
    
    if (relevantDocs.length > 0) {
      console.log(`  📄 ${relevantDocs.length} relevant documents found:`);
      relevantDocs.slice(0, 3).forEach(doc => {
        console.log(`    • ${doc.name} (${doc.legalRelevance}% relevance)`);
      });
    } else {
      console.log(`  ⚠️  No relevant documents found`);
      
      // Try to find documents with any legal relevance
      const anyLegalDocs = documentAnalyses
        .filter(doc => doc.legalRelevance > 50)
        .sort((a, b) => b.legalRelevance - a.legalRelevance)
        .slice(0, 2);
        
      if (anyLegalDocs.length > 0) {
        console.log(`    💡 Best alternative documents:`);
        anyLegalDocs.forEach(doc => {
          console.log(`      • ${doc.name} (${doc.legalRelevance}% legal relevance)`);
        });
      }
    }
  }
  
  console.log('\n✅ Optimized mapping complete');
}

// Run intelligent document assignment
createIntelligentDocumentAssignment().catch(console.error);