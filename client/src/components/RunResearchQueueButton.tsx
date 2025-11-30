/**
 * Run Research Queue Button Component
 * Triggers sequential processing of all research questions for a deal
 * Shows real-time progress and queue status
 * EXACT MATCH to RunLegalQueueButton architecture
 */

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Play, Square, Loader2, ChevronDown, RefreshCw } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
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
  currentQuestionId: string | null;
  isProcessing: boolean;
}

interface RunResearchQueueButtonProps {
  dealId: number;
  onQueueStart?: () => void;
  onQueueComplete?: () => void;
  className?: string;
}

export function RunResearchQueueButton({ 
  dealId, 
  onQueueStart, 
  onQueueComplete,
  className 
}: RunResearchQueueButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const checkQueueStatus = async () => {
      try {
        const response = await apiRequest(`/api/deals/${dealId}/research-analysis/queue-status`);
        if (response.success && response.status) {
          setQueueStatus(response.status);

          if (response.status.isProcessing === false && 
              response.status.completed > 0 && 
              response.status.pending === 0 &&
              response.status.running === 0) {
            onQueueComplete?.();
          }
        }
      } catch (error) {
        console.error('Error checking research queue status:', error);
      }
    };

    checkQueueStatus();

    const interval = setInterval(checkQueueStatus, 3000);
    return () => clearInterval(interval);
  }, [dealId, onQueueComplete]);

  const handleForceRerunAll = async () => {
    setIsLoading(true);
    try {
      console.log(`🔥 FORCE RERUN: Starting ALL research questions for deal ${dealId}`);
      
      const response = await apiRequest(`/api/deals/${dealId}/research-analysis/force-rerun-all`, {
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
      console.error('Error force rerunning research questions:', error);
      
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
      console.log(`🛑 Cancelling research question queue for deal ${dealId}`);
      
      const response = await apiRequest(`/api/deals/${dealId}/research-analysis/cancel-queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.success) {
        toast({
          title: "Queue Cancelled",
          description: "Research analysis queue has been stopped",
        });
      } else {
        throw new Error(response.error || 'Failed to cancel queue');
      }
    } catch (error) {
      console.error('Error cancelling research queue:', error);
      
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
      <Card className="bg-gradient-to-br from-purple-600/10 to-purple-600/5 border-purple-600/20">
        <CardContent className="pt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">
                  Processing Research Questions
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
              <span>Pending: {queueStatus.pending}</span>
              <span>Running: {queueStatus.running}</span>
              <span>Done: {queueStatus.completed}</span>
              {queueStatus.failed > 0 && (
                <span className="text-red-400">Failed: {queueStatus.failed}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          disabled={isLoading}
          className={className}
          variant="outline"
          data-testid="button-run-research-queue"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run Research Questions
              <ChevronDown className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem
          onClick={(e) => {
            console.log('Force Rerun All Research menu item clicked!', { dealId, isLoading });
            e.preventDefault();
            e.stopPropagation();
            handleForceRerunAll();
          }}
          disabled={isLoading}
          data-testid="menu-force-rerun-all-research"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          <div className="flex flex-col">
            <span className="font-medium">Force Rerun All Questions</span>
            <span className="text-xs text-gray-400">Re-analyze ALL research questions</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
