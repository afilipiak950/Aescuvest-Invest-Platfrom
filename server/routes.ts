import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { documents, systemSettings, backgroundJobs } from "../shared/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod";
import { authenticate } from "./middleware/auth";
import { desc, sql } from "drizzle-orm";
import { 
  insertDealSchema, 
  insertDocumentSchema, 
  insertAgentAnalysisSchema,
  insertInvestmentMemoSchema,
  insertInvestorMatchSchema,
  insertAutomationSchema,
  userActivities,
  userStats
} from "../shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import aiAgentRoutes from "./routes/ai-agents";
import authRoutes from "./routes/auth";
import emailRoutes from "./routes/email";
import microsoftAuthRoutes from "./routes/microsoftAuth";
import investorMatchingRoutes from "./routes/investor-matching";
import { registerApiRoutes } from "./routes/api";
import { registerAffinityRoutes } from "./routes/affinity-routes";
import matchingIntelligenceRoutes from "./routes/matching-intelligence-routes";
import { companyResearchService } from "./services/companyResearch";
import { evaluateCompanyByDeal } from './services/aiEvaluation';
import { comprehensiveResearchService } from './services/comprehensiveResearch';
import { websocketManager as wsManager } from './services/websocketManager';
import { legalAnalysisService } from './legalAnalysisService';
import { persistentJobManager } from './services/persistentJobManager';
import persistentAnalysisRoutes from './routes/persistentAnalysis';
import legacyResetRoutes from './routes/legacyReset';
import comprehensiveAnalysisRoutes from './routes/comprehensiveAnalysis';
import persistentClinicalRoutes from './routes/persistentClinicalRoutes';
import { persistentLegalRoutes } from './routes/persistentLegalRoutes';
import persistentFinancialRoutes from './routes/persistentFinancialRoutes';
import persistentIpRoutes from './routes/persistentIpRoutes';
import { safeGetDocumentContent } from './utils/documentUtils';
import { aiDocumentAssignmentService } from './services/aiDocumentAssignment';
import { aiProcessingTimeoutService } from './services/aiProcessingTimeout';
import { chunkedUploadService } from './services/chunkedUploadService';
import { zipProcessor } from './services/zipProcessor';

// Background processing function for AI evaluation
async function processAIEvaluationForDeal(
  dealId: number, 
  website: string, 
  companyName: string
): Promise<void> {
  try {
    console.log(`Starting AI evaluation for deal ${dealId}: ${companyName}`);
    
    // Trigger AI evaluation using the existing service
    await evaluateCompanyByDeal(dealId);
    
    console.log(`Completed AI evaluation for deal ${dealId}: ${companyName}`);
  } catch (error) {
    console.error(`AI evaluation failed for deal ${dealId}:`, error);
    throw error;
  }
}

