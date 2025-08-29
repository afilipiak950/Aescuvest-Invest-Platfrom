import fs from 'fs';
import fetch from 'node-fetch';

async function testGCSUpload() {
  console.log('🔧 Testing Google Cloud Storage upload...\n');
  
  // Step 1: Create a test file
  const testFileName = 'test-upload-' + Date.now() + '.txt';
  const testContent = 'This is a test file uploaded at ' + new Date().toISOString();
  fs.writeFileSync(testFileName, testContent);
  console.log(`✅ Created test file: ${testFileName}`);
  
  try {
    // Step 2: Get signed URL from server
    console.log('\n📡 Requesting upload URL from server...');
    const urlResponse = await fetch('http://localhost:5000/api/gcs/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealId: 23,
        fileName: testFileName,
        contentType: 'text/plain'
      })
    });
    
    if (!urlResponse.ok) {
      throw new Error(`Failed to get upload URL: ${urlResponse.status}`);
    }
    
    const { uploadUrl, gcsPath } = await urlResponse.json();
    console.log(`✅ Got signed URL for: ${gcsPath}`);
    
    // Step 3: Upload file directly to GCS
    console.log('\n☁️ Uploading to Google Cloud Storage...');
    const fileBuffer = fs.readFileSync(testFileName);
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: fileBuffer,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`GCS upload failed: ${uploadResponse.status} - ${errorText}`);
    }
    
    console.log(`✅ Successfully uploaded to GCS!`);
    console.log(`\n📍 File location in bucket:`);
    console.log(`   ${gcsPath}`);
    
    // Step 4: Register with server
    console.log('\n📝 Registering upload with server...');
    const registerResponse = await fetch('http://localhost:5000/api/gcs/register-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealId: 23,
        gcsPath: gcsPath,
        fileName: testFileName,
        fileSize: fileBuffer.length
      })
    });
    
    if (!registerResponse.ok) {
      throw new Error(`Failed to register: ${registerResponse.status}`);
    }
    
    const result = await registerResponse.json();
    console.log(`✅ Upload registered successfully!`);
    console.log(`   Document ID: ${result.document?.id}`);
    console.log(`   Job ID: ${result.jobId}`);
    
    // Clean up test file
    fs.unlinkSync(testFileName);
    console.log(`\n🗑️ Cleaned up local test file`);
    
    console.log('\n✨ TEST SUCCESSFUL! Google Cloud Storage is working!');
    console.log('You should now see the file in your GCS bucket.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    // Clean up on error
    if (fs.existsSync(testFileName)) {
      fs.unlinkSync(testFileName);
    }
  }
}

// Run the test
testGCSUpload();