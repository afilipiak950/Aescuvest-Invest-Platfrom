import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bot, FileText, TrendingUp, AlertTriangle, Play, CheckCircle, XCircle, AlertCircle, RefreshCw, HelpCircle, ChevronDown, ChevronUp, ChevronRight, Zap } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface EnhancedAgentCardProps {
  dealId: number;
  agentType: string;
  analysis?: any;
  isLoading?: boolean;
  documents?: any[];
  isRunningAllAnalyses?: boolean;
  currentProgress?: number;
  currentDocumentName?: string;
  onClinicalAnalysisStart?: () => void;
}

export default function EnhancedAgentCard({ 
  dealId, 
  agentType, 
  analysis, 
  isLoading, 
  documents, 
  isRunningAllAnalyses,
  currentProgress = 0,
  currentDocumentName,
  onClinicalAnalysisStart
}: EnhancedAgentCardProps) {
  const [isRunningAnalysis, setIsRunningAnalysis] = useState(false);
  const [quoteViewerOpen, setQuoteViewerOpen] = useState(false);
  const [selectedQuoteData, setSelectedQuoteData] = useState<{
    quotes?: any[];
    sources?: any[];
    title: string;
  }>({ quotes: [], sources: [], title: '' });

  // Simple component load validation
  useEffect(() => {
    console.log(`✅ EnhancedAgentCard loaded successfully for ${agentType} agent`);
  }, [agentType]);

  // Get basic analysis info
  const findings = analysis?.findings || [];
  const recommendations = analysis?.recommendations || [];
  const assignedDocuments = analysis?.assignedDocuments || 0;

  return (
    <Card className="bg-dark border-dark-lighter">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          {agentType} Agent
          {findings.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {findings.length} findings
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Analysis Status */}
        {isLoading || isRunningAnalysis ? (
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
              <div className="flex-1">
                <p className="text-blue-400 font-medium">Analysis in Progress</p>
                <p className="text-gray-300 text-sm">
                  {currentDocumentName || `Processing ${agentType.toLowerCase()} analysis...`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-white font-medium">{Math.round(currentProgress)}%</p>
              </div>
            </div>
            <Progress 
              value={currentProgress} 
              className="h-2 bg-dark-lighter mt-3"
            />
          </div>
        ) : findings.length > 0 ? (
          <div className="space-y-3">
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
              <div className="text-green-400 mb-2">Analysis Complete</div>
              <div className="text-gray-300 text-sm">
                Found {findings.length} findings and {recommendations.length} recommendations
              </div>
            </div>
            
            {/* Simple findings display */}
            <div className="space-y-2">
              <h4 className="text-white font-medium">Key Findings:</h4>
              {findings.slice(0, 3).map((finding: any, index: number) => (
                <div key={index} className="bg-dark-lighter rounded-lg p-3">
                  <p className="text-gray-200 text-sm">{finding.content || finding.description || finding.text}</p>
                </div>
              ))}
              {findings.length > 3 && (
                <div className="text-center">
                  <Button variant="ghost" size="sm">
                    View All {findings.length} Findings
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-gray-900/20 border border-gray-500/30 rounded-lg p-6 text-center">
            <div className="text-gray-400 mb-2">No Analysis Available</div>
            <div className="text-gray-300 text-sm">
              Run the {agentType.toLowerCase()} analysis to see results here
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-3"
              onClick={() => setIsRunningAnalysis(true)}
            >
              <Play className="h-4 w-4 mr-2" />
              Start Analysis
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}