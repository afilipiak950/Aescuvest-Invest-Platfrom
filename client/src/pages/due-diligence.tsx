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
import { Loader2, Upload, Link as LinkIcon, Bot, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Deal, AgentAnalysis, Document } from '@/types';

export default function DueDiligence() {
  const [location] = useLocation();
  const [selectedDeal, setSelectedDeal] = useState<string>('1'); // Default to first deal
  const [activeAgent, setActiveAgent] = useState<string>('legal');
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadField, setShowUploadField] = useState(false);
  const [showDataRoom, setShowDataRoom] = useState(true); // Always show data room
  const [isRunningAllAnalyses, setIsRunningAllAnalyses] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Parse URL parameters and set selected deal
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const dealParam = searchParams.get('deal');
    if (dealParam) {
      setSelectedDeal(dealParam);
    }
  }, [location]);

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
    enabled: !!selectedDeal && isRunningAllAnalyses,
    refetchInterval: 1000, // Poll every second for real-time progress
    queryFn: async () => {
      console.log(`📊 Polling for job progress for deal ${selectedDeal}`);
      const response = await fetch(`/api/background-jobs/${selectedDeal}`);
      const data = await response.json();
      console.log(`📊 Job progress data:`, data);
      return data;
    }
  });

  // Fetch comprehensive legal analysis progress for persistent display
  const { data: legalProgress } = useQuery({
    queryKey: [`/api/deals/${selectedDeal}/legal-analysis/comprehensive/progress`],
    enabled: !!selectedDeal,
    refetchInterval: 2000, // Poll every 2 seconds for progress updates
    queryFn: async () => {
      const response = await fetch(`/api/deals/${selectedDeal}/legal-analysis/comprehensive/progress`);
      const data = await response.json();
      return data;
    }
  });

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
    analysesLength: (analyses && Array.isArray(analyses)) ? analyses.length : 'not array',
    agentTypes: Array.isArray(analyses) ? analyses.map((a: any) => a.agentType) : 'no data'
  });

  const currentDeal = Array.isArray(deals) ? deals.find((deal: any) => deal.id.toString() === selectedDeal) : undefined;
  
  // Calculate unassigned documents using real database assignments from analyses
  const unassignedDocs = useMemo(() => {
    if (!documents || !Array.isArray(documents)) {
      console.log('📊 Missing documents data for unassigned calculation');
      return [];
    }

    // Get all document NAMES and IDs that are actually assigned to agents from database
    const allAssignedDocNames = new Set();
    const allAssignedDocIds = new Set();
    
    if (analyses && Array.isArray(analyses)) {
      analyses.forEach((analysis: any) => {
        if (analysis.documentSources && Array.isArray(analysis.documentSources)) {
          analysis.documentSources.forEach((docNameOrId: string) => {
            // Check if it's a document ID (numeric string) or document name
            const numericId = parseInt(docNameOrId);
            if (!isNaN(numericId) && numericId.toString() === docNameOrId) {
              // It's a document ID
              allAssignedDocIds.add(numericId);
            } else {
              // It's a document name
              allAssignedDocNames.add(docNameOrId);
            }
          });
        }
      });
    }
    
    // Return documents that are not assigned to any agent in the database (check both name and ID)
    const unassigned = documents.filter((doc: any) => 
      !allAssignedDocNames.has(doc.name) && !allAssignedDocIds.has(doc.id)
    );
    
    // Debug logging to understand assignment distribution
    console.log('📊 Assignment debugging:', {
      totalDocuments: documents.length,
      assignedByName: allAssignedDocNames.size,
      assignedById: allAssignedDocIds.size,
      unassignedCount: unassigned.length,
      totalAnalyses: (analyses && Array.isArray(analyses)) ? analyses.length : 0
    });
    
    console.log('📊 Unassigned calculation (database-based):', { 
      totalDocs: documents.length, 
      assignedDocNames: allAssignedDocNames.size, 
      unassignedCount: unassigned.length,
      analysesCount: analyses && Array.isArray(analyses) ? analyses.length : 0,
      sampleAssignedNames: Array.from(allAssignedDocNames).slice(0, 5),
      sampleDocumentNames: documents.slice(0, 3).map((doc: any) => doc.name),
      firstDocAssigned: documents.length > 0 ? allAssignedDocNames.has(documents[0].name) : false
    });
    
    // Debug: Log detailed analysis breakdown
    if (analyses && Array.isArray(analyses)) {
      console.log('📋 Analysis breakdown:');
      analyses.forEach((analysis: any) => {
        console.log(`  ${analysis.agentType}: ${analysis.documentSources ? analysis.documentSources.length : 0} docs`);
      });
    }
    
    return unassigned;
  }, [documents, analyses]);
  
  const handleFileUpload = async () => {
    setShowUploadField(!showUploadField);
  };

  // Mutation for running all agent analyses (manual trigger)
  const runAllAnalysesMutation = useMutation({
    mutationFn: async () => {
      const agentTypes = ['clinical', 'legal', 'commercial', 'hr', 'financial', 'ip', 'research'];
      console.log(`🚀 Starting fresh comprehensive analysis for all ${agentTypes.length} agents`);
      
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
        
        // Wait for cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (deleteError) {
        console.error(`❌ Failed to delete existing analyses:`, deleteError);
        // Continue anyway - the analyses will be overwritten
      }
      
      // Step 3: Run all agent analyses in parallel with force refresh
      const promises = agentTypes.map(agentType => 
        apiRequest(`/api/deals/${selectedDeal}/agents/${agentType}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forceRefresh: true })
        })
      );
      
      return Promise.all(promises);
    },
    onSuccess: (results) => {
      console.log(`✅ All agent analyses started successfully:`, results);
      
      // Show immediate feedback
      toast({
        title: "Analyses Started",
        description: "All AI agents are now analyzing documents...",
        duration: 3000,
      });
      
      // Invalidate all agent results queries to refresh UI
      const agentTypes = ['clinical', 'legal', 'commercial', 'hr', 'financial', 'ip', 'research'];
      agentTypes.forEach(agentType => {
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${selectedDeal}/agents/${agentType}/results`] });
      });
      queryClient.invalidateQueries({ queryKey: [`/api/analyses/${selectedDeal}`] });
      
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
              console.log(`🎉 All analyses completed! Refreshing data...`);
              setIsRunningAllAnalyses(false);
              clearInterval(checkCompletion);
              
              // Refresh all relevant queries
              queryClient.invalidateQueries({ queryKey: [`/api/analyses/${selectedDeal}`] });
              agentTypes.forEach(agentType => {
                queryClient.invalidateQueries({ queryKey: [`/api/deals/${selectedDeal}/agents/${agentType}/results`] });
              });
              
              // Show completion notification
              toast({
                title: "Analyses Complete",
                description: "All agent analyses completed successfully!",
                duration: 5000,
              });
            }
          }
        } catch (error) {
          console.error('Error checking analysis completion:', error);
        }
      }, 2000); // Check every 2 seconds
      
      // Cleanup after 10 minutes max
      setTimeout(() => {
        setIsRunningAllAnalyses(false);
        clearInterval(checkCompletion);
      }, 600000);
    },
    onError: (error) => {
      console.error(`❌ Failed to start all analyses:`, error);
      setIsRunningAllAnalyses(false);
    }
  });

  const handleRunAllAnalyses = () => {
    console.log(`🚀 Reset & Run All Analyses button clicked for deal ${selectedDeal}`);
    setIsRunningAllAnalyses(true);
    
    // Immediately show loading feedback
    toast({
      title: "Resetting Analyses",
      description: "Stopping all running analyses and starting fresh...",
      duration: 2000,
    });
    
    // Immediately invalidate all agent queries to clear existing data and show loading states
    const agentTypes = ['clinical', 'legal', 'commercial', 'hr', 'financial', 'ip', 'research'];
    agentTypes.forEach(agentType => {
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${selectedDeal}/agents/${agentType}/results`] });
    });
    queryClient.invalidateQueries({ queryKey: [`/api/analyses/${selectedDeal}`] });
    
    runAllAnalysesMutation.mutate();
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
      
      {/* Global Legal Analysis Progress - Persistent across all tabs */}
      {legalProgress?.isRunning && (
        <Card className="bg-blue-500/5 border-blue-500/20 mb-6">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                <div>
                  <h3 className="text-white font-medium">Legal Analysis in Progress</h3>
                  <p className="text-blue-400 text-sm">
                    {legalProgress.currentStep || 'Processing legal documents'}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-blue-400 border-blue-400">
                {legalProgress.progress || 0}%
              </Badge>
            </div>
            
            <div className="w-full bg-dark-lighter rounded-full h-3 relative overflow-hidden border border-blue-500/30">
              <div 
                className="bg-gradient-to-r from-blue-500 to-blue-400 h-3 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${Math.max(5, Math.min(100, legalProgress.progress || 0))}%` }}
              >
                <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse"></div>
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
              <span>Analyzing 169 legal documents across 15 question categories</span>
              <span>Current: {legalProgress.currentDocumentName || 'Processing'}</span>
            </div>
          </CardContent>
        </Card>
      )}
      
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
                <Button 
                  onClick={handleRunAllAnalyses}
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
                
                <TabsContent value="clinical">
                  <EnhancedAgentCard 
                    dealId={parseInt(selectedDeal)}
                    agentType="Clinical"
                    analysis={Array.isArray(analyses) ? analyses.find((a: any) => a.agentType.toLowerCase() === 'clinical') : undefined}
                    isLoading={isLoadingAnalyses}
                    documents={documents}
                    isRunningAllAnalyses={isRunningAllAnalyses}
                    currentProgress={jobProgress?.jobs?.find((job: any) => job.jobId.includes('clinical'))?.progress || 0}
                    currentDocumentName={jobProgress?.jobs?.find((job: any) => job.jobId.includes('clinical'))?.currentStep}
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
                    currentProgress={jobProgress?.jobs?.find((job: any) => job.jobId.includes('legal'))?.progress || 0}
                    currentDocumentName={jobProgress?.jobs?.find((job: any) => job.jobId.includes('legal'))?.currentStep}
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
                    currentProgress={jobProgress?.jobs?.find((job: any) => job.jobId.includes('commercial'))?.progress || 0}
                    currentDocumentName={jobProgress?.jobs?.find((job: any) => job.jobId.includes('commercial'))?.currentStep}
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
                    currentProgress={jobProgress?.jobs?.find((job: any) => job.jobId.includes('hr'))?.progress || 0}
                    currentDocumentName={jobProgress?.jobs?.find((job: any) => job.jobId.includes('hr'))?.currentStep}
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
                    currentProgress={jobProgress?.jobs?.find((job: any) => job.jobId.includes('financial'))?.progress || 0}
                    currentDocumentName={jobProgress?.jobs?.find((job: any) => job.jobId.includes('financial'))?.currentStep}
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
                    currentProgress={jobProgress?.jobs?.find((job: any) => job.jobId.includes('ip'))?.progress || 0}
                    currentDocumentName={jobProgress?.jobs?.find((job: any) => job.jobId.includes('ip'))?.currentStep}
                  />
                </TabsContent>
                
                <TabsContent value="research">
                  <EnhancedAgentCard 
                    dealId={parseInt(selectedDeal)}
                    agentType="Research"
                    analysis={Array.isArray(analyses) ? analyses.find((a: any) => a.agentType.toLowerCase() === 'research') : undefined}
                    isLoading={isLoadingAnalyses}
                    documents={documents}
                    isRunningAllAnalyses={isRunningAllAnalyses}
                    currentProgress={jobProgress?.jobs?.find((job: any) => job.jobId.includes('research'))?.progress || 0}
                    currentDocumentName={jobProgress?.jobs?.find((job: any) => job.jobId.includes('research'))?.currentStep}
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
