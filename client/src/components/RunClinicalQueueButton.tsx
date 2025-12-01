/**
 * Run Clinical Queue Button Component
 * Triggers sequential processing of all clinical questions for a deal
 * Shows real-time progress and queue status
 * STANDARDIZED: Simple Force Rerun All button (no dropdown)
 */

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Square, Loader2, RefreshCw } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from './ui/card';
import { Progress } from './ui/progress';

interface QueueStatus {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  progress: number;
  currentQuestion: string | null;
  isProcessing: boolean;
}

interface RunClinicalQueueButtonProps {
  dealId: number;
  onQueueStart?: () => void;
  onQueueComplete?: () => void;
  className?: string;
}

export function RunClinicalQueueButton({ 
  dealId, 
  onQueueStart, 
  onQueueComplete,
  className 
}: RunClinicalQueueButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const { toast } = useToast();

  // Poll queue status
  useEffect(() => {
    const checkQueueStatus = async () => {
      try {
        const response = await apiRequest(`/api/deals/${dealId}/clinical-analysis/queue-status`);
        if (response.success && response.status) {
          setQueueStatus(response.status);

          // Check if queue just completed
          if (response.status.isProcessing === false && 
              response.status.completed > 0 && 
              response.status.pending === 0 &&
              response.status.running === 0) {
            onQueueComplete?.();
          }
        }
      } catch (error) {
        console.error('Error checking queue status:', error);
      }
    };

    checkQueueStatus();

    // Poll every 3 seconds when queue is processing
    const interval = setInterval(checkQueueStatus, 3000);
    return () => clearInterval(interval);
  }, [dealId, onQueueComplete]);

  const handleForceRerunAll = async () => {
    setIsLoading(true);
    try {
      console.log(`🔥 FORCE RERUN: Starting ALL clinical questions for deal ${dealId}`);
      
      const response = await apiRequest(`/api/deals/${dealId}/clinical-analysis/force-rerun-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.success) {
        onQueueStart?.();
        
        toast({
          title: "Sequential Analysis Started",
          description: `Running ${response.startedCount} questions one-by-one (${response.estimatedTime}). Each question extracts evidence from ALL documents. Next question starts when current one finishes.`,
          duration: 10000,
        });
      } else {
        throw new Error(response.error || 'Failed to force rerun');
      }
    } catch (error) {
      console.error('Error force rerunning questions:', error);
      
      toast({
        title: "Error",
        description: "Failed to force rerun all questions",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelQueue = async () => {
    setIsLoading(true);
    try {
      console.log(`🛑 Cancelling clinical question queue for deal ${dealId}`);
      
      const response = await apiRequest(`/api/deals/${dealId}/clinical-analysis/cancel-queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.success) {
        toast({
          title: "Queue Cancelled",
          description: "Clinical analysis queue has been stopped",
        });
      } else {
        throw new Error(response.error || 'Failed to cancel queue');
      }
    } catch (error) {
      console.error('Error cancelling queue:', error);
      
      toast({
        title: "Error", 
        description: "Failed to cancel queue",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isQueueActive = queueStatus?.isProcessing || 
                       (queueStatus?.pending ?? 0) > 0 || 
                       (queueStatus?.running ?? 0) > 0;

  // Show progress when queue is active
  if (isQueueActive && queueStatus) {
    return (
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">
                  Processing Clinical Questions
                </p>
                <p className="text-xs text-gray-400">
                  {queueStatus.completed} of {queueStatus.total} completed
                </p>
              </div>
              <Button
                onClick={handleCancelQueue}
                disabled={isLoading}
                variant="destructive"
                size="sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <Square className="h-3 w-3 mr-2" />
                    Cancel
                  </>
                )}
              </Button>
            </div>

            <Progress 
              value={queueStatus.progress} 
              className="h-2 bg-dark-lighter"
            />

            {queueStatus.currentQuestion && (
              <p className="text-xs text-gray-300">
                {queueStatus.currentQuestion}
              </p>
            )}

            <div className="flex gap-4 text-xs text-gray-400">
              <span>⏳ Pending: {queueStatus.pending}</span>
              <span>▶️ Running: {queueStatus.running}</span>
              <span>✅ Done: {queueStatus.completed}</span>
              {queueStatus.failed > 0 && (
                <span className="text-red-400">❌ Failed: {queueStatus.failed}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show Force Rerun All button when queue is not active
  return (
    <Button
      onClick={handleForceRerunAll}
      disabled={isLoading}
      className={className}
      data-testid="button-force-rerun-clinical"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Starting...
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4 mr-2" />
          Force Rerun All Clinical Questions
        </>
      )}
    </Button>
  );
}
