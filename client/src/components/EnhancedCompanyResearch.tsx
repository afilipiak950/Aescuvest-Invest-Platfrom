import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  RefreshCw, Globe, DollarSign, Users, Cpu, FileText, Shield, Building, TrendingUp, 
  Eye, Brain, Search, Target, ChartBar, AlertTriangle, CheckCircle, Clock,
  ExternalLink, User, MapPin, Calendar, Briefcase, Award, Lightbulb,
  Network, TrendingDown, Activity, BookOpen, Star, Info, Package, ArrowRight, Loader2
} from 'lucide-react';

interface CompanyResearchProps {
  dealId: number;
}

interface EnhancedResearchData {
  companyName: string;
  website: string;
  lastUpdated: string;
  sources: number;
  aiConfidenceScore: number;
  researchStatus: 'pending' | 'in_progress' | 'complete' | 'error';
  
  // Executive Leadership
  ceoProfile?: {
    name: string;
    background: string;
    experience: string;
    education: string;
    previousCompanies: string[];
    linkedinUrl?: string;
  };
  
  keyTeamMembers?: Array<{
    name: string;
    role: string;
    background: string;
    linkedinUrl?: string;
  }>;
  
  // Financial Intelligence
  financialData?: {
    revenue?: string;
    fundingHistory?: Array<{
      round: string;
      amount: string;
      date: string;
      investors: string[];
    }>;
    valuation?: string;
    employeeCount?: string;
    burnRate?: string;
    runway?: string;
    growthRate?: string;
  };
  
  // Market Analysis
  marketAnalysis?: {
    marketSize?: string;
    competitors?: string[];
    marketPosition?: string;
    uniqueValueProposition?: string;
    customerSegments?: string[];
    pricingStrategy?: string;
  };
  
  // Business Intelligence
  businessIntelligence?: {
    recentNews?: Array<{
      title: string;
      source: string;
      date: string;
      url?: string;
      sentiment?: 'positive' | 'neutral' | 'negative';
    }>;
    patents?: number;
    partnerships?: string[];
    customerBase?: string;
    businessModel?: string;
    technologyStack?: string[];
  };
  
  // Risk Assessment
  riskFactors?: {
    regulatory?: string[];
    competitive?: string[];
    financial?: string[];
    operational?: string[];
    riskLevel?: 'low' | 'medium' | 'high';
  };
  
  // Investment Highlights
  investmentHighlights?: {
    traction?: string[];
    growthMetrics?: string[];
    competitiveAdvantages?: string[];
    marketOpportunity?: string;
    investmentThesis?: string[];
  };
  
  // External Links
  externalLinks?: {
    pitchbookUrl?: string;
    crunchbaseUrl?: string;
    linkedinCompanyUrl?: string;
    angellistUrl?: string;
  };
  
  // AI Analysis Summary
  aiAnalysis?: {
    investmentScore: number;
    confidenceLevel: number;
    keyStrengths: string[];
    keyRisks: string[];
    recommendation: string;
    nextSteps: string[];
  };
}

