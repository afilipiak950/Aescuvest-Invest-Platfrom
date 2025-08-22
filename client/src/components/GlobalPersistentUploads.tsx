// 🎯 CRITICAL: Global Persistent Upload Monitor
// Shows ALL uploads across ALL deals and persists across page navigation

import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload, CheckCircle, XCircle, AlertCircle, X, Minimize2, Maximize2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface PersistentUploadSession {
  id: number;
  sessionId: string;
  dealId: number;
  fileName: string;
  fileSize: number;
  uploadType: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  uploadedBytes: number;
  gcsPath?: string;
  jobId?: string;
  currentStep?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

interface GlobalUploadMonitorProps {
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
  onClose?: () => void;
}

export function GlobalPersistentUploadMonitor({
  isMinimized = false,
  onToggleMinimize,
  onClose
}: GlobalUploadMonitorProps) {
  const queryClient = useQueryClient();
  
  console.log('🔍 GLOBAL WIDGET: Component rendering...');
  
  // Fetch global uploads every 2 seconds
  const { data: uploadsData, isLoading } = useQuery({
    queryKey: ['global-persistent-uploads'],
    queryFn: async () => {
      const response = await fetch('/api/persistent-uploads/global');
      if (!response.ok) throw new Error('Failed to fetch global uploads');
      return response.json();
    },
    refetchInterval: 2000, // Poll every 2 seconds
    refetchIntervalInBackground: true // Continue polling even when tab is not active
  });

  const uploads: PersistentUploadSession[] = uploadsData?.uploads || [];
  console.log(`🔍 GLOBAL WIDGET: Total uploads from API:`, uploads.length);
  
  // 🎯 CRITICAL: Sync with real-time localStorage progress like DataRoomExplorer
  const filteredUploads = uploads.filter(u => u.status === 'uploading' || u.status === 'processing');
  console.log(`🔍 GLOBAL WIDGET: Filtered active uploads:`, filteredUploads.length);
  
  const activeUploads = filteredUploads.map(upload => {
    console.log(`🔍 GLOBAL WIDGET: Processing upload:`, upload.fileName, upload.uploadType);
    // Get real-time progress from localStorage for GCS uploads
    if (upload.uploadType === 'gcs_direct') {
      try {
        const progressKey = `gcs_upload_progress_${upload.sessionId}`;
        console.log(`🔍 GLOBAL WIDGET: Checking localStorage key: ${progressKey}`);
        const localProgress = localStorage.getItem(progressKey);
        console.log(`🔍 GLOBAL WIDGET: localStorage value:`, localProgress);
        
        if (localProgress) {
          const progress = JSON.parse(localProgress);
          console.log(`🔍 GLOBAL WIDGET: Parsed progress:`, progress);
          console.log(`🎯 GLOBAL WIDGET: Syncing ${upload.fileName}: ${upload.progress}% → ${progress.progress}%`);
          return {
            ...upload,
            progress: progress.progress || upload.progress,
            currentStep: progress.status || upload.currentStep
          };
        } else {
          console.log(`🔍 GLOBAL WIDGET: No localStorage data found for ${upload.fileName}`);
        }
      } catch (error) {
        console.warn('Failed to sync localStorage progress:', error);
      }
    }
    return upload;
  });

  // 🎯 CRITICAL: Poll localStorage for real-time progress updates
  useEffect(() => {
    if (activeUploads.length === 0) return;
    
    const interval = setInterval(() => {
      // Force re-render to pick up localStorage changes
      queryClient.invalidateQueries({ queryKey: ['global-persistent-uploads'] });
    }, 1000); // Update every second for real-time sync
    
    return () => clearInterval(interval);
  }, [activeUploads.length, queryClient]);

  // Listen for WebSocket updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'upload_progress' || data.type === 'upload_status') {
            console.log('🔄 Received upload update:', data);
            // Invalidate and refetch global uploads
            queryClient.invalidateQueries({ queryKey: ['global-persistent-uploads'] });
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };
      
      return () => {
        ws.close();
      };
    } catch (error) {
      console.error('❌ Failed to connect WebSocket:', error);
    }
  }, [queryClient]);

  // TEMP DEBUG: Comment out early return to see debug logs
  console.log('🎯 GLOBAL WIDGET: activeUploads.length =', activeUploads.length);
  // if (activeUploads.length === 0) {
  //   return null; // Don't show if no active uploads
  // }

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Card className="bg-dark border-primary/20 shadow-2xl">
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-white font-medium">
                {activeUploads.length} upload{activeUploads.length !== 1 ? 's' : ''} active
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={onToggleMinimize}
                className="h-6 w-6 p-0"
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <Card className="bg-dark border-primary/20 shadow-2xl max-h-96 overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-white flex items-center">
              <Upload className="h-5 w-5 mr-2 text-primary" />
              Global Uploads
            </CardTitle>
            <div className="flex items-center space-x-1">
              <Badge variant="secondary" className="bg-primary/20 text-primary">
                {activeUploads.length} active
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={onToggleMinimize}
                className="h-6 w-6 p-0"
              >
                <Minimize2 className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 max-h-72 overflow-y-auto space-y-3">
          {activeUploads.map((upload) => (
            <UploadItem key={upload.sessionId} upload={upload} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function UploadItem({ upload }: { upload: PersistentUploadSession }) {
  const getStatusIcon = () => {
    switch (upload.status) {
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-green-400" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = () => {
    switch (upload.status) {
      case 'uploading':
        return 'text-blue-400';
      case 'processing':
        return 'text-green-400';
      case 'completed':
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
      default:
        return 'text-yellow-500';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleCancel = async () => {
    console.log(`🗑️ Canceling upload: ${upload.fileName} (${upload.sessionId})`);
    try {
      const response = await fetch(`/api/persistent-uploads/${upload.sessionId}`, { 
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log(`✅ Upload canceled: ${upload.fileName}`);
        // Force refresh the upload list immediately
        window.location.reload();
      } else {
        console.error('❌ Failed to cancel upload:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Network error canceling upload:', error);
    }
  };

  return (
    <div className="border border-gray-600 rounded-lg p-3 bg-dark-lighter">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          {getStatusIcon()}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate" title={upload.fileName}>
              {upload.fileName}
            </p>
            <p className="text-xs text-gray-400">
              Deal {upload.dealId} • {formatFileSize(upload.fileSize)}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge 
            variant="secondary" 
            className={`text-xs ${getStatusColor()} bg-dark border-gray-600`}
          >
            {upload.status.toUpperCase()}
          </Badge>
          {/* Cancel button for stuck/active uploads */}
          {(upload.status === 'uploading' || upload.status === 'processing') && (
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-red-400 transition-colors p-1 rounded"
              title="Cancel upload"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      
      {(upload.status === 'uploading' || upload.status === 'processing') && (
        <div className="space-y-2">
          <Progress value={upload.progress} className="h-2" />
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{upload.progress}%</span>
            <span>
              {upload.uploadedBytes > 0 && upload.fileSize > 0 
                ? `${formatFileSize(upload.uploadedBytes)} / ${formatFileSize(upload.fileSize)}`
                : formatFileSize(upload.fileSize)
              }
            </span>
          </div>
          {upload.currentStep && (
            <p className="text-xs text-gray-300 truncate" title={upload.currentStep}>
              {upload.currentStep}
            </p>
          )}
        </div>
      )}
      
      {upload.status === 'failed' && upload.errorMessage && (
        <p className="text-xs text-red-400 mt-2 truncate" title={upload.errorMessage}>
          Error: {upload.errorMessage}
        </p>
      )}
    </div>
  );
}

// Global Upload Hook for managing persistent uploads anywhere in the app
export function useGlobalPersistentUploads() {
  const [showMonitor, setShowMonitor] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const { data: uploadsData } = useQuery({
    queryKey: ['global-persistent-uploads'],
    queryFn: async () => {
      const response = await fetch('/api/persistent-uploads/global');
      if (!response.ok) throw new Error('Failed to fetch global uploads');
      return response.json();
    },
    refetchInterval: 2000,
    refetchIntervalInBackground: true
  });

  const allUploads = uploadsData?.uploads || [];
  console.log(`🔍 HOOK: Total uploads from API:`, allUploads.length);
  allUploads.forEach((upload, i) => {
    console.log(`🔍 HOOK: Upload ${i + 1}: ${upload.fileName} - Status: ${upload.status}`);
  });

  const activeUploads = allUploads.filter(
    (u: PersistentUploadSession) => u.status === 'uploading' || u.status === 'processing'
  );
  console.log(`🔍 HOOK: Active uploads after filtering:`, activeUploads.length);

  // Automatically show monitor when uploads are active
  useEffect(() => {
    if (activeUploads.length > 0 && !showMonitor) {
      setShowMonitor(true);
      setIsMinimized(false);
    } else if (activeUploads.length === 0 && showMonitor) {
      // Hide after 3 seconds of no active uploads
      const timeout = setTimeout(() => {
        setShowMonitor(false);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [activeUploads.length, showMonitor]);

  return {
    showMonitor,
    isMinimized,
    activeUploadsCount: activeUploads.length,
    toggleMonitor: () => setShowMonitor(!showMonitor),
    toggleMinimize: () => setIsMinimized(!isMinimized),
    closeMonitor: () => setShowMonitor(false)
  };
}