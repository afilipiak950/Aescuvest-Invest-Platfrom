/**
 * MemoSectionProgressPanel Component
 * 
 * A prominent, always-visible panel that shows:
 * 1. Global banner when any section is being regenerated (with progress bar)
 * 2. Grid of all 12 memo sections with status indicators
 * 3. Easy access to Force Rerun buttons for each section
 * 
 * This solves the UX problem of hidden progress - users can always see
 * which section is running and its current progress.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  RefreshCw, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  FileText,
  Square,
  ChevronDown,
  ChevronUp,
  Zap,
  Clock
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface SectionStatus {
  sectionName: string;
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentStep: string;
  qualityScore?: number;
  citationCount?: number;
  metricCount?: number;
}

interface SectionConfig {
  sectionName: string;
  displayName: string;
  requiredAgents: string[];
  qualityThreshold: number;
  description: string;
}

const SECTION_CONFIGS: SectionConfig[] = [
  { sectionName: 'executiveSummary', displayName: 'Executive Summary', requiredAgents: ['financial', 'commercial', 'clinical', 'legal'], qualityThreshold: 85, description: 'High-level investment overview' },
  { sectionName: 'financialAnalysis', displayName: 'Financial Analysis', requiredAgents: ['financial'], qualityThreshold: 90, description: 'Revenue, metrics, projections' },
  { sectionName: 'marketAnalysis', displayName: 'Market Analysis', requiredAgents: ['commercial'], qualityThreshold: 85, description: 'Market size and opportunity' },
  { sectionName: 'clinicalEvidence', displayName: 'Clinical Evidence', requiredAgents: ['clinical'], qualityThreshold: 85, description: 'Clinical data and trials' },
  { sectionName: 'regulatoryPathway', displayName: 'Regulatory Pathway', requiredAgents: ['clinical', 'legal'], qualityThreshold: 85, description: 'FDA/regulatory strategy' },
  { sectionName: 'intellectualProperty', displayName: 'Intellectual Property', requiredAgents: ['ip'], qualityThreshold: 85, description: 'Patents and IP portfolio' },
  { sectionName: 'teamAssessment', displayName: 'Team Assessment', requiredAgents: ['hr'], qualityThreshold: 85, description: 'Leadership and team' },
  { sectionName: 'competitiveAnalysis', displayName: 'Competitive Analysis', requiredAgents: ['commercial', 'research'], qualityThreshold: 85, description: 'Competitor landscape' },
  { sectionName: 'riskAnalysis', displayName: 'Risk Analysis', requiredAgents: ['legal', 'financial', 'clinical'], qualityThreshold: 85, description: 'Key risks and mitigations' },
  { sectionName: 'technologyAssessment', displayName: 'Technology Assessment', requiredAgents: ['research', 'ip', 'clinical'], qualityThreshold: 85, description: 'Tech differentiation' },
  { sectionName: 'investmentTerms', displayName: 'Investment Terms', requiredAgents: ['financial', 'legal'], qualityThreshold: 85, description: 'Deal structure and terms' },
  { sectionName: 'coverPage', displayName: 'Cover Page', requiredAgents: ['financial', 'commercial'], qualityThreshold: 85, description: 'Company overview' },
];

interface MemoSectionProgressPanelProps {
  dealId: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onSectionComplete?: (sectionName: string) => void;
}

export function MemoSectionProgressPanel({
  dealId,
  isExpanded = true,
  onToggleExpand,
  onSectionComplete,
}: MemoSectionProgressPanelProps) {
  const [sectionStatuses, setSectionStatuses] = useState<Record<string, SectionStatus>>({});
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState(isExpanded);
  const { toast } = useToast();

  const fetchAllStatuses = useCallback(async () => {
    try {
      const statusPromises = SECTION_CONFIGS.map(async (config) => {
        try {
          const response = await apiRequest(`/api/deals/${dealId}/memo/sections/${config.sectionName}/status`);
          return {
            sectionName: config.sectionName,
            status: response.status || 'idle',
            progress: response.progress || 0,
            currentStep: response.currentStep || '',
            qualityScore: response.qualityScore,
            citationCount: response.citationCount,
            metricCount: response.metricCount,
          };
        } catch {
          return {
            sectionName: config.sectionName,
            status: 'idle' as const,
            progress: 0,
            currentStep: '',
          };
        }
      });

      const statuses = await Promise.all(statusPromises);
      const statusMap: Record<string, SectionStatus> = {};
      statuses.forEach(s => {
        statusMap[s.sectionName] = s;
      });
      setSectionStatuses(statusMap);
    } catch (error) {
      console.error('Error fetching section statuses:', error);
    }
  }, [dealId]);

  useEffect(() => {
    if (!dealId) return;

    fetchAllStatuses();
    const interval = setInterval(fetchAllStatuses, 2000);
    return () => clearInterval(interval);
  }, [dealId, fetchAllStatuses]);

  const handleForceRerun = async (sectionName: string) => {
    setIsLoading(prev => ({ ...prev, [sectionName]: true }));
    try {
      const response = await apiRequest(`/api/deals/${dealId}/memo/sections/${sectionName}/force-rerun`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.success) {
        setSectionStatuses(prev => ({
          ...prev,
          [sectionName]: {
            sectionName,
            status: 'processing',
            progress: 0,
            currentStep: 'Starting...',
          }
        }));

        toast({
          title: "Section Regeneration Started",
          description: `Regenerating ${sectionName.replace(/([A-Z])/g, ' $1').trim()} with fresh analysis`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || 'Failed to start regeneration',
        variant: "destructive"
      });
    } finally {
      setIsLoading(prev => ({ ...prev, [sectionName]: false }));
    }
  };

  const handleCancel = async (sectionName: string) => {
    setIsLoading(prev => ({ ...prev, [sectionName]: true }));
    try {
      await apiRequest(`/api/deals/${dealId}/memo/sections/${sectionName}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      setSectionStatuses(prev => ({
        ...prev,
        [sectionName]: {
          ...prev[sectionName],
          status: 'cancelled',
        }
      }));

      toast({
        title: "Cancelled",
        description: "Section regeneration cancelled",
      });
    } catch (error) {
      console.error('Error cancelling:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, [sectionName]: false }));
    }
  };

  const activeSection = SECTION_CONFIGS.find(
    config => sectionStatuses[config.sectionName]?.status === 'processing'
  );
  const activeStatus = activeSection ? sectionStatuses[activeSection.sectionName] : null;

  const processingCount = Object.values(sectionStatuses).filter(
    s => s.status === 'processing' || s.status === 'pending'
  ).length;

  const completedCount = Object.values(sectionStatuses).filter(
    s => s.status === 'completed'
  ).length;

  return (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700" data-testid="memo-section-progress-panel">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-yellow-400" />
            Section Regeneration Control
            {processingCount > 0 && (
              <Badge variant="secondary" className="ml-2 bg-blue-500/20 text-blue-300">
                {processingCount} Running
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setExpanded(!expanded);
              onToggleExpand?.();
            }}
            data-testid="button-toggle-section-panel"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {activeSection && activeStatus && (
        <div className="mx-4 mb-3 p-4 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30" data-testid="active-section-banner">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Loader2 className="h-6 w-6 text-blue-400 animate-spin" />
                <div className="absolute inset-0 h-6 w-6 bg-blue-400/20 rounded-full animate-ping" />
              </div>
              <div>
                <p className="text-base font-semibold text-white" data-testid="active-section-name">
                  Regenerating: {activeSection.displayName}
                </p>
                <p className="text-sm text-blue-200" data-testid="active-section-step">
                  {activeStatus.currentStep || 'Processing...'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-blue-500/30 text-blue-200" data-testid="active-section-threshold">
                Threshold: {activeSection.qualityThreshold}+
              </Badge>
              <Button
                onClick={() => handleCancel(activeSection.sectionName)}
                disabled={isLoading[activeSection.sectionName]}
                variant="destructive"
                size="sm"
                data-testid="button-cancel-active-section"
              >
                <Square className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-blue-200">Progress</span>
              <span className="text-white font-medium" data-testid="active-section-progress-percent">{activeStatus.progress}%</span>
            </div>
            <Progress 
              value={activeStatus.progress} 
              className="h-3 bg-slate-700"
              data-testid="active-section-progress-bar"
            />
          </div>
        </div>
      )}

      {expanded && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="section-grid">
            {SECTION_CONFIGS.map((config) => {
              const status = sectionStatuses[config.sectionName];
              const isProcessing = status?.status === 'processing' || status?.status === 'pending';
              const isCompleted = status?.status === 'completed';
              const isFailed = status?.status === 'failed';
              const sectionLoading = isLoading[config.sectionName];

              return (
                <div
                  key={config.sectionName}
                  className={cn(
                    "p-3 rounded-lg border transition-all",
                    isProcessing && "bg-blue-500/10 border-blue-500/30 ring-2 ring-blue-500/20",
                    isCompleted && "bg-emerald-500/10 border-emerald-500/30",
                    isFailed && "bg-red-500/10 border-red-500/30",
                    !isProcessing && !isCompleted && !isFailed && "bg-slate-800/50 border-slate-700/50 hover:border-slate-600"
                  )}
                  data-testid={`section-card-${config.sectionName}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {isProcessing && <Loader2 className="h-4 w-4 text-blue-400 animate-spin flex-shrink-0" />}
                        {isCompleted && <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />}
                        {isFailed && <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />}
                        {!isProcessing && !isCompleted && !isFailed && <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                        <p className="text-sm font-medium text-white truncate" data-testid={`section-name-${config.sectionName}`}>
                          {config.displayName}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {config.description}
                      </p>
                      {isProcessing && status && (
                        <div className="mt-2 space-y-1">
                          <Progress value={status.progress} className="h-1.5 bg-slate-700" />
                          <p className="text-xs text-blue-300">{status.progress}% - {status.currentStep || 'Processing...'}</p>
                        </div>
                      )}
                      {isCompleted && status?.qualityScore !== undefined && (
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          <span className={cn(
                            "font-medium",
                            status.qualityScore >= config.qualityThreshold ? "text-emerald-400" : "text-amber-400"
                          )}>
                            Quality: {status.qualityScore}/100
                          </span>
                          {status.citationCount !== undefined && (
                            <span className="text-gray-400">{status.citationCount} citations</span>
                          )}
                        </div>
                      )}
                      {isFailed && (
                        <p className="text-xs text-red-300 mt-1">{status?.currentStep || 'Generation failed'}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {isProcessing ? (
                        <Button
                          onClick={() => handleCancel(config.sectionName)}
                          disabled={sectionLoading}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                          data-testid={`button-cancel-${config.sectionName}`}
                        >
                          {sectionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleForceRerun(config.sectionName)}
                          disabled={sectionLoading}
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-8 px-2 gap-1",
                            isCompleted ? "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20" : "text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                          )}
                          data-testid={`button-rerun-${config.sectionName}`}
                        >
                          {sectionLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          <span className="text-xs">{isCompleted ? 'Rerun' : 'Run'}</span>
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline" className="text-xs border-slate-600 text-gray-400">
                      <Clock className="h-3 w-3 mr-1" />
                      {config.qualityThreshold}+ required
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