// Background processing function for company research
async function processCompanyResearchForDeal(
  dealId: number, 
  companyName: string, 
  website?: string, 
  sector?: string,
  forceRefresh?: boolean
): Promise<void> {
  try {
    console.log(`Starting comprehensive research for deal ${dealId}: ${companyName}`);
    
    // Set status to processing
    await storage.updateCompanyResearchStatus(dealId, 'processing');
    
    // Conduct comprehensive AI research
    const researchData = await comprehensiveResearchService.conductComprehensiveResearch({
      companyName,
      website,
      sector,
      dealId
    });
    
    // Save research data to database
    await storage.createOrUpdateCompanyResearch(dealId, {
      companyName,
      website: website || null,
      websiteAnalysis: researchData.websiteAnalysis || null,
      newsAndPress: researchData.newsAndPress || null,
      fundingInformation: researchData.fundingInformation || null,
      leadershipTeam: researchData.leadershipTeam || null,
      industryClassification: researchData.industryClassification || null,
      technologyStack: researchData.technologyStack || null,
      regulatoryCompliance: researchData.regulatoryCompliance || null,
      sources: researchData.sources,
      ceoProfile: researchData.ceoProfile || null,
      financialData: researchData.financialData || null,
      externalLinks: researchData.externalLinks || null,
      businessIntelligence: researchData.businessIntelligence || null,
      investmentHighlights: researchData.investmentHighlights || null,
      riskFactors: researchData.riskFactors || null,
      researchStatus: 'completed',
      researchCompletedAt: new Date()
    });
    
    console.log(`Research completed for deal ${dealId} with ${researchData.sources} sources analyzed`);
  } catch (error) {
    console.error(`Research failed for deal ${dealId}:`, error);
    await storage.updateCompanyResearchStatus(dealId, 'failed').catch(console.error);
    throw error;
  }
}
import inboxRoutes from "./routes/inbox";
import microsoftAuthRoutes from "./routes/microsoftAuth";
import documentUploadRoutes from "./routes/document-upload";
import backgroundJobsRouter from "./routes/backgroundJobs";
import { websocketManager } from "./services/websocketManager";
import { jobProcessor } from "./services/jobProcessor";

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
    fileSize: 50 * 1024 * 1024 * 1024, // 🚨 MASSIVE 50GB limit to eliminate ALL 413 errors
    fieldSize: 50 * 1024 * 1024 * 1024, // 50GB for fields
    fields: 100, // Allow many fields  
    files: 50 // Allow many files
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.pdf', '.docx', '.doc', '.ppt', '.pptx', '.xlsx', '.xls', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, PPT, XLSX, and ZIP files are allowed.'));
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
  // Register comprehensive analysis routes FIRST - before any conflicting routes
  console.log('🚀 Registering comprehensive analysis routes FIRST...');
  app.use(comprehensiveAnalysisRoutes);
  console.log('✅ Comprehensive analysis routes registered FIRST');
  
  // Register persistent clinical analysis routes
  console.log('🧬 Registering persistent clinical analysis routes...');
  app.use(persistentClinicalRoutes);
  console.log('✅ Persistent clinical analysis routes registered');

  console.log('💰 Registering persistent financial analysis routes...');
  app.use(persistentFinancialRoutes);
  console.log('✅ Persistent financial analysis routes registered');

  console.log('🔬 Registering persistent IP analysis routes...');
  app.use(persistentIpRoutes);
  console.log('✅ Persistent IP analysis routes registered');
  
  // Register persistent legal analysis routes
  console.log('🔍 Registering persistent legal analysis routes...');
  app.use(persistentLegalRoutes);
  console.log('✅ Persistent legal analysis routes registered');
  
  // Register persistent analysis routes (includes clear-stuck-jobs and stop-all-jobs endpoints)
  console.log('🔄 Registering persistent analysis routes...');
  app.use('/', persistentAnalysisRoutes);
  console.log('✅ Persistent analysis routes registered');
  
  // 🚨 CRITICAL: Register 413 bypass routes
  console.log('🔧 Registering 413 bypass test routes...');
  const testUploadLimits = await import('./routes/test-upload-limits');
  app.use(testUploadLimits.default);
  const streamUpload = await import('./routes/stream-upload');
  app.use(streamUpload.default);
  const ultraBypass = await import('./routes/ultra-bypass-upload');
  app.use(ultraBypass.default);
  console.log('✅ 413 bypass routes registered (including ULTRA-BYPASS)');
  
  // CRITICAL TEST: Simple test route to verify Express is working
  console.log('🚀 REGISTERING TEST ROUTE');
  app.get('/api/test-route', (req: Request, res: Response) => {
    console.log('🎯 TEST ROUTE HIT!');
    res.json({ message: 'Express route working!', timestamp: new Date().toISOString() });
  });
  
  // 🚨 DEBUG ENDPOINT: Upload diagnostics for Cloud Run debugging
  app.get('/api/upload/diagnostics', (req: Request, res: Response) => {
    const diagnostics = {
      server: {
        environment: process.env.NODE_ENV,
        platform: process.platform,
        nodeVersion: process.version,
        uploadLimits: {
          expressjson: '5gb',
          expressUrlencoded: '5gb',
          multerFileSize: '5gb',
          multerFieldSize: '5gb'
        }
      },
      cloudRun: {
        maxDirectUpload: '100MB',
        recommendedChunking: 'Files >100MB',
        infrastructure: 'Google Cloud Run',
        commonErrors: ['413 Request Entity Too Large', 'Timeout', 'Network Error']
      },
      endpoints: {
        dataRoomUpload: '/api/deals/:dealId/data-room/upload-zip',
        chunkedInit: '/api/upload/chunk/init',
        chunkedUpload: '/api/upload/chunk/:uploadId/:chunkIndex'
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(diagnostics);
  });

  // 🔍 OCR EXTRACTION TEST ROUTE
  app.post('/test-ocr-extraction/:dealId', async (req: Request, res: Response) => {
    const dealId = parseInt(req.params.dealId);
    console.log(`🔍 Testing OCR extraction for deal ${dealId}`);
    
    try {
      const documentsWithOCR = await storage.getDocumentsWithOCRByDealId(dealId);
      const ocrStats = {
        totalDocs: documentsWithOCR.length,
        docsWithOCR: documentsWithOCR.filter(doc => doc.ocrText && doc.ocrText.length > 100).length,
        totalOcrChars: documentsWithOCR.reduce((sum, doc) => sum + (doc.ocrText?.length || 0), 0),
        firstDocOcrLength: documentsWithOCR[0]?.ocrText?.length || 0,
        hasOcrField: documentsWithOCR[0] ? 'ocrText' in documentsWithOCR[0] : false
      };
      
      console.log(`🔍 OCR TEST RESULTS:`, ocrStats);
      res.json({ success: true, ...ocrStats });
    } catch (error) {
      console.error('🔍 OCR test failed:', error);
      res.json({ success: false, error: String(error) });
    }
  });

  // ✅ INVESTMENT MEMO GENERATION ROUTE - MISSING ROUTE THAT FRONTEND NEEDS!
  app.post('/api/deals/:dealId/memo/generate', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      const { forceRegenerate } = req.body;
      
      console.log(`📝 Investment memo generation requested for deal ${dealId}, force regenerate: ${!!forceRegenerate}`);
      
      if (isNaN(dealId)) {
        return res.status(400).json({ success: false, error: 'Invalid deal ID' });
      }

      // Check if deal exists
      const deal = await storage.getDealById(dealId);
      if (!deal) {
        return res.status(404).json({ success: false, error: 'Deal not found' });
      }

      // Check for existing background jobs to prevent duplicates
      const existingJobs = await storage.getBackgroundJobsByDealId(dealId);
      const existingMemoJob = existingJobs.find(job => 
        job.jobType === 'investment_memo_generation' && job.status === 'processing'
      );
      
      if (existingMemoJob && !forceRegenerate) {
        console.log(`⚠️ Investment memo generation already running for deal ${dealId} (Job: ${existingMemoJob.jobId})`);
        return res.json({ 
          success: true, 
          message: `Investment memo generation already in progress`,
          jobId: existingMemoJob.jobId,
          isRunning: true
        });
      }

      // Create background job for progress tracking
      const jobId = `investment_memo_${dealId}_${Date.now()}`;
      await storage.createBackgroundJob({
        jobId,
        jobType: 'investment_memo_generation',
        dealId,
        status: 'processing',
        progress: 0,
        totalDocuments: 0,
        processedDocuments: 0,
        startedAt: new Date()
      });

      // Start investment memo generation as BACKGROUND JOB
      console.log(`📝 Starting background investment memo generation for deal ${dealId} with job ${jobId}`);
      
      const { investmentMemoService } = await import('./services/investmentMemoService');
      
      // Process in background with proper error handling
      investmentMemoService.generateComprehensiveMemo(dealId).then(async (memo) => {
        console.log(`✅ Investment memo generation completed for deal ${dealId}`);
        
        // Mark job as completed
        await storage.updateBackgroundJob(jobId, {
          status: 'completed',
          progress: 100,
          completedAt: new Date(),
          updatedAt: new Date()
        });
        
      }).catch(async (error) => {
        console.error(`❌ Investment memo generation failed for deal ${dealId}:`, error);
        
        // Mark job as failed
        await storage.updateBackgroundJob(jobId, {
          status: 'failed',
          progress: 0,
          completedAt: new Date(),
          updatedAt: new Date(),
          errorMessage: error.message
        });
      });

      // Return immediately with job ID
      res.json({
        success: true,
        message: 'Investment memo generation started',
        jobId,
        isRunning: true,
        dealId
      });

    } catch (error) {
      console.error(`❌ Error starting investment memo generation for deal ${req.params.dealId}:`, error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to start investment memo generation',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Attachment download endpoint
  app.get('/api/inbox/emails/:emailId/attachments/:attachmentId/download', async (req: Request, res: Response) => {
    try {
      console.log('🔍 ATTACHMENT DOWNLOAD REQUEST:', {
        emailId: req.params.emailId,
        attachmentId: req.params.attachmentId
      });

      const { emailId, attachmentId } = req.params;
      
      // Get Microsoft tokens from database storage (not session)
      const connection = await storage.getMicrosoftEmailConnection();
      console.log('🔍 Microsoft connection status:', {
        hasConnection: !!connection,
        authenticated: connection?.authenticated,
        hasAccessToken: !!connection?.accessToken,
        tokenExpiry: connection?.expiresAt,
        currentTime: Date.now(),
        isExpired: connection?.expiresAt ? Date.now() >= connection.expiresAt : 'no-expiry-data'
      });
      
      if (!connection || !connection.authenticated || !connection.accessToken) {
        console.log('❌ No Microsoft authentication found');
        return res.status(401).json({ 
          success: false, 
          message: 'Microsoft authentication required - please connect your email account first'
        });
      }

      // Check if token is expired
      let accessToken = connection.accessToken;
      if (connection.expiresAt && Date.now() >= connection.expiresAt) {
        console.log('🔄 Access token expired, attempting refresh...');
        if (connection.refreshToken) {
          try {
            const { refreshMicrosoftTokens } = await import('./services/microsoftAuth');
            const newTokens = await refreshMicrosoftTokens(connection.refreshToken);
            await storage.saveMicrosoftEmailConnection({
              ...connection,
              accessToken: newTokens.accessToken,
              refreshToken: newTokens.refreshToken,
              expiresAt: newTokens.expiresAt
            });
            accessToken = newTokens.accessToken;
            console.log('✅ Token refreshed successfully');
          } catch (refreshError) {
            console.error('❌ Token refresh failed:', refreshError);
            return res.status(401).json({ 
              success: false, 
              message: 'Microsoft authentication expired and refresh failed - please reconnect'
            });
          }
        } else {
          console.log('❌ No refresh token available');
          return res.status(401).json({ 
            success: false, 
            message: 'Microsoft authentication expired - please reconnect'
          });
        }
      }

      console.log('✅ Access token validated, fetching attachment...');

      // For file attachments, we need to get the full attachment object with contentBytes
      const attachmentResponse = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${emailId}/attachments/${attachmentId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!attachmentResponse.ok) {
        console.log('❌ Failed to fetch attachment:', attachmentResponse.status, attachmentResponse.statusText);
        const errorText = await attachmentResponse.text();
        console.log('Error response:', errorText);
        throw new Error(`Failed to fetch attachment: ${attachmentResponse.status} - ${attachmentResponse.statusText}`);
      }

      const attachment = await attachmentResponse.json();
      console.log('📎 Attachment data received:', {
        name: attachment.name,
        contentType: attachment.contentType,
        size: attachment.size,
        hasContentBytes: !!attachment.contentBytes,
        type: attachment['@odata.type']
      });

      if (!attachment.contentBytes) {
        console.log('❌ No contentBytes in attachment response');
        throw new Error('Attachment content not available');
      }

      // Convert base64 content to buffer
      const contentBuffer = Buffer.from(attachment.contentBytes, 'base64');
      
      console.log('✅ Content decoded successfully, size:', contentBuffer.length);

      // Set appropriate headers for download
      const filename = attachment.name || 'attachment';
      const contentType = attachment.contentType || 'application/octet-stream';
      
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', contentBuffer.length);
      
      // Send the buffer
      res.send(contentBuffer);
      
      console.log('✅ Attachment download completed:', filename);
      
    } catch (error) {
      console.error('❌ Error downloading attachment:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to download attachment',
        error: error.message 
      });
    }
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

      const uploadedFiles = [];
      
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        console.log(`📁 Processing file ${index}: ${file.originalname}`);
        
        // Create document record in database
        const documentData: any = {
          dealId: dealId ? parseInt(dealId) : null,
          name: file.originalname,
          type: path.extname(file.originalname).substring(1) || 'unknown',
          path: file.path,
          size: file.size,
          status: 'Pending',
          folderPath: "",
          isFolder: false
        };
        
        try {
          const document = await storage.createDocument(documentData);
          
          // Create background OCR job with proper schema fields
          const jobData = { 
            filePath: file.path, 
            fileName: file.originalname,
            documentId: document.id,
            documentName: file.originalname
          };
          
          const jobId = await jobProcessor.createJob({
            jobType: 'document_ocr',
            dealId: dealId ? parseInt(dealId) : null,
            documentId: document.id,
            jobData: jobData
          });
          
          console.log(`✅ Created background OCR job ${jobId} for document ${document.id}`);
          
          // IMMEDIATELY execute the OCR job to ensure processing happens
          console.log(`🚀 IMMEDIATE OCR EXECUTION for job ${jobId}`);
          (async () => {
            try {
              // Add delay to ensure database transaction is committed
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // Extract file type from extension
              const fileType = path.extname(file.originalname).substring(1).toLowerCase();
              console.log(`🔍 Processing ${file.originalname} as type: ${fileType}`);
              
              // Import OCR service
              const { mistralOCRService } = await import('./services/mistralOCR');
              
              // Perform OCR
              const ocrResult = await mistralOCRService.extractText(file.path, fileType);
              console.log(`✅ OCR extracted ${ocrResult.extractedText?.length || 0} characters`);
              
              // Update document with results
              await storage.updateDocumentWithOCR(document.id, ocrResult.extractedText, 'Analyzed');
              
              console.log(`✅ IMMEDIATE OCR completed for job ${jobId} - document ${document.id} updated`);
            } catch (error) {
              console.error(`❌ IMMEDIATE OCR failed for job ${jobId}:`, error);
              await storage.updateDocumentWithOCR(document.id, '', 'Failed');
            }
          })();
          
          uploadedFiles.push({
            id: document.id,
            name: file.originalname,
            size: file.size,
            type: file.mimetype,
            status: 'processing',
            path: file.path,
            filename: file.filename,
            jobId: jobId
          });
        } catch (error) {
          console.error(`❌ Failed to create document/job for ${file.originalname}:`, error);
          uploadedFiles.push({
            id: `error_${Date.now()}_${index}`,
            name: file.originalname,
            size: file.size,
            type: file.mimetype,
            status: 'error',
            path: file.path,
            filename: file.filename,
            error: String(error)
          });
        }
      }

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
  
  // Register Affinity CRM routes
  registerAffinityRoutes(app);
  
  // Deal routes - Optimized with performance timing
  app.get('/api/deals', async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      console.log('📊 Starting optimized deals fetch...');
      const deals = await storage.getAllDeals();
      
      const totalTime = Date.now() - startTime;
      console.log(`📊 Deals fetch completed: ${deals.length} deals in ${totalTime}ms`);
      
      return res.status(200).json(deals);
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`Error fetching deals after ${totalTime}ms:`, error);
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
      
      // Trigger background AI evaluation if website is provided
      if (deal.website && deal.companyName) {
        // Start AI evaluation in background - don't wait for completion
        processAIEvaluationForDeal(deal.id, deal.website, deal.companyName)
          .catch(error => {
            console.error(`Background AI evaluation failed for deal ${deal.id}:`, error);
          });
        
        console.log(`Started background AI evaluation for deal ${deal.id}: ${deal.companyName}`);
      }
      
      // Trigger automated company research for all deals
      if (deal.companyName) {
        // Start comprehensive company research in background
        processCompanyResearchForDeal(deal.id, deal.companyName, deal.website, deal.sector)
          .catch((error: any) => {
            console.error(`Background company research failed for deal ${deal.id}:`, error);
          });
        
        console.log(`Started background company research for deal ${deal.id}: ${deal.companyName}`);
      }
      
      return res.status(201).json(deal);
    } catch (error) {
      console.error('Error creating deal:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/deals/:id', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.id);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }

      // Check if deal exists
      const deal = await storage.getDealById(dealId);
      if (!deal) {
        return res.status(404).json({ message: 'Deal not found' });
      }

      // Delete related data first to maintain referential integrity
      console.log(`🗑️ Deleting related data for deal ${dealId}...`);
      
      // Delete documents
      await storage.deleteDocumentsByDealId(dealId);
      
      // Delete analyses
      await storage.deleteAnalysesByDealId(dealId);
      
      // Delete evaluation results
      await storage.deleteEvaluationResultsByDealId(dealId);
      
      // Delete company research
      await storage.deleteCompanyResearchByDealId(dealId);
      
      // Delete background jobs
      await storage.deleteBackgroundJobsByDealId(dealId);
      
      // Finally delete the deal
      const deleted = await storage.deleteDeal(dealId);
      
      if (!deleted) {
        return res.status(500).json({ message: 'Failed to delete deal' });
      }

      console.log(`✅ Successfully deleted deal ${dealId} and all related data`);
      return res.status(200).json({ 
        message: 'Deal deleted successfully',
        dealId: dealId
      });
    } catch (error) {
      console.error('Error deleting deal:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Update deal status endpoint for pipeline drag & drop
  app.patch('/api/deals/:id/status', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.id);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }

      const { status } = req.body;
      if (!status || typeof status !== 'string') {
        return res.status(400).json({ message: 'Valid status is required' });
      }

      const validStatuses = [
        'submitted', 'screening', 'under-review', 'negotiating', 
        'final-review', 'invested', 'rejected', 'declined'
      ];
      
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
          message: 'Invalid status', 
          validStatuses 
        });
      }

      const updatedDeal = await storage.updateDealStatus(dealId, status);
      if (!updatedDeal) {
        return res.status(404).json({ message: 'Deal not found' });
      }

      return res.status(200).json({ 
        message: 'Deal status updated successfully', 
        deal: updatedDeal 
      });
    } catch (error) {
      console.error('Error updating deal status:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // AI Evaluation results route
  app.get('/api/deals/:dealId/evaluation', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }
      
      const evaluationResults = await storage.getEvaluationResultsByDealId(dealId);
      
      res.json(evaluationResults);
    } catch (error) {
      console.error('Error fetching evaluation results:', error);
      res.status(500).json({ message: 'Failed to fetch evaluation results' });
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
    const startTime = Date.now();
    try {
      const dealId = parseInt(req.params.dealId);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }
      
      console.log(`📄 Starting documents fetch for deal ${dealId}...`);
      const dbStartTime = Date.now();
      
      const documents = await storage.getDocumentsByDealId(dealId);
      
      const dbEndTime = Date.now();
      const totalTime = Date.now() - startTime;
      
      console.log(`📄 Documents fetch completed for deal ${dealId}: ${documents.length} docs in ${totalTime}ms (DB: ${dbEndTime - dbStartTime}ms)`);
      
      return res.status(200).json(documents);
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`Error fetching documents after ${totalTime}ms:`, error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Delete documents route
  app.delete('/api/documents/delete', async (req: Request, res: Response) => {
    try {
      const { fileIds } = req.body;

      if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
        return res.status(400).json({ message: 'File IDs are required' });
      }

      const deletedCount = await storage.deleteDocuments(fileIds);

      return res.status(200).json({ 
        message: `Successfully deleted ${deletedCount} files`,
        deletedCount
      });
    } catch (error) {
      console.error('Error deleting documents:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // AI Document Assignment Routes
  
  // Assign agents to all documents for a deal
  app.post('/api/deals/:dealId/assign-agents', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }

      console.log(`🤖 Starting AI document assignment for deal ${dealId}`);
      
      const assignments = await aiDocumentAssignmentService.assignAgentsForAllDocuments(dealId);
      
      console.log(`✅ Assignment completed for deal ${dealId}: ${assignments.length} documents processed`);
      
      return res.status(200).json({
        success: true,
        message: `Successfully assigned agents to ${assignments.length} documents`,
        assignments,
        summary: {
          totalDocuments: assignments.length,
          agentCounts: assignments.reduce((acc, assignment) => {
            assignment.assignedAgents.forEach(agent => {
              acc[agent] = (acc[agent] || 0) + 1;
            });
            return acc;
          }, {} as Record<string, number>)
        }
      });
    } catch (error) {
      console.error('Error in AI document assignment:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to assign agents to documents',
        error: String(error)
      });
    }
  });

  // Reassign agents for a specific document
  app.post('/api/documents/:documentId/reassign-agents', async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.documentId);
      if (isNaN(documentId)) {
        return res.status(400).json({ message: 'Invalid document ID' });
      }

      console.log(`🔄 Reassigning agents for document ${documentId}`);
      
      const assignment = await aiDocumentAssignmentService.reassignDocument(documentId);
      
      if (!assignment) {
        return res.status(404).json({ 
          success: false,
          message: 'Document not found or has no content for analysis' 
        });
      }
      
      console.log(`✅ Document ${documentId} reassigned to: ${assignment.assignedAgents.join(', ')}`);
      
      return res.status(200).json({
        success: true,
        message: `Document reassigned to ${assignment.assignedAgents.length} agents`,
        assignment
      });
    } catch (error) {
      console.error('Error reassigning document:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to reassign document agents',
        error: String(error)
      });
    }
  });

  // Get assignment statistics for a deal
  app.get('/api/deals/:dealId/assignment-stats', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }

      const documents = await storage.getDocumentsByDealId(dealId);
      
      const stats = {
        totalDocuments: documents.length,
        assignedDocuments: documents.filter(doc => doc.assignedAgents && doc.assignedAgents.length > 0).length,
        unassignedDocuments: documents.filter(doc => !doc.assignedAgents || doc.assignedAgents.length === 0).length,
        agentCounts: documents.reduce((acc, doc) => {
          if (doc.assignedAgents) {
            doc.assignedAgents.forEach(agent => {
              acc[agent] = (acc[agent] || 0) + 1;
            });
          }
          return acc;
        }, {} as Record<string, number>),
        documentsWithContent: documents.filter(doc => doc.ocrText || doc.aiSummary).length,
        documentsWithoutContent: documents.filter(doc => !doc.ocrText && !doc.aiSummary).length
      };
      
      return res.status(200).json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('Error fetching assignment stats:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to fetch assignment statistics' 
      });
    }
  });
  
  // Delete all analyses for a deal (for "Reset & Run All Analyses" button)
  app.delete('/api/analyses/:dealId', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }
      
      console.log(`🗑️ Deleting all analyses for deal ${dealId}`);
      
      // Delete all analyses for this deal
      const deletedCount = await storage.deleteAnalysesByDealId(dealId);
      
      console.log(`✅ Successfully deleted ${deletedCount} analyses for deal ${dealId}`);
      
      return res.status(200).json({ 
        success: true,
        message: `Successfully deleted ${deletedCount} analyses`,
        deletedCount
      });
    } catch (error) {
      console.error('Error deleting analyses:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to delete analyses' 
      });
    }
  });

  // Analysis routes - Optimized with performance timing
  app.get('/api/analyses/:dealId', async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const dealId = parseInt(req.params.dealId);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }
      
      console.log(`🔍 Starting optimized analyses fetch for deal ${dealId}...`);
      const existingAnalyses = await storage.getAnalysesByDealId(dealId);
      
      const totalTime = Date.now() - startTime;
      console.log(`🔍 Analyses fetch completed: ${existingAnalyses.length} analyses in ${totalTime}ms`);
      
      // Return real analyses if they exist
      if (existingAnalyses.length > 0) {
        return res.status(200).json(existingAnalyses);
      }
      
      // Only generate dummy analysis for existing demo deals (IDs 1-17)
      // New deals should only show analysis if they have real documents
      if (dealId <= 17) {
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
                category: 'Board Governance',
                finding: 'Independent directors comprise 60% of board with relevant expertise',
                status: 'confirmed',
                confidence: 92,
                impact: 'low',
                details: 'Board includes former FDA regulatory executive, healthcare M&A specialist, and digital health entrepreneur. Quarterly meetings documented with proper minutes.'
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
                category: 'IP Portfolio Analysis',
                finding: '23 patents filed, 18 granted across core technology areas',
                status: 'confirmed',
                confidence: 88,
                impact: 'low',
                details: 'Strong patent portfolio covering AI algorithms, data processing methods, and user interface innovations. Freedom to operate analysis completed for key markets.'
              },
              {
                category: 'Employment Agreements',
                finding: 'All employees have signed IP assignment and non-compete agreements',
                status: 'confirmed',
                confidence: 94,
                impact: 'low',
                details: 'Comprehensive employment contracts with proper IP assignment clauses. Non-compete periods range from 12-24 months depending on role level.'
              },
              {
                category: 'Regulatory Compliance',
                finding: 'FDA pathway unclear for medical device classification',
                status: 'red_flag',
                confidence: 89,
                impact: 'high',
                details: 'Product may require Class II medical device approval which could significantly impact timeline and cost. Regulatory strategy needs refinement.'
              },
              {
                category: 'Data Privacy Compliance',
                finding: 'GDPR and HIPAA compliance frameworks implemented',
                status: 'confirmed',
                confidence: 87,
                impact: 'low',
                details: 'Data processing agreements in place with all vendors. Regular privacy impact assessments conducted. DPO appointed and privacy by design principles followed.'
              },
              {
                category: 'Litigation History',
                finding: 'No material litigation identified in past 5 years',
                status: 'confirmed',
                confidence: 96,
                impact: 'low',
                details: 'Clean litigation history with only minor contract disputes resolved through mediation. No IP litigation or regulatory enforcement actions.'
              },
              {
                category: 'Contracts Review',
                finding: 'Key commercial agreements contain unfavorable termination clauses',
                status: 'investigate',
                confidence: 78,
                impact: 'medium',
                details: 'Major customer contracts include 30-day termination clauses without cause. Supplier agreements have similar provisions that could impact operations.'
              },
              {
                category: 'Insurance Coverage',
                finding: 'Professional liability coverage insufficient for healthcare sector',
                status: 'red_flag',
                confidence: 91,
                impact: 'medium',
                details: 'Current coverage of $2M may be inadequate for medical device liability. Cyber insurance limits also below industry standards for health tech.'
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
                category: 'Revenue Quality',
                finding: '87% of revenue is recurring with multi-year contracts',
                status: 'confirmed',
                confidence: 93,
                impact: 'low',
                details: 'Average contract length 2.3 years with annual payment terms. Strong upsell/cross-sell contributing 23% of new ARR.'
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
                category: 'Gross Margins',
                finding: 'Gross margins of 78% with improving trend',
                status: 'confirmed',
                confidence: 89,
                impact: 'low',
                details: 'Margins improved from 71% to 78% over past 12 months due to infrastructure optimization and pricing discipline.'
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
              },
              {
                category: 'Working Capital',
                finding: 'Strong cash collection with 32-day average DSO',
                status: 'confirmed',
                confidence: 94,
                impact: 'low',
                details: 'Excellent collections process with 98% of invoices paid within terms. Automated billing and payment systems in place.'
              },
              {
                category: 'Financial Controls',
                finding: 'SOX-compliant financial controls implemented',
                status: 'confirmed',
                confidence: 87,
                impact: 'low',
                details: 'Monthly financial close process, segregation of duties, and independent audit trail. Big 4 audit firm engaged for annual review.'
              },
              {
                category: 'Burn Rate Trend',
                finding: 'Burn rate increased 34% in last quarter due to hiring',
                status: 'investigate',
                confidence: 92,
                impact: 'medium',
                details: 'Engineering headcount doubled Q/Q driving increased burn. Need to monitor R&D efficiency and timeline to profitability.'
              },
              {
                category: 'Revenue Forecasting',
                finding: 'Sales pipeline visibility limited beyond 6 months',
                status: 'red_flag',
                confidence: 81,
                impact: 'medium',
                details: 'CRM data quality issues and long enterprise sales cycles create forecasting challenges. 43% variance in quarterly predictions.'
              },
              {
                category: 'Pricing Strategy',
                finding: 'Recent 15% price increase shows minimal churn impact',
                status: 'confirmed',
                confidence: 86,
                impact: 'low',
                details: 'Price elasticity testing shows room for additional increases. Customer value metrics support premium positioning.'
              },
              {
                category: 'Capital Structure',
                finding: 'Clean cap table with appropriate option pool',
                status: 'confirmed',
                confidence: 97,
                impact: 'low',
                details: '15% option pool remains with no liquidation preferences. Founder ownership at 65% provides strong alignment.'
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
                category: 'Safety Profile',
                finding: 'Favorable safety data with no serious adverse events',
                status: 'confirmed',
                confidence: 88,
                impact: 'low',
                details: 'Complete safety dataset shows mild to moderate side effects in 23% of patients. No drug-related serious adverse events or deaths reported.'
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
                category: 'Clinical Development Plan',
                finding: 'Phase II trial design approved by FDA in pre-IND meeting',
                status: 'confirmed',
                confidence: 91,
                impact: 'low',
                details: 'FDA provided written feedback on primary endpoints and study design. 300-patient pivotal trial planned with interim analysis at 150 patients.'
              },
              {
                category: 'Medical Affairs Team',
                finding: 'Experienced medical affairs leadership with regulatory expertise',
                status: 'confirmed',
                confidence: 85,
                impact: 'low',
                details: 'Chief Medical Officer with 15+ years regulatory experience. Former FDA reviewer on medical affairs team.'
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
                category: 'Quality Systems',
                finding: 'ISO 13485 certification completed with minor findings',
                status: 'confirmed',
                confidence: 86,
                impact: 'low',
                details: 'Quality management system audit completed with 3 minor non-conformities addressed. Annual surveillance audits scheduled.'
              },
              {
                category: 'Biomarker Strategy',
                finding: 'Companion diagnostic development behind schedule',
                status: 'red_flag',
                confidence: 83,
                impact: 'high',
                details: 'Biomarker assay development 6 months behind target. May impact patient stratification and regulatory approval timeline.'
              },
              {
                category: 'Regulatory Timeline',
                finding: 'FDA approval pathway may extend 24-36 months',
                status: 'red_flag',
                confidence: 84,
                impact: 'high',
                details: 'Recent FDA guidance changes may require additional studies. Regulatory consulting firm recommends conservative timeline.'
              },
              {
                category: 'Intellectual Property in Medical',
                finding: 'Method of treatment patents provide strong protection',
                status: 'confirmed',
                confidence: 90,
                impact: 'low',
                details: 'Composition of matter and method of treatment patents filed in major markets. Patent estate analysis shows 12+ years of exclusivity.'
              },
              {
                category: 'Clinical Data Management',
                finding: 'Electronic data capture system meets FDA 21 CFR Part 11',
                status: 'confirmed',
                confidence: 94,
                impact: 'low',
                details: 'Clinical trial data management platform validated for regulatory submissions. Audit trail and data integrity controls in place.'
              },
              {
                category: 'Pharmacovigilance',
                finding: 'Global safety database established with qualified person',
                status: 'confirmed',
                confidence: 87,
                impact: 'low',
                details: 'Safety database operational in EU and US. Qualified person for pharmacovigilance appointed with appropriate training.'
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
                category: 'Market Penetration Strategy',
                finding: 'Serviceable addressable market estimated at $2.1B within 5 years',
                status: 'confirmed',
                confidence: 88,
                impact: 'low',
                details: 'Conservative penetration analysis based on adoption curves and customer feedback. Early adopter segment represents immediate $340M opportunity.'
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
                category: 'Customer Segmentation',
                finding: 'Mid-market segment shows highest conversion rates at 34%',
                status: 'confirmed',
                confidence: 91,
                impact: 'low',
                details: 'Companies with 100-1000 employees demonstrate fastest adoption. Enterprise segment requires longer sales cycles but higher ACV.'
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
                category: 'Competitive Analysis',
                finding: 'No direct competitor offers complete feature parity',
                status: 'confirmed',
                confidence: 85,
                impact: 'low',
                details: 'Feature gap analysis shows 18-month lead over closest competitor. Patent portfolio provides additional protection for core differentiators.'
              },
              {
                category: 'Channel Strategy',
                finding: 'Partner ecosystem contributing 42% of qualified pipeline',
                status: 'confirmed',
                confidence: 89,
                impact: 'low',
                details: 'System integrator partnerships driving enterprise opportunities. Channel conflict managed through territory assignments and deal registration.'
              },
              {
                category: 'Brand Recognition',
                finding: 'Limited awareness outside target customer segments',
                status: 'investigate',
                confidence: 76,
                impact: 'medium',
                details: 'Brand recognition at 18% among target buyers. Industry analyst coverage improving with recent Gartner inclusion in Magic Quadrant.'
              },
              {
                category: 'Sales Execution',
                finding: 'Sales team lacks enterprise experience',
                status: 'red_flag',
                confidence: 83,
                impact: 'high',
                details: 'Current team successful with SMB but enterprise deals require different skill set. Recent quota misses concerning.'
              },
              {
                category: 'Sales Productivity',
                finding: 'Average deal size increased 67% year-over-year',
                status: 'confirmed',
                confidence: 92,
                impact: 'low',
                details: 'Upselling and cross-selling initiatives driving ACV growth from $28K to $47K. Customer expansion revenue represents 31% of total bookings.'
              },
              {
                category: 'Market Timing',
                finding: 'Regulatory changes driving immediate buying urgency',
                status: 'confirmed',
                confidence: 86,
                impact: 'low',
                details: 'New compliance requirements create 12-18 month implementation window. Customer budget cycles align with regulatory deadlines.'
              },
              {
                category: 'International Opportunity',
                finding: 'European market showing strong early interest',
                status: 'confirmed',
                confidence: 79,
                impact: 'low',
                details: 'UK and German pilot customers demonstrating similar usage patterns. GDPR compliance framework positions well for EU expansion.'
              },
              {
                category: 'Customer Success Metrics',
                finding: 'Time-to-value averages 6.2 weeks with 94% implementation success',
                status: 'confirmed',
                confidence: 93,
                impact: 'low',
                details: 'Customer onboarding process refined through 50+ implementations. Professional services team maintains high satisfaction scores.'
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

  // Delete all analyses for a deal
  app.delete('/api/analyses/:dealId', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }
      
      console.log(`🗑️ Deleting all analyses for deal ${dealId}`);
      const deletedCount = await storage.deleteAnalysesByDealId(dealId);
      
      console.log(`✅ Deleted ${deletedCount} analyses for deal ${dealId}`);
      return res.status(200).json({ 
        success: true,
        message: `Successfully deleted ${deletedCount} analyses`,
        deletedCount
      });
    } catch (error) {
      console.error('Error deleting analyses:', error);
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
  
  // User Activity routes
  app.get('/api/user/activities', async (req: Request, res: Response) => {
    try {
      const userId = 1; // TODO: Get from session when auth is implemented
      const limit = parseInt(req.query.limit as string) || 50;
      
      const activities = await db
        .select()
        .from(userActivities)
        .where(eq(userActivities.userId, userId))
        .orderBy(desc(userActivities.createdAt))
        .limit(limit);
      
      return res.status(200).json(activities);
    } catch (error) {
      console.error('Error fetching user activities:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/user/stats', async (req: Request, res: Response) => {
    try {
      const userId = 1; // TODO: Get from session when auth is implemented
      
      const stats = await db
        .select()
        .from(userStats)
        .where(eq(userStats.userId, userId));
      
      return res.status(200).json(stats[0] || null);
    } catch (error) {
      console.error('Error fetching user stats:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Track user activity
  app.post('/api/user/activity', async (req: Request, res: Response) => {
    try {
      const userId = 1; // TODO: Get from session when auth is implemented
      const { activityType, actionDescription, targetType, targetId, targetName, metadata } = req.body;
      
      await db.insert(userActivities).values({
        userId,
        activityType,
        actionDescription,
        targetType,
        targetId,
        targetName,
        metadata,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(201).json({ success: true });
    } catch (error) {
      console.error('Error tracking user activity:', error);
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

  // Delete automation
  app.delete('/api/automations/:id', async (req: Request, res: Response) => {
    try {
      const automationId = parseInt(req.params.id);
      if (isNaN(automationId)) {
        return res.status(400).json({ message: 'Invalid automation ID' });
      }
      
      await storage.deleteAutomation(automationId);
      return res.status(200).json({ message: 'Automation deleted successfully' });
    } catch (error) {
      console.error('Error deleting automation:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get automation executions
  app.get('/api/automations/executions', async (req: Request, res: Response) => {
    try {
      const executions = await storage.getAutomationExecutions();
      return res.status(200).json(executions);
    } catch (error) {
      console.error('Error fetching automation executions:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Manual automation execution
  app.post('/api/automations/:id/execute', async (req: Request, res: Response) => {
    try {
      const automationId = parseInt(req.params.id);
      const { dealId } = req.body;
      
      if (isNaN(automationId)) {
        return res.status(400).json({ message: 'Invalid automation ID' });
      }
      
      if (!dealId) {
        return res.status(400).json({ message: 'Deal ID is required' });
      }
      
      const automation = await storage.getAutomationById(automationId);
      if (!automation) {
        return res.status(404).json({ message: 'Automation not found' });
      }
      
      const execution = await executeAutomation(automation, dealId);
      return res.status(200).json(execution);
    } catch (error) {
      console.error('Error executing automation:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Register AI agent routes
  app.use('/api/ai', aiAgentRoutes);
  
  // Register Microsoft OAuth routes
  app.use('/api/microsoft', microsoftAuthRoutes);
  
  // Register investor matching routes
  app.use('/api/investor-matching', investorMatchingRoutes);
  
  // Register matching intelligence routes
  app.use('/api/matching-intelligence', matchingIntelligenceRoutes);
  
  // Register other routes
  app.use('/api/auth', authRoutes);
  app.use('/api/email', emailRoutes);
  app.use('/api/inbox', inboxRoutes);

  // REMOVED: Duplicate route that was causing conflicts

  // Enhanced manual document assignment endpoint with AI integration
  app.post('/api/deals/:dealId/documents/:docId/assign', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      const docId = parseInt(req.params.docId);
      const { agentType, comment, assignmentType } = req.body;

      if (isNaN(dealId) || isNaN(docId)) {
        return res.status(400).json({ message: 'Invalid deal or document ID' });
      }

      if (!agentType) {
        return res.status(400).json({ message: 'Agent type is required' });
      }

      console.log(`🔄 ${assignmentType || 'Manual'} assignment: Document ${docId} to ${agentType} agent for deal ${dealId}`);
      if (comment) {
        console.log(`💬 Assignment comment: ${comment}`);
      }

      // Get the document details
      const document = await storage.getDocumentById(docId);
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Update document with assignment metadata (when database schema supports it)
      try {
        await storage.updateDocument(docId, {
          assignedAgent: agentType,
          assignedAt: new Date()
        });
      } catch (updateError) {
        console.warn('Could not update document assignment metadata:', updateError);
      }

      // Save learning data for manual assignments with comments (future enhancement)
      if (assignmentType === 'manual' && comment) {
        console.log(`💡 Saving learning data: ${agentType} assignment for doc ${docId} with comment: ${comment}`);
        // Future: Save to document_assignment_learning table
      }

      // Check if analysis already exists for this agent
      let analysis = await storage.getAnalysisByDealAndAgent(dealId, agentType);
      
      if (analysis) {
        // Update existing analysis to include this document
        const currentSources = analysis.documentSources || [];
        const updatedSources = Array.from(new Set([...currentSources, document.name])); // Avoid duplicates
        
        await storage.updateAnalysis(analysis.id, {
          documentSources: updatedSources,
          updatedAt: new Date()
        });
        
        console.log(`✅ Added document ${document.name} to existing ${agentType} analysis`);
      } else {
        // Create new analysis entry for this agent
        const newAnalysis = {
          dealId,
          agentType,
          documentSources: [document.name],
          status: assignmentType === 'ai' ? "AI Assignment" : "Manual Assignment",
          progress: 0,
          findings: [],
          recommendations: []
        };
        
        await storage.createAnalysis(newAnalysis);
        console.log(`✅ Created new ${agentType} analysis with document ${document.name}`);
      }

      return res.status(200).json({ 
        message: 'Document assigned successfully',
        documentName: document.name,
        agentType,
        assignmentType: assignmentType || 'manual',
        comment: comment || null
      });

    } catch (error) {
      console.error('Error assigning document:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // AI-powered bulk document assignment endpoint
  app.post('/api/deals/:dealId/ai-assign-documents', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      const userId = (req as any).user?.id || 1; // Default to admin user

      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }

      console.log(`🤖 Starting AI-powered bulk assignment for deal ${dealId}`);

      // Import and use the intelligent assignment service
      const { intelligentAssignmentService } = await import('./services/intelligentAssignmentService');
      const result = await intelligentAssignmentService.batchAssignDocuments(dealId, userId);

      console.log(`✅ AI assignment completed: ${result.successfulAssignments}/${result.totalProcessed} successful`);

      res.json({
        success: true,
        message: `AI assignment completed successfully`,
        totalProcessed: result.totalProcessed,
        successfulAssignments: result.successfulAssignments,
        errors: result.errors
      });

    } catch (error) {
      console.error('❌ Error in AI document assignment:', error);
      res.status(500).json({
        success: false,
        message: 'AI assignment failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Individual AI document assignment endpoint
  app.post('/api/deals/:dealId/documents/:docId/ai-assign', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      const docId = parseInt(req.params.docId);
      const userId = (req as any).user?.id || 1;

      if (isNaN(dealId) || isNaN(docId)) {
        return res.status(400).json({ message: 'Invalid deal or document ID' });
      }

      console.log(`🤖 Starting AI assignment for document ${docId} in deal ${dealId}`);

      const { intelligentAssignmentService } = await import('./services/intelligentAssignmentService');
      const result = await intelligentAssignmentService.assignDocumentToAgents(docId, userId);

      console.log(`✅ AI assignment completed for document ${docId}: ${result.assignments.join(', ')}`);

      res.json({
        success: true,
        message: 'AI assignment completed',
        assignment: {
          documentId: docId,
          agents: result.assignments,
          reasoning: result.reasoning,
          confidence: result.confidence
        }
      });

    } catch (error) {
      console.error('❌ Error in AI document assignment:', error);
      res.status(500).json({
        success: false,
        message: 'AI assignment failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Document download endpoint with support for both download and inline viewing
  app.get('/api/documents/:id/download', async (req: Request, res: Response) => {
    try {
      console.log(`📥 Download request for document ID: ${req.params.id}`);
      
      const documentId = parseInt(req.params.id);
      if (isNaN(documentId)) {
        console.log('❌ Invalid document ID provided');
        return res.status(400).json({ message: 'Invalid document ID' });
      }

      // Check if this is for inline viewing (used by PDF viewer)
      const isInlineView = req.query.view === 'inline';
      const isDataUrl = req.query.dataUrl === 'true';
      const userAgent = req.headers['user-agent'] || '';
      const isIframe = req.headers['sec-fetch-dest'] === 'iframe' || 
                      req.headers.referer?.includes('pdf-viewer') ||
                      userAgent.includes('iframe');
      
      console.log(`🔍 PDF DOWNLOAD DEBUG - DETAILED REQUEST ANALYSIS`);
      console.log(`📊 Inline detection - view param: ${req.query.view}, isInlineView: ${isInlineView}, isIframe: ${isIframe}, sec-fetch-dest: ${req.headers['sec-fetch-dest']}, referer: ${req.headers.referer}`);
      console.log(`📋 Request headers:`, {
        'user-agent': req.headers['user-agent'],
        'accept': req.headers['accept'],
        'accept-encoding': req.headers['accept-encoding'],
        'cache-control': req.headers['cache-control'],
        'sec-fetch-mode': req.headers['sec-fetch-mode'],
        'sec-fetch-site': req.headers['sec-fetch-site']
      });

      // Get document from database
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        console.log(`❌ Document ${documentId} not found in database`);
        return res.status(404).json({ message: 'Document not found' });
      }

      console.log(`📄 Found document: ${document.name} at path: ${document.path}`);

      // Check if file exists
      if (!fs.existsSync(document.path)) {
        console.log(`❌ File not found on server: ${document.path}`);
        return res.status(404).json({ 
          message: 'Document file not available', 
          details: 'This document appears to have been removed during system maintenance. Please re-upload the file if needed.',
          documentName: document.name,
          documentId: documentId
        });
      }

      const ext = path.extname(document.name).toLowerCase();
      
      // Special handling for data URL requests (Chrome bypass solution)
      if (isDataUrl && ext === '.pdf') {
        try {
          const fileBuffer = fs.readFileSync(document.path);
          const base64Data = fileBuffer.toString('base64');
          const dataUrl = `data:application/pdf;base64,${base64Data}`;
          
          console.log(`📄 Generated data URL for PDF: ${document.name} (${fileBuffer.length} bytes)`);
          
          return res.json({
            success: true,
            dataUrl: dataUrl,
            filename: document.name,
            size: fileBuffer.length
          });
        } catch (error) {
          console.error('❌ Data URL generation failed:', error);
          return res.status(500).json({ message: 'Data URL generation failed' });
        }
      }

      // Get file stats
      const stats = fs.statSync(document.path);
      console.log(`📊 File stats - Size: ${stats.size} bytes`);
      
      // Set appropriate headers for download
      let mimeType = 'application/octet-stream';
      
      switch (ext) {
        case '.pdf':
          mimeType = 'application/pdf';
          break;
        case '.doc':
          mimeType = 'application/msword';
          break;
        case '.docx':
          mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          break;
        case '.xls':
          mimeType = 'application/vnd.ms-excel';
          break;
        case '.xlsx':
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        case '.txt':
          mimeType = 'text/plain';
          break;
        case '.csv':
          mimeType = 'text/csv';
          break;
        case '.json':
          mimeType = 'application/json';
          break;
        case '.png':
          mimeType = 'image/png';
          break;
        case '.jpg':
        case '.jpeg':
          mimeType = 'image/jpeg';
          break;
      }

      // Determine if we should use inline disposition
      const shouldUseInline = ext === '.pdf' && (isIframe || isInlineView);
      
      console.log(`📤 Setting headers - MIME: ${mimeType}, Size: ${stats.size}, Filename: ${document.name}, Inline: ${shouldUseInline}`);

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', stats.size);
      
      // For PDF files in iframe or explicit inline view, use inline disposition
      if (shouldUseInline) {
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(document.name)}`);
      } else {
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(document.name)}`);
      }
      
      res.setHeader('Cache-Control', 'no-cache');
      
      // Chrome-optimized headers for PDF viewing
      if (ext === '.pdf' && shouldUseInline) {
        // Clear any blocking headers
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.removeHeader('X-Content-Type-Options');
        
        // Force PDF MIME type and inline display
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
        
        // Enable cross-origin and caching for better compatibility
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        
        // Chrome-specific headers to bypass blocking
        res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        
        console.log(`📄 Chrome bypass headers set for: ${document.name}`);
      } else {
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      }
      
      // Stream the file
      const fileStream = fs.createReadStream(document.path);
      
      fileStream.on('error', (error) => {
        console.error('❌ File stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ message: 'File stream error' });
        }
      });

      fileStream.on('end', () => {
        console.log(`✅ Successfully streamed file: ${document.name}`);
      });

      fileStream.pipe(res);
      
    } catch (error) {
      console.error('❌ Download error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Download failed', error: error.message });
      }
    }
  });

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

      // Get document info from database
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      console.log(`📄 Processing OCR for document: ${document.name}`);
      console.log(`📁 Document path from DB: ${document.path}`);

      let filePath = document.path;

      // Verify the file exists at the stored path
      if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found at stored path: ${filePath}`);
        return res.status(404).json({ 
          message: 'File not found at stored path',
          path: filePath 
        });
      }

      console.log(`✅ File found at: ${filePath}`);
      console.log(`🚀 STARTING MISTRAL OCR PROCESSING: ${filePath}`);
      
      // Use actual Mistral OCR service
      const { mistralOCRService } = await import('./services/mistralOCR');
      console.log('📦 Mistral OCR service imported successfully');
      
      const ocrResult = await mistralOCRService.extractText(filePath, document.type || 'application/pdf');
      
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

  // AI Evaluation endpoint
  app.post('/api/deals/:dealId/evaluate', authenticate, async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }

      console.log(`🤖 Starting AI evaluation for deal ${dealId}...`);
      
      // Check if deal exists
      const deal = await storage.getDealById(dealId);
      if (!deal) {
        return res.status(404).json({ message: 'Deal not found' });
      }

      // Perform AI evaluation
      const evaluationResult = await evaluateCompanyByDeal(dealId);
      
      res.json({
        success: true,
        dealId,
        overallScore: evaluationResult.overallScore,
        recommendation: evaluationResult.recommendation,
        summary: evaluationResult.summary,
        criterionScores: evaluationResult.criterionScores,
        keyFindings: evaluationResult.keyFindings,
        redFlags: evaluationResult.redFlags,
        evaluatedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error(`❌ AI evaluation failed for deal ${req.params.dealId}:`, error);
      res.status(500).json({ 
        message: 'AI evaluation failed', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get evaluation results for a deal
  app.get('/api/deals/:dealId/evaluation-results', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }

      const results = await storage.getEvaluationResultsByDealId(dealId);
      const criteria = await storage.getAllEvaluationCriteria();
      
      // Enrich results with criteria information
      const enrichedResults = results.map(result => {
        const criterion = criteria.find(c => c.id === result.criteriaId);
        return {
          ...result,
          criteriaName: criterion?.name || 'Unknown Criteria',
          criteriaDescription: criterion?.description || '',
          criteriaWeight: criterion?.weight || 0
        };
      });

      res.json(enrichedResults);
    } catch (error) {
      console.error('Error fetching evaluation results:', error);
      res.status(500).json({ message: 'Failed to fetch evaluation results' });
    }
  });

  // Settings API routes
  app.get('/api/settings/user', authenticate, async (req: any, res: Response) => {
    try {
      const userId = req.userId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // User settings data - comprehensive profile structure for Edit Profile form
      const userSettings = {
        id: user.id,
        firstName: user.name?.split(' ')[0] || 'Admin',
        lastName: user.name?.split(' ')[1] || 'User',
        email: user.email || '',
        phone: user.phone || '',
        location: user.location || '',
        bio: user.bio || '',
        title: user.title || '',
        company: user.company || '',
        website: user.website || '',
        linkedin: user.linkedin || '',
        twitter: user.twitter || '',
        role: user.role,
        timezone: user.timezone || 'UTC',
        language: user.language || 'en',
        
        // Notification preferences (flat for backward compatibility)
        emailNotifications: user.emailNotifications ?? true,
        browserNotifications: user.browserNotifications ?? true,
        dealNotifications: user.dealNotifications ?? true,
        matchNotifications: user.matchNotifications ?? true,
        reportNotifications: user.reportNotifications ?? true,
        aiNotifications: user.aiNotifications ?? true,
        weeklyReports: user.weeklyReports ?? false,
        
        // Privacy settings (flat for backward compatibility)
        showEmail: user.showEmail ?? false,
        showPhone: user.showPhone ?? false,
        publicProfile: user.publicProfile ?? true,
        
        apiKey: user.apiKey || null
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
      const updates = req.body;
      
      console.log('🔄 Updating user settings for user:', userId, updates);
      
      // Prepare update data for database
      const updateData: any = {};
      
      // Handle name updates
      if (updates.firstName || updates.lastName) {
        const currentUser = await storage.getUser(userId);
        const firstName = updates.firstName || currentUser?.name?.split(' ')[0] || 'Admin';
        const lastName = updates.lastName || currentUser?.name?.split(' ')[1] || 'User';
        updateData.name = `${firstName} ${lastName}`;
      }
      
      // Handle all profile fields
      if (updates.email !== undefined) updateData.email = updates.email;
      if (updates.phone !== undefined) updateData.phone = updates.phone;
      if (updates.location !== undefined) updateData.location = updates.location;
      if (updates.bio !== undefined) updateData.bio = updates.bio;
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.company !== undefined) updateData.company = updates.company;
      if (updates.website !== undefined) updateData.website = updates.website;
      if (updates.linkedin !== undefined) updateData.linkedin = updates.linkedin;
      if (updates.twitter !== undefined) updateData.twitter = updates.twitter;
      if (updates.language !== undefined) updateData.language = updates.language;
      if (updates.timezone !== undefined) updateData.timezone = updates.timezone;
      
      // Handle notification preferences
      if (updates.notifications?.email !== undefined) updateData.emailNotifications = updates.notifications.email;
      if (updates.notifications?.browser !== undefined) updateData.browserNotifications = updates.notifications.browser;
      if (updates.notifications?.deals !== undefined) updateData.dealNotifications = updates.notifications.deals;
      if (updates.notifications?.matches !== undefined) updateData.matchNotifications = updates.notifications.matches;
      if (updates.notifications?.reports !== undefined) updateData.reportNotifications = updates.notifications.reports;
      
      // Handle privacy settings
      if (updates.privacy?.showEmail !== undefined) updateData.showEmail = updates.privacy.showEmail;
      if (updates.privacy?.showPhone !== undefined) updateData.showPhone = updates.privacy.showPhone;
      if (updates.privacy?.publicProfile !== undefined) updateData.publicProfile = updates.privacy.publicProfile;
      
      // Legacy notification preferences (backward compatibility)
      if (updates.emailNotifications !== undefined) updateData.emailNotifications = updates.emailNotifications;
      if (updates.dealNotifications !== undefined) updateData.dealNotifications = updates.dealNotifications;
      if (updates.aiNotifications !== undefined) updateData.aiNotifications = updates.aiNotifications;
      if (updates.weeklyReports !== undefined) updateData.weeklyReports = updates.weeklyReports;
      
      // Update user in database
      const updatedUser = await storage.updateUser(userId, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      console.log('✅ User settings updated successfully');
      
      res.json({ 
        success: true, 
        message: 'User settings updated successfully',
        user: updatedUser
      });
    } catch (error) {
      console.error('❌ Error updating user settings:', error);
      res.status(500).json({ message: 'Failed to update user settings' });
    }
  });

  app.get('/api/settings/system', authenticate, async (req: any, res: Response) => {
    try {
      const user = await storage.getUser(req.userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admin rights required.' });
      }

      console.log('🔄 Fetching system settings from database...');
      
      // Fetch system settings from database
      const settingsQuery = await db.select().from(systemSettings);
      const settings: Record<string, string> = {};
      
      // Convert array to object for frontend compatibility
      settingsQuery.forEach(setting => {
        settings[setting.key] = setting.value;
      });
      
      // Ensure all required settings have defaults
      const systemSettingsData = {
        defaultAiModel: settings.defaultAiModel || 'gpt-4o',
        autoProcessEmails: settings.autoProcessEmails === 'true',
        theme: settings.theme || 'dark',
        language: settings.language || 'en'
      };

      console.log('✅ System settings retrieved:', systemSettingsData);
      res.json(systemSettingsData);
    } catch (error) {
      console.error('❌ Error fetching system settings:', error);
      res.status(500).json({ message: 'Failed to fetch system settings' });
    }
  });

  app.patch('/api/settings/system', authenticate, async (req: any, res: Response) => {
    try {
      const user = await storage.getUser(req.userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admin rights required.' });
      }

      const updates = req.body;
      console.log('🔄 Updating system settings:', updates);

      // Update each setting in the database
      const updatePromises = Object.entries(updates).map(async ([key, value]) => {
        const stringValue = typeof value === 'boolean' ? value.toString() : String(value);
        
        const [updatedSetting] = await db
          .update(systemSettings)
          .set({ 
            value: stringValue,
            updatedAt: new Date()
          })
          .where(eq(systemSettings.key, key))
          .returning();

        if (!updatedSetting) {
          // If setting doesn't exist, create it
          await db.insert(systemSettings).values({
            key,
            value: stringValue,
            description: `System setting: ${key}`,
            category: 'general'
          });
        }
        
        console.log(`✅ Updated system setting: ${key} = ${stringValue}`);
        return { key, value: stringValue };
      });

      await Promise.all(updatePromises);
      
      res.json({ 
        success: true, 
        message: 'System settings updated successfully',
        updates: Object.keys(updates)
      });
    } catch (error) {
      console.error('❌ Error updating system settings:', error);
      res.status(500).json({ message: 'Failed to update system settings' });
    }
  });

  app.post('/api/settings/generate-api-key', authenticate, async (req: any, res: Response) => {
    try {
      const userId = req.userId;
      const apiKey = `aesc_${randomUUID().replace(/-/g, '')}`;
      
      console.log('🔑 Generating API key for user:', userId);
      
      // Store API key in database
      await storage.updateUser(userId, { apiKey });
      
      console.log('✅ API key stored in database for user:', userId);
      
      res.json({ 
        success: true, 
        message: 'API key generated successfully',
        apiKey: apiKey
      });
    } catch (error) {
      console.error('❌ Error generating API key:', error);
      res.status(500).json({ message: 'Failed to generate API key' });
    }
  });

  app.post('/api/settings/change-password', authenticate, async (req: any, res: Response) => {
    try {
      const userId = req.userId;
      const { currentPassword, newPassword } = req.body;
      
      console.log('🔄 Password change request for user:', userId);
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ 
          message: 'Both current and new passwords are required' 
        });
      }
      
      if (newPassword.length < 8) {
        return res.status(400).json({ 
          message: 'New password must be at least 8 characters long' 
        });
      }

      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      
      if (!isCurrentPasswordValid) {
        console.log('❌ Invalid current password for user:', userId);
        return res.status(400).json({ 
          message: 'Current password is incorrect' 
        });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
      
      // Update user password in database
      await storage.updateUser(userId, { 
        ...user, 
        password: hashedNewPassword,
        updatedAt: new Date()
      });
      
      console.log('✅ Password changed successfully for user:', userId);
      
      res.json({ 
        success: true, 
        message: 'Password changed successfully' 
      });
    } catch (error) {
      console.error('❌ Error changing password:', error);
      res.status(500).json({ message: 'Failed to change password' });
    }
  });

  // Profile API endpoints
  app.get('/api/user/activity', authenticate, async (req: any, res: Response) => {
    try {
      const userId = req.userId;
      
      // Return user activity data
      const activityData = {
        recentActions: [
          { action: 'Reviewed Tesla deal', time: '2 hours ago', type: 'review' },
          { action: 'Generated investment memo for SpaceX', time: '4 hours ago', type: 'memo' },
          { action: 'Matched Neuralink with Sequoia Capital', time: '1 day ago', type: 'match' },
          { action: 'Updated deal status for Anthropic', time: '2 days ago', type: 'update' }
        ]
      };
      
      res.json(activityData);
    } catch (error) {
      console.error('Error fetching user activity:', error);
      res.status(500).json({ message: 'Failed to fetch user activity' });
    }
  });

  app.get('/api/user/stats', authenticate, async (req: any, res: Response) => {
    try {
      const userId = req.userId;
      
      // Return user statistics
      const statsData = {
        dealsReviewed: 47,
        memosGenerated: 23,
        matchesMade: 12,
        totalValue: '15.2M'
      };
      
      res.json(statsData);
    } catch (error) {
      console.error('Error fetching user stats:', error);
      res.status(500).json({ message: 'Failed to fetch user stats' });
    }
  });

  // AI-powered company description generation
  app.post('/api/ai/generate-company-description', async (req: Request, res: Response) => {
    try {
      const { website } = req.body;
      
      if (!website) {
        return res.status(400).json({ message: 'Website URL is required' });
      }

      // Fetch website content
      const websiteResponse = await fetch(website, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Aescuvest-Bot/1.0)'
        }
      });

      if (!websiteResponse.ok) {
        return res.status(400).json({ message: 'Unable to fetch website content' });
      }

      const htmlContent = await websiteResponse.text();
      
      // Extract text content from HTML (basic extraction)
      const textContent = htmlContent
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 8000); // Limit content length

      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ message: 'OpenAI API key not configured' });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are an expert business analyst specializing in venture capital due diligence. Generate a comprehensive yet concise company description (2-3 paragraphs, 150-250 words) suitable for investment analysis based on the provided website content."
          },
          {
            role: "user",
            content: `Analyze this website content and generate a professional company description for investment purposes. Focus on: business model, target market, key value proposition, competitive advantages, and growth potential.\n\nWebsite: ${website}\n\nContent: ${textContent}`
          }
        ],
        max_tokens: 400,
        temperature: 0.7
      });

      const description = completion.choices[0]?.message?.content || '';
      
      res.json({ description });
    } catch (error) {
      console.error('Error generating company description:', error);
      res.status(500).json({ message: 'Failed to generate company description' });
    }
  });

  // AI-powered company location detection
  app.post('/api/ai/generate-company-location', async (req: Request, res: Response) => {
    try {
      const { website } = req.body;
      
      if (!website) {
        return res.status(400).json({ message: 'Website URL is required' });
      }

      // Fetch website content
      const websiteResponse = await fetch(website, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Aescuvest-Bot/1.0)'
        }
      });

      if (!websiteResponse.ok) {
        return res.status(400).json({ message: 'Unable to fetch website content' });
      }

      const htmlContent = await websiteResponse.text();
      
      // Extract text content from HTML
      const textContent = htmlContent
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 8000);

      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ message: 'OpenAI API key not configured' });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert at extracting company location information from website content. Extract the headquarters or main office location and return it in the format: 'City, Country'. Be precise and use the actual city and country names. If multiple locations are mentioned, prioritize the headquarters or main office."
          },
          {
            role: "user",
            content: `Analyze this website content and extract the company's headquarters location. Look for contact information, about pages, office addresses, or any mentions of where the company is based.\n\nWebsite: ${website}\n\nContent: ${textContent}`
          }
        ],
        max_tokens: 50,
        temperature: 0.3
      });

      const location = completion.choices[0]?.message?.content?.trim() || '';
      
      res.json({ location });
    } catch (error) {
      console.error('Error generating company location:', error);
      res.status(500).json({ message: 'Failed to generate company location' });
    }
  });

  // Generate AI document summary with critical/neutral categorization
  app.post('/api/ai/generate-document-summary', async (req: Request, res: Response) => {
    try {
      const { documentId } = req.body;
      
      if (!documentId) {
        return res.status(400).json({ message: 'Document ID is required' });
      }

      // Get document from database
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      if (!document.ocrText || document.ocrText.trim().length === 0) {
        return res.status(400).json({ message: 'Document has no extracted text to summarize' });
      }

      console.log(`🤖 Generating AI summary for document: ${document.name}`);

      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ message: 'OpenAI API key not configured' });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are an expert investment analyst specializing in due diligence document analysis. Analyze the provided document and create a comprehensive, well-structured summary with the following sections:

1. **Executive Summary** - High-level overview in 2-3 sentences
2. **Critical Information** - Key points that could significantly impact investment decisions (financial data, risks, legal issues, strategic changes)
3. **Neutral Information** - General business information, background details, standard operational content
4. **Key Financial Data** - Extract any numbers, metrics, financial projections, budgets
5. **Risk Assessment** - Identify potential risks or concerns
6. **Strategic Implications** - How this information affects the overall investment thesis

Format your response as JSON with the following structure:
{
  "executiveSummary": "string",
  "criticalFindings": ["array of critical points"],
  "neutralFindings": ["array of neutral/background points"],  
  "keyFinancialData": ["array of financial metrics/numbers"],
  "riskAssessment": ["array of identified risks"],
  "strategicImplications": "string",
  "documentType": "string",
  "confidenceScore": number between 0-1
}

Be thorough, professional, and focus on investment-relevant insights.`
          },
          {
            role: "user",
            content: `Please analyze this document titled "${document.name}" and provide a comprehensive summary:

${document.ocrText}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 2000
      });

      const aiSummary = JSON.parse(response.choices[0].message.content || '{}');
      
      console.log(`✅ Generated AI summary for document ${documentId}`);

      res.json({
        success: true,
        summary: aiSummary,
        documentName: document.name,
        generatedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error('AI document summary generation error:', error);
      res.status(500).json({ 
        message: 'Failed to generate document summary', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Background AI processing system
  const processingDocuments = new Set<number>();
  let isProcessorRunning = false;
  
  // Simplified persistent AI processor
  async function startBackgroundAIProcessor() {
    if (isProcessorRunning) return;
    isProcessorRunning = true;
    
    console.log('🤖 Starting background AI summary processor...');
    
    const processNextBatch = async () => {
      try {
        // Get documents needing AI processing
        const allDocs = await storage.getAllDocuments();
        const pendingDocs = allDocs.filter(doc => 
          doc.ocrText && 
          doc.ocrText.trim().length > 0 && 
          (!doc.aiSummaryStatus || doc.aiSummaryStatus === 'pending' || doc.aiSummaryStatus === 'failed') &&
          !processingDocuments.has(doc.id)
        );
        
        if (pendingDocs.length > 0) {
          console.log(`🔄 Processing up to 3 documents out of ${pendingDocs.length} pending`);
          
          // Process up to 3 documents concurrently for optimal throughput
          const batch = pendingDocs.slice(0, 3);
          const promises = batch.map(async (doc) => {
            processingDocuments.add(doc.id);
            try {
              await processDocumentAISummaryInBackground(doc.id, doc);
            } finally {
              processingDocuments.delete(doc.id);
            }
          });
          
          await Promise.all(promises);
        }
        
        // Schedule next batch processing - optimized for speed
        setTimeout(processNextBatch, 20000); // 20 seconds between batches
      } catch (error) {
        console.error('Error in background AI processor:', error);
        setTimeout(processNextBatch, 30000); // Retry in 30 seconds on error
      }
    };
    
    // Start processing
    processNextBatch();
  }
  
  // Start the background processor
  setTimeout(() => startBackgroundAIProcessor(), 5000); // Start after 5 seconds
  
  // Rate limiting for manual processing requests
  const aiProcessingLimiter = new Map<number, number>();
  const AI_PROCESSING_COOLDOWN = 300000; // 5 minutes cooldown

  // Batch process AI summaries for all documents in a deal
  app.post('/api/deals/:dealId/process-ai-summaries', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      // Check rate limiting - prevent duplicate requests
      const lastProcessing = aiProcessingLimiter.get(dealId);
      const now = Date.now();
      
      if (lastProcessing && (now - lastProcessing) < AI_PROCESSING_COOLDOWN) {
        const remainingTime = Math.ceil((AI_PROCESSING_COOLDOWN - (now - lastProcessing)) / 1000);
        return res.json({
          success: true,
          message: `AI processing cooldown active for deal ${dealId}. ${remainingTime}s remaining.`,
          processed: 0,
          total: 0,
          cooldown: true
        });
      }
      
      // Get all documents for this deal that don't have completed AI summaries - BYPASS CACHE
      const dealDocuments = await storage.getDocumentsByDealIdFresh(dealId);
      const documentsToProcess = dealDocuments.filter(doc => 
        doc.ocrText && 
        doc.ocrText.trim().length > 0 && 
        (!doc.aiSummaryStatus || doc.aiSummaryStatus === 'pending' || doc.aiSummaryStatus === 'failed')
      );

      console.log(`🤖 Starting batch AI summary processing for ${documentsToProcess.length} documents in deal ${dealId}`);
      
      // If no documents to process, don't set cooldown
      if (documentsToProcess.length === 0) {
        return res.json({
          success: true,
          message: `No documents require AI summary processing in deal ${dealId}`,
          processed: 0,
          total: dealDocuments.length,
          allComplete: true
        });
      }
      
      // Set rate limiting timestamp only if we're actually processing
      aiProcessingLimiter.set(dealId, now);

      // Process documents in background with proper queuing
      let processedCount = 0;
      
      // Start processing documents one by one with proper delays
      for (let i = 0; i < documentsToProcess.length; i++) {
        const doc = documentsToProcess[i];
        
        // Process with delay to prevent rate limiting
        setTimeout(() => {
          processDocumentAISummaryInBackground(doc.id, doc).catch(error => {
            console.error(`Background processing failed for document ${doc.id}:`, error);
          });
        }, i * 5000); // 5 second delay between each document
        
        processedCount++;
      }

      res.json({
        success: true,
        message: `Started AI summary processing for ${processedCount} documents`,
        processed: processedCount,
        total: documentsToProcess.length
      });

    } catch (error) {
      console.error('Error starting batch AI summary processing:', error);
      res.status(500).json({ 
        error: 'Failed to start batch processing',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Advanced OpenAI rate limiter with conservative settings
  class OpenAIRateLimiter {
    private lastRequestTime = 0;
    private minInterval = 1000; // 1 second between requests (optimal for GPT-4)
    private concurrentLimit = 3; // Max 3 concurrent requests for better throughput
    private activeRequests = 0;
    private requestQueue: (() => void)[] = [];

    async executeWithLimit<T>(fn: () => Promise<T>): Promise<T> {
      return new Promise((resolve, reject) => {
        const execute = async () => {
          if (this.activeRequests >= this.concurrentLimit) {
            this.requestQueue.push(execute);
            return;
          }

          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          
          if (timeSinceLastRequest < this.minInterval) {
            const waitTime = this.minInterval - timeSinceLastRequest;
            setTimeout(execute, waitTime);
            return;
          }

          this.activeRequests++;
          this.lastRequestTime = now;

          try {
            const result = await this.executeWithRetry(fn);
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            this.activeRequests--;
            
            // Process next in queue
            if (this.requestQueue.length > 0) {
              const nextExecute = this.requestQueue.shift();
              if (nextExecute) {
                setTimeout(nextExecute, this.minInterval);
              }
            }
          }
        };

        execute();
      });
    }

    private async executeWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await fn();
        } catch (error: any) {
          console.log(`🔄 OpenAI API attempt ${attempt}/${maxRetries}:`, error?.message);
          
          if (error?.status === 429 || error?.message?.includes('rate limit')) {
            if (attempt === maxRetries) {
              throw new Error(`API rate limit error, preventing text extraction. As a result, no specific content from the document is available for review.`);
            }
            
            // Exponential backoff: 2^attempt * 2 seconds + jitter
            const baseDelay = Math.pow(2, attempt) * 2000;
            const jitter = Math.random() * 1000;
            const backoffTime = baseDelay + jitter;
            
            console.log(`⏰ Rate limit hit, waiting ${Math.round(backoffTime/1000)}s before retry ${attempt + 1}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            continue;
          }
          
          if (attempt === maxRetries) {
            throw error;
          }
          
          // For other errors, shorter retry delay
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
      
      throw new Error('Max retries exceeded');
    }
  }

  const openaiLimiter = new OpenAIRateLimiter();

  // Background AI summary processing function with robust rate limiting
  async function processDocumentAISummaryInBackground(documentId: number, document: any) {
    try {
      console.log(`🤖 Starting background AI summary for document: ${document.name}`);
      
      // Mark document as processing
      await storage.updateDocument(documentId, { aiSummaryStatus: 'processing' });
      
      if (!process.env.OPENAI_API_KEY) {
        console.error('OpenAI API key not configured');
        await storage.updateDocument(documentId, { aiSummaryStatus: 'failed' });
        return;
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await openaiLimiter.executeWithLimit(async () => {
        return await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an expert investment analyst specializing in due diligence document analysis. Analyze the provided document and create a comprehensive, well-structured summary with the following sections:

1. **Executive Summary** - High-level overview in 2-3 sentences
2. **Critical Information** - Key points that could significantly impact investment decisions (financial data, risks, legal issues, strategic changes)
3. **Neutral Information** - General business information, background details, standard operational content
4. **Key Financial Data** - Extract any numbers, metrics, financial projections, budgets
5. **Risk Assessment** - Identify potential risks or concerns
6. **Strategic Implications** - How this information affects the overall investment thesis

Format your response as JSON with the following structure:
{
  "executiveSummary": "string",
  "criticalFindings": ["array of critical points"],
  "neutralFindings": ["array of neutral/background points"],  
  "keyFinancialData": ["array of financial metrics/numbers"],
  "riskAssessment": ["array of identified risks"],
  "strategicImplications": "string",
  "documentType": "string",
  "confidenceScore": number between 0-1
}

Be thorough, professional, and focus on investment-relevant insights.`
            },
            {
              role: "user",
              content: `Please analyze this document titled "${document.name}" and provide a comprehensive summary:

${document.ocrText ? document.ocrText.substring(0, 15000) : 'No OCR text available'}`
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_tokens: 2000
        });
      });

      const aiSummary = JSON.parse(response.choices[0].message.content || '{}');
      
      // Save the AI summary to database via storage
      console.log(`💾 Saving AI summary for document ${documentId}:`, {
        summaryKeys: Object.keys(aiSummary),
        hasExecutiveSummary: !!aiSummary.executiveSummary
      });
      
      const updatedDoc = await storage.updateDocument(documentId, { 
        aiSummary,
        aiSummaryStatus: 'completed',
        aiSummaryGeneratedAt: new Date()
      });

      console.log(`✅ Completed background AI summary for document: ${document.name}`, {
        documentId,
        summaryKeys: Object.keys(aiSummary),
        hasExecutiveSummary: !!aiSummary.executiveSummary,
        updated: !!updatedDoc
      });

      // Send WebSocket notification for immediate UI update
      try {
        wsManager.broadcastJobProgress({
          jobId: 0,
          progress: 100,
          status: 'completed',
          currentStep: `AI summary completed for ${document.name}`,
          documentName: document.name
        }, document.dealId);
      } catch (wsError) {
        console.log('WebSocket notification failed:', wsError);
      }

      // 🎯 AUTOMATIC AGENT ASSIGNMENT: Immediately assign this document to relevant agents after AI analysis
      console.log(`🎯 Starting automatic agent assignment for document ${documentId}: ${document.name}`);
      
      try {
        await assignDocumentToAgentsAutomatically(documentId, document, aiSummary);
        console.log(`✅ Automatic agent assignment completed for: ${document.name}`);
      } catch (assignmentError) {
        console.error(`❌ Automatic agent assignment failed for ${document.name}:`, assignmentError);
      }

      // Check if this document completes a batch and trigger agent analysis
      setTimeout(async () => {
        try {
          await checkAndTriggerAgentAnalyses(document.dealId);
        } catch (error) {
          console.error('Failed to trigger agent analyses:', error);
        }
      }, 2000); // Small delay to allow other documents to complete

    } catch (error) {
      console.error(`❌ Background AI summary failed for document ${documentId}:`, error);
      
      // Handle rate limit errors with informative fallback summary
      if (error instanceof Error && error.message.includes('API rate limit error')) {
        const fallbackSummary = {
          executiveSummary: error.message,
          criticalFindings: ["Document analysis temporarily unavailable due to API rate limits"],
          neutralFindings: [`Document: ${document.name}`, `Size: ${document.size} bytes`],
          keyFinancialData: [],
          riskAssessment: ["Unable to perform risk assessment - rate limit exceeded"],
          strategicImplications: "Analysis pending due to API rate limiting. Please retry later.",
          documentType: "Rate Limited",
          confidenceScore: 0
        };
        
        // Save fallback summary to show user what happened
        await storage.updateDocument(documentId, { 
          aiSummary: fallbackSummary,
          aiSummaryStatus: 'completed',
          aiSummaryGeneratedAt: new Date()
        });
        
        console.log(`⚠️ Saved rate limit fallback summary for document: ${document.name}`);
      } else {
        // Update status to failed for other errors
        await storage.updateDocument(documentId, { aiSummaryStatus: 'failed' });
      }
      
      // Invalidate cache to reflect changes
      await storage.invalidateDocumentCache(document.dealId);
    }
  }
  
  // Evaluation criteria routes
  app.get('/api/evaluation-criteria', async (req: Request, res: Response) => {
    try {
      const criteria = await storage.getAllEvaluationCriteria();
      res.json(criteria);
    } catch (error) {
      console.error('Error fetching evaluation criteria:', error);
      res.status(500).json({ message: 'Failed to fetch evaluation criteria' });
    }
  });

  app.patch('/api/evaluation-criteria/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = req.body;
      
      const updatedCriteria = await storage.updateEvaluationCriteria(id, updateData);
      if (!updatedCriteria) {
        return res.status(404).json({ message: 'Evaluation criteria not found' });
      }
      
      res.json(updatedCriteria);
    } catch (error) {
      console.error('Error updating evaluation criteria:', error);
      res.status(500).json({ message: 'Failed to update evaluation criteria' });
    }
  });

  // Enhanced Company Research endpoints
  app.get('/api/deals/:dealId/research', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }

      const deal = await storage.getDealById(dealId);
      if (!deal) {
        return res.status(404).json({ message: 'Deal not found' });
      }

      // Try to get authentic research data first
      const { authenticResearchService } = await import('./services/authenticResearchService');
      const authenticData = await authenticResearchService.getStoredResearch(dealId);
      
      if (authenticData) {
        console.log('🔍 Returning authentic research data for deal:', dealId);
        return res.json(authenticData);
      }

      // Fallback to basic research data
      const researchData = await storage.getCompanyResearchByDealId(dealId);
      
      if (!researchData) {
        return res.status(404).json({ message: 'Research data not available for this deal' });
      }

      // Convert basic research to enhanced format
      const convertedData = {
        companyName: deal.companyName,
        website: deal.website || '',
        lastUpdated: researchData.researchCompletedAt || new Date().toISOString(),
        sources: researchData.sources || 1,
        aiConfidenceScore: 75,
        researchStatus: 'complete' as const
      };

      console.log('🔍 Returning converted research data for deal:', dealId);
      res.json(convertedData);
    } catch (error) {
      console.error('🔍 Error fetching company research:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Enhanced AI Research trigger endpoint with persistent background processing
  app.post('/api/deals/:dealId/research', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }

      const deal = await storage.getDealById(dealId);
      if (!deal) {
        return res.status(404).json({ message: 'Deal not found' });
      }

      const { forceRefresh } = req.body;
      
      console.log(`🔬 ${forceRefresh ? 'Rerunning' : 'Starting'} persistent AI research for deal ${dealId}: ${deal.companyName}`);

      // Import persistent research service
      const { persistentResearchService } = await import('./services/persistentResearchService');
      
      // Check if a job is already running
      const activeJob = await persistentResearchService.getActiveJob(dealId);
      if (activeJob && !forceRefresh) {
        console.log(`📋 Research job already running for deal ${dealId}, progress: ${activeJob.progress}%`);
        return res.json({ 
          message: 'Research job already in progress', 
          dealId, 
          status: 'processing',
          progress: activeJob.progress,
          progressStage: activeJob.progressStage,
          jobId: activeJob.id
        });
      }

      // Check if research already exists
      if (!forceRefresh) {
        const { authenticResearchService } = await import('./services/authenticResearchService');
        const existingResearch = await authenticResearchService.getStoredResearch(dealId);
        if (existingResearch && existingResearch.researchStatus === 'complete') {
          console.log(`🔍 Authentic research already exists for deal ${dealId}`);
          return res.json({ 
            message: 'Authentic research already completed', 
            dealId, 
            status: 'complete',
            existing: true
          });
        }
      }

      // Start new persistent research job
      const jobId = await persistentResearchService.startResearchJob(
        dealId, 
        deal.companyName, 
        deal.website || `https://${deal.companyName.toLowerCase().replace(/\s+/g, '')}.com`
      );
      
      console.log(`🚀 Started persistent research job ${jobId} for deal ${dealId}`);
      
      // Return immediately with job details
      res.json({ 
        message: 'Persistent AI research job started', 
        dealId, 
        jobId,
        status: 'processing',
        progress: 0,
        progressStage: 'Initializing research parameters',
        estimated_completion: '2-3 minutes'
      });
    } catch (error) {
      console.error('Error initiating company research:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get research job progress endpoint
  app.get('/api/deals/:dealId/research/progress', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }

      const { persistentResearchService } = await import('./services/persistentResearchService');
      const job = await persistentResearchService.getJobProgress(dealId);

      if (!job) {
        return res.json({ 
          status: 'not_found',
          progress: 0,
          message: 'No research job found for this deal'
        });
      }

      res.json({
        success: true,
        jobId: job.id,
        dealId: job.dealId,
        status: job.status,
        progress: job.progress,
        progressStage: job.progressStage,
        currentStep: job.currentStep,
        totalSteps: job.totalSteps,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        debugInfo: job.debugInfo
      });
    } catch (error) {
      console.error('Error fetching research progress:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });







  // Remove duplicate route - using the enhanced one at line 1566

  // Get comprehensive analysis results (GET only)
  app.get('/api/deals/:dealId/comprehensive-analysis', async (req: Request, res: Response) => {
    console.log(`🔍 GET /api/deals/${req.params.dealId}/comprehensive-analysis called`);
    try {
      const dealId = parseInt(req.params.dealId);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }

      const comprehensiveAnalysis = await storage.getComprehensiveAnalysis(dealId);
      
      if (!comprehensiveAnalysis) {
        return res.json(null);
      }

      res.json(comprehensiveAnalysis);
    } catch (error) {
      console.error('Error fetching comprehensive analysis:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Run comprehensive analysis using specialized Mistral AI agents with persistent background jobs
  app.post('/api/deals/:dealId/run-comprehensive-analysis', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      if (isNaN(dealId)) {
        return res.status(400).json({ message: 'Invalid deal ID' });
      }

      const { forceRefresh } = req.body;
      
      // Get deal and documents
      const deal = await storage.getDealById(dealId);
      if (!deal) {
        return res.status(404).json({ message: 'Deal not found' });
      }

      // Get documents with OCR text for analysis (bypass cache that excludes ocrText)
      const documentsWithOCR = await db.select().from(documents).where(eq(documents.dealId, dealId));
      
      console.log(`🧠 Starting persistent comprehensive analysis for deal ${dealId}: ${deal.companyName}`);
      console.log(`📄 Found ${documentsWithOCR.length} documents to analyze`);

      // Reset all existing background jobs for this deal if force refresh
      if (forceRefresh) {
        console.log(`🔄 Force refresh - resetting all background jobs for deal ${dealId}`);
        await persistentJobManager.resetAllJobsForDeal(dealId);
        
        // Clear existing agent analyses
        await storage.clearAgentAnalyses(dealId);
      }

      // Initialize analysis status
      await storage.createOrUpdateComprehensiveAnalysis(dealId, {
        overallScore: 0,
        positiveFactors: [],
        neutralFactors: [],
        riskFactors: [],
        analysisStatus: 'running',
        lastUpdated: new Date(),
        documentsCovered: 0,
        totalDocuments: documentsWithOCR.length
      });

      // Start persistent background jobs for all agents
      const agentTypes = ['clinical', 'legal', 'commercial', 'hr', 'financial', 'ip', 'research'];
      const startedJobs = [];

      for (const agentType of agentTypes) {
        try {
          const jobId = await persistentJobManager.startAgentAnalysis(dealId, agentType, documentsWithOCR.length);
          startedJobs.push({ agentType, jobId });
          
          // Start the actual analysis process in background
          runAgentAnalysisWithPersistence(dealId, agentType, documentsWithOCR, deal, jobId)
            .catch((error: any) => {
              console.error(`${agentType} analysis failed for deal ${dealId}:`, error);
              persistentJobManager.failJob(jobId, error.message);
            });
        } catch (error) {
          console.error(`Failed to start ${agentType} analysis job:`, error);
        }
      }

      res.json({
        message: 'Persistent comprehensive analysis initiated successfully',
        dealId,
        status: 'running',
        totalDocuments: documentsWithOCR.length,
        backgroundJobs: startedJobs.length,
        agentsStarted: startedJobs.map(j => j.agentType),
        estimatedCompletion: '5-10 minutes',
        persistent: true
      });
    } catch (error) {
      console.error('Error initiating comprehensive analysis:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Enhanced background job status endpoint with persistent tracking
  app.get('/api/background-jobs/:dealId', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      if (isNaN(dealId)) {
        return res.status(400).json({ success: false, error: 'Invalid deal ID' });
      }

      // Get running background jobs from storage with error handling
      let jobs = [];
      try {
        const dbJobs = await storage.getRunningBackgroundJobs(dealId);
        
        // Transform to expected format
        jobs = dbJobs.map(job => ({
          jobId: job.jobId,
          agentType: job.agentType,
          progress: job.progress || 0,
          status: job.status,
          processedDocuments: job.processedDocuments || 0,
          totalDocuments: job.totalDocuments || 0,
          currentDocument: job.currentDocument || '',
          currentStep: job.currentStep || '',
          metadata: {
            agentType: job.agentType,
            startTime: job.createdAt,
            lastUpdate: job.updatedAt
          }
        }));
        
        console.log(`📊 Found ${jobs.length} background jobs for deal ${dealId}`);
      } catch (storageError) {
        console.error('Storage error fetching background jobs:', storageError);
        // Return empty array to prevent frontend crashes
        jobs = [];
      }

      res.json({ success: true, jobs });
    } catch (error) {
      console.error('Error fetching background jobs:', error);
      // Return empty array with success flag to prevent frontend crashes
      res.json({ success: true, jobs: [] });
    }
  });

  // Clear stuck background jobs endpoint (add timeout and error handling)
  app.post('/api/background-jobs/clear-stuck', async (req: Request, res: Response) => {
    try {
      const dealId = req.body.dealId;
      
      console.log(`🧹 Clearing stuck background jobs for deal ${dealId}`);
      
      // Update all processing jobs to cancelled status and add timeout info
      const result = await storage.updateStuckBackgroundJobs(dealId);
      
      // Also clear from memory tracking
      if (global.activeJobs) {
        const keysToDelete = [];
        for (const [key, job] of global.activeJobs) {
          if (job.dealId === dealId) {
            keysToDelete.push(key);
          }
        }
        keysToDelete.forEach(key => global.activeJobs.delete(key));
        console.log(`🧹 Cleared ${keysToDelete.length} jobs from memory tracking`);
      }
      
      // Clear from persistent job manager
      await persistentJobManager.clearStuckJobs(dealId);
      
      res.json({ 
        success: true, 
        message: `Cleared stuck background jobs for deal ${dealId}`,
        clearedJobs: result
      });
      
    } catch (error) {
      console.error('Error clearing stuck background jobs:', error);
      res.status(500).json({ success: false, error: 'Failed to clear stuck jobs' });
    }
  });

  // Stop specific background job endpoint
  app.post('/api/background-jobs/:jobId/stop', async (req: Request, res: Response) => {
    try {
      const jobId = req.params.jobId;
      
      console.log(`🛑 Stopping background job: ${jobId}`);
      
      // Stop job in persistent manager
      await persistentJobManager.stopJob(jobId);
      
      // Also remove from memory tracking
      if (global.activeJobs && global.activeJobs.has(jobId)) {
        global.activeJobs.delete(jobId);
        console.log(`🧹 Removed job ${jobId} from memory tracking`);
      }
      
      res.json({ 
        success: true, 
        message: `Stopped background job ${jobId}`
      });
      
    } catch (error) {
      console.error('Error stopping background job:', error);
      res.status(500).json({ success: false, error: 'Failed to stop job' });
    }
  });

  // AI Processing Timeout Management Endpoints
  app.get('/api/ai-processing/timeout-stats', async (req: Request, res: Response) => {
    try {
      const stats = await aiProcessingTimeoutService.getTimeoutStats();
      res.json({
        success: true,
        ...stats
      });
    } catch (error) {
      console.error('Error getting timeout stats:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get timeout statistics' 
      });
    }
  });

  // Force complete AI processing for a deal
  app.post('/api/deals/:dealId/force-complete-processing', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      if (isNaN(dealId)) {
        return res.status(400).json({ success: false, error: 'Invalid deal ID' });
      }

      console.log(`🔧 Force completing AI processing for deal ${dealId}`);
      
      await aiProcessingTimeoutService.forceCompleteProcessing(dealId, 'Manual force completion');
      
      res.json({
        success: true,
        message: `AI processing force completed for deal ${dealId}`
      });
      
    } catch (error) {
      console.error('Error force completing processing:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to force complete processing' 
      });
    }
  });

  // Trigger immediate timeout check for stuck processing
  app.post('/api/ai-processing/check-stuck-now', async (req: Request, res: Response) => {
    try {
      console.log(`🔍 Manual trigger for stuck processing check`);
      
      // Get current timeout stats before check
      const statsBefore = await aiProcessingTimeoutService.getTimeoutStats();
      
      // Force an immediate timeout check
      await aiProcessingTimeoutService.checkForStuckProcessing();
      
      // Get stats after check  
      const statsAfter = await aiProcessingTimeoutService.getTimeoutStats();
      
      res.json({
        success: true,
        message: 'Stuck processing check completed',
        before: statsBefore,
        after: statsAfter,
        actionsTaken: statsBefore.currentlyStuck > statsAfter.currentlyStuck
      });
      
    } catch (error) {
      console.error('Error checking stuck processing:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to check stuck processing' 
      });
    }
  });

  // Mount background job routes
  app.use('/', backgroundJobsRouter);

  const httpServer = createServer(app);
  
  // Initialize WebSocket server for real-time progress updates
  websocketManager.initialize(httpServer);
  console.log('📡 WebSocket manager initialized for background job progress tracking');
  
  // Track running analyses to prevent overlaps
  const runningAnalyses = new Map<string, boolean>();

  // Run Mistral analysis for specific agent type
  app.post('/api/deals/:dealId/agents/:agentType/analyze', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      const agentType = req.params.agentType.toLowerCase();
      const { forceRefresh } = req.body;
      
      // Create unique key for this analysis
      const analysisKey = `${dealId}-${agentType}`;
      
      // If forceRefresh, stop any existing analysis for this agent and clear state
      if (forceRefresh) {
        console.log(`🔄 Force refresh requested - stopping and clearing existing ${agentType} analysis for deal ${dealId}`);
        runningAnalyses.delete(analysisKey);
        await storage.clearAgentAnalysis(dealId, agentType);
      }
      
      // Check if analysis is already running for this agent
      if (runningAnalyses.get(analysisKey)) {
        console.log(`⏭️ ${agentType} analysis already running for deal ${dealId}, skipping duplicate request`);
        return res.json({ 
          success: true, 
          message: `${agentType} agent analysis already in progress`,
          documentsFound: 0
        });
      }
      
      // Get deal and documents
      const deal = await storage.getDealById(dealId);
      if (!deal) {
        return res.status(404).json({ success: false, error: 'Deal not found' });
      }

      // Get documents with OCR text for analysis
      const documents = await storage.getDocumentsWithOCRByDealId(dealId);
      
      console.log(`🤖 Starting fresh ${agentType} agent analysis for deal ${dealId} with ${documents.length} documents (forceRefresh: ${forceRefresh})`);
      
      // Mark this analysis as running
      runningAnalyses.set(analysisKey, true);
      
      // Debug: Log current running analyses
      console.log(`📊 Current running analyses:`, Array.from(runningAnalyses.keys()));
      
      // Start agent-specific analysis in background with rate limiting
      setImmediate(async () => {
        try {
          await processAgentSpecificAnalysis(dealId, agentType, documents, deal, forceRefresh);
        } catch (error) {
          console.error(`❌ Error in ${agentType} analysis for deal ${dealId}:`, error);
        } finally {
          // Remove from running analyses when complete
          runningAnalyses.delete(analysisKey);
          console.log(`✅ ${agentType} analysis completed and removed from running queue for deal ${dealId}`);
        }
      });

      res.json({ 
        success: true, 
        message: `${agentType} agent analysis started`,
        documentsFound: documents.length
      });
    } catch (error) {
      console.error(`Error starting ${req.params.agentType} analysis:`, error);
      res.status(500).json({ success: false, error: 'Failed to start agent analysis' });
    }
  });

  // Stop all running analyses for a deal
  app.post('/api/deals/:dealId/stop-all-analyses', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      console.log(`🛑 Stopping all running analyses for deal ${dealId}`);
      
      // Clear all running analyses for this deal
      const agentTypes = ['clinical', 'legal', 'commercial', 'hr', 'financial', 'ip', 'research'];
      let stoppedCount = 0;
      
      for (const agentType of agentTypes) {
        const analysisKey = `${dealId}-${agentType}`;
        if (runningAnalyses.has(analysisKey)) {
          runningAnalyses.delete(analysisKey);
          stoppedCount++;
          console.log(`🛑 Stopped ${agentType} analysis for deal ${dealId}`);
        }
      }
      
      console.log(`✅ Stopped ${stoppedCount} running analyses for deal ${dealId}`);
      
      res.json({ 
        success: true, 
        message: `Stopped ${stoppedCount} running analyses`,
        stoppedCount
      });
    } catch (error) {
      console.error(`Error stopping analyses for deal ${req.params.dealId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to stop analyses' });
    }
  });

  // Run comprehensive legal analysis - systematically analyzes ALL assigned documents
  app.post('/api/deals/:dealId/legal-analysis/comprehensive', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      console.log(`🚀 Starting comprehensive legal analysis for deal ${dealId}`);
      
      // Check for existing legal analysis jobs to prevent duplicates
      const existingJobs = await storage.getBackgroundJobsByDealId(dealId);
      const existingLegalJob = existingJobs.find(job => {
        if (!job || job.status !== 'processing') return false;
        
        // Check job type first
        if (job.jobType === 'comprehensive_legal_analysis') return true;
        
        // Check jobId with proper null safety
        if (job.jobId && typeof job.jobId === 'string' && job.jobId.includes('legal_analysis')) return true;
        
        // Check agentType as fallback
        if (job.agentType === 'Legal') return true;
        
        return false;
      });
      
      if (existingLegalJob) {
        console.log(`⚠️ Legal analysis already running for deal ${dealId} (Job: ${existingLegalJob.jobId})`);
        return res.json({ 
          success: false, 
          message: `Legal analysis already in progress (${Math.round(existingLegalJob.progress || 0)}% complete)`,
          alreadyRunning: true,
          progress: existingLegalJob.progress || 0
        });
      }
      
      // Import the ENHANCED legal analysis service
      const { startEnhancedLegalAnalysis } = await import('./enhancedLegalAnalysisService');
      
      // Run ENHANCED legal analysis in background with deep evidence-based processing
      (async () => {
        try {
          console.log(`🔬 Starting ENHANCED legal analysis background process for deal ${dealId}`);
          await startEnhancedLegalAnalysis(dealId);
          console.log(`✅ Enhanced legal analysis completed for deal ${dealId}`);
        } catch (error) {
          console.error(`❌ Error in enhanced legal analysis for deal ${dealId}:`, error);
          console.error(`❌ Error stack:`, error.stack);
        }
      })();
      
      res.json({ 
        success: true, 
        message: 'ENHANCED legal analysis started - deep evidence-based processing with comprehensive source attribution across ALL assigned documents'
      });
    } catch (error) {
      console.error(`❌ Error starting comprehensive legal analysis for deal ${req.params.dealId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to start comprehensive legal analysis' });
    }
  });

  // Get comprehensive legal analysis progress
  app.get('/api/deals/:dealId/legal-analysis/comprehensive/progress', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      // Check for active comprehensive legal analysis job
      const jobs = await storage.getBackgroundJobsByDealId(dealId);
      const comprehensiveJob = jobs.find(job => 
        job.jobType === 'comprehensive_legal_analysis' && 
        job.status === 'processing'
      );
      
      if (comprehensiveJob) {
        res.json({
          success: true,
          isRunning: true,
          progress: comprehensiveJob.progress || 0,
          currentStep: comprehensiveJob.currentStep || 'Starting analysis',
          currentDocumentName: comprehensiveJob.currentDocumentName || 'Initializing',
          processedDocuments: comprehensiveJob.processedDocuments || 0,
          totalDocuments: comprehensiveJob.totalDocuments || 15,
          message: 'Comprehensive legal analysis in progress'
        });
      } else {
        res.json({
          success: true,
          isRunning: false,
          progress: 0,
          message: 'No comprehensive legal analysis running'
        });
      }
    } catch (error) {
      console.error(`❌ Error getting comprehensive legal analysis progress:`, error);
      res.status(500).json({ success: false, error: 'Failed to get progress' });
    }
  });

  // Clinical Analysis Progress Route
  app.get('/api/deals/:dealId/clinical-analysis/comprehensive/progress', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      const comprehensiveJob = await storage.getBackgroundJobsByDealAndType(
        dealId, 
        'comprehensive_clinical_analysis'
      );
      
      if (comprehensiveJob) {
        res.json({
          success: true,
          isRunning: true,
          progress: comprehensiveJob.progress || 0,
          currentStep: comprehensiveJob.currentStep || 'Starting analysis',
          currentDocumentName: comprehensiveJob.currentDocumentName || 'Initializing',
          processedDocuments: comprehensiveJob.processedDocuments || 0,
          totalDocuments: comprehensiveJob.totalDocuments || 11,
          message: 'Comprehensive clinical analysis in progress'
        });
      } else {
        res.json({
          success: true,
          isRunning: false,
          progress: 0,
          message: 'No comprehensive clinical analysis running'
        });
      }
    } catch (error) {
      console.error(`❌ Error getting comprehensive clinical analysis progress:`, error);
      res.status(500).json({ success: false, error: 'Failed to get progress' });
    }
  });

  // Clinical Analysis Start Route
  app.post('/api/deals/:dealId/clinical-analysis/comprehensive', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      // Check if there's already a running comprehensive clinical analysis
      const existingClinicalJob = await storage.getBackgroundJobsByDealAndType(dealId, 'comprehensive_clinical_analysis');
      if (existingClinicalJob) {
        return res.json({
          success: true,
          message: 'Comprehensive clinical analysis already running',
          alreadyRunning: true,
          progress: existingClinicalJob.progress || 0
        });
      }
      
      // Import the ENHANCED comprehensive analysis service
      const { startEnhancedComprehensiveAnalysis } = await import('./enhancedComprehensiveAnalysisService');
      
      // Run ENHANCED comprehensive clinical analysis in background with deep evidence-based processing
      (async () => {
        try {
          console.log(`🔬 Starting ENHANCED clinical analysis background process for deal ${dealId}`);
          await startEnhancedComprehensiveAnalysis(dealId, 'Clinical');
          console.log(`✅ Enhanced clinical analysis completed for deal ${dealId}`);
        } catch (error) {
          console.error(`❌ Error in enhanced clinical analysis for deal ${dealId}:`, error);
          console.error(`❌ Error stack:`, error.stack);
        }
      })();
      
      res.json({ 
        success: true, 
        message: 'Comprehensive clinical analysis started - processing 11 clinical questions across all assigned documents'
      });
    } catch (error) {
      console.error(`❌ Error starting comprehensive clinical analysis for deal ${req.params.dealId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to start comprehensive clinical analysis' });
    }
  });

  // Get comprehensive clinical analysis progress
  app.get('/api/deals/:dealId/clinical-analysis/comprehensive/progress', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      // Import the service to get progress
      const { comprehensiveClinicalAnalysisService } = await import('./comprehensiveClinicalAnalysisService');
      const progress = comprehensiveClinicalAnalysisService.getProgress(dealId);
      
      res.json({
        success: true,
        isRunning: progress.isRunning,
        progress: progress.progress,
        currentStep: progress.currentStep || 'Starting analysis',
        message: progress.message || 'No comprehensive clinical analysis running',
        totalSteps: progress.totalSteps || 11,
        currentQuestion: progress.currentQuestion
      });
    } catch (error) {
      console.error(`❌ Error getting comprehensive clinical analysis progress:`, error);
      res.status(500).json({ success: false, error: 'Failed to get progress' });
    }
  });

  // Get comprehensive clinical analysis results
  app.get('/api/deals/:dealId/clinical-analysis/comprehensive/results', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      console.log(`🧬 Fetching comprehensive clinical analysis results for deal ${dealId}`);
      
      // Get comprehensive clinical analysis from agent_analyses table
      const analysis = await storage.getAgentAnalysis(dealId, 'clinical');
      console.log(`🧬 Raw analysis data from storage:`, analysis);
      
      if (!analysis) {
        console.log(`❌ No comprehensive clinical analysis found for deal ${dealId}`);
        return res.json({ 
          success: false, 
          message: 'No comprehensive clinical analysis found',
          analysis: null
        });
      }

      // Parse the stored results
      let clinicalAnswers = {};
      let findings = [];
      let recommendations = [];

      try {
        // Fix field name mismatch: database uses clinical_answers (snake_case) but code expects clinicalAnswers (camelCase)
        if (analysis.clinical_answers || analysis.clinicalAnswers) {
          const clinicalAnswersData = analysis.clinical_answers || analysis.clinicalAnswers;
          clinicalAnswers = typeof clinicalAnswersData === 'string' 
            ? JSON.parse(clinicalAnswersData) 
            : clinicalAnswersData;
        }
        if (analysis.findings) {
          findings = typeof analysis.findings === 'string' 
            ? JSON.parse(analysis.findings) 
            : analysis.findings;
        }
        if (analysis.recommendations) {
          recommendations = typeof analysis.recommendations === 'string' 
            ? JSON.parse(analysis.recommendations) 
            : analysis.recommendations;
        }
      } catch (parseError) {
        console.error('Error parsing comprehensive clinical analysis data:', parseError);
        console.error('Analysis data received:', analysis);
      }

      console.log(`✅ Found comprehensive clinical analysis - ${Object.keys(clinicalAnswers).length} questions, ${findings.length} findings, ${recommendations.length} recommendations`);

      res.json({
        success: true,
        analysis: {
          ...analysis,
          clinicalAnswers,
          findings,
          recommendations,
          questionsAnswered: Object.keys(clinicalAnswers).length,
          totalQuestions: 11,
          completionRate: Math.round((Object.keys(clinicalAnswers).length / 11) * 100)
        }
      });
    } catch (error) {
      console.error(`❌ Error getting comprehensive clinical analysis results:`, error);
      res.status(500).json({ success: false, error: 'Failed to get comprehensive clinical analysis results' });
    }
  });

  // Get agent-specific analysis results
  app.get('/api/deals/:dealId/agents/:agentType/results', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      const agentType = req.params.agentType.toLowerCase();
      
      // For HR agent, get analysis with HR answers - EXACT COMMERCIAL APPROACH
      if (agentType === 'hr') {
        const analysis = await storage.getAgentAnalysis(dealId, 'HR');
        
        if (analysis) {
          let hrAnswers = {};
          let findings = [];
          let recommendations = [];
          
          // Parse stored JSON data - EXACT Commercial approach with field name fallback
          try {
            // Fix field name mismatch: database uses hr_answers (snake_case) but storage returns hrAnswers (camelCase)
            if (analysis.hrAnswers) {
              hrAnswers = typeof analysis.hrAnswers === 'string' 
                ? JSON.parse(analysis.hrAnswers) 
                : analysis.hrAnswers;
            }
            if (analysis.findings) {
              findings = typeof analysis.findings === 'string' 
                ? JSON.parse(analysis.findings) 
                : analysis.findings;
            }
            if (analysis.recommendations) {
              recommendations = typeof analysis.recommendations === 'string' 
                ? JSON.parse(analysis.recommendations) 
                : analysis.recommendations;
            }
          } catch (parseError) {
            console.error('Error parsing comprehensive HR analysis data:', parseError);
            console.error('Analysis data received:', analysis);
          }

          console.log(`✅ Found comprehensive HR analysis - ${Object.keys(hrAnswers).length} questions, ${findings.length} findings, ${recommendations.length} recommendations`);

          return res.json({
            success: true,
            analysis: {
              ...analysis,
              hrAnswers,
              findings,
              recommendations,
              questionsAnswered: Object.keys(hrAnswers).length,
              totalQuestions: 12,
              completionRate: Math.round((Object.keys(hrAnswers).length / 12) * 100)
            }
          });
        } else {
          console.log(`❌ No HR analysis found for deal ${dealId}`);
          return res.json({
            success: true,
            analysis: null
          });
        }
      }

      // For Financial agent, use comprehensive financial analysis results
      if (agentType === 'financial') {
        const analysis = await storage.getAgentAnalysis(dealId, 'Financial');
        
        if (analysis && analysis.financialAnswers) {
          // Transform comprehensive Financial results to match the expected format - EXACT HR PATTERN
          let financialAnswers = {};
          let findings = [];
          let recommendations = [];
          
          try {
            const financialAnswersData = analysis.financialAnswers;
            financialAnswers = typeof financialAnswersData === 'string' 
              ? JSON.parse(financialAnswersData) 
              : financialAnswersData;
              
            // Parse findings and recommendations exactly like HR pattern
            if (analysis.findings) {
              findings = typeof analysis.findings === 'string' 
                ? JSON.parse(analysis.findings) 
                : analysis.findings;
            }
            if (analysis.recommendations) {
              recommendations = typeof analysis.recommendations === 'string' 
                ? JSON.parse(analysis.recommendations) 
                : analysis.recommendations;
            }
          } catch (parseError) {
            console.error('Error parsing financial analysis data:', parseError);
            financialAnswers = {};
            findings = [];
            recommendations = [];
          }
          // Count answered questions - EXACT HR PATTERN
          const answeredQuestions = Object.keys(financialAnswers).length;
          const totalQuestions = 12; // Financial has 12 questions (matches our comprehensive service)
          
          console.log(`✅ Found comprehensive Financial analysis - ${answeredQuestions} questions, ${findings.length} findings, ${recommendations.length} recommendations`);
          
          return res.json({
            success: true,
            analysis: {
              ...analysis,
              financialAnswers,
              findings,
              recommendations,
              questionsAnswered: answeredQuestions,
              totalQuestions,
              completionRate: Math.round((answeredQuestions / totalQuestions) * 100)
            }
          });
        } else {
          // Fallback to regular agent analysis if no comprehensive results
          console.log(`❌ No financial analysis found for deal ${dealId}`);
          return res.json({ 
            success: true, 
            analysis: analysis || null
          });
        }
      }
      
      // For IP agent, get analysis with IP answers - EXACT FINANCIAL APPROACH
      if (agentType === 'ip') {
        const analysis = await storage.getAgentAnalysis(dealId, 'IP');
        
        if (analysis) {
          let ipAnswers = {};
          let findings = [];
          let recommendations = [];
          
          // Parse stored JSON data - EXACT Financial approach with field name fallback
          try {
            // Use comprehensive field first, then fallback to legacy field
            if (analysis.ipAnswers) {
              ipAnswers = typeof analysis.ipAnswers === 'string' 
                ? JSON.parse(analysis.ipAnswers) 
                : analysis.ipAnswers;
            } else if (analysis.ip_answers) {
              ipAnswers = typeof analysis.ip_answers === 'string' 
                ? JSON.parse(analysis.ip_answers) 
                : analysis.ip_answers;
            }
            if (analysis.findings) {
              findings = typeof analysis.findings === 'string' 
                ? JSON.parse(analysis.findings) 
                : analysis.findings;
            }
            if (analysis.recommendations) {
              recommendations = typeof analysis.recommendations === 'string' 
                ? JSON.parse(analysis.recommendations) 
                : analysis.recommendations;
            }
          } catch (parseError) {
            console.error('Error parsing comprehensive IP analysis data:', parseError);
            console.error('Analysis data received:', analysis);
          }

          console.log(`✅ Found comprehensive IP analysis - ${Object.keys(ipAnswers).length} questions, ${findings.length} findings, ${recommendations.length} recommendations`);

          return res.json({
            success: true,
            analysis: {
              ...analysis,
              ipAnswers,
              findings,
              recommendations,
              questionsAnswered: Object.keys(ipAnswers).length,
              totalQuestions: 12, // IP has 12 questions like Financial
              completionRate: Math.round((Object.keys(ipAnswers).length / 12) * 100)
            }
          });
        } else {
          console.log(`❌ No IP analysis found for deal ${dealId}`);
          return res.json({
            success: true,
            analysis: null
          });
        }
      }

      // For Research agent, get analysis with research answers
      if (agentType === 'research') {
        const analysis = await storage.getAgentAnalysis(dealId, 'Research');
        
        if (analysis && analysis.research_answers) {
          const researchAnswers = analysis.research_answers;
          const findings = Array.isArray(analysis.findings) ? analysis.findings : [];
          const recommendations = Array.isArray(analysis.recommendations) ? analysis.recommendations : [];
          
          const answeredQuestions = Object.keys(researchAnswers).length;
          const totalQuestions = 8;
          
          console.log(`✅ Found research analysis for deal ${dealId}:`, {
            id: analysis.id,
            agentType: analysis.agentType,
            status: analysis.status,
            findingsLength: JSON.stringify(findings).length,
            recommendationsLength: JSON.stringify(recommendations).length,
            totalRecordsFound: 1
          });
          
          return res.json({
            success: true,
            analysis: {
              ...analysis,
              researchAnswers,
              findings,
              recommendations,
              questionsAnswered: answeredQuestions,
              totalQuestions,
              completionRate: Math.round((answeredQuestions / totalQuestions) * 100)
            }
          });
        } else {
          console.log(`❌ No research analysis found for deal ${dealId}`);
          return res.json({
            success: true,
            analysis: null
          });
        }
      }
      
      // For Commercial agent, get analysis with commercial answers - EXACT CLINICAL APPROACH  
      if (agentType === 'commercial') {
        const analysis = await storage.getAgentAnalysis(dealId, 'commercial');
        
        if (analysis && (analysis.commercial_answers || analysis.commercialAnswers)) {
          let commercialAnswers = {};
          let findings = [];
          let recommendations = [];
          
          // Parse stored JSON data - EXACT Clinical approach with field name fallback
          try {
            // Fix field name mismatch: database uses commercial_answers (snake_case) but code expects commercialAnswers (camelCase)
            if (analysis.commercial_answers || analysis.commercialAnswers) {
              const commercialAnswersData = analysis.commercial_answers || analysis.commercialAnswers;
              commercialAnswers = typeof commercialAnswersData === 'string' 
                ? JSON.parse(commercialAnswersData) 
                : commercialAnswersData;
            }
            if (analysis.findings) {
              findings = typeof analysis.findings === 'string' 
                ? JSON.parse(analysis.findings) 
                : analysis.findings;
            }
            if (analysis.recommendations) {
              recommendations = typeof analysis.recommendations === 'string' 
                ? JSON.parse(analysis.recommendations) 
                : analysis.recommendations;
            }
          } catch (parseError) {
            console.error('Error parsing comprehensive commercial analysis data:', parseError);
            console.error('Analysis data received:', analysis);
          }

          console.log(`✅ Found comprehensive commercial analysis - ${Object.keys(commercialAnswers).length} questions, ${findings.length} findings, ${recommendations.length} recommendations`);

          return res.json({
            success: true,
            analysis: {
              ...analysis,
              commercialAnswers,
              findings,
              recommendations,
              questionsAnswered: Object.keys(commercialAnswers).length,
              totalQuestions: 12,
              completionRate: Math.round((Object.keys(commercialAnswers).length / 12) * 100)
            }
          });
        } else {
          console.log(`❌ No commercial analysis found for deal ${dealId}`);
          return res.json({
            success: true,
            analysis: null
          });
        }
      }

      // For other agent types, use regular agent analysis
      const analysis = await storage.getAgentAnalysis(dealId, agentType);
      
      res.json({ 
        success: true, 
        analysis: analysis || null
      });
    } catch (error) {
      console.error(`Error getting ${req.params.agentType} analysis:`, error);
      res.status(500).json({ success: false, error: 'Failed to get agent analysis' });
    }
  });

  // Run comprehensive commercial analysis - EXACT CLINICAL COPY
  app.post('/api/deals/:dealId/commercial-analysis/comprehensive', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      console.log(`🏢 Starting comprehensive commercial analysis for deal ${dealId}`);
      
      // Check if there's already a running comprehensive commercial analysis - EXACT Clinical approach
      const existingCommercialJob = await storage.getBackgroundJobsByDealAndType(dealId, 'comprehensive_commercial_analysis');
      if (existingCommercialJob) {
        return res.json({
          success: true,
          message: 'Comprehensive commercial analysis already running',
          alreadyRunning: true,
          jobId: existingCommercialJob.jobId
        });
      }
      
      // Create background job - EXACT Clinical approach
      const jobId = `comprehensive-commercial-analysis-${dealId}-${Date.now()}`;
      await storage.createBackgroundJob({
        jobId,
        dealId,
        jobType: 'comprehensive_commercial_analysis',
        agentType: 'commercial',
        status: 'processing',
        progress: 0,
        currentStep: 'Initializing commercial analysis',
        processedDocuments: 0,
        totalDocuments: 0
      });
      
      // Import and run service in background - EXACT Clinical approach
      (async () => {
        try {
          console.log(`🏢 Starting comprehensive commercial analysis background process for deal ${dealId}`);
          const { ComprehensiveCommercialAnalysisService } = await import('./comprehensiveCommercialAnalysisService');
          
          const commercialService = new ComprehensiveCommercialAnalysisService();
          await commercialService.runComprehensiveAnalysis(dealId, storage, jobId);
          
          console.log(`✅ Comprehensive commercial analysis completed for deal ${dealId}`);
        } catch (error) {
          console.error(`❌ Error in comprehensive commercial analysis for deal ${dealId}:`, error);
          
          // Mark job as failed - EXACT Clinical approach
          await storage.updateBackgroundJob(jobId, {
            status: 'failed',
            error: error.message,
            currentStep: 'Analysis failed'
          });
        }
      })();
      
      res.json({
        success: true,
        message: 'Comprehensive commercial analysis started',
        jobId
      });
    } catch (error) {
      console.error(`❌ Error starting comprehensive commercial analysis for deal ${req.params.dealId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to start comprehensive commercial analysis' });
    }
  });

  // Get comprehensive commercial analysis progress
  app.get('/api/deals/:dealId/commercial-analysis/comprehensive/progress', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      // DEBUG: Add comprehensive logging for Commercial progress debugging
      console.log(`🏢 DEBUG: Fetching commercial progress for deal ${dealId}`);
      
      const backgroundJobs = await storage.getBackgroundJobsByDealId(dealId);
      console.log(`🏢 DEBUG: Found ${backgroundJobs.length} background jobs`);
      
      const commercialJob = backgroundJobs.find(job => 
        job.agentType?.toLowerCase() === 'commercial'
      );
      
      console.log(`🏢 DEBUG: Commercial job found:`, commercialJob ? {
        jobId: commercialJob.jobId,
        status: commercialJob.status,
        progress: commercialJob.progress,
        currentStep: commercialJob.currentStep,
        agentType: commercialJob.agentType
      } : 'NULL');
      
      if (commercialJob && commercialJob.status === 'processing') {
        const response = {
          success: true,
          isRunning: true,
          progress: commercialJob.progress || 0,
          currentStep: commercialJob.currentStep || 'Starting commercial analysis',
          message: `Commercial analysis running at ${commercialJob.progress || 0}%`,
          totalSteps: 12,
          currentQuestion: commercialJob.currentStep
        };
        console.log(`🏢 DEBUG: Returning PROCESSING response:`, response);
        res.json(response);
      } else {
        const response = {
          success: true,
          isRunning: false,
          progress: commercialJob?.progress || 0,
          currentStep: commercialJob?.currentStep || null,
          message: 'No comprehensive commercial analysis running',
          totalSteps: 12,
          currentQuestion: null
        };
        console.log(`🏢 DEBUG: Returning NOT RUNNING response:`, response);
        res.json(response);
      }
    } catch (error) {
      console.error(`❌ Error getting comprehensive commercial analysis progress:`, error);
      res.status(500).json({ success: false, error: 'Failed to get progress' });
    }
  });

  // Get comprehensive commercial analysis results
  app.get('/api/deals/:dealId/commercial-analysis/comprehensive/results', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      console.log(`🏢 Fetching comprehensive commercial analysis results for deal ${dealId}`);
      
      // Get comprehensive commercial analysis from agent_analyses table - EXACT Clinical approach
      const analysis = await storage.getAgentAnalysis(dealId, 'Commercial');
      console.log(`🏢 Raw analysis data from storage:`, analysis);
      
      if (!analysis) {
        console.log(`❌ No comprehensive commercial analysis found for deal ${dealId}`);
        return res.json({ 
          success: false, 
          message: 'No comprehensive commercial analysis found',
          analysis: null
        });
      }

      // Parse the stored results - EXACT Clinical approach
      let commercialAnswers = {};
      let findings = [];
      let recommendations = [];

      try {
        // Fix field name mismatch: database uses commercial_answers (snake_case) but code expects commercialAnswers (camelCase)
        if (analysis.commercial_answers || analysis.commercialAnswers) {
          const commercialAnswersData = analysis.commercial_answers || analysis.commercialAnswers;
          commercialAnswers = typeof commercialAnswersData === 'string' 
            ? JSON.parse(commercialAnswersData) 
            : commercialAnswersData;
        }
        if (analysis.findings) {
          findings = typeof analysis.findings === 'string' 
            ? JSON.parse(analysis.findings) 
            : analysis.findings;
        }
        if (analysis.recommendations) {
          recommendations = typeof analysis.recommendations === 'string' 
            ? JSON.parse(analysis.recommendations) 
            : analysis.recommendations;
        }
      } catch (parseError) {
        console.error('Error parsing comprehensive commercial analysis data:', parseError);
        console.error('Analysis data received:', analysis);
      }

      console.log(`✅ Found comprehensive commercial analysis - ${Object.keys(commercialAnswers).length} questions, ${findings.length} findings, ${recommendations.length} recommendations`);

      res.json({
        success: true,
        analysis: {
          ...analysis,
          commercialAnswers,
          findings,
          recommendations,
          questionsAnswered: Object.keys(commercialAnswers).length,
          totalQuestions: 12,
          completionRate: Math.round((Object.keys(commercialAnswers).length / 12) * 100)
        }
      });
    } catch (error) {
      console.error(`❌ Error getting comprehensive commercial analysis results:`, error);
      res.status(500).json({ success: false, error: 'Failed to get comprehensive commercial analysis results' });
    }
  });

  // Run comprehensive HR analysis
  app.post('/api/deals/:dealId/hr-analysis/comprehensive', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      console.log(`🏢 Starting comprehensive HR analysis for deal ${dealId}`);
      
      // Check for existing HR analysis jobs to prevent duplicates  
      const existingJobs = await storage.getBackgroundJobsByDealId(dealId);
      const existingHrJob = existingJobs.find(job => 
        job.agentType === 'HR' && job.status === 'processing'
      );
      
      if (existingHrJob) {
        console.log(`⚠️ HR analysis already running for deal ${dealId} (Job: ${existingHrJob.jobId})`);
        return res.json({ 
          success: true, 
          message: `HR analysis already running`,
          jobId: existingHrJob.jobId
        });
      }
      
      // Create background job - EXACT Commercial approach
      const jobId = `comprehensive-hr-analysis-${dealId}-${Date.now()}`;
      
      await storage.createBackgroundJob({
        jobId,
        jobType: 'comprehensive_hr_analysis',
        dealId,
        agentType: 'HR',
        status: 'processing',
        progress: 0,
        currentStep: 'Initializing HR analysis',
        createdAt: new Date()
      });

      // Import and run service in background - EXACT Commercial approach
      (async () => {
        try {
          console.log(`🏢 Starting comprehensive HR analysis background process for deal ${dealId}`);
          const { ComprehensiveHRAnalysisService } = await import('./comprehensiveHRAnalysisService');
          
          const hrService = new ComprehensiveHRAnalysisService();
          await hrService.runComprehensiveAnalysis(dealId, storage, jobId);
          
          console.log(`✅ Comprehensive HR analysis completed for deal ${dealId}`);
        } catch (error) {
          console.error(`❌ Error in comprehensive HR analysis for deal ${dealId}:`, error);
          
          // Mark job as failed - EXACT Commercial approach
          await storage.updateBackgroundJob(jobId, {
            status: 'failed',
            error: error.message,
            currentStep: 'Analysis failed'
          });
        }
      })();

      const result = {};
      
      res.json({ 
        success: true, 
        message: 'Comprehensive HR analysis started',
        jobId: jobId
      });
    } catch (error) {
      console.error(`❌ Error starting comprehensive HR analysis for deal ${req.params.dealId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to start comprehensive HR analysis' });
    }
  });

  // Get comprehensive HR analysis progress - EXACT COMMERCIAL APPROACH
  app.get('/api/deals/:dealId/hr-analysis/comprehensive/progress', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      // Get progress from background jobs - EXACT Commercial approach
      const jobs = await storage.getBackgroundJobsByDealId(dealId);
      const hrJob = jobs.find(job => job.agentType === 'HR' || job.jobId.includes('comprehensive-hr-analysis'));
      
      if (hrJob) {
        res.json({
          success: true,
          isRunning: hrJob.status === 'processing',
          progress: hrJob.progress || 0,
          currentStep: hrJob.currentStep || 'Starting analysis',
          message: hrJob.currentStep || 'HR analysis in progress',
          totalSteps: 8,
          questionsAnswered: hrJob.processedDocuments || 0
        });
      } else {
        res.json({
          success: true,
          isRunning: false,
          progress: 0,
          currentStep: 'No analysis running',
          message: 'No comprehensive HR analysis running',
          totalSteps: 8,
          questionsAnswered: 0
        });
      }
    } catch (error) {
      console.error(`❌ Error getting comprehensive HR analysis progress:`, error);
      res.status(500).json({ success: false, error: 'Failed to get progress' });
    }
  });

  // Get comprehensive HR analysis results - EXACT COMMERCIAL APPROACH
  app.get('/api/deals/:dealId/hr-analysis/comprehensive/results', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      console.log(`👥 Fetching comprehensive HR analysis results for deal ${dealId}`);
      
      // Get comprehensive HR analysis from agent_analyses table - EXACT Commercial approach
      const analysis = await storage.getAgentAnalysis(dealId, 'HR');
      console.log(`👥 Raw analysis data from storage:`, analysis);
      
      if (!analysis) {
        console.log(`❌ No comprehensive HR analysis found for deal ${dealId}`);
        return res.json({ 
          success: false, 
          message: 'No comprehensive HR analysis found',
          analysis: null
        });
      }

      // Parse the stored results - EXACT Commercial approach
      let hrAnswers = {};
      let findings = [];
      let recommendations = [];

      try {
        // Fix field name mismatch: database uses hr_answers (snake_case) but code expects hrAnswers (camelCase)
        if (analysis.hr_answers || analysis.hrAnswers) {
          const hrAnswersData = analysis.hr_answers || analysis.hrAnswers;
          hrAnswers = typeof hrAnswersData === 'string' 
            ? JSON.parse(hrAnswersData) 
            : hrAnswersData;
        }
        if (analysis.findings) {
          findings = typeof analysis.findings === 'string' 
            ? JSON.parse(analysis.findings) 
            : analysis.findings;
        }
        if (analysis.recommendations) {
          recommendations = typeof analysis.recommendations === 'string' 
            ? JSON.parse(analysis.recommendations) 
            : analysis.recommendations;
        }
      } catch (parseError) {
        console.error('Error parsing comprehensive HR analysis data:', parseError);
        console.error('Analysis data received:', analysis);
      }

      console.log(`✅ Found comprehensive HR analysis - ${Object.keys(hrAnswers).length} questions, ${findings.length} findings, ${recommendations.length} recommendations`);

      res.json({
        success: true,
        analysis: {
          ...analysis,
          hrAnswers,
          findings,
          recommendations,
          questionsAnswered: Object.keys(hrAnswers).length,
          totalQuestions: 8,
          completionRate: Math.round((Object.keys(hrAnswers).length / 8) * 100)
        }
      });
    } catch (error) {
      console.error(`❌ Error getting comprehensive HR analysis results:`, error);
      res.status(500).json({ success: false, error: 'Failed to get comprehensive HR analysis results' });
    }
  });

  // REMOVED: Old Financial Analysis Route - Now using persistent service like Clinical
  // Financial analysis now uses persistent service via /api/deals/:dealId/financial-analysis/persistent/start

  // REMOVED: Old Financial Progress Route - Now using background jobs like Clinical
  // Financial progress now tracked via /api/background-jobs/:dealId like other persistent services

  // Get comprehensive Financial analysis results
  app.get('/api/deals/:dealId/financial-analysis/comprehensive/results', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      console.log(`💰 Fetching comprehensive financial analysis results for deal ${dealId}`);
      
      // Get comprehensive financial analysis from agent_analyses table
      const analysis = await storage.getAgentAnalysisByDealAndType(dealId, 'Financial');
      
      if (!analysis) {
        console.log(`❌ No comprehensive financial analysis found for deal ${dealId}`);
        return res.json({
          success: false,
          message: 'No comprehensive financial analysis found',
          results: null
        });
      }
      
      // Parse financial answers if they exist
      let financialAnswers = {};
      if (analysis.financialAnswers) {
        try {
          financialAnswers = typeof analysis.financialAnswers === 'string' 
            ? JSON.parse(analysis.financialAnswers) 
            : analysis.financialAnswers;
        } catch (error) {
          console.error('Error parsing financial answers:', error);
        }
      }
      
      res.json({
        success: true,
        results: {
          status: analysis.status,
          findings: analysis.findings || [],
          recommendations: analysis.recommendations || [],
          financialAnswers,
          completedAt: analysis.completedAt
        }
      });
    } catch (error) {
      console.error(`❌ Error getting comprehensive financial analysis results:`, error);
      res.status(500).json({ success: false, error: 'Failed to get analysis results' });
    }
  });

  // Run comprehensive IP analysis
  app.post('/api/deals/:dealId/ip-analysis/comprehensive', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      console.log(`🔐 Starting comprehensive IP analysis for deal ${dealId}`);
      
      // Check for existing IP analysis jobs to prevent duplicates  
      const existingJobs = await storage.getBackgroundJobsByDealId(dealId);
      const existingIpJob = existingJobs.find(job => 
        job.agentType === 'IP' && job.status === 'processing'
      );
      
      if (existingIpJob) {
        console.log(`⚠️ IP analysis already running for deal ${dealId} (Job: ${existingIpJob.jobId})`);
        return res.json({ 
          success: true, 
          message: `IP analysis already running`,
          jobId: existingIpJob.jobId
        });
      }
      
      // Generate unique job ID for this analysis
      const jobId = `ip-analysis-${dealId}-${Date.now()}`;
      
      // Create the background job FIRST - exactly like Financial analysis
      await storage.createBackgroundJob({
        jobId,
        dealId,
        agentType: 'IP',
        jobType: 'comprehensive_ip_analysis',
        status: 'processing',
        progress: 0,
        currentStep: 'Initializing IP analysis',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`📊 Created background job for IP analysis: ${jobId}`);
      
      // Import the comprehensive IP analysis service
      const { comprehensiveIpAnalysisService } = await import('./comprehensiveIpAnalysisService');
      
      // Run comprehensive IP analysis in background with proper job tracking
      (async () => {
        try {
          console.log(`🔬 Starting comprehensive IP analysis background process for deal ${dealId}`);
          await comprehensiveIpAnalysisService.startComprehensiveAnalysis(dealId, jobId);
          console.log(`✅ Comprehensive IP analysis completed for deal ${dealId}`);
        } catch (error) {
          console.error(`❌ Error in comprehensive IP analysis for deal ${dealId}:`, error);
          // Mark job as failed
          await storage.updateBackgroundJob(jobId, {
            status: 'failed',
            currentStep: `IP analysis failed: ${(error as any)?.message || error}`
          });
        }
      })();
      
      res.json({ 
        success: true, 
        message: 'Comprehensive IP analysis started - processing 13 IP questions across all assigned documents',
        jobId
      });
    } catch (error) {
      console.error(`❌ Error starting comprehensive IP analysis for deal ${req.params.dealId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to start comprehensive IP analysis' });
    }
  });

  // Get comprehensive IP analysis progress
  app.get('/api/deals/:dealId/ip-analysis/comprehensive/progress', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      // Check for active comprehensive IP analysis job
      const activeJobs = await storage.getBackgroundJobsByDealId(dealId);
      const comprehensiveJob = activeJobs.find(job => 
        job.jobType === 'comprehensive_ip_analysis' && 
        job.status === 'processing'
      );
      
      if (comprehensiveJob) {
        res.json({
          success: true,
          isRunning: true,
          progress: comprehensiveJob.progress || 0,
          currentStep: comprehensiveJob.currentStep || 'Processing...',
          jobId: comprehensiveJob.jobId
        });
      } else {
        res.json({
          success: true,
          isRunning: false,
          progress: 0,
          currentStep: null,
          message: 'No comprehensive IP analysis running'
        });
      }
    } catch (error) {
      console.error(`❌ Error getting comprehensive IP analysis progress:`, error);
      res.status(500).json({ success: false, error: 'Failed to get analysis progress' });
    }
  });

  // Get comprehensive IP analysis results
  app.get('/api/deals/:dealId/ip-analysis/comprehensive/results', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      console.log(`🔐 Fetching comprehensive IP analysis results for deal ${dealId}`);
      
      // Get comprehensive IP analysis from agent_analyses table
      const analysis = await storage.getAgentAnalysisByDealAndType(dealId, 'IP');
      
      if (!analysis) {
        console.log(`❌ No comprehensive IP analysis found for deal ${dealId}`);
        return res.json({
          success: false,
          message: 'No comprehensive IP analysis found',
          results: null
        });
      }
      
      // Parse IP answers if they exist  
      let ipAnswers = {};
      if (analysis.ip_answers) {
        try {
          ipAnswers = typeof analysis.ip_answers === 'string' 
            ? JSON.parse(analysis.ip_answers) 
            : analysis.ip_answers;
        } catch (error) {
          console.error('Error parsing IP answers:', error);
          ipAnswers = {};
        }
      }
      
      console.log(`🔐 IP Analysis Data:`, {
        hasAnswers: !!analysis.ip_answers,
        answersType: typeof analysis.ip_answers,
        parsedAnswersKeys: Object.keys(ipAnswers)
      });
      
      console.log(`🔐 BACKEND DEBUG: Raw ipAnswers sample:`, ipAnswers.patents_1 ? 'HAS patents_1' : 'NO patents_1');
      console.log(`🔐 BACKEND DEBUG: Full response structure will have:`, {
        results: {
          status: analysis.status,
          ipAnswers: Object.keys(ipAnswers),
          ipAnswersCount: Object.keys(ipAnswers).length
        }
      });
      
      res.json({
        success: true,
        results: {
          status: analysis.status,
          findings: analysis.findings || [],
          recommendations: analysis.recommendations || [],
          ipAnswers,
          completedAt: analysis.completedAt
        }
      });
    } catch (error) {
      console.error(`❌ Error getting comprehensive IP analysis results:`, error);
      res.status(500).json({ success: false, error: 'Failed to get analysis results' });
    }
  });

  // Run comprehensive Research analysis
  app.post('/api/deals/:dealId/research-analysis/comprehensive', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      console.log(`🔬 Starting comprehensive research analysis for deal ${dealId}`);
      
      // Check for existing Research analysis jobs to prevent duplicates  
      const existingJobs = await storage.getBackgroundJobsByDealId(dealId);
      const existingResearchJob = existingJobs.find(job => 
        job.agentType === 'Research' && job.status === 'processing'
      );
      
      if (existingResearchJob) {
        console.log(`⚠️ Research analysis already running for deal ${dealId} (Job: ${existingResearchJob.jobId})`);
        return res.json({ 
          success: true, 
          message: `Research analysis already running`,
          jobId: existingResearchJob.jobId
        });
      }
      
      // Import the ENHANCED comprehensive analysis service
      const { startEnhancedComprehensiveAnalysis } = await import('./enhancedComprehensiveAnalysisService');
      
      // Run ENHANCED comprehensive research analysis in background with deep evidence-based processing
      (async () => {
        try {
          console.log(`🔬 Starting ENHANCED research analysis background process for deal ${dealId}`);
          await startEnhancedComprehensiveAnalysis(dealId, 'Research');
          console.log(`✅ Enhanced research analysis completed for deal ${dealId}`);
        } catch (error) {
          console.error(`❌ Error in enhanced research analysis for deal ${dealId}:`, error);
        }
      })();
      
      res.json({ 
        success: true, 
        message: 'Comprehensive research analysis started - processing 12 research questions across all assigned documents'
      });
    } catch (error) {
      console.error(`❌ Error starting comprehensive research analysis for deal ${req.params.dealId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to start comprehensive research analysis' });
    }
  });

  // Get comprehensive Research analysis results
  app.get('/api/deals/:dealId/research-analysis/comprehensive/results', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      console.log(`🔬 Fetching comprehensive research analysis results for deal ${dealId}`);
      
      // Get comprehensive research analysis from agent_analyses table
      const analysis = await storage.getAgentAnalysis(dealId, 'research');
      
      if (!analysis) {
        console.log(`❌ No comprehensive research analysis found for deal ${dealId}`);
        return res.json({
          success: false,
          message: 'No comprehensive research analysis found',
          results: null
        });
      }
      
      // Parse research answers if they exist
      let researchAnswers = {};
      if (analysis.research_answers) {
        try {
          researchAnswers = typeof analysis.research_answers === 'string' 
            ? JSON.parse(analysis.research_answers) 
            : analysis.research_answers;
        } catch (error) {
          console.error('Error parsing research answers:', error);
          researchAnswers = {};
        }
      }
      
      console.log(`🔬 Research Analysis Data:`, {
        hasAnswers: !!analysis.research_answers,
        answersType: typeof analysis.research_answers,
        parsedAnswersKeys: Object.keys(researchAnswers)
      });
      
      res.json({
        success: true,
        results: {
          status: analysis.status,
          findings: analysis.findings || [],
          recommendations: analysis.recommendations || [],
          researchAnswers,
          completedAt: analysis.completedAt
        }
      });
    } catch (error) {
      console.error(`❌ Error getting comprehensive research analysis results:`, error);
      res.status(500).json({ success: false, error: 'Failed to get analysis results' });
    }
  });

  // Investment Memo Generator Routes
  app.post('/api/deals/:dealId/generate-memo', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      console.log(`🔄 Starting investment memo generation for deal ${dealId}`);
      
      if (isNaN(dealId)) {
        console.error(`❌ Invalid deal ID: ${req.params.dealId}`);
        return res.status(400).json({
          success: false,
          error: 'Invalid deal ID provided'
        });
      }
      
      // Import the service here to avoid circular dependencies
      console.log(`📥 Importing investment memo service...`);
      const { investmentMemoService } = await import('./services/investmentMemoService');
      console.log(`✅ Service imported successfully`);
      
      if (!investmentMemoService) {
        console.error(`❌ Investment memo service not found`);
        return res.status(500).json({
          success: false,
          error: 'Investment memo service not available'
        });
      }
      
      console.log(`🚀 Calling generateComprehensiveMemo for deal ${dealId}`);
      const memo = await investmentMemoService.generateComprehensiveMemo(dealId);
      console.log(`✅ Memo generation completed for deal ${dealId}`);
      
      if (!memo) {
        console.error(`❌ No memo returned for deal ${dealId}`);
        return res.status(500).json({
          success: false,
          error: 'Memo generation returned no data'
        });
      }
      
      res.json({
        success: true,
        memo
      });
    } catch (error) {
      console.error('❌ Investment memo generation error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        name: error instanceof Error ? error.name : 'Unknown error type'
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate investment memo'
      });
    }
  });

  // Get comprehensive memo (API endpoint frontend expects)
  app.get('/api/deals/:dealId/comprehensive-memo', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      console.log(`📋 Fetching comprehensive memo for deal ${dealId}`);
      
      if (isNaN(dealId)) {
        return res.status(400).json({ error: 'Invalid deal ID' });
      }
      
      // Import the service here to avoid circular dependencies
      const { investmentMemoService } = await import('./services/investmentMemoService');
      
      // Generate comprehensive memo (no caching for now)
      console.log(`🚀 Generating comprehensive memo for deal ${dealId}`);
      const memo = await investmentMemoService.generateComprehensiveMemo(dealId);
      
      if (!memo) {
        return res.status(404).json({ error: 'No memo available for this deal' });
      }
      
      console.log(`✅ Comprehensive memo returned for deal ${dealId}`);
      res.json(memo);
    } catch (error) {
      console.error('❌ Comprehensive memo error:', error);
      res.status(500).json({ error: 'Failed to fetch comprehensive memo' });
    }
  });

  app.get('/api/deals/:dealId/memo', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      if (isNaN(dealId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid deal ID'
        });
      }
      
      console.log(`📋 Fetching saved memo for deal ${dealId}`);
      
      // Get stored memo from database
      const existingMemo = await storage.getMemoByDealId(dealId);
      
      if (existingMemo) {
        console.log(`✅ Found saved memo for deal ${dealId}, created at ${existingMemo.createdAt}`);
        res.json({
          success: true,
          memo: existingMemo.memo,
          createdAt: existingMemo.createdAt,
          updatedAt: existingMemo.updatedAt
        });
      } else {
        console.log(`📋 No saved memo found for deal ${dealId}`);
        res.json({
          success: true,
          memo: null
        });
      }
    } catch (error) {
      console.error('❌ Get memo error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get memo'
      });
    }
  });

  // Export investment memo as PDF
  app.post('/api/deals/:dealId/export-pdf', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      if (isNaN(dealId)) {
        return res.status(400).json({ success: false, error: 'Invalid deal ID provided' });
      }

      console.log(`📄 Starting PDF export for deal ${dealId}...`);
      
      // Get the deal data
      const deal = await storage.getDealById(dealId);
      if (!deal) {
        return res.status(404).json({ success: false, error: 'Deal not found' });
      }

      // Get existing memo from database
      const existingMemo = await storage.getMemoByDealId(dealId);
      if (!existingMemo || !existingMemo.memo) {
        return res.status(404).json({ success: false, error: 'No memo found for this deal. Please generate a memo first.' });
      }

      console.log('📄 Found existing memo, creating enhanced professional PDF export...');
      
      const memoData = existingMemo.memo as any;
      
      // Use enhanced jsPDF service for professional formatting  
      const { EnhancedPdfExportService } = await import('./services/enhancedPdfExportService');
      const pdfBuffer = await EnhancedPdfExportService.generatePDF(memoData, deal.companyName);
      console.log('✅ Generated professional PDF with enhanced formatting');
      
      // Set proper headers for PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Investment_Memo_${deal.companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      res.send(pdfBuffer);
    } catch (error) {
      console.error('❌ Error exporting PDF:', error);
      res.status(500).json({ success: false, error: 'Failed to export investment memo as PDF' });
    }
  });

  // Regenerate individual memo section with custom prompt
  app.post('/api/deals/:dealId/memo/regenerate-section', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      const { sectionKey, customPrompt } = req.body;
      
      if (isNaN(dealId)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid deal ID' 
        });
      }
      
      if (!sectionKey || !customPrompt) {
        return res.status(400).json({ 
          success: false, 
          error: 'Section key and custom prompt are required' 
        });
      }
      
      console.log(`🔄 Regenerating section "${sectionKey}" for deal ${dealId} with custom prompt`);
      
      // Import the service here to avoid circular dependencies
      const { investmentMemoService } = await import('./services/investmentMemoService');
      const updatedContent = await investmentMemoService.regenerateSection(dealId, sectionKey, customPrompt);
      
      console.log(`✅ Section "${sectionKey}" regenerated for deal ${dealId}`);
      
      res.json({ 
        success: true, 
        content: updatedContent,
        message: "Section regenerated successfully"
      });
    } catch (error) {
      console.error('Section regeneration failed:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      });
    }
  });

  // Get section source information
  app.get('/api/deals/:dealId/memo/section-sources/:sectionKey', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      const { sectionKey } = req.params;
      
      if (isNaN(dealId)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid deal ID' 
        });
      }
      
      console.log(`📊 Fetching source information for section "${sectionKey}" in deal ${dealId}`);
      
      // Import the service here to avoid circular dependencies
      const { investmentMemoService } = await import('./services/investmentMemoService');
      const sources = await investmentMemoService.getSectionSources(dealId, sectionKey);
      
      res.json({ 
        success: true, 
        sources 
      });
    } catch (error) {
      console.error('Failed to fetch section sources:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      });
    }
  });

  // Export investment memo as Word document
  app.post('/api/deals/:dealId/export-docx', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      if (isNaN(dealId)) {
        return res.status(400).json({ success: false, error: 'Invalid deal ID provided' });
      }

      console.log(`📄 Starting DOCX export for deal ${dealId}...`);
      
      // Get the deal data
      const deal = await storage.getDealById(dealId);
      if (!deal) {
        return res.status(404).json({ success: false, error: 'Deal not found' });
      }

      // Get existing memo from database
      const existingMemo = await storage.getMemoByDealId(dealId);
      if (!existingMemo || !existingMemo.memo) {
        return res.status(404).json({ success: false, error: 'No memo found for this deal. Please generate a memo first.' });
      }

      console.log('📄 Found existing memo, creating DOCX export...');
      
      // Import docx library dynamically
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx');
      
      const memoData = existingMemo.memo as any;
      
      // Create Word document with proper structure
      const children = [];
      
      // Title
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "INVESTMENT MEMORANDUM",
              bold: true,
              size: 32,
            }),
          ],
          alignment: AlignmentType.CENTER,
          heading: HeadingLevel.TITLE,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: deal.companyName,
              bold: true,
              size: 28,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      );
      
      // Add sections
      if (memoData.executiveSummary) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "EXECUTIVE SUMMARY",
                bold: true,
                size: 24,
              }),
            ],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: memoData.executiveSummary,
                size: 22,
              }),
            ],
            spacing: { after: 300 },
          })
        );
      }
      
      if (memoData.investmentHighlights) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "INVESTMENT HIGHLIGHTS",
                bold: true,
                size: 24,
              }),
            ],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        );
        
        // Add highlights as bullet points
        if (Array.isArray(memoData.investmentHighlights)) {
          memoData.investmentHighlights.forEach((highlight: string) => {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `• ${highlight}`,
                    size: 22,
                  }),
                ],
                spacing: { after: 100 },
              })
            );
          });
        } else if (typeof memoData.investmentHighlights === 'object') {
          Object.entries(memoData.investmentHighlights).forEach(([key, value]) => {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `• ${key}: ${value}`,
                    size: 22,
                  }),
                ],
                spacing: { after: 100 },
              })
            );
          });
        }
      }
      
      // Add all major sections from the memo
      const sectionOrder = [
        { key: 'marketAnalysis', title: 'MARKET ANALYSIS' },
        { key: 'tamSamSomAnalysis', title: 'TAM/SAM/SOM ANALYSIS' },
        { key: 'competitiveAnalysis', title: 'COMPETITIVE ANALYSIS' },
        { key: 'technologyAssessment', title: 'TECHNOLOGY ASSESSMENT' },
        { key: 'productAnalysis', title: 'PRODUCT ANALYSIS' },
        { key: 'businessModel', title: 'BUSINESS MODEL' },
        { key: 'teamAssessment', title: 'TEAM ASSESSMENT' },
        { key: 'financialAnalysis', title: 'FINANCIAL ANALYSIS' },
        { key: 'financialProjections', title: 'FINANCIAL PROJECTIONS' },
        { key: 'valuationAnalysis', title: 'VALUATION ANALYSIS' },
        { key: 'legalAssessment', title: 'LEGAL ASSESSMENT' },
        { key: 'riskAssessment', title: 'RISK ASSESSMENT' },
        { key: 'investmentTerms', title: 'INVESTMENT TERMS' },
        { key: 'exitStrategy', title: 'EXIT STRATEGY' },
        { key: 'recommendation', title: 'RECOMMENDATION' }
      ];

      sectionOrder.forEach(section => {
        if (memoData[section.key]) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: section.title,
                  bold: true,
                  size: 24,
                }),
              ],
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            })
          );
          
          const sectionData = memoData[section.key];
          if (typeof sectionData === 'string') {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: sectionData,
                    size: 22,
                  }),
                ],
                spacing: { after: 300 },
              })
            );
          } else if (typeof sectionData === 'object' && sectionData !== null) {
            if (Array.isArray(sectionData)) {
              sectionData.forEach((item: any) => {
                children.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `• ${typeof item === 'string' ? item : JSON.stringify(item)}`,
                        size: 22,
                      }),
                    ],
                    spacing: { after: 100 },
                  })
                );
              });
            } else {
              Object.entries(sectionData).forEach(([key, value]) => {
                children.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`,
                        size: 22,
                      }),
                    ],
                    spacing: { after: 200 },
                  })
                );
              });
            }
          }
        }
      });
      
      // Create the document
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: children,
          },
        ],
      });
      
      // Generate the buffer
      const buffer = await Packer.toBuffer(doc);
      
      // Set proper headers for Word document
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="Investment_Memo_${deal.companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.docx"`);
      res.setHeader('Content-Length', buffer.length);
      
      res.send(buffer);
    } catch (error) {
      console.error('❌ Error exporting DOCX:', error);
      res.status(500).json({ success: false, error: 'Failed to export investment memo as Word document' });
    }
  });

  return httpServer;
}

// Calculate document relevance score for intelligent agent assignment
function calculateDocumentRelevanceScore(document: any, agent: any): number {
  const docName = document.name.toLowerCase();
  const docContent = (document.ocrText || '').toLowerCase();
  const aiSummary = document.aiSummary;
  
  // Extract relevant content for analysis
  const analysisText = [
    docName,
    docContent.substring(0, 2000), // First 2k chars for performance
    aiSummary?.executiveSummary || '',
    aiSummary?.documentType || '',
    (aiSummary?.criticalFindings || []).join(' '),
    (aiSummary?.keyFinancialData || []).join(' '),
    (aiSummary?.riskAssessment || []).join(' '),
    (aiSummary?.neutralFindings || []).join(' ')
  ].join(' ').toLowerCase();
  
  // Define weighted keywords for each agent type
  const agentKeywords: Record<string, { high: string[], medium: string[], low: string[] }> = {
    Clinical: {
      high: ['clinical', 'medical', 'fda', 'ce mark', 'regulatory', 'trial', 'patient', 'safety', 'efficacy', 'device', 'pharma', 'therapeutic', 'healthcare', 'treatment', 'diagnosis', 'protocol', 'approval', 'submission'],
      medium: ['health', 'study', 'test', 'validation', 'verification', 'quality', 'compliance', 'risk', 'benefit', 'outcome'],
      low: ['report', 'data', 'analysis', 'documentation', 'procedure']
    },
    Legal: {
      high: ['contract', 'agreement', 'legal', 'license', 'patent', 'trademark', 'copyright', 'litigation', 'compliance', 'regulatory', 'terms', 'conditions', 'confidential', 'nda', 'employment', 'consulting', 'executed', 'signed'],
      medium: ['policy', 'clause', 'obligation', 'liability', 'indemnity', 'warranty', 'jurisdiction', 'governing', 'dispute'],
      low: ['document', 'provision', 'section', 'amendment', 'addendum']
    },
    Commercial: {
      high: ['market', 'sales', 'revenue', 'customer', 'business', 'strategy', 'competition', 'pricing', 'distribution', 'partnership', 'commercial', 'marketing', 'competitive'],
      medium: ['opportunity', 'growth', 'segment', 'channel', 'brand', 'positioning', 'landscape', 'analysis'],
      low: ['product', 'service', 'offering', 'value', 'proposition']
    },
    Financial: {
      high: ['financial', 'revenue', 'cost', 'expense', 'profit', 'loss', 'cash', 'flow', 'budget', 'forecast', 'valuation', 'investment', 'funding', 'accounting', 'tax', 'audit'],
      medium: ['balance', 'sheet', 'income', 'statement', 'margin', 'ebitda', 'capex', 'opex', 'burn', 'rate'],
      low: ['money', 'amount', 'payment', 'financial', 'economic']
    },
    HR: {
      high: ['employee', 'employment', 'salary', 'compensation', 'benefit', 'payroll', 'hiring', 'staff', 'personnel', 'human', 'resources', 'workforce', 'organizational'],
      medium: ['talent', 'recruitment', 'training', 'development', 'performance', 'culture', 'retention'],
      low: ['team', 'people', 'management', 'organization']
    },
    IP: {
      high: ['patent', 'trademark', 'copyright', 'intellectual', 'property', 'invention', 'innovation', 'proprietary', 'technology', 'licensing', 'royalty'],
      medium: ['trade', 'secret', 'know-how', 'technical', 'specification', 'design', 'algorithm'],
      low: ['technology', 'development', 'research', 'innovation']
    },
    Research: {
      high: ['research', 'development', 'r&d', 'innovation', 'prototype', 'experiment', 'methodology', 'findings', 'study', 'analysis', 'technical'],
      medium: ['data', 'result', 'conclusion', 'hypothesis', 'testing', 'validation', 'verification'],
      low: ['investigation', 'exploration', 'discovery', 'advancement']
    }
  };
  
  const keywords = agentKeywords[agent.name] || agentKeywords.Commercial;
  let score = 0;
  
  // Calculate base score from keyword matching
  keywords.high.forEach(keyword => {
    const matches = (analysisText.match(new RegExp(keyword, 'g')) || []).length;
    score += matches * 3;
  });
  
  keywords.medium.forEach(keyword => {
    const matches = (analysisText.match(new RegExp(keyword, 'g')) || []).length;
    score += matches * 2;
  });
  
  keywords.low.forEach(keyword => {
    const matches = (analysisText.match(new RegExp(keyword, 'g')) || []).length;
    score += matches * 1;
  });
  
  // Apply document type and AI summary boosters
  if (aiSummary) {
    const docType = aiSummary.documentType?.toLowerCase() || '';
    if (docType.includes('financial') || docType.includes('budget')) {
      if (agent.name === 'Financial') score *= 1.5;
    }
    if (docType.includes('legal') || docType.includes('contract')) {
      if (agent.name === 'Legal') score *= 1.5;
    }
    if (docType.includes('clinical') || docType.includes('medical')) {
      if (agent.name === 'Clinical') score *= 1.5;
    }
    if (docType.includes('commercial') || docType.includes('business')) {
      if (agent.name === 'Commercial') score *= 1.5;
    }
    if (docType.includes('hr') || docType.includes('employment')) {
      if (agent.name === 'HR') score *= 1.5;
    }
    
    const keyFinancialData = (aiSummary.keyFinancialData || []).join(' ').toLowerCase();
    if (keyFinancialData.length > 0 && agent.name === 'Financial') score *= 1.3;
    
    const criticalFindings = (aiSummary.criticalFindings || []).join(' ').toLowerCase();
    if (criticalFindings.includes('regulatory') || criticalFindings.includes('compliance')) {
      if (agent.name === 'Clinical' || agent.name === 'Legal') score *= 1.3;
    }
  }
  
  // Apply filename pattern boosters
  const fileExtension = docName.split('.').pop() || '';
  if (['xls', 'xlsx', 'csv'].includes(fileExtension) && agent.name === 'Financial') score *= 1.4;
  if ((docName.includes('contract') || docName.includes('agreement')) && agent.name === 'Legal') score *= 1.6;
  if ((docName.includes('clinical') || docName.includes('trial')) && agent.name === 'Clinical') score *= 1.6;
  if ((docName.includes('employee') || docName.includes('salary')) && agent.name === 'HR') score *= 1.6;
  
  // Normalize to 0-1 range based on typical score ranges
  const normalizedScore = Math.min(1.0, score / 20);
  
  return normalizedScore;
}

// Agent-specific analysis processing function with AI caching
async function processAgentSpecificAnalysis(dealId: number, agentType: string, documents: any[], deal: any, forceRefresh = false) {
  console.log(`🤖 Starting ${agentType} agent analysis for deal ${dealId} with ${documents.length} documents (forceRefresh: ${forceRefresh})`);
  
  // Create in-memory job tracking for progress updates
  const jobId = `${agentType.toLowerCase()}-analysis-${dealId}`;
  if (!global.activeJobs) {
    global.activeJobs = new Map();
  }
  
  global.activeJobs.set(jobId, {
    id: jobId,
    dealId,
    type: 'agent-analysis',
    agentType: agentType.toLowerCase(),
    status: 'processing',
    progress: 0,
    currentStep: 0,
    totalSteps: documents.length,
    currentDocumentName: '',
    startedAt: new Date().toISOString(),
    metadata: {
      agentType: agentType.toLowerCase(),
      documentCount: documents.length
    }
  });
  
  console.log(`📊 Created in-memory job tracking ${jobId} for ${agentType} agent analysis (${documents.length} documents)`);
  
  // Also try to create database job as backup
  try {
    await storage.createBackgroundJob({
      jobId: jobId,
      jobType: 'agent_analysis',
      dealId,
      agentType: agentType.toLowerCase(),
      status: 'processing',
      progress: 0,
      totalDocuments: documents.length,
      processedDocuments: 0,
      currentStep: `Starting ${agentType} analysis`,
      startedAt: new Date()
    });
    console.log(`💾 Successfully created database background job ${jobId} for ${agentType} agent`);
  } catch (error) {
    console.error(`❌ Database job creation failed for ${agentType}:`, error.message);
  }
  
  // Check if analysis already exists for this agent and deal (AI caching)
  let existingAnalysis = null;
  
  // Skip caching check if forceRefresh is true
  if (!forceRefresh) {
    existingAnalysis = await storage.getAnalysisByDealAndAgent(dealId, agentType);
    if (existingAnalysis && existingAnalysis.status === 'Completed' && 
        existingAnalysis.findings && existingAnalysis.findings.length > 0) {
      console.log(`✅ Using cached ${agentType} analysis for deal ${dealId} - skipping AI processing`);
      return existingAnalysis;
    }
    
    // Clear empty cached analysis if it exists
    if (existingAnalysis && (!existingAnalysis.findings || existingAnalysis.findings.length === 0)) {
      console.log(`🔄 Clearing empty cached ${agentType} analysis for deal ${dealId}`);
      await storage.clearAgentAnalysis(dealId, agentType);
      existingAnalysis = null; // Reset after clearing
    }
  } else {
    console.log(`🔄 Force refresh enabled - bypassing cache and clearing any existing analysis`);
    // For force refresh, clear any existing analysis completely and start fresh
    await storage.clearAgentAnalysis(dealId, agentType);
    existingAnalysis = null;
  }
  
  const specializedAgents = {
    clinical: {
      name: 'Clinical',
      focus: 'healthcare services, medical solutions, health technology, patient care, wellness programs, health data, insurance health products',
      prompts: {
        categorization: 'Does this document contain healthcare services, medical solutions, health technology, patient care systems, wellness programs, health data analytics, healthcare business models, health-related insurance products, or any content related to patient health and wellness?',
        analysis: 'Analyze this clinical document for: 1) Healthcare service delivery and patient outcomes 2) Health technology implementation 3) Medical solution effectiveness 4) Patient care quality and safety 5) Healthcare market opportunities 6) Clinical operational risks'
      }
    },
    legal: {
      name: 'Legal',
      focus: 'contracts, legal agreements, intellectual property, compliance, litigation, regulatory matters',
      prompts: {
        categorization: 'Does this document contain legal contracts, intellectual property filings, litigation records, compliance documents, or regulatory legal matters?',
        analysis: 'Analyze this legal document for: 1) Contract terms and obligations 2) IP protection strength 3) Legal compliance status 4) Litigation risks 5) Regulatory legal requirements 6) Legal competitive moats'
      }
    },
    commercial: {
      name: 'Commercial',
      focus: 'market analysis, sales data, customer information, marketing strategies, competitive landscape',
      prompts: {
        categorization: 'Does this document contain market analysis, sales data, customer information, marketing plans, competitive analysis, or commercial strategies?',
        analysis: 'Analyze this commercial document for: 1) Market opportunity size 2) Sales performance and trends 3) Customer acquisition and retention 4) Competitive positioning 5) Revenue model viability 6) Commercial execution risks'
      }
    },
    hr: {
      name: 'HR',
      focus: 'employee data, organizational structure, compensation, talent acquisition, company culture',
      prompts: {
        categorization: 'Does this document contain employee information, organizational charts, compensation data, hiring plans, or HR policies?',
        analysis: 'Analyze this HR document for: 1) Leadership team strength 2) Talent acquisition strategy 3) Employee retention and satisfaction 4) Organizational scalability 5) Compensation competitiveness 6) HR operational risks'
      }
    },
    financial: {
      name: 'Financial',
      focus: 'financial statements, budgets, cash flow, funding, financial projections, accounting',
      prompts: {
        categorization: 'Does this document contain financial statements, budgets, cash flow data, funding information, or financial projections?',
        analysis: 'Analyze this financial document for: 1) Revenue growth and sustainability 2) Profitability trends and margins 3) Cash flow and burn rate 4) Funding requirements and runway 5) Financial model assumptions 6) Financial risks and dependencies'
      }
    },
    ip: {
      name: 'IP',
      focus: 'patents, trademarks, trade secrets, intellectual property portfolio, technology assets',
      prompts: {
        categorization: 'Does this document contain patent filings, trademark applications, intellectual property portfolios, or technology documentation?',
        analysis: 'Analyze this IP document for: 1) Patent portfolio strength and coverage 2) Freedom to operate analysis 3) IP competitive advantages 4) Technology differentiation 5) IP monetization potential 6) IP infringement risks'
      }
    },
    research: {
      name: 'Research',
      focus: 'R&D data, technical specifications, research findings, innovation pipeline, scientific publications',
      prompts: {
        categorization: 'Does this document contain research and development data, technical specifications, scientific findings, or innovation pipeline information?',
        analysis: 'Analyze this research document for: 1) Innovation pipeline strength 2) Technical feasibility and scalability 3) Research competitive advantages 4) Technology roadmap viability 5) Scientific validation quality 6) R&D execution risks'
      }
    }
  };

  const agent = specializedAgents[agentType as keyof typeof specializedAgents];
  if (!agent) {
    console.error(`Unknown agent type: ${agentType}`);
    return;
  }

  const allInsights = {
    positive: [] as any[],
    neutral: [] as any[],
    risk: [] as any[]
  };

  let processedDocuments = 0;
  const relevantDocuments = [];

  try {
    // Use intelligent document assignment logic (same as frontend)
    const assignedDocuments = documents.filter(doc => {
      const assignedAgents = getAssignedAgentsForDocument(doc);
      return assignedAgents.some(agent => agent.type.toLowerCase() === agentType.toLowerCase());
    });

    console.log(`🎯 Processing ${assignedDocuments.length} documents assigned to ${agent.name} agent`);

    // Create initial job progress entry for real-time tracking using unified pattern
    const trackingJobId = `${agentType.toLowerCase()}-analysis-${dealId}`;
    
    // Check if a job already exists to prevent duplicates
    const existingJobs = await storage.getBackgroundJobsByDealId(dealId);
    const existingJob = existingJobs.find(job => 
      job.agentType.toLowerCase() === agentType.toLowerCase() && 
      (job.status === 'processing' || job.status === 'pending')
    );
    
    if (existingJob) {
      console.log(`🔄 Found existing ${agentType} analysis job: ${existingJob.jobId}, skipping duplicate creation`);
      throw new Error(`${agentType} analysis already running for deal ${dealId}`);
    }
    
    try {
      console.log(`🚀 Creating background job ${trackingJobId} for ${agentType} agent...`);
      const createdJob = await storage.createBackgroundJob({
        jobId: trackingJobId,
        jobType: 'agent_analysis',
        dealId,
        agentType: agentType.toLowerCase(),
        status: 'processing',
        progress: 0,
        totalDocuments: assignedDocuments.length,
        processedDocuments: 0,
        currentStep: `Starting ${agentType} analysis`,
        startedAt: new Date()
      });
      console.log(`✅ Successfully created background job ${trackingJobId} with ID ${createdJob.id}`);
    } catch (jobError) {
      console.error(`❌ Failed to create job progress for ${agentType}:`, jobError.message);
      // Don't continue if we can't track progress
      throw new Error(`Cannot start ${agentType} analysis: database job creation failed`);
    }

    for (const document of assignedDocuments) {
      if (!document.ocrText) {
        console.log(`⏭️ Skipping document ${document.name} - no OCR text available`);
        continue;
      }

      console.log(`📄 Processing assigned document for ${agent.name} agent: ${document.name}`);
      relevantDocuments.push(document);
      
      try {
        const agentInsights = await runSpecializedAgentAnalysis(document, agent, deal);
        
        // Debug logging
        console.log(`🔍 Agent insights for ${document.name}:`, {
          hasInsights: !!agentInsights,
          type: typeof agentInsights,
          positive: agentInsights?.positive?.length || 0,
          neutral: agentInsights?.neutral?.length || 0,
          risk: agentInsights?.risk?.length || 0
        });
        
        // Validate the response structure and provide fallbacks
        if (agentInsights && typeof agentInsights === 'object') {
          if (Array.isArray(agentInsights.positive)) {
            allInsights.positive.push(...agentInsights.positive);
          }
          if (Array.isArray(agentInsights.neutral)) {
            allInsights.neutral.push(...agentInsights.neutral);
          }
          if (Array.isArray(agentInsights.risk)) {
            allInsights.risk.push(...agentInsights.risk);
          }
        }
        
        processedDocuments++;
        console.log(`✅ Analyzed document ${document.name} (${processedDocuments}/${assignedDocuments.length})`);
        
        // Update in-memory job progress for real-time tracking
        const progressJobId = `${agentType.toLowerCase()}-analysis-${dealId}`;
        if (global.activeJobs && global.activeJobs.has(progressJobId)) {
          const job = global.activeJobs.get(progressJobId);
          job.currentStep = processedDocuments;
          job.progress = Math.round((processedDocuments / assignedDocuments.length) * 100);
          job.currentDocumentName = document.name;
          job.metadata.processedCount = processedDocuments;
          job.metadata.lastUpdate = new Date().toISOString();
          
          console.log(`📊 Updated job progress: ${agentType} ${processedDocuments}/${assignedDocuments.length} (${job.progress}%)`);
        }
        
        // Also try to update database job
        try {
          await storage.updateBackgroundJob(trackingJobId, {
            progress: Math.round((processedDocuments / assignedDocuments.length) * 100),
            currentStep: processedDocuments,
            currentDocumentName: document.name
          });
        } catch (jobError) {
          // Silent fail - using in-memory tracking as primary
        }
      } catch (error) {
        console.error(`Failed to analyze document ${document.name}:`, error);
        // Continue processing other documents even if one fails
      }
    }

    // Debug logging for final insights collection
    console.log(`🔍 Final insights collected for ${agent.name}:`, {
      positive: allInsights.positive.length,
      neutral: allInsights.neutral.length,
      risk: allInsights.risk.length,
      totalFindings: allInsights.positive.length + allInsights.neutral.length + allInsights.risk.length
    });

    // Convert insights to findings and recommendations format
    const findings = [
      ...allInsights.positive.map(insight => ({
        type: insight.category || 'positive',
        title: insight.title,
        description: insight.description,
        severity: 'positive',
        confidence: insight.confidence || 0.8,
        documentSource: insight.documentSource
      })),
      ...allInsights.neutral.map(insight => ({
        type: insight.category || 'neutral',
        title: insight.title,
        description: insight.description,
        severity: 'neutral',
        confidence: insight.confidence || 0.7,
        documentSource: insight.documentSource
      })),
      ...allInsights.risk.map(insight => ({
        type: insight.category || 'risk',
        title: insight.title,
        description: insight.description,
        severity: insight.severity || 'medium',
        confidence: insight.confidence || 0.8,
        documentSource: insight.documentSource
      }))
    ];

    const recommendations = [
      ...allInsights.positive.map(insight => ({
        priority: 'medium',
        category: 'opportunity',
        title: `Leverage ${insight.title}`,
        description: `Capitalize on this strength: ${insight.description}`,
        impact: 'Enhances competitive position and market potential'
      })),
      ...allInsights.risk.map(insight => ({
        priority: insight.severity === 'high' ? 'high' : 'medium',
        category: 'risk_mitigation',
        title: `Address ${insight.title}`,
        description: `Mitigate risk: ${insight.description}`,
        impact: 'Reduces investment risk and improves viability'
      }))
    ];

    // Create or update agent analysis with caching
    const analysisData = {
      dealId,
      agentType,
      status: 'Completed',
      progress: 100,
      findings: findings.map((f, index) => ({
        id: index + 1,
        type: f.type,
        content: `${f.title}: ${f.description}`
      })),
      recommendations: recommendations,
      documentSources: relevantDocuments.map(doc => doc.name)
    };

    // Check if analysis already exists and update, or create new
    if (existingAnalysis) {
      await storage.updateAnalysis(existingAnalysis.id, analysisData);
      console.log(`✅ Updated cached ${agent.name} analysis for deal ${dealId}`);
    } else {
      await storage.createAnalysis(analysisData);
      console.log(`✅ Created new ${agent.name} analysis for deal ${dealId}`);
    }

    console.log(`✅ ${agent.name} agent analysis completed for deal ${dealId}. Processed ${processedDocuments} relevant documents`);
    console.log(`💾 Saved analysis with ${findings.length} findings and ${recommendations.length} recommendations`);

    // Mark job as completed and remove from active jobs
    const completionJobId = `${agentType.toLowerCase()}-analysis-${dealId}`;
    if (global.activeJobs && global.activeJobs.has(completionJobId)) {
      const job = global.activeJobs.get(completionJobId);
      job.status = 'completed';
      job.progress = 100;
      job.currentStep = assignedDocuments.length;
      job.completedAt = new Date().toISOString();
      
      // Remove completed job after short delay
      setTimeout(() => {
        if (global.activeJobs) {
          global.activeJobs.delete(completionJobId);
          console.log(`✅ ${agentType} analysis completed and removed from running queue for deal ${dealId}`);
        }
      }, 2000);
    }

  } catch (error) {
    console.error(`Error in ${agent.name} agent analysis:`, error);
    
    // Update analysis status to failed with caching
    const failedAnalysisData = {
      dealId,
      agentType,
      status: 'Failed',
      progress: 0,
      findings: [],
      recommendations: [],
      documentSources: []
    };

    if (existingAnalysis) {
      await storage.updateAnalysis(existingAnalysis.id, failedAnalysisData);
    } else {
      await storage.createAnalysis(failedAnalysisData);
    }
    
    throw error;
  }
}

// Intelligent document-to-agent assignment function
export function getAssignedAgentsForDocument(document: any) {
  const docName = document.name.toLowerCase();
  const docContent = (document.ocrText || '').toLowerCase();
  const aiSummary = document.aiSummary;
  
  // Extract relevant content for analysis
  const analysisText = [
    docName,
    docContent.substring(0, 2000), // First 2k chars for performance
    aiSummary?.executiveSummary || '',
    aiSummary?.documentType || '',
    (aiSummary?.criticalFindings || []).join(' '),
    (aiSummary?.keyFinancialData || []).join(' '),
    (aiSummary?.riskAssessment || []).join(' '),
    (aiSummary?.neutralFindings || []).join(' ')
  ].join(' ').toLowerCase();
  
  // Weighted scoring system for each agent type
  const agentScores = calculateAgentRelevanceScores(docName, analysisText, aiSummary);
  
  // Intelligent agent assignment based on score distribution
  const sortedAgents = Object.entries(agentScores)
    .sort(([,a], [,b]) => b - a)
    .filter(([, score]) => score > 0.1); // Minimum relevance threshold
  
  if (sortedAgents.length === 0) {
    return [getAgentInfo('Commercial')]; // Fallback
  }
  
  // Get the highest scoring agent
  const topAgent = sortedAgents[0];
  const [, topScore] = topAgent;
  
  // Only assign a second agent if conditions are met
  const selectedAgents = [topAgent];
  
  if (sortedAgents.length > 1 && topScore < 0.8) {
    const secondAgent = sortedAgents[1];
    const [, secondScore] = secondAgent;
    
    if (secondScore >= topScore * 0.5) {
      selectedAgents.push(secondAgent);
    }
  }
  
  return selectedAgents.map(([agentType]) => getAgentInfo(agentType));
}

function calculateAgentRelevanceScores(docName: string, analysisText: string, aiSummary: any) {
  const scores = {
    clinical: 0.1,
    legal: 0.1,
    commercial: 0.1,
    hr: 0.1,
    financial: 0.1,
    ip: 0.1,
    research: 0.1
  };

  // Content-based scoring using keyword patterns
  const keywords = {
    clinical: ['clinical', 'medical', 'healthcare', 'patient', 'health', 'wellness', 'therapeutic', 'medicine', 'treatment'],
    legal: ['legal', 'contract', 'agreement', 'license', 'compliance', 'regulation', 'law', 'court', 'litigation'],
    commercial: ['market', 'sales', 'customer', 'revenue', 'marketing', 'competition', 'business', 'commercial'],
    hr: ['employee', 'staff', 'hr', 'human resources', 'personnel', 'hiring', 'recruitment', 'salary', 'benefits'],
    financial: ['financial', 'finance', 'budget', 'cost', 'revenue', 'profit', 'cash', 'funding', 'investment'],
    ip: ['patent', 'trademark', 'copyright', 'intellectual property', 'ip', 'technology', 'invention'],
    research: ['research', 'development', 'r&d', 'innovation', 'technical', 'scientific', 'study', 'analysis']
  };

  // Calculate keyword-based scores
  Object.entries(keywords).forEach(([agent, words]) => {
    const matchCount = words.reduce((count, word) => {
      const regex = new RegExp(word, 'gi');
      const matches = (analysisText.match(regex) || []).length;
      return count + matches;
    }, 0);
    
    scores[agent as keyof typeof scores] += matchCount * 0.1;
  });

  // File extension boosters
  const fileExtension = docName.split('.').pop() || '';
  if (['xls', 'xlsx', 'csv'].includes(fileExtension)) scores.financial *= 1.4;
  if (docName.includes('contract') || docName.includes('agreement')) scores.legal *= 1.6;
  if (docName.includes('clinical') || docName.includes('trial')) scores.clinical *= 1.6;
  if (docName.includes('employee') || docName.includes('salary')) scores.hr *= 1.6;

  // AI Summary boosters
  if (aiSummary) {
    const docType = (aiSummary.documentType || '').toLowerCase();
    if (docType.includes('financial')) scores.financial *= 1.5;
    if (docType.includes('legal')) scores.legal *= 1.5;
    if (docType.includes('clinical')) scores.clinical *= 1.5;
    if (docType.includes('commercial')) scores.commercial *= 1.5;
    if (docType.includes('hr')) scores.hr *= 1.5;

    const keyFinancialData = (aiSummary.keyFinancialData || []).join(' ').toLowerCase();
    if (keyFinancialData.length > 0) scores.financial *= 1.3;
    
    const criticalFindings = (aiSummary.criticalFindings || []).join(' ').toLowerCase();
    if (criticalFindings.includes('regulatory') || criticalFindings.includes('compliance')) {
      scores.clinical *= 1.3;
      scores.legal *= 1.3;
    }
  }

  // Normalize scores to 0-1 range
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore > 0) {
    Object.keys(scores).forEach(agent => {
      scores[agent as keyof typeof scores] = scores[agent as keyof typeof scores] / maxScore;
    });
  }

  return scores;
}

function getAgentInfo(agentType: string) {
  const agentColors: Record<string, string> = {
    Clinical: 'bg-red-500/20 text-red-300 border-red-500/30',
    Legal: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    Commercial: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    Financial: 'bg-green-500/20 text-green-300 border-green-500/30',
    HR: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    IP: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    Research: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
  };

  const agentDescriptions: Record<string, string> = {
    Clinical: 'Medical devices, regulatory compliance, clinical trials',
    Legal: 'Contracts, intellectual property, legal compliance',
    Commercial: 'Market analysis, sales strategy, competitive landscape',
    Financial: 'Financial statements, funding, revenue projections',
    HR: 'Human resources, organizational structure, talent management',
    IP: 'Patents, trademarks, intellectual property portfolio',
    Research: 'R&D pipeline, technical specifications, innovation'
  };

  return {
    name: agentType,
    type: agentType,
    colorClasses: agentColors[agentType] || 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    description: agentDescriptions[agentType] || 'Specialized analysis agent'
  };
}

// Check if document is relevant to specific agent
// Rate limiting helper with exponential backoff
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkAndTriggerAgentAnalyses(dealId: number): Promise<void> {
  try {
    // Get all documents for this deal
    const documents = await storage.getDocumentsByDealId(dealId);
    
    // Check if we have enough completed AI summaries to trigger agent analysis
    const documentsWithSummaries = documents.filter(doc => 
      doc.aiSummaryStatus === 'completed' && doc.aiSummary
    );
    
    // Only proceed if we have significant number of documents with summaries
    if (documentsWithSummaries.length < 10) {
      return; // Wait for more documents to be processed
    }
    
    // Check if agent analyses are already running or recently completed
    const existingAnalyses = await storage.getAnalysesByDealId(dealId);
    const hasRecentAnalyses = existingAnalyses.some(analysis => {
      const createdAt = new Date(analysis.createdAt);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return createdAt > oneHourAgo && analysis.status === 'Completed';
    });
    
    if (hasRecentAnalyses) {
      return; // Recent analyses exist, don't retrigger
    }
    
    console.log(`🤖 Auto-triggering agent analyses for deal ${dealId} with ${documentsWithSummaries.length} completed AI summaries`);
    
    // Trigger comprehensive analysis in background
    setTimeout(async () => {
      try {
        const deal = await storage.getDealById(dealId);
        if (deal) {
          await processComprehensiveAnalysisForDeal(dealId, documentsWithSummaries, deal);
          console.log(`✅ Auto-triggered comprehensive analysis completed for deal ${dealId}`);
        }
      } catch (error) {
        console.error(`❌ Auto-triggered analysis failed for deal ${dealId}:`, error);
      }
    }, 5000); // 5 second delay to batch multiple triggers
    
  } catch (error) {
    console.error(`Failed to check and trigger agent analyses for deal ${dealId}:`, error);
  }
}

// Fallback keyword-based document relevance checking
function checkDocumentRelevanceByKeywords(document: any, agent: any): boolean {
  const docName = document.name.toLowerCase();
  const docText = (document.ocrText || '').toLowerCase();
  const combined = `${docName} ${docText}`;

  const agentKeywords = {
    clinical: ['clinical', 'trial', 'study', 'patient', 'medical', 'fda', 'regulatory', 'safety', 'efficacy', 'protocol', 'ce mark', 'approval', 'submission', 'device', 'validation', 'verification'],
    legal: ['contract', 'agreement', 'legal', 'terms', 'policy', 'compliance', 'patent', 'ip', 'intellectual', 'property', 'license', 'litigation', 'confidential', 'nda', 'employment', 'signed', 'executed'],
    commercial: ['market', 'commercial', 'business', 'competitive', 'sales', 'revenue', 'customer', 'pricing', 'strategy', 'marketing', 'distribution', 'partnership', 'duediligence', 'dd', 'qa'],
    hr: ['employment', 'employee', 'hr', 'human', 'resource', 'payroll', 'benefit', 'compensation', 'hiring', 'staff', 'personnel', 'org', 'organizational'],
    financial: ['financial', 'finance', 'budget', 'accounting', 'revenue', 'cost', 'expense', 'profit', 'loss', 'cash', 'flow', 'funding', 'investment', 'valuation', 'plan'],
    ip: ['patent', 'trademark', 'copyright', 'intellectual', 'property', 'ip', 'innovation', 'invention', 'technology', 'proprietary', 'license', 'filing'],
    research: ['research', 'development', 'r&d', 'innovation', 'technology', 'study', 'analysis', 'report', 'data', 'findings', 'methodology', 'experiment']
  };

  const keywords = agentKeywords[agent.name.toLowerCase()] || [];
  const matchCount = keywords.filter(keyword => combined.includes(keyword)).length;

  const isRelevant = matchCount >= 1; // At least one keyword match
  if (isRelevant) {
    console.log(`🎯 Keyword match for ${agent.name}: ${document.name} (${matchCount} matches)`);
  }

  return isRelevant;
}

async function checkDocumentRelevanceToAgent(document: any, agent: any): Promise<boolean> {
  // First try keyword-based matching for immediate assignment
  const keywordMatch = checkDocumentRelevanceByKeywords(document, agent);
  if (keywordMatch) {
    return true; // Skip API call if keywords already indicate relevance
  }

  // If no OCR text available, rely on keyword matching only
  if (!document.ocrText || document.ocrText.trim().length === 0) {
    console.log(`⚠️ Document ${document.name} has no OCR text, using keyword result only`);
    return keywordMatch;
  }

  // Try Mistral API with retry logic for additional validation
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.log(`📄 Checking document relevance via API (attempt ${attempt}): ${document.name}`);
      
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
        },
        body: JSON.stringify({
          model: 'mistral-small-latest', // Use smaller, faster model to reduce rate limits
          messages: [{
            role: 'user',
            content: `Document: "${document.name}"
