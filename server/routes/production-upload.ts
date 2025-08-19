import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { storage } from '../storage';
import { insertDocumentSchema, type Document } from '../../shared/schema';

const router = express.Router();

/**
 * 🚨 PRODUCTION BYPASS: Direct streaming upload endpoint
 * This completely bypasses all infrastructure limitations by processing
 * the raw request stream directly without multer or body parsers.
 */
router.post('/bypass-upload/:dealId', async (req: Request, res: Response) => {
  const dealId = parseInt(req.params.dealId);
  
  console.log('🚨 PRODUCTION BYPASS UPLOAD: Processing direct stream');
  console.log('Deal ID:', dealId);
  console.log('Content-Length:', req.headers['content-length']);
  console.log('Content-Type:', req.headers['content-type']);

  // Set streaming response headers immediately
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'X-Accel-Buffering': 'no',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  try {
    const uploadId = `bypass_${Date.now()}`;
    const tempDir = path.join(process.cwd(), 'uploads', 'bypass', uploadId);
    fs.mkdirSync(tempDir, { recursive: true });

    let totalBytes = 0;
    const chunks: Buffer[] = [];
    let progressReported = 0;

    // Process raw stream
    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      chunks.push(chunk);
      
      // Report progress every 10MB to keep connection alive
      const currentMB = Math.floor(totalBytes / (10 * 1024 * 1024));
      if (currentMB > progressReported) {
        progressReported = currentMB;
        console.log(`📊 Bypass upload progress: ${(totalBytes / 1024 / 1024).toFixed(1)}MB`);
      }
    });

    req.on('end', async () => {
      try {
        console.log(`✅ Bypass stream complete: ${totalBytes} bytes`);
        
        const fullBuffer = Buffer.concat(chunks);
        
        // Check if this is a ZIP file based on magic number
        const isZip = fullBuffer.length >= 4 && 
                     fullBuffer[0] === 0x50 && fullBuffer[1] === 0x4B;
        
        if (isZip) {
          // Handle as ZIP file
          const zipFilename = `bypass_upload_${Date.now()}.zip`;
          const zipPath = path.join(tempDir, zipFilename);
          
          fs.writeFileSync(zipPath, fullBuffer);
          console.log(`💾 ZIP file saved: ${zipPath} (${fullBuffer.length} bytes)`);
          
          // Process ZIP file similar to data room upload
          const { zipProcessor } = require('../services/zipProcessor');
          await zipProcessor.processZipFile(zipPath, dealId);
          
          res.json({
            success: true,
            message: 'ZIP file uploaded and processed successfully',
            bytes: totalBytes,
            type: 'zip'
          });
          
        } else {
          // Handle as individual file(s) - parse multipart if present
          const files = await parseUploadData(fullBuffer, req.headers['content-type'] || '');
          
          const savedFiles = await Promise.all(files.map(async (file, index) => {
            const filename = file.filename || `bypass_file_${index}_${Date.now()}`;
            const filepath = path.join(tempDir, filename);
            
            fs.writeFileSync(filepath, file.data);
            console.log(`💾 File saved: ${filename} (${file.data.length} bytes)`);
            
            // Save to database
            const document = await storage.createDocument(insertDocumentSchema.parse({
              dealId,
              name: filename,
              type: file.contentType || 'application/octet-stream',
              path: filepath,
              size: file.data.length,
              status: 'Pending' as const,
              folderPath: '/',
              isFolder: false
            }));
            
            return document;
          }));
          
          res.json({
            success: true,
            message: `${files.length} file(s) uploaded successfully`,
            files: savedFiles.length,
            bytes: totalBytes,
            type: 'files'
          });
        }
        
        // Cleanup temp directory after some delay
        setTimeout(() => {
          try {
            fs.rmSync(tempDir, { recursive: true, force: true });
          } catch (error) {
            console.error('Temp cleanup error:', error);
          }
        }, 60000); // 1 minute
        
      } catch (error) {
        console.error('❌ Bypass processing error:', error);
        res.status(500).json({
          success: false,
          error: 'Processing failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    req.on('error', (error) => {
      console.error('❌ Bypass stream error:', error);
      res.status(500).json({
        success: false,
        error: 'Stream error',
        details: error.message
      });
    });

  } catch (error) {
    console.error('❌ Bypass upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Handle OPTIONS for CORS
router.options('/bypass-upload/:dealId', (req: Request, res: Response) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400'
  });
  res.sendStatus(200);
});

interface ParsedFile {
  filename?: string;
  contentType?: string;
  data: Buffer;
}

async function parseUploadData(buffer: Buffer, contentType: string): Promise<ParsedFile[]> {
  // If it's multipart, parse it
  if (contentType.includes('multipart/form-data')) {
    const boundary = extractBoundary(contentType);
    if (boundary) {
      return parseMultipartData(buffer, boundary);
    }
  }
  
  // Otherwise, treat as single file
  return [{
    filename: `bypass_upload_${Date.now()}`,
    contentType: contentType || 'application/octet-stream',
    data: buffer
  }];
}

function extractBoundary(contentType: string): string | null {
  const match = contentType.match(/boundary=([^;]+)/);
  return match ? match[1].trim().replace(/"/g, '') : null;
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
    
    // Find headers section
    const headerEndIndex = partBuffer.indexOf('\r\n\r\n');
    if (headerEndIndex === -1) {
      start = nextBoundaryIndex;
      continue;
    }
    
    const headersBuffer = partBuffer.slice(0, headerEndIndex);
    const dataBuffer = partBuffer.slice(headerEndIndex + 4);
    
    // Remove trailing \r\n from data
    const cleanDataBuffer = dataBuffer.slice(0, -2);
    
    const headers = headersBuffer.toString('utf8');
    
    // Extract filename and content-type
    const filenameMatch = headers.match(/filename="([^"]+)"/);
    const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
    
    if (filenameMatch || dataBuffer.length > 0) {
      files.push({
        filename: filenameMatch ? filenameMatch[1] : undefined,
        contentType: contentTypeMatch ? contentTypeMatch[1].trim() : undefined,
        data: cleanDataBuffer
      });
    }
    
    start = nextBoundaryIndex;
  }
  
  return files;
}

export { router as productionUploadRouter };