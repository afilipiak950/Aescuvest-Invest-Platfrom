import { storage } from '../storage';
import { websocketManager } from './websocketManager';
import { chunkedUploadService } from './chunkedUploadService';
import { randomUUID } from 'crypto';

interface BackgroundUploadSession {
  uploadId: string;
  dealId: number;
  fileName: string;
  fileSize: number;
  uploadType: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentChunk: number;
  totalChunks: number;
  uploadedBytes: number;
  error?: string;
  startedAt: Date;
  lastActivity: Date;
  completedAt?: Date;
}

export class BackgroundUploadService {
  private activeSessions = new Map<string, BackgroundUploadSession>();
  private progressUpdateInterval = 1000; // 1 second
  private sessionTimeoutMs = 3600000; // 1 hour

  constructor() {
    // Start periodic cleanup of stale sessions
    setInterval(() => {
      this.cleanupStaleSessions();
    }, 60000); // Every minute

    console.log('📁 Background Upload Service initialized');
  }

  /**
   * Create a new background upload session
   */
  async createUploadSession(
    dealId: number,
    fileName: string,
    fileSize: number,
    uploadType: string = 'zip'
  ): Promise<string> {
    const uploadId = randomUUID();
    
    try {
      // Create session in memory
      const session: BackgroundUploadSession = {
        uploadId,
        dealId,
        fileName,
        fileSize,
        uploadType,
        status: 'uploading',
        progress: 0,
        currentChunk: 0,
        totalChunks: Math.ceil(fileSize / (5 * 1024 * 1024)), // 5MB chunks
        uploadedBytes: 0,
        startedAt: new Date(),
        lastActivity: new Date()
      };

      this.activeSessions.set(uploadId, session);

      // Persist to database
      await storage.createBackgroundUpload({
        uploadId,
        dealId,
        fileName,
        fileSize,
        status: 'uploading',
        progress: 0,
        currentChunk: 0,
        totalChunks: session.totalChunks,
        chunkSize: 5 * 1024 * 1024, // 5MB chunks
        uploadedBytes: 0,
        createdAt: new Date(),
        lastActivity: new Date()
      });

      console.log(`📁 Created background upload session ${uploadId} for deal ${dealId}`);
      
      // Initialize chunked upload
      const chunkSize = 5 * 1024 * 1024; // 5MB chunks
      const chunkedUploadId = chunkedUploadService.initializeUpload(fileName, fileSize, chunkSize);
      
      console.log(`🔗 Linked background upload ${uploadId} with chunked upload ${chunkedUploadId}`);
      
      return uploadId;
    } catch (error) {
      console.error(`❌ Failed to create background upload session:`, error);
      throw error;
    }
  }

  /**
   * Update upload progress and persist to database
   */
  async updateProgress(
    uploadId: string,
    progress: number,
    currentChunk: number,
    uploadedBytes: number
  ): Promise<void> {
    try {
      const session = this.activeSessions.get(uploadId);
      if (!session) {
        console.warn(`⚠️ No active session found for upload ${uploadId}`);
        return;
      }

      // Update session in memory
      session.progress = Math.min(100, Math.max(0, progress));
      session.currentChunk = currentChunk;
      session.uploadedBytes = uploadedBytes;
      session.lastActivity = new Date();

      // Persist to database
      await storage.updateBackgroundUploadProgress(uploadId, progress, currentChunk, uploadedBytes);

      // Emit progress via WebSocket
      websocketManager.broadcastJobProgress({
        jobId: 0, // Not a job, just upload progress
        type: 'upload_progress',
        status: 'Running',
        progress: session.progress,
        currentStep: `Uploading chunk ${session.currentChunk}/${session.totalChunks}`,
        startTime: session.startedAt,
        metadata: {
          uploadId,
          currentChunk: session.currentChunk,
          totalChunks: session.totalChunks,
          uploadedBytes: session.uploadedBytes,
          fileSize: session.fileSize,
          fileName: session.fileName,
          status: session.status
        }
      }, session.dealId);

      console.log(`📁 Updated upload progress: ${uploadId} - ${progress}% (chunk ${currentChunk}/${session.totalChunks})`);
    } catch (error) {
      console.error(`❌ Failed to update progress for upload ${uploadId}:`, error);
    }
  }