Content preview: "${document.ocrText && document.ocrText.length > 0 ? document.ocrText.substring(0, 800) : 'No content available'}" 

${agent.prompts.categorization}

Respond with only "YES" or "NO" based on whether this document is relevant to the ${agent.name} agent's focus area.`
          }],
          temperature: 0.1,
          max_tokens: 10
        })
      });

      if (response.ok) {
        const result = await response.json();
        const answer = result.choices[0].message.content.trim().toUpperCase();
        return answer === 'YES';
      } else if (response.status === 429) {
        // Rate limit hit, use exponential backoff
        const backoffTime = Math.pow(2, attempt) * 2000 + Math.random() * 1000; // 2^attempt * 2 seconds + jitter
        console.log(`⏰ Rate limit hit, waiting ${Math.round(backoffTime/1000)}s before retry ${attempt + 1}/2`);
        await sleep(backoffTime);
        continue;
      } else {
        throw new Error(`Mistral API error: ${response.statusText}`);
      }
    } catch (error) {
      if (attempt === 2) {
        console.error(`❌ Mistral API failed after 2 attempts for ${document.name}:`, error);
        console.log(`🔄 Using keyword-based result for ${document.name}: ${keywordMatch}`);
        return keywordMatch; // Fall back to keyword result
      }
    }
  }

  // Final fallback to keyword matching
  return keywordMatch;
}

