/**
 * Pre-Migration Checklist
 * Verifies GCS is properly configured before running migration
 */

import { db } from './db';
import { documents } from '../shared/schema';
import { gcsService } from './services/googleCloudStorage';
import fs from 'fs';
import path from 'path';

async function preMigrationCheck() {
  console.log('🔍 PRE-MIGRATION CHECKLIST');
  console.log('=' .repeat(70));
  
  let allChecksPass = true;
  
  // Check 1: GCS Credentials
  console.log('\n✓ Checking GCS credentials...');
  const bucket = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
  const key = process.env.GOOGLE_CLOUD_STORAGE_KEY;
  
  if (!bucket) {
    console.log('  ❌ GOOGLE_CLOUD_STORAGE_BUCKET not set');
    allChecksPass = false;
  } else {
    console.log(`  ✅ Bucket name: ${bucket}`);
  }
  
  if (!key) {
    console.log('  ❌ GOOGLE_CLOUD_STORAGE_KEY not set');
    allChecksPass = false;
  } else {
    console.log(`  ✅ GCS credentials configured`);
  }
  
  // Check 2: Test GCS Upload
  console.log('\n✓ Testing GCS connectivity...');
  try {
    const testFilePath = path.join(process.cwd(), 'test-gcs-upload.txt');
    fs.writeFileSync(testFilePath, 'Test file for GCS migration verification');
    
    const gcsPath = await gcsService.uploadFile(testFilePath, 999, 'test-migration-check.txt');
    console.log(`  ✅ GCS upload successful: ${gcsPath}`);
    
    // Cleanup test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  } catch (error) {
    console.log(`  ❌ GCS upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.log('  💡 This means migration will fail. Fix GCS credentials first.');
    allChecksPass = false;
  }
  
  // Check 3: Database Connection
  console.log('\n✓ Checking database connection...');
  try {
    const docs = await db.select().from(documents).limit(1);
    console.log(`  ✅ Database connected successfully`);
  } catch (error) {
    console.log(`  ❌ Database error: ${error}`);
    allChecksPass = false;
  }
  
  // Check 4: Document Analysis
  console.log('\n✓ Analyzing documents...');
  try {
    const allDocs = await db.select().from(documents);
    const needsMigration = allDocs.filter(doc => doc.path && !doc.path.startsWith('gs://'));
    const filesFound = needsMigration.filter(doc => {
      const localPath = doc.path.startsWith('extracted/') 
        ? path.join(process.cwd(), 'uploads', doc.path)
        : path.join(process.cwd(), doc.path);
      return fs.existsSync(localPath);
    });
    
    console.log(`  📊 Total documents: ${allDocs.length}`);
    console.log(`  📊 Need migration: ${needsMigration.length}`);
    console.log(`  📊 Files found locally: ${filesFound.length}`);
    console.log(`  📊 Files missing: ${needsMigration.length - filesFound.length}`);
    
    if (needsMigration.length === 0) {
      console.log('  ✅ All documents already in GCS - no migration needed!');
    } else {
      console.log(`  ⚠️  ${needsMigration.length} documents need migration`);
    }
    
    if (needsMigration.length - filesFound.length > 0) {
      console.log(`  ⚠️  ${needsMigration.length - filesFound.length} files are missing and will be skipped`);
    }
  } catch (error) {
    console.log(`  ❌ Analysis error: ${error}`);
    allChecksPass = false;
  }
  
  // Final verdict
  console.log('\n' + '='.repeat(70));
  if (allChecksPass) {
    console.log('✅ ALL CHECKS PASSED - Ready to migrate!');
    console.log('\nRun migration with:');
    console.log('  npx tsx server/migrate-to-gcs.ts migrate');
  } else {
    console.log('❌ SOME CHECKS FAILED - Fix issues before migrating');
    console.log('\nCommon fixes:');
    console.log('  1. Set GOOGLE_CLOUD_STORAGE_BUCKET in Replit Secrets');
    console.log('  2. Set GOOGLE_CLOUD_STORAGE_KEY in Replit Secrets');
    console.log('  3. Verify GCS credentials are valid');
  }
  console.log('='.repeat(70));
}

preMigrationCheck().catch(console.error);
