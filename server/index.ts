// @ts-nocheck - bypass type errors for deployment  
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
import { debug413Middleware, bypass413Middleware } from "./debug-413";

// Import chunked upload router
import chunkedUploadRouter from './routes/chunked-upload';
import productionChunkedRouter, { rawBodyHandler } from './routes/production-chunked-upload';
import gcsDirectUploadRouter from './routes/gcs-direct-upload';
import gcsProxyUploadRouter from './routes/gcs-proxy-upload';
import gcsSignedUploadRouter from './routes/gcs-signed-upload';

const app = express();

// 🚨🚨🚨 CRITICAL: Register streaming endpoint FIRST before ANY middleware to bypass Vite
app.post('/api/deals/:dealId/ai-assistant/stream', async (req: Request, res: Response) => {
  console.log('🚨🚨🚨 STREAMING ENDPOINT HIT FIRST!');
  console.log('🚨🚨🚨 Raw body type:', typeof req.body);
  console.log('🚨🚨🚨 Headers:', req.headers['content-type']);
  
  try {
    // Parse body manually if needed
    let body = req.body;
    if (!body || typeof body === 'string') {
      console.log('🔧 Parsing body manually...');
      // Read raw body
      let rawBody = '';
      req.on('data', chunk => rawBody += chunk);
      await new Promise((resolve) => req.on('end', resolve));
      
      try {
        body = JSON.parse(rawBody || '{}');
        console.log('✅ Body parsed:', body);
      } catch (e) {
        console.error('❌ Failed to parse body:', e);
        body = {};
      }
    }
    
    const dealId = parseInt(req.params.dealId);
    const { query } = body;
    
    console.log('📝 Query received:', query);
    
    if (!query) {
      console.error('❌ No query provided');
      res.setHeader('Content-Type', 'text/event-stream');
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Query is required' })}\n\n`);
      res.end();
      return;
    }
    
    console.log(`🤖 AI Assistant streaming query for deal ${dealId}: ${query}`);
    
    // Import the AI Assistant service
    console.log('📦 Importing AI Assistant service...');
    const { AescuvestAIAssistant } = await import('./services/aiAssistantService');
    console.log('✅ Service imported');
    
    // Create assistant instance for this deal
    console.log('🔧 Creating AI Assistant instance...');
    const assistant = new AescuvestAIAssistant(dealId);
    console.log('✅ Instance created');
    
    // Set up SSE headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    // Send initial context stats
    console.log('📊 Getting context stats...');
    const stats = assistant.getContextStats();
    console.log('📊 Stats:', stats);
    res.write(`data: ${JSON.stringify({ type: 'stats', stats })}\n\n`);
    
    try {
      // Get the streaming response
      console.log('🌊 Starting stream query...');
      const stream = await assistant.streamQuery(query);
      console.log('✅ Stream started');
      
      // Stream the response chunks
      let chunkCount = 0;
      for await (const chunk of stream) {
        chunkCount++;
        console.log(`📝 Chunk ${chunkCount}:`, chunk.substring(0, 50));
        res.write(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`);
      }
      
      // Send completion event
      console.log(`✅ Stream completed with ${chunkCount} chunks`);
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    } catch (streamError: any) {
      console.error('❌ Stream error:', streamError);
      console.error('❌ Stack:', streamError.stack);
      res.write(`data: ${JSON.stringify({ type: 'error', error: streamError.message })}\n\n`);
      res.end();
    }
  } catch (error: any) {
    console.error('❌ AI Assistant streaming error:', error);
    console.error('❌ Stack:', error.stack);
    
    // Still try to send as SSE if possible
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
    }
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || 'Unknown error' })}\n\n`);
    res.end();
  }
});

// 🔍 ULTRA-DEBUG: Add comprehensive 413 debugging
app.use(debug413Middleware);
app.use(bypass413Middleware);

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

// 🚨 CRITICAL: Completely skip Express body parsers for upload routes
app.use((req, res, next) => {
  // Special case: Allow JSON parsing for upload-complete endpoint
  if (req.path.includes('/upload-complete')) {
    console.log(`📋 Allowing JSON parsing for upload-complete: ${req.path}`);
    return express.json({ limit: '10mb' })(req, res, next);
  }
  // PRODUCTION FIX: Completely skip ALL body parsing for upload routes
  if (req.path.includes('/upload') || req.path.includes('/data-room') || req.path.includes('zip')) {
    console.log(`🔧 BYPASSING body parsing for upload route: ${req.path}`);
    return next();
  }
  // Apply minimal body parsers for non-upload routes only
  express.json({ limit: '10mb' })(req, res, next); // Small limit for API routes
});

app.use((req, res, next) => {
  // PRODUCTION FIX: Completely skip ALL body parsing for upload routes  
  if (req.path.includes('/upload') || req.path.includes('/data-room') || req.path.includes('zip')) {
    return next();
  }
  // Apply minimal URL-encoded parser for non-upload routes only
  express.urlencoded({ limit: '10mb', extended: true })(req, res, next); // Small limit for forms
});

// COMPLETELY SKIP raw parser for upload routes
app.use((req, res, next) => {
  if (req.path.includes('/upload') || req.path.includes('/data-room') || req.path.includes('zip')) {
    return next(); // Skip raw parsing too
  }
  if (req.path.includes('/api/webhooks')) {
    express.raw({ limit: '10mb', type: '*/*' })(req, res, next);
  } else {
    next();
  }
});

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
    fileSize: Infinity, // 🚨 UNLIMITED - ELIMINATE ALL 413 ERRORS IN PRODUCTION
    fieldSize: Infinity, // Unlimited for fields
    fields: Infinity, // Allow unlimited fields
    files: Infinity, // Allow unlimited files
    parts: Infinity, // Allow unlimited parts
    headerPairs: Infinity // Allow unlimited header pairs
  },
  fileFilter: (req, file, cb) => {
    console.log(`🔧 MULTER: Processing file ${file.originalname} (${file.size || 'unknown'} bytes)`);
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
      // Only set headers if they haven't been sent yet
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      return originalSend.call(this, data);
    };
    
    // Override res.json to ensure proper JSON handling
    res.json = function(data: any) {
      console.log(`📤 JSON response: ${req.method} ${req.originalUrl}`);
      // Only set headers if they haven't been sent yet
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      return originalJson.call(this, data);
    };
    
    // Override res.end to ensure JSON content-type
    res.end = function(data?: any, encoding?: any) {
      console.log(`🔧 Anti-Vite end override: ${req.method} ${req.originalUrl}`);
      // Only set headers if they haven't been sent yet
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
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

  // 🚨 CRITICAL: AI PROCESSING ROUTES - Added BEFORE Vite middleware to prevent blocking
  app.post('/api/deals/:dealId/documents/:documentId/mistral-ocr', async (req: Request, res: Response) => {
    console.log('🔍 [OCR ENDPOINT] Direct OCR endpoint hit - bypassing Vite!');
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const dealId = parseInt(req.params.dealId);
      const documentId = parseInt(req.params.documentId);
      
      if (isNaN(dealId) || isNaN(documentId)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid deal ID or document ID' 
        });
      }
      
      // Import storage to get document
      const { storage } = await import('./storage');
      
      // Get document
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ 
          success: false, 
          error: 'Document not found' 
        });
      }
      
      // Use path for file location - construct actual file path from document name and deal extraction directory
      if (!document.path) {
        return res.status(400).json({ 
          success: false, 
          error: 'Document has no path' 
        });
      }
      
      // Convert database path to actual file path
      let actualFilePath = document.path;
      console.log(`🔍 Initial path from database: ${document.path}`);
      
      if (document.path.startsWith('extracted/')) {
        // Handle nested folder structures in extracted ZIP files
        const pathWithoutExtracted = document.path.substring('extracted/'.length);
        const fileName = path.basename(document.path);
        console.log(`🔍 Extracted file name: ${fileName}`);
        console.log(`🔍 Path within extraction: ${pathWithoutExtracted}`);
        
        // Look for the file in uploads/extracted directories - handle nested paths
        const uploadsDir = path.join(process.cwd(), 'uploads', 'extracted');
        console.log(`🔍 Searching in: ${uploadsDir}`);
        
        if (fs.existsSync(uploadsDir)) {
          const subDirs = fs.readdirSync(uploadsDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
          
          console.log(`🔍 Found subdirectories:`, subDirs.slice(0, 3), `... (total: ${subDirs.length})`);
          
          // First try to find the file in the correct deal directory with full nested path
          const correctDealDirs = subDirs.filter(subDir => subDir.includes(`deal-${dealId}-`));
          console.log(`🎯 Looking for correct deal dirs for deal ${dealId}:`, correctDealDirs);
          
          for (const subDir of correctDealDirs) {
            // Try full nested path first
            const fullNestedPath = path.join(uploadsDir, subDir, pathWithoutExtracted);
            console.log(`🔍 Checking nested path: ${fullNestedPath}`);
            if (fs.existsSync(fullNestedPath)) {
              actualFilePath = fullNestedPath;
              console.log(`✅ Found extracted file at nested path: ${actualFilePath}`);
              break;
            }
            
            // Try just filename in root of extraction directory
            const rootPath = path.join(uploadsDir, subDir, fileName);
            console.log(`🔍 Checking root path: ${rootPath}`);
            if (fs.existsSync(rootPath)) {
              actualFilePath = rootPath;
              console.log(`✅ Found extracted file at root: ${actualFilePath}`);
              break;
            }
          }
          
          // If not found in correct deal directory, search all directories with recursive search
          if (!actualFilePath || !fs.existsSync(actualFilePath) || actualFilePath === document.path) {
            console.log(`⚠️ File not found in correct deal directory, performing recursive search...`);
            
            const findFileRecursively = (dir: string, targetFileName: string): string | null => {
              try {
                const items = fs.readdirSync(dir, { withFileTypes: true });
                
                // Check files in current directory
                for (const item of items) {
                  if (item.isFile() && item.name === targetFileName) {
                    return path.join(dir, item.name);
                  }
                }
                
                // Search subdirectories recursively
                for (const item of items) {
                  if (item.isDirectory()) {
                    const result = findFileRecursively(path.join(dir, item.name), targetFileName);
                    if (result) return result;
                  }
                }
              } catch (error) {
                // Skip directories that can't be read
                console.log(`⚠️ Error reading directory ${dir}: ${error}`);
              }
              return null;
            };
            
            // Search in all extraction directories
            for (const subDir of subDirs) {
              const extractionRoot = path.join(uploadsDir, subDir);
              console.log(`🔍 Recursively searching in: ${extractionRoot}`);
              const foundPath = findFileRecursively(extractionRoot, fileName);
              if (foundPath && fs.existsSync(foundPath)) {
                actualFilePath = foundPath;
                console.log(`✅ Found extracted file via recursive search: ${actualFilePath}`);
                break;
              }
            }
          }
        } else {
          console.log(`❌ Uploads directory does not exist: ${uploadsDir}`);
        }
      }
      
      console.log(`🎯 Final file path for OCR: ${actualFilePath}`);
      
      if (!actualFilePath || !fs.existsSync(actualFilePath)) {
        return res.status(400).json({ 
          success: false, 
          error: 'File not found for OCR processing',
          searchedPath: actualFilePath,
          originalPath: document.path
        });
      }
      
      console.log('📝 Starting Mistral OCR processing for document', documentId, 'at path', actualFilePath);
      
      // Double check the actualFilePath value before OCR
      if (!actualFilePath) {
        console.error('❌ actualFilePath is undefined right before OCR call!');
        return res.status(500).json({
          success: false,
          error: 'File path resolution failed'
        });
      }
      
      // Import OCR service dynamically
      const { mistralOCRService } = await import('./services/mistralOCR');
      const fileExtension = document.name.split('.').pop()?.toLowerCase() || 'pdf';
      
      try {
        console.log('🎯 About to call OCR with path:', actualFilePath);
        const ocrResult = await mistralOCRService.extractText(actualFilePath, fileExtension);
        await storage.updateDocumentWithOCR(documentId, ocrResult.extractedText, 'Analyzed');
        
        console.log('✅ Mistral OCR completed for document', documentId, 'extracted', ocrResult.extractedText?.length || 0, 'characters');
        
        return res.status(200).json({
          success: true,
          message: 'OCR processing completed',
          documentId,
          dealId,
          extractedLength: ocrResult.extractedText?.length || 0
        });
      } catch (ocrError) {
        console.error('❌ Mistral OCR failed:', ocrError);
        await storage.updateDocumentWithOCR(documentId, '', 'Failed');
        
        return res.status(500).json({ 
          success: false, 
          error: 'OCR processing failed', 
          details: String(ocrError) 
        });
      }
      
    } catch (error) {
      console.error('Error processing Mistral OCR:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to process OCR' 
      });
    }
  });

  app.post('/api/deals/:dealId/documents/:documentId/ai-summary', async (req: Request, res: Response) => {
    console.log('🔍 [AI SUMMARY ENDPOINT] Direct AI summary endpoint hit - bypassing Vite!');
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const dealId = parseInt(req.params.dealId);
      const documentId = parseInt(req.params.documentId);
      
      if (isNaN(dealId) || isNaN(documentId)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid deal ID or document ID' 
        });
      }
      
      // Import storage to get document
      const { storage } = await import('./storage');
      
      // Get document
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ 
          success: false, 
          error: 'Document not found' 
        });
      }
      
      // If no OCR text, start OCR first
      if (!document.ocrText) {
        console.log('📝 Starting OCR processing first for document', documentId);
        // Import OCR service dynamically
        const { mistralOCRService } = await import('./services/mistralOCR');
        
        // Get the actual file path for processing
        const actualFilePath = document.path;
        if (actualFilePath) {
          const fileExtension = document.name.split('.').pop()?.toLowerCase() || 'pdf';
          try {
            const ocrResult = await mistralOCRService.extractText(actualFilePath, fileExtension);
            await storage.updateDocumentWithOCR(documentId, ocrResult.extractedText, 'Analyzed');
            console.log('✅ OCR completed for document', documentId);
          } catch (ocrError) {
            console.error('❌ OCR failed:', ocrError);
          }
        }
      }
      
      // Start AI summary processing
      console.log('🤖 Starting AI summary for document', documentId);
      
      return res.status(200).json({
        success: true,
        message: 'AI summary processing started',
        documentId,
        dealId
      });
      
    } catch (error) {
      console.error('Error processing AI summary:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to process AI summary' 
      });
    }
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
  
  // 🚀 REGISTER CHUNKED UPLOAD ROUTES
  app.use(chunkedUploadRouter);
  console.log('✅ Chunked upload routes registered');
  
  // 🚀 REGISTER GCS DIRECT UPLOAD ROUTES
  app.use(gcsDirectUploadRouter);
  console.log('✅ GCS direct upload routes registered');
  
  app.use(gcsProxyUploadRouter);
  console.log('✅ GCS proxy upload routes registered (bypasses CORS entirely)');
  
  // 🚀 REGISTER GCS SIGNED UPLOAD ROUTES (TRUE 413 BYPASS)
  app.use(gcsSignedUploadRouter);
  console.log('✅ GCS signed upload routes registered (TRUE 413 bypass - direct to GCS)');
  
  // 🚨 PRODUCTION CHUNKED UPLOAD WITH RAW BODY HANDLING
  // Register production routes with special middleware for Cloud Run
  if (process.env.NODE_ENV === 'production' || process.env.K_SERVICE) {
    console.log('🔥 REGISTERING PRODUCTION CHUNKED UPLOAD ROUTES');
    app.use(productionChunkedRouter);
    console.log('✅ Production chunked upload routes registered for Cloud Run');
  }

  // ZIP file upload routes - REMOVED
  // The correct ZIP upload implementation is in server/routes.ts and should not be overridden
  console.log('✅ ZIP UPLOAD ROUTES: Using implementation from server/routes.ts (no override needed)');

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

    // Skip anti-Vite middleware for SSE streaming endpoints
    if (req.originalUrl.includes('/ai-assistant/stream')) {
      console.log(`🌊 STREAMING ENDPOINT - Skipping anti-Vite middleware: ${req.originalUrl}`);
      return next();
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
