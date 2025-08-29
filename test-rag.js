// Test script for RAG system
import { EmbeddingService } from './server/services/embeddingService.ts';
import { db } from './server/db.ts';
import { documents } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

async function testRAG() {
  console.log('🚀 Starting RAG test for deal 29...\n');
  
  try {
    // Step 1: Process one document as a test
    console.log('📄 Step 1: Finding a document with OCR text...');
    const docs = await db.select()
      .from(documents)
      .where(eq(documents.dealId, 29))
      .limit(5);
    
    const docWithOCR = docs.find(d => d.ocrText && d.ocrText.length > 100);
    
    if (!docWithOCR) {
      console.log('❌ No documents with OCR text found');
      return;
    }
    
    console.log(`✅ Found document: ${docWithOCR.name}`);
    console.log(`   OCR text length: ${docWithOCR.ocrText.length} characters\n`);
    
    // Step 2: Generate embeddings for this document
    console.log('🔄 Step 2: Generating embeddings...');
    const startEmbed = Date.now();
    
    await EmbeddingService.embedDocument(
      docWithOCR.id,  // documentId
      29,  // dealId
      docWithOCR.name,  // documentName
      docWithOCR.ocrText,  // text
      docWithOCR.type || 'general'  // documentType
    );
    
    const embedTime = Date.now() - startEmbed;
    console.log(`✅ Embeddings generated in ${embedTime}ms\n`);
    
    // Step 3: Test semantic search
    console.log('🔍 Step 3: Testing semantic search...');
    const testQuery = "What are the key financial metrics and revenue projections?";
    console.log(`   Query: "${testQuery}"`);
    
    const startSearch = Date.now();
    const results = await EmbeddingService.searchSimilarChunks(testQuery, 29, 5);
    const searchTime = Date.now() - startSearch;
    
    console.log(`✅ Search completed in ${searchTime}ms`);
    console.log(`   Found ${results.length} relevant chunks\n`);
    
    if (results.length > 0) {
      console.log('📊 Top relevant chunks:');
      results.slice(0, 3).forEach((result, idx) => {
        console.log(`\n   ${idx + 1}. Document: ${result.metadata.documentName}`);
        console.log(`      Similarity: ${result.similarity.toFixed(3)}`);
        console.log(`      Preview: ${result.chunk.substring(0, 150)}...`);
      });
    }
    
    // Step 4: Get embedding stats
    console.log('\n📈 Step 4: Getting embedding stats...');
    const stats = await EmbeddingService.getEmbeddingStats(29);
    console.log(`   Total chunks: ${stats.totalChunks}`);
    console.log(`   Unique documents: ${stats.uniqueDocuments}`);
    console.log(`   Average chunk size: ${stats.avgChunkSize} characters`);
    
    console.log('\n✅ RAG test complete!');
    console.log(`⚡ Total semantic search time: ${searchTime}ms (target: <2000ms)`);
    
    if (searchTime < 2000) {
      console.log('🎉 Performance target achieved!');
    } else {
      console.log('⚠️ Performance needs optimization');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
  
  process.exit(0);
}

// Run the test
testRAG();