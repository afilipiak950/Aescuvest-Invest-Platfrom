import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Loader2, Play, X } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface UnifiedAnalysisProgressProps {
  dealId: number;
}

export function UnifiedAnalysisProgress({ dealId }: UnifiedAnalysisProgressProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [processedDocs, setProcessedDocs] = useState(0);
  const [totalDocs, setTotalDocs] = useState(0);
  const queryClient = useQueryClient();

  // Check for unified analysis progress
  const { data: unifiedProgress } = useQuery({
    queryKey: [`/api/deals/${dealId}/unified-analysis/progress`],
    refetchInterval: 1000,
    retry: false,
    staleTime: 0,
  });

  // Also check regular background jobs for any running analysis
  const { data: jobProgress } = useQuery({
    queryKey: [`/api/background-jobs/${dealId}`],
    refetchInterval: 1000,
    retry: false,
    staleTime: 0,
  });

  useEffect(() => {
    // Check for unified analysis first (priority)
    if (unifiedProgress && typeof unifiedProgress === 'object' && 'isRunning' in unifiedProgress) {
      const progressData = unifiedProgress as any;
      if (progressData.isRunning) {
        setProgress(progressData.progress || 0);
        setCurrentStep(progressData.currentStep || 'Processing documents...');
        setProcessedDocs(progressData.processedDocuments || 0);
        setTotalDocs(progressData.totalDocuments || 0);
        setIsVisible(true);
        return;
      }
    }

    // If unified analysis is not running, check for any individual agent jobs
    if (jobProgress && typeof jobProgress === 'object' && 'jobs' in jobProgress) {
      const progressData = jobProgress as any;
      if (progressData.jobs?.length > 0) {
        const runningJob = progressData.jobs.find((job: any) => job.status === 'processing');
        if (runningJob) {
          setProgress(runningJob.progress || 0);
          setCurrentStep(runningJob.currentStep || 'Processing analysis...');
          setProcessedDocs(runningJob.processedDocuments || 0);
          setTotalDocs(runningJob.totalDocuments || 0);
          setIsVisible(true);
          return;
        }
      }
    }

    // No active jobs found
    setIsVisible(false);
    setProgress(0);
    setCurrentStep('');
    setProcessedDocs(0);
    setTotalDocs(0);
  }, [unifiedProgress, jobProgress]);

  // Start unified analysis mutation
  const startUnifiedAnalysis = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/deals/${dealId}/unified-analysis`, {
        method: 'POST'
      });
      return response;
    },
    onSuccess: () => {
      console.log('🚀 Unified analysis started successfully');
      queryClient.invalidateQueries({
        queryKey: [`/api/deals/${dealId}/unified-analysis/progress`]
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/background-jobs/${dealId}`]
      });
    },
    onError: (error) => {
      console.error('❌ Error starting unified analysis:', error);
    }
  });

  // Cancel unified analysis mutation
  const cancelUnifiedAnalysis = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/deals/${dealId}/unified-analysis/cancel`, {
        method: 'POST'
      });
      return response;
    },
    onSuccess: () => {
      console.log('🛑 Unified analysis cancelled');
      setIsVisible(false);
      queryClient.invalidateQueries({
        queryKey: [`/api/deals/${dealId}/unified-analysis/progress`]
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/background-jobs/${dealId}`]
      });
    },
    onError: (error) => {
      console.error('❌ Error cancelling unified analysis:', error);
    }
  });

  const handleStartAnalysis = async () => {
    console.log(`🚀 Starting unified analysis for all 65 documents across all agent types for deal ${dealId}`);
    
    // First, force stop all fragmented jobs
    try {
      console.log(`🛑 Stopping all fragmented jobs for deal ${dealId}`);
      await apiRequest(`/api/deals/${dealId}/force-stop-all-jobs`, {
        method: 'POST'
      });
      console.log(`✅ Successfully stopped all fragmented jobs`);
      
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Invalidate job progress queries to refresh UI
      queryClient.invalidateQueries({
        queryKey: [`/api/background-jobs/${dealId}`]
      });
      
    } catch (error) {
      console.error('⚠️ Failed to stop fragmented jobs (continuing anyway):', error);
    }
    
    // Now start the unified analysis
    startUnifiedAnalysis.mutate();
  };

  const handleCancelAnalysis = () => {
    console.log(`🛑 Cancelling unified analysis for deal ${dealId}`);
    cancelUnifiedAnalysis.mutate();
  };

  // Show start button if no analysis is running
  if (!isVisible) {
    return (
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">
              🚀 NEW: Unified Document Analysis
            </h3>
            <p className="text-sm text-gray-300">
              <strong>ONE progress bar for ALL 65 documents</strong> across Clinical, Legal, Commercial, HR, Financial, IP & Research agents. <span className="text-green-400">No more restarting jobs!</span>
            </p>
          </div>
          <Button
            onClick={handleStartAnalysis}
            disabled={startUnifiedAnalysis.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg flex items-center gap-2"
          >
            {startUnifiedAnalysis.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Start Full Analysis
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
          <div>
            <h3 className="text-lg font-semibold text-white">
              Comprehensive Analysis in Progress
            </h3>
            <p className="text-sm text-gray-300">
              Processing {totalDocs} documents across all agent categories
            </p>
          </div>
        </div>
        <Button
          onClick={handleCancelAnalysis}
          disabled={cancelUnifiedAnalysis.isPending}
          variant="outline"
          size="sm"
          className="text-red-400 border-red-400/20 hover:bg-red-400/10"
        >
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
      </div>

      {/* Unified Progress Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-blue-300 font-medium">
            Overall Progress: {processedDocs}/{totalDocs} documents
          </span>
          <span className="text-blue-300 font-mono">
            {Math.round(progress)}%
          </span>
        </div>
        
        <div className="w-full bg-blue-400/20 rounded-full h-3">
          <div 
            className="bg-gradient-to-r from-blue-400 to-purple-400 h-3 rounded-full transition-all duration-500 ease-out" 
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
        
        <div className="text-xs text-blue-300/80">
          {currentStep || 'Preparing analysis...'}
        </div>
        
        {/* Progress Details */}
        <div className="grid grid-cols-7 gap-1 mt-4">
          {['Clinical', 'Legal', 'Commercial', 'HR', 'Financial', 'IP', 'Research'].map((agent, index) => (
            <div 
              key={agent}
              className={`text-xs text-center py-1 px-2 rounded ${
                progress > (index * 14.3) ? 
                'bg-blue-500/20 text-blue-300' : 
                'bg-gray-500/20 text-gray-400'
              }`}
            >
              {agent}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}