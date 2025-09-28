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
import { FormattedAnswer } from './FormattedAnswer';
import { ProfessionalFormattedContent } from './ProfessionalFormattedContent';

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
      queryKey: [`/api/deals/${dealId}/agents/commercial/progress`],
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

  // Normalize status to handle case variations and common aliases
  const normalizeStatus = (status?: string): string => {
    if (!status) return '';
    const normalized = status.toLowerCase().trim();
    // Handle common status variations
    if (normalized === 'complete') return 'completed';
    if (normalized === 'in progress') return 'processing';
    return normalized;
  };

  // Check if analysis is currently processing by looking at status and recent activity
  const isAnalysisCurrentlyRunning = () => {
    // Check if all analyses are running from parent component
    if (isRunningAllAnalyses) {
      return true;
    }
    
    // Check if we have a processing status (case-insensitive)
    const normalizedStatus = normalizeStatus(analysisData?.status);
    if (normalizedStatus === 'processing') {
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
    
    // Show processing UI for individual agent runs (case-insensitive)
    const normalizedStatus = normalizeStatus(analysisData?.status);
    if (normalizedStatus === 'processing') {
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
    f.severity === 'positive' || f.type === 'positive' || f.category === 'positive' ||
    f.type === 'organizational_strength' // ✅ FIXED: HR agent specific positive findings
  ).length;
  const riskFactors = (findings || []).filter((f: any) => 
    f.severity === 'risk' || f.severity === 'negative' || f.type === 'risk' || f.category === 'risk' ||
    f.type === 'organizational_risk' // ✅ FIXED: HR agent specific risk findings
  ).length;
  
  // Check if we have any analysis data (robust logic with proper array checks)
  const normalizedStatus = normalizeStatus(analysisData?.status);
  const hasAnalysis = (findings && findings.length > 0) || 
                     (recommendations && recommendations.length > 0) || 
                     ['completed', 'complete'].includes(normalizedStatus);

  // Debug KPI calculations for verification
  console.log(`🔢 ${agentType} Agent KPIs:`, {
    totalDocuments: documents?.length || 0,
    assignedDocuments: assignedDocuments,
    hasAnalysis: hasAnalysis,
    normalizedStatus: normalizedStatus,
    findingsCount: (findings || []).length,
    recommendationsCount: (recommendations || []).length,
    positiveInsights,
    riskFactors
  });

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
            ['completed', 'complete'].includes(normalizedStatus) ? 'text-green-400 border-green-400' :
            normalizedStatus === 'processing' ? 'text-blue-400 border-blue-400' :
            normalizedStatus === 'failed' ? 'text-red-400 border-red-400' :
            'text-gray-400 border-gray-400'
          }>
            {status}
          </Badge>
          {normalizedStatus === 'processing' && (
            <span className="text-xs text-gray-400">{progress}% complete</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Progress tracking components will be implemented in future versions */}
        
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
          /* Removed: LegalQuestionsSection - using UnifiedQuestionsSection */
          <div className="bg-dark border border-dark-lighter rounded-lg p-4">
            <p className="text-gray-400 text-center">Legal analysis results will be displayed here</p>
          </div>
        ) : agentType.toLowerCase() === 'clinical' ? (
          /* Removed: ClinicalQuestionsSection - using UnifiedQuestionsSection */
          <div className="bg-dark border border-dark-lighter rounded-lg p-4">
            <p className="text-gray-400 text-center">Clinical analysis results will be displayed here</p>
          </div>
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
        ) : agentType.toLowerCase() === 'research' ? (
          /* Removed: ResearchQuestionsSection - using UnifiedQuestionsSection */
          <div className="bg-dark border border-dark-lighter rounded-lg p-4">
            <p className="text-gray-400 text-center">Research analysis results will be displayed here</p>
          </div>
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
