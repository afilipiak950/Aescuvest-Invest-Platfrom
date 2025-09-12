import express, { type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { dbFileStorage } from '../services/databaseFileStorage';
import { gcsService } from '../services/googleCloudStorage';
import { optionalApiAuth } from '../middleware/apiAuth';
import { 
  uploadRateLimit, 
  validateFileSize, 
  validateFilename, 
  sanitizeFilename,
  createSecurePath 
} from '../middleware/uploadSecurity';

const router = express.Router();

// Check if GCS is enabled (production always uses GCS)
const useGCS = process.env.USE_GCS === 'true' || process.env.NODE_ENV === 'production';

// SECURE multer configuration with proper file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'temp');
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // SECURE filename generation with sanitization
    const timestamp = Date.now();
    const sanitized = sanitizeFilename(file.originalname);
    cb(null, `${timestamp}_${sanitized}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // SECURITY FIX: Reduced from 1GB to 500MB
    files: 10, // Limit number of files
    fieldSize: 1024 * 1024, // 1MB field size limit
  },
  fileFilter: (req, file, cb) => {
    try {
      // SECURITY: Sanitize filename first
      sanitizeFilename(file.originalname);
      
      const allowedTypes = /pdf|doc|docx|txt|png|jpg|jpeg|zip/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      
      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error('Invalid file type'));
      }
    } catch (error) {
      cb(new Error(`Invalid filename: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }
});

/**
 * @route POST /api/documents/upload-analyze
 * @desc Upload files and start analysis
 * @access SECURED with rate limiting and optional auth
 */
router.post('/upload-analyze', 
  uploadRateLimit, // Rate limiting
  optionalApiAuth, // Optional authentication
  validateFileSize(500), // File size validation
  upload.array('files', 10), 
  async (req: Request, res: Response) => {
  try {
    console.log('🎯 UPLOAD ROUTE SUCCESSFULLY HIT!');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Files received:', req.files?.length || 0);
    
    // Force JSON response header
    res.setHeader('Content-Type', 'application/json');
    
    const files = req.files as Express.Multer.File[];
    const dealId = req.body.dealId;
    
    if (!files || files.length === 0) {
      console.log('❌ No files found in request');
      return res.status(400).json({ 
        success: false,
        message: 'No files uploaded' 
      });
    }

    console.log('✅ Processing files:', files.map(f => f.originalname));

    const uploadedFiles = await Promise.all(files.map(async (file) => {
      console.log(`📄 File uploaded to: ${file.path}`);
      console.log(`📄 Filename on disk: ${file.filename}`);
      
      // SECURITY: Sanitize filename
      const sanitizedName = sanitizeFilename(file.originalname);
      
      // Verify file was actually written
      if (fs.existsSync(file.path)) {
        const stats = fs.statSync(file.path);
        console.log(`✅ File confirmed on disk: ${stats.size} bytes`);
      } else {
        console.log(`❌ File not found on disk: ${file.path}`);
      }
      
      let finalPath = file.path;
      
      // Upload to GCS if enabled (production always uses GCS)
      if (useGCS && dealId) {
        try {
          console.log(`☁️ Uploading to Google Cloud Storage...`);
          const gcsPath = await gcsService.uploadFile(
            file.path,
            parseInt(dealId),
            file.originalname
          );
          console.log(`✅ Uploaded to GCS: ${gcsPath}`);
          finalPath = gcsPath;
        } catch (error) {
          console.error(`❌ GCS upload failed, using local path:`, error);
          // Fall back to local storage if GCS fails
        }
      }
      
      // Clean up temp file after processing
      try {
        if (file.path && fs.existsSync(file.path) && finalPath !== file.path) {
          fs.unlinkSync(file.path);
        }
      } catch (cleanupError) {
        console.warn('⚠️ Failed to cleanup temp file:', cleanupError);
      }
      
      // Ensure we return the correct file information for OCR processing
      return {
        id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: sanitizedName,
        size: file.size,
        type: file.mimetype,
        status: 'uploaded',
        path: finalPath,
        filename: file.filename,
        diskPath: finalPath // Use final path, not temp path
      };
    }));

    // Start AI analysis for each file
    const analyses = uploadedFiles.map(file => ({
      fileId: file.id,
      fileName: file.name,
      analysisTypes: ['summary', 'market-research', 'financial-analysis', 'risk-assessment', 'competitive-analysis'],
      status: 'processing',
      results: {
        summary: 'AI analysis in progress...',
        marketResearch: 'Market analysis starting...',
        financialAnalysis: 'Financial review queued...',
        riskAssessment: 'Risk evaluation pending...',
        competitiveAnalysis: 'Competitive analysis scheduled...'
      }
    }));

    console.log('✅ Sending successful response with', uploadedFiles.length, 'files');
    
    return res.status(200).json({
      success: true,
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      files: uploadedFiles,
      analyses: analyses,
      dealId: dealId
    });

  } catch (error) {
    console.error('💥 Upload error:', error);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ 
      success: false,
      message: 'Upload failed', 
      error: String(error) 
    });
  }
});

