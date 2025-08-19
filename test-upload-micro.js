#!/usr/bin/env node

// MICRO STEP UPLOAD TEST - Systematic debugging of JSON parsing issue
console.log('🧪 MICRO STEP TEST: Starting upload diagnosis...');

import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

async function testUploadMicroSteps() {
  const baseUrl = 'http://localhost:5000';
  const dealId = 29;
  
  try {
    console.log('🎯 MICRO STEP 1: Testing server connectivity...');
    const healthCheck = await fetch(`${baseUrl}/api/health`);
    console.log(`✅ MICRO STEP 1: Server health status: ${healthCheck.status}`);

    console.log('🎯 MICRO STEP 2: Creating test file...');
    const testContent = 'PK\x03\x04test zip content';
    fs.writeFileSync('test-micro.zip', testContent);
    console.log(`✅ MICRO STEP 2: Created test file (${testContent.length} bytes)`);

    console.log('🎯 MICRO STEP 3: Preparing form data...');
    const form = new FormData();
    form.append('zipFile', fs.createReadStream('test-micro.zip'));
    console.log('✅ MICRO STEP 3: Form data prepared');

    console.log('🎯 MICRO STEP 4: Sending upload request...');
    const uploadUrl = `${baseUrl}/api/deals/${dealId}/data-room/upload-zip`;
    console.log(`📡 Upload URL: ${uploadUrl}`);
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    console.log(`📊 MICRO STEP 4: Response status: ${response.status}`);
    console.log(`📊 MICRO STEP 4: Response headers:`, Object.fromEntries(response.headers.entries()));

    console.log('🎯 MICRO STEP 5: Reading response body...');
    const responseText = await response.text();
    console.log(`📊 MICRO STEP 5: Response length: ${responseText.length} characters`);
    console.log(`📊 MICRO STEP 5: Response preview (first 500 chars):`, responseText.substring(0, 500));

    console.log('🎯 MICRO STEP 6: Attempting JSON parsing...');
    try {
      const jsonResponse = JSON.parse(responseText);
      console.log(`✅ MICRO STEP 6: JSON parsing successful:`, jsonResponse);
    } catch (parseError) {
      console.error(`❌ MICRO STEP 6: JSON parsing failed:`, parseError.message);
      console.error(`❌ MICRO STEP 6: Raw response:`, responseText);
      
      if (responseText.includes('<!DOCTYPE html>')) {
        console.error(`🚨 MICRO STEP 6: Server returned HTML instead of JSON`);
      } else if (responseText.includes('Error:')) {
        console.error(`🚨 MICRO STEP 6: Server returned error message`);
      }
    }

    // Cleanup
    fs.unlinkSync('test-micro.zip');
    console.log('🧹 MICRO STEP 7: Cleanup completed');

  } catch (error) {
    console.error('❌ MICRO STEP TEST FAILED:', error);
  }
}

testUploadMicroSteps();