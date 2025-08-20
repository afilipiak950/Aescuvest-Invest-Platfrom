import express from 'express';
import multer from 'multer';
import { gcsService } from '../services/googleCloudStorage';
import { storage as dbStorage } from '../storage';
import { backgroundJobManager } from '../services/backgroundJobManager';
import { Readable } from 'stream';

const router = express.Router();

// Configure multer for memory storage (stream directly to GCS)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024 * 1024, // 5TB limit
  }
});

/**
 * Proxy upload endpoint - handles upload server-side to bypass CORS
 * This is the ultimate solution for production 413 and CORS issues
 */
router.post('/api/gcs/proxy-upload/:dealId', 
  upload.single('file'),
  async (req, res) => {
    try {
      const dealId = parseInt(req.params.dealId);
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'No file provided'
        });
      }
      
      console.log(`🚀 Proxy upload: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(1)}MB) for deal ${dealId}`);
      
      // Generate GCS path
      const timestamp = Date.now();
      const gcsFileName = `deals/${dealId}/documents/${timestamp}_${file.originalname}`;
      
      // Upload directly to GCS from memory buffer
      console.log(`📤 Uploading to GCS via proxy: ${gcsFileName}`);
      
      let gcsPath: string;
      let useLocalFallback = false;
      
      try {
        // Check if GCS is properly initialized
        if (!(gcsService as any).bucket) {
          console.error('❌ GCS bucket not initialized, using local fallback');
          throw new Error('GCS not initialized');
        }
        
        const bucket = (gcsService as any).bucket;
        const gcsFile = bucket.file(gcsFileName);
        
        // Create a stream from the buffer
        const stream = Readable.from(file.buffer);
        
        // Upload to GCS with timeout
        await Promise.race([
          new Promise((resolve, reject) => {
            const uploadStream = gcsFile.createWriteStream({
              metadata: {
                contentType: file.mimetype,
                metadata: {
                  dealId: dealId.toString(),
                  originalName: file.originalname,
                  uploadedAt: new Date().toISOString()
                }
              }
            });
            
            uploadStream.on('error', (error) => {
              console.error('❌ GCS upload stream error:', error);
              reject(error);
            });
            
            uploadStream.on('finish', () => {
              console.log('✅ GCS upload stream finished');
              resolve(true);
            });
            
            stream.pipe(uploadStream);
          }),
          new Promise((_, reject) => 
            setTimeout(() => {
              console.error('❌ GCS upload timeout after 30 seconds');
              reject(new Error('GCS upload timeout'));
            }, 30000)
          )
        ]);
        
        gcsPath = `gs://${(gcsService as any).bucketName}/${gcsFileName}`;
      } catch (gcsError) {
        console.error('⚠️ GCS upload failed, using local storage fallback:', gcsError);
        useLocalFallback = true;
        
        // Fallback to local storage
        const fs = await import('fs');
        const path = await import('path');
        const uploadDir = path.join(process.cwd(), 'uploads', 'extracted', `deal-${dealId}`);
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        // Save file locally
        const localPath = path.join(uploadDir, file.originalname);
        fs.writeFileSync(localPath, file.buffer);
        
        gcsPath = localPath;
        console.log(`✅ File saved locally as fallback: ${localPath}`);
      }
      console.log(`✅ Proxy upload successful: ${gcsPath}`);
      
      // Check if file is a ZIP that needs extraction
      const isZipFile = file.originalname.toLowerCase().endsWith('.zip');
      
      if (isZipFile) {
        console.log(`📦 ZIP file detected - creating extraction job`);
        
        // For ZIP files, create a background job to extract and process
        // CRITICAL: Use jobProcessor to actually trigger processing, not just create DB entry
        console.log(`🔍 ZIP UPLOAD MICRO-STEP 1: Loading jobProcessor module...`);
        const { jobProcessor } = await import('../services/jobProcessor');
        
        const uniqueJobId = `zip_${dealId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log(`🔍 ZIP UPLOAD MICRO-STEP 2: Creating job with ID: ${uniqueJobId}`);
        
        const jobData = {
          jobId: uniqueJobId,  // Required unique identifier
          jobType: 'zip_processing',  // MUST match the job processor case
          dealId: dealId,
          documentId: null,
          status: 'processing',
          progress: 0,
          currentStep: 'Starting ZIP extraction...',
          jobData: {
            zipPath: gcsPath,
            dealId: dealId,
            folderName: file.originalname.replace('.zip', ''),
            fileName: file.originalname
          }
        };
        
        console.log(`🔍 ZIP UPLOAD MICRO-STEP 3: Job data:`, JSON.stringify(jobData, null, 2));
        
        const jobId = await jobProcessor.createJob(jobData);
        
        console.log(`🔍 ZIP UPLOAD MICRO-STEP 4: Job created with ID: ${jobId}`);
        
        console.log(`✅ ZIP extraction job created: ${jobId}`);
        
        return res.json({
          success: true,
          message: 'ZIP file uploaded successfully and will be extracted',
          jobId,
          gcsPath,
          isZip: true,
          extractionStarted: true
        });
        
      } else {
        // For non-ZIP files, create document record as before
        const document = await dbStorage.createDocument({
          dealId: dealId,
          name: file.originalname,
          type: file.originalname.split('.').pop() || '',
          path: gcsPath,
          size: file.size,
          status: 'Pending',
          folderPath: '',
          isFolder: false
        } as any);
        
        console.log(`✅ Document registered: ${document.id}`);
        
        // Create background job for OCR processing
        const jobId = await backgroundJobManager.createJob({
          jobType: 'document_ocr',
          dealId: dealId,
          documentId: document.id,
          jobData: {
            filePath: gcsPath,
            fileName: file.originalname,
            documentId: document.id,
            documentName: file.originalname
          }
        });
        
        console.log(`✅ Processing job created: ${jobId}`);
        
        return res.json({
          success: true,
          message: 'File uploaded successfully via proxy',
          document,
          jobId,
          gcsPath
        });
      }
      
    } catch (error: any) {
      console.error('❌ Proxy upload failed:', error);
      return res.status(500).json({
        success: false,
        message: 'Proxy upload failed',
        error: error.message
      });
    }
  }
);

/**
 * Stream upload endpoint for very large files
 * Handles streaming directly to GCS without loading into memory
 */
router.post('/api/gcs/stream-upload/:dealId', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const fileName = req.headers['x-file-name'] as string;
    const fileSize = parseInt(req.headers['x-file-size'] as string || '0');
    
    if (!fileName) {
      return res.status(400).json({
        success: false,
        message: 'fileName header required'
      });
    }
    
    console.log(`🌊 Stream upload: ${fileName} (${(fileSize / 1024 / 1024).toFixed(1)}MB) for deal ${dealId}`);
    
    // Generate GCS path
    const timestamp = Date.now();
    const gcsFileName = `deals/${dealId}/documents/${timestamp}_${fileName}`;
    
    // Stream directly to GCS
    const bucket = (gcsService as any).bucket;
    const gcsFile = bucket.file(gcsFileName);
    
    const stream = gcsFile.createWriteStream({
      metadata: {
        contentType: req.headers['content-type'] || 'application/octet-stream',
        metadata: {
          dealId: dealId.toString(),
          originalName: fileName,
          uploadedAt: new Date().toISOString()
        }
      }
    });
    
    // Pipe request directly to GCS
    req.pipe(stream)
      .on('error', (error) => {
        console.error('❌ Stream upload failed:', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Stream upload failed',
            error: error.message
          });
        }
      })
      .on('finish', async () => {
        try {
          const gcsPath = `gs://${(gcsService as any).bucketName}/${gcsFileName}`;
          console.log(`✅ Stream upload successful: ${gcsPath}`);
          
          // Create document record
          const document = await dbStorage.createDocument({
            dealId: dealId,
            name: fileName,
            type: fileName.split('.').pop() || '',
            path: gcsPath,
            size: fileSize,
            status: 'Pending',
            folderPath: '',
            isFolder: false
          } as any);
          
          // Create background job
          const jobId = await backgroundJobManager.createJob({
            jobType: 'document_ocr',
            dealId: dealId,
            documentId: document.id,
            jobData: {
              filePath: gcsPath,
              fileName: fileName,
              documentId: document.id,
              documentName: fileName
            }
          });
          
          res.json({
            success: true,
            message: 'File streamed successfully',
            document,
            jobId,
            gcsPath
          });
        } catch (error: any) {
          console.error('❌ Post-stream processing failed:', error);
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              message: 'Post-stream processing failed',
              error: error.message
            });
          }
        }
      });
      
  } catch (error: any) {
    console.error('❌ Stream upload setup failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Stream upload setup failed',
      error: error.message
    });
  }
});

export default router;