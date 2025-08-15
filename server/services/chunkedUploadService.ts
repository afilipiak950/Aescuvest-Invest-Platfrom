import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

interface ChunkInfo {
  uploadId: string;
  fileName: string;
  totalChunks: number;
  chunkSize: number;
  totalSize: number;
  uploadedChunks: Set<number>;
  filePath: string;
  createdAt: Date;
}

class ChunkedUploadService {
  private activeUploads = new Map<string, ChunkInfo>();
  private readonly chunkTimeout = 30 * 60 * 1000; // 30 minutes
  private readonly uploadsDir = path.join(process.cwd(), 'uploads');

  constructor() {
    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }

    // Cleanup expired uploads every 10 minutes
    setInterval(() => this.cleanupExpiredUploads(), 10 * 60 * 1000);
  }

  /**
   * Initialize a new chunked upload session
   */
  initializeUpload(fileName: string, totalSize: number, chunkSize: number): string {
    const uploadId = randomUUID();
    const totalChunks = Math.ceil(totalSize / chunkSize);
    const filePath = path.join(this.uploadsDir, `${uploadId}_${fileName}`);

    const chunkInfo: ChunkInfo = {
      uploadId,
      fileName,
      totalChunks,
      chunkSize,
      totalSize,
      uploadedChunks: new Set(),
      filePath,
      createdAt: new Date()
    };

    this.activeUploads.set(uploadId, chunkInfo);

    console.log(`📁 Initialized chunked upload: ${fileName} (${(totalSize / 1024 / 1024).toFixed(1)}MB, ${totalChunks} chunks)`);

    return uploadId;
  }

  /**
   * Upload a single chunk
   */
  async uploadChunk(uploadId: string, chunkIndex: number, chunkData: Buffer): Promise<{
    success: boolean;
    progress: number;
    isComplete: boolean;
    error?: string;
  }> {
    const chunkInfo = this.activeUploads.get(uploadId);
    
    if (!chunkInfo) {
      return {
        success: false,
        progress: 0,
        isComplete: false,
        error: 'Upload session not found or expired'
      };
    }

    try {
      // Create temporary chunk file
      const chunkPath = `${chunkInfo.filePath}.chunk.${chunkIndex}`;
      await fs.promises.writeFile(chunkPath, chunkData);

      // Mark chunk as uploaded
      chunkInfo.uploadedChunks.add(chunkIndex);

      const progress = (chunkInfo.uploadedChunks.size / chunkInfo.totalChunks) * 100;
      const isComplete = chunkInfo.uploadedChunks.size === chunkInfo.totalChunks;

      console.log(`📦 Chunk ${chunkIndex + 1}/${chunkInfo.totalChunks} uploaded for ${chunkInfo.fileName} (${progress.toFixed(1)}%)`);

      if (isComplete) {
        // Assemble final file
        await this.assembleFile(chunkInfo);
        this.activeUploads.delete(uploadId);
        console.log(`✅ File assembly complete: ${chunkInfo.fileName}`);
      }

      return {
        success: true,
        progress,
        isComplete
      };
    } catch (error) {
      console.error(`❌ Error uploading chunk ${chunkIndex}:`, error);
      return {
        success: false,
        progress: (chunkInfo.uploadedChunks.size / chunkInfo.totalChunks) * 100,
        isComplete: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get upload status
   */
  getUploadStatus(uploadId: string): {
    exists: boolean;
    progress?: number;
    isComplete?: boolean;
    fileName?: string;
    uploadedChunks?: number;
    totalChunks?: number;
  } {
    const chunkInfo = this.activeUploads.get(uploadId);
    
    if (!chunkInfo) {
      return { exists: false };
    }

    const progress = (chunkInfo.uploadedChunks.size / chunkInfo.totalChunks) * 100;
    const isComplete = chunkInfo.uploadedChunks.size === chunkInfo.totalChunks;

    return {
      exists: true,
      progress,
      isComplete,
      fileName: chunkInfo.fileName,
      uploadedChunks: chunkInfo.uploadedChunks.size,
      totalChunks: chunkInfo.totalChunks
    };
  }

  /**
   * Cancel an upload and cleanup
   */
  async cancelUpload(uploadId: string): Promise<boolean> {
    const chunkInfo = this.activeUploads.get(uploadId);
    
    if (!chunkInfo) {
      return false;
    }

    try {
      // Clean up chunk files
      for (let i = 0; i < chunkInfo.totalChunks; i++) {
        const chunkPath = `${chunkInfo.filePath}.chunk.${i}`;
        if (fs.existsSync(chunkPath)) {
          await fs.promises.unlink(chunkPath);
        }
      }

      // Remove final file if it exists
      if (fs.existsSync(chunkInfo.filePath)) {
        await fs.promises.unlink(chunkInfo.filePath);
      }

      this.activeUploads.delete(uploadId);
      console.log(`🗑️ Cancelled upload: ${chunkInfo.fileName}`);
      return true;
    } catch (error) {
      console.error(`❌ Error cancelling upload ${uploadId}:`, error);
      return false;
    }
  }

  /**
   * Assemble chunks into final file
   */
  private async assembleFile(chunkInfo: ChunkInfo): Promise<void> {
    const writeStream = fs.createWriteStream(chunkInfo.filePath);
    
    try {
      for (let i = 0; i < chunkInfo.totalChunks; i++) {
        const chunkPath = `${chunkInfo.filePath}.chunk.${i}`;
        
        if (!fs.existsSync(chunkPath)) {
          throw new Error(`Missing chunk ${i}`);
        }

        const chunkData = await fs.promises.readFile(chunkPath);
        writeStream.write(chunkData);

        // Clean up chunk file
        await fs.promises.unlink(chunkPath);
      }

      writeStream.end();
      
      // Wait for stream to finish
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      console.log(`🔧 Assembled file: ${chunkInfo.fileName} (${(chunkInfo.totalSize / 1024 / 1024).toFixed(1)}MB)`);
    } catch (error) {
      writeStream.destroy();
      throw error;
    }
  }

  /**
   * Clean up expired uploads
   */
  private cleanupExpiredUploads(): void {
    const now = new Date();
    const expiredUploads: string[] = [];

    this.activeUploads.forEach((chunkInfo, uploadId) => {
      const age = now.getTime() - chunkInfo.createdAt.getTime();
      if (age > this.chunkTimeout) {
        expiredUploads.push(uploadId);
      }
    });

    for (const uploadId of expiredUploads) {
      this.cancelUpload(uploadId).catch(console.error);
    }

    if (expiredUploads.length > 0) {
      console.log(`🧹 Cleaned up ${expiredUploads.length} expired uploads`);
    }
  }

  /**
   * Get the file path for a completed upload
   */
  getFilePath(uploadId: string): string | null {
    const chunkInfo = this.activeUploads.get(uploadId);
    return chunkInfo ? chunkInfo.filePath : null;
  }

  /**
   * Check if upload exists and is complete
   */
  isUploadComplete(uploadId: string): boolean {
    const status = this.getUploadStatus(uploadId);
    return status.exists && status.isComplete === true;
  }
}

export const chunkedUploadService = new ChunkedUploadService();