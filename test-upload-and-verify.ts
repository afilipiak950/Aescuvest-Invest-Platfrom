#!/usr/bin/env tsx
/**
 * TEST COMPLETE UPLOAD AND VERIFICATION
 * Tests if files appear in data room after upload
 */

import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://localhost:5000';
const DEAL_ID = 23;

console.log('🧪 TESTING COMPLETE UPLOAD FLOW WITH VERIFICATION');
console.log('='.repeat(80));

async function testCompleteUpload() {
  try {
    // Step 1: Check current documents in data room
    console.log('1️⃣ Checking current documents in data room...');
    const currentDocsResponse = await fetch(`${API_BASE}/api/deals/${DEAL_ID}/documents`);
    const currentDocs = await currentDocsResponse.json();
    console.log(`   Current documents: ${currentDocs.length} files`);
    
    // Step 2: Create a test ZIP file
    console.log('\n2️⃣ Creating test ZIP file...');
    const testZipPath = path.join(process.cwd(), 'test-upload.zip');
    
    // Create a simple ZIP file with some text files
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    
    // Add test files to ZIP
    zip.addFile('test-document-1.txt', Buffer.from('This is test document 1 content'));
    zip.addFile('folder1/test-document-2.txt', Buffer.from('This is test document 2 in a folder'));
    zip.addFile('folder2/test-document-3.txt', Buffer.from('This is test document 3 in another folder'));
    
    // Write ZIP file
    zip.writeZip(testZipPath);
    const stats = fs.statSync(testZipPath);
    console.log(`   Created test ZIP: ${(stats.size / 1024).toFixed(1)}KB`);
    
    // Step 3: Request signed URL for upload
    console.log('\n3️⃣ Requesting signed URL...');
    const signedUrlResponse = await fetch(`${API_BASE}/api/gcs/signed-url/${DEAL_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'test-upload.zip',
        fileSize: stats.size
      })
    });
    
    if (!signedUrlResponse.ok) {
      throw new Error(`Failed to get signed URL: ${signedUrlResponse.status}`);
    }
    
    const { signedUrl, gcsFileName, uploadId } = await signedUrlResponse.json();
    console.log('   ✅ Got signed URL');
    console.log(`   Upload ID: ${uploadId}`);
    
    // Step 4: Upload to GCS (simulated - in real browser this would be direct)
    console.log('\n4️⃣ Uploading to GCS...');
    console.log('   NOTE: In production, this would be a direct browser upload');
    console.log('   For testing, using proxy upload instead...');
    
    // Use proxy upload for testing (since we can't directly upload to GCS from Node)
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testZipPath));
    
    const proxyResponse = await fetch(`${API_BASE}/api/gcs/proxy-upload/${DEAL_ID}`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });
    
    if (!proxyResponse.ok) {
      const error = await proxyResponse.text();
      throw new Error(`Proxy upload failed: ${error}`);
    }
    
    const uploadResult = await proxyResponse.json();
    console.log('   ✅ Upload complete:', uploadResult.message);
    
    // Step 5: Wait for processing
    console.log('\n5️⃣ Waiting for processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 6: Check if documents appear in data room
    console.log('\n6️⃣ Checking if documents appear in data room...');
    const newDocsResponse = await fetch(`${API_BASE}/api/deals/${DEAL_ID}/documents`);
    const newDocs = await newDocsResponse.json();
    console.log(`   Documents after upload: ${newDocs.length} files`);
    
    // Check for new documents
    const addedDocs = newDocs.length - currentDocs.length;
    if (addedDocs > 0) {
      console.log(`   ✅ SUCCESS: ${addedDocs} new documents added!`);
      
      // Show the new documents
      const latestDocs = newDocs.slice(-addedDocs);
      console.log('\n   New documents:');
      latestDocs.forEach((doc: any) => {
        console.log(`     - ${doc.name} (${doc.folderPath || 'root'})`);
      });
    } else {
      console.log('   ❌ No new documents found');
    }
    
    // Clean up
    fs.unlinkSync(testZipPath);
    console.log('\n🧹 Test file cleaned up');
    
    // Final verdict
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST RESULTS:');
    console.log('='.repeat(80));
    
    if (addedDocs > 0) {
      console.log('✅ UPLOAD SYSTEM WORKING!');
      console.log('   Files are successfully uploaded and appear in data room.');
      console.log('   The 400 error fix and body parser fix are both working.');
    } else {
      console.log('⚠️ UPLOAD COMPLETED BUT FILES NOT VISIBLE');
      console.log('   The upload process worked but documents are not showing.');
      console.log('   This might be a database or processing issue.');
    }
    
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    
    // Clean up if test failed
    const testZipPath = path.join(process.cwd(), 'test-upload.zip');
    if (fs.existsSync(testZipPath)) {
      fs.unlinkSync(testZipPath);
    }
  }
}

// Run test
testCompleteUpload().catch(console.error);