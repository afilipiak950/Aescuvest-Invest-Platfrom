import express from 'express';
import { multipartStorageService } from '../services/multipartStorageService';
import { storage } from '../storage';
import { insertDocumentSchema } from '../../shared/schema';

const router = express.Router();

/**
 * Initialize multipart upload
 * Returns presigned URLs for direct-to-storage upload
 */
router.post('/init', async (req, res) => {
  try {
    const { fileName, fileSize, dealId, chunkSize } = req.body;
    
    console.log(`🚀 Multipart init: ${fileName} (${(fileSize / 1024 / 1024).toFixed(1)}MB) for deal ${dealId}`);
    
    if (!fileName || !fileSize || !dealId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: fileName, fileSize, dealId'
      });
    }

    const result = await multipartStorageService.initializeMultipartUpload({
      fileName,
      fileSize: parseInt(fileSize),
      dealId: parseInt(dealId),
      chunkSize: chunkSize ? parseInt(chunkSize) : undefined,
    });

    console.log(`✅ Multipart initialized: ${result.uploadId} (${result.totalParts} parts)`);

    res.json({
      success: true,
      ...result,
    });

  } catch (error) {
    console.error('❌ Multipart init error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initialize multipart upload'
    });
  }
});

/**
 * Complete multipart upload
 * Combines all parts into final object and saves to database
 */
router.post('/complete', async (req, res) => {
  try {
    const { uploadId, partETags } = req.body;
    
    console.log(`🔄 Completing multipart upload: ${uploadId}`);
    
    if (!uploadId || !Array.isArray(partETags)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: uploadId, partETags'
      });
    }

    // Get upload session to extract metadata
    const session = multipartStorageService.getUploadSession(uploadId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Upload session not found'
      });
    }

    // Complete the multipart upload
    const result = await multipartStorageService.completeMultipartUpload(uploadId, partETags);
    
    // Extract deal ID from object name (deals/{dealId}/uploads/...)
    const dealIdMatch = result.objectKey.match(/deals\/(\d+)\//);
    const dealId = dealIdMatch ? parseInt(dealIdMatch[1]) : null;
    
    if (!dealId) {
      console.warn(`Could not extract deal ID from object key: ${result.objectKey}`);
    }

    // Extract file name from object name
    const fileName = result.objectKey.split('/').pop() || 'unknown';
    
    // Save document to database if deal ID found
    let document = null;
    if (dealId) {
      try {
        document = await storage.createDocument(insertDocumentSchema.parse({
          dealId,
          name: fileName,
          type: 'application/octet-stream', // Will be detected later
          path: result.objectKey,
          size: result.size,
          status: 'Pending' as const,
          folderPath: '/',
          isFolder: false
        }));
        
        console.log(`💾 Document saved to database: ${document.id}`);
      } catch (dbError) {
        console.error('Database save error:', dbError);
        // Continue anyway - file is uploaded successfully
      }
    }

    console.log(`✅ Multipart upload completed: ${result.objectKey} (${result.size} bytes)`);

    res.json({
      success: true,
      objectKey: result.objectKey,
      etag: result.etag,
      size: result.size,
      document: document ? {
        id: document.id,
        name: document.name,
        dealId: document.dealId
      } : null
    });

  } catch (error) {
    console.error('❌ Multipart complete error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete multipart upload'
    });
  }
});

/**
 * Abort multipart upload
 * Cleans up uploaded parts and session
 */
router.post('/abort', async (req, res) => {
  try {
    const { uploadId } = req.body;
    
    console.log(`🗑️ Aborting multipart upload: ${uploadId}`);
    
    if (!uploadId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: uploadId'
      });
    }

    await multipartStorageService.abortMultipartUpload(uploadId);
    
    console.log(`✅ Multipart upload aborted: ${uploadId}`);

    res.json({
      success: true,
      message: 'Upload aborted successfully'
    });

  } catch (error) {
    console.error('❌ Multipart abort error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to abort multipart upload'
    });
  }
});

/**
 * Get upload session status
 */
router.get('/status/:uploadId', async (req, res) => {
  try {
    const { uploadId } = req.params;
    
    const session = multipartStorageService.getUploadSession(uploadId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Upload session not found'
      });
    }

    res.json({
      success: true,
      session: {
        uploadId: session.uploadId,
        totalParts: session.totalParts,
        createdAt: session.createdAt,
      }
    });

  } catch (error) {
    console.error('❌ Multipart status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get upload status'
    });
  }
});

/**
 * List active upload sessions
 */
router.get('/sessions', async (req, res) => {
  try {
    const sessions = multipartStorageService.getActiveSessions();
    
    res.json({
      success: true,
      sessions: sessions.map(session => ({
        uploadId: session.uploadId,
        totalParts: session.totalParts,
        createdAt: session.createdAt,
      }))
    });

  } catch (error) {
    console.error('❌ Multipart sessions error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get upload sessions'
    });
  }
});

export { router as multipartUploadRouter };