import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, Play, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ComprehensiveAnalysisButtonProps {
  dealId: number;
  onAnalysisStarted?: () => void;
}

export function ComprehensiveAnalysisButton({ dealId, onAnalysisStarted }: ComprehensiveAnalysisButtonProps) {
  const [isStarting, setIsStarting] = useState(false);
  const { toast } = useToast();

  const handleStartAnalysis = async () => {
    try {
      setIsStarting(true);
      
      console.log(`🚀 Starting comprehensive E2E analysis for deal ${dealId}`);
      
      const response = await fetch(`/api/deals/${dealId}/comprehensive-analysis/reset-and-run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        toast({
          title: "Analysis Started",
          description: `Comprehensive E2E analysis started for all 7 agents. Processing ${result.message}`,
          duration: 5000
        });
        
        onAnalysisStarted?.();
        
        console.log('✅ Comprehensive analysis started successfully:', result);
      } else {
        throw new Error(result.error || 'Failed to start analysis');
      }
      
    } catch (error) {
      console.error('❌ Failed to start comprehensive analysis:', error);
      
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : 'Failed to start comprehensive analysis',
        duration: 5000
      });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Button
      onClick={handleStartAnalysis}
      disabled={isStarting}
      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium px-6 py-2 rounded-lg shadow-lg transition-all duration-200"
      size="lg"
    >
      {isStarting ? (
        <>
          <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
          Starting E2E Analysis...
        </>
      ) : (
        <>
          <Play className="w-4 h-4 mr-2" />
          Reset & Run All Analyses
        </>
      )}
    </Button>
  );
}

export default ComprehensiveAnalysisButton;