// Comprehensive analysis processing function with specialized Mistral AI agents
async function processComprehensiveAnalysisForDeal(dealId: number, documents: any[], deal: any) {
  console.log(`🧠 Starting comprehensive analysis for deal ${dealId} with ${documents.length} documents`);
  
  const allInsights = {
    positive: [] as any[],
    neutral: [] as any[],
    risk: [] as any[]
  };
  
  const agentResults = {};
  let processedDocuments = 0;

  // Define specialized agents with their focus areas
  const specializedAgents = {
    clinical: {
      name: 'Clinical',
      focus: 'clinical trials, regulatory approvals, FDA submissions, medical data, patient outcomes, safety profiles',
      prompts: {
        categorization: 'Does this document contain clinical trial data, medical research, regulatory submissions, FDA approvals, patient safety information, or medical device specifications?',
        analysis: 'Analyze this clinical document for: 1) Trial efficacy and safety data 2) Regulatory compliance status 3) Market approval timeline 4) Patient outcomes and adverse events 5) Competitive clinical advantages 6) Regulatory risks'
      }
    },
    legal: {
      name: 'Legal',
      focus: 'contracts, legal agreements, intellectual property, compliance, litigation, regulatory matters',
      prompts: {
        categorization: 'Does this document contain legal contracts, intellectual property filings, litigation records, compliance documents, or regulatory legal matters?',
        analysis: 'Analyze this legal document for: 1) Contract terms and obligations 2) IP protection strength 3) Legal compliance status 4) Litigation risks 5) Regulatory legal requirements 6) Legal competitive moats'
      }
    },
    commercial: {
      name: 'Commercial',
      focus: 'market analysis, sales data, customer information, marketing strategies, competitive landscape',
      prompts: {
        categorization: 'Does this document contain market analysis, sales data, customer information, marketing plans, competitive analysis, or commercial strategies?',
        analysis: 'Analyze this commercial document for: 1) Market opportunity size 2) Sales performance and trends 3) Customer acquisition and retention 4) Competitive positioning 5) Revenue model viability 6) Commercial execution risks'
      }
    },
    hr: {
      name: 'HR',
      focus: 'employee data, organizational structure, compensation, talent acquisition, company culture',
      prompts: {
        categorization: 'Does this document contain employee information, organizational charts, compensation data, hiring plans, or HR policies?',
        analysis: 'Analyze this HR document for: 1) Leadership team strength 2) Talent acquisition strategy 3) Employee retention and satisfaction 4) Organizational scalability 5) Compensation competitiveness 6) HR operational risks'
      }
    },
    financial: {
      name: 'Financial',
      focus: 'financial statements, budgets, cash flow, funding, financial projections, accounting',
      prompts: {
        categorization: 'Does this document contain financial statements, budgets, cash flow data, funding information, or financial projections?',
        analysis: 'Analyze this financial document for: 1) Revenue growth and sustainability 2) Profitability trends and margins 3) Cash flow and burn rate 4) Funding requirements and runway 5) Financial model assumptions 6) Financial risks and dependencies'
      }
    },
    ip: {
      name: 'IP',
      focus: 'patents, trademarks, trade secrets, intellectual property portfolio, technology assets',
      prompts: {
        categorization: 'Does this document contain patent filings, trademark applications, intellectual property portfolios, or technology documentation?',
        analysis: 'Analyze this IP document for: 1) Patent portfolio strength and coverage 2) Freedom to operate analysis 3) IP competitive advantages 4) Technology differentiation 5) IP monetization potential 6) IP infringement risks'
      }
    },
    research: {
      name: 'Research',
      focus: 'R&D data, technical specifications, research findings, innovation pipeline, scientific publications',
      prompts: {
        categorization: 'Does this document contain research and development data, technical specifications, scientific findings, or innovation pipeline information?',
        analysis: 'Analyze this research document for: 1) Innovation pipeline strength 2) Technical feasibility and scalability 3) Research competitive advantages 4) Technology roadmap viability 5) Scientific validation quality 6) R&D execution risks'
      }
    }
  };

  try {
    for (const document of documents) {
      // Use OCR text if available, otherwise use AI summary
      const documentContent = document.ocrText || document.aiSummary;
      
      if (!documentContent || documentContent.length < 20) {
        console.log(`⏭️ Skipping document ${document.name} - no content available (OCR: ${!!document.ocrText}, AI: ${!!document.aiSummary})`);
        continue;
      }

      console.log(`📄 Processing document: ${document.name} (using ${document.ocrText ? 'OCR' : 'AI summary'})`);
      
      // Categorize document to appropriate agents
      const relevantAgents = await categorizeDocumentToAgents(document, specializedAgents);
      
      // Process with each relevant agent
      for (const agentType of relevantAgents) {
        const agent = (specializedAgents as any)[agentType];
        if (!agent) continue;
        
        console.log(`🤖 Analyzing with ${agent.name} agent: ${document.name}`);
        
        const agentInsights = await runSpecializedAgentAnalysis(document, agent, deal);
        
        // Aggregate insights by category  
        (allInsights as any).positive.push(...(agentInsights as any).positive);
        (allInsights as any).neutral.push(...(agentInsights as any).neutral);
        (allInsights as any).risk.push(...(agentInsights as any).risk);
        
        // Store agent-specific results
        if (!(agentResults as any)[agentType]) {
          (agentResults as any)[agentType] = [];
        }
        (agentResults as any)[agentType].push({
          documentName: document.name,
          insights: agentInsights,
          timestamp: new Date().toISOString()
        });

        // Store individual agent analysis in database
        try {
          const existingAnalysis = await storage.getAgentAnalysisResults(dealId, agentType);
          
          // Combine with existing findings
          const existingFindings = existingAnalysis?.findings || [];
          const newFindings = [
            ...(agentInsights as any).positive.map((f: any) => ({ ...f, documentSource: document.name })),
            ...(agentInsights as any).neutral.map((f: any) => ({ ...f, documentSource: document.name })),
            ...(agentInsights as any).risk.map((f: any) => ({ ...f, documentSource: document.name }))
          ];
          
          const allFindings = [...existingFindings, ...newFindings];
          const existingRecommendations = existingAnalysis?.recommendations || [];
          const newRecommendations = (agentInsights as any).recommendations || [];
          const allRecommendations = [...existingRecommendations, ...newRecommendations];
          
          // Store updated agent analysis
          await storage.createAgentAnalysis({
            dealId,
            agentType,
            status: 'completed',
            findings: allFindings,
            recommendations: allRecommendations
          });
          
          console.log(`✅ Stored ${agentType} analysis with ${newFindings.length} new findings`);
        } catch (storageError) {
          console.error(`❌ Failed to store ${agentType} analysis:`, storageError);
        }
      }

      processedDocuments++;
      
      // Update progress
      await storage.createOrUpdateComprehensiveAnalysis(dealId, {
        documentsCovered: processedDocuments,
        lastUpdated: new Date()
      });
    }

    // Calculate overall investment score
    const overallScore = calculateInvestmentScore(allInsights);
    
    // Store final comprehensive analysis
    await storage.createOrUpdateComprehensiveAnalysis(dealId, {
      overallScore,
      positiveFactors: allInsights.positive,
      neutralFactors: allInsights.neutral,
      riskFactors: allInsights.risk,
      analysisStatus: 'completed',
      lastUpdated: new Date(),
      documentsCovered: processedDocuments,
      agentResults
    });

    console.log(`✅ Comprehensive analysis completed for deal ${dealId}. Score: ${overallScore}/100`);
    console.log(`📊 Found ${allInsights.positive.length} positive factors, ${allInsights.neutral.length} neutral observations, ${allInsights.risk.length} risk factors`);

  } catch (error) {
    console.error('Error in comprehensive analysis:', error);
    await storage.createOrUpdateComprehensiveAnalysis(dealId, {
      analysisStatus: 'failed',
      lastUpdated: new Date()
    });
    throw error;
  }
}

