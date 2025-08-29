/**
 * Chunked Upload Utility for Large Files
 * Handles files over 30MB to avoid Cloud Run's 32MB limit
 */

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks (safe under 32MB limit)

interface ChunkedUploadResult {
  success: boolean;
  fileName: string;
  documentsProcessed: number;
  message: string;
}

export async function uploadChunked(
  file: File,
  dealId: number,
  folderName: string,
  onProgress?: (progress: number) => void
): Promise<ChunkedUploadResult> {
  console.log(`🚀 Starting chunked upload for ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
  
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const fileName = file.name;
  const totalSize = file.size;
  const chunkSize = CHUNK_SIZE;
  
  console.log(`📦 File will be uploaded in ${totalChunks} chunks of ${CHUNK_SIZE / 1024 / 1024}MB each`);
  
  // Initialize chunked upload - matching backend expectations
  const initResponse = await fetch(`/api/upload/chunk/init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName,
      totalSize,
      chunkSize
    }),
  });
  
  if (!initResponse.ok) {
    const error = await initResponse.text();
    throw new Error(`Failed to initialize chunked upload: ${error}`);
  }
  
  const { uploadId } = await initResponse.json();
  console.log(`✅ Upload session initialized: ${uploadId}`);
  
  // Upload chunks using the backend's expected route pattern
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    
    const formData = new FormData();
    formData.append('chunk', chunk);
    
    console.log(`📤 Uploading chunk ${chunkIndex + 1}/${totalChunks} (${((end - start) / 1024 / 1024).toFixed(1)}MB)`);
    
    const chunkResponse = await fetch(`/api/upload/chunk/${uploadId}/${chunkIndex}`, {
      method: 'POST',
      body: formData,
    });
    
    if (!chunkResponse.ok) {
      const error = await chunkResponse.text();
      throw new Error(`Failed to upload chunk ${chunkIndex + 1}: ${error}`);
    }
    
    const progress = ((chunkIndex + 1) / totalChunks) * 100;
    console.log(`✅ Chunk ${chunkIndex + 1}/${totalChunks} uploaded (${progress.toFixed(0)}%)`);
    
    if (onProgress) {
      onProgress(progress);
    }
  }
  
  // Complete the upload by processing the assembled file
  console.log(`🔄 Completing upload and starting processing...`);
  
  const completeResponse = await fetch(`/api/deals/${dealId}/upload-chunked/${uploadId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      folderName
    }),
  });
  
  if (!completeResponse.ok) {
    const error = await completeResponse.text();
    throw new Error(`Failed to complete chunked upload: ${error}`);
  }
  
  const result = await completeResponse.json();
  console.log(`✅ Chunked upload complete:`, result);
  
  return {
    success: true,
    fileName: file.name,
    documentsProcessed: result.documentsProcessed || 0,
    message: result.message || 'Upload successful'
  };
}

/**
 * Alternative: Direct upload for small files (under 30MB)
 */
export async function uploadDirect(
  file: File,
  dealId: number,
  folderName: string
): Promise<ChunkedUploadResult> {
  const formData = new FormData();
  formData.append('zipFile', file);
  formData.append('folderName', folderName);
  
  const response = await fetch(`/api/deals/${dealId}/data-room/upload-zip`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload failed: ${error}`);
  }
  
  const result = await response.json();
  
  return {
    success: result.success,
    fileName: file.name,
    documentsProcessed: result.documentsProcessed || 0,
    message: result.message || 'Upload successful'
  };
}