// React imports removed - no longer needed for state management
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, ExternalLink, X } from 'lucide-react';

interface Quote {
  text: string;
  documentName: string;
  pageNumber?: number;
  lineNumber?: number;
  context?: string;
  confidence?: number;
}

interface Source {
  documentName: string;
  pageNumber?: number;
  relevantSections: string[];
  extractedText?: string;
}

interface DocumentQuoteViewerProps {
  isOpen: boolean;
  onClose: () => void;
  quotes?: Quote[];
  sources?: Source[];
  title: string;
  documents?: any[];
}

export default function DocumentQuoteViewer({
  isOpen,
  onClose,
  quotes = [],
  sources = [],
  title,
  documents = []
}: DocumentQuoteViewerProps) {

  const handleDocumentClick = (documentName: string) => {
    // Find the document by name
    const document = documents.find(doc => 
      doc.name === documentName || 
      doc.name.includes(documentName) || 
      documentName.includes(doc.name)
    );
    
    if (document) {
      // Open the document in a new tab for viewing
      window.open(`/api/documents/${document.id}/download?inline=true`, '_blank');
    } else {
      console.log(`Document "${documentName}" not found`);
    }
  };

  const highlightText = (text: string, quote: string) => {
    if (!quote) return text;
    
    const regex = new RegExp(`(${quote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 text-black px-1 rounded">$1</mark>');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] bg-dark-light border-dark-lighter" aria-describedby="document-evidence-description">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-xl font-semibold text-white">
            {title} - Document Evidence
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="mb-4">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-400" />
            Document Sources ({sources.length})
          </h3>
          <p id="document-evidence-description" className="text-sm text-gray-400 mt-1">
            Evidence extracted from documents to support the analysis findings
          </p>
        </div>

        <ScrollArea className="h-[500px] w-full">
          <div className="space-y-4">
              {sources.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No sources available</p>
                </div>
              ) : (
                sources.map((source, index) => (
                  <div key={index} className="border border-dark-lighter rounded-lg p-4 bg-dark/30">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-green-400" />
                        <span className="font-medium text-white">{source.documentName}</span>
                        {source.pageNumber && (
                          <Badge variant="outline" className="text-xs">
                            Page {source.pageNumber}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs text-green-400 border-green-400">
                          {source.relevantSections.length} section{source.relevantSections.length > 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDocumentClick(source.documentName)}
                        className="h-8 w-8 p-0"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {source.relevantSections.map((section, sectionIndex) => (
                        <div key={sectionIndex} className="bg-dark-lighter/50 rounded-lg p-3">
                          <h4 className="text-sm font-medium text-gray-300 mb-2">
                            Relevant Section {sectionIndex + 1}:
                          </h4>
                          <p className="text-gray-300 text-sm leading-relaxed">
                            {section}
                          </p>
                        </div>
                      ))}

                      {/* Only show Full Extract if it's different from relevant sections */}
                      {source.extractedText && 
                       !source.relevantSections.some(section => 
                         section.trim().toLowerCase() === source.extractedText.trim().toLowerCase()
                       ) && (
                        <div className="bg-dark-lighter/30 rounded-lg p-3">
                          <h4 className="text-sm font-medium text-gray-300 mb-2">Full Extract:</h4>
                          <p className="text-gray-300 text-sm leading-relaxed">
                            {source.extractedText}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
          </div>
        </ScrollArea>

        <div className="border-t border-dark-lighter my-4"></div>
        
        <div className="flex justify-between items-center text-sm text-gray-400">
          <span>
            {sources.length} sources found
          </span>
          <span>
            Click <ExternalLink className="inline h-3 w-3" /> to view full document
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}