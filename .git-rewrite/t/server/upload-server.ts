import express from 'express';
import multer from 'multer';

const uploadApp = express();
const PORT = 5001;

// Enable CORS for cross-origin requests
uploadApp.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Parse JSON bodies
uploadApp.use(express.json());

// Setup multer
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  }
});

// Upload route
uploadApp.post('/upload-analyze', upload.array('files', 10), async (req, res) => {
  console.log('🎯 UPLOAD SERVER HIT!');
  console.log('Files:', req.files?.length || 0);
  console.log('Deal ID:', req.body?.dealId);
  
  try {
    res.setHeader('Content-Type', 'application/json');
    
    const files = req.files as Express.Multer.File[];
    const dealId = req.body.dealId;
    
    if (!files || files.length === 0) {
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

    console.log('✅ Upload success:', uploadedFiles.length, 'files');
    
    return res.status(200).json({
      success: true,
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      files: uploadedFiles,
      dealId: dealId || null
    });

  } catch (error) {
    console.error('💥 Upload error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Upload failed', 
      error: String(error) 
    });
  }
});

// Health check
uploadApp.get('/health', (req, res) => {
  res.json({ status: 'Upload server running', port: PORT });
});

uploadApp.listen(PORT, () => {
  console.log(`🚀 Upload server running on port ${PORT}`);
});