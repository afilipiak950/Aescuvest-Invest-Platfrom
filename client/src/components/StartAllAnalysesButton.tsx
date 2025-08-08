import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Loader2, Play, StopCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StartAllAnalysesButtonProps {
  dealId: number;
  documents: any[];
  isRunning: boolean;
  onStart: () => void;
  onComplete: () => void;
  activeJobs: any[];
}

export default function StartAllAnalysesButton({
  dealId,
  documents,
  isRunning,
  onStart,
  onComplete,
  activeJobs
}: StartAllAnalysesButtonProps) {
  const [isStarting, setIsStarting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mutation to start all analyses
  const startAllAnalyses = useMutation({
    mutationFn: async () => {
      // Use our working direct restart script approach
      const response = await fetch('/api/start-all-ai-analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId })
      });
      
      if (!response.ok) {
        throw new Error('Failed to start AI analyses');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      console.log('✅ All AI analyses started:', data);
      toast({
        title: "AI Analysis Started",
        description: `Started analysis for all 7 agents across ${documents.length} documents`,
      });
      onStart();
      
      // Invalidate job progress to refresh UI
      queryClient.invalidateQueries({ queryKey: ['/api/background-jobs', dealId] });
    },
    onError: (error: any) => {
      console.error('❌ Failed to start analyses:', error);
      toast({
        title: "Analysis Failed to Start",
        description: error.message || "Please try again",
        variant: "destructive",
      });
      setIsStarting(false);
    }
  });

  // Mutation to stop all analyses
  const stopAllAnalyses = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/stop-all-ai-analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId })
      });
      
      if (!response.ok) {
        throw new Error('Failed to stop AI analyses');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "AI Analysis Stopped",
        description: "All running analyses have been cancelled",
      });
      onComplete();
      
      // Invalidate job progress to refresh UI
      queryClient.invalidateQueries({ queryKey: ['/api/background-jobs', dealId] });
    },
    onError: (error: any) => {
      console.error('❌ Failed to stop analyses:', error);
      toast({
        title: "Failed to Stop Analysis",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  });

  const handleStartAnalyses = async () => {
    if (!documents || documents.length === 0) {
      toast({
        title: "No Documents Found",
        description: "Please upload documents before starting AI analysis",
        variant: "destructive",
      });
      return;
    }

    setIsStarting(true);
    startAllAnalyses.mutate();
  };

  const handleStopAnalyses = () => {
    stopAllAnalyses.mutate();
  };

  const hasActiveJobs = activeJobs && activeJobs.length > 0;
  const isLoading = startAllAnalyses.isPending || stopAllAnalyses.isPending || isStarting;

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        {!hasActiveJobs ? (
          <Button
            onClick={handleStartAnalyses}
            disabled={isLoading || !documents?.length}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting Analysis...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Start All AI Analyses (7 Agents)
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={handleStopAnalyses}
            disabled={isLoading}
            variant="destructive"
            className="flex-1"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Stopping...
              </>
            ) : (
              <>
                <StopCircle className="mr-2 h-4 w-4" />
                Stop All Analyses
              </>
            )}
          </Button>
        )}
      </div>

      {!documents?.length && (
        <p className="text-sm text-gray-400 text-center">
          Upload documents first to enable AI analysis
        </p>
      )}
      
      {documents?.length > 0 && !hasActiveJobs && (
        <p className="text-sm text-gray-300 text-center">
          Ready to analyze {documents.length} documents with 7 AI agents
        </p>
      )}
    </div>
  );
}