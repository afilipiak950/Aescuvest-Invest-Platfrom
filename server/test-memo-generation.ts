import { db } from './db';
import { InvestmentMemoService } from './services/investmentMemoService';
import { dbStorage } from './storage';
import { investmentMemos } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function testMemoGeneration() {
  console.log('\n🚀 ========== MEMO GENERATION TEST ==========\n');
  
  const dealId = 10;
  const testJobId = `test-memo-${Date.now()}`;
  
  try {
    // Step 1: Delete old placeholder memo
    console.log('🗑️  Deleting old memo for deal', dealId);
    await db.delete(investmentMemos).where(eq(investmentMemos.dealId, dealId));
    console.log('✅ Old memo deleted\n');
    
    // Step 2: Check embedding statistics
    console.log('📊 Checking embedding statistics...');
    const { EmbeddingService } = await import('./services/embeddingService');
    const stats = await EmbeddingService.getEmbeddingStats(dealId);
    console.log(`📊 Embeddings: ${stats.totalChunks} chunks from ${stats.uniqueDocuments} documents`);
    console.log(`📊 Average chunk size: ${Math.round(stats.averageChunkSize)} tokens\n`);
    
    // Step 3: Generate fresh memo with progress tracking
    console.log('🚀 Starting memo generation with job tracking...');
    console.log(`📝 Job ID: ${testJobId}\n`);
    
    const result = await InvestmentMemoService.generateComprehensiveMemoWithJobTracking(
      dealId,
      testJobId,
      dbStorage
    );
    
    console.log('\n✅ ========== MEMO GENERATION COMPLETE ==========\n');
    
    // Step 4: Validate the result
    if (result && result.memo) {
      const executiveSummary = result.memo.executiveSummary || '';
      const highlights = Array.isArray(result.memo.investmentHighlights) 
        ? result.memo.investmentHighlights.join(' ')
        : (result.memo.investmentHighlights || '');
      
      console.log('📊 Quality Metrics:');
      console.log(`   - Executive Summary: ${executiveSummary.length} characters`);
      console.log(`   - Status: ${result.status}`);
      
      // Check for placeholders
      const placeholders = [
        'Information not available',
        'Content generation temporarily unavailable',
        'temporarily unavailable',
        'Data not available'
      ];
      
      const foundPlaceholders = placeholders.filter(p => 
        executiveSummary.toLowerCase().includes(p.toLowerCase()) ||
        highlights.toLowerCase().includes(p.toLowerCase())
      );
      
      if (foundPlaceholders.length > 0) {
        console.log(`\n❌ QUALITY CHECK FAILED - Found placeholders:`);
        foundPlaceholders.forEach(p => console.log(`   - "${p}"`));
      } else {
        console.log('\n✅ QUALITY CHECK PASSED - No placeholders detected!');
      }
      
      // Show preview
      console.log('\n📄 Executive Summary Preview (first 500 chars):');
      console.log(executiveSummary.substring(0, 500));
      console.log('...\n');
      
    } else {
      console.log('❌ No memo generated');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ========== MEMO GENERATION FAILED ==========\n');
    console.error('Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testMemoGeneration();
