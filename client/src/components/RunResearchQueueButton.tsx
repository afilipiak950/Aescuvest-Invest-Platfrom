/**
 * Run Research Queue Button Component
 * Triggers sequential processing of all research questions for a deal
 * Shows real-time progress, queue status, and cross-agent queue position
 * STANDARDIZED: Simple Force Rerun All button (no dropdown)
 */

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Square, Loader2, RefreshCw, Clock } from 'lucide-react';
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
  currentQuestionId: string | null;
  isProcessing: boolean;
}

interface AgentRunQueueEntry {
  agentType: string;
  status: string;
  position: number;
  totalQuestions: number;
  completedQuestions: number;
  currentStep: string | null;
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
  const [agentQueuePosition, setAgentQueuePosition] = useState<AgentRunQueueEntry | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const checkQueueStatus = async () => {
      try {
        const [statusResponse, agentQueueResponse] = await Promise.all([
          apiRequest(`/api/deals/${dealId}/research-analysis/queue-status`),
          apiRequest(`/api/deals/${dealId}/agent-run-queue/status`)
        ]);
        
        if (statusResponse.success && statusResponse.status) {
          setQueueStatus(statusResponse.status);

          if (statusResponse.status.isProcessing === false && 
              statusResponse.status.completed > 0 && 
              statusResponse.status.pending === 0 &&
              statusResponse.status.running === 0) {
            onQueueComplete?.();
          }
        }
        
        // Check agent run queue for this agent's position
        if (agentQueueResponse.success && agentQueueResponse.queue) {
          const researchEntry = agentQueueResponse.queue.find(
            (entry: AgentRunQueueEntry) => entry.agentType === 'research'
          );
          setAgentQueuePosition(researchEntry || null);
        } else {
          setAgentQueuePosition(null);
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
        
        const message = response.isRunning 
          ? `Started ${response.totalQuestions} questions one-by-one. Each question extracts evidence from ALL documents.`
          : `Queued at position ${response.queuePosition}. Waiting for other agents to complete.`;
        
        toast({
          title: response.isRunning ? "Analysis Started" : "Analysis Queued",
          description: message,
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
  
  // Check if this agent is waiting in cross-agent queue (queued but not running)
  const isWaitingInQueue = agentQueuePosition?.status === 'queued';
  const isRunningInQueue = agentQueuePosition?.status === 'running';

  // Show waiting state when queued behind other agents
  if (isWaitingInQueue && agentQueuePosition) {
    return (
      <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
        <CardContent className="pt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400 animate-pulse" />
                <div>
                  <p className="text-sm font-medium text-white">
                    Waiting in Queue (Position {agentQueuePosition.position})
                  </p>
                  <p className="text-xs text-gray-400">
                    Another agent is currently running
                  </p>
                </div>
              </div>
              <Button
                onClick={handleCancelQueue}
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Square className="h-3 w-3 mr-2" />
                    Cancel
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-amber-200">
              Research analysis will start automatically when previous agents complete.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show progress when queue is active (running)
  if ((isQueueActive && queueStatus) || isRunningInQueue) {
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
                  {queueStatus?.completed || agentQueuePosition?.completedQuestions || 0} of {queueStatus?.total || agentQueuePosition?.totalQuestions || 0} completed
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
              value={queueStatus?.progress || 0} 
              className="h-2 bg-dark-lighter"
            />

            {(queueStatus?.currentQuestion || agentQueuePosition?.currentStep) && (
              <p className="text-xs text-gray-300">
                {queueStatus?.currentQuestion || agentQueuePosition?.currentStep}
              </p>
            )}

            <div className="flex gap-4 text-xs text-gray-400">
              <span>⏳ Pending: {queueStatus?.pending || 0}</span>
              <span>▶️ Running: {queueStatus?.running || 0}</span>
              <span>✅ Done: {queueStatus?.completed || 0}</span>
              {(queueStatus?.failed || 0) > 0 && (
                <span className="text-red-400">❌ Failed: {queueStatus?.failed}</span>
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
      data-testid="button-force-rerun-research"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Starting...
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4 mr-2" />
          Force Rerun All Research Questions
        </>
      )}
    </Button>
  );
}
