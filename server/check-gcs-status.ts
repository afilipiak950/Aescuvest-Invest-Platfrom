/**
 * GCS Status Diagnostic Tool
 * Identifies why PDFs aren't accessible in production deployment
 */

import { db } from './db';
import { documents } from '../shared/schema';
import { sql } from 'drizzle-orm';

async function diagnoseGCSStatus() {
  console.log('🔍 DIAGNOSING GCS STATUS FOR PRODUCTION DEPLOYMENT');
  console.log('=' .repeat(60));
  
  // 1. Check environment variables
  console.log('\n📋 ENVIRONMENT VARIABLES:');
  console.log(`GOOGLE_CLOUD_STORAGE_BUCKET: ${process.env.GOOGLE_CLOUD_STORAGE_BUCKET ? '✅ SET' : '❌ MISSING'}`);
  console.log(`GOOGLE_CLOUD_STORAGE_KEY: ${process.env.GOOGLE_CLOUD_STORAGE_KEY ? '✅ SET' : '❌ MISSING'}`);
  console.log(`GCS_BUCKET_NAME: ${process.env.GCS_BUCKET_NAME ? '✅ SET' : '❌ MISSING'}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`K_SERVICE (Cloud Run): ${process.env.K_SERVICE ? '✅ YES' : '❌ NO'}`);
  
  // 2. Check document storage paths
  console.log('\n📁 DOCUMENT STORAGE ANALYSIS:');
  const allDocs = await db.select({
    id: documents.id,
    name: documents.name,
    path: documents.path,
    dealId: documents.dealId
  }).from(documents).limit(100);
  
  let gcsCount = 0;
  let localCount = 0;
  let extractedCount = 0;
  let uploadsCount = 0;
  let otherCount = 0;
  
  allDocs.forEach(doc => {
    if (doc.path.startsWith('gs://')) {
      gcsCount++;
    } else if (doc.path.startsWith('extracted/')) {
      extractedCount++;
    } else if (doc.path.startsWith('uploads/')) {
      uploadsCount++;
    } else if (doc.path.startsWith('/') || doc.path.includes('uploads')) {
      localCount++;
    } else {
      otherCount++;
    }
  });
  
  console.log(`Total documents: ${allDocs.length}`);
  console.log(`GCS paths (gs://...): ${gcsCount} ✅`);
  console.log(`Extracted paths (extracted/...): ${extractedCount} ❌`);
  console.log(`Uploads paths (uploads/...): ${uploadsCount} ❌`);
  console.log(`Other local paths: ${localCount} ❌`);
  console.log(`Other: ${otherCount}`);
  
  // 3. Calculate problem percentage
  const problemDocuments = extractedCount + uploadsCount + localCount;
  const problemPercentage = allDocs.length > 0 ? ((problemDocuments / allDocs.length) * 100).toFixed(1) : 0;
  
  console.log('\n⚠️ PRODUCTION DEPLOYMENT ISSUE:');
  console.log(`${problemDocuments} out of ${allDocs.length} documents (${problemPercentage}%) have LOCAL filesystem paths`);
  console.log(`These files will NOT be accessible in production deployment because:`);
  console.log(`  - Replit deployments don't have persistent filesystem storage`);
  console.log(`  - Files saved to local 'uploads/' directory get wiped on redeployment`);
  console.log(`  - Only GCS (Google Cloud Storage) paths persist in production`);
  
  // 4. Show examples
  console.log('\n📄 EXAMPLE PROBLEMATIC DOCUMENTS:');
  const problematicDocs = allDocs.filter(doc => 
    !doc.path.startsWith('gs://')
  ).slice(0, 5);
  
  problematicDocs.forEach(doc => {
    console.log(`  - ID ${doc.id}: ${doc.name}`);
    console.log(`    Path: ${doc.path}`);
    console.log(`    ❌ This file won't work in production`);
  });
  
  // 5. Show solutions
  console.log('\n✅ SOLUTIONS:');
  if (gcsCount > 0) {
    console.log('1. GOOD NEWS: GCS is working! New uploads are saving to GCS correctly.');
    console.log(`   ${gcsCount} documents already have GCS paths.`);
  } else {
    console.log('1. ISSUE: No documents have GCS paths yet.');
    console.log('   Check if GCS credentials are configured correctly.');
  }
  
  if (problemDocuments > 0) {
    console.log(`\n2. MIGRATION NEEDED: ${problemDocuments} documents need to be re-uploaded`);
    console.log('   Option A: Re-upload these files to save them to GCS');
    console.log('   Option B: Store file content in PostgreSQL database (simpler but uses more DB space)');
  }
  
  console.log('\n' + '='.repeat(60));
}

diagnoseGCSStatus().catch(console.error);
