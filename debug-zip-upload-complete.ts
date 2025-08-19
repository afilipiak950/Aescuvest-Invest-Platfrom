#!/usr/bin/env tsx

/**
 * 🚨 CRITICAL ZIP UPLOAD DEBUGGING SCRIPT
 * 
 * This script diagnoses why ZIP uploads have been failing for 2 days
 * and provides step-by-step microstep debugging to identify the exact failure point
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { and, eq, desc, count, sql } from 'drizzle-orm';
import { documents, backgroundJobs, analysisAgents } from './shared/schema';

async function debugZipUploads() {
  console.log('🚨 CRITICAL ZIP UPLOAD DEBUGGING - Starting comprehensive diagnosis...');
  console.log('📅 Date: August 19, 2025');
  console.log('🎯 Goal: Identify exact failure point in ZIP upload pipeline after 2 days of issues');
  console.log('');

  const db = drizzle(postgres(process.env.DATABASE_URL!));

  console.log('📊 STEP 1: RECENT UPLOAD ACTIVITY ANALYSIS');
  console.log('═'.repeat(60));
  
  // Check recent document uploads
  const recentDocs = await db
    .select({
      id: documents.id,
      dealId: documents.dealId,
      name: documents.name,
      uploadedAt: documents.uploadedAt,
      size: documents.size,
      source: documents.source
    })
    .from(documents)
    .where(sql`${documents.uploadedAt} > NOW() - INTERVAL '24 hours'`)
    .orderBy(desc(documents.uploadedAt))
    .limit(20);

  console.log(`📄 Recent document uploads (last 24 hours): ${recentDocs.length}`);
  if (recentDocs.length > 0) {
    console.log('Most recent uploads:');
    recentDocs.slice(0, 5).forEach(doc => {
      console.log(`  • ${doc.name} (Deal ${doc.dealId}) - ${doc.size} bytes - ${doc.uploadedAt}`);
      console.log(`    Source: ${doc.source || 'direct'}`);
    });
  } else {
    console.log('⚠️  NO UPLOADS in last 24 hours - This confirms upload failure!');
  }

  console.log('');
  console.log('📊 STEP 2: BACKGROUND JOB ANALYSIS');
  console.log('═'.repeat(60));

  // Check for stuck upload jobs
  const stuckJobs = await db
    .select({
      id: backgroundJobs.id,
      dealId: backgroundJobs.dealId,
      jobType: backgroundJobs.jobType,
      status: backgroundJobs.status,
      startedAt: backgroundJobs.startedAt,
      progress: backgroundJobs.progress,
      metadata: backgroundJobs.metadata
    })
    .from(backgroundJobs)
    .where(
      and(
        eq(backgroundJobs.jobType, 'zip_upload'),
        sql`${backgroundJobs.startedAt} > NOW() - INTERVAL '48 hours'`
      )
    )
    .orderBy(desc(backgroundJobs.startedAt));

  console.log(`🔄 ZIP upload jobs (last 48 hours): ${stuckJobs.length}`);
  if (stuckJobs.length > 0) {
    console.log('Recent ZIP upload attempts:');
    stuckJobs.forEach(job => {
      const metadata = job.metadata as any;
      console.log(`  • Job ${job.id} (Deal ${job.dealId}) - Status: ${job.status}`);
      console.log(`    Started: ${job.startedAt}`);
      console.log(`    Progress: ${job.progress}%`);
      if (metadata) {
        console.log(`    File: ${metadata.fileName || 'Unknown'}`);
        console.log(`    Size: ${metadata.fileSize || 'Unknown'}`);
      }
    });
  } else {
    console.log('❌ NO ZIP upload jobs found - Upload requests aren\'t reaching the backend!');
  }

  console.log('');
  console.log('📊 STEP 3: ERROR PATTERN ANALYSIS');
  console.log('═'.repeat(60));

  // Check for failed jobs with error details
  const failedJobs = await db
    .select({
      id: backgroundJobs.id,
      dealId: backgroundJobs.dealId,
      jobType: backgroundJobs.jobType,
      status: backgroundJobs.status,
      error: backgroundJobs.error,
      startedAt: backgroundJobs.startedAt,
      metadata: backgroundJobs.metadata
    })
    .from(backgroundJobs)
    .where(
      and(
        eq(backgroundJobs.status, 'failed'),
        sql`${backgroundJobs.startedAt} > NOW() - INTERVAL '48 hours'`
      )
    )
    .orderBy(desc(backgroundJobs.startedAt))
    .limit(10);

  console.log(`❌ Failed jobs (last 48 hours): ${failedJobs.length}`);
  if (failedJobs.length > 0) {
    console.log('Recent failure patterns:');
    failedJobs.forEach(job => {
      console.log(`  • Job ${job.id} (${job.jobType}) - Deal ${job.dealId}`);
      console.log(`    Error: ${job.error || 'No error message'}`);
      console.log(`    Started: ${job.startedAt}`);
    });
  }

  console.log('');
  console.log('📊 STEP 4: UPLOAD ROUTE ACCESSIBILITY TEST');
  console.log('═'.repeat(60));

  try {
    const testResponse = await fetch('http://localhost:5000/api/upload/test');
    if (testResponse.ok) {
      const testData = await testResponse.json();
      console.log('✅ API test endpoint accessible:', testData);
    } else {
      console.log(`❌ API test endpoint failed: ${testResponse.status} ${testResponse.statusText}`);
    }
  } catch (error) {
    console.log(`❌ API test endpoint error:`, error);
  }

  console.log('');
  console.log('📊 STEP 5: COMPREHENSIVE DIAGNOSIS');
  console.log('═'.repeat(60));

  const diagnosis = {
    recentUploads: recentDocs.length,
    zipJobs: stuckJobs.length,
    failedJobs: failedJobs.length,
    patterns: [] as string[]
  };

  if (diagnosis.recentUploads === 0) {
    diagnosis.patterns.push('CRITICAL: No document uploads in 24 hours');
  }

  if (diagnosis.zipJobs === 0) {
    diagnosis.patterns.push('CRITICAL: No ZIP upload jobs created - frontend not reaching backend');
  }

  if (diagnosis.failedJobs > 0) {
    diagnosis.patterns.push(`WARNING: ${diagnosis.failedJobs} failed jobs detected`);
  }

  console.log('🎯 PRIMARY FAILURE INDICATORS:');
  diagnosis.patterns.forEach(pattern => {
    console.log(`  • ${pattern}`);
  });

  console.log('');
  console.log('📋 STEP 6: RECOMMENDED DEBUGGING ACTIONS');
  console.log('═'.repeat(60));

  if (diagnosis.zipJobs === 0 && diagnosis.recentUploads === 0) {
    console.log('🚨 CRITICAL ISSUE: Frontend-to-Backend Communication Failure');
    console.log('');
    console.log('Recommended debugging steps:');
    console.log('1. Check browser console for JavaScript errors during upload');
    console.log('2. Verify upload button click handlers are executing');
    console.log('3. Check if FormData is being created correctly');
    console.log('4. Verify API endpoint is reachable from frontend');
    console.log('5. Check CORS and authentication issues');
    console.log('6. Verify upload mutation is being called');
    console.log('');
    console.log('🔧 IMMEDIATE ACTIONS:');
    console.log('• Add comprehensive console.log() statements to upload handlers');
    console.log('• Check Network tab in browser devtools during upload attempts');
    console.log('• Verify server logs show incoming upload requests');
    console.log('• Test direct API calls with curl to isolate frontend/backend issues');
  }

  if (diagnosis.zipJobs > 0 && diagnosis.failedJobs > 0) {
    console.log('🚨 BACKEND PROCESSING FAILURE');
    console.log('');
    console.log('Jobs are reaching backend but failing during processing');
    console.log('Check the error messages above for specific failure causes');
  }

  console.log('');
  console.log('🚀 ZIP UPLOAD DEBUGGING COMPLETE');
  console.log('═'.repeat(60));
  console.log('Report generated with comprehensive diagnosis');
  console.log('Focus debugging efforts on the identified critical issues above');
}

// Run the debugging script
debugZipUploads()
  .then(() => {
    console.log('✅ ZIP upload debugging completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ ZIP upload debugging failed:', error);
    process.exit(1);
  });