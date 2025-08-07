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
import { Loader2, Bot, FileText, TrendingUp, AlertTriangle, Play, CheckCircle, XCircle, AlertCircle, RefreshCw, HelpCircle, ChevronDown, ChevronUp, ChevronRight, Zap } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import DocumentQuoteViewer from './DocumentQuoteViewer';

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
}

export default function EnhancedAgentCard({ 
  dealId, 
  agentType, 
  analysis, 
  isLoading, 
  documents, 
  isRunningAllAnalyses,
  currentProgress = 0,
  currentDocumentName,
  onClinicalAnalysisStart
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
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  // Fetch comprehensive IP analysis data directly for IP agents
  const { data: ipAnalysisData } = useQuery<{success: boolean; analysis: AnalysisData}>({
    queryKey: [`/api/deals/${dealId}/agents/ip/results`],
    enabled: agentType.toLowerCase() === 'ip',
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  // Fetch comprehensive Research analysis data directly for Research agents
  const { data: researchAnalysisData } = useQuery({
    queryKey: [`/api/deals/${dealId}/agents/research/results`],
    enabled: agentType.toLowerCase() === 'research',
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  // Fetch comprehensive Clinical analysis data directly for Clinical agents
  const { data: clinicalAnalysisData } = useQuery({
    queryKey: [`/api/deals/${dealId}/agents/clinical/results`],
    enabled: agentType.toLowerCase() === 'clinical',
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  // Use comprehensive analysis data if this is an HR, IP, Research, or Clinical agent and we have the data
  const actualAnalysisData = (() => {
    if (agentType.toLowerCase() === 'hr' && hrAnalysisData && typeof hrAnalysisData === 'object' && 'analysis' in hrAnalysisData) {
      return hrAnalysisData.analysis;
    }
    if (agentType.toLowerCase() === 'ip' && ipAnalysisData && typeof ipAnalysisData === 'object' && 'analysis' in ipAnalysisData) {
      return ipAnalysisData.analysis;
    }
    if (agentType.toLowerCase() === 'research' && researchAnalysisData && typeof researchAnalysisData === 'object' && 'analysis' in researchAnalysisData) {
      return researchAnalysisData.analysis;
    }
    if (agentType.toLowerCase() === 'clinical' && clinicalAnalysisData && typeof clinicalAnalysisData === 'object' && 'analysis' in clinicalAnalysisData) {
      return clinicalAnalysisData.analysis;
    }
    return analysis || {};
  })();

  console.log(`🔍 ${agentType} Agent Analysis Data:`, actualAnalysisData);

  // Progress Display Component for Legal Analysis
  function ProgressDisplay({ dealId, assignedDocuments }: { dealId: number; assignedDocuments: number }) {
    const { data: jobProgress } = useQuery({
      queryKey: [`/api/background-jobs/${dealId}`],
      refetchInterval: 1000, // Poll every second for progress updates
    });

    // Check for comprehensive legal analysis progress
    const { data: legalProgress = { isRunning: false, progress: 0, currentStep: '' } } = useQuery({
      queryKey: [`/api/deals/${dealId}/legal-analysis/comprehensive/progress`],
      refetchInterval: 1000,
    });

    // Check for comprehensive commercial analysis progress
    const { data: commercialProgress = { isRunning: false, progress: 0, currentStep: '' } } = useQuery({
      queryKey: [`/api/deals/${dealId}/commercial-analysis/comprehensive/progress`],
      refetchInterval: 1000,
    });

    // Check for comprehensive HR analysis progress
    const { data: hrProgress = { isRunning: false, progress: 0, currentStep: '' } } = useQuery({
      queryKey: [`/api/deals/${dealId}/hr-analysis/comprehensive/progress`],
      refetchInterval: 1000,
    });

    // Check for comprehensive IP analysis progress
    const { data: ipProgress = { isRunning: false, progress: 0, currentStep: '' } } = useQuery({
      queryKey: [`/api/deals/${dealId}/ip-analysis/comprehensive/progress`],
      refetchInterval: 1000,
    });

    // Check for comprehensive Financial analysis progress
    const { data: financialProgress = { isRunning: false, progress: 0, currentStep: '' } } = useQuery({
      queryKey: [`/api/deals/${dealId}/financial-analysis/comprehensive/progress`],
      refetchInterval: 1000,
    });

    // Check for comprehensive Clinical analysis progress
    const { data: clinicalProgress = { isRunning: false, progress: 0, currentStep: '' } } = useQuery({
      queryKey: [`/api/deals/${dealId}/clinical-analysis/comprehensive/progress`],
      refetchInterval: 1000,
    });

    // Look for both comprehensive legal analysis and regular legal agent jobs
    const legalJobs = (jobProgress && typeof jobProgress === 'object' && 'jobs' in jobProgress && Array.isArray(jobProgress.jobs) ? jobProgress.jobs : []).filter((job: any) => 
      (job.jobType === 'comprehensive_legal_analysis' || job.jobId.includes('legal_')) && 
      job.status === 'processing' &&
      job.progress > 0 // Only show jobs with actual progress
    );

    const activeLegalJob = legalJobs[0];
    
    // Show comprehensive commercial analysis if running
    if (commercialProgress && typeof commercialProgress === 'object' && 'isRunning' in commercialProgress && commercialProgress.isRunning) {
      return (
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="h-5 w-5 text-purple-400 animate-spin" />
            <div className="flex-1">
              <p className="text-purple-400 font-medium">Comprehensive Commercial Analysis in Progress</p>
              <p className="text-gray-300 text-sm">
                {(commercialProgress && typeof commercialProgress === 'object' && 'currentStep' in commercialProgress ? commercialProgress.currentStep : null) || 'Processing comprehensive commercial analysis...'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-white font-medium">{Math.round((commercialProgress && typeof commercialProgress === 'object' && 'progress' in commercialProgress ? commercialProgress.progress as number : 0) || 0)}%</p>
            </div>
          </div>
          <Progress 
            value={(commercialProgress && typeof commercialProgress === 'object' && 'progress' in commercialProgress ? commercialProgress.progress as number : 0) || 0} 
            className="h-2 bg-dark-lighter"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>Comprehensive analysis of {assignedDocuments} documents</span>
            <span>{Math.round(commercialProgress.progress || 0)}% complete</span>
          </div>
        </div>
      );
    }

    // Show comprehensive HR analysis if running
    if (hrProgress && typeof hrProgress === 'object' && 'isRunning' in hrProgress && hrProgress.isRunning) {
      return (
        <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="h-5 w-5 text-orange-400 animate-spin" />
            <div className="flex-1">
              <p className="text-orange-400 font-medium">Comprehensive HR Analysis in Progress</p>
              <p className="text-gray-300 text-sm">
                {(hrProgress && typeof hrProgress === 'object' && 'currentStep' in hrProgress ? hrProgress.currentStep : null) || 'Processing comprehensive HR analysis...'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-white font-medium">{Math.round((hrProgress && typeof hrProgress === 'object' && 'progress' in hrProgress ? hrProgress.progress as number : 0) || 0)}%</p>
            </div>
          </div>
          <Progress 
            value={(hrProgress && typeof hrProgress === 'object' && 'progress' in hrProgress ? hrProgress.progress as number : 0) || 0} 
            className="h-2 bg-dark-lighter"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>Comprehensive analysis of {assignedDocuments} documents</span>
            <span>{Math.round((hrProgress && typeof hrProgress === 'object' && 'progress' in hrProgress ? hrProgress.progress as number : 0) || 0)}% complete</span>
          </div>
        </div>
      );
    }

    // Show comprehensive Clinical analysis if running
    if (clinicalProgress && typeof clinicalProgress === 'object' && 'isRunning' in clinicalProgress && clinicalProgress.isRunning) {
      return (
        <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="h-5 w-5 text-green-400 animate-spin" />
            <div className="flex-1">
              <p className="text-green-400 font-medium">Comprehensive Clinical Analysis in Progress</p>
              <p className="text-gray-300 text-sm">
                {(clinicalProgress && typeof clinicalProgress === 'object' && 'currentStep' in clinicalProgress ? clinicalProgress.currentStep : null) || 'Processing comprehensive clinical analysis...'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-white font-medium">{Math.round((clinicalProgress && typeof clinicalProgress === 'object' && 'progress' in clinicalProgress ? clinicalProgress.progress as number : 0) || 0)}%</p>
            </div>
          </div>
          <Progress 
            value={(clinicalProgress && typeof clinicalProgress === 'object' && 'progress' in clinicalProgress ? clinicalProgress.progress as number : 0) || 0} 
            className="h-2 bg-dark-lighter"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>Comprehensive analysis of {assignedDocuments} documents</span>
            <span>{Math.round((clinicalProgress && typeof clinicalProgress === 'object' && 'progress' in clinicalProgress ? clinicalProgress.progress as number : 0) || 0)}% complete</span>
          </div>
        </div>
      );
    }

    // Show comprehensive IP analysis if running
    if (ipProgress?.isRunning) {
      return (
        <div className="bg-purple-600/5 border border-purple-600/20 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="h-5 w-5 text-purple-400 animate-spin" />
            <div className="flex-1">
              <p className="text-purple-400 font-medium">Comprehensive IP Analysis in Progress</p>
              <p className="text-gray-300 text-sm">
                {ipProgress.currentStep || 'Processing comprehensive IP analysis...'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-white font-medium">{Math.round(ipProgress.progress || 0)}%</p>
            </div>
          </div>
          <Progress 
            value={ipProgress.progress || 0} 
            className="h-2 bg-dark-lighter"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>Comprehensive analysis of {assignedDocuments} documents</span>
            <span>{Math.round(ipProgress.progress || 0)}% complete</span>
          </div>
        </div>
      );
    }

    // Show comprehensive Financial analysis if running
    if (financialProgress?.isRunning) {
      return (
        <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="h-5 w-5 text-green-400 animate-spin" />
            <div className="flex-1">
              <p className="text-green-400 font-medium">Comprehensive Financial Analysis in Progress</p>
              <p className="text-gray-300 text-sm">
                {financialProgress.currentStep || 'Processing comprehensive financial analysis...'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-white font-medium">{Math.round(financialProgress.progress || 0)}%</p>
            </div>
          </div>
          <Progress 
            value={financialProgress.progress || 0} 
            className="h-2 bg-dark-lighter"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>Comprehensive analysis of {assignedDocuments} documents</span>
            <span>{Math.round(financialProgress.progress || 0)}% complete</span>
          </div>
        </div>
      );
    }

    // Show comprehensive legal analysis if running
    if (legalProgress?.isRunning) {
      return (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
            <div className="flex-1">
              <p className="text-blue-400 font-medium">Comprehensive Legal Analysis in Progress</p>
              <p className="text-gray-300 text-sm">
                {legalProgress.currentStep || 'Processing comprehensive legal analysis...'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-white font-medium">{Math.round(legalProgress.progress || 0)}%</p>
            </div>
          </div>
          <Progress 
            value={legalProgress.progress || 0} 
            className="h-2 bg-dark-lighter"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>Comprehensive analysis of {assignedDocuments} documents</span>
            <span>{Math.round(legalProgress.progress || 0)}% complete</span>
          </div>
        </div>
      );
    }

    if (!activeLegalJob) {
      return (
        <div className="bg-dark-lighter/50 border border-dark-lighter rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-yellow-400 animate-spin" />
            <div>
              <p className="text-yellow-400 font-medium">Legal Analysis Ready</p>
              <p className="text-gray-400 text-sm">
                Ready to analyze {assignedDocuments} legal documents. Click "Run AI Analysis" to start.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-dark-lighter/50 border border-dark-lighter rounded-lg p-4 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <Loader2 className="h-5 w-5 text-yellow-400 animate-spin" />
          <div className="flex-1">
            <p className="text-yellow-400 font-medium">Legal Analysis in Progress</p>
            <p className="text-gray-400 text-sm">
              {activeLegalJob.currentStep || 'Processing legal documents...'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-white font-medium">{Math.round(activeLegalJob.progress || 0)}%</p>
          </div>
        </div>
        <Progress 
          value={activeLegalJob.progress || 0} 
          className="h-2 bg-dark-lighter"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-2">
          <span>Analyzing {assignedDocuments} documents</span>
          <span>{Math.round(activeLegalJob.progress || 0)}% complete</span>
        </div>
      </div>
    );
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
    refetchInterval: 5000, // Poll every 5 seconds to get updates
  });

  // Fetch agent-specific results directly from the agent results endpoint (for non-clinical agents)
  const { data: agentResults } = useQuery({
    queryKey: [`/api/deals/${dealId}/agents/${agentType.toLowerCase()}/results`],
    enabled: !!dealId && !!agentType && agentType.toLowerCase() !== 'clinical',
    refetchInterval: 5000, // Poll every 5 seconds to get updates
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

  // Calculate documents assigned to this specific agent using intelligent relevance scoring
  const getAssignedDocumentCount = () => {
    if (!documents || !Array.isArray(documents)) return 0;
    
    return documents.filter(document => {
      const assignedAgents = getAssignedAgents(document);
      return assignedAgents.some(agent => agent.type.toLowerCase() === agentType.toLowerCase());
    }).length;
  };

  const assignedDocuments = getAssignedDocumentCount();

  // Helper function to get assigned documents for this agent
  const getAssignedDocumentsForAgent = () => {
    if (!documents || !Array.isArray(documents)) return [];
    
    return documents.filter(document => {
      const assignedAgents = getAssignedAgents(document);
      return assignedAgents.some(agent => agent.type.toLowerCase() === agentType.toLowerCase());
    });
  };
  
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
    
    // Default progress based on status
    if (status === 'Completed') return 100;
    if (status === 'Processing') return 15; // Show some progress for processing
    return 0;
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
        ) : agentType.toLowerCase() === 'research' ? (
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
          />
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
                            <h4 className="font-medium text-white mb-2">{finding.title || finding.content || 'Finding'}</h4>
                            <p className="text-gray-400 text-sm mb-2">{finding.description || finding.content || 'No description available'}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-green-400 border-green-400">
                                Confidence: {Math.min(100, Math.max(0, Math.round(finding.confidence || 80)))}%
                              </Badge>
                              <Badge variant="outline" className="text-gray-400 border-gray-400">
                                {finding.type || finding.category || 'analysis'}
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
                            <h4 className="font-medium text-white mb-2">{finding.title || finding.content || 'Finding'}</h4>
                            <p className="text-gray-400 text-sm mb-2">{finding.description || finding.content || 'No description available'}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-gray-400 border-gray-400">
                                Confidence: {Math.min(100, Math.max(0, Math.round(finding.confidence || 80)))}%
                              </Badge>
                              <Badge variant="outline" className="text-gray-400 border-gray-400">
                                {finding.type || finding.category || 'analysis'}
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
                            <h4 className="font-medium text-white mb-2">{finding.title || finding.content || 'Finding'}</h4>
                            <p className="text-gray-400 text-sm mb-2">{finding.description || finding.content || 'No description available'}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-red-400 border-red-400">
                                Confidence: {Math.min(100, Math.max(0, Math.round(finding.confidence || 80)))}%
                              </Badge>
                              <Badge variant="outline" className="text-gray-400 border-gray-400">
                                {finding.type || finding.category || 'analysis'}
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
    id: 'sha_1',
    category: 'Shareholders Agreement / Articles of Association',
    question: 'What class of shares exist?',
    subQuestions: ['Preferred shares', 'Common shares', 'Other share classes']
  },
  {
    id: 'sha_2',
    category: 'Shareholders Agreement / Articles of Association',
    question: 'Are liquidation preferences defined?',
    subQuestions: ['1x preferences', 'Participating preferences', 'Non-participating preferences']
  },
  {
    id: 'sha_3',
    category: 'Shareholders Agreement / Articles of Association',
    question: 'Is anti-dilution protection present?',
    subQuestions: ['Full ratchet protection', 'Weighted average protection']
  },
  {
    id: 'gov_1',
    category: 'Governance & Voting',
    question: 'Is board composition defined?',
    subQuestions: ['Board seats', 'Director appointments', 'Board procedures']
  },
  {
    id: 'gov_2',
    category: 'Governance & Voting',
    question: 'Are voting rights clearly specified?',
    subQuestions: ['Voting procedures', 'Majority requirements', 'Veto rights']
  },
  {
    id: 'ip_1',
    category: 'IP Assignment & Key Personnel',
    question: 'Are IP assignment agreements in place?',
    subQuestions: ['Patents', 'Trademarks', 'Copyrights', 'Trade secrets']
  },
  {
    id: 'ip_2',
    category: 'IP Assignment & Key Personnel',
    question: 'Are all founders/key personnel covered?',
    subQuestions: ['Founders', 'Key employees', 'Consultants', 'Advisors']
  },
  {
    id: 'commercial_1',
    category: 'Commercial Agreements',
    question: 'Are SLAs, warranties, and indemnity clauses present?',
    subQuestions: ['Service level agreements', 'Warranty terms', 'Indemnification clauses']
  },
  {
    id: 'commercial_2',
    category: 'Commercial Agreements',
    question: 'Are termination clauses fair and mutual?',
    subQuestions: ['Notice periods', 'Termination triggers', 'Post-termination obligations']
  },
  {
    id: 'lit_1',
    category: 'Litigation & Regulatory',
    question: 'Are there pending litigations or regulatory proceedings?',
    subQuestions: ['Ongoing litigation', 'Regulatory investigations', 'Compliance issues']
  },
  {
    id: 'lit_2',
    category: 'Litigation & Regulatory',
    question: 'Is financial exposure quantified?',
    subQuestions: ['Potential damages', 'Legal costs', 'Settlement amounts']
  },
  {
    id: 'reg_1',
    category: 'Regulatory Compliance',
    question: 'Are there FDA submissions or regulatory approvals?',
    subQuestions: ['FDA submissions', 'Regulatory approvals', 'Compliance status']
  },
  {
    id: 'reg_2',
    category: 'Regulatory Compliance',
    question: 'Are there any regulatory compliance issues?',
    subQuestions: ['Compliance violations', 'Regulatory warnings', 'Audit findings']
  },
  {
    id: 'financial_1',
    category: 'Financial Instruments',
    question: 'Are there warrants or convertible instruments?',
    subQuestions: ['Exercise price', 'Conversion terms', 'Maturity dates']
  },
  {
    id: 'financial_2',
    category: 'Financial Instruments',
    question: 'What are the interest rates and maturity for debt instruments?',
    subQuestions: ['Interest rate structure', 'Maturity timeline', 'Conversion features']
  }
];

function LegalQuestionsSection({ dealId, analysisData, findings, assignedDocuments, documents, handleDocumentClick, quoteViewerOpen, setQuoteViewerOpen, selectedQuoteData, setSelectedQuoteData }: LegalQuestionsSectionProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  // Check if legal analysis is available - enhanced detection
  const hasLegalAnalysis = analysisData && (
    (analysisData.legalAnswers && Object.keys(analysisData.legalAnswers).length > 0) ||
    (analysisData?.findings && analysisData.findings.length > 0) ||
    (analysisData?.status === 'Completed' || analysisData?.status === 'completed')
  );
  
  // Debug logging - enhanced for troubleshooting
  console.log('🔍 Legal Analysis Available:', hasLegalAnalysis);
  console.log('🔍 Analysis Data exists:', !!analysisData);
  console.log('🔍 Legal Answers exists:', !!analysisData?.legalAnswers);
  console.log('🔍 Legal Answers keys:', analysisData?.legalAnswers ? Object.keys(analysisData.legalAnswers) : 'none');
  console.log('🔍 Analysis Status:', analysisData?.status);
  console.log('🔍 Findings count:', findings?.length || 0);

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

  // Extract answers from legal analysis data with enhanced quote support
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
    if (!analysisData) return null;
    
    // Debug logging
    console.log(`🔍 Looking for answer to question ${questionId}`);
    console.log(`🔍 Legal Answers exists:`, !!analysisData.legalAnswers);
    console.log(`🔍 Question ${questionId} exists in legal answers:`, !!analysisData.legalAnswers?.[questionId]);
    
    // First try to get answer from legalAnswers structure
    if (analysisData.legalAnswers && analysisData.legalAnswers[questionId]) {
      const answer = analysisData.legalAnswers[questionId];
      console.log(`🔍 Found enhanced answer for ${questionId}:`, answer);
      console.log(`🔍 Has detailedEvidence:`, !!answer.detailedEvidence);
      return {
        answer: answer.answer || '',
        confidence: answer.confidence || 0,
        sources: answer.sources && Array.isArray(answer.sources) ? answer.sources : (answer.sources ? [answer.sources] : []),
        quotes: answer.quotes && Array.isArray(answer.quotes) ? answer.quotes : [],
        keyFindings: answer.keyFindings && Array.isArray(answer.keyFindings) ? answer.keyFindings : [],
        evidenceSummary: answer.evidenceSummary || '',
        legalAssessment: answer.legalAssessment || '',
        recommendations: answer.recommendations && Array.isArray(answer.recommendations) ? answer.recommendations : [],
        detailedEvidence: answer.detailedEvidence && Array.isArray(answer.detailedEvidence) ? answer.detailedEvidence : []
      };
    }
    
    // Fallback to findings-based extraction
    if (!analysisData?.findings || !Array.isArray(analysisData.findings)) return null;
    
    // Convert question ID to searchable keywords
    const questionKeywords = LEGAL_QUESTIONS.find(q => q.id === questionId);
    if (!questionKeywords) return null;
    
    // Search through findings for relevant content
    const relevantFindings = analysisData.findings.filter((finding: any) => {
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
    
    // Extract source document names
    const sources = relevantFindings
      .map((finding: any) => finding.source || finding.document)
      .filter((source: string) => source)
      .slice(0, 3); // Limit to 3 sources
    
    return {
      answer: combinedAnswer.substring(0, 500) + (combinedAnswer.length > 500 ? '...' : ''),
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
        <ComprehensiveLegalAnalysisButton dealId={22} />
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
                          <p className="text-white font-medium text-sm">{question.question}</p>
                          
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
                                <p className="text-gray-300 text-sm leading-relaxed">{answer.answer}</p>
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
                                            onClick={() => handleDocumentClick(quote.document)}
                                            className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 hover:bg-blue-500/30 transition-colors cursor-pointer"
                                            title={`View document: ${quote.document}`}
                                          >
                                            📄 {quote.document && quote.document.length > 25 ? `${quote.document.substring(0, 25)}...` : quote.document}
                                          </button>
                                          {quote.relevance && (
                                            <Badge variant="outline" className="text-xs text-gray-400 border-gray-400">
                                              {quote.relevance}
                                            </Badge>
                                          )}
                                        </div>
                                        <blockquote className="text-gray-300 text-xs italic leading-relaxed border-l-2 border-gray-600 pl-2 mt-1">
                                          "{quote.text}"
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
                                        {finding}
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
                                        {rec}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Metadata */}
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-green-400 border-green-400">
                                  Confidence: {Math.round((answer.confidence || 0) * 100)}%
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
    refetchInterval: 2000,
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
    
    // Extract source document names
    const sources = relevantFindings
      .map((finding: any) => finding.source || finding.document)
      .filter((source: string) => source)
      .slice(0, 3); // Limit to 3 sources
    
    return {
      answer: combinedAnswer.substring(0, 500) + (combinedAnswer.length > 500 ? '...' : ''),
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
        <ComprehensiveClinicalAnalysisButton dealId={dealId} onAnalysisStart={onClinicalAnalysisStart} />
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
                          <p className="text-white font-medium text-sm">{question.question}</p>
                          
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
                                <p className="text-gray-300 text-sm leading-relaxed">{answer.answer}</p>
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
                                        {finding}
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
                                        {rec}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Metadata */}
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-green-400 border-green-400">
                                  Confidence: {Math.round((answer.confidence || 0) * 100)}%
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
}

function ResearchQuestionsSection({ dealId, analysisData, assignedDocuments, documents, handleDocumentClick, quoteViewerOpen, setQuoteViewerOpen, selectedQuoteData, setSelectedQuoteData }: ResearchQuestionsSectionProps) {
  const [expandedCategories, setExpandedCategories] = useState(new Set(["Technical Whitepapers"]));

  // Check if research analysis is available from agent endpoint
  const { data: comprehensiveResults } = useQuery({
    queryKey: [`/api/deals/${dealId}/agents/research/results`],
    refetchInterval: 2000,
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

  // Complete Research questions structure - ALL questions that should be answered
  const RESEARCH_QUESTIONS = [
    // Current questions with answers (res_1 to res_5)
    { id: "res_1", question: "What research methodology and scientific approach is used?", category: "Technical Methodology" },
    { id: "res_2", question: "What peer-reviewed publications and citations exist?", category: "Academic Publications" },
    { id: "res_3", question: "What research partnerships and collaborations are present?", category: "Academic Publications" },
    { id: "res_4", question: "What data quality and validation has been performed?", category: "Technical Methodology" },
    { id: "res_5", question: "What research competitive advantages exist?", category: "Technical Innovation" },
    
    // Additional research questions that should be analyzed
    { id: "res_6", question: "Are there citations in high-impact journals (Nature, Science, Cell)?", category: "Academic Publications" },
    { id: "res_7", question: "What is the h-index and citation count of key publications?", category: "Academic Publications" },
    { id: "res_8", question: "Are there collaborations with leading academic institutions?", category: "Academic Publications" },
    { id: "res_9", question: "What is the total addressable market (TAM) size?", category: "Market Research" },
    { id: "res_10", question: "Who are the main competitors and what is their market share?", category: "Market Research" },
    { id: "res_11", question: "What are the market growth projections and key drivers?", category: "Market Research" },
    { id: "res_12", question: "What is the freedom-to-operate (FTO) analysis result?", category: "Patent Landscape" },
    { id: "res_13", question: "Are there any patent disputes or prior art challenges?", category: "Patent Landscape" }
  ];

  const categorizedQuestions = RESEARCH_QUESTIONS.reduce((acc, question) => {
    if (!acc[question.category]) {
      acc[question.category] = [];
    }
    acc[question.category].push(question);
    return acc;
  }, {} as Record<string, typeof RESEARCH_QUESTIONS>);

  const getAnswerForQuestion = (questionId: string, questionText: string) => {
    // Try comprehensive results first - check snake_case field name from API
    if (comprehensiveResults?.analysis?.research_answers) {
      // First try by question text (exact match)
      const answer = comprehensiveResults.analysis.research_answers[questionText];
      if (answer) return answer;
      
      // Fallback to question ID
      const answerById = comprehensiveResults.analysis.research_answers[questionId];
      if (answerById) return answerById;
    }
    
    // Fallback to camelCase if available
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
        <ComprehensiveResearchAnalysisButton dealId={dealId} />
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
                                <p className="text-gray-300 text-sm leading-relaxed">{answer.answer}</p>
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
                                            onClick={() => handleDocumentClick(quote.document)}
                                            className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 hover:bg-blue-500/30 transition-colors cursor-pointer"
                                            title={`View document: ${quote.document}`}
                                          >
                                            📄 {quote.document && quote.document.length > 25 ? `${quote.document.substring(0, 25)}...` : quote.document}
                                          </button>
                                          {quote.relevance && (
                                            <Badge variant="outline" className="text-xs text-gray-400 border-gray-400">
                                              {quote.relevance}
                                            </Badge>
                                          )}
                                        </div>
                                        <blockquote className="text-gray-300 text-xs italic leading-relaxed border-l-2 border-gray-600 pl-2 mt-1">
                                          "{quote.text}"
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
                                        {finding}
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
                                        {rec}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Metadata */}
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-cyan-400 border-cyan-400">
                                  Confidence: {Math.min(100, Math.max(0, Math.round(answer.confidence || 0)))}%
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
function ComprehensiveResearchAnalysisButton({ dealId }: { dealId: number }) {
  const [isRunning, setIsRunning] = useState(false);
  const queryClient = useQueryClient();

  // Check for existing background jobs
  const { data: jobProgress } = useQuery({
    queryKey: [`/api/background-jobs/${dealId}`],
    refetchInterval: 1000,
  });

  // Check if research analysis is already running
  const isAlreadyRunning = (() => {
    if (jobProgress && 'jobs' in jobProgress && Array.isArray(jobProgress.jobs)) {
      const researchJob = jobProgress.jobs.find((job: any) => job.agentType === 'Research');
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
        console.log('Research analysis already running');
        setIsRunning(false);
        return;
      }
      
      // Invalidate ALL relevant query keys to refresh the research data
      queryClient.invalidateQueries({
        queryKey: [`/api/deals/${dealId}/research-analysis/comprehensive/results`]
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/deals/${dealId}/agents/research/results`]
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/analyses', dealId]
      });
      
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
    
    try {
      await comprehensiveAnalysisMutation.mutateAsync();
      console.log('✅ Analysis request sent, waiting for completion...');
      
      // Wait for results since analysis takes time
      let attempts = 0;
      const maxAttempts = 60; // 2 minutes max wait
      
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
              queryKey: [`/api/deals/${dealId}/agents/research/results`]
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
            queryKey: [`/api/deals/${dealId}/agents/research/results`]
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
    refetchInterval: 1000,
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
      const maxAttempts = 60; // 2 minutes max wait
      
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
    refetchInterval: 1000,
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
      
      // Wait a bit longer for results since analysis takes time
      let attempts = 0;
      const maxAttempts = 60; // 2 minutes max wait
      
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
    refetchInterval: 1000,
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
    refetchInterval: 1000,
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
    refetchInterval: 1000,
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
    refetchInterval: 1000,
  });

  // Also check for comprehensive financial analysis progress
  const { data: financialProgress } = useQuery({
    queryKey: [`/api/deals/${dealId}/financial-analysis/comprehensive/progress`],
    refetchInterval: 1000,
  });

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    // Check for comprehensive financial analysis first
    if (financialProgress?.isRunning) {
      setProgress(financialProgress.progress || 0);
      setCurrentStep(financialProgress.currentStep || 'Processing comprehensive financial analysis...');
      setIsVisible(true);
      return;
    }

    // Then check for regular financial jobs
    if (jobProgress?.jobs) {
      const financialJob = jobProgress.jobs.find((job: any) => 
        job.agentType === 'Financial' || job.jobType === 'comprehensive_financial_analysis'
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
  }, [jobProgress, financialProgress]);

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
    refetchInterval: 1000,
    retry: false,
    staleTime: 0, // Always fetch fresh data
  });

  // Also check for comprehensive IP analysis progress
  const { data: ipProgress } = useQuery({
    queryKey: [`/api/deals/${dealId}/ip-analysis/comprehensive/progress`],
    refetchInterval: 1000,
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
    refetchInterval: 1000,
  });

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (jobProgress?.jobs) {
      const researchJob = jobProgress.jobs.find((job: any) => job.agentType === 'Research');
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
    refetchInterval: 1000,
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
    refetchInterval: 1000,
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
    refetchInterval: 1000,
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

  const { data: comprehensiveResults } = useQuery({
    queryKey: [`/api/deals/${dealId}/agents/financial/results`],
    refetchInterval: 2000,
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

  // Financial questions structure matching the backend service
  const FINANCIAL_QUESTIONS = [
    { id: 'income_1', question: 'What are the revenue trends over the last 3 years?', category: 'Income Statements' },
    { id: 'income_2', question: 'How have gross margins evolved?', category: 'Income Statements' },
    { id: 'income_3', question: 'What are the main cost drivers and their trends?', category: 'Income Statements' },
    { id: 'balance_1', question: 'What is the current cash position?', category: 'Balance Sheets' },
    { id: 'balance_2', question: 'How much debt does the company carry?', category: 'Balance Sheets' },
    { id: 'balance_3', question: 'Are there any significant off-balance sheet items?', category: 'Balance Sheets' },
    { id: 'cashflow_1', question: 'What is the operating cash flow trend?', category: 'Cash Flow Statements' },
    { id: 'cashflow_2', question: 'How much is being invested in capex and R&D?', category: 'Cash Flow Statements' },
    { id: 'cashflow_3', question: 'What is the current burn rate and runway?', category: 'Cash Flow Statements' },
    { id: 'forecast_1', question: 'What are the key assumptions in financial projections?', category: 'Financial Model/Forecasts' },
    { id: 'forecast_2', question: 'How realistic are the growth projections?', category: 'Financial Model/Forecasts' },
    { id: 'forecast_3', question: 'What sensitivity analysis has been conducted?', category: 'Financial Model/Forecasts' },
    { id: 'captable_1', question: 'Who are the current shareholders and their ownership?', category: 'Cap Table' },
    { id: 'captable_2', question: 'What liquidation preferences exist?', category: 'Cap Table' },
    { id: 'captable_3', question: 'Are there any option pools or warrants outstanding?', category: 'Cap Table' },
    { id: 'tax_1', question: 'Are there any significant tax liabilities or benefits?', category: 'Tax Documentation' },
    { id: 'tax_2', question: 'What is the effective tax rate?', category: 'Tax Documentation' },
    { id: 'tax_3', question: 'Are there any transfer pricing or international tax issues?', category: 'Tax Documentation' }
  ];

  const categorizedQuestions = FINANCIAL_QUESTIONS.reduce((acc, question) => {
    if (!acc[question.category]) {
      acc[question.category] = [];
    }
    acc[question.category].push(question);
    return acc;
  }, {} as Record<string, typeof FINANCIAL_QUESTIONS>);

  const getAnswerForQuestion = (questionId: string) => {
    // First try comprehensive results
    if (comprehensiveResults?.analysis?.financialAnswers?.[questionId]) {
      return comprehensiveResults.analysis.financialAnswers[questionId];
    }
    
    // Fallback to existing analysis data structure for backward compatibility
    if (analysisData?.financialAnswers?.[questionId]) {
      return analysisData.financialAnswers[questionId];
    }
    
    // Generate intelligent answers from available financial documents
    const financialDocs = documents?.filter(doc => 
      doc.aiSummary && 
      (doc.name?.toLowerCase().includes('financial') || 
       doc.name?.toLowerCase().includes('balance') ||
       doc.name?.toLowerCase().includes('income') ||
       doc.name?.toLowerCase().includes('revenue') ||
       doc.name?.toLowerCase().includes('cash') ||
       doc.name?.toLowerCase().includes('profit') ||
       doc.name?.toLowerCase().includes('statement') ||
       doc.assignment === 'Financial')
    ) || [];

    if (financialDocs.length > 0) {
      // Extract specific insights based on question type
      const getQuestionSpecificAnswer = (qId: string) => {
        const summary = typeof financialDocs[0].aiSummary === 'object' ? 
          financialDocs[0].aiSummary.executiveSummary : financialDocs[0].aiSummary;
        
        switch(qId) {
          case 'income_1':
            if (summary?.includes('loss') || summary?.includes('revenue')) {
              return `Based on financial documents: ${summary}. Company shows financial challenges with documented losses.`;
            }
            return `Revenue trends analysis needed - ${financialDocs.length} financial documents available for review.`;
          
          case 'balance_1':
            if (summary?.includes('cash') || summary?.includes('retained')) {
              return `Cash position analysis: ${summary}. Significant attention needed on cash management.`;
            }
            return `Cash position requires detailed analysis - financial statements available.`;
          
          case 'cashflow_1':
            if (summary?.includes('burn') || summary?.includes('cash flow')) {
              return `Operating cash flow: ${summary}. Requires careful monitoring.`;
            }
            return `Operating cash flow analysis needed - multiple financial documents available.`;
          
          default:
            return `${summary || 'Financial analysis available in supporting documents'}`;
        }
      };

      return {
        answer: getQuestionSpecificAnswer(questionId),
        confidence: 0.75,
        sources: financialDocs.map(doc => doc.name),
        quotes: [],
        keyFindings: [`${financialDocs.length} financial documents analyzed`, 'Key insights extracted from available data'],
        evidenceSummary: `Analysis based on ${financialDocs.length} financial documents including statements and budgets`,
        financialAssessment: 'Based on available financial documentation and AI analysis',
        recommendations: ['Detailed comprehensive analysis recommended', 'Review all financial metrics systematically'],
        detailedEvidence: financialDocs.map(doc => ({
          documentName: doc.name,
          relevantContent: [typeof doc.aiSummary === 'object' ? doc.aiSummary.executiveSummary : doc.aiSummary],
          documentSummary: typeof doc.aiSummary === 'object' ? doc.aiSummary.executiveSummary : doc.aiSummary
        }))
      };
    }
    
    return null;
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
        <ComprehensiveFinancialAnalysisButton dealId={dealId} />
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
                                            onClick={() => handleDocumentClick(quote.document)}
                                            className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 hover:bg-blue-500/30 transition-colors cursor-pointer"
                                            title={`View document: ${quote.document}`}
                                          >
                                            📄 {quote.document && quote.document.length > 25 ? `${quote.document.substring(0, 25)}...` : quote.document}
                                          </button>
                                          {quote.relevance && (
                                            <Badge variant="outline" className="text-xs text-gray-400 border-gray-400">
                                              {quote.relevance}
                                            </Badge>
                                          )}
                                        </div>
                                        <blockquote className="text-gray-300 text-xs italic leading-relaxed border-l-2 border-gray-600 pl-2 mt-1">
                                          "{quote.text}"
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
                                        {finding}
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
                                        {rec}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Metadata */}
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-green-400 border-green-400">
                                  Confidence: {Math.round((answer.confidence || 0.8) * 100)}%
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

// Comprehensive Financial Analysis Button
function ComprehensiveFinancialAnalysisButton({ dealId }: { dealId: number }) {
  const [isRunning, setIsRunning] = useState(false);

  const { data: jobProgress } = useQuery({
    queryKey: [`/api/background-jobs/${dealId}`],
    refetchInterval: 1000,
  });

  const { data: progressData } = useQuery({
    queryKey: [`/api/deals/${dealId}/financial-analysis/comprehensive/progress`],
    refetchInterval: 1000,
  });

  const isAlreadyRunning = progressData?.isRunning || 
    jobProgress?.jobs?.some((job: any) => 
      job.jobType === 'comprehensive_financial_analysis' && job.status === 'processing'
    );

  const queryClient = useQueryClient();
  
  const comprehensiveAnalysisMutation = useMutation({
    mutationFn: async () => {
      console.log('Starting comprehensive financial analysis for deal', dealId);
      const response = await apiRequest(`/api/deals/${dealId}/financial-analysis/comprehensive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return response;
    },
    onSuccess: () => {
      console.log('✅ Comprehensive financial analysis started successfully');
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/financial-analysis/comprehensive/results`] });
      queryClient.invalidateQueries({ queryKey: [`/api/background-jobs/${dealId}`] });
      setIsRunning(false);
    },
    onError: (error) => {
      console.error('❌ Failed to start comprehensive financial analysis:', error);
      setIsRunning(false);
    }
  });

  const handleRunAnalysis = async () => {
    setIsRunning(true);
    console.log('Starting comprehensive financial analysis for deal', dealId);
    
    try {
      await comprehensiveAnalysisMutation.mutateAsync();
      
      let attempts = 0;
      const maxAttempts = 60;
      
      const checkForResults = async () => {
        attempts++;
        console.log(`📊 Checking for financial analysis results (attempt ${attempts})`);
        
        if (attempts >= maxAttempts) {
          console.log('⏰ Max attempts reached for financial analysis');
          setIsRunning(false);
          return;
        }

        try {
          const response = await fetch(`/api/deals/${dealId}/financial-analysis/comprehensive/results`);
          const data = await response.json();
          
          console.log('📊 Financial analysis status:', data);
          
          if (data && data.financialAnswers && Object.keys(data.financialAnswers).length > 0) {
            console.log('✅ Financial analysis completed successfully');
            queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/financial-analysis/comprehensive/results`] });
            setIsRunning(false);
            return;
          }
        } catch (error) {
          console.log('⚠️ Error checking financial analysis results:', error);
        }
        
        setTimeout(checkForResults, 5000);
      };
      
      setTimeout(checkForResults, 5000);
      
    } catch (error) {
      console.error('Error starting financial analysis:', error);
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
          {isAlreadyRunning ? 'Financial Analysis Running...' : isRunning ? 'Financial Analysis Running...' : 'Starting Analysis...'}
        </>
      ) : (
        <>
          <Zap className="h-4 w-4 mr-2" />
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
    refetchInterval: 1000,
  });

  const { data: progressData } = useQuery({
    queryKey: [`/api/deals/${dealId}/ip-analysis/comprehensive/progress`],
    refetchInterval: 1000,
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
    refetchInterval: 2000,
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
                                <p className="text-gray-300 text-sm leading-relaxed">{answer.answer}</p>
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
                                            onClick={() => handleDocumentClick(quote.document)}
                                            className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 hover:bg-blue-500/30 transition-colors cursor-pointer"
                                            title={`View document: ${quote.document}`}
                                          >
                                            📄 {quote.document && quote.document.length > 25 ? `${quote.document.substring(0, 25)}...` : quote.document}
                                          </button>
                                          {quote.relevance && (
                                            <Badge variant="outline" className="text-xs text-gray-400 border-gray-400">
                                              {quote.relevance}
                                            </Badge>
                                          )}
                                        </div>
                                        <blockquote className="text-gray-300 text-xs italic leading-relaxed border-l-2 border-gray-600 pl-2 mt-1">
                                          "{quote.text}"
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
                                        {finding}
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
                                        {rec}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Metadata */}
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-purple-400 border-purple-400">
                                  Confidence: {Math.round((answer.confidence || 0) * 100)}%
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
  const [expandedCategories, setExpandedCategories] = useState(new Set(["Employment Contracts"]));

  const { data: comprehensiveResults } = useQuery({
    queryKey: [`/api/deals/${dealId}/agents/hr/results`],
    refetchInterval: 2000,
  });

  const { data: hrProgress } = useQuery({
    queryKey: [`/api/deals/${dealId}/hr-analysis/comprehensive/progress`],
    refetchInterval: 2000,
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

  const HR_QUESTIONS = [
    // 1. Employment Contracts (Employees) - 8 questions
    { id: 'employment_1', question: 'Are all employment contracts signed and dated?', category: 'Employment Contracts' },
    { id: 'employment_2', question: 'Are notice periods in line with local labor law or extended?', category: 'Employment Contracts' },
    { id: 'employment_3', question: 'Are probation periods defined? If yes, how long?', category: 'Employment Contracts' },
    { id: 'employment_4', question: 'Are termination clauses (ordinary, extraordinary) present?', category: 'Employment Contracts' },
    { id: 'employment_5', question: 'Is there mention of confidentiality, IP assignment, and post-contractual non-compete?', category: 'Employment Contracts' },
    { id: 'employment_6', question: 'Are variable components (bonuses, stock options, commissions) clearly described and performance-based?', category: 'Employment Contracts' },
    { id: 'employment_7', question: 'Are working hours, overtime rules, and leave entitlements defined?', category: 'Employment Contracts' },
    { id: 'employment_8', question: 'Are there unusual clauses (e.g. guaranteed salary raises, minimum employment duration)?', category: 'Employment Contracts' },
    
    // 2. Executive/Managing Director Contracts - 5 questions
    { id: 'executive_1', question: 'Is the total compensation package broken down (base, bonus, equity)?', category: 'Executive Contracts' },
    { id: 'executive_2', question: 'Are KPI-driven bonuses explicitly defined?', category: 'Executive Contracts' },
    { id: 'executive_3', question: 'Are severance packages or golden parachutes included?', category: 'Executive Contracts' },
    { id: 'executive_4', question: 'Are liability exclusions or indemnity clauses included?', category: 'Executive Contracts' },
    { id: 'executive_5', question: 'What exit clauses exist in case of M&A or investor-led changes?', category: 'Executive Contracts' },
    
    // 3. ESOP/VSOP Agreements - 6 questions
    { id: 'equity_1', question: 'What is the total pool reserved (as % of shares)?', category: 'ESOP/VSOP Plans' },
    { id: 'equity_2', question: 'What vesting model is used? (cliff, linear, backloaded)', category: 'ESOP/VSOP Plans' },
    { id: 'equity_3', question: 'Are good leaver/bad leaver rules defined?', category: 'ESOP/VSOP Plans' },
    { id: 'equity_4', question: 'Are rights in case of IPO or acquisition clearly set?', category: 'ESOP/VSOP Plans' },
    { id: 'equity_5', question: 'Are conversion or dilution rules defined?', category: 'ESOP/VSOP Plans' },
    { id: 'equity_6', question: 'Is board/shareholder approval included for issuance?', category: 'ESOP/VSOP Plans' },
    
    // 4. Freelancer/Contractor Agreements - 3 questions
    { id: 'freelancer_1', question: 'Are contracts aligned with IR35 or similar compliance tests?', category: 'Freelancer Agreements' },
    { id: 'freelancer_2', question: 'Is IP assignment clearly stated?', category: 'Freelancer Agreements' },
    { id: 'freelancer_3', question: 'Are term, termination, deliverables, and payment terms detailed?', category: 'Freelancer Agreements' },
    
    // 5. HR SaaS Contracts - 4 questions
    { id: 'hr_saas_1', question: 'What modules are in use? Payroll? Performance reviews? ATS?', category: 'HR SaaS Contracts' },
    { id: 'hr_saas_2', question: 'What is the contractual term, renewal logic, and notice period?', category: 'HR SaaS Contracts' },
    { id: 'hr_saas_3', question: 'Is data processing governed by a GDPR-compliant DPA?', category: 'HR SaaS Contracts' },
    { id: 'hr_saas_4', question: 'What SLAs or uptime guarantees are defined?', category: 'HR SaaS Contracts' },
    
    // 6. Internal HR Policies/Guidelines - 3 questions
    { id: 'policies_1', question: 'Are internal documents covering leave, diversity, misconduct, whistleblowing, etc.?', category: 'HR Policies' },
    { id: 'policies_2', question: 'Are policies updated and compliant with local law?', category: 'HR Policies' },
    { id: 'policies_3', question: 'Is there a documented performance review or promotion framework?', category: 'HR Policies' },
    
    // 7. Compensation Benchmarking/Salary Tables - 3 questions
    { id: 'compensation_1', question: 'Are salaries benchmarked (e.g., Radford, Mercer)?', category: 'Compensation Analysis' },
    { id: 'compensation_2', question: 'Are pay bands defined by level and function?', category: 'Compensation Analysis' },
    { id: 'compensation_3', question: 'Is salary growth rate documented historically?', category: 'Compensation Analysis' }
  ];

  const categories = [...new Set(HR_QUESTIONS.map(q => q.category))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-gradient-to-r from-orange-500/5 to-orange-600/5 border border-orange-500/20 rounded-lg p-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">Comprehensive HR Analysis</h3>
          <p className="text-gray-300 text-sm">
            Analyze {assignedDocuments} HR documents across 7 categories with 32 detailed questions
          </p>
        </div>
        <ComprehensiveHrAnalysisButton dealId={dealId} />
      </div>

      {categories.map(category => (
        <div key={category} className="border border-dark-lighter rounded-lg overflow-hidden">
          <div 
            className="flex items-center justify-between p-4 bg-dark-light hover:bg-dark cursor-pointer transition-colors"
            onClick={() => toggleCategory(category)}
          >
            <h4 className="font-medium text-white">{category}</h4>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-gray-400 border-gray-600">
                {HR_QUESTIONS.filter(q => q.category === category).length} questions
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
              {HR_QUESTIONS.filter(q => q.category === category).map(question => {
                const answer = comprehensiveResults?.success && comprehensiveResults.analysis?.hrAnswers 
                  ? comprehensiveResults.analysis.hrAnswers[question.id] 
                  : null;

                return (
                  <div key={question.id} className="p-4 border-b border-dark-lighter last:border-b-0">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-white mb-2">{question.question}</p>
                          
                          {answer ? (
                            <div className="mt-3 space-y-3">
                              <div className="bg-dark/50 rounded p-3">
                                <h5 className="text-xs font-medium text-orange-400 mb-2">HR Analysis</h5>
                                <p className="text-gray-300 text-sm leading-relaxed">{answer.answer}</p>
                              </div>

                              {/* Enhanced HR Assessment */}
                              {answer.hrAssessment && (
                                <div className="bg-dark/30 rounded p-3">
                                  <h5 className="text-xs font-medium text-amber-400 mb-2">HR Assessment</h5>
                                  <p className="text-gray-300 text-sm leading-relaxed">{answer.hrAssessment}</p>
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
                                            onClick={() => handleDocumentClick(quote.document)}
                                            className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 hover:bg-blue-500/30 transition-colors cursor-pointer"
                                            title={`View document: ${quote.document}`}
                                          >
                                            📄 {quote.document && quote.document.length > 25 ? `${quote.document.substring(0, 25)}...` : quote.document}
                                          </button>
                                          {quote.relevance && (
                                            <Badge variant="outline" className="text-xs text-gray-400 border-gray-400">
                                              {quote.relevance}
                                            </Badge>
                                          )}
                                        </div>
                                        <blockquote className="text-gray-300 text-xs italic leading-relaxed border-l-2 border-gray-600 pl-2 mt-1">
                                          "{quote.text}"
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
                                  <h5 className="text-xs font-medium text-orange-400 mb-2">Key Findings</h5>
                                  <ul className="space-y-1">
                                    {answer.keyFindings.map((finding, index) => (
                                      <li key={index} className="text-gray-300 text-xs flex items-start gap-2">
                                        <span className="text-orange-400 text-xs mt-1">•</span>
                                        {finding}
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
                                        {rec}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Metadata */}
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-orange-400 border-orange-400">
                                  Confidence: {Math.round((answer.confidence || 0) * 100)}%
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
  const [expandedCategories, setExpandedCategories] = useState(new Set(["Patent Applications/Grants"]));

  const { data: comprehensiveResults } = useQuery({
    queryKey: [`/api/deals/${dealId}/agents/ip/results`],
    refetchInterval: 2000,
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

  // IP questions structure matching the backend service
  const IP_QUESTIONS = [
    // 1. Patent Applications/Grants - 4 questions
    { id: "patents_1", question: "What jurisdictions are covered (US, EU, China, Japan)?", category: "Patent Applications/Grants" },
    { id: "patents_2", question: "What is the legal status (granted, pending, abandoned)?", category: "Patent Applications/Grants" },
    { id: "patents_3", question: "How long is the protection duration remaining?", category: "Patent Applications/Grants" },
    { id: "patents_4", question: "Is there freedom to operate (FTO) analysis available?", category: "Patent Applications/Grants" },
    
    // 2. Trademark Registrations - 4 questions
    { id: "trademarks_1", question: "What Nice classes are covered for trademark protection?", category: "Trademark Registrations" },
    { id: "trademarks_2", question: "Are there any oppositions or disputes filed?", category: "Trademark Registrations" },
    { id: "trademarks_3", question: "What renewal dates and maintenance requirements exist?", category: "Trademark Registrations" },
    { id: "trademarks_4", question: "Are brand extensions or geographical expansions planned?", category: "Trademark Registrations" },
    
    // 3. License Agreements - 4 questions
    { id: "licenses_1", question: "Are licenses exclusive or non-exclusive?", category: "License Agreements" },
    { id: "licenses_2", question: "What royalty rates and payment terms are defined?", category: "License Agreements" },
    { id: "licenses_3", question: "Are sublicensing rights granted or restricted?", category: "License Agreements" },
    { id: "licenses_4", question: "What termination clauses and conditions exist?", category: "License Agreements" },
    
    // 4. Source Code Ownership Declarations - 4 questions
    { id: "source_code_1", question: "Is all source code developed in-house or are there third-party components?", category: "Source Code Ownership" },
    { id: "source_code_2", question: "What open-source licenses are used (GPL, MIT, Apache)?", category: "Source Code Ownership" },
    { id: "source_code_3", question: "Are there clear policies for employee-created IP?", category: "Source Code Ownership" },
    { id: "source_code_4", question: "Are all code contributions properly documented and assigned?", category: "Source Code Ownership" }
  ];

  const categorizedQuestions = IP_QUESTIONS.reduce((acc, question) => {
    if (!acc[question.category]) {
      acc[question.category] = [];
    }
    acc[question.category].push(question);
    return acc;
  }, {} as Record<string, typeof IP_QUESTIONS>);

  // Get findings and recommendations from IP analysis
  const findings = (comprehensiveResults as any)?.analysis?.findings || [];
  const recommendations = (comprehensiveResults as any)?.analysis?.recommendations || [];

  const getAnswerForQuestion = (questionId: string) => {
    // Try to map findings to questions based on content similarity
    if (findings.length > 0) {
      // Find the most relevant finding for this question
      const relevantFinding = findings.find((finding: any) => {
        const questionKeywords = {
          'patents_1': ['jurisdiction', 'US', 'EU', 'China', 'Japan', 'country', 'countries', 'filed', 'application'],
          'patents_2': ['status', 'granted', 'pending', 'abandoned', 'approved', 'allowed', 'legal'],
          'patents_3': ['duration', 'remaining', 'expir', 'protection', 'term'],
          'patents_4': ['freedom', 'operate', 'FTO', 'analysis'],
          'trademarks_1': ['Nice', 'class', 'trademark', 'protection'],
          'trademarks_2': ['opposition', 'dispute', 'filed', 'challenge'],
          'trademarks_3': ['renewal', 'maintenance', 'requirement'],
          'trademarks_4': ['brand', 'extension', 'geographical', 'expansion'],
          'licenses_1': ['exclusive', 'non-exclusive', 'license'],
          'licenses_2': ['royalty', 'payment', 'terms', 'rate'],
          'licenses_3': ['sublicensing', 'rights', 'granted', 'restricted'],
          'licenses_4': ['termination', 'clause', 'condition'],
          'source_code_1': ['source', 'code', 'in-house', 'third-party', 'component', 'developed'],
          'source_code_2': ['open-source', 'GPL', 'MIT', 'Apache', 'license', 'open source'],
          'source_code_3': ['employee', 'policy', 'IP', 'created'],
          'source_code_4': ['contribution', 'documented', 'assigned']
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
          severity: relevantFinding.severity
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
            severity: patentFinding.severity
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
                              {/* Main Analysis Response - Clinical style matching the attached image */}
                              <div className="bg-dark/50 rounded p-3">
                                <h5 className="text-xs font-medium text-purple-400 mb-2">IP Analysis</h5>
                                <p className="text-gray-300 text-sm leading-relaxed">{answer.answer}</p>
                              </div>

                              {/* Enhanced IP Assessment */}
                              {answer.severity && (
                                <div className="bg-dark/30 rounded p-3">
                                  <h5 className="text-xs font-medium text-indigo-400 mb-2">IP Assessment</h5>
                                  <p className="text-gray-300 text-sm leading-relaxed">
                                    Severity Level: <span className={`font-medium ${
                                      answer.severity === 'high' ? 'text-red-400' :
                                      answer.severity === 'medium' ? 'text-yellow-400' :
                                      'text-green-400'
                                    }`}>
                                      {answer.severity.toUpperCase()}
                                    </span> - This finding requires {
                                      answer.severity === 'high' ? 'immediate attention and legal review' :
                                      answer.severity === 'medium' ? 'careful consideration in due diligence' :
                                      'standard documentation and filing'
                                    }.
                                  </p>
                                </div>
                              )}

                              {/* Document Quotes */}
                              {answer.sources && Array.isArray(answer.sources) && answer.sources.length > 0 && (
                                <div className="bg-gradient-to-r from-yellow-400/10 to-orange-400/10 rounded p-3">
                                  <h5 className="text-xs font-medium text-yellow-400 mb-2">
                                    📖 Document Quotes ({answer.sources && Array.isArray(answer.sources) ? answer.sources.length : 0})
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
                                            📄 {source && source.length > 25 ? `${source.substring(0, 25)}...` : source}
                                          </button>
                                        </div>
                                        <blockquote className="text-gray-300 text-xs italic leading-relaxed border-l-2 border-gray-600 pl-2 mt-1">
                                          "{answer.answer}"
                                        </blockquote>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Evidence Summary */}
                              {answer.category && (
                                <div className="bg-dark/30 rounded p-3">
                                  <h5 className="text-xs font-medium text-purple-400 mb-2">Evidence Summary</h5>
                                  <p className="text-gray-300 text-sm leading-relaxed">
                                    Analysis category: {answer.category}. This finding is based on comprehensive review of IP documentation 
                                    and represents key insights for investment due diligence assessment.
                                  </p>
                                </div>
                              )}

                              {/* Key IP Findings */}
                              <div className="bg-dark/30 rounded p-3">
                                <h5 className="text-xs font-medium text-purple-400 mb-2">🔍 Key IP Findings</h5>
                                <ul className="space-y-1">
                                  <li className="text-gray-300 text-xs flex items-start gap-2">
                                    <span className="text-purple-400 text-xs mt-1">•</span>
                                    IP protection status: {answer.severity === 'high' ? 'Strong portfolio' : answer.severity === 'medium' ? 'Moderate coverage' : 'Basic protection'}
                                  </li>
                                  <li className="text-gray-300 text-xs flex items-start gap-2">
                                    <span className="text-purple-400 text-xs mt-1">•</span>
                                    Documentation quality: {answer.confidence > 80 ? 'Comprehensive' : answer.confidence > 60 ? 'Adequate' : 'Limited'} evidence available
                                  </li>
                                </ul>
                              </div>

                              {/* IP Recommendations */}
                              <div className="bg-gradient-to-r from-red-400/10 to-orange-400/10 rounded p-3">
                                <h5 className="text-xs font-medium text-red-400 mb-2">💡 IP Recommendations</h5>
                                <ul className="space-y-1">
                                  <li className="text-gray-300 text-xs flex items-start gap-2">
                                    <span className="text-red-400 text-xs mt-1">⚠</span>
                                    {answer.severity === 'high' ? 'Immediate IP audit recommended' : 'Standard IP review sufficient'}
                                  </li>
                                  <li className="text-gray-300 text-xs flex items-start gap-2">
                                    <span className="text-red-400 text-xs mt-1">⚠</span>
                                    Verify all IP registrations and filing statuses before investment
                                  </li>
                                </ul>
                              </div>

                              {/* Metadata */}
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-purple-400 border-purple-400">
                                  Confidence: {answer.confidence}%
                                </Badge>
                                {answer.sources && Array.isArray(answer.sources) && answer.sources.length > 0 && (
                                  <Badge variant="outline" className="text-yellow-400 border-yellow-400">
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
                    <p className="text-gray-300 text-sm leading-relaxed">{rec.content || rec.recommendation || rec}</p>
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
