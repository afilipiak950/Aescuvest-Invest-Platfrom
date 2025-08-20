import { Storage } from '@google-cloud/storage';
import { Readable } from 'stream';
import path from 'path';
import fs from 'fs';

/**
 * Google Cloud Storage Service
 * Handles all file storage operations in GCS
 */
class GoogleCloudStorageService {
  private storage: Storage;
  private bucketName: string;
  private bucket: any;

  constructor() {
    // Initialize GCS client with base64 encoded credentials
    let storageConfig: any = {};
    
    // Check for base64 encoded credentials
    if (process.env.GOOGLE_CLOUD_STORAGE_KEY) {
      try {
        // Decode base64 credentials
        const keyJson = Buffer.from(process.env.GOOGLE_CLOUD_STORAGE_KEY, 'base64').toString('utf-8');
        const credentials = JSON.parse(keyJson);
        
        storageConfig = {
          projectId: credentials.project_id,
          credentials: credentials
        };
        
        console.log(`🔐 GCS initialized with credentials for project: ${credentials.project_id}`);
      } catch (error) {
        console.error('❌ Failed to parse GCS credentials:', error);
        throw new Error('Invalid Google Cloud Storage credentials');
      }
    } else {
      console.log('⚠️ No GCS credentials found, using default');
      storageConfig = {
        projectId: process.env.GCP_PROJECT_ID,
        keyFilename: process.env.GCS_KEY_FILE || undefined,
      };
    }
    
    this.storage = new Storage(storageConfig);
    this.bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || process.env.GCS_BUCKET_NAME || 'aescuvest-documents';
    this.bucket = this.storage.bucket(this.bucketName);
    
    console.log(`📁 GCS initialized with bucket: ${this.bucketName}`);
  }

