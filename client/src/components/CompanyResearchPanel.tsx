import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import UnifiedCompanyIntelligence from '@/components/UnifiedCompanyIntelligence';
import {
  Brain, Search, RefreshCw, Play, CheckCircle, Clock, AlertCircle,
  Globe, Building, TrendingUp, Loader2, ChevronDown, ChevronUp, XCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CompanyResearchPanelProps {
  dealId: number;
}

interface ResearchProgress {
  status: 'pending' | 'processing' | 'completed' | 'error' | 'idle';
  progress: number;
  progressStage: string;
  jobId?: number;
  error?: string;
  lastUpdated?: string;
}

export default function CompanyResearchPanel({ dealId }: CompanyResearchPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: researchData, isLoading: isLoadingResearch, error: researchError } = useQuery<any>({
    queryKey: ['/api/deals', dealId, 'research'],
    queryFn: async () => {
      const response = await fetch(`/api/deals/${dealId}/research`, {
        credentials: 'include',
      });
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch research data');
      }
      return response.json();
    },
    enabled: !!dealId,
    retry: 1,
    staleTime: 30000,
  });

  const { data: progressData, refetch: refetchProgress, error: progressFetchError } = useQuery<ResearchProgress>({
    queryKey: ['/api/deals', dealId, 'research', 'progress'],
    queryFn: async () => {
      const response = await fetch(`/api/deals/${dealId}/research/progress`, {
        credentials: 'include',
      });
      if (!response.ok) {
        if (response.status === 404) {
          return { status: 'idle' as const, progress: 0, progressStage: '' };
        }
        throw new Error(`Progress fetch failed: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!dealId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'processing' || data?.status === 'pending' || isStarting) {
        return 2000;
      }
      return 60000;
    },
    staleTime: 2000,
    retry: 1,
  });

  const isPending = progressData?.status === 'pending';
  const isProcessing = progressData?.status === 'processing';
  const isCompleted = progressData?.status === 'completed';
  const isError = progressData?.status === 'error';
  const isActiveJob = isPending || isProcessing || isStarting;
  
  const hasResearchData = !!(
    researchData && (
      researchData.companyName || 
      researchData.marketAnalysis || 
      researchData.financialData ||
      researchData.ceoProfile ||
      researchData.aiAnalysis ||
      researchData.researchStatus === 'complete'
    )
  );

  useEffect(() => {
    if (progressData?.status === 'error') {
      setProgressError(progressData.error || 'Research failed');
      setIsStarting(false);
    } else if (progressData?.status === 'completed') {
      setProgressError(null);
      setIsStarting(false);
      queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'research'] });
      queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'intelligence'] });
    } else if (progressData?.status === 'idle') {
      setIsStarting(false);
    } else if (progressData?.status === 'pending') {
      setIsStarting(false);
    }
  }, [progressData, dealId, queryClient]);

  useEffect(() => {
    if (progressFetchError) {
      setProgressError('Unable to check research status');
    }
  }, [progressFetchError]);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('[CompanyResearchPanel] WebSocket connected');
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'research_progress' && data.dealId === dealId) {
            refetchProgress();
            if (data.status === 'completed') {
              queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'research'] });
              queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'intelligence'] });
              toast({
                title: 'Research Complete',
                description: 'Company research has finished. View results below.',
              });
            } else if (data.status === 'error') {
              setProgressError(data.error || 'Research failed');
              setIsStarting(false);
            }
          }
        } catch (e) {
          console.warn('[CompanyResearchPanel] Failed to parse WebSocket message:', e);
        }
      };

      wsRef.current.onerror = (error) => {
        console.warn('[CompanyResearchPanel] WebSocket error:', error);
      };

      wsRef.current.onclose = () => {
        console.log('[CompanyResearchPanel] WebSocket closed');
        if (isActiveJob) {
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
        }
      };
    } catch (e) {
      console.warn('[CompanyResearchPanel] Failed to create WebSocket:', e);
    }
  }, [dealId, isActiveJob, refetchProgress, queryClient, toast]);

  useEffect(() => {
    if (isActiveJob) {
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [isActiveJob, connectWebSocket]);

  const startResearchMutation = useMutation({
    mutationFn: async (forceRefresh: boolean = false) => {
      const response = await fetch(`/api/deals/${dealId}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to start research');
      }
      
      return response.json();
    },
    onMutate: () => {
      setIsStarting(true);
      setProgressError(null);
    },
    onSuccess: (data) => {
      toast({
        title: 'Research Started',
        description: 'AI-powered company research is now running...',
      });
      refetchProgress();
      connectWebSocket();
    },
    onError: (error: Error) => {
      setIsStarting(false);
      setProgressError(error.message);
      toast({
        title: 'Research Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getStatusBadge = () => {
    if (isActiveJob) {
      return (
        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          {isPending ? 'Queued' : 'Running'}
        </Badge>
      );
    }
    if (isError || progressError) {
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
          <XCircle className="h-3 w-3 mr-1" />
          Error
        </Badge>
      );
    }
    if (hasResearchData) {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
          <CheckCircle className="h-3 w-3 mr-1" />
          Complete
        </Badge>
      );
    }
    return (
      <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
        <Clock className="h-3 w-3 mr-1" />
        Not Started
      </Badge>
    );
  };

  const showStartButton = !hasResearchData && !isActiveJob;
  const showProgressBar = isActiveJob;
  const showResults = hasResearchData && !isActiveJob;

  return (
    <div className="space-y-6" data-testid="company-research-panel">
      <Card className="bg-dark border-dark-lighter">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gradient-to-br from-primary/20 to-blue-600/20 rounded-lg flex items-center justify-center">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  Company Research
                  {getStatusBadge()}
                </CardTitle>
                <CardDescription>
                  AI-powered intelligence gathering from multiple sources
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasResearchData && !isActiveJob && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startResearchMutation.mutate(true)}
                  disabled={isActiveJob}
                  className="bg-dark-lighter border-dark-lighter hover:bg-dark hover:border-primary/50"
                  data-testid="button-refresh-research"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-gray-400"
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="pt-0">
            {progressError && (
              <Alert className="mb-4 bg-red-500/10 border-red-500/20">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-300">
                  {progressError}
                  <Button
                    variant="link"
                    size="sm"
                    className="ml-2 text-red-400 p-0 h-auto"
                    onClick={() => {
                      setProgressError(null);
                      startResearchMutation.mutate(true);
                    }}
                  >
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {showProgressBar && (
              <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Brain className="h-5 w-5 text-blue-400 animate-pulse" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">
                        {isPending ? 'Research queued, waiting to start...' : (progressData?.progressStage || 'Initializing research...')}
                      </span>
                      <span className="text-sm text-blue-400">
                        {progressData?.progress || 0}%
                      </span>
                    </div>
                  </div>
                </div>
                <Progress value={progressData?.progress || 0} className="h-2" />
                <p className="text-xs text-gray-400 mt-2">
                  {isPending 
                    ? 'Research job is queued and will start shortly...'
                    : 'Research is gathering intelligence from websites, databases, and public sources...'}
                </p>
              </div>
            )}

            {showStartButton && !progressError && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Start Company Research</h3>
                <p className="text-gray-400 mb-6 max-w-lg mx-auto">
                  Launch AI-powered research to gather comprehensive intelligence about this company, 
                  including market analysis, financial data, leadership profiles, and risk assessment.
                </p>
                <Button
                  onClick={() => startResearchMutation.mutate(false)}
                  disabled={isActiveJob}
                  className="bg-primary hover:bg-primary/80"
                  size="lg"
                  data-testid="button-start-research"
                >
                  <Play className="h-5 w-5 mr-2" />
                  Start Company Research
                </Button>
              </div>
            )}

            {showResults && (
              <div className="space-y-4">
                <Alert className="bg-green-500/10 border-green-500/20">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <AlertDescription className="text-green-300">
                    Research completed. Data is displayed in the intelligence view below.
                    {researchData?.lastUpdated && (
                      <span className="block text-xs text-green-400/70 mt-1">
                        Last updated: {new Date(researchData.lastUpdated).toLocaleString()}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-dark-lighter rounded-lg p-3 text-center">
                    <Globe className="h-5 w-5 text-blue-400 mx-auto mb-1" />
                    <div className="text-xs text-gray-400">Website</div>
                    <div className="text-sm text-white font-medium truncate">
                      {researchData?.website || 'N/A'}
                    </div>
                  </div>
                  <div className="bg-dark-lighter rounded-lg p-3 text-center">
                    <Building className="h-5 w-5 text-purple-400 mx-auto mb-1" />
                    <div className="text-xs text-gray-400">Company</div>
                    <div className="text-sm text-white font-medium truncate">
                      {researchData?.companyName || 'N/A'}
                    </div>
                  </div>
                  <div className="bg-dark-lighter rounded-lg p-3 text-center">
                    <TrendingUp className="h-5 w-5 text-green-400 mx-auto mb-1" />
                    <div className="text-xs text-gray-400">Sources</div>
                    <div className="text-sm text-white font-medium">
                      {researchData?.sources || 0}
                    </div>
                  </div>
                  <div className="bg-dark-lighter rounded-lg p-3 text-center">
                    <Brain className="h-5 w-5 text-primary mx-auto mb-1" />
                    <div className="text-xs text-gray-400">AI Confidence</div>
                    <div className="text-sm text-white font-medium">
                      {researchData?.aiConfidenceScore ? `${researchData.aiConfidenceScore}%` : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <Separator className="border-dark-lighter" />

      <UnifiedCompanyIntelligence dealId={dealId} />
    </div>
  );
}
