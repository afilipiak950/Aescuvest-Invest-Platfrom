// 🚨 CHUNKED UPLOAD SYSTEM - COMPLETE 413 BYPASS
import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from '../db';
import { documents as documentsTable } from '../../shared/schema';
import { zipProcessor } from '../services/zipProcessor';

const router = Router();

// Store active upload sessions
const uploadSessions = new Map<string, {
  dealId: number;
  fileName: string;
  totalChunks: number;
  receivedChunks: Set<number>;
  tempDir: string;
  startTime: number;
}>();

// Initialize chunked upload
router.post('/api/deals/:dealId/chunked-upload/init', async (req: Request, res: Response) => {
  console.log('🚀 CHUNKED UPLOAD: Initializing...');
  
  try {
    const dealId = parseInt(req.params.dealId);
    const { fileName, totalChunks, fileSize } = req.body;
    
    // Generate unique session ID
    const sessionId = crypto.randomBytes(16).toString('hex');
    
    // Create temp directory for chunks
    const tempDir = path.join(process.cwd(), 'uploads', 'chunks', sessionId);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Store session info
    uploadSessions.set(sessionId, {
      dealId,
      fileName,
      totalChunks,
      receivedChunks: new Set(),
      tempDir,
      startTime: Date.now()
    });
    
    console.log(`✅ Session created: ${sessionId} for ${fileName} (${totalChunks} chunks, ${fileSize} bytes)`);
    
    res.json({
      success: true,
      sessionId,
      message: 'Upload session initialized'
    });
  } catch (error) {
    console.error('❌ Init failed:', error);
    res.status(500).json({ error: 'Failed to initialize upload' });
  }
});

// Upload individual chunk
router.post('/api/deals/:dealId/chunked-upload/chunk', async (req: Request, res: Response) => {
  try {
    const sessionId = req.headers['x-session-id'] as string;
    const chunkIndex = parseInt(req.headers['x-chunk-index'] as string);
    
    // Validate inputs
    if (!sessionId || isNaN(chunkIndex) || chunkIndex < 0) {
      return res.status(400).json({ error: 'Invalid session or chunk index' });
    }
    
    const session = uploadSessions.get(sessionId);
    if (!session) {
      return res.status(400).json({ error: 'Invalid or expired session' });
    }
    
    // Validate chunk index
    if (chunkIndex >= session.totalChunks) {
      return res.status(400).json({ error: 'Chunk index out of range' });
    }
    
    // Check if chunk already exists (avoid duplicates)
    if (session.receivedChunks.has(chunkIndex)) {
      console.log(`⚠️ Chunk ${chunkIndex} already received, skipping`);
      return res.json({
        success: true,
        received: session.receivedChunks.size,
        total: session.totalChunks,
        progress: (session.receivedChunks.size / session.totalChunks) * 100
      });
    }
    
    // Save chunk to temp file
    const chunkPath = path.join(session.tempDir, `chunk-${chunkIndex}`);
    const writeStream = fs.createWriteStream(chunkPath);
    
    let chunkSize = 0;
    req.on('data', (data) => {
      chunkSize += data.length;
      // Validate chunk size (max 10MB per chunk for safety)
      if (chunkSize > 10 * 1024 * 1024) {
        writeStream.destroy();
        throw new Error('Chunk size exceeds maximum allowed');
      }
    });
    
    req.pipe(writeStream);
    
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', reject);
      req.on('error', reject);
    });
    
    // Mark chunk as received
    session.receivedChunks.add(chunkIndex);
    
    const progress = (session.receivedChunks.size / session.totalChunks) * 100;
    console.log(`📦 Chunk ${chunkIndex + 1}/${session.totalChunks} received (${Math.round(progress)}%)`);
    
    res.json({
      success: true,
      received: session.receivedChunks.size,
      total: session.totalChunks,
      progress
    });
  } catch (error: any) {
    console.error('❌ Chunk upload failed:', error);
    res.status(500).json({ error: error.message || 'Failed to upload chunk' });
  }
});