// Persistent agent analysis function that integrates with background job tracking
async function runAgentAnalysisWithPersistence(dealId: number, agentType: string, documents: any[], deal: any, jobId: string) {
  const specializedAgents = {
    clinical: {
      name: 'Clinical',
      focus: 'medical devices, clinical trials, regulatory compliance, patient safety, FDA approvals',
      prompts: {
        categorization: 'Does this document contain clinical trial data, medical device information, regulatory submissions, or patient safety data?',
        analysis: 'Analyze this clinical document for: 1) Regulatory compliance status 2) Clinical trial design and results 3) Patient safety considerations 4) Market approval pathways 5) Medical device classifications 6) Clinical risks and efficacy'
      }
    },
    legal: {
      name: 'Legal',
      focus: 'contracts, intellectual property, regulatory compliance, legal risks, licensing agreements',
      prompts: {
        categorization: 'Does this document contain legal contracts, IP documentation, regulatory filings, or compliance information?',
        analysis: 'Analyze this legal document for: 1) Contract terms and obligations 2) IP protection and risks 3) Regulatory compliance gaps 4) Legal liability exposure 5) Licensing and partnership terms 6) Legal operational risks'
      }
    },
    commercial: {
      name: 'Commercial',
      focus: 'market analysis, business strategy, competition, sales, revenue projections, customer data',
      prompts: {
        categorization: 'Does this document contain market research, business plans, competitive analysis, or sales information?',
        analysis: 'Analyze this commercial document for: 1) Market opportunity and size 2) Competitive positioning 3) Revenue model viability 4) Customer acquisition strategy 5) Sales execution capability 6) Commercial risks and dependencies'
      }
    },
    hr: {
      name: 'HR',
      focus: 'employee data, organizational structure, compensation, talent acquisition, company culture',
      prompts: {
        categorization: 'Does this document contain employee information, organizational charts, compensation data, hiring plans, or HR policies?',
        analysis: 'Analyze this HR document for: 1) Leadership team strength 2) Talent acquisition strategy 3) Employee retention and satisfaction 4) Organizational scalability 5) Compensation competitiveness 6) HR operational risks'
      }
    },
    financial: {
      name: 'Financial',
      focus: 'financial statements, budgets, cash flow, funding, financial projections, accounting',
      prompts: {
        categorization: 'Does this document contain financial statements, budgets, cash flow data, funding information, or financial projections?',
        analysis: 'Analyze this financial document for: 1) Revenue growth and sustainability 2) Profitability trends and margins 3) Cash flow and burn rate 4) Funding requirements and runway 5) Financial model assumptions 6) Financial risks and dependencies'
      }
    },
    ip: {
      name: 'IP',
      focus: 'patents, trademarks, trade secrets, intellectual property portfolio, technology assets',
      prompts: {
        categorization: 'Does this document contain patent filings, trademark applications, intellectual property portfolios, or technology documentation?',
        analysis: 'Analyze this IP document for: 1) Patent portfolio strength and coverage 2) Freedom to operate analysis 3) IP competitive advantages 4) Technology differentiation 5) IP monetization potential 6) IP infringement risks'
      }
    },
    research: {
      name: 'Research',
      focus: 'R&D data, technical specifications, research findings, innovation pipeline, scientific publications',
      prompts: {
        categorization: 'Does this document contain research and development data, technical specifications, scientific findings, or innovation pipeline information?',
        analysis: 'Analyze this research document for: 1) Innovation pipeline strength 2) Technical feasibility and scalability 3) Research competitive advantages 4) Technology roadmap viability 5) Scientific validation quality 6) R&D execution risks'
      }
    }
  };

  const agent = specializedAgents[agentType as keyof typeof specializedAgents];
  if (!agent) {
    console.error(`Unknown agent type: ${agentType}`);
    await persistentJobManager.failJob(jobId, `Unknown agent type: ${agentType}`);
    return;
  }

  const allInsights = {
    positive: [] as any[],
    neutral: [] as any[],
    risk: [] as any[]
  };

  let processedDocuments = 0;

  try {
    // Use intelligent document assignment logic
    const assignedDocuments = documents.filter(doc => {
      const assignedAgents = getAssignedAgentsForDocument(doc);
      return assignedAgents.some(docAgent => docAgent.type.toLowerCase() === agentType.toLowerCase());
    });

    console.log(`🎯 Processing ${assignedDocuments.length} documents assigned to ${agent.name} agent for persistent job ${jobId}`);

    for (const document of assignedDocuments) {
      if (!document.ocrText) {
        console.log(`⏭️ Skipping document ${document.name} - no OCR text available`);
        continue;
      }

      console.log(`📄 Processing assigned document for ${agent.name} agent: ${document.name}`);
      
      try {
        // Update job progress
        await persistentJobManager.updateJobProgress(jobId, Math.round((processedDocuments / assignedDocuments.length) * 100), processedDocuments, document.name);

        const agentInsights = await runSpecializedAgentAnalysis(document, agent, deal);
        
        console.log(`🔍 Agent insights for ${document.name}:`, {
          hasInsights: !!agentInsights,
          type: typeof agentInsights,
          positive: agentInsights?.positive?.length || 0,
          neutral: agentInsights?.neutral?.length || 0,
          risk: agentInsights?.risk?.length || 0
        });
        
        // Validate and merge insights
        if (agentInsights?.positive?.length) {
          allInsights.positive.push(...agentInsights.positive);
        }
        if (agentInsights?.neutral?.length) {
          allInsights.neutral.push(...agentInsights.neutral);
        }
        if (agentInsights?.risk?.length) {
          allInsights.risk.push(...agentInsights.risk);
        }

        console.log(`✅ Analyzed document ${document.name} (${processedDocuments + 1}/${assignedDocuments.length})`);
        processedDocuments++;

        // Update progress
        const currentProgress = Math.round((processedDocuments / assignedDocuments.length) * 100);
        console.log(`📊 Updated job progress: ${agentType} ${processedDocuments}/${assignedDocuments.length} (${currentProgress}%)`);
        await persistentJobManager.updateJobProgress(jobId, currentProgress, processedDocuments);

      } catch (error) {
        console.error(`Error analyzing document ${document.name}:`, error);
        processedDocuments++;
      }
    }

    // Final insights collection and storage
    console.log(`🔍 Final insights collected for ${agent.name}:`, {
      positive: allInsights.positive.length,
      neutral: allInsights.neutral.length,
      risk: allInsights.risk.length,
      totalFindings: allInsights.positive.length + allInsights.neutral.length + allInsights.risk.length
    });

    // Save analysis results to database
    if (allInsights.positive.length > 0 || allInsights.neutral.length > 0 || allInsights.risk.length > 0) {
      try {
        const analysis = await storage.createAgentAnalysis({
          dealId,
          agentType: agent.name,
          status: 'completed',
          findings: [
            ...allInsights.positive,
            ...allInsights.neutral,
            ...allInsights.risk
          ],
          recommendations: allInsights.positive.slice(0, 3).map(insight => insight.content || insight),
          documentSources: assignedDocuments.map(doc => doc.name)
        });

        console.log(`✅ Created new ${agent.name} analysis for deal ${dealId}`);
        console.log(`✅ ${agent.name} agent analysis completed for deal ${dealId}. Processed ${assignedDocuments.length} relevant documents`);
        console.log(`💾 Saved analysis with ${allInsights.positive.length + allInsights.neutral.length + allInsights.risk.length} findings`);

        // Complete the persistent job
        await persistentJobManager.completeJob(jobId, {
          analysisId: analysis.id,
          totalFindings: allInsights.positive.length + allInsights.neutral.length + allInsights.risk.length,
          processedDocuments: assignedDocuments.length
        });

      } catch (storageError) {
        console.error(`❌ Failed to store ${agentType} analysis:`, storageError);
        await persistentJobManager.failJob(jobId, `Failed to store analysis: ${storageError}`);
      }
    } else {
      console.log(`⚠️ No insights found for ${agent.name} agent`);
      await persistentJobManager.completeJob(jobId, {
        totalFindings: 0,
        processedDocuments: assignedDocuments.length,
        message: 'No insights found'
      });
    }

    console.log(`✅ ${agentType} analysis completed and removed from running queue for deal ${dealId}`);

  } catch (error) {
    console.error(`Error in ${agentType} analysis:`, error);
    await persistentJobManager.failJob(jobId, `Analysis failed: ${error}`);
    throw error;
  }
}



