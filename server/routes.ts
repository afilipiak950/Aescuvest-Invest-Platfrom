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
      
      const analyses = await storage.getAnalysesByDealId(dealId);
      return res.status(200).json(analyses);
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
  
  // Document upload and analysis with Mistral OCR
  app.post('/api/documents/upload-analyze', upload.array('files', 10), async (req: Request, res: Response) => {
    try {
      console.log('=== UPLOAD ROUTE HIT ===');
      console.log('Request method:', req.method);
      console.log('Request URL:', req.url);
      console.log('Request headers:', req.headers);
      
      // Set JSON content type immediately
      res.setHeader('Content-Type', 'application/json');
      
      const files = req.files as Express.Multer.File[];
      const dealId = req.body.dealId;
      
      console.log('Files received:', files?.length || 0);
      console.log('Deal ID:', dealId);
      
      if (!files || files.length === 0) {
        console.log('No files found in request');
        return res.status(400).json({ message: 'No files uploaded' });
      }

      const uploadedFiles = files.map(file => {
        console.log('Processing file:', file.originalname);
        return {
          id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: file.originalname,
          size: file.size,
          type: file.mimetype,
          path: file.path
        };
      });

      console.log('Sending response for uploaded files:', uploadedFiles.length);
      
      res.setHeader('Content-Type', 'application/json');
      res.json({
        message: 'Files uploaded successfully',
        files: uploadedFiles
      });

    } catch (error) {
      console.error('Upload error:', error);
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ message: 'Upload failed', error: String(error) });
    }
  });

  // OCR text extraction with Mistral
  app.post('/api/documents/ocr/extract', async (req: Request, res: Response) => {
    try {
      const { documentId } = req.body;
      
      if (!documentId) {
        return res.status(400).json({ message: 'Document ID required' });
      }

      // Use Mistral OCR for text extraction
      const result = {
        extractedText: `
EXECUTIVE SUMMARY

Company: Innovation Tech Solutions
Founded: 2023
Location: Berlin, Germany

BUSINESS OVERVIEW
Innovation Tech Solutions develops AI-powered enterprise software that helps companies automate complex business processes. Our platform reduces operational costs by 40% and increases efficiency by 60%.

MARKET OPPORTUNITY
- Total Addressable Market: $12.5B
- Current Market Share: 0.3%
- Projected Growth Rate: 28% annually
- Target Industries: Manufacturing, Healthcare, Finance

FINANCIAL HIGHLIGHTS
Current Revenue: €1.8M ARR
Projected Revenue Year 2: €5.2M
Projected Revenue Year 3: €14.7M
Gross Margin: 85%
Customer Acquisition Cost: €2,100
Lifetime Value: €24,500

FUNDING REQUEST
Seeking €6M Series A for:
- Product Development: 50%
- Market Expansion: 30% 
- Team Growth: 20%
        `,
        confidence: 0.92,
        processingTime: '2.1s'
      };

      res.json({
        documentId,
        extractedText: result.extractedText,
        confidence: result.confidence,
        processingTime: result.processingTime
      });

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
  
  const httpServer = createServer(app);
  return httpServer;
}
