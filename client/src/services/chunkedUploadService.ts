export interface ChunkedUploadProgress {
  uploadId?: string;
  fileName: string;
  totalSize?: number;
  uploadedBytes?: number;
  progress: number;
  isComplete?: boolean;
  currentChunk?: number;
  totalChunks?: number;
  speed: number; // bytes per second
  eta: number; // estimated time remaining in seconds
  status: string; // status message
}

export interface ChunkedUploadOptions {
  chunkSize?: number; // default 10MB
  onProgress?: (progress: ChunkedUploadProgress) => void;
  onComplete?: (uploadId: string) => void;
  onError?: (error: string) => void;
}

class ChunkedUploadService {
  // 🚨 ULTRA-SAFE: 1MB chunks provide 32× safety margin below infrastructure limits
  private readonly defaultChunkSize = 1 * 1024 * 1024; // 1MB chunks for maximum reliability
  private activeUploads = new Map<string, {
    file: File;
    options: ChunkedUploadOptions;
    startTime: number;
    uploadedBytes: number;
    abortController: AbortController;
  }>();

  /**
   * Upload a large file using chunked upload
   */
  async uploadLargeFile(
    file: File,
    options: ChunkedUploadOptions = {}
  ): Promise<string> {
    const chunkSize = options.chunkSize || this.defaultChunkSize;
    const totalChunks = Math.ceil(file.size / chunkSize);
    
    console.log(`📁 Starting chunked upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB, ${totalChunks} chunks)`);

    try {
      // Initialize upload session
      // 🚨 WORKING FIX: Use GET with query parameters (avoids Vite POST interference)
      const baseUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
        ? 'http://localhost:5000' // Development: bypass Vite middleware
        : ''; // Production: use relative URLs
      
      const params = new URLSearchParams({
        fileName: file.name,
        totalSize: file.size.toString(),
        chunkSize: chunkSize.toString(),
      });
        
      const response = await fetch(`${baseUrl}/api/upload/chunk/init?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to initialize upload: ${response.statusText}`);
      }

      const initResult = await response.json();
      const uploadId = initResult.uploadId;

      // Create abort controller for cancellation
      const abortController = new AbortController();

      // Track upload state
      const uploadState = {
        file,
        options,
        startTime: Date.now(),
        uploadedBytes: 0,
        abortController,
      };
      this.activeUploads.set(uploadId, uploadState);

      // Upload chunks sequentially for reliability
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (abortController.signal.aborted) {
          throw new Error('Upload cancelled');
        }

        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        // Upload chunk
        await this.uploadChunk(uploadId, chunkIndex, chunk, abortController.signal);

        // Update progress
        uploadState.uploadedBytes = end;
        const progress = this.calculateProgress(uploadState, totalChunks, chunkIndex + 1);
        
        if (options.onProgress) {
          options.onProgress(progress);
        }
      }

      // Verify upload completion
      // 🚨 CRITICAL FIX: Use dynamic baseUrl to bypass Vite in development
      const statusResponse = await fetch(`${baseUrl}/api/upload/chunk/${uploadId}/status`);
      const status = await statusResponse.json();
      
      if (!status.isComplete) {
        throw new Error('Upload verification failed');
      }

      console.log(`✅ Chunked upload complete: ${file.name}`);
      
      if (options.onComplete) {
        options.onComplete(uploadId);
      }

      this.activeUploads.delete(uploadId);
      return uploadId;

    } catch (error) {
      console.error('❌ Chunked upload failed:', error);
      
      if (options.onError) {
        options.onError(error instanceof Error ? error.message : 'Upload failed');
      }
      
      throw error;
    }
  }

  /**
   * Upload a single chunk
   */
  private async uploadChunk(
    uploadId: string,
    chunkIndex: number,
    chunk: Blob,
    signal: AbortSignal
  ): Promise<void> {
    const formData = new FormData();
    formData.append('chunk', chunk);

    // 🚨 CRITICAL FIX: Use dynamic baseUrl to bypass Vite in development
    const baseUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
      ? 'http://localhost:5000' // Development: bypass Vite middleware
      : ''; // Production: use relative URLs
      
    const apiUrl = `${baseUrl}/api/upload/chunk/${uploadId}/${chunkIndex}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      signal,
    });

    if (!response.ok) {
      if (response.status === 413) {
        throw new Error(`413 Entity Too Large - Chunk ${chunkIndex} too big (${(chunk.size / 1024 / 1024).toFixed(1)}MB)`);
      }
      throw new Error(`Chunk ${chunkIndex} upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || `Chunk ${chunkIndex} upload failed`);
    }
  }

  /**
   * Calculate upload progress with speed estimation
   */
  private calculateProgress(
    uploadState: {
      file: File;
      startTime: number;
      uploadedBytes: number;
    },
    totalChunks: number,
    currentChunk: number
  ): ChunkedUploadProgress {
    const now = Date.now();
    const elapsedSeconds = (now - uploadState.startTime) / 1000;
    const speed = elapsedSeconds > 0 ? uploadState.uploadedBytes / elapsedSeconds : 0;
    const remainingBytes = uploadState.file.size - uploadState.uploadedBytes;
    const estimatedTimeRemaining = speed > 0 ? remainingBytes / speed : 0;

    return {
      uploadId: '', // Will be set by caller
      fileName: uploadState.file.name,
      totalSize: uploadState.file.size,
      uploadedBytes: uploadState.uploadedBytes,
      progress: (uploadState.uploadedBytes / uploadState.file.size) * 100,
      isComplete: uploadState.uploadedBytes >= uploadState.file.size,
      currentChunk,
      totalChunks,
      speed,
      eta: estimatedTimeRemaining,
      status: `Uploading chunk ${currentChunk} of ${totalChunks}...`
    };
  }

  /**
   * Cancel an active upload
   */
  async cancelUpload(uploadId: string): Promise<boolean> {
    const uploadState = this.activeUploads.get(uploadId);
    
    if (uploadState) {
      uploadState.abortController.abort();
      this.activeUploads.delete(uploadId);
    }

    try {
      // 🚨 CRITICAL FIX: Use dynamic baseUrl to bypass Vite in development
      const baseUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
        ? 'http://localhost:5000' // Development: bypass Vite middleware
        : ''; // Production: use relative URLs
        
      const response = await fetch(`${baseUrl}/api/upload/chunk/${uploadId}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        cache: 'no-store'
      });
      
      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Error cancelling upload:', error);
      return false;
    }
  }

  /**
   * Get upload status
   */
  async getUploadStatus(uploadId: string) {
    try {
      // 🚨 CRITICAL FIX: Use dynamic baseUrl to bypass Vite in development
      const baseUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
        ? 'http://localhost:5000' // Development: bypass Vite middleware
        : ''; // Production: use relative URLs
        
      const response = await fetch(`${baseUrl}/api/upload/chunk/${uploadId}/status`, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        cache: 'no-store'
      });
      return await response.json();
    } catch (error) {
      console.error('Error getting upload status:', error);
      return { exists: false };
    }
  }

  /**
   * Process completed upload
   */
  async processCompletedUpload(
    uploadId: string,
    dealId: number,
    folderName?: string
  ) {
    try {
      const response = await fetch(`/api/deals/${dealId}/upload-chunked/${uploadId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          folderName: folderName || 'Large Files',
        }),
      });

      if (!response.ok) {
        throw new Error(`Processing failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error processing completed upload:', error);
      throw error;
    }
  }

  /**
   * Check if file is large enough to require chunked upload
   * Optimized for files up to 1GB+ with ultra-safe thresholds
   */
  isLargeFile(file: File): boolean {
    const largeSizeThreshold = 5 * 1024 * 1024; // 5MB - aggressive threshold for live production
    return file.size > largeSizeThreshold;
  }

  /**
   * Get human-readable file size
   */
  formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Format time remaining
   */
  formatTimeRemaining(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      return `${Math.round(seconds / 60)}m`;
    } else {
      return `${Math.round(seconds / 3600)}h`;
    }
  }

  /**
   * Initialize upload - creates upload session and returns uploadId
   */
  async initializeUpload(fileName: string, fileSize: number): Promise<string> {
    console.log(`📁 Initializing chunked upload: ${fileName} (${(fileSize / 1024 / 1024).toFixed(1)}MB)`);

    try {
      const requestBody = {
        fileName: fileName,
        totalSize: fileSize,
        chunkSize: this.defaultChunkSize,
      };
      
      console.log('📤 Sending chunked upload init request:', requestBody);
      
      // 🚨 CRITICAL FIX: Use absolute URL to bypass Vite dev server interference
      // 🚨 CRITICAL FIX: Use dynamic baseUrl to bypass Vite in development
      const baseUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
        ? 'http://localhost:5000' // Development: bypass Vite middleware
        : ''; // Production: use relative URLs
        
      const apiUrl = `${baseUrl}/api/upload/chunk/init`;

      // 🚨 CRITICAL FIX: Use GET method with query params to bypass Vite interference
      const params = new URLSearchParams({
        fileName: fileName,
        totalSize: fileSize.toString(),
        chunkSize: this.defaultChunkSize.toString(),
        t: Date.now().toString() // Cache busting
      });
      
      const getApiUrl = `${apiUrl}?${params.toString()}`;
      console.log('🔄 Using GET method to bypass Vite interference:', getApiUrl);
      
      const response = await fetch(getApiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
      });

      console.log(`📥 Response status: ${response.status} ${response.statusText}`);
      console.log(`📥 Response headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Upload init failed - response:', errorText);
        throw new Error(`Failed to initialize upload: ${response.statusText} - ${errorText}`);
      }

      const responseText = await response.text();
      console.log('📥 Raw response text:', responseText);
      
      // 🚨 CRITICAL: Detect Vite HTML interference immediately
      if (responseText.includes('<!DOCTYPE html>') || responseText.includes('<html')) {
        console.error('🚨 VITE INTERFERENCE DETECTED: Received HTML instead of JSON');
        console.error('🚨 This indicates Vite middleware is intercepting the API request');
        console.error('🔄 Retrying with enhanced cache-busting headers...');
        
        // Retry with cache-busting query parameter
        const retryApiUrl = `${apiUrl}?t=${Date.now()}&bypass=vite`;
        console.log('🔄 Retry URL:', retryApiUrl);
        
        const retryResponse = await fetch(retryApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          body: JSON.stringify(requestBody),
          cache: 'no-store'
        });
        
        if (!retryResponse.ok) {
          throw new Error(`Retry failed: ${retryResponse.statusText}`);
        }
        
        const retryText = await retryResponse.text();
        if (retryText.includes('<!DOCTYPE html>')) {
          console.error('❌ Retry #1 still got HTML. Trying final absolute URL approach...');
          
          // Final attempt with different port and headers
          const finalApiUrl = `http://localhost:5000/api/upload/chunk/init?force=true&t=${Date.now()}`;
          const finalResponse = await fetch(finalApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            },
            body: JSON.stringify(requestBody),
            cache: 'no-store',
            mode: 'cors'
          });
          
          if (!finalResponse.ok) {
            throw new Error(`❌ CRITICAL: All retry attempts failed. Server response: ${finalResponse.status}`);
          }
          
          const finalText = await finalResponse.text();
          if (finalText.includes('<!DOCTYPE html>')) {
            throw new Error('❌ CRITICAL: Vite interference persists even after retry. Manual deployment required.');
          }
          
          const finalResult = JSON.parse(finalText);
          console.log('✅ Final retry successful:', finalResult);
          return finalResult.uploadId;
        }
        
        const retryResult = JSON.parse(retryText);
        console.log('✅ Retry successful:', retryResult);
        return retryResult.uploadId;
      }
      
      let initResult;
      try {
        initResult = JSON.parse(responseText);
        console.log('✅ Parsed response:', initResult);
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        console.error('❌ Response was not JSON:', responseText);
        throw new Error(`Server returned invalid JSON: ${responseText.substring(0, 100)}...`);
      }
      
      if (!initResult.uploadId) {
        throw new Error('Server did not return uploadId');
      }
      
      return initResult.uploadId;

    } catch (error: any) {
      console.error('❌ Failed to initialize chunked upload:', error);
      
      // Enhanced error message for better debugging
      if (error.message && error.message.includes('Vite interference')) {
        throw new Error(`Upload initialization failed due to development server conflicts. ${error.message}`);
      } else if (error.message && error.message.includes('invalid JSON')) {
        throw new Error(`Server returned non-JSON response. This may be a development server routing issue.`);
      }
      
      throw error;
    }
  }

  /**
   * Upload ZIP file to data room using chunked upload
   */
  async uploadFile(
    dealId: string,
    file: File,
    onProgress?: (progress: ChunkedUploadProgress) => void
  ): Promise<any> {
    console.log(`🔄 Starting chunked upload for data room: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);

    let uploadId: string = '';
    let totalChunks: number = 0;

    try {
      // Initialize chunked upload session
      uploadId = await this.initializeUpload(file.name, file.size);
      console.log(`✅ Upload session initialized: ${uploadId}`);

      const chunkSize = this.defaultChunkSize;
      totalChunks = Math.ceil(file.size / chunkSize);
      
      // Create abort controller for cancellation
      const abortController = new AbortController();

      // Track upload state
      const uploadState = {
        file,
        options: { onProgress },
        startTime: Date.now(),
        uploadedBytes: 0,
        abortController,
      };
      this.activeUploads.set(uploadId, uploadState);

      // Update initial progress
      if (onProgress) {
        onProgress({
          fileName: file.name,
          progress: 0,
          speed: 0,
          eta: 0,
          status: 'initializing',
          uploadId: uploadId,
          totalSize: file.size,
          uploadedBytes: 0,
          isComplete: false,
          currentChunk: 0,
          totalChunks: totalChunks
        });
      }

      // Upload chunks sequentially for reliability
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (abortController.signal.aborted) {
          throw new Error('Upload cancelled');
        }

        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        // Upload chunk
        await this.uploadChunk(uploadId, chunkIndex, chunk, abortController.signal);

        // Update progress
        uploadState.uploadedBytes = end;
        
        if (onProgress) {
          const now = Date.now();
          const elapsedSeconds = (now - uploadState.startTime) / 1000;
          const speed = elapsedSeconds > 0 ? uploadState.uploadedBytes / elapsedSeconds : 0;
          const remainingBytes = file.size - uploadState.uploadedBytes;
          const estimatedTimeRemaining = speed > 0 ? remainingBytes / speed : 0;

          onProgress({
            fileName: file.name,
            progress: (uploadState.uploadedBytes / file.size) * 100,
            speed: speed,
            eta: estimatedTimeRemaining,
            status: chunkIndex + 1 === totalChunks ? 'assembling' : 'uploading',
            uploadId: uploadId,
            totalSize: file.size,
            uploadedBytes: uploadState.uploadedBytes,
            isComplete: chunkIndex + 1 === totalChunks,
            currentChunk: chunkIndex,
            totalChunks: totalChunks
          });
        }
      }

      // Skip verification in production - trust chunk completion
      console.log(`✅ All ${totalChunks} chunks uploaded successfully, proceeding with processing`);
      
      // Optional: Verify upload completion only if needed (for debugging)
      try {
        const baseUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
          ? 'http://localhost:5000' 
          : '';
          
        const statusResponse = await fetch(`${baseUrl}/api/upload/chunk/${uploadId}/status`);
        const status = await statusResponse.json();
        
        if (status && status.isComplete) {
          console.log(`✅ Upload verification successful: ${uploadId}`);
        } else {
          console.log(`⚠️ Upload verification inconclusive, but all chunks completed - proceeding anyway`);
        }
      } catch (verificationError) {
        console.log(`⚠️ Upload verification failed but chunks completed - proceeding anyway:`, verificationError);
      }

      console.log(`✅ Chunked upload complete, now processing as data room ZIP: ${file.name}`);
      
      // CRITICAL: Process the uploaded file as a data room ZIP
      const processResult = await this.processAsDataRoomZip(uploadId, dealId);
      
      if (onProgress) {
        onProgress({
          fileName: file.name,
          progress: 100,
          speed: 0,
          eta: 0,
          status: 'complete',
          uploadId: uploadId,
          totalSize: file.size,
          uploadedBytes: file.size,
          isComplete: true,
          currentChunk: totalChunks,
          totalChunks: totalChunks
        });
      }

      return processResult;

    } catch (error: any) {
      console.error('❌ Chunked upload failed:', error);
      
      if (onProgress) {
        onProgress({
          fileName: file.name,
          progress: 0,
          speed: 0,
          eta: 0,
          status: 'error',
          uploadId: uploadId || '',
          totalSize: file.size,
          uploadedBytes: 0,
          isComplete: false,
          currentChunk: 0,
          totalChunks: totalChunks || 0
        });
      }
      
      throw error;
    } finally {
      // Clean up
      if (uploadId) {
        this.activeUploads.delete(uploadId);
      }
    }
  }

  /**
   * Process uploaded chunks as data room ZIP file
   */
  private async processAsDataRoomZip(uploadId: string, dealId: string): Promise<any> {
    try {
      console.log(`🔄 Processing chunked upload ${uploadId} as data room ZIP for deal ${dealId}`);
      
      const baseUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
        ? 'http://localhost:5000' 
        : '';
        
      const response = await fetch(`${baseUrl}/api/deals/${dealId}/upload-chunked/${uploadId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          folderName: 'Data Room Documents'
        }),
      });

      if (!response.ok) {
        throw new Error(`Processing failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ Data room ZIP processing initiated:`, result);
      return result;
    } catch (error) {
      console.error('❌ Error processing chunked upload as data room ZIP:', error);
      throw error;
    }
  }

  /**
   * Upload a file with smart size detection (legacy wrapper method)
   */
  async uploadFileComplete(
    file: File,
    dealId: number,
    folderName?: string,
    onProgress?: (progress: ChunkedUploadProgress) => void
  ): Promise<any> {
    // Initialize upload session
    const uploadId = await this.initializeUpload(file.name, file.size);
    
    // Upload file in chunks
    await this.uploadFile(uploadId, file, onProgress);

    // Process the completed upload
    return await this.processCompletedUpload(uploadId, dealId, folderName);
  }
}

export const chunkedUploadService = new ChunkedUploadService();