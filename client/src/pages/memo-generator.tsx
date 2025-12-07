import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, Brain, TrendingUp, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { ProfessionalFormattedContent } from '@/components/ProfessionalFormattedContent';
import { SectionInfoBadge } from '@/components/memo-generator/SectionInfoBadge';
import { SectionEditor } from '@/components/memo-generator/SectionEditor';

interface ComprehensiveMemo {
  coverPage: string;
  executiveSummary: string;
  financialAnalysis: string;
  teamAssessment: string;
  marketAnalysis: string;
  riskAnalysis: string;
  regulatoryPathway: string;
  clinicalEvidence: string;
  intellectualProperty: string;
  investmentTerms: string;
  competitiveAnalysis: string;
  technologyAssessment: string;
  [key: string]: string | undefined;
}

function normalizeMemoData(rawMemo: any): ComprehensiveMemo | null {
  if (!rawMemo) return null;
  
  return {
    coverPage: rawMemo.coverPage || '',
    executiveSummary: rawMemo.executiveSummary || '',
    financialAnalysis: rawMemo.financialAnalysis || '',
    teamAssessment: rawMemo.teamAssessment || '',
    marketAnalysis: rawMemo.marketAnalysis || '',
    riskAnalysis: rawMemo.riskAnalysis || rawMemo.riskAssessment || '',
    regulatoryPathway: rawMemo.regulatoryPathway || rawMemo.regulatoryAnalysis || '',
    clinicalEvidence: rawMemo.clinicalEvidence || rawMemo.clinicalAssessment || '',
    intellectualProperty: rawMemo.intellectualProperty || rawMemo.ipAnalysis || '',
    investmentTerms: rawMemo.investmentTerms || '',
    competitiveAnalysis: rawMemo.competitiveAnalysis || '',
    technologyAssessment: rawMemo.technologyAssessment || '',
  };
}