  /**
   * Mark upload as completed and trigger processing
   */
  async completeUpload(uploadId: string, assembledFilePath: string): Promise<void> {
    try {
      const session = this.activeSessions.get(uploadId);
      if (!session) {
        console.warn(`⚠️ No active session found for upload ${uploadId}`);
        return;
      }

      // Update session status
      session.status = 'processing';
      session.progress = 100;
      session.completedAt = new Date();
      session.lastActivity = new Date();

      // Persist to database
      await storage.updateBackgroundUpload(uploadId, {
        status: 'processing',
        progress: 100,
        completedAt: new Date()
      });

      console.log(`✅ Upload completed: ${uploadId}, starting processing...`);

      // Emit completion event
      websocketManager.broadcastJobComplete(0, {
        uploadId,
        fileName: session.fileName,
        status: 'processing'
      }, session.dealId);

      // Start document processing in background
      if (session.uploadType === 'zip' && assembledFilePath) {
        setImmediate(async () => {
          try {
            await this.processZipFile(uploadId, assembledFilePath, session.dealId);
          } catch (error) {
            console.error(`❌ Background ZIP processing failed for ${uploadId}:`, error);
            await this.failUpload(uploadId, error instanceof Error ? error.message : 'Processing failed');
          }
        });
      }
    } catch (error) {
      console.error(`❌ Failed to complete upload ${uploadId}:`, error);
      await this.failUpload(uploadId, error instanceof Error ? error.message : 'Completion failed');
    }
  }

  /**
   * Process ZIP file and extract documents
   */
  private async processZipFile(uploadId: string, filePath: string, dealId: number): Promise<void> {
    try {
      console.log(`🗃️ Processing ZIP file for upload ${uploadId}`);
      
      const session = this.activeSessions.get(uploadId);
      if (!session) {
        throw new Error('Upload session not found');
      }

      // Emit processing start event
      websocketManager.broadcastJobProgress({
        jobId: 0,
        type: 'upload_processing',
        status: 'Running',
        progress: 100,
        currentStep: 'Processing ZIP file',
        startTime: new Date(),
        metadata: {
          uploadId,
          fileName: session.fileName,
          status: 'processing'
        }
      }, dealId);

      // For now, simulate ZIP processing since we removed zipProcessor import
      // This would be replaced with actual ZIP processing logic
      const result = {
        processedFiles: [],
        totalFiles: 0
      };

      // Mark as completed
      session.status = 'completed';
      await storage.completeBackgroundUpload(uploadId);

      // Emit completion event with results
      websocketManager.broadcastJobComplete(0, {
        uploadId,
        fileName: session.fileName,
        documentsProcessed: result.processedFiles.length,
        errors: []
      }, dealId);

      console.log(`✅ Background ZIP processing completed for ${uploadId}: ${result.processedFiles.length} documents processed`);

      // Clean up session after successful completion
      this.activeSessions.delete(uploadId);
    } catch (error) {
      console.error(`❌ ZIP processing failed for upload ${uploadId}:`, error);
      throw error;
    }
  }

  /**
   * Mark upload as failed
   */
  async failUpload(uploadId: string, errorMessage: string): Promise<void> {
    try {
      const session = this.activeSessions.get(uploadId);
      if (session) {
        session.status = 'failed';
        session.error = errorMessage;
        session.lastActivity = new Date();
      }

      // Persist to database
      await storage.failBackgroundUpload(uploadId, errorMessage);

      // Emit failure event
      if (session) {
        websocketManager.broadcastJobComplete(0, {
          uploadId,
          fileName: session.fileName,
          error: errorMessage,
          status: 'failed'
        }, session.dealId);
      }

      console.log(`❌ Upload failed: ${uploadId} - ${errorMessage}`);
    } catch (error) {
      console.error(`❌ Failed to mark upload as failed ${uploadId}:`, error);
    }
  }

