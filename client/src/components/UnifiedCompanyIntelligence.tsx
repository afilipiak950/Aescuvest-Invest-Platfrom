import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  RefreshCw, Globe, DollarSign, Users, Building, TrendingUp, 
  Brain, Target, AlertTriangle, CheckCircle, Clock,
  ExternalLink, User, Briefcase, Award, Lightbulb,
  Shield, Scale, Beaker, BookOpen, Loader2, Info,
  ChevronRight, Database, BarChart3, Zap
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface DataCompletenessSection {
  name: string;
  hasData: boolean;
  dataPoints: number;
  sources: string[];
}

interface UnifiedIntelligence {
  dealId: number;
  companyName: string;
  website?: string;
  sector?: string;
  stage?: string;
  
  dataCompleteness: {
    overallScore: number;
    sections: DataCompletenessSection[];
    missingCritical: string[];
    lastFullUpdate?: string;
  };
  
  executiveTeam: {
    ceo?: {
      name: string;
      background?: string;
      experience?: string;
      education?: string;
      previousCompanies?: string[];
      linkedinUrl?: string;
      source: string;
    };
    keyMembers?: Array<{
      name: string;
      role: string;
      background?: string;
      source: string;
    }>;
    teamStrengths?: string[];
    teamRisks?: string[];
  };
  
  financialIntelligence: {
    revenue?: string;
    valuation?: string;
    fundingAmount?: string;
    fundingHistory?: Array<{
      round: string;
      amount: string;
      date: string;
      investors?: string[];
      source: string;
    }>;
    employeeCount?: string;
    growthRate?: string;
    burnRate?: string;
    runway?: string;
    financialStrengths?: string[];
    financialRisks?: string[];
    sources: string[];
  };
  
  marketAnalysis: {
    marketSize?: string;
    marketPosition?: string;
    competitors?: string[];
    competitiveAdvantages?: string[];
    customerSegments?: string[];
    businessModel?: string;
    marketOpportunity?: string;
    sources: string[];
  };
  
  riskAssessment: {
    overallRiskLevel: 'low' | 'medium' | 'high' | 'unknown';
    regulatory?: string[];
    competitive?: string[];
    financial?: string[];
    operational?: string[];
    clinical?: string[];
    legal?: string[];
    ip?: string[];
    sources: string[];
  };
  
  investmentHighlights: {
    keyStrengths: string[];
    keyRisks: string[];
    traction?: string[];
    differentiators?: string[];
    investmentThesis?: string[];
    sources: string[];
  };
  
  aiScoring: {
    overallScore?: number;
    confidence?: number;
    criteriaScores?: Array<{
      name: string;
      score: number;
      weight: number;
      reasoning?: string;
    }>;
    recommendation?: string;
    lastEvaluated?: string;
  };
  
  agentInsights: {
    [key: string]: {
      status: string;
      keyFindings: string[];
      risks: string[];
      lastAnalyzed?: string;
    } | undefined;
  };
  
  externalLinks: {
    website?: string;
    pitchbookUrl?: string;
    crunchbaseUrl?: string;
    linkedinCompanyUrl?: string;
    northdataUrl?: string;
  };
  
  metadata: {
    researchStatus: 'pending' | 'processing' | 'complete' | 'error';
    lastResearchUpdate?: string;
    sourcesCount: number;
    qualityScore: number;
  };
}

interface UnifiedCompanyIntelligenceProps {
  dealId: number;
}

