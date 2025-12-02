/**
 * Run Clinical Queue Button Component
 * Triggers sequential processing of all clinical questions for a deal
 * Uses shared AgentQueueCard for identical UI across all agents
 */

import { useAgentQueue } from '@/hooks/useAgentQueue';
import { AgentQueueCard, AGENT_CONFIGS } from './agentQueues';

interface RunClinicalQueueButtonProps {
  dealId: number;
  onQueueStart?: () => void;
  onQueueComplete?: () => void;
  onQuestionComplete?: () => void;
  className?: string;
}

export function RunClinicalQueueButton({ 
  dealId, 
  onQueueStart, 
  onQueueComplete,
  onQuestionComplete,
  className 
}: RunClinicalQueueButtonProps) {
  const config = AGENT_CONFIGS.clinical;
  
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
