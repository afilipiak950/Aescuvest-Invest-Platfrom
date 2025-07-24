import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, HelpCircle, Zap, ChevronDown, ChevronRight } from 'lucide-react';
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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Technical Whitepapers']));

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Handle document click
  const handleDocumentClick = (documentName: string) => {
    console.log('📄 Document clicked:', documentName);
    // Find the document and open it
    const document = documents.find(doc => doc.name === documentName);
    if (document) {
      // Open document viewer or download
      window.open(`/api/documents/${document.id}/download`, '_blank');
    }
  };

  // Research questions by category
  const RESEARCH_QUESTIONS = [
    // Technical Whitepapers - 3 questions
    { id: "technical_1", question: "Are methodologies reproducible?", category: "Technical Whitepapers" },
    { id: "technical_2", question: "Are KPIs / benchmarks clearly described?", category: "Technical Whitepapers" },
    { id: "technical_3", question: "Are claims cited and supported by peer-reviewed literature?", category: "Technical Whitepapers" },
    
    // Market Research Reports - 3 questions
    { id: "market_1", question: "Are TAM/SAM/SOM defined with assumptions?", category: "Market Research Reports" },
    { id: "market_2", question: "Are sources cited (Gartner, Statista, CB Insights)?", category: "Market Research Reports" },
    { id: "market_3", question: "Are forecasts based on bottom-up or top-down logic?", category: "Market Research Reports" },
    
    // Academic Publications - 3 questions
    { id: "academic_1", question: "Are papers peer-reviewed?", category: "Academic Publications" },
    { id: "academic_2", question: "Are citations in PubMed, arXiv, Nature, etc.?", category: "Academic Publications" },
    { id: "academic_3", question: "Is the publication recent and still relevant?", category: "Academic Publications" },
    
    // Patent Landscape Analyses - 2 questions
    { id: "patent_1", question: "Are citations and forward references analyzed?", category: "Patent Landscape Analyses" },
    { id: "patent_2", question: "Is competitive IP density mapped?", category: "Patent Landscape Analyses" }
  ];

  const categorizedQuestions = RESEARCH_QUESTIONS.reduce((acc, question) => {
    if (!acc[question.category]) {
      acc[question.category] = [];
    }
    acc[question.category].push(question);
    return acc;
  }, {} as Record<string, typeof RESEARCH_QUESTIONS>);

  // Get answer for a specific question
  const getAnswerForQuestion = (questionId: string): {
    answer: string;
    confidence: number; 
    sources: string[];
    quotes?: Array<{document: string; text: string; relevance: string}>;
    keyFindings?: string[];
    evidenceSummary?: string;
    researchAssessment?: string;
    recommendations?: string[];
    detailedEvidence?: any[];
  } | null => {
    if (!analysisData) return null;
    
    console.log(`🔍 Looking for answer to question ${questionId}`);
    console.log(`🔍 Research Answers exists:`, !!analysisData.researchAnswers);
    console.log(`🔍 Question ${questionId} exists in research answers:`, !!analysisData.researchAnswers?.[questionId]);
    
    // First try to get answer from researchAnswers structure
    if (analysisData.researchAnswers && analysisData.researchAnswers[questionId]) {
      const answer = analysisData.researchAnswers[questionId];
      console.log(`🔍 Found enhanced answer for ${questionId}:`, answer);
      console.log(`🔍 Has detailedEvidence:`, !!answer.detailedEvidence);
      return {
        answer: answer.answer,
        confidence: answer.confidence,
        sources: Array.isArray(answer.sources) ? answer.sources : answer.sources ? [answer.sources] : [],
        quotes: answer.quotes || [],
        keyFindings: answer.keyFindings || [],
        evidenceSummary: answer.evidenceSummary || '',
        researchAssessment: answer.researchAssessment || '',
        recommendations: answer.recommendations || [],
        detailedEvidence: answer.detailedEvidence || []
      };
    }
    
    // Fallback to research_answers structure
    if (analysisData.research_answers && analysisData.research_answers[questionId]) {
      const answer = analysisData.research_answers[questionId];
      return {
        answer: answer.answer,
        confidence: Math.round((answer.confidence || 0.75) * 100),
        sources: Array.isArray(answer.sources) ? answer.sources : answer.sources ? [answer.sources] : [],
        quotes: answer.quotes || [],
        keyFindings: answer.keyFindings || [],
        evidenceSummary: answer.evidenceSummary || '',
        researchAssessment: answer.researchAssessment || '',
        recommendations: answer.recommendations || [],
        detailedEvidence: answer.detailedEvidence || []
      };
    }
    
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-green-400" />
          <h3 className="text-lg font-semibold text-white">Research Due Diligence Questions</h3>
          <Badge variant="outline" className="text-gray-400 border-gray-400">
            {assignedDocuments} Documents Analyzed
          </Badge>
        </div>
        <ComprehensiveResearchAnalysisButton dealId={dealId} />
      </div>

      {Object.entries(categorizedQuestions).map(([category, questions]) => (
        <div key={category} className="border border-dark-lighter rounded-lg">
          <button
            onClick={() => toggleCategory(category)}
            className="w-full flex items-center justify-between p-4 bg-dark-lighter/50 hover:bg-dark-lighter/70 transition-colors"
          >
            <h4 className="font-medium text-white text-left">{category}</h4>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-gray-400 border-gray-400">
                {questions.length} questions
              </Badge>
              {expandedCategories.has(category) ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </div>
          </button>

          {expandedCategories.has(category) && (
            <div className="p-4 space-y-4">
              {questions.map((question) => {
                const answer = getAnswerForQuestion(question.id);
                const hasAnswer = answer !== null;
                
                return (
                  <div key={question.id} className="border border-dark-lighter/50 rounded-lg">
                    <div className="p-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          hasAnswer ? 'bg-green-400' : 'bg-gray-400'
                        }`} />
                        <div className="flex-1">
                          <p className="text-white font-medium text-sm">{question.question}</p>
                          
                          {hasAnswer ? (
                            <div className="mt-3 space-y-3">
                              {/* Main Answer */}
                              <div className="bg-dark/50 rounded p-3">
                                <h5 className="text-xs font-medium text-green-400 mb-2">Research Analysis</h5>
                                <p className="text-gray-300 text-sm leading-relaxed">{answer.answer}</p>
                              </div>

                              {/* Enhanced Research Assessment */}
                              {answer.researchAssessment && (
                                <div className="bg-dark/30 rounded p-3">
                                  <h5 className="text-xs font-medium text-purple-400 mb-2">Research Assessment</h5>
                                  <p className="text-gray-300 text-sm leading-relaxed">{answer.researchAssessment}</p>
                                </div>
                              )}

                              {/* Document Quotes */}
                              {answer.quotes && answer.quotes.length > 0 && (
                                <div className="bg-gradient-to-r from-yellow-400/10 to-orange-400/10 rounded p-3">
                                  <h5 className="text-xs font-medium text-yellow-400 mb-2">
                                    📖 Document Quotes ({answer.quotes.length})
                                  </h5>
                                  <div className="space-y-2">
                                    {answer.quotes.map((quote, index) => (
                                      <div key={index} className="bg-dark/70 rounded p-2 border-l-2 border-yellow-400">
                                        <div className="flex items-start justify-between mb-1">
                                          <button
                                            onClick={() => handleDocumentClick(quote.document)}
                                            className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 hover:bg-blue-500/30 transition-colors cursor-pointer"
                                            title={`View document: ${quote.document}`}
                                          >
                                            📄 {quote.document.length > 25 ? `${quote.document.substring(0, 25)}...` : quote.document}
                                          </button>
                                          {quote.relevance && (
                                            <Badge variant="outline" className="text-xs text-gray-400 border-gray-400">
                                              {quote.relevance}
                                            </Badge>
                                          )}
                                        </div>
                                        <blockquote className="text-gray-300 text-xs italic leading-relaxed border-l-2 border-gray-600 pl-2 mt-1">
                                          "{quote.text}"
                                        </blockquote>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Evidence Summary */}
                              {answer.evidenceSummary && (
                                <div className="bg-dark/30 rounded p-3">
                                  <h5 className="text-xs font-medium text-green-400 mb-2">Evidence Summary</h5>
                                  <p className="text-gray-300 text-sm leading-relaxed">{answer.evidenceSummary}</p>
                                </div>
                              )}

                              {/* Key Findings */}
                              {answer.keyFindings && answer.keyFindings.length > 0 && (
                                <div className="bg-dark/30 rounded p-3">
                                  <h5 className="text-xs font-medium text-blue-400 mb-2">Key Findings</h5>
                                  <ul className="space-y-1">
                                    {answer.keyFindings.map((finding, index) => (
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
                                    {answer.recommendations.map((rec, index) => (
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
                                  Confidence: {answer.confidence}%
                                </Badge>
                                {answer.quotes && answer.quotes.length > 0 && (
                                  <Badge 
                                    variant="outline" 
                                    className="text-yellow-400 border-yellow-400 cursor-pointer hover:bg-yellow-400/10"
                                    onClick={() => {
                                      setSelectedQuoteData({
                                        quotes: answer.quotes?.map((quote: any) => ({
                                          text: quote.text,
                                          documentName: quote.document || 'Unknown Document',
                                          confidence: answer.confidence || 80
                                        })) || [],
                                        sources: [],
                                        title: question.question
                                      });
                                      setQuoteViewerOpen(true);
                                    }}
                                  >
                                    {answer.quotes.length} quote{answer.quotes.length > 1 ? 's' : ''}
                                  </Badge>
                                )}
                                {answer.sources && answer.sources.length > 0 && (
                                  <Badge 
                                    variant="outline" 
                                    className="text-blue-400 border-blue-400 cursor-pointer hover:bg-blue-400/10"
                                    onClick={() => {
                                      console.log('🚀 CLICK HANDLER TRIGGERED!');
                                      console.log('🔍 Answer object:', answer);
                                      // Create sources using detailed evidence with unique content from each document
                                      console.log('🔍 Processing detailedEvidence:', answer.detailedEvidence);
                                      const sources = answer.detailedEvidence?.map((evidence: any) => {
                                        console.log('🔍 Processing evidence for:', evidence.documentName);
                                        console.log('🔍 Evidence data:', evidence);
                                        return {
                                          documentName: evidence.documentName,
                                          relevantSections: evidence.relevantContent || evidence.keyFindings || [evidence.documentSummary || 'No specific section identified'],
                                          extractedText: evidence.documentSummary || 'No specific content extracted'
                                        };
                                      }) || answer.sources.map((source: string) => ({
                                        documentName: source,
                                        relevantSections: [answer.answer || 'No specific section identified'],
                                        extractedText: answer.answer
                                      }));
                                      console.log('🔍 Final sources array:', sources);
                                      
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
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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