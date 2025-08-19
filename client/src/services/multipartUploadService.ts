interface MultipartUploadProgress {
  uploadId: string;
  fileName: string;
  totalSize: number;
  uploadedBytes: number;
  totalParts: number;
  completedParts: number;
  progress: number;
  speed: number; // bytes per second
  eta: number; // seconds remaining
  status: string;
}

interface PartUploadResult {
  partNumber: number;
  etag: string;
  size: number;
}

class MultipartUploadService {
  private activeUploads = new Map<string, {
    abortController: AbortController;
    startTime: number;
    uploadedBytes: number;
  }>();

  /**
   * Upload large file using direct-to-storage multipart upload
   */
  async uploadLargeFile(
    file: File,
    dealId: number,
    onProgress?: (progress: MultipartUploadProgress) => void
  ): Promise<{
    objectKey: string;
    etag: string;
    size: number;
  }> {
    console.log(`🚀 Starting multipart upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);

    const chunkSize = this.calculateOptimalChunkSize(file.size);
    console.log(`📊 Using chunk size: ${(chunkSize / 1024 / 1024).toFixed(0)}MB`);

    try {
      // Initialize multipart upload
      const initResponse = await fetch('/api/multipart/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          dealId,
          chunkSize,
        }),
      });

      if (!initResponse.ok) {
        throw new Error(`Failed to initialize upload: ${initResponse.statusText}`);
      }

      const { uploadId, partUrls, totalParts } = await initResponse.json();
      console.log(`✅ Upload initialized: ${uploadId} (${totalParts} parts)`);

      // Create abort controller
      const abortController = new AbortController();
      const startTime = Date.now();
      
      // Track upload state
      this.activeUploads.set(uploadId, {
        abortController,
        startTime,
        uploadedBytes: 0,
      });

      // Upload parts with parallelization
      const maxConcurrent = this.calculateMaxConcurrency(file.size);
      const partResults = await this.uploadPartsParallel(
        file,
        partUrls,
        chunkSize,
        maxConcurrent,
        abortController.signal,
        (uploadedBytes) => {
          const uploadState = this.activeUploads.get(uploadId);
          if (uploadState) {
            uploadState.uploadedBytes = uploadedBytes;
            
            // Calculate progress metrics
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = uploadedBytes / elapsed;
            const remaining = file.size - uploadedBytes;
            const eta = remaining / speed;
            
            if (onProgress) {
              onProgress({
                uploadId,
                fileName: file.name,
                totalSize: file.size,
                uploadedBytes,
                totalParts,
                completedParts: Math.floor(uploadedBytes / chunkSize),
                progress: (uploadedBytes / file.size) * 100,
                speed,
                eta,
                status: `Uploading part ${Math.floor(uploadedBytes / chunkSize) + 1} of ${totalParts}`,
              });
            }
          }
        }
      );

      console.log(`📦 All parts uploaded successfully (${partResults.length} parts)`);

      // Complete multipart upload
      const completeResponse = await fetch('/api/multipart/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uploadId,
          partETags: partResults.map(r => r.etag),
        }),
      });

      if (!completeResponse.ok) {
        throw new Error(`Failed to complete upload: ${completeResponse.statusText}`);
      }

      const result = await completeResponse.json();
      console.log(`✅ Upload completed: ${result.objectKey}`);

      // Cleanup
      this.activeUploads.delete(uploadId);

      // Final progress update
      if (onProgress) {
        onProgress({
          uploadId,
          fileName: file.name,
          totalSize: file.size,
          uploadedBytes: file.size,
          totalParts,
          completedParts: totalParts,
          progress: 100,
          speed: 0,
          eta: 0,
          status: 'Upload completed successfully',
        });
      }

      return result;

    } catch (error) {
      console.error(`❌ Multipart upload failed: ${error}`);
      
      // Cleanup on error
      this.activeUploads.delete(uploadId);
      
      // Abort upload on server
      try {
        await fetch('/api/multipart/abort', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uploadId }),
        });
      } catch (abortError) {
        console.warn('Failed to abort upload:', abortError);
      }

      throw error;
    }
  }

  /**
   * Upload parts with controlled parallelization
   */
  private async uploadPartsParallel(
    file: File,
    partUrls: string[],
    chunkSize: number,
    maxConcurrent: number,
    signal: AbortSignal,
    onProgress: (uploadedBytes: number) => void
  ): Promise<PartUploadResult[]> {
    const results: PartUploadResult[] = [];
    const semaphore = new Semaphore(maxConcurrent);
    let uploadedBytes = 0;

    const uploadTasks = partUrls.map(async (url, index) => {
      return semaphore.acquire(async () => {
        if (signal.aborted) {
          throw new Error('Upload aborted');
        }

        const partNumber = index + 1;
        const start = index * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        console.log(`⬆️ Uploading part ${partNumber}/${partUrls.length} (${(chunk.size / 1024 / 1024).toFixed(1)}MB)`);

        const response = await fetch(url, {
          method: 'PUT',
          body: chunk,
          signal,
          headers: {
            'Content-Type': 'application/octet-stream',
          },
        });

        if (!response.ok) {
          throw new Error(`Part ${partNumber} upload failed: ${response.statusText}`);
        }

        const etag = response.headers.get('etag') || `"part-${partNumber}"`;
        
        uploadedBytes += chunk.size;
        onProgress(uploadedBytes);

        console.log(`✅ Part ${partNumber} uploaded (ETag: ${etag})`);

        return {
          partNumber,
          etag,
          size: chunk.size,
        };
      });
    });

    const uploadResults = await Promise.all(uploadTasks);
    
    // Sort by part number to ensure correct order
    return uploadResults.sort((a, b) => a.partNumber - b.partNumber);
  }

  /**
   * Calculate optimal chunk size based on file size
   */
  private calculateOptimalChunkSize(fileSize: number): number {
    // Google Cloud Storage limits: 5MB - 5GB per part, max 1024 parts
    const minChunkSize = 5 * 1024 * 1024; // 5MB
    const maxChunkSize = 100 * 1024 * 1024; // 100MB (for better performance)
    const maxParts = 1000; // Conservative limit

    const calculatedChunkSize = Math.ceil(fileSize / maxParts);
    
    if (calculatedChunkSize < minChunkSize) {
      return minChunkSize;
    } else if (calculatedChunkSize > maxChunkSize) {
      return maxChunkSize;
    } else {
      return calculatedChunkSize;
    }
  }

  /**
   * Calculate optimal concurrency based on file size and connection
   */
  private calculateMaxConcurrency(fileSize: number): number {
    // More concurrency for larger files, but cap at reasonable limits
    if (fileSize > 10 * 1024 * 1024 * 1024) { // > 10GB
      return 8;
    } else if (fileSize > 1 * 1024 * 1024 * 1024) { // > 1GB
      return 6;
    } else if (fileSize > 100 * 1024 * 1024) { // > 100MB
      return 4;
    } else {
      return 2;
    }
  }

  /**
   * Cancel active upload
   */
  async cancelUpload(uploadId: string): Promise<void> {
    const uploadState = this.activeUploads.get(uploadId);
    if (uploadState) {
      uploadState.abortController.abort();
      this.activeUploads.delete(uploadId);
      
      // Notify server to abort
      try {
        await fetch('/api/multipart/abort', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uploadId }),
        });
      } catch (error) {
        console.warn('Failed to abort upload on server:', error);
      }
    }
  }

  /**
   * Get active uploads
   */
  getActiveUploads(): string[] {
    return Array.from(this.activeUploads.keys());
  }
}

/**
 * Simple semaphore for controlling concurrency
 */
class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const executeTask = async () => {
        try {
          const result = await task();
          this.release();
          resolve(result);
        } catch (error) {
          this.release();
          reject(error);
        }
      };

      if (this.permits > 0) {
        this.permits--;
        executeTask();
      } else {
        this.queue.push(executeTask);
      }
    });
  }

  private release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.permits++;
    }
  }
}

export const multipartUploadService = new MultipartUploadService();