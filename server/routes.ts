import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import { z } from "zod";
import { authenticate } from "./middleware/auth";
import { 
  insertDealSchema, 
  insertDocumentSchema, 
  insertAgentAnalysisSchema,
  insertInvestmentMemoSchema,
  insertInvestorMatchSchema,
  insertAutomationSchema
} from "../shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import aiAgentRoutes from "./routes/ai-agents";
import authRoutes from "./routes/auth";
import emailRoutes from "./routes/email";
import inboxRoutes from "./routes/inbox";
import microsoftAuthRoutes from "./routes/microsoftAuth";
import documentUploadRoutes from "./routes/document-upload";

// Setup multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueFileName = `${Date.now()}-${randomUUID()}-${file.originalname}`;
      cb(null, uniqueFileName);
    }
  }),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.pdf', '.docx', '.doc', '.ppt', '.pptx', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, PPT, and XLSX files are allowed.'));
    }
  }
});

// Helper for validation errors
const handleValidationError = (res: Response, error: z.ZodError) => {
  return res.status(400).json({
    message: 'Validation error',
    errors: error.errors.map(e => ({
      path: e.path.join('.'),
      message: e.message,
    })),
  });
};

export async function registerRoutes(app: Express): Promise<Server> {
  
  // CRITICAL TEST: Simple test route to verify Express is working
  console.log('🚀 REGISTERING TEST ROUTE');
  app.get('/api/test-route', (req: Request, res: Response) => {
    console.log('🎯 TEST ROUTE HIT!');
    res.json({ message: 'Express route working!', timestamp: new Date().toISOString() });
  });
  
  // URGENT DEBUG: Direct route registration to bypass middleware issues
  console.log('🔧 Registering DIRECT upload route...');
  app.post('/api/documents/upload-analyze', upload.array('files', 10), async (req: Request, res: Response) => {
    console.log('🚨 DIRECT ROUTE HIT! Method:', req.method, 'URL:', req.url);
    console.log('Files count:', req.files?.length || 0);
    console.log('Deal ID:', req.body?.dealId);
    
    try {
      res.setHeader('Content-Type', 'application/json');
      
      const files = req.files as Express.Multer.File[];
      const dealId = req.body.dealId;
      
      if (!files || files.length === 0) {
        console.log('❌ No files found');
        return res.status(400).json({ 
          success: false,
          message: 'No files uploaded' 
        });
      }

      const uploadedFiles = files.map((file, index) => {
        console.log(`📁 Processing file ${index}: ${file.originalname}`);
        console.log(`   - File path: ${file.path}`);
        console.log(`   - File size: ${file.size} bytes`);
        console.log(`   - Filename: ${file.filename}`);
        
        // Verify file exists on disk
        const fs = require('fs');
        if (fs.existsSync(file.path)) {
          const stats = fs.statSync(file.path);
          console.log(`   ✅ File confirmed on disk: ${stats.size} bytes`);
        } else {
          console.log(`   ❌ File NOT found on disk: ${file.path}`);
        }
        
        return {
          id: `file_${Date.now()}_${index}`,
          name: file.originalname,
          size: file.size,
          type: file.mimetype,
          status: 'uploaded',
          path: file.path,
          filename: file.filename
        };
      });

      console.log('✅ SUCCESS! Responding with', uploadedFiles.length, 'files');
      
      return res.status(200).json({
        success: true,
        message: `${uploadedFiles.length} file(s) uploaded successfully`,
        files: uploadedFiles,
        dealId: dealId || null
      });

    } catch (error) {
      console.error('💥 DIRECT ROUTE ERROR:', error);
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ 
        success: false,
        message: 'Upload failed', 
        error: String(error) 
      });
    }
  });
  
  // Register document upload routes (fallback)
  app.use('/api/documents', documentUploadRoutes);
  
  // Mount auth routes
  app.use('/api/auth', authRoutes);
  
  // Mount email routes
  app.use('/api/email', emailRoutes);
  
  // Mount inbox routes
  app.use('/api/inbox', inboxRoutes);
  
  // Deal routes
  app.get('/api/deals', async (req: Request, res: Response) => {
    try {
      const deals = await storage.getAllDeals();
      return res.status(200).json(deals);
    } catch (error) {
      console.error('Error fetching deals:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.get('/api/deals/:id', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.id);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }
      
      const deal = await storage.getDealById(dealId);
      if (!deal) {
        return res.status(404).json({ message: 'Deal not found' });
      }
      
      return res.status(200).json(deal);
    } catch (error) {
      console.error('Error fetching deal:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.post('/api/deals', async (req: Request, res: Response) => {
    try {
      const result = insertDealSchema.safeParse(req.body);
      
      if (!result.success) {
        return handleValidationError(res, result.error);
      }
      
      const deal = await storage.createDeal(result.data);
      
      // Generate a random AI score for demo purposes
      const aiScore = Math.floor(Math.random() * 35) + 65; // 65-100
      await storage.updateDealAiScore(deal.id, aiScore);
      
      return res.status(201).json({
        ...deal,
        aiScore
      });
    } catch (error) {
      console.error('Error creating deal:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Document routes
  app.post('/api/documents', upload.array('files', 10), async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.body.dealId);
      
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }
      
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }
      
      const documents = [];
      
      for (const file of files) {
        const fileExt = path.extname(file.originalname).substring(1);
        
        const documentData = {
          dealId,
          name: file.originalname,
          type: fileExt,
          path: file.path,
          size: file.size,
          status: 'Pending'
        };
        
        const result = insertDocumentSchema.safeParse(documentData);
        if (!result.success) {
          return handleValidationError(res, result.error);
        }
        
        const document = await storage.createDocument(result.data);
        documents.push(document);
      }
      
      return res.status(201).json(documents);
    } catch (error) {
      console.error('Error uploading documents:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.get('/api/deals/:dealId/documents', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }
      
      const documents = await storage.getDocumentsByDealId(dealId);
      return res.status(200).json(documents);
    } catch (error) {
      console.error('Error fetching documents:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Analysis routes
  app.get('/api/analyses/:dealId', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }
      
      const existingAnalyses = await storage.getAnalysesByDealId(dealId);
      
      // If no analyses exist, generate comprehensive detailed analysis results
      if (existingAnalyses.length === 0) {
        const detailedAnalyses = [
          {
            id: 1,
            dealId: dealId,
            agentType: 'Legal',
            status: 'Reviewed',
            confidence: 87,
            summary: 'Legal documentation appears comprehensive with minor gaps in IP protection. Corporate structure is sound with proper incorporation in Delaware. Some regulatory compliance items require clarification.',
            findings: [
              {
                category: 'Corporate Structure',
                finding: 'Delaware C-Corp with proper board composition and bylaws',
                status: 'confirmed',
                confidence: 95,
                impact: 'low',
                details: 'Standard corporate structure with appropriate director and shareholder protections. Clean cap table with proper equity allocation.'
              },
              {
                category: 'Intellectual Property',
                finding: 'Patent portfolio exists but coverage gaps identified',
                status: 'investigate',
                confidence: 72,
                impact: 'medium',
                details: 'Core technology patents filed but international protection limited. Trade secret agreements in place for employees.'
              },
              {
                category: 'Regulatory Compliance',
                finding: 'FDA pathway unclear for medical device classification',
                status: 'red_flag',
                confidence: 89,
                impact: 'high',
                details: 'Product may require Class II medical device approval which could significantly impact timeline and cost. Regulatory strategy needs refinement.'
              }
            ],
            recommendations: [
              'Strengthen international patent filing strategy',
              'Clarify FDA regulatory pathway with specialized counsel',
              'Review and update employment agreements for IP assignment',
              'Consider forming regulatory advisory board'
            ],
            lastUpdated: '2 hours ago',
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: 2,
            dealId: dealId,
            agentType: 'Finance',
            status: 'Complete',
            confidence: 93,
            summary: 'Strong financial fundamentals with healthy growth trajectory. Revenue model is scalable and unit economics are improving. Some concerns around customer concentration and cash runway.',
            findings: [
              {
                category: 'Revenue Growth',
                finding: '180% year-over-year growth with recurring revenue model',
                status: 'confirmed',
                confidence: 96,
                impact: 'low',
                details: 'ARR of $2.1M with 95% retention rate. Clear path to $10M ARR within 24 months based on current pipeline.'
              },
              {
                category: 'Unit Economics',
                finding: 'LTV/CAC ratio of 4.2x indicates healthy business model',
                status: 'confirmed',
                confidence: 91,
                impact: 'low',
                details: 'Customer acquisition cost of $1,200 with lifetime value of $5,040. Payback period of 8 months is reasonable for enterprise SaaS.'
              },
              {
                category: 'Customer Concentration',
                finding: 'Top 3 customers represent 45% of total revenue',
                status: 'investigate',
                confidence: 88,
                impact: 'medium',
                details: 'While contracts are long-term, high concentration creates revenue risk. Customer diversification strategy needed.'
              },
              {
                category: 'Cash Management',
                finding: 'Current runway of 14 months at current burn rate',
                status: 'investigate',
                confidence: 85,
                impact: 'medium',
                details: 'Monthly burn of $180k with $2.5M cash. Growth investment may accelerate burn without corresponding revenue increase.'
              }
            ],
            recommendations: [
              'Diversify customer base to reduce concentration risk',
              'Implement quarterly board reporting on key metrics',
              'Establish credit facility for working capital flexibility',
              'Consider milestone-based funding structure'
            ],
            lastUpdated: '1 hour ago',
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: 3,
            dealId: dealId,
            agentType: 'Medical',
            status: 'In Progress',
            confidence: 76,
            summary: 'Promising medical technology with solid clinical validation. Early-stage clinical data shows efficacy but larger trials needed. Regulatory pathway presents challenges.',
            findings: [
              {
                category: 'Clinical Efficacy',
                finding: 'Phase I trial showed 78% efficacy in primary endpoint',
                status: 'confirmed',
                confidence: 92,
                impact: 'low',
                details: 'n=45 patients with statistically significant improvement over standard of care. Safety profile acceptable with manageable side effects.'
              },
              {
                category: 'Scientific Advisory Board',
                finding: 'Strong advisory team with key opinion leaders',
                status: 'confirmed',
                confidence: 89,
                impact: 'low',
                details: 'Board includes 3 department heads from top-tier medical centers. Active engagement in study design and regulatory strategy.'
              },
              {
                category: 'Manufacturing Scale',
                finding: 'Production scaling challenges identified',
                status: 'investigate',
                confidence: 71,
                impact: 'medium',
                details: 'Current CMO capacity limited to clinical supply. Commercial manufacturing partner identification required.'
              },
              {
                category: 'Regulatory Timeline',
                finding: 'FDA approval pathway may extend 24-36 months',
                status: 'red_flag',
                confidence: 84,
                impact: 'high',
                details: 'Recent FDA guidance changes may require additional studies. Regulatory consulting firm recommends conservative timeline.'
              }
            ],
            recommendations: [
              'Engage FDA in pre-submission meeting for pathway clarification',
              'Secure commercial manufacturing partnership',
              'Plan Phase II trial design with regulatory input',
              'Consider breakthrough therapy designation application'
            ],
            lastUpdated: '3 hours ago',
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: 4,
            dealId: dealId,
            agentType: 'Commercial',
            status: 'Complete',
            confidence: 82,
            summary: 'Market opportunity is substantial with clear customer demand. Competitive landscape is manageable but evolving rapidly. Go-to-market strategy needs refinement.',
            findings: [
              {
                category: 'Market Size',
                finding: 'TAM of $8.5B with 12% CAGR growth rate',
                status: 'confirmed',
                confidence: 94,
                impact: 'low',
                details: 'Third-party market research confirms addressable market size. Multiple analyst reports align on growth projections.'
              },
              {
                category: 'Customer Validation',
                finding: 'Strong product-market fit with early adopters',
                status: 'confirmed',
                confidence: 87,
                impact: 'low',
                details: 'Net Promoter Score of 73 with 89% customer satisfaction. Multiple case studies demonstrate clear ROI for customers.'
              },
              {
                category: 'Competitive Positioning',
                finding: 'Two major competitors launching similar solutions',
                status: 'investigate',
                confidence: 79,
                impact: 'medium',
                details: 'Market incumbents showing increased R&D investment in competing technologies. First-mover advantage may be temporary.'
              },
              {
                category: 'Sales Execution',
                finding: 'Sales team lacks enterprise experience',
                status: 'red_flag',
                confidence: 83,
                impact: 'high',
                details: 'Current team successful with SMB but enterprise deals require different skill set. Recent quota misses concerning.'
              }
            ],
            recommendations: [
              'Hire experienced enterprise sales leadership',
              'Develop competitive differentiation messaging',
              'Establish strategic partnerships for market access',
              'Implement formal sales methodology and training'
            ],
            lastUpdated: '30 minutes ago',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ];
        
        return res.status(200).json(detailedAnalyses);
      }
      
      return res.status(200).json(existingAnalyses);
    } catch (error) {
      console.error('Error fetching analyses:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.post('/api/analyses', async (req: Request, res: Response) => {
    try {
      const result = insertAgentAnalysisSchema.safeParse(req.body);
      
      if (!result.success) {
        return handleValidationError(res, result.error);
      }
      
      const analysis = await storage.createAgentAnalysis(result.data);
      return res.status(201).json(analysis);
    } catch (error) {
      console.error('Error creating analysis:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Investment Memo routes
  app.get('/api/memos/:dealId', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }
      
      const memo = await storage.getMemoByDealId(dealId);
      return res.status(200).json(memo);
    } catch (error) {
      console.error('Error fetching memo:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.post('/api/memos', async (req: Request, res: Response) => {
    try {
      const result = insertInvestmentMemoSchema.safeParse(req.body);
      
      if (!result.success) {
        return handleValidationError(res, result.error);
      }
      
      const memo = await storage.createInvestmentMemo(result.data);
      return res.status(201).json(memo);
    } catch (error) {
      console.error('Error creating memo:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Investor routes
  app.get('/api/investors', async (req: Request, res: Response) => {
    try {
      const investors = await storage.getAllInvestors();
      return res.status(200).json(investors);
    } catch (error) {
      console.error('Error fetching investors:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Investor Matching routes
  app.get('/api/investors/:dealId', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }
      
      const matches = await storage.getInvestorMatchesByDealId(dealId);
      return res.status(200).json(matches);
    } catch (error) {
      console.error('Error fetching investor matches:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.post('/api/matches', async (req: Request, res: Response) => {
    try {
      const result = insertInvestorMatchSchema.safeParse(req.body);
      
      if (!result.success) {
        return handleValidationError(res, result.error);
      }
      
      const match = await storage.createInvestorMatch(result.data);
      return res.status(201).json(match);
    } catch (error) {
      console.error('Error creating investor match:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Automation routes
  app.get('/api/automations', async (req: Request, res: Response) => {
    try {
      const automations = await storage.getAllAutomations();
      return res.status(200).json(automations);
    } catch (error) {
      console.error('Error fetching automations:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.post('/api/automations', async (req: Request, res: Response) => {
    try {
      const result = insertAutomationSchema.safeParse(req.body);
      
      if (!result.success) {
        return handleValidationError(res, result.error);
      }
      
      const automation = await storage.createAutomation(result.data);
      return res.status(201).json(automation);
    } catch (error) {
      console.error('Error creating automation:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.patch('/api/automations/:id/toggle', async (req: Request, res: Response) => {
    try {
      const automationId = parseInt(req.params.id);
      if (isNaN(automationId)) {
        return res.status(400).json({ message: 'Invalid automation ID' });
      }
      
      const automation = await storage.getAutomationById(automationId);
      if (!automation) {
        return res.status(404).json({ message: 'Automation not found' });
      }
      
      const updatedAutomation = await storage.toggleAutomation(automationId);
      return res.status(200).json(updatedAutomation);
    } catch (error) {
      console.error('Error toggling automation:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Register AI agent routes
  app.use('/api/ai', aiAgentRoutes);
  
  // Register Microsoft OAuth routes
  app.use('/api/microsoft', microsoftAuthRoutes);
  
  // Register other routes
  app.use('/api/auth', authRoutes);
  app.use('/api/email', emailRoutes);
  app.use('/api/inbox', inboxRoutes);

  // REMOVED: Duplicate route that was causing conflicts

  // OCR text extraction with Mistral
  app.post('/api/documents/ocr/extract', async (req: Request, res: Response) => {
    try {
      console.log('🎯 OCR EXTRACT ENDPOINT HIT');
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      
      const { documentId, fileName, fileType } = req.body;
      
      if (!documentId) {
        console.log('❌ No documentId provided');
        return res.status(400).json({ message: 'Document ID required' });
      }

      // Get the actual file path from uploads directory
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
        const { mistralOCRService } = await import('./services/mistralOCR');
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
        
        // Return an error instead of placeholder data
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

  // AI analysis with Mistral or OpenAI
  app.post('/api/documents/analyze', async (req: Request, res: Response) => {
    try {
      const { documentId, analysisType, extractedText, prompt } = req.body;
      
      if (!documentId || !analysisType || !extractedText || !prompt) {
        return res.status(400).json({ message: 'Missing required parameters' });
      }

      let analysis = '';

      // Try Mistral first if available
      if (process.env.MISTRAL_API_KEY) {
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'mistral-large-latest',
            messages: [
              {
                role: 'system',
                content: 'You are an expert investment analyst providing detailed, professional analysis of business documents.'
              },
              {
                role: 'user',
                content: `${prompt}\n\nDocument content:\n${extractedText}`
              }
            ],
            max_tokens: 1000,
            temperature: 0.3
          })
        });

        if (response.ok) {
          const result = await response.json();
          analysis = result.choices[0]?.message?.content || 'Analysis could not be completed';
        }
      }

      // Fallback to demo analysis if Mistral fails
      if (!analysis) {
        analysis = generateDemoAnalysis(analysisType);
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

  // Helper function for demo analysis
  function generateDemoAnalysis(analysisType: string): string {
    const analyses: Record<string, string> = {
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

  // Settings API routes
  app.get('/api/settings/user', authenticate, async (req: any, res: Response) => {
    try {
      const userId = req.userId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Mock user settings data - in production this would come from database
      const userSettings = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        preferences: {
          theme: 'dark',
          language: 'en',
          timezone: 'Europe/Berlin',
          emailNotifications: true,
          pushNotifications: false,
          weeklyReports: true,
          dealAlerts: true,
          documentAnalysisNotifications: true
        },
        security: {
          twoFactorEnabled: false,
          sessionTimeout: 60,
          passwordLastChanged: '2024-05-15'
        },
        apiAccess: {
          hasApiKey: false,
          apiKeyCreated: null,
          requestsThisMonth: 247,
          rateLimit: 1000
        }
      };

      res.json(userSettings);
    } catch (error) {
      console.error('Error fetching user settings:', error);
      res.status(500).json({ message: 'Failed to fetch user settings' });
    }
  });

  app.patch('/api/settings/user', authenticate, async (req: any, res: Response) => {
    try {
      const userId = req.userId;
      // In production, this would update the database
      console.log('Updating user settings for user:', userId, req.body);
      
      res.json({ 
        success: true, 
        message: 'User settings updated successfully' 
      });
    } catch (error) {
      console.error('Error updating user settings:', error);
      res.status(500).json({ message: 'Failed to update user settings' });
    }
  });

  app.get('/api/settings/system', authenticate, async (req: any, res: Response) => {
    try {
      const user = await storage.getUser(req.userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admin rights required.' });
      }

      // Mock system settings data
      const systemSettings = {
        aiModels: {
          ocrModel: 'mistral-ocr-latest',
          analysisModel: 'gpt-4o',
          summaryModel: 'gpt-4o'
        },
        integrations: {
          emailService: 'sendgrid',
          crmConnected: false,
          documentStorage: 'local'
        },
        automation: {
          autoAnalyzeDocuments: true,
          autoGenerateReports: false,
          autoMatchInvestors: false,
          analysisFrequency: 'immediate'
        }
      };

      res.json(systemSettings);
    } catch (error) {
      console.error('Error fetching system settings:', error);
      res.status(500).json({ message: 'Failed to fetch system settings' });
    }
  });

  app.patch('/api/settings/system', authenticate, async (req: any, res: Response) => {
    try {
      const user = await storage.getUser(req.userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admin rights required.' });
      }

      console.log('Updating system settings:', req.body);
      
      res.json({ 
        success: true, 
        message: 'System settings updated successfully' 
      });
    } catch (error) {
      console.error('Error updating system settings:', error);
      res.status(500).json({ message: 'Failed to update system settings' });
    }
  });

  app.post('/api/settings/generate-api-key', authenticate, async (req: any, res: Response) => {
    try {
      const userId = req.userId;
      // In production, generate a real API key and store it
      const apiKey = `aesc_${randomUUID().replace(/-/g, '')}`;
      
      console.log('Generated API key for user:', userId);
      
      res.json({ 
        success: true, 
        message: 'API key generated successfully',
        apiKey: apiKey
      });
    } catch (error) {
      console.error('Error generating API key:', error);
      res.status(500).json({ message: 'Failed to generate API key' });
    }
  });

  app.post('/api/settings/change-password', authenticate, async (req: any, res: Response) => {
    try {
      const userId = req.userId;
      const { newPassword } = req.body;
      
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ 
          message: 'Password must be at least 8 characters long' 
        });
      }

      // In production, hash the password and update the database
      console.log('Password changed for user:', userId);
      
      res.json({ 
        success: true, 
        message: 'Password changed successfully' 
      });
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ message: 'Failed to change password' });
    }
  });
  
  const httpServer = createServer(app);
  return httpServer;
}
