// 🧪 TEST ENDPOINT FOR UPLOAD LIMITS
import { Router } from 'express';
import multer from 'multer';

const router = Router();

// Test endpoint to check exact limits
router.post('/api/test-upload-limit', (req, res) => {
  const contentLength = req.headers['content-length'];
  
  console.log(`
🧪 TEST UPLOAD LIMIT ENDPOINT HIT:
- Content-Length: ${contentLength}
- Method: ${req.method}
- Headers: ${JSON.stringify(req.headers, null, 2)}
- Body Parser Active: ${!!(req as any).body}
- Environment: ${process.env.NODE_ENV}
- Platform: ${process.env.K_SERVICE ? 'Cloud Run' : 'Replit'}
`);

  // Try to read the body
  let bodySize = 0;
  req.on('data', (chunk) => {
    bodySize += chunk.length;
    console.log(`📦 Received chunk: ${chunk.length} bytes (total: ${bodySize})`);
  });

  req.on('end', () => {
    console.log(`✅ Request complete. Total size: ${bodySize} bytes`);
    res.json({
      success: true,
      receivedBytes: bodySize,
      contentLengthHeader: contentLength,
      platform: process.env.K_SERVICE ? 'Cloud Run' : 'Replit'
    });
  });

  req.on('error', (err) => {
    console.error('❌ Request error:', err);
    res.status(500).json({ error: err.message });
  });
});

// Test with different multer configurations
const testMulter = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Infinity
  }
});

router.post('/api/test-multer-upload', testMulter.single('file'), (req, res) => {
  console.log(`
🧪 MULTER TEST ENDPOINT:
- File received: ${req.file ? 'YES' : 'NO'}
- File size: ${req.file?.size || 'N/A'}
- File name: ${req.file?.originalname || 'N/A'}
`);

  if (req.file) {
    res.json({
      success: true,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });
  } else {
    res.status(400).json({
      success: false,
      error: 'No file received'
    });
  }
});

export default router;