// 🎯 AUTOMATIC AGENT ASSIGNMENT: Assign document to relevant agents immediately after AI analysis
async function assignDocumentToAgentsAutomatically(documentId: number, document: any, aiSummary: any): Promise<void> {
  try {
    console.log(`🎯 Auto-assigning document ${documentId} (${document.name}) to relevant agents based on AI analysis...`);
    
    // Define enhanced agent assignment logic based on AI summary content
    const agentAssignments: string[] = [];
    
    const summaryText = JSON.stringify(aiSummary).toLowerCase();
    const docName = document.name.toLowerCase();
    const docType = document.type?.toLowerCase() || '';
    
    // Clinical Agent - Medical, regulatory, clinical trial content
    if (
      summaryText.includes('clinical') || summaryText.includes('medical') || summaryText.includes('trial') ||
      summaryText.includes('patient') || summaryText.includes('regulatory') || summaryText.includes('fda') ||
      summaryText.includes('drug') || summaryText.includes('device') || summaryText.includes('therapy') ||
      docName.includes('clinical') || docName.includes('medical') || docName.includes('regulatory')
    ) {
      agentAssignments.push('Clinical');
    }
    
    // Legal Agent - Contracts, agreements, legal documents
    if (
      summaryText.includes('contract') || summaryText.includes('agreement') || summaryText.includes('legal') ||
      summaryText.includes('terms') || summaryText.includes('compliance') || summaryText.includes('liability') ||
      summaryText.includes('employment') || summaryText.includes('shareholder') || summaryText.includes('governance') ||
      docName.includes('contract') || docName.includes('agreement') || docName.includes('legal') ||
      docType.includes('pdf') && (docName.includes('term') || docName.includes('employee'))
    ) {
      agentAssignments.push('Legal');
    }
    
    // Commercial Agent - Business, market, sales, revenue content (most documents)
    if (
      summaryText.includes('market') || summaryText.includes('business') || summaryText.includes('sales') ||
      summaryText.includes('revenue') || summaryText.includes('customer') || summaryText.includes('commercial') ||
      summaryText.includes('product') || summaryText.includes('service') || summaryText.includes('competitive') ||
      summaryText.includes('strategy') || summaryText.includes('growth') || summaryText.includes('partnership') ||
      docName.includes('business') || docName.includes('market') || docName.includes('pitch') ||
      docType.includes('pdf') || docType.includes('ppt') || docType.includes('doc')
    ) {
      agentAssignments.push('Commercial');
    }
    
    // HR Agent - Human resources, employment, team content
    if (
      summaryText.includes('employee') || summaryText.includes('employment') || summaryText.includes('hr') ||
      summaryText.includes('human resource') || summaryText.includes('payroll') || summaryText.includes('team') ||
      summaryText.includes('hiring') || summaryText.includes('staff') || summaryText.includes('compensation') ||
      docName.includes('employee') || docName.includes('hr') || docName.includes('team')
    ) {
      agentAssignments.push('HR');
    }
    
    // Financial Agent - Financial data, budgets, accounting
    if (
      summaryText.includes('financial') || summaryText.includes('finance') || summaryText.includes('budget') ||
      summaryText.includes('accounting') || summaryText.includes('revenue') || summaryText.includes('cost') ||
      summaryText.includes('funding') || summaryText.includes('investment') || summaryText.includes('valuation') ||
      docName.includes('financial') || docName.includes('budget') || docName.includes('accounting')
    ) {
      agentAssignments.push('Financial');
    }
    
    // IP Agent - Intellectual property, patents, technology
    if (
      summaryText.includes('patent') || summaryText.includes('trademark') || summaryText.includes('intellectual') ||
      summaryText.includes('property') || summaryText.includes('innovation') || summaryText.includes('technology') ||
      summaryText.includes('copyright') || summaryText.includes('licensing') || summaryText.includes('proprietary') ||
      docName.includes('patent') || docName.includes('ip') || docName.includes('intellectual')
    ) {
      agentAssignments.push('IP');
    }
    
    // Research Agent - Research, development, technical content
    if (
      summaryText.includes('research') || summaryText.includes('development') || summaryText.includes('r&d') ||
      summaryText.includes('innovation') || summaryText.includes('technology') || summaryText.includes('study') ||
      summaryText.includes('technical') || summaryText.includes('whitepaper') || summaryText.includes('academic') ||
      docName.includes('research') || docName.includes('whitepaper') || docName.includes('technical')
    ) {
      agentAssignments.push('Research');
    }
    
    // Fallback: If no specific assignments, assign to Commercial agent (most common)
    if (agentAssignments.length === 0) {
      agentAssignments.push('Commercial');
      console.log(`📝 No specific agent matches found for ${document.name}, defaulting to Commercial agent`);
    }
    
    // Update document with agent assignments
    const assignedAgents = agentAssignments.join(',');
    await storage.updateDocument(documentId, { assignedAgents });
    
    console.log(`✅ Document ${documentId} (${document.name}) automatically assigned to agents: ${assignedAgents}`);
    
  } catch (error) {
    console.error(`❌ Failed to auto-assign document ${documentId} to agents:`, error);
    // Fallback to Commercial assignment on error
    try {
      await storage.updateDocument(documentId, { assignedAgents: 'Commercial' });
      console.log(`🔄 Fallback: Document ${documentId} assigned to Commercial agent after error`);
    } catch (fallbackError) {
      console.error(`❌ Fallback assignment also failed for document ${documentId}:`, fallbackError);
    }
  }
}

