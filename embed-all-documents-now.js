#!/usr/bin/env node

import { db } from './server/db.js';
import { documents, documentEmbeddings } from './server/db.js';
import { eq, sql, and, isNotNull, or } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class EmbeddingService {
  async embedDocument(documentId) {
    // Get document data
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Check if already embedded
    const existing = await db
      .select()
      .from(documentEmbeddings)
      .where(eq(documentEmbeddings.documentId, documentId));

    if (existing.length > 0) {
      console.log(`  ⏭️  Document ${documentId} already embedded`);
      return;
    }

    // Combine OCR text and AI summary
    const fullText = [
      document.ocrText || '',
      document.aiSummary || ''
    ].filter(Boolean).join('\n\n');

    if (!fullText || fullText.trim().length === 0) {
      throw new Error(`Document ${documentId} has no text content`);
    }

    // Split into chunks (3000 chars each)
    const chunkSize = 3000;
    const chunks = [];
    
    for (let i = 0; i < fullText.length; i += chunkSize) {
      chunks.push(fullText.slice(i, i + chunkSize));
    }

    // Generate embeddings for each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: chunk,
      });

      const embedding = embeddingResponse.data[0].embedding;
      
      // Store embedding
      await db.insert(documentEmbeddings).values({
        documentId: document.id,
        dealId: document.dealId,
        documentName: document.name,
        chunkText: chunk,
        chunkIndex: i,
        embedding: JSON.stringify(embedding),
        tokenCount: embeddingResponse.usage?.total_tokens || 0,
        metadata: {
          hasOcr: !!document.ocrText,
          hasSummary: !!document.aiSummary,
          chunkNumber: i + 1,
          totalChunks: chunks.length
        }
      });
    }

    console.log(`  ✅ Embedded ${chunks.length} chunks`);
  }
}

async function embedAllDocuments() {
  console.log('\n🚀 STARTING COMPREHENSIVE DOCUMENT EMBEDDING');
  console.log('━'.repeat(60));
  
  const embeddingService = new EmbeddingService();
  
  // Get all documents that need embedding
  const documentsToEmbed = await db.execute(sql`
    SELECT d.id, d.name, d.deal_id
    FROM documents d
    WHERE (d.ocr_text IS NOT NULL OR d.ai_summary IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1 FROM document_embeddings de 
        WHERE de.document_id = d.id
      )
    ORDER BY d.id
    LIMIT 500
  `);
  
  const totalDocs = documentsToEmbed.rows.length;
  console.log(`📊 Processing batch of ${totalDocs} documents`);
  
  if (totalDocs === 0) {
    console.log('✅ All documents are already embedded!');
    return;
  }
  
  let processed = 0;
  let successful = 0;
  let failed = 0;
  
  for (const doc of documentsToEmbed.rows) {
    processed++;
    const progress = ((processed / totalDocs) * 100).toFixed(1);
    
    try {
      console.log(`[${progress}%] Embedding: ${doc.name.substring(0, 60)}...`);
      await embeddingService.embedDocument(doc.id);
      successful++;
      
      // Rate limit protection
      if (processed % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      failed++;
      console.error(`  ❌ Failed: ${error.message}`);
      
      if (error.message.includes('rate')) {
        console.log('  ⏳ Rate limit - waiting 10 seconds...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  }
  
  console.log('\n' + '━'.repeat(60));
  console.log('📊 BATCH COMPLETE');
  console.log(`  ✅ Successful: ${successful}`);
  console.log(`  ❌ Failed: ${failed}`);
  
  // Verify status
  const status = await db.execute(sql`
    SELECT 
      COUNT(DISTINCT document_id) as embedded,
      COUNT(*) as chunks
    FROM document_embeddings
  `);
  
  const total = await db.execute(sql`
    SELECT COUNT(*) as total
    FROM documents
    WHERE ocr_text IS NOT NULL OR ai_summary IS NOT NULL
  `);
  
  console.log('\n🎯 OVERALL STATUS:');
  console.log(`  Documents embedded: ${status.rows[0].embedded}/${total.rows[0].total}`);
  console.log(`  Total chunks: ${status.rows[0].chunks}`);
  console.log(`  Coverage: ${((status.rows[0].embedded/total.rows[0].total) * 100).toFixed(1)}%`);
  
  if (status.rows[0].embedded < total.rows[0].total) {
    console.log('\n⏳ More documents to process. Run again to continue.');
  }
}

// Run
console.log('🔧 Starting embedding process...');
embedAllDocuments()
  .then(() => {
    console.log('\n✨ Batch complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });