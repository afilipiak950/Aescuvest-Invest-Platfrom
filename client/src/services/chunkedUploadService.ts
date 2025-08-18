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
  private readonly defaultChunkSize = 5 * 1024 * 1024; // 5MB chunks for maximum safety
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
      const response = await fetch('/api/upload/chunk/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          totalSize: file.size,
          chunkSize: chunkSize,
        }),
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
      const statusResponse = await fetch(`/api/upload/chunk/${uploadId}/status`);
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

    const response = await fetch(`/api/upload/chunk/${uploadId}/${chunkIndex}`, {
      method: 'POST',
      body: formData,
      signal,
    });

    if (!response.ok) {
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
      const response = await fetch(`/api/upload/chunk/${uploadId}`, {
        method: 'DELETE',
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
      const response = await fetch(`/api/upload/chunk/${uploadId}/status`);
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
      const response = await fetch('/api/upload/chunk/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: fileName,
          totalSize: fileSize,
          chunkSize: this.defaultChunkSize,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to initialize upload: ${response.statusText}`);
      }

      const initResult = await response.json();
      return initResult.uploadId;

    } catch (error) {
      console.error('❌ Failed to initialize chunked upload:', error);
      throw error;
    }
  }

  /**
   * Upload file in chunks using existing uploadId
   */
  async uploadFile(
    uploadId: string,
    file: File,
    onProgress?: (progress: ChunkedUploadProgress) => void
  ): Promise<void> {
    const chunkSize = this.defaultChunkSize;
    const totalChunks = Math.ceil(file.size / chunkSize);
    
    console.log(`📁 Starting chunked upload: ${file.name} (${totalChunks} chunks)`);

    try {
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

      // Verify upload completion
      const statusResponse = await fetch(`/api/upload/chunk/${uploadId}/status`);
      const status = await statusResponse.json();
      
      if (!status.isComplete) {
        throw new Error('Upload verification failed');
      }

      console.log(`✅ Chunked upload complete: ${file.name}`);
      
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

      this.activeUploads.delete(uploadId);

    } catch (error) {
      console.error('❌ Chunked upload failed:', error);
      this.activeUploads.delete(uploadId);
      
      if (onProgress) {
        onProgress({
          fileName: file.name,
          progress: 0,
          speed: 0,
          eta: 0,
          status: 'error',
          uploadId: uploadId,
          totalSize: file.size,
          uploadedBytes: 0,
          isComplete: false,
          currentChunk: 0,
          totalChunks: totalChunks
        });
      }
      
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