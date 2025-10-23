import { Request, Response, NextFunction } from 'express';
import path from 'path';
import rateLimit from 'express-rate-limit';

/**
 * SECURE FILENAME SANITIZATION
 * Prevents path traversal attacks and ensures safe file storage
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Invalid filename provided');
  }
  
  // Use path.basename to prevent directory traversal
  const baseName = path.basename(filename);
  
  // Remove any remaining path separators that might have survived
  const cleanName = baseName.replace(/[\/\\]/g, '');
  
  // Only allow alphanumeric characters, dots, dashes, underscores, and spaces
  // This prevents special characters that could be used in attacks
  const sanitized = cleanName.replace(/[^a-zA-Z0-9.\-_ ]/g, '_');
  
  // Ensure the filename is not empty after sanitization
  if (!sanitized || sanitized.trim().length === 0) {
    throw new Error('Filename contains no valid characters');
  }
  
  // Prevent files starting with dots (hidden files)
  if (sanitized.startsWith('.')) {
    throw new Error('Hidden files are not allowed');
  }
  
  // Limit filename length to prevent buffer overflow attacks
  if (sanitized.length > 200) {
    const ext = path.extname(sanitized);
    const nameWithoutExt = sanitized.slice(0, sanitized.length - ext.length);
    return nameWithoutExt.slice(0, 195 - ext.length) + ext;
  }
  
  return sanitized;
}

/**
 * SECURE PATH CREATION
 * Creates safe file paths that prevent directory traversal
 */
export function createSecurePath(baseDir: string, dealId: number, filename: string): string {
  const sanitizedFilename = sanitizeFilename(filename);
  const timestamp = Date.now();
  const secureFilename = `${timestamp}_${sanitizedFilename}`;
  
  // Ensure the deal ID is valid
  if (!dealId || dealId < 1 || dealId > 999999) {
    throw new Error('Invalid deal ID');
  }
  
  // Create the secure path
  const dealFolder = `deal-${dealId}`;
  const securePath = path.join(baseDir, dealFolder, secureFilename);
  
  // Verify the resulting path is still within the base directory
  const resolvedPath = path.resolve(securePath);
  const resolvedBase = path.resolve(baseDir);
  
  if (!resolvedPath.startsWith(resolvedBase)) {
    throw new Error('Path traversal attempt detected');
  }
  
  return securePath;
}

/**
 * UPLOAD RATE LIMITER
 * Prevents DoS attacks by limiting upload frequency
 */
export const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 uploads per windowMs
  message: {
    error: 'Too many upload requests',
    message: 'You have exceeded the upload rate limit. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Don't count successful requests
  skipSuccessfulRequests: false,
  // Don't count failed requests 
  skipFailedRequests: true,
});

/**
 * STRICT UPLOAD RATE LIMITER for large files
 * More restrictive limits for large file uploads
 */
export const strictUploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 large uploads per hour
  message: {
    error: 'Too many large file uploads',
    message: 'You have exceeded the large file upload rate limit. Please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * FILE SIZE VALIDATION MIDDLEWARE
 * Validates file size before processing
 */
export function validateFileSize(maxSizeMB: number = 5000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.headers['content-length'];
    const fileSize = req.headers['x-file-size'];
    
    const size = contentLength ? parseInt(contentLength) : 
                 fileSize ? parseInt(fileSize as string) : 0;
    
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    
    if (size > maxSizeBytes) {
      return res.status(413).json({
        success: false,
        error: 'File too large',
        message: `File size exceeds the maximum allowed size of ${maxSizeMB}MB`,
        maxSize: `${maxSizeMB}MB`,
        receivedSize: `${(size / 1024 / 1024).toFixed(1)}MB`
      });
    }
    
    next();
  };
}

/**
 * FILENAME VALIDATION MIDDLEWARE
 * Validates filename security before processing
 */
export function validateFilename(req: Request, res: Response, next: NextFunction) {
  try {
    const filename = req.file?.originalname || 
                    req.headers['x-file-name'] as string ||
                    req.body?.fileName;
    
    if (!filename) {
      return res.status(400).json({
        success: false,
        error: 'Missing filename',
        message: 'Filename is required for upload'
      });
    }
    
    // Sanitize the filename (this will throw if invalid)
    const sanitized = sanitizeFilename(filename);
    
    // Store the sanitized filename for later use
    if (req.file) {
      req.file.originalname = sanitized;
    }
    if (req.headers['x-file-name']) {
      req.headers['x-file-name'] = sanitized;
    }
    if (req.body?.fileName) {
      req.body.fileName = sanitized;
    }
    
    next();
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: 'Invalid filename',
      message: error.message || 'Filename contains invalid characters'
    });
  }
}

/**
 * DEAL ID VALIDATION MIDDLEWARE
 * Validates deal ID parameter
 */
export function validateDealId(req: Request, res: Response, next: NextFunction) {
  const dealId = parseInt(req.params.dealId);
  
  if (!dealId || dealId < 1 || dealId > 999999) {
    return res.status(400).json({
      success: false,
      error: 'Invalid deal ID',
      message: 'Deal ID must be a valid positive integer'
    });
  }
  
  next();
}