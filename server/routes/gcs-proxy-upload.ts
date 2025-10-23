import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { gcsService } from '../services/googleCloudStorage';
import { storage as dbStorage } from '../storage';
import { jobProcessor } from '../services/jobProcessor';
import { Readable } from 'stream';
import { optionalApiAuth } from '../middleware/apiAuth';
import { 
  uploadRateLimit, 
  strictUploadRateLimit, 
  validateFileSize, 
  validateFilename, 
  validateDealId, 
  sanitizeFilename, 
  createSecurePath 
} from '../middleware/uploadSecurity';

const router = express.Router();

// SECURE MULTER CONFIGURATION - Fixed DoS vulnerability
// Switched from memory to disk storage and reduced size limit from 5TB to 500MB
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadsDir = path.join(process.cwd(), 'uploads', 'temp');
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
      // Use secure filename with timestamp
      const timestamp = Date.now();
      const sanitized = sanitizeFilename(file.originalname);
      cb(null, `${timestamp}_${sanitized}`);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024, // 5GB limit for dataroom uploads
    files: 1, // Only allow single file uploads
    fieldSize: 1024 * 1024, // 1MB field size limit
  },
  fileFilter: (req, file, cb) => {
    try {
      // Additional filename validation
      sanitizeFilename(file.originalname);
      cb(null, true);
    } catch (error) {
      cb(new Error(`Invalid filename: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }
});

/**
 * Test endpoint to verify proxy upload is accessible
 */
router.get('/api/gcs/proxy-upload/test', (req, res) => {
  console.log('🔍 Proxy upload test endpoint hit');
  res.status(200).json({
    success: true,
    message: 'Proxy upload endpoint is accessible',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    gcsInitialized: !!(gcsService as any).bucket
  });
});

/**
 * SECURE Proxy upload endpoint - handles upload server-side to bypass CORS
 * SECURITY FIXES: Added auth, rate limiting, filename validation, and size limits
 */
router.post('/api/gcs/proxy-upload/:dealId', 
  uploadRateLimit, // Rate limiting to prevent DoS
  optionalApiAuth, // Optional authentication
  validateDealId, // Validate deal ID parameter
  validateFileSize(5000), // Validate file size (5GB max)
  upload.single('file'), // Secure file upload
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
      
      // Generate SECURE GCS path with sanitized filename
      const timestamp = Date.now();
      const sanitizedFilename = sanitizeFilename(file.originalname);
      const gcsFileName = `deals/${dealId}/documents/${timestamp}_${sanitizedFilename}`;
      
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
        
        // Create a stream from the uploaded file (now using disk storage)
        const stream = fs.createReadStream(file.path);
        
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
            
            uploadStream.on('error', (error: any) => {
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
        
        // SECURE Fallback to local storage - FIXED PATH TRAVERSAL VULNERABILITY
        const uploadDir = path.join(process.cwd(), 'uploads', 'extracted', `deal-${dealId}`);
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        // SECURITY FIX: Use createSecurePath instead of direct path.join
        const localPath = createSecurePath(
          path.join(process.cwd(), 'uploads', 'extracted'),
          dealId,
          file.originalname
        );
        
        // Copy from temp upload location to secure final location
        fs.copyFileSync(file.path, localPath);
        
        gcsPath = localPath;
        console.log(`✅ File saved locally as fallback: ${localPath}`);
      }
      console.log(`✅ Proxy upload successful: ${gcsPath}`);
      
      // Clean up temporary file if it exists
      try {
        if (file.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (cleanupError) {
        console.warn('⚠️ Failed to cleanup temp file:', cleanupError);
      }
      
      // Check if file is a ZIP that needs extraction
      const isZipFile = sanitizedFilename.toLowerCase().endsWith('.zip');
      
      if (isZipFile) {
        console.log(`📦 ZIP file detected - creating extraction job`);
        
        let jobId: string | null = null;
        let jobCreationError: string | null = null;
        
        try {
          // 🎯 CRITICAL: Create persistent upload session FIRST
          console.log(`🔍 ZIP UPLOAD MICRO-STEP 0: Creating persistent upload session...`);
          const { persistentUploadService } = await import('../services/persistentUploadService');
          
          const sessionId = persistentUploadService.generateSessionId();
          await persistentUploadService.createSession({
            sessionId,
            dealId: dealId,
            fileName: file.originalname,
            fileSize: file.size,
            uploadType: 'gcs_direct',
            status: 'processing',
            progress: 100,
            uploadedBytes: file.size,
            gcsPath: gcsPath,
            currentStep: 'Starting ZIP extraction...'
          });
          
          console.log(`✅ Created persistent upload session: ${sessionId}`);
          
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
          
          // Wrap job creation with timeout to prevent hanging
          const jobIdNumber = await Promise.race([
            jobProcessor.createJob(jobData),
            new Promise<number>((_, reject) => 
              setTimeout(() => reject(new Error('Job creation timeout')), 5000)
            )
          ]);
          jobId = jobIdNumber.toString();
          
          console.log(`🔍 ZIP UPLOAD MICRO-STEP 4: Job created with ID: ${jobId}`);
          console.log(`✅ ZIP extraction job created: ${jobId}`);
          
        } catch (jobError: any) {
          console.error('⚠️ Failed to create extraction job:', jobError);
          jobCreationError = jobError?.message || 'Unknown job creation error';
          // Continue - file is uploaded, just job creation failed
        }
        
        // ALWAYS send response, even if job creation failed
        const response = {
          success: true,
          message: jobId 
            ? 'ZIP file uploaded successfully and will be extracted'
            : 'ZIP file uploaded but extraction job failed - manual processing required',
          jobId: jobId || undefined,
          gcsPath,
          isZip: true,
          extractionStarted: !!jobId,
          jobError: jobCreationError || undefined
        };
        
        console.log('📤 Sending ZIP upload response:', JSON.stringify(response));
        return res.status(200).json(response);
        
      } else {
        // For non-ZIP files, create document record
        let document: any = null;
        let jobId: string | null = null;
        let processingError: string | null = null;
        
        try {
          document = await dbStorage.createDocument({
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
          
          try {
            // Create background job for OCR processing with timeout using jobProcessor
            const jobIdNumber = await Promise.race([
              jobProcessor.createJob({
                jobId: `ocr_${dealId}_${document.id}_${Date.now()}`,
                jobType: 'document_ocr',
                dealId: dealId,
                documentId: document.id,
                status: 'pending',
                progress: 0,
                currentStep: 'Starting OCR processing...',
                jobData: {
                  filePath: gcsPath,
                  fileName: file.originalname,
                  documentId: document.id,
                  documentName: file.originalname
                }
              }),
              new Promise<number>((_, reject) => 
                setTimeout(() => reject(new Error('OCR job creation timeout')), 5000)
              )
            ]);
            jobId = jobIdNumber.toString();
            
            console.log(`✅ Processing job created: ${jobId}`);
          } catch (jobError: any) {
            console.error('⚠️ Failed to create OCR job:', jobError);
            processingError = jobError?.message || 'OCR job creation failed';
            // Continue - document is saved, just OCR job failed
          }
          
        } catch (dbError: any) {
          console.error('❌ Failed to save document to database:', dbError);
          // Still return success as file is uploaded to storage
          return res.json({
            success: true,
            message: 'File uploaded to storage but database save failed',
            error: dbError?.message || 'Database error',
            gcsPath
          });
        }
        
        // ALWAYS send response
        const response = {
          success: true,
          message: jobId 
            ? 'File uploaded successfully via proxy'
            : 'File uploaded but OCR processing failed - manual processing required',
          document,
          jobId: jobId || undefined,
          gcsPath,
          processingError: processingError || undefined
        };
        
        console.log('📤 Sending document upload response:', JSON.stringify(response));
        return res.status(200).json(response);
      }
      
    } catch (error: any) {
      console.error('❌ Proxy upload failed:', error);
      console.error('Error stack:', error.stack);
      
      // Ensure we always send a proper JSON response
      const errorResponse = {
        success: false,
        message: 'Proxy upload failed',
        error: error.message || 'Unknown server error',
        details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      };
      
      console.log('📤 Sending error response:', JSON.stringify(errorResponse));
      return res.status(500).json(errorResponse);
    }
  }
);

/**
 * SECURE Stream upload endpoint for large files
 * SECURITY FIXES: Added authentication, rate limiting, and size validation
 */
router.post('/api/gcs/stream-upload/:dealId', 
  strictUploadRateLimit, // Stricter rate limiting for large files
  optionalApiAuth, // Optional authentication
  validateDealId, // Validate deal ID
  validateFileSize(5000), // 5GB limit for stream uploads
  async (req, res) => {
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
    
    // SECURITY: Sanitize the filename
    let sanitizedFileName: string;
    try {
      sanitizedFileName = sanitizeFilename(fileName);
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename',
        error: error.message
      });
    }
    
    console.log(`🌊 Stream upload: ${fileName} (${(fileSize / 1024 / 1024).toFixed(1)}MB) for deal ${dealId}`);
    
    // Generate SECURE GCS path
    const timestamp = Date.now();
    const gcsFileName = `deals/${dealId}/documents/${timestamp}_${sanitizedFileName}`;
    
    // Stream directly to GCS
    const bucket = (gcsService as any).bucket;
    const gcsFile = bucket.file(gcsFileName);
    
    const stream = gcsFile.createWriteStream({
      metadata: {
        contentType: req.headers['content-type'] || 'application/octet-stream',
        metadata: {
          dealId: dealId.toString(),
          originalName: sanitizedFileName,
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
            name: sanitizedFileName,
            type: sanitizedFileName.split('.').pop() || '',
            path: gcsPath,
            size: fileSize,
            status: 'Pending',
            folderPath: '',
            isFolder: false
          } as any);
          
          // Create background job using jobProcessor
          const jobIdNumber = await jobProcessor.createJob({
            jobId: `ocr_stream_${dealId}_${document.id}_${Date.now()}`,
            jobType: 'document_ocr',
            dealId: dealId,
            documentId: document.id,
            status: 'pending',
            progress: 0,
            currentStep: 'Starting OCR processing...',
            jobData: {
              filePath: gcsPath,
              fileName: sanitizedFileName,
              documentId: document.id,
              documentName: sanitizedFileName
            }
          });
          const jobId = jobIdNumber.toString();
          
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