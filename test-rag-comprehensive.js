// Comprehensive RAG System Test with 10 Ultra-Detailed Questions
import { EmbeddingService } from './server/services/embeddingService.ts';
import { db } from './server/db.ts';
import { documents, agentAnalyses } from './shared/schema.ts';
import { eq, sql } from 'drizzle-orm';

// Test questions covering various aspects of the Neteera deal (Deal 29)
const testQuestions = [
  {
    query: "What are Neteera's key financial metrics including revenue projections, burn rate, and funding history?",
    expectedContext: ["revenue", "financial", "funding", "burn rate", "projections", "ARR", "TAM"]
  },
  {
    query: "Describe the clinical trial results and regulatory status for Neteera's medical devices",
    expectedContext: ["clinical", "trial", "FDA", "regulatory", "medical", "device", "approval", "MDR"]
  },
  {
    query: "What intellectual property does Neteera have including patents, trademarks, and trade secrets?",
    expectedContext: ["patent", "IP", "intellectual property", "trademark", "proprietary", "technology"]
  },
  {
    query: "Who are the key executives and board members, and what are their backgrounds?",
    expectedContext: ["CEO", "CTO", "founder", "board", "executive", "management", "team"]
  },
  {
    query: "What are the main legal risks and compliance issues identified in the due diligence?",
    expectedContext: ["legal", "risk", "compliance", "contract", "liability", "terms", "agreement"]
  },
  {
    query: "Explain Neteera's core technology, how the contactless monitoring works, and key technical differentiators",
    expectedContext: ["technology", "radar", "monitoring", "contactless", "sensor", "algorithm", "AI"]
  },
  {
    query: "What is the competitive landscape, who are the main competitors, and what is Neteera's market position?",
    expectedContext: ["competitor", "market", "competitive", "advantage", "differentiation", "position"]
  },
  {
    query: "What are the pricing models, business model details, and go-to-market strategy?",
    expectedContext: ["pricing", "business model", "SaaS", "subscription", "go-to-market", "sales", "strategy"]
  },
  {
    query: "What partnerships, collaborations, or strategic relationships does Neteera have?",
    expectedContext: ["partnership", "collaboration", "strategic", "relationship", "customer", "client"]
  },
  {
    query: "What are the investment terms, valuation, equity structure, and cap table details?",
    expectedContext: ["investment", "valuation", "equity", "cap table", "shares", "ownership", "terms"]
  }
];

