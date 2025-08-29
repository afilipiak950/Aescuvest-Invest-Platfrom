// 🚀 STREAM-BASED UPLOAD - BYPASS ALL 413 LIMITS
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { documents as documentsTable } from '../../shared/schema';

const router = Router();

// ULTRA-BYPASS: Stream directly to disk without buffering
router.post('/api/deals/:dealId/stream-upload', async (req, res) => {
  const dealId = parseInt(req.params.dealId);
  const timestamp = Date.now();
  
  console.log(`
🚀 STREAM UPLOAD INITIATED:
- Deal ID: ${dealId}
- Content-Length: ${req.headers['content-length']}
- Content-Type: ${req.headers['content-type']}
- Timestamp: ${timestamp}
`);

  // Create upload directory
  const uploadDir = path.join(process.cwd(), 'uploads', 'stream');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Generate unique filename
  const fileName = `deal-${dealId}-${timestamp}.zip`;
  const filePath = path.join(uploadDir, fileName);
  
  // Create write stream
  const writeStream = fs.createWriteStream(filePath);
  let bytesReceived = 0;
  let lastProgressUpdate = Date.now();
  
  // Disable all timeouts
  req.setTimeout(0);
  res.setTimeout(0);
  
  // Track upload progress
  req.on('data', (chunk) => {
    bytesReceived += chunk.length;
    writeStream.write(chunk);
    
    // Log progress every second
    const now = Date.now();
    if (now - lastProgressUpdate > 1000) {
      console.log(`📦 Stream progress: ${bytesReceived} bytes received`);
      lastProgressUpdate = now;
    }
  });
  
  // Handle upload completion
  req.on('end', async () => {
    writeStream.end();
    
    console.log(`
✅ STREAM UPLOAD COMPLETE:
- Total bytes: ${bytesReceived}
- File saved: ${filePath}
`);
    
    try {
      // Save to database
      const [document] = await db.insert(documentsTable).values({
        dealId,
        name: fileName,
        content: `Stream uploaded: ${bytesReceived} bytes`,
        uploadDate: new Date(),
        aiSummary: null,
        size: bytesReceived
      }).returning();
      
      res.json({
        success: true,
        message: 'File uploaded successfully via stream',
        documentId: document.id,
        fileName,
        size: bytesReceived
      });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({
        success: false,
        error: 'Database error after successful upload'
      });
    }
  });
  
  // Handle errors
  req.on('error', (err) => {
    console.error('❌ Stream upload error:', err);
    writeStream.destroy();
    fs.unlinkSync(filePath);
    res.status(500).json({
      success: false,
      error: err.message
    });
  });
  
  writeStream.on('error', (err) => {
    console.error('❌ Write stream error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to write file'
    });
  });
});

// RAW BODY UPLOAD - No parsing at all
router.post('/api/deals/:dealId/raw-upload', (req, res) => {
  const dealId = parseInt(req.params.dealId);
  
  console.log(`
🔧 RAW UPLOAD - NO BODY PARSING:
- Deal ID: ${dealId}
- Headers: ${JSON.stringify(req.headers, null, 2)}
`);
  
  const chunks: Buffer[] = [];
  
  req.on('data', (chunk) => {
    chunks.push(chunk);
    console.log(`📦 Raw chunk: ${chunk.length} bytes`);
  });
  
  req.on('end', () => {
    const buffer = Buffer.concat(chunks);
    console.log(`✅ Raw upload complete: ${buffer.length} bytes`);
    
    // Save to file
    const fileName = `raw-${dealId}-${Date.now()}.zip`;
    const filePath = path.join(process.cwd(), 'uploads', fileName);
    
    fs.writeFile(filePath, buffer, (err) => {
      if (err) {
        console.error('❌ Write error:', err);
        res.status(500).json({ error: 'Failed to save file' });
      } else {
        res.json({
          success: true,
          fileName,
          size: buffer.length
        });
      }
    });
  });
});

export default router;