import { Router, Request, Response } from 'express';
import founderSuccessService from '../services/founderSuccess';
import dueDiligenceService from '../services/dueDiligence';
import advisoryTeamService from '../services/advisoryTeam';
import workflowAutomationService from '../services/workflowAutomation';
import { storage } from '../storage';
import { z } from 'zod';

const router = Router();

// Validation schemas
const investmentRequestSchema = z.object({
  requestText: z.string().min(10),
  attachments: z.array(z.string()).optional()
});

const founderResponseSchema = z.object({
  requestData: z.any(),
  responseType: z.enum(['rejection', 'more-info', 'follow-up', 'proceed']),
  customContext: z.string().optional()
});

const documentAnalysisSchema = z.object({
  dealId: z.number().int().positive(),
  documentId: z.number().int().positive(),
  agentType: z.enum(['Clinical', 'Legal', 'Commercial', 'HR', 'Financial', 'IP', 'Research'])
});

const investmentTeaserSchema = z.object({
  dealId: z.number().int().positive(),
  includeConfidential: z.boolean().optional()
});

const investorMatchingSchema = z.object({
  dealId: z.number().int().positive(),
  minMatchScore: z.number().min(0).max(100).optional()
});

const investorCommunicationSchema = z.object({
  dealId: z.number().int().positive(),
  investorId: z.number().int().positive(),
  communicationType: z.enum(['initial-outreach', 'follow-up', 'meeting-request'])
});

