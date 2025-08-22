// 🎯 CRITICAL: Persistent Upload API Routes
// Provides endpoints for managing uploads that persist across page navigation

import { Router } from 'express';
import { persistentUploadService } from '../services/persistentUploadService';
import type { Request, Response } from 'express';

const router = Router();

// Create new persistent upload session
router.post('/api/persistent-uploads/create', async (req: Request, res: Response) => {
  try {
    console.log(`🎯 Creating persistent upload session from frontend`);
    
    const sessionData = req.body;
    const session = await persistentUploadService.createSession(sessionData);
    
    console.log(`✅ Created persistent upload session: ${session.sessionId}`);
    
    res.json({
      success: true,
      session
    });
    
  } catch (error) {
    console.error('❌ Error creating persistent upload session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create persistent upload session'
    });
  }
});

// Get all persistent upload sessions for a deal
router.get('/api/deals/:dealId/persistent-uploads', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    console.log(`📋 Getting persistent uploads for deal ${dealId}`);
    
    // Get all sessions (active, processing, completed)
    const allSessions = await persistentUploadService.getAllSessionsForDeal(dealId);
    const activeSessions = await persistentUploadService.getActiveSessionsForDeal(dealId);
    const processingSessions = await persistentUploadService.getProcessingSessionsForDeal(dealId);
    
    console.log(`📊 Found ${allSessions.length} total, ${activeSessions.length} active, ${processingSessions.length} processing uploads`);
    
    res.json({
      success: true,
      uploads: {
        all: allSessions,
        active: activeSessions,
        processing: processingSessions,
        totalCount: allSessions.length,
        activeCount: activeSessions.length,
        processingCount: processingSessions.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting persistent uploads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get persistent uploads'
    });
  }
});

// Get all global persistent upload sessions (across all deals)
router.get('/api/persistent-uploads/global', async (req: Request, res: Response) => {
  try {
    console.log(`🌐 Getting all global persistent uploads`);
    
    const activeSessions = await persistentUploadService.getAllActiveSessions();
    
    console.log(`📊 Found ${activeSessions.length} active uploads globally`);
    
    res.json({
      success: true,
      uploads: activeSessions,
      totalCount: activeSessions.length
    });
    
  } catch (error) {
    console.error('❌ Error getting global persistent uploads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get global persistent uploads'
    });
  }
});

// Get specific upload session by ID
router.get('/api/persistent-uploads/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    console.log(`🔍 Getting persistent upload session: ${sessionId}`);
    
    const session = await persistentUploadService.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Upload session not found'
      });
    }
    
    console.log(`✅ Found upload session: ${session.fileName} (${session.status})`);
    
    res.json({
      success: true,
      session
    });
    
  } catch (error) {
    console.error('❌ Error getting persistent upload session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get upload session'
    });
  }
});

// Update upload session progress (used by upload handlers)
router.patch('/api/persistent-uploads/:sessionId/progress', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { progress, uploadedBytes, currentStep } = req.body;
    
    console.log(`📈 Updating upload progress: ${sessionId} -> ${progress}%`);
    
    await persistentUploadService.updateProgress(
      sessionId, 
      progress, 
      uploadedBytes, 
      currentStep
    );
    
    res.json({
      success: true,
      message: 'Progress updated successfully'
    });
    
  } catch (error) {
    console.error('❌ Error updating upload progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update progress'
    });
  }
});

// Update upload session status (used by upload handlers)
router.patch('/api/persistent-uploads/:sessionId/status', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { status, errorMessage, jobId, gcsPath } = req.body;
    
    console.log(`🔄 Updating upload status: ${sessionId} -> ${status}`);
    
    await persistentUploadService.updateStatus(
      sessionId, 
      status, 
      errorMessage,
      jobId,
      gcsPath
    );
    
    res.json({
      success: true,
      message: 'Status updated successfully'
    });
    
  } catch (error) {
    console.error('❌ Error updating upload status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update status'
    });
  }
});

// Clean up old upload sessions
router.post('/api/persistent-uploads/cleanup', async (req: Request, res: Response) => {
  try {
    const { olderThanDays = 7 } = req.body;
    
    console.log(`🧹 Cleaning up upload sessions older than ${olderThanDays} days`);
    
    await persistentUploadService.cleanupOldSessions(olderThanDays);
    
    res.json({
      success: true,
      message: `Cleaned up old upload sessions successfully`
    });
    
  } catch (error) {
    console.error('❌ Error cleaning up upload sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup upload sessions'
    });
  }
});

// Check for stuck uploads and mark them as failed
router.post('/api/persistent-uploads/check-stuck', async (req: Request, res: Response) => {
  try {
    console.log(`🔍 Checking for stuck upload sessions`);
    
    await persistentUploadService.checkForStuckUploads();
    
    res.json({
      success: true,
      message: 'Checked for stuck uploads successfully'
    });
    
  } catch (error) {
    console.error('❌ Error checking stuck uploads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check stuck uploads'
    });
  }
});

export default router;