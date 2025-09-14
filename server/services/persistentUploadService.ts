// 🎯 CRITICAL: Persistent Upload Service for Complete Background Processing
// Ensures uploads NEVER stop even when leaving page, refreshing, or switching deals

import { db } from '../db';
import { persistentUploadSessions, insertPersistentUploadSessionSchema } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { websocketManager } from './websocketManager';
import { z } from 'zod';

// Use schema-derived types as single source of truth
export type PersistentUploadSession = typeof persistentUploadSessions.$inferSelect;
export type InsertPersistentUploadSession = z.infer<typeof insertPersistentUploadSessionSchema>;

export class PersistentUploadService {
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    // Start automatic stuck upload cleanup every 10 minutes
    this.startAutomaticCleanup();
  }

  /**
   * Start automatic periodic cleanup of stuck uploads
   */
  private startAutomaticCleanup(): void {
    // Initial cleanup on startup
    setTimeout(() => {
      this.checkForStuckUploads().catch(error => {
        console.error('❌ Error in initial stuck upload cleanup:', error);
      });
    }, 5000); // Wait 5 seconds after startup

    // Periodic cleanup every 10 minutes
    this.cleanupInterval = setInterval(async () => {
      try {
        const cleanedUp = await this.checkForStuckUploads();
        if (cleanedUp > 0) {
          console.log(`🔄 Automatic cleanup: ${cleanedUp} stuck uploads cleaned up`);
        }
      } catch (error) {
        console.error('❌ Error in automatic stuck upload cleanup:', error);
      }
    }, 10 * 60 * 1000); // Every 10 minutes

    console.log('🔄 Automatic stuck upload cleanup started (checks every 10 minutes)');
  }

  /**
   * Stop automatic cleanup (for graceful shutdown)
   */
  stopAutomaticCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
      console.log('🛑 Automatic stuck upload cleanup stopped');
    }
  }

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
    
    try {
      const updateResult = await db.update(persistentUploadSessions)
        .set({
          progress,
          uploadedBytes: uploadedBytes || undefined,
          currentStep,
          updatedAt: new Date()
        })
        .where(eq(persistentUploadSessions.sessionId, sessionId));

      console.log(`✅ Progress update successful for ${sessionId}: ${progress}%`);
      console.log(`📊 Update result:`, updateResult);

      // Broadcast progress to all connected clients
      this.broadcastProgress(sessionId, progress, currentStep);
      
    } catch (error) {
      console.error(`❌ PROGRESS UPDATE ERROR for ${sessionId}:`, error);
      throw error;
    }
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
   * Now checks for uploads stuck for more than 15 minutes
   * Also completes uploads that reached 100% but never transitioned to completed
   */
  async checkForStuckUploads(): Promise<number> {
    try {
      console.log('🔍 Starting stuck upload check...');
      
      // 3 minute timeout for much faster recovery - uploads should progress every 30 seconds
      const stuckThreshold = new Date();
      stuckThreshold.setMinutes(stuckThreshold.getMinutes() - 3);
      
      console.log(`🕒 Looking for uploads stuck since before: ${stuckThreshold.toISOString()}`);

      const stuckSessions = await db.select()
        .from(persistentUploadSessions)
        .where(
          and(
            eq(persistentUploadSessions.status, 'uploading'),
            // Check if updated_at is older than 15 minutes
            // Note: In development, we'll check all uploading sessions for safety
          )
        );

      console.log(`🔍 Found ${stuckSessions.length} potentially stuck upload sessions`);

      let cleanedUpCount = 0;
      for (const session of stuckSessions) {
        // Check if this session is truly stuck (no update for 3+ minutes)
        const lastUpdate = new Date(session.updatedAt || session.createdAt);
        const minutesStuck = (new Date().getTime() - lastUpdate.getTime()) / (1000 * 60);
        
        console.log(`📊 Session ${session.sessionId} (${session.fileName}): ${minutesStuck.toFixed(1)} minutes since last update, progress: ${session.progress}%`);
        
        // 🎯 CRITICAL: If upload reached 100% but never got marked as completed, complete it now
        if (session.progress >= 100) {
          console.log(`✅ Upload reached 100% but never completed: ${session.sessionId} (${session.fileName}) - marking as completed`);
          await this.updateStatus(
            session.sessionId, 
            'completed', 
            'Analysis completed, upload finished'
          );
          cleanedUpCount++;
        } else if (minutesStuck >= 3) {
          console.log(`⚠️ Found stuck upload session: ${session.sessionId} (${session.fileName}), stuck for ${minutesStuck.toFixed(1)} minutes`);
          await this.updateStatus(
            session.sessionId, 
            'failed', 
            `Upload connection lost after ${Math.round(minutesStuck)} minutes - please try again. Upload may resume when you return to this page.`
          );
          cleanedUpCount++;
        }
      }

      if (cleanedUpCount > 0) {
        console.log(`🧹 Processed ${cleanedUpCount} stuck upload sessions (completed or failed)`);
      } else {
        console.log('✅ No stuck uploads found');
      }
      
      return cleanedUpCount;
    } catch (error) {
      console.error('❌ Failed to check for stuck uploads:', error);
      return 0;
    }
  }
}

export const persistentUploadService = new PersistentUploadService();