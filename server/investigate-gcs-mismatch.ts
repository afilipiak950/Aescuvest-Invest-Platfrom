/**
 * Investigate GCS vs Database Path Mismatch
 * Find out why production can't access files if they're in GCS
 */

import { db } from './db';
import { documents } from '../shared/schema';
import { gcsService } from './services/googleCloudStorage';
import path from 'path';

async function investigateMismatch() {
  console.log('🔍 INVESTIGATING GCS vs DATABASE MISMATCH');
  console.log('=' .repeat(70));
  
  // Get all files from GCS with full details
  console.log('\n📦 Step 1: Listing ALL files in GCS bucket...');
  const gcsFiles = await gcsService.listAllFiles();
  console.log(`Found ${gcsFiles.length} files in GCS`);
  
  // Group files by type
  const zipFiles = gcsFiles.filter(f => f.endsWith('.zip'));
  const pdfFiles = gcsFiles.filter(f => f.endsWith('.pdf'));
  const docFiles = gcsFiles.filter(f => f.match(/\.(doc|docx)$/i));
  const otherFiles = gcsFiles.filter(f => !f.match(/\.(zip|pdf|doc|docx)$/i));
  
  console.log(`\n📊 GCS File Breakdown:`);
  console.log(`  ZIP files: ${zipFiles.length}`);
  console.log(`  PDF files: ${pdfFiles.length}`);
  console.log(`  DOC/DOCX files: ${docFiles.length}`);
  console.log(`  Other files: ${otherFiles.length}`);
  
  // Show ALL GCS files
  console.log(`\n📋 ALL FILES IN GCS BUCKET:`);
  gcsFiles.forEach((file, idx) => {
    console.log(`  ${idx + 1}. ${file}`);
  });
  
  // Get database document paths
  console.log(`\n📊 Step 2: Analyzing database document paths...`);
  const allDocs = await db.select({
    id: documents.id,
    name: documents.name,
    path: documents.path,
    dealId: documents.dealId,
    type: documents.type
  }).from(documents).limit(50);
  
  const gcsPathDocs = allDocs.filter(doc => doc.path?.startsWith('gs://'));
  const localPathDocs = allDocs.filter(doc => doc.path && !doc.path.startsWith('gs://'));
  
  console.log(`\nDatabase paths:`);
  console.log(`  Documents with GCS paths (gs://...): ${gcsPathDocs.length}`);
  console.log(`  Documents with local paths: ${localPathDocs.length}`);
  
  // Show sample paths
  console.log(`\n📄 Sample database paths:`);
  allDocs.slice(0, 10).forEach(doc => {
    console.log(`  ${doc.name}`);
    console.log(`    DB Path: ${doc.path}`);
    console.log(`    Type: ${doc.type}`);
  });
  
  // Check if files exist in GCS
  console.log(`\n🔗 Step 3: Checking if database paths match GCS files...`);
  let foundInGCS = 0;
  let notFoundInGCS = 0;
  
  for (const doc of allDocs.slice(0, 20)) {
    if (doc.path?.startsWith('gs://')) {
      // Extract filename from GCS path
      const gcsFileName = doc.path.split('/').pop();
      const existsInList = gcsFiles.some(f => f.includes(gcsFileName || ''));
      
      if (existsInList) {
        foundInGCS++;
        console.log(`  ✅ ${doc.name} - EXISTS in GCS`);
      } else {
        notFoundInGCS++;
        console.log(`  ❌ ${doc.name} - NOT FOUND in GCS`);
        console.log(`     Expected: ${doc.path}`);
      }
    } else {
      // Local path - check if corresponding GCS file exists
      const basename = path.basename(doc.name);
      const possibleGCSFile = gcsFiles.find(f => {
        const gcsBasename = path.basename(f);
        return gcsBasename === basename || gcsBasename.includes(basename.replace(/\.[^/.]+$/, ''));
      });
      
      if (possibleGCSFile) {
        console.log(`  🔄 ${doc.name} - LOCAL PATH but file EXISTS in GCS`);
        console.log(`     DB Path: ${doc.path}`);
        console.log(`     GCS Path: ${possibleGCSFile}`);
      } else {
        console.log(`  ❌ ${doc.name} - LOCAL PATH and NOT in GCS`);
        console.log(`     DB Path: ${doc.path}`);
      }
    }
  }
  
  console.log(`\n` + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log(`GCS has: ${gcsFiles.length} files`);
  console.log(`Database has: ${allDocs.length} documents (showing first 50)`);
  console.log(`Documents with correct GCS paths: ${gcsPathDocs.length}`);
  console.log(`Documents with local paths: ${localPathDocs.length}`);
  console.log('='.repeat(70));
}

investigateMismatch().catch(console.error);
