// 🎯 CRITICAL: Persistent Upload Service for Complete Background Processing
// Ensures uploads NEVER stop even when leaving page, refreshing, or switching deals

import { db } from '../db';
import { persistentUploadSessions } from '@shared/schema';
import { eq, and, desc, or } from 'drizzle-orm';
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
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    // Start automatic stuck upload cleanup every 10 minutes
    this.startAutomaticCleanup();
  }

  /**
   * Start automatic periodic cleanup and recovery of stuck uploads
   */
  private startAutomaticCleanup(): void {
    // Initial cleanup on startup
    setTimeout(() => {
      this.checkForStuckUploads().catch(error => {
        console.error('❌ Error in initial stuck upload cleanup:', error);
      });
    }, 5000); // Wait 5 seconds after startup

    // Periodic cleanup every 2 minutes for faster recovery
    this.cleanupInterval = setInterval(async () => {
      try {
        const cleanedUp = await this.checkForStuckUploads();
        if (cleanedUp > 0) {
          console.log(`🔄 Automatic recovery: ${cleanedUp} stuck uploads processed`);
        }
      } catch (error) {
        console.error('❌ Error in automatic stuck upload recovery:', error);
      }
    }, 2 * 60 * 1000); // Every 2 minutes for faster recovery

    console.log('🔄 Automatic stuck upload recovery started (checks every 2 minutes)');
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
    // Drizzle ORM returns camelCase properties - use them directly
    return {
      id: created.id,
      sessionId: created.sessionId,
      dealId: created.dealId,
      fileName: created.fileName,
      fileSize: created.fileSize,
      uploadType: created.uploadType,
      status: created.status,
      progress: created.progress,
      uploadedBytes: created.uploadedBytes,
      gcsPath: created.gcsPath,
      jobId: created.jobId,
      currentStep: created.currentStep,
      errorMessage: created.errorMessage,
      metadata: created.metadata,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      completedAt: created.completedAt
    } as PersistentUploadSession;
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
      // Create update object with proper schema references
      const updateData: any = {
        progress,
        updatedAt: new Date()
      };
      
      // Only add optional fields if they have values
      if (uploadedBytes !== undefined) {
        updateData.uploadedBytes = uploadedBytes;
      }
      if (currentStep !== undefined) {
        updateData.currentStep = currentStep;
      }
      
      const updateResult = await db.update(persistentUploadSessions)
        .set(updateData)
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

    if (!session) return null;
    
    // Map database columns to TypeScript interface  
    return {
      id: session.id,
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
      metadata: session.metadata,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      completedAt: session.completedAt
    } as PersistentUploadSession;
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

    return sessions.map(session => ({
      id: session.id,
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
      metadata: session.metadata,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      completedAt: session.completedAt
    } as PersistentUploadSession));
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

    return sessions.map(session => ({
      id: session.id,
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
      metadata: session.metadata,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      completedAt: session.completedAt
    } as PersistentUploadSession));
  }

  /**
   * Get all upload sessions for a deal (including completed/failed)
   */
  async getAllSessionsForDeal(dealId: number): Promise<PersistentUploadSession[]> {
    const sessions = await db.select()
      .from(persistentUploadSessions)
      .where(eq(persistentUploadSessions.dealId, dealId))
      .orderBy(desc(persistentUploadSessions.createdAt));

    return sessions.map(session => ({
      id: session.id,
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
      metadata: session.metadata,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      completedAt: session.completedAt
    } as PersistentUploadSession));
  }

  /**
   * Get all active sessions across all deals (for global monitoring)
   */
  async getAllActiveSessions(): Promise<PersistentUploadSession[]> {
    // Include failed uploads from the last 30 minutes so users can retry them
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);
    
    const sessions = await db.select()
      .from(persistentUploadSessions)
      .where(
        or(
          eq(persistentUploadSessions.status, 'uploading'),
          eq(persistentUploadSessions.status, 'processing'),
          // Include recent failed uploads for retry
          and(
            eq(persistentUploadSessions.status, 'failed'),
            // Note: We'll filter by date in JS since Drizzle date comparisons can be tricky
          )
        )
      )
      .orderBy(desc(persistentUploadSessions.createdAt));
      
    console.log(`🔍 getAllActiveSessions RAW query returned ${sessions.length} sessions`);
    if (sessions.length > 0) {
      console.log(`🔍 First session raw data:`, JSON.stringify(sessions[0], null, 2));
    }

    // 🔧 CRITICAL FIX: Filter recent failed uploads AND validate session data
    const filteredSessions = sessions.filter((session: any) => {
      // 🔧 CRITICAL VALIDATION: Skip sessions with NULL/undefined required fields
      // NOTE: Drizzle ORM maps snake_case DB columns to camelCase properties!
      if (!session || typeof session !== 'object') {
        console.log(`❌ INVALID SESSION OBJECT FILTERED OUT`);
        return false;
      }
      
      // Skip sessions without required fields (using camelCase properties from Drizzle)
      if (!session.sessionId || !session.fileName) {
        console.log(`❌ Session missing required fields: sessionId=${session.sessionId}, fileName=${session.fileName}`);
        return false;
      }
      
      // 🔧 CRITICAL VALIDATION: Ensure valid date fields (using camelCase)
      if (!session.createdAt || isNaN(new Date(session.createdAt).getTime())) {
        console.log(`❌ SESSION WITH INVALID CREATED_AT FILTERED OUT: ${session.sessionId}`);
        return false;
      }
      
      // Filter failed uploads by date
      if (session.status === 'failed') {
        const updatedAt = new Date(session.updatedAt || session.createdAt);
        if (isNaN(updatedAt.getTime())) {
          console.log(`❌ SESSION WITH INVALID DATE FILTERED OUT: ${session.sessionId}`);
          return false;
        }
        return updatedAt > thirtyMinutesAgo;
      }
      
      return true;
    });

    // Sessions already have camelCase properties from Drizzle ORM
    return filteredSessions.map(session => ({
      id: session.id,
      sessionId: session.sessionId,
      dealId: session.dealId,
      fileName: session.fileName,
      fileSize: session.fileSize || 0,
      uploadType: session.uploadType,
      status: session.status,
      progress: session.progress || 0,
      uploadedBytes: session.uploadedBytes || 0,
      gcsPath: session.gcsPath,
      jobId: session.jobId,
      currentStep: session.currentStep,
      errorMessage: session.errorMessage,
      metadata: session.metadata,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      completedAt: session.completedAt
    } as PersistentUploadSession));
  }

  /**
   * Delete a specific upload session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    console.log(`🗑️ DELETING SESSION: ${sessionId} from database`);
    
    try {
      // 🔧 CRITICAL FIX: Handle deletion by session_id OR by ID for corrupted records
      let result;
      
      if (sessionId && sessionId.startsWith('corrupted_')) {
        // Extract the ID for corrupted sessions
        const id = parseInt(sessionId.replace('corrupted_', ''));
        if (!isNaN(id)) {
          console.log(`🧹 Deleting corrupted session by ID: ${id}`);
          result = await db.delete(persistentUploadSessions)
            .where(eq(persistentUploadSessions.id, id));
        } else {
          console.log(`❌ Invalid corrupted session ID: ${sessionId}`);
          return false;
        }
      } else if (sessionId) {
        // Normal deletion by session_id
        result = await db.delete(persistentUploadSessions)
          .where(eq(persistentUploadSessions.sessionId, sessionId));
      } else {
        console.log(`❌ Cannot delete session with invalid sessionId: ${sessionId}`);
        return false;
      }

      console.log(`✅ DATABASE DELETION RESULT:`, result);
      
      // Broadcast deletion to all clients (only if it's a real session_id)
      if (sessionId && !sessionId.startsWith('corrupted_')) {
        this.broadcastStatusUpdate(sessionId, 'failed', 'Upload canceled by user');
      }
      
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
   * Check for stuck uploads and attempt recovery
   * Checks for uploads stuck for more than 5 minutes
   * Attempts to recover by checking GCS and triggering processing if needed
   */
  async checkForStuckUploads(): Promise<number> {
    try {
      console.log('🔍 Starting stuck upload check with recovery logic...');
      
      // 5 minute timeout for faster recovery
      const stuckThreshold = new Date();
      stuckThreshold.setMinutes(stuckThreshold.getMinutes() - 5);
      
      console.log(`🕒 Looking for uploads stuck since before: ${stuckThreshold.toISOString()}`);

      const stuckSessions = await db.select()
        .from(persistentUploadSessions)
        .where(
          and(
            eq(persistentUploadSessions.status, 'uploading'),
            // Check if updated_at is older than 5 minutes
            // Note: In development, we'll check all uploading sessions for safety
          )
        );

      console.log(`🔍 Found ${stuckSessions.length} potentially stuck upload sessions`);

      let cleanedUpCount = 0;
      for (const dbSession of stuckSessions) {
        // Database columns use snake_case, not camelCase
        // Skip sessions without required fields (but don't delete them)
        if (!dbSession || !dbSession.id) {
          console.log(`❌ Invalid session object found, skipping...`);
          continue;
        }

        // 🔧 CRITICAL FIX: Validate date values before calculations
        // NOTE: Drizzle ORM maps snake_case to camelCase (updatedAt, createdAt, sessionId)
        const updatedAt = dbSession.updatedAt;
        const createdAt = dbSession.createdAt;
        
        if (!updatedAt && !createdAt) {
          console.log(`❌ SESSION WITH INVALID DATES: ${dbSession.sessionId} - skipping`);
          continue; // Skip instead of delete - might be a mapping issue
        }
        
        const lastUpdate = new Date(updatedAt || createdAt);
        const currentTime = new Date();
        
        // 🔧 CRITICAL FIX: Validate date calculation
        if (isNaN(lastUpdate.getTime()) || isNaN(currentTime.getTime())) {
          console.log(`❌ SESSION WITH INVALID DATE CALCULATION: ${dbSession.sessionId} - skipping`);
          continue; // Skip instead of delete
        }
        
        const minutesStuck = (currentTime.getTime() - lastUpdate.getTime()) / (1000 * 60);
        
        // 🔧 CRITICAL FIX: Validate calculated minutes
        if (isNaN(minutesStuck) || minutesStuck < 0) {
          console.log(`❌ SESSION WITH INVALID TIME CALCULATION: ${dbSession.sessionId}, minutesStuck=${minutesStuck} - skipping`);
          continue; // Skip instead of delete
        }
        
        console.log(`📊 Session ${dbSession.sessionId} (${dbSession.fileName}): ${minutesStuck.toFixed(1)} minutes since last update, progress: ${dbSession.progress || 0}%`);
        
        // 🎯 CRITICAL: If upload reached 100% but never got marked as completed, complete it now
        if ((dbSession.progress || 0) >= 100) {
          console.log(`✅ Upload reached 100% but never completed: ${dbSession.sessionId} (${dbSession.fileName}) - marking as completed`);
          await this.updateStatus(
            dbSession.sessionId, 
            'completed', 
            'Analysis completed, upload finished'
          );
          cleanedUpCount++;
        } else if (minutesStuck >= 5) {
          console.log(`⚠️ Found stuck upload session: ${dbSession.sessionId} (${dbSession.fileName}), stuck for ${minutesStuck.toFixed(1)} minutes`);
          console.log(`🔍 Attempting recovery for stuck upload...`);
          
          // Try to recover the upload
          const recovered = await this.attemptUploadRecovery(dbSession);
          
          if (recovered) {
            console.log(`🎉 Successfully recovered stuck upload: ${dbSession.sessionId}`);
          } else {
            console.log(`❌ Failed to recover stuck upload: ${dbSession.sessionId}`);
          }
          
          cleanedUpCount++;
        }
      }

      if (cleanedUpCount > 0) {
        console.log(`🧹 Processed ${cleanedUpCount} stuck upload sessions (recovered, completed or failed)`);
      } else {
        console.log('✅ No stuck uploads found');
      }
      
      return cleanedUpCount;
    } catch (error) {
      console.error('❌ Failed to check for stuck uploads:', error);
      return 0;
    }
  }

  /**
   * Attempt to recover a stuck upload by checking GCS and triggering processing
   */
  private async attemptUploadRecovery(session: any): Promise<boolean> {
    try {
      // 🔧 CRITICAL FIX: Use camelCase properties that Drizzle returns
      console.log(`🚑 Starting recovery for upload: ${session.sessionId} (${session.fileName})`);
      
      // Import required services
      const { gcsService } = await import('./googleCloudStorage');
      const { zipProcessor } = await import('./zipProcessor');
      const { documents } = await import('@shared/schema');
      
      // Check if we have a GCS path
      if (!session.gcsPath) {
        console.log(`❌ No GCS path found for upload ${session.sessionId} - marking as failed`);
        await this.updateStatus(
          session.sessionId,
          'failed',
          'Upload failed - no cloud storage path found after 5 minutes'
        );
        return false;
      }
      
      // Check if the file exists in GCS
      console.log(`☁️ Checking if file exists in GCS: ${session.gcsPath}`);
      const fileExists = await gcsService.fileExists(session.gcsPath);
      
      if (fileExists) {
        console.log(`✅ File found in GCS! Attempting to complete upload and trigger processing...`);
        
        // Mark upload as completed
        await this.updateStatus(
          session.sessionId,
          'completed',
          'Upload recovered - file found in cloud storage'
        );
        
        // Check if a document record exists
        const existingDocs = await db.select()
          .from(documents)
          .where(
            and(
              eq(documents.dealId, session.dealId),
              eq(documents.name, session.fileName)
            )
          )
          .limit(1);
        
        if (existingDocs.length === 0) {
          console.log(`📄 Creating document record for recovered upload...`);
          
          // Create document record
          const [document] = await db.insert(documents).values({
            dealId: session.dealId,
            name: session.fileName,
            path: session.gcsPath,
            type: session.fileName.toLowerCase().endsWith('.zip') ? 'application/zip' : 'application/octet-stream',
            size: session.fileSize,
            status: 'Processing',
            uploadedAt: new Date()
          }).returning();
          
          console.log(`📄 Document created with ID: ${document.id}`);
          
          // If it's a ZIP file, trigger processing
          if (session.fileName.toLowerCase().endsWith('.zip')) {
            console.log(`🗂️ Triggering ZIP processing for recovered upload...`);
            
            // Download the file from GCS to process it
            const tempPath = `/tmp/recovered_${Date.now()}_${session.fileName}`;
            await gcsService.downloadFile(session.gcsPath, tempPath);
            
            // Process the ZIP file
            zipProcessor.processZipFile(tempPath, session.dealId, 'Recovered Upload').catch((err: Error) => {
              console.error('❌ ZIP processing failed for recovered upload:', err);
            });
            
            console.log(`🎉 Successfully triggered processing for recovered upload`);
          }
        } else {
          console.log(`📄 Document record already exists for this upload`);
        }
        
        // Broadcast success to clients
        this.broadcastStatusUpdate(
          session.sessionId,
          'completed',
          'Upload recovered successfully'
        );
        
        return true;
      } else {
        console.log(`❌ File NOT found in GCS: ${session.gcsPath}`);
        console.log(`📊 Upload was at ${session.progress}% when it got stuck`);
        
        // Mark as failed since file doesn't exist
        await this.updateStatus(
          session.sessionId,
          'failed',
          `Upload failed - file not found in cloud storage after ${session.progress}% progress`
        );
        
        return false;
      }
    } catch (error) {
      console.error(`❌ Error during upload recovery for ${session.sessionId}:`, error);
      
      // Mark as failed if recovery fails
      await this.updateStatus(
        session.sessionId,
        'failed',
        `Upload recovery failed: ${error.message}`
      );
      
      return false;
    }
  }
}

export const persistentUploadService = new PersistentUploadService();