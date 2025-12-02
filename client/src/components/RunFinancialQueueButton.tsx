/**
 * Run Financial Queue Button Component
 * Triggers sequential processing of all Financial questions for a deal
 * Uses shared AgentQueueCard for identical UI across all agents
 */

import { useAgentQueue } from '@/hooks/useAgentQueue';
import { AgentQueueCard, AGENT_CONFIGS } from './agentQueues';

interface RunFinancialQueueButtonProps {
  dealId: number;
  onQueueStart?: () => void;
  onQueueComplete?: () => void;
  onQuestionComplete?: () => void;
  className?: string;
}

export function RunFinancialQueueButton({ 
  dealId, 
  onQueueStart, 
  onQueueComplete,
  onQuestionComplete,
  className 
}: RunFinancialQueueButtonProps) {
  const config = AGENT_CONFIGS.financial;
  
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
