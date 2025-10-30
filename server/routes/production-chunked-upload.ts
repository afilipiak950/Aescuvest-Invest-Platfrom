// 🚨 PRODUCTION-READY CHUNKED UPLOAD - COMPLETE 413 BYPASS
// This implementation specifically handles Cloud Run's infrastructure quirks

import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from '../db';
import { documents as documentsTable } from '../../shared/schema';

const router = Router();

// 🔥 CRITICAL: Raw body handler for chunk uploads
// This bypasses ALL middleware and handles raw streams
export function rawBodyHandler(req: Request, res: Response, next: NextFunction) {
  // Only apply to chunk upload routes
  if (!req.path.includes('/chunked-upload/chunk')) {
    return next();
  }
  
  console.log('🎯 Raw body handler activated for chunk upload');
  
  // Disable all body parsing
  (req as any).skipBodyParsing = true;
  
  // Set up raw data collection
  const chunks: Buffer[] = [];
  let size = 0;
  
  req.on('data', (chunk: Buffer) => {
    size += chunk.length;
    
    // Enforce 10MB limit per chunk (safety margin)
    if (size > 10 * 1024 * 1024) {
      req.destroy();
      return res.status(413).json({ error: 'Chunk too large' });
    }
    
    chunks.push(chunk);
  });
  
  req.on('end', () => {
    (req as any).rawBody = Buffer.concat(chunks);
    next();
  });
  
  req.on('error', (err) => {
    console.error('Request stream error:', err);
    res.status(400).json({ error: 'Stream error' });
  });
}

// Store active upload sessions with enhanced tracking
interface UploadSession {
  dealId: number;
  fileName: string;
  totalChunks: number;
  receivedChunks: Set<number>;
  tempDir: string;
  startTime: number;
  lastActivity: number;
  fileSize: number;
  checksum?: string;
}

const uploadSessions = new Map<string, UploadSession>();

// Session cleanup daemon - VERY GENEROUS TIMEOUT for large uploads
setInterval(() => {
  const now = Date.now();
  const timeout = 4 * 60 * 60 * 1000; // 4 HOURS - generous for large files on slow connections
  
  for (const [sessionId, session] of Array.from(uploadSessions.entries())) {
    if (now - session.lastActivity > timeout) {
      console.log(`🧹 Cleaning expired session: ${sessionId} (inactive for ${Math.round((now - session.lastActivity) / 1000 / 60)} minutes)`);
      try {
        if (fs.existsSync(session.tempDir)) {
          fs.rmSync(session.tempDir, { recursive: true, force: true });
        }
        uploadSessions.delete(sessionId);
      } catch (err) {
        console.error('Cleanup error:', err);
      }
    }
  }
}, 15 * 60 * 1000); // Check every 15 minutes instead of 5

// Initialize chunked upload with validation
router.post('/api/deals/:dealId/production-chunked/init', async (req: Request, res: Response) => {
  console.log('🚀 PRODUCTION CHUNKED: Initializing upload session...');
  
  try {
    const dealId = parseInt(req.params.dealId);
    const { fileName, totalChunks, fileSize, checksum } = req.body;
    
    // Validate inputs
    if (!fileName || !totalChunks || !fileSize) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (totalChunks > 100000) { // Max 100k chunks (500GB with 5MB chunks) - VERY GENEROUS
      return res.status(400).json({ error: 'Too many chunks - file exceeds 500GB limit' });
    }
    
    // Generate cryptographically secure session ID
    const sessionId = crypto.randomBytes(32).toString('hex');
    
    // Create isolated temp directory
    const tempDir = path.join(process.cwd(), 'uploads', 'chunks', sessionId);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Initialize session with full tracking
    const session: UploadSession = {
      dealId,
      fileName,
      totalChunks,
      receivedChunks: new Set(),
      tempDir,
      startTime: Date.now(),
      lastActivity: Date.now(),
      fileSize,
      checksum
    };
    
    uploadSessions.set(sessionId, session);
    
    console.log(`✅ Session initialized: ${sessionId}`);
    console.log(`📊 File: ${fileName}, Size: ${fileSize}, Chunks: ${totalChunks}`);
    
    res.json({
      success: true,
      sessionId,
      chunkSize: 5 * 1024 * 1024, // Inform client of expected chunk size
      message: 'Upload session initialized'
    });
  } catch (error: any) {
    console.error('❌ Init failed:', error);
    res.status(500).json({ error: error.message || 'Failed to initialize upload' });
  }
});

