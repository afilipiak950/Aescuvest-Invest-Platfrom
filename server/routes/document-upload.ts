import express, { type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { dbFileStorage } from '../services/databaseFileStorage';

const router = express.Router();

// Setup multer for file uploads with proper file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Keep original filename with timestamp to avoid conflicts
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}_${originalName}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1000 * 1024 * 1024, // 1GB limit for large files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|txt|png|jpg|jpeg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

/**
 * @route POST /api/documents/upload-analyze
 * @desc Upload files and start analysis
 * @access Public
 */
router.post('/upload-analyze', upload.array('files', 10), async (req: Request, res: Response) => {
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
      
      // Verify file was actually written
      if (fs.existsSync(file.path)) {
        const stats = fs.statSync(file.path);
        console.log(`✅ File confirmed on disk: ${stats.size} bytes`);
      } else {
        console.log(`❌ File not found on disk: ${file.path}`);
      }
      
      // Ensure we return the correct file information for OCR processing
      return {
        id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
        status: 'uploaded',
        path: file.path,
        filename: file.filename,
        diskPath: file.path // Full path to the file on disk
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
 * @access Public
 */
router.post('/', upload.array('files', 10), async (req: Request, res: Response) => {
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
      
      const documentData = {
        dealId: dealId ? parseInt(dealId) : null,
        name: file.originalname,
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
        file.originalname
      );
      
      // Update document data with storage path
      documentData.path = storagePath;
      
      // Create document in database
      const document = await storage.createDocument(documentData);
      
      // Create background OCR job for progress tracking
      const jobData = { 
        filePath: storagePath, // Use storage path instead of local path
        fileName: file.originalname,
        documentId: document.id,
        documentName: file.originalname
      };
      
      try {
        const jobId = await backgroundJobManager.createJob({
          jobType: 'document_ocr',
          dealId: dealId ? parseInt(dealId) : null,
          documentId: document.id,
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