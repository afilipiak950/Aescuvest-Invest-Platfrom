import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import { z } from "zod";
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
  
  const httpServer = createServer(app);
  return httpServer;
}