  /**
   * Upload a file to GCS
   */
  async uploadFile(
    localPath: string,
    dealId: number,
    fileName: string
  ): Promise<string> {
    try {
      // Create GCS path: deals/{dealId}/documents/{timestamp}_{fileName}
      const timestamp = Date.now();
      const gcsFileName = `deals/${dealId}/documents/${timestamp}_${fileName}`;
      
      console.log(`📤 Uploading to GCS: ${gcsFileName}`);
      
      // Upload file to GCS
      await this.bucket.upload(localPath, {
        destination: gcsFileName,
        metadata: {
          metadata: {
            dealId: dealId.toString(),
            originalName: fileName,
            uploadedAt: new Date().toISOString()
          }
        }
      });
      
      // Generate GCS path reference
      const gcsPath = `gs://${this.bucketName}/${gcsFileName}`;
      console.log(`✅ Uploaded to GCS: ${gcsPath}`);
      
      // Delete local file after successful upload
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
        console.log(`🗑️ Cleaned up local file: ${localPath}`);
      }
      
      return gcsPath;
    } catch (error) {
      console.error('❌ GCS upload failed:', error);
      throw new Error(`Failed to upload to GCS: ${error.message}`);
    }
  }

  /**
   * Download a file from GCS to local path
   */
  async downloadFile(gcsPath: string, localPath: string): Promise<void> {
    try {
      // Extract file name from GCS path
      const fileName = this.extractFileName(gcsPath);
      
      console.log(`📥 Downloading from GCS: ${fileName} to ${localPath}`);
      
      // Download file
      await this.bucket.file(fileName).download({
        destination: localPath
      });
      
      console.log(`✅ Downloaded from GCS: ${localPath}`);
    } catch (error) {
      console.error('❌ GCS download failed:', error);
      throw new Error(`Failed to download from GCS: ${error.message}`);
    }
  }

  /**
   * Stream a file from GCS
   */
  async streamFile(gcsPath: string): Promise<Readable> {
    try {
      const fileName = this.extractFileName(gcsPath);
      console.log(`📊 Streaming from GCS: ${fileName}`);
      
      const stream = this.bucket.file(fileName).createReadStream();
      return stream;
    } catch (error) {
      console.error('❌ GCS stream failed:', error);
      throw new Error(`Failed to stream from GCS: ${error.message}`);
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(gcsPath: string): Promise<any> {
    try {
      const fileName = this.extractFileName(gcsPath);
      const [metadata] = await this.bucket.file(fileName).getMetadata();
      return metadata;
    } catch (error) {
      console.error('❌ Failed to get GCS metadata:', error);
      return null;
    }
  }

  /**
   * Delete a file from GCS
   */
  async deleteFile(gcsPath: string): Promise<void> {
    try {
      const fileName = this.extractFileName(gcsPath);
      console.log(`🗑️ Deleting from GCS: ${fileName}`);
      
      await this.bucket.file(fileName).delete();
      console.log(`✅ Deleted from GCS: ${fileName}`);
    } catch (error) {
      console.error('❌ GCS deletion failed:', error);
      // Don't throw - file might already be deleted
    }
  }

  /**
   * Check if a file exists in GCS
   */
  async fileExists(gcsPath: string): Promise<boolean> {
    try {
      const fileName = this.extractFileName(gcsPath);
      const [exists] = await this.bucket.file(fileName).exists();
      return exists;
    } catch (error) {
      console.error('❌ GCS existence check failed:', error);
      return false;
    }
  }

  /**
   * Generate a signed URL for direct upload (bypasses Cloud Run)
   */
  async generateUploadUrl(
    dealId: number,
    fileName: string,
    contentType: string = 'application/octet-stream'
  ): Promise<{ uploadUrl: string; gcsPath: string }> {
    try {
      const timestamp = Date.now();
      const gcsFileName = `deals/${dealId}/documents/${timestamp}_${fileName}`;
      
      console.log(`🔐 Generating signed upload URL for: ${gcsFileName}`);
      
      // Generate a signed URL for direct upload with CORS support
      const [url] = await this.bucket.file(gcsFileName).getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        contentType,
        // Add extension headers for CORS
        extensionHeaders: {
          'x-goog-content-type': contentType,
        },
        // Use resumable upload for better CORS support
        virtualHostedStyle: false,
        cname: undefined,
      });
      
      const gcsPath = `gs://${this.bucketName}/${gcsFileName}`;
      
      console.log(`✅ Generated upload URL for: ${gcsPath}`);
      console.log(`📝 Content-Type: ${contentType}`);
      
      return {
        uploadUrl: url,
        gcsPath
      };
    } catch (error) {
      console.error('❌ Failed to generate upload URL:', error);
      throw new Error(`Failed to generate upload URL: ${error.message}`);
    }
  }

  /**
   * Generate a signed URL for download
   */
  async generateDownloadUrl(gcsPath: string): Promise<string> {
    try {
      const fileName = this.extractFileName(gcsPath);
      
      const [url] = await this.bucket.file(fileName).getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000, // 1 hour
      });
      
      return url;
    } catch (error) {
      console.error('❌ Failed to generate download URL:', error);
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }
  }

  /**
   * Extract file name from GCS path
   */
  private extractFileName(gcsPath: string): string {
    // Remove gs://bucket-name/ prefix
    if (gcsPath.startsWith('gs://')) {
      const withoutProtocol = gcsPath.replace('gs://', '');
      const parts = withoutProtocol.split('/');
      parts.shift(); // Remove bucket name
      return parts.join('/');
    }
    return gcsPath;
  }

  /**
   * Check if path is a GCS path
   */
  isGcsPath(path: string): boolean {
    return path.startsWith('gs://');
  }

  /**
   * Get or download file locally for processing
   */
  async ensureLocalFile(filePath: string, dealId: number): Promise<string> {
    // If it's a GCS path, download it
    if (this.isGcsPath(filePath)) {
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const localPath = path.join(tempDir, `temp_${Date.now()}_${path.basename(filePath)}`);
      await this.downloadFile(filePath, localPath);
      return localPath;
    }
    
    // Already a local path
    return filePath;
  }

  /**
   * Initialize bucket (create if doesn't exist)
   */
  async initializeBucket(): Promise<void> {
    try {
      const [exists] = await this.bucket.exists();
      
      if (!exists) {
        console.log(`🚀 Creating GCS bucket: ${this.bucketName}`);
        await this.storage.createBucket(this.bucketName, {
          location: 'US-CENTRAL1',
          storageClass: 'STANDARD',
        });
        console.log(`✅ Created GCS bucket: ${this.bucketName}`);
      } else {
        console.log(`✅ GCS bucket exists: ${this.bucketName}`);
      }
    } catch (error) {
      console.error('❌ Failed to initialize bucket:', error);
      // Don't throw - bucket might already exist
    }
  }
}

// Export singleton instance
export const gcsService = new GoogleCloudStorageService();