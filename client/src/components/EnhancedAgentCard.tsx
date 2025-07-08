import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  FileText, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Zap,
  Target,
  Users,
  Shield,
  DollarSign,
  Briefcase,
  Copyright,
  FlaskConical
} from 'lucide-react';

interface AgentCardProps {
  agentType: string;
  analysis: any;
  isRunning: boolean;
  progress: number;
  onAnalyze: () => void;
  documentsProcessed: number;
  totalDocuments: number;
}

const agentIcons = {
  clinical: Shield,
  legal: Scale,
  financial: DollarSign,
  commercial: Briefcase,
  hr: Users,
  ip: Copyright,
  research: FlaskConical
};

const agentColors = {
  clinical: 'bg-blue-50 border-blue-200 text-blue-800',
  legal: 'bg-purple-50 border-purple-200 text-purple-800',
  financial: 'bg-green-50 border-green-200 text-green-800',
  commercial: 'bg-orange-50 border-orange-200 text-orange-800',
  hr: 'bg-pink-50 border-pink-200 text-pink-800',
  ip: 'bg-indigo-50 border-indigo-200 text-indigo-800',
  research: 'bg-teal-50 border-teal-200 text-teal-800'
};

const agentDescriptions = {
  clinical: 'Healthcare compliance, regulatory pathways, clinical evidence',
  legal: 'IP portfolio, contracts, regulatory compliance, governance',
  financial: 'Revenue models, unit economics, cash flow, valuation',
  commercial: 'Market opportunity, competitive landscape, go-to-market',
  hr: 'Leadership team, talent strategy, organizational culture',
  ip: 'Patent portfolio, trade secrets, freedom to operate',
  research: 'Technology assessment, R&D strategy, innovation pipeline'
};

export default function EnhancedAgentCard({ 
  agentType, 
  analysis, 
  isRunning, 
  progress, 
  onAnalyze,
  documentsProcessed,
  totalDocuments 
}: AgentCardProps) {
  const IconComponent = agentIcons[agentType as keyof typeof agentIcons] || Brain;
  const colorClass = agentColors[agentType as keyof typeof agentColors] || 'bg-gray-50 border-gray-200 text-gray-800';
  const description = agentDescriptions[agentType as keyof typeof agentDescriptions] || 'Specialized analysis';
  
  const hasAnalysis = analysis && analysis.findings && analysis.findings.length > 0;
  const confidence = analysis?.confidence || 0;
  const relevanceScore = analysis?.relevanceScore || 0;
  const findingsCount = analysis?.findings?.length || 0;
  const recommendationsCount = analysis?.recommendations?.length || 0;

  return (
    <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${colorClass}`}>
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg capitalize">{agentType} Agent</CardTitle>
              <p className="text-sm text-gray-600 mt-1">{description}</p>
            </div>
          </div>
          <Badge 
            variant={hasAnalysis ? 'default' : 'secondary'}
            className="flex items-center gap-1"
          >
            {hasAnalysis ? (
              <CheckCircle className="w-3 h-3" />
            ) : (
              <AlertCircle className="w-3 h-3" />
            )}
            {hasAnalysis ? 'Enhanced' : 'Ready'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Analysis Progress */}
        {isRunning && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Processing documents...</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-gray-500">
              {documentsProcessed} of {totalDocuments} documents analyzed
            </p>
          </div>
        )}

        {/* Enhanced Analysis Metrics */}
        {hasAnalysis && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Confidence</span>
                <div className="flex items-center gap-1">
                  <Target className="w-3 h-3 text-blue-500" />
                  <span className="font-medium text-blue-600">{confidence}%</span>
                </div>
              </div>
              <Progress value={confidence} className="h-1" />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Relevance</span>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-green-500" />
                  <span className="font-medium text-green-600">{relevanceScore}%</span>
                </div>
              </div>
              <Progress value={relevanceScore} className="h-1" />
            </div>
          </div>
        )}

        {/* Analysis Results Summary */}
        {hasAnalysis && (
          <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">{findingsCount}</div>
              <div className="text-xs text-gray-600">Findings</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">{recommendationsCount}</div>
              <div className="text-xs text-gray-600">Recommendations</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">{documentsProcessed}</div>
              <div className="text-xs text-gray-600">Documents</div>
            </div>
          </div>
        )}

        {/* Enhanced Features Badge */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-xs">
            <Zap className="w-3 h-3 mr-1" />
            Fine-tuned Prompts
          </Badge>
          <Badge variant="outline" className="text-xs">
            <Brain className="w-3 h-3 mr-1" />
            Context-Aware
          </Badge>
          <Badge variant="outline" className="text-xs">
            <FileText className="w-3 h-3 mr-1" />
            Structured Analysis
          </Badge>
        </div>

        {/* Sample Findings Preview */}
        {hasAnalysis && analysis.findings && analysis.findings.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Recent Findings:</h4>
            <div className="space-y-1">
              {analysis.findings.slice(0, 2).map((finding: any, index: number) => (
                <div key={index} className="text-xs text-gray-600 p-2 bg-gray-50 rounded">
                  {finding.title || finding.content || 'Analysis finding'}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        <Button 
          onClick={onAnalyze}
          disabled={isRunning}
          className="w-full"
          variant={hasAnalysis ? "outline" : "default"}
        >
          {isRunning ? (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 animate-spin" />
              Analyzing...
            </div>
          ) : hasAnalysis ? (
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Rerun Enhanced Analysis
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Run Enhanced Analysis
            </div>
          )}
        </Button>

        {/* Processing Time */}
        {analysis?.processingTime && (
          <div className="text-xs text-gray-500 text-center">
            Completed in {analysis.processingTime}ms
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Scale icon component (since it's not in lucide-react)
function Scale({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" 
      />
    </svg>
  );
}

export { EnhancedAgentCard };