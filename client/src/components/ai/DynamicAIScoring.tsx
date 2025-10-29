import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Brain, RefreshCw, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EvaluationCriteria {
  id: number;
  name: string;
  description: string;
  weight: number;
  isActive: boolean;
}

interface EvaluationResult {
  id: number;
  dealId: number;
  criteriaId: number;
  score: number;
  reasoning: string;
  keyFactors?: string[];
  riskLevel?: 'low' | 'medium' | 'high';
  confidence?: number;
  createdAt: string;
}

interface EvaluationResultsResponse {
  results: EvaluationResult[];
  criteria: EvaluationCriteria[];
}

interface DynamicAIScoringProps {
  dealId: number;
  overallScore?: number;
}

export default function DynamicAIScoring({ dealId, overallScore }: DynamicAIScoringProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEvaluating, setIsEvaluating] = useState(false);

  const { data: criteria, isLoading: loadingCriteria } = useQuery<EvaluationCriteria[]>({
    queryKey: ["/api/evaluation-criteria"],
  });

  const { data: evaluationData, isLoading: loadingResults } = useQuery<EvaluationResultsResponse>({
    queryKey: [`/api/deals/${dealId}/evaluation-results`],
    refetchInterval: isEvaluating ? 5000 : false, // Poll every 5s while running
  });

  // Poll for background job progress (ALWAYS enabled to detect in-progress jobs after reload)
  const { data: jobsData } = useQuery<{success: boolean, jobs: any[]}>({
    queryKey: [`/api/background-jobs/${dealId}`],
    refetchInterval: 2000, // Always poll every 2s to detect in-progress jobs
  });

  // Find the AI evaluation job
  const aiEvaluationJob = jobsData?.jobs?.find(job => 
    job.jobType === 'ai_evaluation' && job.status === 'processing'
  );
  
  const evaluationProgress = aiEvaluationJob?.progress ?? 0;
  const evaluationStep = aiEvaluationJob?.currentStep ?? '';

  // Auto-detect in-progress evaluation on mount or job status change
  useEffect(() => {
    if (aiEvaluationJob) {
      // Found in-progress job, enable evaluating state
      if (!isEvaluating) {
        console.log('📊 Detected in-progress AI evaluation, enabling progress tracking');
        setIsEvaluating(true);
      }
    } else if (isEvaluating) {
      // Job completed, failed, or not found - disable evaluating state
      const completedJob = jobsData?.jobs?.find(job => 
        job.jobType === 'ai_evaluation' && job.status === 'completed'
      );
      const failedJob = jobsData?.jobs?.find(job => 
        job.jobType === 'ai_evaluation' && job.status === 'failed'
      );
      
      if (completedJob) {
        console.log('✅ AI evaluation completed, stopping progress tracking');
        setIsEvaluating(false);
        // Refresh results
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/evaluation-results`] });
        queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      } else if (failedJob) {
        console.error('❌ AI evaluation failed, stopping progress tracking');
        setIsEvaluating(false);
        // Show error toast
        toast({
          title: "❌ AI Evaluation Failed",
          description: failedJob.error || "Evaluation failed. Please try again.",
          variant: "destructive",
          duration: 7000,
        });
        // Refresh results
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/evaluation-results`] });
        queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      }
    }
  }, [aiEvaluationJob, isEvaluating, jobsData, dealId, queryClient, toast]);

  const runAIEvaluation = useMutation({
    mutationFn: async () => {
      console.log(`🚀 Starting AI evaluation for deal ${dealId}...`);
      setIsEvaluating(true);
      return apiRequest(`/api/deals/${dealId}/evaluate`, {
        method: 'POST'
      });
    },
    onSuccess: (data) => {
      console.log(`✅ AI Evaluation completed:`, data);
      setIsEvaluating(false);
      toast({
        title: "✅ AI Evaluation Complete",
        description: `Analysis completed with score: ${data.overallScore}/100`,
        duration: 5000,
      });
      // Invalidate queries to fetch fresh data
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/evaluation-results`] });
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation-criteria"] });
    },
    onError: (error: any) => {
      console.error(`❌ AI Evaluation failed:`, error);
      setIsEvaluating(false);
      toast({
        title: "❌ AI Evaluation Failed",
        description: error.message || "Failed to complete AI evaluation. Please try again.",
        variant: "destructive",
        duration: 7000,
      });
    }
  });

  // Auto-refresh results when evaluation completes
  useEffect(() => {
    if (!isEvaluating && runAIEvaluation.isSuccess) {
      // Refresh data after 2 seconds to ensure backend has saved
      const timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/evaluation-results`] });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isEvaluating, runAIEvaluation.isSuccess, dealId, queryClient]);

  if (loadingCriteria || loadingResults) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const activeCriteria = criteria?.filter(c => c.isActive) || [];
  const totalWeight = activeCriteria.reduce((sum, c) => sum + c.weight, 0);
  const evaluationResults = evaluationData?.results || [];

  // Calculate weighted scores
  const scoredCriteria = activeCriteria.map(criteria => {
    const result = evaluationResults.find(r => r.criteriaId === criteria.id);
    const hasResult = result != null;
    const rawScore = hasResult ? result.score : null;
    const weightedScore = hasResult ? (result.score * criteria.weight) / 100 : 0;
    
    return {
      ...criteria,
      rawScore,
      hasResult,
      weightedScore,
      reasoning: result?.reasoning || "Not evaluated yet",
      normalizedWeight: (criteria.weight / totalWeight) * 100
    };
  });

  const calculatedScore = scoredCriteria.reduce((sum, c) => sum + c.weightedScore, 0);
  const hasAnyResults = evaluationResults && evaluationResults.length > 0;
  const displayScore = overallScore != null ? overallScore : Math.round(calculatedScore);

  return (
    <div className="pt-4 space-y-6">
      {/* Overall Score Summary */}
      <Card className="bg-dark border-dark-lighter">
        <CardHeader>
          <CardTitle className="text-lg">AI Evaluation Summary</CardTitle>
          <CardDescription>Scoring based on your configured evaluation criteria</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-2xl font-bold text-white">
                {hasAnyResults ? `${displayScore}/100` : (
                  <span className="text-gray-500">Not Evaluated</span>
                )}
              </h4>
              <p className="text-gray-400">Overall Investment Score</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => runAIEvaluation.mutate()}
                disabled={runAIEvaluation.isPending || isEvaluating}
                className="bg-primary hover:bg-primary-hover"
                data-testid="button-run-ai-evaluation"
              >
                {(runAIEvaluation.isPending || isEvaluating) ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Running AI Analysis... (~75s)
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" />
                    Run AI Evaluation
                  </>
                )}
              </Button>
              <div className={`px-4 py-2 rounded-lg text-lg font-medium ${
                !hasAnyResults ? 'bg-gray-600/20 text-gray-400 border border-gray-600/30' :
                displayScore >= 85 ? 'bg-green-600/20 text-green-400 border border-green-600/30' :
                displayScore >= 65 ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30' :
                'bg-red-600/20 text-red-400 border border-red-600/30'
              }`}>
                {!hasAnyResults ? 'PENDING' : displayScore >= 85 ? 'PASS' : displayScore >= 65 ? 'INVESTIGATE' : 'REJECT'}
              </div>
            </div>
          </div>
          {(runAIEvaluation.isPending || isEvaluating) && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-medium">{evaluationStep || 'Processing AI evaluation...'}</span>
                </div>
                <span className="text-sm font-bold text-blue-300">{evaluationProgress}%</span>
              </div>
              <div className="relative">
                <Progress value={evaluationProgress} className="h-2" />
              </div>
              <p className="text-xs text-blue-300/80">
                This typically takes 60-75 seconds to complete. You can leave this page and come back.
              </p>
            </div>
          )}
          <p className="text-gray-300">
            Evaluated against {activeCriteria.length} active criteria with weighted scoring algorithm.
            Total weight allocation: {totalWeight}%
          </p>
        </CardContent>
      </Card>

      {/* Scoring Criteria Breakdown */}
      <Card className="bg-dark border-dark-lighter">
        <CardHeader>
          <CardTitle className="text-lg">Evaluation Criteria Breakdown</CardTitle>
          <CardDescription>Detailed scoring based on your investment criteria settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {scoredCriteria.map((criterion) => {
              const scoreValue = criterion.rawScore ?? 0;
              const scoreColor = !criterion.hasResult ? 'text-gray-500' :
                               scoreValue >= 80 ? 'text-green-400' : 
                               scoreValue >= 60 ? 'text-yellow-400' : 'text-red-400';
              const barColor = !criterion.hasResult ? 'bg-gray-600' :
                              scoreValue >= 80 ? 'bg-green-500' : 
                              scoreValue >= 60 ? 'bg-yellow-500' : 'bg-red-500';
              
              return (
                <div key={criterion.id} className="space-y-3 p-4 bg-dark-light rounded-lg border border-dark-lighter">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-white font-medium">{criterion.name}</span>
                        <span className="text-xs bg-dark border border-dark-lighter px-2 py-1 rounded">
                          Weight: {criterion.weight}%
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">{criterion.description}</p>
                    </div>
                    <div className="text-right ml-4">
                      <span className={`font-semibold ${scoreColor}`}>
                        {criterion.hasResult ? `${scoreValue}/100` : 'Pending'}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        Weighted: {criterion.weightedScore.toFixed(1)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="w-full bg-dark-lighter rounded-full h-2">
                    <div 
                      className={`${barColor} h-2 rounded-full transition-all duration-500`} 
                      style={{width: `${criterion.rawScore ?? 0}%`}}
                    ></div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="bg-dark-lighter p-3 rounded border border-dark">
                      <h5 className="text-xs font-semibold text-white mb-2">Analysis</h5>
                      <p className="text-sm text-gray-300 leading-relaxed">
                        {criterion.reasoning}
                      </p>
                    </div>
                    
                    {evaluationResults?.find(r => r.criteriaId === criterion.id) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Evidence Section */}
                        {evaluationResults.find(r => r.criteriaId === criterion.id)?.keyFactors && 
                         Array.isArray(evaluationResults.find(r => r.criteriaId === criterion.id)?.keyFactors) && 
                         evaluationResults.find(r => r.criteriaId === criterion.id)?.keyFactors && evaluationResults.find(r => r.criteriaId === criterion.id)!.keyFactors!.length > 0 && (
                          <div className="bg-green-900/20 p-3 rounded border border-green-700/30">
                            <h6 className="text-xs font-semibold text-green-400 mb-2 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Supporting Evidence
                            </h6>
                            <ul className="text-xs text-green-200 space-y-1">
                              {(evaluationResults.find(r => r.criteriaId === criterion.id)?.keyFactors || []).slice(0, 3).map((factor, idx) => (
                                <li key={idx} className="flex items-start gap-1">
                                  <span className="text-green-400 mt-0.5">•</span>
                                  <span>{factor}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Risk Assessment */}
                        <div className="space-y-2">
                          {evaluationResults.find(r => r.criteriaId === criterion.id)?.riskLevel && (
                            <div className={`p-3 rounded border ${
                              evaluationResults.find(r => r.criteriaId === criterion.id)?.riskLevel === 'low' 
                                ? 'bg-green-900/20 border-green-700/30' 
                                : evaluationResults.find(r => r.criteriaId === criterion.id)?.riskLevel === 'medium'
                                ? 'bg-yellow-900/20 border-yellow-700/30'
                                : 'bg-red-900/20 border-red-700/30'
                            }`}>
                              <div className="flex items-center gap-2 mb-1">
                                {evaluationResults.find(r => r.criteriaId === criterion.id)?.riskLevel === 'low' && 
                                  <CheckCircle className="w-3 h-3 text-green-400" />}
                                {evaluationResults.find(r => r.criteriaId === criterion.id)?.riskLevel === 'medium' && 
                                  <AlertTriangle className="w-3 h-3 text-yellow-400" />}
                                {evaluationResults.find(r => r.criteriaId === criterion.id)?.riskLevel === 'high' && 
                                  <XCircle className="w-3 h-3 text-red-400" />}
                                <span className={`text-xs font-semibold ${
                                  evaluationResults.find(r => r.criteriaId === criterion.id)?.riskLevel === 'low' 
                                    ? 'text-green-400' 
                                    : evaluationResults.find(r => r.criteriaId === criterion.id)?.riskLevel === 'medium'
                                    ? 'text-yellow-400'
                                    : 'text-red-400'
                                }`}>
                                  {evaluationResults.find(r => r.criteriaId === criterion.id)?.riskLevel?.toUpperCase()} RISK
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {evaluationResults.find(r => r.criteriaId === criterion.id)?.confidence && (
                            <div className="bg-blue-900/20 p-2 rounded border border-blue-700/30">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-blue-400 font-semibold">AI Confidence</span>
                                <span className="text-xs text-blue-200">
                                  {Math.round((evaluationResults.find(r => r.criteriaId === criterion.id)?.confidence || 0) * 100)}%
                                </span>
                              </div>
                              <div className="w-full bg-blue-900/30 rounded-full h-1 mt-1">
                                <div 
                                  className="bg-blue-400 h-1 rounded-full" 
                                  style={{width: `${Math.round((evaluationResults.find(r => r.criteriaId === criterion.id)?.confidence || 0) * 100)}%`}}
                                ></div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Scoring Algorithm Details */}
      <Card className="bg-dark border-dark-lighter">
        <CardHeader>
          <CardTitle className="text-lg">Scoring Algorithm</CardTitle>
          <CardDescription>How the overall score is calculated</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-dark-light p-4 rounded-lg border border-dark-lighter">
              <h4 className="font-semibold text-white mb-2">Weighted Average</h4>
              <p className="text-sm text-gray-400 mb-2">
                Each criterion score is multiplied by its weight percentage
              </p>
              <div className="text-xs text-gray-500">
                Formula: Σ(Score × Weight) / 100
              </div>
            </div>
            
            <div className="bg-dark-light p-4 rounded-lg border border-dark-lighter">
              <h4 className="font-semibold text-white mb-2">Dynamic Criteria</h4>
              <p className="text-sm text-gray-400 mb-2">
                Based on your active evaluation criteria settings
              </p>
              <div className="text-xs text-gray-500">
                Configurable in Settings → Evaluation Criteria
              </div>
            </div>
          </div>
          
          <div className="bg-dark-light p-4 rounded-lg border border-dark-lighter">
            <h4 className="font-semibold text-white mb-3">Score Calculation</h4>
            <div className="space-y-2 text-sm">
              {scoredCriteria.map(criterion => (
                <div key={criterion.id} className="flex justify-between text-gray-300">
                  <span>{criterion.name}:</span>
                  <span>
                    {criterion.hasResult ? `${criterion.rawScore}` : '—'} × {criterion.weight}% = {criterion.weightedScore.toFixed(1)}
                  </span>
                </div>
              ))}
              <hr className="border-dark-lighter my-2" />
              <div className="flex justify-between font-semibold text-white">
                <span>Total Score:</span>
                <span>{calculatedScore.toFixed(1)} ≈ {Math.round(calculatedScore)}/100</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
