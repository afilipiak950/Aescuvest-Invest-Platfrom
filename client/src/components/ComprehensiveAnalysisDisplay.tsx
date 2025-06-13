import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  AlertTriangle, 
  Minus, 
  Play, 
  CheckCircle, 
  Clock, 
  FileText,
  Brain,
  BarChart3,
  Shield,
  RefreshCw
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface ComprehensiveAnalysisProps {
  dealId: number;
  analyses: any[];
  documents: any[];
}

interface AnalysisInsight {
  category: 'positive' | 'neutral' | 'risk';
  agent: string;
  title: string;
  description: string;
  confidence: number;
  severity?: 'low' | 'medium' | 'high';
  documentSource?: string;
}

interface ComprehensiveAnalysisResult {
  overallScore: number;
  positiveFactors: AnalysisInsight[];
  neutralFactors: AnalysisInsight[];
  riskFactors: AnalysisInsight[];
  analysisStatus: 'pending' | 'running' | 'completed' | 'failed';
  lastUpdated: string;
  documentsCovered: number;
  totalDocuments: number;
}

export function ComprehensiveAnalysisDisplay({ dealId, analyses, documents }: ComprehensiveAnalysisProps) {
  const [isRunningAnalysis, setIsRunningAnalysis] = useState(false);
  const queryClient = useQueryClient();

  // Fetch comprehensive analysis results
  const { data: comprehensiveAnalysis, isLoading, refetch } = useQuery({
    queryKey: [`/api/deals/${dealId}/comprehensive-analysis`],
    retry: false,
    enabled: !!dealId
  });

  // Mutation for running comprehensive analysis
  const runAnalysisMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/deals/${dealId}/run-comprehensive-analysis`, {
        method: 'POST',
        body: JSON.stringify({ forceRefresh: true }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/comprehensive-analysis`] });
      setIsRunningAnalysis(false);
    },
    onError: () => {
      setIsRunningAnalysis(false);
    }
  });

  const handleRunAnalysis = () => {
    setIsRunningAnalysis(true);
    runAnalysisMutation.mutate();
  };

  const getInsightIcon = (category: string) => {
    switch (category) {
      case 'positive':
        return <TrendingUp className="h-4 w-4 text-green-400" />;
      case 'risk':
        return <AlertTriangle className="h-4 w-4 text-red-400" />;
      default:
        return <Minus className="h-4 w-4 text-yellow-400" />;
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const renderInsightCard = (insight: AnalysisInsight, index: number) => (
    <Card key={index} className="bg-dark border-dark-lighter">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            {getInsightIcon(insight.category)}
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-medium text-white text-sm">{insight.title}</h4>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {insight.agent}
                </Badge>
                {insight.severity && (
                  <Badge variant="outline" className={`text-xs ${getSeverityColor(insight.severity)}`}>
                    {insight.severity}
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-gray-300 text-sm mb-2">{insight.description}</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">
                Confidence: {Math.round(insight.confidence * 100)}%
              </span>
              {insight.documentSource && (
                <span className="text-gray-500 flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {insight.documentSource}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-2 text-gray-400">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading comprehensive analysis...
        </div>
      </div>
    );
  }

  const analysis = comprehensiveAnalysis as ComprehensiveAnalysisResult | undefined;

  if (!analysis) {
    return (
      <div className="text-center py-8">
        <div className="mb-4">
          <div className="w-16 h-16 bg-dark-lighter rounded-full flex items-center justify-center mx-auto mb-4">
            <Brain className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Run Comprehensive Analysis</h3>
          <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
            Analyze all documents across all specialized agents to generate a comprehensive investment analysis with positive factors, neutral observations, and risk assessments.
          </p>
        </div>
        <Button 
          onClick={handleRunAnalysis}
          disabled={isRunningAnalysis || runAnalysisMutation.isPending}
          className="bg-primary hover:bg-primary/80 text-white"
        >
          {isRunningAnalysis || runAnalysisMutation.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Running Analysis...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run Comprehensive Analysis
            </>
          )}
        </Button>
      </div>
    );
  }

  const progress = analysis.totalDocuments > 0 ? (analysis.documentsCovered / analysis.totalDocuments) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Analysis Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-dark border-dark-lighter">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-gray-300">Overall Score</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {Math.round(analysis.overallScore)}/100
            </div>
          </CardContent>
        </Card>

        <Card className="bg-dark border-dark-lighter">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <span className="text-sm font-medium text-gray-300">Positive Factors</span>
            </div>
            <div className="text-2xl font-bold text-green-400">
              {analysis.positiveFactors?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-dark border-dark-lighter">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <span className="text-sm font-medium text-gray-300">Risk Factors</span>
            </div>
            <div className="text-2xl font-bold text-red-400">
              {analysis.riskFactors?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-dark border-dark-lighter">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-300">Documents</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {analysis.documentsCovered}/{analysis.totalDocuments}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Progress */}
      <Card className="bg-dark border-dark-lighter">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-300">Analysis Progress</span>
            <div className="flex items-center gap-2">
              {analysis.analysisStatus === 'completed' && (
                <CheckCircle className="h-4 w-4 text-green-400" />
              )}
              {analysis.analysisStatus === 'running' && (
                <Clock className="h-4 w-4 text-yellow-400" />
              )}
              <span className="text-xs text-gray-400">
                Last updated: {new Date(analysis.lastUpdated).toLocaleString()}
              </span>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* Analysis Results */}
      <Tabs defaultValue="positive" className="w-full">
        <TabsList className="border-b border-dark-lighter bg-transparent mb-6 w-full justify-start">
          <TabsTrigger
            value="positive"
            className="data-[state=active]:border-green-400 data-[state=active]:text-green-400 border-b-2 border-transparent pb-2 px-1"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Positive Factors ({analysis.positiveFactors?.length || 0})
          </TabsTrigger>
          <TabsTrigger
            value="neutral"
            className="data-[state=active]:border-yellow-400 data-[state=active]:text-yellow-400 border-b-2 border-transparent pb-2 px-1"
          >
            <Minus className="h-4 w-4 mr-2" />
            Neutral Observations ({analysis.neutralFactors?.length || 0})
          </TabsTrigger>
          <TabsTrigger
            value="risks"
            className="data-[state=active]:border-red-400 data-[state=active]:text-red-400 border-b-2 border-transparent pb-2 px-1"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Risk Factors ({analysis.riskFactors?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="positive">
          <div className="space-y-3">
            {analysis.positiveFactors?.length > 0 ? (
              analysis.positiveFactors.map(renderInsightCard)
            ) : (
              <Card className="bg-dark border-dark-lighter">
                <CardContent className="p-8 text-center">
                  <TrendingUp className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-400">No positive factors identified yet</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="neutral">
          <div className="space-y-3">
            {analysis.neutralFactors?.length > 0 ? (
              analysis.neutralFactors.map(renderInsightCard)
            ) : (
              <Card className="bg-dark border-dark-lighter">
                <CardContent className="p-8 text-center">
                  <Minus className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-400">No neutral observations identified yet</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="risks">
          <div className="space-y-3">
            {analysis.riskFactors?.length > 0 ? (
              analysis.riskFactors.map(renderInsightCard)
            ) : (
              <Card className="bg-dark border-dark-lighter">
                <CardContent className="p-8 text-center">
                  <Shield className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-400">No risk factors identified yet</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <Button 
          onClick={handleRunAnalysis}
          disabled={isRunningAnalysis || runAnalysisMutation.isPending}
          variant="outline"
          className="border-dark-lighter text-gray-300 hover:bg-dark-light"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRunningAnalysis ? 'animate-spin' : ''}`} />
          Refresh Analysis
        </Button>
        <Button 
          onClick={() => refetch()}
          variant="outline"
          className="border-dark-lighter text-gray-300 hover:bg-dark-light"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Reload Results
        </Button>
      </div>
    </div>
  );
}