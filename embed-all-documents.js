// Script to embed all existing documents into the RAG system
import { db } from './server/db.ts';
import { documents } from './shared/schema.ts';
import { EmbeddingService } from './server/services/embeddingService.ts';
import { isNotNull, sql } from 'drizzle-orm';

async function embedAllDocuments() {
  console.log('🚀 Starting comprehensive document embedding process...\n');
  
  try {
    // Get all documents with OCR text or AI summaries that don't have embeddings
    const unembeddedDocs = await db.execute(sql`
      SELECT d.id, d.name, d.deal_id, d.ocr_text, d.ai_summary, d.type
      FROM documents d
      WHERE (d.ocr_text IS NOT NULL OR d.ai_summary IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM document_embeddings de 
          WHERE de.document_id = d.id
        )
      ORDER BY d.deal_id, d.id
    `);
    
    console.log(`📊 Found ${unembeddedDocs.rows.length} documents without embeddings`);
    
    if (unembeddedDocs.rows.length === 0) {
      console.log('✅ All documents are already embedded!');
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Process documents in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < unembeddedDocs.rows.length; i += batchSize) {
      const batch = unembeddedDocs.rows.slice(i, Math.min(i + batchSize, unembeddedDocs.rows.length));
      
      console.log(`\n📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(unembeddedDocs.rows.length/batchSize)}...`);
      
      // Process batch in parallel
      await Promise.all(batch.map(async (doc) => {
        try {
          // Combine OCR text and AI summary for maximum context
          let textToEmbed = '';
          
          if (doc.ocr_text) {
            const ocrText = typeof doc.ocr_text === 'string' ? doc.ocr_text : JSON.stringify(doc.ocr_text);
            textToEmbed += 'OCR TEXT:\n' + ocrText + '\n\n';
          }
          
          if (doc.ai_summary) {
            const summary = typeof doc.ai_summary === 'string' ? doc.ai_summary : JSON.stringify(doc.ai_summary);
            textToEmbed += 'AI SUMMARY:\n' + summary;
          }
          
          if (!textToEmbed.trim()) {
            console.log(`  ⚠️ Skipping ${doc.name} - no text to embed`);
            return;
          }
          
          console.log(`  🔄 Embedding: ${doc.name} (${textToEmbed.length} chars)`);
          
          await EmbeddingService.embedDocument(
            doc.id,
            doc.deal_id,
            doc.name,
            textToEmbed,
            doc.type || 'general'
          );
          
          successCount++;
          console.log(`  ✅ Embedded: ${doc.name}`);
        } catch (error) {
          errorCount++;
          const errorMsg = `Failed to embed ${doc.name}: ${error.message}`;
          errors.push(errorMsg);
          console.error(`  ❌ ${errorMsg}`);
        }
      }));
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < unembeddedDocs.rows.length) {
        console.log('  ⏳ Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 EMBEDDING COMPLETE');
    console.log('='.repeat(60));
    console.log(`✅ Successfully embedded: ${successCount} documents`);
    console.log(`❌ Failed: ${errorCount} documents`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
      if (errors.length > 10) {
        console.log(`  ... and ${errors.length - 10} more errors`);
      }
    }
    
    // Verify final stats
    const finalStats = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM documents WHERE ocr_text IS NOT NULL OR ai_summary IS NOT NULL) as total_with_content,
        (SELECT COUNT(DISTINCT document_id) FROM document_embeddings) as total_embedded
    `);
    
    console.log('\n📈 Final Statistics:');
    console.log(`- Documents with content: ${finalStats.rows[0].total_with_content}`);
    console.log(`- Documents with embeddings: ${finalStats.rows[0].total_embedded}`);
    console.log(`- Coverage: ${(finalStats.rows[0].total_embedded / finalStats.rows[0].total_with_content * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the embedding process
console.log('🔧 Aescuvest RAG System - Document Embedding Tool');
console.log('='.repeat(60));
embedAllDocuments()
  .then(() => {
    console.log('\n✅ Embedding process complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Embedding process failed:', err);
    process.exit(1);
  });