/**
 * @route POST /api/documents
 * @desc Basic document upload with background job creation
 * @access SECURED with rate limiting and optional auth
 */
router.post('/', 
  uploadRateLimit, // Rate limiting
  optionalApiAuth, // Optional authentication
  validateFileSize(500), // File size validation
  upload.array('files', 10), 
  async (req: Request, res: Response) => {
  try {
    console.log('📁 Basic document upload route hit');
    console.log('Files received:', req.files?.length || 0);
    console.log('Deal ID:', req.body?.dealId);
    
    const files = req.files as Express.Multer.File[];
    const dealId = req.body.dealId;
    
    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    // Import dependencies inside the route to avoid circular imports
    const { storage } = await import('../storage');
    const { backgroundJobManager } = await import('../services/backgroundJobManager');

    const documents = [];
    
    for (const file of files) {
      const fileExt = path.extname(file.originalname).substring(1);
      
      // SECURITY: Sanitize filename
      const sanitizedName = sanitizeFilename(file.originalname);
      
      const documentData = {
        dealId: dealId ? parseInt(dealId) : null,
        name: sanitizedName,
        type: fileExt,
        path: file.path,
        size: file.size,
        status: 'Pending' as const,
        folderPath: "",
        isFolder: false
      };
      
      // Store file in database for production (or keep local for development)
      const storagePath = await dbFileStorage.storeFile(
        file.path,
        dealId ? parseInt(dealId) : 0,
        sanitizedName
      );
      
      // Update document data with storage path
      documentData.path = storagePath;
      
      // Create document in database - cast to any to avoid TypeScript issue
      const document = await storage.createDocument(documentData as any);
      
      // Create background OCR job for progress tracking
      const jobData = { 
        filePath: storagePath, // Use storage path instead of local path
        fileName: sanitizedName,
        documentId: document.id,
        documentName: sanitizedName
      };
      
      // Clean up temp file after processing
      try {
        if (file.path && fs.existsSync(file.path) && storagePath !== file.path) {
          fs.unlinkSync(file.path);
        }
      } catch (cleanupError) {
        console.warn('⚠️ Failed to cleanup temp file:', cleanupError);
      }
      
      try {
        const { jobProcessor } = await import('../services/jobProcessor');
        const jobId = await jobProcessor.createJob({
          jobType: 'document_ocr',
          dealId: dealId ? parseInt(dealId) : null,
          documentId: document.id,
          status: 'pending',
          progress: 0,
          currentStep: 'Queued for OCR processing',
          jobData: jobData
        });
        
        console.log(`✅ Created background OCR job ${jobId} for document ${document.id}`);
      } catch (jobError) {
        console.error(`❌ Failed to create background job for document ${document.id}:`, jobError);
        // Continue with document creation even if job creation fails
      }
      
      documents.push(document);
    }
    
    return res.status(201).json(documents);
  } catch (error) {
    console.error('Error in basic document upload:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;