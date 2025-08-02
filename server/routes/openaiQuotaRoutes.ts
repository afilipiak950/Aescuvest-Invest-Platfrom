import { Router } from 'express';
import { openaiQuotaManager } from '../services/openaiQuotaManager';

const router = Router();

// Get current quota status and health
router.get('/openai-quota-status', (req, res) => {
  try {
    const status = {
      quotaStatus: openaiQuotaManager.getQuotaStatus(),
      failedRequestCount: openaiQuotaManager.getFailedRequestCount(),
      isHealthy: openaiQuotaManager.isHealthy(),
      timestamp: new Date().toISOString()
    };
    
    res.json(status);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get quota status',
      message: error.message 
    });
  }
});

// Reset quota manager state
router.post('/openai-quota-reset', (req, res) => {
  try {
    openaiQuotaManager.reset();
    res.json({ 
      message: 'Quota manager reset successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to reset quota manager',
      message: error.message 
    });
  }
});

export { router as openaiQuotaRoutes };