#!/usr/bin/env node

// EMERGENCY SCRIPT TO EMBED ALL DOCUMENTS IMMEDIATELY

import { db } from './server/db.js';
import { sql } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function embedAllDocumentsNow() {
  console.log('🚨 EMERGENCY RAG EMBEDDING - PROCESSING ALL DOCUMENTS');
  console.log('━'.repeat(70));
  
  // Get ALL documents that need embedding
  const docs = await db.execute(sql`
    SELECT 
      d.id,
      d.deal_id,
      d.name,
      d.ocr_text,
      d.ai_summary
    FROM documents d
    WHERE (d.ocr_text IS NOT NULL OR d.ai_summary IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1 FROM document_embeddings de 
        WHERE de.document_id = d.id
      )
    ORDER BY d.id
  `);
  
  console.log(`📊 Found ${docs.rows.length} documents without embeddings`);
  console.log('🚀 Starting immediate embedding process...\n');
  
  let processed = 0;
  let successful = 0;
  let failed = 0;
  
  for (const doc of docs.rows) {
    processed++;
    const progress = ((processed / docs.rows.length) * 100).toFixed(1);
    
    try {
      // Combine OCR and AI summary
      const fullText = [
        doc.ocr_text || '',
        doc.ai_summary || ''
      ].filter(Boolean).join('\n\n');
      
      if (!fullText || fullText.trim().length === 0) {
        console.log(`[${progress}%] ⏭️  Skipping ${doc.id}: No content`);
        continue;
      }
      
      // Create chunks (3000 chars each)
      const chunkSize = 3000;
      const chunks = [];
      for (let i = 0; i < fullText.length; i += chunkSize) {
        chunks.push(fullText.slice(i, i + chunkSize));
      }
      
      console.log(`[${progress}%] 📄 Processing: ${doc.name.substring(0, 50)}... (${chunks.length} chunks)`);
      
      // Generate embeddings for each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // Generate embedding
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: chunk,
        });
        
        const embedding = embeddingResponse.data[0].embedding;
        
        // Store in database
        await db.execute(sql`
          INSERT INTO document_embeddings (
            document_id,
            deal_id,
            document_name,
            chunk_text,
            chunk_index,
            embedding,
            token_count,
            metadata,
            created_at
          ) VALUES (
            ${doc.id},
            ${doc.deal_id},
            ${doc.name},
            ${chunk},
            ${i},
            ${JSON.stringify(embedding)}::vector,
            ${embeddingResponse.usage?.total_tokens || 0},
            ${JSON.stringify({
              hasOcr: !!doc.ocr_text,
              hasSummary: !!doc.ai_summary,
              chunkNumber: i + 1,
              totalChunks: chunks.length
            })}::jsonb,
            NOW()
          )
        `);
      }
      
      successful++;
      console.log(`  ✅ Successfully embedded ${chunks.length} chunks`);
      
      // Rate limiting - pause every 5 documents
      if (processed % 5 === 0) {
        console.log('  ⏳ Rate limit pause (2 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      failed++;
      console.error(`  ❌ Failed: ${error.message}`);
      
      // If rate limited, wait longer
      if (error.message && error.message.includes('429')) {
        console.log('  🛑 Rate limit hit - waiting 10 seconds...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  }
  
  console.log('\n' + '━'.repeat(70));
  console.log('📊 EMBEDDING COMPLETE');
  console.log(`  ✅ Successful: ${successful}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  ⏭️  Skipped: ${processed - successful - failed}`);
  
  // Final status check
  const finalStatus = await db.execute(sql`
    SELECT 
      COUNT(DISTINCT document_id) as docs_embedded,
      COUNT(*) as total_chunks,
      ROUND(AVG(token_count)) as avg_tokens
    FROM document_embeddings
  `);
  
  const totalDocs = await db.execute(sql`
    SELECT COUNT(*) as total
    FROM documents
    WHERE ocr_text IS NOT NULL OR ai_summary IS NOT NULL
  `);
  
  console.log('\n🎯 FINAL RAG SYSTEM STATUS:');
  console.log(`  📄 Documents embedded: ${finalStatus.rows[0].docs_embedded}/${totalDocs.rows[0].total}`);
  console.log(`  📦 Total chunks: ${finalStatus.rows[0].total_chunks}`);
  console.log(`  🎯 Coverage: ${((finalStatus.rows[0].docs_embedded/totalDocs.rows[0].total) * 100).toFixed(1)}%`);
  console.log(`  📊 Avg tokens/chunk: ${finalStatus.rows[0].avg_tokens}`);
  
  if (finalStatus.rows[0].docs_embedded === totalDocs.rows[0].total) {
    console.log('\n🎉 SUCCESS! All documents are now embedded in the RAG system!');
  } else {
    console.log(`\n⚠️  ${totalDocs.rows[0].total - finalStatus.rows[0].docs_embedded} documents still need embedding.`);
    console.log('   Run this script again to continue.');
  }
}

// Execute
console.log('Starting emergency embedding process...\n');
embedAllDocumentsNow()
  .then(() => {
    console.log('\n✨ Process complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Critical error:', error);
    process.exit(1);
  });