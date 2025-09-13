/**
 * Background Upload Service - Runs independently of React components
 * Ensures uploads continue even when user navigates away from page
 */

export interface BackgroundUploadProgress {
  sessionId: string;
  fileName: string;
  progress: number;
  status: string;
  isComplete: boolean;
  error?: string;
}

export interface BackgroundUploadOptions {
  dealId: number;
  file: File;
  onProgress?: (progress: BackgroundUploadProgress) => void;
  onComplete?: (sessionId: string) => void;
  onError?: (error: string) => void;
}

class BackgroundUploadService {
  private activeUploads = new Map<string, {
    uploadPromise: Promise<void>;
    abortController: AbortController;
    options: BackgroundUploadOptions;
  }>();

  /**
   * Start a background ZIP upload that continues even if user navigates away
   */
  async startZipUpload(options: BackgroundUploadOptions): Promise<string> {
    const { dealId, file } = options;
    
    // Check maximum file size - with GCS, we support up to 5TB
    const maxSize = 5 * 1024 * 1024 * 1024 * 1024; // 5TB with GCS
    if (file.size > maxSize) {
      throw new Error(`File size (${(file.size / 1024 / 1024 / 1024).toFixed(1)}GB) exceeds the maximum limit of 5TB.`);
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      throw new Error('Please select a ZIP file');
    }

    console.log(`🚀 Starting background ZIP upload: ${file.name}, Size: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
    
    // Import persistent upload service
    const { frontendPersistentUploadService } = await import('./persistentUploadService');
    
    // Create persistent upload session
    const sessionId = await frontendPersistentUploadService.createUploadSession(
      dealId,
      file.name,
      file.size,
      'gcs_direct'
    );

    console.log(`📝 Created background upload session: ${sessionId}`);

    // Create abort controller for cancellation
    const abortController = new AbortController();
    
    // Start the upload process in background
    const uploadPromise = this.executeBackgroundUpload(sessionId, dealId, file, abortController, options);
    
    // Track the upload
    this.activeUploads.set(sessionId, {
      uploadPromise,
      abortController,
      options
    });

    // Don't await - let it run in background
    uploadPromise
      .then(() => {
        console.log(`✅ Background upload completed: ${sessionId}`);
        this.activeUploads.delete(sessionId);
        options.onComplete?.(sessionId);
      })
      .catch((error) => {
        console.error(`❌ Background upload failed: ${sessionId}`, error);
        this.activeUploads.delete(sessionId);
        options.onError?.(error.message);
      });

    return sessionId;
  }

  /**
   * Execute the upload process in background, independent of components
   */
  private async executeBackgroundUpload(
    sessionId: string,
    dealId: number,
    file: File,
    abortController: AbortController,
    options: BackgroundUploadOptions,
    retryCount = 0
  ): Promise<void> {
    const { frontendPersistentUploadService } = await import('./persistentUploadService');
    const MAX_RETRIES = 3;
    
    try {
      // Step 1: Get signed URL with retry logic
      await this.updateProgress(sessionId, 1, 'Getting upload authorization...', options);
      
      let signedUrlResponse;
      let retryAttempts = 0;
      
      while (retryAttempts < MAX_RETRIES) {
        try {
          signedUrlResponse = await fetch(`/api/gcs/signed-url/${dealId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileName: file.name,
              fileSize: file.size
            }),
            signal: abortController.signal
          });

          if (signedUrlResponse.ok) break;
          
          if (signedUrlResponse.status >= 500) {
            // Server error - retry with exponential backoff
            retryAttempts++;
            if (retryAttempts < MAX_RETRIES) {
              const delay = Math.min(1000 * Math.pow(2, retryAttempts), 10000);
              console.log(`⚠️ Server error, retrying in ${delay}ms (attempt ${retryAttempts}/${MAX_RETRIES})`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
          }
          
          throw new Error(`Failed to get signed URL: ${signedUrlResponse.statusText}`);
        } catch (error: any) {
          if (error.name === 'AbortError') throw error;
          if (retryAttempts >= MAX_RETRIES - 1) throw error;
          
          retryAttempts++;
          const delay = Math.min(1000 * Math.pow(2, retryAttempts), 10000);
          console.log(`⚠️ Network error, retrying in ${delay}ms (attempt ${retryAttempts}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (!signedUrlResponse || !signedUrlResponse.ok) {
        throw new Error(`Failed to get signed URL after ${MAX_RETRIES} attempts`);
      }

      const { signedUrl, gcsFileName, uploadId } = await signedUrlResponse.json();
      console.log(`✅ Got signed URL for background upload: ${sessionId}`);

      await this.updateProgress(sessionId, 10, 'Starting direct cloud upload...', options);

      // Step 2: Upload directly to GCS in background with retry logic
      let uploadSuccess = false;
      let uploadRetries = 0;
      
      while (!uploadSuccess && uploadRetries < MAX_RETRIES) {
        try {
          await this.uploadToGCS(sessionId, file, signedUrl, abortController, options);
          uploadSuccess = true;
        } catch (error: any) {
          if (error.name === 'AbortError') throw error;
          
          uploadRetries++;
          if (uploadRetries >= MAX_RETRIES) throw error;
          
          const delay = Math.min(2000 * Math.pow(2, uploadRetries), 30000);
          console.log(`⚠️ Upload failed, retrying in ${delay}ms (attempt ${uploadRetries}/${MAX_RETRIES})`);
          
          await this.updateProgress(
            sessionId, 
            Math.max(10, (uploadRetries - 1) * 30), 
            `Retrying upload (attempt ${uploadRetries}/${MAX_RETRIES})...`, 
            options
          );
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // Step 3: Notify server of completion
      await this.updateProgress(sessionId, 95, 'Processing uploaded file...', options);

      const completeResponse = await fetch(`/api/gcs/upload-complete/${dealId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gcsFileName,
          uploadId,
          fileName: file.name
        }),
        signal: abortController.signal
      });

      if (!completeResponse.ok) {
        throw new Error(`Server processing failed: ${completeResponse.statusText}`);
      }

      const result = await completeResponse.json();
      
      await this.updateProgress(sessionId, 100, `✅ Upload complete! ${result.documentsCreated || 0} documents extracted`, options);
      
      // Mark as completed in persistent storage
      await frontendPersistentUploadService.updateProgress(
        sessionId,
        100,
        file.size,
        'Upload completed successfully'
      );
      
      // Store completion in localStorage for notifications
      const completedUploads = JSON.parse(localStorage.getItem('completedUploads') || '[]');
      completedUploads.push({
        sessionId,
        fileName: file.name,
        documentsCreated: result.documentsCreated || 0,
        completedAt: Date.now()
      });
      localStorage.setItem('completedUploads', JSON.stringify(completedUploads));

      console.log(`✅ Background upload fully completed: ${sessionId}`);

      // Show notification if page visibility API supports it
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Upload Complete', {
          body: `${file.name} has been uploaded successfully. ${result.documentsCreated || 0} documents extracted.`,
          icon: '/assets/aescuvest-icon.png'
        });
      }

    } catch (error: any) {
      console.error(`❌ Background upload error: ${sessionId}`, error);
      
      // If we haven't exceeded max retries, try again
      if (retryCount < MAX_RETRIES && error.name !== 'AbortError') {
        const delay = Math.min(3000 * Math.pow(2, retryCount), 60000);
        console.log(`🔄 Retrying entire upload process in ${delay}ms (retry ${retryCount + 1}/${MAX_RETRIES})`);
        
        await this.updateProgress(
          sessionId,
          0,
          `Retrying upload (attempt ${retryCount + 1}/${MAX_RETRIES})...`,
          options
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.executeBackgroundUpload(
          sessionId,
          dealId,
          file,
          abortController,
          options,
          retryCount + 1
        );
      }
      
      await frontendPersistentUploadService.updateProgress(
        sessionId,
        0,
        0,
        `Upload failed: ${error.message}`
      );

      throw error;
    }
  }

  /**
   * Upload file to GCS with progress tracking
   */
  private async uploadToGCS(
    sessionId: string,
    file: File,
    signedUrl: string,
    abortController: AbortController,
    options: BackgroundUploadOptions
  ): Promise<void> {
    const { frontendPersistentUploadService } = await import('./persistentUploadService');

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Handle abortion
      abortController.signal.addEventListener('abort', () => {
        console.log(`🛑 Aborting background upload: ${sessionId}`);
        xhr.abort();
        reject(new Error('Upload aborted by user'));
      });

      // Track upload progress
      xhr.upload.addEventListener('progress', async (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          
          await this.updateProgress(
            sessionId, 
            Math.min(percentComplete, 90), // Cap at 90% for GCS upload
            `Uploading to cloud (${percentComplete}%)...`,
            options
          );

          // Update persistent storage
          try {
            await frontendPersistentUploadService.updateProgress(
              sessionId,
              percentComplete,
              e.loaded,
              `Uploading to cloud (${percentComplete}%)`
            );
          } catch (error) {
            console.log('Progress update failed (non-critical):', error);
          }
        }
      });

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status === 200 || xhr.status === 201 || xhr.status === 204) {
          console.log(`✅ GCS upload completed for session: ${sessionId}`);
          resolve();
        } else {
          reject(new Error(`GCS upload failed with status: ${xhr.status}`));
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error('Network error during GCS upload'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload aborted'));
      });

      // Start the upload
      xhr.open('PUT', signedUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.send(file);
    });
  }

  /**
   * Update progress and notify callback if provided
   */
  private async updateProgress(
    sessionId: string,
    progress: number,
    status: string,
    options: BackgroundUploadOptions
  ): Promise<void> {
    const progressData: BackgroundUploadProgress = {
      sessionId,
      fileName: options.file.name,
      progress,
      status,
      isComplete: progress >= 100
    };

    console.log(`📊 Background upload progress [${sessionId}]: ${progress}% - ${status}`);

    // Notify callback if component is still listening
    options.onProgress?.(progressData);
  }

  /**
   * Get all active background uploads
   */
  getActiveUploads(): string[] {
    return Array.from(this.activeUploads.keys());
  }

  /**
   * Check if an upload is currently active
   */
  isUploadActive(sessionId: string): boolean {
    return this.activeUploads.has(sessionId);
  }

  /**
   * Cancel a background upload
   */
  async cancelUpload(sessionId: string): Promise<void> {
    const upload = this.activeUploads.get(sessionId);
    if (upload) {
      console.log(`🛑 Cancelling background upload: ${sessionId}`);
      upload.abortController.abort();
      this.activeUploads.delete(sessionId);
      
      // Update persistent storage
      const { frontendPersistentUploadService } = await import('./persistentUploadService');
      await frontendPersistentUploadService.updateProgress(
        sessionId,
        0,
        0,
        'Upload cancelled by user'
      );
    }
  }

  /**
   * Resume monitoring an existing upload session
   */
  async resumeUploadMonitoring(sessionId: string, options: BackgroundUploadOptions): Promise<void> {
    // Check if upload is already active
    if (this.activeUploads.has(sessionId)) {
      console.log(`📋 Upload already being monitored: ${sessionId}`);
      return;
    }

    console.log(`🔄 Resuming monitoring for upload session: ${sessionId}`);
    
    // Get upload status from persistent storage
    const { frontendPersistentUploadService } = await import('./persistentUploadService');
    
    // Poll for updates until complete
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/persistent-uploads/${sessionId}`);
        if (response.ok) {
          const session = await response.json();
          
          if (session.status === 'completed') {
            clearInterval(pollInterval);
            options.onComplete?.(sessionId);
          } else if (session.status === 'failed') {
            clearInterval(pollInterval);
            options.onError?.(session.errorMessage || 'Upload failed');
          } else {
            // Still in progress
            options.onProgress?.({
              sessionId,
              fileName: session.fileName,
              progress: session.progress,
              status: session.currentStep || 'Processing...',
              isComplete: false
            });
          }
        }
      } catch (error) {
        console.log('Polling error (non-critical):', error);
      }
    }, 2000); // Poll every 2 seconds

    // Clean up after 30 minutes max
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 30 * 60 * 1000);
  }
}

// Export singleton instance
export const backgroundUploadService = new BackgroundUploadService();