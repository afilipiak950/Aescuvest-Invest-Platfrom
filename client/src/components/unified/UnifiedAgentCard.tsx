/**
 * Unified Agent Card Component
 * Displays analysis results from the unified agent architecture
 * Maintains the exact same design as EnhancedAgentCard but uses unified endpoints
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, Bot, FileText, TrendingUp, AlertTriangle, 
  Play, CheckCircle, XCircle, AlertCircle, RefreshCw, 
  ChevronDown, ChevronUp, Zap, Square 
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import DocumentQuoteViewer from '../DocumentQuoteViewer';

// Agent configuration
const AGENT_CONFIG = {
  legal: {
    title: 'Legal Analysis',
    icon: Bot,
    color: 'bg-blue-600',
    badgeColor: 'bg-blue-500/20 text-blue-400',
  },
  clinical: {
    title: 'Clinical Analysis',
    icon: Bot,
    color: 'bg-green-600',
    badgeColor: 'bg-green-500/20 text-green-400',
  },
  commercial: {
    title: 'Commercial Analysis',
    icon: TrendingUp,
    color: 'bg-purple-600',
    badgeColor: 'bg-purple-500/20 text-purple-400',
  },
  hr: {
    title: 'HR Analysis',
    icon: Bot,
    color: 'bg-orange-600',
    badgeColor: 'bg-orange-500/20 text-orange-400',
  },
  financial: {
    title: 'Financial Analysis',
    icon: TrendingUp,
    color: 'bg-red-600',
    badgeColor: 'bg-red-500/20 text-red-400',
  },
  ip: {
    title: 'IP Analysis',
    icon: Bot,
    color: 'bg-cyan-600',
    badgeColor: 'bg-cyan-500/20 text-cyan-400',
  },
  research: {
    title: 'Research Analysis',
    icon: FileText,
    color: 'bg-yellow-600',
    badgeColor: 'bg-yellow-500/20 text-yellow-400',
  },
};

interface UnifiedAgentCardProps {
  dealId: number;
  agentType: 'legal' | 'clinical' | 'commercial' | 'hr' | 'financial' | 'ip' | 'research';
  documents?: any[];
}

export function UnifiedAgentCard({ dealId, agentType, documents = [] }: UnifiedAgentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTab, setSelectedTab] = useState('findings');
  const [showQuotes, setShowQuotes] = useState(false);
  const [selectedQuotes, setSelectedQuotes] = useState<any[]>([]);
  
  const config = AGENT_CONFIG[agentType];
  const Icon = config.icon;
  
  // Fetch status
  const { data: statusData, isLoading: statusLoading } = useQuery<any>({
    queryKey: [`/api/unified/agents/${agentType}/status/${dealId}`],
    refetchInterval: (data) => {
      // Poll every 2 seconds if processing
      if (data?.status?.status === 'processing') return 2000;
      return false;
    },
  });
  
  // Fetch results
  const { data: resultsData, isLoading: resultsLoading } = useQuery<any>({
    queryKey: [`/api/unified/agents/${agentType}/results/${dealId}`],
    enabled: statusData?.status?.status === 'completed',
  });
  
  // Start analysis mutation
  const startAnalysis = useMutation({
    mutationFn: async (forceRerun: boolean = false) => {
      return apiRequest(`/api/unified/agents/${agentType}/analyze`, {
        method: 'POST',
        body: JSON.stringify({ dealId, forceRerun }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/unified/agents/${agentType}/status/${dealId}`] 
      });
      toast({
        title: 'Analysis Started',
        description: `${config.title} has been started for this deal.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to start analysis',
        variant: 'destructive',
      });
    },
  });
  
  // Cancel analysis mutation
  const cancelAnalysis = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/unified/agents/${agentType}/cancel/${dealId}`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/unified/agents/${agentType}/status/${dealId}`] 
      });
      toast({
        title: 'Analysis Cancelled',
        description: `${config.title} has been cancelled.`,
      });
    },
  });
  
  const status = statusData?.status || statusData;
  const results = resultsData;
  const isProcessing = status?.status === 'processing';
  const isCompleted = status?.status === 'completed';
  const progress = status?.progress || 0;
  
  // Get answers from results
  const answers = results?.answers || [];
  const findings = answers.flatMap((a: any) => a.keyFindings || []);
  const recommendations = answers.flatMap((a: any) => a.recommendations || []);
  
  const getStatusBadge = () => {
    if (!status) {
      return <Badge variant="outline">Not Started</Badge>;
    }
    
    switch (status.status) {
      case 'processing':
        return (
          <Badge className="bg-blue-500/20 text-blue-400">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-green-500/20 text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-500/20 text-red-400">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge className="bg-gray-500/20 text-gray-400">
            <Square className="h-3 w-3 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status.status}</Badge>;
    }
  };
  
  const handleShowQuotes = (quotes: any[]) => {
    setSelectedQuotes(quotes);
    setShowQuotes(true);
  };
  
  if (statusLoading) {
    return (
      <Card className="bg-dark-lighter border-dark-border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-gray-400" />
              <CardTitle className="text-lg">{config.title}</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <>
      <Card className="bg-dark-lighter border-dark-border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-gray-400" />
              <CardTitle className="text-lg">{config.title}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              {isProcessing && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => cancelAnalysis.mutate()}
                  disabled={cancelAnalysis.isPending}
                >
                  <Square className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>Processing {status?.completedQuestions || 0} of {status?.totalQuestions || 0} questions</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
          
          {/* Action Buttons */}
          {!status || status.status === 'failed' || status.status === 'cancelled' ? (
            <div className="flex gap-2">
              <Button
                onClick={() => startAnalysis.mutate(false)}
                disabled={startAnalysis.isPending}
                className="flex-1"
              >
                {startAnalysis.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Start Analysis
              </Button>
            </div>
          ) : isCompleted && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => startAnalysis.mutate(true)}
                disabled={startAnalysis.isPending}
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Re-run Analysis
              </Button>
              <Button
                variant="ghost"
                onClick={() => setIsExpanded(!isExpanded)}
                size="sm"
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
          
          {/* Summary Stats */}
          {isCompleted && (
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{answers.length}</div>
                <div className="text-xs text-gray-400">Questions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{findings.length}</div>
                <div className="text-xs text-gray-400">Findings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{recommendations.length}</div>
                <div className="text-xs text-gray-400">Recommendations</div>
              </div>
            </div>
          )}
          
          {/* Expanded Content */}
          {isExpanded && isCompleted && (
            <div className="mt-4 space-y-4">
              <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="findings" className="flex-1">
                    Findings ({findings.length})
                  </TabsTrigger>
                  <TabsTrigger value="recommendations" className="flex-1">
                    Recommendations ({recommendations.length})
                  </TabsTrigger>
                  <TabsTrigger value="details" className="flex-1">
                    Details
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="findings" className="mt-4 space-y-2">
                  {findings.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-4">
                      No findings available
                    </p>
                  ) : (
                    findings.map((finding: string, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 bg-dark rounded-lg border border-dark-border"
                      >
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-blue-400 mt-0.5" />
                          <p className="text-sm text-gray-300">{finding}</p>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>
                
                <TabsContent value="recommendations" className="mt-4 space-y-2">
                  {recommendations.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-4">
                      No recommendations available
                    </p>
                  ) : (
                    recommendations.map((rec: string, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 bg-dark rounded-lg border border-dark-border"
                      >
                        <div className="flex items-start gap-2">
                          <Zap className="h-4 w-4 text-yellow-400 mt-0.5" />
                          <p className="text-sm text-gray-300">{rec}</p>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>
                
                <TabsContent value="details" className="mt-4 space-y-4">
                  {answers.map((answer: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-4 bg-dark rounded-lg border border-dark-border space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <h4 className="font-medium text-gray-200">
                          Question {idx + 1}
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          Confidence: {Math.round((answer.confidence || 0) * 100)}%
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-300">{answer.answer}</p>
                      {answer.sources && answer.sources.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleShowQuotes(answer.sources)}
                          className="text-xs"
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          View Sources ({answer.sources.length})
                        </Button>
                      )}
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Document Quote Viewer */}
      <DocumentQuoteViewer
        isOpen={showQuotes}
        onClose={() => setShowQuotes(false)}
        sources={selectedQuotes}
        title="Document Sources"
        documents={documents}
      />
    </>
  );
}