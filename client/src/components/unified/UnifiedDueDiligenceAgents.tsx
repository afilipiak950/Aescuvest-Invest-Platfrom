/**
 * Unified Due Diligence Agents Component
 * Displays all unified agent analyses with the exact same design as existing system
 * Uses the unified architecture for consistent JSON parsing and 80%+ confidence scores
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { UnifiedAgentCard } from './UnifiedAgentCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, RefreshCw, Loader2, CheckCircle, XCircle, 
  AlertTriangle, Info, TrendingUp, Bot, FileText, 
  Square, PlayCircle, AlertCircle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// Agent types in order of display
const AGENT_TYPES = ['legal', 'clinical', 'commercial', 'hr', 'financial', 'ip', 'research'] as const;
type AgentType = typeof AGENT_TYPES[number];

// Agent metadata for display
const AGENT_META = {
  legal: {
    title: 'Legal',
    description: 'Contract analysis, liability assessment, compliance verification',
    color: 'bg-blue-600',
    icon: Bot,
  },
  clinical: {
    title: 'Clinical',
    description: 'Clinical trials, regulatory compliance, patient outcomes',
    color: 'bg-green-600',
    icon: Bot,
  },
  commercial: {
    title: 'Commercial',
    description: 'Market sizing, competitive analysis, revenue models',
    color: 'bg-purple-600',
    icon: TrendingUp,
  },
  hr: {
    title: 'HR',
    description: 'Team evaluation, compensation analysis, organizational health',
    color: 'bg-orange-600',
    icon: Bot,
  },
  financial: {
    title: 'Financial',
    description: 'Financial modeling, unit economics, valuation assessment',
    color: 'bg-red-600',
    icon: TrendingUp,
  },
  ip: {
    title: 'IP',
    description: 'Patent analysis, trademark assessment, freedom to operate',
    color: 'bg-cyan-600',
    icon: Bot,
  },
  research: {
    title: 'Research',
    description: 'Industry trends, competitive intelligence, market dynamics',
    color: 'bg-yellow-600',
    icon: FileText,
  },
};

interface UnifiedDueDiligenceAgentsProps {
  dealId: number;
  documents?: any[];
}

export function UnifiedDueDiligenceAgents({ dealId, documents = [] }: UnifiedDueDiligenceAgentsProps) {
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState<AgentType>('legal');
  const [isRunningAll, setIsRunningAll] = useState(false);
  
  // Fetch all agent statuses
  const { data: allStatuses, isLoading: statusesLoading } = useQuery<any>({
    queryKey: [`/api/unified/agents/all/status/${dealId}`],
    refetchInterval: 5000, // Poll every 5 seconds
  });
  
  // Start all analyses mutation
  const startAllAnalyses = useMutation({
    mutationFn: async (forceRerun: boolean = false) => {
      return apiRequest('/api/unified/agents/all/analyze', {
        method: 'POST',
        body: JSON.stringify({ dealId, forceRerun }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onMutate: () => {
      setIsRunningAll(true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/unified/agents/all/status/${dealId}`] 
      });
      toast({
        title: 'All Analyses Started',
        description: 'All agent analyses have been started for this deal.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to start all analyses',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsRunningAll(false);
    },
  });
  
  // Calculate overall progress
  const calculateOverallProgress = () => {
    if (!allStatuses?.statuses) return { progress: 0, completed: 0, total: AGENT_TYPES.length };
    
    let totalProgress = 0;
    let completedCount = 0;
    
    AGENT_TYPES.forEach(agentType => {
      const status = allStatuses.statuses[agentType];
      if (status) {
        if (status.status === 'completed') {
          totalProgress += 100;
          completedCount++;
        } else if (status.status === 'processing') {
          totalProgress += status.progress || 0;
        }
      }
    });
    
    return {
      progress: totalProgress / AGENT_TYPES.length,
      completed: completedCount,
      total: AGENT_TYPES.length,
    };
  };
  
  const { progress, completed, total } = calculateOverallProgress();
  const hasAnyAnalysis = allStatuses?.statuses && Object.values(allStatuses.statuses).some((s: any) => s !== null);
  const allCompleted = completed === total;
  const someProcessing = allStatuses?.statuses && Object.values(allStatuses.statuses).some((s: any) => s?.status === 'processing');
  
  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="bg-dark-lighter border-dark-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Unified Agent Analysis</CardTitle>
              <CardDescription className="mt-1">
                Institutional-grade investment analysis with 80%+ confidence scores
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {someProcessing && (
                <Badge className="bg-blue-500/20 text-blue-400 px-3 py-1">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Processing
                </Badge>
              )}
              {allCompleted && (
                <Badge className="bg-green-500/20 text-green-400 px-3 py-1">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  All Completed
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Progress Overview */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">
                Overall Progress: {completed} of {total} agents completed
              </span>
              <span className="text-gray-400">
                {Math.round(progress)}%
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3">
            {!hasAnyAnalysis || allCompleted ? (
              <>
                <Button
                  onClick={() => startAllAnalyses.mutate(false)}
                  disabled={isRunningAll || startAllAnalyses.isPending}
                  className="flex-1"
                >
                  {startAllAnalyses.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <PlayCircle className="h-4 w-4 mr-2" />
                  )}
                  {!hasAnyAnalysis ? 'Start All Analyses' : 'Re-run All Analyses'}
                </Button>
              </>
            ) : someProcessing ? (
              <div className="flex-1 text-center py-2">
                <span className="text-sm text-gray-400">
                  Analyses in progress...
                </span>
              </div>
            ) : (
              <Button
                onClick={() => startAllAnalyses.mutate(true)}
                disabled={isRunningAll || startAllAnalyses.isPending}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Force Re-run All
              </Button>
            )}
          </div>
          
          {/* Agent Status Grid */}
          <div className="grid grid-cols-7 gap-2 pt-2">
            {AGENT_TYPES.map(agentType => {
              const meta = AGENT_META[agentType];
              const status = allStatuses?.statuses?.[agentType];
              const Icon = meta.icon;
              
              let statusColor = 'bg-gray-600';
              let statusIcon = <AlertCircle className="h-3 w-3" />;
              
              if (status) {
                switch (status.status) {
                  case 'completed':
                    statusColor = 'bg-green-600';
                    statusIcon = <CheckCircle className="h-3 w-3" />;
                    break;
                  case 'processing':
                    statusColor = 'bg-blue-600';
                    statusIcon = <Loader2 className="h-3 w-3 animate-spin" />;
                    break;
                  case 'failed':
                    statusColor = 'bg-red-600';
                    statusIcon = <XCircle className="h-3 w-3" />;
                    break;
                  case 'cancelled':
                    statusColor = 'bg-gray-500';
                    statusIcon = <Square className="h-3 w-3" />;
                    break;
                }
              }
              
              return (
                <button
                  key={agentType}
                  onClick={() => setSelectedTab(agentType)}
                  className={`
                    relative p-3 rounded-lg border transition-all
                    ${selectedTab === agentType 
                      ? 'bg-dark border-gray-600' 
                      : 'bg-dark-lighter border-dark-border hover:bg-dark'
                    }
                  `}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Icon className="h-6 w-6 text-gray-400" />
                    <span className="text-xs font-medium">{meta.title}</span>
                    <div className={`
                      absolute top-1 right-1 rounded-full p-1
                      ${statusColor} bg-opacity-20
                    `}>
                      {statusIcon}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      {/* Tabbed Agent Cards */}
      <Card className="bg-dark-lighter border-dark-border">
        <CardContent className="p-6">
          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as AgentType)}>
            <TabsList className="grid grid-cols-7 mb-6">
              {AGENT_TYPES.map(agentType => {
                const meta = AGENT_META[agentType];
                const status = allStatuses?.statuses?.[agentType];
                const isCompleted = status?.status === 'completed';
                
                return (
                  <TabsTrigger
                    key={agentType}
                    value={agentType}
                    className="data-[state=active]:bg-dark"
                  >
                    <span className="flex items-center gap-1">
                      {meta.title}
                      {isCompleted && (
                        <CheckCircle className="h-3 w-3 text-green-400 ml-1" />
                      )}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            
            {AGENT_TYPES.map(agentType => (
              <TabsContent key={agentType} value={agentType}>
                <div className="space-y-4">
                  {/* Agent Description */}
                  <div className="pb-4 border-b border-dark-border">
                    <h3 className="text-lg font-medium mb-1">
                      {AGENT_META[agentType].title} Analysis
                    </h3>
                    <p className="text-sm text-gray-400">
                      {AGENT_META[agentType].description}
                    </p>
                  </div>
                  
                  {/* Agent Card */}
                  <UnifiedAgentCard
                    dealId={dealId}
                    agentType={agentType}
                    documents={documents}
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}