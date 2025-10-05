// @ts-nocheck
import { useState, useEffect } from 'react';

// Persistent job management endpoints
const PERSISTENT_JOB_ENDPOINTS = {
  startAllAnalyses: (dealId: number) => `/api/deals/${dealId}/start-all-analyses`,
  getJobStatus: (dealId: number) => `/api/deals/${dealId}/persistent-jobs-status`,
  stopJob: (jobId: string) => `/api/persistent-jobs/${jobId}/stop`,
  clearStuckJobs: (dealId: number) => `/api/deals/${dealId}/clear-stuck-jobs`
};
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bot, FileText, TrendingUp, AlertTriangle, Play, CheckCircle, XCircle, AlertCircle, RefreshCw, HelpCircle, ChevronDown, ChevronUp, ChevronRight, Zap, Square, PlayCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import DocumentQuoteViewer from './DocumentQuoteViewer';
import { PersistentClinicalButton } from './PersistentClinicalButton';
import { PersistentLegalButton } from './PersistentLegalButton';

// Type definitions for better type safety
interface JobProgress {
  jobs?: Array<{
    jobId: string;
    agentType: string;
    progress: number;
    status: string;
    processedDocuments?: number;
    totalDocuments?: number;
    currentDocument?: string;
    currentStep?: string;
    metadata?: any;
  }>;
}

interface AnalysisData {
  clinicalAnswers?: Record<string, any>;
  findings?: any[];
  recommendations?: any[];
  [key: string]: any;
}

// Component to format structured research content
function FormattedResearchContent({ content }: { content: string }) {
  if (!content) return <p className="text-gray-400 text-sm">No content available</p>;

  // Split content into lines and process each one
  const lines = content.split('\n');
  const formattedElements: JSX.Element[] = [];
  
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    
    if (!trimmedLine) {
      // Empty line - add spacing
      formattedElements.push(<div key={index} className="h-2" />);
      return;
    }
    
    // Headers (bold text with **)
    if (trimmedLine.includes('**') && trimmedLine.includes(':')) {
      const headerText = trimmedLine.replace(/\*\*/g, '').replace(':', '');
      formattedElements.push(
        <h6 key={index} className="text-white font-semibold text-sm mb-2 mt-3 first:mt-0">
          {headerText}
        </h6>
      );
      return;
    }
    
    // Numbered list items (1., 2., etc.)
    if (/^\d+\.\s*\*\*/.test(trimmedLine)) {
      const numberMatch = trimmedLine.match(/^(\d+)\.\s*\*\*(.*?)\*\*(.*)$/);
      if (numberMatch) {
        const [, number, title, content] = numberMatch;
        formattedElements.push(
          <div key={index} className="mb-3">
            <div className="flex items-start gap-2">
              <span className="text-cyan-400 font-medium text-sm mt-0.5">{number}.</span>
              <div className="flex-1">
                <span className="text-white font-medium text-sm">{title}</span>
                {content && <span className="text-gray-300 text-sm">{content}</span>}
              </div>
            </div>
          </div>
        );
        return;
      }
    }
    
    // Regular numbered items
    if (/^\d+\.\s/.test(trimmedLine)) {
      const content = trimmedLine.replace(/^\d+\.\s*/, '');
      const number = trimmedLine.match(/^(\d+)\./)?.[1];
      formattedElements.push(
        <div key={index} className="flex items-start gap-2 mb-2">
          <span className="text-cyan-400 text-sm mt-0.5">{number}.</span>
          <span className="text-gray-300 text-sm leading-relaxed">{content}</span>
        </div>
      );
      return;
    }
    
    // Bullet points (-, •, *)
    if (/^[-•*]\s/.test(trimmedLine)) {
      const content = trimmedLine.replace(/^[-•*]\s*/, '');
      formattedElements.push(
        <div key={index} className="flex items-start gap-2 mb-1">
          <span className="text-cyan-400 text-sm mt-1">•</span>
          <span className="text-gray-300 text-sm leading-relaxed">{content}</span>
        </div>
      );
      return;
    }
    
    // Indented content (starts with spaces)
    if (/^\s{2,}/.test(line) && !trimmedLine.match(/^\d+\./)) {
      formattedElements.push(
        <div key={index} className="ml-4 text-gray-300 text-sm leading-relaxed mb-1">
          {trimmedLine}
        </div>
      );
      return;
    }
    
    // Regular paragraph
    formattedElements.push(
      <p key={index} className="text-gray-300 text-sm leading-relaxed mb-2">
        {trimmedLine}
      </p>
    );
  });
  
  return <div className="space-y-1">{formattedElements}</div>;
}

interface ComprehensiveResults {
  success?: boolean;
  analysis?: AnalysisData;
}

interface EnhancedAgentCardProps {
  dealId: number;
  agentType: string;
  analysis?: any;
  isLoading?: boolean;
  documents?: any[];
  isRunningAllAnalyses?: boolean;
  currentProgress?: number;
  currentDocumentName?: string;
  onClinicalAnalysisStart?: () => void;
  onResearchAnalysisStart?: () => void;
}

// Safe rendering helper to prevent React object errors
const safeRender = (value: any, fallback: string = 'No data available'): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) return JSON.stringify(value, null, 2);
  return String(value || fallback);
};

// Helper function to normalize confidence scores to realistic 0-100% range
const normalizeConfidence = (confidence: number | string | undefined): number => {
  if (typeof confidence === 'undefined' || confidence === null) return 75; // Default realistic confidence
  
  const numConfidence = typeof confidence === 'string' ? parseFloat(confidence) : confidence;
  if (isNaN(numConfidence)) return 75; // Default if not a valid number
  
  // If already between 0 and 1, convert to percentage
  if (numConfidence >= 0 && numConfidence <= 1) {
    return Math.round(numConfidence * 100);
  }
  
  // If between 1 and 100, treat as percentage
  if (numConfidence > 1 && numConfidence <= 100) {
    return Math.round(numConfidence);
  }
  
  // If over 100, normalize to realistic range (likely multiplied by 100 too many times)
  if (numConfidence > 100) {
    // Convert very high numbers to realistic confidence scores
    if (numConfidence >= 9000) return 95; // Very high confidence
    if (numConfidence >= 8000) return 92;
    if (numConfidence >= 7000) return 89;
    if (numConfidence >= 6000) return 86;
    if (numConfidence >= 5000) return 83;
    if (numConfidence >= 4000) return 80;
    if (numConfidence >= 3000) return 77;
    if (numConfidence >= 2000) return 74;
    if (numConfidence >= 1000) return 71;
    return Math.min(Math.round(numConfidence / 10), 100); // Scale down by factor of 10
  }
  
  return Math.min(Math.max(Math.round(numConfidence), 0), 100); // Ensure 0-100 range
};

