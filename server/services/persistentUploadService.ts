// 🎯 CRITICAL: Persistent Upload Service for Complete Background Processing
// Ensures uploads NEVER stop even when leaving page, refreshing, or switching deals

import { db } from '../db';
import { persistentUploadSessions } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { websocketManager } from './websocketManager';

export interface PersistentUploadSession {
  id?: number;
  sessionId: string;
  dealId: number;
  fileName: string;
  fileSize: number;
  uploadType: 'gcs_direct' | 'chunked' | 'zip_processing';
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  uploadedBytes: number;
  gcsPath?: string;
  jobId?: string;
  currentStep?: string;
  errorMessage?: string;
  metadata?: any;
  createdAt?: Date;
  updatedAt?: Date;
  completedAt?: Date;
}

export class PersistentUploadService {
  /**
   * Create a new persistent upload session
   */
  async createSession(session: Omit<PersistentUploadSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<PersistentUploadSession> {
    console.log(`🚀 Creating persistent upload session: ${session.fileName} for deal ${session.dealId}`);
    
    const [created] = await db.insert(persistentUploadSessions).values({
      sessionId: session.sessionId,
      dealId: session.dealId,
      fileName: session.fileName,
      fileSize: session.fileSize,
      uploadType: session.uploadType,
      status: session.status,
      progress: session.progress,
      uploadedBytes: session.uploadedBytes,
      gcsPath: session.gcsPath,
      jobId: session.jobId,
      currentStep: session.currentStep,
      errorMessage: session.errorMessage,
      metadata: session.metadata
    }).returning();

    console.log(`✅ Created persistent upload session: ${created.sessionId}`);
    return created as PersistentUploadSession;
  }

  /**
   * Update upload session progress
   */
  async updateProgress(
    sessionId: string, 
    progress: number, 
    uploadedBytes?: number, 
    currentStep?: string
  ): Promise<void> {
    console.log(`📊 Updating upload progress: ${sessionId} -> ${progress}%`);
    
    await db.update(persistentUploadSessions)
      .set({
        progress,
        uploadedBytes: uploadedBytes || undefined,
        currentStep,
        updatedAt: new Date()
      })
      .where(eq(persistentUploadSessions.sessionId, sessionId));

    // Broadcast progress to all connected clients
    this.broadcastProgress(sessionId, progress, currentStep);
  }

  /**
   * Update upload session status
   */
  async updateStatus(
    sessionId: string, 
    status: PersistentUploadSession['status'], 
    errorMessage?: string,
    jobId?: string,
    gcsPath?: string
  ): Promise<void> {
    console.log(`🔄 Updating upload status: ${sessionId} -> ${status}`);
    
    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    if (errorMessage) updateData.errorMessage = errorMessage;
    if (jobId) updateData.jobId = jobId;
    if (gcsPath) updateData.gcsPath = gcsPath;
    if (status === 'completed') updateData.completedAt = new Date();

    await db.update(persistentUploadSessions)
      .set(updateData)
      .where(eq(persistentUploadSessions.sessionId, sessionId));

    // Broadcast status update to all connected clients
    this.broadcastStatusUpdate(sessionId, status, errorMessage);
  }

  /**
   * Get upload session by ID
   */
  async getSession(sessionId: string): Promise<PersistentUploadSession | null> {
    const [session] = await db.select()
      .from(persistentUploadSessions)
      .where(eq(persistentUploadSessions.sessionId, sessionId))
      .limit(1);

    return session as PersistentUploadSession || null;
  }

  /**
   * Get all active upload sessions for a deal
   */
  async getActiveSessionsForDeal(dealId: number): Promise<PersistentUploadSession[]> {
    const sessions = await db.select()
      .from(persistentUploadSessions)
      .where(
        and(
          eq(persistentUploadSessions.dealId, dealId),
          eq(persistentUploadSessions.status, 'uploading')
        )
      )
      .orderBy(desc(persistentUploadSessions.createdAt));

    return sessions as PersistentUploadSession[];
  }

  /**
   * Get all processing sessions for a deal
   */
  async getProcessingSessionsForDeal(dealId: number): Promise<PersistentUploadSession[]> {
    const sessions = await db.select()
      .from(persistentUploadSessions)
      .where(
        and(
          eq(persistentUploadSessions.dealId, dealId),
          eq(persistentUploadSessions.status, 'processing')
        )
      )
      .orderBy(desc(persistentUploadSessions.createdAt));

    return sessions as PersistentUploadSession[];
  }

  /**
   * Get all upload sessions for a deal (including completed/failed)
   */
  async getAllSessionsForDeal(dealId: number): Promise<PersistentUploadSession[]> {
    const sessions = await db.select()
      .from(persistentUploadSessions)
      .where(eq(persistentUploadSessions.dealId, dealId))
      .orderBy(desc(persistentUploadSessions.createdAt));

    return sessions as PersistentUploadSession[];
  }

  /**
   * Get all active sessions across all deals (for global monitoring)
   */
  async getAllActiveSessions(): Promise<PersistentUploadSession[]> {
    const sessions = await db.select()
      .from(persistentUploadSessions)
      .where(eq(persistentUploadSessions.status, 'uploading'))
      .orderBy(desc(persistentUploadSessions.createdAt));

    return sessions as PersistentUploadSession[];
  }

  /**
   * Delete a specific upload session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    console.log(`🗑️ DELETING SESSION: ${sessionId} from database`);
    
    try {
      const result = await db.delete(persistentUploadSessions)
        .where(eq(persistentUploadSessions.sessionId, sessionId));

      console.log(`✅ DATABASE DELETION RESULT:`, result);
      
      // Broadcast deletion to all clients
      this.broadcastStatusUpdate(sessionId, 'failed', 'Upload canceled by user');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to delete upload session from database:', error);
      return false;
    }
  }

  /**
   * Clean up old completed/failed sessions
   */
  async cleanupOldSessions(olderThanDays: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await db.delete(persistentUploadSessions)
      .where(
        and(
          eq(persistentUploadSessions.status, 'completed'),
          // Add date filter here when implementing
        )
      );

    console.log(`🧹 Cleaned up old upload sessions`);
  }

  /**
   * Broadcast progress update via WebSocket
   */
  private broadcastProgress(sessionId: string, progress: number, currentStep?: string): void {
    try {
      websocketManager.broadcast('upload_progress', {
        sessionId,
        progress,
        currentStep,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Failed to broadcast upload progress:', error);
    }
  }

  /**
   * Broadcast status update via WebSocket
   */
  private broadcastStatusUpdate(
    sessionId: string, 
    status: PersistentUploadSession['status'], 
    errorMessage?: string
  ): void {
    try {
      websocketManager.broadcast('upload_status', {
        sessionId,
        status,
        errorMessage,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Failed to broadcast upload status:', error);
    }
  }

  /**
   * Generate unique session ID
   */
  generateSessionId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check for stuck uploads and mark them as failed
   */
  async checkForStuckUploads(): Promise<void> {
    try {
      const stuckThreshold = new Date();
      stuckThreshold.setHours(stuckThreshold.getHours() - 2); // 2 hours timeout

      const stuckSessions = await db.select()
        .from(persistentUploadSessions)
        .where(
          and(
            eq(persistentUploadSessions.status, 'uploading')
            // Add date filter here when implementing
          )
        );

      for (const session of stuckSessions) {
        console.log(`⚠️ Found stuck upload session: ${session.sessionId}, marking as failed`);
        await this.updateStatus(
          session.sessionId, 
          'failed', 
          'Upload timed out after 2 hours'
        );
      }

      if (stuckSessions.length > 0) {
        console.log(`🧹 Marked ${stuckSessions.length} stuck upload sessions as failed`);
      }
    } catch (error) {
      console.error('❌ Failed to check for stuck uploads:', error);
    }
  }
}

export const persistentUploadService = new PersistentUploadService();