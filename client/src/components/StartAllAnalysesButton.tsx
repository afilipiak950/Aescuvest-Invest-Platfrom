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
    <div className="space-y-4">
      {/* Main Action Button */}
      <div className="flex gap-3">
        {!hasActiveJobs ? (
          <Button
            onClick={handleStartAnalyses}
            disabled={isLoading || !documents?.length}
            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg border-0 h-12 text-lg font-semibold"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                Initializing AI Agents...
              </>
            ) : (
              <>
                <Play className="mr-3 h-5 w-5" />
                🚀 Launch All 7 AI Agents
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={handleStopAnalyses}
            disabled={isLoading}
            className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg border-0 h-12 text-lg font-semibold"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                Stopping All Agents...
              </>
            ) : (
              <>
                <StopCircle className="mr-3 h-5 w-5" />
                🛑 Stop All Analyses
              </>
            )}
          </Button>
        )}
      </div>

      {/* Agent List */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <h4 className="text-sm font-medium text-gray-300 mb-3">AI Agent Pipeline:</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {['Clinical', 'Legal', 'Commercial', 'HR', 'Financial', 'IP', 'Research'].map((agent) => (
            <div key={agent} className="flex items-center gap-2 py-1">
              <div className={`w-2 h-2 rounded-full ${
                hasActiveJobs && activeJobs.some((job: any) => 
                  job.agentType === agent || job.agentType === agent.toLowerCase()
                ) ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
              }`} />
              <span className="text-gray-300">{agent} Agent</span>
            </div>
          ))}
        </div>
      </div>

      {/* Status Messages */}
      {!documents?.length && (
        <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3">
          <p className="text-sm text-yellow-400 text-center">
            📄 Upload documents first to enable AI analysis
          </p>
        </div>
      )}
      
      {documents?.length > 0 && !hasActiveJobs && (
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
          <p className="text-sm text-blue-400 text-center">
            ✅ Ready to analyze {documents.length} documents across all 7 specialized AI agents
          </p>
        </div>
      )}

      {hasActiveJobs && (
        <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3">
          <p className="text-sm text-green-400 text-center">
            🔄 {activeJobs.length} AI agent{activeJobs.length > 1 ? 's' : ''} currently processing documents
          </p>
        </div>
      )}
    </div>
  );
}