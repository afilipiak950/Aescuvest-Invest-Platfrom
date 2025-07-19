import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bot, FileText, TrendingUp, AlertTriangle, Play, CheckCircle, XCircle, AlertCircle, RefreshCw, HelpCircle, ChevronDown, ChevronRight, Zap } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import DocumentQuoteViewer from './DocumentQuoteViewer';

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

  // Progress Display Component for Legal Analysis
  function ProgressDisplay({ dealId, assignedDocuments }: { dealId: number; assignedDocuments: number }) {
    const { data: jobProgress } = useQuery({
      queryKey: [`/api/background-jobs/${dealId}`],
      refetchInterval: 1000, // Poll every second for progress updates
    });

    // Check for comprehensive legal analysis progress
    const { data: legalProgress } = useQuery({
      queryKey: [`/api/deals/${dealId}/legal-analysis/comprehensive/progress`],
      refetchInterval: 1000,
    });

    // Look for both comprehensive legal analysis and regular legal agent jobs
    const legalJobs = jobProgress?.jobs?.filter((job: any) => 
      (job.jobType === 'comprehensive_legal_analysis' || job.jobId.includes('legal_')) && 
      job.status === 'processing' &&
      job.progress > 0 // Only show jobs with actual progress
    ) || [];

    const activeLegalJob = legalJobs[0];
    
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
  const analysisData = (comprehensiveClinicalResults as any)?.analysis || (agentResults as any)?.analysis || analysis || {} as any;
  
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
  
  if (analysisData.findings) {
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
  
  if (analysisData.recommendations) {
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
  
  const status = analysisData.status || 'Not Started';

  // Intelligent document-to-agent assignment (same logic as DataRoomExplorer)
  const getAssignedAgents = (document: any) => {
    const docName = document.name.toLowerCase();
    const docContent = (document.ocrText || '').toLowerCase();
    const aiSummary = document.aiSummary;
    
    // Extract relevant content for analysis
    const analysisText = [
      docName,
      docContent.substring(0, 2000), // First 2k chars for performance
      aiSummary?.executiveSummary || '',
      aiSummary?.documentType || '',
      (aiSummary?.criticalFindings || []).join(' '),
      (aiSummary?.keyFinancialData || []).join(' '),
      (aiSummary?.riskAssessment || []).join(' '),
      (aiSummary?.neutralFindings || []).join(' ')
    ].join(' ').toLowerCase();
    
    // Weighted scoring system for each agent type
    const agentScores = calculateAgentRelevanceScores(docName, analysisText, aiSummary);
    
    // Intelligent agent assignment based on score distribution
    const sortedAgents = Object.entries(agentScores)
      .sort(([,a], [,b]) => b - a)
      .filter(([, score]) => score > 0.1); // Minimum relevance threshold
    
    if (sortedAgents.length === 0) {
      return [getAgentInfo('Commercial')]; // Fallback
    }
    
    // Get the highest scoring agent
    const topAgent = sortedAgents[0];
    const [, topScore] = topAgent;
    
    // Only assign a second agent if:
    // 1. There is a second agent above threshold
    // 2. The second agent's score is at least 50% of the top score
    // 3. The top score is not overwhelmingly dominant (< 0.8)
    const selectedAgents = [topAgent];
    
    if (sortedAgents.length > 1 && topScore < 0.8) {
      const secondAgent = sortedAgents[1];
      const [, secondScore] = secondAgent;
      
      // Only add second agent if it's meaningfully relevant
      if (secondScore >= topScore * 0.5) {
        selectedAgents.push(secondAgent);
      }
    }
    
    return selectedAgents.map(([agentType]) => 
      getAgentInfo(agentType.charAt(0).toUpperCase() + agentType.slice(1))
    );
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
    if (analysisData.progress && analysisData.progress > 0) {
      return analysisData.progress;
    }
    
    // Default progress based on status
    if (status === 'Completed') return 100;
    if (status === 'Processing') return 15; // Show some progress for processing
    return 0;
  })();
  
  // Calculate how many documents were actually analyzed (have findings with document sources)
  const getAnalyzedDocumentCount = () => {
    if (!findings || findings.length === 0) return 0;
    
    const documentsWithSources = findings.filter((finding: any) => 
      finding.documentSource || finding.documentSources
    );
    
    const uniqueDocuments = new Set();
    documentsWithSources.forEach((finding: any) => {
      if (finding.documentSource) {
        uniqueDocuments.add(finding.documentSource);
      }
      if (finding.documentSources && Array.isArray(finding.documentSources)) {
        finding.documentSources.forEach((source: string) => uniqueDocuments.add(source));
      }
    });
    
    return uniqueDocuments.size;
  };

  const positiveInsights = findings.filter((f: any) => 
    f.severity === 'positive' || f.type === 'positive' || f.category === 'positive'
  ).length;
  const riskFactors = findings.filter((f: any) => 
    f.severity === 'risk' || f.severity === 'negative' || f.type === 'risk' || f.category === 'risk'
  ).length;
  
  // Debug KPI calculations for verification
  console.log(`🔢 ${agentType} Agent KPIs:`, {
    totalDocuments: documents?.length || 0,
    assignedDocuments: assignedDocuments,
    hasAnalysis: !!analysisData && analysisData.status === 'Completed',
    findingsCount: findings.length,
    positiveInsights,
    riskFactors
  });
  
  // Check if we have any analysis data (findings, recommendations, or status indicating completion)
  const hasAnalysis = findings.length > 0 || recommendations.length > 0 || 
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
        {/* KPI Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-dark border border-dark-lighter rounded-lg p-3 text-center">
            <div className="text-xl md:text-2xl font-bold text-blue-400 mb-1">{assignedDocuments}</div>
            <div className="text-xs md:text-sm text-gray-400">Assigned Documents</div>
          </div>
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
                                Confidence: {Math.round((finding.confidence || 0.8) * 100)}%
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
                                Confidence: {Math.round((finding.confidence || 0.8) * 100)}%
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
                                Confidence: {Math.round((finding.confidence || 0.8) * 100)}%
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
        ) : agentType.toLowerCase() !== 'legal' ? (
          <div className="text-center py-8">
            <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No Analysis Available</h3>
            <p className="text-gray-400 mb-4">
              Run the {agentType} analysis to process all {assignedDocuments} assigned documents with the Mistral AI agent.
            </p>
            <Button
              onClick={handleRunMistralAnalysis}
              disabled={isAnalysisCurrentlyRunning() || assignedDocuments === 0}
              className="bg-primary hover:bg-primary/90"
            >
              {isAnalysisCurrentlyRunning() ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Analyzing {assignedDocuments} Documents
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run {agentType} Analysis ({assignedDocuments} docs)
                </>
              )}
            </Button>
          </div>
        ) : null}

        {/* Recommendations Section */}
        {recommendations.length > 0 && (
          <div className="mt-6 pt-6 border-t border-dark-lighter">
            <h4 className="font-medium text-white mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Recommendations
            </h4>
            <div className="space-y-3">
              {recommendations.map((rec: any, index: number) => {
                // Handle both string and object formats
                const isString = typeof rec === 'string';
                const title = isString ? rec.split(':')[0] || `Recommendation ${index + 1}` : rec.title;
                const description = isString ? rec.split(':').slice(1).join(':').trim() || rec : rec.description;
                const priority = isString ? 'medium' : rec.priority || 'medium';
                const impact = isString ? null : rec.impact;
                
                return (
                  <div key={index} className="border border-dark-lighter rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                        priority === 'high' ? 'bg-red-400' :
                        priority === 'medium' ? 'bg-yellow-400' :
                        'bg-gray-400'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h5 className="font-medium text-white">{title}</h5>
                          <Badge variant="outline" className={
                            priority === 'high' ? 'text-red-400 border-red-400' :
                            priority === 'medium' ? 'text-yellow-400 border-yellow-400' :
                            'text-gray-400 border-gray-400'
                          }>
                            {priority}
                          </Badge>
                        </div>
                        <p className="text-gray-400 text-sm mb-2">{description}</p>
                        {impact && (
                          <div className="bg-dark/50 rounded p-2 mt-2">
                            <p className="text-gray-400 text-xs"><strong>Impact:</strong> {impact}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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

  // Check if legal analysis is available
  const hasLegalAnalysis = analysisData && (
    (analysisData.legalAnswers && Object.keys(analysisData.legalAnswers).length > 0) ||
    (analysisData.findings && analysisData.findings.length > 0)
  );
  
  // Debug logging
  console.log('🔍 Legal Analysis Available:', hasLegalAnalysis);
  console.log('🔍 Analysis Data:', analysisData);
  console.log('🔍 Legal Answers:', analysisData?.legalAnswers);
  console.log('🔍 Findings:', findings);

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
        answer: answer.answer,
        confidence: answer.confidence,
        sources: Array.isArray(answer.sources) ? answer.sources : answer.sources ? [answer.sources] : [],
        quotes: answer.quotes || [],
        keyFindings: answer.keyFindings || [],
        evidenceSummary: answer.evidenceSummary || '',
        legalAssessment: answer.legalAssessment || '',
        recommendations: answer.recommendations || [],
        detailedEvidence: answer.detailedEvidence || []
      };
    }
    
    // Fallback to findings-based extraction
    if (!analysisData.findings || !Array.isArray(analysisData.findings)) return null;
    
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
                {questions.length} questions
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
              {questions.map((question) => {
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
                          
                          {question.subQuestions && (
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
                              {answer.quotes && answer.quotes.length > 0 && (
                                <div className="bg-gradient-to-r from-yellow-400/10 to-orange-400/10 rounded p-3">
                                  <h5 className="text-xs font-medium text-yellow-400 mb-2">
                                    📖 Document Quotes ({answer.quotes.length})
                                  </h5>
                                  <div className="space-y-2">
                                    {answer.quotes.map((quote, index) => (
                                      <div key={index} className="bg-dark/70 rounded p-2 border-l-2 border-yellow-400">
                                        <div className="flex items-start justify-between mb-1">
                                          <button
                                            onClick={() => handleDocumentClick(quote.document)}
                                            className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 hover:bg-blue-500/30 transition-colors cursor-pointer"
                                            title={`View document: ${quote.document}`}
                                          >
                                            📄 {quote.document.length > 25 ? `${quote.document.substring(0, 25)}...` : quote.document}
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
                              {answer.keyFindings && answer.keyFindings.length > 0 && (
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
                              {answer.recommendations && answer.recommendations.length > 0 && (
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
                                  Confidence: {answer.confidence}%
                                </Badge>
                                {answer.quotes && answer.quotes.length > 0 && (
                                  <Badge 
                                    variant="outline" 
                                    className="text-yellow-400 border-yellow-400 cursor-pointer hover:bg-yellow-400/10"
                                    onClick={() => {
                                      setSelectedQuoteData({
                                        quotes: answer.quotes.map((quote: string) => ({
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
                                    {answer.quotes.length} quote{answer.quotes.length > 1 ? 's' : ''}
                                  </Badge>
                                )}
                                {answer.sources && answer.sources.length > 0 && (
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
                                    {answer.sources.length} source{answer.sources.length > 1 ? 's' : ''}
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

  // Check if clinical analysis is available
  const hasClinicalAnalysis = analysisData && (
    (analysisData.clinicalAnswers && Object.keys(analysisData.clinicalAnswers).length > 0) ||
    (analysisData.findings && analysisData.findings.length > 0)
  );
  
  console.log('🧬 Clinical Analysis Available:', hasClinicalAnalysis);
  console.log('🧬 Analysis Data:', analysisData);
  console.log('🧬 Clinical Answers:', analysisData?.clinicalAnswers);

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
    if (!analysisData) return null;
    
    console.log(`🧬 Looking for answer to clinical question ${questionId}`);
    console.log(`🧬 Clinical Answers exists:`, !!analysisData.clinicalAnswers);
    
    // First try to get answer from clinicalAnswers structure
    if (analysisData.clinicalAnswers && analysisData.clinicalAnswers[questionId]) {
      const answer = analysisData.clinicalAnswers[questionId];
      console.log(`🧬 Found enhanced answer for ${questionId}:`, answer);
      console.log(`🧬 Has detailedEvidence:`, !!answer.detailedEvidence);
      return {
        answer: answer.answer,
        confidence: answer.confidence,
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
    if (!analysisData.findings || !Array.isArray(analysisData.findings)) return null;
    
    // Search through findings for relevant content
    const relevantFindings = analysisData.findings.filter((finding: any) => {
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
                {questions.length} questions
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
              {questions.map((question) => {
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
                          
                          {question.subQuestions && (
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
                              {answer.keyFindings && answer.keyFindings.length > 0 && (
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
                              {answer.recommendations && answer.recommendations.length > 0 && (
                                <div className="bg-gradient-to-r from-yellow-400/10 to-orange-400/10 rounded p-3">
                                  <h5 className="text-xs font-medium text-yellow-400 mb-2">
                                    💡 Clinical Recommendations ({answer.recommendations.length})
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
                                  Confidence: {answer.confidence}%
                                </Badge>
                                {answer.sources && answer.sources.length > 0 && (
                                  <Badge 
                                    variant="outline" 
                                    className="text-blue-400 border-blue-400 cursor-pointer hover:bg-blue-400/10"
                                    onClick={() => {
                                      console.log('🚀 CLINICAL CLICK HANDLER TRIGGERED!');
                                      console.log('🧬 Answer object:', answer);
                                      // Create sources using detailed evidence with unique content from each document
                                      console.log('🧬 Processing detailedEvidence:', answer.detailedEvidence);
                                      const sources = answer.detailedEvidence?.map((evidence: any) => {
                                        console.log('🧬 Processing clinical evidence for:', evidence.documentName);
                                        console.log('🧬 Evidence data:', evidence);
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
                                      console.log('🧬 Final sources array:', sources);
                                      
                                      setSelectedQuoteData({
                                        quotes: [],
                                        sources,
                                        title: question.question
                                      });
                                      setQuoteViewerOpen(true);
                                    }}
                                  >
                                    {answer.sources.length} source{answer.sources.length > 1 ? 's' : ''}
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

// Comprehensive Legal Analysis Button Component
function ComprehensiveClinicalAnalysisButton({ dealId, onAnalysisStart }: { dealId: number; onAnalysisStart?: () => void }) {
  const [isRunning, setIsRunning] = useState(false);
  const queryClient = useQueryClient();

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
      disabled={isRunning || comprehensiveAnalysisMutation.isPending}
      size="sm"
      className="bg-green-600 hover:bg-green-700 text-white border-green-500"
    >
      {isRunning || comprehensiveAnalysisMutation.isPending ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {isRunning ? 'Clinical Analysis Running...' : 'Starting Analysis...'}
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
      disabled={isRunning || comprehensiveAnalysisMutation.isPending}
      size="sm"
      className="bg-blue-600 hover:bg-blue-700 text-white border-blue-500"
    >
      {isRunning || comprehensiveAnalysisMutation.isPending ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {isRunning ? 'AI Analysis Running...' : 'Starting Analysis...'}
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