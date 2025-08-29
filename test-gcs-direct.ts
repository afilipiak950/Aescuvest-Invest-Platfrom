import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

async function testGCSDirectUpload() {
  const baseUrl = 'http://localhost:5000';
  const dealId = 23;
  
  // Create a test file with random data (not zeros, they compress too much)
  const testFileName = 'test-gcs-upload-40mb.zip';
  const testFileSize = 40 * 1024 * 1024; // 40MB
  
  console.log('📝 Creating 40MB test file with random data...');
  const buffer = Buffer.alloc(testFileSize);
  for (let i = 0; i < testFileSize; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  fs.writeFileSync(testFileName, buffer);
  console.log(`✅ Created ${testFileName} (${(testFileSize / 1024 / 1024).toFixed(1)}MB)`);
  
  try {
    // Step 1: Get signed upload URL
    console.log('\n🔐 Requesting signed upload URL from server...');
    const urlResponse = await fetch(`${baseUrl}/api/gcs/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealId: dealId,
        fileName: testFileName,
        contentType: 'application/zip'
      })
    });
    
    if (!urlResponse.ok) {
      const error = await urlResponse.text();
      throw new Error(`Failed to get upload URL: ${urlResponse.status} - ${error}`);
    }
    
    const { uploadUrl, gcsPath } = await urlResponse.json();
    console.log(`✅ Got signed URL for GCS path: ${gcsPath}`);
    
    // Step 2: Upload directly to GCS
    console.log('\n☁️ Uploading directly to Google Cloud Storage...');
    const fileBuffer = fs.readFileSync(testFileName);
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: fileBuffer,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': fileBuffer.length.toString()
      }
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`GCS upload failed: ${uploadResponse.status} - ${errorText}`);
    }
    
    console.log(`✅ Successfully uploaded to GCS!`);
    
    // Step 3: Register the upload
    console.log('\n📝 Registering upload with server...');
    const registerResponse = await fetch(`${baseUrl}/api/gcs/register-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealId: dealId,
        gcsPath: gcsPath,
        fileName: testFileName,
        fileSize: testFileSize
      })
    });
    
    if (!registerResponse.ok) {
      const error = await registerResponse.text();
      throw new Error(`Failed to register upload: ${registerResponse.status} - ${error}`);
    }
    
    const result = await registerResponse.json();
    console.log(`✅ Upload registered! Document ID: ${result.document.id}, Job ID: ${result.jobId}`);
    
    console.log('\n🎉 SUCCESS! GCS direct upload is working perfectly!');
    console.log('The file bypassed Cloud Run entirely and uploaded directly to Google Cloud Storage.');
    
    // Clean up test file
    fs.unlinkSync(testFileName);
    console.log(`🗑️ Cleaned up test file`);
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    // Clean up test file on error
    if (fs.existsSync(testFileName)) {
      fs.unlinkSync(testFileName);
    }
  }
}

// Run the test
testGCSDirectUpload();