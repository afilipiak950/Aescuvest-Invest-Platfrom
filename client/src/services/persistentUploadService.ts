// 🎯 CRITICAL: Frontend Persistent Upload Service
// Creates sessions immediately when uploads start, not when they complete

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

export class FrontendPersistentUploadService {
  /**
   * Create a new persistent upload session immediately when upload starts
   */
  async createUploadSession(
    dealId: number,
    fileName: string,
    fileSize: number,
    uploadType: 'gcs_direct' | 'chunked' | 'zip_processing' = 'gcs_direct'
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    
    console.log(`🎯 Creating persistent upload session for: ${fileName}`);
    
    try {
      const response = await fetch('/api/persistent-uploads/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          dealId,
          fileName,
          fileSize,
          uploadType,
          status: 'uploading',
          progress: 0,
          uploadedBytes: 0,
          currentStep: 'Starting upload...'
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create upload session: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ Created persistent upload session: ${sessionId}`);
      
      return sessionId;
    } catch (error) {
      console.error('❌ Failed to create persistent upload session:', error);
      // Return session ID anyway so upload can continue
      return sessionId;
    }
  }

  /**
   * Update upload progress
   */
  async updateProgress(
    sessionId: string,
    progress: number,
    uploadedBytes?: number,
    currentStep?: string
  ): Promise<void> {
    try {
      await fetch(`/api/persistent-uploads/${sessionId}/progress`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          progress,
          uploadedBytes,
          currentStep
        }),
      });
    } catch (error) {
      console.error('❌ Failed to update upload progress:', error);
      // Don't throw - allow upload to continue
    }
  }

  /**
   * Update upload status
   */
  async updateStatus(
    sessionId: string,
    status: PersistentUploadSession['status'],
    errorMessage?: string,
    jobId?: string,
    gcsPath?: string
  ): Promise<void> {
    try {
      await fetch(`/api/persistent-uploads/${sessionId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          errorMessage,
          jobId,
          gcsPath
        }),
      });
    } catch (error) {
      console.error('❌ Failed to update upload status:', error);
      // Don't throw - allow upload to continue
    }
  }

  /**
   * Generate unique session ID
   */
  generateSessionId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get active uploads for a deal
   */
  async getActiveUploads(dealId: number): Promise<PersistentUploadSession[]> {
    try {
      const response = await fetch(`/api/deals/${dealId}/persistent-uploads`);
      if (!response.ok) {
        throw new Error(`Failed to get active uploads: ${response.statusText}`);
      }

      const data = await response.json();
      return data.uploads?.active || [];
    } catch (error) {
      console.error('❌ Failed to get active uploads:', error);
      return [];
    }
  }

  /**
   * Get all global uploads
   */
  async getGlobalUploads(): Promise<PersistentUploadSession[]> {
    try {
      const response = await fetch('/api/persistent-uploads/global');
      if (!response.ok) {
        throw new Error(`Failed to get global uploads: ${response.statusText}`);
      }

      const data = await response.json();
      return data.uploads || [];
    } catch (error) {
      console.error('❌ Failed to get global uploads:', error);
      return [];
    }
  }
}

export const frontendPersistentUploadService = new FrontendPersistentUploadService();