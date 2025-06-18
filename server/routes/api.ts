import type { Express, Request, Response } from "express";
import { authenticateApiKey, optionalApiAuth } from "../middleware/apiAuth";
import { storage } from "../storage";
import { insertDealSchema, insertDocumentSchema } from "../../shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for API file uploads
const apiUpload = multer({
  dest: 'uploads/api',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'image/jpeg',
      'image/png'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  }
});

// API response helpers
const apiResponse = {
  success: (data: any, message = 'Success') => ({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  }),
  
  error: (message: string, code = 'API_ERROR', details?: any) => ({
    success: false,
    error: {
      code,
      message,
      details
    },
    timestamp: new Date().toISOString()
  }),
  
  paginated: (data: any[], page: number, limit: number, total: number) => ({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    timestamp: new Date().toISOString()
  })
};

export function registerApiRoutes(app: Express) {
  console.log('🔗 Registering API endpoints...');

  // API Documentation endpoint
  app.get('/api/v1/docs', (req: Request, res: Response) => {
    res.json({
      name: 'Aescuvest API',
      version: '1.0.0',
      description: 'RESTful API for the Aescuvest Investment Platform',
      baseUrl: `${req.protocol}://${req.get('host')}/api/v1`,
      authentication: {
        type: 'Bearer Token',
        header: 'Authorization: Bearer <your-api-key>',
        note: 'Generate your API key in the Settings page'
      },
      endpoints: {
        deals: {
          'GET /deals': 'List all investment deals',
          'GET /deals/:id': 'Get specific deal details',
          'POST /deals': 'Create new investment deal',
          'PUT /deals/:id': 'Update existing deal',
          'DELETE /deals/:id': 'Delete deal'
        },
        documents: {
          'GET /deals/:dealId/documents': 'List documents for a deal',
          'POST /deals/:dealId/documents': 'Upload documents to a deal',
          'GET /documents/:id': 'Get document details',
          'DELETE /documents/:id': 'Delete document'
        },
        analyses: {
          'GET /deals/:dealId/analyses': 'Get AI analyses for a deal',
          'POST /deals/:dealId/analyze': 'Trigger AI analysis',
          'GET /analyses/:id': 'Get specific analysis'
        },
        user: {
          'GET /user/profile': 'Get current user profile',
          'GET /user/activity': 'Get user activity logs',
          'GET /user/stats': 'Get user statistics'
        }
      }
    });
  });

  // User Profile & Stats (Authenticated)
  app.get('/api/v1/user/profile', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const user = req.apiUser!;
      res.json(apiResponse.success({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }, 'User profile retrieved successfully'));
    } catch (error) {
      console.error('❌ API Error getting user profile:', error);
      res.status(500).json(apiResponse.error('Failed to retrieve user profile'));
    }
  });

  app.get('/api/v1/user/stats', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const deals = await storage.getAllDeals();
      const documents = await storage.getAllDocuments();
      const userDeals = deals.filter((d: any) => d.createdBy === req.apiUser!.id);
      
      const stats = {
        totalDeals: userDeals.length,
        totalDocuments: documents.filter(d => userDeals.some(deal => deal.id === d.dealId)).length,
        dealsByStatus: userDeals.reduce((acc, deal) => {
          acc[deal.status] = (acc[deal.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        recentActivity: userDeals.slice(0, 5).map(deal => ({
          type: 'deal',
          action: 'created',
          dealId: deal.id,
          dealName: deal.companyName,
          timestamp: deal.createdAt
        }))
      };

      res.json(apiResponse.success(stats, 'User statistics retrieved successfully'));
    } catch (error) {
      console.error('❌ API Error getting user stats:', error);
      res.status(500).json(apiResponse.error('Failed to retrieve user statistics'));
    }
  });

  // Deals API (Read operations public, Write operations require auth)
  app.get('/api/v1/deals', optionalApiAuth, async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const status = req.query.status as string;
      const search = req.query.search as string;

      let deals = await storage.getAllDeals();
      
      // Apply filters
      if (status) {
        deals = deals.filter(d => d.status === status);
      }
      
      if (search) {
        const searchLower = search.toLowerCase();
        deals = deals.filter(d => 
          d.companyName.toLowerCase().includes(searchLower) ||
          d.description?.toLowerCase().includes(searchLower)
        );
      }

      // If authenticated, show all deals; if not, show only public deals
      if (!req.apiUser) {
        deals = deals.filter(d => d.status === 'published' || d.status === 'active');
      }

      const total = deals.length;
      const offset = (page - 1) * limit;
      const paginatedDeals = deals.slice(offset, offset + limit);

      // Remove sensitive data for unauthenticated requests
      const responseDeals = paginatedDeals.map(deal => {
        if (!req.apiUser) {
          const { createdBy, ...publicDeal } = deal;
          return publicDeal;
        }
        return deal;
      });

      res.json(apiResponse.paginated(responseDeals, page, limit, total));
    } catch (error) {
      console.error('❌ API Error listing deals:', error);
      res.status(500).json(apiResponse.error('Failed to retrieve deals'));
    }
  });

  app.get('/api/v1/deals/:id', optionalApiAuth, async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.id);
      const deal = await storage.getDealById(dealId);
      
      if (!deal) {
        return res.status(404).json(apiResponse.error('Deal not found', 'DEAL_NOT_FOUND'));
      }

      // Check if deal is public or user is authenticated
      if (!req.apiUser && !['published', 'active'].includes(deal.status)) {
        return res.status(403).json(apiResponse.error('Access denied to private deal', 'ACCESS_DENIED'));
      }

      // Get additional data
      const documents = await storage.getDocumentsByDealId(dealId);
      const analyses = await storage.getAnalysesByDealId(dealId);
      
      const dealData = {
        ...deal,
        documents: documents.length,
        analyses: analyses.length,
        ...(req.apiUser && { 
          documentsDetail: documents.map(d => ({ id: d.id, name: d.name, type: d.type, size: d.size })),
          analysesDetail: analyses.map(a => ({ id: a.id, agentType: a.agentType, status: a.status }))
        })
      };

      res.json(apiResponse.success(dealData, 'Deal retrieved successfully'));
    } catch (error) {
      console.error('❌ API Error getting deal:', error);
      res.status(500).json(apiResponse.error('Failed to retrieve deal'));
    }
  });

  app.post('/api/v1/deals', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const validation = insertDealSchema.omit({ id: true, createdAt: true, updatedAt: true }).safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json(apiResponse.error(
          'Invalid deal data',
          'VALIDATION_ERROR',
          validation.error.issues
        ));
      }

      const newDeal = await storage.createDeal({
        ...validation.data,
        createdBy: req.apiUser!.id
      });

      res.status(201).json(apiResponse.success(newDeal, 'Deal created successfully'));
    } catch (error) {
      console.error('❌ API Error creating deal:', error);
      res.status(500).json(apiResponse.error('Failed to create deal'));
    }
  });

  app.put('/api/v1/deals/:id', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.id);
      const existingDeal = await storage.getDeal(dealId);
      
      if (!existingDeal) {
        return res.status(404).json(apiResponse.error('Deal not found', 'DEAL_NOT_FOUND'));
      }

      // Check ownership (admins can edit any deal)
      if (req.apiUser!.role !== 'admin' && existingDeal.createdBy !== req.apiUser!.id) {
        return res.status(403).json(apiResponse.error('Access denied', 'ACCESS_DENIED'));
      }

      const validation = insertDealSchema.omit({ id: true, createdAt: true, updatedAt: true, createdBy: true }).safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json(apiResponse.error(
          'Invalid deal data',
          'VALIDATION_ERROR',
          validation.error.issues
        ));
      }

      const updatedDeal = await storage.updateDeal(dealId, validation.data);
      res.json(apiResponse.success(updatedDeal, 'Deal updated successfully'));
    } catch (error) {
      console.error('❌ API Error updating deal:', error);
      res.status(500).json(apiResponse.error('Failed to update deal'));
    }
  });

  app.delete('/api/v1/deals/:id', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.id);
      const existingDeal = await storage.getDeal(dealId);
      
      if (!existingDeal) {
        return res.status(404).json(apiResponse.error('Deal not found', 'DEAL_NOT_FOUND'));
      }

      // Check ownership (admins can delete any deal)
      if (req.apiUser!.role !== 'admin' && existingDeal.createdBy !== req.apiUser!.id) {
        return res.status(403).json(apiResponse.error('Access denied', 'ACCESS_DENIED'));
      }

      await storage.deleteDeal(dealId);
      res.json(apiResponse.success(null, 'Deal deleted successfully'));
    } catch (error) {
      console.error('❌ API Error deleting deal:', error);
      res.status(500).json(apiResponse.error('Failed to delete deal'));
    }
  });

  // Documents API
  app.get('/api/v1/deals/:dealId/documents', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      const deal = await storage.getDeal(dealId);
      
      if (!deal) {
        return res.status(404).json(apiResponse.error('Deal not found', 'DEAL_NOT_FOUND'));
      }

      const documents = await storage.getDocumentsByDeal(dealId);
      
      const documentList = documents.map(doc => ({
        id: doc.id,
        name: doc.name,
        type: doc.type,
        size: doc.size,
        uploadedAt: doc.createdAt,
        hasAiSummary: !!doc.aiSummary,
        assignedAgents: doc.assignedAgents || []
      }));

      res.json(apiResponse.success(documentList, 'Documents retrieved successfully'));
    } catch (error) {
      console.error('❌ API Error getting documents:', error);
      res.status(500).json(apiResponse.error('Failed to retrieve documents'));
    }
  });

  app.post('/api/v1/deals/:dealId/documents', authenticateApiKey, apiUpload.array('files'), async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      const deal = await storage.getDeal(dealId);
      
      if (!deal) {
        return res.status(404).json(apiResponse.error('Deal not found', 'DEAL_NOT_FOUND'));
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json(apiResponse.error('No files provided', 'NO_FILES'));
      }

      const uploadedDocuments = [];

      for (const file of files) {
        try {
          // Create uploads directory if it doesn't exist
          const uploadDir = 'uploads';
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          // Move file to proper location
          const fileName = `${Date.now()}-${file.originalname}`;
          const filePath = path.join(uploadDir, fileName);
          fs.renameSync(file.path, filePath);

          // Create document record
          const document = await storage.createDocument({
            dealId,
            name: file.originalname,
            type: file.mimetype,
            size: file.size,
            path: filePath,
            uploadedBy: req.apiUser!.id
          });

          uploadedDocuments.push({
            id: document.id,
            name: document.name,
            size: document.size,
            type: document.type
          });
        } catch (fileError) {
          console.error(`❌ Error processing file ${file.originalname}:`, fileError);
          // Clean up file if it exists
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }
      }

      res.status(201).json(apiResponse.success(uploadedDocuments, `${uploadedDocuments.length} documents uploaded successfully`));
    } catch (error) {
      console.error('❌ API Error uploading documents:', error);
      res.status(500).json(apiResponse.error('Failed to upload documents'));
    }
  });

  // Analyses API
  app.get('/api/v1/deals/:dealId/analyses', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      const deal = await storage.getDeal(dealId);
      
      if (!deal) {
        return res.status(404).json(apiResponse.error('Deal not found', 'DEAL_NOT_FOUND'));
      }

      const analyses = await storage.getAgentAnalysesByDeal(dealId);
      
      const analysisData = analyses.map(analysis => ({
        id: analysis.id,
        agentType: analysis.agentType,
        status: analysis.status,
        progress: analysis.progress,
        findings: analysis.findings,
        recommendations: analysis.recommendations,
        score: analysis.score,
        completedAt: analysis.completedAt,
        createdAt: analysis.createdAt
      }));

      res.json(apiResponse.success(analysisData, 'Analyses retrieved successfully'));
    } catch (error) {
      console.error('❌ API Error getting analyses:', error);
      res.status(500).json(apiResponse.error('Failed to retrieve analyses'));
    }
  });

  app.post('/api/v1/deals/:dealId/analyze', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      const { agentTypes } = req.body;
      
      const deal = await storage.getDeal(dealId);
      if (!deal) {
        return res.status(404).json(apiResponse.error('Deal not found', 'DEAL_NOT_FOUND'));
      }

      const documents = await storage.getDocumentsByDeal(dealId);
      if (documents.length === 0) {
        return res.status(400).json(apiResponse.error('No documents found for analysis', 'NO_DOCUMENTS'));
      }

      const validAgentTypes = ['clinical', 'legal', 'commercial', 'hr', 'financial', 'ip', 'research'];
      const requestedAgents = agentTypes && Array.isArray(agentTypes) 
        ? agentTypes.filter(type => validAgentTypes.includes(type))
        : validAgentTypes;

      if (requestedAgents.length === 0) {
        return res.status(400).json(apiResponse.error('No valid agent types specified', 'INVALID_AGENTS'));
      }

      // Trigger background analysis
      const analysisJobs = [];
      for (const agentType of requestedAgents) {
        try {
          const analysis = await storage.createAgentAnalysis({
            dealId,
            agentType,
            status: 'pending',
            progress: 0,
            documentSources: documents.map(d => d.id.toString())
          });
          analysisJobs.push({
            id: analysis.id,
            agentType,
            status: 'pending'
          });
        } catch (error) {
          console.error(`❌ Error creating analysis for ${agentType}:`, error);
        }
      }

      res.status(202).json(apiResponse.success(analysisJobs, 'Analysis jobs created successfully'));
    } catch (error) {
      console.error('❌ API Error triggering analysis:', error);
      res.status(500).json(apiResponse.error('Failed to trigger analysis'));
    }
  });

  console.log('✅ API endpoints registered successfully');
}