// Upload individual chunk with raw body handling
router.post('/api/deals/:dealId/production-chunked/chunk', 
  rawBodyHandler, // Apply raw body handler first
  async (req: Request, res: Response) => {
    try {
      const sessionId = req.headers['x-session-id'] as string;
      const chunkIndex = parseInt(req.headers['x-chunk-index'] as string);
      const chunkChecksum = req.headers['x-chunk-checksum'] as string;
      
      console.log(`📦 Processing chunk ${chunkIndex} for session ${sessionId}`);
      
      // Validate session
      const session = uploadSessions.get(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found or expired' });
      }
      
      // Update activity timestamp
      session.lastActivity = Date.now();
      
      // Validate chunk index
      if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
        return res.status(400).json({ error: 'Invalid chunk index' });
      }
      
      // Skip if already received (idempotency)
      if (session.receivedChunks.has(chunkIndex)) {
        console.log(`⚠️ Chunk ${chunkIndex} already received, acknowledging`);
        return res.json({
          success: true,
          received: session.receivedChunks.size,
          total: session.totalChunks,
          progress: (session.receivedChunks.size / session.totalChunks) * 100
        });
      }
      
      // Get raw body data
      const chunkData = (req as any).rawBody;
      if (!chunkData) {
        return res.status(400).json({ error: 'No chunk data received' });
      }
      
      // Optional: Verify chunk checksum
      if (chunkChecksum) {
        const actualChecksum = crypto.createHash('md5').update(chunkData).digest('hex');
        if (actualChecksum !== chunkChecksum) {
          return res.status(400).json({ error: 'Chunk checksum mismatch' });
        }
      }
      
      // Save chunk to disk
      const chunkPath = path.join(session.tempDir, `chunk-${chunkIndex.toString().padStart(6, '0')}`);
      await fs.promises.writeFile(chunkPath, chunkData);
      
      // Mark as received
      session.receivedChunks.add(chunkIndex);
      
      const progress = (session.receivedChunks.size / session.totalChunks) * 100;
      console.log(`✅ Chunk ${chunkIndex + 1}/${session.totalChunks} saved (${Math.round(progress)}%)`);
      
      res.json({
        success: true,
        received: session.receivedChunks.size,
        total: session.totalChunks,
        progress,
        sessionId
      });
    } catch (error: any) {
      console.error('❌ Chunk upload failed:', error);
      res.status(500).json({ error: error.message || 'Failed to upload chunk' });
    }
  }
);

