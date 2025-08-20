// Google Cloud Storage Service for Production Document Storage
import { Storage } from '@google-cloud/storage';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

export class GCSStorageService {
  private storage: Storage | null = null;
  private bucketName: string;
  private isProduction: boolean;
  
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE;
    this.bucketName = process.env.GCS_BUCKET_NAME || 'aescuvest-documents';
    
    if (this.isProduction) {
      this.initializeGCS();
    }
  }
  
  private initializeGCS() {
    try {
      // In Cloud Run, this uses Application Default Credentials automatically
      this.storage = new Storage({
        projectId: process.env.GCP_PROJECT_ID
      });
      
      console.log(`✅ Google Cloud Storage initialized for bucket: ${this.bucketName}`);
    } catch (error) {
      console.error('❌ Failed to initialize Google Cloud Storage:', error);
    }
  }
  
  /**
   * Upload a file to GCS or local storage based on environment
   */
  async uploadFile(localPath: string, destination: string): Promise<string> {
    if (!this.isProduction) {
      // Development: Keep file locally
      console.log(`📁 Development mode: File stored locally at ${localPath}`);
      return localPath;
    }
    
    if (!this.storage) {
      throw new Error('Google Cloud Storage not initialized');
    }
    
    try {
      const bucket = this.storage.bucket(this.bucketName);
      
      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `${timestamp}-${path.basename(destination)}`;
      const gcsPath = `uploads/${fileName}`;
      
      // Upload file to GCS
      await bucket.upload(localPath, {
        destination: gcsPath,
        metadata: {
          contentType: this.getContentType(destination),
          cacheControl: 'private, max-age=0'
        }
      });
      
      // Delete local file after successful upload
      try {
        await fs.promises.unlink(localPath);
      } catch (err) {
        console.warn('Failed to delete local file:', err);
      }
      
      const publicUrl = `gs://${this.bucketName}/${gcsPath}`;
      console.log(`☁️ File uploaded to GCS: ${publicUrl}`);
      
      return publicUrl;
    } catch (error) {
      console.error('Failed to upload to GCS:', error);
      throw error;
    }
  }
  
  /**
   * Upload from buffer/stream directly
   */
  async uploadFromBuffer(buffer: Buffer, destination: string): Promise<string> {
    if (!this.isProduction) {
      // Development: Save buffer to local file
      const localPath = path.join(process.cwd(), 'uploads', destination);
      await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
      await fs.promises.writeFile(localPath, buffer);
      console.log(`📁 Development mode: Buffer saved locally at ${localPath}`);
      return localPath;
    }
    
    if (!this.storage) {
      throw new Error('Google Cloud Storage not initialized');
    }
    
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const timestamp = Date.now();
      const fileName = `${timestamp}-${path.basename(destination)}`;
      const gcsPath = `uploads/${fileName}`;
      
      const file = bucket.file(gcsPath);
      const stream = file.createWriteStream({
        metadata: {
          contentType: this.getContentType(destination),
          cacheControl: 'private, max-age=0'
        }
      });
      
      return new Promise((resolve, reject) => {
        stream.on('error', reject);
        stream.on('finish', () => {
          const publicUrl = `gs://${this.bucketName}/${gcsPath}`;
          console.log(`☁️ Buffer uploaded to GCS: ${publicUrl}`);
          resolve(publicUrl);
        });
        stream.end(buffer);
      });
    } catch (error) {
      console.error('Failed to upload buffer to GCS:', error);
      throw error;
    }
  }
  
  /**
   * Download a file from GCS or read from local storage
   */
  async downloadFile(filePath: string): Promise<Buffer> {
    if (!this.isProduction || !filePath.startsWith('gs://')) {
      // Development or local file: Read from filesystem
      try {
        const buffer = await fs.promises.readFile(filePath);
        console.log(`📁 Read local file: ${filePath}`);
        return buffer;
      } catch (error) {
        console.error('Failed to read local file:', error);
        throw error;
      }
    }
    
    if (!this.storage) {
      throw new Error('Google Cloud Storage not initialized');
    }
    
    try {
      // Parse GCS path: gs://bucket-name/path/to/file
      const matches = filePath.match(/^gs:\/\/([^\/]+)\/(.+)$/);
      if (!matches) {
        throw new Error('Invalid GCS path format');
      }
      
      const [, bucketName, gcsPath] = matches;
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(gcsPath);
      
      const [buffer] = await file.download();
      console.log(`☁️ Downloaded from GCS: ${filePath}`);
      return buffer;
    } catch (error) {
      console.error('Failed to download from GCS:', error);
      throw error;
    }
  }
  
  /**
   * Get a signed URL for temporary access
   */
  async getSignedUrl(filePath: string, expirationMinutes: number = 60): Promise<string> {
    if (!this.isProduction || !filePath.startsWith('gs://')) {
      // Development: Return local file path
      return filePath;
    }
    
    if (!this.storage) {
      throw new Error('Google Cloud Storage not initialized');
    }
    
    try {
      const matches = filePath.match(/^gs:\/\/([^\/]+)\/(.+)$/);
      if (!matches) {
        throw new Error('Invalid GCS path format');
      }
      
      const [, bucketName, gcsPath] = matches;
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(gcsPath);
      
      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expirationMinutes * 60 * 1000
      });
      
      console.log(`🔗 Generated signed URL for: ${filePath}`);
      return url;
    } catch (error) {
      console.error('Failed to generate signed URL:', error);
      throw error;
    }
  }
  
  /**
   * Delete a file from GCS or local storage
   */
  async deleteFile(filePath: string): Promise<void> {
    if (!this.isProduction || !filePath.startsWith('gs://')) {
      // Development: Delete local file
      try {
        await fs.promises.unlink(filePath);
        console.log(`🗑️ Deleted local file: ${filePath}`);
      } catch (error) {
        console.warn('Failed to delete local file:', error);
      }
      return;
    }
    
    if (!this.storage) {
      throw new Error('Google Cloud Storage not initialized');
    }
    
    try {
      const matches = filePath.match(/^gs:\/\/([^\/]+)\/(.+)$/);
      if (!matches) {
        throw new Error('Invalid GCS path format');
      }
      
      const [, bucketName, gcsPath] = matches;
      const bucket = this.storage.bucket(bucketName);
      await bucket.file(gcsPath).delete();
      
      console.log(`🗑️ Deleted from GCS: ${filePath}`);
    } catch (error) {
      console.error('Failed to delete from GCS:', error);
      throw error;
    }
  }
  
  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    if (!this.isProduction || !filePath.startsWith('gs://')) {
      // Development: Check local file
      try {
        await fs.promises.access(filePath);
        return true;
      } catch {
        return false;
      }
    }
    
    if (!this.storage) {
      return false;
    }
    
    try {
      const matches = filePath.match(/^gs:\/\/([^\/]+)\/(.+)$/);
      if (!matches) {
        return false;
      }
      
      const [, bucketName, gcsPath] = matches;
      const bucket = this.storage.bucket(bucketName);
      const [exists] = await bucket.file(gcsPath).exists();
      
      return exists;
    } catch {
      return false;
    }
  }
  
  /**
   * Get appropriate content type for file
   */
  private getContentType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.zip': 'application/zip',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.json': 'application/json'
    };
    
    return contentTypes[ext] || 'application/octet-stream';
  }
}

// Export singleton instance
export const gcsStorage = new GCSStorageService();