export default function MemoGenerator() {
  const [selectedDeal, setSelectedDeal] = useState<string>('');
  const [generatedMemo, setGeneratedMemo] = useState<ComprehensiveMemo | null>(null);
  const [sectionSources, setSectionSources] = useState<Record<string, any>>({});
  const [isGenerationActive, setIsGenerationActive] = useState(false); // 🔥 FIX: Track if generation is actively running
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Track which jobs we've already shown success toasts for (prevents duplicate toasts)
  const shownSuccessJobsRef = useRef<Set<string>>(new Set());

  // 🔥 AUTO-SELECT DEAL FROM URL PARAMETER (when clicking Edit from memos page)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const dealParam = urlParams.get('deal');
    if (dealParam && !selectedDeal) {
      console.log(`🔗 Auto-selecting deal ${dealParam} from URL parameter`);
      setSelectedDeal(dealParam);
    }
  }, []); // Run once on mount

  // Load section sources when deal is selected (with cache busting)
  useEffect(() => {
    if (selectedDeal) {
      const loadSectionSources = async () => {
        try {
          console.log(`🔄 Loading section sources for deal ${selectedDeal}`);
          const mainSections = ['coverPage', 'executiveSummary', 'financialAnalysis', 'teamAssessment', 'marketAnalysis', 'riskAnalysis', 'regulatoryPathway', 'clinicalEvidence', 'intellectualProperty', 'investmentTerms', 'competitiveAnalysis', 'technologyAssessment'];
          const sourcePromises = mainSections.map(async (sectionKey) => {
            try {
              // Add cache busting parameter to ensure fresh data
              const timestamp = Date.now();
              const response = await fetch(`/api/deals/${selectedDeal}/memo/section-sources/${sectionKey}?t=${timestamp}`, {
                cache: 'no-cache',
                headers: {
                  'Cache-Control': 'no-cache',
                  'Pragma': 'no-cache'
                }
              });
              if (response.ok) {
                const data = await response.json();
                console.log(`📊 Section "${sectionKey}": ${data.sources?.ocrDocuments?.length || 0} OCR docs, ${data.sources?.agentAnalyses?.length || 0} agents`);
                return [sectionKey, data.sources];
              }
            } catch (error) {
              console.warn(`Failed to load sources for ${sectionKey}:`, error);
            }
            return [sectionKey, {}];
          });
          
          const results = await Promise.all(sourcePromises);
          const sourcesMap = Object.fromEntries(results);
          setSectionSources(sourcesMap);
          console.log(`✅ Loaded section sources for ${mainSections.length} sections`);
        } catch (error) {
          console.error('Failed to load section sources:', error);
        }
      };
      
      loadSectionSources();
    }
  }, [selectedDeal]);
  
  // Clear generated memo state when deal changes to ensure fresh loading from database
  useEffect(() => {
    if (selectedDeal) {
      setGeneratedMemo(null); // Clear local state to force database fetch
      console.log(`🔄 Deal changed to ${selectedDeal}, clearing local memo state`);
    }
  }, [selectedDeal]);
  
  // Fetch real deals from API with document and analysis counts
  const { data: deals, isLoading: isLoadingDeals } = useQuery({
    queryKey: ['/api/deals'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  // Fetch document and analysis counts for each deal with real-time updates
  const dealsArray = Array.isArray(deals) ? deals : [];
  const { data: dealCounts, isLoading: isLoadingCounts, refetch: refetchCounts } = useQuery({
    queryKey: ['/api/deals/counts', dealsArray.length],
    queryFn: async () => {
      if (!Array.isArray(deals) || deals.length === 0) return {};
      
      console.log(`🔄 Fetching document and analysis counts for ${deals.length} deals`);
      
      const countsPromises = deals.map(async (deal: any) => {
        try {
          const [docsResponse, analysesResponse] = await Promise.all([
            fetch(`/api/deals/${deal.id}/documents`),
            fetch(`/api/analyses/${deal.id}`)
          ]);
          
          const docsData = await docsResponse.json();
          const analysesData = await analysesResponse.json();
          
          
          // Handle the actual API response structure: {documents: [...], total: 378, page: 1}
          const docCount = docsData?.documents ? docsData.documents.length : 
                          Array.isArray(docsData) ? docsData.length : 0;
          const analysisCount = Array.isArray(analysesData) ? analysesData.length : 0;
          
          console.log(`📊 Deal ${deal.id} (${deal.companyName}): ${docCount} docs, ${analysisCount} analyses`);
          
          return {
            dealId: deal.id,
            documents: docCount,
            analyses: analysisCount
          };
        } catch (error) {
          console.warn(`Failed to fetch counts for deal ${deal.id}:`, error);
          return {
            dealId: deal.id,
            documents: 0,
            analyses: 0
          };
        }
      });
      
      const results = await Promise.all(countsPromises);
      const countsMap = results.reduce((acc, curr) => {
        acc[curr.dealId] = { documents: curr.documents, analyses: curr.analyses };
        return acc;
      }, {} as Record<number, { documents: number; analyses: number }>);
      
      console.log(`✅ Updated counts for ${results.length} deals`, countsMap);
      return countsMap;
    },
    enabled: Array.isArray(deals) && deals.length > 0,
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
  });
  
  // Auto-refresh counts when deals change and force immediate refresh
  useEffect(() => {
    if (Array.isArray(deals) && deals.length > 0) {
      console.log('🔄 Deals data updated, refreshing counts...');
      // Invalidate all count-related queries and force refetch
      queryClient.invalidateQueries({ queryKey: ['/api/deals/counts'] });
      refetchCounts();
    }
  }, [deals, refetchCounts, queryClient]);
  
  // Force immediate refresh on component mount
  useEffect(() => {
    if (Array.isArray(deals) && deals.length > 0) {
      console.log('🚀 Component mounted, forcing immediate count refresh...');
      // Clear any existing cache
      queryClient.removeQueries({ queryKey: ['/api/deals/counts'] });
      setTimeout(() => refetchCounts(), 100); // Small delay to ensure cache is cleared
    }
  }, []); // Run only on mount
  
  // Fetch existing memo if available
  const { data: existingMemo, isLoading: isLoadingMemo } = useQuery({
    queryKey: ['/api/deals', selectedDeal, 'memo'],
    queryFn: async () => {
      if (!selectedDeal) return null;
      console.log(`📋 Fetching memo for deal ${selectedDeal}`);
      const response = await fetch(`/api/deals/${selectedDeal}/memo`);
      const data = await response.json();
      console.log(`📋 Memo fetch response:`, { success: data.success, hasMemo: !!data.memo });
      return data;
    },
    enabled: !!selectedDeal,
    staleTime: 1000 * 60 * 5, // 5 minutes cache to ensure fresh data
  });

  // Helper function to find LATEST memo generation job
  const findMemoJob = (jobs: any[]) => {
    if (!jobs || !Array.isArray(jobs)) return null;
    
    // Filter all memo-related jobs
    const memoJobs = jobs.filter((job: any) => {
      if (!job || !job.jobType) return false;
      const jobType = job.jobType.toLowerCase();
      return jobType === 'investment_memo_generation' || 
             jobType.includes('memo') || 
             jobType.includes('investment_memo');
    });
    
    if (memoJobs.length === 0) return null;
    
    // Return the LATEST job based on metadata.lastUpdate or updatedAt
    return memoJobs.reduce((latest: any, current: any) => {
      const latestTime = latest?.metadata?.lastUpdate || latest?.updatedAt || 0;
      const currentTime = current?.metadata?.lastUpdate || current?.updatedAt || 0;
      return new Date(currentTime) > new Date(latestTime) ? current : latest;
    });
  };

  // Fetch job progress data - poll every 2 seconds when a job is running
  const { data: jobProgressData } = useQuery({
    queryKey: [`/api/background-jobs/${selectedDeal}`],
    enabled: !!selectedDeal,
    refetchInterval: (query) => {
      // Poll every 2 seconds if there's an active memo generation job
      const data = query.state.data as any;
      const memoJob = findMemoJob(data?.jobs || []);
      const isJobRunning = memoJob?.status === 'processing';
      return isJobRunning ? 2000 : false; // 2 second polling when running
    },
    staleTime: 1000, // Short cache to ensure fresh data
    queryFn: async () => {
      console.log(`📊 Polling for memo generation job progress for deal ${selectedDeal}`);
      const response = await fetch(`/api/background-jobs/${selectedDeal}`);
      const data = await response.json();
      console.log(`📊 Job progress data:`, data);
      if (data?.jobs?.length > 0) {
        console.log(`🔍 Available job types:`, data.jobs.map((j: any) => j.jobType));
        const memoJob = findMemoJob(data.jobs);
        if (memoJob) {
          console.log(`🔍 Memo job details:`, {
            jobType: memoJob.jobType,
            status: memoJob.status,
            progress: memoJob.progress,
            currentStep: memoJob.currentStep || memoJob.message
          });
        }
      }
      return data;
    }
  });

  // Create progress state from job data
  const memoProgress = useMemo(() => {
    const memoJob = findMemoJob(jobProgressData?.jobs || []);
    if (!memoJob) return null;
    
    return {
      isRunning: memoJob.status === 'processing',
      progress: memoJob.progress || 0,
      currentStep: memoJob.currentStep || memoJob.message || 'Generating investment memo...',
      status: memoJob.status || 'processing',
      jobId: memoJob.id
    };
  }, [jobProgressData]);

  // Auto-refresh memo when job completes
  useEffect(() => {
    if (memoProgress && memoProgress.status === 'completed' && memoProgress.progress === 100) {
      const jobId = memoProgress.jobId;
      
      // CRITICAL FIX: Prevent duplicate success toasts for the same job
      if (jobId && shownSuccessJobsRef.current.has(jobId)) {
        console.log(`⏭️ Already shown success toast for job ${jobId}, skipping...`);
        return;
      }
      
      console.log('✅ Memo generation job completed, refreshing memo data...');
      // 🔥 FIX: Stop generation mode when job completes
      setIsGenerationActive(false);
      
      // Invalidate and refetch memo
      queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
      }, 1000);
      
      // CRITICAL FIX: Only show success toast if memo actually exists in database
      // This prevents showing success for old completed jobs that have no memo
      setTimeout(() => {
        const memoData = queryClient.getQueryData(['/api/deals', selectedDeal, 'memo']) as any;
        if (memoData?.memo && Object.keys(memoData.memo).length > 0) {
          // Mark this job as shown BEFORE showing toast
          if (jobId) {
            shownSuccessJobsRef.current.add(jobId);
          }
          
          toast({
            title: "Memo Generated Successfully",
            description: "Your investment memo is ready to view.",
          });
        } else {
          console.log('⚠️ Job completed but no memo found in database, skipping success notification');
        }
      }, 1500); // Wait for memo refetch to complete
    } else if (memoProgress && memoProgress.status === 'failed') {
      console.log('❌ Memo generation job failed');
      // 🔥 FIX: Stop generation mode on failure
      setIsGenerationActive(false);
      
      toast({
        title: "Memo Generation Failed",
        description: "There was an error generating the memo. Please try again.",
        variant: "destructive",
      });
    }
  }, [memoProgress, selectedDeal, queryClient, toast]);

  // Memo generation mutation
  const generateMemoMutation = useMutation({
    mutationFn: async (dealId: string) => {
      console.log(`🔄 Generating comprehensive investment memo for deal ${dealId}`);
      
      const response = await apiRequest(`/api/deals/${dealId}/generate-memo`, {
        method: 'POST',
      });
      
      console.log('📝 Generate memo response:', { success: response.success, hasMemo: !!response.memo, error: response.error });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to generate memo');
      }
      
      return response.memo;
    },
    onSuccess: (memo: any) => {
      console.log('✅ Investment memo generation job started', { memo: !!memo, keys: memo ? Object.keys(memo) : [] });
      const normalizedMemo = normalizeMemoData(memo);
      setGeneratedMemo(normalizedMemo);
      // 🔥 FIX: Start generation mode - this keeps progress bar visible
      setIsGenerationActive(true);
      
      // Immediately refetch background jobs to start progress tracking
      queryClient.invalidateQueries({ queryKey: [`/api/background-jobs/${selectedDeal}`] });
      
      // CRITICAL FIX: Only show success toast if memo data actually exists
      // Otherwise the job is still running and we should show progress
      if (memo && Object.keys(memo).length > 0) {
        // Memo generated synchronously (fast path) - stop generation mode
        setIsGenerationActive(false);
        toast({
          title: "Investment Memo Generated",
          description: "Comprehensive memo created successfully. The memo content is now available.",
        });
        // Force immediate cache invalidation and refetch of the database memo
        queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
        setTimeout(() => {
          queryClient.refetchQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
        }, 1000); // Small delay to ensure database persistence
      } else {
        // Job started in background - show info toast instead
        toast({
          title: "Generating Investment Memo",
          description: "Memo generation started in background. You'll see live progress updates as sections are generated.",
        });
      }
    },
    onError: (error: any) => {
      console.error('❌ Memo generation failed:', error);
      // 🔥 FIX: Don't stop generation mode on timeout - job might still be running
      // Only stop on real errors (not timeout)
      if (!error?.message?.includes('timeout') && !error?.message?.includes('took too long')) {
        setIsGenerationActive(false);
      }
      
      // Check if memo was actually generated but API timed out
      setTimeout(() => {
        console.log('🔄 Checking for saved memo after timeout...');
        queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
        queryClient.refetchQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
      }, 2000);
      
      // Handle specific error types
      let title = "Generation Timeout";
      let description = "Memo generation may have completed in the background. Check for saved memo in a moment.";
      
      if (error?.message?.includes('quota') || error?.message?.includes('429')) {
        title = "API Quota Exceeded";
        description = "OpenAI API quota has been exceeded. Please check your billing and upgrade your plan if needed.";
      } else if (error?.message?.includes('rate limit')) {
        title = "Rate Limit Exceeded";
        description = "Too many requests. Please wait a moment and try again.";
      } else if (error?.message) {
        description = error.message;
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    }
  });

  const handleGenerateMemo = () => {
    if (!selectedDeal) {
      toast({
        title: "No Deal Selected",
        description: "Please select a deal to generate an investment memo.",
        variant: "destructive",
      });
      return;
    }

    generateMemoMutation.mutate(selectedDeal);
  };
  
  const isLoading = isLoadingDeals || isLoadingMemo || isLoadingCounts;
  const isGenerating = generateMemoMutation.isPending;
  // Use existing memo from database first, then fallback to newly generated memo
  // Apply normalization to handle both old and new key names
  const currentMemo = normalizeMemoData(existingMemo?.memo) || generatedMemo;
  const selectedDealData = Array.isArray(deals) ? deals.find((d: any) => d.id.toString() === selectedDeal) : null;
  
  // CRITICAL: Check if job is actually running (fixes the "instant success" bug)
  // The memo field can be NULL during generation (until 90%), so we must check job status first
  const hasActiveJob = memoProgress && memoProgress.isRunning;
  const hasMemoRecord = !!existingMemo; // Memo record exists even if memo field is NULL
  
  // 🔥 FIX: Progress bar stays visible throughout entire generation process
  const showProgressBar = isGenerating || hasActiveJob || isGenerationActive;
  
  // Debug logging
  console.log('🔍 Display Debug:', {
    existingMemo: !!existingMemo,
    existingMemoData: !!existingMemo?.memo,
    generatedMemo: !!generatedMemo,
    currentMemo: !!currentMemo,
    currentMemoKeys: currentMemo ? Object.keys(currentMemo) : [],
    isGenerating,
    hasActiveJob,
    isGenerationActive,
    showProgressBar,
    hasMemoRecord,
    memoProgress,
    selectedDeal,
    showReadyToGenerate: !currentMemo && !showProgressBar,
    showGenerating: showProgressBar,
    showMemoContent: !!currentMemo && !showProgressBar
  });
  
  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader 
        title="Investment Memo Generator" 
        description="Create comprehensive investment memos with AI assistance."
      />
      
      <div className="mb-6">
        <Card className="bg-dark-light border-dark-lighter">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <label className="text-sm text-gray-400 mb-1 block">Select Deal</label>
                <Select 
                  value={selectedDeal} 
                  onValueChange={setSelectedDeal}
                  disabled={isLoadingDeals || isLoadingCounts}
                >
                  <SelectTrigger className="bg-dark border-dark-lighter text-white focus:ring-primary">
                    <SelectValue placeholder="Select a deal to generate memo" />
                  </SelectTrigger>
                  <SelectContent className="bg-dark-lighter border-dark-lighter">
                    {isLoadingCounts ? (
                      <div className="p-2 text-gray-400">Loading data...</div>
                    ) : (
                      Array.isArray(deals) && deals.map((deal: any) => {
                        const counts = dealCounts?.[deal.id] || { documents: 0, analyses: 0 };
                        const hasData = counts.documents > 0 || counts.analyses > 0;
                        const status = hasData ? "✅" : "❌";
                        const dataInfo = hasData 
                          ? `(${counts.documents} docs${counts.analyses > 0 ? ` + ${counts.analyses} analyses` : ''})`
                          : "(no data)";
                        
                        
                        return (
                          <SelectItem key={deal.id} value={deal.id.toString()}>
                            {deal.companyName} - {deal.stage} {status} {dataInfo}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Memo Content */}
          <div className="lg:col-span-2">
            <Card className="bg-dark-light border-dark-lighter mb-6">
              <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Investment Memo</h2>
                </div>
                
{!selectedDeal ? (
                  <div className="text-center py-12">
                    <FileText className="h-16 w-16 text-gray-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-300 mb-2">Select a Deal</h3>
                    <p className="text-gray-500">Choose a deal from the dropdown to generate a comprehensive investment memo.</p>
                  </div>
                ) : !currentMemo && !isGenerating && !hasActiveJob ? (
                  <div className="text-center py-12">
                    <Brain className="h-16 w-16 text-primary mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">Ready to Generate</h3>
                    <p className="text-gray-400 mb-6">
                      Create a comprehensive investment memo using all documents, agent analyses, and market research for <span className="text-primary font-medium">{selectedDealData?.companyName}</span>.
                    </p>
                    {selectedDealData && ![18, 22, 33].includes(selectedDealData.id) && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
                        <p className="text-yellow-400 text-sm">
                          ⚠️ This deal has no documents or agent analyses. For best results, select Deal 33 (Neteera IM) with 100 documents and completed analyses.
                        </p>
                      </div>
                    )}
                    <Button onClick={handleGenerateMemo} className="bg-primary hover:bg-primary/90" data-testid="button-generate-memo">
                      <Brain className="h-4 w-4 mr-2" />
                      Generate Investment Memo
                    </Button>
                  </div>
                ) : showProgressBar ? (
                  <div className="py-8">
                    <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                      <CardContent className="pt-6">
                        <div className="space-y-6">
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                              <Loader2 className="h-12 w-12 text-primary animate-spin" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-xl font-semibold text-white mb-2">
                                Generating Investment Memo
                              </h3>
                              <p className="text-sm text-gray-400 mb-4">
                                Creating comprehensive analysis for {selectedDealData?.companyName}
                              </p>
                              
                              {/* Progress Bar */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-300 font-medium">
                                    {memoProgress?.currentStep || 'Initializing memo generation...'}
                                  </span>
                                  <span className="text-primary font-semibold">
                                    {memoProgress?.progress || 0}%
                                  </span>
                                </div>
                                <Progress 
                                  value={memoProgress?.progress || 0} 
                                  className="h-3 bg-dark-lighter"
                                  data-testid="memo-generation-progress-bar"
                                />
                              </div>

                              {/* Status Messages */}
                              <div className="mt-4 p-3 bg-dark-light/50 rounded-lg border border-dark-lighter">
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                                  <span>
                                    {memoProgress?.progress === 0 && 'Starting analysis...'}
                                    {memoProgress?.progress > 0 && memoProgress?.progress < 25 && 'Processing documents and analyses...'}
                                    {memoProgress?.progress >= 25 && memoProgress?.progress < 50 && 'Generating executive summary and highlights...'}
                                    {memoProgress?.progress >= 50 && memoProgress?.progress < 75 && 'Analyzing market and team assessment...'}
                                    {memoProgress?.progress >= 75 && memoProgress?.progress < 100 && 'Finalizing recommendations and appendices...'}
                                    {memoProgress?.progress === 100 && 'Completing memo generation...'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="space-y-8 max-h-[calc(100vh-200px)] overflow-y-auto pr-4 custom-scrollbar">{/* Single scrollable document layout */}
                      {/* Cover Page */}
                      {currentMemo?.coverPage && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
                              <div>
                                <CardTitle className="text-2xl text-white">Investment Memorandum</CardTitle>
                                <p className="text-slate-400 text-sm">Professional investment opportunity presentation</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-invert max-w-none">
                              <ProfessionalFormattedContent 
                                content={currentMemo.coverPage} 
                                variant="large"
                                className="text-slate-200 leading-relaxed"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      
                      {/* Executive Summary */}
                      {currentMemo?.executiveSummary && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <TrendingUp className="h-6 w-6 text-blue-400" />
                                <div>
                                  <CardTitle className="text-xl text-white">Executive Summary</CardTitle>
                                  <p className="text-slate-400 text-sm">Investment opportunity overview and key value proposition</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <SectionInfoBadge sources={sectionSources.executiveSummary || {}} />
                                <SectionEditor 
                                  dealId={selectedDeal}
                                  sectionKey="executiveSummary"
                                  sectionTitle="Executive Summary"
                                  currentContent={currentMemo.executiveSummary}
                                  onUpdate={(newContent) => {
                                    setGeneratedMemo(prev => prev ? { ...prev, executiveSummary: newContent } : null);
                                    queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
                                  }}
                                />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-invert max-w-none">
                              <ProfessionalFormattedContent 
                                content={currentMemo.executiveSummary} 
                                variant="large"
                                className="text-slate-200 leading-relaxed"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )}

                    {/* Market Analysis Section */}
                      {currentMemo?.marketAnalysis && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-8 bg-purple-500 rounded-full"></div>
                                <div>
                                  <CardTitle className="text-xl text-white">Market Analysis</CardTitle>
                                  <p className="text-slate-400 text-sm">Market size, timing, and competitive landscape assessment</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <SectionInfoBadge sources={sectionSources.marketAnalysis || {}} />
                                <SectionEditor 
                                  dealId={selectedDeal}
                                  sectionKey="marketAnalysis"
                                  sectionTitle="Market Analysis"
                                  currentContent={currentMemo.marketAnalysis}
                                  onUpdate={(newContent) => {
                                    setGeneratedMemo(prev => prev ? { ...prev, marketAnalysis: newContent } : null);
                                    queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
                                  }}
                                />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-invert max-w-none">
                              <ProfessionalFormattedContent 
                                content={currentMemo.marketAnalysis} 
                                variant="default"
                                className="text-slate-200 leading-relaxed"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Technology Assessment */}
                      {currentMemo?.technologyAssessment && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-8 bg-cyan-500 rounded-full"></div>
                                <div>
                                  <CardTitle className="text-xl text-white">Technology Assessment</CardTitle>
                                  <p className="text-slate-400 text-sm">Product overview and technological differentiation</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <SectionInfoBadge sources={sectionSources.technologyAssessment || {}} />
                                <SectionEditor 
                                  dealId={selectedDeal}
                                  sectionKey="technologyAssessment"
                                  sectionTitle="Technology Assessment"
                                  currentContent={currentMemo.technologyAssessment}
                                  onUpdate={(newContent) => {
                                    setGeneratedMemo(prev => prev ? { ...prev, technologyAssessment: newContent } : null);
                                    queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
                                  }}
                                />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-invert max-w-none">
                              <ProfessionalFormattedContent 
                                content={currentMemo.technologyAssessment} 
                                variant="default"
                                className="text-slate-200 leading-relaxed"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Team Assessment */}
                      {currentMemo?.teamAssessment && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-8 bg-violet-500 rounded-full"></div>
                                <div>
                                  <CardTitle className="text-xl text-white">Team Assessment</CardTitle>
                                  <p className="text-slate-400 text-sm">Leadership team evaluation and key personnel analysis</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <SectionInfoBadge sources={sectionSources.teamAssessment || {}} />
                                <SectionEditor 
                                  dealId={selectedDeal}
                                  sectionKey="teamAssessment"
                                  sectionTitle="Team Assessment"
                                  currentContent={currentMemo.teamAssessment}
                                  onUpdate={(newContent) => {
                                    setGeneratedMemo(prev => prev ? { ...prev, teamAssessment: newContent } : null);
                                    queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
                                  }}
                                />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-invert max-w-none">
                              <ProfessionalFormattedContent 
                                content={currentMemo.teamAssessment} 
                                variant="default"
                                className="text-slate-200 leading-relaxed"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Clinical Evidence */}
                      {currentMemo?.clinicalEvidence && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-8 bg-red-500 rounded-full"></div>
                                <div>
                                  <CardTitle className="text-xl text-white">Clinical Evidence</CardTitle>
                                  <p className="text-slate-400 text-sm">Clinical evaluation and regulatory pathway analysis</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <SectionInfoBadge sources={sectionSources.clinicalEvidence || {}} />
                                <SectionEditor 
                                  dealId={selectedDeal}
                                  sectionKey="clinicalEvidence"
                                  sectionTitle="Clinical Evidence"
                                  currentContent={currentMemo.clinicalEvidence}
                                  onUpdate={(newContent) => {
                                    setGeneratedMemo(prev => prev ? { ...prev, clinicalEvidence: newContent } : null);
                                    queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
                                  }}
                                />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-invert max-w-none">
                              <ProfessionalFormattedContent 
                                content={currentMemo.clinicalEvidence} 
                                variant="default" 
                                className="text-slate-200 leading-relaxed"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Intellectual Property */}
                      {currentMemo?.intellectualProperty && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-8 bg-indigo-500 rounded-full"></div>
                                <div>
                                  <CardTitle className="text-xl text-white">Intellectual Property</CardTitle>
                                  <p className="text-slate-400 text-sm">Patent portfolio and IP protection strategy</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <SectionInfoBadge sources={sectionSources.intellectualProperty || {}} />
                                <SectionEditor 
                                  dealId={selectedDeal}
                                  sectionKey="intellectualProperty"
                                  sectionTitle="Intellectual Property"
                                  currentContent={currentMemo.intellectualProperty}
                                  onUpdate={(newContent) => {
                                    setGeneratedMemo(prev => prev ? { ...prev, intellectualProperty: newContent } : null);
                                    queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
                                  }}
                                />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-invert max-w-none">
                              <ProfessionalFormattedContent 
                                content={currentMemo.intellectualProperty} 
                                variant="default" 
                                className="text-slate-200 leading-relaxed"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Regulatory Pathway */}
                      {currentMemo?.regulatoryPathway && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-8 bg-teal-500 rounded-full"></div>
                                <div>
                                  <CardTitle className="text-xl text-white">Regulatory Pathway</CardTitle>
                                  <p className="text-slate-400 text-sm">Regulatory landscape and compliance assessment</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <SectionInfoBadge sources={sectionSources.regulatoryPathway || {}} />
                                <SectionEditor 
                                  dealId={selectedDeal}
                                  sectionKey="regulatoryPathway"
                                  sectionTitle="Regulatory Pathway"
                                  currentContent={currentMemo.regulatoryPathway}
                                  onUpdate={(newContent) => {
                                    setGeneratedMemo(prev => prev ? { ...prev, regulatoryPathway: newContent } : null);
                                    queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
                                  }}
                                />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-invert max-w-none">
                              <ProfessionalFormattedContent 
                                content={currentMemo.regulatoryPathway} 
                                variant="default"
                                className="text-slate-200 leading-relaxed"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Competitive Analysis */}
                      {currentMemo?.competitiveAnalysis && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-8 bg-orange-500 rounded-full"></div>
                                <div>
                                  <CardTitle className="text-xl text-white">Competitive Analysis</CardTitle>
                                  <p className="text-slate-400 text-sm">Competitive landscape and market positioning</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <SectionInfoBadge sources={sectionSources.competitiveAnalysis || {}} />
                                <SectionEditor 
                                  dealId={selectedDeal}
                                  sectionKey="competitiveAnalysis"
                                  sectionTitle="Competitive Analysis"
                                  currentContent={currentMemo.competitiveAnalysis}
                                  onUpdate={(newContent) => {
                                    setGeneratedMemo(prev => prev ? { ...prev, competitiveAnalysis: newContent } : null);
                                    queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
                                  }}
                                />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-invert max-w-none">
                              <ProfessionalFormattedContent 
                                content={currentMemo.competitiveAnalysis} 
                                variant="default"
                                className="text-slate-200 leading-relaxed"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      
                    {/* Financial Analysis Section */}
                      {currentMemo?.financialAnalysis && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-8 bg-green-500 rounded-full"></div>
                                <div>
                                  <CardTitle className="text-xl text-white">Financial Analysis</CardTitle>
                                  <p className="text-slate-400 text-sm">Financial performance and projections overview</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <SectionInfoBadge sources={sectionSources.financialAnalysis || {}} />
                                <SectionEditor 
                                  dealId={selectedDeal}
                                  sectionKey="financialAnalysis"
                                  sectionTitle="Financial Analysis"
                                  currentContent={currentMemo.financialAnalysis}
                                  onUpdate={(newContent) => {
                                    setGeneratedMemo(prev => prev ? { ...prev, financialAnalysis: newContent } : null);
                                    queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
                                  }}
                                />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-invert max-w-none">
                              <ProfessionalFormattedContent 
                                content={currentMemo.financialAnalysis} 
                                variant="default"
                                className="text-slate-200 leading-relaxed"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Investment Terms */}
                      {currentMemo?.investmentTerms && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
                                <div>
                                  <CardTitle className="text-xl text-white">Investment Terms</CardTitle>
                                  <p className="text-slate-400 text-sm">Deal structure, valuation, and investment terms</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <SectionInfoBadge sources={sectionSources.investmentTerms || {}} />
                                <SectionEditor 
                                  dealId={selectedDeal}
                                  sectionKey="investmentTerms"
                                  sectionTitle="Investment Terms"
                                  currentContent={currentMemo.investmentTerms}
                                  onUpdate={(newContent) => {
                                    setGeneratedMemo(prev => prev ? { ...prev, investmentTerms: newContent } : null);
                                    queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
                                  }}
                                />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-invert max-w-none">
                              <ProfessionalFormattedContent 
                                content={currentMemo.investmentTerms} 
                                variant="default"
                                className="text-slate-200 leading-relaxed"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Risk Analysis */}
                      {currentMemo?.riskAnalysis && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-8 bg-red-500 rounded-full"></div>
                                <div>
                                  <CardTitle className="text-xl text-white">Risk Analysis</CardTitle>
                                  <p className="text-slate-400 text-sm">Investment risks and mitigation strategies</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <SectionInfoBadge sources={sectionSources.riskAnalysis || {}} />
                                <SectionEditor 
                                  dealId={selectedDeal}
                                  sectionKey="riskAnalysis"
                                  sectionTitle="Risk Analysis"
                                  currentContent={currentMemo.riskAnalysis}
                                  onUpdate={(newContent) => {
                                    setGeneratedMemo(prev => prev ? { ...prev, riskAnalysis: newContent } : null);
                                    queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
                                  }}
                                />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-invert max-w-none">
                              <ProfessionalFormattedContent 
                                content={currentMemo.riskAnalysis} 
                                variant="default"
                                className="text-slate-200 leading-relaxed"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Right Column - Controls */}
          <div>
            <Card className="bg-dark-light border-dark-lighter sticky top-6">
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Generation Controls</h3>
                
                {selectedDealData && (
                  <div className="space-y-4 mb-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-1">Selected Deal</h4>
                      <p className="text-white font-medium">{selectedDealData.companyName}</p>
                      <p className="text-sm text-gray-400">{selectedDealData.stage} • {selectedDealData.status}</p>
                    </div>
                    
                    <div className="flex space-x-4 text-sm">
                      <div>
                        <span className="text-gray-400">Sector:</span>
                        <span className="text-white ml-1">{selectedDealData.sector}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Location:</span>
                        <span className="text-white ml-1">{selectedDealData.location}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <Button 
                    onClick={handleGenerateMemo}
                    disabled={!selectedDeal || isGenerating}
                    className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : existingMemo?.memo ? (
                      <>
                        <Brain className="h-4 w-4 mr-2" />
                        Regenerate Memo
                      </>
                    ) : (
                      <>
                        <Brain className="h-4 w-4 mr-2" />
                        Generate Comprehensive Memo
                      </>
                    )}
                  </Button>

                  {existingMemo?.memo && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        <span className="text-green-400 text-sm font-medium">Saved Memo Available</span>
                      </div>
                      <p className="text-green-300 text-xs">
                        Generated on {existingMemo.createdAt ? new Date(existingMemo.createdAt).toLocaleDateString() : 'Unknown date'}
                      </p>
                    </div>
                  )}
                  
                  {currentMemo && (
                    <div className="space-y-2">
                      <Button 
                        variant="outline" 
                        className="w-full border-dark-lighter text-white hover:bg-dark-lighter"
                        onClick={async () => {
                          try {
                            const response = await fetch(`/api/deals/${selectedDeal}/export-pdf`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                            });
                            
                            if (!response.ok) {
                              throw new Error('Export failed');
                            }
                            
                            // Create blob and download
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `Investment_Memo_${selectedDealData?.companyName || 'Company'}_${new Date().toISOString().split('T')[0]}.pdf`;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);
                            
                            toast({
                              title: "PDF Export Complete",
                              description: "Investment memo has been exported as PDF with BAIBYS structure.",
                            });
                          } catch (error) {
                            toast({
                              title: "Export Failed",
                              description: "Failed to export PDF. Please try again.",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Export PDF
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        className="w-full border-dark-lighter text-white hover:bg-dark-lighter"
                        onClick={async () => {
                          try {
                            const response = await fetch(`/api/deals/${selectedDeal}/export-docx`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                            });
                            
                            if (!response.ok) {
                              throw new Error('Export failed');
                            }
                            
                            // Create blob and download
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `Investment_Memo_${selectedDealData?.companyName || 'Company'}_${new Date().toISOString().split('T')[0]}.docx`;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);
                            
                            toast({
                              title: "Word Export Complete", 
                              description: "Investment memo has been exported as Word document with BAIBYS structure.",
                            });
                          } catch (error) {
                            toast({
                              title: "Export Failed",
                              description: "Failed to export Word document. Please try again.",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export Word
                      </Button>
                    </div>
                  )}
                </div>
                
                {selectedDeal && (
                  <div className="mt-6 pt-6 border-t border-dark-lighter">
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Memo will include:</h4>
                    <ul className="space-y-2 text-sm text-gray-300">
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                        All uploaded documents
                      </li>
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                        7 agent analyses (Legal, Financial, etc.)
                      </li>
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                        AI-powered market research
                      </li>
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-orange-400 rounded-full mr-2"></span>
                        Investment recommendation
                      </li>
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
