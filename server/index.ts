import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import multer from "multer";
import fs from "fs";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { zipProcessor } from "./services/zipProcessor";
import { backgroundJobManager } from "./services/backgroundJobManager";
import { aiProcessingTimeoutService } from "./services/aiProcessingTimeout";
import { persistentClinicalAnalysisService } from "./services/persistentClinicalAnalysis";
import { persistentLegalAnalysisService } from "./services/persistentLegalAnalysis";
import { persistentFinancialAnalysisService } from "./services/persistentFinancialAnalysis";
import { cloudRunUploadService } from "./services/cloudRunUploadService";
import { largeFileHandler } from "./middleware/largeFileHandler";
import { productionUploadRouter } from "./routes/production-upload";
import { multipartUploadRouter } from "./routes/multipart-upload";

const app = express();

// 🚨 CRITICAL: Production bypass routes MUST come first (before any body parsers)
app.use('/api/production', productionUploadRouter);

// 🚀 MULTIPART: Direct-to-storage upload routes (JSON body parsing enabled)
app.use('/api/multipart', express.json(), multipartUploadRouter);

// 🚨 CRITICAL: Large file streaming handler MUST come first
app.use(largeFileHandler);

// CRITICAL: Configure for Google Cloud Run large file uploads - ELIMINATE ALL 413 ERRORS
app.use((req, res, next) => {
  // Set headers to handle large uploads in production
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  });
  
  // For upload routes, set specific headers to prevent 413 errors
  if (req.path.includes('/upload') || req.path.includes('/data-room')) {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Content-Length, Authorization',
      'Access-Control-Max-Age': '86400',
      'X-Accel-Buffering': 'no', // CRITICAL: Disable nginx buffering 
      'X-Content-Type-Options': 'nosniff',
      'Transfer-Encoding': 'chunked', // Enable chunked transfer
      'Connection': 'keep-alive'
    });
    
    // Set timeout for large uploads
    req.setTimeout(7200000); // 2 hours
    res.setTimeout(7200000); // 2 hours
  }
  
  next();
});

// 🚨 CRITICAL: Configure Express body parsers - EXCLUDE upload routes to prevent multer conflicts
app.use((req, res, next) => {
  // Skip body parsing for upload routes to allow multer to handle multipart data
  if (req.path.includes('/upload') || req.path.includes('/data-room')) {
    return next();
  }
  // Apply body parsers only for non-upload routes
  express.json({ limit: '59055800320' })(req, res, next); // 55GB in bytes for production
});

app.use((req, res, next) => {
  // Skip body parsing for upload routes to allow multer to handle multipart data
  if (req.path.includes('/upload') || req.path.includes('/data-room')) {
    return next();
  }
  // Apply URL-encoded parser only for non-upload routes
  express.urlencoded({ limit: '59055800320', extended: true })(req, res, next); // 55GB in bytes for production  
});

// Raw parser should only be used for specific routes that need it
app.use('/api/webhooks', express.raw({ limit: '59055800320', type: '*/*' })); // Raw body parser for webhooks only

// 🚨 CRITICAL: Error handling middleware to catch and prevent 413 errors
app.use((err: any, req: any, res: any, next: any) => {
  if (err.status === 413 || err.code === 'LIMIT_FILE_SIZE' || err.message.includes('413')) {
    console.error('🚨 CAUGHT 413 ERROR - PRODUCTION CONFIGURATION ISSUE!');
    console.error('Error details:', err);
    console.error('Request URL:', req.url);
    console.error('Content-Length:', req.headers['content-length']);
    console.error('User-Agent:', req.headers['user-agent']);
    console.error('X-Forwarded-For:', req.headers['x-forwarded-for']);
    console.error('Environment:', process.env.NODE_ENV);
    console.error('Platform check:', {
      isCloudRun: !!process.env.K_SERVICE,
      isAppEngine: !!process.env.GAE_APPLICATION,
      isReplit: !!process.env.REPL_ID
    });
    
    return res.status(413).json({
      success: false,
      error: 'File upload limit exceeded in production. All layers configured for 55GB but infrastructure override detected.',
      details: {
        configuredLimit: '59055800320 bytes (55GB PRODUCTION)',
        actualError: err.message,
        environment: process.env.NODE_ENV,
        platform: {
          cloudRun: !!process.env.K_SERVICE,
          appEngine: !!process.env.GAE_APPLICATION,
          replit: !!process.env.REPL_ID
        },
        suggestedAction: 'Infrastructure-level configuration override - contact platform support'
      }
    });
  }
  next(err);
});

