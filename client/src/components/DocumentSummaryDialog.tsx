import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Calendar, User, Target, AlertTriangle, TrendingUp, Brain } from 'lucide-react';

interface DocumentSummaryDialogProps {
  document: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentSummaryDialog({ document, open, onOpenChange }: DocumentSummaryDialogProps) {
  if (!document) return null;

  const aiSummary = document.aiSummary;
  const hasAISummary = aiSummary && aiSummary.executiveSummary;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-dark-light border-dark-lighter">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-white">
            <FileText className="h-5 w-5 text-primary" />
            {document.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Document Details */}
          <Card className="bg-dark border-dark-lighter">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-300">
                    Uploaded: {new Date(document.uploadedAt || document.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-300">
                    Size: {document.size ? `${(document.size / 1024).toFixed(1)} KB` : 'Unknown'}
                  </span>
                </div>
              </div>
              
              {document.description && (
                <p className="mt-3 text-gray-300">{document.description}</p>
              )}
            </CardContent>
          </Card>

          {/* AI Summary Status */}
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <span className="text-white font-medium">AI Analysis</span>
            <Badge 
              variant="outline" 
              className={
                document.aiSummaryStatus === 'completed' 
                  ? 'text-green-400 border-green-400/30 bg-green-500/10'
                  : document.aiSummaryStatus === 'processing'
                  ? 'text-yellow-400 border-yellow-400/30 bg-yellow-500/10'
                  : 'text-red-400 border-red-400/30 bg-red-500/10'
              }
            >
              {document.aiSummaryStatus || 'pending'}
            </Badge>
          </div>

          {hasAISummary ? (
            <div className="space-y-4">
              {/* Executive Summary */}
              {aiSummary.executiveSummary && (
                <Card className="bg-dark border-dark-lighter">
                  <CardContent className="p-4">
                    <h3 className="flex items-center gap-2 font-semibold text-white mb-3">
                      <FileText className="h-4 w-4 text-primary" />
                      Executive Summary
                    </h3>
                    <p className="text-gray-300 leading-relaxed">{aiSummary.executiveSummary}</p>
                  </CardContent>
                </Card>
              )}

              {/* Critical Findings */}
              {aiSummary.criticalFindings && aiSummary.criticalFindings.length > 0 && (
                <Card className="bg-dark border-dark-lighter">
                  <CardContent className="p-4">
                    <h3 className="flex items-center gap-2 font-semibold text-white mb-3">
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                      Critical Findings
                    </h3>
                    <ul className="space-y-2">
                      {aiSummary.criticalFindings.map((finding: string, index: number) => (
                        <li key={index} className="flex items-start gap-2 text-gray-300">
                          <span className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                          {finding}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Key Financial Data */}
              {aiSummary.keyFinancialData && aiSummary.keyFinancialData.length > 0 && (
                <Card className="bg-dark border-dark-lighter">
                  <CardContent className="p-4">
                    <h3 className="flex items-center gap-2 font-semibold text-white mb-3">
                      <TrendingUp className="h-4 w-4 text-green-400" />
                      Key Financial Data
                    </h3>
                    <ul className="space-y-2">
                      {aiSummary.keyFinancialData.map((data: string, index: number) => (
                        <li key={index} className="flex items-start gap-2 text-gray-300">
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0" />
                          {data}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Risk Assessment */}
              {aiSummary.riskAssessment && aiSummary.riskAssessment.length > 0 && (
                <Card className="bg-dark border-dark-lighter">
                  <CardContent className="p-4">
                    <h3 className="flex items-center gap-2 font-semibold text-white mb-3">
                      <Target className="h-4 w-4 text-orange-400" />
                      Risk Assessment
                    </h3>
                    <ul className="space-y-2">
                      {aiSummary.riskAssessment.map((risk: string, index: number) => (
                        <li key={index} className="flex items-start gap-2 text-gray-300">
                          <span className="w-1.5 h-1.5 bg-orange-400 rounded-full mt-2 flex-shrink-0" />
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Strategic Implications */}
              {aiSummary.strategicImplications && (
                <Card className="bg-dark border-dark-lighter">
                  <CardContent className="p-4">
                    <h3 className="flex items-center gap-2 font-semibold text-white mb-3">
                      <Brain className="h-4 w-4 text-primary" />
                      Strategic Implications
                    </h3>
                    <p className="text-gray-300 leading-relaxed">{aiSummary.strategicImplications}</p>
                  </CardContent>
                </Card>
              )}

              {/* Document Type & Confidence */}
              <Card className="bg-dark border-dark-lighter">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-gray-400">Document Type: </span>
                      <Badge variant="outline" className="text-blue-400 border-blue-400/30 bg-blue-500/10">
                        {aiSummary.documentType || 'Unknown'}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-gray-400">Confidence: </span>
                      <Badge 
                        variant="outline" 
                        className={
                          (aiSummary.confidenceScore || 0) > 0.8 
                            ? 'text-green-400 border-green-400/30 bg-green-500/10'
                            : (aiSummary.confidenceScore || 0) > 0.6
                            ? 'text-yellow-400 border-yellow-400/30 bg-yellow-500/10'
                            : 'text-red-400 border-red-400/30 bg-red-500/10'
                        }
                      >
                        {((aiSummary.confidenceScore || 0) * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="bg-dark border-dark-lighter">
              <CardContent className="p-6 text-center">
                <Brain className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-white mb-2">No AI Summary Available</h3>
                <p className="text-gray-400">
                  {document.aiSummaryStatus === 'processing' 
                    ? 'AI analysis is currently in progress...'
                    : document.aiSummaryStatus === 'failed'
                    ? 'AI analysis failed. Please try reprocessing this document.'
                    : 'This document has not been analyzed yet.'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}