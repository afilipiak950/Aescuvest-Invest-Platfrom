#!/usr/bin/env tsx
/**
 * TEST SPECIFIC 400 ERROR FIX
 * Tests if the OneDrive filename issue is resolved
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000';
const DEAL_ID = 33;

console.log('🧪 TESTING 400 ERROR FIX FOR SPECIFIC FILENAME');
console.log('='.repeat(80));

async function test400Fix() {
  // Test with the exact problematic filename
  const problematicName = 'OneDrive_1_10.8.2025.zip';
  
  console.log('📍 Testing with filename:', problematicName);
  console.log('  This filename previously caused 400 errors\n');
  
  try {
    // Step 1: Request signed URL
    console.log('1️⃣ Requesting signed URL...');
    const response = await fetch(`${API_BASE}/api/gcs/signed-url/${DEAL_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: problematicName,
        fileSize: 10 * 1024 * 1024 // 10MB
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get signed URL: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ Signed URL generated successfully');
    console.log('   Upload ID:', data.uploadId);
    console.log('   GCS Path:', data.gcsFileName);
    
    // Step 2: Analyze the signed URL
    console.log('\n2️⃣ Analyzing signed URL...');
    const url = new URL(data.signedUrl);
    const hasContentLengthRange = url.searchParams.get('X-Goog-SignedHeaders')?.includes('x-goog-content-length-range');
    
    if (hasContentLengthRange) {
      console.log('❌ PROBLEM: Signed URL still expects x-goog-content-length-range header');
      console.log('   This will cause 400 errors!');
    } else {
      console.log('✅ FIXED: Signed URL does NOT require x-goog-content-length-range');
      console.log('   This should prevent 400 errors');
    }
    
    // Step 3: Test what headers are expected
    console.log('\n3️⃣ Checking signed headers...');
    const signedHeaders = url.searchParams.get('X-Goog-SignedHeaders');
    console.log('   Expected headers:', signedHeaders || 'none');
    
    if (signedHeaders === 'host') {
      console.log('✅ Only standard headers required (host is automatic)');
    } else if (signedHeaders?.includes('content-type')) {
      console.log('⚠️ Content-Type header required - client must send: application/zip');
    }
    
    // Step 4: Simulate upload test
    console.log('\n4️⃣ Testing upload compatibility...');
    console.log('   Client will send:');
    console.log('     - Method: PUT');
    console.log('     - Content-Type: application/zip');
    console.log('     - Body: File data');
    
    // Check if this matches signed URL expectations
    const contentType = data.instructions?.headers?.['Content-Type'];
    if (contentType === 'application/zip') {
      console.log('✅ Content-Type matches what client sends');
    } else {
      console.log('❌ Content-Type mismatch!');
    }
    
    // Final verdict
    console.log('\n' + '='.repeat(80));
    console.log('🎯 FIX VERIFICATION:');
    console.log('='.repeat(80));
    
    if (!hasContentLengthRange) {
      console.log('✅ 400 ERROR SHOULD BE FIXED!');
      console.log('   The problematic header requirement has been removed.');
      console.log('   Files with names like "OneDrive_1_10.8.2025.zip" should upload successfully.');
      console.log('\n📝 Next steps:');
      console.log('   1. Try uploading the file again in the browser');
      console.log('   2. Check browser console for any errors');
      console.log('   3. The upload should complete without 400 errors');
    } else {
      console.log('❌ 400 ERROR MAY STILL OCCUR');
      console.log('   The server still requires headers that the client doesn\'t send.');
      console.log('   Additional fixes needed.');
    }
    
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run test
test400Fix().catch(console.error);