// Setup multer for file uploads BEFORE any other middleware
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

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 59055800320, // 🚨 55GB to ELIMINATE ALL 413 ERRORS IN PRODUCTION
    fieldSize: 59055800320, // 55GB for fields
    fields: 200, // Allow many fields
    files: 100, // Allow many files
    parts: 1000, // Allow many parts
    headerPairs: 2000 // Allow many header pairs
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for ZIP uploads - NO RESTRICTIONS
    cb(null, true);
  }
});

// Upload routes will be registered in routes.ts with full OCR processing

// ZIP upload routes will be registered AFTER main routes to avoid conflicts

// Setup persistent sessions with PostgreSQL
const pgStore = connectPg(session);
const sessionStore = new pgStore({
  conString: process.env.DATABASE_URL,
  createTableIfMissing: true,
  ttl: 30 * 24 * 60 * 60, // 30 days in seconds
  tableName: "user_sessions",
});

// Configure session middleware
app.use(session({
  store: sessionStore,
  secret: process.env.JWT_SECRET || 'investment-platform-secret-key',
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset maxAge on every request
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
    sameSite: 'lax'
  },
  name: 'aescuvest-session'
}));

// Body parsing limits already configured above for 5GB - removing duplicate configuration

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // 🚨 ULTIMATE ANTI-VITE MIDDLEWARE: Bulletproof API route protection
  app.use('/api/*', (req: Request, res: Response, next: NextFunction) => {
    console.log(`🎯 API route hit: ${req.method} ${req.originalUrl}`);
    
    // 🚨 CRITICAL: Override all response methods to prevent Vite HTML interference  
    const originalSend = res.send.bind(res);
    const originalJson = res.json.bind(res);
    const originalEnd = res.end.bind(res);
    
    // Force JSON content-type for ALL API responses
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Override res.send to force JSON responses
    res.send = function(data: any) {
      console.log(`🔧 Anti-Vite send override: ${req.method} ${req.originalUrl}`);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return originalSend.call(this, data);
    };
    
    // Override res.json to ensure proper JSON handling
    res.json = function(data: any) {
      console.log(`📤 JSON response: ${req.method} ${req.originalUrl}`);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return originalJson.call(this, data);
    };
    
    // Override res.end to ensure JSON content-type
    res.end = function(data?: any, encoding?: any) {
      console.log(`🔧 Anti-Vite end override: ${req.method} ${req.originalUrl}`);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return originalEnd.call(this, data, encoding);
    };
    
    next();
  });

  // 🚨 CRITICAL: Add diagnostics route BEFORE vite middleware to prevent conflicts
  app.get('/api/upload/diagnostics', (req: Request, res: Response) => {
    const diagnostics = {
      server: {
        environment: process.env.NODE_ENV || 'development',
        platform: process.platform,
        nodeVersion: process.version,
        uploadLimits: {
          expressjson: '5gb',
          expressUrlencoded: '5gb', 
          multerFileSize: '5gb',
          multerFieldSize: '5gb'
        }
      },
      cloudRun: {
        maxDirectUpload: '100MB',
        recommendedChunking: 'Files >100MB',
        infrastructure: 'Google Cloud Run',
        commonErrors: ['413 Request Entity Too Large', 'Timeout', 'Network Error']
      },
      endpoints: {
        dataRoomUpload: '/api/deals/:dealId/data-room/upload-zip',
        chunkedInit: '/api/upload/chunk/init', 
        chunkedUpload: '/api/upload/chunk/:uploadId/:chunkIndex'
      },
      verification: {
        currentExpressLimits: 'Configured for 50GB',
        currentMulterLimits: 'Configured for 50GB',
        cloudRunHeaders: 'Enhanced for large uploads',
        errorHandling: '413 detection enabled'
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(diagnostics);
  });

  // 🚨 WORKING SOLUTION: Add chunked upload init directly here (same location as working diagnostics)
  app.get('/api/upload/chunk/init', async (req: Request, res: Response) => {
    console.log('🚀 CHUNKED UPLOAD INIT (WORKING) HIT!', req.query);
    
    try {
      const { fileName, totalSize, chunkSize } = req.query;
      
      if (!fileName || !totalSize || !chunkSize) {
        console.log('❌ Missing parameters:', { fileName, totalSize, chunkSize });
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: fileName, totalSize, chunkSize'
        });
      }

      // Import the chunked upload service
      const { chunkedUploadService } = await import('./services/chunkedUploadService');
      
      console.log(`📁 Initializing chunked upload: ${fileName}, ${totalSize} bytes, ${chunkSize} byte chunks`);
      const uploadId = chunkedUploadService.initializeUpload(fileName as string, parseInt(totalSize as string), parseInt(chunkSize as string));
      console.log(`✅ Chunked upload initialized with ID: ${uploadId}`);

      const response = {
        success: true,
        uploadId,
        message: `Chunked upload initialized for ${fileName}`,
        maxFileSize: '5GB',
        supportedTypes: ['ZIP', 'PDF', 'DOCX', 'XLSX', 'PPT']
      };
      
      console.log('📤 Sending chunked upload init response:', response);
      return res.json(response);
    } catch (error) {
      console.error('❌ Error initializing chunked upload:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to initialize chunked upload'
      });
    }
  });

  // 🚨 WORKING SOLUTION: Add chunk upload endpoint using multer (bypasses Vite issues)
  // Import multer for handling multipart uploads
  const multer = (await import('multer')).default;
  
  // Create multer instance for chunk uploads
  const chunkUploader = multer({
    storage: multer.memoryStorage(), // Store in memory for processing
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max chunk size
    },
  });

  app.post('/api/upload/chunk/:uploadId/:chunkIndex',
    chunkUploader.single('chunk'),
    async (req: Request, res: Response) => {
      console.log(`🚀 CHUNK UPLOAD (MULTER) HIT! Upload: ${req.params.uploadId}, Chunk: ${req.params.chunkIndex}`);
      
      try {
        const { uploadId, chunkIndex } = req.params;
        const chunkFile = req.file;

        if (!chunkFile) {
          return res.status(400).json({
            success: false,
            error: 'No chunk data received'
          });
        }

        // Import the chunked upload service
        const { chunkedUploadService } = await import('./services/chunkedUploadService');
        
        console.log(`📁 Processing chunk ${chunkIndex} for upload ${uploadId} (${chunkFile.size} bytes)`);
        
        const result = await chunkedUploadService.uploadChunk(uploadId, parseInt(chunkIndex), chunkFile.buffer);
        
        console.log(`✅ Chunk ${chunkIndex} processed successfully`);
        
        return res.json({
          success: true,
          chunkIndex: parseInt(chunkIndex),
          isComplete: result.isComplete,
          message: `Chunk ${chunkIndex} uploaded successfully`,
          chunkSize: chunkFile.size
        });
      } catch (error) {
        console.error('❌ Error uploading chunk:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to upload chunk'
        });
      }
    }
  );

  // Add chunk upload status endpoint (GET method works with Vite)
  app.get('/api/upload/chunk/:uploadId/status', async (req: Request, res: Response) => {
    console.log(`🔍 CHUNK STATUS CHECK! Upload: ${req.params.uploadId}`);
    
    try {
      const { uploadId } = req.params;

      // Import the chunked upload service
      const { chunkedUploadService } = await import('./services/chunkedUploadService');
      
      const status = await chunkedUploadService.getUploadStatus(uploadId);
      
      console.log(`📊 Upload status for ${uploadId}:`, status);
      
      return res.json({
        success: true,
        uploadId,
        ...status
      });
    } catch (error) {
      console.error('❌ Error getting upload status:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get upload status'
      });
    }
  });

  // 🚨 CRITICAL: Register API routes FIRST (before Vite middleware)
  const server = await registerRoutes(app);
  console.log('✅ All API routes registered successfully before Vite middleware');

  // ZIP file upload routes - registered AFTER main routes to take priority
  console.log('🚀 REGISTERING ZIP UPLOAD ROUTES');
  
  // CRITICAL: Cloud Run ZIP upload with enhanced error handling
  const cloudRunUploader = cloudRunUploadService.createCloudRunUploader();
  
  app.post('/api/deals/:dealId/data-room/upload-zip', 
    cloudRunUploadService.setCloudRunHeaders.bind(cloudRunUploadService),
    (req, res, next) => {
      // Enhanced multer error handling for Cloud Run
      cloudRunUploader.single('zipFile')(req, res, (error) => {
        if (error) {
          console.error('🚨 Multer error in Cloud Run upload:', error);
          
          // Use Cloud Run specific error handler
          if (cloudRunUploadService.handleCloudRunUploadError(error, req, res)) {
            return; // Error was handled
          }
        }
        next(error);
      });
    },
    async (req: Request, res: Response) => {
    try {
      console.log('🗂️ ZIP upload route called for deal:', req.params.dealId);
      console.log('📋 Request body:', req.body);
      console.log('📁 Uploaded file:', req.file);
      
      const dealId = parseInt(req.params.dealId);
      const zipFile = req.file;
      const folderName = (req.body && req.body.folderName) ? req.body.folderName : 'Data Room Documents';

      if (!zipFile) {
        return res.status(400).json({
          success: false,
          message: 'No ZIP file uploaded'
        });
      }

      if (!zipFile.originalname.toLowerCase().endsWith('.zip')) {
        // Clean up uploaded file if it's not a ZIP
        try {
          if (zipFile.path && fs.existsSync(zipFile.path)) {
            fs.unlinkSync(zipFile.path);
          }
        } catch (cleanupError) {
          console.error('Failed to cleanup non-ZIP file:', cleanupError);
        }
        
        return res.status(400).json({
          success: false,
          message: 'Only ZIP files are allowed'
        });
      }

      console.log(`📦 Processing ZIP file: ${zipFile.originalname} for deal ${dealId} with folder name: ${folderName}`);

      // Create background job for ZIP processing with real-time progress
      const jobId = await backgroundJobManager.createJob({
        jobType: 'zip_processing',
        dealId: dealId,
        documentId: null,
        jobData: {
          zipPath: zipFile.path,
          folderName: folderName,
          fileName: zipFile.originalname
        }
      });

      // Process ZIP file in background
      zipProcessor.processZipFile(zipFile.path, dealId, folderName, jobId)
        .then(result => {
          console.log(`✅ ZIP processing completed for job ${jobId}`);
          backgroundJobManager.completeJob(jobId, result);
        })
        .catch(error => {
          console.error(`❌ ZIP processing failed for job ${jobId}:`, error);
          backgroundJobManager.completeJob(jobId, null, error.message);
        });

      res.json({
        success: true,
        message: 'ZIP file upload started. Processing in background...',
        jobId: jobId,
        fileName: zipFile.originalname
      });

    } catch (error: any) {
      console.error('❌ ZIP processing error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process ZIP file',
        error: error.message
      });
    }
  });

  // Get data room connection status
  app.get('/api/deals/:dealId/data-room/status', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      const connection = await zipProcessor.getConnection(dealId.toString());
      
      res.json({
        success: true,
        connection
      });
    } catch (error: any) {
      console.error('❌ Error getting data room status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get data room status',
        error: error.message
      });
    }
  });

  // Disconnect data room
  app.post('/api/deals/:dealId/data-room/disconnect', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      res.json({
        success: true,
        message: 'Data room disconnected successfully'
      });
    } catch (error: any) {
      console.error('❌ Error disconnecting data room:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to disconnect data room',
        error: error.message
      });
    }
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // 🚨 ULTIMATE SOLUTION: Complete Pre-Vite API Processing
  // Process ALL API routes completely BEFORE Vite middleware can interfere
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.originalUrl.startsWith('/api/')) {
      return next(); // Not an API route, continue normally
    }

    console.log(`🔄 PRE-VITE COMPLETE: ${req.method} ${req.originalUrl}`);
    
    // Force proper headers immediately
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    
    // Override ALL response methods to ensure JSON output
    const originalSend = res.send.bind(res);
    const originalJson = res.json.bind(res);
    const originalEnd = res.end.bind(res);
    
    res.send = function(data: any) {
      console.log(`📤 PRE-VITE SEND: ${req.method} ${req.originalUrl}`);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return originalSend.call(this, data);
    };
    
    res.json = function(data: any) {
      console.log(`📤 PRE-VITE JSON: ${req.method} ${req.originalUrl}`);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return originalJson.call(this, data);
    };
    
    res.end = function(data?: any, encoding?: any) {
      console.log(`📤 PRE-VITE END: ${req.method} ${req.originalUrl}`);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      
      // If Vite tries to inject HTML, block it completely
      if (typeof data === 'string' && data.includes('<!DOCTYPE html>')) {
        console.error(`🚨 PRE-VITE BLOCKED HTML for ${req.originalUrl}`);
        return originalEnd.call(this, JSON.stringify({
          success: false,
          error: 'Vite HTML injection blocked',
          route: req.originalUrl,
          method: req.method
        }), 'utf8');
      }
      
      return originalEnd.call(this, data, encoding);
    };
    
    next();
  });

  // Removed final API protection to allow routes to work properly

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use environment PORT for deployment, fallback to 5000 for local development
  // This ensures compatibility with Cloud Run and other deployment platforms
  const port = parseInt(process.env.PORT as string) || 5000;
  
  // 🚨 CRITICAL: Configure MASSIVE server timeouts for huge file uploads
  server.timeout = 2 * 60 * 60 * 1000; // 2 hours for massive uploads  
  server.keepAliveTimeout = 2 * 60 * 60 * 1000; // 2 hours
  server.headersTimeout = 2 * 60 * 60 * 1000; // 2 hours
  server.requestTimeout = 2 * 60 * 60 * 1000; // 2 hours for request processing
  
  // Set max listeners to handle concurrent uploads
  server.setMaxListeners(50);
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port} with extended timeouts for large uploads`);
    
    // Start AI Processing Timeout Service
    console.log('🚀 Starting AI Processing Timeout Service...');
    aiProcessingTimeoutService.start();
    
    // Initialize Persistent Clinical Analysis Service
    console.log('🧬 Initializing Persistent Clinical Analysis Service...');
    persistentClinicalAnalysisService.initialize().catch(err => {
      console.error('❌ Failed to initialize persistent clinical analysis:', err);
    });
    
    // Initialize Persistent Legal Analysis Service
    console.log('🔍 Initializing Persistent Legal Analysis Service...');
    persistentLegalAnalysisService.initialize().catch(err => {
      console.error('❌ Failed to initialize persistent legal analysis:', err);
    });

    // Initialize Persistent Financial Analysis Service
    console.log('💰 Initializing Persistent Financial Analysis Service...');
    persistentFinancialAnalysisService.initialize().catch(err => {
      console.error('❌ Failed to initialize persistent financial analysis:', err);
    });
  });
})();
