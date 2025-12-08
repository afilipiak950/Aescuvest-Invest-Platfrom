/**
 * MemoSectionQueueCard Component
 * 
 * Force Rerun button for individual memo sections.
 * Follows the same visual design as AgentQueueCard for consistency.
 * 
 * Shows 3 states:
 * - Idle: Force Rerun Section button
 * - Processing: Progress bar with cancel option  
 * - Completed: Shows quality score and option to rerun
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Square, Loader2, RefreshCw, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { SectionRerunStatus } from '@/hooks/useMemoSectionQueue';

interface MemoSectionQueueCardProps {
  sectionName: string;
  displayName: string;
  description?: string;
  requiredAgents: string[];
  qualityThreshold: number;
  status: SectionRerunStatus | null;
  isLoading: boolean;
  isProcessing: boolean;
  onForceRerun: () => void;
  onCancel: () => void;
  className?: string;
}

export function MemoSectionQueueCard({
  sectionName,
  displayName,
  description,
  requiredAgents,
  qualityThreshold,
  status,
  isLoading,
  isProcessing,
  onForceRerun,
  onCancel,
  className,
}: MemoSectionQueueCardProps) {
  if (isProcessing && status) {
    return (
      <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
        <CardContent className="pt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">
                  Regenerating {displayName}
                </p>
                <p className="text-xs text-gray-400">
                  {status.currentStep || 'Processing...'}
                </p>
              </div>
              <Button
                onClick={onCancel}
                disabled={isLoading}
                variant="destructive"
                size="icon"
                className="h-8 w-8 shrink-0"
                data-testid={`button-cancel-memo-section-${sectionName}`}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </Button>
            </div>

            <Progress 
              value={status.progress || 0} 
              className="h-2 bg-dark-lighter"
            />

            <div className="flex gap-4 text-xs text-gray-400">
              <span>Progress: {status.progress}%</span>
              {status.qualityScore !== undefined && (
                <span>Quality: {status.qualityScore}/100</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status?.status === 'completed') {
    const meetsThreshold = (status.qualityScore || 0) >= qualityThreshold;
    
    return (
      <Card className={meetsThreshold 
        ? "bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20"
        : "bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20"
      }>
        <CardContent className="pt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {meetsThreshold ? (
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                )}
                <div>
                  <p className="text-sm font-medium text-white">
                    {displayName}
                  </p>
                  <p className="text-xs text-gray-400">
                    Quality: {status.qualityScore}/100 
                    {status.citationCount !== undefined && ` • ${status.citationCount} citations`}
                    {status.metricCount !== undefined && ` • ${status.metricCount} data points`}
                  </p>
                </div>
              </div>
              <Button
                onClick={onForceRerun}
                disabled={isLoading}
                variant="outline"
                size="sm"
                className="gap-2 border-gray-600 hover:border-gray-500"
                data-testid={`button-rerun-memo-section-${sectionName}`}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Rerun
              </Button>
            </div>

            {!meetsThreshold && (
              <p className="text-xs text-amber-200">
                Quality below threshold ({qualityThreshold}). Consider rerunning for better results.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status?.status === 'failed') {
    return (
      <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
        <CardContent className="pt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <div>
                  <p className="text-sm font-medium text-white">
                    {displayName} - Failed
                  </p>
                  <p className="text-xs text-red-300">
                    {status.currentStep || 'Generation failed'}
                  </p>
                </div>
              </div>
              <Button
                onClick={onForceRerun}
                disabled={isLoading}
                variant="outline"
                size="sm"
                className="gap-2 border-red-600 hover:border-red-500 text-red-400"
                data-testid={`button-retry-memo-section-${sectionName}`}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Retry
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700/50 ${className || ''}`}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-white">
                {displayName}
              </p>
              {description && (
                <p className="text-xs text-gray-400 max-w-xs truncate">
                  {description}
                </p>
              )}
              <p className="text-xs text-gray-500">
                Agents: {requiredAgents.join(', ')}
              </p>
            </div>
          </div>
          <Button
            onClick={onForceRerun}
            disabled={isLoading}
            variant="default"
            size="sm"
            className="gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600"
            data-testid={`button-force-rerun-memo-section-${sectionName}`}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Force Rerun Section
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
