import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Brain,
  Shield,
  DollarSign,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UnifiedAgentIcon } from '../unified/UnifiedAgentIcon';
import { UnifiedAgentStatus } from '../unified/UnifiedAgentStatus';

interface FindingItem {
  id: number;
  type: 'positive' | 'warning' | 'negative' | 'neutral';
  content: string;
}

interface AgentAnalysis {
  id: number;
  agentType: string;
  status: string;
  progress: number;
  findings: FindingItem[];
  recommendations: string[];
}

interface AgentCardProps {
  analysis?: AgentAnalysis;
  isLoading?: boolean;
}

const StatusIcon = ({ type }: { type: 'positive' | 'warning' | 'negative' | 'neutral' }) => {
  switch (type) {
    case 'positive':
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    case 'negative':
      return <XCircle className="w-4 h-4 text-red-400" />;
    case 'neutral':
      return <Clock className="w-4 h-4 text-blue-400" />;
    default:
      return <Clock className="w-4 h-4 text-gray-400" />;
  }
};

const StatusBadge = ({ status, confidence }: { status: string; confidence: number }) => {
  const getStatusColor = () => {
    if (confidence >= 85) return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (confidence >= 70) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  return (
    <Badge className={cn("border", getStatusColor())}>
      {status} ({confidence}%)
    </Badge>
  );
};

const ImpactIndicator = ({ impact }: { impact: 'high' | 'medium' | 'low' }) => {
  const getImpactIcon = () => {
    switch (impact) {
      case 'high':
        return <TrendingUp className="w-4 h-4 text-red-400" />;
      case 'medium':
        return <Activity className="w-4 h-4 text-amber-400" />;
      case 'low':
        return <TrendingDown className="w-4 h-4 text-green-400" />;
    }
  };

  const getImpactColor = () => {
    switch (impact) {
      case 'high':
        return 'text-red-400';
      case 'medium':
        return 'text-amber-400';
      case 'low':
        return 'text-green-400';
    }
  };

  return (
    <div className={cn("flex items-center gap-1", getImpactColor())}>
      {getImpactIcon()}
      <span className="text-xs font-medium uppercase">{impact}</span>
    </div>
  );
};

export default function AgentCard({ analysis, isLoading }: AgentCardProps) {
  if (isLoading) {
    return (
      <Card className="bg-dark border-dark-lighter">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
            <div className="h-20 bg-gray-700 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card className="bg-dark border-dark-lighter">
        <CardContent className="p-6 text-center">
          <Brain className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">No Analysis Available</h3>
          <p className="text-gray-500">AI analysis for this category is not yet available.</p>
        </CardContent>
      </Card>
    );
  }

  // Unified agent icon using configuration system
  const getAgentIcon = (agentType: string) => {
    return <UnifiedAgentIcon agentType={agentType} size={20} />;
  };

  return (
    <Card className="bg-dark border-dark-lighter">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {getAgentIcon(analysis.agentType)}
            {analysis.agentType} Analysis
          </CardTitle>
          <UnifiedAgentStatus 
            agentType={analysis.agentType} 
            status={analysis.status} 
            progress={analysis.progress}
            showIcon={false}
            size="sm"
          />
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>Findings: {analysis.findings.length} items</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Detailed Findings */}
        <div>
          <h4 className="font-medium mb-4 text-white">Investment Analysis Findings</h4>
          <div className="space-y-3">
            {analysis.findings.map((finding, index) => (
              <div key={finding.id} className="border border-dark-lighter rounded-lg p-4 bg-dark-light/50">
                <div className="flex items-start gap-3">
                  <StatusIcon type={finding.type} />
                  <div className="flex-1">
                    <p className="text-gray-300 text-sm leading-relaxed">{finding.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator className="bg-dark-lighter" />

        {/* Recommendations */}
        <div>
          <h4 className="font-medium mb-3 text-white flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-primary" />
            Recommendations
          </h4>
          <ul className="space-y-2">
            {analysis.recommendations.map((recommendation, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-primary font-bold">•</span>
                <span>{recommendation}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}