// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import PageHeader from '@/components/layout/page-header';
import { DataRoomExplorer } from '@/components/DataRoomExplorer';
import EnhancedAgentCard from '@/components/EnhancedAgentCard';
import DueDiligenceAgents from '@/components/ai/DueDiligenceAgents';
import { SimpleFileUpload } from '@/components/SimpleFileUpload';
import FileUploadAnalysis from '@/components/FileUploadAnalysis';
import EnhancedCompanyResearch from '@/components/EnhancedCompanyResearch';
import DynamicAIScoring from '@/components/ai/DynamicAIScoring';
import DataRoomManager from '@/components/DataRoomManager';
import UnassignedDocuments from '@/components/UnassignedDocuments';
import { AgentOverviewProgress } from '@/components/AgentOverviewProgress';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Upload, Link as LinkIcon, Bot, AlertCircle, X, Square, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Deal, AgentAnalysis, Document } from '@/types';
import ErrorBoundary from '@/components/ErrorBoundary';

function DueDiligenceContent() {
    try {
    const [location] = useLocation();
    const params = useParams();
    const [selectedDeal, setSelectedDeal] = useState<string>(params.dealId || '22'); // Default to deal 22
    const [activeAgent, setActiveAgent] = useState<string>('legal');
    const [isUploading, setIsUploading] = useState(false);
    const [showUploadField, setShowUploadField] = useState(false);
    const [showDataRoom, setShowDataRoom] = useState(true); // Always show data room
    const [isRunningAllAnalyses, setIsRunningAllAnalyses] = useState(false);
    const [clinicalAnalysisStarted, setClinicalAnalysisStarted] = useState(false);

    const queryClient = useQueryClient();
    const { toast } = useToast();

    // Safe helper function to find jobs
    const findJobSafely = (jobs: any[], patterns: string[]) => {
      if (!jobs || !Array.isArray(jobs)) return null;
      return jobs.find((job: any) => {
        if (!job) return false;
        if (patterns.some(pattern => job.agentType === pattern)) return true;
        if (job.jobId && typeof job.jobId === 'string') {
          return patterns.some(pattern => job.jobId.includes(pattern));
        }
        return false;
      });
    };

    // Parse URL parameters and set selected deal
    useEffect(() => {
      // Check for deal ID in URL path parameter first
      if (params.dealId) {
        setSelectedDeal(params.dealId);
      } else {
        // Fall back to URL search parameter
        const searchParams = new URLSearchParams(window.location.search);
        const dealParam = searchParams.get('deal');
        if (dealParam) {
          setSelectedDeal(dealParam);
        }
      }
    }, [location, params.dealId]);

    // Fetch real deals from database
    const { data: deals, isLoading: isLoadingDeals } = useQuery({
      queryKey: ['/api/deals'],
      retry: false,
    });

    // Fetch real documents for selected deal
    const { data: documents, isLoading: isLoadingDocuments, error: documentsError } = useQuery({
    queryKey: [`/api/deals/${selectedDeal}/documents`],
    retry: 3,
    enabled: !!selectedDeal,
    refetchInterval: 5000, // Poll every 5 seconds for real-time AI progress
    staleTime: 0, // Always fetch fresh data to show current AI processing status
    gcTime: 60000, // Keep in cache for 1 minute
    queryFn: async () => {
      console.log(`🔄 Fetching documents for deal ${selectedDeal}...`);
      const response = await fetch(`/api/deals/${selectedDeal}/documents`, {
        credentials: 'include',
        signal: AbortSignal.timeout(120000), // 2 minute timeout
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`✅ Received ${data?.length || 0} documents for deal ${selectedDeal}`);
      return data;
    }
    });

    // NEW: Job-based progress tracking for gradual 0-100% progress
    const { data: jobBasedProgress, isLoading: isLoadingJobProgress } = useQuery({
      queryKey: [`/api/analysis/deal-progress/${selectedDeal}`],
      enabled: !!selectedDeal,
      refetchInterval: 1000, // Poll every 1 second for gradual progress updates
      refetchIntervalInBackground: true,
      gcTime: 0, // Don't cache the results
      staleTime: 0, // Always consider stale to refetch
    });

    // Fallback: Enterprise progress tracking (legacy support)
    const { data: enterpriseProgress } = useQuery({
      queryKey: [`/api/enterprise/progress/${selectedDeal}`],
      enabled: !!selectedDeal && !jobBasedProgress?.progress,
      refetchInterval: 2000,
      refetchIntervalInBackground: true,
      gcTime: 0,
      staleTime: 0,
    });

    // Auto-reset stuck state when no jobs are running (update to use new progress APIs)
    useEffect(() => {
      const noJobsRunning = (
        (enterpriseProgress && Array.isArray(enterpriseProgress.jobs) && enterpriseProgress.jobs.length === 0) &&
        (!jobBasedProgress?.progress || jobBasedProgress.progress.status === 'idle')
      );
      
      if (isRunningAllAnalyses && noJobsRunning) {
        console.log('🔄 No active jobs detected - resetting stuck analysis state');
        setIsRunningAllAnalyses(false);
      }
    }, [enterpriseProgress, jobBasedProgress, isRunningAllAnalyses]);

    // Fetch real analysis data - MOVED UP to prevent temporal dead zone error
    const { data: analyses, isLoading: isLoadingAnalyses } = useQuery({
      queryKey: [`/api/analyses/${selectedDeal}`],
      retry: false,
      enabled: !!selectedDeal
    });

    // Enterprise job metrics for overall queue state
    const { data: queueMetrics } = useQuery({
      queryKey: ['/api/enterprise/metrics'],
      enabled: !!selectedDeal,
      refetchInterval: 3000,
    });

    // Log polling attempts
    useEffect(() => {
      if (selectedDeal) {
        console.log('📊 Job-based progress polling for deal', selectedDeal);
        console.log('📊 Job-based progress data:', jobBasedProgress);
        console.log('📊 Job-based agents:', jobBasedProgress?.progress?.agentProgress);
        console.log('📊 Enterprise progress data (fallback):', enterpriseProgress);
        console.log('📊 Queue metrics:', queueMetrics);
      }
    }, [selectedDeal, jobBasedProgress, enterpriseProgress, queueMetrics]);

    // Create comprehensive agent progress data using job-based progress tracking
    const agentProgressData = useMemo(() => {
      const agentTypes = ['Legal', 'Clinical', 'Commercial', 'HR', 'Financial', 'IP', 'Research'];
      
      return agentTypes.map(agentType => {
        let progress = 0;
        let status = 'Idle' as 'Idle' | 'Processing' | 'Completed' | 'Failed';
        let processedCount: number | undefined;
        let totalCount: number | undefined;
        let currentStep: string | undefined;
        
        // PRIORITY 1: Use job-based progress from new API
        if (jobBasedProgress?.progress?.agentProgress) {
          const agentProgress = jobBasedProgress.progress.agentProgress.find(
            (a: any) => a.agentType?.toLowerCase() === agentType.toLowerCase()
          );
          
          if (agentProgress) {
            progress = Math.max(0, Math.min(100, Math.floor(agentProgress.progress || 0)));
            status = agentProgress.status === 'running' ? 'Processing' : 
                     agentProgress.status === 'completed' ? 'Completed' : 
                     agentProgress.status === 'failed' ? 'Failed' : 'Idle';
            processedCount = agentProgress.completedJobs;
            totalCount = agentProgress.totalJobs;
            currentStep = `${agentProgress.completedJobs || 0}/${agentProgress.totalJobs || 0} tasks completed`;
            
            console.log(`🔍 Job-based progress for ${agentType}: ${progress}% (${status})`);
          }
        } 
        // PRIORITY 2: Use enterprise job progress (fallback)
        else if (enterpriseProgress?.jobs) {
          const job = findJobSafely(
            enterpriseProgress.jobs, 
            [agentType.toLowerCase(), agentType]
          );
          
          if (job && typeof job.progress === 'number') {
            progress = Math.max(0, Math.min(100, Math.floor(job.progress)));
            status = job.status || 'Processing';
            processedCount = job.processedCount;
            totalCount = job.totalCount;
            currentStep = job.currentStep;
          }
        }
        // PRIORITY 3: Use legacy analysis data (last resort)
        else if (analyses && Array.isArray(analyses)) {
          const analysis = analyses.find((a: any) => a.agentType?.toLowerCase() === agentType.toLowerCase());
          
          if (analysis) {
            progress = typeof analysis.progress === 'number' ? analysis.progress : 0;
            status = analysis.status === 'Completed' ? 'Completed' : 
                     analysis.status === 'Processing' ? 'Processing' : 'Idle';
          }
        }
        
        // CRITICAL: Force reset to 0% when starting new analysis
        if (isRunningAllAnalyses && status === 'Completed') {
          progress = 0;
          status = 'Processing';
        }
        
        return {
          agentType,
          progress,
          status,
          processedCount,
          totalCount,
          currentStep
        };
      });
    }, [jobBasedProgress, enterpriseProgress, analyses, isRunningAllAnalyses]);

    // Create progress states from new job-based progress data
    const legalProgress = useMemo(() => {
      const agent = agentProgressData.find(a => a.agentType === 'Legal');
      return agent && agent.status === 'Processing' ? {
        isRunning: true,
        progress: agent.progress,
        currentStep: agent.currentStep || 'Processing legal documents...',
        currentDocumentName: agent.currentStep || 'Processing'
      } : null;
    }, [agentProgressData]);

    const commercialProgress = useMemo(() => {
      const agent = agentProgressData.find(a => a.agentType === 'Commercial');
      return agent && agent.status === 'Processing' ? {
        isRunning: true,
        progress: agent.progress,
        currentStep: agent.currentStep || 'Processing commercial documents...',
        currentDocumentName: agent.currentStep || 'Processing'
      } : null;
    }, [agentProgressData]);

    const hrProgress = useMemo(() => {
      const agent = agentProgressData.find(a => a.agentType === 'HR');
      return agent && agent.status === 'Processing' ? {
        isRunning: true,
        progress: agent.progress,
        currentStep: agent.currentStep || 'Processing HR documents...',
        currentDocumentName: agent.currentStep || 'Processing'
      } : null;
    }, [agentProgressData]);

    const clinicalProgress = useMemo(() => {
      const agent = agentProgressData.find(a => a.agentType === 'Clinical');
      return agent && agent.status === 'Processing' ? {
        isRunning: true,
        progress: agent.progress,
        currentStep: agent.currentStep || 'Processing clinical documents...',
        currentDocumentName: agent.currentStep || 'Processing'
      } : null;
    }, [agentProgressData]);

    // Moved to after analyses query definition to prevent temporal dead zone error

    // Stop job mutation
    const stopJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest(`/api/background-jobs/${jobId}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return response;
    },
    onSuccess: () => {
      // Refresh background jobs data
      queryClient.invalidateQueries({ queryKey: [`/api/background-jobs/${selectedDeal}`] });
    },
    onError: (error) => {
      console.error('❌ Error stopping job:', error);
    }
    });

    const handleStopJob = (jobId: string, agentType: string) => {
      console.log(`🛑 Stopping ${agentType} analysis job: ${jobId}`);
      stopJobMutation.mutate(jobId);
    };

    // Reset clinical analysis started flag when analysis is complete
    useEffect(() => {
      // Disabled due to progress polling removal - clinical analysis completion is now handled elsewhere
      if (clinicalAnalysisStarted) {
        // Auto-reset flag after 30 seconds to prevent it from staying true indefinitely
        const timer = setTimeout(() => {
          setClinicalAnalysisStarted(false);
        }, 30000);
        return () => clearTimeout(timer);
      }
    }, [clinicalAnalysisStarted]);

    // Log current state immediately
    console.log(`🎯 Current selectedDeal:`, selectedDeal);
    console.log(`🎯 Progress polling disabled to fix UI interference issues`);

    // Debug log for documents loading
    console.log('📄 Documents query state:', {
      selectedDeal,
      isLoading: isLoadingDocuments,
      hasData: !!documents,
      dataLength: documents?.length || 0,
      error: documentsError
    });

    // Track document count for automated analysis triggering
    const [previousDocumentCount, setPreviousDocumentCount] = useState(0);
    const [hasTriggeredInitialAnalysis, setHasTriggeredInitialAnalysis] = useState(false);

    // Auto-show data room when documents exist (always show for immediate access)
    useEffect(() => {
      setShowDataRoom(true); // Always show data room for immediate document access
    }, [documents]);

    // Function to trigger automated analysis for all agents
    const triggerAutomatedAnalysis = async () => {
    if (isRunningAllAnalyses) {
      console.log('⏭️ Analysis already in progress, skipping automated trigger');
      return;
    }

    console.log('🤖 Starting automated comprehensive analysis for all agents...');
    setIsRunningAllAnalyses(true);

    try {
      const agentTypes = ['clinical', 'legal', 'commercial', 'hr', 'financial', 'ip', 'research'];
      
      // Run all agent analyses in parallel with force refresh
      const promises = agentTypes.map(agentType => {
        console.log(`📊 Triggering ${agentType} agent analysis...`);
        return apiRequest(`/api/deals/${selectedDeal}/agents/${agentType}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forceRefresh: true })
        });
      });

      const results = await Promise.allSettled(promises);
      
      // Log results
      results.forEach((result, index) => {
        const agentType = agentTypes[index];
        if (result.status === 'fulfilled') {
          console.log(`✅ ${agentType} analysis completed successfully`);
        } else {
          console.log(`❌ ${agentType} analysis failed:`, result.reason);
        }
      });

      // Refresh analyses data
      queryClient.invalidateQueries({ queryKey: [`/api/analyses/${selectedDeal}`] });
      
      console.log('🎉 Automated comprehensive analysis completed');
    } catch (error) {
      console.error('❌ Error during automated analysis:', error);
    } finally {
      setIsRunningAllAnalyses(false);
    }
  };

  // Automatic analysis disabled to prevent system instability
  // Users can manually trigger analysis using the "Run All Analyses" button
  // useEffect(() => {
  //   // Automatic analysis temporarily disabled for stability
  // }, []);

  // Analysis data moved up above to prevent temporal dead zone error

  // Debug log for analyses data
  console.log('🔍 Analyses Query Debug:', {
    selectedDeal,
    isLoadingAnalyses,
    analysesData: analyses,
    analysesLength: (analyses && Array.isArray(analyses)) ? analyses.length : 'not array',
    agentTypes: Array.isArray(analyses) ? analyses.map((a: any) => a.agentType) : 'no data'
  });

  const currentDeal = Array.isArray(deals) ? deals.find((deal: any) => deal.id.toString() === selectedDeal) : undefined;
  
  // Calculate unassigned documents using intelligent assignment system
  const unassignedDocs = useMemo(() => {
    if (!documents || !Array.isArray(documents)) {
      console.log('📊 Missing documents data for unassigned calculation');
      return [];
    }

    // Filter documents that have no assignedAgents field or empty assignedAgents array
    const unassigned = documents.filter((doc: any) => 
      !doc.assignedAgents || 
      !Array.isArray(doc.assignedAgents) || 
      doc.assignedAgents.length === 0
    );
    
    console.log('📊 Intelligent assignment status:', {
      totalDocuments: documents.length,
      unassignedCount: unassigned.length,
      assignedCount: documents.length - unassigned.length,
      assignmentRate: `${Math.round(((documents.length - unassigned.length) / documents.length) * 100)}%`
    });
    
    // Debug: Show sample assignments
    const sampleAssigned = documents.filter(doc => 
      doc.assignedAgents && Array.isArray(doc.assignedAgents) && doc.assignedAgents.length > 0
    ).slice(0, 3);
    
    if (sampleAssigned.length > 0) {
      console.log('📋 Sample intelligent assignments:');
      sampleAssigned.forEach((doc: any) => {
        console.log(`  "${doc.name}": ${doc.assignedAgents.join(', ')}`);
      });
    }
    
    return unassigned;
  }, [documents]);
  
  const handleFileUpload = async () => {
    setShowUploadField(!showUploadField);
  };

  // Comprehensive Analysis Mutation - Reset and run all 7 agents with fresh state
  const comprehensiveAnalysisMutation = useMutation({
    mutationFn: async () => {
      try {
        console.log(`🚀 Comprehensive Analysis - Starting fresh analysis for all 7 agents with reset`);
        
        if (!selectedDeal) {
          throw new Error('No deal selected for analysis');
        }
        
        const dealId = parseInt(selectedDeal);
        
        // Use the new job-based comprehensive analysis endpoint that creates individual jobs for progress tracking
        console.log('🚀 Using new job-based comprehensive analysis engine with gradual progress tracking...');
        const response = await apiRequest(`/api/analysis/comprehensive/${dealId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        console.log(`✅ Comprehensive analysis started with new engine:`, response);
        return { ...response, resetSuccess: true };
        
      } catch (error) {
        console.error('❌ Comprehensive analysis failed:', error);
        throw error;
      }
    },
    onSuccess: (results) => {
      console.log(`✅ Job-based comprehensive analysis started:`, results);
      console.log(`📊 Run ID: ${results.runId} - Individual jobs created for each agent with gradual progress tracking`);
      
      // Start monitoring progress for the new run
      const runId = results.runId;
      
      toast({
        title: "Job-Based Analysis Started",
        description: `Run ${runId} created. Progress bars will show gradual 0-100% progression for each agent.`,
        duration: 8000,
      });
      
      // Set up progress monitoring for the specific run
      const monitorProgress = setInterval(async () => {
        try {
          const progressResponse = await fetch(`/api/analysis/deal-progress/${selectedDeal}`);
          const progressData = await progressResponse.json();
          
          if (progressData.progress && progressData.progress.status === 'completed') {
            console.log(`🎉 Job-based analysis completed for run ${runId}!`);
            setIsRunningAllAnalyses(false);
            clearInterval(monitorProgress);
            
            // Refresh all relevant queries
            queryClient.invalidateQueries({ queryKey: [`/api/analyses/${selectedDeal}`] });
            queryClient.invalidateQueries({ queryKey: [`/api/analysis/deal-progress/${selectedDeal}`] });
            
            toast({
              title: "Analysis Complete",
              description: "All agents completed with gradual progress tracking!",
              duration: 5000,
            });
          }
        } catch (error) {
          console.error('Error monitoring job progress:', error);
        }
      }, 2000); // Check every 2 seconds
      
      // Cleanup after 20 minutes
      setTimeout(() => {
        setIsRunningAllAnalyses(false);
        clearInterval(monitorProgress);
      }, 1200000);
      
      // Verify results after UI updates
      setTimeout(async () => {
        try {
          const verificationResponse = await fetch(`/api/analyses/${selectedDeal}`);
          const verificationData = await verificationResponse.json();
          const completedAgents = verificationData.filter((a: any) => a.status === 'Completed').length;
          
          console.log(`📊 Verification: ${completedAgents}/7 agents completed with fresh question-specific answers`);
          
          // Final UI refresh to ensure all data is current
          queryClient.invalidateQueries({ queryKey: [`/api/analyses/${selectedDeal}`] });
        } catch (error) {
          console.error('❌ Verification error:', error);
        }
      }, 1000);
    },
    onError: (error) => {
      console.error(`❌ Comprehensive analysis failed:`, error);
      setIsRunningAllAnalyses(false);
      
      toast({
        title: "Analysis Failed",
        description: "Failed to start comprehensive analysis. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    }
  });

  // Combined OCR Reset & Analysis Mutation - Uses new efficient Combined OCR system
  const runAllAnalysesMutation = useMutation({
    mutationFn: async () => {
      try {
        console.log(`🚀 Combined OCR Reset & Analysis - Starting for all 7 agents using efficient Combined OCR system`);
        
        if (!selectedDeal) {
          throw new Error('No deal selected for analysis');
        }
        
        // Step 1: COMPLETE DATA DELETION - Clear all analysis data, caches, localStorage
        console.log(`🔄 LEGACY RESET: Complete data deletion for deal ${selectedDeal}`);
        
        // Clear server analysis data
        await apiRequest(`/api/analyses/${selectedDeal}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
        
        // Clear all client-side caches immediately to reset progress to 0%
        const agentTypes = ['legal', 'clinical', 'commercial', 'hr', 'financial', 'ip', 'research'];
        agentTypes.forEach(agentType => {
          queryClient.removeQueries({ queryKey: [`/api/deals/${selectedDeal}/agents/${agentType}/results`] });
          queryClient.removeQueries({ queryKey: [`/api/enterprise/deals/${selectedDeal}/agent/${agentType.charAt(0).toUpperCase() + agentType.slice(1)}/comprehensive`] });
        });
        
        // Clear all progress tracking caches
        queryClient.removeQueries({ queryKey: [`/api/analyses/${selectedDeal}`] });
        queryClient.removeQueries({ queryKey: [`/api/enterprise/progress/${selectedDeal}`] });
        queryClient.removeQueries({ queryKey: [`/api/analysis/deal-progress/${selectedDeal}`] });
        
        // Clear localStorage caches
        localStorage.removeItem(`deal-${selectedDeal}-progress`);
        localStorage.removeItem(`deal-${selectedDeal}-runId`);
        
        // Force reset UI state to 0% immediately
        queryClient.setQueryData([`/api/analyses/${selectedDeal}`], []);
        queryClient.setQueryData([`/api/enterprise/progress/${selectedDeal}`], { jobs: [], totalJobs: 0 });
        queryClient.setQueryData([`/api/analysis/deal-progress/${selectedDeal}`], { progress: { status: 'idle', agents: [] } });
        
        // Wait for cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
      
        // Step 2: Start job-based legacy analysis for all 7 agents
        console.log(`📋 Starting job-based legacy analysis for all 7 agents`);
        const response = await apiRequest(`/api/analysis/legacy/${parseInt(selectedDeal)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        console.log(`✅ Combined OCR analysis started:`, response);
        return response;
        
      } catch (mutationError) {
        console.error('❌ Critical error in Combined OCR analysis:', mutationError);
        throw new Error(`Combined OCR analysis failed: ${(mutationError as any)?.message || 'Unknown error'}`);
      }
    },
    onSuccess: (results) => {
      console.log(`✅ Job-based legacy analysis started for all 7 agents:`, results);
      
      // Show immediate feedback with job-based progress confirmation
      toast({
        title: "Job-Based Legacy Analysis Started",
        description: `Run ${results.runId} created. Progress bars will show gradual 0-100% progression for each agent.`,
        duration: 5000,
      });
      
      // Invalidate all agent result queries to refresh UI
      const agentTypes = ['clinical', 'legal', 'commercial', 'hr', 'financial', 'ip', 'research'];
      
      // Invalidate both legacy and new endpoints for comprehensive refresh
      agentTypes.forEach(agentType => {
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${selectedDeal}/agents/${agentType}/results`] });
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${selectedDeal}/${agentType}-analysis/comprehensive/results`] });
      });
      
      // Also invalidate regular agent endpoints for backwards compatibility
      agentTypes.forEach(agentType => {
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${selectedDeal}/agents/${agentType}/results`] });
      });
      queryClient.invalidateQueries({ queryKey: [`/api/analyses/${selectedDeal}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/background-jobs/${selectedDeal}`] });
      
      // Set up completion monitoring
      const checkCompletion = setInterval(async () => {
        try {
          const response = await fetch(`/api/analyses/${selectedDeal}`);
          const data = await response.json();
          
          if (Array.isArray(data) && data.length >= 7) {
            const allCompleted = data.every((analysis: any) => 
              analysis.status === 'Completed' || analysis.status === 'completed'
            );
            
            if (allCompleted) {
              console.log(`🎉 All comprehensive analyses completed! Refreshing data...`);
              setIsRunningAllAnalyses(false);
              clearInterval(checkCompletion);
              
              // Refresh all relevant queries
              queryClient.invalidateQueries({ queryKey: [`/api/analyses/${selectedDeal}`] });
              queryClient.invalidateQueries({ queryKey: [`/api/background-jobs/${selectedDeal}`] });
              agentTypes.forEach(agentType => {
                queryClient.invalidateQueries({ queryKey: [`/api/deals/${selectedDeal}/agents/${agentType}/results`] });
              });
              
              // Show completion notification
              toast({
                title: "Comprehensive Analyses Complete",
                description: "All 7 agent comprehensive analyses completed successfully!",
                duration: 5000,
              });
            }
          }
        } catch (error) {
          console.error('Error checking analysis completion:', error);
        }
      }, 3000); // Check every 3 seconds
      
      // Cleanup after 15 minutes max
      setTimeout(() => {
        setIsRunningAllAnalyses(false);
        clearInterval(checkCompletion);
      }, 900000);
    },
    onError: (error) => {
      console.error(`❌ Failed to start all analyses:`, error);
      setIsRunningAllAnalyses(false);
      
      // Show user-friendly error message
      toast({
        title: "Analysis Failed",
        description: "Failed to start analyses. This may be due to API quota limits. Please try again later.",
        variant: "destructive",
        duration: 5000,
      });
      
      // Clear any loading states
      queryClient.setQueryData([`/api/background-jobs/${selectedDeal}`], { jobs: [] });
    }
  });

  const handleRunAllAnalyses = () => {
    try {
      console.log(`🚀 Legacy Reset button clicked for deal ${selectedDeal}`);
      console.log('🔄 This will: 1) Delete all analyses 2) Start fresh Combined OCR for all 7 agents');
      
      if (!selectedDeal) {
        console.error('❌ No deal selected');
        toast({
          title: "No Deal Selected",
          description: "Please select a deal before running analyses.",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }
      
      // CRITICAL: Clear all cached analysis data IMMEDIATELY to reset progress to 0%
      queryClient.setQueryData([`/api/analyses/${selectedDeal}`], []);
      queryClient.setQueryData([`/api/enterprise/progress/${selectedDeal}`], { jobs: [], totalJobs: 0 });
      
      // Clear all agent-specific results caches
      const agentTypes = ['clinical', 'legal', 'commercial', 'hr', 'financial', 'ip', 'research'];
      agentTypes.forEach(agentType => {
        queryClient.setQueryData([`/api/deals/${selectedDeal}/agents/${agentType}/results`], null);
        queryClient.setQueryData([`/api/deals/${selectedDeal}/${agentType}-analysis/comprehensive/results`], null);
      });
      
      // Also invalidate to trigger fresh fetch
      queryClient.invalidateQueries({ queryKey: [`/api/analyses/${selectedDeal}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/enterprise/progress/${selectedDeal}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${selectedDeal}/documents`] });
      
      // Start the reset and analysis process
      setIsRunningAllAnalyses(true);
      
      toast({
        title: "Legacy Reset Started",
        description: "Progress reset to 0% - All answers cleared - Starting fresh Combined OCR for all 7 agents...",
        duration: 4000,
      });
      
      runAllAnalysesMutation.mutate();
      
    } catch (error) {
      console.error('❌ Critical error in handleRunAllAnalyses:', error);
      setIsRunningAllAnalyses(false);
      
      toast({
        title: "Critical Error",
        description: `Failed to start analyses: ${(error as any)?.message || 'Unknown error'}. Please refresh the page and try again.`,
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  // Handler for comprehensive analysis
  const handleComprehensiveAnalysis = () => {
    try {
      console.log(`🚀 Comprehensive Analysis button clicked for deal ${selectedDeal}`);
      console.log('🔄 This will: 1) Reset all analysis states 2) Launch fresh analysis for all 7 agents 3) Generate real answers');
      
      if (!selectedDeal) {
        console.error('❌ No deal selected');
        toast({
          title: "No Deal Selected", 
          description: "Please select a deal before running analysis.",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }
      
      // CRITICAL: Clear all cached analysis data IMMEDIATELY to reset progress to 0%
      queryClient.setQueryData([`/api/analyses/${selectedDeal}`], []);
      queryClient.setQueryData([`/api/enterprise/progress/${selectedDeal}`], { jobs: [], totalJobs: 0 });
      
      // Also invalidate to trigger fresh fetch
      queryClient.invalidateQueries({ queryKey: [`/api/analyses/${selectedDeal}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/enterprise/progress/${selectedDeal}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${selectedDeal}/documents`] });
      
      // Start the comprehensive analysis process
      setIsRunningAllAnalyses(true);
      
      toast({
        title: "Starting Comprehensive Analysis",
        description: "Progress reset to 0% - Deleting all previous answers and generating fresh analysis for all 7 agents...",
        duration: 4000,
      });
      
      comprehensiveAnalysisMutation.mutate();
      
    } catch (error) {
      console.error('❌ Error in handleComprehensiveAnalysis:', error);
      setIsRunningAllAnalyses(false);
      
      toast({
        title: "Error",
        description: `Failed to start analysis: ${(error as any)?.message || 'Unknown error'}`,
        variant: "destructive",
        duration: 5000,
      });
    }
  };

    return (
      <div className="container mx-auto px-4 py-6">
        <PageHeader 
          title="Due Diligence Analysis" 
          description="Analyze company documents and generate insights with AI agents."
        />
        
        {/* Deal Selection */}
      <Card className="bg-dark-light border-dark-lighter mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1">
              <label className="text-sm text-gray-400 mb-1 block">Select Deal</label>
              <Select 
                value={selectedDeal} 
                onValueChange={setSelectedDeal}
                disabled={isLoadingDeals}
              >
                <SelectTrigger className="bg-dark border-dark-lighter text-white focus:ring-primary h-10">
                  <SelectValue placeholder="Select a deal" />
                </SelectTrigger>
                <SelectContent className="bg-dark-lighter border-dark-lighter">
                  {Array.isArray(deals) ? deals.map((deal: any) => (
                    <SelectItem key={deal.id} value={deal.id.toString()}>
                      {deal.companyName}
                    </SelectItem>
                  )) : null}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="bg-dark-lighter hover:bg-dark border-dark-lighter h-10"
                onClick={handleFileUpload}
              >
                <Upload className="mr-2 h-4 w-4" />
                {showUploadField ? 'Hide Upload' : 'Upload Files'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      


      
      {/* Upload Field - Shows when Upload Files button is clicked */}
      {showUploadField && (
        <Card className="bg-dark-light border-dark-lighter mb-6">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Upload Documents</CardTitle>
            <CardDescription>Upload documents for AI analysis and due diligence review</CardDescription>
          </CardHeader>
          <CardContent>
            <FileUploadAnalysis dealId={selectedDeal} />
          </CardContent>
        </Card>
      )}
      
      {isLoadingDeals ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : currentDeal ? (
        <>
          {/* Company Information */}
          <Card className="bg-dark-light border-dark-lighter mb-6">
            <CardHeader>
              <CardTitle className="text-xl font-semibold">Company Information</CardTitle>
              <CardDescription>Overview of the company details and submission information</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="basic-info" className="w-full">
                <TabsList className="border-b border-dark-lighter bg-transparent mb-6 w-full justify-start">
                  <TabsTrigger
                    value="basic-info"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    Basic Information
                  </TabsTrigger>
                  <TabsTrigger
                    value="company-research"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    Company Research
                  </TabsTrigger>
                  <TabsTrigger
                    value="ai-scoring"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    AI Scoring
                  </TabsTrigger>
                  <TabsTrigger
                    value="pitchbook"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    Pitchbook
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="basic-info">
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="bg-dark border-dark-lighter">
                        <CardHeader>
                          <CardTitle className="text-lg">Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-gray-400">Company Name</label>
                            <p className="text-white font-semibold">{currentDeal.companyName}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Description</label>
                            <p className="text-gray-300">{currentDeal.description}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Sector</label>
                            <p className="text-white">{currentDeal.sector}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Stage</label>
                            <p className="text-white">{currentDeal.stage}</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-dark border-dark-lighter">
                        <CardHeader>
                          <CardTitle className="text-lg">Contact & Financial</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-gray-400">Location</label>
                            <p className="text-white">{currentDeal.location || 'Not specified'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Website</label>
                            {currentDeal.website ? (
                              <a 
                                href={currentDeal.website} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary-hover underline"
                              >
                                {currentDeal.website}
                              </a>
                            ) : (
                              <p className="text-gray-400">Not provided</p>
                            )}
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Funding Amount</label>
                            <p className="text-white font-semibold">
                              {currentDeal.fundingAmount 
                                ? `$${(currentDeal.fundingAmount / 1000000).toFixed(1)}M` 
                                : 'Not specified'
                              }
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">AI Score</label>
                            <div className="flex items-center gap-3">
                              <p className="text-white font-semibold">
                                {currentDeal.aiScore ? `${currentDeal.aiScore}/100` : 'Pending evaluation'}
                              </p>
                              {currentDeal.aiScore && (
                                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  currentDeal.aiScore >= 85 ? 'bg-green-600/20 text-green-400 border border-green-600/30' :
                                  currentDeal.aiScore >= 70 ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30' :
                                  'bg-red-600/20 text-red-400 border border-red-600/30'
                                }`}>
                                  {currentDeal.aiScore >= 85 ? 'Excellent' : currentDeal.aiScore >= 70 ? 'Good' : 'Moderate'}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="bg-dark border-dark-lighter">
                      <CardHeader>
                        <CardTitle className="text-lg">Submission Details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-400">Created At</label>
                            <p className="text-white">
                              {new Date(currentDeal.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Last Updated</label>
                            <p className="text-white">
                              {new Date(currentDeal.updatedAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Status</label>
                            <div className="inline-block">
                              <span className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full text-sm font-medium border border-blue-600/30">
                                {currentDeal.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="company-research">
                  <div className="pt-4">
                    <EnhancedCompanyResearch dealId={parseInt(selectedDeal)} />
                  </div>
                </TabsContent>

                <TabsContent value="ai-scoring">
                  <DynamicAIScoring 
                    dealId={parseInt(selectedDeal)} 
                    overallScore={currentDeal.aiScore}
                  />
                </TabsContent>

                <TabsContent value="pitchbook">
                  <div className="space-y-6">
                    <Card className="bg-dark border-dark-lighter">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <div className="h-8 w-8 bg-primary/20 rounded-lg flex items-center justify-center">
                            <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </div>
                          Pitchbook Integration
                        </CardTitle>
                        <CardDescription>
                          Market intelligence and company data from Pitchbook API
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="border-2 border-dashed border-dark-lighter rounded-lg p-8 text-center">
                          <div className="mx-auto w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                            <svg className="h-6 w-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-semibold text-white mb-2">Pitchbook API Integration</h3>
                          <p className="text-gray-400 mb-4 max-w-md mx-auto">
                            This section will display comprehensive market data, funding history, and competitive analysis from Pitchbook once the API integration is implemented.
                          </p>
                          <div className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600/20 border border-blue-600/30 rounded-lg text-blue-400 text-sm">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Coming Soon
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Card className="bg-dark-lighter border-dark-lighter">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base text-gray-300">Planned Features</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="flex items-center gap-2 text-sm text-gray-400">
                                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                Company financials and metrics
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-400">
                                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                Funding rounds and investors
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-400">
                                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                Market comparables
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-400">
                                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                Competitive landscape
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-dark-lighter border-dark-lighter">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base text-gray-300">Data Sources</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="flex items-center gap-2 text-sm text-gray-400">
                                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                Real-time market data
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-400">
                                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                Verified company information
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-400">
                                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                Industry benchmarks
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-400">
                                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                Investment trends
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          
          {/* Main Progress Bar - Restored */}
          {enterpriseProgress && enterpriseProgress.jobs && enterpriseProgress.jobs.length > 0 && (
            <Card className="bg-dark-light border-dark-lighter mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Analysis Progress</CardTitle>
                <CardDescription>
                  {enterpriseProgress.jobs.length} analysis{enterpriseProgress.jobs.length > 1 ? 'es' : ''} running
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {enterpriseProgress.jobs.map((job: any) => (
                    <div key={job.jobId} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-300">
                          {job.agentType} Analysis
                        </span>
                        <span className="text-sm text-gray-400">
                          {job.progress}%
                        </span>
                      </div>
                      <Progress value={job.progress} className="h-2" />
                      {job.currentStep && (
                        <p className="text-xs text-gray-500">
                          {job.currentStep}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Documents */}
          <Card className="bg-dark-light border-dark-lighter mb-6">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold">Documents</CardTitle>
                  <CardDescription>Uploaded documents for analysis</CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" className="bg-dark-lighter hover:bg-dark border-dark-lighter">
                    Export
                  </Button>
                  <Button>
                    Generate Memo
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!showDataRoom ? (
                <div className="relative overflow-hidden">
                  {/* Background gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-blue-500/5"></div>
                  
                  {/* Content */}
                  <div className="relative p-8 text-center">
                    {/* Icon with animated background */}
                    <div className="relative mb-6">
                      <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-blue-500/20 rounded-2xl flex items-center justify-center mx-auto border border-primary/20 backdrop-blur-sm">
                        <div className="w-16 h-16 bg-gradient-to-br from-primary/30 to-blue-500/30 rounded-xl flex items-center justify-center">
                          <LinkIcon className="h-8 w-8 text-primary" />
                        </div>
                      </div>
                      {/* Floating particles */}
                      <div className="absolute top-2 right-4 w-2 h-2 bg-primary/40 rounded-full animate-pulse"></div>
                      <div className="absolute bottom-4 left-6 w-1.5 h-1.5 bg-blue-400/40 rounded-full animate-pulse delay-300"></div>
                    </div>
                    
                    <h3 className="text-xl font-semibold text-white mb-3 bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
                      Connect Data Room
                    </h3>
                    <p className="text-gray-400 text-sm mb-8 max-w-md mx-auto leading-relaxed">
                      Upload ZIP files, individual documents, or connect to external data sources. 
                      Our AI will automatically analyze and categorize your documents with intelligent insights.
                    </p>
                    
                    {/* Features list */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-xs">
                      <div className="flex items-center justify-center space-x-2 p-3 bg-dark-lighter/50 rounded-lg border border-gray-700/50">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        <span className="text-gray-300">ZIP File Support</span>
                      </div>
                      <div className="flex items-center justify-center space-x-2 p-3 bg-dark-lighter/50 rounded-lg border border-gray-700/50">
                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                        <span className="text-gray-300">AI Analysis</span>
                      </div>
                      <div className="flex items-center justify-center space-x-2 p-3 bg-dark-lighter/50 rounded-lg border border-gray-700/50">
                        <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                        <span className="text-gray-300">Real-time OCR</span>
                      </div>
                    </div>
                    
                    <Button 
                      onClick={() => setShowDataRoom(true)}
                      className="bg-gradient-to-r from-primary to-green-400 hover:from-primary/80 hover:to-green-400/80 text-white font-medium px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                    >
                      <LinkIcon className="h-5 w-5 mr-2" />
                      Connect Data Room
                    </Button>
                  </div>
                </div>
              ) : (
                <DataRoomExplorer 
                  dealId={parseInt(selectedDeal!)} 
                  onUploadComplete={() => {
                    // Refresh documents and keep data room visible
                    queryClient.invalidateQueries({ queryKey: [`/api/deals/${selectedDeal}/documents`] });
                    queryClient.invalidateQueries({ queryKey: [`/api/analyses/${selectedDeal}`] });
                  }}
                />
              )}
            </CardContent>
          </Card>
          
          {/* AI Analysis Results */}
          <Card className="bg-dark-light border-dark-lighter">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl font-semibold">AI Analysis Results</CardTitle>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      try {
                        handleComprehensiveAnalysis();
                      } catch (buttonError) {
                        console.error('❌ Button click error:', buttonError);
                        toast({
                          title: "Button Error",
                          description: "Failed to handle button click. Please refresh the page.",
                          variant: "destructive",
                          duration: 5000,
                        });
                      }
                    }}
                    disabled={isRunningAllAnalyses || comprehensiveAnalysisMutation.isPending}
                    className="bg-primary hover:bg-primary/90 pt-[19px] pb-[19px]"
                    size="sm"
                  >
                    {isRunningAllAnalyses || comprehensiveAnalysisMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing Matrix
                      </>
                    ) : (
                      <>
                        <Bot className="h-4 w-4 mr-2" />
                        Comprehensive Analysis
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    onClick={() => {
                      try {
                        handleRunAllAnalyses();
                      } catch (buttonError) {
                        console.error('❌ Button click error:', buttonError);
                        toast({
                          title: "Button Error",
                          description: "Failed to handle button click. Please refresh the page.",
                          variant: "destructive",
                          duration: 5000,
                        });
                      }
                    }}
                    disabled={isRunningAllAnalyses || runAllAnalysesMutation.isPending}
                    variant="outline"
                    className="border-gray-600 hover:bg-gray-700 text-gray-300 pt-[19px] pb-[19px]"
                    size="sm"
                  >
                    {isRunningAllAnalyses || runAllAnalysesMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Legacy Mode
                      </>
                    ) : (
                      <>
                        <Bot className="h-4 w-4 mr-2" />
                        Legacy Reset
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>

              
              <Tabs value={activeAgent} onValueChange={setActiveAgent} className="w-full">
                <TabsList className="border-b border-dark-lighter bg-transparent mb-6 w-full justify-start">
                  <TabsTrigger
                    value="clinical"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    Clinical
                  </TabsTrigger>
                  <TabsTrigger
                    value="legal"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    Legal
                  </TabsTrigger>
                  <TabsTrigger
                    value="commercial"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    Commercial
                  </TabsTrigger>
                  <TabsTrigger
                    value="hr"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    HR
                  </TabsTrigger>
                  <TabsTrigger
                    value="financial"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    Financial
                  </TabsTrigger>
                  <TabsTrigger
                    value="ip"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    IP
                  </TabsTrigger>
                  <TabsTrigger
                    value="research"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    Research
                  </TabsTrigger>
                  <TabsTrigger
                    value="unassigned"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    Unassigned ({unassignedDocs.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="ai-agents"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    AI Agents
                  </TabsTrigger>
                </TabsList>

                {/* Agent Overview Progress - Always visible */}
                <div className="mb-6">
                  <AgentOverviewProgress 
                    dealId={parseInt(selectedDeal)}
                    agents={agentProgressData}
                    isRunningAllAnalyses={isRunningAllAnalyses}
                  />
                </div>
                
                <TabsContent value="clinical">
                  <EnhancedAgentCard 
                    dealId={parseInt(selectedDeal)}
                    agentType="Clinical"
                    analysis={Array.isArray(analyses) ? analyses.find((a: any) => a.agentType.toLowerCase() === 'clinical') : undefined}
                    isLoading={isLoadingAnalyses}
                    documents={documents}
                    isRunningAllAnalyses={isRunningAllAnalyses}
                    currentProgress={findJobSafely(enterpriseProgress?.jobs, ['Clinical', 'clinical'])?.progress || 0}
                    currentDocumentName={findJobSafely(enterpriseProgress?.jobs, ['Clinical', 'clinical'])?.currentDocument || findJobSafely(enterpriseProgress?.jobs, ['Clinical', 'clinical'])?.currentStep}
                    isRunningAnalysis={!!findJobSafely(enterpriseProgress?.jobs, ['Clinical', 'clinical'])}
                    onClinicalAnalysisStart={() => setClinicalAnalysisStarted(true)}
                  />
                </TabsContent>
                
                <TabsContent value="legal">
                  <EnhancedAgentCard 
                    dealId={parseInt(selectedDeal)}
                    agentType="Legal"
                    analysis={Array.isArray(analyses) ? analyses.find((a: any) => a.agentType.toLowerCase() === 'legal') : undefined}
                    isLoading={isLoadingAnalyses}
                    documents={documents}
                    isRunningAllAnalyses={isRunningAllAnalyses}
                    currentProgress={findJobSafely(enterpriseProgress?.jobs, ['Legal', 'legal'])?.progress || 0}
                    currentDocumentName={findJobSafely(enterpriseProgress?.jobs, ['Legal', 'legal'])?.currentDocument || findJobSafely(enterpriseProgress?.jobs, ['Legal', 'legal'])?.currentStep}
                    isRunningAnalysis={!!findJobSafely(enterpriseProgress?.jobs, ['Legal', 'legal'])}
                  />
                </TabsContent>
                
                <TabsContent value="commercial">
                  <EnhancedAgentCard 
                    dealId={parseInt(selectedDeal)}
                    agentType="Commercial"
                    analysis={Array.isArray(analyses) ? analyses.find((a: any) => a.agentType.toLowerCase() === 'commercial') : undefined}
                    isLoading={isLoadingAnalyses}
                    documents={documents}
                    isRunningAllAnalyses={isRunningAllAnalyses}
                    currentProgress={findJobSafely(enterpriseProgress?.jobs, ['Commercial', 'commercial'])?.progress || 0}
                    currentDocumentName={findJobSafely(enterpriseProgress?.jobs, ['Commercial', 'commercial'])?.currentDocument || findJobSafely(enterpriseProgress?.jobs, ['Commercial', 'commercial'])?.currentStep}
                    isRunningAnalysis={!!findJobSafely(enterpriseProgress?.jobs, ['Commercial', 'commercial'])}
                  />
                </TabsContent>
                
                <TabsContent value="hr">
                  <EnhancedAgentCard 
                    dealId={parseInt(selectedDeal)}
                    agentType="HR"
                    analysis={Array.isArray(analyses) ? analyses.find((a: any) => a.agentType.toLowerCase() === 'hr') : undefined}
                    isLoading={isLoadingAnalyses}
                    documents={documents}
                    isRunningAllAnalyses={isRunningAllAnalyses}
                    currentProgress={findJobSafely(enterpriseProgress?.jobs, ['HR', 'hr'])?.progress || 0}
                    currentDocumentName={findJobSafely(enterpriseProgress?.jobs, ['HR', 'hr'])?.currentDocument || findJobSafely(enterpriseProgress?.jobs, ['HR', 'hr'])?.currentStep}
                    isRunningAnalysis={!!findJobSafely(enterpriseProgress?.jobs, ['HR', 'hr'])}
                  />
                </TabsContent>
                
                <TabsContent value="financial">
                  <EnhancedAgentCard 
                    dealId={parseInt(selectedDeal)}
                    agentType="Financial"
                    analysis={Array.isArray(analyses) ? analyses.find((a: any) => a.agentType.toLowerCase() === 'financial') : undefined}
                    isLoading={isLoadingAnalyses}
                    documents={documents}
                    isRunningAllAnalyses={isRunningAllAnalyses}
                    currentProgress={findJobSafely(enterpriseProgress?.jobs, ['Financial', 'financial'])?.progress || 0}
                    currentDocumentName={findJobSafely(enterpriseProgress?.jobs, ['Financial', 'financial'])?.currentDocument || findJobSafely(enterpriseProgress?.jobs, ['Financial', 'financial'])?.currentStep}
                    isRunningAnalysis={!!findJobSafely(enterpriseProgress?.jobs, ['Financial', 'financial'])}
                  />
                </TabsContent>
                
                <TabsContent value="ip">
                  <EnhancedAgentCard 
                    dealId={parseInt(selectedDeal)}
                    agentType="IP"
                    analysis={Array.isArray(analyses) ? analyses.find((a: any) => a.agentType.toLowerCase() === 'ip') : undefined}
                    isLoading={isLoadingAnalyses}
                    documents={documents}
                    isRunningAllAnalyses={isRunningAllAnalyses}
                    currentProgress={findJobSafely(enterpriseProgress?.jobs, ['IP', 'ip'])?.progress || 0}
                    currentDocumentName={findJobSafely(enterpriseProgress?.jobs, ['IP', 'ip'])?.currentDocument || findJobSafely(enterpriseProgress?.jobs, ['IP', 'ip'])?.currentStep}
                    isRunningAnalysis={!!findJobSafely(enterpriseProgress?.jobs, ['IP', 'ip'])}
                  />
                </TabsContent>
                
                <TabsContent value="research">
                  <EnhancedAgentCard 
                    dealId={parseInt(selectedDeal)}
                    agentType="Research"
                    analysis={Array.isArray(analyses) ? analyses.find((a: any) => a.agentType === 'Research' || a.agentType.toLowerCase() === 'research') : undefined}
                    isLoading={isLoadingAnalyses}
                    documents={documents}
                    isRunningAllAnalyses={isRunningAllAnalyses}
                    currentProgress={findJobSafely(enterpriseProgress?.jobs, ['Research', 'research'])?.progress || 0}
                    currentDocumentName={findJobSafely(enterpriseProgress?.jobs, ['Research', 'research'])?.currentDocument || findJobSafely(enterpriseProgress?.jobs, ['Research', 'research'])?.currentStep}
                    isRunningAnalysis={!!findJobSafely(enterpriseProgress?.jobs, ['Research', 'research'])}
                  />
                </TabsContent>
                
                <TabsContent value="unassigned">
                  <UnassignedDocuments 
                    dealId={parseInt(selectedDeal)}
                    documents={unassignedDocs}
                    onAssignDocument={(docId: number, agentType: string) => {
                      // Invalidate queries to refresh UI after assignment
                      queryClient.invalidateQueries({ queryKey: [`/api/deals/${selectedDeal}/documents`] });
                      queryClient.invalidateQueries({ queryKey: [`/api/analyses/${selectedDeal}`] });
                    }}
                  />
                </TabsContent>
                
                <TabsContent value="ai-agents">
                  <div className="pt-4">
                    <DueDiligenceAgents dealId={parseInt(selectedDeal)} />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>


        </>
      ) : (
        <Card className="bg-dark-light border-dark-lighter">
          <CardContent className="py-12 text-center">
            <h3 className="text-xl font-semibold mb-2">No Deal Selected</h3>
            <p className="text-gray-400 mb-4">Please select a deal to view its due diligence analysis.</p>
          </CardContent>
        </Card>
        )}
      </div>
    );
    } catch (error) {
        console.error('Error in DueDiligenceContent:', error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
        return (
            <Card className="bg-dark-light border-dark-lighter">
                <CardContent className="py-12 text-center">
                    <h3 className="text-xl font-semibold mb-2">An error occurred</h3>
                    <p className="text-gray-400 mb-4">Please refresh the page or try again.</p>
                    <p className="text-red-400 text-sm mt-4">
                        Error: {error instanceof Error ? error.message : 'Unknown error'}
                    </p>
                </CardContent>
            </Card>
        );
    }
}

export default function DueDiligence() {
  return (
    <ErrorBoundary>
      <DueDiligenceContent />
    </ErrorBoundary>
  );
}
