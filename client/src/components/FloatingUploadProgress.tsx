import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  X, 
  Upload, 
  Pause, 
  Play, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Wifi,
  WifiOff,
  Clock,
  HardDrive,
  FileArchive,
  DownloadCloud
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { frontendPersistentUploadService } from '@/services/persistentUploadService';
import { backgroundUploadService } from '@/services/backgroundUploadService';

interface UploadSession {
  sessionId: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: string;
  uploadSpeed?: number;
  timeRemaining?: number;
  error?: string;
  startTime: number;
  pausedAt?: number;
  retryCount?: number;
  dealId: number;
  processingJobId?: string;
  processingStatus?: string;
  processingProgress?: number;
  documentsProcessed?: number;
  totalDocuments?: number;
}

// Utility to format bytes
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Utility to format time remaining
const formatTimeRemaining = (seconds: number): string => {
  if (seconds === Infinity || isNaN(seconds)) return 'Calculating...';
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
};

export const FloatingUploadProgress: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [uploadSessions, setUploadSessions] = useState<Map<string, UploadSession>>(new Map());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastUpdateTime, setLastUpdateTime] = useState<Map<string, number>>(new Map());
  const [uploadSpeeds, setUploadSpeeds] = useState<Map<string, number[]>>(new Map());

  // Monitor network connectivity
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('🌐 Network connection restored');
      
      // Resume paused uploads
      uploadSessions.forEach((session) => {
        if (session.status === 'paused_network') {
          resumeUpload(session.sessionId);
        }
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('🌐 Network connection lost');
      
      // Auto-pause active uploads
      uploadSessions.forEach((session) => {
        if (session.status === 'uploading') {
          pauseUpload(session.sessionId, true);
        }
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [uploadSessions]);

  // Load upload sessions from localStorage on mount
  useEffect(() => {
    const loadStoredSessions = () => {
      const stored = localStorage.getItem('activeUploadSessions');
      if (stored) {
        try {
          const sessions = JSON.parse(stored);
          const sessionMap = new Map<string, UploadSession>();
          
          Object.entries(sessions).forEach(([sessionId, session]) => {
            sessionMap.set(sessionId, session as UploadSession);
          });
          
          setUploadSessions(sessionMap);
          console.log(`📦 Loaded ${sessionMap.size} stored upload sessions`);
          
          // Show notification if uploads are active
          if (sessionMap.size > 0) {
            setIsMinimized(false);
            setIsExpanded(true);
          }
        } catch (error) {
          console.error('Failed to load stored upload sessions:', error);
        }
      }
    };

    loadStoredSessions();
  }, []);

  // Save upload sessions to localStorage whenever they change
  useEffect(() => {
    if (uploadSessions.size > 0) {
      const sessionsObj = Object.fromEntries(uploadSessions);
      localStorage.setItem('activeUploadSessions', JSON.stringify(sessionsObj));
    } else {
      localStorage.removeItem('activeUploadSessions');
    }
  }, [uploadSessions]);

  // Poll for active uploads from backend
  const { data: globalUploads } = useQuery<{
    success: boolean;
    uploads: any[];
  }>({
    queryKey: ['/api/persistent-uploads/global'],
    refetchInterval: 2000,
    enabled: true
  });

  // 🔧 CRITICAL FIX: Sync localStorage with backend state to prevent stale uploads
  // FIXED INFINITE LOOP: Only depend on globalUploads, not uploadSessions
  useEffect(() => {
    if (globalUploads?.success) {
      const activeBackendSessions = globalUploads.uploads || [];
      
      if (activeBackendSessions.length === 0) {
        // Backend has no active uploads - clear localStorage and component state
        // Only clear if we actually have sessions to clear
        setUploadSessions(prev => {
          if (prev.size > 0) {
            console.log('🧹 Backend has no active uploads - clearing all local data');
            localStorage.removeItem('activeUploadSessions');
            return new Map();
          }
          return prev;
        });
      } else {
        // Sync local state with backend state
        setUploadSessions(prev => {
          const backendSessionIds = new Set(activeBackendSessions.map(u => u.sessionId));
          const localSessionIds = new Set(prev.keys());
          
          // Remove local sessions that don't exist on backend
          const toRemove = Array.from(localSessionIds).filter(id => !backendSessionIds.has(id));
          if (toRemove.length > 0) {
            console.log(`🧹 Removing ${toRemove.length} stale local sessions:`, toRemove);
            const newSessions = new Map(prev);
            toRemove.forEach(id => newSessions.delete(id));
            return newSessions;
          }
          return prev;
        });
      }
    }
  }, [globalUploads]); // FIX: Only depend on globalUploads to prevent infinite loop

  // Poll for background processing jobs
  const pollBackgroundJobs = useCallback(async () => {
    const completedSessions = Array.from(uploadSessions.values()).filter(
      s => s.status === 'completed' && s.dealId && !s.processingJobId
    );

    for (const session of completedSessions) {
      try {
        const response = await fetch(`/api/background-jobs/${session.dealId}`);
        const data = await response.json();
        
        if (data.success && data.jobs && data.jobs.length > 0) {
          const relevantJob = data.jobs.find((job: any) => 
            job.createdAt > session.startTime && 
            (job.status === 'processing' || job.status === 'queued' || job.status === 'pending')
          );
          
          if (relevantJob) {
            setUploadSessions(prev => {
              const newMap = new Map(prev);
              const existingSession = newMap.get(session.sessionId);
              if (existingSession) {
                newMap.set(session.sessionId, {
                  ...existingSession,
                  processingJobId: relevantJob.jobId,
                  processingStatus: relevantJob.status,
                  processingProgress: relevantJob.progress,
                  documentsProcessed: relevantJob.processedDocuments,
                  totalDocuments: relevantJob.totalDocuments
                });
              }
              return newMap;
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch background jobs:', error);
      }
    }
  }, [uploadSessions]);

  // Poll for background jobs periodically
  useEffect(() => {
    const interval = setInterval(pollBackgroundJobs, 3000);
    return () => clearInterval(interval);
  }, [pollBackgroundJobs]);

  // Sync with backend upload sessions
  useEffect(() => {
    if (globalUploads?.uploads && Array.isArray(globalUploads.uploads)) {
      console.log('🔄 FloatingUploadProgress: Syncing with backend uploads:', globalUploads.uploads);
      
      // 🔧 CRITICAL FIX: Validate backend sessions before processing
      const validActiveSessions = globalUploads.uploads.filter((session: any) => {
        // Validate required fields
        if (!session.sessionId || !session.fileName) {
          console.log(`❌ FloatingUploadProgress: Invalid session filtered out:`, {
            sessionId: session.sessionId,
            fileName: session.fileName,
            hasSessionId: !!session.sessionId,
            hasFileName: !!session.fileName
          });
          return false;
        }
        
        // Validate numeric fields
        if (typeof session.fileSize !== 'number' || session.fileSize <= 0) {
          console.log(`❌ FloatingUploadProgress: Invalid fileSize for ${session.sessionId}:`, session.fileSize);
          return false;
        }
        
        if (typeof session.progress !== 'number' || session.progress < 0 || session.progress > 100) {
          console.log(`❌ FloatingUploadProgress: Invalid progress for ${session.sessionId}:`, session.progress);
          return false;
        }
        
        return true;
      });

      console.log(`📊 FloatingUploadProgress: Found ${validActiveSessions.length} valid active sessions (filtered from ${globalUploads.uploads.length})`);
      
      // Auto-show if there are active uploads
      if (validActiveSessions.length > 0 && isMinimized) {
        setIsMinimized(false);
        setIsExpanded(true);
      }
      
      validActiveSessions.forEach((backendSession: any) => {
        setUploadSessions(prev => {
          const newMap = new Map(prev);
          const existingSession = newMap.get(backendSession.sessionId);
          
          if (!existingSession || existingSession.progress !== backendSession.progress) {
            // Calculate upload speed
            const now = Date.now();
            const lastTime = lastUpdateTime.get(backendSession.sessionId) || now;
            const timeDiff = (now - lastTime) / 1000; // seconds
            
            if (timeDiff > 0 && existingSession) {
              const bytesDiff = (backendSession.progress - existingSession.progress) / 100 * backendSession.fileSize;
              const speed = Math.max(0, bytesDiff / timeDiff); // bytes per second
              
              // Store speed samples for averaging
              const speeds = uploadSpeeds.get(backendSession.sessionId) || [];
              speeds.push(speed);
              if (speeds.length > 10) speeds.shift(); // Keep last 10 samples
              setUploadSpeeds(prev => new Map(prev).set(backendSession.sessionId, speeds));
              
              // 🔧 CRITICAL FIX: Validate speed calculation
              const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
              
              // Calculate time remaining
              const bytesRemaining = Math.max(0, backendSession.fileSize * (1 - backendSession.progress / 100));
              const timeRemaining = (avgSpeed > 0 && bytesRemaining > 0) ? bytesRemaining / avgSpeed : Infinity;
              
              // 🔧 CRITICAL FIX: Validate time remaining
              const validTimeRemaining = (isNaN(timeRemaining) || !isFinite(timeRemaining)) ? Infinity : timeRemaining;
              
              newMap.set(backendSession.sessionId, {
                ...existingSession,
                progress: Math.max(0, Math.min(100, backendSession.progress || 0)),
                status: backendSession.status || 'unknown',
                uploadSpeed: Math.max(0, avgSpeed || 0),
                timeRemaining: validTimeRemaining
              });
            } else {
              // New session or first update
              newMap.set(backendSession.sessionId, {
                sessionId: backendSession.sessionId,
                fileName: backendSession.fileName || 'Unknown File',
                fileSize: Math.max(0, backendSession.fileSize || 0),
                progress: Math.max(0, Math.min(100, backendSession.progress || 0)),
                status: backendSession.status || 'unknown',
                startTime: existingSession?.startTime || Date.now(),
                dealId: backendSession.dealId || 0,
                uploadSpeed: 0,
                timeRemaining: Infinity
              });
            }
            
            setLastUpdateTime(prev => new Map(prev).set(backendSession.sessionId, now));
          }
          
          return newMap;
        });
      });

      // 🔧 CRITICAL FIX: Remove completed sessions after a delay with validation
      const completedSessions = validActiveSessions.filter(
        (u: any) => u.status === 'completed' || u.status === 'failed'
      );

      completedSessions.forEach((session: any) => {
        // 🔧 CRITICAL FIX: Validate session ID before setting timeout
        if (!session.sessionId) {
          console.log(`❌ FloatingUploadProgress: Skipping timeout for invalid sessionId`);
          return;
        }
        
        setTimeout(() => {
          setUploadSessions(prev => {
            const newMap = new Map(prev);
            // Only delete if the status hasn't changed
            const currentSession = newMap.get(session.sessionId);
            if (currentSession && (currentSession.status === 'completed' || currentSession.status === 'failed')) {
              console.log(`🗑️ FloatingUploadProgress: Removing completed session: ${session.sessionId}`);
              newMap.delete(session.sessionId);
            }
            return newMap;
          });
        }, 5000); // Keep completed/failed uploads visible for 5 seconds
      });
    }
  }, [globalUploads]);

  // Handle upload pause
  const pauseUpload = useCallback(async (sessionId: string, isNetworkPause = false) => {
    console.log(`⏸️ Pausing upload: ${sessionId}`);
    
    try {
      await backgroundUploadService.cancelUpload(sessionId);
      
      setUploadSessions(prev => {
        const newMap = new Map(prev);
        const session = newMap.get(sessionId);
        if (session) {
          newMap.set(sessionId, {
            ...session,
            status: isNetworkPause ? 'paused_network' : 'paused',
            pausedAt: Date.now()
          });
        }
        return newMap;
      });
    } catch (error) {
      console.error('Failed to pause upload:', error);
    }
  }, []);

  // Handle upload resume
  const resumeUpload = useCallback(async (sessionId: string) => {
    console.log(`▶️ Resuming upload: ${sessionId}`);
    
    const session = uploadSessions.get(sessionId);
    if (!session) return;

    setUploadSessions(prev => {
      const newMap = new Map(prev);
      const s = newMap.get(sessionId);
      if (s) {
        newMap.set(sessionId, {
          ...s,
          status: 'resuming',
          pausedAt: undefined
        });
      }
      return newMap;
    });

    // TODO: Implement actual resume logic with the backend
    // For now, we'll just update the status
    setTimeout(() => {
      setUploadSessions(prev => {
        const newMap = new Map(prev);
        const s = newMap.get(sessionId);
        if (s) {
          newMap.set(sessionId, {
            ...s,
            status: 'uploading'
          });
        }
        return newMap;
      });
    }, 1000);
  }, [uploadSessions]);

  // Handle upload retry
  const retryUpload = useCallback(async (sessionId: string) => {
    console.log(`🔄 Retrying upload: ${sessionId}`);
    
    const session = uploadSessions.get(sessionId);
    if (!session) return;

    setUploadSessions(prev => {
      const newMap = new Map(prev);
      const s = newMap.get(sessionId);
      if (s) {
        newMap.set(sessionId, {
          ...s,
          status: 'retrying',
          error: undefined,
          retryCount: (s.retryCount || 0) + 1
        });
      }
      return newMap;
    });

    // TODO: Implement actual retry logic
    setTimeout(() => {
      setUploadSessions(prev => {
        const newMap = new Map(prev);
        const s = newMap.get(sessionId);
        if (s) {
          newMap.set(sessionId, {
            ...s,
            status: 'uploading'
          });
        }
        return newMap;
      });
    }, 2000);
  }, [uploadSessions]);

  // Handle upload cancel
  const cancelUpload = useCallback(async (sessionId: string) => {
    console.log(`❌ Cancelling upload: ${sessionId}`);
    
    try {
      await frontendPersistentUploadService.cancelUpload(sessionId);
      
      setUploadSessions(prev => {
        const newMap = new Map(prev);
        newMap.delete(sessionId);
        return newMap;
      });
    } catch (error) {
      console.error('Failed to cancel upload:', error);
    }
  }, []);

  // Debug logging for visibility issues
  console.log('📊 FloatingUploadProgress render check:', {
    sessionCount: uploadSessions.size,
    sessions: Array.from(uploadSessions.values()).map(s => ({
      sessionId: s.sessionId,
      fileName: s.fileName,
      progress: s.progress,
      status: s.status
    }))
  });

  // Don't render if no active uploads
  if (uploadSessions.size === 0) {
    console.log('❌ FloatingUploadProgress: No sessions to display');
    return null;
  }

  const activeUploads = Array.from(uploadSessions.values());
  const totalProgress = activeUploads.reduce((sum, s) => sum + s.progress, 0) / activeUploads.length;
  const hasErrors = activeUploads.some(s => s.status === 'failed' || s.error);
  const isAllComplete = activeUploads.every(s => s.status === 'completed');

  return (
    <div 
      className={cn(
        "fixed bottom-4 right-4 z-[9999] transition-all duration-300",
        isMinimized ? "w-16" : "w-96"
      )}
    >
      {/* Main container */}
      <div className="bg-dark-lighter border border-dark-border rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div 
          className="p-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-dark-border cursor-pointer"
          onClick={() => {
            if (isMinimized) {
              setIsMinimized(false);
              setIsExpanded(true);
            } else {
              setIsExpanded(!isExpanded);
            }
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isMinimized ? (
                <div className="relative">
                  <Upload className="w-5 h-5 text-blue-400" />
                  {hasErrors && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                  {!isAllComplete && !hasErrors && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  )}
                </div>
              ) : (
                <>
                  <div className="relative">
                    {isAllComplete ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : hasErrors ? (
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    ) : (
                      <Upload className="w-5 h-5 text-blue-400 animate-pulse" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {activeUploads.length === 1 
                        ? 'File Upload' 
                        : `${activeUploads.length} Uploads`}
                    </h3>
                    <p className="text-xs text-gray-400">
                      {isAllComplete 
                        ? 'All uploads complete' 
                        : `${Math.round(totalProgress)}% complete`}
                    </p>
                  </div>
                </>
              )}
            </div>
            
            {!isMinimized && (
              <div className="flex items-center gap-1">
                {/* Network status indicator */}
                {isOnline ? (
                  <Wifi className="w-4 h-4 text-green-400" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-400" />
                )}
                
                {/* Expand/Collapse button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronUp className="w-4 h-4" />
                  )}
                </Button>
                
                {/* Minimize button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMinimized(true);
                    setIsExpanded(false);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {!isMinimized && isExpanded && (
          <div className="max-h-96 overflow-y-auto">
            {activeUploads.map((session) => (
              <div 
                key={session.sessionId} 
                className="p-3 border-b border-dark-border last:border-b-0"
              >
                <div className="space-y-2">
                  {/* File info */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <FileArchive className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <p className="text-sm font-medium text-white truncate">
                          {session.fileName}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatBytes(session.fileSize)}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <Progress 
                      value={session.progress} 
                      className="h-2 bg-dark"
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{Math.round(session.progress)}%</span>
                      {session.uploadSpeed && session.uploadSpeed > 0 && (
                        <span>{formatBytes(session.uploadSpeed)}/s</span>
                      )}
                      {session.timeRemaining && session.timeRemaining < Infinity && (
                        <span>{formatTimeRemaining(session.timeRemaining)}</span>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {session.status === 'uploading' && (
                        <>
                          <DownloadCloud className="w-3 h-3 text-blue-400 animate-pulse" />
                          <span className="text-xs text-blue-400">Uploading to cloud...</span>
                        </>
                      )}
                      {session.status === 'processing' && (
                        <>
                          <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />
                          <span className="text-xs text-purple-400">Processing documents...</span>
                        </>
                      )}
                      {session.status === 'paused' && (
                        <>
                          <Pause className="w-3 h-3 text-yellow-400" />
                          <span className="text-xs text-yellow-400">Paused</span>
                        </>
                      )}
                      {session.status === 'paused_network' && (
                        <>
                          <WifiOff className="w-3 h-3 text-orange-400" />
                          <span className="text-xs text-orange-400">Waiting for network...</span>
                        </>
                      )}
                      {session.status === 'failed' && (
                        <>
                          <AlertCircle className="w-3 h-3 text-red-400" />
                          <span className="text-xs text-red-400">Upload failed</span>
                        </>
                      )}
                      {session.status === 'completed' && (
                        <>
                          <CheckCircle className="w-3 h-3 text-green-400" />
                          <span className="text-xs text-green-400">Complete</span>
                        </>
                      )}
                      {session.status === 'retrying' && (
                        <>
                          <RefreshCw className="w-3 h-3 text-yellow-400 animate-spin" />
                          <span className="text-xs text-yellow-400">
                            Retrying... (Attempt {session.retryCount || 1})
                          </span>
                        </>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      {session.status === 'uploading' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1 h-6 w-6"
                          onClick={() => pauseUpload(session.sessionId)}
                          title="Pause upload"
                        >
                          <Pause className="w-3 h-3" />
                        </Button>
                      )}
                      {(session.status === 'paused' || session.status === 'paused_network') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1 h-6 w-6"
                          onClick={() => resumeUpload(session.sessionId)}
                          disabled={session.status === 'paused_network' && !isOnline}
                          title="Resume upload"
                        >
                          <Play className="w-3 h-3" />
                        </Button>
                      )}
                      {session.status === 'failed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1 h-6 w-6"
                          onClick={() => retryUpload(session.sessionId)}
                          title="Retry upload"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                      )}
                      {session.status !== 'completed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1 h-6 w-6 text-red-400 hover:text-red-300"
                          onClick={() => cancelUpload(session.sessionId)}
                          title="Cancel upload"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Error message */}
                  {session.error && (
                    <Alert className="bg-red-500/10 border-red-500/20 py-2">
                      <AlertCircle className="h-3 w-3" />
                      <AlertDescription className="text-xs">
                        {session.error}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload count badge when minimized */}
      {isMinimized && activeUploads.length > 0 && (
        <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          {activeUploads.length}
        </div>
      )}
    </div>
  );
};