// Complete upload and reassemble file
router.post('/api/deals/:dealId/chunked-upload/complete', async (req: Request, res: Response) => {
  console.log('🔄 CHUNKED UPLOAD: Completing...');
  
  try {
    const { sessionId } = req.body;
    const session = uploadSessions.get(sessionId);
    
    if (!session) {
      return res.status(400).json({ error: 'Invalid session' });
    }
    
    // Verify all chunks received
    if (session.receivedChunks.size !== session.totalChunks) {
      return res.status(400).json({ 
        error: 'Missing chunks',
        received: session.receivedChunks.size,
        expected: session.totalChunks
      });
    }
    
    // Reassemble file from chunks
    const uploadDir = path.join(process.cwd(), 'uploads', 'dataroom');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const finalPath = path.join(uploadDir, `${Date.now()}-${session.fileName}`);
    const writeStream = fs.createWriteStream(finalPath);
    
    // Write chunks in order using streams (avoid memory issues)
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = path.join(session.tempDir, `chunk-${i}`);
      
      // Verify chunk exists
      if (!fs.existsSync(chunkPath)) {
        throw new Error(`Missing chunk ${i}`);
      }
      
      // Use streaming to avoid memory issues
      const chunkStream = fs.createReadStream(chunkPath);
      await new Promise<void>((resolve, reject) => {
        chunkStream.on('end', () => resolve());
        chunkStream.on('error', reject);
        chunkStream.pipe(writeStream, { end: false });
      });
    }
    
    writeStream.end();
    
    await new Promise<void>((resolve) => writeStream.on('finish', () => resolve()));
    
    // Get file size
    const stats = fs.statSync(finalPath);
    console.log(`✅ File reassembled: ${finalPath} (${stats.size} bytes)`);
    
    // Clean up chunks
    fs.rmSync(session.tempDir, { recursive: true, force: true });
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
    
    // Process ZIP in background
    if (session.fileName.endsWith('.zip')) {
      console.log('🗂️ Starting ZIP processing...');
      // Check if method exists before calling
      if (typeof zipProcessor.processDataRoomZip === 'function') {
        zipProcessor.processDataRoomZip(session.dealId, finalPath, document.id).catch((err: Error) => {
          console.error('❌ ZIP processing failed:', err);
        });
      } else if (typeof zipProcessor.processZipFile === 'function') {
        zipProcessor.processZipFile(session.dealId, finalPath, 'dataroom', document.id).catch((err: Error) => {
          console.error('❌ ZIP processing failed:', err);
        });
      } else {
        console.warn('⚠️ ZIP processor method not found, skipping processing');
      }
    }
    
    const duration = (Date.now() - session.startTime) / 1000;
    console.log(`🎉 Upload complete in ${duration.toFixed(1)}s`);
    
    res.json({
      success: true,
      message: 'Upload complete',
      documentId: document.id,
      duration
    });
  } catch (error) {
    console.error('❌ Complete failed:', error);
    res.status(500).json({ error: 'Failed to complete upload' });
  }
});

// Clean up old sessions (run periodically)
setInterval(() => {
  const now = Date.now();
  const timeout = 30 * 60 * 1000; // 30 minutes
  
  // Convert to array to iterate properly
  const sessions = Array.from(uploadSessions.entries());
  
  for (const [sessionId, session] of sessions) {
    if (now - session.startTime > timeout) {
      console.log(`🧹 Cleaning up expired session: ${sessionId}`);
      try {
        if (fs.existsSync(session.tempDir)) {
          fs.rmSync(session.tempDir, { recursive: true, force: true });
        }
      } catch (err) {
        console.error(`Failed to clean up session ${sessionId}:`, err);
      }
      uploadSessions.delete(sessionId);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

export default router;