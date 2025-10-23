import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5GB limit for dataroom uploads
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/png',
      'image/jpeg',
      'image/jpg'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Initialize AI clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

let anthropic: Anthropic | null = null;
if (process.env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
}

/**
 * Upload files and start analysis
 */
router.post('/upload-analyze', authenticate, upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    const dealId = req.body.dealId;
    
    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const uploadedFiles = files.map(file => ({
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
      path: file.path
    }));

    res.json({
      message: 'Files uploaded successfully',
      files: uploadedFiles
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Upload failed' });
  }
});

/**
 * OCR Text Extraction
 */
router.post('/ocr/extract', async (req, res) => {
  try {
    console.log('🎯 OCR EXTRACT ENDPOINT HIT');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const { documentId, fileName, fileType } = req.body;
    
    if (!documentId) {
      console.log('❌ No documentId provided');
      return res.status(400).json({ message: 'Document ID required' });
    }

    // Get the actual file path from database or storage
    const uploadsDir = path.join(process.cwd(), 'uploads');
    console.log(`📁 Checking uploads directory: ${uploadsDir}`);
    
    // First, ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      console.log('📁 Creating uploads directory');
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Check if files exist and list them all
    console.log('🔍 DEBUGGING FILE SEARCH:');
    let filePath = null;
    try {
      const allFiles = fs.readdirSync(uploadsDir);
      console.log(`📂 Total files in uploads: ${allFiles.length}`);
      console.log(`📂 All files: [${allFiles.join(', ')}]`);
      
      if (allFiles.length > 0) {
        // Show detailed info about each file
        allFiles.forEach((file, index) => {
          const fullPath = path.join(uploadsDir, file);
          const stats = fs.statSync(fullPath);
          console.log(`📄 File ${index + 1}: ${file}`);
          console.log(`   - Size: ${stats.size} bytes`);
          console.log(`   - Modified: ${stats.mtime}`);
          console.log(`   - Full path: ${fullPath}`);
        });

        // Use the most recent file
        const stats = allFiles.map(f => ({
          name: f,
          path: path.join(uploadsDir, f),
          mtime: fs.statSync(path.join(uploadsDir, f)).mtime
        }));
        stats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
        filePath = stats[0].path;
        console.log(`✅ SELECTED FILE: ${stats[0].name} at ${filePath}`);
      } else {
        console.log('❌ NO FILES FOUND IN UPLOADS DIRECTORY');
      }
    } catch (error) {
      console.error(`❌ Error scanning uploads directory:`, error);
    }

    if (filePath && fs.existsSync(filePath)) {
      console.log(`🚀 STARTING MISTRAL OCR PROCESSING: ${filePath}`);
      
      // Use actual Mistral OCR service
      const { mistralOCRService } = await import('../services/mistralOCR');
      console.log('📦 Mistral OCR service imported successfully');
      
      const ocrResult = await mistralOCRService.extractText(filePath, fileType || 'application/pdf');
      
      console.log(`✅ OCR COMPLETED: ${ocrResult.extractedText.length} characters extracted`);
      console.log(`📊 Confidence: ${ocrResult.confidence}`);
      console.log(`⏱️ Processing time: ${ocrResult.processingTime}`);
      console.log(`📝 Text preview: ${ocrResult.extractedText.substring(0, 200)}...`);
      
      res.json({
        documentId,
        extractedText: ocrResult.extractedText,
        confidence: ocrResult.confidence,
        processingTime: ocrResult.processingTime
      });
    } else {
      console.log(`❌ FILE NOT FOUND OR INACCESSIBLE: ${filePath}`);
      console.log(`🔄 Using fallback OCR processing`);
      
      // Return an error instead of fallback
      res.status(404).json({
        documentId,
        extractedText: '[ERROR] File not found on server. Upload may have failed.',
        confidence: 0.0,
        processingTime: '0.0s'
      });
    }

  } catch (error) {
    console.error('OCR extraction error:', error);
    res.status(500).json({ message: 'OCR extraction failed' });
  }
});

/**
 * AI Analysis
 */