const automationSchema = z.object({
  name: z.string().min(3),
  description: z.string().min(10),
  trigger: z.string().min(3),
  action: z.string().min(3),
  scope: z.string().min(3),
  isActive: z.boolean().optional()
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

/*
 * Founder Success Team Endpoints
 */

// Evaluate an investment request
router.post('/founder-success/evaluate', async (req: Request, res: Response) => {
  try {
    const result = investmentRequestSchema.safeParse(req.body);
    
    if (!result.success) {
      return handleValidationError(res, result.error);
    }
    
    const evaluation = await founderSuccessService.evaluateInvestmentRequest(
      result.data.requestText,
      result.data.attachments
    );
    
    return res.status(200).json(evaluation);
  } catch (error) {
    console.error('Error evaluating investment request:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Generate a response to a founder
router.post('/founder-success/generate-response', async (req: Request, res: Response) => {
  try {
    const result = founderResponseSchema.safeParse(req.body);
    
    if (!result.success) {
      return handleValidationError(res, result.error);
    }
    
    const response = await founderSuccessService.generateFounderResponse(
      result.data.requestData,
      result.data.responseType,
      result.data.customContext
    );
    
    return res.status(200).json({ response });
  } catch (error) {
    console.error('Error generating founder response:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Create a deal record from analyzed request
router.post('/founder-success/create-deal', async (req: Request, res: Response) => {
  try {
    const dealId = await founderSuccessService.createDealRecord(req.body);
    return res.status(201).json({ dealId });
  } catch (error) {
    console.error('Error creating deal record:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Determine routing assignment for a deal
router.post('/founder-success/determine-routing', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.body.dealId);
    if (isNaN(dealId)) {
      return res.status(400).json({ message: 'Invalid deal ID' });
    }
    
    const deal = await storage.getDealById(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    const assignment = await founderSuccessService.determineRoutingAssignment(deal);
    return res.status(200).json(assignment);
  } catch (error) {
    console.error('Error determining routing assignment:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/*
 * Due Diligence Team Endpoints
 */

// Get available agent types for due diligence
router.get('/due-diligence/agent-types', (req: Request, res: Response) => {
  try {
    return res.status(200).json({ 
      agentTypes: Object.keys(dueDiligenceService.agentSpecialties),
      agentInfo: dueDiligenceService.agentSpecialties
    });
  } catch (error) {
    console.error('Error getting agent types:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Analyze a document
router.post('/due-diligence/analyze-document', async (req: Request, res: Response) => {
  try {
    const result = documentAnalysisSchema.safeParse(req.body);
    
    if (!result.success) {
      return handleValidationError(res, result.error);
    }
    
    const { dealId, documentId, agentType } = result.data;
    
    // Get the document content
    const document = await storage.getDocumentById(documentId);
    if (!document || document.dealId !== dealId) {
      return res.status(404).json({ message: 'Document not found or not associated with this deal' });
    }
    
    // Get document content (in a real system, this would fetch from a file storage service)
    const documentContent = `Sample content for document ${document.name}. This is where the actual document text would go.`;
    
    // Analyze the document
    const analysis = await dueDiligenceService.analyzeDocument(
      documentContent,
      document.type,
      agentType
    );
    
    // Create a database record for this analysis
    const analysisId = await dueDiligenceService.createAgentAnalysis(dealId, agentType, analysis);
    
    // Update the status to reflect completion
    await dueDiligenceService.updateAnalysisProgress(analysisId, 100, "Complete");
    
    return res.status(200).json({ analysisId, ...analysis });
  } catch (error) {
    console.error('Error analyzing document:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Generate a comprehensive due diligence report
router.post('/due-diligence/generate-report/:dealId', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    if (isNaN(dealId)) {
      return res.status(400).json({ message: 'Invalid deal ID' });
    }
    
    const includeAgentTypes = req.body.includeAgentTypes || undefined;
    
    const report = await dueDiligenceService.generateDueDiligenceReport(dealId, includeAgentTypes);
    return res.status(200).json(report);
  } catch (error) {
    console.error('Error generating due diligence report:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/*
 * Advisory Team Endpoints
 */

// Generate an investment teaser
router.post('/advisory/generate-teaser', async (req: Request, res: Response) => {
  try {
    const result = investmentTeaserSchema.safeParse(req.body);
    
    if (!result.success) {
      return handleValidationError(res, result.error);
    }
    
    const teaser = await advisoryTeamService.generateInvestmentTeaser(
      result.data.dealId,
      result.data.includeConfidential
    );
    
    return res.status(200).json(teaser);
  } catch (error) {
    console.error('Error generating investment teaser:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Match investors for a deal
router.post('/advisory/match-investors', async (req: Request, res: Response) => {
  try {
    const result = investorMatchingSchema.safeParse(req.body);
    
    if (!result.success) {
      return handleValidationError(res, result.error);
    }
    
    const matches = await advisoryTeamService.matchInvestorsForDeal(
      result.data.dealId,
      result.data.minMatchScore
    );
    
    // Save matches to database
    await advisoryTeamService.saveInvestorMatches(result.data.dealId, matches);
    
    return res.status(200).json({ matches });
  } catch (error) {
    console.error('Error matching investors:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Generate investor communication
router.post('/advisory/generate-communication', async (req: Request, res: Response) => {
  try {
    const result = investorCommunicationSchema.safeParse(req.body);
    
    if (!result.success) {
      return handleValidationError(res, result.error);
    }
    
    const communication = await advisoryTeamService.generateInvestorCommunication(
      result.data.dealId,
      result.data.investorId,
      result.data.communicationType
    );
    
    return res.status(200).json(communication);
  } catch (error) {
    console.error('Error generating investor communication:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/*
 * Workflow Automation Endpoints
 */

// Create a new automation
router.post('/automation/create', async (req: Request, res: Response) => {
  try {
    const result = automationSchema.safeParse(req.body);
    
    if (!result.success) {
      return handleValidationError(res, result.error);
    }
    
    const automationId = await workflowAutomationService.createAutomation(
      result.data.name,
      result.data.description,
      result.data.trigger,
      result.data.action,
      result.data.scope,
      result.data.isActive
    );
    
    return res.status(201).json({ automationId });
  } catch (error) {
    console.error('Error creating automation:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Toggle an automation's active status
router.post('/automation/toggle/:id', async (req: Request, res: Response) => {
  try {
    const automationId = parseInt(req.params.id);
    if (isNaN(automationId)) {
      return res.status(400).json({ message: 'Invalid automation ID' });
    }
    
    const isActive = await workflowAutomationService.toggleAutomation(automationId);
    return res.status(200).json({ id: automationId, isActive });
  } catch (error) {
    console.error('Error toggling automation:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Get recommended automations
router.get('/automation/recommend', async (req: Request, res: Response) => {
  try {
    const dealCount = parseInt(req.query.dealCount as string) || 5;
    const activeDuration = parseInt(req.query.activeDuration as string) || 30;
    
    const recommendations = await workflowAutomationService.recommendAutomations(dealCount, activeDuration);
    return res.status(200).json({ recommendations });
  } catch (error) {
    console.error('Error getting automation recommendations:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;