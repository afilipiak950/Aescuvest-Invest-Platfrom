import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, Brain, TrendingUp, Download, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { ProfessionalFormattedContent } from '@/components/ProfessionalFormattedContent';
import { SectionInfoBadge } from '@/components/memo-generator/SectionInfoBadge';
import { SectionEditor } from '@/components/memo-generator/SectionEditor';
import { MemoSectionRerunButton } from '@/components/memoSections/MemoSectionRerunButton';
import { MemoSectionProgressPanel } from '@/components/memoSections/MemoSectionProgressPanel';
import { MemoMarkdownRenderer } from '@/components/MemoMarkdownRenderer';

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

function flattenToString(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (typeof item === 'string') {
          const trimmed = item.trim();
          return trimmed.length > 0 ? `• ${trimmed}` : '';
        }
        return flattenToString(item);
      })
      .filter(s => s.trim().length > 0)
      .join('\n');
  }
  if (typeof value === 'object') {
    const parts: string[] = [];
    for (const [key, val] of Object.entries(value)) {
      if (val !== null && val !== undefined) {
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
        const content = flattenToString(val);
        if (content.length > 0) {
          parts.push(`**${label}**\n${content}`);
        }
      }
    }
    return parts.join('\n\n');
  }
  return String(value);
}

function normalizeMemoData(rawMemo: any): ComprehensiveMemo | null {
  if (!rawMemo) return null;
  
  // CRITICAL FIX: Backend saves sections to memo.sections.coverPage, but also might save to memo.coverPage
  // Check BOTH locations and prefer the nested sections structure (used by section rerun service)
  const sections = rawMemo.sections || {};
  
  // Helper to get section content from either location, preferring the sections object
  const getSection = (key: string, altKey?: string): string => {
    // First try the nested sections object (where section rerun saves content)
    if (sections[key]) return flattenToString(sections[key]);
    // Then try the top-level key
    if (rawMemo[key]) return flattenToString(rawMemo[key]);
    // Try alternate key if provided
    if (altKey && sections[altKey]) return flattenToString(sections[altKey]);
    if (altKey && rawMemo[altKey]) return flattenToString(rawMemo[altKey]);
    return '';
  };
  
  return {
    coverPage: getSection('coverPage'),
    executiveSummary: getSection('executiveSummary'),
    financialAnalysis: getSection('financialAnalysis'),
    teamAssessment: getSection('teamAssessment'),
    marketAnalysis: getSection('marketAnalysis'),
    riskAnalysis: getSection('riskAnalysis', 'riskAssessment'),
    regulatoryPathway: getSection('regulatoryPathway', 'regulatoryAnalysis'),
    clinicalEvidence: getSection('clinicalEvidence', 'clinicalAssessment'),
    intellectualProperty: getSection('intellectualProperty', 'ipAnalysis'),
    investmentTerms: getSection('investmentTerms'),
    competitiveAnalysis: getSection('competitiveAnalysis'),
    technologyAssessment: getSection('technologyAssessment'),
  };
}

