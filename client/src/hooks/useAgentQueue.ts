/**
 * useAgentQueue Hook
 * Unified hook for managing agent queue state, polling, and actions
 * Used by all 7 agent queue button components
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  AgentQueueConfig, 
  QueueStatus, 
  AgentRunQueueEntry 
} from '@/components/agentQueues/agentQueueConfig';

interface UseAgentQueueOptions {
  dealId: number;
  config: AgentQueueConfig;
  onQueueStart?: () => void;
  onQueueComplete?: () => void;
  onQuestionComplete?: () => void;
}

interface UseAgentQueueReturn {
  isLoading: boolean;
  queueStatus: QueueStatus | null;
  agentQueuePosition: AgentRunQueueEntry | null;
  isQueueActive: boolean;
  isWaitingInQueue: boolean;
  isRunningInQueue: boolean;
  handleForceRerunAll: () => Promise<void>;
  handleCancelQueue: () => Promise<void>;
}

export function useAgentQueue({
  dealId,
  config,
  onQueueStart,
  onQueueComplete,
  onQuestionComplete,
}: UseAgentQueueOptions): UseAgentQueueReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [agentQueuePosition, setAgentQueuePosition] = useState<AgentRunQueueEntry | null>(null);
  const { toast } = useToast();
  
  const prevCompletedRef = useRef<number>(0);

  useEffect(() => {
    const checkQueueStatus = async () => {
      try {
        const [statusResponse, agentQueueResponse] = await Promise.all([
          apiRequest(`/api/deals/${dealId}/${config.apiPath}/queue-status`),
          apiRequest(`/api/deals/${dealId}/agent-run-queue/status`)
        ]);
        
        if (statusResponse.success && statusResponse.status) {
          const newCompleted = statusResponse.status.completed;
          const prevCompleted = prevCompletedRef.current;
          
          if (newCompleted > prevCompleted) {
            console.log(`🎯 ${config.displayName} Question completed! ${prevCompleted} -> ${newCompleted}, invalidating cache for instant display`);
            
            const cacheKeys = config.cacheKeysToInvalidate(dealId);
            cacheKeys.forEach(key => {
              queryClient.invalidateQueries({ queryKey: [key] });
            });
            queryClient.invalidateQueries({ queryKey: [`/api/background-jobs/${dealId}`] });
            
            onQuestionComplete?.();
          }
          
          prevCompletedRef.current = newCompleted;
          setQueueStatus(statusResponse.status);

          if (statusResponse.status.isProcessing === false && 
              statusResponse.status.completed > 0 && 
              statusResponse.status.pending === 0 &&
              statusResponse.status.running === 0) {
            onQueueComplete?.();
          }
        }
        
        if (agentQueueResponse.success && agentQueueResponse.queue) {
          const entry = agentQueueResponse.queue.find(
            (e: AgentRunQueueEntry) => e.agentType === config.agentType
          );
          setAgentQueuePosition(entry || null);
        } else {
          setAgentQueuePosition(null);
        }
      } catch (error) {
        console.error(`Error checking ${config.displayName} queue status:`, error);
      }
    };

    checkQueueStatus();

    const interval = setInterval(checkQueueStatus, config.pollInterval);
    return () => clearInterval(interval);
  }, [dealId, config, onQueueComplete, onQuestionComplete]);

  const handleForceRerunAll = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log(`🔥 FORCE RERUN: Starting ALL ${config.displayName} questions for deal ${dealId}`);
      
      const response = await apiRequest(`/api/deals/${dealId}/${config.apiPath}/force-rerun-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.success) {
        onQueueStart?.();
        
        queryClient.invalidateQueries({ queryKey: [`/api/background-jobs/${dealId}`] });
        
        const message = response.isRunning 
          ? `Started ${response.totalQuestions} questions one-by-one. Each question extracts evidence from ALL documents.`
          : `Queued at position ${response.queuePosition}. ${response.currentRunningAgent ? `Waiting for ${response.currentRunningAgent} agent to complete.` : 'Waiting for other agents to complete.'}`;
        
        toast({
          title: response.isRunning ? "Analysis Started" : "Analysis Queued",
          description: message,
          duration: 10000,
        });
      } else {
        throw new Error(response.error || 'Failed to force rerun');
      }
    } catch (error) {
      console.error(`Error force rerunning ${config.displayName} questions:`, error);
      
      toast({
        title: "Error",
        description: `Failed to force rerun all ${config.displayName} questions`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [dealId, config, onQueueStart, toast]);

  const handleCancelQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log(`🛑 Cancelling ${config.displayName} question queue for deal ${dealId}`);
      
      const response = await apiRequest(`/api/deals/${dealId}/${config.apiPath}/cancel-queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.success) {
        toast({
          title: "Queue Cancelled",
          description: `${config.displayName} analysis queue has been stopped`,
        });
      } else {
        throw new Error(response.error || 'Failed to cancel queue');
      }
    } catch (error) {
      console.error(`Error cancelling ${config.displayName} queue:`, error);
      
      toast({
        title: "Error", 
        description: "Failed to cancel queue",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [dealId, config, toast]);

  const isQueueActive = queueStatus?.isProcessing || 
                       (queueStatus?.pending ?? 0) > 0 || 
                       (queueStatus?.running ?? 0) > 0;
  
  const isWaitingInQueue = agentQueuePosition?.status === 'queued';
  const isRunningInQueue = agentQueuePosition?.status === 'running';

  return {
    isLoading,
    queueStatus,
    agentQueuePosition,
    isQueueActive,
    isWaitingInQueue,
    isRunningInQueue,
    handleForceRerunAll,
    handleCancelQueue,
  };
}
