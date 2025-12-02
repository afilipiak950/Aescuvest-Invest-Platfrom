/**
 * AgentQueueCard Component
 * Shared presentational component for all 7 agent queue buttons
 * Renders 3 states: waiting, processing, or idle (force rerun button)
 * 
 * IDENTICAL ARCHITECTURE FOR ALL AGENTS:
 * - Same visual design (gradient card, progress bar, status counts)
 * - Same data flow (queue status, agent queue position)
 * - Same functionality (cancel, progress tracking)
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Square, Loader2, RefreshCw, Clock } from 'lucide-react';
import { AgentQueueConfig, QueueStatus, AgentRunQueueEntry } from './agentQueueConfig';

interface AgentQueueCardProps {
  config: AgentQueueConfig;
  isLoading: boolean;
  queueStatus: QueueStatus | null;
  agentQueuePosition: AgentRunQueueEntry | null;
  isQueueActive: boolean;
  isWaitingInQueue: boolean;
  isRunningInQueue: boolean;
  onForceRerunAll: () => void;
  onCancelQueue: () => void;
  className?: string;
}

export function AgentQueueCard({
  config,
  isLoading,
  queueStatus,
  agentQueuePosition,
  isQueueActive,
  isWaitingInQueue,
  isRunningInQueue,
  onForceRerunAll,
  onCancelQueue,
  className,
}: AgentQueueCardProps) {
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
                onClick={onCancelQueue}
                disabled={isLoading}
                variant="outline"
                size="sm"
                data-testid={`button-cancel-${config.testId}-waiting`}
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
              {config.displayName} analysis will start automatically when previous agents complete.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if ((isQueueActive && queueStatus) || isRunningInQueue) {
    return (
      <Card className={config.processingGradient}>
        <CardContent className="pt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">
                  Processing {config.displayName} Questions
                </p>
                <p className="text-xs text-gray-400">
                  {queueStatus?.completed || agentQueuePosition?.completedQuestions || 0} of {queueStatus?.total || agentQueuePosition?.totalQuestions || 0} completed
                </p>
              </div>
              <Button
                onClick={onCancelQueue}
                disabled={isLoading}
                variant="destructive"
                size="sm"
                data-testid={`button-cancel-${config.testId}-queue`}
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

  return (
    <Button
      onClick={onForceRerunAll}
      disabled={isLoading}
      className={className}
      data-testid={`button-force-rerun-${config.testId}`}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Starting...
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4 mr-2" />
          Force Rerun All
        </>
      )}
    </Button>
  );
}
