// 🚀 GOOGLE CLOUD STORAGE DIRECT UPLOAD - BYPASS ALL SERVER LIMITS
import { Router, Request, Response } from 'express';
import { Storage } from '@google-cloud/storage';
import crypto from 'crypto';
import { db } from '../db';
import { documents as documentsTable } from '../../shared/schema';
import { zipProcessor } from '../services/zipProcessor';
import path from 'path';

const router = Router();

// Initialize Google Cloud Storage
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

// Create bucket name from environment or use default
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'aescuvest-data-room-uploads';

// Ensure bucket exists
let bucket: any;

async function initializeBucket() {
  try {
    bucket = storage.bucket(BUCKET_NAME);
    const [exists] = await bucket.exists();
    
    if (!exists) {
      console.log(`📦 Creating GCS bucket: ${BUCKET_NAME}`);
      await storage.createBucket(BUCKET_NAME, {
        location: 'US-CENTRAL1',
        storageClass: 'STANDARD',
        cors: [{
          origin: ['*'],
          method: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          responseHeader: ['*'],
          maxAgeSeconds: 3600
        }]
      });
      console.log(`✅ GCS bucket created: ${BUCKET_NAME}`);
    } else {
      console.log(`✅ GCS bucket exists: ${BUCKET_NAME}`);
      
      // Update CORS settings
      await bucket.setCorsConfiguration([{
        origin: ['*'],
        method: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        responseHeader: ['*'],
        maxAgeSeconds: 3600
      }]);
    }
  } catch (error) {
    console.error('❌ Failed to initialize GCS bucket:', error);
    // Continue without GCS if not configured
    console.warn('⚠️ Google Cloud Storage not configured. Using fallback upload method.');
  }
}

// Initialize bucket on startup
initializeBucket();

// Generate a signed URL for direct upload to GCS
router.post('/api/deals/:dealId/gcs-upload/generate-url', async (req: Request, res: Response) => {
  console.log('🔑 Generating GCS signed URL for direct upload...');
  
  try {
    const dealId = parseInt(req.params.dealId);
    const { fileName, fileType, fileSize } = req.body;
    
    if (!bucket) {
      throw new Error('Google Cloud Storage not configured');
    }
    
    // Generate unique file name
    const timestamp = Date.now();
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const objectName = `deals/${dealId}/${timestamp}-${uniqueId}-${sanitizedFileName}`;
    
    console.log(`📄 Generating signed URL for: ${objectName}`);
    console.log(`📊 File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
    
    // Generate signed URL for upload (valid for 2 hours)
    const options = {
      version: 'v4' as const,
      action: 'write' as const,
      expires: Date.now() + 2 * 60 * 60 * 1000, // 2 hours
      contentType: fileType || 'application/octet-stream',
      extensionHeaders: {
        'x-goog-content-length-range': `0,${54975581388}` // Up to 51GB
      }
    };
    
    const [signedUrl] = await bucket.file(objectName).getSignedUrl(options);
    
    console.log(`✅ Signed URL generated for ${objectName}`);
    
    // Return the signed URL and metadata
    res.json({
      success: true,
      uploadUrl: signedUrl,
      objectName,
      bucketName: BUCKET_NAME,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    });
    
  } catch (error: any) {
    console.error('❌ Failed to generate signed URL:', error);
    res.status(500).json({ 
      error: 'Failed to generate upload URL',
      details: error.message 
    });
  }
});

// Confirm upload completion and create document record
router.post('/api/deals/:dealId/gcs-upload/confirm', async (req: Request, res: Response) => {
  console.log('✅ Confirming GCS upload completion...');
  
  try {
    const dealId = parseInt(req.params.dealId);
    const { objectName, fileName, fileSize } = req.body;
    
    if (!bucket) {
      throw new Error('Google Cloud Storage not configured');
    }
    
    // Verify file exists in GCS
    const file = bucket.file(objectName);
    const [exists] = await file.exists();
    
    if (!exists) {
      throw new Error('File not found in storage');
    }
    
    // Get actual file metadata
    const [metadata] = await file.getMetadata();
    const actualSize = parseInt(metadata.size || '0');
    
    console.log(`📦 File confirmed in GCS: ${objectName}`);
    console.log(`📊 Size: ${(actualSize / 1024 / 1024).toFixed(2)} MB`);
    
    // Create document record
    const documentResult = await db.insert(documentsTable).values({
      dealId,
      name: fileName,
      content: `gs://${BUCKET_NAME}/${objectName}`, // Store GCS path
      uploadStatus: 'processing' as const,
      processingStatus: 'pending' as const,
      type: 'dataroom' as const,
      uploadDate: new Date(),
      fileSize: actualSize
    }).returning();
    
    const document = Array.isArray(documentResult) ? documentResult[0] : documentResult;
    console.log(`📄 Document created with ID: ${document.id}`);
    
    // Process ZIP in background if needed
    if (fileName.toLowerCase().endsWith('.zip')) {
      console.log('🗂️ Starting ZIP processing from GCS...');
      
      // Download file from GCS for processing
      const tempPath = path.join(process.cwd(), 'uploads', 'temp', `${Date.now()}-${fileName}`);
      await file.download({ destination: tempPath });
      
      // Process the ZIP file
      if (typeof zipProcessor.processZipFile === 'function') {
        zipProcessor.processZipFile(dealId, tempPath, 'dataroom', document.id).catch((err: Error) => {
          console.error('❌ ZIP processing failed:', err);
        });
      } else {
        console.warn('⚠️ ZIP processor not available');
      }
    }
    
    res.json({
      success: true,
      message: 'Upload confirmed',
      documentId: document.id,
      fileSize: actualSize
    });
    
  } catch (error: any) {
    console.error('❌ Failed to confirm upload:', error);
    res.status(500).json({ 
      error: 'Failed to confirm upload',
      details: error.message 
    });
  }
});

// Get upload status
router.get('/api/deals/:dealId/gcs-upload/status/:objectName', async (req: Request, res: Response) => {
  try {
    const { objectName } = req.params;
    
    if (!bucket) {
      throw new Error('Google Cloud Storage not configured');
    }
    
    const file = bucket.file(objectName);
    const [exists] = await file.exists();
    
    if (exists) {
      const [metadata] = await file.getMetadata();
      res.json({
        success: true,
        exists: true,
        size: parseInt(metadata.size || '0'),
        contentType: metadata.contentType,
        created: metadata.timeCreated
      });
    } else {
      res.json({
        success: true,
        exists: false
      });
    }
  } catch (error: any) {
    console.error('❌ Failed to check upload status:', error);
    res.status(500).json({ 
      error: 'Failed to check status',
      details: error.message 
    });
  }
});

export default router;