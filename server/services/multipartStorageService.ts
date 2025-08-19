import { Storage, File } from "@google-cloud/storage";
import { randomUUID } from "crypto";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

interface MultipartUploadSession {
  uploadId: string;
  bucketName: string;
  objectName: string;
  partUrls: string[];
  totalParts: number;
  createdAt: Date;
}

class MultipartStorageService {
  private activeSessions = new Map<string, MultipartUploadSession>();

  /**
   * Initialize multipart upload - returns presigned URLs for each part
   */
  async initializeMultipartUpload({
    fileName,
    fileSize,
    dealId,
    chunkSize = 50 * 1024 * 1024, // 50MB default
  }: {
    fileName: string;
    fileSize: number;
    dealId: number;
    chunkSize?: number;
  }): Promise<{
    uploadId: string;
    partUrls: string[];
    totalParts: number;
    bucketName: string;
    objectName: string;
  }> {
    console.log(`🚀 Initializing multipart upload: ${fileName} (${(fileSize / 1024 / 1024).toFixed(1)}MB)`);
    
    const uploadId = randomUUID();
    const totalParts = Math.ceil(fileSize / chunkSize);
    
    // Get private object directory from environment
    const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
    if (!privateObjectDir) {
      throw new Error("PRIVATE_OBJECT_DIR not configured");
    }
    
    // Create object path in private directory
    const objectName = `${privateObjectDir}/deals/${dealId}/uploads/${uploadId}/${fileName}`;
    const bucketName = this.extractBucketName(privateObjectDir);
    
    console.log(`📁 Object path: ${bucketName}/${objectName}`);
    console.log(`📊 Total parts: ${totalParts} (${(chunkSize / 1024 / 1024).toFixed(0)}MB each)`);
    
    // Generate presigned URLs for each part
    const partUrls = await Promise.all(
      Array.from({ length: totalParts }, (_, index) =>
        this.generatePresignedPartUrl(bucketName, objectName, index + 1, uploadId)
      )
    );
    
    // Store session
    const session: MultipartUploadSession = {
      uploadId,
      bucketName,
      objectName,
      partUrls,
      totalParts,
      createdAt: new Date(),
    };
    
    this.activeSessions.set(uploadId, session);
    
    console.log(`✅ Multipart upload initialized: ${uploadId}`);
    
    return {
      uploadId,
      partUrls,
      totalParts,
      bucketName,
      objectName,
    };
  }

  /**
   * Complete multipart upload - combines all parts into final object
   */
  async completeMultipartUpload(
    uploadId: string,
    partETags: string[]
  ): Promise<{
    objectKey: string;
    etag: string;
    size: number;
  }> {
    const session = this.activeSessions.get(uploadId);
    if (!session) {
      throw new Error(`Upload session not found: ${uploadId}`);
    }

    console.log(`🔄 Completing multipart upload: ${uploadId}`);
    
    try {
      // Use Google Cloud Storage compose operation to combine parts
      const bucket = objectStorageClient.bucket(session.bucketName);
      const finalObject = bucket.file(session.objectName);
      
      // Create part file references
      const partFiles = partETags.map((etag, index) =>
        bucket.file(`${session.objectName}.part.${index + 1}`)
      );
      
      // Compose parts into final object
      await finalObject.compose(partFiles);
      
      // Get final object metadata
      const [metadata] = await finalObject.getMetadata();
      
      // Clean up part files
      await Promise.all(partFiles.map(partFile => 
        partFile.delete().catch(err => 
          console.warn(`Failed to delete part file: ${err.message}`)
        )
      ));
      
      // Clean up session
      this.activeSessions.delete(uploadId);
      
      console.log(`✅ Multipart upload completed: ${session.objectName}`);
      
      return {
        objectKey: session.objectName,
        etag: metadata.etag || '',
        size: parseInt(metadata.size || '0'),
      };
      
    } catch (error) {
      console.error(`❌ Failed to complete multipart upload: ${error}`);
      throw error;
    }
  }

  /**
   * Abort multipart upload and clean up
   */
  async abortMultipartUpload(uploadId: string): Promise<void> {
    const session = this.activeSessions.get(uploadId);
    if (!session) {
      return; // Already cleaned up
    }

    console.log(`🗑️ Aborting multipart upload: ${uploadId}`);
    
    try {
      // Clean up any uploaded parts
      const bucket = objectStorageClient.bucket(session.bucketName);
      const partFiles = Array.from({ length: session.totalParts }, (_, index) =>
        bucket.file(`${session.objectName}.part.${index + 1}`)
      );
      
      await Promise.all(partFiles.map(partFile => 
        partFile.delete().catch(() => {}) // Ignore errors for non-existent parts
      ));
      
    } catch (error) {
      console.warn(`Warning during multipart abort: ${error}`);
    } finally {
      this.activeSessions.delete(uploadId);
    }
  }

  /**
   * Get upload session status
   */
  getUploadSession(uploadId: string): MultipartUploadSession | undefined {
    return this.activeSessions.get(uploadId);
  }

  /**
   * List active upload sessions
   */
  getActiveSessions(): MultipartUploadSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Generate presigned URL for a specific part
   */
  private async generatePresignedPartUrl(
    bucketName: string,
    objectName: string,
    partNumber: number,
    uploadId: string
  ): Promise<string> {
    const partObjectName = `${objectName}.part.${partNumber}`;
    
    const request = {
      bucket_name: bucketName,
      object_name: partObjectName,
      method: 'PUT' as const,
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
    };

    const response = await fetch(
      `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to generate presigned URL for part ${partNumber}`);
    }

    const { signed_url } = await response.json();
    return signed_url;
  }

  /**
   * Extract bucket name from object storage path
   */
  private extractBucketName(path: string): string {
    // Path format: /<bucket_name>/...
    const parts = path.split('/');
    if (parts.length < 2) {
      throw new Error(`Invalid object storage path: ${path}`);
    }
    return parts[1];
  }

  /**
   * Cleanup old sessions (called periodically)
   */
  cleanupOldSessions(maxAgeHours: number = 24): void {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    
    for (const [uploadId, session] of this.activeSessions.entries()) {
      if (session.createdAt < cutoff) {
        console.log(`🧹 Cleaning up old session: ${uploadId}`);
        this.abortMultipartUpload(uploadId).catch(err =>
          console.warn(`Failed to cleanup session ${uploadId}: ${err.message}`)
        );
      }
    }
  }
}

export const multipartStorageService = new MultipartStorageService();

// Cleanup old sessions every hour
setInterval(() => {
  multipartStorageService.cleanupOldSessions();
}, 60 * 60 * 1000);