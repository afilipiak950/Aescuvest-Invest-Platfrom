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
  private readonly chunkTimeout = 60 * 60 * 1000; // 1 hour for large files (900MB+)
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

    // Enhanced logging for large files
    const sizeMB = (totalSize / 1024 / 1024).toFixed(1);
    if (totalSize > 500 * 1024 * 1024) { // 500MB+
      console.log(`📁 LARGE FILE: Initialized chunked upload: ${fileName} (${sizeMB}MB, ${totalChunks} chunks of ${(chunkSize / 1024 / 1024).toFixed(1)}MB each)`);
      console.log(`⏱️ Estimated upload time: ${Math.ceil(totalChunks * 2 / 60)} minutes (2 seconds per chunk)`);
    } else {
      console.log(`📁 Initialized chunked upload: ${fileName} (${sizeMB}MB, ${totalChunks} chunks)`);
    }

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

      // Enhanced progress logging for large files
      if (chunkInfo.totalSize > 500 * 1024 * 1024) { // 500MB+
        if (chunkIndex % 10 === 0 || isComplete) { // Every 10th chunk for large files
          console.log(`📦 LARGE FILE Progress: Chunk ${chunkIndex + 1}/${chunkInfo.totalChunks} uploaded for ${chunkInfo.fileName} (${progress.toFixed(1)}%)`);
        }
      } else {
        console.log(`📦 Chunk ${chunkIndex + 1}/${chunkInfo.totalChunks} uploaded for ${chunkInfo.fileName} (${progress.toFixed(1)}%)`);
      }

      if (isComplete) {
        // Assemble final file
        console.log(`🔧 Starting assembly for ${chunkInfo.fileName} (${(chunkInfo.totalSize / 1024 / 1024).toFixed(1)}MB)`);
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
    let bytesWritten = 0;
    
    try {
      console.log(`🔧 Starting file assembly: ${chunkInfo.fileName} (${chunkInfo.totalChunks} chunks)`);
      
      for (let i = 0; i < chunkInfo.totalChunks; i++) {
        const chunkPath = `${chunkInfo.filePath}.chunk.${i}`;
        
        if (!fs.existsSync(chunkPath)) {
          throw new Error(`❌ CRITICAL: Missing chunk ${i} at ${chunkPath}`);
        }

        const chunkData = await fs.promises.readFile(chunkPath);
        writeStream.write(chunkData);
        bytesWritten += chunkData.length;
        
        console.log(`📦 Assembled chunk ${i + 1}/${chunkInfo.totalChunks} (${(bytesWritten / 1024 / 1024).toFixed(1)}MB)`);

        // Clean up chunk file
        await fs.promises.unlink(chunkPath);
      }

      writeStream.end();
      
      // Wait for stream to finish
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      // Verify final file size matches expected
      const stats = fs.statSync(chunkInfo.filePath);
      if (stats.size !== chunkInfo.totalSize) {
        throw new Error(`❌ CRITICAL: File size mismatch! Expected: ${chunkInfo.totalSize}, Got: ${stats.size}`);
      }

      console.log(`✅ File assembly complete: ${chunkInfo.fileName} (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
    } catch (error) {
      writeStream.destroy();
      console.error(`❌ Error assembling file:`, error);
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
    console.log(`🔍 MICROSTEP: Getting file path for upload ${uploadId}`);
    
    // First check if file exists from completed upload
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    try {
      if (!fs.existsSync(uploadsDir)) {
        console.log(`⚠️ Uploads directory does not exist: ${uploadsDir}`);
        return null;
      }
      
      const allFiles = fs.readdirSync(uploadsDir);
      console.log(`📁 Found ${allFiles.length} files in uploads directory`);
      
      const possibleFiles = allFiles.filter(f => f.startsWith(uploadId));
      console.log(`🎯 Found ${possibleFiles.length} files matching uploadId: ${uploadId}`);
      
      if (possibleFiles.length > 0) {
        const filePath = path.join(uploadsDir, possibleFiles[0]);
        console.log(`✅ MICROSTEP: Found completed upload file: ${filePath}`);
        console.log(`📊 File size: ${fs.statSync(filePath).size} bytes`);
        return filePath;
      }
    } catch (error) {
      console.error(`❌ MICROSTEP: Error reading uploads directory:`, error);
    }
    
    // Fallback to active uploads
    const chunkInfo = this.activeUploads.get(uploadId);
    if (chunkInfo) {
      console.log(`📋 MICROSTEP: Found active upload - ${chunkInfo.uploadedChunks.size}/${chunkInfo.totalChunks} chunks`);
      console.log(`🎯 MICROSTEP: Active upload file path: ${chunkInfo.filePath}`);
      return chunkInfo.filePath;
    } else {
      console.log(`❌ MICROSTEP: No active upload found for ${uploadId}`);
      return null;
    }
  }

  /**
   * Check if upload exists and is complete
   */
  isUploadComplete(uploadId: string): boolean {
    // Check if final file exists (upload was completed and removed from active uploads)
    const uploadsDir = path.join(process.cwd(), 'uploads');
    try {
      const possibleFiles = fs.readdirSync(uploadsDir).filter(f => f.startsWith(uploadId));
      
      if (possibleFiles.length > 0) {
        console.log(`✅ Upload ${uploadId} is complete (file exists)`);
        return true;
      }
    } catch (error) {
      console.error('Error checking uploads directory:', error);
    }
    
    // Check active uploads
    const chunkInfo = this.activeUploads.get(uploadId);
    const isComplete = chunkInfo ? chunkInfo.uploadedChunks.size === chunkInfo.totalChunks : false;
    
    console.log(`🔍 Upload ${uploadId} completion check: ${isComplete} (${chunkInfo?.uploadedChunks.size}/${chunkInfo?.totalChunks})`);
    return isComplete;
  }
}

export const chunkedUploadService = new ChunkedUploadService();