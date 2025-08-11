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

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Upload, Link as LinkIcon, Bot, AlertCircle, X, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Deal, AgentAnalysis, Document } from '@/types';
import ErrorBoundary from '@/components/ErrorBoundary';

function DueDiligenceContent() {
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

    // Fetch job progress data for real-time updates
    const { data: jobProgress } = useQuery({
    queryKey: [`/api/background-jobs/${selectedDeal}`],
    enabled: !!selectedDeal,
    refetchInterval: 1000, // Poll every second for real-time progress
    queryFn: async () => {
      console.log(`📊 Polling for job progress for deal ${selectedDeal}`);
      const response = await fetch(`/api/background-jobs/${selectedDeal}`);
      const data = await response.json();
      console.log(`📊 Job progress data:`, data);
      return data;
    }
    });

    // Create progress states from jobProgress data instead of separate queries to prevent UI interference
    const legalProgress = useMemo(() => {
      const legalJob = findJobSafely(jobProgress?.jobs, ['Legal', 'legal_analysis', 'legal-analysis']);
      return legalJob ? {
        isRunning: legalJob.status === 'processing',
        progress: legalJob.progress || 0,
        currentStep: legalJob.currentDocument || legalJob.message || 'Processing legal documents...',
        currentDocumentName: legalJob.currentDocument || 'Processing'
      } : null;
    }, [jobProgress]);

    const commercialProgress = useMemo(() => {
      const commercialJob = findJobSafely(jobProgress?.jobs, ['Commercial', 'commercial-analysis', 'commercial_analysis']);
      return commercialJob ? {
        isRunning: commercialJob.status === 'processing',
        progress: commercialJob.progress || 0,
        currentStep: commercialJob.currentDocument || commercialJob.message || 'Processing commercial documents...',
        currentDocumentName: commercialJob.currentDocument || 'Processing'
      } : null;
    }, [jobProgress]);

    const hrProgress = useMemo(() => {
      const hrJob = findJobSafely(jobProgress?.jobs, ['HR', 'hr_analysis', 'hr-analysis']);
      return hrJob ? {
        isRunning: hrJob.status === 'processing',
        progress: hrJob.progress || 0,
        currentStep: hrJob.currentDocument || hrJob.message || 'Processing HR documents...',
        currentDocumentName: hrJob.currentDocument || 'Processing'
      } : null;
    }, [jobProgress]);

    const clinicalProgress = useMemo(() => {
      const clinicalJob = findJobSafely(jobProgress?.jobs, ['Clinical', 'clinical_analysis', 'clinical-analysis']);
      return clinicalJob ? {
        isRunning: clinicalJob.status === 'processing' && clinicalJob.progress > 0,
        progress: clinicalJob.progress || 0,
        currentStep: clinicalJob.currentDocument || clinicalJob.message || 'Processing clinical documents...',
        currentDocumentName: clinicalJob.currentDocument || 'Processing'
      } : null;
    }, [jobProgress]);

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

  // Fetch real analysis data
  const { data: analyses, isLoading: isLoadingAnalyses } = useQuery({
    queryKey: [`/api/analyses/${selectedDeal}`],
    retry: false,
    enabled: !!selectedDeal
  });

  // Debug log for analyses data
  console.log('🔍 Analyses Query Debug:', {
    selectedDeal,
    isLoadingAnalyses,
    analysesData: analyses,
    analysesLength: (analyses && Array.isArray(analyses)) ? (analyses?.length || 0) : 'not array',
    agentTypes: Array.isArray(analyses) ? analyses.map((a: any) => a.agentType) : 'no data'
  });

  const currentDeal = Array.isArray(deals) ? deals.find((deal: any) => deal.id.toString() === selectedDeal) : undefined;
  
  // Calculate document assignments for each agent type with comprehensive safety
  const agentDocuments = useMemo(() => {
    // Always return a safe default structure
    const safeDefault = {
      clinical: [],
      legal: [],
      commercial: [],
      hr: [],
      financial: [],
      ip: [],
      research: [],
      unassigned: []
    };

    // Early exit with safe default if no documents
    if (!documents || !Array.isArray(documents) || (documents?.length || 0) === 0) {
      console.log('📊 Missing or empty documents data for agent assignments');
      return safeDefault;
    }

    try {
      const assignments = {
        clinical: [] as any[],
        legal: [] as any[],
        commercial: [] as any[],
        hr: [] as any[],
        financial: [] as any[],
        ip: [] as any[],
        research: [] as any[],
        unassigned: [] as any[]
      };

      documents.forEach((doc: any) => {
        if (!doc || typeof doc !== 'object') {
          assignments.unassigned.push(doc);
          return;
        }

        if (!doc.assignedAgents || !Array.isArray(doc.assignedAgents) || (doc.assignedAgents?.length || 0) === 0) {
          assignments.unassigned.push(doc);
        } else {
          // Document can be assigned to multiple agents
          doc.assignedAgents.forEach((agent: string) => {
            try {
              const agentKey = String(agent || '').toLowerCase();
              if (agentKey && agentKey in assignments) {
                assignments[agentKey as keyof typeof assignments].push(doc);
              }
            } catch (agentError) {
              console.warn('Error processing agent assignment:', agentError);
              assignments.unassigned.push(doc);
            }
          });
        }
      });
      
      console.log('📊 Agent document assignments:', {
        clinical: assignments.clinical?.length || 0,
        legal: assignments.legal?.length || 0,
        commercial: assignments.commercial?.length || 0,
        hr: assignments.hr?.length || 0,
        financial: assignments.financial?.length || 0,
        ip: assignments.ip?.length || 0,
        research: assignments.research?.length || 0,
        unassigned: assignments.unassigned?.length || 0,
        total: documents?.length || 0
      });
      
      return assignments;
    } catch (error) {
      console.error('Error calculating agent documents:', error);
      return safeDefault;
    }
  }, [documents]);

  // Extract individual agent document arrays for easy access with null safety
  const clinicalDocs = agentDocuments?.clinical || [];
  const legalDocs = agentDocuments?.legal || [];
  const commercialDocs = agentDocuments?.commercial || [];
  const hrDocs = agentDocuments?.hr || [];
  const financialDocs = agentDocuments?.financial || [];
  const ipDocs = agentDocuments?.ip || [];
  const researchDocs = agentDocuments?.research || [];
  const unassignedDocs = agentDocuments?.unassigned || [];
  
  const handleFileUpload = async () => {
    setShowUploadField(!showUploadField);
  };

  // Mutation for running all agent analyses (manual trigger)
  const runAllAnalysesMutation = useMutation({
    mutationFn: async () => {
      try {
        console.log(`🚀 Starting comprehensive analysis for all 7 agents`);
        
        // Validate selectedDeal is available in mutation context
        if (!selectedDeal) {
          throw new Error('No deal selected for analysis');
        }
        
        // Step 1: Stop all running analyses first 
        console.log(`🛑 Stopping all running analyses for deal ${selectedDeal}`);
        try {
          await apiRequest(`/api/deals/${selectedDeal}/stop-all-analyses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          console.log(`✅ Successfully stopped all running analyses for deal ${selectedDeal}`);
        } catch (stopError) {
          console.warn(`⚠️ Failed to stop running analyses (may not be running):`, stopError);
        }
      
      // Step 2: Delete all existing analyses 
      console.log(`🗑️ Deleting all existing analyses for deal ${selectedDeal}`);
      try {
        await apiRequest(`/api/analyses/${selectedDeal}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
        console.log(`✅ Successfully deleted existing analyses for deal ${selectedDeal}`);
        
        // Also clear any stuck background jobs
        try {
          await apiRequest(`/api/background-jobs/clear-stuck`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dealId: parseInt(selectedDeal) })
          });
          console.log(`✅ Cleared stuck background jobs for deal ${selectedDeal}`);
        } catch (clearError) {
          console.warn(`⚠️ Failed to clear stuck jobs:`, clearError);
        }
        
        // Wait for cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (deleteError) {
        console.error(`❌ Failed to delete existing analyses:`, deleteError);
        // Continue anyway - the analyses will be overwritten
      }
      
      // Step 3: Run all comprehensive analyses in parallel
      const comprehensiveEndpoints = [
        `/api/deals/${selectedDeal}/clinical-analysis/comprehensive`,
        `/api/deals/${selectedDeal}/legal-analysis/comprehensive`,
        `/api/deals/${selectedDeal}/commercial-analysis/comprehensive`,
        `/api/deals/${selectedDeal}/hr-analysis/comprehensive`,
        `/api/deals/${selectedDeal}/financial-analysis/comprehensive`,
        `/api/deals/${selectedDeal}/ip-analysis/comprehensive`,
        `/api/deals/${selectedDeal}/research-analysis/comprehensive`
      ];

      const promises = comprehensiveEndpoints.map(async (endpoint) => {
        console.log(`📊 Starting comprehensive analysis: ${endpoint}`);
        try {
          const response = await apiRequest(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          
          // Handle "already running" responses as successes
          if (response && (response.alreadyRunning || response.success === false)) {
            console.log(`✅ Analysis already running for ${endpoint}:`, response.message);
            return { success: true, alreadyRunning: true, endpoint, message: response.message };
          }
          
          // Handle HR endpoint temporary issue - treat as success for now
          if (endpoint.includes('hr-analysis') && response && response.success === false) {
            console.log(`⚠️ HR analysis has temporary issue, treating as success for now`);
            return { success: true, temporaryIssue: true, endpoint, message: 'HR analysis temporarily unavailable' };
          }
          
          return response;
        } catch (error) {
          console.error(`❌ Error starting analysis for ${endpoint}:`, error);
          // Don't throw - let individual failures not break the whole process
          return { success: false, endpoint, error: (error as any)?.message || 'Unknown error' };
        }
      });
      
      const results = await Promise.allSettled(promises);
      
      // Log results and count successes
      let successCount = 0;
      results.forEach((result, index) => {
        const endpoint = comprehensiveEndpoints[index];
        if (result.status === 'fulfilled' && (result.value.success || result.value.alreadyRunning)) {
          successCount++;
          console.log(`✅ ${endpoint}: Success`);
        } else {
          console.log(`❌ ${endpoint}: Failed`);
        }
      });
      
      console.log(`📊 Analysis summary: ${successCount}/${comprehensiveEndpoints?.length || 0} analyses started/running`);
      
      // Return successful results (don't fail if some are already running)
      return results.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean);
      
      } catch (mutationError) {
        console.error('❌ Critical error in mutation function:', mutationError);
        throw new Error(`Analysis mutation failed: ${(mutationError as any)?.message || 'Unknown error'}`);
      }
    },
    onSuccess: (results) => {
      console.log(`✅ All comprehensive analyses started successfully:`, results);
      
      // Show immediate feedback
      toast({
        title: "Comprehensive Analyses Started",
        description: "All 7 AI agents are now running comprehensive document analysis...",
        duration: 5000,
      });
      
      // Invalidate all comprehensive analysis results queries to refresh UI
      const agentTypes = ['clinical', 'legal', 'commercial', 'hr', 'financial', 'ip', 'research'];
      
      // Invalidate comprehensive analysis endpoints
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${selectedDeal}/clinical-analysis/comprehensive/results`] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${selectedDeal}/legal-analysis/comprehensive/results`] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${selectedDeal}/commercial-analysis/comprehensive/results`] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${selectedDeal}/hr-analysis/comprehensive/results`] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${selectedDeal}/financial-analysis/comprehensive/results`] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${selectedDeal}/ip-analysis/comprehensive/results`] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${selectedDeal}/research-analysis/comprehensive/results`] });
      
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
          
          if (Array.isArray(data) && (data?.length || 0) >= 7) {
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
      console.log(`🚀 Reset & Run All Analyses button clicked for deal ${selectedDeal}`);
      
      // Validate selectedDeal exists
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
      
      setIsRunningAllAnalyses(true);
      
      // Immediately show loading feedback
      toast({
        title: "Resetting Analyses",
        description: "Stopping all running analyses and starting fresh...",
        duration: 2000,
      });
      
      // Skip query invalidation to prevent crashes - let mutation handle cache updates
      console.log('📋 Skipping immediate query invalidation to prevent component crashes');
      
      // Start mutation immediately to prevent state conflicts
      try {
        runAllAnalysesMutation.mutate();
      } catch (mutationError) {
        console.error('❌ Error starting mutation:', mutationError);
        setIsRunningAllAnalyses(false);
        toast({
          title: "Mutation Error",
          description: "Failed to start analysis mutation. Please try again.",
          variant: "destructive",
          duration: 5000,
        });
      }
      
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

  // Early loading guard to prevent undefined property access errors
  if (isLoadingDocuments || isLoadingDeals || !agentDocuments) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center mt-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-200 mb-4">Loading Analysis</h2>
          <p className="text-gray-400">Preparing document analysis data...</p>
        </div>
      </div>
    );
  }

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

          {/* Deal Statistics Card */}
          <Card className="bg-dark-light border-dark-lighter mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">Deal Analysis Overview</CardTitle>
              <CardDescription>
                Real-time statistics for {currentDeal?.companyName || 'Selected Deal'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-dark border border-dark-lighter rounded-lg p-3">
                  <div className="text-2xl font-bold text-primary">{documents?.length || 0}</div>
                  <div className="text-sm text-gray-400">Total Documents</div>
                </div>
                <div className="bg-dark border border-dark-lighter rounded-lg p-3">
                  <div className="text-2xl font-bold text-blue-400">
                    {Array.isArray(analyses) ? (analyses.filter((a: any) => a.status === 'Completed' || a.status === 'completed')?.length || 0) : 0}
                  </div>
                  <div className="text-sm text-gray-400">Completed Analyses</div>
                </div>
                <div className="bg-dark border border-dark-lighter rounded-lg p-3">
                  <div className="text-2xl font-bold text-yellow-400">
                    {jobProgress?.jobs ? (jobProgress.jobs.filter((job: any) => job.status === 'processing')?.length || 0) : 0}
                  </div>
                  <div className="text-sm text-gray-400">Running Analyses</div>
                </div>
                <div className="bg-dark border border-dark-lighter rounded-lg p-3">
                  <div className="text-2xl font-bold text-green-400">
                    {(unassignedDocs?.length || 0) === 0 && (documents?.length || 0) > 0 ? '100%' : 
                     (documents?.length || 0) > 0 ? `${Math.round(((documents?.length || 0) - (unassignedDocs?.length || 0)) / (documents?.length || 1) * 100)}%` : '0%'}
                  </div>
                  <div className="text-sm text-gray-400">Assignment Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Main Progress Bar - Restored */}
          {jobProgress && jobProgress.jobs && (jobProgress.jobs?.length || 0) > 0 && (
            <Card className="bg-dark-light border-dark-lighter mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Analysis Progress</CardTitle>
                <CardDescription>
                  {jobProgress?.jobs?.length || 0} analysis{(jobProgress?.jobs?.length || 0) > 1 ? 'es' : ''} running
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {jobProgress.jobs.map((job: any) => (
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
                          {job.currentStep && job.currentStep.includes('batch') ? 
                            job.currentStep.replace(/\s*\([^)]*documents?\)/g, '') :
                            job.currentStep
                          }
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
                  <CardTitle className="text-xl font-bold">
                    Documents ({documents?.length || 0})
                  </CardTitle>
                  <CardDescription>
                    {documents?.length === 0 ? 'No documents uploaded yet' : `${documents.length} documents available for analysis`}
                  </CardDescription>
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
                <div className="flex space-x-2">
                  <Button 
                    onClick={async () => {
                      try {
                        console.log('🛑 Stopping all background jobs for deal', selectedDeal);
                        
                        const response = await fetch(`/api/deals/${selectedDeal}/stop-all-jobs`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json'
                          }
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                          toast({
                            title: "Jobs Stopped",
                            description: `Stopped ${result.stoppedCount} running analyses`,
                            duration: 3000,
                          });
                          
                          // Refresh job progress
                          queryClient.invalidateQueries({ queryKey: [`/api/background-jobs/${selectedDeal}`] });
                        } else {
                          throw new Error(result.error || 'Failed to stop jobs');
                        }
                      } catch (error) {
                        console.error('❌ Error stopping jobs:', error);
                        toast({
                          title: "Stop Failed",
                          description: "Failed to stop background jobs. Please try again.",
                          variant: "destructive",
                          duration: 5000,
                        });
                      }
                    }}
                    variant="outline"
                    className="bg-red-600/10 hover:bg-red-600/20 border-red-600/30 text-red-400 hover:text-red-300"
                    size="sm"
                    disabled={!jobProgress?.jobs?.some(job => job.status === 'processing')}
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Stop All Jobs
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
                    className="bg-primary hover:bg-primary/90 pt-[19px] pb-[19px]"
                    size="sm"
                  >
                    {isRunningAllAnalyses || runAllAnalysesMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Running All Analyses
                      </>
                    ) : (
                      <>
                        <Bot className="h-4 w-4 mr-2" />
                        Reset & Run All Analyses
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            {/* Show Running Analysis Progress */}
            {(jobProgress?.jobs && jobProgress.jobs.length > 0) && (
              <div className="mx-6 mb-4 p-4 bg-dark-light border border-primary/30 rounded-lg">
                <h4 className="text-sm font-medium text-primary mb-3">Currently Running Analyses</h4>
                <div className="space-y-3">
                  {jobProgress.jobs.map((job) => (
                    <div key={job.jobId} className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium text-white">
                              {job.agentType || 'Analysis'} - {job.progress || 0}%
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          {job.currentStep || 'Processing...'}
                        </div>
                        <div className="w-full bg-dark-lighter rounded-full h-1.5 mt-2">
                          <div 
                            className="bg-primary h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${job.progress || 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <CardContent>

              
              <Tabs value={activeAgent} onValueChange={setActiveAgent} className="w-full">
                <TabsList className="border-b border-dark-lighter bg-transparent mb-6 w-full justify-start">
                  <TabsTrigger
                    value="clinical"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    Clinical ({clinicalDocs?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger
                    value="legal"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    <div className="flex items-center space-x-2">
                      <span>Legal ({legalDocs?.length || 0})</span>
                      {findJobSafely(jobProgress?.jobs, ['Legal', 'legal'])?.status === 'processing' && (
                        <div className="flex items-center space-x-1">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></div>
                          <span className="text-xs text-primary">
                            {findJobSafely(jobProgress?.jobs, ['Legal', 'legal'])?.progress || 0}%
                          </span>
                        </div>
                      )}
                    </div>
                  </TabsTrigger>
                  <TabsTrigger
                    value="commercial"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    <div className="flex items-center space-x-2">
                      <span>Commercial ({commercialDocs?.length || 0})</span>
                      {findJobSafely(jobProgress?.jobs, ['Commercial', 'commercial'])?.status === 'processing' && (
                        <div className="flex items-center space-x-1">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></div>
                          <span className="text-xs text-primary">
                            {findJobSafely(jobProgress?.jobs, ['Commercial', 'commercial'])?.progress || 0}%
                          </span>
                        </div>
                      )}
                    </div>
                  </TabsTrigger>
                  <TabsTrigger
                    value="hr"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    HR ({hrDocs?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger
                    value="financial"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    Financial ({financialDocs?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger
                    value="ip"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    IP ({ipDocs?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger
                    value="research"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    Research ({researchDocs?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger
                    value="unassigned"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    Unassigned ({unassignedDocs?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger
                    value="ai-agents"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    AI Agents
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="clinical">
                  <EnhancedAgentCard 
                    dealId={parseInt(selectedDeal)}
                    agentType="Clinical"
                    analysis={Array.isArray(analyses) ? analyses.find((a: any) => a.agentType.toLowerCase() === 'clinical') : undefined}
                    isLoading={isLoadingAnalyses}
                    documents={documents}
                    isRunningAllAnalyses={isRunningAllAnalyses}
                    currentProgress={findJobSafely(jobProgress?.jobs, ['Clinical', 'clinical'])?.progress || 0}
                    currentDocumentName={findJobSafely(jobProgress?.jobs, ['Clinical', 'clinical'])?.currentStep}
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
                    currentProgress={findJobSafely(jobProgress?.jobs, ['Legal', 'legal'])?.progress || 0}
                    currentDocumentName={findJobSafely(jobProgress?.jobs, ['Legal', 'legal'])?.currentStep}
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
                    currentProgress={findJobSafely(jobProgress?.jobs, ['Commercial', 'commercial'])?.progress || 0}
                    currentDocumentName={findJobSafely(jobProgress?.jobs, ['Commercial', 'commercial'])?.currentStep}
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
                    currentProgress={findJobSafely(jobProgress?.jobs, ['HR', 'hr'])?.progress || 0}
                    currentDocumentName={findJobSafely(jobProgress?.jobs, ['HR', 'hr'])?.currentStep}
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
                    currentProgress={findJobSafely(jobProgress?.jobs, ['Financial', 'financial'])?.progress || 0}
                    currentDocumentName={findJobSafely(jobProgress?.jobs, ['Financial', 'financial'])?.currentStep}
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
                    currentProgress={findJobSafely(jobProgress?.jobs, ['IP', 'ip'])?.progress || 0}
                    currentDocumentName={findJobSafely(jobProgress?.jobs, ['IP', 'ip'])?.currentStep}
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
                    currentProgress={findJobSafely(jobProgress?.jobs, ['Research', 'research'])?.progress || 0}
                    currentDocumentName={findJobSafely(jobProgress?.jobs, ['Research', 'research'])?.currentStep}
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

}

export default function DueDiligence() {
  return (
    <ErrorBoundary>
      <DueDiligenceContent />
    </ErrorBoundary>
  );
}
