import { Router, Request, Response } from 'express';
import { unifiedDocumentProcessor } from '../services/unifiedDocumentProcessor';
import { storage } from '../storage';

const router = Router();

// Start unified analysis for all documents and all agent types
router.post('/api/deals/:dealId/unified-analysis', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    if (isNaN(dealId)) {
      return res.status(400).json({ success: false, error: 'Invalid deal ID' });
    }

    console.log(`🚀 Starting unified analysis for deal ${dealId}`);

    // Check if deal exists
    const deal = await storage.getDealById(dealId);
    if (!deal) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    // Start unified processing
    const jobId = await unifiedDocumentProcessor.startUnifiedProcessing(dealId);

    res.json({
      success: true,
      message: 'Unified analysis started successfully',
      jobId,
      dealId
    });

  } catch (error) {
    console.error('❌ Error starting unified analysis:', error);
    
    if (error.message.includes('already running')) {
      return res.status(409).json({ 
        success: false, 
        error: 'Analysis already in progress for this deal',
        alreadyRunning: true
      });
    }

    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to start unified analysis' 
    });
  }
});

// Get unified analysis progress
router.get('/api/deals/:dealId/unified-analysis/progress', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    if (isNaN(dealId)) {
      return res.status(400).json({ success: false, error: 'Invalid deal ID' });
    }

    const jobStatus = unifiedDocumentProcessor.getJobStatus(dealId);
    
    if (!jobStatus) {
      return res.json({
        success: true,
        isRunning: false,
        progress: 0,
        message: 'No unified analysis currently running'
      });
    }

    res.json({
      success: true,
      isRunning: jobStatus.status === 'processing',
      progress: jobStatus.progress,
      currentStep: `Processing ${jobStatus.currentDocument} (${jobStatus.processedDocuments}/${jobStatus.totalDocuments})`,
      processedDocuments: jobStatus.processedDocuments,
      totalDocuments: jobStatus.totalDocuments,
      status: jobStatus.status,
      startTime: jobStatus.startTime
    });

  } catch (error) {
    console.error('❌ Error getting unified analysis progress:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get analysis progress' 
    });
  }
});

// Cancel unified analysis
router.post('/api/deals/:dealId/unified-analysis/cancel', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    if (isNaN(dealId)) {
      return res.status(400).json({ success: false, error: 'Invalid deal ID' });
    }

    const cancelled = await unifiedDocumentProcessor.cancelJob(dealId);
    
    if (!cancelled) {
      return res.status(404).json({ 
        success: false, 
        error: 'No active analysis found for this deal' 
      });
    }

    res.json({
      success: true,
      message: 'Unified analysis cancelled successfully'
    });

  } catch (error) {
    console.error('❌ Error cancelling unified analysis:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to cancel analysis' 
    });
  }
});

export default router;