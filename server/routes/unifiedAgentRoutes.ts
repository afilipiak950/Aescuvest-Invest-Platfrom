import { Router } from 'express';
import { persistentUnifiedAgentService } from '../services/persistentUnifiedAgentService';

const router = Router();

// Get status for all agents for a deal
router.get('/api/unified/agents/all/status/:dealId', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    if (isNaN(dealId)) {
      return res.status(400).json({ success: false, error: 'Invalid deal ID' });
    }

    const statuses = await persistentUnifiedAgentService.getAllAgentStatuses(dealId);
    res.json({ success: true, statuses });
  } catch (error) {
    console.error('Error getting all agent statuses:', error);
    res.status(500).json({ success: false, error: 'Failed to get agent statuses' });
  }
});

// Start analysis for all agents
router.post('/api/unified/agents/all/analyze', async (req, res) => {
  try {
    const { dealId, forceRerun = false } = req.body;
    if (!dealId || isNaN(dealId)) {
      return res.status(400).json({ success: false, error: 'Invalid deal ID' });
    }

    const results = await persistentUnifiedAgentService.startAllAnalyses(dealId, forceRerun);
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error starting all analyses:', error);
    res.status(500).json({ success: false, error: 'Failed to start all analyses' });
  }
});

// Get analysis results for a specific agent
router.get('/api/unified/agents/:agentType/:dealId', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const agentType = req.params.agentType;
    
    if (isNaN(dealId)) {
      return res.status(400).json({ success: false, error: 'Invalid deal ID' });
    }

    const analysis = await persistentUnifiedAgentService.getAgentAnalysis(dealId, agentType);
    res.json({ success: true, analysis });
  } catch (error) {
    console.error(`Error getting ${req.params.agentType} analysis:`, error);
    res.status(500).json({ success: false, error: `Failed to get ${req.params.agentType} analysis` });
  }
});

// Start analysis for a specific agent
router.post('/api/unified/agents/:agentType/:dealId/analyze', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const agentType = req.params.agentType;
    const { forceRerun = false } = req.body;
    
    if (isNaN(dealId)) {
      return res.status(400).json({ success: false, error: 'Invalid deal ID' });
    }

    const result = await persistentUnifiedAgentService.startAgentAnalysis(dealId, agentType, forceRerun);
    res.json({ success: true, result });
  } catch (error) {
    console.error(`Error starting ${req.params.agentType} analysis:`, error);
    res.status(500).json({ success: false, error: `Failed to start ${req.params.agentType} analysis` });
  }
});

export default router;