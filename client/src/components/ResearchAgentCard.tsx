// @ts-nocheck
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Play, CheckCircle, ChevronDown, ChevronUp, Search, BookOpen, BarChart3, Users, Lightbulb, Target } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DocumentQuoteViewer from './DocumentQuoteViewer';

interface ResearchAgentCardProps {
  dealId: number;
  documents?: any[];
  currentProgress?: number;
  currentDocumentName?: string;
}

export default function ResearchAgentCard({ 
  dealId, 
  documents = [],
  currentProgress = 0,
  currentDocumentName
}: ResearchAgentCardProps) {
  const [isRunningAnalysis, setIsRunningAnalysis] = useState(false);
  const [quoteViewerOpen, setQuoteViewerOpen] = useState(false);
  const [selectedQuoteData, setSelectedQuoteData] = useState<{
    quotes?: any[];
    sources?: any[];
    title: string;
  }>({ quotes: [], sources: [], title: '' });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  
  const queryClient = useQueryClient();

  // Get Research agent documents (documents assigned to Research agent)
  const researchDocs = documents.filter(doc => 
    doc.assignedAgents && 
    Array.isArray(doc.assignedAgents) && 
    doc.assignedAgents.some((agent: string) => agent.toLowerCase() === 'research')
  );

  // Fetch background job progress
  const { data: jobProgress } = useQuery({
    queryKey: [`/api/background-jobs/${dealId}`],
    refetchInterval: 2000, // Poll every 2 seconds
  });

  // Find current Research job
  const currentJob = jobProgress?.jobs?.find((job: any) => 
    job.agentType === 'research' || 
    job.jobId?.includes('research-analysis') ||
    job.jobId?.includes('research')
  );

  // Fetch Research analysis results
  const { data: researchAnalysisData, refetch: refetchAnalysis } = useQuery({
    queryKey: [`/api/deals/${dealId}/agents/research/results`],
    refetchInterval: currentJob?.status === 'processing' ? 3000 : 30000, // Faster polling during processing
  });

  // Start Research analysis mutation
  const startAnalysisMutation = useMutation({
    mutationFn: async () => {
      console.log('🔬 Starting Research agent comprehensive analysis...');
      setIsRunningAnalysis(true);
      
      const response = await apiRequest(`/api/deals/${dealId}/research-analysis/comprehensive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      return response;
    },
    onSuccess: (data) => {
      console.log('✅ Research analysis started successfully:', data);
      
      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: [`/api/background-jobs/${dealId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/agents/research/results`] });
      
      setTimeout(() => {
        setIsRunningAnalysis(false);
      }, 2000);
    },
    onError: (error) => {
      console.error('❌ Error starting Research analysis:', error);
      setIsRunningAnalysis(false);
    }
  });

  // Get analysis data
  const analysisData = researchAnalysisData?.analysis || {};
  
  // Research questions from the analysis
  const researchQuestions = analysisData?.researchAnswers || {};
  
  // Calculate analysis status
  const hasAnalysis = Object.keys(researchQuestions).length > 0;
  const isProcessing = currentJob?.status === 'processing' || isRunningAnalysis;
  const progress = currentJob?.progress || currentProgress || 0;

  // Toggle section expansion
  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // Open quote viewer
  const openQuoteViewer = (title: string, evidence: any[] = []) => {
    setSelectedQuoteData({
      title,
      quotes: evidence.filter(e => e.quote),
      sources: evidence.filter(e => e.source),
      title
    });
    setQuoteViewerOpen(true);
  };

  // Render confidence badge
  const renderConfidenceBadge = (confidence: string | number) => {
    const confValue = typeof confidence === 'string' ? parseFloat(confidence) : confidence;
    const confPercent = Math.round(confValue * 100);
    
    let badgeClass = 'bg-gray-500';
    if (confPercent >= 80) badgeClass = 'bg-green-500';
    else if (confPercent >= 60) badgeClass = 'bg-yellow-500';
    else if (confPercent >= 40) badgeClass = 'bg-orange-500';
    else badgeClass = 'bg-red-500';
    
    return (
      <Badge className={`${badgeClass} text-white text-xs`}>
        {confPercent}% confidence
      </Badge>
    );
  };

  // Render evidence list
  const renderEvidence = (evidence: any[] = [], maxShow: number = 3) => {
    if (!evidence || evidence.length === 0) return null;
    
    const visibleEvidence = evidence.slice(0, maxShow);
    const hasMore = evidence.length > maxShow;
    
    return (
      <div className="mt-2 space-y-1">
        {visibleEvidence.map((item, idx) => (
          <div key={idx} className="text-sm bg-gray-800 p-2 rounded border-l-2 border-blue-500">
            <div className="text-gray-300 italic">"{item.quote || item.insight}"</div>
            {item.source && (
              <div className="text-xs text-gray-500 mt-1">📄 {item.source}</div>
            )}
          </div>
        ))}
        {hasMore && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => openQuoteViewer('Supporting Evidence', evidence)}
            className="text-blue-400 hover:text-blue-300"
          >
            View {evidence.length - maxShow} more evidence →
          </Button>
        )}
      </div>
    );
  };

  // Render expandable section
  const renderExpandableSection = (key: string, title: string, icon: any, questionData: any) => {
    const Icon = icon;
    const isExpanded = expandedSections[key];
    
    return (
      <div key={key} className="border border-gray-700 rounded-lg">
        <button
          onClick={() => toggleSection(key)}
          className="w-full p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-between"
        >
          <div className="flex items-center space-x-2">
            <Icon className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-white">{title}</span>
          </div>
          {isExpanded ? 
            <ChevronUp className="w-4 h-4 text-gray-400" /> : 
            <ChevronDown className="w-4 h-4 text-gray-400" />
          }
        </button>
        {isExpanded && (
          <div className="p-3 bg-gray-900 rounded-b-lg">
            <p className="text-sm text-gray-300 mb-2">
              {questionData?.answer || 'No analysis available for this question'}
            </p>
            {questionData?.confidence && renderConfidenceBadge(questionData.confidence)}
            {renderEvidence(questionData?.evidence)}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="bg-dark-light border-dark-lighter">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-900/30 rounded-lg">
              <Search className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-white flex items-center space-x-2">
                <span>Research Agent</span>
                {isProcessing && (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <span className="text-sm text-blue-400">{progress}%</span>
                  </div>
                )}
              </CardTitle>
              <p className="text-sm text-gray-400 mt-1">
                Scientific & Technical Analysis • {researchDocs.length} documents assigned
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {hasAnalysis && (
              <Badge className="bg-green-900/50 text-green-400 border-green-700">
                <CheckCircle className="w-3 h-3 mr-1" />
                Analysis Complete
              </Badge>
            )}
            
            <Button
              onClick={() => startAnalysisMutation.mutate()}
              disabled={isProcessing || startAnalysisMutation.isPending}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1" />
                  Run Research Analysis
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress indicator */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Research Analysis Progress</span>
              <span className="text-blue-400">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            {currentDocumentName && (
              <p className="text-xs text-gray-500">
                Current: {currentDocumentName}
              </p>
            )}
          </div>
        )}

        {/* Analysis Results */}
        {hasAnalysis ? (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <span>Research Analysis Results</span>
            </h3>
            
            <div className="space-y-3">
              {/* Key Research Areas */}
              {researchQuestions['research_methodology'] && 
                renderExpandableSection('methodology', 'Research Methodology', BookOpen, researchQuestions['research_methodology'])
              }
              
              {researchQuestions['technical_innovation'] && 
                renderExpandableSection('innovation', 'Technical Innovation', Lightbulb, researchQuestions['technical_innovation'])
              }
              
              {researchQuestions['research_partnerships'] && 
                renderExpandableSection('partnerships', 'Research Partnerships', Users, researchQuestions['research_partnerships'])
              }

              {/* Additional Research Questions */}
              {Object.entries(researchQuestions).map(([key, questionData]: [string, any]) => {
                if (['research_methodology', 'technical_innovation', 'research_partnerships'].includes(key)) {
                  return null; // Already shown above
                }
                
                const questionTitle = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                
                return renderExpandableSection(key, questionTitle, Target, questionData);
              })}
            </div>
          </div>
        ) : !isProcessing ? (
          <div className="text-center py-8">
            <Search className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No Research Analysis Available</h3>
            <p className="text-gray-400 mb-4">
              Start the Research analysis to explore scientific methodology, technical innovation, and research partnerships.
            </p>
            <Button
              onClick={() => startAnalysisMutation.mutate()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Research Analysis
            </Button>
          </div>
        ) : null}

        {/* Document Assignment Summary */}
        <div className="mt-6 p-4 bg-gray-800 rounded-lg">
          <h4 className="text-sm font-medium text-white mb-2 flex items-center space-x-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <span>Research Document Coverage</span>
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Assigned Documents:</span>
              <span className="text-white ml-2 font-medium">{researchDocs.length}</span>
            </div>
            <div>
              <span className="text-gray-400">Analysis Status:</span>
              <span className={`ml-2 font-medium ${hasAnalysis ? 'text-green-400' : 'text-gray-400'}`}>
                {hasAnalysis ? 'Complete' : 'Pending'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Quote Viewer Dialog */}
      <Dialog open={quoteViewerOpen} onOpenChange={setQuoteViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedQuoteData.title}</DialogTitle>
          </DialogHeader>
          <DocumentQuoteViewer
            quotes={selectedQuoteData.quotes || []}
            sources={selectedQuoteData.sources || []}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}