// Generating placeholder component for sections in progress
function SectionGeneratingPlaceholder({ 
  title, 
  description,
  colorClass = "bg-slate-500"
}: { 
  title: string; 
  description: string;
  colorClass?: string;
}) {
  return (
    <Card className="border-slate-700 bg-slate-900/50 opacity-80">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-8 ${colorClass} rounded-full animate-pulse`}></div>
            <div>
              <CardTitle className="text-xl text-white flex items-center gap-2">
                {title}
                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              </CardTitle>
              <p className="text-slate-400 text-sm">{description}</p>
            </div>
          </div>
          <span className="text-xs text-blue-400 bg-blue-500/20 px-2 py-1 rounded">Generating...</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="h-4 bg-slate-700/50 rounded animate-pulse w-full"></div>
          <div className="h-4 bg-slate-700/50 rounded animate-pulse w-3/4"></div>
          <div className="h-4 bg-slate-700/50 rounded animate-pulse w-5/6"></div>
          <div className="h-4 bg-slate-700/50 rounded animate-pulse w-2/3"></div>
        </div>
      </CardContent>
    </Card>
  );
}

// Section metadata for generating placeholders
const SECTION_METADATA: Record<string, { title: string; description: string; colorClass: string }> = {
  coverPage: { title: "Cover Page", description: "Investment memo title and company details", colorClass: "bg-slate-500" },
  executiveSummary: { title: "Executive Summary", description: "Investment opportunity overview", colorClass: "bg-blue-500" },
  marketAnalysis: { title: "Market Analysis", description: "Market size and competitive landscape", colorClass: "bg-purple-500" },
  technologyAssessment: { title: "Technology Assessment", description: "Product and technological differentiation", colorClass: "bg-cyan-500" },
  clinicalEvidence: { title: "Clinical Evidence", description: "Clinical data and trial outcomes", colorClass: "bg-green-500" },
  regulatoryPathway: { title: "Regulatory Pathway", description: "FDA/regulatory strategy and timeline", colorClass: "bg-amber-500" },
  intellectualProperty: { title: "Intellectual Property", description: "Patent portfolio and IP protection", colorClass: "bg-indigo-500" },
  competitiveAnalysis: { title: "Competitive Analysis", description: "Market position and competitor assessment", colorClass: "bg-pink-500" },
  teamAssessment: { title: "Team Assessment", description: "Management team capabilities", colorClass: "bg-teal-500" },
  financialAnalysis: { title: "Financial Analysis", description: "Financial metrics and projections", colorClass: "bg-emerald-500" },
  investmentTerms: { title: "Investment Terms", description: "Deal structure and valuation", colorClass: "bg-blue-500" },
  riskAnalysis: { title: "Risk Analysis", description: "Investment risks and mitigation", colorClass: "bg-red-500" },
};

// Low confidence warning card component - shows content but with warning badge
function SectionLowConfidenceCard({ 
  title, 
  description,
  content,
  colorClass = "bg-amber-500",
  onRegenerate
}: { 
  title: string; 
  description: string;
  content: string;
  colorClass?: string;
  onRegenerate: () => void;
}) {
  return (
    <Card className="border-amber-700/50 bg-amber-900/10">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-8 ${colorClass} rounded-full`}></div>
            <div>
              <CardTitle className="text-xl text-white flex items-center gap-2">
                {title}
                <span className="text-xs text-amber-400 bg-amber-500/20 px-2 py-1 rounded flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Limited Data
                </span>
              </CardTitle>
              <p className="text-slate-400 text-sm">{description}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRegenerate}
            className="border-amber-500 text-amber-400 hover:bg-amber-500/20"
          >
            Regenerate
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-amber-400 text-xs mb-3">
          This section was generated with limited available data. Consider uploading more documents for a complete analysis.
        </div>
        <MemoMarkdownRenderer content={content} />
      </CardContent>
    </Card>
  );
}

