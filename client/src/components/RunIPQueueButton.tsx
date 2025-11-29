/**
 * Run IP Queue Button Component
 * Triggers sequential processing of all IP questions for a deal
 * Shows real-time progress and queue status
 * EXACT CLONE of RunHRQueueButton for architectural parity
 * 
 * REAL-TIME ANSWER DISPLAY: Invalidates IP results cache when questions complete
 * so answers appear instantly without page refresh
 */

import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Play, Square, Loader2, ChevronDown, RefreshCw } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from './ui/card';
import { Progress } from './ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface QueueStatus {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  progress: number;
  currentQuestion: string | null;
  currentQuestionId: string | null;  // CRITICAL: Match Legal's contract for per-question progress
  isProcessing: boolean;
}

interface RunIPQueueButtonProps {
  dealId: number;
  onQueueStart?: () => void;
  onQueueComplete?: () => void;
  onQuestionComplete?: () => void;
  className?: string;
}

export function RunIPQueueButton({ 
  dealId, 
  onQueueStart, 
  onQueueComplete,
  onQuestionComplete,
  className 
}: RunIPQueueButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const { toast } = useToast();
  
  const prevCompletedRef = useRef<number>(0);

  useEffect(() => {
    const checkQueueStatus = async () => {
      try {
        const response = await apiRequest(`/api/deals/${dealId}/ip-analysis/queue-status`);
        if (response.success && response.status) {
          const newCompleted = response.status.completed;
          const prevCompleted = prevCompletedRef.current;
          
          if (newCompleted > prevCompleted) {
            console.log(`🎯 IP Question completed! ${prevCompleted} -> ${newCompleted}, invalidating cache for instant display`);
            queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/ip-analysis/comprehensive`] });
            queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/ip-analysis/comprehensive/results`] });
            queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/agents/ip/results`] });
            queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/agents/analysis`] });
            queryClient.invalidateQueries({ queryKey: [`/api/background-jobs/${dealId}`] });
            onQuestionComplete?.();
          }
          
          prevCompletedRef.current = newCompleted;
          setQueueStatus(response.status);

          if (response.status.isProcessing === false && 
              response.status.completed > 0 && 
              response.status.pending === 0 &&
              response.status.running === 0) {
            onQueueComplete?.();
          }
        }
      } catch (error) {
        console.error('Error checking IP queue status:', error);
      }
    };

    checkQueueStatus();

    const interval = setInterval(checkQueueStatus, 2000);
    return () => clearInterval(interval);
  }, [dealId, onQueueComplete, onQuestionComplete]);

  const handleForceRerunAll = async () => {
    setIsLoading(true);
    try {
      console.log(`🔥 FORCE RERUN: Starting ALL IP questions for deal ${dealId}`);
      
      const response = await apiRequest(`/api/deals/${dealId}/ip-analysis/force-rerun-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.success) {
        onQueueStart?.();
        
        toast({
          title: "Sequential IP Analysis Started",
          description: `Running ${response.startedCount} questions one-by-one (${response.estimatedTime}). Each question extracts evidence from ALL documents. Next question starts when current one finishes.`,
          duration: 10000,
        });
      } else {
        throw new Error(response.error || 'Failed to force rerun');
      }
    } catch (error) {
      console.error('Error force rerunning IP questions:', error);
      
      toast({
        title: "Error",
        description: "Failed to force rerun all IP questions",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelQueue = async () => {
    setIsLoading(true);
    try {
      console.log(`🛑 Cancelling IP question queue for deal ${dealId}`);
      
      const response = await apiRequest(`/api/deals/${dealId}/ip-analysis/cancel-queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.success) {
        toast({
          title: "Queue Cancelled",
          description: "IP analysis queue has been stopped",
        });
      } else {
        throw new Error(response.error || 'Failed to cancel queue');
      }
    } catch (error) {
      console.error('Error cancelling IP queue:', error);
      
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

  if (isQueueActive && queueStatus) {
    return (
      <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/5 border-violet-500/20">
        <CardContent className="pt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">
                  Processing IP Questions
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
                data-testid="button-cancel-ip-queue"
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

  return (
    <Button
      onClick={handleForceRerunAll}
      disabled={isLoading}
      className={className}
      data-testid="button-force-rerun-ip"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Starting...
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4 mr-2" />
          Force Rerun All IP Questions
        </>
      )}
    </Button>
  );
}
