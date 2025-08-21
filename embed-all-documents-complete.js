#!/usr/bin/env node

import { db } from './server/db.js';
import { sql } from 'drizzle-orm';
import { EmbeddingService } from './server/services/embeddingService.js';

const embeddingService = new EmbeddingService();

async function embedAllDocuments() {
  console.log('\n🚀 STARTING COMPREHENSIVE DOCUMENT EMBEDDING');
  console.log('━'.repeat(60));
  
  // Get all documents that need embedding
  const documentsToEmbed = await db.execute(sql`
    SELECT d.id, d.name, d.deal_id,
           CASE WHEN d.ocr_text IS NOT NULL THEN true ELSE false END as has_ocr,
           CASE WHEN d.ai_summary IS NOT NULL THEN true ELSE false END as has_summary
    FROM documents d
    WHERE (d.ocr_text IS NOT NULL OR d.ai_summary IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1 FROM document_embeddings de 
        WHERE de.document_id = d.id
      )
    ORDER BY d.id
  `);
  
  const totalDocs = documentsToEmbed.rows.length;
  console.log(`📊 Found ${totalDocs} documents that need embedding`);
  
  if (totalDocs === 0) {
    console.log('✅ All documents are already embedded!');
    return;
  }
  
  let processed = 0;
  let successful = 0;
  let failed = 0;
  const batchSize = 5; // Process 5 at a time to avoid rate limits
  
  // Process in batches
  for (let i = 0; i < totalDocs; i += batchSize) {
    const batch = documentsToEmbed.rows.slice(i, Math.min(i + batchSize, totalDocs));
    
    console.log(`\n📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(totalDocs/batchSize)}`);
    
    for (const doc of batch) {
      processed++;
      const progress = ((processed / totalDocs) * 100).toFixed(1);
      
      try {
        console.log(`[${progress}%] Embedding document ${doc.id}: ${doc.name}`);
        await embeddingService.embedDocument(doc.id);
        successful++;
        console.log(`  ✅ Successfully embedded (OCR: ${doc.has_ocr ? 'Yes' : 'No'}, Summary: ${doc.has_summary ? 'Yes' : 'No'})`);
      } catch (error) {
        failed++;
        console.error(`  ❌ Failed to embed: ${error.message}`);
      }
    }
    
    // Add delay between batches to avoid rate limits
    if (i + batchSize < totalDocs) {
      console.log('  ⏳ Waiting 2 seconds before next batch...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n' + '━'.repeat(60));
  console.log('📊 EMBEDDING COMPLETE');
  console.log(`  ✅ Successful: ${successful}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📈 Success rate: ${((successful/totalDocs) * 100).toFixed(1)}%`);
  
  // Verify final status
  const finalCheck = await db.execute(sql`
    SELECT 
      COUNT(DISTINCT document_id) as embedded_count,
      COUNT(*) as total_chunks
    FROM document_embeddings
  `);
  
  const totalDocsCheck = await db.execute(sql`
    SELECT COUNT(*) as total
    FROM documents
    WHERE ocr_text IS NOT NULL OR ai_summary IS NOT NULL
  `);
  
  console.log('\n🎯 FINAL RAG SYSTEM STATUS:');
  console.log(`  Documents embedded: ${finalCheck.rows[0].embedded_count}/${totalDocsCheck.rows[0].total}`);
  console.log(`  Total chunks: ${finalCheck.rows[0].total_chunks}`);
  console.log(`  Coverage: ${((finalCheck.rows[0].embedded_count/totalDocsCheck.rows[0].total) * 100).toFixed(1)}%`);
}

// Run the embedding
console.log('🔧 Starting comprehensive embedding process...');
embedAllDocuments()
  .then(() => {
    console.log('\n✨ All documents embedded successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Embedding process failed:', error);
    process.exit(1);
  });