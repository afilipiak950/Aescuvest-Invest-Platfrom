/**
 * 🔥 STREAMING UPLOAD TEST SCRIPT
 * This demonstrates the working streaming upload solution
 */

async function testStreamingUpload() {
  const dealId = 33; // Test with existing deal
  
  // Create a test file (simulate large file)
  const testContent = 'A'.repeat(1024 * 1024); // 1MB of 'A' characters
  const testFile = new Blob([testContent], { type: 'text/plain' });
  const file = new File([testFile], 'test-large-file.txt', { type: 'text/plain' });
  
  console.log(`🔥 Testing streaming upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
  
  try {
    // Step 1: Initialize upload
    const initResponse = await fetch(`/api/streaming/init/${dealId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        totalSize: file.size
      })
    });
    
    if (!initResponse.ok) {
      throw new Error(`Init failed: ${initResponse.statusText}`);
    }
    
    const { uploadId, chunkSize } = await initResponse.json();
    console.log(`✅ Upload initialized: ${uploadId} (chunk size: ${chunkSize})`);
    
    // Step 2: Upload chunks
    const totalChunks = Math.ceil(file.size / chunkSize);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      
      const formData = new FormData();
      formData.append('chunk', chunk);
      
      const chunkResponse = await fetch(`/api/streaming/chunk/${uploadId}/${i}`, {
        method: 'POST',
        body: formData
      });
      
      if (!chunkResponse.ok) {
        throw new Error(`Chunk ${i} failed: ${chunkResponse.statusText}`);
      }
      
      const result = await chunkResponse.json();
      console.log(`📦 Chunk ${i + 1}/${totalChunks} uploaded (${result.progress.toFixed(1)}%)`);
    }
    
    // Step 3: Complete upload
    const completeResponse = await fetch(`/api/streaming/complete/${uploadId}`, {
      method: 'POST'
    });
    
    if (!completeResponse.ok) {
      throw new Error(`Complete failed: ${completeResponse.statusText}`);
    }
    
    const finalResult = await completeResponse.json();
    console.log(`🎉 Upload completed: ${finalResult.message}`);
    
  } catch (error) {
    console.error('❌ Streaming upload test failed:', error);
  }
}

// Run test in browser console
// testStreamingUpload();

export { testStreamingUpload };