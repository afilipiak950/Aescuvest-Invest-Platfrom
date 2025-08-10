import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Activity, CheckCircle, AlertTriangle } from 'lucide-react';

interface AgentProgress {
  agentType: string;
  progress: number;
  status: 'Idle' | 'Processing' | 'Completed' | 'Failed';
  currentStep?: string;
  processedCount?: number;
  totalCount?: number;
}

interface AgentOverviewProgressProps {
  dealId: number;
  agents: AgentProgress[];
  isRunningAllAnalyses: boolean;
}

export function AgentOverviewProgress({ dealId, agents, isRunningAllAnalyses }: AgentOverviewProgressProps) {
  // Calculate overall progress
  const totalProgress = agents.length > 0 ? agents.reduce((sum, agent) => sum + agent.progress, 0) / agents.length : 0;
  const completedAgents = agents.filter(agent => agent.status === 'Completed').length;
  const processingAgents = agents.filter(agent => agent.status === 'Processing').length;
  const failedAgents = agents.filter(agent => agent.status === 'Failed').length;
  
  const getAgentStatusIcon = (status: string, progress: number) => {
    switch (status) {
      case 'Completed':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'Processing':
        return <Activity className="h-4 w-4 text-blue-400 animate-pulse" />;
      case 'Failed':
        return <AlertTriangle className="h-4 w-4 text-red-400" />;
      default:
        return <Bot className="h-4 w-4 text-gray-400" />;
    }
  };

  const getAgentColorClass = (agentType: string) => {
    const colors = {
      Legal: 'border-purple-400/50 bg-purple-500/5',
      Clinical: 'border-green-400/50 bg-green-500/5',
      Commercial: 'border-blue-400/50 bg-blue-500/5',
      HR: 'border-orange-400/50 bg-orange-500/5',
      Financial: 'border-yellow-400/50 bg-yellow-500/5',
      IP: 'border-indigo-400/50 bg-indigo-500/5',
      Research: 'border-cyan-400/50 bg-cyan-500/5'
    } as const;
    
    return colors[agentType as keyof typeof colors] || 'border-gray-400/50 bg-gray-500/5';
  };

  return (
    <Card className="bg-dark-light border-dark-lighter mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            All Agents Progress Overview
          </CardTitle>
          <div className="flex items-center gap-3 text-sm">
            <Badge variant="outline" className="text-green-400 border-green-400">
              {completedAgents}/7 Complete
            </Badge>
            {processingAgents > 0 && (
              <Badge variant="outline" className="text-blue-400 border-blue-400">
                {processingAgents} Running
              </Badge>
            )}
            {failedAgents > 0 && (
              <Badge variant="outline" className="text-red-400 border-red-400">
                {failedAgents} Failed
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-300">Overall Progress</span>
            <span className="text-white font-medium">{Math.round(totalProgress)}%</span>
          </div>
          <Progress value={totalProgress} className="h-2 bg-dark-lighter" />
        </div>

        {/* Individual Agent Mini Progress Bars */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
          {agents.map((agent) => (
            <div
              key={agent.agentType}
              className={`p-3 rounded-lg border transition-colors ${getAgentColorClass(agent.agentType)}`}
            >
              <div className="flex items-center gap-2 mb-2">
                {getAgentStatusIcon(agent.status, agent.progress)}
                <span className="text-xs font-medium text-white truncate">
                  {agent.agentType}
                </span>
              </div>
              
              <Progress 
                value={agent.progress} 
                className="h-1.5 bg-dark-lighter mb-1"
              />
              
              <div className="flex justify-between text-xs text-gray-400">
                <span>{Math.round(agent.progress)}%</span>
                {agent.processedCount !== undefined && agent.totalCount !== undefined && (
                  <span>{agent.processedCount}/{agent.totalCount}</span>
                )}
              </div>
              
              {agent.currentStep && agent.status === 'Processing' && (
                <div className="text-xs text-gray-400 mt-1 truncate" title={agent.currentStep}>
                  {agent.currentStep.length > 20 
                    ? `${agent.currentStep.substring(0, 17)}...` 
                    : agent.currentStep
                  }
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Combined OCR System Status */}
        {(isRunningAllAnalyses || processingAgents > 0) && (
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-400">
                Combined OCR System Active • Real-time Updates • High-efficiency Processing
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}