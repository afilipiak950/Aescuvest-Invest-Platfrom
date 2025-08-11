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

const app = express();

// Configure Express to handle large file uploads
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

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
    fileSize: 1000 * 1024 * 1024, // 1GB limit for ZIP files
    fieldSize: 1000 * 1024 * 1024,
    files: 10
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for ZIP uploads
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

// Body parsing limits already configured above for 500MB - removing duplicate configuration

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
  const server = await registerRoutes(app);

  // ZIP file upload routes - registered AFTER main routes to take priority
  console.log('🚀 REGISTERING ZIP UPLOAD ROUTES');
  
  app.post('/api/deals/:dealId/data-room/upload-zip', upload.single('zipFile'), async (req: Request, res: Response) => {
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
          if (zipFile.path && require('fs').existsSync(zipFile.path)) {
            require('fs').unlinkSync(zipFile.path);
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

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  
  // Configure server timeouts for large file uploads
  server.timeout = 10 * 60 * 1000; // 10 minutes for large ZIP uploads
  server.keepAliveTimeout = 10 * 60 * 1000; // 10 minutes
  server.headersTimeout = 10 * 60 * 1000; // 10 minutes
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port} with extended timeouts for large uploads`);
    
    // Start AI Processing Timeout Service
    console.log('🚀 Starting AI Processing Timeout Service...');
    aiProcessingTimeoutService.start();
  });
})();
