/**
 * Unified Agent Analysis Routes
 * Provides API endpoints for the unified agent architecture
 */

import { Router } from 'express';
import { unifiedAgentManager } from '../services/persistentUnifiedAgentService';
import { z } from 'zod';

const router = Router();

// Schema validation
const startAnalysisSchema = z.object({
  dealId: z.number(),
  forceRerun: z.boolean().optional().default(false),
});

const agentTypeSchema = z.enum(['legal', 'clinical', 'commercial', 'hr', 'financial', 'ip', 'research']);

/**
 * POST /api/unified/agents/:agentType/analyze
 * Start or resume analysis for a specific agent type
 */
router.post('/api/unified/agents/:agentType/analyze', async (req, res) => {
  try {
    const agentType = agentTypeSchema.parse(req.params.agentType);
    const { dealId, forceRerun } = startAnalysisSchema.parse(req.body);
    
    console.log(`🚀 Starting unified ${agentType} analysis for deal ${dealId}`);
    
    const result = await unifiedAgentManager.startAnalysis(dealId, agentType, forceRerun);
    
    res.json(result);
  } catch (error: any) {
    console.error(`❌ Failed to start unified analysis:`, error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/unified/agents/:agentType/status/:dealId
 * Get status of analysis for a specific agent type and deal
 */
router.get('/api/unified/agents/:agentType/status/:dealId', async (req, res) => {
  try {
    const agentType = agentTypeSchema.parse(req.params.agentType);
    const dealId = parseInt(req.params.dealId, 10);
    
    if (isNaN(dealId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid deal ID',
      });
    }
    
    const status = await unifiedAgentManager.getStatus(dealId, agentType);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'No analysis found',
      });
    }
    
    res.json({
      success: true,
      status,
    });
  } catch (error: any) {
    console.error(`❌ Failed to get unified status:`, error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid agent type',
        details: error.errors,
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/unified/agents/:agentType/results/:dealId
 * Get results of analysis for a specific agent type and deal
 */
router.get('/api/unified/agents/:agentType/results/:dealId', async (req, res) => {
  try {
    const agentType = agentTypeSchema.parse(req.params.agentType);
    const dealId = parseInt(req.params.dealId, 10);
    
    if (isNaN(dealId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid deal ID',
      });
    }
    
    const results = await unifiedAgentManager.getResults(dealId, agentType);
    
    if (!results.run) {
      return res.status(404).json({
        success: false,
        message: 'No analysis found',
      });
    }
    
    res.json({
      success: true,
      ...results,
    });
  } catch (error: any) {
    console.error(`❌ Failed to get unified results:`, error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid agent type',
        details: error.errors,
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * DELETE /api/unified/agents/:agentType/analysis/:dealId
 * Delete analysis for a specific agent type and deal (for reruns)
 */
router.delete('/api/unified/agents/:agentType/analysis/:dealId', async (req, res) => {
  try {
    const agentType = agentTypeSchema.parse(req.params.agentType);
    const dealId = parseInt(req.params.dealId, 10);
    
    if (isNaN(dealId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid deal ID',
      });
    }
    
    const success = await unifiedAgentManager.deleteAnalysis(dealId, agentType);
    
    res.json({
      success,
      message: success ? 'Analysis deleted successfully' : 'No analysis found to delete',
    });
  } catch (error: any) {
    console.error(`❌ Failed to delete unified analysis:`, error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid agent type',
        details: error.errors,
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * POST /api/unified/agents/:agentType/cancel/:dealId
 * Cancel running analysis for a specific agent type and deal
 */
router.post('/api/unified/agents/:agentType/cancel/:dealId', async (req, res) => {
  try {
    const agentType = agentTypeSchema.parse(req.params.agentType);
    const dealId = parseInt(req.params.dealId, 10);
    
    if (isNaN(dealId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid deal ID',
      });
    }
    
    const success = await unifiedAgentManager.cancelAnalysis(dealId, agentType);
    
    res.json({
      success,
      message: success ? 'Analysis cancelled successfully' : 'No running analysis found',
    });
  } catch (error: any) {
    console.error(`❌ Failed to cancel unified analysis:`, error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid agent type',
        details: error.errors,
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * POST /api/unified/agents/all/analyze
 * Start analysis for all agent types
 */
router.post('/api/unified/agents/all/analyze', async (req, res) => {
  try {
    const { dealId, forceRerun } = startAnalysisSchema.parse(req.body);
    
    console.log(`🚀 Starting unified analysis for all agents on deal ${dealId}`);
    
    const results = await unifiedAgentManager.startAllAnalyses(dealId, forceRerun);
    
    // Convert Map to object for JSON serialization
    const resultsObject: Record<string, any> = {};
    results.forEach((value, key) => {
      resultsObject[key] = value;
    });
    
    res.json({
      success: true,
      results: resultsObject,
    });
  } catch (error: any) {
    console.error(`❌ Failed to start all unified analyses:`, error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/unified/agents/all/status/:dealId
 * Get status for all agent types
 */
router.get('/api/unified/agents/all/status/:dealId', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId, 10);
    
    if (isNaN(dealId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid deal ID',
      });
    }
    
    const statuses = await unifiedAgentManager.getAllStatuses(dealId);
    
    // Convert Map to object for JSON serialization
    const statusesObject: Record<string, any> = {};
    statuses.forEach((value, key) => {
      statusesObject[key] = value;
    });
    
    res.json({
      success: true,
      statuses: statusesObject,
    });
  } catch (error: any) {
    console.error(`❌ Failed to get all unified statuses:`, error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

export default router;