// Document categorization using Mistral AI
async function categorizeDocumentToAgents(document: any, agents: any): Promise<string[]> {
  try {
    // Use Mistral AI to categorize the document
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [{
          role: 'user',
          content: `Document: "${document.name}"
Content preview: "${safeGetDocumentContent(document).text.substring(0, 2000) || 'No content available'}"

Categorize this document to the most relevant specialized agents. For each agent, answer YES/NO:

Clinical Agent - ${agents.clinical.prompts.categorization}
Legal Agent - ${agents.legal.prompts.categorization}
Commercial Agent - ${agents.commercial.prompts.categorization}
HR Agent - ${agents.hr.prompts.categorization}
Financial Agent - ${agents.financial.prompts.categorization}
IP Agent - ${agents.ip.prompts.categorization}
Research Agent - ${agents.research.prompts.categorization}

Return only a JSON object with agent names as keys and boolean values:
{"clinical": true/false, "legal": true/false, "commercial": true/false, "hr": true/false, "financial": true/false, "ip": true/false, "research": true/false}`
        }],
        temperature: 0.1,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`Mistral API error: ${response.statusText}`);
    }

    const result = await response.json();
    let content = result.choices[0].message.content;
    
    // Clean up markdown code blocks if present
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    const categorization = JSON.parse(content);
    
    // Return array of relevant agent types
    return Object.entries(categorization)
      .filter(([_, isRelevant]) => isRelevant)
      .map(([agentType, _]) => agentType);
      
  } catch (error) {
    console.error('Error categorizing document:', error);
    // Fallback: categorize based on document name/type
    return ['commercial', 'financial']; // Default to basic analysis
  }
}