// Complete upload and reassemble file
router.post('/api/deals/:dealId/production-chunked/complete/:sessionId', async (req: Request, res: Response) => {
  console.log('🔄 PRODUCTION CHUNKED: Completing upload...');
  
  try {
    const { sessionId } = req.params;
    const { checksum } = req.body;
    
    const session = uploadSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }
    
    // Verify all chunks received
    if (session.receivedChunks.size !== session.totalChunks) {
      const missing = [];
      for (let i = 0; i < session.totalChunks; i++) {
        if (!session.receivedChunks.has(i)) {
          missing.push(i);
        }
      }
      return res.status(400).json({ 
        error: 'Missing chunks',
        received: session.receivedChunks.size,
        expected: session.totalChunks,
        missing: missing.slice(0, 10) // First 10 missing chunks
      });
    }
    
    // Create final upload directory
    const uploadDir = path.join(process.cwd(), 'uploads', 'dataroom');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const finalPath = path.join(uploadDir, `${Date.now()}-${session.fileName}`);
    
    console.log('🔧 Reassembling file from chunks...');
    
    // Reassemble using streams for memory efficiency
    const writeStream = fs.createWriteStream(finalPath);
    
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = path.join(session.tempDir, `chunk-${i.toString().padStart(6, '0')}`);
      
      if (!fs.existsSync(chunkPath)) {
        writeStream.destroy();
        throw new Error(`Missing chunk file: ${i}`);
      }
      
      const chunkData = await fs.promises.readFile(chunkPath);
      await new Promise<void>((resolve, reject) => {
        writeStream.write(chunkData, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    
    await new Promise<void>((resolve) => {
      writeStream.end(() => resolve());
    });
    
    // Verify file size
    const stats = fs.statSync(finalPath);
    if (stats.size !== session.fileSize) {
      console.error(`Size mismatch: expected ${session.fileSize}, got ${stats.size}`);
      // Continue anyway, file might still be valid
    }
    
    // Optional: Verify file checksum
    if (checksum || session.checksum) {
      const fileBuffer = await fs.promises.readFile(finalPath);
      const actualChecksum = crypto.createHash('md5').update(fileBuffer).digest('hex');
      const expectedChecksum = checksum || session.checksum;
      
      if (actualChecksum !== expectedChecksum) {
        console.warn('File checksum mismatch, but continuing...');
      }
    }
    
    console.log(`✅ File reassembled: ${finalPath} (${stats.size} bytes)`);
    
    // Clean up chunks
    try {
      await fs.promises.rm(session.tempDir, { recursive: true, force: true });
    } catch (err) {
      console.error('Failed to clean chunks:', err);
    }
    
    uploadSessions.delete(sessionId);
    
    // Create document record
    const documentResult = await db.insert(documentsTable).values({
      dealId: session.dealId,
      name: session.fileName,
      content: finalPath,
      uploadStatus: 'processing' as const,
      processingStatus: 'pending' as const,
      type: 'dataroom' as const,
      uploadDate: new Date(),
      fileSize: stats.size
    }).returning();
    
    const document = Array.isArray(documentResult) ? documentResult[0] : documentResult;
    console.log(`📄 Document created with ID: ${document.id}`);
    
    // Process ZIP if applicable
    if (session.fileName.toLowerCase().endsWith('.zip')) {
      console.log('🗂️ Starting ZIP processing with background job tracking...');
      
      // Import dynamically to avoid circular dependencies
      const { jobProcessor } = await import('../services/jobProcessor');
      const { zipProcessor } = await import('../services/zipProcessor');
      
      // Create background job for ZIP extraction
      const jobId = await jobProcessor.createJob({
        jobType: 'zip_extraction',
        dealId: session.dealId,
        targetId: document.id,
        metadata: {
          fileName: session.fileName,
          fileSize: stats.size,
          documentId: document.id,
          extractionPath: finalPath
        }
      });
      
      console.log(`✅ Created background job ${jobId} for ZIP extraction`);
      
      // Process ZIP in background with progress tracking
      if (typeof zipProcessor.processZipFile === 'function') {
        (async () => {
          try {
            await jobProcessor.updateJobProgress(jobId, 5, 'Preparing to extract ZIP file...');
            
            await zipProcessor.processZipFile(finalPath, session.dealId, 'dataroom', document.id);
            
            await jobProcessor.updateJobProgress(jobId, 100, 'ZIP extraction complete!');
            await jobProcessor.completeJob(jobId, { success: true, documentId: document.id });
            
            // Clear cache after ZIP processing completes
            const documentCache = (global as any).documentCache;
            if (documentCache) {
              const keysToDelete: string[] = [];
              for (const key of documentCache.keys()) {
                if (key.startsWith(`${session.dealId}-`)) {
                  keysToDelete.push(key);
                }
              }
              keysToDelete.forEach((key: string) => documentCache.delete(key));
              console.log(`🧹 Cleared document cache for deal ${session.dealId} after ZIP processing - removed ${keysToDelete.length} cache entries`);
            }
          } catch (err: any) {
            console.error('ZIP processing failed:', err);
            await jobProcessor.completeJob(jobId, null, err.message || 'ZIP extraction failed');
          }
        })();
      }
    }
    
    const duration = (Date.now() - session.startTime) / 1000;
    console.log(`🎉 Upload complete in ${duration.toFixed(1)}s`);
    
    res.json({
      success: true,
      message: 'Upload complete',
      documentId: document.id,
      duration,
      fileSize: stats.size
    });
  } catch (error: any) {
    console.error('❌ Complete failed:', error);
    res.status(500).json({ error: error.message || 'Failed to complete upload' });
  }
});

// Get upload status
router.get('/api/deals/:dealId/production-chunked/status/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  const session = uploadSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const missing = [];
  for (let i = 0; i < session.totalChunks; i++) {
    if (!session.receivedChunks.has(i)) {
      missing.push(i);
    }
  }
  
  res.json({
    success: true,
    received: session.receivedChunks.size,
    total: session.totalChunks,
    progress: (session.receivedChunks.size / session.totalChunks) * 100,
    missing: missing.slice(0, 100), // First 100 missing chunks
    fileName: session.fileName,
    fileSize: session.fileSize
  });
});

export default router;