export default function UnifiedCompanyIntelligence({ dealId }: UnifiedCompanyIntelligenceProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: intelligence, isLoading, error, refetch } = useQuery<UnifiedIntelligence>({
    queryKey: ['/api/deals', dealId, 'intelligence'],
    enabled: !!dealId,
    staleTime: 30000,
  });

  const runResearchMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/deals/${dealId}/research`, {
        method: 'POST',
        body: JSON.stringify({ forceRefresh: true }),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Research Started',
        description: 'AI research is now running in the background. This may take a few minutes.',
      });
      setTimeout(() => refetch(), 5000);
    },
    onError: (error: any) => {
      toast({
        title: 'Research Failed',
        description: error.message || 'Failed to start research',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="intelligence-loading">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
        <span className="text-gray-400">Loading company intelligence...</span>
      </div>
    );
  }

  if (error || !intelligence) {
    return (
      <Alert className="bg-red-900/20 border-red-800">
        <AlertTriangle className="h-4 w-4 text-red-400" />
        <AlertDescription className="text-red-300">
          Failed to load company intelligence. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  const { dataCompleteness, metadata } = intelligence;
  
  const safeMetadata = {
    researchStatus: metadata?.researchStatus || 'pending',
    lastResearchUpdate: metadata?.lastResearchUpdate,
    sourcesCount: metadata?.sourcesCount || 1,
    qualityScore: metadata?.qualityScore ?? 0
  };
  
  const safeDataCompleteness = {
    overallScore: dataCompleteness?.overallScore ?? 0,
    sections: dataCompleteness?.sections || [],
    missingCritical: dataCompleteness?.missingCritical || [],
    lastFullUpdate: dataCompleteness?.lastFullUpdate
  };

  const safeInvestmentHighlights = {
    keyStrengths: intelligence.investmentHighlights?.keyStrengths || [],
    keyRisks: intelligence.investmentHighlights?.keyRisks || [],
    traction: intelligence.investmentHighlights?.traction || [],
    differentiators: intelligence.investmentHighlights?.differentiators || [],
    investmentThesis: intelligence.investmentHighlights?.investmentThesis || [],
    sources: intelligence.investmentHighlights?.sources || []
  };

  const safeAIScoring = {
    overallScore: intelligence.aiScoring?.overallScore,
    confidence: intelligence.aiScoring?.confidence,
    criteriaScores: intelligence.aiScoring?.criteriaScores || [],
    recommendation: intelligence.aiScoring?.recommendation
  };

  const safeExecutiveTeam = {
    ceo: intelligence.executiveTeam?.ceo,
    keyMembers: intelligence.executiveTeam?.keyMembers || [],
    teamStrengths: intelligence.executiveTeam?.teamStrengths || [],
    teamRisks: intelligence.executiveTeam?.teamRisks || []
  };

  const safeFinancialIntelligence = {
    sources: intelligence.financialIntelligence?.sources || [],
    fundingAmount: intelligence.financialIntelligence?.fundingAmount,
    revenue: intelligence.financialIntelligence?.revenue,
    valuation: intelligence.financialIntelligence?.valuation,
    fundingHistory: intelligence.financialIntelligence?.fundingHistory || [],
    employeeCount: intelligence.financialIntelligence?.employeeCount,
    growthRate: intelligence.financialIntelligence?.growthRate
  };

  const safeMarketAnalysis = {
    sources: intelligence.marketAnalysis?.sources || [],
    marketSize: intelligence.marketAnalysis?.marketSize,
    marketPosition: intelligence.marketAnalysis?.marketPosition,
    competitors: intelligence.marketAnalysis?.competitors || [],
    businessModel: intelligence.marketAnalysis?.businessModel
  };

  const safeRiskAssessment = {
    overallRiskLevel: intelligence.riskAssessment?.overallRiskLevel || 'unknown',
    regulatory: intelligence.riskAssessment?.regulatory || [],
    competitive: intelligence.riskAssessment?.competitive || [],
    financial: intelligence.riskAssessment?.financial || [],
    operational: intelligence.riskAssessment?.operational || [],
    clinical: intelligence.riskAssessment?.clinical || [],
    legal: intelligence.riskAssessment?.legal || [],
    ip: intelligence.riskAssessment?.ip || [],
    sources: intelligence.riskAssessment?.sources || []
  };

  const safeAgentInsights = intelligence.agentInsights || {};

  const getQualityColor = (score: number) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-600/20 text-green-400 border-green-600/30';
      case 'medium': return 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30';
      case 'high': return 'bg-red-600/20 text-red-400 border-red-600/30';
      default: return 'bg-gray-600/20 text-gray-400 border-gray-600/30';
    }
  };

  return (
    <div className="space-y-6" data-testid="unified-intelligence">
      <Card className="bg-gradient-to-r from-primary/10 to-blue-500/10 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-primary/20 rounded-lg flex items-center justify-center">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Amplifa Intelligence</CardTitle>
                <CardDescription>
                  AI-powered comprehensive company analysis from {safeMetadata.sourcesCount} verified sources
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge 
                variant="outline" 
                className={`${safeMetadata.researchStatus === 'complete' ? 'bg-green-600/20 text-green-400' : 'bg-yellow-600/20 text-yellow-400'}`}
              >
                {safeMetadata.researchStatus === 'complete' ? 'COMPLETE' : safeMetadata.researchStatus.toUpperCase()}
              </Badge>
              <div className="text-right">
                <div className={`text-2xl font-bold ${getQualityColor(safeMetadata.qualityScore)}`}>
                  {safeMetadata.qualityScore}%
                </div>
                <div className="text-xs text-gray-400">Data Quality</div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {safeDataCompleteness.sections.map((section) => (
              <div 
                key={section.name}
                className={`p-3 rounded-lg border ${section.hasData ? 'bg-dark border-green-600/30' : 'bg-dark-lighter border-dark-lighter'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {section.hasData ? (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-gray-500" />
                  )}
                  <span className={`text-sm font-medium ${section.hasData ? 'text-white' : 'text-gray-500'}`}>
                    {section.name}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  {section.dataPoints} data points
                </div>
              </div>
            ))}
          </div>
          
          {safeDataCompleteness.missingCritical.length > 0 && (
            <Alert className="bg-yellow-900/20 border-yellow-800">
              <Info className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-300 text-sm">
                Missing critical data: {safeDataCompleteness.missingCritical.join(', ')}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-dark-lighter">
            <div className="text-sm text-gray-400">
              {safeMetadata.lastResearchUpdate && (
                <>
                  Last Analysis: {new Date(safeMetadata.lastResearchUpdate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </>
              )}
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => runResearchMutation.mutate()}
              disabled={runResearchMutation.isPending}
              className="bg-dark-lighter hover:bg-dark border-dark-lighter"
              data-testid="btn-rerun-research"
            >
              {runResearchMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Rerun
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="border-b border-dark-lighter bg-transparent mb-6 w-full justify-start flex-wrap">
          <TabsTrigger value="overview" className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-3">
            <Zap className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="team" className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-3">
            <Users className="h-4 w-4 mr-2" />
            Team
          </TabsTrigger>
          <TabsTrigger value="financials" className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-3">
            <DollarSign className="h-4 w-4 mr-2" />
            Financials
          </TabsTrigger>
          <TabsTrigger value="market" className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-3">
            <Target className="h-4 w-4 mr-2" />
            Market
          </TabsTrigger>
          <TabsTrigger value="risks" className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-3">
            <Shield className="h-4 w-4 mr-2" />
            Risks
          </TabsTrigger>
          <TabsTrigger value="agents" className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-3">
            <Database className="h-4 w-4 mr-2" />
            Agent Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-dark border-dark-lighter">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="h-5 w-5 text-green-400" />
                  Key Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                {safeInvestmentHighlights.keyStrengths.length > 0 ? (
                  <ul className="space-y-2">
                    {safeInvestmentHighlights.keyStrengths.map((strength, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-300">{strength}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 text-sm">No strengths identified yet. Run research to populate.</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-dark border-dark-lighter">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  Key Risks
                </CardTitle>
              </CardHeader>
              <CardContent>
                {safeInvestmentHighlights.keyRisks.length > 0 ? (
                  <ul className="space-y-2">
                    {safeInvestmentHighlights.keyRisks.map((risk, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-300">{risk}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 text-sm">No risks identified yet. Run research to populate.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {safeAIScoring.overallScore !== undefined && (
            <Card className="bg-dark border-dark-lighter">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  AI Investment Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className={`text-4xl font-bold ${
                      safeAIScoring.overallScore >= 70 ? 'text-green-400' :
                      safeAIScoring.overallScore >= 50 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {safeAIScoring.overallScore}/100
                    </div>
                    <div className="text-sm text-gray-400">Investment Score</div>
                  </div>
                  {safeAIScoring.confidence && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400">
                        {safeAIScoring.confidence}%
                      </div>
                      <div className="text-sm text-gray-400">Confidence</div>
                    </div>
                  )}
                  <div className="flex-1">
                    <Progress value={safeAIScoring.overallScore} className="h-3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          {safeExecutiveTeam.ceo ? (
            <Card className="bg-dark border-dark-lighter">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  CEO / Founder
                </CardTitle>
                <Badge variant="outline" className="w-fit text-xs">
                  Source: {safeExecutiveTeam.ceo.source}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold text-white">{safeExecutiveTeam.ceo.name}</h3>
                  {safeExecutiveTeam.ceo.linkedinUrl && (
                    <a 
                      href={safeExecutiveTeam.ceo.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-sm hover:underline flex items-center gap-1"
                    >
                      LinkedIn <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {safeExecutiveTeam.ceo.background && (
                  <div>
                    <label className="text-sm font-medium text-gray-400">Background</label>
                    <p className="text-gray-300">{safeExecutiveTeam.ceo.background}</p>
                  </div>
                )}
                {safeExecutiveTeam.ceo.experience && (
                  <div>
                    <label className="text-sm font-medium text-gray-400">Experience</label>
                    <p className="text-gray-300">{safeExecutiveTeam.ceo.experience}</p>
                  </div>
                )}
                {safeExecutiveTeam.ceo.previousCompanies && safeExecutiveTeam.ceo.previousCompanies.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-400">Previous Companies</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {safeExecutiveTeam.ceo.previousCompanies.map((company, idx) => (
                        <Badge key={idx} variant="secondary" className="bg-dark-lighter">
                          {company}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Alert className="bg-yellow-900/20 border-yellow-800">
              <Info className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-300">
                CEO information not available. Run company research to populate.
              </AlertDescription>
            </Alert>
          )}

          {safeExecutiveTeam.teamStrengths && safeExecutiveTeam.teamStrengths.length > 0 && (
            <Card className="bg-dark border-dark-lighter">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Team Strengths</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {safeExecutiveTeam.teamStrengths.map((strength, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-300">{strength}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="financials" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {safeFinancialIntelligence.fundingAmount && (
              <Card className="bg-dark border-dark-lighter">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-green-400">{safeFinancialIntelligence.fundingAmount}</div>
                  <div className="text-sm text-gray-400">Funding</div>
                </CardContent>
              </Card>
            )}
            {safeFinancialIntelligence.valuation && (
              <Card className="bg-dark border-dark-lighter">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-blue-400">{safeFinancialIntelligence.valuation}</div>
                  <div className="text-sm text-gray-400">Valuation</div>
                </CardContent>
              </Card>
            )}
            {safeFinancialIntelligence.revenue && (
              <Card className="bg-dark border-dark-lighter">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-primary">{safeFinancialIntelligence.revenue}</div>
                  <div className="text-sm text-gray-400">Revenue</div>
                </CardContent>
              </Card>
            )}
            {safeFinancialIntelligence.employeeCount && (
              <Card className="bg-dark border-dark-lighter">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-white">{safeFinancialIntelligence.employeeCount}</div>
                  <div className="text-sm text-gray-400">Employees</div>
                </CardContent>
              </Card>
            )}
          </div>

          {safeFinancialIntelligence.fundingHistory && safeFinancialIntelligence.fundingHistory.length > 0 && (
            <Card className="bg-dark border-dark-lighter">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Funding History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {safeFinancialIntelligence.fundingHistory.map((round, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-dark-lighter rounded-lg">
                      <div>
                        <span className="font-medium text-white">{round.round}</span>
                        <span className="text-gray-400 text-sm ml-2">{round.date}</span>
                      </div>
                      <Badge variant="secondary" className="bg-green-600/20 text-green-400">
                        {round.amount}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {safeFinancialIntelligence.sources.length > 0 && (
            <div className="text-xs text-gray-500">
              Sources: {safeFinancialIntelligence.sources.join(', ')}
            </div>
          )}
        </TabsContent>

        <TabsContent value="market" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-dark border-dark-lighter">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Market Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {safeMarketAnalysis.marketSize && (
                  <div>
                    <label className="text-sm font-medium text-gray-400">Market Size</label>
                    <p className="text-white font-semibold">{safeMarketAnalysis.marketSize}</p>
                  </div>
                )}
                {safeMarketAnalysis.marketPosition && (
                  <div>
                    <label className="text-sm font-medium text-gray-400">Market Position</label>
                    <p className="text-gray-300">{safeMarketAnalysis.marketPosition}</p>
                  </div>
                )}
                {safeMarketAnalysis.businessModel && (
                  <div>
                    <label className="text-sm font-medium text-gray-400">Business Model</label>
                    <p className="text-gray-300">{safeMarketAnalysis.businessModel}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-dark border-dark-lighter">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Competitors</CardTitle>
              </CardHeader>
              <CardContent>
                {safeMarketAnalysis.competitors && safeMarketAnalysis.competitors.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {safeMarketAnalysis.competitors.map((competitor, idx) => (
                      <Badge key={idx} variant="outline" className="bg-dark-lighter">
                        {competitor}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No competitor data available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="risks" className="space-y-6">
          <Card className="bg-dark border-dark-lighter">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Risk Assessment</CardTitle>
                <Badge className={getRiskColor(safeRiskAssessment.overallRiskLevel)}>
                  {safeRiskAssessment.overallRiskLevel.toUpperCase()} RISK
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries({
                  regulatory: { label: 'Regulatory', icon: Scale },
                  competitive: { label: 'Competitive', icon: Target },
                  financial: { label: 'Financial', icon: DollarSign },
                  operational: { label: 'Operational', icon: Building },
                  clinical: { label: 'Clinical', icon: Beaker },
                  legal: { label: 'Legal', icon: Shield },
                  ip: { label: 'IP', icon: Lightbulb },
                }).map(([key, config]) => {
                  const risks = safeRiskAssessment[key as keyof typeof safeRiskAssessment];
                  if (!Array.isArray(risks) || risks.length === 0) return null;
                  
                  const Icon = config.icon;
                  return (
                    <div key={key} className="p-3 bg-dark-lighter rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="h-4 w-4 text-red-400" />
                        <span className="font-medium text-white">{config.label} Risks</span>
                        <Badge variant="outline" className="ml-auto text-xs">
                          {risks.length}
                        </Badge>
                      </div>
                      <ul className="space-y-1">
                        {risks.slice(0, 3).map((risk, idx) => (
                          <li key={idx} className="text-sm text-gray-400 flex items-start gap-2">
                            <ChevronRight className="h-3 w-3 mt-1 flex-shrink-0" />
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries({
              legal: { label: 'Legal Agent', icon: Scale, color: 'text-blue-400' },
              clinical: { label: 'Clinical Agent', icon: Beaker, color: 'text-green-400' },
              commercial: { label: 'Commercial Agent', icon: Building, color: 'text-purple-400' },
              financial: { label: 'Financial Agent', icon: DollarSign, color: 'text-yellow-400' },
              hr: { label: 'HR Agent', icon: Users, color: 'text-pink-400' },
              ip: { label: 'IP Agent', icon: Lightbulb, color: 'text-orange-400' },
              research: { label: 'Research Agent', icon: BookOpen, color: 'text-cyan-400' },
            }).map(([key, config]) => {
              const agent = safeAgentInsights[key as keyof typeof safeAgentInsights];
              const Icon = config.icon;
              const isComplete = agent?.status === 'Completed';
              
              return (
                <Card key={key} className={`bg-dark border-dark-lighter ${!isComplete ? 'opacity-60' : ''}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-5 w-5 ${config.color}`} />
                        <CardTitle className="text-sm">{config.label}</CardTitle>
                      </div>
                      <Badge 
                        variant="outline"
                        className={isComplete ? 'bg-green-600/20 text-green-400' : 'bg-gray-600/20 text-gray-400'}
                      >
                        {agent?.status || 'Pending'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isComplete && agent ? (
                      <div className="space-y-2">
                        <div className="text-xs text-gray-400">
                          {agent.keyFindings.length} findings, {agent.risks.length} risks
                        </div>
                        {agent.keyFindings.slice(0, 2).map((finding, idx) => (
                          <p key={idx} className="text-xs text-gray-300 line-clamp-2">
                            {finding}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">Analysis not yet complete</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
