import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import multer from "multer";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Setup multer for file uploads BEFORE any other middleware
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// CRITICAL: Register upload route IMMEDIATELY, before any other middleware
console.log('🚀 REGISTERING UPLOAD ROUTE DIRECTLY IN SERVER');
app.post('/api/documents/upload-analyze', upload.array('files', 10), async (req: Request, res: Response) => {
  console.log('🎯 UPLOAD ROUTE HIT IN MAIN SERVER!');
  console.log('Method:', req.method, 'URL:', req.url);
  console.log('Files received:', req.files?.length || 0);
  console.log('Body dealId:', req.body?.dealId);
  
  try {
    res.setHeader('Content-Type', 'application/json');
    
    const files = req.files as Express.Multer.File[];
    const dealId = req.body.dealId;
    
    if (!files || files.length === 0) {
      console.log('❌ No files found');
      return res.status(400).json({ 
        success: false,
        message: 'No files uploaded' 
      });
    }

    const uploadedFiles = files.map((file, index) => ({
      id: `file_${Date.now()}_${index}`,
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
      status: 'uploaded'
    }));

    console.log('✅ SUCCESS! Responding with JSON for', uploadedFiles.length, 'files');
    
    return res.status(200).json({
      success: true,
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      files: uploadedFiles,
      dealId: dealId || null
    });

  } catch (error) {
    console.error('💥 UPLOAD ERROR IN MAIN SERVER:', error);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ 
      success: false,
      message: 'Upload failed', 
      error: String(error) 
    });
  }
});

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

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
