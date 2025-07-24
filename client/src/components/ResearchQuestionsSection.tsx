import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, HelpCircle, Zap } from 'lucide-react';
import DocumentQuoteViewer from './DocumentQuoteViewer';

interface ResearchQuestionsSectionProps {
  dealId: number;
  analysisData: any;
  assignedDocuments: number;
  documents: any[];
}

export default function ResearchQuestionsSection({ dealId, analysisData, assignedDocuments, documents }: ResearchQuestionsSectionProps) {
  const [quoteViewerOpen, setQuoteViewerOpen] = useState(false);
  const [selectedQuoteData, setSelectedQuoteData] = useState<{
    quotes?: any[];
    sources?: any[];
    title: string;
  }>({ quotes: [], sources: [], title: '' });

  // Check if research analysis is available
  const hasResearchAnalysis = analysisData && (
    (analysisData.researchAnswers && Object.keys(analysisData.researchAnswers).length > 0) ||
    (analysisData.research_answers && Object.keys(analysisData.research_answers).length > 0)
  );

  // Get research answers, preferring comprehensive data
  const researchAnswers = analysisData?.researchAnswers || analysisData?.research_answers || {};

  console.log('🔬 Research Analysis Available:', hasResearchAnalysis);
  console.log('🔬 Research Analysis Data:', analysisData);
  console.log('🔬 Research Answers:', researchAnswers);

  // Group questions by category
  const questionsByCategory = {
    'Technical Whitepapers': [
      { id: 'technical_1', question: 'Are methodologies reproducible?' },
      { id: 'technical_2', question: 'Are KPIs / benchmarks clearly described?' },
      { id: 'technical_3', question: 'Are claims cited and supported by peer-reviewed literature?' }
    ],
    'Market Research Reports': [
      { id: 'market_1', question: 'Are TAM/SAM/SOM defined with assumptions?' },
      { id: 'market_2', question: 'Are sources cited (Gartner, Statista, CB Insights)?' },
      { id: 'market_3', question: 'Are forecasts based on bottom-up or top-down logic?' }
    ],
    'Academic Publications': [
      { id: 'academic_1', question: 'Are papers peer-reviewed?' },
      { id: 'academic_2', question: 'Are citations in PubMed, arXiv, Nature, etc.?' },
      { id: 'academic_3', question: 'Is the publication recent and still relevant?' }
    ],
    'Patent Landscape Analyses': [
      { id: 'patent_1', question: 'Are citations and forward references analyzed?' },
      { id: 'patent_2', question: 'Is competitive IP density mapped?' }
    ]
  };

  if (!hasResearchAnalysis) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Research Analysis</h3>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{assignedDocuments} documents assigned</span>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-orange-400/10 to-red-400/10 border border-orange-400/20 rounded-lg p-6 text-center">
          <HelpCircle className="h-8 w-8 text-orange-400 mx-auto mb-3" />
          <h4 className="text-lg font-medium text-white mb-2">No Research Analysis Available</h4>
          <p className="text-gray-400 text-sm mb-4">
            Start a comprehensive research analysis to evaluate technical whitepapers, market research reports, academic publications, and patent landscape across {assignedDocuments} assigned documents.
          </p>
          <ComprehensiveResearchAnalysisButton dealId={dealId} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Research Analysis</h3>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{assignedDocuments} documents analyzed</span>
          <ComprehensiveResearchAnalysisButton dealId={dealId} />
        </div>
      </div>

      {Object.entries(questionsByCategory).map(([category, questions]) => (
        <div key={category} className="space-y-4">
          <h4 className="text-base font-medium text-white border-b border-dark-lighter pb-2">
            {category}
          </h4>
          
          <div className="space-y-3">
            {questions.map((question) => {
              const answer = researchAnswers[question.id];
              
              return (
                <div key={question.id} className="border border-dark-lighter rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <h5 className="text-sm font-medium text-white pr-4">{question.question}</h5>
                    {answer && (
                      <Badge variant="outline" className="text-green-400 border-green-400 shrink-0">
                        Analyzed
                      </Badge>
                    )}
                  </div>
                  
                  {answer ? (
                    <div className="space-y-3">
                      <p className="text-gray-300 text-sm leading-relaxed">
                        {answer.answer}
                      </p>

                      {/* Key Findings */}
                      {answer.keyFindings && answer.keyFindings.length > 0 && (
                        <div className="bg-dark/30 rounded p-3">
                          <h5 className="text-xs font-medium text-blue-400 mb-2">Key Findings</h5>
                          <ul className="space-y-1">
                            {answer.keyFindings.map((finding: string, index: number) => (
                              <li key={index} className="text-gray-300 text-xs flex items-start gap-2">
                                <span className="text-blue-400 text-xs mt-1">•</span>
                                {finding}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Recommendations */}
                      {answer.recommendations && answer.recommendations.length > 0 && (
                        <div className="bg-gradient-to-r from-red-400/10 to-orange-400/10 rounded p-3">
                          <h5 className="text-xs font-medium text-red-400 mb-2">Recommendations</h5>
                          <ul className="space-y-1">
                            {answer.recommendations.map((rec: string, index: number) => (
                              <li key={index} className="text-gray-300 text-xs flex items-start gap-2">
                                <span className="text-red-400 text-xs mt-1">⚠</span>
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-green-400 border-green-400">
                          Confidence: {Math.round((answer.confidence || 0.75) * 100)}%
                        </Badge>
                        {answer.sources && answer.sources.length > 0 && (
                          <Badge 
                            variant="outline" 
                            className="text-blue-400 border-blue-400 cursor-pointer hover:bg-blue-400/10"
                            onClick={() => {
                              const sources = answer.detailedEvidence?.map((evidence: any) => ({
                                documentName: evidence.documentName,
                                relevantSections: evidence.relevantContent || [evidence.documentSummary || 'No specific section identified'],
                                extractedText: evidence.documentSummary || 'No specific content extracted'
                              })) || answer.sources.map((source: string) => ({
                                documentName: source,
                                relevantSections: [answer.answer || 'No specific section identified'],
                                extractedText: answer.answer
                              }));
                              
                              setSelectedQuoteData({
                                quotes: [],
                                sources,
                                title: question.question
                              });
                              setQuoteViewerOpen(true);
                            }}
                          >
                            {answer.sources.length} source{answer.sources.length > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 bg-dark/30 rounded p-3">
                      <p className="text-gray-400 text-sm italic">No answer found in analyzed documents</p>
                      <Badge variant="outline" className="text-gray-400 border-gray-400 mt-2">
                        Requires analysis
                      </Badge>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      
      <DocumentQuoteViewer
        isOpen={quoteViewerOpen}
        onClose={() => setQuoteViewerOpen(false)}
        quotes={selectedQuoteData.quotes}
        sources={selectedQuoteData.sources}
        title={selectedQuoteData.title}
        documents={documents}
      />
    </div>
  );
}

// Comprehensive Research Analysis Button Component
function ComprehensiveResearchAnalysisButton({ dealId }: { dealId: number }) {
  const [isRunning, setIsRunning] = useState(false);
  const queryClient = useQueryClient();

  // Check for existing background jobs
  const { data: jobProgress } = useQuery({
    queryKey: [`/api/background-jobs/${dealId}`],
    refetchInterval: 1000,
  });

  // Check if research analysis is already running
  const isAlreadyRunning = (() => {
    if (jobProgress && (jobProgress as any).jobs) {
      const researchJob = (jobProgress as any).jobs.find((job: any) => job.agentType === 'Research');
      return !!researchJob && researchJob.status === 'processing';
    }
    return false;
  })();

  const comprehensiveAnalysisMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/deals/${dealId}/research-analysis/comprehensive`, {
        method: 'POST'
      });
      return response;
    },
    onSuccess: (data) => {
      if (data?.alreadyRunning) {
        console.log('Research analysis already running');
        setIsRunning(false);
        return;
      }
      
      queryClient.invalidateQueries({
        queryKey: [`/api/deals/${dealId}/research-analysis/comprehensive/results`]
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/deals/${dealId}/agents/research/results`]
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/analyses', dealId]
      });
      
      console.log('Comprehensive research analysis started successfully');
    },
    onError: (error) => {
      console.error('Error starting comprehensive research analysis:', error);
      setIsRunning(false);
    }
  });

  const handleRunAnalysis = async () => {
    setIsRunning(true);
    console.log('Starting comprehensive research analysis for deal', dealId);
    
    try {
      await comprehensiveAnalysisMutation.mutateAsync();
      
      let attempts = 0;
      const maxAttempts = 60;
      
      const checkForResults = async () => {
        attempts++;
        
        try {
          const response = await fetch(`/api/deals/${dealId}/research-analysis/comprehensive/results?_t=${Date.now()}`, {
            cache: 'no-cache'
          });
          const data = await response.json();
          
          console.log(`Research analysis attempt ${attempts}...`);
          
          if (data.success && data.results?.researchAnswers && Object.keys(data.results.researchAnswers).length > 0) {
            console.log('Research analysis completed!');
            
            queryClient.invalidateQueries({
              queryKey: [`/api/deals/${dealId}/research-analysis/comprehensive/results`]
            });
            queryClient.invalidateQueries({
              queryKey: [`/api/deals/${dealId}/agents/research/results`]
            });
            queryClient.invalidateQueries({
              queryKey: ['/api/analyses', dealId]
            });
            queryClient.invalidateQueries({
              queryKey: [`/api/background-jobs/${dealId}`]
            });
            
            setTimeout(() => {
              setIsRunning(false);
            }, 1000);
            
            return;
          }
        } catch (error) {
          console.error('Error checking for research results:', error);
        }
        
        if (attempts < maxAttempts) {
          setTimeout(checkForResults, 3000);
        } else {
          setIsRunning(false);
        }
      };
      
      setTimeout(checkForResults, 5000);
      
    } catch (error) {
      console.error('Error starting research analysis:', error);
      setIsRunning(false);
    }
  };

  return (
    <Button
      onClick={handleRunAnalysis}
      disabled={isRunning || comprehensiveAnalysisMutation.isPending || isAlreadyRunning}
      size="sm"
      className="bg-green-600 hover:bg-green-700 text-white border-green-500"
    >
      {isRunning || comprehensiveAnalysisMutation.isPending || isAlreadyRunning ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {isAlreadyRunning ? 'Research Analysis Running...' : isRunning ? 'Research Analysis Running...' : 'Starting Analysis...'}
        </>
      ) : (
        <>
          <Zap className="h-4 w-4 mr-2" />
          Run Research Analysis
        </>
      )}
    </Button>
  );
}