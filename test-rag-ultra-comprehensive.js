#!/usr/bin/env node

import { db } from './server/db.js';
import { sql } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 10 ULTRA-DETAILED TEST QUESTIONS
const testQuestions = [
  {
    id: 1,
    category: "Financial Deep Dive",
    question: "What are the exact revenue figures, burn rates, and funding history mentioned across all financial documents, pitch decks, and investor presentations? Include specific numbers, dates, and growth percentages."
  },
  {
    id: 2,
    category: "Legal Compliance",
    question: "List all specific legal agreements, contracts, NDAs, employment agreements, and intellectual property assignments found in the documents. Include party names, dates, and key terms."
  },
  {
    id: 3,
    category: "Clinical/Technical Details",
    question: "What are the specific clinical trial results, FDA approvals, CE markings, technical specifications, and product performance metrics mentioned in any technical or clinical documents?"
  },
  {
    id: 4,
    category: "Team & Leadership",
    question: "Who are all the executives, board members, advisors, and key employees mentioned across all documents? Include their backgrounds, previous companies, and specific roles."
  },
  {
    id: 5,
    category: "IP & Patents",
    question: "What patents, trademarks, trade secrets, and proprietary technologies are described? Include patent numbers, filing dates, jurisdictions, and technology descriptions."
  },
  {
    id: 6,
    category: "Market & Competition",
    question: "What specific market size data, competitor analysis, market share percentages, and growth projections are mentioned? Include TAM, SAM, SOM figures and competitor names."
  },
  {
    id: 7,
    category: "Product Development",
    question: "What are the product roadmap milestones, development timelines, R&D investments, and technical challenges discussed? Include specific dates, budget allocations, and engineering details."
  },
  {
    id: 8,
    category: "Customer & Sales",
    question: "List all customer names, case studies, pilot programs, sales figures, pricing models, and customer testimonials found in the documents. Include deal sizes and contract terms."
  },
  {
    id: 9,
    category: "Risk Analysis",
    question: "What specific risks, challenges, regulatory hurdles, competitive threats, and mitigation strategies are mentioned across all due diligence and analysis documents?"
  },
  {
    id: 10,
    category: "Cross-Document Synthesis",
    question: "Synthesize information from multiple documents: How do the financial projections in the pitch deck align with the actual performance data in financial statements? Are there any discrepancies between different documents?"
  }
];

async function searchDocuments(query) {
  console.log(`\n🔍 Searching: "${query.substring(0, 100)}..."`);
  
  try {
    // Generate embedding for the query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;
    
    // Search for similar documents using pgvector
    const searchResults = await db.execute(sql`
      SELECT 
        de.document_id,
        de.document_name,
        de.chunk_text,
        de.chunk_index,
        de.embedding <=> $1::vector as distance,
        1 - (de.embedding <=> $1::vector) as similarity
      FROM document_embeddings de
      ORDER BY de.embedding <=> $1::vector
      LIMIT 10
    `, [JSON.stringify(queryEmbedding)]);
    
    return searchResults.rows;
  } catch (error) {
    console.error(`❌ Search failed: ${error.message}`);
    return [];
  }
}

async function runComprehensiveTests() {
  console.log('🚀 RUNNING ULTRA-COMPREHENSIVE RAG SYSTEM TESTS');
  console.log('━'.repeat(80));
  
  // Check current embedding status
  const status = await db.execute(sql`
    SELECT 
      COUNT(DISTINCT document_id) as docs_embedded,
      COUNT(*) as total_chunks
    FROM document_embeddings
  `);
  
  console.log(`\n📊 Current Status:`);
  console.log(`  Documents embedded: ${status.rows[0].docs_embedded}`);
  console.log(`  Total chunks: ${status.rows[0].total_chunks}`);
  
  if (status.rows[0].docs_embedded < 100) {
    console.log('\n⚠️  WARNING: Less than 100 documents embedded. Results may be limited.');
    console.log('   Run embed-all-documents-fixed.js to embed all documents.');
  }
  
  // Run each test question
  const results = [];
  let totalTime = 0;
  let successCount = 0;
  
  for (const test of testQuestions) {
    console.log('\n' + '─'.repeat(80));
    console.log(`📝 Test ${test.id}: ${test.category}`);
    console.log(`   Question: ${test.question.substring(0, 150)}...`);
    
    const startTime = Date.now();
    const searchResults = await searchDocuments(test.question);
    const searchTime = Date.now() - startTime;
    totalTime += searchTime;
    
    if (searchResults.length > 0) {
      successCount++;
      const topResult = searchResults[0];
      
      console.log(`   ✅ Found ${searchResults.length} relevant chunks in ${searchTime}ms`);
      console.log(`   📄 Top match: ${topResult.document_name}`);
      console.log(`   📊 Similarity: ${(topResult.similarity * 100).toFixed(2)}%`);
      console.log(`   📝 Preview: ${topResult.chunk_text.substring(0, 200)}...`);
      
      // Show diversity of sources
      const uniqueDocs = new Set(searchResults.map(r => r.document_name));
      console.log(`   📚 Sources: ${uniqueDocs.size} unique documents`);
      
      results.push({
        test: test.id,
        category: test.category,
        success: true,
        time: searchTime,
        topSimilarity: topResult.similarity,
        uniqueSources: uniqueDocs.size
      });
    } else {
      console.log(`   ❌ No results found`);
      results.push({
        test: test.id,
        category: test.category,
        success: false,
        time: searchTime,
        topSimilarity: 0,
        uniqueSources: 0
      });
    }
  }
  
  // Summary
  console.log('\n' + '━'.repeat(80));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('━'.repeat(80));
  
  console.log(`\n✅ Success Rate: ${successCount}/${testQuestions.length} (${(successCount/testQuestions.length * 100).toFixed(1)}%)`);
  console.log(`⚡ Average Search Time: ${(totalTime/testQuestions.length).toFixed(0)}ms`);
  
  // Performance breakdown
  const avgSimilarity = results.filter(r => r.success).reduce((sum, r) => sum + r.topSimilarity, 0) / successCount;
  const avgSources = results.filter(r => r.success).reduce((sum, r) => sum + r.uniqueSources, 0) / successCount;
  
  console.log(`📈 Average Similarity Score: ${(avgSimilarity * 100).toFixed(2)}%`);
  console.log(`📚 Average Unique Sources: ${avgSources.toFixed(1)} documents per query`);
  
  // Category performance
  console.log('\n📋 Performance by Category:');
  results.forEach(r => {
    const status = r.success ? '✅' : '❌';
    const similarity = r.success ? `${(r.topSimilarity * 100).toFixed(1)}%` : 'N/A';
    console.log(`  ${status} ${r.category}: ${r.time}ms, Similarity: ${similarity}`);
  });
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  if (status.rows[0].docs_embedded < 1000) {
    console.log('  ⚠️  Continue embedding process - only partial documents are indexed');
  }
  if (avgSimilarity < 0.3) {
    console.log('  ⚠️  Low similarity scores - consider improving document chunking strategy');
  }
  if (totalTime / testQuestions.length > 2000) {
    console.log('  ⚠️  Search times exceed 2-second target - consider index optimization');
  }
  if (successCount === testQuestions.length && avgSimilarity > 0.4 && totalTime / testQuestions.length < 1000) {
    console.log('  🌟 EXCELLENT! RAG system is performing optimally!');
  }
}

// Run tests
console.log('🔧 Starting comprehensive RAG system tests...\n');
runComprehensiveTests()
  .then(() => {
    console.log('\n✨ Testing complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });