import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, HelpCircle, Zap, ChevronDown, ChevronRight } from 'lucide-react';
import DocumentQuoteViewer from './DocumentQuoteViewer';

// Comprehensive Research Analysis Button Component
function ComprehensiveResearchAnalysisButton({ dealId }: { dealId: number }) {
  const [isRunning, setIsRunning] = useState(false);

  // RESET: Force isRunning to false to fix stuck state - AGGRESSIVE RESET
  useEffect(() => {
    console.log('🔄 AGGRESSIVE RESET: ResearchQuestionsSection button isRunning state to false');
    setIsRunning(false);
  }); // No dependency array = runs every render

  // Also force reset when component first mounts
  if (isRunning) {
    console.log('🔄 FORCE RESET: ResearchQuestionsSection detected isRunning=true, forcing false');
    setIsRunning(false);
  }
  
  const comprehensiveAnalysisMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/deals/${dealId}/research-analysis/comprehensive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return response;
    },
    onSuccess: () => {
      console.log('Comprehensive research analysis started successfully');
    },
    onError: (error) => {
      console.error('Error starting comprehensive research analysis:', error);
      setIsRunning(false);
    }
  });

  const handleRunAnalysis = async () => {
    console.log('🚀 ACTUAL Research button clicked! Deal:', dealId);
    console.log('🔍 Button state before:', { isRunning, isPending: comprehensiveAnalysisMutation.isPending });
    
    setIsRunning(true);
    console.log('Starting comprehensive research analysis for deal', dealId);
    
    try {
      console.log('🔥 About to call mutateAsync...');
      await comprehensiveAnalysisMutation.mutateAsync();
      console.log('✅ Research mutation completed successfully');
    } catch (error) {
      console.error('❌ Error starting research analysis:', error);
      setIsRunning(false);
    }
  };

  // Debug disabled state for Research button
  console.log('🔍 ACTUAL Research button state:', {
    isRunning,
    isPending: comprehensiveAnalysisMutation.isPending,
    disabled: isRunning || comprehensiveAnalysisMutation.isPending,
    dealId
  });

  return (
    <Button
      onClick={handleRunAnalysis}
      disabled={isRunning || comprehensiveAnalysisMutation.isPending}
      size="sm"
      className="bg-cyan-600 hover:bg-cyan-700 text-white border-cyan-500"
    >
      {isRunning || comprehensiveAnalysisMutation.isPending ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Research Analysis Running...
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

// Research Analysis Progress Display Component
function ResearchAnalysisProgress({ dealId }: { dealId: number }) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  const { data: jobProgress } = useQuery({
    queryKey: [`/api/background-jobs/${dealId}`],
    refetchInterval: 1000,
  });

  React.useEffect(() => {
    try {
      if (jobProgress && typeof jobProgress === 'object' && 'jobs' in jobProgress && Array.isArray((jobProgress as any).jobs)) {
        const researchJob = (jobProgress as any).jobs.find((job: any) => job.agentType === 'Research');
        
        // Only show progress bar if research job is actively processing and has meaningful progress
        if (researchJob && researchJob.status === 'processing' && researchJob.progress > 0) {
          setProgress(researchJob.progress || 0);
          setCurrentStep(researchJob.currentDocument || 'Processing research analysis...');
          setIsVisible(true);
          console.log('🔬 Research progress visible:', researchJob.progress + '%');
        } else {
          setIsVisible(false);
          if (researchJob) {
            console.log('🔬 Research progress hidden - Status:', researchJob.status, 'Progress:', researchJob.progress);
          }
        }
      } else {
        setIsVisible(false);
      }
    } catch (error) {
      console.error('Error in ResearchAnalysisProgress useEffect:', error);
      setIsVisible(false);
    }
  }, [jobProgress]);

  if (!isVisible) return null;

  return (
    <div className="mb-4 p-4 bg-cyan-400/10 border border-cyan-400/20 rounded-lg">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-cyan-400">Research Analysis in Progress</span>
            <span className="text-sm text-cyan-300">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-cyan-400/20 rounded-full h-2 mb-2">
            <div 
              className="bg-cyan-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-cyan-300">{currentStep}</p>
        </div>
      </div>
    </div>
  );
}

interface ResearchQuestionsSectionProps {
  dealId: number;
  analysisData: any;
  assignedDocuments: number;
  documents: any[];
}

export default function ResearchQuestionsSection({ dealId, analysisData, assignedDocuments, documents }: ResearchQuestionsSectionProps) {
  const queryClient = useQueryClient();

  // Fetch Research analysis data from working endpoint
  const { data: comprehensiveResults, error: comprehensiveError, isLoading: comprehensiveLoading } = useQuery({
    queryKey: [`/api/deals/${dealId}/research-analysis/comprehensive/results`],
    refetchInterval: 2000,
    retry: false
  });

  // Debug logging for data structure
  React.useEffect(() => {
    if (comprehensiveResults) {
      console.log('🔬 Research results from agents endpoint:', comprehensiveResults);
      console.log('🔬 Has research answers:', !!(comprehensiveResults as any)?.analysis?.researchAnswers);
      console.log('🔬 Research answers keys:', Object.keys((comprehensiveResults as any)?.analysis?.researchAnswers || {}));
    }
  }, [comprehensiveResults]);

  // Add error boundary protection
  if (comprehensiveError) {
    console.error('Research tab error:', comprehensiveError);
    return (
      <div className="text-center p-8">
        <p className="text-red-400">Unable to load research analysis. Please refresh the page.</p>
      </div>
    );
  }

  // Add comprehensive null safety checks
  if (!dealId || !documents) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-400">Loading research analysis...</p>
      </div>
    );
  }
  
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
    try {
      console.log('📄 Document clicked:', documentName);
      if (!documents || !Array.isArray(documents)) {
        console.warn('Documents array not available');
        return;
      }
      
      // Find the document and open it
      const document = documents.find(doc => doc && doc.name === documentName);
      if (document && document.id) {
        // Open document viewer or download
        window.open(`/api/documents/${document.id}/download`, '_blank');
      } else {
        console.warn('Document not found:', documentName);
      }
    } catch (error) {
      console.error('Error handling document click:', error);
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
    // First try comprehensive results from working endpoint
    if (comprehensiveResults && typeof comprehensiveResults === 'object' && 'analysis' in comprehensiveResults && 
        (comprehensiveResults as any).analysis?.researchAnswers?.[questionId]) {
      const answer = (comprehensiveResults as any).analysis.researchAnswers[questionId];
      return {
        answer: answer.answer || 'No analysis available',
        confidence: answer.confidence || 0,
        sources: Array.isArray(answer.sources) ? answer.sources : answer.sources ? [answer.sources] : [],
        quotes: answer.quotes || [],
        keyFindings: answer.keyFindings || [],
        evidenceSummary: answer.evidenceSummary || '',
        researchAssessment: answer.researchAssessment || '',
        recommendations: answer.recommendations || [],
        detailedEvidence: answer.detailedEvidence || []
      };
    }
    
    // Fallback to analysisData
    if (!analysisData) return null;
    
    // First try to get answer from researchAnswers structure
    if (analysisData.researchAnswers && analysisData.researchAnswers[questionId]) {
      const answer = analysisData.researchAnswers[questionId];
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

  try {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between bg-gradient-to-r from-cyan-500/5 to-cyan-600/5 border border-cyan-500/20 rounded-lg p-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Comprehensive Research Analysis</h3>
            <p className="text-gray-300 text-sm">
              Analyze {assignedDocuments || 0} research documents across 4 categories with 11 detailed questions
            </p>
          </div>
          <ComprehensiveResearchAnalysisButton dealId={dealId} />
        </div>



      {Object.entries(categorizedQuestions).map(([category, questions]) => (
        <div key={category} className="border border-dark-lighter rounded-lg overflow-hidden">
          <div 
            className="flex items-center justify-between p-4 bg-dark-light hover:bg-dark cursor-pointer transition-colors"
            onClick={() => toggleCategory(category)}
          >
            <h4 className="font-medium text-white">{category}</h4>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-gray-400 border-gray-600">
                {questions.length} questions
              </Badge>
              {expandedCategories.has(category) ? (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </div>
          
          {expandedCategories.has(category) && (
            <div className="border-t border-dark-lighter">
              {questions.map(question => {
                const answer = getAnswerForQuestion(question.id);

                return (
                  <div key={question.id} className="p-4 border-b border-dark-lighter last:border-b-0">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-white mb-2">{question.question}</p>
                          
                          {answer ? (
                            <div className="mt-3 space-y-3">
                              <div className="bg-dark/50 rounded p-3">
                                <h5 className="text-xs font-medium text-cyan-400 mb-2">Research Analysis</h5>
                                <p className="text-gray-300 text-sm leading-relaxed">{answer.answer}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-cyan-400 border-cyan-400">
                                  Confidence: {answer.confidence}%
                                </Badge>
                                {answer.sources && answer.sources.length > 0 && (
                                  <Badge 
                                    variant="outline" 
                                    className="text-blue-400 border-blue-400 cursor-pointer hover:bg-blue-400/10"
                                    onClick={() => {
                                      const sources = answer.sources.map((source: string) => ({
                                        documentName: source,
                                        relevantSections: [answer.answer || "No specific section identified"],
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
                                    {answer.sources.length} source{answer.sources.length > 1 ? "s" : ""}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 p-3 bg-gray-800/50 rounded border border-gray-700">
                              <p className="text-gray-400 text-xs">No research analysis available for this question yet.</p>
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
  } catch (error) {
    console.error('Error in ResearchQuestionsSection:', error);
    return (
      <div className="text-center p-8 bg-red-500/10 border border-red-500/20 rounded-lg">
        <p className="text-red-400">Research tab encountered an error. Please refresh the page.</p>
      </div>
    );
  }
}