/**
 * Persistent Legal Button Component
 * Manages legal analysis jobs with automatic state detection and persistence
 * Based on the proven clinical analysis architecture
 */

import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Play, Square, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface PersistentLegalButtonProps {
  dealId: number;
  onAnalysisStart?: () => void;
  onAnalysisStop?: () => void;
  className?: string;
}

export function PersistentLegalButton({ 
  dealId, 
  onAnalysisStart, 
  onAnalysisStop,
  className 
}: PersistentLegalButtonProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Check if legal analysis is currently running
  useEffect(() => {
    const checkAnalysisStatus = async () => {
      try {
        const response = await apiRequest(`/api/background-jobs/${dealId}`);
        if (response.success && response.jobs) {
          const legalJob = response.jobs.find((job: any) => 
            job.agentType?.toLowerCase() === 'legal' && job.status === 'processing'
          );
          setIsRunning(!!legalJob);
        }
      } catch (error) {
        console.error('Error checking legal analysis status:', error);
      }
    };

    checkAnalysisStatus();

    // Poll for status updates every 2 seconds
    const interval = setInterval(checkAnalysisStatus, 2000);
    return () => clearInterval(interval);
  }, [dealId]);

  const handleStartAnalysis = async () => {
    setIsLoading(true);
    try {
      console.log(`🚀 Starting legal analysis for deal ${dealId}`);
      
      const response = await apiRequest(`/api/deals/${dealId}/legal-analysis/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.success) {
        setIsRunning(true);
        onAnalysisStart?.();
        
        toast({
          title: "Legal Analysis Started",
          description: "Comprehensive legal analysis is now running in the background",
        });
      } else {
        throw new Error(response.error || 'Failed to start legal analysis');
      }
    } catch (error) {
      console.error('Error starting legal analysis:', error);
      
      toast({
        title: "Error",
        description: "Failed to start legal analysis",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopAnalysis = async () => {
    setIsLoading(true);
    try {
      console.log(`🛑 Stopping legal analysis for deal ${dealId}`);
      
      const response = await apiRequest(`/api/deals/${dealId}/legal-analysis/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.success) {
        setIsRunning(false);
        onAnalysisStop?.();
        
        toast({
          title: "Legal Analysis Stopped",
          description: "Legal analysis has been stopped",
        });
      } else {
        throw new Error(response.error || 'Failed to stop legal analysis');
      }
    } catch (error) {
      console.error('Error stopping legal analysis:', error);
      
      toast({
        title: "Error", 
        description: "Failed to stop legal analysis",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isRunning) {
    return (
      <Button
        onClick={handleStopAnalysis}
        disabled={isLoading}
        variant="destructive"
        className={className}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Stopping...
          </>
        ) : (
          <>
            <Square className="h-4 w-4 mr-2" />
            Stop Legal Analysis
          </>
        )}
      </Button>
    );
  }

  return (
    <Button
      onClick={handleStartAnalysis}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Starting...
        </>
      ) : (
        <>
          <Play className="h-4 w-4 mr-2" />
          Run Legal Analysis
        </>
      )}
    </Button>
  );
}