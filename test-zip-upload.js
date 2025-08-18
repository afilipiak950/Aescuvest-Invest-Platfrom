// Test script to verify ZIP upload functionality works
async function testChunkedUpload() {
  console.log('🧪 Testing chunked upload initialization...');
  
  const testData = {
    fileName: 'test-upload.zip',
    totalSize: 1000000,  // 1MB
    chunkSize: 5000000   // 5MB chunks
  };
  
  try {
    const response = await fetch('http://localhost:5000/api/upload/chunk/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    console.log('📥 Response status:', response.status);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('📥 Response text:', responseText);
    
    if (responseText.includes('<!DOCTYPE html>')) {
      console.error('❌ VITE INTERFERENCE DETECTED: Got HTML instead of JSON');
      return false;
    }
    
    const result = JSON.parse(responseText);
    console.log('✅ Parsed JSON response:', result);
    
    if (result.success && result.uploadId) {
      console.log('✅ Chunked upload init working correctly!');
      return true;
    } else {
      console.error('❌ Invalid response structure');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Run test
testChunkedUpload().then(success => {
  console.log(success ? '✅ Test PASSED' : '❌ Test FAILED');
  process.exit(success ? 0 : 1);
});