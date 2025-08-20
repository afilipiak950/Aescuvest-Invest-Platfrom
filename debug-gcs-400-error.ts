#!/usr/bin/env tsx
/**
 * DEBUG GCS 400 ERROR - MICRO-STEP ANALYSIS
 * Identifies exactly why GCS returns 400 error
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:5000';
const DEAL_ID = 33;

console.log('🔍 DEBUGGING GCS 400 ERROR - MICRO-STEP ANALYSIS');
console.log('='.repeat(80));

async function debugGCS400() {
  console.log('📋 COMMON 400 ERROR CAUSES:');
  console.log('  1. Wrong Content-Type header');
  console.log('  2. Invalid file name characters');
  console.log('  3. CORS misconfiguration');
  console.log('  4. Expired or invalid signed URL');
  console.log('  5. Missing required headers\n');
  
  // Step 1: Test with problematic filename
  console.log('🔬 MICRO-STEP 1: Testing with problematic filename...');
  const problematicName = 'OneDrive_1_10.8.2025.zip';
  console.log(`  Filename: "${problematicName}"`);
  console.log('  Checking for issues...');
  
  // Check for special characters
  const hasSpecialChars = /[^a-zA-Z0-9._-]/.test(problematicName);
  console.log(`  Special characters: ${hasSpecialChars ? '❌ YES (could cause issues)' : '✅ NO'}`);
  
  // Check filename encoding
  const encodedName = encodeURIComponent(problematicName);
  console.log(`  URL encoded: ${encodedName}`);
  console.log(`  Encoding changed: ${encodedName !== problematicName ? '⚠️ YES' : '✅ NO'}`);
  
  // Step 2: Request signed URL with exact filename
  console.log('\n🔬 MICRO-STEP 2: Requesting signed URL...');
  try {
    const signedUrlResponse = await fetch(`${API_BASE}/api/gcs/signed-url/${DEAL_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: problematicName,
        fileSize: 1024 * 1024 // 1MB test
      })
    });
    
    console.log(`  Response status: ${signedUrlResponse.status}`);
    
    if (!signedUrlResponse.ok) {
      const errorText = await signedUrlResponse.text();
      console.log(`  ❌ Error: ${errorText}`);
      return;
    }
    
    const signedUrlData = await signedUrlResponse.json();
    console.log('  ✅ Signed URL received');
    console.log(`  Upload ID: ${signedUrlData.uploadId}`);
    console.log(`  GCS filename: ${signedUrlData.gcsFileName}`);
    
    // Step 3: Analyze the signed URL
    console.log('\n🔬 MICRO-STEP 3: Analyzing signed URL...');
    const url = new URL(signedUrlData.signedUrl);
    console.log(`  Host: ${url.hostname}`);
    console.log(`  Path: ${url.pathname}`);
    console.log('  Query params:');
    
    const params = Array.from(url.searchParams.entries());
    params.forEach(([key, value]) => {
      if (key === 'X-Goog-Signature') {
        console.log(`    ${key}: [SIGNATURE]`);
      } else if (key === 'X-Goog-Credential') {
        console.log(`    ${key}: ${value.substring(0, 30)}...`);
      } else {
        console.log(`    ${key}: ${value}`);
      }
    });
    
    // Step 4: Test what headers are required
    console.log('\n🔬 MICRO-STEP 4: Testing required headers...');
    console.log('  Testing with different Content-Type values...');
    
    const contentTypes = [
      'application/zip',
      'application/octet-stream',
      'application/x-zip-compressed',
      'multipart/form-data'
    ];
    
    for (const contentType of contentTypes) {
      console.log(`\n  Testing Content-Type: ${contentType}`);
      
      // Create a small test buffer
      const testBuffer = Buffer.from('PK\x03\x04test'); // ZIP file signature
      
      try {
        // Test with HEAD request first (safer)
        const headResponse = await fetch(signedUrlData.signedUrl, {
          method: 'HEAD',
          headers: {
            'Content-Type': contentType,
            'Content-Length': testBuffer.length.toString()
          }
        });
        
        if (headResponse.status === 403) {
          console.log(`    ❌ 403 Forbidden - Wrong signature or expired`);
        } else if (headResponse.status === 400) {
          console.log(`    ❌ 400 Bad Request - Invalid header`);
        } else if (headResponse.status === 200 || headResponse.status === 404) {
          console.log(`    ✅ Headers accepted (${headResponse.status})`);
        } else {
          console.log(`    ⚠️ Status ${headResponse.status}`);
        }
      } catch (error: any) {
        console.log(`    ❌ Network error: ${error.message}`);
      }
    }
    
    // Step 5: Check CORS configuration
    console.log('\n🔬 MICRO-STEP 5: Checking CORS configuration...');
    const corsFile = path.join(process.cwd(), 'gcs-cors-config.json');
    if (fs.existsSync(corsFile)) {
      const corsConfig = JSON.parse(fs.readFileSync(corsFile, 'utf-8'));
      console.log('  CORS configuration:');
      console.log(`    Origins: ${corsConfig[0].origin?.join(', ') || 'ALL'}`);
      console.log(`    Methods: ${corsConfig[0].method?.join(', ')}`);
      console.log(`    Headers: ${corsConfig[0].responseHeader?.join(', ') || 'ALL'}`);
      
      // Check if Content-Type is allowed
      const allowedHeaders = corsConfig[0].responseHeader || ['*'];
      const contentTypeAllowed = allowedHeaders.includes('*') || 
                                 allowedHeaders.includes('Content-Type');
      console.log(`    Content-Type allowed: ${contentTypeAllowed ? '✅' : '❌'}`);
    }
    
    // Step 6: Debug client-side implementation
    console.log('\n🔬 MICRO-STEP 6: Checking client-side implementation...');
    const clientFile = path.join(process.cwd(), 'client/src/components/DataRoomExplorer.tsx');
    if (fs.existsSync(clientFile)) {
      const clientCode = fs.readFileSync(clientFile, 'utf-8');
      
      // Check what Content-Type is being set
      const contentTypeMatch = clientCode.match(/xhr\.setRequestHeader\(['"]Content-Type['"]/);
      if (contentTypeMatch) {
        const lineStart = clientCode.lastIndexOf('\n', contentTypeMatch.index!) + 1;
        const lineEnd = clientCode.indexOf('\n', contentTypeMatch.index!);
        const line = clientCode.substring(lineStart, lineEnd);
        console.log(`  Content-Type header: ${line.trim()}`);
        
        // Check if it's using the right content type
        if (line.includes('application/zip')) {
          console.log('    ✅ Using application/zip');
        } else if (line.includes('application/octet-stream')) {
          console.log('    ⚠️ Using generic octet-stream');
        } else {
          console.log('    ❌ Wrong content type');
        }
      } else {
        console.log('  ❌ No Content-Type header found in client code!');
      }
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
  
  // Step 7: Provide solution
  console.log('\n' + '='.repeat(80));
  console.log('🔧 RECOMMENDED FIXES:');
  console.log('='.repeat(80));
  console.log('\n1. FILENAME ISSUE:');
  console.log('   The filename "OneDrive_1_10.8.2025.zip" contains underscores and dots');
  console.log('   Solution: Sanitize filename before upload');
  
  console.log('\n2. CONTENT-TYPE ISSUE:');
  console.log('   GCS requires exact Content-Type matching');
  console.log('   Solution: Use "application/zip" for ZIP files');
  
  console.log('\n3. CORS ISSUE:');
  console.log('   Browser might be blocked by CORS');
  console.log('   Solution: Apply CORS configuration to bucket');
  
  console.log('\n4. CLIENT-SIDE FIX:');
  console.log('   Update DataRoomExplorer.tsx to:');
  console.log('   - Set correct Content-Type header');
  console.log('   - Handle special characters in filenames');
  console.log('   - Add better error logging');
}

// Run debug
debugGCS400().catch(console.error);