export default function EnhancedCompanyResearch({ dealId }: CompanyResearchProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeResearchTab, setActiveResearchTab] = useState('overview');
  const [researchProgress, setResearchProgress] = useState<{
    progress: number;
    stage: string;
    jobId?: number;
    status: string;
    debugInfo?: any;
  } | null>(null);
  const [isFinancialSearching, setIsFinancialSearching] = useState(false);
  const [financialSearchData, setFinancialSearchData] = useState<any>(null);
  const [isMarketPositionSearching, setIsMarketPositionSearching] = useState(false);
  const [marketPositionSearchData, setMarketPositionSearchData] = useState<any>(null);
  const [isCompetitiveSearching, setIsCompetitiveSearching] = useState(false);
  const [competitiveSearchData, setCompetitiveSearchData] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: researchData, isLoading, error, refetch } = useQuery<EnhancedResearchData>({
    queryKey: [`/api/deals/${dealId}/research`],
    enabled: !!dealId,
    retry: false,
  });

  // Always poll for research progress to detect new jobs
  const { data: progressData } = useQuery<{
    status: string;
    progress: number;
    progressStage: string;
    jobId: number;
    debugInfo: any;
  }>({
    queryKey: [`/api/deals/${dealId}/research/progress`],
    refetchInterval: 2000, // Always poll every 2 seconds
    enabled: !!dealId,
    retry: false,
  });

  // Update progress state when polling data changes
  useEffect(() => {
    if (progressData?.status === 'processing') {
      console.log('📊 Progress update:', progressData.progress + '%', progressData.progressStage);
      setResearchProgress({
        progress: progressData.progress || 0,
        stage: progressData.progressStage || 'Processing...',
        jobId: progressData.jobId,
        status: progressData.status,
        debugInfo: progressData.debugInfo
      });
    } else if (progressData?.status === 'completed') {
      // Show completion briefly before clearing
      setResearchProgress({
        progress: 100,
        stage: 'Research completed successfully',
        jobId: progressData.jobId,
        status: 'completed',
        debugInfo: progressData.debugInfo
      });
      
      // Clear progress and refresh data after 3 seconds
      setTimeout(() => {
        setResearchProgress(null);
        setIsRefreshing(false);
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/research`] });
      }, 3000);
    }
  }, [progressData, queryClient, dealId]);

  const refreshResearchMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/deals/${dealId}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh: true }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to refresh research');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      console.log('🔬 Research job started:', data);
      if (data.status === 'processing') {
        setResearchProgress({
          progress: data.progress || 0,
          stage: data.progressStage || 'Initializing research parameters',
          jobId: data.jobId,
          status: data.status,
          debugInfo: data.debugInfo
        });
      }
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/research`] });
    },
    onError: (error) => {
      console.error('Research refresh failed:', error);
      setIsRefreshing(false);
    }
  });

  const handleRefreshResearch = () => {
    setIsRefreshing(true);
    setResearchProgress(null);
    refreshResearchMutation.mutate();
  };

  // Financial Search Mutation
  const financialSearchMutation = useMutation({
    mutationFn: async (companyName: string) => {
      const response = await fetch(`/api/deals/${dealId}/financial-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to search financial data');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      console.log('💰 Financial search completed:', data);
      setFinancialSearchData(data);
      setIsFinancialSearching(false);
    },
    onError: (error) => {
      console.error('Financial search failed:', error);
      setIsFinancialSearching(false);
    }
  });

  const handleFinancialSearch = () => {
    if (researchData?.companyName) {
      setIsFinancialSearching(true);
      setFinancialSearchData(null);
      financialSearchMutation.mutate(researchData.companyName);
    }
  };

  // Market Position Search Mutation
  const marketPositionSearchMutation = useMutation({
    mutationFn: async (companyName: string) => {
      const response = await fetch(`/api/deals/${dealId}/market-position-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to search market position');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      console.log('📊 Market position search completed:', data);
      setMarketPositionSearchData(data);
      setIsMarketPositionSearching(false);
    },
    onError: (error) => {
      console.error('Market position search failed:', error);
      setIsMarketPositionSearching(false);
    }
  });

  const handleMarketPositionSearch = () => {
    if (researchData?.companyName) {
      setIsMarketPositionSearching(true);
      setMarketPositionSearchData(null);
      marketPositionSearchMutation.mutate(researchData.companyName);
    }
  };

  // Competitive Landscape Search Mutation
  const competitiveSearchMutation = useMutation({
    mutationFn: async (companyName: string) => {
      const response = await fetch(`/api/deals/${dealId}/competitive-landscape-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to search competitive landscape');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      console.log('🎯 Competitive landscape search completed:', data);
      setCompetitiveSearchData(data);
      setIsCompetitiveSearching(false);
    },
    onError: (error) => {
      console.error('Competitive landscape search failed:', error);
      setIsCompetitiveSearching(false);
    }
  });

  const handleCompetitiveSearch = () => {
    if (researchData?.companyName) {
      setIsCompetitiveSearching(true);
      setCompetitiveSearchData(null);
      competitiveSearchMutation.mutate(researchData.companyName);
    }
  };



  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <Card className="bg-dark border-dark-lighter">
          <CardHeader>
            <div className="h-6 bg-dark-lighter rounded w-1/2"></div>
            <div className="h-4 bg-dark-lighter rounded w-1/3 mt-2"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-4 bg-dark-lighter rounded w-full"></div>
              <div className="h-4 bg-dark-lighter rounded w-3/4"></div>
              <div className="h-4 bg-dark-lighter rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !researchData) {
    return (
      <Card className="bg-dark border-dark-lighter">
        <CardContent className="p-12 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Brain className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">AI-Powered Company Intelligence</h3>
          <p className="text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed">
            Launch comprehensive AI research to gather deep intelligence from multiple sources including market analysis, 
            competitive positioning, financial metrics, leadership profiles, and risk assessment using advanced algorithms.
          </p>
          {researchProgress?.status === 'processing' ? (
            <div className="space-y-4">
              <div className="bg-dark-lighter rounded-lg p-6 border border-primary/20">
                <div className="flex items-center gap-3 mb-4">
                  <Brain className="h-6 w-6 text-primary animate-pulse" />
                  <div>
                    <h3 className="text-lg font-semibold text-white">AI Research in Progress</h3>
                    <p className="text-sm text-gray-400">
                      {researchProgress.stage}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Progress</span>
                    <span className="text-white font-medium">{researchProgress.progress}%</span>
                  </div>
                  <Progress 
                    value={researchProgress.progress} 
                    className="h-2 bg-dark border border-dark-lighter"
                  />
                </div>
                
                {researchProgress.debugInfo && (
                  <div className="mt-4 p-3 bg-dark rounded border border-gray-700">
                    <p className="text-xs text-gray-500 font-mono">
                      Debug: Job #{researchProgress.jobId} | Step: {researchProgress.debugInfo.step || 'Unknown'}
                    </p>
                    {researchProgress.debugInfo.timestamp && (
                      <p className="text-xs text-gray-600 font-mono">
                        Last Update: {new Date(researchProgress.debugInfo.timestamp).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                )}
                
                <div className="mt-4 text-center">
                  <p className="text-xs text-gray-500">
                    Research continues running in background • Navigate away safely
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <Button 
              onClick={handleRefreshResearch}
              disabled={isRefreshing || refreshResearchMutation.isPending}
              className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white px-8 py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              size="lg"
            >
              {isRefreshing || refreshResearchMutation.isPending ? (
                <>
                  <Brain className="h-5 w-5 mr-3 animate-pulse" />
                  Starting AI Research...
                </>
              ) : (
                <>
                  <Search className="h-5 w-5 mr-3" />
                  Start AI Company Research
                </>
              )}
            </Button>
          )}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-500 justify-center">
              <CheckCircle className="h-4 w-4 text-green-400" />
              Executive Intelligence
            </div>
            <div className="flex items-center gap-2 text-gray-500 justify-center">
              <CheckCircle className="h-4 w-4 text-blue-400" />
              Financial Analysis
            </div>
            <div className="flex items-center gap-2 text-gray-500 justify-center">
              <CheckCircle className="h-4 w-4 text-purple-400" />
              Risk Assessment
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'text-green-400 bg-green-400/20 border-green-400/30';
      case 'in_progress': return 'text-yellow-400 bg-yellow-400/20 border-yellow-400/30';
      case 'pending': return 'text-gray-400 bg-gray-400/20 border-gray-400/30';
      case 'error': return 'text-red-400 bg-red-400/20 border-red-400/30';
      default: return 'text-gray-400 bg-gray-400/20 border-gray-400/30';
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 85) return 'text-green-400 bg-green-400/20';
    if (score >= 70) return 'text-yellow-400 bg-yellow-400/20';
    return 'text-red-400 bg-red-400/20';
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Research Header */}
      <Card className="bg-gradient-to-r from-dark via-dark-light to-dark border-dark-lighter overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-blue-600/5"></div>
        <CardHeader className="relative">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-blue-600/20 rounded-xl flex items-center justify-center">
                  <Brain className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl text-white font-bold">
                    {researchData.companyName} Intelligence
                  </CardTitle>
                  <CardDescription className="text-base mt-1">
                    AI-powered comprehensive company analysis from {researchData.sources} verified sources
                  </CardDescription>
                </div>
              </div>
              
              <div className="flex items-center gap-4 mt-4">
                <Badge className={`px-3 py-1 font-medium border ${getStatusColor(researchData.researchStatus)}`}>
                  {researchData.researchStatus === 'complete' && <CheckCircle className="h-3 w-3 mr-1" />}
                  {researchData.researchStatus === 'in_progress' && <Clock className="h-3 w-3 mr-1 animate-spin" />}
                  {researchData.researchStatus === 'error' && <AlertTriangle className="h-3 w-3 mr-1" />}
                  {researchData.researchStatus.replace('_', ' ').toUpperCase()}
                </Badge>
                
                <div className={`flex items-center gap-2 px-3 py-1 rounded-lg ${getConfidenceColor(researchData.aiConfidenceScore)}`}>
                  <Target className="h-3 w-3" />
                  <span className="text-sm font-medium">
                    {researchData.aiConfidenceScore}% AI Confidence
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Globe className="h-4 w-4" />
                  <ExternalLink 
                    className="h-3 w-3 cursor-pointer hover:text-white transition-colors" 
                    onClick={() => window.open(researchData.website, '_blank')}
                  />
                  <span>{researchData.website}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm text-gray-400">Last Analysis</div>
                <div className="text-sm text-white">
                  {new Date(researchData.lastUpdated).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleRefreshResearch}
                disabled={isRefreshing || refreshResearchMutation.isPending}
                className="bg-dark-lighter hover:bg-dark border-dark-lighter"
              >
                {isRefreshing || refreshResearchMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    Running...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Rerun
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {/* Research Progress Indicator */}
        {researchProgress && (
          <div className="px-6 pb-4">
            <div className="bg-dark-lighter rounded-lg p-4 border border-primary/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm font-medium text-white">AI Research in Progress</span>
                </div>
                <div className="text-sm text-primary font-bold">
                  {Math.min(researchProgress.progress, 100)}%
                </div>
              </div>
              <div className="w-full bg-dark rounded-full h-2 mb-2">
                <div 
                  className="bg-gradient-to-r from-primary to-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(researchProgress.progress, 100)}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-400">
                {researchProgress.stage}
              </div>
              {researchProgress.debugInfo && (
                <div className="text-xs text-gray-500 mt-1">
                  Job ID: {researchProgress.jobId} • Status: {researchProgress.status}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* AI Analysis Summary */}
      {researchData.aiAnalysis && (
        <Card className="bg-gradient-to-br from-primary/10 to-blue-600/10 border-primary/20">
          <CardHeader>
            <CardTitle className="text-xl text-white flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Investment Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-1">
                  {researchData.aiAnalysis.investmentScore}/100
                </div>
                <div className="text-sm text-gray-400">Investment Score</div>
                <Progress 
                  value={researchData.aiAnalysis.investmentScore} 
                  className="mt-2 h-2"
                />
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400 mb-1">
                  {researchData.aiAnalysis.confidenceLevel}%
                </div>
                <div className="text-sm text-gray-400">Confidence Level</div>
                <Progress 
                  value={researchData.aiAnalysis.confidenceLevel} 
                  className="mt-2 h-2"
                />
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400 mb-1">
                  {researchData.aiAnalysis.keyStrengths.length}
                </div>
                <div className="text-sm text-gray-400">Key Strengths</div>
              </div>
            </div>
            
            <Separator className="border-primary/20" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-green-400 mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Key Strengths
                </h4>
                <ul className="space-y-2">
                  {researchData.aiAnalysis.keyStrengths.map((strength, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                      <Star className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold text-red-400 mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Key Risks
                </h4>
                <ul className="space-y-2">
                  {researchData.aiAnalysis.keyRisks.map((risk, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                      <AlertTriangle className="h-3 w-3 text-red-400 mt-0.5 flex-shrink-0" />
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            <Alert className="bg-primary/10 border-primary/20">
              <Lightbulb className="h-4 w-4 text-primary" />
              <AlertDescription className="text-white">
                <strong>AI Recommendation:</strong> {researchData.aiAnalysis.recommendation}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Research Tabs */}
      <Card className="bg-dark border-dark-lighter">
        <CardContent className="p-0">
          <Tabs value={activeResearchTab} onValueChange={setActiveResearchTab} className="w-full">
            <div className="border-b border-dark-lighter px-6 py-4">
              <TabsList className="bg-dark-lighter border border-dark-lighter h-auto p-1 grid grid-cols-4 lg:grid-cols-9 w-full">
                <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-white text-xs">
                  <Building className="h-3 w-3 mr-1" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="leadership" className="data-[state=active]:bg-primary data-[state=active]:text-white text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  Leadership
                </TabsTrigger>
                <TabsTrigger value="financial" className="data-[state=active]:bg-primary data-[state=active]:text-white text-xs">
                  <DollarSign className="h-3 w-3 mr-1" />
                  Financial
                </TabsTrigger>
                <TabsTrigger value="market" className="data-[state=active]:bg-primary data-[state=active]:text-white text-xs">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Market
                </TabsTrigger>
                <TabsTrigger value="intelligence" className="data-[state=active]:bg-primary data-[state=active]:text-white text-xs">
                  <Brain className="h-3 w-3 mr-1" />
                  Intelligence
                </TabsTrigger>
                <TabsTrigger value="risks" className="data-[state=active]:bg-primary data-[state=active]:text-white text-xs">
                  <Shield className="h-3 w-3 mr-1" />
                  Risks
                </TabsTrigger>
                <TabsTrigger value="investment" className="data-[state=active]:bg-primary data-[state=active]:text-white text-xs">
                  <Target className="h-3 w-3 mr-1" />
                  Investment
                </TabsTrigger>
                <TabsTrigger value="links" className="data-[state=active]:bg-primary data-[state=active]:text-white text-xs">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Links
                </TabsTrigger>
                <TabsTrigger value="ai-analysis" className="data-[state=active]:bg-primary data-[state=active]:text-white text-xs">
                  <Brain className="h-3 w-3 mr-1" />
                  AI Analysis
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Company Overview Tab */}
            <TabsContent value="overview" className="p-6">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-dark-lighter border-dark-lighter">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Building className="h-5 w-5 text-blue-400" />
                        Company Profile
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-400">Business Model</label>
                        <p className="text-white mt-1">
                          {researchData.aiAnalysis?.businessModel || researchData.businessIntelligence?.businessModel || 'Business model analysis pending'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-400">Target Customers</label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {Array.isArray(researchData.aiAnalysis?.targetCustomers) ? 
                            researchData.aiAnalysis.targetCustomers.map((customer, index) => (
                              <Badge key={index} variant="secondary" className="bg-blue-500/20 text-blue-400">
                                {customer}
                              </Badge>
                            )) : (
                              <p className="text-white mt-1">
                                {researchData.businessIntelligence?.customerBase || 'Customer analysis in progress'}
                              </p>
                            )
                          }
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-400">Products & Services</label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {researchData.aiAnalysis?.productsServices?.map((service, index) => (
                            <Badge key={index} variant="secondary" className="bg-green-500/20 text-green-400">
                              {service}
                            </Badge>
                          )) || researchData.businessIntelligence?.technologyStack?.map((tech, index) => (
                            <Badge key={index} variant="secondary" className="bg-blue-500/20 text-blue-400">
                              {tech}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-dark-lighter border-dark-lighter">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Activity className="h-5 w-5 text-green-400" />
                        Company Metrics
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-400">Employees</label>
                          <p className="text-white font-semibold mt-1">
                            {researchData.financialData?.employeeCount === 'Not available' ? 
                              'No data found' : 
                              researchData.financialData?.employeeCount || 'No data found'}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-400">Patents</label>
                          <p className="text-white font-semibold mt-1">
                            {researchData.businessIntelligence?.patents !== undefined ? 
                              (researchData.businessIntelligence.patents === 0 ? 'No patents found' : researchData.businessIntelligence.patents) : 
                              'No data found'}
                          </p>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-400">Partnerships</label>
                        <div className="mt-2">
                          {researchData.businessIntelligence?.partnerships?.length > 0 ? (
                            researchData.businessIntelligence.partnerships.map((partner, index) => (
                              <Badge key={index} variant="outline" className="mr-2 mb-2">
                                {partner}
                              </Badge>
                            ))
                          ) : (
                            <p className="text-gray-400 text-sm">No partnerships found</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Leadership Tab */}
            <TabsContent value="leadership" className="p-6">
              <div className="space-y-6">
                {researchData.ceoProfile && (
                  <Card className="bg-gradient-to-r from-primary/10 to-blue-600/10 border-primary/20">
                    <CardHeader>
                      <CardTitle className="text-xl flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        Chief Executive Officer
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
                          <User className="h-8 w-8 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-white">
                            {researchData.ceoProfile.name}
                          </h3>
                          <p className="text-gray-300 mt-1">
                            {researchData.ceoProfile.background}
                          </p>
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <Briefcase className="h-4 w-4" />
                              <span>{researchData.ceoProfile.experience}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <Award className="h-4 w-4" />
                              <span>{researchData.ceoProfile.education}</span>
                            </div>
                          </div>
                          <div className="mt-4">
                            <label className="text-sm font-medium text-gray-400">Previous Companies</label>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {researchData.ceoProfile.previousCompanies && researchData.ceoProfile.previousCompanies.length > 0 ? (
                                researchData.ceoProfile.previousCompanies.map((company, index) => (
                                  <Badge key={index} variant="secondary" className="bg-primary/20 text-primary">
                                    {company}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-gray-400 text-sm">No previous companies found</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {researchData.keyTeamMembers && researchData.keyTeamMembers.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Key Team Members
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {researchData.keyTeamMembers.map((member, index) => (
                        <Card key={index} className="bg-dark-lighter border-dark-lighter">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                                <User className="h-6 w-6 text-blue-400" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-white">{member.name}</h4>
                                <p className="text-sm text-blue-400 mb-2">{member.role}</p>
                                <p className="text-xs text-gray-400">{member.background}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Financial Tab */}
            <TabsContent value="financial" className="p-6">
              <div className="space-y-6">
                {/* Financial Search Button */}
                <div className="flex justify-end mb-4">
                  <Button
                    onClick={handleFinancialSearch}
                    disabled={isFinancialSearching || financialSearchMutation.isPending}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-4 py-2 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    {isFinancialSearching || financialSearchMutation.isPending ? (
                      <>
                        <DollarSign className="h-4 w-4 mr-2 animate-pulse" />
                        Searching Financial Data...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Search Financial Data
                      </>
                    )}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-green-500/10 border-green-500/20">
                    <CardContent className="p-4 text-center">
                      <DollarSign className="h-8 w-8 text-green-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-green-400">
                        {financialSearchData?.revenue || 
                         (researchData.financialData?.revenue === 'Financial information not available' ? 
                          'No data found' : 
                          researchData.financialData?.revenue || 'No data found')}
                      </div>
                      <div className="text-sm text-gray-400">
                        Revenue Range
                        {financialSearchData?.revenue && (
                          <span className="ml-1 text-green-400">• AI Enhanced</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-blue-500/10 border-blue-500/20">
                    <CardContent className="p-4 text-center">
                      <TrendingUp className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-blue-400">
                        {financialSearchData?.valuation || 
                         (researchData.financialData?.valuation === 'Not available' ? 
                          'No data found' : 
                          researchData.financialData?.valuation || 'No data found')}
                      </div>
                      <div className="text-sm text-gray-400">
                        Valuation Range
                        {financialSearchData?.valuation && (
                          <span className="ml-1 text-blue-400">• AI Enhanced</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-purple-500/10 border-purple-500/20">
                    <CardContent className="p-4 text-center">
                      <Star className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-purple-400">
                        {researchData.aiAnalysis?.investmentScore ? `${researchData.aiAnalysis.investmentScore}/100` : researchData.financialData?.runway || 'Calculating'}
                      </div>
                      <div className="text-sm text-gray-400">
                        {researchData.aiAnalysis?.investmentScore ? 'Investment Score' : 'Runway'}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-dark-lighter border-dark-lighter">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Funding History
                      {financialSearchData?.fundingHistory && (
                        <Badge className="ml-2 bg-green-500/20 text-green-400 border-green-500/30">
                          AI Enhanced
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(financialSearchData?.fundingHistory || researchData.financialData?.fundingHistory) ? (
                      <div className="space-y-4">
                        {(financialSearchData?.fundingHistory || researchData.financialData?.fundingHistory)?.map((round, index) => (
                          <div key={index} className="flex items-center justify-between p-4 bg-dark rounded-lg">
                            <div>
                              <div className="font-semibold text-white">{round.round}</div>
                              <div className="text-sm text-gray-400">{round.amount}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-white">{round.date}</div>
                              <div className="text-xs text-gray-400">
                                {Array.isArray(round.investors) ? round.investors.join(', ') : round.investors || 'Undisclosed'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="text-gray-400 mb-2">No funding history available</div>
                        <div className="text-sm text-gray-500">
                          {financialSearchData === null ? 'Click "Search Financial Data" to get the latest funding information' : 'No funding rounds found in available data sources'}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Financial Search Results */}
                {financialSearchData && (
                  <Card className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-green-400" />
                        AI Financial Intelligence
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          Fresh Data
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-400">Employee Count</label>
                          <p className="text-white font-semibold mt-1">
                            {financialSearchData.employeeCount || 'Not available'}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-400">Growth Rate</label>
                          <p className="text-white font-semibold mt-1">
                            {financialSearchData.financialMetrics?.growthRate || 'Not available'}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-400">Burn Rate</label>
                          <p className="text-white font-semibold mt-1">
                            {financialSearchData.financialMetrics?.burnRate || 'Not available'}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-400">Runway</label>
                          <p className="text-white font-semibold mt-1">
                            {financialSearchData.financialMetrics?.runway || 'Not available'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Market Analysis Tab */}
            <TabsContent value="market" className="p-6">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-dark-lighter border-dark-lighter">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <ChartBar className="h-5 w-5 text-blue-400" />
                        Market Position
                        {marketPositionSearchData && (
                          <Badge className="ml-2 bg-blue-500/20 text-blue-400 border-blue-500/30">
                            AI Enhanced
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-end mb-4">
                        <Button
                          onClick={handleMarketPositionSearch}
                          disabled={isMarketPositionSearching || !researchData?.companyName}
                          className="bg-blue-500 hover:bg-blue-600 text-white"
                          size="sm"
                        >
                          {isMarketPositionSearching ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Searching...
                            </>
                          ) : (
                            <>
                              <Search className="h-4 w-4 mr-2" />
                              Search Market Position
                            </>
                          )}
                        </Button>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium text-gray-400">Industry Sector</label>
                        <p className="text-white mt-1">
                          {marketPositionSearchData?.industrySector || 
                           researchData.aiAnalysis?.industrySector || 
                           researchData.marketAnalysis?.marketSize || 
                           'Market research in progress'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-400">Market Position</label>
                        <p className="text-white mt-1">
                          {marketPositionSearchData?.marketPosition || 
                           researchData.marketAnalysis?.marketPosition || 
                           'Positioning analysis pending'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-400">Market Size</label>
                        <p className="text-white mt-1">
                          {marketPositionSearchData?.marketSize || 
                           researchData.marketAnalysis?.marketSize || 
                           'Market size analysis pending'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-400">Key Value Propositions</label>
                        <div className="space-y-2">
                          {(marketPositionSearchData?.valuePropositions || researchData.aiAnalysis?.keyValuePropositions)?.map((value, index) => (
                            <div key={index} className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                              <p className="text-white text-sm">{value}</p>
                            </div>
                          )) || (
                            <p className="text-white mt-1">
                              {researchData.marketAnalysis?.uniqueValueProposition || 'Value analysis in progress'}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-dark-lighter border-dark-lighter">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Target className="h-5 w-5 text-green-400" />
                        Competitive Landscape
                        {competitiveSearchData && (
                          <Badge className="ml-2 bg-green-500/20 text-green-400 border-green-500/30">
                            AI Enhanced
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-end mb-4">
                        <Button
                          onClick={handleCompetitiveSearch}
                          disabled={isCompetitiveSearching || !researchData?.companyName}
                          className="bg-green-500 hover:bg-green-600 text-white"
                          size="sm"
                        >
                          {isCompetitiveSearching ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <Search className="h-4 w-4 mr-2" />
                              Search Competitive Landscape
                            </>
                          )}
                        </Button>
                      </div>
                      
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-400">Main Competitors</label>
                        <div className="flex flex-wrap gap-2">
                          {(competitiveSearchData?.competitors || researchData.marketAnalysis?.competitors)?.map((competitor, index) => (
                            <Badge key={index} variant="outline" className="border-red-500/30 text-red-400">
                              {competitor}
                            </Badge>
                          ))}
                        </div>
                        
                        {competitiveSearchData?.competitiveAdvantages && (
                          <div className="mt-4">
                            <label className="text-sm font-medium text-gray-400">Competitive Advantages</label>
                            <div className="space-y-2 mt-2">
                              {competitiveSearchData.competitiveAdvantages.map((advantage, index) => (
                                <div key={index} className="flex items-start gap-2">
                                  <Star className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                                  <p className="text-white text-sm">{advantage}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {competitiveSearchData?.marketShare && (
                          <div className="mt-4">
                            <label className="text-sm font-medium text-gray-400">Market Share</label>
                            <p className="text-white mt-1">{competitiveSearchData.marketShare}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Business Intelligence Tab */}
            <TabsContent value="intelligence" className="p-6">
              <div className="space-y-6">
                {researchData.businessIntelligence?.recentNews && (
                  <Card className="bg-dark-lighter border-dark-lighter">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-400" />
                        Recent News & Press
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {researchData.businessIntelligence.recentNews.map((news, index) => (
                          <div key={index} className="p-4 bg-dark rounded-lg border border-dark-lighter">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-semibold text-white mb-1">{news.title}</h4>
                                <div className="flex items-center gap-3 text-sm text-gray-400">
                                  <span>{news.source}</span>
                                  <span>•</span>
                                  <span>{news.date}</span>
                                  {news.sentiment && (
                                    <>
                                      <span>•</span>
                                      <Badge 
                                        variant="secondary" 
                                        className={
                                          news.sentiment === 'positive' ? 'bg-green-500/20 text-green-400' :
                                          news.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                                          'bg-gray-500/20 text-gray-400'
                                        }
                                      >
                                        {news.sentiment}
                                      </Badge>
                                    </>
                                  )}
                                </div>
                              </div>
                              {news.url && (
                                <Button variant="ghost" size="sm" onClick={() => window.open(news.url, '_blank')}>
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Risk Assessment Tab */}
            <TabsContent value="risks" className="p-6">
              <div className="space-y-6">
                {(researchData.aiAnalysis?.keyRisks || researchData.riskFactors) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-red-500/10 border-red-500/20">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-400" />
                          Key Risk Factors
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {researchData.aiAnalysis?.keyRisks ? (
                          <div>
                            <h4 className="font-medium text-white mb-2">AI-Identified Risks</h4>
                            <ul className="space-y-1">
                              {researchData.aiAnalysis.keyRisks.map((risk, index) => (
                                <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                                  <AlertTriangle className="h-3 w-3 text-red-400 mt-0.5 flex-shrink-0" />
                                  {risk}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          Object.entries(researchData.riskFactors).map(([category, risks]) => {
                            if (category === 'riskLevel' || !Array.isArray(risks)) return null;
                            return (
                              <div key={category}>
                                <h4 className="font-medium text-white capitalize mb-2">{category}</h4>
                                <ul className="space-y-1">
                                  {risks.map((risk, index) => (
                                    <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                                      <AlertTriangle className="h-3 w-3 text-red-400 mt-0.5 flex-shrink-0" />
                                      {risk}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-dark-lighter border-dark-lighter">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Shield className="h-5 w-5 text-blue-400" />
                          Risk Assessment
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="text-center">
                            <div className={`text-3xl font-bold mb-2 ${
                              researchData.riskFactors.riskLevel === 'low' ? 'text-green-400' :
                              researchData.riskFactors.riskLevel === 'medium' ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {researchData.riskFactors.riskLevel?.toUpperCase() || 'ANALYZING'}
                            </div>
                            <div className="text-sm text-gray-400">Overall Risk Level</div>
                          </div>
                          
                          <Alert className={`${
                            researchData.riskFactors.riskLevel === 'low' ? 'bg-green-500/10 border-green-500/20' :
                            researchData.riskFactors.riskLevel === 'medium' ? 'bg-yellow-500/10 border-yellow-500/20' :
                            'bg-red-500/10 border-red-500/20'
                          }`}>
                            <Info className="h-4 w-4" />
                            <AlertDescription className="text-white">
                              Risk assessment based on regulatory, competitive, financial, and operational factors.
                            </AlertDescription>
                          </Alert>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Investment Highlights Tab */}
            <TabsContent value="investment" className="p-6">
              <div className="space-y-6">
                {researchData.investmentHighlights && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-green-500/10 border-green-500/20">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Lightbulb className="h-5 w-5 text-green-400" />
                          Investment Thesis
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {researchData.aiAnalysis?.keyStrengths?.map((point, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                              <CheckCircle className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                              {point}
                            </li>
                          )) || researchData.investmentHighlights.investmentThesis?.map((point, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                              <CheckCircle className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                              {point}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    <Card className="bg-blue-500/10 border-blue-500/20">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Star className="h-5 w-5 text-blue-400" />
                          Competitive Advantages
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {researchData.aiAnalysis?.keyValuePropositions?.map((advantage, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                              <Star className="h-3 w-3 text-blue-400 mt-0.5 flex-shrink-0" />
                              {advantage}
                            </li>
                          )) || researchData.investmentHighlights.competitiveAdvantages?.map((advantage, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                              <Star className="h-3 w-3 text-blue-400 mt-0.5 flex-shrink-0" />
                              {advantage}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* External Links Tab */}
            <TabsContent value="links" className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {researchData.externalLinks && Object.entries(researchData.externalLinks).map(([platform, url]) => {
                  if (!url) return null;
                  return (
                    <Card key={platform} className="bg-dark-lighter border-dark-lighter">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <ExternalLink className="h-5 w-5 text-primary" />
                            <div>
                              <div className="font-medium text-white capitalize">
                                {platform.replace('Url', '').replace(/([A-Z])/g, ' $1').trim()}
                              </div>
                              <div className="text-sm text-gray-400 truncate max-w-[200px]">
                                {url}
                              </div>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => window.open(url, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            {/* AI Analysis Tab */}
            <TabsContent value="ai-analysis" className="p-6">
              <div className="space-y-6">
                {researchData.aiAnalysis && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Investment Score Card */}
                    <Card className="bg-gradient-to-r from-primary/10 to-blue-600/10 border-primary/20">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Star className="h-5 w-5 text-primary" />
                          Investment Score
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center">
                          <div className="text-4xl font-bold text-primary mb-2">
                            {researchData.aiAnalysis.investmentScore}/100
                          </div>
                          <div className="text-sm text-gray-400 mb-4">Investment Rating</div>
                          <div className="flex items-center justify-center gap-2">
                            <div className="text-sm text-gray-400">Confidence:</div>
                            <div className="text-sm font-semibold text-white">
                              {researchData.aiAnalysis.confidenceLevel}%
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Business Model Card */}
                    <Card className="bg-dark-lighter border-dark-lighter">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Building className="h-5 w-5 text-blue-400" />
                          Business Intelligence
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-400">Industry</label>
                          <p className="text-white mt-1">{researchData.aiAnalysis.industry}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-400">Business Model</label>
                          <p className="text-white mt-1">{researchData.aiAnalysis.businessModel}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-400">Target Customers</label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {Array.isArray(researchData.aiAnalysis?.targetCustomers) ? 
                              researchData.aiAnalysis.targetCustomers.map((customer, index) => (
                                <Badge key={index} variant="secondary" className="bg-blue-500/20 text-blue-400">
                                  {customer}
                                </Badge>
                              )) : (
                                <p className="text-white mt-1">Target customers analysis pending</p>
                              )
                            }
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Key Strengths Card */}
                    <Card className="bg-green-500/10 border-green-500/20">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-400" />
                          Key Strengths
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-3">
                          {researchData.aiAnalysis.keyStrengths?.map((strength, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                              <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    {/* Key Risks Card */}
                    <Card className="bg-red-500/10 border-red-500/20">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-400" />
                          Key Risks
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-3">
                          {researchData.aiAnalysis.keyRisks?.map((risk, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                              <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                              {risk}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    {/* Value Propositions Card */}
                    <Card className="bg-purple-500/10 border-purple-500/20">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Lightbulb className="h-5 w-5 text-purple-400" />
                          Value Propositions
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-3">
                          {researchData.aiAnalysis.valuePropositions?.map((value, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                              <Lightbulb className="h-4 w-4 text-purple-400 mt-0.5 flex-shrink-0" />
                              {value}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    {/* Products & Services Card */}
                    <Card className="bg-dark-lighter border-dark-lighter">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Package className="h-5 w-5 text-blue-400" />
                          Products & Services
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {researchData.aiAnalysis.productsServices?.map((service, index) => (
                            <Badge key={index} variant="outline" className="border-blue-500/30 text-blue-400">
                              {service}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* AI Recommendation Card */}
                {researchData.aiAnalysis?.recommendation && (
                  <Card className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border-blue-500/20">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Brain className="h-5 w-5 text-blue-400" />
                        AI Investment Recommendation
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-white leading-relaxed">
                        {researchData.aiAnalysis.recommendation}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Next Steps Card */}
                {researchData.aiAnalysis?.nextSteps && (
                  <Card className="bg-dark-lighter border-dark-lighter">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <ArrowRight className="h-5 w-5 text-green-400" />
                        Recommended Next Steps
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3">
                        {researchData.aiAnalysis.nextSteps.map((step, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                            <ArrowRight className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                            {step}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}