async function testRAGSystem() {
  console.log('🚀 COMPREHENSIVE RAG SYSTEM TEST');
  console.log('=' .repeat(80));
  console.log('Testing with 10 ultra-detailed questions on Neteera (Deal 29)\n');
  
  // First check embedding status
  const embeddingStats = await EmbeddingService.getEmbeddingStats(29);
  console.log('📊 Current Embedding Statistics:');
  console.log(`  - Total chunks: ${embeddingStats.totalChunks}`);
  console.log(`  - Unique documents: ${embeddingStats.uniqueDocuments}`);
  console.log(`  - Average chunk size: ${embeddingStats.avgChunkSize} chars\n`);
  
  if (embeddingStats.totalChunks === 0) {
    console.log('⚠️ WARNING: No embeddings found for deal 29. Please run embed-all-documents.js first!\n');
  }
  
  // Test each question
  const results = [];
  
  for (let i = 0; i < testQuestions.length; i++) {
    const test = testQuestions[i];
    console.log(`\n📝 QUESTION ${i + 1}/${testQuestions.length}`);
    console.log('─'.repeat(60));
    console.log(`Q: ${test.query}`);
    console.log('');
    
    const startTime = Date.now();
    
    try {
      // Search for relevant chunks
      const searchResults = await EmbeddingService.searchSimilarChunks(test.query, 29, 5);
      const searchTime = Date.now() - startTime;
      
      console.log(`⚡ Search Time: ${searchTime}ms`);
      console.log(`📄 Found ${searchResults.length} relevant chunks`);
      
      if (searchResults.length > 0) {
        console.log('\n🎯 Top Results:');
        
        searchResults.slice(0, 3).forEach((result, idx) => {
          console.log(`\n  ${idx + 1}. Document: ${result.metadata.documentName}`);
          console.log(`     Similarity: ${result.similarity.toFixed(3)}`);
          console.log(`     Type: ${result.metadata.documentType}`);
          
          // Check for expected context matches
          const chunkLower = result.chunk.toLowerCase();
          const matchedKeywords = test.expectedContext.filter(keyword => 
            chunkLower.includes(keyword.toLowerCase())
          );
          
          if (matchedKeywords.length > 0) {
            console.log(`     ✅ Matched keywords: ${matchedKeywords.join(', ')}`);
          }
          
          // Show preview of the chunk
          const preview = result.chunk.substring(0, 200).replace(/\n/g, ' ');
          console.log(`     Preview: "${preview}..."`);
        });
        
        // Calculate quality score
        const topResult = searchResults[0];
        const qualityScore = {
          similarity: topResult.similarity,
          hasExpectedContent: test.expectedContext.some(keyword => 
            topResult.chunk.toLowerCase().includes(keyword.toLowerCase())
          ),
          responseTime: searchTime,
          resultCount: searchResults.length
        };
        
        results.push({
          question: test.query,
          success: true,
          ...qualityScore
        });
        
        // Quality assessment
        if (qualityScore.similarity > 0.4 && qualityScore.hasExpectedContent) {
          console.log('\n✅ EXCELLENT: High relevance and correct context');
        } else if (qualityScore.similarity > 0.3) {
          console.log('\n⚠️ GOOD: Moderate relevance');
        } else {
          console.log('\n❌ POOR: Low relevance - may need better embeddings');
        }
        
      } else {
        console.log('❌ No results found!');
        results.push({
          question: test.query,
          success: false,
          error: 'No results'
        });
      }
      
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      results.push({
        question: test.query,
        success: false,
        error: error.message
      });
    }
  }
  
  // Final summary
  console.log('\n');
  console.log('=' .repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('=' .repeat(80));
  
  const successful = results.filter(r => r.success).length;
  const avgSearchTime = results
    .filter(r => r.success && r.responseTime)
    .reduce((sum, r) => sum + r.responseTime, 0) / successful || 0;
  
  const avgSimilarity = results
    .filter(r => r.success && r.similarity)
    .reduce((sum, r) => sum + r.similarity, 0) / successful || 0;
  
  const withExpectedContent = results
    .filter(r => r.success && r.hasExpectedContent).length;
  
  console.log(`✅ Successful queries: ${successful}/${testQuestions.length}`);
  console.log(`⚡ Average search time: ${avgSearchTime.toFixed(0)}ms`);
  console.log(`📊 Average similarity score: ${avgSimilarity.toFixed(3)}`);
  console.log(`🎯 Queries with expected content: ${withExpectedContent}/${successful}`);
  
  // Performance assessment
  console.log('\n🏆 PERFORMANCE ASSESSMENT:');
  if (avgSearchTime < 1000 && successful === testQuestions.length) {
    console.log('⭐⭐⭐⭐⭐ EXCELLENT - All queries successful with sub-second response!');
  } else if (avgSearchTime < 2000 && successful >= 8) {
    console.log('⭐⭐⭐⭐ VERY GOOD - Most queries successful with good performance');
  } else if (avgSearchTime < 3000 && successful >= 6) {
    console.log('⭐⭐⭐ GOOD - Acceptable performance with room for improvement');
  } else {
    console.log('⭐⭐ NEEDS IMPROVEMENT - Consider re-embedding documents or tuning parameters');
  }
  
  // Detailed results table
  console.log('\n📋 DETAILED RESULTS:');
  console.log('─'.repeat(80));
  results.forEach((r, i) => {
    const status = r.success ? '✅' : '❌';
    const time = r.responseTime ? `${r.responseTime}ms` : 'N/A';
    const sim = r.similarity ? r.similarity.toFixed(3) : 'N/A';
    const context = r.hasExpectedContent ? 'YES' : 'NO';
    
    console.log(`${i + 1}. ${status} | Time: ${time.padEnd(7)} | Sim: ${sim} | Context: ${context}`);
    console.log(`   Q: ${r.question.substring(0, 60)}...`);
  });
}

// Run the comprehensive test
console.log('🔧 Aescuvest RAG System - Comprehensive Test Suite');
console.log('Testing document search and retrieval capabilities...\n');

testRAGSystem()
  .then(() => {
    console.log('\n✅ Test suite complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Test suite failed:', err);
    process.exit(1);
  });