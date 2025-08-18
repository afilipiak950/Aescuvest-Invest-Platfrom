import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Cloud Run specific upload service to handle 413 errors
export class CloudRunUploadService {
  private static instance: CloudRunUploadService;
  private maxDirectUploadSize = 10 * 1024 * 1024 * 1024; // 🚨 MASSIVE 10GB - eliminate Cloud Run limits
  
  private constructor() {}
  
  public static getInstance(): CloudRunUploadService {
    if (!CloudRunUploadService.instance) {
      CloudRunUploadService.instance = new CloudRunUploadService();
    }
    return CloudRunUploadService.instance;
  }
  
  // Enhanced multer configuration for Cloud Run
  public createCloudRunUploader() {
    const storage = multer.diskStorage({
      destination: function (req, file, cb) {
        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
      },
      filename: function (req, file, cb) {
        const timestamp = Date.now();
        const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${timestamp}_${originalName}`);
      }
    });

    return multer({
      storage: storage,
      limits: {
        fileSize: 50 * 1024 * 1024 * 1024, // 🚨 MASSIVE 50GB limit to eliminate ALL 413 errors
        fieldSize: 50 * 1024 * 1024 * 1024, // 50GB for field data  
        fields: 100, // Allow many fields
        files: 50 // Allow many files
      },
      fileFilter: (req, file, cb) => {
        // Enhanced file type validation
        const allowedTypes = ['.zip', '.rar', '.7z', '.tar', '.gz'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (allowedTypes.includes(ext) || file.mimetype.includes('zip') || file.mimetype.includes('archive')) {
          cb(null, true);
        } else {
          cb(new Error('Only archive files (ZIP, RAR, 7Z, TAR, GZ) are allowed for bulk upload.'));
        }
      }
    });
  }
  
  // Enhanced error handler for Cloud Run specific issues
  public handleCloudRunUploadError(error: any, req: Request, res: Response): boolean {
    console.error('🚨 Cloud Run upload error:', error);
    
    // Handle specific Cloud Run errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        success: false,
        error: 'File too large for direct upload',  
        cloudRunLimit: true,
        recommendedAction: 'Use chunked upload for files over 10GB',
        maxDirectSize: this.maxDirectUploadSize
      });
      return true;
    }
    
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      res.status(400).json({
        success: false,
        error: 'Unexpected file field',
        details: error.message
      });
      return true;
    }
    
    if (error.message?.includes('413') || error.status === 413) {
      res.status(413).json({
        success: false,
        error: 'Request entity too large - Cloud Run infrastructure limit',
        cloudRunLimit: true,
        recommendedAction: 'Use chunked upload or reduce file size',
        infrastructureError: true
      });
      return true;
    }
    
    // Handle timeout errors
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      res.status(408).json({
        success: false,
        error: 'Upload timeout - file may be too large for Cloud Run',
        cloudRunLimit: true,
        recommendedAction: 'Use chunked upload for large files'
      });
      return true;
    }
    
    // Handle multer form parsing errors
    if (error.message?.includes('Unexpected end of form') || error.message?.includes('Part terminated early')) {
      res.status(400).json({
        success: false,
        error: 'Invalid multipart form data',
        details: 'The file upload form was not properly formatted or was interrupted',
        recommendedAction: 'Please try uploading the file again'
      });
      return true;
    }
    
    // Handle general multer errors
    if (error.message?.includes('form') || error.code?.startsWith('LIMIT_')) {
      res.status(400).json({
        success: false,
        error: 'File upload error',
        details: error.message,
        multerError: true
      });
      return true;
    }
    
    return false; // Let other error handlers process
  }
  
  // Middleware to set Cloud Run specific headers
  public setCloudRunHeaders(req: Request, res: Response, next: Function) {
    // Disable any proxy buffering that might cause 413 errors
    res.set({
      'X-Accel-Buffering': 'no',
      'X-Proxy-Buffering': 'no', 
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Transfer-Encoding': 'chunked'
    });
    
    // Set request timeout headers
    if (req.path.includes('/upload') || req.path.includes('/data-room')) {
      res.set({
        'X-Request-Timeout': '3600', // 1 hour
        'X-Upload-Timeout': '3600',
        'Keep-Alive': 'timeout=3600'
      });
    }
    
    next();
  }
  
  // Check if file should use chunked upload
  public shouldUseChunkedUpload(fileSize: number): boolean {
    return fileSize > this.maxDirectUploadSize;
  }
  
  // Get detailed error information for debugging
  public getUploadErrorDetails(req: Request): object {
    return {
      headers: req.headers,
      contentLength: req.get('content-length'),
      contentType: req.get('content-type'),
      userAgent: req.get('user-agent'),
      method: req.method,
      url: req.url,
      body: req.body ? Object.keys(req.body) : [],
      files: req.files ? (Array.isArray(req.files) ? req.files.length : Object.keys(req.files).length) : 0,
      timestamp: new Date().toISOString()
    };
  }
}

export const cloudRunUploadService = CloudRunUploadService.getInstance();