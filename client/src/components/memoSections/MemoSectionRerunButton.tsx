/**
 * MemoSectionRerunButton Component
 * 
 * Wrapper component that combines useMemoSectionQueue hook with MemoSectionQueueCard
 * for a complete Force Rerun solution for a single memo section.
 * 
 * Drop this component into any memo section header to enable per-section regeneration.
 */

import { useMemoSectionQueue } from '@/hooks/useMemoSectionQueue';
import { MemoSectionQueueCard } from './MemoSectionQueueCard';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

interface MemoSectionRerunButtonProps {
  dealId: number;
  sectionName: string;
  displayName: string;
  description?: string;
  requiredAgents?: string[];
  qualityThreshold?: number;
  variant?: 'inline' | 'card';
  onRerunComplete?: () => void;
  className?: string;
}

/**
 * Default agent mappings - mirrors MEMO_SECTION_CONFIGS from server
 * These are used as fallbacks; ideally fetch from /api/memo/sections
 */
const DEFAULT_AGENTS: Record<string, string[]> = {
  coverPage: ['financial', 'commercial', 'legal'],
  executiveSummary: ['financial', 'commercial', 'clinical', 'legal'],
  financialAnalysis: ['financial'],
  teamAssessment: ['hr'],
  marketAnalysis: ['commercial'],
  riskAnalysis: ['legal', 'financial', 'clinical', 'commercial'],
  regulatoryPathway: ['clinical', 'legal'],
  clinicalEvidence: ['clinical'],
  intellectualProperty: ['ip'],
  investmentTerms: ['financial', 'legal'],
  competitiveAnalysis: ['commercial', 'research'],
  technologyAssessment: ['research', 'ip', 'clinical'],
};

/**
 * Default quality thresholds - mirrors MEMO_SECTION_CONFIGS from server
 * CRITICAL: financialAnalysis requires 90+ (stricter than default 85)
 */
const DEFAULT_THRESHOLDS: Record<string, number> = {
  coverPage: 85,
  executiveSummary: 85,
  financialAnalysis: 90, // Stricter threshold for financial sections
  teamAssessment: 85,
  marketAnalysis: 85,
  riskAnalysis: 85,
  regulatoryPathway: 85,
  clinicalEvidence: 85,
  intellectualProperty: 85,
  investmentTerms: 85,
  competitiveAnalysis: 85,
  technologyAssessment: 85,
};

export function MemoSectionRerunButton({
  dealId,
  sectionName,
  displayName,
  description,
  requiredAgents,
  qualityThreshold,
  variant = 'inline',
  onRerunComplete,
  className,
}: MemoSectionRerunButtonProps) {
  const { toast } = useToast();
  
  const agents = requiredAgents || DEFAULT_AGENTS[sectionName] || ['financial'];
  const threshold = qualityThreshold || DEFAULT_THRESHOLDS[sectionName] || 85;
  
  const {
    isLoading,
    status,
    isProcessing,
    handleForceRerun,
    handleCancel,
  } = useMemoSectionQueue({
    dealId,
    sectionName,
    pollInterval: 2000,
    onRerunComplete: (qualityScore) => {
      toast({
        title: "Section Regenerated",
        description: `${displayName} updated with quality score: ${qualityScore}/100`,
        duration: 5000,
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'memo'] });
      
      onRerunComplete?.();
    },
    onError: (error) => {
      toast({
        title: "Regeneration Failed",
        description: error,
        variant: "destructive",
      });
    },
  });

  if (variant === 'card') {
    return (
      <MemoSectionQueueCard
        sectionName={sectionName}
        displayName={displayName}
        description={description}
        requiredAgents={agents}
        qualityThreshold={threshold}
        status={status}
        isLoading={isLoading}
        isProcessing={isProcessing}
        onForceRerun={handleForceRerun}
        onCancel={handleCancel}
        className={className}
      />
    );
  }

  if (isProcessing) {
    return (
      <Button
        onClick={handleCancel}
        disabled={isLoading}
        variant="outline"
        size="sm"
        className={`gap-1.5 text-blue-400 border-blue-500/30 hover:border-blue-400/50 ${className || ''}`}
        data-testid={`button-memo-section-rerun-${sectionName}-processing`}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="text-xs">
          {status?.progress || 0}%
        </span>
      </Button>
    );
  }

  return (
    <Button
      onClick={handleForceRerun}
      disabled={isLoading}
      variant="ghost"
      size="sm"
      className={`gap-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 ${className || ''}`}
      title={`Regenerate ${displayName} section using fresh document analysis`}
      data-testid={`button-memo-section-rerun-${sectionName}`}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" />
      )}
      <span className="text-xs hidden sm:inline">Rerun</span>
    </Button>
  );
}
