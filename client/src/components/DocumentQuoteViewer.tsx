import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, ExternalLink, Quote, X } from 'lucide-react';

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
  const [selectedTab, setSelectedTab] = useState<'quotes' | 'sources'>('quotes');

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
      <DialogContent className="max-w-4xl max-h-[80vh] bg-dark-light border-dark-lighter">
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

        <div className="flex gap-2 mb-4">
          <Button
            variant={selectedTab === 'quotes' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTab('quotes')}
            className="flex items-center gap-2"
          >
            <Quote className="h-4 w-4" />
            Quotes ({quotes.length})
          </Button>
          <Button
            variant={selectedTab === 'sources' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTab('sources')}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Sources ({sources.length})
          </Button>
        </div>

        <ScrollArea className="h-[500px] w-full">
          {selectedTab === 'quotes' && (
            <div className="space-y-4">
              {quotes.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Quote className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No quotes available</p>
                </div>
              ) : (
                quotes.map((quote, index) => (
                  <div key={index} className="border border-dark-lighter rounded-lg p-4 bg-dark/30">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-400" />
                        <span className="font-medium text-white">{quote.documentName}</span>
                        {quote.pageNumber && (
                          <Badge variant="outline" className="text-xs">
                            Page {quote.pageNumber}
                          </Badge>
                        )}
                        {quote.lineNumber && (
                          <Badge variant="outline" className="text-xs">
                            Line {quote.lineNumber}
                          </Badge>
                        )}
                        {quote.confidence && (
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              quote.confidence > 0.8 ? 'text-green-400 border-green-400' :
                              quote.confidence > 0.6 ? 'text-yellow-400 border-yellow-400' :
                              'text-red-400 border-red-400'
                            }`}
                          >
                            {Math.round(quote.confidence * 100)}% confident
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDocumentClick(quote.documentName)}
                        className="h-8 w-8 p-0"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="bg-dark-lighter/50 rounded-lg p-3 mb-3">
                      <h4 className="text-sm font-medium text-gray-300 mb-2">Extracted Quote:</h4>
                      <blockquote className="text-white bg-dark/50 border-l-4 border-blue-400 pl-4 py-2 rounded-r">
                        "{quote.text}"
                      </blockquote>
                    </div>

                    {quote.context && (
                      <div className="bg-dark-lighter/30 rounded-lg p-3">
                        <h4 className="text-sm font-medium text-gray-300 mb-2">Context:</h4>
                        <p 
                          className="text-gray-300 text-sm leading-relaxed"
                          dangerouslySetInnerHTML={{ 
                            __html: highlightText(quote.context, quote.text) 
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {selectedTab === 'sources' && (
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
                            Evidence from Document:
                          </h4>
                          <p className="text-gray-300 text-sm leading-relaxed">
                            {section}
                          </p>
                        </div>
                      ))}

                      {source.extractedText && source.extractedText !== source.relevantSections[0] && (
                        <div className="bg-dark-lighter/30 rounded-lg p-3">
                          <h4 className="text-sm font-medium text-gray-300 mb-2">Additional Context:</h4>
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
          )}
        </ScrollArea>

        <div className="border-t border-dark-lighter my-4"></div>
        
        <div className="flex justify-between items-center text-sm text-gray-400">
          <span>
            {selectedTab === 'quotes' ? quotes.length : sources.length} {selectedTab} found
          </span>
          <span>
            Click <ExternalLink className="inline h-3 w-3" /> to view full document
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}