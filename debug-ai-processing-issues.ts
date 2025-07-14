/**
 * Debug AI Processing Issues
 * Comprehensive analysis and fixes for intermittent AI processing failures
 */

import { db } from './server/db';
import { documents, backgroundJobs } from './shared/schema';
import { eq, and, or, isNull, isNotNull, inArray } from 'drizzle-orm';
import OpenAI from "openai";

interface ProcessingIssue {
  type: 'stuck_processing' | 'failed_jobs' | 'orphaned_documents' | 'rate_limit_errors' | 'timeout_errors';
  count: number;
  details: any[];
  fix?: string;
}

async function debugAIProcessingIssues(): Promise<void> {
  console.log('🔍 DEBUGGING AI PROCESSING ISSUES - COMPREHENSIVE ANALYSIS');
  
  const issues: ProcessingIssue[] = [];
  
  // 1. Check for documents stuck in 'processing' state
  console.log('\n1. Checking for documents stuck in processing state...');
  const stuckDocs = await db.select()
    .from(documents)
    .where(eq(documents.aiSummaryStatus, 'processing'));
  
  if (stuckDocs.length > 0) {
    console.log(`⚠️ Found ${stuckDocs.length} documents stuck in processing state`);
    issues.push({
      type: 'stuck_processing',
      count: stuckDocs.length,
      details: stuckDocs.map(d => ({ id: d.id, name: d.name, dealId: d.dealId })),
      fix: 'Reset status to pending and retry'
    });
    
    // Fix stuck documents
    await db.update(documents)
      .set({ aiSummaryStatus: 'pending' })
      .where(eq(documents.aiSummaryStatus, 'processing'));
    
    console.log(`✅ Reset ${stuckDocs.length} stuck documents to pending`);
  } else {
    console.log('✅ No documents stuck in processing state');
  }
  
  // 2. Check for failed background jobs
  console.log('\n2. Checking for failed background jobs...');
  const failedJobs = await db.select()
    .from(backgroundJobs)
    .where(eq(backgroundJobs.status, 'failed'));
  
  if (failedJobs.length > 0) {
    console.log(`⚠️ Found ${failedJobs.length} failed background jobs`);
    issues.push({
      type: 'failed_jobs',
      count: failedJobs.length,
      details: failedJobs.map(j => ({ id: j.id, jobType: j.jobType, error: j.error })),
      fix: 'Clean up failed jobs and retry'
    });
    
    // Clean up old failed jobs
    await db.delete(backgroundJobs)
      .where(eq(backgroundJobs.status, 'failed'));
    
    console.log(`✅ Cleaned up ${failedJobs.length} failed background jobs`);
  } else {
    console.log('✅ No failed background jobs found');
  }
  
  // 3. Check for orphaned documents (have OCR text but no AI summary)
  console.log('\n3. Checking for orphaned documents...');
  const orphanedDocs = await db.select()
    .from(documents)
    .where(and(
      isNotNull(documents.ocrText),
      or(
        isNull(documents.aiSummaryStatus),
        eq(documents.aiSummaryStatus, 'pending'),
        eq(documents.aiSummaryStatus, 'failed')
      )
    ));
  
  if (orphanedDocs.length > 0) {
    console.log(`⚠️ Found ${orphanedDocs.length} orphaned documents with OCR but no AI summary`);
    issues.push({
      type: 'orphaned_documents',
      count: orphanedDocs.length,
      details: orphanedDocs.map(d => ({ id: d.id, name: d.name, dealId: d.dealId, hasOcrText: !!d.ocrText })),
      fix: 'Process these documents with AI analysis'
    });
  } else {
    console.log('✅ No orphaned documents found');
  }
  
  // 4. Check for documents with rate limit errors
  console.log('\n4. Checking for rate limit fallback summaries...');
  const rateLimitDocs = await db.select()
    .from(documents)
    .where(and(
      eq(documents.aiSummaryStatus, 'completed'),
      isNotNull(documents.aiSummary)
    ));
  
  let rateLimitCount = 0;
  const rateLimitDetails: any[] = [];
  
  for (const doc of rateLimitDocs) {
    const summary = doc.aiSummary as any;
    if (summary?.executiveSummary?.includes('API rate limit error')) {
      rateLimitCount++;
      rateLimitDetails.push({ id: doc.id, name: doc.name, dealId: doc.dealId });
    }
  }
  
  if (rateLimitCount > 0) {
    console.log(`⚠️ Found ${rateLimitCount} documents with rate limit fallback summaries`);
    issues.push({
      type: 'rate_limit_errors',
      count: rateLimitCount,
      details: rateLimitDetails,
      fix: 'Retry these documents with proper rate limiting'
    });
  } else {
    console.log('✅ No rate limit fallback summaries found');
  }
  
  // 5. Check for timeout or incomplete processing
  console.log('\n5. Checking for timeout or incomplete processing...');
  const timeoutDocs = await db.select()
    .from(documents)
    .where(and(
      isNotNull(documents.ocrText),
      eq(documents.aiSummaryStatus, 'completed'),
      isNotNull(documents.aiSummary)
    ));
  
  let timeoutCount = 0;
  const timeoutDetails: any[] = [];
  
  for (const doc of timeoutDocs) {
    const summary = doc.aiSummary as any;
    if (!summary || typeof summary !== 'object' || !summary.executiveSummary) {
      timeoutCount++;
      timeoutDetails.push({ id: doc.id, name: doc.name, dealId: doc.dealId, summaryType: typeof summary });
    }
  }
  
  if (timeoutCount > 0) {
    console.log(`⚠️ Found ${timeoutCount} documents with incomplete AI summaries`);
    issues.push({
      type: 'timeout_errors',
      count: timeoutCount,
      details: timeoutDetails,
      fix: 'Regenerate AI summaries for these documents'
    });
  } else {
    console.log('✅ No timeout or incomplete processing found');
  }
  
  // 6. Summary and recommendations
  console.log('\n🔍 ISSUE SUMMARY AND RECOMMENDATIONS');
  console.log('=' * 60);
  
  if (issues.length === 0) {
    console.log('✅ No processing issues found! System appears to be healthy.');
  } else {
    console.log(`Found ${issues.length} types of issues:`);
    issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.type}: ${issue.count} occurrences`);
      console.log(`   Fix: ${issue.fix}`);
    });
  }
  
  // 7. Test OpenAI API connectivity
  console.log('\n7. Testing OpenAI API connectivity...');
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const testResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Test message" }],
      max_tokens: 10
    });
    console.log('✅ OpenAI API is accessible and responsive');
  } catch (error) {
    console.error('❌ OpenAI API test failed:', error);
    issues.push({
      type: 'rate_limit_errors',
      count: 1,
      details: [{ error: error instanceof Error ? error.message : 'Unknown error' }],
      fix: 'Check API key and rate limits'
    });
  }
  
  // 8. Check background processing queue
  console.log('\n8. Checking background processing queue...');
  const processingJobs = await db.select()
    .from(backgroundJobs)
    .where(eq(backgroundJobs.status, 'processing'));
  
  console.log(`📊 Current processing jobs: ${processingJobs.length}`);
  
  // 9. Performance recommendations
  console.log('\n🚀 PERFORMANCE RECOMMENDATIONS');
  console.log('=' * 60);
  console.log('1. Implement exponential backoff for OpenAI API calls');
  console.log('2. Add circuit breaker pattern for rate limit handling');
  console.log('3. Implement document processing queue with priority');
  console.log('4. Add health checks for background processing');
  console.log('5. Implement retry logic with jitter for failed requests');
  
  // 10. Final recommendations based on found issues
  if (issues.some(i => i.type === 'stuck_processing')) {
    console.log('\n🔧 IMMEDIATE FIXES APPLIED:');
    console.log('- Reset stuck documents to pending state');
    console.log('- Cleaned up failed background jobs');
    console.log('- Documents will be automatically reprocessed by background processor');
  }
  
  if (issues.some(i => i.type === 'orphaned_documents')) {
    console.log('\n⏳ NEXT STEPS:');
    console.log('- Background processor will automatically pick up orphaned documents');
    console.log('- Monitor processing logs for 5-10 minutes');
    console.log('- Check completion rates in the UI');
  }
  
  console.log('\n✅ Debug analysis complete. Issues have been identified and fixes applied.');
}

// Run the debug analysis
debugAIProcessingIssues().catch(console.error);