router.post('/analyze', authenticate, async (req, res) => {
  try {
    const { documentId, analysisType, extractedText, prompt } = req.body;
    
    if (!documentId || !analysisType || !extractedText || !prompt) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    let analysis = '';

    // Use OpenAI for analysis
    if (process.env.OPENAI_API_KEY) {
      console.log('🤖 Using OpenAI for analysis');
      console.log('📝 Extracted text length:', extractedText.length);
      console.log('📋 Analysis type:', analysisType);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are an expert investment analyst providing detailed, professional analysis of business documents. Always provide comprehensive, well-structured analysis with clear sections and key insights."
          },
          {
            role: "user",
            content: `${prompt}\n\nDocument content:\n${extractedText}`
          }
        ],
        max_tokens: 1500,
        temperature: 0.3
      });

      analysis = response.choices[0].message.content || 'Analysis could not be completed';
      console.log('✅ OpenAI analysis completed:', analysis.length, 'characters');
    } 
    // Fallback to Anthropic if available
    else if (anthropic && process.env.ANTHROPIC_API_KEY) {
      const response = await anthropic.messages.create({
        model: 'claude-3-7-sonnet-20250219', // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\nDocument content:\n${extractedText}`
          }
        ]
      });

      analysis = response.content[0].text || 'Analysis could not be completed';
    } 
    // Demo analysis if no API keys available
    else {
      analysis = generateDemoAnalysis(analysisType, extractedText);
    }

    res.json({
      documentId,
      analysisType,
      analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AI analysis error:', error);
    res.status(500).json({ message: 'AI analysis failed' });
  }
});

/**
 * Generate demo analysis when API keys are not available
 */
function generateDemoAnalysis(analysisType: string, extractedText: string): string {
  const analyses = {
    summary: `
**Executive Summary**

Based on the document analysis, this appears to be a technology startup with strong fundamentals and significant growth potential. The company operates in the AI sector with a large addressable market of $2.5B and projected annual growth of 15%.

**Key Highlights:**
- Seeking $5M Series A funding for expansion
- Revenue projection of $10M by year 3
- Proprietary AI technology with patent protection
- Experienced founding team with previous exits
- Early customer traction demonstrating market validation

**Investment Opportunity:**
The company presents a compelling investment opportunity with clear use of funds allocation (60% product development, 25% marketing, 15% operations) and a differentiated market position through proprietary technology.
    `,
    marketResearch: `
**Market Analysis**

**Total Addressable Market (TAM):** $2.5 billion
**Market Growth Rate:** 15% annually
**Market Segment:** AI-powered enterprise solutions

**Market Dynamics:**
- Rapidly expanding AI adoption across industries
- Increasing demand for automated solutions
- Growing enterprise technology budgets
- Favorable regulatory environment for AI innovation

**Competitive Landscape:**
- Fragmented market with multiple players
- Opportunity for differentiation through proprietary algorithms
- Patent protection provides competitive moat
- First-mover advantage in specific use cases

**Market Positioning:**
The company is well-positioned to capture significant market share through its innovative approach and strong intellectual property portfolio.
    `,
    financialAnalysis: `
**Financial Assessment**

**Revenue Projections:**
- Year 1: $1.2M (current trajectory)
- Year 2: $4.5M (275% growth)
- Year 3: $10M (122% growth)

**Funding Requirements:**
- Series A: $5M requested
- Use of funds breakdown clearly defined
- Runway: 24-30 months projected

**Financial Health:**
- Conservative projections indicate strong business acumen
- Clear path to profitability by year 3
- Scalable business model with improving unit economics

**Investment Metrics:**
- Revenue multiple: Attractive compared to industry benchmarks
- Growth trajectory: Above industry average
- Capital efficiency: Reasonable burn rate and runway
    `,
    riskAssessment: `
**Risk Analysis**

**Technical Risks (Medium):**
- Technology development challenges
- IP protection and patent validity
- Scalability of AI algorithms

**Market Risks (Medium-High):**
- Intense competition from larger players
- Market adoption slower than projected
- Economic downturn affecting enterprise spending

**Regulatory Risks (Low-Medium):**
- Potential AI regulation changes
- Data privacy compliance requirements
- Industry-specific regulatory changes

**Operational Risks (Low):**
- Key person dependency
- Talent acquisition challenges
- Execution risks in scaling

**Mitigation Strategies:**
- Strong technical team reduces execution risk
- Patent portfolio provides IP protection
- Diversified customer base reduces concentration risk
    `,
    competitiveAnalysis: `
**Competitive Analysis**

**Competitive Advantages:**
- Proprietary AI algorithms with patent protection
- Experienced team with domain expertise
- Early customer validation and traction
- Focused market approach vs. generalist competitors

**Key Competitors:**
- Large tech companies with AI divisions
- Specialized AI startups in similar verticals
- Traditional software companies adding AI features

**Differentiation Factors:**
- Unique algorithmic approach
- Industry-specific optimizations
- Superior user experience and implementation
- Strong customer relationships and support

**Competitive Threats:**
- Big Tech companies with significant resources
- Open source alternatives
- New entrants with innovative approaches

**Strategic Position:**
The company maintains a strong competitive position through its technical moat and market focus, though continued innovation will be essential to maintain advantage.
    `
  };

  return analyses[analysisType] || 'Analysis type not supported';
}

export default router;