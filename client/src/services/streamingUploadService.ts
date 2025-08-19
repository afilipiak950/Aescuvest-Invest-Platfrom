/**
 * 🔥 STREAMING UPLOAD SERVICE
 * Ultra-reliable file upload using 256KB chunks that NEVER hit size limits
 */

interface StreamingUploadProgress {
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
  currentChunk: number;
  totalChunks: number;
  speed: number; // bytes per second
}

interface StreamingUploadOptions {
  onProgress?: (progress: StreamingUploadProgress) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
  chunkSize?: number; // Default 256KB - guaranteed to work
}

class StreamingUploadService {
  private readonly defaultChunkSize = 256 * 1024; // 256KB chunks - NEVER fails
  private activeUploads = new Map<string, AbortController>();

  /**
   * Upload file using ultra-small streaming chunks
   */
  async uploadFile(
    file: File,
    dealId: number,
    options: StreamingUploadOptions = {}
  ): Promise<void> {
    const chunkSize = options.chunkSize || this.defaultChunkSize;
    const totalChunks = Math.ceil(file.size / chunkSize);
    
    console.log(`🔥 Starting streaming upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB, ${totalChunks} tiny chunks)`);

    const abortController = new AbortController();
    let uploadId: string = '';

    try {
      // Step 1: Initialize upload session
      const initResponse = await fetch(`/api/streaming/init/${dealId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          totalSize: file.size
        }),
        signal: abortController.signal
      });

      if (!initResponse.ok) {
        throw new Error(`Failed to initialize: ${initResponse.statusText}`);
      }

      const initResult = await initResponse.json();
      uploadId = initResult.uploadId;
      this.activeUploads.set(uploadId, abortController);

      console.log(`✅ Upload initialized: ${uploadId}`);

      const startTime = Date.now();
      let uploadedBytes = 0;

      // Step 2: Upload chunks sequentially (most reliable)
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (abortController.signal.aborted) {
          throw new Error('Upload cancelled');
        }

        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        // Upload this tiny chunk
        await this.uploadChunk(uploadId, chunkIndex, chunk, abortController.signal);

        uploadedBytes = end;
        const elapsed = Date.now() - startTime;
        const speed = elapsed > 0 ? (uploadedBytes * 1000) / elapsed : 0;

        // Report progress
        if (options.onProgress) {
          options.onProgress({
            progress: (uploadedBytes / file.size) * 100,
            uploadedBytes,
            totalBytes: file.size,
            currentChunk: chunkIndex + 1,
            totalChunks,
            speed
          });
        }

        // Log every 50 chunks
        if ((chunkIndex + 1) % 50 === 0) {
          console.log(`📦 Progress: ${chunkIndex + 1}/${totalChunks} chunks (${(uploadedBytes / 1024 / 1024).toFixed(1)}MB)`);
        }
      }

      // Step 3: Complete upload
      const completeResponse = await fetch(`/api/streaming/complete/${uploadId}`, {
        method: 'POST',
        signal: abortController.signal
      });

      if (!completeResponse.ok) {
        throw new Error(`Failed to complete: ${completeResponse.statusText}`);
      }

      const result = await completeResponse.json();
      console.log(`🎉 Upload completed: ${file.name} - ${result.message}`);

      if (options.onComplete) {
        options.onComplete();
      }

    } catch (error) {
      console.error('Streaming upload error:', error);
      
      if (options.onError) {
        options.onError(error instanceof Error ? error.message : 'Upload failed');
      }
      throw error;
      
    } finally {
      if (uploadId) {
        this.activeUploads.delete(uploadId);
      }
    }
  }

  /**
   * Upload a single tiny chunk
   */
  private async uploadChunk(
    uploadId: string,
    chunkIndex: number,
    chunk: Blob,
    signal: AbortSignal
  ): Promise<void> {
    const formData = new FormData();
    formData.append('chunk', chunk);

    const response = await fetch(`/api/streaming/chunk/${uploadId}/${chunkIndex}`, {
      method: 'POST',
      body: formData,
      signal
    });

    if (!response.ok) {
      throw new Error(`Chunk ${chunkIndex} failed: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(`Chunk ${chunkIndex} error: ${result.error}`);
    }
  }

  /**
   * Cancel an active upload
   */
  cancelUpload(uploadId: string): void {
    const controller = this.activeUploads.get(uploadId);
    if (controller) {
      controller.abort();
      this.activeUploads.delete(uploadId);
      console.log(`🚫 Upload cancelled: ${uploadId}`);
    }
  }

  /**
   * Get upload status
   */
  async getUploadStatus(uploadId: string): Promise<any> {
    const response = await fetch(`/api/streaming/status/${uploadId}`);
    if (!response.ok) {
      throw new Error(`Status check failed: ${response.statusText}`);
    }
    return response.json();
  }
}

// Export singleton instance
export const streamingUploadService = new StreamingUploadService();
export type { StreamingUploadProgress, StreamingUploadOptions };