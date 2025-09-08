import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2, StopCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface JobProgress {
  jobId: number;
  progress: number;
  status: string;
  currentStep: string;
  documentName?: string;
  error?: string;
}

interface BackgroundJobProgressProps {
  dealId?: number;
  onJobComplete?: (jobId: number, result: any) => void;
}

export function BackgroundJobProgress({ dealId, onJobComplete }: BackgroundJobProgressProps) {
  const [activeJobs, setActiveJobs] = useState<Map<number, JobProgress>>(new Map());
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const queryClient = useQueryClient();

  // Mutation to cancel a job
  const cancelJobMutation = useMutation({
    mutationFn: async (jobId: string | number) => {
      // Use the correct endpoint based on job ID format
      const endpoint = typeof jobId === 'string' ? 'stop' : 'cancel';
      return apiRequest(`/api/background-jobs/${jobId}/${endpoint}`, {
        method: 'POST',
      });
    },
    onSuccess: (data, jobId) => {
      // Remove the job from active jobs immediately
      setActiveJobs(prev => {
        const updated = new Map(prev);
        updated.delete(jobId);
        return updated;
      });
      
      // Invalidate background jobs query to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/background-jobs', dealId] });
    },
    onError: (error) => {
      console.error('Failed to cancel job:', error);
    }
  });

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let isConnecting = false;

    const connect = () => {
      if (isConnecting || (ws && ws.readyState === WebSocket.CONNECTING)) {
        return;
      }

      isConnecting = true;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected for progress tracking');
        setSocket(ws);
        isConnecting = false;
        
        // Subscribe to deal-specific updates if dealId provided
        if (dealId && ws) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            dealId: dealId
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'job_progress') {
            const progress: JobProgress = message.data;
            setActiveJobs(prev => {
              const updated = new Map(prev);
              updated.set(progress.jobId, progress);
              return updated;
            });
          } else if (message.type === 'job_complete') {
            const { jobId, result } = message.data;
            
            // Invalidate documents cache when AI summary jobs complete
            if (dealId && result?.success) {
              queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
            }
            
            // Remove completed job after a delay
            setTimeout(() => {
              setActiveJobs(prev => {
                const updated = new Map(prev);
                updated.delete(jobId);
                return updated;
              });
            }, 5000);
            
            // Notify parent component
            if (onJobComplete) {
              onJobComplete(jobId, result);
            }
          } else if (message.type === 'job_cancelled') {
            const { jobId } = message.data;
            
            // Remove cancelled job immediately
            setActiveJobs(prev => {
              const updated = new Map(prev);
              updated.delete(jobId);
              return updated;
            });
            
            console.log(`🛑 Job ${jobId} was cancelled`);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setSocket(null);
        isConnecting = false;
        
        // Reconnect after 2 seconds
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, 2000);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        isConnecting = false;
      };
    };

    connect();

    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (ws) {
        ws.close();
      }
    };
  }, [dealId, onJobComplete]);

  // Add polling as fallback for progress updates
  useEffect(() => {
    if (!dealId) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/background-jobs/${dealId}`);
        const data = await response.json();
        
        if (data.success && data.jobs) {
          // Filter out legal analysis jobs from logging since they use their own progress endpoint
          const nonLegalJobs = data.jobs.filter((job: JobProgress) => !job.jobId.toString().includes('legal_analysis'));
          
          if (nonLegalJobs.length > 0) {
            console.log(`📊 Polling found ${nonLegalJobs.length} active jobs for deal ${dealId}`);
            nonLegalJobs.forEach((job: JobProgress) => {
              console.log(`📋 Job ${job.jobId}: ${job.progress}% - ${job.currentStep}`);
            });
          }
          
          const jobsMap = new Map();
          data.jobs.forEach((job: JobProgress) => {
            jobsMap.set(job.jobId, job);
          });
          setActiveJobs(jobsMap);
        }
      } catch (error) {
        console.error('Error polling background jobs:', error);
      }
    }, 5000); // Poll every 5 seconds - reduced from 1s for performance

    return () => clearInterval(pollInterval);
  }, [dealId]);

  const getStatusIcon = (status: string, progress: number) => {
    if (status === 'failed') {
      return <XCircle className="h-4 w-4 text-red-500" />;
    } else if (status === 'completed' || progress === 100) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    } else {
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    }
  };

  const getStatusBadge = (status: string, progress: number) => {
    if (status === 'failed') {
      return <Badge variant="destructive">Failed</Badge>;
    } else if (status === 'completed' || progress === 100) {
      return <Badge variant="default" className="bg-green-500">Completed</Badge>;
    } else {
      return <Badge variant="secondary">Processing</Badge>;
    }
  };

  // Always render the container, but show different content based on job status
  if (activeJobs.size === 0) {
    return (
      <div className="fixed top-4 right-4 z-50 w-96">
        {/* Placeholder for when polling detects jobs */}
      </div>
    );
  }

  if (Array.from(activeJobs.values()).length === 0) {
    return null;
  }

  // Filter out agent analysis jobs to hide them from UI
  const visibleJobs = Array.from(activeJobs.values()).filter(job => 
    !job.jobId.toString().includes('analysis')
  );

  // Don't render anything if only agent analysis jobs are running
  if (visibleJobs.length === 0) {
    return null;
  }

  return (
    <div className="w-full space-y-3 mb-4">
      {visibleJobs.map((job) => (
        <div key={job.jobId} className="bg-dark-light border border-dark-lighter rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-white text-sm font-medium">
              {getStatusIcon(job.status, job.progress)}
              ZIP Analysis Processing
            </div>
            <div className="flex items-center gap-2">
              {job.status === 'processing' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => cancelJobMutation.mutate(job.jobId)}
                  disabled={cancelJobMutation.isPending}
                  className="h-7 px-3 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  <StopCircle className="h-3 w-3 mr-1" />
                  {cancelJobMutation.isPending ? 'Stopping...' : 'Stop'}
                </Button>
              )}
              {getStatusBadge(job.status, job.progress)}
            </div>
          </div>
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-gray-300 mb-2">
                <div className="flex flex-col">
                  <span>{job.currentStep}</span>
                  {job.progress > 0 && job.progress < 100 && (
                    <div className="text-xs text-blue-400 mt-1">
                      {job.totalFiles && job.processedFiles !== undefined && (
                        <span className="mr-4">
                          Files: {job.processedFiles}/{job.totalFiles}
                        </span>
                      )}
                      {job.estimatedTimeRemaining && (
                        <span>Est. remaining: {job.estimatedTimeRemaining}</span>
                      )}
                    </div>
                  )}
                </div>
                <span className="font-bold text-blue-400">{job.progress}%</span>
              </div>
              <Progress value={job.progress} className="h-2 bg-dark" />
            </div>
            
            {job.documentName && (
              <div className="text-xs text-gray-400 bg-dark p-2 rounded">
                <span className="font-medium text-blue-300">Current file:</span>
                <div className="mt-1 text-white truncate">{job.documentName}</div>
              </div>
            )}
            
            {job.error && (
              <div className="text-xs text-red-300 bg-red-900/20 p-2 rounded border border-red-500/30">
                <span className="font-medium">Error:</span> {job.error}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}