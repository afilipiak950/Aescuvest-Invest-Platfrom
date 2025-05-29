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

interface AnalysisItem {
  category: string;
  finding: string;
  status: 'confirmed' | 'investigate' | 'red_flag';
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  details?: string;
}

interface AgentAnalysis {
  id: number;
  agentType: string;
  status: string;
  confidence: number;
  summary: string;
  findings: AnalysisItem[];
  recommendations: string[];
  lastUpdated: string;
}

interface AgentCardProps {
  analysis?: AgentAnalysis;
  isLoading?: boolean;
}

const StatusIcon = ({ status }: { status: 'confirmed' | 'investigate' | 'red_flag' }) => {
  switch (status) {
    case 'confirmed':
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    case 'investigate':
      return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    case 'red_flag':
      return <XCircle className="w-4 h-4 text-red-400" />;
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

  const getAgentIcon = (agentType: string) => {
    switch (agentType.toLowerCase()) {
      case 'legal':
        return <Shield className="w-5 h-5 text-blue-400" />;
      case 'finance':
        return <DollarSign className="w-5 h-5 text-green-400" />;
      case 'medical':
        return <Activity className="w-5 h-5 text-red-400" />;
      case 'commercial':
        return <TrendingUp className="w-5 h-5 text-purple-400" />;
      default:
        return <Brain className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <Card className="bg-dark border-dark-lighter">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {getAgentIcon(analysis.agentType)}
            {analysis.agentType} Analysis
          </CardTitle>
          <StatusBadge status={analysis.status} confidence={analysis.confidence} />
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>Confidence: {analysis.confidence}%</span>
          <Progress value={analysis.confidence} className="w-24 h-2" />
          <span>Updated: {analysis.lastUpdated}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary */}
        <div>
          <h4 className="font-medium mb-2 text-white">Executive Summary</h4>
          <p className="text-gray-300 text-sm leading-relaxed">{analysis.summary}</p>
        </div>

        <Separator className="bg-dark-lighter" />

        {/* Detailed Findings */}
        <div>
          <h4 className="font-medium mb-4 text-white">Detailed Findings</h4>
          <div className="space-y-4">
            {analysis.findings.map((finding, index) => (
              <div key={index} className="border border-dark-lighter rounded-lg p-4 bg-dark-light/50">
                <div className="flex items-start gap-3">
                  <StatusIcon status={finding.status} />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium text-white">{finding.category}</h5>
                      <div className="flex items-center gap-2">
                        <ImpactIndicator impact={finding.impact} />
                        <Badge variant="outline" className="text-xs">
                          {finding.confidence}% confidence
                        </Badge>
                      </div>
                    </div>
                    <p className="text-gray-300 text-sm">{finding.finding}</p>
                    {finding.details && (
                      <div className="mt-2 p-3 bg-dark/50 rounded border-l-2 border-gray-600">
                        <p className="text-gray-400 text-xs">{finding.details}</p>
                      </div>
                    )}
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