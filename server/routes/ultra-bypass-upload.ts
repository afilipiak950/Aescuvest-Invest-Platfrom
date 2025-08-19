// 🚨 ULTRA-BYPASS UPLOAD - COMPLETE 413 ELIMINATION
import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { documents as documentsTable } from '../../shared/schema';
import { zipProcessor } from '../services/zipProcessor';

const router = Router();

// 🔥 ULTRA-BYPASS: Direct raw body handler with NO middleware
router.post('/api/deals/:dealId/ultra-bypass-upload', async (req: Request, res: Response) => {
  console.log('🚨 ULTRA-BYPASS UPLOAD ACTIVATED');
  console.log(`📊 Headers: ${JSON.stringify(req.headers)}`);
  
  try {
    const dealId = parseInt(req.params.dealId);
    const fileName = req.headers['x-file-name'] as string || 'upload.zip';
    const fileSize = parseInt(req.headers['content-length'] || '0');
    
    console.log(`🎯 Deal ID: ${dealId}, File: ${fileName}, Size: ${fileSize} bytes`);
    
    // Create upload directory
    const uploadDir = path.join(process.cwd(), 'uploads', 'ultra-bypass');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const filePath = path.join(uploadDir, `${Date.now()}-${fileName}`);
    const writeStream = fs.createWriteStream(filePath);
    
    let bytesReceived = 0;
    
    // Stream directly to disk with progress tracking
    req.on('data', (chunk) => {
      bytesReceived += chunk.length;
      writeStream.write(chunk);
      
      // Send progress updates
      if (bytesReceived % (10 * 1024 * 1024) === 0) { // Every 10MB
        console.log(`📦 Progress: ${bytesReceived}/${fileSize} bytes (${Math.round(bytesReceived/fileSize*100)}%)`);
      }
    });
    
    req.on('end', async () => {
      writeStream.end();
      console.log(`✅ File received: ${bytesReceived} bytes`);
      
      try {
        // Create document record
        const [document] = await db.insert(documentsTable).values({
          dealId,
          name: fileName,
          content: filePath,
          uploadStatus: 'processing' as const,
          processingStatus: 'pending' as const,
          type: 'dataroom' as const,
          uploadDate: new Date(),
          fileSize: bytesReceived
        }).returning();
        
        console.log(`📄 Document created with ID: ${document.id}`);
        
        // Process ZIP in background
        if (fileName.endsWith('.zip')) {
          console.log('🗂️ Starting ZIP processing...');
          zipProcessor.processDataRoomZip(dealId, filePath, document.id).catch(err => {
            console.error('❌ ZIP processing failed:', err);
          });
        }
        
        res.json({
          success: true,
          message: 'File uploaded via ultra-bypass',
          documentId: document.id,
          bytesReceived
        });
      } catch (dbError) {
        console.error('❌ Database error:', dbError);
        res.status(500).json({
          success: false,
          error: 'Database error after upload'
        });
      }
    });
    
    req.on('error', (error) => {
      console.error('❌ Upload stream error:', error);
      writeStream.destroy();
      fs.unlinkSync(filePath);
      res.status(500).json({
        success: false,
        error: 'Upload stream failed'
      });
    });
    
  } catch (error) {
    console.error('❌ Ultra-bypass upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Ultra-bypass upload failed'
    });
  }
});

// 🧪 TEST ENDPOINT: Verify ultra-bypass is working
router.post('/api/test-ultra-bypass', (req: Request, res: Response) => {
  console.log('🧪 ULTRA-BYPASS TEST HIT');
  console.log(`📊 Content-Length: ${req.headers['content-length']}`);
  
  let bytesReceived = 0;
  
  req.on('data', (chunk) => {
    bytesReceived += chunk.length;
  });
  
  req.on('end', () => {
    console.log(`✅ Test received ${bytesReceived} bytes`);
    res.json({
      success: true,
      bytesReceived,
      message: 'Ultra-bypass test successful'
    });
  });
});

export default router;