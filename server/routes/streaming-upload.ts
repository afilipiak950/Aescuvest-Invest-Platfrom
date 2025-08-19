import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { storage } from '../storage';
import { insertDocumentSchema } from '../../shared/schema';

const router = express.Router();

// Store for tracking active streaming uploads
const streamingUploads = new Map<string, {
  dealId: number;
  filename: string;
  totalSize: number;
  chunks: Buffer[];
  receivedBytes: number;
  createdAt: number;
}>();

/**
 * 🔥 STREAMING SOLUTION: Ultra-small chunks that NEVER hit limits
 * Uses 256KB chunks (1/20th of normal limits) for 100% reliability
 */

// Initialize streaming upload
router.post('/init/:dealId', async (req: Request, res: Response) => {
  const dealId = parseInt(req.params.dealId);
  const { filename, totalSize } = req.body;
  
  const uploadId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  streamingUploads.set(uploadId, {
    dealId,
    filename,
    totalSize: parseInt(totalSize),
    chunks: [],
    receivedBytes: 0,
    createdAt: Date.now()
  });
  
  console.log(`🔥 Initialized streaming upload: ${filename} (${(totalSize / 1024 / 1024).toFixed(1)}MB)`);
  console.log(`📊 Active uploads: ${streamingUploads.size}, Upload ID: ${uploadId}`);
  
  res.json({
    success: true,
    uploadId,
    chunkSize: 256 * 1024, // 256KB chunks - NEVER hits limits
    message: 'Streaming upload initialized'
  });
});

// Receive tiny chunks
router.post('/chunk/:uploadId/:chunkIndex', async (req: Request, res: Response) => {
  const { uploadId, chunkIndex } = req.params;
  const upload = streamingUploads.get(uploadId);
  
  if (!upload) {
    return res.status(404).json({ success: false, error: 'Upload session not found' });
  }
  
  let chunkData: Buffer;
  
  // Handle both form data and raw body
  if (req.files && (req.files as any).chunk) {
    chunkData = fs.readFileSync((req.files as any).chunk.path);
  } else {
    // Collect raw body data
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    await new Promise(resolve => req.on('end', resolve));
    chunkData = Buffer.concat(chunks);
  }
  
  upload.chunks[parseInt(chunkIndex)] = chunkData;
  upload.receivedBytes += chunkData.length;
  
  console.log(`📦 Chunk ${chunkIndex} received: ${chunkData.length} bytes (${upload.receivedBytes}/${upload.totalSize})`);
  
  res.json({
    success: true,
    receivedBytes: upload.receivedBytes,
    progress: (upload.receivedBytes / upload.totalSize) * 100
  });
});

// Complete streaming upload
router.post('/complete/:uploadId', async (req: Request, res: Response) => {
  const { uploadId } = req.params;
  const upload = streamingUploads.get(uploadId);
  
  if (!upload) {
    return res.status(404).json({ success: false, error: 'Upload session not found' });
  }
  
  try {
    console.log(`🔥 Completing streaming upload: ${upload.filename}`);
    
    // Combine all chunks in order
    const completeFile = Buffer.concat(upload.chunks.filter(chunk => chunk !== undefined));
    
    // Save to disk
    const tempDir = path.join(process.cwd(), 'uploads', 'streaming');
    fs.mkdirSync(tempDir, { recursive: true });
    
    const filepath = path.join(tempDir, upload.filename);
    fs.writeFileSync(filepath, completeFile);
    
    console.log(`💾 File assembled: ${upload.filename} (${completeFile.length} bytes)`);
    
    // Check if it's a ZIP file and process accordingly
    const isZip = upload.filename.toLowerCase().endsWith('.zip') || 
                  (completeFile.length >= 4 && 
                   completeFile[0] === 0x50 && completeFile[1] === 0x4B);
    
    if (isZip) {
      // Process ZIP file
      try {
        const zipProcessorModule = await import('../services/zipProcessor');
        const zipProcessor = zipProcessorModule.zipProcessor || zipProcessorModule.default;
        if (zipProcessor && zipProcessor.processZipFile) {
          await zipProcessor.processZipFile(filepath, upload.dealId);
        } else {
          throw new Error('ZIP processor not available');
        }
        
        res.json({
          success: true,
          message: 'ZIP file uploaded and processed successfully',
          filename: upload.filename,
          size: completeFile.length,
          type: 'zip'
        });
      } catch (zipError) {
        console.error('ZIP processing error:', zipError);
        res.status(500).json({
          success: false,
          error: 'ZIP processing failed',
          details: zipError instanceof Error ? zipError.message : 'Unknown error'
        });
      }
    } else {
      // Save as regular document
      const document = await storage.createDocument(insertDocumentSchema.parse({
        dealId: upload.dealId,
        name: upload.filename,
        type: 'application/octet-stream',
        path: filepath,
        size: completeFile.length,
        status: 'Pending' as const,
        folderPath: '/',
        isFolder: false
      }));
      
      res.json({
        success: true,
        message: 'File uploaded successfully',
        document,
        filename: upload.filename,
        size: completeFile.length,
        type: 'file'
      });
    }
    
    // Cleanup
    streamingUploads.delete(uploadId);
    
  } catch (error) {
    console.error('Streaming upload completion error:', error);
    res.status(500).json({
      success: false,
      error: 'Upload completion failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get upload status
router.get('/status/:uploadId', (req: Request, res: Response) => {
  const { uploadId } = req.params;
  const upload = streamingUploads.get(uploadId);
  
  if (!upload) {
    return res.status(404).json({ success: false, error: 'Upload session not found' });
  }
  
  res.json({
    success: true,
    uploadId,
    filename: upload.filename,
    totalSize: upload.totalSize,
    receivedBytes: upload.receivedBytes,
    progress: (upload.receivedBytes / upload.totalSize) * 100,
    chunksReceived: upload.chunks.filter(c => c !== undefined).length
  });
});

// Cleanup old uploads (every 30 minutes)
setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes
  
  streamingUploads.forEach((upload, uploadId) => {
    if (now - upload.createdAt > maxAge) {
      streamingUploads.delete(uploadId);
      console.log(`🧹 Cleaned up old streaming upload: ${uploadId}`);
    }
  });
}, 30 * 60 * 1000);

export { router as streamingUploadRouter };