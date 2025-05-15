import express, { Request, Response } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { 
  evaluateInvestmentRequest,
  generateFounderResponse,
  createDealRecord,
  determineRoutingAssignment
} from '../services/founderSuccess';
import {
  analyzeDocument as analyzeDocumentDueDiligence,
  createAgentAnalysis,
  updateAnalysisProgress,
  generateDueDiligenceReport,
  type AgentType
} from '../services/dueDiligence';
import {
  generateInvestmentTeaser,
  matchInvestorsForDeal,
  saveInvestorMatches,
  generateInvestorCommunication
} from '../services/advisoryTeam';
import {
  createAutomation,
  toggleAutomation,
  recommendAutomations
} from '../services/workflowAutomation';

const router = express.Router();

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

// Founder Success Team routes

/**
 * Evaluates an investment request using AI
 */
router.post('/founder-success/evaluate', async (req: Request, res: Response) => {
  try {
    const { requestData } = req.body;
    
    if (!requestData) {
      return res.status(400).json({ message: 'Request data is required' });
    }
    
    const evaluation = await evaluateInvestmentRequest(requestData);
    return res.status(200).json(evaluation);
  } catch (error) {
    console.error('Error evaluating investment request:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * Generates a response to a founder
 */
router.post('/founder-success/generate-response', async (req: Request, res: Response) => {
  try {
    const { requestAnalysis, requestData } = req.body;
    
    if (!requestAnalysis || !requestData) {
      return res.status(400).json({ message: 'Request analysis and data are required' });
    }
    
    const response = await generateFounderResponse(requestAnalysis, requestData);
    return res.status(200).json({ response });
  } catch (error) {
    console.error('Error generating founder response:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * Creates a deal in the database
 */
router.post('/founder-success/create-deal', async (req: Request, res: Response) => {
  try {
    const { requestAnalysis } = req.body;
    
    if (!requestAnalysis) {
      return res.status(400).json({ message: 'Request analysis is required' });
    }
    
    const dealId = await createDealRecord(requestAnalysis);
    return res.status(200).json({ dealId });
  } catch (error) {
    console.error('Error creating deal record:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * Determines routing for a deal
 */
router.post('/founder-success/determine-routing', async (req: Request, res: Response) => {
  try {
    const { dealData } = req.body;
    
    if (!dealData) {
      return res.status(400).json({ message: 'Deal data is required' });
    }
    
    const routingAssignment = await determineRoutingAssignment(dealData);
    return res.status(200).json(routingAssignment);
  } catch (error) {
    console.error('Error determining routing assignment:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Due Diligence Team routes

/**
 * Returns the types of due diligence agents available
 */
router.get('/due-diligence/agent-types', (req: Request, res: Response) => {
  const agentTypes: AgentType[] = ['Clinical', 'Legal', 'Commercial', 'HR', 'Financial', 'IP', 'Research'];
  
  const agentInfo = {
    'Clinical': {
      focusAreas: [
        'Clinical study protocols and outcomes',
        'Patient data and safety profiles',
        'Regulatory approvals and compliance',
        'Therapeutic efficacy',
        'Clinical development roadmap'
      ]
    },
    'Legal': {
      focusAreas: [
        'Contracts and agreements',
        'Regulatory compliance',
        'Intellectual property claims',
        'Litigation risks',
        'Corporate structure and governance'
      ]
    },
    'Commercial': {
      focusAreas: [
        'Market size and trends',
        'Competitive landscape',
        'Go-to-market strategy',
        'Pricing models',
        'Distribution channels'
      ]
    },
    'HR': {
      focusAreas: [
        'Team credentials and expertise',
        'Leadership capabilities',
        'Culture and talent retention',
        'Compensation structures',
        'Key person dependencies'
      ]
    },
    'Financial': {
      focusAreas: [
        'Financial statements and projections',
        'Cash flow and burn rate',
        'Funding history and capitalization',
        'Revenue models',
        'Tax compliance'
      ]
    },
    'IP': {
      focusAreas: [
        'Patent portfolio',
        'Freedom to operate',
        'IP strategy',
        'Licensing agreements',
        'Trade secrets protection'
      ]
    },
    'Research': {
      focusAreas: [
        'Scientific basis and novelty',
        'Research methodologies',
        'Data quality and reproducibility',
        'Future research directions',
        'Technological moat'
      ]
    }
  };
  
  return res.status(200).json({ agentTypes, agentInfo });
});

/**
 * Analyzes a document using AI
 */
router.post('/due-diligence/analyze-document', async (req: Request, res: Response) => {
  try {
    const { dealId, documentId, agentType } = req.body;
    
    if (!dealId || !documentId || !agentType) {
      return res.status(400).json({ message: 'Deal ID, document ID, and agent type are required' });
    }
    
    // Get the document
    const document = await storage.getDocumentById(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Create initial analysis record
    const analysis = await createAgentAnalysis({
      dealId,
      agentType,
      status: 'In Progress',
      progress: 10
    });
    
    // Start the analysis process (this would typically be done asynchronously)
    // For demonstration purposes, we're doing it synchronously
    try {
      // Update document status
      await storage.updateDocumentStatus(documentId, 'Analyzing');
      
      // Start the analysis
      const analysisResults = await analyzeDocumentDueDiligence(document.content, agentType);
      
      // Update the analysis with findings
      await updateAnalysisProgress(analysis.id, {
        status: 'Complete',
        progress: 100,
        findings: analysisResults.findings,
        recommendations: analysisResults.recommendations
      });
      
      // Update document status
      await storage.updateDocumentStatus(documentId, 'Analyzed');
      
      return res.status(200).json({ 
        success: true, 
        message: 'Document analysis started',
        analysisId: analysis.id
      });
    } catch (analysisError) {
      console.error('Error during document analysis:', analysisError);
      
      // Update the analysis as failed
      await updateAnalysisProgress(analysis.id, {
        status: 'Failed',
        progress: 0
      });
      
      // Update document status
      await storage.updateDocumentStatus(documentId, 'Not Analyzed');
      
      return res.status(500).json({ message: 'Error analyzing document' });
    }
  } catch (error) {
    console.error('Error initiating document analysis:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * Generates a comprehensive due diligence report
 */
router.post('/due-diligence/generate-report/:dealId', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const { includeAgentTypes } = req.body;
    
    if (isNaN(dealId)) {
      return res.status(400).json({ message: 'Invalid deal ID' });
    }
    
    // Get all analyses for the deal
    const analyses = await storage.getAnalysesByDealId(dealId);
    
    // Filter by completed status and requested agent types
    const completedAnalyses = analyses.filter(analysis => 
      analysis.status === 'Complete' && 
      (!includeAgentTypes || includeAgentTypes.includes(analysis.agentType))
    );
    
    if (completedAnalyses.length === 0) {
      return res.status(400).json({ message: 'No completed analyses found for report generation' });
    }
    
    // Get deal details
    const deal = await storage.getDealById(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Generate a comprehensive report
    const report = await generateDueDiligenceReport(deal, completedAnalyses);
    
    // Create or update investment memo
    const existingMemo = await storage.getMemoByDealId(dealId);
    
    if (existingMemo) {
      await storage.updateMemo(existingMemo.id, {
        ...report,
        status: 'Draft'
      });
      
      return res.status(200).json({
        success: true,
        memoId: existingMemo.id,
        message: 'Report generated and investment memo updated'
      });
    } else {
      const memo = await storage.createInvestmentMemo({
        dealId,
        ...report,
        status: 'Draft'
      });
      
      return res.status(200).json({
        success: true,
        memoId: memo.id,
        message: 'Report generated and new investment memo created'
      });
    }
  } catch (error) {
    console.error('Error generating due diligence report:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Advisory Team routes

/**
 * Generates an investment teaser
 */
router.post('/advisory/generate-teaser', async (req: Request, res: Response) => {
  try {
    const { dealId, includeConfidential } = req.body;
    
    if (!dealId) {
      return res.status(400).json({ message: 'Deal ID is required' });
    }
    
    // Get deal details
    const deal = await storage.getDealById(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Get analyses for the deal
    const analyses = await storage.getAnalysesByDealId(dealId);
    
    // Generate the teaser
    const teaser = await generateInvestmentTeaser(deal, analyses, includeConfidential);
    
    return res.status(200).json({
      success: true,
      teaser
    });
  } catch (error) {
    console.error('Error generating investment teaser:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * Matches investors to a deal
 */
router.post('/advisory/match-investors', async (req: Request, res: Response) => {
  try {
    const { dealId, minMatchScore = 70 } = req.body;
    
    if (!dealId) {
      return res.status(400).json({ message: 'Deal ID is required' });
    }
    
    // Get deal details
    const deal = await storage.getDealById(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Get all investors
    const investors = await storage.getAllInvestors();
    
    // Match investors to the deal
    const matches = await matchInvestorsForDeal(deal, investors, minMatchScore);
    
    // Save matches to the database
    await saveInvestorMatches(dealId, matches);
    
    return res.status(200).json({
      success: true,
      matchCount: matches.length
    });
  } catch (error) {
    console.error('Error matching investors:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * Generates investor communication
 */
router.post('/advisory/generate-communication', async (req: Request, res: Response) => {
  try {
    const { dealId, investorId, communicationType } = req.body;
    
    if (!dealId || !investorId || !communicationType) {
      return res.status(400).json({ 
        message: 'Deal ID, investor ID, and communication type are required' 
      });
    }
    
    // Get deal details
    const deal = await storage.getDealById(dealId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Get investor details
    const investor = await storage.getInvestorById(investorId);
    if (!investor) {
      return res.status(404).json({ message: 'Investor not found' });
    }
    
    // Get match details
    const matches = await storage.getInvestorMatchesByDealId(dealId);
    const investorMatch = matches.find(match => match.investorId === investorId);
    
    if (!investorMatch) {
      return res.status(404).json({ message: 'Investor match not found' });
    }
    
    // Generate the communication
    const communication = await generateInvestorCommunication(
      deal,
      investor,
      investorMatch,
      communicationType
    );
    
    return res.status(200).json({
      success: true,
      communication
    });
  } catch (error) {
    console.error('Error generating investor communication:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Workflow Automation routes

/**
 * Creates a new automation rule
 */
router.post('/automation/create', async (req: Request, res: Response) => {
  try {
    const { name, description, trigger, action, scope, isActive = false } = req.body;
    
    if (!name || !description || !trigger || !action || !scope) {
      return res.status(400).json({ 
        message: 'Name, description, trigger, action, and scope are required' 
      });
    }
    
    // Create the automation
    const automation = await createAutomation({
      name,
      description,
      trigger,
      action,
      scope,
      isActive
    });
    
    return res.status(200).json({
      success: true,
      automation
    });
  } catch (error) {
    console.error('Error creating automation:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * Toggles an automation's active status
 */
router.post('/automation/toggle/:id', async (req: Request, res: Response) => {
  try {
    const automationId = parseInt(req.params.id);
    
    if (isNaN(automationId)) {
      return res.status(400).json({ message: 'Invalid automation ID' });
    }
    
    // Get the automation
    const automation = await storage.getAutomationById(automationId);
    if (!automation) {
      return res.status(404).json({ message: 'Automation not found' });
    }
    
    // Toggle the automation
    const success = await toggleAutomation(automationId);
    
    if (success) {
      const updatedAutomation = await storage.getAutomationById(automationId);
      return res.status(200).json({
        success: true,
        isActive: updatedAutomation?.isActive
      });
    } else {
      return res.status(500).json({ message: 'Failed to toggle automation' });
    }
  } catch (error) {
    console.error('Error toggling automation:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * Recommends automations based on team behavior
 */
router.get('/automation/recommend', async (req: Request, res: Response) => {
  try {
    // Get all deals, documents, analyses, and automations
    const deals = await storage.getAllDeals();
    const documents = await storage.getAllDocuments();
    const analyses = await storage.getAllAnalyses();
    const existingAutomations = await storage.getAllAutomations();
    
    // Generate recommendations
    const recommendations = await recommendAutomations(
      deals,
      documents,
      analyses,
      existingAutomations
    );
    
    return res.status(200).json({
      success: true,
      recommendations
    });
  } catch (error) {
    console.error('Error recommending automations:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;