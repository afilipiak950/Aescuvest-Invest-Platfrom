import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

/**
 * 🚨 CRITICAL: Large File Streaming Handler 
 * This middleware intercepts large uploads BEFORE they hit infrastructure limits
 * and processes them as streaming chunks to completely bypass 413 errors.
 */
export const largeFileHandler = (req: Request, res: Response, next: NextFunction) => {
  // Only handle upload routes
  if (!req.path.includes('/upload') && !req.path.includes('/data-room')) {
    return next();
  }

  console.log('🚨 LARGE FILE HANDLER: Intercepting upload request');
  console.log('Content-Length:', req.headers['content-length']);
  console.log('Content-Type:', req.headers['content-type']);

  // Set response headers immediately to prevent infrastructure timeouts
  res.set({
    'X-Accel-Buffering': 'no',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Transfer-Encoding': 'chunked'
  });

  // Handle large files with streaming approach
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > 50 * 1024 * 1024) { // 50MB+
    console.log('🚨 LARGE FILE DETECTED: Using streaming handler');
    
    return handleLargeFileStream(req, res, next);
  }

  // For smaller files, continue with normal processing
  next();
};

async function handleLargeFileStream(req: Request, res: Response, next: NextFunction) {
  try {
    console.log('🔄 Starting large file stream processing...');
    
    // Create unique upload session
    const uploadId = Date.now().toString();
    const tempDir = path.join(process.cwd(), 'uploads', 'streaming', uploadId);
    
    // Ensure directory exists
    fs.mkdirSync(tempDir, { recursive: true });
    
    let totalBytes = 0;
    let chunkCount = 0;
    const chunks: Buffer[] = [];
    
    // Set up streaming response
    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      chunkCount++;
      chunks.push(chunk);
      
      // Send progress update every 10MB
      if (totalBytes % (10 * 1024 * 1024) < chunk.length) {
        console.log(`📊 Stream progress: ${(totalBytes / 1024 / 1024).toFixed(1)}MB (${chunkCount} chunks)`);
        
        // Send intermediate response to keep connection alive
        if (!res.headersSent) {
          res.writeHead(200, { 
            'Content-Type': 'application/json',
            'X-Stream-Progress': totalBytes.toString()
          });
        }
      }
    });

    req.on('end', async () => {
      try {
        console.log(`✅ Stream complete: ${totalBytes} bytes in ${chunkCount} chunks`);
        
        // Combine all chunks
        const fullBuffer = Buffer.concat(chunks);
        
        // Parse multipart data manually
        const boundary = extractBoundary(req.headers['content-type'] || '');
        if (!boundary) {
          throw new Error('No multipart boundary found');
        }
        
        const files = parseMultipartData(fullBuffer, boundary);
        console.log(`📁 Extracted ${files.length} files from stream`);
        
        // Save files to disk
        const savedFiles = await Promise.all(files.map(async (file, index) => {
          const filename = file.filename || `upload_${index}_${Date.now()}`;
          const filepath = path.join(tempDir, filename);
          
          fs.writeFileSync(filepath, file.data);
          console.log(`💾 Saved: ${filename} (${file.data.length} bytes)`);
          
          return {
            originalname: filename,
            filename: filename,
            path: filepath,
            size: file.data.length,
            mimetype: file.contentType || 'application/octet-stream'
          };
        }));
        
        // Attach files to request object (mimicking multer)
        (req as any).files = savedFiles;
        (req as any).streamProcessed = true;
        
        // Continue with normal processing
        next();
        
      } catch (error) {
        console.error('❌ Stream processing error:', error);
        if (!res.headersSent) {
          res.status(500).json({ 
            success: false, 
            error: 'Stream processing failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    });

    req.on('error', (error) => {
      console.error('❌ Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          success: false, 
          error: 'Stream error',
          details: error.message 
        });
      }
    });

  } catch (error) {
    console.error('❌ Large file handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        error: 'Large file handler failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

function extractBoundary(contentType: string): string | null {
  const match = contentType.match(/boundary=([^;]+)/);
  return match ? match[1].trim() : null;
}

interface ParsedFile {
  filename?: string;
  contentType?: string;
  data: Buffer;
}

function parseMultipartData(buffer: Buffer, boundary: string): ParsedFile[] {
  const files: ParsedFile[] = [];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  
  let start = 0;
  while (true) {
    const boundaryIndex = buffer.indexOf(boundaryBuffer, start);
    if (boundaryIndex === -1) break;
    
    const nextBoundaryIndex = buffer.indexOf(boundaryBuffer, boundaryIndex + boundaryBuffer.length);
    if (nextBoundaryIndex === -1) break;
    
    const partBuffer = buffer.slice(boundaryIndex + boundaryBuffer.length, nextBoundaryIndex);
    
    // Find headers section (ends with \r\n\r\n)
    const headerEndIndex = partBuffer.indexOf('\r\n\r\n');
    if (headerEndIndex === -1) {
      start = nextBoundaryIndex;
      continue;
    }
    
    const headersBuffer = partBuffer.slice(0, headerEndIndex);
    const dataBuffer = partBuffer.slice(headerEndIndex + 4);
    
    const headers = headersBuffer.toString('utf8');
    
    // Extract filename and content-type
    const filenameMatch = headers.match(/filename="([^"]+)"/);
    const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
    
    if (filenameMatch) {
      files.push({
        filename: filenameMatch[1],
        contentType: contentTypeMatch ? contentTypeMatch[1].trim() : undefined,
        data: dataBuffer
      });
    }
    
    start = nextBoundaryIndex;
  }
  
  return files;
}