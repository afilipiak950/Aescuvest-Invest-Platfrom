import express from 'express';
import { gcsService } from '../services/googleCloudStorage';

const router = express.Router();

/**
 * Generate a signed URL for direct upload to GCS
 * This bypasses Cloud Run entirely, eliminating 413 errors
 */
router.post('/api/gcs/upload-url', express.json(), async (req, res) => {
  try {
    const { dealId, fileName, contentType } = req.body;
    
    if (!dealId || !fileName) {
      return res.status(400).json({
        success: false,
        message: 'dealId and fileName are required'
      });
    }
    
    console.log(`🔐 Generating direct upload URL for ${fileName} (deal ${dealId})`);
    
    // Generate signed URL for direct upload
    const { uploadUrl, gcsPath } = await gcsService.generateUploadUrl(
      parseInt(dealId),
      fileName,
      contentType || 'application/octet-stream'
    );
    
    console.log(`✅ Generated upload URL for direct upload to: ${gcsPath}`);
    
    return res.json({
      success: true,
      uploadUrl,
      gcsPath,
      method: 'PUT',
      headers: {
        'Content-Type': contentType || 'application/octet-stream'
      }
    });
  } catch (error: any) {
    console.error('❌ Failed to generate upload URL:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate upload URL',
      error: error.message
    });
  }
});

/**
 * Register file after direct upload to GCS
 */
router.post('/api/gcs/register-upload', async (req, res) => {
  try {
    const { dealId, gcsPath, fileName, fileSize } = req.body;
    
    if (!dealId || !gcsPath || !fileName) {
      return res.status(400).json({
        success: false,
        message: 'dealId, gcsPath, and fileName are required'
      });
    }
    
    console.log(`📝 Registering uploaded file: ${fileName} at ${gcsPath}`);
    
    // Import storage to create document record
    const { storage } = await import('../storage');
    
    // Create document record with GCS path
    const document = await storage.createDocument({
      dealId: parseInt(dealId),
      name: fileName,
      type: fileName.split('.').pop() || '',
      path: gcsPath,
      size: fileSize || 0,
      status: 'Pending',
      folderPath: '',
      isFolder: false
    } as any);
    
    console.log(`✅ Registered document ${document.id} with GCS path: ${gcsPath}`);
    
    // Create background job for processing
    const { jobProcessor } = await import('../services/jobProcessor');
    
    const jobId = await jobProcessor.createJob({
      jobType: 'document_ocr',
      dealId: parseInt(dealId),
      documentId: document.id,
      status: 'pending',
      progress: 0,
      currentStep: 'Queued for OCR processing',
      jobData: {
        filePath: gcsPath,
        fileName: fileName,
        documentId: document.id,
        documentName: fileName
      }
    });
    
    console.log(`✅ Created processing job ${jobId} for document ${document.id}`);
    
    return res.json({
      success: true,
      document,
      jobId
    });
  } catch (error: any) {
    console.error('❌ Failed to register upload:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register upload',
      error: error.message
    });
  }
});

/**
 * Generate signed URL for download
 */
router.post('/api/gcs/download-url', async (req, res) => {
  try {
    const { gcsPath } = req.body;
    
    if (!gcsPath) {
      return res.status(400).json({
        success: false,
        message: 'gcsPath is required'
      });
    }
    
    console.log(`🔐 Generating download URL for: ${gcsPath}`);
    
    const downloadUrl = await gcsService.generateDownloadUrl(gcsPath);
    
    console.log(`✅ Generated download URL for: ${gcsPath}`);
    
    return res.json({
      success: true,
      downloadUrl
    });
  } catch (error: any) {
    console.error('❌ Failed to generate download URL:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate download URL',
      error: error.message
    });
  }
});

export default router;