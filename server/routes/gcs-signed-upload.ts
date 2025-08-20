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
        'x-goog-content-length-range': `0,${5 * 1024 * 1024 * 1024 * 1024}` // Up to 5TB
      }
    };

    console.log('🔑 Generating signed URL with options:', options);
    
    // Initialize GCS if needed
    if (!(gcsService as any).bucket) {
      console.log('🔧 Initializing GCS service...');
      await gcsService.initialize();
    }

    const [signedUrl] = await (gcsService as any).bucket
      .file(gcsFileName)
      .getSignedUrl(options);

    console.log('✅ Signed URL generated successfully');
    console.log(`📍 URL length: ${signedUrl.length} characters`);

    // Return signed URL and metadata
    const response = {
      success: true,
      signedUrl,
      gcsFileName,
      uploadId: `upload-${timestamp}`,
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

    // Verify file exists in GCS
    const file = (gcsService as any).bucket.file(gcsFileName);
    const [exists] = await file.exists();
    
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
    const [document] = await db.insert(documents).values({
      dealId: parseInt(dealId),
      name: fileName,
      uploadedAt: new Date(),
      metadata: {
        originalName: fileName,
        gcsPath: gcsFileName,
        uploadId,
        size: parseInt(metadata.size),
        processedAt: new Date().toISOString()
      }
    }).returning();

    console.log(`✅ Document created with ID: ${document.id}`);

    // Process ZIP file if it's a ZIP
    if (fileName.toLowerCase().endsWith('.zip')) {
      console.log('📦 Processing ZIP file from GCS...');
      
      // Download file from GCS to process
      const tempFilePath = `/tmp/${uploadId}-${fileName}`;
      console.log(`📥 Downloading to temp: ${tempFilePath}`);
      
      await file.download({ destination: tempFilePath });
      console.log('✅ File downloaded from GCS');

      // Process the ZIP file
      const processedDocs = await zipProcessor.processZipFromGCS(
        tempFilePath,
        parseInt(dealId),
        document.id,
        gcsFileName
      );

      console.log(`✅ ZIP processed: ${processedDocs.length} documents extracted`);

      // Clean up temp file
      const fs = require('fs').promises;
      await fs.unlink(tempFilePath);
      console.log('🧹 Temp file cleaned up');

      // Start background AI processing
      try {
        console.log('🤖 Starting AI processing job...');
        await jobProcessor.createJob(parseInt(dealId), document.id, 'ai_summary');
        console.log('✅ AI processing job created');
      } catch (jobError) {
        console.error('⚠️ AI job creation failed (non-critical):', jobError);
      }

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