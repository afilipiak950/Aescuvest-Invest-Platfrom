#!/usr/bin/env node

/**
 * Complete Chunked Upload Test
 * Tests the entire chunked upload flow end-to-end
 */

import fs from 'fs';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:5000';
const TEST_FILE_SIZE = 5 * 1024 * 1024; // 5MB test file
const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB chunks
const TEST_FILE_PATH = './test-large-file.zip';

// Create a test ZIP file with random data
function createTestFile() {
  console.log(`📁 Creating test file: ${TEST_FILE_SIZE / 1024 / 1024}MB...`);
  
  const buffer = crypto.randomBytes(TEST_FILE_SIZE);
  fs.writeFileSync(TEST_FILE_PATH, buffer);
  
  console.log(`✅ Test file created: ${TEST_FILE_PATH}`);
  return buffer;
}

// Initialize chunked upload
async function initializeUpload(fileName, totalSize, chunkSize) {
  console.log(`🚀 Initializing chunked upload...`);
  
  const params = new URLSearchParams({
    fileName,
    totalSize: totalSize.toString(),
    chunkSize: chunkSize.toString(),
  });
  
  const response = await fetch(`${BASE_URL}/api/upload/chunk/init?${params}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Initialize failed: ${response.statusText}`);
  }
  
  const result = await response.json();
  console.log(`✅ Upload initialized:`, result);
  
  return result.uploadId;
}

// Upload a single chunk
async function uploadChunk(uploadId, chunkIndex, chunkData) {
  console.log(`📤 Uploading chunk ${chunkIndex}...`);
  
  const response = await fetch(`${BASE_URL}/api/upload/chunk/${uploadId}/${chunkIndex}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: chunkData,
  });
  
  if (!response.ok) {
    throw new Error(`Chunk ${chunkIndex} upload failed: ${response.statusText}`);
  }
  
  const result = await response.json();
  console.log(`✅ Chunk ${chunkIndex} uploaded:`, result);
  
  return result;
}

// Main test function
async function testChunkedUpload() {
  try {
    console.log('🧪 STARTING COMPLETE CHUNKED UPLOAD TEST');
    console.log('=' .repeat(50));
    
    // Step 1: Create test file
    const fileData = createTestFile();
    
    // Step 2: Initialize upload
    const uploadId = await initializeUpload('test-large-file.zip', TEST_FILE_SIZE, CHUNK_SIZE);
    
    // Step 3: Upload chunks
    const totalChunks = Math.ceil(TEST_FILE_SIZE / CHUNK_SIZE);
    console.log(`📦 Uploading ${totalChunks} chunks...`);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, TEST_FILE_SIZE);
      const chunkData = fileData.slice(start, end);
      
      console.log(`📦 Chunk ${i}: ${start}-${end-1} (${chunkData.length} bytes)`);
      
      const result = await uploadChunk(uploadId, i, chunkData);
      
      if (result.isComplete) {
        console.log('🎉 UPLOAD COMPLETE!');
        break;
      }
      
      // Small delay between chunks
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('=' .repeat(50));
    console.log('✅ CHUNKED UPLOAD TEST COMPLETED SUCCESSFULLY');
    
    // Clean up
    fs.unlinkSync(TEST_FILE_PATH);
    console.log('🗑️ Test file cleaned up');
    
  } catch (error) {
    console.error('❌ CHUNKED UPLOAD TEST FAILED:', error);
    
    // Clean up on error
    if (fs.existsSync(TEST_FILE_PATH)) {
      fs.unlinkSync(TEST_FILE_PATH);
    }
    
    process.exit(1);
  }
}

// Run the test
testChunkedUpload();