import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bot, FileText, TrendingUp, AlertTriangle, Play, CheckCircle, XCircle, AlertCircle, RefreshCw, HelpCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface EnhancedAgentCardProps {
  dealId: number;
  agentType: string;
  analysis?: any;
  isLoading?: boolean;
  documents?: any[];
  isRunningAllAnalyses?: boolean;
  currentProgress?: number;
  currentDocumentName?: string;
}

export default function EnhancedAgentCard({ 
  dealId, 
  agentType, 
  analysis, 
  isLoading, 
  documents, 
  isRunningAllAnalyses,
  currentProgress = 0,
  currentDocumentName 
}: EnhancedAgentCardProps) {
  const [isRunningAnalysis, setIsRunningAnalysis] = useState(false);
  const queryClient = useQueryClient();

  // Fetch agent-specific results directly from the agent results endpoint
  const { data: agentResults } = useQuery({
    queryKey: [`/api/deals/${dealId}/agents/${agentType.toLowerCase()}/results`],
    enabled: !!dealId && !!agentType,
    refetchInterval: 5000, // Poll every 5 seconds to get updates
  });

  // Use agent results if available, fallback to passed analysis
  const analysisData = (agentResults as any)?.analysis || analysis || {} as any;
  
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

        {/* Legal Questions for Legal Agent */}
        {agentType.toLowerCase() === 'legal' ? (
          <LegalQuestionsSection 
            analysisData={analysisData} 
            findings={findings} 
            assignedDocuments={assignedDocuments} 
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

        {shouldShowProcessingUI() ? (
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
        ) : (
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
        )}

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

// Legal Questions Section Component
interface LegalQuestionsSectionProps {
  analysisData: any;
  findings: any[];
  assignedDocuments: number;
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

const LEGAL_QUESTIONS: LegalQuestion[] = [
  {
    id: 'shareholders_agreement',
    category: 'Shareholders Agreement / Articles of Association',
    question: 'What class of shares exist?',
    subQuestions: ['Preferred shares', 'Common shares', 'Other share classes']
  },
  {
    id: 'liquidation_preferences',
    category: 'Shareholders Agreement / Articles of Association',
    question: 'Are liquidation preferences defined?',
    subQuestions: ['1x preferences', 'Participating preferences', 'Non-participating preferences']
  },
  {
    id: 'anti_dilution',
    category: 'Shareholders Agreement / Articles of Association',
    question: 'Is anti-dilution protection present?',
    subQuestions: ['Full ratchet protection', 'Weighted average protection']
  },
  {
    id: 'rights_provisions',
    category: 'Shareholders Agreement / Articles of Association',
    question: 'Are drag-along, tag-along, ROFR and co-sale rights clearly defined?'
  },
  {
    id: 'board_composition',
    category: 'Shareholders Agreement / Articles of Association',
    question: 'Are board composition and voting thresholds defined?'
  },
  {
    id: 'extra_rights',
    category: 'Shareholders Agreement / Articles of Association',
    question: 'Do any clauses exist that grant existing shareholders extra rights?',
    subQuestions: ['Warrants to subscribe to additional shares', 'Affirmative voting setups', 'Preferential valuations']
  },
  {
    id: 'veto_rights',
    category: 'Shareholders Agreement / Articles of Association',
    question: 'Are there any veto rights by existing shareholders?',
    subQuestions: ['Based on shareholding percentage', 'Additional agreements in SHA and AoA']
  },
  {
    id: 'side_letters',
    category: 'Shareholders Agreement / Articles of Association',
    question: 'Are there any side letters or preferential investor rights not visible in the main SHA?'
  },
  {
    id: 'founder_shareholding',
    category: 'Shareholders Agreement / Articles of Association',
    question: 'What is the shareholding of the founders/C-level management pre round?'
  },
  {
    id: 'investment_valuation',
    category: 'Investment Agreements',
    question: 'What is the valuation cap/discount (for SAFEs/Notes)?'
  },
  {
    id: 'interest_maturity',
    category: 'Investment Agreements',
    question: 'Are interest rates and maturity conditions specified?'
  },
  {
    id: 'mfn_conversion',
    category: 'Investment Agreements',
    question: 'Are MFN, conversion triggers and pro rata rights included?'
  },
  {
    id: 'conversion_schedule',
    category: 'Investment Agreements',
    question: 'Is there a conversion schedule/example calculation?',
    subQuestions: ['How will outstanding convertible loans dilute existing investors?', 'How will they dilute new investors upon conversion?']
  },
  {
    id: 'hidden_warrants',
    category: 'Investment Agreements',
    question: 'Are there "hidden" warrants or convertible structures that could dilute new investors?'
  },
  {
    id: 'ip_assignment_coverage',
    category: 'IP Assignment Agreements',
    question: 'Are all founders/key personnel covered?'
  },
  {
    id: 'ip_retroactive',
    category: 'IP Assignment Agreements',
    question: 'Do they include retroactive clauses?'
  },
  {
    id: 'ip_contractors',
    category: 'IP Assignment Agreements',
    question: 'Are external contractors included?'
  },
  {
    id: 'commercial_slas',
    category: 'Commercial Agreements',
    question: 'Are SLAs, warranties, and indemnity clauses present?'
  },
  {
    id: 'distributor_terms',
    category: 'Commercial Agreements',
    question: 'Summarize the key terms of distributor agreements',
    subQuestions: ['Signing date', 'Term', 'Scope', 'Payment terms', 'Exclusivities', 'Geographies covered']
  },
  {
    id: 'partner_terms',
    category: 'Commercial Agreements',
    question: 'Summarize the key terms of agreements with other partners',
    subQuestions: ['Placement agents', 'Clinical research partners', 'Other key partners']
  },
  {
    id: 'termination_clauses',
    category: 'Commercial Agreements',
    question: 'Are termination clauses fair and mutual?'
  },
  {
    id: 'exclusivity_clauses',
    category: 'Commercial Agreements',
    question: 'Are exclusivity clauses or MFN clauses present?'
  },
  {
    id: 'nda_duration',
    category: 'NDAs',
    question: 'What is the duration of confidentiality?'
  },
  {
    id: 'nda_ip_ownership',
    category: 'NDAs',
    question: 'Are IP ownership and data return clauses present?'
  },
  {
    id: 'nda_mutual',
    category: 'NDAs',
    question: 'Is the NDA mutual or one-way?'
  },
  {
    id: 'pending_litigation',
    category: 'Litigation Documents',
    question: 'Are there pending litigations or regulatory proceedings?'
  },
  {
    id: 'financial_exposure',
    category: 'Litigation Documents',
    question: 'Is financial exposure quantified?'
  },
  {
    id: 'settlement_agreements',
    category: 'Litigation Documents',
    question: 'Are there settlement agreements or insurance protections?'
  },
  {
    id: 'ethical_controversies',
    category: 'Litigation Documents',
    question: 'Has the company or founder been involved in any past ethical controversies or fraud cases?'
  },
  {
    id: 'adverse_media',
    category: 'Litigation Documents',
    question: 'Are there adverse media reports or regulatory flags in their country of operation?'
  },
  {
    id: 'fda_submissions',
    category: 'Regulatory Compliance',
    question: 'Are all FDA submissions properly documented with clear approval status?',
    subQuestions: ['IND submissions', 'IDE submissions', 'NDA submissions', 'BLA submissions', 'CE MDR status']
  },
  {
    id: 'clinical_trial_agreements',
    category: 'Regulatory Compliance',
    question: 'Do clinical trial agreements include proper indemnification clauses for investigator sites?'
  },
  {
    id: 'data_use_agreements',
    category: 'Regulatory Compliance',
    question: 'Are there comprehensive data use agreements for patient data handling and sharing?'
  },
  {
    id: 'regulatory_communications',
    category: 'Regulatory Compliance',
    question: 'What is the status of regulatory communications?',
    subQuestions: ['FDA communications', 'EMA communications', 'Notified bodies', 'Other authorities']
  },
  {
    id: 'regulatory_actions',
    category: 'Regulatory Compliance',
    question: 'Are there any regulatory actions pending?',
    subQuestions: ['FDA warning letters', 'Consent decrees', 'Other regulatory actions']
  }
];

function LegalQuestionsSection({ analysisData, findings, assignedDocuments }: LegalQuestionsSectionProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

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

  // Mock function to get answer - in real implementation, this would come from analysisData
  const getAnswerForQuestion = (questionId: string): { answer: string; confidence: number; sources: string[] } | null => {
    // This is placeholder logic - in real implementation, you'd extract from analysisData
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <HelpCircle className="h-5 w-5 text-blue-400" />
        <h3 className="text-lg font-semibold text-white">Legal Due Diligence Questions</h3>
        <Badge variant="outline" className="text-gray-400 border-gray-400">
          {assignedDocuments} Documents Analyzed
        </Badge>
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
                            <div className="mt-3 bg-dark/50 rounded p-3">
                              <p className="text-gray-300 text-sm">{answer.answer}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="text-green-400 border-green-400">
                                  Confidence: {answer.confidence}%
                                </Badge>
                                {answer.sources.length > 0 && (
                                  <Badge variant="outline" className="text-gray-400 border-gray-400">
                                    {answer.sources.length} sources
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
    </div>
  );
}