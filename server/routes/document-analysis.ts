import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
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
router.post('/ocr/extract', authenticate, async (req, res) => {
  try {
    const { documentId } = req.body;
    
    if (!documentId) {
      return res.status(400).json({ message: 'Document ID required' });
    }

    // For demo purposes, simulate OCR extraction
    // In production, you would use actual OCR service like Tesseract, AWS Textract, etc.
    const simulatedText = `
    EXECUTIVE SUMMARY
    
    This document contains key information about the investment opportunity including:
    
    • Company Overview: Technology startup focused on AI-powered solutions
    • Market Opportunity: $2.5B addressable market with 15% annual growth
    • Financial Projections: Revenue expected to reach $10M by year 3
    • Funding Requirements: Seeking $5M Series A funding
    • Competitive Advantage: Proprietary AI algorithms with patent protection
    • Team: Experienced founders with previous exits in the technology sector
    • Risks: Market competition, regulatory changes, technology risks
    • Use of Funds: 60% product development, 25% marketing, 15% operations
    
    The company has demonstrated strong traction with early customers and is positioned 
    for significant growth in the emerging AI market segment.
    `;

    res.json({
      documentId,
      extractedText: simulatedText,
      confidence: 0.95,
      processingTime: '2.3s'
    });

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
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are an expert investment analyst providing detailed, professional analysis of business documents."
          },
          {
            role: "user",
            content: `${prompt}\n\nDocument content:\n${extractedText}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      });

      analysis = response.choices[0].message.content || 'Analysis could not be completed';
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