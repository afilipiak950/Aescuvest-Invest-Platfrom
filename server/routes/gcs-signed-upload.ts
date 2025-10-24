import { Router, Request, Response } from 'express';
import { db } from '../db';
import { documents } from '@shared/schema';
import { gcsService } from '../services/googleCloudStorage';
import { zipProcessor } from '../services/zipProcessor';
import { jobProcessor } from '../services/jobProcessor';

const router = Router();

/**
 * MICRO-STEP 1: Generate signed URL for direct GCS upload
 * This completely bypasses the server for file upload
 */
router.post('/api/gcs/signed-url/:dealId', async (req: Request, res: Response) => {
  console.log('🔐 MICRO-STEP 1: Generating signed URL for direct upload');
  
  try {
    const { dealId } = req.params;
    const { fileName, fileSize } = req.body;
    
    console.log(`📋 Request details:
      - Deal ID: ${dealId}
      - File: ${fileName}
      - Size: ${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

    // Validate request
    if (!fileName || !fileSize) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'fileName and fileSize are required'
      });
    }

    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const gcsFileName = `uploads/deal-${dealId}/${timestamp}-${sanitizedFileName}`;
    
    console.log(`📁 GCS file path: ${gcsFileName}`);

    // Generate signed URL for direct upload
    const options = {
      version: 'v4' as const,
      action: 'write' as const,
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
      contentType: 'application/zip',
      extensionHeaders: {
        'x-goog-content-length-range': `0,${5 * 1024 * 1024 * 1024}` // Up to 5GB
      }
    };

    console.log('🔑 Requesting signed URL from GCS service...');
    
    // Use the new generateSignedUploadUrl method
    const { 
      signedUrl, 
      gcsFileName: generatedFileName, 
      uploadId 
    } = await gcsService.generateSignedUploadUrl(fileName, fileSize, parseInt(dealId));

    console.log('✅ Signed URL generated successfully');
    console.log(`📍 URL length: ${signedUrl.length} characters`);

    // Return signed URL and metadata
    const response = {
      success: true,
      signedUrl,
      gcsFileName: generatedFileName,
      uploadId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      instructions: {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/zip',
          'Content-Length': fileSize.toString()
        }
      }
    };

    console.log('📤 Sending signed URL response (URL truncated for security)');
    return res.status(200).json(response);

  } catch (error: any) {
    console.error('❌ MICRO-STEP 1 FAILED:', error);
    console.error('Stack:', error.stack);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate signed URL',
      error: error.message
    });
  }
});

/**
 * MICRO-STEP 2: Handle upload completion notification
 * Called after client successfully uploads to GCS
 */
router.post('/api/gcs/upload-complete/:dealId', async (req: Request, res: Response) => {
  console.log('🎯 MICRO-STEP 2: Processing completed GCS upload');
  
  try {
    const { dealId } = req.params;
    const { gcsFileName, uploadId, fileName } = req.body;
    
    console.log(`📋 Upload completion details:
      - Deal ID: ${dealId}
      - GCS File: ${gcsFileName}
      - Upload ID: ${uploadId}
      - Original Name: ${fileName}`);

    // 🎯 CRITICAL: Create persistent upload session immediately
    console.log(`🎯 Creating persistent upload session for: ${fileName}`);
    const { persistentUploadService } = await import('../services/persistentUploadService');
    
    const sessionId = persistentUploadService.generateSessionId();
    
    // Initialize GCS and get file size with error handling
    try {
      await gcsService.initializeIfNeeded();
    } catch (initError: any) {
      console.error('❌ GCS initialization failed:', initError);
      return res.status(500).json({
        success: false,
        message: 'Google Cloud Storage unavailable',
        error: 'Storage service initialization failed'
      });
    }
    
    const file = (gcsService as any).bucket.file(gcsFileName);
    let exists = false;
    try {
      [exists] = await file.exists();
    } catch (existsError: any) {
      console.error('❌ Failed to check file existence:', existsError);
      return res.status(500).json({
        success: false,
        message: 'Unable to verify uploaded file',
        error: existsError.message
      });
    }
    
    let fileSize = 0;
    if (exists) {
      const [metadata] = await file.getMetadata();
      fileSize = parseInt(metadata.size || '0');
    }
    
    const sessionData = {
      sessionId,
      dealId: parseInt(dealId),
      fileName,
      fileSize,
      uploadType: 'gcs_direct' as const,
      status: 'completed' as const,
      progress: 100,
      uploadedBytes: fileSize,
      gcsPath: gcsFileName,
      currentStep: 'Upload completed, starting processing...'
    };
    
    await persistentUploadService.createSession(sessionData);
    console.log(`✅ Created persistent upload session: ${sessionId}`);
    
    if (!exists) {
      console.error('❌ File not found in GCS:', gcsFileName);
      return res.status(404).json({
        success: false,
        message: 'Uploaded file not found in GCS'
      });
    }

    console.log('✅ File verified in GCS');

    // Get file metadata
    const [metadata] = await file.getMetadata();
    console.log(`📊 File metadata:
      - Size: ${metadata.size} bytes
      - Content Type: ${metadata.contentType}
      - Created: ${metadata.timeCreated}`);

    // Create database entry for the uploaded file
    console.log('💾 Creating database entry...');
    const insertResult = await db.insert(documents).values({
      dealId: parseInt(dealId),
      name: fileName,
      type: metadata.contentType || 'application/zip', // Fix: Add required type field
      path: gcsFileName, // Fix: Add required path field pointing to GCS location
      size: parseInt(metadata.size),
      uploadedAt: new Date(),
      metadata: {
        originalName: fileName,
        gcsPath: gcsFileName,
        uploadId,
        size: parseInt(metadata.size),
        processedAt: new Date().toISOString()
      }
    }).returning();
    
    const document = Array.isArray(insertResult) ? insertResult[0] : insertResult;

    console.log(`✅ Document created with ID: ${document.id}`);

    // Process ZIP file if it's a ZIP
    if (fileName.toLowerCase().endsWith('.zip')) {
      console.log('📦 Processing ZIP file from GCS...');
      
      // Download file from GCS to process with timeout
      const tempFilePath = `/tmp/${uploadId}-${fileName}`;
      console.log(`📥 Downloading to temp: ${tempFilePath}`);
      
      // Add timeout for production reliability
      await Promise.race([
        file.download({ destination: tempFilePath }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Download timeout')), 60000) // 1 minute timeout
        )
      ]);
      console.log('✅ File downloaded from GCS');

      // Process the ZIP file
      const processedDocs = await zipProcessor.processZipFromGCS(
        tempFilePath,
        parseInt(dealId),
        document.id,
        gcsFileName
      );

      console.log(`✅ ZIP processed: ${processedDocs.length} documents extracted with automatic OCR and AI processing`);

      // Clean up temp file
      const fs = await import('fs');
      await fs.promises.unlink(tempFilePath);
      console.log('🧹 Temp file cleaned up');

      // Note: OCR and AI processing jobs are now automatically created by processZipFromGCS()
      // No need for additional job creation here - the method handles everything

      // CRITICAL: Clear cache after ZIP processing so documents appear instantly
      // Access the global document cache directly (set in routes.ts)
      const documentCache = (global as any).documentCache;
      if (documentCache) {
        const keysToDelete: string[] = [];
        for (const key of documentCache.keys()) {
          if (key.startsWith(`${dealId}-`)) {
            keysToDelete.push(key);
          }
        }
        keysToDelete.forEach((key: string) => documentCache.delete(key));
        console.log(`🧹 Cleared document cache for deal ${dealId} after GCS ZIP processing - removed ${keysToDelete.length} cache entries`);
      } else {
        console.log(`⚠️ Could not clear document cache - cache not accessible`);
      }
      
      // Also clear storage cache
      const { storage } = await import('../storage');
      await storage.invalidateDocumentCache(parseInt(dealId));
      console.log(`🧹 Cleared storage cache for deal ${dealId} after GCS ZIP processing`);

      return res.status(200).json({
        success: true,
        message: 'ZIP file processed successfully',
        documentId: document.id,
        documentsCreated: processedDocs.length,
        gcsPath: gcsFileName
      });
    }

    // For non-ZIP files
    return res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      documentId: document.id,
      gcsPath: gcsFileName
    });

  } catch (error: any) {
    console.error('❌ MICRO-STEP 2 FAILED:', error);
    console.error('Stack:', error.stack);
    return res.status(500).json({
      success: false,
      message: 'Failed to process uploaded file',
      error: error.message
    });
  }
});

/**
 * MICRO-STEP 3: Configure CORS for GCS bucket
 * This endpoint helps set up CORS configuration
 */
router.post('/api/gcs/configure-cors', async (req: Request, res: Response) => {
  console.log('🔧 MICRO-STEP 3: Configuring GCS bucket CORS');
  
  try {
    const corsConfiguration = [
      {
        origin: ['*'],
        method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
        responseHeader: ['*'],
        maxAgeSeconds: 3600
      }
    ];

    console.log('📋 CORS configuration:', JSON.stringify(corsConfiguration, null, 2));

    // Set CORS on the bucket
    await (gcsService as any).bucket.setCorsConfiguration(corsConfiguration);
    
    console.log('✅ CORS configuration applied successfully');

    return res.status(200).json({
      success: true,
      message: 'CORS configuration applied to GCS bucket',
      configuration: corsConfiguration
    });

  } catch (error: any) {
    console.error('❌ CORS configuration failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to configure CORS',
      error: error.message
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/api/gcs/signed-upload/health', (req: Request, res: Response) => {
  console.log('💚 Signed upload service health check');
  res.status(200).json({
    success: true,
    service: 'GCS Signed Upload',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    features: [
      'Signed URL generation',
      'Direct GCS upload',
      'ZIP processing from GCS',
      'AI processing integration'
    ]
  });
});

export default router;