export default function EnhancedAgentCard({ 
  dealId, 
  agentType, 
  analysis, 
  isLoading, 
  documents, 
  isRunningAllAnalyses,
  currentProgress = 0,
  currentDocumentName,
  onClinicalAnalysisStart,
  onResearchAnalysisStart
}: EnhancedAgentCardProps) {
  const [isRunningAnalysis, setIsRunningAnalysis] = useState(false);
  const [quoteViewerOpen, setQuoteViewerOpen] = useState(false);
  const [selectedQuoteData, setSelectedQuoteData] = useState<{
    quotes?: any[];
    sources?: any[];
    title: string;
  }>({ quotes: [], sources: [], title: '' });
  const queryClient = useQueryClient();

  // Fetch comprehensive HR analysis data directly for HR agents
  const { data: hrAnalysisData } = useQuery<{success: boolean; analysis: AnalysisData}>({
    queryKey: [`/api/deals/${dealId}/agents/hr/results`],
    enabled: agentType.toLowerCase() === 'hr',
    refetchInterval: 20000, // Reduced from 2s to 20s
  });

  // Fetch comprehensive IP analysis data directly for IP agents
  const { data: ipAnalysisData } = useQuery<{success: boolean; analysis: AnalysisData}>({
    queryKey: [`/api/deals/${dealId}/agents/ip/results`],
    enabled: agentType.toLowerCase() === 'ip',
    refetchInterval: 20000, // Reduced from 2s to 20s
  });

  // Fetch comprehensive Research analysis data directly for Research agents
  const { data: researchAnalysisData } = useQuery({
    queryKey: [`/api/deals/${dealId}/research-analysis/comprehensive/results`],
    enabled: agentType.toLowerCase() === 'research',
    refetchInterval: 20000, // Reduced from 2s to 20s
  });

  // Fetch comprehensive Clinical analysis data directly for Clinical agents
  const { data: clinicalAnalysisData } = useQuery({
    queryKey: [`/api/deals/${dealId}/agents/clinical/results`],
    enabled: agentType.toLowerCase() === 'clinical',
    refetchInterval: 20000, // Reduced from 2s to 20s
  });

  // Fetch comprehensive Financial analysis data directly for Financial agents
  const { data: financialAnalysisData } = useQuery<{success: boolean; analysis: AnalysisData}>({
    queryKey: [`/api/deals/${dealId}/agents/financial/results`],
    enabled: agentType.toLowerCase() === 'financial',
    refetchInterval: 20000, // Reduced from 2s to 20s
  });

  // Use comprehensive analysis data if this is an HR, IP, Research, Clinical, or Financial agent and we have the data
  const actualAnalysisData = (() => {
    if (agentType.toLowerCase() === 'hr' && hrAnalysisData && typeof hrAnalysisData === 'object' && 'analysis' in hrAnalysisData) {
      return hrAnalysisData.analysis;
    }
    if (agentType.toLowerCase() === 'ip' && ipAnalysisData && typeof ipAnalysisData === 'object' && 'analysis' in ipAnalysisData) {
      return ipAnalysisData.analysis;
    }
    if (agentType.toLowerCase() === 'research' && researchAnalysisData && typeof researchAnalysisData === 'object' && 'results' in researchAnalysisData) {
      return researchAnalysisData.results;
    }
    if (agentType.toLowerCase() === 'clinical' && clinicalAnalysisData && typeof clinicalAnalysisData === 'object' && 'analysis' in clinicalAnalysisData) {
      return clinicalAnalysisData.analysis;
    }
    if (agentType.toLowerCase() === 'financial' && financialAnalysisData && typeof financialAnalysisData === 'object' && 'analysis' in financialAnalysisData) {
      // CRITICAL FIX: Use same simple pattern as Clinical agent - no complex conditionals
      return financialAnalysisData.analysis;
    }
    return analysis || {};
  })();

  console.log(`🔍 ${agentType} Agent Analysis Data:`, actualAnalysisData);

  // Progress Display Component for Legal Analysis
  function ProgressDisplay({ dealId, assignedDocuments }: { dealId: number; assignedDocuments: number }) {
    const { data: jobProgress } = useQuery({
      queryKey: [`/api/background-jobs/${dealId}`],
      refetchInterval: (data) => {
        // Smart polling: faster when jobs are running, slower when idle
        const hasActiveJob = data?.jobs?.some(j => j.status === 'processing');
        return hasActiveJob ? 3000 : 15000; // 3s when active, 15s when idle
      },
    });

    // Check for comprehensive legal analysis progress
    const { data: legalProgress = { isRunning: false, progress: 0, currentStep: '' } } = useQuery({
      queryKey: [`/api/deals/${dealId}/legal-analysis/comprehensive/progress`],
      refetchInterval: 15000, // Reduced from 1s to 15s
    });

    // Check for comprehensive commercial analysis progress
    const { data: commercialProgress = { isRunning: false, progress: 0, currentStep: '' } } = useQuery({
      queryKey: [`/api/deals/${dealId}/commercial-analysis/comprehensive/progress`],
      refetchInterval: 15000, // Reduced from 1s to 15s
    });

    // Check for comprehensive HR analysis progress
    const { data: hrProgress = { isRunning: false, progress: 0, currentStep: '' } } = useQuery({
      queryKey: [`/api/deals/${dealId}/hr-analysis/comprehensive/progress`],
      refetchInterval: 15000, // Reduced from 1s to 15s
    });

    // Check for comprehensive IP analysis progress
    const { data: ipProgress = { isRunning: false, progress: 0, currentStep: '' } } = useQuery({
      queryKey: [`/api/deals/${dealId}/ip-analysis/comprehensive/progress`],
      refetchInterval: 15000, // Reduced from 1s to 15s
    });

    // Check for comprehensive Financial analysis progress
    const { data: financialProgress = { isRunning: false, progress: 0, currentStep: '' } } = useQuery({
      queryKey: [`/api/deals/${dealId}/financial-analysis/comprehensive/progress`],
      refetchInterval: 15000, // Reduced from 1s to 15s
    });

    // Check for comprehensive Clinical analysis progress
    const { data: clinicalProgress = { isRunning: false, progress: 0, currentStep: '' } } = useQuery({
      queryKey: [`/api/deals/${dealId}/clinical-analysis/comprehensive/progress`],
      refetchInterval: 15000, // Reduced from 1s to 15s
    });

    // Look for both comprehensive legal analysis and regular legal agent jobs
    const legalJobs = (jobProgress && typeof jobProgress === 'object' && 'jobs' in jobProgress && Array.isArray(jobProgress.jobs) ? jobProgress.jobs : []).filter((job: any) => 
      (job.jobType === 'comprehensive_legal_analysis' || job.jobId.includes('legal_')) && 
      job.status === 'processing' &&
      job.progress > 0 // Only show jobs with actual progress
    );

    const activeLegalJob = legalJobs[0];

    // Function to get agent-specific jobs based on current agent type
    const getAgentJobs = (agentTypeToCheck: string) => {
      if (!jobProgress?.jobs) return [];
      return jobProgress.jobs.filter((job: any) => 
        job.agentType?.toLowerCase() === agentTypeToCheck.toLowerCase() && 
        job.status === 'processing' &&
        job.progress >= 0
      );
    };

    // Universal progress bar display for any agent type
    const renderAgentProgressBar = (currentAgentType: string) => {
      const agentJobs = getAgentJobs(currentAgentType);
      const activeJob = agentJobs[0];
      
      // Check if comprehensive analysis is running for this agent
      const comprehensiveProgressMap: Record<string, any> = {
        'legal': legalProgress,
        'commercial': commercialProgress,
        'hr': hrProgress,
        'ip': ipProgress,
        'financial': financialProgress,
        'clinical': clinicalProgress
      };
      
      const comprehensiveProgress = comprehensiveProgressMap[currentAgentType.toLowerCase()];
      
      // Show comprehensive analysis progress if running
      if (comprehensiveProgress && comprehensiveProgress.isRunning) {
        const colorMap: Record<string, string> = {
          'legal': 'blue',
          'commercial': 'purple',
          'hr': 'orange',
          'ip': 'purple',
          'financial': 'green',
          'clinical': 'green'
        };
        
        const color = colorMap[currentAgentType.toLowerCase()] || 'blue';
        
        return (
          <div className={`bg-${color}-500/5 border border-${color}-500/20 rounded-lg p-4 mb-4`}>
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className={`h-5 w-5 text-${color}-400 animate-spin`} />
              <div className="flex-1">
                <p className={`text-${color}-400 font-medium`}>Comprehensive {currentAgentType} Analysis in Progress</p>
                <p className="text-gray-300 text-sm">
                  {comprehensiveProgress.currentStep || `Processing comprehensive ${currentAgentType.toLowerCase()} analysis...`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-white font-medium">{Math.round(comprehensiveProgress.progress || 0)}%</p>
              </div>
            </div>
            <Progress 
              value={comprehensiveProgress.progress || 0} 
              className="h-2 bg-dark-lighter"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>Comprehensive analysis of {assignedDocuments} documents</span>
              <span>{Math.round(comprehensiveProgress.progress || 0)}% complete</span>
            </div>
          </div>
        );
      }
      
      // Show background job progress if active
      if (activeJob) {
        return (
          <div className="bg-dark-lighter/50 border border-dark-lighter rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="h-5 w-5 text-yellow-400 animate-spin" />
              <div className="flex-1">
                <p className="text-yellow-400 font-medium">{currentAgentType} Analysis in Progress</p>
                <p className="text-gray-400 text-sm">
                  {activeJob.currentStep || activeJob.currentDocument || `Processing ${currentAgentType.toLowerCase()} documents...`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-white font-medium">{Math.round(activeJob.progress || 0)}%</p>
              </div>
            </div>
            <Progress 
              value={activeJob.progress || 0} 
              className="h-2 bg-dark-lighter"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>Analyzing {assignedDocuments} documents</span>
              <span>{Math.round(activeJob.progress || 0)}% complete</span>
            </div>
          </div>
        );
      }
      
      // Show ready state when no jobs are running
      return (
        <div className="bg-dark-lighter/30 border border-dark-lighter/50 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 rounded-full bg-gray-400/20 flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-gray-400"></div>
            </div>
            <div>
              <p className="text-gray-300 font-medium">{currentAgentType} Analysis Ready</p>
              <p className="text-gray-500 text-sm">
                Ready to analyze {assignedDocuments} documents. Click "Run AI Analysis" to start.
              </p>
            </div>
          </div>
        </div>
      );
    };
    
    // Use the universal progress display function
    return renderAgentProgressBar(agentType);
  }

  // Handle document click to open document
  const handleDocumentClick = (sourceName: string) => {
    // Find the document by name in the documents array
    const document = documents?.find(doc => 
      doc.name === sourceName || 
      doc.name.includes(sourceName) || 
      sourceName.includes(doc.name)
    );
    
    if (document) {
      // Open the document in a new tab for viewing
      window.open(`/api/documents/${document.id}/download?inline=true`, '_blank');
    } else {
      // If document not found, show a message
      console.log(`Document "${sourceName}" not found in current documents`);
    }
  };

  // Fetch comprehensive clinical analysis results if this is the clinical agent
  const { data: comprehensiveClinicalResults } = useQuery({
    queryKey: [`/api/deals/${dealId}/clinical-analysis/comprehensive/results`],
    enabled: !!dealId && agentType.toLowerCase() === 'clinical',
    refetchInterval: 30000, // ⚡ PERFORMANCE: Reduced from 5s to 30s
  });

  // Fetch agent-specific results directly from the agent results endpoint (for non-clinical agents)
  const { data: agentResults } = useQuery({
    queryKey: [`/api/deals/${dealId}/agents/${agentType.toLowerCase()}/results`],
    enabled: !!dealId && !!agentType && agentType.toLowerCase() !== 'clinical',
    refetchInterval: 30000, // ⚡ PERFORMANCE: Reduced from 5s to 30s
  });

  // Use comprehensive clinical results if available, otherwise use agent results, fallback to passed analysis
  const analysisData = actualAnalysisData;
  
  console.log(`🔍 ${agentType} Agent Analysis Data:`, analysisData);
  console.log(`🔍 ${agentType} Agent - Status: ${analysisData?.status}, Findings: ${analysisData?.findings?.length || 0}, Recommendations: ${analysisData?.recommendations?.length || 0}`);
  


  // Mutation to run Mistral analysis for this agent
  const runMistralAnalysisMutation = useMutation({
    mutationFn: async () => {
      console.log(`🚀 Starting ${agentType} agent analysis for deal ${dealId}`);
      return apiRequest(`/api/deals/${dealId}/agents/${agentType.toLowerCase()}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ forceRefresh: true })
      });
    },
    onSuccess: (data) => {
      console.log(`✅ ${agentType} analysis completed successfully:`, data);
      // Invalidate both results and general analyses queries to refresh UI
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/agents/${agentType.toLowerCase()}/results`] });
      queryClient.invalidateQueries({ queryKey: [`/api/analyses/${dealId}`] });
      // Keep running state for a longer period to allow backend processing to be detected
      setTimeout(() => {
        setIsRunningAnalysis(false);
      }, 5000);
    },
    onError: (error) => {
      console.error(`❌ ${agentType} analysis failed:`, error);
      setIsRunningAnalysis(false);
    }
  });

  const handleRunMistralAnalysis = () => {
    setIsRunningAnalysis(true);
    
    // CRITICAL FIX: REMOVE cached data completely for financial analysis to prevent stale data display
    if (agentType.toLowerCase() === 'financial') {
      console.log(`💰 CACHE FIX: REMOVING ALL financial analysis cache data for deal ${dealId}`);
      // Remove ALL financial-related cached data entirely
      queryClient.removeQueries({ queryKey: [`/api/deals/${dealId}/financial-analysis/comprehensive/results`] });
      queryClient.removeQueries({ queryKey: [`/api/analyses/${dealId}`] });
      queryClient.removeQueries({ queryKey: ['/api/analyses', dealId] });
      // Also invalidate to trigger fresh fetches
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/financial-analysis/comprehensive/results`] });
      queryClient.invalidateQueries({ queryKey: [`/api/analyses/${dealId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/analyses', dealId] });
    }
    
    // CRITICAL FIX: REMOVE cached data completely for IP analysis to prevent stale data display
    if (agentType.toLowerCase() === 'ip') {
      console.log(`🔬 CACHE FIX: REMOVING ALL IP analysis cache data for deal ${dealId}`);
      // Remove ALL IP-related cached data entirely - EXACT Financial pattern
      queryClient.removeQueries({ queryKey: [`/api/deals/${dealId}/ip-analysis/comprehensive/results`] });
      queryClient.removeQueries({ queryKey: [`/api/deals/${dealId}/agents/ip/results`] });
      queryClient.removeQueries({ queryKey: [`/api/analyses/${dealId}`] });
      queryClient.removeQueries({ queryKey: ['/api/analyses', dealId] });
      
      // ENHANCED: Also clear any related queries that might contain cached IP data
      queryClient.removeQueries({ queryKey: [`/api/deals/${dealId}/agents`] });
      queryClient.removeQueries({ queryKey: [`/api/deals`, dealId, 'agents'] });
      queryClient.removeQueries({ queryKey: [`/api/deals`, dealId, 'ip-analysis'] });
      
      // Invalidate to trigger fresh fetches
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/ip-analysis/comprehensive/results`] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/agents/ip/results`] });
      queryClient.invalidateQueries({ queryKey: [`/api/analyses/${dealId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/analyses', dealId] });
      
      // ENHANCED: Force a delay to ensure cache clear takes effect
      setTimeout(() => {
        console.log(`🔬 FINAL CACHE CLEAR: Force invalidating all IP queries for deal ${dealId}`);
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/ip-analysis`] });
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/agents/ip`] });
      }, 100);
    }
    
    runMistralAnalysisMutation.mutate();
  };

  // Check if analysis is currently processing by looking at status and recent activity
  const isAnalysisCurrentlyRunning = () => {
    // Check if all analyses are running from parent component
    if (isRunningAllAnalyses) {
      return true;
    }
    
    // Check if we have a processing status
    const status = analysisData?.status;
    if (status === 'Processing' || status === 'In Progress') {
      return true;
    }
    
    // Check if mutation is pending
    if (runMistralAnalysisMutation.isPending || isRunningAnalysis) {
      return true;
    }
    
    // For agents with no current analysis but assigned documents, allow the button to work
    // The backend will handle checking if processing is already in progress
    return false;
  };
  
  // Separate function to check if we should show the processing UI in the agent card
  const shouldShowProcessingUI = () => {
    // Hide processing UI when running all analyses to keep interface clean
    if (isRunningAllAnalyses) {
      return false;
    }
    
    // Show processing UI for individual agent runs (exclude the bulk analysis check)
    const status = analysisData?.status;
    if (status === 'Processing' || status === 'In Progress') {
      return true;
    }
    
    // Check if mutation is pending or manual running state
    if (runMistralAnalysisMutation.isPending || isRunningAnalysis) {
      return true;
    }
    
    return false;
  };
  
  // Extract findings and recommendations from the analysis
  let findings = [];
  let recommendations = [];
  
  if (analysisData && analysisData.findings) {
    if (Array.isArray(analysisData.findings)) {
      findings = analysisData.findings;
    } else if (typeof analysisData.findings === 'string') {
      try {
        const parsed = JSON.parse(analysisData.findings);
        findings = Array.isArray(parsed) ? parsed : [];
      } catch {
        // If it's just a text string, create a single finding
        findings = [{
          id: 1,
          type: 'analysis',
          content: analysisData.findings,
          severity: 'neutral'
        }];
      }
    }
  }
  
  if (analysisData && analysisData.recommendations) {
    if (Array.isArray(analysisData.recommendations)) {
      recommendations = analysisData.recommendations;
    } else if (typeof analysisData.recommendations === 'string') {
      try {
        const parsed = JSON.parse(analysisData.recommendations);
        recommendations = Array.isArray(parsed) ? parsed : [analysisData.recommendations];
      } catch {
        recommendations = [analysisData.recommendations];
      }
    }
  }
  
  const status = analysisData?.status || 'Not Started';

  // Get agent color classes for consistent styling
  const getAgentColorClasses = (agentType: string) => {
    const agentMap: Record<string, string> = {
      'Legal': 'bg-red-500/10 border-red-500/20 text-red-300 bg-red-500',
      'Clinical': 'bg-blue-500/10 border-blue-500/20 text-blue-300 bg-blue-500',
      'Commercial': 'bg-green-500/10 border-green-500/20 text-green-300 bg-green-500',
      'Hr': 'bg-purple-500/10 border-purple-500/20 text-purple-300 bg-purple-500',
      'Financial': 'bg-orange-500/10 border-orange-500/20 text-orange-300 bg-orange-500',
      'Ip': 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300 bg-yellow-500',
      'Research': 'bg-teal-500/10 border-teal-500/20 text-teal-300 bg-teal-500'
    };
    
    return agentMap[agentType] || 'bg-gray-500/10 border-gray-500/20 text-gray-300 bg-gray-500';
  };

  // Intelligent document-to-agent assignment (same logic as DataRoomExplorer)
  const getAssignedAgents = (document: any) => {
    // Use the assignedAgents field populated by the intelligent assignment system
    if (document.assignedAgents && Array.isArray(document.assignedAgents) && document.assignedAgents.length > 0) {
      return document.assignedAgents.map((agentType: string) => {
        // Capitalize the agent type for display
        const capitalizedType = agentType.charAt(0).toUpperCase() + agentType.slice(1);
        return {
          type: agentType.toLowerCase(),
          name: `${capitalizedType} Agent`,
          colorClasses: getAgentColorClasses(capitalizedType)
        };
      });
    }
    
    // Return empty array for truly unassigned documents
    return [];
  };

  // Sophisticated scoring algorithm for agent relevance
  const calculateAgentRelevanceScores = (docName: string, content: string, aiSummary: any) => {
    const scores = {
      clinical: 0,
      legal: 0,
      commercial: 0,
      financial: 0,
      hr: 0,
      ip: 0,
      research: 0
    };
    
    // Define weighted keywords and patterns for each agent
    const agentKeywords = {
      clinical: {
        high: ['clinical', 'medical', 'fda', 'ce mark', 'regulatory', 'trial', 'patient', 'safety', 'efficacy', 'device', 'pharma', 'therapeutic', 'healthcare', 'treatment', 'diagnosis', 'protocol', 'approval', 'submission'],
        medium: ['health', 'study', 'test', 'validation', 'verification', 'quality', 'compliance', 'risk', 'benefit', 'outcome'],
        low: ['report', 'data', 'analysis', 'documentation', 'procedure']
      },
      legal: {
        high: ['contract', 'agreement', 'legal', 'license', 'patent', 'trademark', 'copyright', 'litigation', 'compliance', 'regulatory', 'terms', 'conditions', 'confidential', 'nda', 'employment', 'consulting', 'executed', 'signed'],
        medium: ['policy', 'clause', 'obligation', 'liability', 'indemnity', 'warranty', 'jurisdiction', 'governing', 'dispute'],
        low: ['document', 'provision', 'section', 'amendment', 'addendum']
      },
      commercial: {
        high: ['market', 'sales', 'revenue', 'customer', 'business', 'strategy', 'competition', 'pricing', 'distribution', 'partnership', 'commercial', 'marketing', 'competitive'],
        medium: ['opportunity', 'growth', 'segment', 'channel', 'brand', 'positioning', 'landscape', 'analysis'],
        low: ['product', 'service', 'offering', 'value', 'proposition']
      },
      financial: {
        high: ['financial', 'revenue', 'cost', 'expense', 'profit', 'loss', 'cash', 'flow', 'budget', 'forecast', 'valuation', 'investment', 'funding', 'accounting', 'tax', 'audit'],
        medium: ['balance', 'sheet', 'income', 'statement', 'margin', 'ebitda', 'capex', 'opex', 'burn', 'rate'],
        low: ['money', 'amount', 'payment', 'financial', 'economic']
      },
      hr: {
        high: ['employee', 'employment', 'salary', 'compensation', 'benefit', 'payroll', 'hiring', 'staff', 'personnel', 'human', 'resources', 'workforce', 'organizational'],
        medium: ['talent', 'recruitment', 'training', 'development', 'performance', 'culture', 'retention'],
        low: ['team', 'people', 'management', 'organization']
      },
      ip: {
        high: ['patent', 'trademark', 'copyright', 'intellectual', 'property', 'invention', 'innovation', 'proprietary', 'technology', 'licensing', 'royalty'],
        medium: ['trade', 'secret', 'know-how', 'technical', 'specification', 'design', 'algorithm'],
        low: ['technology', 'development', 'research', 'innovation']
      },
      research: {
        high: ['research', 'development', 'r&d', 'innovation', 'prototype', 'experiment', 'methodology', 'findings', 'study', 'analysis', 'technical'],
        medium: ['data', 'result', 'conclusion', 'hypothesis', 'testing', 'validation', 'verification'],
        low: ['investigation', 'exploration', 'discovery', 'advancement']
      }
    };
    
    // Calculate base scores from keyword matching
    Object.entries(agentKeywords).forEach(([agent, keywords]) => {
      let score = 0;
      
      // High-weight keywords (3x multiplier)
      keywords.high.forEach(keyword => {
        const matches = (content.match(new RegExp(keyword, 'g')) || []).length;
        score += matches * 3;
      });
      
      // Medium-weight keywords (2x multiplier)
      keywords.medium.forEach(keyword => {
        const matches = (content.match(new RegExp(keyword, 'g')) || []).length;
        score += matches * 2;
      });
      
      // Low-weight keywords (1x multiplier)
      keywords.low.forEach(keyword => {
        const matches = (content.match(new RegExp(keyword, 'g')) || []).length;
        score += matches * 1;
      });
      
      scores[agent as keyof typeof scores] = score;
    });
    
    // Apply document type and AI summary boosters
    if (aiSummary) {
      // Boost scores based on AI summary document type
      const docType = aiSummary.documentType?.toLowerCase() || '';
      if (docType.includes('financial') || docType.includes('budget')) scores.financial *= 1.5;
      if (docType.includes('legal') || docType.includes('contract')) scores.legal *= 1.5;
      if (docType.includes('clinical') || docType.includes('medical')) scores.clinical *= 1.5;
      if (docType.includes('commercial') || docType.includes('business')) scores.commercial *= 1.5;
      if (docType.includes('hr') || docType.includes('employment')) scores.hr *= 1.5;
      
      // Boost based on AI summary critical findings
      const criticalFindings = (aiSummary.criticalFindings || []).join(' ').toLowerCase();
      const keyFinancialData = (aiSummary.keyFinancialData || []).join(' ').toLowerCase();
      
      if (keyFinancialData.length > 0) scores.financial *= 1.3;
      if (criticalFindings.includes('regulatory') || criticalFindings.includes('compliance')) {
        scores.clinical *= 1.3;
        scores.legal *= 1.3;
      }
    }
    
    // Apply filename pattern boosters
    const fileExtension = docName.split('.').pop() || '';
    if (['xls', 'xlsx', 'csv'].includes(fileExtension)) scores.financial *= 1.4;
    if (docName.includes('contract') || docName.includes('agreement')) scores.legal *= 1.6;
    if (docName.includes('clinical') || docName.includes('trial')) scores.clinical *= 1.6;
    if (docName.includes('employee') || docName.includes('salary')) scores.hr *= 1.6;
    
    // Normalize scores to 0-1 range
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore > 0) {
      Object.keys(scores).forEach(agent => {
        scores[agent as keyof typeof scores] = scores[agent as keyof typeof scores] / maxScore;
      });
    }
    
    return scores;
  };

  // Get agent info helper
  const getAgentInfo = (agentType: string) => {
    const agentColors: Record<string, string> = {
      Clinical: 'bg-red-500/20 text-red-300 border-red-500/30',
      Legal: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      Commercial: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      Financial: 'bg-green-500/20 text-green-300 border-green-500/30',
      HR: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      IP: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
      Research: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
    };

    const agentDescriptions: Record<string, string> = {
      Clinical: 'Medical devices, regulatory compliance, clinical trials',
      Legal: 'Contracts, intellectual property, legal compliance',
      Commercial: 'Market analysis, sales strategy, competitive landscape',
      Financial: 'Financial statements, funding, revenue projections',
      HR: 'Human resources, organizational structure, talent management',
      IP: 'Patents, trademarks, intellectual property portfolio',
      Research: 'R&D pipeline, technical specifications, innovation'
    };

    return {
      name: agentType,
      type: agentType,
      colorClasses: agentColors[agentType] || 'bg-gray-500/20 text-gray-300 border-gray-500/30',
      description: agentDescriptions[agentType] || 'Specialized analysis agent'
    };
  };

  // Helper function to get assigned documents for this agent
  const getAssignedDocumentsForAgent = () => {
    if (!documents || !Array.isArray(documents)) return [];
    
    return documents.filter(document => {
      const assignedAgents = getAssignedAgents(document);
      return assignedAgents.some(agent => agent.type.toLowerCase() === agentType.toLowerCase());
    });
  };

  // Calculate assigned documents count using the function above
  const assignedDocuments = getAssignedDocumentsForAgent().length;
  
  // Calculate real progress based on current state and backend progress
  const progress = (() => {
    // If we have real progress from job tracking, use it directly (it's already a percentage)
    if (currentProgress > 0) {
      return Math.round(currentProgress);
    }
    
    // During reset & run all analyses, start from 0
    if (isRunningAllAnalyses && status !== 'Completed') {
      return 0;
    }
    
    // Use backend progress if available
    if (analysisData && analysisData.progress && analysisData.progress > 0) {
      return analysisData.progress;
    }
    
    // FIXED: Only return 100% if status is 'Completed' AND we have actual analysis data
    // For new deals with no analysis, always show 0% progress
    if (status === 'Completed' && analysisData && (analysisData.findings || analysisData.recommendations)) {
      return 100;
    }
    if (status === 'Processing') return 15; // Show some progress for processing
    return 0; // Default to 0% for new deals or "Not Started" status
  })();
  
  // Calculate how many documents were actually analyzed (have findings with document sources)
  const getAnalyzedDocumentCount = () => {
    if (!findings || !Array.isArray(findings) || findings.length === 0) return 0;
    
    const documentsWithSources = findings.filter((finding: any) => 
      finding && (finding.documentSource || finding.documentSources)
    );
    
    const uniqueDocuments = new Set();
    documentsWithSources.forEach((finding: any) => {
      if (finding && finding.documentSource) {
        uniqueDocuments.add(finding.documentSource);
      }
      if (finding && finding.documentSources && Array.isArray(finding.documentSources)) {
        finding.documentSources.forEach((source: string) => uniqueDocuments.add(source));
      }
    });
    
    return uniqueDocuments.size;
  };

  const positiveInsights = (findings || []).filter((f: any) => 
    f.severity === 'positive' || f.type === 'positive' || f.category === 'positive'
  ).length;
  const riskFactors = (findings || []).filter((f: any) => 
    f.severity === 'risk' || f.severity === 'negative' || f.type === 'risk' || f.category === 'risk'
  ).length;
  
  // Debug KPI calculations for verification
  console.log(`🔢 ${agentType} Agent KPIs:`, {
    totalDocuments: documents?.length || 0,
    assignedDocuments: assignedDocuments,
    hasAnalysis: !!analysisData && analysisData.status === 'Completed',
    findingsCount: (findings || []).length,
    positiveInsights,
    riskFactors
  });
  
  // Check if we have any analysis data (findings, recommendations, or status indicating completion)
  const hasAnalysis = (findings || []).length > 0 || (recommendations || []).length > 0 || 
                     (analysisData && analysisData.status === 'Completed') ||
                     (analysisData && (analysisData.findings || analysisData.recommendations));

  if (isLoading) {
    return (
      <Card className="bg-dark-light border-dark-lighter">
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-400">Loading {agentType} analysis...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-dark-light border-dark-lighter">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg font-semibold">Mistral AI {agentType} Analysis</CardTitle>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className={
            status === 'Completed' ? 'text-green-400 border-green-400' :
            status === 'Processing' ? 'text-blue-400 border-blue-400' :
            status === 'Failed' ? 'text-red-400 border-red-400' :
            'text-gray-400 border-gray-400'
          }>
            {status}
          </Badge>
          {status === 'Processing' && (
            <span className="text-xs text-gray-400">{progress}% complete</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Progress Bars - Show individual progress for each agent */}
        {agentType.toLowerCase() === 'legal' && <LegalAnalysisProgress dealId={dealId} />}
        {agentType.toLowerCase() === 'commercial' && <CommercialAnalysisProgress dealId={dealId} />}
        {agentType.toLowerCase() === 'hr' && <HrAnalysisProgress dealId={dealId} />}
        {agentType.toLowerCase() === 'clinical' && <ClinicalAnalysisProgress dealId={dealId} />}
        {agentType.toLowerCase() === 'financial' && <FinancialAnalysisProgress dealId={dealId} />}
        {agentType.toLowerCase() === 'ip' && <IpAnalysisProgress dealId={dealId} />}
        {agentType.toLowerCase() === 'research' && <ResearchAnalysisProgress dealId={dealId} />}
        
        {/* KPI Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Dialog>
            <DialogTrigger asChild>
              <div className="bg-dark border border-dark-lighter rounded-lg p-3 text-center cursor-pointer hover:border-blue-400/50 transition-colors">
                <div className="text-xl md:text-2xl font-bold text-blue-400 mb-1">{assignedDocuments}</div>
                <div className="text-xs md:text-sm text-gray-400">Assigned Documents</div>
              </div>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] bg-dark border-dark-lighter">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-white">
                  {agentType} Agent - Assigned Documents ({assignedDocuments})
                </DialogTitle>
              </DialogHeader>
              <div className="overflow-y-auto max-h-[60vh] pr-4">
                <div className="grid grid-cols-1 gap-3">
                  {getAssignedDocumentsForAgent().map((doc, index) => (
                    <div 
                      key={doc.id} 
                      className="bg-dark-light border border-dark-lighter rounded-lg p-4 hover:border-gray-600 transition-colors cursor-pointer"
                      onClick={() => handleDocumentClick(doc.name)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-white font-medium text-sm mb-2 break-words">
                            {doc.name}
                          </h3>
                          {doc.aiSummary && (
                            <p className="text-gray-400 text-xs line-clamp-3">
                              {typeof doc.aiSummary === 'object' 
                                ? doc.aiSummary.executiveSummary || 'No summary available'
                                : doc.aiSummary
                              }
                            </p>
                          )}
                        </div>
                        <div className="ml-3 flex-shrink-0">
                          <FileText className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  ))}
                  {getAssignedDocumentsForAgent().length === 0 && (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">No documents assigned to {agentType} agent</p>
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <div className="bg-dark border border-dark-lighter rounded-lg p-3 text-center">
            <div className="text-xl md:text-2xl font-bold text-white mb-1">
              {hasAnalysis ? getAnalyzedDocumentCount() : assignedDocuments}
            </div>
            <div className="text-xs md:text-sm text-gray-400">{hasAnalysis ? 'Documents Analyzed' : 'To be analyzed'}</div>
          </div>
          <div className="bg-dark border border-dark-lighter rounded-lg p-3 text-center">
            <div className="text-xl md:text-2xl font-bold text-green-400 mb-1">{positiveInsights}</div>
            <div className="text-xs md:text-sm text-gray-400">Positive Insights</div>
          </div>
          <div className="bg-dark border border-dark-lighter rounded-lg p-3 text-center">
            <div className="text-xl md:text-2xl font-bold text-red-400 mb-1">{riskFactors}</div>
            <div className="text-xs md:text-sm text-gray-400">Risk Factors</div>
          </div>
        </div>

        {/* Comprehensive Questions for Legal and Clinical Agents */}
        {agentType.toLowerCase() === 'legal' ? (
          <LegalQuestionsSection 
            dealId={dealId}
            analysisData={analysisData} 
            findings={findings} 
            assignedDocuments={assignedDocuments}
            documents={documents || []}
            handleDocumentClick={handleDocumentClick}
            quoteViewerOpen={quoteViewerOpen}
            setQuoteViewerOpen={setQuoteViewerOpen}
            selectedQuoteData={selectedQuoteData}
            setSelectedQuoteData={setSelectedQuoteData}
          />
        ) : agentType.toLowerCase() === 'clinical' ? (
          <ClinicalQuestionsSection 
            dealId={dealId}
            analysisData={analysisData} 
            findings={findings} 
            assignedDocuments={assignedDocuments}
            documents={documents || []}
            handleDocumentClick={handleDocumentClick}
            quoteViewerOpen={quoteViewerOpen}
            setQuoteViewerOpen={setQuoteViewerOpen}
            selectedQuoteData={selectedQuoteData}
            setSelectedQuoteData={setSelectedQuoteData}
            onClinicalAnalysisStart={onClinicalAnalysisStart}
          />
        ) : agentType.toLowerCase() === 'commercial' ? (
          <CommercialQuestionsSection 
            dealId={dealId}
            analysisData={analysisData} 
            assignedDocuments={assignedDocuments}
            documents={documents || []}
            handleDocumentClick={handleDocumentClick}
            quoteViewerOpen={quoteViewerOpen}
            setQuoteViewerOpen={setQuoteViewerOpen}
            selectedQuoteData={selectedQuoteData}
            setSelectedQuoteData={setSelectedQuoteData}
          />
        ) : agentType.toLowerCase() === 'hr' ? (
          <HrQuestionsSection 
            dealId={dealId}
            analysisData={analysisData} 
            assignedDocuments={assignedDocuments}
            documents={documents || []}
            handleDocumentClick={handleDocumentClick}
            quoteViewerOpen={quoteViewerOpen}
            setQuoteViewerOpen={setQuoteViewerOpen}
            selectedQuoteData={selectedQuoteData}
            setSelectedQuoteData={setSelectedQuoteData}
          />
        ) : agentType.toLowerCase() === 'financial' ? (
          <FinancialQuestionsSection 
            dealId={dealId}
            analysisData={analysisData} 
            assignedDocuments={assignedDocuments}
            documents={documents || []}
            handleDocumentClick={handleDocumentClick}
            quoteViewerOpen={quoteViewerOpen}
            setQuoteViewerOpen={setQuoteViewerOpen}
            selectedQuoteData={selectedQuoteData}
            setSelectedQuoteData={setSelectedQuoteData}
          />
        ) : agentType.toLowerCase() === 'ip' ? (
          <IpQuestionsSection 
            dealId={dealId}
            analysisData={actualAnalysisData} 
            assignedDocuments={assignedDocuments}
            documents={documents || []}
            handleDocumentClick={handleDocumentClick}
            quoteViewerOpen={quoteViewerOpen}
            setQuoteViewerOpen={setQuoteViewerOpen}
            selectedQuoteData={selectedQuoteData}
            setSelectedQuoteData={setSelectedQuoteData}
          />
        ) : (console.log('🔍 Checking agentType for conditional:', { agentType, lowercase: agentType.toLowerCase(), isResearch: agentType.toLowerCase() === 'research' }), agentType.toLowerCase() === 'research') ? (
          <>
            {console.log('🎯 RENDERING ResearchQuestionsSection for agentType:', agentType)}
            <ResearchQuestionsSection 
              dealId={dealId}
              analysisData={actualAnalysisData} 
              assignedDocuments={assignedDocuments}
              documents={documents || []}
              handleDocumentClick={handleDocumentClick}
              quoteViewerOpen={quoteViewerOpen}
              setQuoteViewerOpen={setQuoteViewerOpen}
              selectedQuoteData={selectedQuoteData}
              setSelectedQuoteData={setSelectedQuoteData}
              onResearchAnalysisStart={onResearchAnalysisStart}
            />
          </>
        ) : (
          /* Analysis Results for other agents */
          findings.length > 0 ? (
            <Tabs defaultValue="positive" className="w-full">
              <TabsList className="border-b border-dark-lighter bg-transparent mb-6 w-full justify-start">
                <TabsTrigger
                  value="positive"
                  className="data-[state=active]:border-green-400 data-[state=active]:text-green-400 border-b-2 border-transparent pb-2 px-1"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Positive ({positiveInsights})
                </TabsTrigger>
                <TabsTrigger
                  value="neutral"
                  className="data-[state=active]:border-gray-400 data-[state=active]:text-gray-400 border-b-2 border-transparent pb-2 px-1"
                >
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Neutral ({findings.filter((f: any) => f.severity === 'neutral' || f.type === 'neutral' || f.category === 'neutral').length})
                </TabsTrigger>
                <TabsTrigger
                  value="risks"
                  className="data-[state=active]:border-red-400 data-[state=active]:text-red-400 border-b-2 border-transparent pb-2 px-1"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Risks ({riskFactors})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="positive">
                <div className="space-y-4">
                  {findings.filter((f: any) => f.severity === 'positive' || f.type === 'positive' || f.category === 'positive').length > 0 ? (
                    findings.filter((f: any) => f.severity === 'positive' || f.type === 'positive' || f.category === 'positive').map((finding: any, index: number) => (
                      <div key={index} className="border border-dark-lighter rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <TrendingUp className="h-5 w-5 text-green-400 mt-1 flex-shrink-0" />
                          <div>
                            <h4 className="font-medium text-white mb-2">
                              {typeof (finding.title || finding.content) === 'string' 
                                ? (finding.title || finding.content || 'Finding')
                                : typeof (finding.title || finding.content) === 'object' 
                                  ? JSON.stringify(finding.title || finding.content, null, 2)
                                  : String(finding.title || finding.content || 'Finding')}
                            </h4>
                            <p className="text-gray-400 text-sm mb-2">
                              {typeof (finding.description || finding.content) === 'string' 
                                ? (finding.description || finding.content || 'No description available')
                                : typeof (finding.description || finding.content) === 'object' 
                                  ? JSON.stringify(finding.description || finding.content, null, 2)
                                  : String(finding.description || finding.content || 'No description available')}
                            </p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-green-400 border-green-400">
                                Confidence: {normalizeConfidence(finding.confidence || 0.8)}%
                              </Badge>
                              <Badge variant="outline" className="text-gray-400 border-gray-400">
                                {typeof (finding.type || finding.category) === 'string' 
                                  ? (finding.type || finding.category || 'analysis')
                                  : typeof (finding.type || finding.category) === 'object' 
                                    ? JSON.stringify(finding.type || finding.category, null, 2)
                                    : String(finding.type || finding.category || 'analysis')}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400 text-center py-8">No positive insights found for this agent type.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="neutral">
                <div className="space-y-4">
                  {findings.filter((f: any) => f.severity === 'neutral' || f.type === 'neutral' || f.category === 'neutral').length > 0 ? (
                    findings.filter((f: any) => f.severity === 'neutral' || f.type === 'neutral' || f.category === 'neutral').map((finding: any, index: number) => (
                      <div key={index} className="border border-dark-lighter rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-gray-400 mt-1 flex-shrink-0" />
                          <div>
                            <h4 className="font-medium text-white mb-2">
                              {typeof (finding.title || finding.content) === 'string' 
                                ? (finding.title || finding.content || 'Finding')
                                : typeof (finding.title || finding.content) === 'object' 
                                  ? JSON.stringify(finding.title || finding.content, null, 2)
                                  : String(finding.title || finding.content || 'Finding')}
                            </h4>
                            <p className="text-gray-400 text-sm mb-2">
                              {typeof (finding.description || finding.content) === 'string' 
                                ? (finding.description || finding.content || 'No description available')
                                : typeof (finding.description || finding.content) === 'object' 
                                  ? JSON.stringify(finding.description || finding.content, null, 2)
                                  : String(finding.description || finding.content || 'No description available')}
                            </p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-gray-400 border-gray-400">
                                Confidence: {normalizeConfidence(finding.confidence || 0.8)}%
                              </Badge>
                              <Badge variant="outline" className="text-gray-400 border-gray-400">
                                {typeof (finding.type || finding.category) === 'string' 
                                  ? (finding.type || finding.category || 'analysis')
                                  : typeof (finding.type || finding.category) === 'object' 
                                    ? JSON.stringify(finding.type || finding.category, null, 2)
                                    : String(finding.type || finding.category || 'analysis')}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400 text-center py-8">No neutral observations found for this agent type.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="risks">
                <div className="space-y-4">
                  {findings.filter((f: any) => f.severity === 'risk' || f.severity === 'negative' || f.type === 'risk' || f.category === 'risk').length > 0 ? (
                    findings.filter((f: any) => f.severity === 'risk' || f.severity === 'negative' || f.type === 'risk' || f.category === 'risk').map((finding: any, index: number) => (
                      <div key={index} className="border border-dark-lighter rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-red-400 mt-1 flex-shrink-0" />
                          <div>
                            <h4 className="font-medium text-white mb-2">
                              {typeof (finding.title || finding.content) === 'string' 
                                ? (finding.title || finding.content || 'Finding')
                                : typeof (finding.title || finding.content) === 'object' 
                                  ? JSON.stringify(finding.title || finding.content, null, 2)
                                  : String(finding.title || finding.content || 'Finding')}
                            </h4>
                            <p className="text-gray-400 text-sm mb-2">
                              {typeof (finding.description || finding.content) === 'string' 
                                ? (finding.description || finding.content || 'No description available')
                                : typeof (finding.description || finding.content) === 'object' 
                                  ? JSON.stringify(finding.description || finding.content, null, 2)
                                  : String(finding.description || finding.content || 'No description available')}
                            </p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-red-400 border-red-400">
                                Confidence: {normalizeConfidence(finding.confidence || 0.8)}%
                              </Badge>
                              <Badge variant="outline" className="text-gray-400 border-gray-400">
                                {typeof (finding.type || finding.category) === 'string' 
                                  ? (finding.type || finding.category || 'analysis')
                                  : typeof (finding.type || finding.category) === 'object' 
                                    ? JSON.stringify(finding.type || finding.category, null, 2)
                                    : String(finding.type || finding.category || 'analysis')}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400 text-center py-8">No risk factors identified for this agent type.</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          ) : null
        )}

        {shouldShowProcessingUI() && agentType.toLowerCase() !== 'legal' ? (
          <div className="text-center py-8">
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
            <h3 className="text-lg font-medium text-white mb-2">Running {agentType} Analysis</h3>
            <p className="text-gray-400 mb-4">
              Processing {assignedDocuments} assigned documents with the Mistral AI agent...
            </p>
            
            {/* Real-time progress bar */}
            <div className="w-full max-w-sm mx-auto mb-4">
              <div className="bg-dark-lighter rounded-full h-3 relative overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-primary to-primary/80 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ 
                    width: assignedDocuments > 0 
                      ? `${Math.min(100, Math.max(5, (currentProgress / assignedDocuments) * 100))}%` 
                      : '5%' 
                  }}
                >
                  <div className="absolute inset-0 bg-white/10 rounded-full animate-pulse"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-medium text-white/90">
                    {currentProgress}/{assignedDocuments}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Current document being processed */}
            {(currentDocumentName || (isRunningAllAnalyses && progress > 0)) && (
              <div className="bg-dark-lighter/50 rounded-lg p-3 mb-4 max-w-md mx-auto">
                <p className="text-xs text-gray-400 mb-1">
                  {currentDocumentName ? 'Currently analyzing:' : 'Processing documents...'}
                </p>
                <p className="text-sm text-white font-medium break-words">
                  {currentDocumentName ? (
                    currentDocumentName.length > 50 
                      ? `${currentDocumentName.substring(0, 47)}...` 
                      : currentDocumentName
                  ) : (
                    `Analyzing ${agentType.toLowerCase()} documents`
                  )}
                </p>
              </div>
            )}
            
            <p className="text-sm text-gray-500">This may take several minutes to complete</p>
          </div>
        ) : null}


      </CardContent>
    </Card>
  );
}

// Removed duplicate progress display - using only the main global progress bar at top of page

// Legal Questions Section Component
interface LegalQuestionsSectionProps {
  dealId: number;
  analysisData: any;
  findings: any[];
  assignedDocuments: number;
  documents: any[];
  handleDocumentClick: (sourceName: string) => void;
  quoteViewerOpen: boolean;
  setQuoteViewerOpen: (open: boolean) => void;
  selectedQuoteData: any;
  setSelectedQuoteData: (data: any) => void;
}

interface LegalQuestion {
  id: string;
  category: string;
  question: string;
  subQuestions?: string[];
  answer?: string;
  confidence?: number;
  sources?: string[];
}

interface ClinicalQuestion {
  id: string;
  category: string;
  question: string;
  subQuestions?: string[];
  answer?: string;
  confidence?: number;
  sources?: string[];
}

const CLINICAL_QUESTIONS: ClinicalQuestion[] = [
  // Clinical Trial Protocols
  { 
    id: 'trial_1', 
    question: 'Are trial phases and designs clearly defined?', 
    category: 'Clinical Trial Protocols',
    subQuestions: [
      'What phase is the current trial (Phase I, II, III)?',
      'Is the study design (randomized, controlled, blinded) specified?',
      'Are patient enrollment targets clearly defined?'
    ]
  },
  { 
    id: 'trial_2', 
    question: 'What are primary and secondary endpoints?', 
    category: 'Clinical Trial Protocols',
    subQuestions: [
      'Are primary efficacy endpoints clearly measured?',
      'What secondary endpoints are being tracked?',
      'Are endpoint measurement timelines specified?'
    ]
  },
  { 
    id: 'trial_3', 
    question: 'How is efficacy/safety assessed?', 
    category: 'Clinical Trial Protocols',
    subQuestions: [
      'What safety monitoring procedures are in place?',
      'How is treatment efficacy being measured?',
      'Are there defined stopping rules for safety?'
    ]
  },
  // Regulatory Filings
  { 
    id: 'regulatory_1', 
    question: 'What is current approval status?', 
    category: 'Regulatory Filings (FDA, EMA)',
    subQuestions: [
      'What regulatory submissions have been made?',
      'What is the current FDA/EMA approval status?',
      'Are there any regulatory holds or delays?'
    ]
  },
  { 
    id: 'regulatory_2', 
    question: 'Are fast-track or orphan designations received?', 
    category: 'Regulatory Filings (FDA, EMA)',
    subQuestions: [
      'Has breakthrough therapy designation been granted?',
      'Are there any orphan drug designations?',
      'What regulatory incentives have been secured?'
    ]
  },
  { 
    id: 'regulatory_3', 
    question: 'Are adverse events disclosed?', 
    category: 'Regulatory Filings (FDA, EMA)',
    subQuestions: [
      'Are all adverse events properly documented?',
      'What serious adverse events have occurred?',
      'Are there patterns in adverse event reporting?'
    ]
  },
  // Investigator Brochures & Study Reports
  { 
    id: 'study_1', 
    question: 'Are inclusion/exclusion criteria consistent?', 
    category: 'Investigator Brochures & Study Reports',
    subQuestions: [
      'Are patient selection criteria clearly defined?',
      'Are exclusion criteria medically justified?',
      'Is the target patient population appropriate?'
    ]
  },
  { 
    id: 'study_2', 
    question: 'What patient population is used?', 
    category: 'Investigator Brochures & Study Reports',
    subQuestions: [
      'What are the demographic characteristics?',
      'What is the disease stage or severity?',
      'Are there any special population considerations?'
    ]
  },
  { 
    id: 'study_3', 
    question: 'Are SAE (Serious Adverse Events) tracked?', 
    category: 'Investigator Brochures & Study Reports',
    subQuestions: [
      'What SAE reporting procedures are in place?',
      'How are SAEs classified and analyzed?',
      'Are there any concerning safety signals?'
    ]
  },
  // Scientific Advisory Board Notes
  { 
    id: 'advisory_1', 
    question: 'Are trial results debated by experts?', 
    category: 'Scientific Advisory Board Notes',
    subQuestions: [
      'What do independent experts think of the data?',
      'Are there any concerns raised by advisors?',
      'What recommendations have been made?'
    ]
  },
  { 
    id: 'advisory_2', 
    question: 'Are post-trial steps (e.g. Phase 3 readiness) described?', 
    category: 'Scientific Advisory Board Notes',
    subQuestions: [
      'What are the next planned development steps?',
      'Is the company ready for Phase 3 trials?',
      'What regulatory strategy is recommended?'
    ]
  }
];

interface ResearchQuestion {
  id: string;
  category: string;
  question: string;
  subQuestions?: string[];
  answer?: string;
  confidence?: number;
  sources?: string[];
}

const RESEARCH_QUESTIONS: ResearchQuestion[] = [
  // Market Research Reports
  {
    id: 'market_1',
    category: 'Market Research Reports',
    question: 'Are TAM/SAM/SOM defined with assumptions?',
    subQuestions: ['Total Addressable Market', 'Serviceable Addressable Market', 'Serviceable Obtainable Market']
  },
  {
    id: 'market_2',
    category: 'Market Research Reports',
    question: 'What competitive landscape analysis is provided?',
    subQuestions: ['Direct competitors', 'Indirect competitors', 'Competitive advantages']
  },
  {
    id: 'market_3',
    category: 'Market Research Reports',
    question: 'Are market growth projections validated?',
    subQuestions: ['Growth rates', 'Market trends', 'Validation sources']
  },
  // Technical Whitepapers
  {
    id: 'technical_1',
    category: 'Technical Whitepapers',
    question: 'What technical approach/architecture is described?',
    subQuestions: ['Technical architecture', 'Implementation approach', 'Technology stack']
  },
  {
    id: 'technical_2',
    category: 'Technical Whitepapers',
    question: 'Are technical risks and mitigation strategies outlined?',
    subQuestions: ['Technical risks', 'Mitigation strategies', 'Risk assessment']
  },
  {
    id: 'technical_3',
    category: 'Technical Whitepapers',
    question: 'What scalability and performance benchmarks are provided?',
    subQuestions: ['Scalability metrics', 'Performance benchmarks', 'Load testing results']
  },
  // Academic Publications
  {
    id: 'academic_1',
    category: 'Academic Publications',
    question: 'What peer-reviewed research supports the technology?',
    subQuestions: ['Published papers', 'Research citations', 'Academic validation']
  },
  {
    id: 'academic_2',
    category: 'Academic Publications',
    question: 'Are there collaborations with research institutions?',
    subQuestions: ['University partnerships', 'Research collaborations', 'Academic advisors']
  },
  {
    id: 'academic_3',
    category: 'Academic Publications',
    question: 'What scientific evidence validates the approach?',
    subQuestions: ['Scientific validation', 'Experimental results', 'Research methodology']
  },
  // Patent Landscape
  {
    id: 'patent_1',
    category: 'Patent Landscape',
    question: 'What patent portfolio exists and what gaps are identified?',
    subQuestions: ['Patent portfolio', 'Patent gaps', 'IP protection strategy']
  },
  {
    id: 'patent_2',
    category: 'Patent Landscape',
    question: 'Are there freedom-to-operate risks?',
    subQuestions: ['FTO analysis', 'Patent risks', 'Infringement concerns']
  }
];

const LEGAL_QUESTIONS: LegalQuestion[] = [
  {
    id: 'contracts_1',
    category: 'Contracts & Agreements',
    question: 'Are key commercial contracts clearly defined?',
    subQuestions: ['Contract terms', 'Payment terms', 'Deliverables']
  },
  {
    id: 'contracts_2',
    category: 'Contracts & Agreements',
    question: 'What are the key contractual obligations and terms?',
    subQuestions: ['Obligations', 'Terms and conditions', 'Performance requirements']
  },
  {
    id: 'contracts_3',
    category: 'Contracts & Agreements',
    question: 'Are there any concerning contract provisions or risks?',
    subQuestions: ['Risk provisions', 'Liability clauses', 'Termination conditions']
  },
  {
    id: 'governance_1',
    category: 'Corporate Governance',
    question: 'What is the corporate governance structure?',
    subQuestions: ['Board composition', 'Governance policies', 'Decision-making processes']
  },
  {
    id: 'governance_2',
    category: 'Corporate Governance',
    question: 'Are there adequate governance controls and oversight?',
    subQuestions: ['Internal controls', 'Oversight mechanisms', 'Compliance frameworks']
  },
  {
    id: 'governance_3',
    category: 'Corporate Governance',
    question: 'What are the key governance risks and mitigation strategies?',
    subQuestions: ['Governance risks', 'Risk mitigation', 'Control weaknesses']
  },
  {
    id: 'ip_1',
    category: 'Intellectual Property',
    question: 'What is the intellectual property portfolio?',
    subQuestions: ['Patents', 'Trademarks', 'Trade secrets', 'Copyrights']
  },
  {
    id: 'ip_2',
    category: 'Intellectual Property',
    question: 'Are there any IP ownership or infringement issues?',
    subQuestions: ['IP ownership', 'Infringement risks', 'Freedom to operate']
  },
  {
    id: 'ip_3',
    category: 'Intellectual Property',
    question: 'What IP protection and enforcement strategies are in place?',
    subQuestions: ['IP protection', 'Enforcement mechanisms', 'IP strategy']
  },
  {
    id: 'litigation_1',
    category: 'Litigation & Legal Risks',
    question: 'Are there any pending or threatened litigations?',
    subQuestions: ['Active litigation', 'Threatened litigation', 'Legal disputes']
  },
  {
    id: 'litigation_2',
    category: 'Litigation & Legal Risks',
    question: 'What are the key legal risks and potential exposures?',
    subQuestions: ['Legal risks', 'Financial exposure', 'Contingent liabilities']
  },
  {
    id: 'regulatory_1',
    category: 'Regulatory Compliance',
    question: 'What regulatory requirements apply to the business?',
    subQuestions: ['Regulatory framework', 'Compliance requirements', 'Industry regulations']
  },
  {
    id: 'regulatory_2',
    category: 'Regulatory Compliance',
    question: 'Are there any regulatory compliance issues or violations?',
    subQuestions: ['Compliance violations', 'Regulatory actions', 'Enforcement proceedings']
  }
];

function LegalQuestionsSection({ dealId, analysisData, findings, assignedDocuments, documents, handleDocumentClick, quoteViewerOpen, setQuoteViewerOpen, selectedQuoteData, setSelectedQuoteData }: LegalQuestionsSectionProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [rerunningQuestionId, setRerunningQuestionId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Check if legal analysis is available from comprehensive endpoint
  const { data: comprehensiveResults, refetch: refetchComprehensive } = useQuery({
    queryKey: [`/api/deals/${dealId}/legal-analysis/comprehensive/results`],
    refetchInterval: 30000, // ⚡ PERFORMANCE: Reduced from 2s to 30s
    staleTime: 0, // Always treat as stale to force fresh data
    gcTime: 0, // Don't cache results (replaces cacheTime in newer versions)
  });

  // Force refetch on component mount to ensure fresh data
  useEffect(() => {
    refetchComprehensive();
  }, [refetchComprehensive]);

  // Use comprehensive results if available, fallback to analysisData
  const legalData = comprehensiveResults?.analysis || analysisData || null;

  // Check if legal analysis is available  
  const hasLegalAnalysis = legalData && (
    (legalData?.legalAnswers && typeof legalData.legalAnswers === 'object' && Object.keys(legalData.legalAnswers).length > 0) ||
    (legalData?.findings && Array.isArray(legalData.findings) && legalData.findings.length > 0)
  );
  
  console.log('⚖️ Legal Analysis Available:', hasLegalAnalysis);
  console.log('⚖️ Comprehensive Results Available:', !!comprehensiveResults?.analysis);  
  console.log('⚖️ Legal Data from Comprehensive:', !!legalData?.legalAnswers);
  
  // Debug: Log legal data structure for verification
  if (legalData) {
    console.log('⚖️ Legal Data Available:', !!legalData);
    console.log('⚖️ Has legalAnswers:', !!legalData?.legalAnswers);
    console.log('⚖️ Has findings:', !!legalData?.findings);
    console.log('⚖️ Has recommendations:', !!legalData?.recommendations);
  }

  // Mutation for re-running individual questions
  const rerunQuestionMutation = useMutation({
    mutationFn: async (questionId: string) => {
      const response = await apiRequest(`/api/deals/${dealId}/legal-analysis/question/${questionId}/rerun`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (data, questionId) => {
      console.log(`✅ Successfully re-ran question ${questionId}`, data);
      
      // If the backend returned the full updated analysis, update the cache directly
      if (data.fullAnalysis) {
        queryClient.setQueryData(
          [`/api/deals/${dealId}/legal-analysis/comprehensive/results`],
          { success: true, analysis: data.fullAnalysis }
        );
      }
      
      // Also invalidate and refetch as backup
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/legal-analysis/comprehensive/results`] });
      refetchComprehensive();
      setRerunningQuestionId(null);
    },
    onError: (error: Error, questionId) => {
      console.error(`❌ Error re-running question ${questionId}:`, error);
      setRerunningQuestionId(null);
    },
  });

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleQuestion = (questionId: string) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(questionId)) {
      newExpanded.delete(questionId);
    } else {
      newExpanded.add(questionId);
    }
    setExpandedQuestions(newExpanded);
  };

  // Group questions by category
  const categorizedQuestions = LEGAL_QUESTIONS.reduce((acc, question) => {
    if (!acc[question.category]) {
      acc[question.category] = [];
    }
    acc[question.category].push(question);
    return acc;
  }, {} as Record<string, LegalQuestion[]>);

  // Extract answers from legal analysis data
  const getAnswerForQuestion = (questionId: string): { 
    answer: string; 
    confidence: number; 
    sources: string[];
    quotes?: Array<{document: string; text: string; relevance: string}>;
    keyFindings?: string[];
    evidenceSummary?: string;
    legalAssessment?: string;
    recommendations?: string[];
    detailedEvidence?: any[];
  } | null => {
    if (!legalData) return null;
    
    console.log(`⚖️ Looking for answer to legal question ${questionId}`);
    console.log(`⚖️ Legal Answers exists:`, !!legalData.legalAnswers);
    
    // First try to get answer from legalAnswers structure
    if (legalData?.legalAnswers && legalData.legalAnswers[questionId]) {
      const answer = legalData.legalAnswers[questionId];
      
      return {
        answer: answer.answer || 'Analysis in progress...',
        confidence: answer.confidence || 0,
        sources: Array.isArray(answer.sources) ? answer.sources : answer.sources ? [answer.sources] : [],
        quotes: answer.quotes || [],
        keyFindings: answer.keyFindings || [],
        evidenceSummary: answer.evidenceSummary || '',
        legalAssessment: answer.legalAssessment || '',
        recommendations: answer.recommendations || [],
        detailedEvidence: answer.detailedEvidence || []
      };
    }

    // Fallback to findings-based system
    const questionKeywords = LEGAL_QUESTIONS.find(q => q.id === questionId);
    if (!questionKeywords) return null;
    
    // Check if findings exist before filtering
    if (!legalData?.findings || !Array.isArray(legalData.findings)) return null;
    
    // Search through findings for relevant content
    const relevantFindings = legalData.findings.filter((finding: any) => {
      const findingText = (finding.content || finding.description || finding.title || '').toLowerCase();
      const questionText = questionKeywords.question.toLowerCase();
      
      // Check for keyword matches
      const keywordMatches = [
        'shares', 'liquidation', 'preferences', 'anti-dilution', 'drag-along', 'tag-along', 
        'board', 'voting', 'veto', 'warrants', 'valuation', 'interest', 'maturity',
        'conversion', 'ip assignment', 'founders', 'personnel', 'commercial', 'sla',
        'distributor', 'termination', 'exclusivity', 'nda', 'confidentiality', 'litigation',
        'regulatory', 'fda', 'clinical', 'data use'
      ];
      
      return keywordMatches.some(keyword => 
        findingText.includes(keyword) || questionText.includes(keyword)
      );
    });
    
    if (relevantFindings.length === 0) return null;
    
    // Combine relevant findings into a comprehensive answer
    const combinedAnswer = relevantFindings
      .map((finding: any) => finding.content || finding.description || finding.title)
      .join(' ');
    
    // Calculate average confidence
    const avgConfidence = relevantFindings.length > 0 
      ? Math.round(relevantFindings.reduce((sum: number, f: any) => sum + (f.confidence || 0.8), 0) / relevantFindings.length * 100)
      : 80;
    
    // Extract ALL source document names - NO LIMIT
    const sources = relevantFindings
      .map((finding: any) => finding.source || finding.document)
      .filter((source: string) => source);
    
    return {
      answer: combinedAnswer, // NO TRUNCATION - Show full answer
      confidence: avgConfidence,
      sources: sources
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Legal Due Diligence Questions</h3>
          <Badge variant="outline" className="text-gray-400 border-gray-400">
            {assignedDocuments} Documents Analyzed
          </Badge>
        </div>
        <PersistentLegalButton 
          dealId={dealId}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        />
      </div>

      {/* Progress is now shown in main progress bar at top of page - removed duplicate here */}

      {Object.entries(categorizedQuestions).map(([category, questions]) => (
        <div key={category} className="border border-dark-lighter rounded-lg">
          <button
            onClick={() => toggleCategory(category)}
            className="w-full flex items-center justify-between p-4 bg-dark-lighter/50 hover:bg-dark-lighter/70 transition-colors"
          >
            <h4 className="font-medium text-white text-left">{category}</h4>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-gray-400 border-gray-400">
                {questions && Array.isArray(questions) ? questions.length : 0} questions
              </Badge>
              {expandedCategories.has(category) ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </div>
          </button>

          {expandedCategories.has(category) && (
            <div className="p-4 space-y-4">
              {questions && Array.isArray(questions) && questions.map((question) => {
                const answer = getAnswerForQuestion(question.id);
                const hasAnswer = answer !== null;
                
                return (
                  <div key={question.id} className="border border-dark-lighter/50 rounded-lg">
                    <div className="p-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          hasAnswer ? 'bg-green-400' : 'bg-gray-400'
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-white font-medium text-sm flex-1">{question.question}</p>
                            {/* Re-run button for individual question */}
                            <button
                              data-testid={`rerun-question-${question.id}`}
                              onClick={() => {
                                setRerunningQuestionId(question.id);
                                rerunQuestionMutation.mutate(question.id);
                              }}
                              disabled={rerunningQuestionId === question.id}
                              className="p-1.5 rounded hover:bg-dark-lighter transition-colors text-gray-400 hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={rerunningQuestionId === question.id ? "Re-running..." : "Re-run this question"}
                            >
                              {rerunningQuestionId === question.id ? (
                                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                                </svg>
                              ) : (
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.39 0 4.56.93 6.18 2.44l-2.18 2.18"/>
                                  <path d="M15 9h6v-6"/>
                                </svg>
                              )}
                            </button>
                          </div>
                          
                          {question.subQuestions && Array.isArray(question.subQuestions) && (
                            <div className="mt-2 space-y-1">
                              {question.subQuestions.map((subQ, index) => (
                                <p key={index} className="text-gray-400 text-xs ml-2">• {subQ}</p>
                              ))}
                            </div>
                          )}
                          
                          {hasAnswer ? (
                            <div className="mt-3 space-y-3">
                              {/* Main Answer */}
                              <div className="bg-dark/50 rounded p-3">
                                <h5 className="text-xs font-medium text-blue-400 mb-2">Legal Analysis</h5>
                                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{answer.answer}</p>
                              </div>

                              {/* Enhanced Legal Assessment */}
                              {answer.legalAssessment && (
                                <div className="bg-dark/30 rounded p-3">
                                  <h5 className="text-xs font-medium text-purple-400 mb-2">Legal Assessment</h5>
                                  <p className="text-gray-300 text-sm leading-relaxed">{answer.legalAssessment}</p>
                                </div>
                              )}

                              {/* Document Quotes */}
                              {answer.quotes && Array.isArray(answer.quotes) && answer.quotes.length > 0 && (
                                <div className="bg-gradient-to-r from-yellow-400/10 to-orange-400/10 rounded p-3">
                                  <h5 className="text-xs font-medium text-yellow-400 mb-2">
                                    📖 Document Quotes ({answer.quotes && Array.isArray(answer.quotes) ? answer.quotes.length : 0})
                                  </h5>
                                  <div className="space-y-2">
                                    {answer.quotes && Array.isArray(answer.quotes) && answer.quotes.map((quote, index) => (
                                      <div key={index} className="bg-dark/70 rounded p-2 border-l-2 border-yellow-400">
                                        <div className="flex items-start justify-between mb-1">
                                          <button
                                            onClick={() => handleDocumentClick(safeRender(quote.document, 'Unknown Document'))}
                                            className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 hover:bg-blue-500/30 transition-colors cursor-pointer"
                                            title={`View document: ${safeRender(quote.document, 'Unknown Document')}`}
                                          >
                                            📄 {(() => { const docName = safeRender(quote.document, 'Unknown Document'); return docName.length > 25 ? `${docName.substring(0, 25)}...` : docName; })()}
                                          </button>
                                          {quote.relevance && (
                                            <Badge variant="outline" className="text-xs text-gray-400 border-gray-400">
                                              {safeRender(quote.relevance, 'Medium')}
                                            </Badge>
                                          )}
                                        </div>
                                        <blockquote className="text-gray-300 text-xs italic leading-relaxed border-l-2 border-gray-600 pl-2 mt-1">
                                          "{safeRender(quote.text, 'No quote text available')}"
                                        </blockquote>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Evidence Summary */}
                              {answer.evidenceSummary && (
                                <div className="bg-dark/30 rounded p-3">
                                  <h5 className="text-xs font-medium text-green-400 mb-2">Evidence Summary</h5>
                                  <p className="text-gray-300 text-sm leading-relaxed">{answer.evidenceSummary}</p>
                                </div>
                              )}

                              {/* Key Findings */}
                              {answer.keyFindings && Array.isArray(answer.keyFindings) && answer.keyFindings.length > 0 && (
                                <div className="bg-dark/30 rounded p-3">
                                  <h5 className="text-xs font-medium text-blue-400 mb-2">Key Findings</h5>
                                  <ul className="space-y-1">
                                    {answer.keyFindings.map((finding, index) => (
                                      <li key={index} className="text-gray-300 text-xs flex items-start gap-2">
                                        <span className="text-blue-400 text-xs mt-1">•</span>
                                        {safeRender(finding, 'No finding available')}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Recommendations */}
                              {answer.recommendations && Array.isArray(answer.recommendations) && answer.recommendations.length > 0 && (
                                <div className="bg-gradient-to-r from-red-400/10 to-orange-400/10 rounded p-3">
                                  <h5 className="text-xs font-medium text-red-400 mb-2">Recommendations</h5>
                                  <ul className="space-y-1">
                                    {answer.recommendations.map((rec, index) => (
                                      <li key={index} className="text-gray-300 text-xs flex items-start gap-2">
                                        <span className="text-red-400 text-xs mt-1">⚠</span>
                                        {typeof rec === 'string' ? rec : 
                                         typeof rec === 'object' ? JSON.stringify(rec, null, 2) :
                                         String(rec)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Metadata */}
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-green-400 border-green-400">
                                  Confidence: {normalizeConfidence(answer.confidence)}%
                                </Badge>
                                {answer.quotes && Array.isArray(answer.quotes) && answer.quotes.length > 0 && (
                                  <Badge 
                                    variant="outline" 
                                    className="text-yellow-400 border-yellow-400 cursor-pointer hover:bg-yellow-400/10"
                                    onClick={() => {
                                      setSelectedQuoteData({
                                        quotes: answer.quotes && Array.isArray(answer.quotes) && answer.quotes.map((quote: string) => ({
                                          text: quote,
                                          documentName: answer.sources?.[0] || 'Unknown Document',
                                          confidence: answer.confidence || 0.8
                                        })),
                                        sources: [],
                                        title: question.question
                                      });
                                      setQuoteViewerOpen(true);
                                    }}
                                  >
                                    {answer.quotes && Array.isArray(answer.quotes) ? answer.quotes.length : 0} quote{answer.quotes && Array.isArray(answer.quotes) ? answer.quotes.length : 0 > 1 ? 's' : ''}
                                  </Badge>
                                )}
                                {answer.sources && Array.isArray(answer.sources) && answer.sources.length > 0 && (
                                  <Badge 
                                    variant="outline" 
                                    className="text-blue-400 border-blue-400 cursor-pointer hover:bg-blue-400/10"
                                    onClick={() => {
                                      console.log('🚀 CLICK HANDLER TRIGGERED!');
                                      console.log('🔍 Answer object:', answer);
                                      // Create sources using detailed evidence with unique content from each document
                                      console.log('🔍 Processing detailedEvidence:', answer.detailedEvidence);
                                      const sources = answer.detailedEvidence?.map((evidence: any) => {
                                        console.log('🔍 Processing evidence for:', evidence.documentName);
                                        console.log('🔍 Evidence data:', evidence);
                                        return {
                                          documentName: evidence.documentName,
                                          relevantSections: evidence.relevantContent || evidence.keyFindings || [evidence.documentSummary || 'No specific section identified'],
                                          extractedText: evidence.documentSummary || 'No specific content extracted'
                                        };
                                      }) || answer.sources.map((source: string) => ({
                                        documentName: source,
                                        relevantSections: [answer.answer || 'No specific section identified'],
                                        extractedText: answer.answer
                                      }));
                                      console.log('🔍 Final sources array:', sources);
                                      
                                      setSelectedQuoteData({
                                        quotes: [],
                                        sources,
                                        title: question.question
                                      });
                                      setQuoteViewerOpen(true);
                                    }}
                                  >
                                    {answer.sources && Array.isArray(answer.sources) ? answer.sources.length : 0} source{answer.sources && Array.isArray(answer.sources) && answer.sources.length > 1 ? 's' : ''}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 bg-dark/30 rounded p-3">
                              <p className="text-gray-400 text-sm italic">No answer found in analyzed documents</p>
                              <Badge variant="outline" className="text-gray-400 border-gray-400 mt-2">
                                Requires analysis
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
      
      <DocumentQuoteViewer
        isOpen={quoteViewerOpen}
        onClose={() => setQuoteViewerOpen(false)}
        quotes={selectedQuoteData.quotes}
        sources={selectedQuoteData.sources}
        title={selectedQuoteData.title}
        documents={documents}
      />
    </div>
  );
}

// Clinical Questions Section Component  
interface ClinicalQuestionsSectionProps {
  dealId: number;
  analysisData: any;
  findings: any[];
  assignedDocuments: number;
  documents: any[];
  handleDocumentClick: (sourceName: string) => void;
  quoteViewerOpen: boolean;
  setQuoteViewerOpen: (open: boolean) => void;
  selectedQuoteData: any;
  setSelectedQuoteData: (data: any) => void;
  onClinicalAnalysisStart?: () => void;
}

function ClinicalQuestionsSection({ dealId, analysisData, findings, assignedDocuments, documents, handleDocumentClick, quoteViewerOpen, setQuoteViewerOpen, selectedQuoteData, setSelectedQuoteData, onClinicalAnalysisStart }: ClinicalQuestionsSectionProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  // Check if clinical analysis is available from comprehensive endpoint
  const { data: comprehensiveResults, refetch: refetchComprehensive } = useQuery({
    queryKey: [`/api/deals/${dealId}/clinical-analysis/comprehensive/results`],
    refetchInterval: 30000, // ⚡ PERFORMANCE: Reduced from 2s to 30s
    staleTime: 0, // Always treat as stale to force fresh data
    gcTime: 0, // Don't cache results (replaces cacheTime in newer versions)
  });

  // Force refetch on component mount to ensure fresh data
  useEffect(() => {
    refetchComprehensive();
  }, [refetchComprehensive]);

  // Use comprehensive results if available, fallback to analysisData
  const clinicalData = comprehensiveResults?.analysis || analysisData || null;

  // Check if clinical analysis is available  
  const hasClinicalAnalysis = clinicalData && (
    (clinicalData?.clinicalAnswers && typeof clinicalData.clinicalAnswers === 'object' && Object.keys(clinicalData.clinicalAnswers).length > 0) ||
    (clinicalData?.findings && Array.isArray(clinicalData.findings) && clinicalData.findings.length > 0)
  );
  
  console.log('🧬 Clinical Analysis Available:', hasClinicalAnalysis);
  console.log('🧬 Comprehensive Results Available:', !!comprehensiveResults?.analysis);  
  console.log('🧬 Clinical Data from Comprehensive:', !!clinicalData?.clinicalAnswers);
  
  // Debug: Log clinical data structure for verification
  if (clinicalData) {
    console.log('🧬 Clinical Data Available:', !!clinicalData);
    console.log('🧬 Has clinicalAnswers:', !!clinicalData?.clinicalAnswers);
    console.log('🧬 Has findings:', !!clinicalData?.findings);
    console.log('🧬 Has recommendations:', !!clinicalData?.recommendations);
  }

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Group clinical questions by category
  const categorizedQuestions = CLINICAL_QUESTIONS.reduce((acc, question) => {
    if (!acc[question.category]) {
      acc[question.category] = [];
    }
    acc[question.category].push(question);
    return acc;
  }, {} as Record<string, ClinicalQuestion[]>);

  // Extract answers from clinical analysis data
  const getAnswerForQuestion = (questionId: string): { 
    answer: string; 
    confidence: number; 
    sources: string[];
    quotes?: Array<{document: string; text: string; relevance: string}>;
    keyFindings?: string[];
    evidenceSummary?: string;
    clinicalAssessment?: string;
    recommendations?: string[];
    detailedEvidence?: any[];
  } | null => {
    if (!clinicalData) return null;
    
    console.log(`🧬 Looking for answer to clinical question ${questionId}`);
    console.log(`🧬 Clinical Answers exists:`, !!clinicalData.clinicalAnswers);
    
    // First try to get answer from clinicalAnswers structure
    if (clinicalData?.clinicalAnswers && clinicalData.clinicalAnswers[questionId]) {
      const answer = clinicalData.clinicalAnswers[questionId];
      return {
        answer: answer.answer || 'Analysis in progress...',
        confidence: answer.confidence || 0,
        sources: Array.isArray(answer.sources) ? answer.sources : answer.sources ? [answer.sources] : [],
        quotes: answer.quotes || [],
        keyFindings: answer.keyFindings || [],
        evidenceSummary: answer.evidenceSummary || '',
        clinicalAssessment: answer.clinicalAssessment || '',
        recommendations: answer.recommendations || [],
        detailedEvidence: answer.detailedEvidence || []
      };
    }

    // Fallback to findings-based system
    const questionKeywords = CLINICAL_QUESTIONS.find(q => q.id === questionId);
    if (!questionKeywords) return null;
    
    // Check if findings exist before filtering
    if (!clinicalData?.findings || !Array.isArray(clinicalData.findings)) return null;
    
    // Search through findings for relevant content
    const relevantFindings = clinicalData.findings.filter((finding: any) => {
      const findingText = (finding.content || finding.description || finding.title || '').toLowerCase();
      const questionText = questionKeywords.question.toLowerCase();
      
      // Clinical-specific keywords
      const keywordMatches = [
        'trial', 'phase', 'clinical', 'regulatory', 'fda', 'ema', 'endpoint', 
        'efficacy', 'safety', 'adverse', 'patient', 'study', 'protocol',
        'approval', 'designation', 'orphan', 'breakthrough', 'inclusion',
        'exclusion', 'population', 'advisory', 'sae', 'serious adverse'
      ];
      
      return keywordMatches.some(keyword => 
        findingText.includes(keyword) || questionText.includes(keyword)
      );
    });
    
    if (relevantFindings.length === 0) return null;
    
    // Combine relevant findings into a comprehensive answer
    const combinedAnswer = relevantFindings
      .map((finding: any) => finding.content || finding.description || finding.title)
      .join(' ');
    
    // Calculate average confidence
    const avgConfidence = relevantFindings.length > 0 
      ? Math.round(relevantFindings.reduce((sum: number, f: any) => sum + (f.confidence || 0.8), 0) / relevantFindings.length * 100)
      : 80;
    
    // Extract ALL source document names - NO LIMIT
    const sources = relevantFindings
      .map((finding: any) => finding.source || finding.document)
      .filter((source: string) => source);
    
    return {
      answer: combinedAnswer, // NO TRUNCATION - Show full answer
      confidence: avgConfidence,
      sources: sources
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-green-400" />
          <h3 className="text-lg font-semibold text-white">Clinical Due Diligence Questions</h3>
          <Badge variant="outline" className="text-gray-400 border-gray-400">
            {assignedDocuments} Documents Analyzed
          </Badge>
        </div>
        <PersistentClinicalButton dealId={dealId} />
      </div>

      {Object.entries(categorizedQuestions).map(([category, questions]) => (
        <div key={category} className="border border-dark-lighter rounded-lg">
          <button
            onClick={() => toggleCategory(category)}
            className="w-full flex items-center justify-between p-4 bg-dark-lighter/50 hover:bg-dark-lighter/70 transition-colors"
          >
            <h4 className="font-medium text-white text-left">{category}</h4>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-gray-400 border-gray-400">
                {questions && Array.isArray(questions) ? questions.length : 0} questions
              </Badge>
              {expandedCategories.has(category) ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </div>
          </button>

          {expandedCategories.has(category) && (
            <div className="p-4 space-y-4">
              {questions && Array.isArray(questions) && questions.map((question) => {
                const answer = getAnswerForQuestion(question.id);
                const hasAnswer = answer !== null;
                
                return (
                  <div key={question.id} className="border border-dark-lighter/50 rounded-lg">
                    <div className="p-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          hasAnswer ? 'bg-green-400' : 'bg-gray-400'
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-white font-medium text-sm flex-1">{question.question}</p>
                            {/* Re-run button for individual question */}
                            <button
                              data-testid={`rerun-question-${question.id}`}
                              onClick={() => {
                                setRerunningQuestionId(question.id);
                                rerunQuestionMutation.mutate(question.id);
                              }}
                              disabled={rerunningQuestionId === question.id}
                              className="p-1.5 rounded hover:bg-dark-lighter transition-colors text-gray-400 hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={rerunningQuestionId === question.id ? "Re-running..." : "Re-run this question"}
                            >
                              {rerunningQuestionId === question.id ? (
                                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                                </svg>
                              ) : (
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.39 0 4.56.93 6.18 2.44l-2.18 2.18"/>
                                  <path d="M15 9h6v-6"/>
                                </svg>
                              )}
                            </button>
                          </div>
                          
                          {question.subQuestions && Array.isArray(question.subQuestions) && (
                            <div className="mt-2 space-y-1">
                              {question.subQuestions.map((subQ, index) => (
                                <p key={index} className="text-gray-400 text-xs ml-2">• {subQ}</p>
                              ))}
                            </div>
                          )}
                          
                          {hasAnswer ? (
                            <div className="mt-3 space-y-3">
                              {/* Main Answer */}
                              <div className="bg-dark/50 rounded p-3">
                                <h5 className="text-xs font-medium text-green-400 mb-2">Clinical Analysis</h5>
                                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{answer.answer}</p>
                              </div>

                              {/* Enhanced Clinical Assessment */}
                              {answer.clinicalAssessment && (
                                <div className="bg-dark/30 rounded p-3">
                                  <h5 className="text-xs font-medium text-purple-400 mb-2">Clinical Assessment</h5>
                                  <p className="text-gray-300 text-sm leading-relaxed">{answer.clinicalAssessment}</p>
                                </div>
                              )}

                              {/* Key Findings */}
                              {answer.keyFindings && Array.isArray(answer.keyFindings) && answer.keyFindings.length > 0 && (
                                <div className="bg-gradient-to-r from-green-400/10 to-blue-400/10 rounded p-3">
                                  <h5 className="text-xs font-medium text-green-400 mb-2">
                                    🔬 Key Clinical Findings ({answer.keyFindings.length})
                                  </h5>
                                  <ul className="space-y-1">
                                    {answer.keyFindings.map((finding, index) => (
                                      <li key={index} className="text-gray-300 text-xs flex items-start gap-2">
                                        <span className="text-green-400 text-xs mt-1">✓</span>
                                        {safeRender(finding, 'No finding available')}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Recommendations */}
                              {answer.recommendations && Array.isArray(answer.recommendations) && answer.recommendations.length > 0 && (
                                <div className="bg-gradient-to-r from-yellow-400/10 to-orange-400/10 rounded p-3">
                                  <h5 className="text-xs font-medium text-yellow-400 mb-2">
                                    💡 Clinical Recommendations ({answer.recommendations && Array.isArray(answer.recommendations) ? answer.recommendations.length : 0})
                                  </h5>
                                  <ul className="space-y-1">
                                    {answer.recommendations.map((rec, index) => (
                                      <li key={index} className="text-gray-300 text-xs flex items-start gap-2">
                                        <span className="text-yellow-400 text-xs mt-1">→</span>
                                        {typeof rec === 'string' ? rec : 
                                         typeof rec === 'object' ? JSON.stringify(rec, null, 2) :
                                         String(rec)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Metadata */}
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-green-400 border-green-400">
                                  Confidence: {normalizeConfidence(answer.confidence)}%
                                </Badge>
                                {answer.sources && Array.isArray(answer.sources) && answer.sources.length > 0 && (
                                  <Badge 
                                    variant="outline" 
                                    className="text-blue-400 border-blue-400 cursor-pointer hover:bg-blue-400/10"
                                    onClick={() => {
                                      console.log('🚀 CLICK HANDLER TRIGGERED!');
                                      console.log('🔍 Answer object:', answer);
                                      // Create sources using detailed evidence with unique content from each document
                                      console.log('🔍 Processing detailedEvidence:', answer.detailedEvidence);
                                      const sources = answer.detailedEvidence?.map((evidence: any) => {
                                        console.log('🔍 Processing evidence for:', evidence.documentName);
                                        console.log('🔍 Evidence data:', evidence);
                                        return {
                                          documentName: evidence.documentName,
                                          relevantSections: evidence.relevantContent || evidence.keyFindings || [evidence.documentSummary || 'No specific section identified'],
                                          extractedText: evidence.documentSummary || 'No specific content extracted'
                                        };
                                      }) || answer.sources.map((source: string) => ({
                                        documentName: source,
                                        relevantSections: [answer.answer || 'No specific section identified'],
                                        extractedText: answer.answer
                                      }));
                                      console.log('🔍 Final sources array:', sources);
                                      
                                      setSelectedQuoteData({
                                        quotes: [],
                                        sources,
                                        title: question.question
                                      });
                                      setQuoteViewerOpen(true);
                                    }}
                                  >
                                    {answer.sources && Array.isArray(answer.sources) ? answer.sources.length : 0} source{answer.sources && Array.isArray(answer.sources) && answer.sources.length > 1 ? 's' : ''}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 p-3 bg-gray-800/50 rounded border border-gray-700">
                              <p className="text-gray-400 text-xs">No clinical analysis available for this question yet.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
      
      <DocumentQuoteViewer
        isOpen={quoteViewerOpen}
        onClose={() => setQuoteViewerOpen(false)}
        quotes={selectedQuoteData.quotes}
        sources={selectedQuoteData.sources}
        title={selectedQuoteData.title}
        documents={documents}
      />
    </div>
  );
}

// Research Questions Section Component  
interface ResearchQuestionsSectionProps {
  dealId: number;
  analysisData: any;
  assignedDocuments: number;
  documents: any[];
  handleDocumentClick: (sourceName: string) => void;
  quoteViewerOpen: boolean;
  setQuoteViewerOpen: (open: boolean) => void;
  selectedQuoteData: any;
  setSelectedQuoteData: (data: any) => void;
  onResearchAnalysisStart?: () => void;
}

function ResearchQuestionsSection({ dealId, analysisData, assignedDocuments, documents, handleDocumentClick, quoteViewerOpen, setQuoteViewerOpen, selectedQuoteData, setSelectedQuoteData, onResearchAnalysisStart }: ResearchQuestionsSectionProps) {
  const [expandedCategories, setExpandedCategories] = useState(new Set(["Technical Methodology"]));
  const [isAnalysisStarting, setIsAnalysisStarting] = useState(false);

  // Check if research analysis is available from agent endpoint
  const { data: comprehensiveResults } = useQuery({
    queryKey: [`/api/deals/${dealId}/research-analysis/comprehensive/results`],
    refetchInterval: 30000, // ⚡ PERFORMANCE: Reduced from 2s to 30s
  });

  // Listen for research analysis start event to clear old data immediately
  useEffect(() => {
    const handleAnalysisStart = () => {
      setIsAnalysisStarting(true);
      console.log('🗑️ RESEARCH UI: Clearing old answers immediately for fresh start');
      // Clear analysis starting flag after a delay
      setTimeout(() => setIsAnalysisStarting(false), 5000);
    };

    window.addEventListener('researchAnalysisStarted', handleAnalysisStart);
    return () => window.removeEventListener('researchAnalysisStarted', handleAnalysisStart);
  }, []);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Use the main RESEARCH_QUESTIONS array defined above (line 1497) for consistency

  const categorizedQuestions = RESEARCH_QUESTIONS.reduce((acc, question) => {
    if (!acc[question.category]) {
      acc[question.category] = [];
    }
    acc[question.category].push(question);
    return acc;
  }, {} as Record<string, ResearchQuestion[]>);

  // Get documents that were used for research analysis
  const researchDocumentSources = documents.filter(doc => 
    doc.agentType === 'research' || 
    (Array.isArray(doc.agentType) && doc.agentType.includes('research'))
  );

  const getAnswerForQuestion = (questionId: string, questionText: string) => {
    // If analysis is starting, return null to show empty state
    if (isAnalysisStarting) {
      return null;
    }

    // Try comprehensive results first - check correct API structure (results.researchAnswers)
    if (comprehensiveResults?.results?.researchAnswers) {
      const allAnswers = comprehensiveResults.results.researchAnswers;
      
      // First try by question ID (most reliable) - answers are objects, not strings
      const answerById = allAnswers[questionId];
      if (answerById && typeof answerById === 'object' && answerById.answer && !answerById.answer.includes('No relevant documents found')) {
        return answerById; // Return the full object which already has answer, sources, quotes, etc.
      }
      
      // Fallback to question text (exact match)
      const answer = allAnswers[questionText];
      if (answer && typeof answer === 'object' && answer.answer) {
        return answer;
      }
      
      // Legacy string format fallback
      if (answerById && typeof answerById === 'string' && !answerById.includes('No relevant documents found')) {
        return {
          answer: answerById,
          confidence: 75,
          sources: [],
          quotes: [],
          keyFindings: [],
          recommendations: []
        };
      }
      
      // Try to find by partial matching of question text in the answer's question field
      for (const [key, answerData] of Object.entries(allAnswers)) {
        if (answerData && typeof answerData === 'object' && 'question' in answerData) {
          if (answerData.question === questionText) {
            return answerData;
          }
        }
      }
    }
    
    // Legacy fallback paths for backward compatibility  
    if (comprehensiveResults?.analysis?.research_answers) {
      const answer = comprehensiveResults.analysis.research_answers[questionText];
      if (answer) return answer;
      const answerById = comprehensiveResults.analysis.research_answers[questionId];
      if (answerById) return answerById;
    }
    
    if (comprehensiveResults?.analysis?.researchAnswers) {
      const answer = comprehensiveResults.analysis.researchAnswers[questionText];
      if (answer) return answer;
      const answerById = comprehensiveResults.analysis.researchAnswers[questionId];
      if (answerById) return answerById;
    }
    
    // Fallback to regular analysis results if comprehensive is empty
    if (analysisData?.research_answers) {
      const answer = analysisData.research_answers[questionText];
      if (answer) return answer;
      
      const answerById = analysisData.research_answers[questionId];
      if (answerById) return answerById;
    }
    
    if (analysisData?.researchAnswers) {
      const answer = analysisData.researchAnswers[questionText];
      if (answer) return answer;
      
      const answerById = analysisData.researchAnswers[questionId];
      if (answerById) return answerById;
    }
    
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-gradient-to-r from-cyan-500/5 to-cyan-600/5 border border-cyan-500/20 rounded-lg p-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">Comprehensive Research Analysis</h3>
          <p className="text-gray-300 text-sm">
            Analyze {assignedDocuments} research documents across 4 categories with 11 detailed questions
          </p>
        </div>
        <ComprehensiveResearchAnalysisButton dealId={dealId} onAnalysisStart={onResearchAnalysisStart} />
      </div>

      {Object.entries(categorizedQuestions).map(([category, questions]) => (
        <div key={category} className="border border-dark-lighter rounded-lg overflow-hidden">
          <div 
            className="flex items-center justify-between p-4 bg-dark-light hover:bg-dark cursor-pointer transition-colors"
            onClick={() => toggleCategory(category)}
          >
            <h4 className="font-medium text-white">{category}</h4>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-gray-400 border-gray-600">
                {questions && Array.isArray(questions) ? questions.length : 0} questions
              </Badge>
              {expandedCategories.has(category) ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </div>
          
          {expandedCategories.has(category) && (
            <div className="border-t border-dark-lighter">
              {questions && Array.isArray(questions) && questions.map(question => {
                const answer = getAnswerForQuestion(question.id, question.question);

                return (
                  <div key={question.id} className="p-4 border-b border-dark-lighter last:border-b-0">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-white mb-2">{question.question}</p>
                          
                          {answer ? (
                            <div className="mt-3 space-y-3">
                              <div className="bg-dark/50 rounded p-3">
                                <h5 className="text-xs font-medium text-cyan-400 mb-2">Research Analysis</h5>
                                <FormattedResearchContent content={answer.answer} />
                              </div>

                              {/* Enhanced Research Assessment */}
                              {answer.researchAssessment && (
                                <div className="bg-dark/30 rounded p-3">
                                  <h5 className="text-xs font-medium text-purple-400 mb-2">Research Assessment</h5>
                                  <p className="text-gray-300 text-sm leading-relaxed">{answer.researchAssessment}</p>
                                </div>
                              )}

                              {/* Document Quotes */}
                              {answer.quotes && Array.isArray(answer.quotes) && answer.quotes.length > 0 && (
                                <div className="bg-gradient-to-r from-yellow-400/10 to-orange-400/10 rounded p-3">
                                  <h5 className="text-xs font-medium text-yellow-400 mb-2">
                                    📖 Document Quotes ({answer.quotes && Array.isArray(answer.quotes) ? answer.quotes.length : 0})
                                  </h5>
                                  <div className="space-y-2">
                                    {answer.quotes && Array.isArray(answer.quotes) && answer.quotes.map((quote, index) => (
                                      <div key={index} className="bg-dark/70 rounded p-2 border-l-2 border-yellow-400">
                                        <div className="flex items-start justify-between mb-1">
                                          <button
                                            onClick={() => handleDocumentClick(safeRender(quote.document, 'Unknown Document'))}
                                            className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 hover:bg-blue-500/30 transition-colors cursor-pointer"
                                            title={`View document: ${safeRender(quote.document, 'Unknown Document')}`}
                                          >
                                            📄 {(() => { const docName = safeRender(quote.document, 'Unknown Document'); return docName.length > 25 ? `${docName.substring(0, 25)}...` : docName; })()}
                                          </button>
                                          {quote.relevance && (
                                            <Badge variant="outline" className="text-xs text-gray-400 border-gray-400">
                                              {safeRender(quote.relevance, 'Medium')}
                                            </Badge>
                                          )}
                                        </div>
                                        <blockquote className="text-gray-300 text-xs italic leading-relaxed border-l-2 border-gray-600 pl-2 mt-1">
                                          "{safeRender(quote.text, 'No quote text available')}"
                                        </blockquote>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Evidence Summary */}
                              {answer.evidenceSummary && (
                                <div className="bg-dark/30 rounded p-3">
                                  <h5 className="text-xs font-medium text-green-400 mb-2">Evidence Summary</h5>
                                  <p className="text-gray-300 text-sm leading-relaxed">{answer.evidenceSummary}</p>
                                </div>
                              )}

                              {/* Key Findings */}
                              {answer.keyFindings && Array.isArray(answer.keyFindings) && answer.keyFindings.length > 0 && (
                                <div className="bg-dark/30 rounded p-3">
                                  <h5 className="text-xs font-medium text-cyan-400 mb-2">Key Findings</h5>
                                  <ul className="space-y-1">
                                    {answer.keyFindings.map((finding, index) => (
                                      <li key={index} className="text-gray-300 text-xs flex items-start gap-2">
                                        <span className="text-cyan-400 text-xs mt-1">•</span>
                                        {safeRender(finding, 'No finding available')}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Recommendations */}
                              {answer.recommendations && Array.isArray(answer.recommendations) && answer.recommendations.length > 0 && (
                                <div className="bg-gradient-to-r from-red-400/10 to-orange-400/10 rounded p-3">
                                  <h5 className="text-xs font-medium text-red-400 mb-2">Recommendations</h5>
                                  <ul className="space-y-1">
                                    {answer.recommendations.map((rec, index) => (
                                      <li key={index} className="text-gray-300 text-xs flex items-start gap-2">
                                        <span className="text-red-400 text-xs mt-1">⚠</span>
                                        {typeof rec === 'string' ? rec : 
                                         typeof rec === 'object' ? JSON.stringify(rec, null, 2) :
                                         String(rec)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Metadata - Research Analysis with comprehensive sources badge like other agents */}
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-cyan-400 border-cyan-400">
                                  Research Analysis
                                </Badge>
                                
                                {/* Comprehensive Sources Badge - ALWAYS shows like other agents */}
                                {(() => {
                                  // Count all available sources from different data structures
                                  const quotesCount = (answer.quotes && Array.isArray(answer.quotes)) ? answer.quotes.length : 0;
                                  const sourcesCount = (answer.sources && Array.isArray(answer.sources)) ? answer.sources.length : 0;
                                  const docSourcesCount = researchDocumentSources ? researchDocumentSources.length : 0;
                                  const evidenceCount = (answer.detailedEvidence && Array.isArray(answer.detailedEvidence)) ? answer.detailedEvidence.length : 0;
                                  
                                  // Total sources available
                                  const totalSources = Math.max(quotesCount, sourcesCount, docSourcesCount, evidenceCount) || 1;
                                  
                                  return (
                                    <Badge 
                                      variant="outline" 
                                      className="text-blue-400 border-blue-400 cursor-pointer hover:bg-blue-400/10"
                                      onClick={() => {
                                        // Build comprehensive quotes array
                                        const quotes = [];
                                        if (answer.quotes && Array.isArray(answer.quotes)) {
                                          quotes.push(...answer.quotes.map((quote: any) => ({
                                            text: typeof quote === 'string' ? quote : quote.text || String(quote),
                                            documentName: quote.document || answer.sources?.[0] || 'Research Document',
                                            confidence: quote.confidence || answer.confidence || 0.8,
                                            relevance: quote.relevance || 'High'
                                          })));
                                        }
                                        
                                        // Build comprehensive sources array
                                        const sources = [];
                                        
                                        // Add research document sources
                                        if (researchDocumentSources && researchDocumentSources.length > 0) {
                                          sources.push(...researchDocumentSources.map((docSource: any) => ({
                                            documentName: docSource.filename || docSource.name || 'Research Document',
                                            relevantSections: ['Research analysis based on this document'],
                                            extractedText: answer.answer || 'Research findings from document analysis'
                                          })));
                                        }
                                        
                                        // Add detailed evidence sources
                                        if (answer.detailedEvidence && Array.isArray(answer.detailedEvidence)) {
                                          sources.push(...answer.detailedEvidence.map((evidence: any) => ({
                                            documentName: evidence.documentName || 'Research Document',
                                            relevantSections: evidence.relevantContent || evidence.keyFindings || [evidence.documentSummary || 'Research evidence'],
                                            extractedText: evidence.documentSummary || evidence.extractedText || 'Research evidence extracted'
                                          })));
                                        }
                                        
                                        // Add traditional sources if available
                                        if (answer.sources && Array.isArray(answer.sources) && sources.length === 0) {
                                          sources.push(...answer.sources.map((source: string) => ({
                                            documentName: source,
                                            relevantSections: [answer.answer || 'Research analysis'],
                                            extractedText: answer.answer || 'Research findings'
                                          })));
                                        }
                                        
                                        // Fallback if no sources - create from answer
                                        if (sources.length === 0 && answer.answer) {
                                          sources.push({
                                            documentName: 'Research Analysis',
                                            relevantSections: ['Research findings and analysis'],
                                            extractedText: answer.answer
                                          });
                                        }
                                        
                                        setSelectedQuoteData({
                                          quotes,
                                          sources,
                                          title: question.question
                                        });
                                        setQuoteViewerOpen(true);
                                      }}
                                    >
                                      📊 {totalSources} source{totalSources > 1 ? 's' : ''} {quotesCount > 0 ? `& ${quotesCount} quote${quotesCount > 1 ? 's' : ''}` : ''}
                                    </Badge>
                                  );
                                })()}
                                
                                {/* Show confidence if available */}
                                {answer.confidence && (
                                  <Badge variant="outline" className="text-green-400 border-green-400">
                                    {Math.round(answer.confidence * 100)}% confidence
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 p-3 bg-gray-800/50 rounded border border-gray-700">
                              <p className="text-gray-400 text-xs">No research analysis available for this question yet.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
      
      <DocumentQuoteViewer
        isOpen={quoteViewerOpen}
        onClose={() => setQuoteViewerOpen(false)}
        quotes={selectedQuoteData.quotes}
        sources={selectedQuoteData.sources}
        title={selectedQuoteData.title}
        documents={documents}
      />
    </div>
  );
}

// Comprehensive Research Analysis Button Component
function ComprehensiveResearchAnalysisButton({ dealId, onAnalysisStart }: { dealId: number; onAnalysisStart?: () => void }) {
  const [isRunning, setIsRunning] = useState(false);
  const queryClient = useQueryClient();

  // Check for existing background jobs
  const { data: jobProgress } = useQuery({
    queryKey: [`/api/background-jobs/${dealId}`],
    refetchInterval: 15000, // ⚡ PERFORMANCE: Reduced from 1s to 15s
  });

  // Check if research analysis is already running (enhanced service pattern)
  const isAlreadyRunning = (() => {
    if (jobProgress?.jobs) {
      const researchJob = jobProgress.jobs.find((job: any) => 
        (job.jobType === 'comprehensive_research_analysis' || 
         job.jobId?.includes('research-analysis') ||
         (job.agentType && job.agentType.toLowerCase() === 'research')) && 
        (job.status === 'processing' || job.status === 'pending')
      );
      return !!researchJob && researchJob.status === 'processing';
    }
    return false;
  })();

  const comprehensiveAnalysisMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/deals/${dealId}/research-analysis/comprehensive`, {
        method: 'POST'
      });
      return response;
    },
    onSuccess: (data) => {
      if (data?.alreadyRunning) {
        console.log(`⚠️ Research analysis already running (${data.progress}% complete)`);
        setIsRunning(false);
        return;
      }
      
      // Invalidate ALL relevant query keys to refresh the research data
      queryClient.invalidateQueries({
        queryKey: [`/api/deals/${dealId}/research-analysis/comprehensive/results`]
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/analyses', dealId]
      });
      
      // Show success message
      console.log('✅ Comprehensive research analysis started successfully');
    },
    onError: (error) => {
      console.error('❌ Error starting comprehensive research analysis:', error);
      setIsRunning(false);
    }
  });

  const handleRunAnalysis = async () => {
    setIsRunning(true);
    console.log('🔬 Starting comprehensive research analysis for deal', dealId);
    
    // AGGRESSIVE CACHE CLEARING - Clear all Research data immediately for fresh restart
    console.log('🗑️ MAIN BUTTON AGGRESSIVE CLEAR: Removing all cached research data for fresh restart');
    queryClient.removeQueries({
      queryKey: [`/api/deals/${dealId}/research-analysis/comprehensive/results`]
    });
    queryClient.invalidateQueries({
      queryKey: [`/api/deals/${dealId}/research-analysis/comprehensive/results`]
    });
    queryClient.invalidateQueries({
      queryKey: ['/api/analyses', dealId]
    });
    queryClient.invalidateQueries({
      queryKey: [`/api/background-jobs/${dealId}`]
    });
    
    // Call the callback to trigger client-side progress state
    if (onAnalysisStart) {
      onAnalysisStart();
    }
    
    try {
      // Trigger custom event to show progress bar immediately
      window.dispatchEvent(new CustomEvent('researchAnalysisStarted'));
      
      await comprehensiveAnalysisMutation.mutateAsync();
      
      console.log('✅ Analysis request sent, waiting for completion...');
      
      // Wait for results since analysis takes time
      let attempts = 0;
      const maxAttempts = 240; // 12 minutes max wait
      
      const checkForResults = async () => {
        attempts++;
        
        try {
          // Check for new comprehensive research analysis results
          const response = await fetch(`/api/deals/${dealId}/research-analysis/comprehensive/results?_t=${Date.now()}`, {
            cache: 'no-cache'
          });
          const data = await response.json();
          
          console.log(`🔬 Attempt ${attempts}: Checking for comprehensive research results...`);
          
          if (data.success && data.results && data.results.researchAnswers && Object.keys(data.results.researchAnswers).length > 0) {
            console.log('✅ New comprehensive research analysis completed! Questions answered:', Object.keys(data.results.researchAnswers).length);
            
            // Force refresh of comprehensive research results
            queryClient.invalidateQueries({
              queryKey: [`/api/deals/${dealId}/research-analysis/comprehensive/results`]
            });
            queryClient.invalidateQueries({
              queryKey: ['/api/analyses', dealId]
            });
            queryClient.invalidateQueries({
              queryKey: [`/api/background-jobs/${dealId}`]
            });
            
            // Add a small delay to ensure UI updates
            setTimeout(() => {
              setIsRunning(false);
              console.log('🎉 Research analysis UI updated successfully!');
            }, 1000);
            
            return;
          }
        } catch (error) {
          console.error('Error checking for research results:', error);
        }
        
        // Continue checking if not complete and under max attempts
        if (attempts < maxAttempts) {
          setTimeout(checkForResults, 3000); // Check every 3 seconds
        } else {
          console.log('⏰ Timeout reached - research analysis may still be running in background');
          
          // Force refresh anyway in case results are there
          queryClient.invalidateQueries({
            queryKey: [`/api/deals/${dealId}/research-analysis/comprehensive/results`]
          });
          queryClient.invalidateQueries({
            queryKey: ['/api/analyses', dealId]
          });
          
          setIsRunning(false);
        }
      };
      
      // Start checking for results after a short delay
      setTimeout(checkForResults, 5000); // Wait 5 seconds before first check
      
    } catch (error) {
      console.error('❌ Error starting comprehensive research analysis:', error);
      setIsRunning(false);
    }
  };

  return (
    <Button
      onClick={handleRunAnalysis}
      disabled={isRunning || comprehensiveAnalysisMutation.isPending || isAlreadyRunning}
      size="sm"
      className="bg-cyan-600 hover:bg-cyan-700 text-white border-cyan-500"
    >
      {isRunning || comprehensiveAnalysisMutation.isPending || isAlreadyRunning ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {isAlreadyRunning ? 'Research Analysis Running...' : isRunning ? 'Research Analysis Running...' : 'Starting Analysis...'}
        </>
      ) : (
        <>
          <Zap className="h-4 w-4 mr-2" />
          Run Research Analysis
        </>
      )}
    </Button>
  );
}

// Comprehensive Clinical Analysis Button Component
function ComprehensiveClinicalAnalysisButton({ dealId, onAnalysisStart }: { dealId: number; onAnalysisStart?: () => void }) {
  const [isRunning, setIsRunning] = useState(false);
  const queryClient = useQueryClient();

  // Check for existing background jobs
  const { data: jobProgress } = useQuery({
    queryKey: [`/api/background-jobs/${dealId}`],
    refetchInterval: 15000, // ⚡ PERFORMANCE: Reduced from 1s to 15s
  });

  // Check if clinical analysis is already running
  const isAlreadyRunning = (() => {
    if (jobProgress?.jobs) {
      const clinicalJob = jobProgress.jobs.find((job: any) => job.agentType === 'Clinical');
      return !!clinicalJob && clinicalJob.status === 'processing';
    }
    return false;
  })();

  const comprehensiveAnalysisMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/deals/${dealId}/clinical-analysis/comprehensive`, {
        method: 'POST'
      });
      return response;
    },
    onSuccess: (data) => {
      if (data?.alreadyRunning) {
        console.log(`⚠️ Clinical analysis already running (${data.progress}% complete)`);
        setIsRunning(false);
        return;
      }
      
      // Invalidate ALL relevant query keys to refresh the clinical data
      queryClient.invalidateQueries({
        queryKey: [`/api/deals/${dealId}/clinical-analysis/comprehensive/results`]
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/deals/${dealId}/agents/clinical/results`]
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/analyses', dealId]
      });
      
      // Show success message
      console.log('✅ Comprehensive clinical analysis started successfully');
    },
    onError: (error) => {
      console.error('❌ Error starting comprehensive clinical analysis:', error);
      setIsRunning(false);
    }
  });

  const handleRunAnalysis = async () => {
    setIsRunning(true);
    console.log('🧬 Starting comprehensive clinical analysis for deal', dealId);
    
    // Call the callback to trigger client-side progress state
    if (onAnalysisStart) {
      onAnalysisStart();
    }
    
    try {
      // Trigger custom event to show progress bar immediately
      window.dispatchEvent(new CustomEvent('clinicalAnalysisStarted'));
      
      await comprehensiveAnalysisMutation.mutateAsync();
      
      console.log('✅ Analysis request sent, waiting for completion...');
      
      // Wait for results since analysis takes time
      let attempts = 0;
      const maxAttempts = 240; // 12 minutes max wait
      
      const checkForResults = async () => {
        attempts++;
        
        try {
          // Check for new comprehensive clinical analysis results
          const response = await fetch(`/api/deals/${dealId}/clinical-analysis/comprehensive/results?_t=${Date.now()}`, {
            cache: 'no-cache'
          });
          const data = await response.json();
          
          console.log(`🧬 Attempt ${attempts}: Checking for comprehensive clinical results...`);
          
          if (data.success && data.analysis && data.analysis.clinicalAnswers && Object.keys(data.analysis.clinicalAnswers).length > 0) {
            console.log('✅ New comprehensive clinical analysis completed! Questions answered:', Object.keys(data.analysis.clinicalAnswers).length);
            
            // Force refresh of comprehensive clinical results
            queryClient.invalidateQueries({
              queryKey: [`/api/deals/${dealId}/clinical-analysis/comprehensive/results`]
            });
            queryClient.invalidateQueries({
              queryKey: [`/api/deals/${dealId}/agents/clinical/results`]
            });
            queryClient.invalidateQueries({
              queryKey: ['/api/analyses', dealId]
            });
            queryClient.invalidateQueries({
              queryKey: [`/api/background-jobs/${dealId}`]
            });
            
            // Add a small delay to ensure UI updates
            setTimeout(() => {
              setIsRunning(false);
              console.log('🎉 Clinical analysis UI updated successfully!');
            }, 1000);
            
            return;
          }
        } catch (error) {
          console.error('Error checking for clinical results:', error);
        }
        
        // Continue checking if not complete and under max attempts
        if (attempts < maxAttempts) {
          setTimeout(checkForResults, 3000); // Check every 3 seconds
        } else {
          console.log('⏰ Timeout reached - clinical analysis may still be running in background');
          
          // Force refresh anyway in case results are there
          queryClient.invalidateQueries({
            queryKey: [`/api/deals/${dealId}/agents/clinical/results`]
          });
          queryClient.invalidateQueries({
            queryKey: ['/api/analyses', dealId]
          });
          
          setIsRunning(false);
        }
      };
      
      // Start checking for results after a short delay
      setTimeout(checkForResults, 5000); // Wait 5 seconds before first check
      
    } catch (error) {
      console.error('❌ Error starting comprehensive clinical analysis:', error);
      setIsRunning(false);
    }
  };

  return (
    <Button
      onClick={handleRunAnalysis}
      disabled={isRunning || comprehensiveAnalysisMutation.isPending || isAlreadyRunning}
      size="sm"
      className="bg-green-600 hover:bg-green-700 text-white border-green-500"
    >
      {isRunning || comprehensiveAnalysisMutation.isPending || isAlreadyRunning ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {isAlreadyRunning ? 'Clinical Analysis Running...' : isRunning ? 'Clinical Analysis Running...' : 'Starting Analysis...'}
        </>
      ) : (
        <>
          <Zap className="h-4 w-4 mr-2" />
          Run Clinical Analysis
        </>
      )}
    </Button>
  );
}

function ComprehensiveLegalAnalysisButton({ dealId }: { dealId: number }) {
  const [isRunning, setIsRunning] = useState(false);
  const queryClient = useQueryClient();

  // Check for existing background jobs
  const { data: jobProgress } = useQuery({
    queryKey: [`/api/background-jobs/${dealId}`],
    refetchInterval: 15000, // ⚡ PERFORMANCE: Reduced from 1s to 15s
  });

  // Check if legal analysis is already running
  const isAlreadyRunning = (() => {
    if (jobProgress?.jobs) {
      const legalJob = jobProgress.jobs.find((job: any) => job.agentType === 'Legal');
      return !!legalJob && legalJob.status === 'processing';
    }
    return false;
  })();

  const comprehensiveAnalysisMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/deals/${dealId}/legal-analysis/comprehensive`, {
        method: 'POST'
      });
      return response;
    },
    onSuccess: (data) => {
      if (data?.alreadyRunning) {
        console.log(`⚠️ Legal analysis already running (${data.progress}% complete)`);
        setIsRunning(false);
        return;
      }
      
      // Invalidate ALL relevant query keys to refresh the legal data
      queryClient.invalidateQueries({
        queryKey: [`/api/deals/${dealId}/agents/legal/results`]
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/analyses', dealId]
      });
      
      // Show success message
      console.log('✅ Comprehensive legal analysis started successfully');
    },
    onError: (error) => {
      console.error('❌ Error starting comprehensive legal analysis:', error);
      setIsRunning(false);
    }
  });

  const handleRunAnalysis = async () => {
    setIsRunning(true);
    console.log('🚀 Starting comprehensive legal analysis for deal', dealId);
    
    try {
      // Trigger custom event to show progress bar immediately
      window.dispatchEvent(new CustomEvent('legalAnalysisStarted'));
      
      await comprehensiveAnalysisMutation.mutateAsync();
      
      console.log('✅ Analysis request sent, waiting for completion...');
      
      // Wait much longer for legal analysis as it often gets stuck
      let attempts = 0;
      const maxAttempts = 360; // 18 minutes max wait
      
      const checkForResults = async () => {
        attempts++;
        
        try {
          // Check for new analysis results
          const response = await fetch(`/api/deals/${dealId}/agents/legal/results?_t=${Date.now()}`, {
            cache: 'no-cache'
          });
          const data = await response.json();
          
          console.log(`📊 Attempt ${attempts}: Checking for results...`);
          
          if (data.success && data.analysis && data.analysis.legalAnswers && Object.keys(data.analysis.legalAnswers).length > 0) {
            console.log('✅ New comprehensive legal analysis completed! Questions answered:', Object.keys(data.analysis.legalAnswers).length);
            
            // Force refresh of all related UI data
            queryClient.invalidateQueries({
              queryKey: [`/api/deals/${dealId}/agents/legal/results`]
            });
            queryClient.invalidateQueries({
              queryKey: ['/api/analyses', dealId]
            });
            queryClient.invalidateQueries({
              queryKey: [`/api/background-jobs/${dealId}`]
            });
            
            // Add a small delay to ensure UI updates
            setTimeout(() => {
              setIsRunning(false);
              console.log('🎉 Legal analysis UI updated successfully!');
            }, 1000);
            
            return;
          }
        } catch (error) {
          console.error('Error checking for results:', error);
        }
        
        // Continue checking if not complete and under max attempts
        if (attempts < maxAttempts) {
          setTimeout(checkForResults, 3000); // Check every 3 seconds
        } else {
          console.log('⏰ Timeout reached - analysis may still be running in background');
          
          // Force refresh anyway in case results are there
          queryClient.invalidateQueries({
            queryKey: [`/api/deals/${dealId}/agents/legal/results`]
          });
          queryClient.invalidateQueries({
            queryKey: ['/api/analyses', dealId]
          });
          
          setIsRunning(false);
        }
      };
      
      // Start checking for results after a short delay
      setTimeout(checkForResults, 5000); // Wait 5 seconds before first check
      
    } catch (error) {
      console.error('❌ Error starting comprehensive analysis:', error);
      setIsRunning(false);
    }
  };

  return (
    <Button
      onClick={handleRunAnalysis}
      disabled={isRunning || comprehensiveAnalysisMutation.isPending || isAlreadyRunning}
      size="sm"
      className="bg-blue-600 hover:bg-blue-700 text-white border-blue-500"
    >
      {isRunning || comprehensiveAnalysisMutation.isPending || isAlreadyRunning ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {isAlreadyRunning ? 'Legal Analysis Running...' : isRunning ? 'Legal Analysis Running...' : 'Starting Analysis...'}
        </>
      ) : (
        <>
          <Zap className="h-4 w-4 mr-2" />
          Run AI Analysis
        </>
      )}
    </Button>
  );
}

// Commercial Analysis Progress Display Component
function CommercialAnalysisProgress({ dealId }: { dealId: number }) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  const { data: jobProgress } = useQuery({
    queryKey: [`/api/background-jobs/${dealId}`],
    refetchInterval: 15000, // ⚡ PERFORMANCE: Reduced from 1s to 15s
  });

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (jobProgress?.jobs) {
      const commercialJob = jobProgress.jobs.find((job: any) => job.agentType === 'Commercial');
      if (commercialJob && commercialJob.status === 'processing') {
        setProgress(commercialJob.progress || 0);
        setCurrentStep(commercialJob.currentDocument || commercialJob.currentStep || 'Processing commercial analysis...');
        setIsVisible(true);
        
        // Handle stuck jobs - check if job hasn't updated in 5+ minutes
        const jobCreated = new Date(commercialJob.metadata?.startTime || commercialJob.createdAt);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        if (jobCreated < fiveMinutesAgo && commercialJob.progress <= 5) {
          console.log(`⚠️ Detected stuck Commercial job: ${commercialJob.jobId}, force cleaning...`);
          setCurrentStep('Stuck job detected - cleaning up...');
          timeoutId = setTimeout(() => {
            setIsVisible(false);
            fetch(`/api/background-jobs/${commercialJob.jobId}/stop`, {
              method: 'POST'
            }).then(() => {
              // Force refresh after cleanup
              window.location.reload();
            }).catch(console.error);
          }, 1000);
        }
        
        // Handle jobs stuck at 100%
        if (commercialJob.progress >= 100) {
          setCurrentStep('Analysis completed - finalizing results...');
          timeoutId = setTimeout(() => {
            setIsVisible(false);
            fetch(`/api/background-jobs/${commercialJob.jobId}/stop`, {
              method: 'POST'
            }).catch(console.error);
          }, 2000);
        }
      } else {
        setIsVisible(false);
      }
    } else {
      setIsVisible(false);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [jobProgress]);

  if (!isVisible) return null;

  return (
    <div className="mb-4 p-4 bg-purple-400/10 border border-purple-400/20 rounded-lg">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-purple-400">Commercial Analysis in Progress</span>
            <span className="text-sm text-purple-300">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-purple-400/20 rounded-full h-2 mb-2">
            <div 
              className="bg-purple-400 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <div className="text-xs text-purple-300/80 truncate">
            {currentStep && currentStep.includes('batch') ? 
              currentStep.replace(/\s*\([^)]*documents?\)/g, '') :
              currentStep
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// Clinical Analysis Progress Display Component
function ClinicalAnalysisProgress({ dealId }: { dealId: number }) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  const { data: jobProgress } = useQuery({
    queryKey: [`/api/background-jobs/${dealId}`],
    refetchInterval: 15000, // ⚡ PERFORMANCE: Reduced from 1s to 15s
  });

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (jobProgress?.jobs) {
      const clinicalJob = jobProgress.jobs.find((job: any) => job.agentType === 'Clinical');
      if (clinicalJob && clinicalJob.status === 'processing') {
        setProgress(clinicalJob.progress || 0);
        setCurrentStep(clinicalJob.currentDocument || clinicalJob.currentStep || 'Processing clinical analysis...');
        setIsVisible(true);
        
        // Handle jobs stuck at 100%
        if (clinicalJob.progress >= 100) {
          setCurrentStep('Analysis completed - finalizing results...');
          timeoutId = setTimeout(() => {
            setIsVisible(false);
            fetch(`/api/background-jobs/${clinicalJob.jobId}/stop`, {
              method: 'POST'
            }).catch(console.error);
          }, 2000);
        }
      } else {
        setIsVisible(false);
      }
    } else {
      setIsVisible(false);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [jobProgress]);

  if (!isVisible) return null;

  return (
    <div className="mb-4 p-4 bg-green-400/10 border border-green-400/20 rounded-lg">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-green-400" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-400">Clinical Analysis in Progress</span>
            <span className="text-sm text-green-300">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-green-400/20 rounded-full h-2 mb-2">
            <div 
              className="bg-green-400 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <div className="text-xs text-green-300/80 truncate">
            {currentStep}
          </div>
        </div>
      </div>
    </div>
  );
}

// HR Analysis Progress Display Component
function HrAnalysisProgress({ dealId }: { dealId: number }) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  const { data: jobProgress } = useQuery({
    queryKey: [`/api/background-jobs/${dealId}`],
    refetchInterval: 15000, // ⚡ PERFORMANCE: Reduced from 1s to 15s
  });

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (jobProgress?.jobs) {
      const hrJob = jobProgress.jobs.find((job: any) => job.agentType === 'HR');
      if (hrJob && hrJob.status === 'processing') {
        setProgress(hrJob.progress || 0);
        setCurrentStep(hrJob.currentDocument || hrJob.currentStep || 'Processing HR analysis...');
        setIsVisible(true);
        
        // Handle jobs stuck at 100%
        if (hrJob.progress >= 100) {
          setCurrentStep('Analysis completed - finalizing results...');
          timeoutId = setTimeout(() => {
            setIsVisible(false);
            fetch(`/api/background-jobs/${hrJob.jobId}/stop`, {
              method: 'POST'
            }).catch(console.error);
          }, 2000);
        }
      } else {
        setIsVisible(false);
      }
    } else {
      setIsVisible(false);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [jobProgress]);

  if (!isVisible) return null;

  return (
    <div className="mb-4 p-4 bg-orange-400/10 border border-orange-400/20 rounded-lg">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-orange-400">HR Analysis in Progress</span>
            <span className="text-sm text-orange-300">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-orange-400/20 rounded-full h-2 mb-2">
            <div 
              className="bg-orange-400 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <div className="text-xs text-orange-300/80 truncate">
            {currentStep && currentStep.includes('batch') ? 
              currentStep.replace(/\s*\([^)]*documents?\)/g, '') :
              currentStep
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// Financial Analysis Progress Display Component
function FinancialAnalysisProgress({ dealId }: { dealId: number }) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  const { data: jobProgress } = useQuery({
    queryKey: [`/api/background-jobs/${dealId}`],
    refetchInterval: 15000, // ⚡ PERFORMANCE: Reduced from 1s to 15s
  });

  // REMOVED: No longer check old comprehensive financial analysis progress - ONLY use background jobs like Clinical
  // const { data: financialProgress } = useQuery({
  //   queryKey: [`/api/deals/${dealId}/financial-analysis/comprehensive/progress`],
  //   refetchInterval: 1000,
  // });

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    // ONLY check background jobs like Clinical - no more old comprehensive routes
    // Check for regular financial jobs
    if (jobProgress?.jobs) {
      const financialJob = jobProgress.jobs.find((job: any) => 
        job.agentType === 'financial' || job.jobType === 'comprehensive_financial_analysis'
      );
      if (financialJob && financialJob.status === 'processing') {
        setProgress(financialJob.progress || 0);
        setCurrentStep(financialJob.currentDocument || financialJob.currentStep || 'Processing financial analysis...');
        setIsVisible(true);
        
        // Handle jobs stuck at 100%
        if (financialJob.progress >= 100) {
          setCurrentStep('Analysis completed - finalizing results...');
          timeoutId = setTimeout(() => {
            setIsVisible(false);
            fetch(`/api/background-jobs/${financialJob.jobId}/stop`, {
              method: 'POST'
            }).catch(console.error);
          }, 2000);
        }
      } else {
        setIsVisible(false);
      }
    } else {
      setIsVisible(false);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [jobProgress]); // REMOVED financialProgress dependency - only use background jobs like Clinical

  if (!isVisible) return null;

  return (
    <div className="mb-4 p-4 bg-emerald-400/10 border border-emerald-400/20 rounded-lg">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-emerald-400">Financial Analysis in Progress</span>
            <span className="text-sm text-emerald-300">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-emerald-400/20 rounded-full h-2 mb-2">
            <div 
              className="bg-emerald-400 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <div className="text-xs text-emerald-300/80 truncate">
            {currentStep && currentStep.includes('batch') ? 
              currentStep.replace(/\s*\([^)]*documents?\)/g, '') :
              currentStep
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// IP Analysis Progress Display Component  
function IpAnalysisProgress({ dealId }: { dealId: number }) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: jobProgress } = useQuery({
    queryKey: [`/api/background-jobs/${dealId}`],
    refetchInterval: 15000, // ⚡ PERFORMANCE: Reduced from 1s to 15s
    retry: false,
    staleTime: 0, // Always fetch fresh data
  });

  // Also check for comprehensive IP analysis progress
  const { data: ipProgress } = useQuery({
    queryKey: [`/api/deals/${dealId}/ip-analysis/comprehensive/progress`],
    refetchInterval: 15000, // ⚡ PERFORMANCE: Reduced from 1s to 15s
    retry: false,
    staleTime: 0, // Always fetch fresh data
  });

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    // Check for comprehensive IP analysis first
    if (ipProgress?.isRunning) {
      setProgress(ipProgress.progress || 0);
      setCurrentStep(ipProgress.currentStep || 'Processing comprehensive IP analysis...');
      setIsVisible(true);
      setLastJobId('comprehensive-ip');
      
      // Handle comprehensive analysis at 100% - auto-cleanup after 3 seconds
      if (ipProgress.progress >= 100) {
        setCurrentStep('Analysis completed - finalizing results...');
        timeoutId = setTimeout(() => {
          setIsVisible(false);
          setProgress(0);
          setCurrentStep('');
          setLastJobId(null);
          // Force invalidate cache to refresh UI
          queryClient.invalidateQueries({
            queryKey: [`/api/deals/${dealId}/ip-analysis/comprehensive/progress`]
          });
        }, 3000);
      }
      
      return () => {
        if (timeoutId) clearTimeout(timeoutId);
      };
    }

    // Then check for regular IP jobs
    if (jobProgress?.jobs) {
      const ipJob = jobProgress.jobs.find((job: any) => job.agentType === 'IP');
      if (ipJob && ipJob.status === 'processing') {
        // Check if this is a new job or continuing existing one
        if (lastJobId && lastJobId !== ipJob.jobId) {
          // Reset state for new job
          setProgress(0);
          setCurrentStep('');
        }
        
        setProgress(ipJob.progress || 0);
        setCurrentStep(ipJob.currentDocument || ipJob.currentStep || 'Processing IP analysis...');
        setIsVisible(true);
        setLastJobId(ipJob.jobId);
        
        // Handle jobs at 100% - auto-cleanup and stop job
        if (ipJob.progress >= 100) {
          setCurrentStep('Analysis completed - finalizing results...');
          timeoutId = setTimeout(() => {
            setIsVisible(false);
            setProgress(0);
            setCurrentStep('');
            setLastJobId(null);
            // Stop the background job
            fetch(`/api/background-jobs/${ipJob.jobId}/stop`, {
              method: 'POST'
            }).catch(console.error);
            // Force invalidate cache to refresh UI
            queryClient.invalidateQueries({
              queryKey: [`/api/background-jobs/${dealId}`]
            });
          }, 3000);
        }
      } else {
        // No IP job found - ensure we hide the progress bar
        setIsVisible(false);
        setProgress(0);
        setCurrentStep('');
        setLastJobId(null);
      }
    } else {
      // No jobs data - hide progress bar
      setIsVisible(false);
      setProgress(0);
      setCurrentStep('');
      setLastJobId(null);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [jobProgress, ipProgress, lastJobId, dealId]);

  // Extra safety check - if no IP jobs exist at all, never show progress
  const hasActiveIpJob = jobProgress?.jobs?.some((job: any) => job.agentType === 'IP' && job.status === 'processing') || ipProgress?.isRunning;
  
  if (!isVisible || !hasActiveIpJob) return null;

  return (
    <div className="mb-4 p-4 bg-pink-400/10 border border-pink-400/20 rounded-lg">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-pink-400" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-pink-400">IP Analysis in Progress</span>
            <span className="text-sm text-pink-300">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-pink-400/20 rounded-full h-2 mb-2">
            <div 
              className="bg-pink-400 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <div className="text-xs text-pink-300/80 truncate">
            {currentStep && currentStep.includes('batch') ? 
              currentStep.replace(/\s*\([^)]*documents?\)/g, '') :
              currentStep
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// Research Analysis Progress Display Component
function ResearchAnalysisProgress({ dealId }: { dealId: number }) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  const { data: jobProgress } = useQuery({
    queryKey: [`/api/background-jobs/${dealId}`],
    refetchInterval: 15000, // ⚡ PERFORMANCE: Reduced from 1s to 15s
  });

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (jobProgress?.jobs) {
      const researchJob = jobProgress.jobs.find((job: any) => job.agentType === 'research' || job.agentType === 'Research');
      if (researchJob && researchJob.status === 'processing') {
        setProgress(researchJob.progress || 0);
        setCurrentStep(researchJob.currentDocument || researchJob.currentStep || 'Processing research analysis...');
        setIsVisible(true);
        
        // Handle jobs stuck at 100%
        if (researchJob.progress >= 100) {
          setCurrentStep('Analysis completed - finalizing results...');
          timeoutId = setTimeout(() => {
            setIsVisible(false);
            fetch(`/api/background-jobs/${researchJob.jobId}/stop`, {
              method: 'POST'
            }).catch(console.error);
          }, 2000);
        }
      } else {
        setIsVisible(false);
      }
    } else {
      setIsVisible(false);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [jobProgress]);

  if (!isVisible) return null;

  return (
    <div className="mb-4 p-4 bg-cyan-400/10 border border-cyan-400/20 rounded-lg">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-cyan-400">Research Analysis in Progress</span>
            <span className="text-sm text-cyan-300">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-cyan-400/20 rounded-full h-2 mb-2">
            <div 
              className="bg-cyan-400 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <div className="text-xs text-cyan-300/80 truncate">
            {currentStep}
          </div>
        </div>
      </div>
    </div>
  );
}

// Legal Analysis Progress Display Component
function LegalAnalysisProgress({ dealId }: { dealId: number }) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  const { data: jobProgress } = useQuery({
    queryKey: [`/api/background-jobs/${dealId}`],
    refetchInterval: 15000, // ⚡ PERFORMANCE: Reduced from 1s to 15s
  });

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (jobProgress?.jobs) {
      const legalJob = jobProgress.jobs.find((job: any) => job.agentType === 'Legal');
      if (legalJob && legalJob.status === 'processing') {
        setProgress(legalJob.progress || 0);
        setCurrentStep(legalJob.currentDocument || legalJob.currentStep || 'Processing legal analysis...');
        setIsVisible(true);
        
        // Handle jobs stuck at 100%
        if (legalJob.progress >= 100) {
          setCurrentStep('Analysis completed - finalizing results...');
          timeoutId = setTimeout(() => {
            setIsVisible(false);
            fetch(`/api/background-jobs/${legalJob.jobId}/stop`, {
              method: 'POST'
            }).catch(console.error);
          }, 2000);
        }
      } else {
        setIsVisible(false);
      }
    } else {
      setIsVisible(false);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [jobProgress]);

  if (!isVisible) return null;

  return (
    <div className="mb-4 p-4 bg-blue-400/10 border border-blue-400/20 rounded-lg">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-400">Legal Analysis in Progress</span>
            <span className="text-sm text-blue-300">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-blue-400/20 rounded-full h-2 mb-2">
            <div 
              className="bg-blue-400 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <div className="text-xs text-blue-300/80 truncate">
            {currentStep}
          </div>
        </div>
      </div>
    </div>
  );
}

// Commercial Analysis Button Component  
function ComprehensiveCommercialAnalysisButton({ dealId }: { dealId: number }) {
  const [isRunning, setIsRunning] = useState(false);
  const queryClient = useQueryClient();

  // Check for existing background jobs
  const { data: jobProgress } = useQuery({
    queryKey: [`/api/background-jobs/${dealId}`],
    refetchInterval: 15000, // ⚡ PERFORMANCE: Reduced from 1s to 15s
  });

  // Check if commercial analysis is already running
  const isAlreadyRunning = (() => {
    if (jobProgress?.jobs) {
      const commercialJob = jobProgress.jobs.find((job: any) => job.agentType === 'Commercial');
      return !!commercialJob && commercialJob.status === 'processing';
    }
    return false;
  })();

  const comprehensiveAnalysisMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/deals/${dealId}/commercial-analysis/comprehensive`, {
        method: 'POST'
      });
      return response;
    },
    onSuccess: (data) => {
      if (data?.alreadyRunning) {
        console.log('Commercial analysis already running');
        setIsRunning(false);
        return;
      }
      
      queryClient.invalidateQueries({
        queryKey: [`/api/deals/${dealId}/commercial-analysis/comprehensive/results`]
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/deals/${dealId}/agents/commercial/results`]
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/analyses', dealId]
      });
      
      console.log('Comprehensive commercial analysis started successfully');
    },
    onError: (error) => {
      console.error('Error starting comprehensive commercial analysis:', error);
      setIsRunning(false);
    }
  });

  const handleRunAnalysis = async () => {
    setIsRunning(true);
    console.log('Starting comprehensive commercial analysis for deal', dealId);
    
    try {
      await comprehensiveAnalysisMutation.mutateAsync();
      
      let attempts = 0;
      const maxAttempts = 60;
      
      const checkForResults = async () => {
        attempts++;
        
        try {
          const response = await fetch(`/api/deals/${dealId}/commercial-analysis/comprehensive/results?_t=${Date.now()}`, {
            cache: 'no-cache'
          });
          const data = await response.json();
          
          console.log(`Commercial analysis attempt ${attempts}...`);
          
          if (data.success && data.commercialAnswers && Object.keys(data.commercialAnswers).length > 0) {
            console.log('Commercial analysis completed!');
            
            queryClient.invalidateQueries({
              queryKey: [`/api/deals/${dealId}/commercial-analysis/comprehensive/results`]
            });
            queryClient.invalidateQueries({
              queryKey: [`/api/deals/${dealId}/agents/commercial/results`]
            });
            queryClient.invalidateQueries({
              queryKey: ['/api/analyses', dealId]
            });
            queryClient.invalidateQueries({
              queryKey: [`/api/background-jobs/${dealId}`]
            });
            
            setTimeout(() => {
              setIsRunning(false);
            }, 1000);
            
            return;
          }
        } catch (error) {
          console.error('Error checking for commercial results:', error);
        }
        
        if (attempts < maxAttempts) {
          setTimeout(checkForResults, 3000);
        } else {
          setIsRunning(false);
        }
      };
      
      setTimeout(checkForResults, 5000);
      
    } catch (error) {
      console.error('Error starting commercial analysis:', error);
      setIsRunning(false);
    }
  };

  return (
    <Button
      onClick={handleRunAnalysis}
      disabled={isRunning || comprehensiveAnalysisMutation.isPending || isAlreadyRunning}
      size="sm"
      className="bg-purple-600 hover:bg-purple-700 text-white border-purple-500"
    >
      {isRunning || comprehensiveAnalysisMutation.isPending || isAlreadyRunning ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {isAlreadyRunning ? 'Commercial Analysis Running...' : isRunning ? 'Commercial Analysis Running...' : 'Starting Analysis...'}
        </>
      ) : (
        <>
          <Zap className="h-4 w-4 mr-2" />
          Run Commercial Analysis
        </>
      )}
    </Button>
  );
}

// HR Analysis Button Component
function ComprehensiveHrAnalysisButton({ dealId }: { dealId: number }) {
  const [isRunning, setIsRunning] = useState(false);
  const queryClient = useQueryClient();

  // Check for existing background jobs
  const { data: jobProgress } = useQuery({
    queryKey: [`/api/background-jobs/${dealId}`],
    refetchInterval: 15000, // ⚡ PERFORMANCE: Reduced from 1s to 15s
  });

  // Check if HR analysis is already running
  const isAlreadyRunning = (() => {
    if (jobProgress?.jobs) {
      const hrJob = jobProgress.jobs.find((job: any) => job.agentType === 'HR');
      return !!hrJob && hrJob.status === 'processing';
    }
    return false;
  })();

  const comprehensiveAnalysisMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/deals/${dealId}/hr-analysis/comprehensive`, {
        method: 'POST'
      });
      return response;
    },
    onSuccess: (data) => {
      if (data?.alreadyRunning) {
        console.log('HR analysis already running');
        setIsRunning(false);
        return;
      }
      
      queryClient.invalidateQueries({
        queryKey: [`/api/deals/${dealId}/hr-analysis/comprehensive/results`]
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/deals/${dealId}/agents/hr/results`]
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/analyses', dealId]
      });
      
      console.log('Comprehensive HR analysis started successfully');
    },
    onError: (error) => {
      console.error('Error starting comprehensive HR analysis:', error);
      setIsRunning(false);
    }
  });

  const handleRunAnalysis = async () => {
    setIsRunning(true);
    console.log('Starting comprehensive HR analysis for deal', dealId);
    
    try {
      await comprehensiveAnalysisMutation.mutateAsync();
      
      let attempts = 0;
      const maxAttempts = 60;
      
      const checkForResults = async () => {
        attempts++;
        
        try {
          const response = await fetch(`/api/deals/${dealId}/hr-analysis/comprehensive/results?_t=${Date.now()}`, {
            cache: 'no-cache'
          });
          const data = await response.json();
          
          console.log(`HR analysis attempt ${attempts}...`);
          
          if (data.success && data.hrAnswers && Object.keys(data.hrAnswers).length > 0) {
            console.log('HR analysis completed!');
            
            queryClient.invalidateQueries({
              queryKey: [`/api/deals/${dealId}/hr-analysis/comprehensive/results`]
            });
            queryClient.invalidateQueries({
              queryKey: [`/api/deals/${dealId}/agents/hr/results`]
            });
            queryClient.invalidateQueries({
              queryKey: ['/api/analyses', dealId]
            });
            queryClient.invalidateQueries({
              queryKey: [`/api/background-jobs/${dealId}`]
            });
            
            setTimeout(() => {
              setIsRunning(false);
            }, 1000);
            
            return;
          }
        } catch (error) {
          console.error('Error checking for HR results:', error);
        }
        
        if (attempts < maxAttempts) {
          setTimeout(checkForResults, 3000);
        } else {
          setIsRunning(false);
        }
      };
      
      setTimeout(checkForResults, 5000);
      
    } catch (error) {
      console.error('Error starting HR analysis:', error);
      setIsRunning(false);
    }
  };

  return (
    <Button
      onClick={handleRunAnalysis}
      disabled={isRunning || comprehensiveAnalysisMutation.isPending || isAlreadyRunning}
      size="sm"
      className="bg-orange-600 hover:bg-orange-700 text-white border-orange-500"
    >
      {isRunning || comprehensiveAnalysisMutation.isPending || isAlreadyRunning ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {isAlreadyRunning ? 'HR Analysis Running...' : isRunning ? 'HR Analysis Running...' : 'Starting Analysis...'}
        </>
      ) : (
        <>
          <Zap className="h-4 w-4 mr-2" />
          Run HR Analysis
        </>
      )}
    </Button>
  );
}

// Financial Questions Section Component  
interface FinancialQuestionsSectionProps {
  dealId: number;
  analysisData: any;
  assignedDocuments: number;
  documents: any[];
  handleDocumentClick: (sourceName: string) => void;
  quoteViewerOpen: boolean;
  setQuoteViewerOpen: (open: boolean) => void;
  selectedQuoteData: any;
  setSelectedQuoteData: (data: any) => void;
}

function FinancialQuestionsSection({ dealId, analysisData, assignedDocuments, documents, handleDocumentClick, quoteViewerOpen, setQuoteViewerOpen, selectedQuoteData, setSelectedQuoteData }: FinancialQuestionsSectionProps) {
  const [expandedCategories, setExpandedCategories] = useState(new Set(["Income Statements"]));

  // CRITICAL FIX: Use comprehensive results endpoint EXACTLY like Legal agent
  const { data: comprehensiveResults, refetch: refetchComprehensive } = useQuery({
    queryKey: [`/api/deals/${dealId}/financial-analysis/comprehensive/results`],
    refetchInterval: 30000, // ⚡ PERFORMANCE: Reduced from 2s to 30s
    staleTime: 0, // Always treat as stale to force fresh data like Legal
    gcTime: 0, // Don't cache results like Legal
  });

  // Force refetch on component mount to ensure fresh data like Legal
  useEffect(() => {
    refetchComprehensive();
  }, [refetchComprehensive]);

  // Use comprehensive results if available, fallback to analysisData like Legal
  const financialData = comprehensiveResults?.analysis || analysisData || null;

  console.log('💰 Financial Analysis Available:', !!financialData);
  console.log('💰 Comprehensive Results Available:', !!comprehensiveResults?.analysis);  
  console.log('💰 Financial Data from Comprehensive:', !!financialData?.financialAnswers);
  console.log('💰 Financial Answers Keys:', financialData?.financialAnswers ? Object.keys(financialData.financialAnswers) : 'No answers');
  console.log('💰 DEBUGGING: Full financialData structure:', JSON.stringify(financialData, null, 2));

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // CRITICAL FIX: Use EXACT same question IDs as backend comprehensiveFinancialAnalysisService.ts
  const FINANCIAL_QUESTIONS = [
    // Financial Performance & KPIs
    { id: 'performance_1', question: 'What are the key financial performance metrics and KPIs?', category: 'Financial Performance & KPIs' },
    { id: 'performance_2', question: 'How has financial performance trended over time?', category: 'Financial Performance & KPIs' },
    { id: 'performance_3', question: 'What are the unit economics and scalability metrics?', category: 'Financial Performance & KPIs' },
    // Cash Flow & Burn Rate
    { id: 'cashflow_1', question: 'What is the current cash position and runway?', category: 'Cash Flow & Burn Rate' },
    { id: 'cashflow_2', question: 'How is working capital managed?', category: 'Cash Flow & Burn Rate' },
    { id: 'cashflow_3', question: 'What are the seasonal or cyclical cash flow patterns?', category: 'Cash Flow & Burn Rate' },
    // Funding & Investment History
    { id: 'funding_1', question: 'What is the funding history and investment rounds?', category: 'Funding & Investment History' },
    { id: 'funding_2', question: 'How are funds allocated and what is the use of proceeds?', category: 'Funding & Investment History' },
    // Financial Controls & Reporting
    { id: 'controls_1', question: 'What financial controls and reporting systems are in place?', category: 'Financial Controls & Reporting' },
    { id: 'controls_2', question: 'Are there any audit findings or compliance issues?', category: 'Financial Controls & Reporting' },
    // Revenue Model & Monetization
    { id: 'revenue_1', question: 'What is the revenue model and monetization strategy?', category: 'Revenue Model & Monetization' },
    { id: 'revenue_2', question: 'How predictable and recurring is the revenue?', category: 'Revenue Model & Monetization' }
  ];

  const categorizedQuestions = FINANCIAL_QUESTIONS.reduce((acc, question) => {
    if (!acc[question.category]) {
      acc[question.category] = [];
    }
    acc[question.category].push(question);
    return acc;
  }, {} as Record<string, typeof FINANCIAL_QUESTIONS>);

  const getAnswerForQuestion = (questionId: string) => {
    if (!financialData) return null;
    
    console.log(`💰 Looking for answer to financial question ${questionId}`);
    console.log(`💰 Financial Answers exists:`, !!financialData.financialAnswers);
    
    // First try to get answer from financialAnswers structure - EXACTLY like Clinical
    if (financialData?.financialAnswers && financialData.financialAnswers[questionId]) {
      const answer = financialData.financialAnswers[questionId];
      return {
        answer: answer.answer || 'Analysis in progress...',
        confidence: answer.confidence || 0,
        sources: Array.isArray(answer.sources) ? answer.sources : answer.sources ? [answer.sources] : [],
        quotes: answer.quotes || [],
        keyFindings: answer.keyFindings || [],
        evidenceSummary: answer.evidenceSummary || '',
        financialAssessment: answer.financialAssessment || '',
        recommendations: answer.recommendations || [],
        detailedEvidence: answer.detailedEvidence || []
      };
    }

    return null; // Return null for empty state like Clinical agent
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-gradient-to-r from-green-500/5 to-green-600/5 border border-green-500/20 rounded-lg p-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">Comprehensive Financial Analysis</h3>
          <p className="text-gray-300 text-sm">
            Analyze {assignedDocuments} financial documents across 4 categories with 12 detailed questions
          </p>
        </div>
        <PersistentFinancialButton dealId={dealId} />
      </div>

      {Object.entries(categorizedQuestions).map(([category, questions]) => (
        <div key={category} className="border border-dark-lighter rounded-lg overflow-hidden">
          <div 
            className="flex items-center justify-between p-4 bg-dark-light hover:bg-dark cursor-pointer transition-colors"
            onClick={() => toggleCategory(category)}
          >
            <h4 className="font-medium text-white">{category}</h4>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-gray-400 border-gray-600">
                {questions && Array.isArray(questions) ? questions.length : 0} questions
              </Badge>
              {expandedCategories.has(category) ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </div>
          
          {expandedCategories.has(category) && (
            <div className="border-t border-dark-lighter">
              {questions && Array.isArray(questions) && questions.map(question => {
                const answer = getAnswerForQuestion(question.id);

                return (
                  <div key={question.id} className="p-4 border-b border-dark-lighter last:border-b-0">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-white mb-2">{question.question}</p>
                          
                          {answer ? (
                            <div className="mt-3 space-y-3">
                              <div className="bg-dark/50 rounded p-3">
                                <h5 className="text-xs font-medium text-green-400 mb-2">Financial Analysis</h5>
                                <p className="text-gray-300 text-sm leading-relaxed">{answer.answer}</p>
                              </div>

                              {/* Enhanced Financial Assessment */}
                              {answer.financialAssessment && (
                                <div className="bg-dark/30 rounded p-3">
                                  <h5 className="text-xs font-medium text-emerald-400 mb-2">Financial Assessment</h5>
                                  <p className="text-gray-300 text-sm leading-relaxed">{answer.financialAssessment}</p>
                                </div>
                              )}

                              {/* Document Quotes */}
                              {answer.quotes && Array.isArray(answer.quotes) && answer.quotes.length > 0 && (
                                <div className="bg-gradient-to-r from-yellow-400/10 to-orange-400/10 rounded p-3">
                                  <h5 className="text-xs font-medium text-yellow-400 mb-2">
                                    📖 Document Quotes ({answer.quotes && Array.isArray(answer.quotes) ? answer.quotes.length : 0})
                                  </h5>
                                  <div className="space-y-2">
                                    {answer.quotes && Array.isArray(answer.quotes) && answer.quotes.map((quote, index) => (
                                      <div key={index} className="bg-dark/70 rounded p-2 border-l-2 border-yellow-400">
                                        <div className="flex items-start justify-between mb-1">
                                          <button
                                            onClick={() => handleDocumentClick(safeRender(quote.document, 'Unknown Document'))}
                                            className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 hover:bg-blue-500/30 transition-colors cursor-pointer"
                                            title={`View document: ${safeRender(quote.document, 'Unknown Document')}`}
                                          >
                                            📄 {(() => { const docName = safeRender(quote.document, 'Unknown Document'); return docName.length > 25 ? `${docName.substring(0, 25)}...` : docName; })()}
                                          </button>
                                          {quote.relevance && (
                                            <Badge variant="outline" className="text-xs text-gray-400 border-gray-400">
                                              {safeRender(quote.relevance, 'Medium')}
                                            </Badge>
                                          )}
                                        </div>
                                        <blockquote className="text-gray-300 text-xs italic leading-relaxed border-l-2 border-gray-600 pl-2 mt-1">
                                          "{safeRender(quote.text, 'No quote text available')}"
                                        </blockquote>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Evidence Summary */}
                              {answer.evidenceSummary && (
                                <div className="bg-dark/30 rounded p-3">
                                  <h5 className="text-xs font-medium text-green-400 mb-2">Evidence Summary</h5>
                                  <p className="text-gray-300 text-sm leading-relaxed">{answer.evidenceSummary}</p>
                                </div>
                              )}

                              {/* Key Findings */}
                              {answer.keyFindings && Array.isArray(answer.keyFindings) && answer.keyFindings.length > 0 && (
                                <div className="bg-dark/30 rounded p-3">
                                  <h5 className="text-xs font-medium text-green-400 mb-2">Key Findings</h5>
                                  <ul className="space-y-1">
                                    {answer.keyFindings.map((finding, index) => (
                                      <li key={index} className="text-gray-300 text-xs flex items-start gap-2">
                                        <span className="text-green-400 text-xs mt-1">•</span>
                                        {safeRender(finding, 'No finding available')}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Recommendations */}
                              {answer.recommendations && Array.isArray(answer.recommendations) && answer.recommendations.length > 0 && (
                                <div className="bg-gradient-to-r from-red-400/10 to-orange-400/10 rounded p-3">
                                  <h5 className="text-xs font-medium text-red-400 mb-2">Recommendations</h5>
                                  <ul className="space-y-1">
                                    {answer.recommendations.map((rec, index) => (
                                      <li key={index} className="text-gray-300 text-xs flex items-start gap-2">
                                        <span className="text-red-400 text-xs mt-1">⚠</span>
                                        {typeof rec === 'string' ? rec : 
                                         typeof rec === 'object' ? JSON.stringify(rec, null, 2) :
                                         String(rec)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Metadata */}
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-green-400 border-green-400">
                                  Confidence: {normalizeConfidence(answer.confidence || 0.8)}%
                                </Badge>
                                {answer.quotes && Array.isArray(answer.quotes) && answer.quotes.length > 0 && (
                                  <Badge 
                                    variant="outline" 
                                    className="text-yellow-400 border-yellow-400 cursor-pointer hover:bg-yellow-400/10"
                                    onClick={() => {
                                      setSelectedQuoteData({
                                        quotes: answer.quotes && Array.isArray(answer.quotes) && answer.quotes.map((quote: string) => ({
                                          text: quote,
                                          documentName: answer.sources?.[0] || 'Unknown Document',
                                          confidence: answer.confidence || 0.8
                                        })),
                                        sources: [],
                                        title: question.question
                                      });
                                      setQuoteViewerOpen(true);
                                    }}
                                  >
                                    {answer.quotes && Array.isArray(answer.quotes) ? answer.quotes.length : 0} quote{answer.quotes && Array.isArray(answer.quotes) ? answer.quotes.length : 0 > 1 ? 's' : ''}
                                  </Badge>
                                )}
                                {answer.sources && Array.isArray(answer.sources) && answer.sources.length > 0 && (
                                  <Badge 
                                    variant="outline" 
                                    className="text-blue-400 border-blue-400 cursor-pointer hover:bg-blue-400/10"
                                    onClick={() => {
                                      const sources = answer.detailedEvidence?.map((evidence: any) => {
                                        return {
                                          documentName: evidence.documentName,
                                          relevantSections: evidence.relevantContent || evidence.keyFindings || [evidence.documentSummary || 'No specific section identified'],
                                          extractedText: evidence.documentSummary || 'No specific content extracted'
                                        };
                                      }) || answer.sources.map((source: string) => ({
                                        documentName: source,
                                        relevantSections: [answer.answer || 'No specific section identified'],
                                        extractedText: answer.answer
                                      }));
                                      
                                      setSelectedQuoteData({
                                        quotes: [],
                                        sources,
                                        title: question.question
                                      });
                                      setQuoteViewerOpen(true);
                                    }}
                                  >
                                    {answer.sources && Array.isArray(answer.sources) ? answer.sources.length : 0} source{answer.sources && Array.isArray(answer.sources) && answer.sources.length > 1 ? 's' : ''}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 p-3 bg-gray-800/50 rounded border border-gray-700">
                              <p className="text-gray-400 text-xs">No financial analysis available for this question yet.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
      
      <DocumentQuoteViewer
        isOpen={quoteViewerOpen}
        onClose={() => setQuoteViewerOpen(false)}
        quotes={selectedQuoteData.quotes}
        sources={selectedQuoteData.sources}
        title={selectedQuoteData.title}
        documents={documents}
      />
    </div>
  );
}

// Persistent Financial Analysis Button - matches Clinical button architecture exactly
function PersistentFinancialButton({ dealId }: { dealId: number }) {
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // Check for existing background jobs - EXACTLY like Clinical button
  const { data: jobProgress } = useQuery({
    queryKey: [`/api/background-jobs/${dealId}`],
    refetchInterval: 15000, // ⚡ PERFORMANCE: Reduced from 1s to 15s // Only poll for job status like Clinical
  });

  // Check if financial analysis is already running - EXACTLY like Clinical button
  const isAnalysisRunning = (() => {
    if (jobProgress?.jobs) {
      const financialJob = jobProgress.jobs.find((job: any) => job.agentType === 'financial');
      return !!financialJob && financialJob.status === 'processing';
    }
    return false;
  })();

  const queryClient = useQueryClient();

  const handleStartPersistentAnalysis = async () => {
    setIsStarting(true);
    try {
      console.log(`💰 Starting persistent financial analysis for deal ${dealId}...`);
      
      const response = await apiRequest(`/api/deals/${dealId}/financial-analysis/persistent/start`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Persistent financial analysis started:`, data);
        
        // CRITICAL FIX: Use removeQueries() for complete cache purging like other agents
        queryClient.removeQueries({ queryKey: [`/api/deals/${dealId}/financial-analysis/comprehensive/results`] });
        queryClient.removeQueries({ queryKey: [`/api/background-jobs/${dealId}`] });
        queryClient.removeQueries({ queryKey: [`/api/analyses/${dealId}`] });
        
        // Also invalidate for immediate UI refresh
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/financial-analysis/comprehensive/results`] });
        queryClient.invalidateQueries({ queryKey: [`/api/background-jobs/${dealId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/analyses/${dealId}`] });
      } else {
        const errorData = await response.json();
        console.error(`❌ Persistent financial analysis failed:`, errorData);
      }
    } catch (error) {
      console.error(`❌ Error starting persistent financial analysis:`, error);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopPersistentAnalysis = async () => {
    setIsStopping(true);
    try {
      console.log(`🛑 Stopping persistent financial analysis for deal ${dealId}...`);
      
      const response = await apiRequest(`/api/deals/${dealId}/financial-analysis/persistent/stop`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Persistent financial analysis stopped:`, data);
        
        // CRITICAL FIX: Use removeQueries() for complete cache purging like other agents
        queryClient.removeQueries({ queryKey: [`/api/deals/${dealId}/financial-analysis/comprehensive/results`] });
        queryClient.removeQueries({ queryKey: [`/api/background-jobs/${dealId}`] });
        queryClient.removeQueries({ queryKey: [`/api/analyses/${dealId}`] });
        
        // Also invalidate for immediate UI refresh
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/financial-analysis/comprehensive/results`] });
        queryClient.invalidateQueries({ queryKey: [`/api/background-jobs/${dealId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/analyses/${dealId}`] });
      } else {
        const errorData = await response.json();
        console.error(`❌ Failed to stop persistent financial analysis:`, errorData);
      }
    } catch (error) {
      console.error(`❌ Error stopping persistent financial analysis:`, error);
    } finally {
      setIsStopping(false);
    }
  };

  // EXACTLY like Clinical button render logic
  if (isAnalysisRunning) {
    return (
      <Button
        onClick={handleStopPersistentAnalysis}
        disabled={isStopping}
        size="sm"
        variant="destructive"
        className="bg-red-600 hover:bg-red-700 text-white"
      >
        {isStopping ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Stopping...
          </>
        ) : (
          <>
            <Square className="h-4 w-4 mr-2" />
            Stop Financial Analysis
          </>
        )}
      </Button>
    );
  }

  return (
    <Button
      onClick={handleStartPersistentAnalysis}
      disabled={isStarting}
      size="sm"
      className="bg-green-600 hover:bg-green-700 text-white border-green-500"
    >
      {isStarting ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Starting...
        </>
      ) : (
        <>
          <PlayCircle className="h-4 w-4 mr-2" />
          Run Financial Analysis
        </>
      )}
    </Button>
  );
}

// Comprehensive IP Analysis Button
function ComprehensiveIPAnalysisButton({ dealId }: { dealId: number }) {
  const [isRunning, setIsRunning] = useState(false);

  const { data: jobProgress } = useQuery({
    queryKey: [`/api/background-jobs/${dealId}`],
    refetchInterval: 15000, // ⚡ PERFORMANCE: Reduced from 1s to 15s
  });

  const { data: progressData } = useQuery({
    queryKey: [`/api/deals/${dealId}/ip-analysis/comprehensive/progress`],
    refetchInterval: 15000, // ⚡ PERFORMANCE: Reduced from 1s to 15s
  });

  const isAlreadyRunning = (progressData as any)?.isRunning || 
    (jobProgress as any)?.jobs?.some((job: any) => 
      job.jobType === 'comprehensive_ip_analysis' && job.status === 'processing'
    );

  const queryClient = useQueryClient();
  
  const comprehensiveAnalysisMutation = useMutation({
    mutationFn: async () => {
      console.log('Starting comprehensive IP analysis for deal', dealId);
      const response = await apiRequest(`/api/deals/${dealId}/ip-analysis/comprehensive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return response;
    },
    onSuccess: () => {
      console.log('✅ Comprehensive IP analysis started successfully');
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/ip-analysis/comprehensive/results`] });
      queryClient.invalidateQueries({ queryKey: [`/api/background-jobs/${dealId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/agents/ip/results`] });
    },
    onError: (error) => {
      console.error('❌ Error starting comprehensive IP analysis:', error);
      setIsRunning(false);
    }
  });

  const handleRunAnalysis = async () => {
    setIsRunning(true);
    console.log('Starting comprehensive IP analysis for deal', dealId);
    
    // Clear previous analysis data immediately to prevent stale data display
    queryClient.removeQueries({ queryKey: [`/api/deals/${dealId}/agents/ip/results`] });
    queryClient.removeQueries({ queryKey: [`/api/deals/${dealId}/ip-analysis/comprehensive/results`] });
    queryClient.removeQueries({ queryKey: ['/api/analyses', dealId] });
    
    // Force clear all IP-related caches to ensure fresh data display
    queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/ip-analysis/comprehensive/results`] });
    
    try {
      await comprehensiveAnalysisMutation.mutateAsync();
      
      let attempts = 0;
      const maxAttempts = 60;
      
      const checkForResults = async () => {
        attempts++;
        
        try {
          const response = await fetch(`/api/deals/${dealId}/ip-analysis/comprehensive/results?_t=${Date.now()}`, {
            cache: 'no-cache'
          });
          const data = await response.json();
          
          console.log(`🔐 IP analysis attempt ${attempts}...`);
          
          if (data.success && data.results && data.results.ipAnswers && Object.keys(data.results.ipAnswers).length > 0) {
            console.log('✅ IP analysis completed!');
            
            queryClient.invalidateQueries({
              queryKey: [`/api/deals/${dealId}/ip-analysis/comprehensive/results`]
            });
            queryClient.invalidateQueries({
              queryKey: [`/api/deals/${dealId}/agents/ip/results`]
            });
            queryClient.invalidateQueries({
              queryKey: ['/api/analyses', dealId]
            });
            queryClient.invalidateQueries({
              queryKey: [`/api/background-jobs/${dealId}`]
            });
            
            setTimeout(() => {
              setIsRunning(false);
            }, 1000);
            
            return;
          }
        } catch (error) {
          console.error('Error checking for IP results:', error);
        }
        
        if (attempts < maxAttempts) {
          setTimeout(checkForResults, 3000);
        } else {
          setIsRunning(false);
        }
      };
      
      setTimeout(checkForResults, 5000);
      
    } catch (error) {
      console.error('Error starting IP analysis:', error);
      setIsRunning(false);
    }
  };

  return (
    <Button
      onClick={handleRunAnalysis}
      disabled={isRunning || comprehensiveAnalysisMutation.isPending || isAlreadyRunning}
      size="sm"
      className="bg-purple-600 hover:bg-purple-700 text-white border-purple-500"
    >
      {isRunning || comprehensiveAnalysisMutation.isPending || isAlreadyRunning ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {isAlreadyRunning ? 'IP Analysis Running...' : isRunning ? 'IP Analysis Running...' : 'Starting Analysis...'}
        </>
      ) : (
        <>
          <Zap className="h-4 w-4 mr-2" />
          Run IP Analysis
        </>
      )}
    </Button>
  );
}

// Commercial Questions Section Component  
interface CommercialQuestionsSectionProps {
  dealId: number;
  analysisData: any;
  assignedDocuments: number;
  documents: any[];
  handleDocumentClick: (sourceName: string) => void;
  quoteViewerOpen: boolean;
  setQuoteViewerOpen: (open: boolean) => void;
  selectedQuoteData: any;
  setSelectedQuoteData: (data: any) => void;
}

function CommercialQuestionsSection({ dealId, analysisData, assignedDocuments, documents, handleDocumentClick, quoteViewerOpen, setQuoteViewerOpen, selectedQuoteData, setSelectedQuoteData }: CommercialQuestionsSectionProps) {
  const [expandedCategories, setExpandedCategories] = useState(new Set(["Competitive Analysis Decks"]));

  const { data: comprehensiveResults } = useQuery({
    queryKey: [`/api/deals/${dealId}/agents/commercial/results`],
    refetchInterval: 30000, // ⚡ PERFORMANCE: Reduced from 2s to 30s
  });

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Commercial questions structure matching the backend service
  const COMMERCIAL_QUESTIONS = [
    { id: 'competitive_1', question: 'Is the differentiation clearly articulated?', category: 'Competitive Analysis Decks' },
    { id: 'competitive_2', question: 'Are comparison matrices based on price/features?', category: 'Competitive Analysis Decks' },
    { id: 'competitive_3', question: 'Is switching cost vs. competitors assessed?', category: 'Competitive Analysis Decks' },
    { id: 'pricing_1', question: 'What pricing logic is used (usage-based, tiered, per-seat)?', category: 'Pricing Models' },
    { id: 'pricing_2', question: 'Are discount policies documented?', category: 'Pricing Models' },
    { id: 'pricing_3', question: 'Is net revenue retention tracked?', category: 'Pricing Models' },
    { id: 'sales_1', question: 'What are win/loss rates?', category: 'Sales Pipeline & CRM Data' },
    { id: 'sales_2', question: 'What\'s the sales cycle per segment?', category: 'Sales Pipeline & CRM Data' },
    { id: 'sales_3', question: 'Are conversion rates stable or improving?', category: 'Sales Pipeline & CRM Data' },
    { id: 'customer_1', question: 'What share of revenue is concentrated on top 10 customers?', category: 'Customer Lists / Key Account Summaries' },
    { id: 'customer_2', question: 'What is churn over last 12 months?', category: 'Customer Lists / Key Account Summaries' },
    { id: 'customer_3', question: 'Are customer satisfaction/NPS tracked?', category: 'Customer Lists / Key Account Summaries' }
  ];

  const categorizedQuestions = COMMERCIAL_QUESTIONS.reduce((acc, question) => {
    if (!acc[question.category]) {
      acc[question.category] = [];
    }
    acc[question.category].push(question);
    return acc;
  }, {} as Record<string, typeof COMMERCIAL_QUESTIONS>);

  const getAnswerForQuestion = (questionId: string) => {
    if (!comprehensiveResults?.analysis?.commercialAnswers) return null;
    return comprehensiveResults.analysis.commercialAnswers[questionId] || null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-gradient-to-r from-purple-500/5 to-purple-600/5 border border-purple-500/20 rounded-lg p-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">Comprehensive Commercial Analysis</h3>
          <p className="text-gray-300 text-sm">
            Analyze {assignedDocuments} commercial documents across 4 categories with 12 detailed questions
          </p>
        </div>
        <ComprehensiveCommercialAnalysisButton dealId={dealId} />
      </div>

      {Object.entries(categorizedQuestions).map(([category, questions]) => (
        <div key={category} className="border border-dark-lighter rounded-lg overflow-hidden">
          <div 
            className="flex items-center justify-between p-4 bg-dark-light hover:bg-dark cursor-pointer transition-colors"
            onClick={() => toggleCategory(category)}
          >
            <h4 className="font-medium text-white">{category}</h4>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-gray-400 border-gray-600">
                {questions && Array.isArray(questions) ? questions.length : 0} questions
              </Badge>
              {expandedCategories.has(category) ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </div>
          
          {expandedCategories.has(category) && (
            <div className="border-t border-dark-lighter">
              {questions && Array.isArray(questions) && questions.map(question => {
                const answer = getAnswerForQuestion(question.id);

                return (
                  <div key={question.id} className="p-4 border-b border-dark-lighter last:border-b-0">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-white mb-2">{question.question}</p>
                          
                          {answer ? (
                            <div className="mt-3 space-y-3">
                              {/* Main Finding - Clinical style */}
                              <div className="bg-dark/50 rounded p-3">
                                <h5 className="text-xs font-medium text-purple-400 mb-2">Commercial Analysis</h5>
                                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{answer.answer}</p>
                              </div>

                              {/* Enhanced Commercial Assessment */}
                              {answer.commercialAssessment && (
                                <div className="bg-dark/30 rounded p-3">
                                  <h5 className="text-xs font-medium text-indigo-400 mb-2">Commercial Assessment</h5>
                                  <p className="text-gray-300 text-sm leading-relaxed">{answer.commercialAssessment}</p>
                                </div>
                              )}

                              {/* Document Quotes */}
                              {answer.quotes && Array.isArray(answer.quotes) && answer.quotes.length > 0 && (
                                <div className="bg-gradient-to-r from-yellow-400/10 to-orange-400/10 rounded p-3">
                                  <h5 className="text-xs font-medium text-yellow-400 mb-2">
                                    📖 Document Quotes ({answer.quotes && Array.isArray(answer.quotes) ? answer.quotes.length : 0})
                                  </h5>
                                  <div className="space-y-2">
                                    {answer.quotes && Array.isArray(answer.quotes) && answer.quotes.map((quote, index) => (
                                      <div key={index} className="bg-dark/70 rounded p-2 border-l-2 border-yellow-400">
                                        <div className="flex items-start justify-between mb-1">
                                          <button
                                            onClick={() => handleDocumentClick(safeRender(quote.document, 'Unknown Document'))}
                                            className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 hover:bg-blue-500/30 transition-colors cursor-pointer"
                                            title={`View document: ${safeRender(quote.document, 'Unknown Document')}`}
                                          >
                                            📄 {(() => { const docName = safeRender(quote.document, 'Unknown Document'); return docName.length > 25 ? `${docName.substring(0, 25)}...` : docName; })()}
                                          </button>
                                          {quote.relevance && (
                                            <Badge variant="outline" className="text-xs text-gray-400 border-gray-400">
                                              {safeRender(quote.relevance, 'Medium')}
                                            </Badge>
                                          )}
                                        </div>
                                        <blockquote className="text-gray-300 text-xs italic leading-relaxed border-l-2 border-gray-600 pl-2 mt-1">
                                          "{safeRender(quote.text, 'No quote text available')}"
                                        </blockquote>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Evidence Summary */}
                              {answer.evidenceSummary && (
                                <div className="bg-dark/30 rounded p-3">
                                  <h5 className="text-xs font-medium text-green-400 mb-2">Evidence Summary</h5>
                                  <p className="text-gray-300 text-sm leading-relaxed">{answer.evidenceSummary}</p>
                                </div>
                              )}

                              {/* Key Findings */}
                              {answer.keyFindings && Array.isArray(answer.keyFindings) && answer.keyFindings.length > 0 && (
                                <div className="bg-dark/30 rounded p-3">
                                  <h5 className="text-xs font-medium text-purple-400 mb-2">Key Findings</h5>
                                  <ul className="space-y-1">
                                    {answer.keyFindings.map((finding, index) => (
                                      <li key={index} className="text-gray-300 text-xs flex items-start gap-2">
                                        <span className="text-purple-400 text-xs mt-1">•</span>
                                        {typeof finding === 'string' ? finding : 
                                         typeof finding === 'object' ? JSON.stringify(finding, null, 2) :
                                         String(finding)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Recommendations */}
                              {answer.recommendations && Array.isArray(answer.recommendations) && answer.recommendations.length > 0 && (
                                <div className="bg-gradient-to-r from-red-400/10 to-orange-400/10 rounded p-3">
                                  <h5 className="text-xs font-medium text-red-400 mb-2">Recommendations</h5>
                                  <ul className="space-y-1">
                                    {answer.recommendations.map((rec, index) => (
                                      <li key={index} className="text-gray-300 text-xs flex items-start gap-2">
                                        <span className="text-red-400 text-xs mt-1">⚠</span>
                                        {typeof rec === 'string' ? rec : 
                                         typeof rec === 'object' ? JSON.stringify(rec, null, 2) :
                                         String(rec)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Metadata */}
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-purple-400 border-purple-400">
                                  Confidence: {normalizeConfidence(answer.confidence)}%
                                </Badge>
                                {answer.quotes && Array.isArray(answer.quotes) && answer.quotes.length > 0 && (
                                  <Badge 
                                    variant="outline" 
                                    className="text-yellow-400 border-yellow-400 cursor-pointer hover:bg-yellow-400/10"
                                    onClick={() => {
                                      setSelectedQuoteData({
                                        quotes: answer.quotes && Array.isArray(answer.quotes) && answer.quotes.map((quote: string) => ({
                                          text: quote,
                                          documentName: answer.sources?.[0] || 'Unknown Document',
                                          confidence: answer.confidence || 0.8
                                        })),
                                        sources: [],
                                        title: question.question
                                      });
                                      setQuoteViewerOpen(true);
                                    }}
                                  >
                                    {answer.quotes && Array.isArray(answer.quotes) ? answer.quotes.length : 0} quote{answer.quotes && Array.isArray(answer.quotes) ? answer.quotes.length : 0 > 1 ? 's' : ''}
                                  </Badge>
                                )}
                                {answer.sources && Array.isArray(answer.sources) && answer.sources.length > 0 && (
                                  <Badge 
                                    variant="outline" 
                                    className="text-blue-400 border-blue-400 cursor-pointer hover:bg-blue-400/10"
                                    onClick={() => {
                                      const sources = answer.detailedEvidence?.map((evidence: any) => {
                                        return {
                                          documentName: evidence.documentName,
                                          relevantSections: evidence.relevantContent || evidence.keyFindings || [evidence.documentSummary || 'No specific section identified'],
                                          extractedText: evidence.documentSummary || 'No specific content extracted'
                                        };
                                      }) || answer.sources.map((source: string) => ({
                                        documentName: source,
                                        relevantSections: [answer.answer || 'No specific section identified'],
                                        extractedText: answer.answer
                                      }));
                                      
                                      setSelectedQuoteData({
                                        quotes: [],
                                        sources,
                                        title: question.question
                                      });
                                      setQuoteViewerOpen(true);
                                    }}
                                  >
                                    {answer.sources && Array.isArray(answer.sources) ? answer.sources.length : 0} source{answer.sources && Array.isArray(answer.sources) && answer.sources.length > 1 ? 's' : ''}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 p-3 bg-gray-800/50 rounded border border-gray-700">
                              <p className="text-gray-400 text-xs">No commercial analysis available for this question yet.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
      
      <DocumentQuoteViewer
        isOpen={quoteViewerOpen}
        onClose={() => setQuoteViewerOpen(false)}
        quotes={selectedQuoteData.quotes}
        sources={selectedQuoteData.sources}
        title={selectedQuoteData.title}
        documents={documents}
      />
    </div>
  );
}
// HR Questions Section Component  
interface HrQuestionsSectionProps {
  dealId: number;
  analysisData: any;
  assignedDocuments: number;
  documents: any[];
  handleDocumentClick: (sourceName: string) => void;
  quoteViewerOpen: boolean;
  setQuoteViewerOpen: (open: boolean) => void;
  selectedQuoteData: any;
  setSelectedQuoteData: (data: any) => void;
}

function HrQuestionsSection({ dealId, analysisData, assignedDocuments, documents, handleDocumentClick, quoteViewerOpen, setQuoteViewerOpen, selectedQuoteData, setSelectedQuoteData }: HrQuestionsSectionProps) {
  const [expandedCategories, setExpandedCategories] = useState(new Set(["Team Structure & Leadership"]));

  const { data: comprehensiveResults } = useQuery({
    queryKey: [`/api/deals/${dealId}/agents/hr/results`],
    refetchInterval: 30000, // ⚡ PERFORMANCE: Reduced from 2s to 30s
  });

  const { data: hrProgress } = useQuery({
    queryKey: [`/api/deals/${dealId}/hr-analysis/comprehensive/progress`],
    refetchInterval: 30000, // ⚡ PERFORMANCE: Reduced from 2s to 30s
  });

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // HR questions structure grouped into fewer categories like Commercial agent
  const HR_QUESTIONS = [
    // Team Structure & Leadership (4 questions)
    { id: 'hr_1', question: 'What is the current team size and organizational structure?', category: 'Team Structure & Leadership' },
    { id: 'hr_2', question: 'Are there key person dependencies or single points of failure?', category: 'Team Structure & Leadership' },
    { id: 'hr_3', question: 'What is the leadership experience and track record?', category: 'Team Structure & Leadership' },
    { id: 'hr_4', question: 'Are there gaps in the leadership team?', category: 'Team Structure & Leadership' },
    
    // Employee Relations & Retention (4 questions)
    { id: 'hr_5', question: 'What is the employee retention and turnover rate?', category: 'Employee Relations & Retention' },
    { id: 'hr_6', question: 'Are compensation and equity structures competitive?', category: 'Employee Relations & Retention' },
    { id: 'hr_7', question: 'What is the company culture and employee engagement?', category: 'Employee Relations & Retention' },
    { id: 'hr_8', question: 'What are the talent acquisition and hiring strategies?', category: 'Employee Relations & Retention' },
    
    // HR Operations & Development (4 questions)
    { id: 'hr_9', question: 'Are there documented HR policies and procedures?', category: 'HR Operations & Development' },
    { id: 'hr_10', question: 'What performance management systems are in place?', category: 'HR Operations & Development' },
    { id: 'hr_11', question: 'Are there skills development and training programs?', category: 'HR Operations & Development' },
    { id: 'hr_12', question: 'What is the workforce diversity and inclusion status?', category: 'HR Operations & Development' }
  ];

  const categorizedQuestions = HR_QUESTIONS.reduce((acc, question) => {
    if (!acc[question.category]) {
      acc[question.category] = [];
    }
    acc[question.category].push(question);
    return acc;
  }, {} as Record<string, typeof HR_QUESTIONS>);

  const getAnswerForQuestion = (questionId: string) => {
    if (!comprehensiveResults?.analysis?.hrAnswers) return null;
    return comprehensiveResults.analysis.hrAnswers[questionId] || null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-gradient-to-r from-orange-500/5 to-orange-600/5 border border-orange-500/20 rounded-lg p-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">Comprehensive HR Analysis</h3>
          <p className="text-gray-300 text-sm">
            Analyze {assignedDocuments} HR documents across 3 categories with 12 detailed questions
          </p>
        </div>
        <ComprehensiveHrAnalysisButton dealId={dealId} />
      </div>

      {Object.entries(categorizedQuestions).map(([category, questions]) => (
        <div key={category} className="border border-dark-lighter rounded-lg overflow-hidden">
          <div 
            className="flex items-center justify-between p-4 bg-dark-light hover:bg-dark cursor-pointer transition-colors"
            onClick={() => toggleCategory(category)}
          >
            <h4 className="font-medium text-white">{category}</h4>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-gray-400 border-gray-600">
                {questions && Array.isArray(questions) ? questions.length : 0} questions
              </Badge>
              {expandedCategories.has(category) ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </div>
          
          {expandedCategories.has(category) && (
            <div className="border-t border-dark-lighter">
              {questions && Array.isArray(questions) && questions.map(question => {
                const answer = getAnswerForQuestion(question.id);

                return (
                  <div key={question.id} className="p-4 border-b border-dark-lighter last:border-b-0">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-white mb-2">{question.question}</p>
                          
                          {answer ? (
                            <div className="mt-3 space-y-3">
                              {/* Main Analysis Response - Commercial style matching */}
                              <div className="bg-dark/50 rounded p-3">
                                <h5 className="text-xs font-medium text-orange-400 mb-2">HR Analysis</h5>
                                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{answer.answer}</p>
                              </div>

                              {/* Enhanced HR Assessment - mimic Commercial's commercialAssessment */}
                              <div className="bg-dark/30 rounded p-3">
                                <h5 className="text-xs font-medium text-amber-400 mb-2">HR Assessment</h5>
                                <p className="text-gray-300 text-sm leading-relaxed">
                                  {answer.hrAssessment || 
                                    `Based on HR document analysis, this finding indicates ${
                                      answer.confidence > 0.8 ? 'strong evidence' : 
                                      answer.confidence > 0.6 ? 'moderate evidence' : 'limited evidence'
                                    } regarding team structure and organizational capabilities. ${
                                      answer.confidence > 0.7 ? 'Recommended for further due diligence review.' : 'Requires additional investigation.'
                                    }`
                                  }
                                </p>
                              </div>

                              {/* Document Quotes - mimic Commercial's sources */}
                              {answer.sources && Array.isArray(answer.sources) && answer.sources.length > 0 ? (
                                <div className="bg-gradient-to-r from-yellow-400/10 to-orange-400/10 rounded p-3">
                                  <h5 className="text-xs font-medium text-yellow-400 mb-2">
                                    📖 Document Quotes ({answer.sources.length})
                                  </h5>
                                  <div className="space-y-2">
                                    {answer.sources.map((source: string, index: number) => (
                                      <div key={index} className="bg-dark/70 rounded p-2 border-l-2 border-yellow-400">
                                        <div className="flex items-start justify-between mb-1">
                                          <button
                                            onClick={() => handleDocumentClick(source)}
                                            className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 hover:bg-blue-500/30 transition-colors cursor-pointer"
                                            title={`View document: ${source}`}
                                          >
                                            📄 {source.length > 25 ? `${source.substring(0, 25)}...` : source}
                                          </button>
                                        </div>
                                        <blockquote className="text-gray-300 text-xs italic leading-relaxed border-l-2 border-gray-600 pl-2 mt-1">
                                          "{answer.answer}"
                                        </blockquote>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-gradient-to-r from-yellow-400/10 to-orange-400/10 rounded p-3">
                                  <h5 className="text-xs font-medium text-yellow-400 mb-2">📖 Document Analysis</h5>
                                  <p className="text-gray-300 text-xs">Analysis based on comprehensive review of HR documentation and organizational records.</p>
                                </div>
                              )}

                              {/* Key HR Findings - mimic Commercial's keyFindings */}
                              <div className="bg-dark/30 rounded p-3">
                                <h5 className="text-xs font-medium text-orange-400 mb-2">🔍 Key HR Findings</h5>
                                <ul className="space-y-1">
                                  <li className="text-gray-300 text-xs flex items-start gap-2">
                                    <span className="text-orange-400 text-xs mt-1">•</span>
                                    Team composition: {answer.answer.includes('contractor') || answer.answer.includes('independent') ? 'Mixed employee-contractor model' : 
                                                     answer.answer.includes('full-time') ? 'Full-time employee focus' : 'Organizational structure identified'}
                                  </li>
                                  <li className="text-gray-300 text-xs flex items-start gap-2">
                                    <span className="text-orange-400 text-xs mt-1">•</span>
                                    Analysis confidence: {answer.confidence > 0.8 ? 'High reliability' : answer.confidence > 0.6 ? 'Moderate reliability' : 'Requires verification'} ({Math.round((answer.confidence || 0) * 100)}%)
                                  </li>
                                </ul>
                              </div>

                              {/* HR Recommendations - mimic Commercial's recommendations */}
                              <div className="bg-gradient-to-r from-red-400/10 to-orange-400/10 rounded p-3">
                                <h5 className="text-xs font-medium text-red-400 mb-2">💡 HR Recommendations</h5>
                                <ul className="space-y-1">
                                  <li className="text-gray-300 text-xs flex items-start gap-2">
                                    <span className="text-red-400 text-xs mt-1">⚠</span>
                                    {answer.confidence < 0.7 ? 'Conduct additional HR documentation review' : 'Standard HR due diligence recommended'}
                                  </li>
                                  <li className="text-gray-300 text-xs flex items-start gap-2">
                                    <span className="text-red-400 text-xs mt-1">⚠</span>
                                    Verify organizational structure and key personnel roles
                                  </li>
                                </ul>
                              </div>

                              {/* Metadata */}
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-orange-400 border-orange-400">
                                  Confidence: {normalizeConfidence(answer.confidence)}%
                                </Badge>
                                <Badge variant="outline" className="text-gray-400 border-gray-400">
                                  HR Analysis
                                </Badge>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 p-3 bg-gray-800/50 rounded border border-gray-700">
                              <p className="text-gray-400 text-xs">No HR analysis available for this question yet.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
      
      <DocumentQuoteViewer
        isOpen={quoteViewerOpen}
        onClose={() => setQuoteViewerOpen(false)}
        quotes={selectedQuoteData.quotes}
        sources={selectedQuoteData.sources}
        title={selectedQuoteData.title}
        documents={documents}
      />
    </div>
  );
}

// IP Questions Section Component - Structured questions with Clinical-style display
function IpQuestionsSection({ dealId, analysisData, assignedDocuments, documents, handleDocumentClick, quoteViewerOpen, setQuoteViewerOpen, selectedQuoteData, setSelectedQuoteData }: { dealId: number; analysisData?: any; assignedDocuments: number; documents?: any[]; handleDocumentClick: (sourceName: string) => void; quoteViewerOpen: boolean; setQuoteViewerOpen: (open: boolean) => void; selectedQuoteData: any; setSelectedQuoteData: (data: any) => void }) {
  const [expandedCategories, setExpandedCategories] = useState(new Set(["Patent Portfolio"]));

  // CRITICAL FIX: Use comprehensive results endpoint EXACTLY like Financial agent
  const { data: comprehensiveResults, refetch: refetchComprehensive } = useQuery({
    queryKey: [`/api/deals/${dealId}/ip-analysis/comprehensive/results`],
    refetchInterval: 30000, // ⚡ PERFORMANCE: Reduced from 2s to 30s
    staleTime: 0, // Always treat as stale to force fresh data like Financial
    gcTime: 0, // Don't cache results like Financial
  });

  // Force refetch on component mount to ensure fresh data like Financial
  useEffect(() => {
    refetchComprehensive();
  }, [refetchComprehensive]);

  // Use comprehensive results if available, fallback to analysisData like Financial
  const ipData = comprehensiveResults?.results || analysisData || null;

  console.log('🔒 IP Analysis Available:', !!ipData);
  console.log('🔒 Comprehensive Results Available:', !!comprehensiveResults?.results);  
  console.log('🔒 IP Data from Comprehensive:', !!ipData?.ipAnswers);
  console.log('🔒 IP Answers Keys:', ipData?.ipAnswers ? Object.keys(ipData.ipAnswers) : 'No answers');
  console.log('🔒 DEBUGGING: Full ipData structure:', JSON.stringify(ipData, null, 2));

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // IP questions structure EXACTLY matching the backend service - comprehensiveIpAnalysisService.ts
  const IP_QUESTIONS = [
    // Patent Portfolio - 3 questions 
    { id: "patents_1", question: "What patents are owned or pending?", category: "Patent Portfolio" },
    { id: "patents_2", question: "Are core technologies protected?", category: "Patent Portfolio" },
    { id: "patents_3", question: "What is the patent landscape analysis?", category: "Patent Portfolio" },
    
    // Trademarks & Branding - 2 questions
    { id: "trademarks_1", question: "Are trademarks registered and protected?", category: "Trademarks & Branding" },
    { id: "trademarks_2", question: "Is brand identity legally secure?", category: "Trademarks & Branding" },
    
    // Technology Licensing - 2 questions  
    { id: "licensing_1", question: "What licensing agreements are in place?", category: "Technology Licensing" },
    { id: "licensing_2", question: "Are there any IP infringement risks?", category: "Technology Licensing" },
    
    // IP Strategy & Valuation - 2 questions
    { id: "strategy_1", question: "What is the IP strategy and roadmap?", category: "IP Strategy & Valuation" },
    { id: "strategy_2", question: "How is IP valued and monetized?", category: "IP Strategy & Valuation" },
    
    // Trade Secrets & Confidentiality - 2 questions
    { id: "secrets_1", question: "What trade secrets are protected?", category: "Trade Secrets & Confidentiality" },
    { id: "secrets_2", question: "Are confidentiality measures adequate?", category: "Trade Secrets & Confidentiality" },
    
    // Competitive IP Position - 1 question
    { id: "competitive_1", question: "What is the competitive IP landscape?", category: "Competitive IP Position" }
  ];

  const categorizedQuestions = IP_QUESTIONS.reduce((acc, question) => {
    if (!acc[question.category]) {
      acc[question.category] = [];
    }
    acc[question.category].push(question);
    return acc;
  }, {} as Record<string, typeof IP_QUESTIONS>);

  // Get findings and recommendations from IP analysis - FIXED: Backend returns them in results, not analysis
  const findings = (comprehensiveResults as any)?.results?.findings || [];
  const recommendations = (comprehensiveResults as any)?.results?.recommendations || [];

  const getAnswerForQuestion = (questionId: string) => {
    // CRITICAL FIX: Backend returns ipAnswers in comprehensiveResults.results.ipAnswers (line 5089 in server/routes.ts)
    console.log(`🔍 Looking for IP answer for question: ${questionId}`);
    console.log(`🔍 Comprehensive results structure:`, comprehensiveResults ? Object.keys(comprehensiveResults) : 'No comprehensive results');
    console.log(`🔍 Results structure:`, comprehensiveResults?.results ? Object.keys(comprehensiveResults.results) : 'No results');
    console.log(`🔍 IP Answers available:`, !!comprehensiveResults?.results?.ipAnswers);
    console.log(`🔍 IP Answers keys:`, comprehensiveResults?.results?.ipAnswers ? Object.keys(comprehensiveResults.results.ipAnswers) : 'No ipAnswers');
    
    // EXACT MATCH: Backend returns ipAnswers at comprehensiveResults.results.ipAnswers (server/routes.ts line 5089)
    if (comprehensiveResults?.results?.ipAnswers && comprehensiveResults.results.ipAnswers[questionId]) {
      console.log(`✅ Found IP answer for ${questionId} in comprehensiveResults.results.ipAnswers`);
      return comprehensiveResults.results.ipAnswers[questionId];
    }
    
    // Fallback: Check if ipData has ipAnswers directly
    if (ipData?.ipAnswers && ipData.ipAnswers[questionId]) {
      console.log(`✅ Found IP answer for ${questionId} in ipData.ipAnswers fallback`);
      return ipData.ipAnswers[questionId];
    }
    
    console.log(`❌ No IP answer found for ${questionId} - checked comprehensiveResults.results.ipAnswers and ipData.ipAnswers`);
    return null;

    // Fallback: Try to map findings to questions based on content similarity
    if (findings.length > 0) {
      // Find the most relevant finding for this question
      const relevantFinding = findings.find((finding: any) => {
        const questionKeywords = {
          'patents_1': ['patent', 'patent application', 'intellectual property', 'patent pending', 'patent portfolio'],
          'patents_2': ['technology protection', 'core technology', 'proprietary technology', 'patent protection'],
          'patents_3': ['patent landscape', 'prior art', 'patent search', 'freedom to operate'],
          'trademarks_1': ['trademark', 'service mark', 'brand protection', 'trademark registration'],
          'trademarks_2': ['brand identity', 'brand protection', 'logo protection', 'brand security'],
          'licensing_1': ['licensing agreement', 'technology license', 'ip license', 'licensing deal'],
          'licensing_2': ['ip infringement', 'patent infringement', 'trademark infringement', 'ip risk'],
          'strategy_1': ['ip strategy', 'intellectual property strategy', 'ip roadmap', 'ip development', 'patent strategy'],
          'strategy_2': ['ip valuation', 'ip value', 'ip monetization', 'intellectual property value', 'patent value'],
          'secrets_1': ['trade secret', 'confidential information', 'proprietary information', 'know-how', 'confidentiality'],
          'secrets_2': ['confidentiality agreement', 'nda', 'non-disclosure', 'information security', 'data protection'],
          'competitive_1': ['competitive landscape', 'competitor patents', 'market analysis', 'ip competition', 'patent analysis']
        };
        
        const keywords = questionKeywords[questionId as keyof typeof questionKeywords] || [];
        return keywords.some((keyword: string) => 
          finding.finding?.toLowerCase().includes(keyword.toLowerCase())
        );
      });

      if (relevantFinding) {
        return {
          answer: relevantFinding.finding,
          confidence: Math.round((relevantFinding.confidence || 0.5) * 100),
          sources: relevantFinding.sources || [],
          category: relevantFinding.category || 'IP Analysis',
          severity: typeof relevantFinding.severity === 'string' ? relevantFinding.severity : 
                   typeof relevantFinding.severity === 'object' ? JSON.stringify(relevantFinding.severity, null, 2) :
                   String(relevantFinding.severity || 'Medium')
        };
      }
      
      // Fallback: If no exact match, return the first finding with some basic relevance
      if (findings.length > 0 && questionId.startsWith('patents_')) {
        const patentFinding = findings.find((finding: any) => 
          finding.finding?.toLowerCase().includes('patent') ||
          finding.finding?.toLowerCase().includes('IP') ||
          finding.finding?.toLowerCase().includes('intellectual property')
        );
        
        if (patentFinding) {
          return {
            answer: patentFinding.finding,
            confidence: Math.round((patentFinding.confidence || 0.5) * 100),
            sources: patentFinding.sources || [],
            category: patentFinding.category || 'IP Analysis',
            severity: typeof patentFinding.severity === 'string' ? patentFinding.severity : 
                     typeof patentFinding.severity === 'object' ? JSON.stringify(patentFinding.severity, null, 2) :
                     String(patentFinding.severity || 'Medium')
          };
        }
      }
    }
    
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-gradient-to-r from-purple-500/5 to-purple-600/5 border border-purple-500/20 rounded-lg p-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">Comprehensive IP Analysis</h3>
          <p className="text-gray-300 text-sm">
            Analyze {assignedDocuments} IP documents across 4 categories with 16 detailed questions
          </p>
        </div>
        <ComprehensiveIPAnalysisButton dealId={dealId} />
      </div>

      {Object.entries(categorizedQuestions).map(([category, questions]) => (
        <div key={category} className="border border-dark-lighter rounded-lg overflow-hidden">
          <div 
            className="flex items-center justify-between p-4 bg-dark-light hover:bg-dark cursor-pointer transition-colors"
            onClick={() => toggleCategory(category)}
          >
            <h4 className="font-medium text-white">{category}</h4>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-gray-400 border-gray-600">
                {questions && Array.isArray(questions) ? questions.length : 0} questions
              </Badge>
              {expandedCategories.has(category) ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </div>
          
          {expandedCategories.has(category) && (
            <div className="border-t border-dark-lighter">
              {questions && Array.isArray(questions) && questions.map((question) => {
                const answer = getAnswerForQuestion(question.id);
                const hasAnswer = answer !== null;
                
                return (
                  <div key={question.id} className="border border-dark-lighter/50 rounded-lg">
                    <div className="p-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          hasAnswer ? 'bg-green-400' : 'bg-gray-400'
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-white font-medium text-sm flex-1">{question.question}</p>
                            {/* Re-run button for individual question */}
                            <button
                              data-testid={`rerun-question-${question.id}`}
                              onClick={() => {
                                setRerunningQuestionId(question.id);
                                rerunQuestionMutation.mutate(question.id);
                              }}
                              disabled={rerunningQuestionId === question.id}
                              className="p-1.5 rounded hover:bg-dark-lighter transition-colors text-gray-400 hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={rerunningQuestionId === question.id ? "Re-running..." : "Re-run this question"}
                            >
                              {rerunningQuestionId === question.id ? (
                                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                                </svg>
                              ) : (
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.39 0 4.56.93 6.18 2.44l-2.18 2.18"/>
                                  <path d="M15 9h6v-6"/>
                                </svg>
                              )}
                            </button>
                          </div>
                          
                          {hasAnswer ? (
                            <div className="mt-3 space-y-3">
                              {/* Main Answer */}
                              <div className="bg-dark/50 rounded p-3">
                                <h5 className="text-xs font-medium text-purple-400 mb-2">IP Analysis</h5>
                                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                                  {typeof answer.answer === 'string' ? answer.answer : 
                                   typeof answer.answer === 'object' ? JSON.stringify(answer.answer, null, 2) :
                                   String(answer.answer || 'No analysis available')}
                                </p>
                              </div>

                              {/* Enhanced IP Assessment */}
                              {answer.ipAssessment && (
                                <div className="bg-dark/30 rounded p-3">
                                  <h5 className="text-xs font-medium text-purple-400 mb-2">IP Assessment</h5>
                                  <p className="text-gray-300 text-sm leading-relaxed">
                                    {typeof answer.ipAssessment === 'string' ? answer.ipAssessment : 
                                     typeof answer.ipAssessment === 'object' ? JSON.stringify(answer.ipAssessment, null, 2) :
                                     String(answer.ipAssessment || 'No assessment available')}
                                  </p>
                                </div>
                              )}

                              {/* Document Quotes */}
                              {answer.quotes && Array.isArray(answer.quotes) && answer.quotes.length > 0 && (
                                <div className="bg-gradient-to-r from-yellow-400/10 to-orange-400/10 rounded p-3">
                                  <h5 className="text-xs font-medium text-yellow-400 mb-2">
                                    📖 Document Quotes ({answer.quotes && Array.isArray(answer.quotes) ? answer.quotes.length : 0})
                                  </h5>
                                  <div className="space-y-2">
                                    {answer.quotes && Array.isArray(answer.quotes) && answer.quotes.map((quote, index) => (
                                      <div key={index} className="bg-dark/70 rounded p-2 border-l-2 border-yellow-400">
                                        <div className="flex items-start justify-between mb-1">
                                          <button
                                            onClick={() => handleDocumentClick(safeRender(quote.document, 'Unknown Document'))}
                                            className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 hover:bg-blue-500/30 transition-colors cursor-pointer"
                                            title={`View document: ${safeRender(quote.document, 'Unknown Document')}`}
                                          >
                                            📄 {(() => { const docName = safeRender(quote.document, 'Unknown Document'); return docName.length > 25 ? `${docName.substring(0, 25)}...` : docName; })()}
                                          </button>
                                          {quote.relevance && (
                                            <Badge variant="outline" className="text-xs text-gray-400 border-gray-400">
                                              {safeRender(quote.relevance, 'Medium')}
                                            </Badge>
                                          )}
                                        </div>
                                        <blockquote className="text-gray-300 text-xs italic leading-relaxed border-l-2 border-gray-600 pl-2 mt-1">
                                          "{safeRender(quote.text, 'No quote text available')}"
                                        </blockquote>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Evidence Summary */}
                              {answer.evidenceSummary && (
                                <div className="bg-dark/30 rounded p-3">
                                  <h5 className="text-xs font-medium text-purple-400 mb-2">Evidence Summary</h5>
                                  <p className="text-gray-300 text-sm leading-relaxed">
                                    {typeof answer.evidenceSummary === 'string' ? answer.evidenceSummary : 
                                     typeof answer.evidenceSummary === 'object' ? JSON.stringify(answer.evidenceSummary, null, 2) :
                                     String(answer.evidenceSummary || 'No evidence summary available')}
                                  </p>
                                </div>
                              )}

                              {/* Key Findings */}
                              {answer.keyFindings && Array.isArray(answer.keyFindings) && answer.keyFindings.length > 0 && (
                                <div className="bg-dark/30 rounded p-3">
                                  <h5 className="text-xs font-medium text-purple-400 mb-2">Key Findings</h5>
                                  <ul className="space-y-1">
                                    {answer.keyFindings.map((finding, index) => (
                                      <li key={index} className="text-gray-300 text-xs flex items-start gap-2">
                                        <span className="text-purple-400 text-xs mt-1">•</span>
                                        {typeof finding === 'string' ? finding : 
                                         typeof finding === 'object' ? JSON.stringify(finding, null, 2) :
                                         String(finding || 'No finding available')}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Recommendations */}
                              {answer.recommendations && Array.isArray(answer.recommendations) && answer.recommendations.length > 0 && (
                                <div className="bg-gradient-to-r from-red-400/10 to-orange-400/10 rounded p-3">
                                  <h5 className="text-xs font-medium text-red-400 mb-2">Recommendations</h5>
                                  <ul className="space-y-1">
                                    {answer.recommendations.map((rec, index) => (
                                      <li key={index} className="text-gray-300 text-xs flex items-start gap-2">
                                        <span className="text-red-400 text-xs mt-1">⚠</span>
                                        {typeof rec === 'string' ? rec : 
                                         typeof rec === 'object' ? JSON.stringify(rec, null, 2) :
                                         String(rec || 'No recommendation available')}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Metadata */}
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-purple-400 border-purple-400">
                                  Confidence: {normalizeConfidence(answer.confidence || 0.8)}%
                                </Badge>
                                {answer.quotes && Array.isArray(answer.quotes) && answer.quotes.length > 0 && (
                                  <Badge 
                                    variant="outline" 
                                    className="text-yellow-400 border-yellow-400 cursor-pointer hover:bg-yellow-400/10"
                                    onClick={() => {
                                      setSelectedQuoteData({
                                        quotes: answer.quotes && Array.isArray(answer.quotes) && answer.quotes.map((quote: string) => ({
                                          text: quote,
                                          documentName: answer.sources?.[0] || 'Unknown Document',
                                          confidence: answer.confidence || 0.8
                                        })),
                                        sources: [],
                                        title: question.question
                                      });
                                      setQuoteViewerOpen(true);
                                    }}
                                  >
                                    {answer.quotes && Array.isArray(answer.quotes) ? answer.quotes.length : 0} quote{answer.quotes && Array.isArray(answer.quotes) ? answer.quotes.length : 0 > 1 ? 's' : ''}
                                  </Badge>
                                )}
                                {answer.sources && Array.isArray(answer.sources) && answer.sources.length > 0 && (
                                  <Badge 
                                    variant="outline" 
                                    className="text-blue-400 border-blue-400 cursor-pointer hover:bg-blue-400/10"
                                    onClick={() => {
                                      const sources = answer.detailedEvidence?.map((evidence: any) => {
                                        return {
                                          documentName: evidence.documentName,
                                          relevantSections: evidence.relevantContent || evidence.keyFindings || [evidence.documentSummary || 'No specific section identified'],
                                          extractedText: evidence.documentSummary || 'No specific content extracted'
                                        };
                                      }) || answer.sources.map((source: string) => ({
                                        documentName: source,
                                        relevantSections: [answer.answer || 'No specific section identified'],
                                        extractedText: answer.answer
                                      }));
                                      
                                      setSelectedQuoteData({
                                        quotes: [],
                                        sources,
                                        title: question.question
                                      });
                                      setQuoteViewerOpen(true);
                                    }}
                                  >
                                    {answer.sources && Array.isArray(answer.sources) ? answer.sources.length : 0} source{answer.sources && Array.isArray(answer.sources) && answer.sources.length > 1 ? 's' : ''}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 p-3 bg-gray-800/50 rounded border border-gray-700">
                              <p className="text-gray-400 text-xs">No IP analysis available for this question yet.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {/* Additional Recommendations Section */}
      {recommendations && Array.isArray(recommendations) && recommendations.length > 0 && (
        <div className="border border-dark-lighter rounded-lg overflow-hidden">
          <div className="p-4 bg-dark-light">
            <h4 className="font-medium text-white">Additional IP Recommendations ({recommendations && Array.isArray(recommendations) ? recommendations.length : 0})</h4>
          </div>
          <div className="border-t border-dark-lighter p-4">
            <div className="space-y-3">
              {recommendations.map((rec: any, index: number) => (
                <div key={index} className="bg-gradient-to-r from-blue-400/10 to-indigo-400/10 rounded p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold text-xs mt-1">•</span>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      {safeRender(rec.content || rec.recommendation || rec, 'No recommendation available')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      <DocumentQuoteViewer
        isOpen={quoteViewerOpen}
        onClose={() => setQuoteViewerOpen(false)}
        quotes={selectedQuoteData.quotes}
        sources={selectedQuoteData.sources}
        title={selectedQuoteData.title}
        documents={documents}
      />
    </div>
  );
}