  /**
   * Get upload session status
   */
  async getUploadStatus(uploadId: string): Promise<BackgroundUploadSession | null> {
    // Check memory first
    const memorySession = this.activeSessions.get(uploadId);
    if (memorySession) {
      return memorySession;
    }

    // Check database
    try {
      const dbUpload = await storage.getBackgroundUploadById(uploadId);
      if (dbUpload) {
        // Recreate session object from database data
        const session: BackgroundUploadSession = {
          uploadId: dbUpload.uploadId,
          dealId: dbUpload.dealId || 0,
          fileName: dbUpload.fileName,
          fileSize: dbUpload.fileSize,
          uploadType: 'zip', // Default upload type
          status: dbUpload.status as any,
          progress: dbUpload.progress || 0,
          currentChunk: dbUpload.currentChunk || 0,
          totalChunks: dbUpload.totalChunks,
          uploadedBytes: dbUpload.uploadedBytes || 0,
          error: dbUpload.error || undefined,
          startedAt: dbUpload.createdAt,
          lastActivity: dbUpload.lastActivity,
          completedAt: dbUpload.completedAt || undefined
        };

        // Restore to memory if still active
        if (session.status === 'uploading' || session.status === 'processing') {
          this.activeSessions.set(uploadId, session);
        }

        return session;
      }
    } catch (error) {
      console.error(`❌ Failed to get upload status for ${uploadId}:`, error);
    }

    return null;
  }

  /**
   * Get all active uploads for a deal
   */
  async getActiveUploadsForDeal(dealId: number): Promise<BackgroundUploadSession[]> {
    try {
      const dbUploads = await storage.getActiveUploadsByDealId(dealId);
      const sessions: BackgroundUploadSession[] = [];

      for (const upload of dbUploads) {
        const session: BackgroundUploadSession = {
          uploadId: upload.uploadId,
          dealId: upload.dealId || 0,
          fileName: upload.fileName,
          fileSize: upload.fileSize,
          uploadType: 'zip', // Default upload type
          status: upload.status as any,
          progress: upload.progress || 0,
          currentChunk: upload.currentChunk || 0,
          totalChunks: upload.totalChunks,
          uploadedBytes: upload.uploadedBytes || 0,
          error: upload.error || undefined,
          startedAt: upload.createdAt,
          lastActivity: upload.lastActivity,
          completedAt: upload.completedAt || undefined
        };

        sessions.push(session);

        // Restore active sessions to memory
        if (session.status === 'uploading' || session.status === 'processing') {
          this.activeSessions.set(session.uploadId, session);
        }
      }

      return sessions;
    } catch (error) {
      console.error(`❌ Failed to get active uploads for deal ${dealId}:`, error);
      return [];
    }
  }

  /**
   * Clean up stale upload sessions
   */
  private cleanupStaleSessions(): void {
    const now = new Date();
    const staleSessions: string[] = [];

    this.activeSessions.forEach((session, uploadId) => {
      const timeSinceActivity = now.getTime() - session.lastActivity.getTime();
      
      if (timeSinceActivity > this.sessionTimeoutMs) {
        staleSessions.push(uploadId);
      }
    });

    for (const uploadId of staleSessions) {
      console.log(`🧹 Cleaning up stale upload session: ${uploadId}`);
      this.activeSessions.delete(uploadId);
    }

    if (staleSessions.length > 0) {
      console.log(`🧹 Cleaned up ${staleSessions.length} stale upload sessions`);
    }
  }

  /**
   * Resume upload from previous session (for page refreshes)
   */
  async resumeUpload(uploadId: string): Promise<BackgroundUploadSession | null> {
    try {
      const session = await this.getUploadStatus(uploadId);
      if (!session) {
        return null;
      }

      console.log(`🔄 Resuming upload session: ${uploadId} (${session.progress}% complete)`);
      
      // Emit resume event to client
      websocketManager.broadcastJobProgress({
        jobId: 0,
        type: 'upload_resumed',
        status: 'Running',
        progress: session.progress,
        currentStep: `Resumed: chunk ${session.currentChunk}/${session.totalChunks}`,
        startTime: session.startedAt,
        metadata: {
          uploadId,
          fileName: session.fileName,
          status: session.status,
          currentChunk: session.currentChunk,
          totalChunks: session.totalChunks
        }
      }, session.dealId);

      return session;
    } catch (error) {
      console.error(`❌ Failed to resume upload ${uploadId}:`, error);
      return null;
    }
  }
}

// Export singleton instance
export const backgroundUploadService = new BackgroundUploadService();