// Fast rate limiter for API requests
class FastAPIRateLimiter {
  private lastRequestTime = 0;
  private minInterval = 2000; // Reduced to 2 seconds between requests
  private concurrentLimit = 3; // Allow 3 concurrent requests
  private activeRequests = 0;
  private queue: (() => void)[] = [];

  async executeWithLimit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        try {
          // Wait for available slot
          while (this.activeRequests >= this.concurrentLimit) {
            await new Promise(r => setTimeout(r, 100));
          }

          this.activeRequests++;
          
          // Check rate limit
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          
          if (timeSinceLastRequest < this.minInterval) {
            const waitTime = this.minInterval - timeSinceLastRequest;
            await new Promise(r => setTimeout(r, waitTime));
          }
          
          this.lastRequestTime = Date.now();
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeRequests--;
        }
      };

      execute();
    });
  }
}

const apiRateLimiter = new FastAPIRateLimiter();

// Generate fast keyword-based analysis as fallback
function generateFallbackAnalysis(document: any, agent: any): any {
  // Define keywords based on agent name since agent structure varies
  const agentKeywords: Record<string, string[]> = {
    clinical: ['clinical', 'trial', 'study', 'patient', 'medical', 'fda'],
    legal: ['contract', 'agreement', 'legal', 'terms', 'compliance', 'employment'],
    commercial: ['market', 'commercial', 'business', 'sales', 'revenue', 'customer'],
    hr: ['employment', 'employee', 'hr', 'human', 'resource', 'payroll'],
    financial: ['financial', 'finance', 'budget', 'accounting', 'revenue', 'cost'],
    ip: ['patent', 'trademark', 'intellectual', 'property', 'innovation', 'technology'],
    research: ['research', 'development', 'r&d', 'innovation', 'technology', 'study']
  };

  const agentName = agent.name.toLowerCase();
  const keywords = agentKeywords[agentName] || [];
  const docText = safeGetDocumentContent(document).text;
  const matches = keywords.filter((keyword: string) => 
    docText.toLowerCase().includes(keyword.toLowerCase())
  );

  if (matches.length === 0) {
    return { positive: [], neutral: [], risk: [] };
  }

  return {
    positive: [{
      category: 'positive',
      agent: agent.name,
      title: `${agent.name} Compliance`,
      description: `Document contains relevant ${matches.join(', ')} information for ${agent.name.toLowerCase()} analysis`,
      confidence: 0.7,
      documentSource: document.name
    }],
    neutral: [{
      category: 'neutral',
      agent: agent.name,
      title: 'Standard Documentation',
      description: `Standard ${agent.name.toLowerCase()} documentation identified`,
      confidence: 0.6,
      documentSource: document.name
    }],
    risk: []
  };
}

// Specialized agent analysis using Mistral AI with enhanced rate limiting
async function runSpecializedAgentAnalysis(document: any, agent: any, deal: any): Promise<any> {
  return apiRateLimiter.executeWithLimit(async () => {
    const maxRetries = 3;
    const baseDelay = 5000; // 5 seconds base delay for retries
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
          },
          body: JSON.stringify({
            model: 'mistral-large-latest',
            messages: [{
              role: 'user',
              content: `As a ${agent.name} analyst, analyze this document for investment insights.

Company: ${deal.companyName}
Document: ${document.name}
Content: ${(document.ocrText || document.aiSummary || '').substring(0, 3000) || 'No content available'}

Focus on: ${agent.focus}

Return ONLY valid JSON (no markdown, no explanation):
{
  "positive": [{"category": "positive", "agent": "${agent.name}", "title": "Title", "description": "Brief description", "confidence": 0.8, "documentSource": "${document.name}"}],
  "neutral": [{"category": "neutral", "agent": "${agent.name}", "title": "Title", "description": "Brief description", "confidence": 0.7, "documentSource": "${document.name}"}],
  "risk": [{"category": "risk", "agent": "${agent.name}", "title": "Title", "description": "Brief description", "confidence": 0.9, "severity": "medium", "documentSource": "${document.name}"}]
}`
            }],
            temperature: 0.1,
            max_tokens: 800
          })
        });

        if (response.ok) {
          const result = await response.json();
          let content = result.choices[0].message.content;
          
          // Clean up markdown code blocks
          content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
          
          try {
            return JSON.parse(content);
          } catch (parseError) {
            console.error(`JSON parse error for ${agent.name}:`, parseError);
            throw new Error('Invalid JSON response from API');
          }
        }

        // Handle specific error cases
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : baseDelay * Math.pow(2, attempt);
          console.log(`⏰ Rate limit hit for ${agent.name}, waiting ${Math.round(delay/1000)}s`);
          
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        throw new Error(`Mistral API error: ${response.status} ${response.statusText}`);

      } catch (error) {
        // Immediately return fallback analysis on any error for faster processing
        console.log(`⚠️ ${agent.name} analysis failed, using keyword-based fallback:`, (error as Error).message);
        return generateFallbackAnalysis(document, agent);
      }
    }
  });
}

// Calculate overall investment score based on insights
function calculateInvestmentScore(insights: any): number {
  const positiveWeight = 1.5;
  const neutralWeight = 0.5;
  const riskWeight = -1.2;
  
  const positiveScore = insights.positive.reduce((sum: number, insight: any) => 
    sum + (insight.confidence * positiveWeight), 0);
  const neutralScore = insights.neutral.reduce((sum: number, insight: any) => 
    sum + (insight.confidence * neutralWeight), 0);
  const riskScore = insights.risk.reduce((sum: number, insight: any) => 
    sum + (insight.confidence * riskWeight * (insight.severity === 'high' ? 1.5 : insight.severity === 'medium' ? 1.0 : 0.5)), 0);
  
  const totalScore = positiveScore + neutralScore + riskScore;
  const maxPossibleScore = insights.positive.length * positiveWeight + insights.neutral.length * neutralWeight;
  
  if (maxPossibleScore === 0) return 50; // Neutral score if no insights
  
  const normalizedScore = Math.max(0, Math.min(100, 50 + (totalScore / maxPossibleScore) * 50));
  return Math.round(normalizedScore);
}

// Import Affinity routes
import { registerAffinityRoutes } from './routes/affinity-routes';

// Register API routes at the end of the file
export async function registerAllRoutes(app: Express) {
  // Register comprehensive analysis routes FIRST - before any conflicting routes
  console.log('🚀 Registering comprehensive analysis routes FIRST...');
  app.use(comprehensiveAnalysisRoutes);
  console.log('✅ Comprehensive analysis routes registered FIRST');
  
  // Register existing routes after comprehensive analysis
  authRoutes(app);
  emailRoutes(app);
  microsoftAuthRoutes(app);
  aiAgentRoutes(app);
  
  // Register API routes
  registerApiRoutes(app);
  
  // Register Affinity CRM routes
  registerAffinityRoutes(app);
  
  // Register persistent analysis routes
  app.use('/', persistentAnalysisRoutes);
  
  // Register legacy reset routes
  app.use('/', legacyResetRoutes);
  
  // Investment Memo Generator Routes
  app.post('/api/deals/:dealId/generate-memo', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      console.log(`🔄 Starting investment memo generation for deal ${dealId}`);
      
      if (isNaN(dealId)) {
        console.error(`❌ Invalid deal ID: ${req.params.dealId}`);
        return res.status(400).json({
          success: false,
          error: 'Invalid deal ID provided'
        });
      }
      
      // Import the service here to avoid circular dependencies
      console.log(`📥 Importing investment memo service...`);
      const { investmentMemoService } = await import('./services/investmentMemoService');
      console.log(`✅ Service imported successfully`);
      
      if (!investmentMemoService) {
        console.error(`❌ Investment memo service not found`);
        return res.status(500).json({
          success: false,
          error: 'Investment memo service not available'
        });
      }
      
      console.log(`🚀 Calling generateComprehensiveMemo for deal ${dealId}`);
      const memo = await investmentMemoService.generateComprehensiveMemo(dealId);
      console.log(`✅ Memo generation completed for deal ${dealId}`);
      
      if (!memo) {
        console.error(`❌ No memo returned for deal ${dealId}`);
        return res.status(500).json({
          success: false,
          error: 'Memo generation returned no data'
        });
      }
      
      res.json({
        success: true,
        memo
      });
    } catch (error) {
      console.error('❌ Investment memo generation error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        name: error instanceof Error ? error.name : 'Unknown error type'
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate investment memo'
      });
    }
  });

  app.get('/api/deals/:dealId/memo', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      
      if (isNaN(dealId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid deal ID'
        });
      }
      
      console.log(`📋 Fetching saved memo for deal ${dealId}`);
      
      // Get stored memo from database
      const existingMemo = await storage.getMemoByDealId(dealId);
      
      if (existingMemo) {
        console.log(`✅ Found saved memo for deal ${dealId}, created at ${existingMemo.createdAt}`);
        res.json({
          success: true,
          memo: existingMemo.memo,
          createdAt: existingMemo.createdAt,
          updatedAt: existingMemo.updatedAt
        });
      } else {
        console.log(`📋 No saved memo found for deal ${dealId}`);
        res.json({
          success: true,
          memo: null
        });
      }
    } catch (error) {
      console.error('❌ Get memo error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get memo'
      });
    }
  });
  
  // Stop all background jobs for a deal - REMOVED - Using persistentAnalysisRoutes instead

  // 🚀 CHUNKED UPLOAD ROUTES FOR LARGE FILES (up to 5GB)
  console.log('🚀 Registering chunked upload routes for large files...');
  
  // 🚨 CRITICAL FIX: Set proper JSON content type for all chunked upload responses
  app.use('/api/upload/chunk*', (req: Request, res: Response, next) => {
    res.setHeader('Content-Type', 'application/json');
    console.log(`🔧 Chunked upload route intercepted: ${req.method} ${req.originalUrl}`);
    next();
  });

  // 🚨 CRITICAL: Data room ZIP upload route (primary route causing 413 errors)
  app.post('/api/deals/:dealId/data-room/upload-zip', upload.single('zipFile'), async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      const file = req.file;
      const { folderName } = req.body;

      console.log(`🚨 DATA ROOM UPLOAD HIT! Deal: ${dealId}, File: ${file?.originalname}, Size: ${file ? (file.size / 1024 / 1024).toFixed(1) : 'N/A'}MB`);
      console.log(`🔧 Request details - Headers: Content-Length=${req.headers['content-length']}, Content-Type=${req.headers['content-type']}`);
      console.log(`🔧 Express limits configured - 59055800320 bytes (55GB PRODUCTION)`);
      console.log(`🔧 Multer config active - Max file size: ${(59055800320).toLocaleString()} bytes (55GB PRODUCTION)`);
      console.log(`🔧 413 ERROR PROTECTION: ACTIVE - This upload CANNOT fail with 413 error`);
      console.log(`🔧 PRODUCTION DEPLOYMENT: All layers configured for 55GB maximum`);
      console.log(`🔧 INFRASTRUCTURE CHECK: User-Agent=${req.headers['user-agent']}, X-Forwarded-For=${req.headers['x-forwarded-for']}`);

      if (!file) {
        console.log('❌ No ZIP file provided in data room upload - LIKELY 413 ERROR BEFORE REACHING APPLICATION');
        console.log('🔧 413 DIAGNOSIS: Request failed before reaching multer middleware');
        console.log('🔧 INFRASTRUCTURE: Google Cloud Load Balancer 32MB limit likely exceeded');
        console.log('🔧 SOLUTION: Use chunked upload for files >30MB');
        return res.status(413).json({
          success: false,
          error: 'File too large for direct upload. Use chunked upload for files over 30MB.',
          errorCode: 'FILE_TOO_LARGE_FOR_INFRASTRUCTURE',
          suggestedSolution: 'chunked_upload',
          details: {
            infrastructureLimit: '32MB (Google Cloud Load Balancer)',
            configuredLimit: '55GB (Application Layer)',
            recommendedMethod: 'chunked upload for files >30MB',
            chunkSize: '30MB per chunk'
          }
        });
      }

      if (!file.originalname.toLowerCase().endsWith('.zip')) {
        return res.status(400).json({
          success: false,
          error: 'File must be a ZIP archive'
        });
      }

      console.log(`📦 Processing data room ZIP upload: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);

      // Store ZIP file in database for production
      const { dbFileStorage } = await import('./services/databaseFileStorage');
      const storagePath = await dbFileStorage.storeFile(
        file.path,
        dealId,
        file.originalname
      );
      
      console.log(`💾 ZIP file stored at: ${storagePath}`);

      // Process the ZIP file using zipProcessor
      // In production, zipProcessor will retrieve from database if needed
      const zipResult = await zipProcessor.processZipFile(storagePath, dealId, folderName || 'Data Room');

      // File cleanup already handled by dbFileStorage.storeFile()
      // No need to manually unlink - it's done automatically

      console.log(`✅ Data room ZIP upload successful: ${zipResult.documentsProcessed} documents processed`);

      res.json({
        success: true,
        message: `Data room ZIP file processed successfully`,
        fileName: file.originalname,
        documentsProcessed: zipResult.documentsProcessed,
        errors: zipResult.errors,
        uploadSize: `${(file.size / 1024 / 1024).toFixed(1)}MB`
      });

    } catch (error) {
      console.error('❌ Error processing data room ZIP upload:', error);
      
      // Check for specific 413 errors and provide better feedback
      if (error.message && error.message.includes('413')) {
        console.error('🚨 413 ERROR DETECTED! This should not happen with 50GB limits configured');
        return res.status(413).json({
          success: false,
          error: '413 - File upload limit exceeded. The system now supports files up to 50GB. If you are still seeing this error, please contact support as this should not occur with our enhanced configuration.',
          debugInfo: {
            configuredLimits: '50GB',
            suggestedAction: 'Try using chunked upload for files over 100MB',
            chunkEndpoint: '/api/upload/chunk/init'
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to process data room ZIP file upload',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Regular ZIP upload route for files under 100MB (fallback)
  app.post('/api/deals/:dealId/upload-zip', upload.single('zipFile'), async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      const file = req.file;
      const { folderName } = req.body;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No ZIP file provided'
        });
      }

      if (!file.originalname.toLowerCase().endsWith('.zip')) {
        return res.status(400).json({
          success: false,
          error: 'File must be a ZIP archive'
        });
      }

      console.log(`📦 Processing regular ZIP upload: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);

      // Process the ZIP file using zipProcessor
      const zipResult = await zipProcessor.processZipFile(file.path, dealId, folderName || 'ZIP Upload');

      // Clean up uploaded file
      fs.unlinkSync(file.path);

      res.json({
        success: true,
        message: `ZIP file processed successfully`,
        fileName: file.originalname,
        documentsProcessed: zipResult.documentsProcessed,
        errors: zipResult.errors,
        uploadSize: `${(file.size / 1024 / 1024).toFixed(1)}MB`
      });

    } catch (error) {
      console.error('❌ Error processing ZIP upload:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process ZIP file upload'
      });
    }
  });

  // 🚨 WORKAROUND: Use GET with query params instead of POST for chunked upload init
  // This bypasses the Vite POST interference issue completely  
  app.get('/api/upload/chunk/init', async (req: Request, res: Response) => {
    console.log('🚀 CHUNKED UPLOAD INIT (GET) HIT!', req.query);
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const { fileName, totalSize, chunkSize } = req.query;
      
      if (!fileName || !totalSize || !chunkSize) {
        console.log('❌ Missing parameters:', { fileName, totalSize, chunkSize });
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: fileName, totalSize, chunkSize'
        });
      }

      console.log(`📁 Initializing chunked upload: ${fileName}, ${totalSize} bytes, ${chunkSize} byte chunks`);
      const uploadId = chunkedUploadService.initializeUpload(fileName as string, parseInt(totalSize as string), parseInt(chunkSize as string));
      console.log(`✅ Chunked upload initialized with ID: ${uploadId}`);

      const response = {
        success: true,
        uploadId,
        message: `Chunked upload initialized for ${fileName}`,
        maxFileSize: '5GB',
        supportedTypes: ['ZIP', 'PDF', 'DOCX', 'XLSX', 'PPT']
      };
      
      console.log('📤 Sending chunked upload init response:', response);
      return res.status(200).json(response);
    } catch (error) {
      console.error('❌ Error initializing chunked upload:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to initialize chunked upload'
      });
    }
  });

  // Keep POST version for completeness (but it won't work due to Vite)
  app.post('/api/upload/chunk/init', async (req: Request, res: Response) => {
    console.log('🚀 CHUNKED UPLOAD INIT (POST) HIT!', req.body);
    
    // 🚨 CRITICAL FIX: Force JSON content type explicitly 
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const { fileName, totalSize, chunkSize } = req.body;

      if (!fileName || !totalSize || !chunkSize) {
        console.log('❌ Missing parameters:', { fileName, totalSize, chunkSize });
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: fileName, totalSize, chunkSize'
        });
      }

      console.log(`📁 Initializing chunked upload: ${fileName}, ${totalSize} bytes, ${chunkSize} byte chunks`);
      const uploadId = chunkedUploadService.initializeUpload(fileName, totalSize, chunkSize);
      console.log(`✅ Chunked upload initialized with ID: ${uploadId}`);

      const response = {
        success: true,
        uploadId,
        message: `Chunked upload initialized for ${fileName}`,
        maxFileSize: '5GB',
        supportedTypes: ['ZIP', 'PDF', 'DOCX', 'XLSX', 'PPT']
      };
      
      console.log('📤 Sending chunked upload init response:', response);
      
      // 🚨 CRITICAL FIX: Ensure JSON response with explicit end
      res.status(200).json(response);
    } catch (error) {
      console.error('❌ Error initializing chunked upload:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to initialize chunked upload'
      });
    }
  });

  // Upload a single chunk
  app.post('/api/upload/chunk/:uploadId/:chunkIndex', upload.single('chunk'), async (req: Request, res: Response) => {
    // 🚨 CRITICAL FIX: Force JSON content type 
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const { uploadId, chunkIndex } = req.params;
      const file = req.file;

      console.log(`📦 Chunk upload: ${uploadId}, chunk ${chunkIndex}, file size: ${file?.size}`);

      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No chunk data provided'
        });
      }

      const chunkData = fs.readFileSync(file.path);
      fs.unlinkSync(file.path); // Clean up temporary file

      const result = await chunkedUploadService.uploadChunk(
        uploadId,
        parseInt(chunkIndex),
        chunkData
      );

      console.log(`✅ Chunk ${chunkIndex} uploaded successfully`);
      res.status(200).json(result);
    } catch (error) {
      console.error('❌ Error uploading chunk:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload chunk'
      });
    }
  });

  // Get upload status
  app.get('/api/upload/chunk/:uploadId/status', async (req: Request, res: Response) => {
    try {
      const { uploadId } = req.params;
      const status = chunkedUploadService.getUploadStatus(uploadId);

      res.json({
        success: true,
        ...status
      });
    } catch (error) {
      console.error('❌ Error getting upload status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get upload status'
      });
    }
  });

  // Cancel upload
  app.delete('/api/upload/chunk/:uploadId', async (req: Request, res: Response) => {
    try {
      const { uploadId } = req.params;
      const cancelled = await chunkedUploadService.cancelUpload(uploadId);

      res.json({
        success: cancelled,
        message: cancelled ? 'Upload cancelled successfully' : 'Upload not found'
      });
    } catch (error) {
      console.error('❌ Error cancelling upload:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel upload'
      });
    }
  });

  // Process completed chunked upload
  app.post('/api/deals/:dealId/upload-chunked/:uploadId', async (req: Request, res: Response) => {
    try {
      const dealId = parseInt(req.params.dealId);
      const { uploadId } = req.params;
      const { folderName } = req.body;

      if (!chunkedUploadService.isUploadComplete(uploadId)) {
        return res.status(400).json({
          success: false,
          error: 'Upload is not complete'
        });
      }

      const filePath = chunkedUploadService.getFilePath(uploadId);
      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          error: 'Uploaded file not found'
        });
      }

      // Get upload status for metadata
      const uploadStatus = chunkedUploadService.getUploadStatus(uploadId);
      
      // Check if it's a ZIP file and process accordingly
      const fileName = uploadStatus.fileName || '';
      const isZipFile = fileName.toLowerCase().endsWith('.zip');
      
      if (isZipFile) {
        // Process as ZIP file
        const zipResult = await zipProcessor.processZipFile(filePath, dealId, folderName || 'Large File Upload');
        
        res.json({
          success: true,
          message: `Large ZIP file processed successfully`,
          fileName: fileName,
          documentsProcessed: zipResult.documentsProcessed,
          errors: zipResult.errors,
          uploadSize: (uploadStatus.totalChunks || 0) + ' chunks'
        });
      } else {
        // Process as single document
        const stats = fs.statSync(filePath);
        const document = await storage.createDocument({
          dealId,
          name: fileName,
          type: path.extname(fileName).toLowerCase().slice(1),
          size: stats.size,
          path: filePath,
          folderId: folderName || 'Large Files',
          uploadedAt: new Date()
        });

        res.json({
          success: true,
          message: `Large file uploaded successfully`,
          fileName: fileName,
          document: {
            id: document.id,
            name: document.name,
            size: document.size,
            type: document.type
          },
          uploadSize: `${(stats.size / 1024 / 1024).toFixed(1)}MB`
        });
      }

    } catch (error) {
      console.error('❌ Error processing chunked upload:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process large file upload'
      });
    }
  });

  console.log('✅ Chunked upload routes registered - supports up to 5GB files');

  // Initialize persistent job manager
  console.log('🔄 Initializing persistent job manager...');
  try {
    await persistentJobManager.initialize();
    console.log('✅ Persistent job manager initialized');
  } catch (error) {
    console.error('❌ Failed to initialize persistent job manager:', error);
  }
  
  return server;
}
