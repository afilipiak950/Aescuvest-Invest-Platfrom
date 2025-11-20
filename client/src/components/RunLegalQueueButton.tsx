/**
 * Run Legal Queue Button Component
 * Triggers sequential processing of all legal questions for a deal
 * Shows real-time progress and queue status
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
  isProcessing: boolean;
}

interface RunLegalQueueButtonProps {
  dealId: number;
  onQueueStart?: () => void;
  onQueueComplete?: () => void;
  className?: string;
}

export function RunLegalQueueButton({ 
  dealId, 
  onQueueStart, 
  onQueueComplete,
  className 
}: RunLegalQueueButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const { toast } = useToast();

  // Poll queue status
  useEffect(() => {
    const checkQueueStatus = async () => {
      try {
        const response = await apiRequest(`/api/deals/${dealId}/legal-analysis/queue-status`);
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

  const handleStartQueue = async () => {
    setIsLoading(true);
    try {
      console.log(`🚀 Starting legal question queue for deal ${dealId}`);
      
      const response = await apiRequest(`/api/deals/${dealId}/legal-analysis/run-all-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.success) {
        onQueueStart?.();
        
        toast({
          title: "Legal Analysis Queue Started",
          description: `Processing ${response.queuedCount} new questions`,
        });
      } else {
        throw new Error(response.error || 'Failed to start queue');
      }
    } catch (error) {
      console.error('Error starting queue:', error);
      
      toast({
        title: "Error",
        description: "Failed to start legal analysis queue",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceRerunAll = async () => {
    setIsLoading(true);
    try {
      console.log(`🔥 FORCE RERUN: Starting ALL legal questions for deal ${dealId}`);
      
      const response = await apiRequest(`/api/deals/${dealId}/legal-analysis/force-rerun-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.success) {
        onQueueStart?.();
        
        toast({
          title: "Comprehensive Analysis Started",
          description: `Started deep analysis of ${response.startedCount} questions - this will take ${response.estimatedTime}. Each question extracts evidence from ALL documents.`,
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
      console.log(`🛑 Cancelling legal question queue for deal ${dealId}`);
      
      const response = await apiRequest(`/api/deals/${dealId}/legal-analysis/cancel-queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.success) {
        toast({
          title: "Queue Cancelled",
          description: "Legal analysis queue has been stopped",
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
                  Processing Legal Questions
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

  // Show dropdown menu when queue is not active
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          disabled={isLoading}
          className={className}
          data-testid="button-run-legal-queue"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run Legal Questions
              <ChevronDown className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem
          onClick={handleStartQueue}
          disabled={isLoading}
          data-testid="menu-run-new-questions"
        >
          <Play className="h-4 w-4 mr-2" />
          <div className="flex flex-col">
            <span className="font-medium">Run New Questions Only</span>
            <span className="text-xs text-gray-400">Skip already answered questions</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            console.log('🎯 Force Rerun All menu item clicked!', { dealId, isLoading });
            e.preventDefault();
            e.stopPropagation();
            handleForceRerunAll();
          }}
          disabled={isLoading}
          data-testid="menu-force-rerun-all"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          <div className="flex flex-col">
            <span className="font-medium">Force Rerun All Questions</span>
            <span className="text-xs text-gray-400">Re-analyze ALL questions through AI</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
