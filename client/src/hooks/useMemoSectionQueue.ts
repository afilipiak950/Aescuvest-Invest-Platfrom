/**
 * useMemoSectionQueue Hook
 * 
 * Hook for managing memo section Force Rerun state, polling, and actions.
 * Follows the same pattern as useAgentQueue but for memo section regeneration.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export interface MemoSectionConfig {
  sectionName: string;
  displayName: string;
  requiredAgents: string[];
  qualityThreshold: number;
  description: string;
  orderIndex: number;
  isRequired: boolean;
}

export interface SectionRerunStatus {
  sectionName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentStep: string;
  qualityScore?: number;
  citationCount?: number;
  metricCount?: number;
}

interface UseMemoSectionQueueOptions {
  dealId: number;
  sectionName: string;
  pollInterval?: number;
  onRerunStart?: () => void;
  onRerunComplete?: (qualityScore: number) => void;
  onError?: (error: string) => void;
}

interface UseMemoSectionQueueReturn {
  isLoading: boolean;
  status: SectionRerunStatus | null;
  isProcessing: boolean;
  handleForceRerun: () => Promise<void>;
  handleCancel: () => Promise<void>;
}

export function useMemoSectionQueue({
  dealId,
  sectionName,
  pollInterval = 2000,
  onRerunStart,
  onRerunComplete,
  onError,
}: UseMemoSectionQueueOptions): UseMemoSectionQueueReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<SectionRerunStatus | null>(null);
  const { toast } = useToast();
  
  const prevStatusRef = useRef<string>('');
  const prevProgressRef = useRef<number>(0);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await apiRequest(`/api/deals/${dealId}/memo/sections/${sectionName}/status`);
        
        if (response.success && response.sectionName) {
          const newStatus: SectionRerunStatus = {
            sectionName: response.sectionName,
            status: response.status || 'pending',
            progress: response.progress || 0,
            currentStep: response.currentStep || '',
            qualityScore: response.qualityScore,
            citationCount: response.citationCount,
            metricCount: response.metricCount
          };
          
          const prevStatus = prevStatusRef.current;
          
          if (newStatus.status === 'completed' && prevStatus === 'processing') {
            console.log(`✅ [${sectionName}] Section rerun complete! Quality: ${newStatus.qualityScore}`);
            
            queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/memo`] });
            queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'memo'] });
            
            onRerunComplete?.(newStatus.qualityScore || 0);
          }
          
          if (newStatus.status === 'failed' && prevStatus === 'processing') {
            console.error(`❌ [${sectionName}] Section rerun failed`);
            onError?.(newStatus.currentStep || 'Unknown error');
          }
          
          prevStatusRef.current = newStatus.status;
          prevProgressRef.current = newStatus.progress;
          setStatus(newStatus);
        }
      } catch (error) {
        console.error(`Error checking ${sectionName} rerun status:`, error);
      }
    };

    checkStatus();

    const interval = setInterval(checkStatus, pollInterval);
    return () => clearInterval(interval);
  }, [dealId, sectionName, pollInterval, onRerunComplete, onError]);

  const handleForceRerun = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log(`🚀 [${sectionName}] Starting force rerun for deal ${dealId}`);
      
      const response = await apiRequest(`/api/deals/${dealId}/memo/sections/${sectionName}/force-rerun`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.success) {
        onRerunStart?.();
        
        prevStatusRef.current = 'processing';
        setStatus({
          sectionName,
          status: 'processing',
          progress: 0,
          currentStep: 'Starting...'
        });
        
        toast({
          title: "Section Regeneration Started",
          description: `Regenerating ${sectionName.replace(/([A-Z])/g, ' $1').trim()} section with fresh document analysis`,
          duration: 5000,
        });
      } else {
        throw new Error(response.error || 'Failed to start section rerun');
      }
    } catch (error: any) {
      console.error(`Error starting ${sectionName} rerun:`, error);
      
      toast({
        title: "Error",
        description: `Failed to start section regeneration: ${error.message}`,
        variant: "destructive"
      });
      
      onError?.(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [dealId, sectionName, onRerunStart, onError, toast]);

  const handleCancel = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log(`🛑 [${sectionName}] Cancelling rerun for deal ${dealId}`);
      
      const response = await apiRequest(`/api/deals/${dealId}/memo/sections/${sectionName}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.success) {
        toast({
          title: "Cancelled",
          description: `Section regeneration cancelled`,
        });
        
        setStatus(prev => prev ? { ...prev, status: 'cancelled' } : null);
      } else {
        throw new Error(response.error || 'Failed to cancel');
      }
    } catch (error: any) {
      console.error(`Error cancelling ${sectionName} rerun:`, error);
      
      toast({
        title: "Error", 
        description: "Failed to cancel regeneration",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [dealId, sectionName, toast]);

  const isProcessing = status?.status === 'processing' || status?.status === 'pending';

  return {
    isLoading,
    status,
    isProcessing,
    handleForceRerun,
    handleCancel,
  };
}

/**
 * Hook to manage all section statuses for a deal
 */
export function useAllMemoSectionStatuses(dealId: number, pollInterval = 3000) {
  const [statuses, setStatuses] = useState<Record<string, SectionRerunStatus>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const response = await apiRequest(`/api/deals/${dealId}/memo/sections/status`);
        
        if (response.success && response.sections) {
          setStatuses(response.sections);
        }
      } catch (error) {
        console.error('Error fetching all section statuses:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatuses();
    
    const interval = setInterval(fetchStatuses, pollInterval);
    return () => clearInterval(interval);
  }, [dealId, pollInterval]);

  const hasAnyProcessing = Object.values(statuses).some(
    s => s.status === 'processing' || s.status === 'pending'
  );

  return {
    statuses,
    isLoading,
    hasAnyProcessing
  };
}
