import { Badge } from '@/components/ui/badge';
import { FileText, Brain, Search } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SectionInfoBadgeProps {
  sources: {
    ocrDocuments?: string[];
    aiSummaries?: string[];
    agentAnalyses?: string[];
  };
}

export function SectionInfoBadge({ sources }: SectionInfoBadgeProps) {
  const totalSources = (sources.ocrDocuments?.length || 0) + 
                      (sources.aiSummaries?.length || 0) + 
                      (sources.agentAnalyses?.length || 0);

  if (totalSources === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex gap-1">
            {sources.ocrDocuments && sources.ocrDocuments.length > 0 && (
              <Badge variant="outline" className="text-xs bg-blue-500/10 border-blue-400 text-blue-300">
                <FileText className="w-3 h-3 mr-1" />
                {sources.ocrDocuments.length} OCR
              </Badge>
            )}
            {sources.aiSummaries && sources.aiSummaries.length > 0 && (
              <Badge variant="outline" className="text-xs bg-green-500/10 border-green-400 text-green-300">
                <Brain className="w-3 h-3 mr-1" />
                {sources.aiSummaries.length} AI
              </Badge>
            )}
            {sources.agentAnalyses && sources.agentAnalyses.length > 0 && (
              <Badge variant="outline" className="text-xs bg-purple-500/10 border-purple-400 text-purple-300">
                <Search className="w-3 h-3 mr-1" />
                {sources.agentAnalyses.length} Agent
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-md">
          <div className="space-y-2">
            {sources.ocrDocuments && sources.ocrDocuments.length > 0 && (
              <div>
                <p className="font-medium text-blue-300">OCR Documents ({sources.ocrDocuments.length}):</p>
                <ul className="text-xs text-slate-300 list-disc list-inside max-h-32 overflow-y-auto">
                  {sources.ocrDocuments.slice(0, 10).map((doc, i) => (
                    <li key={i} className="truncate">{doc}</li>
                  ))}
                  {sources.ocrDocuments.length > 10 && (
                    <li className="text-slate-400">...and {sources.ocrDocuments.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}
            {sources.aiSummaries && sources.aiSummaries.length > 0 && (
              <div>
                <p className="font-medium text-green-300">AI Summaries ({sources.aiSummaries.length}):</p>
                <ul className="text-xs text-slate-300 list-disc list-inside">
                  {sources.aiSummaries.slice(0, 5).map((summary, i) => (
                    <li key={i} className="truncate">{summary}</li>
                  ))}
                  {sources.aiSummaries.length > 5 && (
                    <li className="text-slate-400">...and {sources.aiSummaries.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}
            {sources.agentAnalyses && sources.agentAnalyses.length > 0 && (
              <div>
                <p className="font-medium text-purple-300">Agent Analyses ({sources.agentAnalyses.length}):</p>
                <ul className="text-xs text-slate-300 list-disc list-inside">
                  {sources.agentAnalyses.map((agent, i) => (
                    <li key={i}>{agent}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}