import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Brain, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  Target,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface CriterionScore {
  criterion: string;
  score: number;
  reasoning: string;
  evidence: string[];
  concerns: string[];
}

interface AIEvaluationData {
  overallScore: number;
  recommendation: 'PASS' | 'INVESTIGATE' | 'REJECT';
  criterionScores: CriterionScore[];
  summary: string;
  keyFindings: string[];
  redFlags: string[];
  evaluatedAt: string;
}

interface Props {
  dealId: number;
  aiScore?: number;
  compact?: boolean;
}

export function AIScoreBadge({ aiScore }: { aiScore?: number }) {
  if (aiScore === undefined || aiScore === null) {
    return (
      <Badge variant="secondary" className="bg-gray-600 text-gray-300">
        <Clock className="w-3 h-3 mr-1" />
        Processing
      </Badge>
    );
  }

  if (aiScore === -1) {
    return (
      <Badge variant="secondary" className="bg-blue-600 text-blue-100 animate-pulse">
        <Brain className="w-3 h-3 mr-1" />
        Analyzing...
      </Badge>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 85) return "bg-green-600 text-green-100";
    if (score >= 65) return "bg-yellow-600 text-yellow-100";
    return "bg-red-600 text-red-100";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 85) return <CheckCircle className="w-3 h-3 mr-1" />;
    if (score >= 65) return <AlertTriangle className="w-3 h-3 mr-1" />;
    return <XCircle className="w-3 h-3 mr-1" />;
  };

  return (
    <Badge className={getScoreColor(aiScore)}>
      {getScoreIcon(aiScore)}
      {aiScore}/100
    </Badge>
  );
}

export default function AIEvaluationDisplay({ dealId, aiScore, compact = false }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: evaluation, isLoading } = useQuery({
    queryKey: ['/api/deals', dealId, 'evaluation'],
    enabled: aiScore !== undefined && aiScore !== -1 && aiScore !== null
  });

  if (compact) {
    return <AIScoreBadge aiScore={aiScore} />;
  }

  if (isLoading) {
    return (
      <Card className="bg-dark border-dark-lighter">
        <CardContent className="p-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2 text-sm text-gray-400">Loading evaluation...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!evaluation) {
    return (
      <Card className="bg-dark border-dark-lighter">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Brain className="w-4 h-4" />
            AI Investment Evaluation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <AIScoreBadge aiScore={aiScore} />
          </div>
          {aiScore === -1 && (
            <p className="text-sm text-gray-400 text-center mt-2">
              Our AI is analyzing this company's website against our investment criteria. 
              This usually takes 2-3 minutes.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const evaluationData = evaluation as AIEvaluationData;

  return (
    <Card className="bg-dark border-dark-lighter">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            AI Investment Evaluation
          </div>
          <AIScoreBadge aiScore={evaluationData.overallScore} />
        </CardTitle>
        <CardDescription>
          Intelligent analysis based on our investment criteria
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Score */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Overall Score</span>
            <span className="text-lg font-bold">{evaluationData.overallScore}/100</span>
          </div>
          <Progress 
            value={evaluationData.overallScore} 
            className="h-2"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>REJECT (0-49)</span>
            <span>INVESTIGATE (50-79)</span>
            <span>PASS (80-100)</span>
          </div>
        </div>

        {/* Recommendation */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-dark-lighter">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            <span className="font-medium">Recommendation</span>
          </div>
          <Badge 
            className={
              evaluationData.recommendation === 'PASS' ? 'bg-green-600 text-green-100' :
              evaluationData.recommendation === 'INVESTIGATE' ? 'bg-yellow-600 text-yellow-100' :
              'bg-red-600 text-red-100'
            }
          >
            {evaluationData.recommendation}
          </Badge>
        </div>

        {/* Summary */}
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Executive Summary
          </h4>
          <p className="text-sm text-gray-300">{evaluationData.summary}</p>
        </div>

        {/* Key Findings */}
        {evaluationData.keyFindings.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2 text-green-400">
              <CheckCircle className="w-4 h-4" />
              Key Findings
            </h4>
            <ul className="space-y-1">
              {evaluationData.keyFindings.map((finding, index) => (
                <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-green-400 mt-1">•</span>
                  {finding}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Red Flags */}
        {evaluationData.redFlags.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4" />
              Red Flags
            </h4>
            <ul className="space-y-1">
              {evaluationData.redFlags.map((flag, index) => (
                <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-red-400 mt-1">•</span>
                  {flag}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Detailed Criteria Breakdown */}
        <div className="pt-4 border-t border-dark-lighter">
          <Button
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full justify-between text-sm"
          >
            Detailed Criteria Breakdown
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          
          {isExpanded && (
            <div className="mt-4 space-y-4">
              {evaluationData.criterionScores.map((criterion, index) => (
                <Card key={index} className="bg-dark-lighter border-dark">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h5 className="font-medium">{criterion.criterion}</h5>
                      <Badge 
                        className={
                          criterion.score >= 80 ? 'bg-green-600 text-green-100' :
                          criterion.score >= 50 ? 'bg-yellow-600 text-yellow-100' :
                          'bg-red-600 text-red-100'
                        }
                      >
                        {criterion.score}/100
                      </Badge>
                    </div>
                    <Progress value={criterion.score} className="h-1 mb-3" />
                    <p className="text-sm text-gray-300 mb-2">{criterion.reasoning}</p>
                    
                    {criterion.evidence.length > 0 && (
                      <div className="mb-2">
                        <h6 className="text-xs font-medium text-green-400 mb-1">Evidence:</h6>
                        <ul className="text-xs text-gray-400 space-y-1">
                          {criterion.evidence.map((evidence, idx) => (
                            <li key={idx}>• {evidence}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {criterion.concerns.length > 0 && (
                      <div>
                        <h6 className="text-xs font-medium text-yellow-400 mb-1">Concerns:</h6>
                        <ul className="text-xs text-gray-400 space-y-1">
                          {criterion.concerns.map((concern, idx) => (
                            <li key={idx}>• {concern}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500 text-center pt-2">
          Evaluated on {new Date(evaluationData.evaluatedAt).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}