/**
 * Run HR Queue Button Component
 * Triggers sequential processing of all HR questions for a deal
 * Uses shared AgentQueueCard for identical UI across all agents
 */

import { useAgentQueue } from '@/hooks/useAgentQueue';
import { AgentQueueCard, AGENT_CONFIGS } from './agentQueues';

interface RunHRQueueButtonProps {
  dealId: number;
  onQueueStart?: () => void;
  onQueueComplete?: () => void;
  onQuestionComplete?: () => void;
  className?: string;
}

export function RunHRQueueButton({ 
  dealId, 
  onQueueStart, 
  onQueueComplete,
  onQuestionComplete,
  className 
}: RunHRQueueButtonProps) {
  const config = AGENT_CONFIGS.hr;
  
  const {
    isLoading,
    queueStatus,
    agentQueuePosition,
    isQueueActive,
    isWaitingInQueue,
    isRunningInQueue,
    handleForceRerunAll,
    handleCancelQueue,
  } = useAgentQueue({
    dealId,
    config,
    onQueueStart,
    onQueueComplete,
    onQuestionComplete,
  });

  return (
    <AgentQueueCard
      config={config}
      isLoading={isLoading}
      queueStatus={queueStatus}
      agentQueuePosition={agentQueuePosition}
      isQueueActive={isQueueActive}
      isWaitingInQueue={isWaitingInQueue}
      isRunningInQueue={isRunningInQueue}
      onForceRerunAll={handleForceRerunAll}
      onCancelQueue={handleCancelQueue}
      className={className}
    />
  );
}
