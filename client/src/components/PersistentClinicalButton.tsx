/**
 * Persistent Clinical Analysis Button Component
 * Provides a button to start/stop persistent clinical analysis
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { Loader2, Play, Square } from 'lucide-react';

interface PersistentClinicalButtonProps {
  dealId: number;
  isAnalysisRunning?: boolean;
}

export function PersistentClinicalButton({ dealId, isAnalysisRunning = false }: PersistentClinicalButtonProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const { toast } = useToast();

  const handleStartPersistentAnalysis = async () => {
    setIsStarting(true);
    try {
      console.log(`🧬 Starting persistent clinical analysis for deal ${dealId}...`);
      
      const response = await apiRequest(`/api/deals/${dealId}/clinical-analysis/persistent/start`, {
        method: 'POST',
        body: {}
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Persistent clinical analysis started:`, data);
        
        toast({
          title: "Persistent Clinical Analysis Started",
          description: "Clinical analysis will continue running even if you refresh the page",
        });
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/agents/clinical/results`] });
        queryClient.invalidateQueries({ queryKey: [`/api/background-jobs/${dealId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/clinical-analysis/comprehensive/results`] });
      } else {
        const errorData = await response.json();
        console.error(`❌ Persistent clinical analysis failed:`, errorData);
        
        toast({
          title: "Analysis Failed",
          description: errorData.error || "Failed to start persistent clinical analysis",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error(`❌ Error starting persistent clinical analysis:`, error);
      
      toast({
        title: "Analysis Error",
        description: "Failed to start persistent clinical analysis",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopPersistentAnalysis = async () => {
    setIsStopping(true);
    try {
      console.log(`🛑 Stopping persistent clinical analysis for deal ${dealId}...`);
      
      const response = await apiRequest(`/api/deals/${dealId}/clinical-analysis/persistent/stop`, {
        method: 'POST',
        body: {}
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Persistent clinical analysis stopped:`, data);
        
        toast({
          title: "Analysis Stopped",
          description: "Persistent clinical analysis has been stopped",
        });
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/agents/clinical/results`] });
        queryClient.invalidateQueries({ queryKey: [`/api/background-jobs/${dealId}`] });
      } else {
        const errorData = await response.json();
        console.error(`❌ Failed to stop persistent clinical analysis:`, errorData);
        
        toast({
          title: "Stop Failed",
          description: errorData.error || "Failed to stop persistent clinical analysis",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error(`❌ Error stopping persistent clinical analysis:`, error);
      
      toast({
        title: "Stop Error",
        description: "Failed to stop persistent clinical analysis",
        variant: "destructive",
      });
    } finally {
      setIsStopping(false);
    }
  };

  if (isAnalysisRunning) {
    return (
      <Button
        onClick={handleStopPersistentAnalysis}
        disabled={isStopping}
        variant="destructive"
        size="sm"
        className="w-full"
      >
        {isStopping ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Stopping...
          </>
        ) : (
          <>
            <Square className="mr-2 h-4 w-4" />
            Stop Persistent Analysis
          </>
        )}
      </Button>
    );
  }

  return (
    <Button
      onClick={handleStartPersistentAnalysis}
      disabled={isStarting}
      variant="default"
      size="sm"
      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
    >
      {isStarting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Starting...
        </>
      ) : (
        <>
          <Play className="mr-2 h-4 w-4" />
          Start Persistent Analysis
        </>
      )}
    </Button>
  );
}