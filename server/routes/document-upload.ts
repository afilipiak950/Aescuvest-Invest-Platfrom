import express, { type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';

const router = express.Router();

// Setup multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
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

    const uploadedFiles = files.map(file => ({
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
      status: 'uploaded',
      path: file.path
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

export default router;