export default function MemoGenerator() {
  const [selectedDeal, setSelectedDeal] = useState<string>('');
  const [generatedMemo, setGeneratedMemo] = useState<ComprehensiveMemo | null>(null);
  const [sectionSources, setSectionSources] = useState<Record<string, any>>({});
  const [isGenerationActive, setIsGenerationActive] = useState(false); // 🔥 FIX: Track if generation is actively running
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportStep, setExportStep] = useState('');
  const [exportProgress, setExportProgress] = useState(0);
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
  
  // Fetch existing memo if available - poll during generation to show sections as they complete
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
    staleTime: isGenerationActive ? 300 : 1000 * 60 * 5, // Very short cache during generation
    refetchInterval: isGenerationActive ? 1000 : false, // Poll every 1s during generation for faster section display
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

  // Check if there's an active job from job progress data (for reload detection)
  const hasActiveJobFromProgress = useMemo(() => {
    const memoJob = findMemoJob(jobProgressData?.jobs || []);
    return memoJob?.status === 'processing';
  }, [jobProgressData]);

  // Fetch section rerun statuses for progress tracking
  // Enabled when either isGenerationActive is true OR we detect an active job from job progress
  const { data: sectionStatusesData } = useQuery({
    queryKey: ['/api/deals', selectedDeal, 'memo', 'sections', 'status'],
    enabled: !!selectedDeal && (isGenerationActive || hasActiveJobFromProgress),
    refetchInterval: (isGenerationActive || hasActiveJobFromProgress) ? 1000 : false, // Poll every 1s during generation for faster section display
    queryFn: async () => {
      const response = await fetch(`/api/deals/${selectedDeal}/memo/sections/status`);
      return response.json();
    }
  });
  
  // Calculate section-based progress
  const sectionProgress = useMemo(() => {
    if (!sectionStatusesData?.sections) return null;
    
    const sections = sectionStatusesData.sections;
    const sectionNames = Object.keys(sections);
    const totalSections = 12; // Total expected sections
    
    const completedCount = sectionNames.filter(
      name => sections[name]?.status === 'completed'
    ).length;
    
    const processingSection = sectionNames.find(
      name => sections[name]?.status === 'processing'
    );
    
    const progress = Math.round((completedCount / totalSections) * 100);
    
    return {
      completedCount,
      totalSections,
      progress,
      currentSection: processingSection ? sections[processingSection]?.currentStep : null,
      hasActiveSection: !!processingSection
    };
  }, [sectionStatusesData]);

  // Create progress state from job data OR section progress
  const memoProgress = useMemo(() => {
    // First check section-based progress (for section-by-section generation)
    if (sectionProgress && sectionProgress.hasActiveSection) {
      return {
        isRunning: true,
        progress: sectionProgress.progress,
        currentStep: sectionProgress.currentSection || `Generating sections (${sectionProgress.completedCount}/${sectionProgress.totalSections})`,
        status: 'processing',
        jobId: null,
        isAllComplete: false
      };
    }
    
    // Check if all sections are complete
    if (sectionProgress && sectionProgress.completedCount >= sectionProgress.totalSections) {
      return {
        isRunning: false,
        progress: 100,
        currentStep: 'All sections complete',
        status: 'completed',
        jobId: null,
        isAllComplete: true
      };
    }
    
    // Fall back to job-based progress
    const memoJob = findMemoJob(jobProgressData?.jobs || []);
    if (!memoJob) return null;
    
    return {
      isRunning: memoJob.status === 'processing',
      progress: memoJob.progress || 0,
      currentStep: memoJob.currentStep || memoJob.message || 'Generating investment memo...',
      status: memoJob.status || 'processing',
      jobId: memoJob.id,
      isAllComplete: false
    };
  }, [jobProgressData, sectionProgress]);
  
  // Auto-detect active jobs after reload and resume generation mode
  useEffect(() => {
    // If we detect an active memo job but isGenerationActive is false, activate it
    // This handles page refresh while generation is in progress
    if (memoProgress?.isRunning && !isGenerationActive) {
      console.log('🔄 Detected active memo generation, resuming progress tracking...');
      setIsGenerationActive(true);
    }
  }, [memoProgress?.isRunning, isGenerationActive]);

  // Track previous completed count to detect new completions
  const prevCompletedCountRef = useRef<number>(0);
  const prevGenerationActiveRef = useRef<boolean>(false);
  
  // Reset completed count ref when new generation starts
  useEffect(() => {
    if (isGenerationActive && !prevGenerationActiveRef.current) {
      console.log('🔄 New generation started, resetting completed count tracker');
      prevCompletedCountRef.current = 0;
    }
    prevGenerationActiveRef.current = isGenerationActive;
  }, [isGenerationActive]);
  
  // Trigger immediate memo refetch when a section completes (faster than polling)
  useEffect(() => {
    if (sectionProgress && sectionProgress.completedCount > prevCompletedCountRef.current) {
      console.log(`✨ Section completed! (${prevCompletedCountRef.current} -> ${sectionProgress.completedCount}), fetching updated memo...`);
      prevCompletedCountRef.current = sectionProgress.completedCount;
      // CRITICAL: Force immediate refetch (not just invalidate) to show newly completed section instantly
      queryClient.refetchQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
    }
  }, [sectionProgress?.completedCount, selectedDeal, queryClient]);
  
  // Refetch memo when tab becomes visible again (handles navigation away/back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && selectedDeal) {
        console.log('👁️ Tab became visible, refreshing memo data...');
        queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
        queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo', 'sections', 'status'] });
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [selectedDeal, queryClient]);

  // BULLETPROOF INSTANT SECTION VISIBILITY: WebSocket subscription for real-time section completion
  // CRITICAL FIX: Connect ALWAYS when a deal is selected, not just during active generation
  // This ensures we don't miss broadcasts for fast-completing sections (like coverPage)
  // that finish before the first poll cycle detects the active job
  useEffect(() => {
    if (!selectedDeal) return;
    
    const dealId = parseInt(selectedDeal);
    if (isNaN(dealId)) return;
    
    console.log(`📡 BULLETPROOF WebSocket: Connecting for deal ${dealId} (always-on subscription)...`);
    
    // Connect to WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('📡 WebSocket connected for memo section updates (always-on)');
      // Subscribe to this deal's updates immediately
      ws.send(JSON.stringify({ type: 'subscribe', dealId }));
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        // Listen for section completion events
        if (message.type === 'memo_section_complete' && message.data?.dealId === dealId) {
          console.log(`🚀 INSTANT UPDATE via WebSocket: Section "${message.data.sectionName}" ${message.data.status}!`);
          console.log(`🔄 Triggering immediate refetch with EXACT query keys...`);
          
          // CRITICAL FIX: Use EXACT same query key format as the useQuery definitions
          // selectedDeal is already a string, so use it directly to match the query key
          const memoQueryKey = ['/api/deals', selectedDeal, 'memo'];
          const statusQueryKey = ['/api/deals', selectedDeal, 'memo', 'sections', 'status'];
          
          console.log(`📋 Invalidating memo query:`, memoQueryKey);
          console.log(`📋 Invalidating status query:`, statusQueryKey);
          
          // Use invalidateQueries to mark as stale AND trigger immediate refetch
          queryClient.invalidateQueries({ queryKey: memoQueryKey });
          queryClient.invalidateQueries({ queryKey: statusQueryKey });
          
          // Also force a refetch to be absolutely sure
          queryClient.refetchQueries({ queryKey: memoQueryKey });
          queryClient.refetchQueries({ queryKey: statusQueryKey });
          
          // Show toast notification
          if (message.data.status === 'completed') {
            toast({
              title: "Section Generated",
              description: `${message.data.sectionName} is now ready to view.`,
            });
          } else if (message.data.status === 'low_confidence') {
            // Low confidence means content was saved but below quality threshold
            toast({
              title: "Section Generated",
              description: `${message.data.sectionName} generated with limited data - may need review.`,
            });
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('📡 WebSocket disconnected');
    };
    
    // Cleanup on unmount or deal change only
    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        console.log('📡 Closing WebSocket (deal changed or unmount)');
        ws.close();
      }
    };
  }, [selectedDeal, queryClient, toast]); // Removed isGenerationActive/hasActiveJobFromProgress - always connect when deal selected

  // Stop generation mode when all sections complete
  useEffect(() => {
    if (memoProgress?.isAllComplete && isGenerationActive) {
      setIsGenerationActive(false);
      queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
      toast({
        title: "Memo Generated Successfully",
        description: "All sections have been generated with AI analysis.",
      });
    }
  }, [memoProgress?.isAllComplete, isGenerationActive, selectedDeal, queryClient, toast]);

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
    } else if (memoProgress && memoProgress.status === 'low_confidence') {
      // Low confidence is still a success - content was saved
      console.log('⚠️ Memo generation completed with low confidence');
      setIsGenerationActive(false);
      
      toast({
        title: "Memo Generated",
        description: "Memo generated with limited data - some sections may need review.",
      });
    }
  }, [memoProgress, selectedDeal, queryClient, toast]);

  // Memo generation mutation - uses section-by-section rerun for quality
  const generateMemoMutation = useMutation({
    mutationFn: async (dealId: string) => {
      console.log(`🔄 Generating comprehensive investment memo for deal ${dealId} (section-by-section)`);
      
      // Use the force-rerun-all-sections endpoint for enhanced quality
      const response = await apiRequest(`/api/deals/${dealId}/memo/force-rerun-all-sections`, {
        method: 'POST',
      });
      
      console.log('📝 Generate memo response:', { success: response.success, totalSections: response.totalSections, error: response.error });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to start memo generation');
      }
      
      return response;
    },
    onSuccess: (response: any) => {
      console.log('✅ Section-by-section memo generation started', { totalSections: response.totalSections });
      
      // Start generation mode - this enables progress bar and section status polling
      setIsGenerationActive(true);
      
      // Immediately refetch section statuses to start progress tracking
      queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo', 'sections', 'status'] });
      queryClient.invalidateQueries({ queryKey: [`/api/background-jobs/${selectedDeal}`] });
      
      // Show info toast - sections will be generated one by one
      toast({
        title: "Generating Investment Memo",
        description: `Generating ${response.totalSections || 12} sections with AI-powered analysis. You'll see live progress as each section completes.`,
      });
      
      // Polling is handled by sectionStatusesData query's refetchInterval when isGenerationActive is true
    },
    onError: (error: any) => {
      console.error('❌ Memo generation failed:', error);
      setIsGenerationActive(false);
      
      // Handle specific error types
      let title = "Generation Failed";
      let description = "Failed to start memo generation. Please try again.";
      
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

    // CRITICAL: Clear local memo state BEFORE starting generation
    // This ensures old content disappears immediately and placeholders show
    setGeneratedMemo(null);
    console.log('🧹 Cleared local memo state for fresh regeneration');
    
    // Invalidate memo cache so stale database data doesn't show 
    // (the backend also clears sections, but this ensures UI updates immediately)
    queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });

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
    showMemoContent: !!currentMemo && !showProgressBar,
    // CRITICAL: Show actual section content lengths to debug rendering
    sectionContentLengths: currentMemo ? {
      coverPage: currentMemo.coverPage?.length || 0,
      executiveSummary: currentMemo.executiveSummary?.length || 0,
      financialAnalysis: currentMemo.financialAnalysis?.length || 0,
      teamAssessment: currentMemo.teamAssessment?.length || 0,
      marketAnalysis: currentMemo.marketAnalysis?.length || 0,
    } : null
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

                {/* Section Regeneration Control Panel - Always visible when a deal is selected */}
                {selectedDeal && currentMemo && (
                  <div className="mb-6">
                    <MemoSectionProgressPanel
                      dealId={parseInt(selectedDeal)}
                      onSectionComplete={() => {
                        queryClient.invalidateQueries({ queryKey: [`/api/deals/${selectedDeal}/memo`] });
                      }}
                    />
                  </div>
                )}
                
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
                ) : (currentMemo || showProgressBar) ? (
                  <>
                    {/* Compact progress bar during generation */}
                    {showProgressBar && (
                      <div className="mb-6">
                        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-center gap-4">
                              <Loader2 className="h-8 w-8 text-primary animate-spin flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between text-sm mb-2">
                                  <span className="text-gray-300 font-medium truncate">
                                    {memoProgress?.currentStep || 'Generating sections...'}
                                  </span>
                                  <span className="text-primary font-semibold ml-2">
                                    {memoProgress?.progress || 0}%
                                  </span>
                                </div>
                                <Progress 
                                  value={memoProgress?.progress || 0} 
                                  className="h-2 bg-dark-lighter"
                                  data-testid="memo-generation-progress-bar"
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                    
                    {/* Sections container - shows completed sections + placeholders */}
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
                                <MemoSectionRerunButton
                                  dealId={parseInt(selectedDeal)}
                                  sectionName="executiveSummary"
                                  displayName="Executive Summary"
                                  onRerunComplete={() => {
                                    queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
                                  }}
                                />
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
                                <MemoSectionRerunButton
                                  dealId={parseInt(selectedDeal)}
                                  sectionName="marketAnalysis"
                                  displayName="Market Analysis"
                                  onRerunComplete={() => {
                                    queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
                                  }}
                                />
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
                                <MemoSectionRerunButton
                                  dealId={parseInt(selectedDeal)}
                                  sectionName="technologyAssessment"
                                  displayName="Technology Assessment"
                                  onRerunComplete={() => {
                                    queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
                                  }}
                                />
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
                                <MemoSectionRerunButton
                                  dealId={parseInt(selectedDeal)}
                                  sectionName="teamAssessment"
                                  displayName="Team Assessment"
                                  onRerunComplete={() => {
                                    queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
                                  }}
                                />
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
                                <MemoSectionRerunButton
                                  dealId={parseInt(selectedDeal)}
                                  sectionName="clinicalEvidence"
                                  displayName="Clinical Evidence"
                                  onRerunComplete={() => {
                                    queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
                                  }}
                                />
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
                                <MemoSectionRerunButton
                                  dealId={parseInt(selectedDeal)}
                                  sectionName="intellectualProperty"
                                  displayName="Intellectual Property"
                                  onRerunComplete={() => {
                                    queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
                                  }}
                                />
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
                                <MemoSectionRerunButton
                                  dealId={parseInt(selectedDeal)}
                                  sectionName="regulatoryPathway"
                                  displayName="Regulatory Pathway"
                                  onRerunComplete={() => {
                                    queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
                                  }}
                                />
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
                                <MemoSectionRerunButton
                                  dealId={parseInt(selectedDeal)}
                                  sectionName="competitiveAnalysis"
                                  displayName="Competitive Analysis"
                                  onRerunComplete={() => {
                                    queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
                                  }}
                                />
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
                                <MemoSectionRerunButton
                                  dealId={parseInt(selectedDeal)}
                                  sectionName="financialAnalysis"
                                  displayName="Financial Analysis"
                                  onRerunComplete={() => {
                                    queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
                                  }}
                                />
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
                                <MemoSectionRerunButton
                                  dealId={parseInt(selectedDeal)}
                                  sectionName="investmentTerms"
                                  displayName="Investment Terms"
                                  onRerunComplete={() => {
                                    queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
                                  }}
                                />
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
                                <MemoSectionRerunButton
                                  dealId={parseInt(selectedDeal)}
                                  sectionName="riskAnalysis"
                                  displayName="Risk Analysis"
                                  onRerunComplete={() => {
                                    queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
                                  }}
                                />
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

                      {/* Generating placeholders for pending sections during generation */}
                      {(isGenerationActive || hasActiveJobFromProgress) && sectionStatusesData?.sections && (
                        <>
                          {Object.entries(sectionStatusesData.sections)
                            .filter(([sectionName, status]: [string, any]) => {
                              // Show placeholder for sections that are pending/processing and don't have content yet
                              const hasContent = currentMemo?.[sectionName as keyof ComprehensiveMemo];
                              const isPendingOrProcessing = status?.status === 'pending' || status?.status === 'processing';
                              return isPendingOrProcessing && !hasContent;
                            })
                            .map(([sectionName, status]: [string, any]) => {
                              const meta = SECTION_METADATA[sectionName];
                              if (!meta) return null;
                              return (
                                <SectionGeneratingPlaceholder
                                  key={sectionName}
                                  title={meta.title}
                                  description={status?.status === 'processing' ? (status?.currentStep || meta.description) : meta.description}
                                  colorClass={meta.colorClass}
                                />
                              );
                            })}
                        </>
                      )}

                      {/* Low confidence section cards with regenerate button - show content with warning */}
                      {sectionStatusesData?.sections && (
                        <>
                          {Object.entries(sectionStatusesData.sections)
                            .filter(([sectionName, status]: [string, any]) => {
                              // Show low-confidence card if section has content but is marked as low confidence
                              const hasContent = currentMemo?.[sectionName as keyof ComprehensiveMemo];
                              return status?.confidence === 'low' && hasContent;
                            })
                            .map(([sectionName]: [string, any]) => {
                              const meta = SECTION_METADATA[sectionName];
                              const content = currentMemo?.[sectionName as keyof ComprehensiveMemo] || '';
                              if (!meta) return null;
                              return (
                                <SectionLowConfidenceCard
                                  key={sectionName}
                                  title={meta.title}
                                  description={meta.description}
                                  content={flattenToString(content)}
                                  colorClass={meta.colorClass}
                                  onRegenerate={async () => {
                                    try {
                                      await apiRequest(`/api/deals/${selectedDeal}/memo/sections/${sectionName}/rerun`, {
                                        method: 'POST',
                                      });
                                      queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo', 'sections', 'status'] });
                                      toast({
                                        title: "Regenerating Section",
                                        description: `Regenerating ${meta.title} for improved quality...`,
                                      });
                                    } catch (error) {
                                      toast({
                                        title: "Regeneration Failed",
                                        description: "Could not regenerate section.",
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                />
                              );
                            })}
                        </>
                      )}
                  </div>
                  </>
                ) : null}
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
                        disabled={isExportingPdf}
                        data-testid="button-export-pdf"
                        onClick={async () => {
                          setIsExportingPdf(true);
                          setExportProgress(0);
                          setExportStep('Starting export...');
                          
                          try {
                            setExportProgress(10);
                            setExportStep('Synthesizing sections with AI...');
                            
                            const response = await fetch(`/api/deals/${selectedDeal}/export-pdf`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({ premium: true }),
                            });
                            
                            setExportProgress(70);
                            setExportStep('Rendering premium PDF...');
                            
                            if (!response.ok) {
                              throw new Error('Export failed');
                            }
                            
                            setExportProgress(85);
                            setExportStep('Downloading...');
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `Investment_Memo_${selectedDealData?.companyName || 'Company'}_${new Date().toISOString().split('T')[0]}.pdf`;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);
                            
                            setExportProgress(100);
                            setExportStep('Complete!');
                            
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
                          } finally {
                            setIsExportingPdf(false);
                            setExportStep('');
                            setExportProgress(0);
                          }
                        }}
                      >
                        {isExportingPdf ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Exporting...
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 mr-2" />
                            Export PDF
                          </>
                        )}
                      </Button>
                      
                      {isExportingPdf && (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3" data-testid="pdf-export-progress">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
                              <span className="text-blue-400 text-sm font-medium">{exportStep}</span>
                            </div>
                            <span className="text-blue-400 text-xs">{exportProgress}%</span>
                          </div>
                          <div className="mt-2 w-full bg-dark-lighter rounded-full h-1.5">
                            <div 
                              className="bg-blue-400 h-1.5 rounded-full transition-all duration-300" 
                              style={{width: `${exportProgress}%`}}
                            ></div>
                          </div>
                        </div>
                      )}
                      
                      <Button 
                        variant="outline" 
                        className="w-full border-dark-lighter text-white hover:bg-dark-lighter"
                        disabled={isExportingPdf}
                        data-testid="button-export-word"
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
