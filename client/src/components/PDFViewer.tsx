import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  ExternalLink, 
  AlertCircle,
  RefreshCw,
  Eye
} from 'lucide-react';

interface PDFViewerProps {
  documentId: number;
  documentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PDFViewer({ documentId, documentName, open, onOpenChange }: PDFViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [viewMode, setViewMode] = useState<'iframe' | 'embed' | 'object'>('iframe');
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset states when dialog opens
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      setError(null);
      setRetryCount(0);
      setViewMode('iframe');
    }
  }, [open]);

  const handleDownload = () => {
    window.open(`/api/documents/${documentId}/download?attachment=true`, '_blank');
  };

  const handleOpenInNewTab = () => {
    window.open(`/api/documents/${documentId}/download?view=inline`, '_blank');
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setIsLoading(true);
    setError(null);
    
    // Cycle through different viewing modes
    if (viewMode === 'iframe') {
      setViewMode('embed');
    } else if (viewMode === 'embed') {
      setViewMode('object');
    } else {
      setViewMode('iframe');
    }
  };

  const handleLoadSuccess = () => {
    console.log(`PDF viewer loaded successfully: ${documentName} (Mode: ${viewMode})`);
    setIsLoading(false);
    setError(null);
  };

  const handleLoadError = () => {
    console.error(`PDF viewer error for ${documentName} (Mode: ${viewMode})`);
    setIsLoading(false);
    
    // Auto-try next viewing mode
    if (viewMode === 'iframe') {
      console.log('Iframe failed, trying embed...');
      setViewMode('embed');
      setIsLoading(true);
      setError(null);
    } else if (viewMode === 'embed') {
      console.log('Embed failed, trying object...');
      setViewMode('object');
      setIsLoading(true);
      setError(null);
    } else {
      setError('Unable to display PDF in browser. Use download or open in new tab.');
    }
  };

  const renderPDFViewer = () => {
    const pdfUrl = `/api/documents/${documentId}/download?view=inline&t=${Date.now()}&retry=${retryCount}`;
    
    if (viewMode === 'iframe') {
      return (
        <iframe
          src={pdfUrl}
          className="w-full h-full border-0"
          title={documentName}
          onLoad={handleLoadSuccess}
          onError={handleLoadError}
          sandbox="allow-same-origin allow-scripts allow-forms"
          allow="fullscreen"
          style={{ backgroundColor: '#f5f5f5' }}
        />
      );
    } else if (viewMode === 'embed') {
      return (
        <embed
          src={pdfUrl}
          type="application/pdf"
          className="w-full h-full"
          title={documentName}
          onLoad={handleLoadSuccess}
          onError={handleLoadError}
        />
      );
    } else {
      return (
        <object
          data={pdfUrl}
          type="application/pdf"
          className="w-full h-full"
          title={documentName}
          onLoad={handleLoadSuccess}
          onError={handleLoadError}
        >
          <div className="flex flex-col items-center justify-center h-full text-gray-600 bg-gray-100">
            <AlertCircle className="w-16 h-16 mb-4" />
            <p className="text-lg mb-4">PDF Plugin Required</p>
            <p className="text-sm text-center mb-6 max-w-md">
              Your browser doesn't have a built-in PDF viewer. Please download the file or open in a new tab.
            </p>
            <div className="flex gap-3">
              <Button onClick={handleDownload} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              <Button onClick={handleOpenInNewTab} variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in New Tab
              </Button>
            </div>
          </div>
        </object>
      );
    }
  };

  const renderContent = () => {
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-white bg-gray-800">
          <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">PDF Display Issue</h3>
          <p className="text-gray-300 mb-6 text-center max-w-md">{error}</p>
          <div className="flex gap-3">
            <Button 
              onClick={handleRetry} 
              variant="outline" 
              className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Different Method
            </Button>
            <Button 
              onClick={handleDownload} 
              variant="outline" 
              className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button 
              onClick={handleOpenInNewTab} 
              variant="outline" 
              className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in New Tab
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="relative w-full h-full bg-gray-50" ref={containerRef}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
            <div className="flex flex-col items-center text-gray-700">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p>Loading PDF...</p>
              <p className="text-sm text-gray-500 mt-2">Method: {viewMode}</p>
              {retryCount > 0 && <p className="text-sm text-gray-400 mt-1">Attempt {retryCount + 1}</p>}
            </div>
          </div>
        )}
        
        {renderPDFViewer()}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-full h-[90vh] p-0 bg-white border-gray-300">
        <DialogHeader className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-gray-900 truncate mr-4">
              {documentName}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 mr-2">
                Mode: {viewMode}
              </span>
              <Button
                onClick={handleRetry}
                variant="outline"
                size="sm"
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Try Again
              </Button>
              <Button
                onClick={handleDownload}
                variant="outline"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button
                onClick={handleOpenInNewTab}
                variant="outline"
                size="sm"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                New Tab
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Inline PDF preview component for document cards
export function InlinePDFPreview({ documentId, documentName, className = "" }: {
  documentId: number;
  documentName: string;
  className?: string;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <div className={`relative bg-gray-100 rounded-lg overflow-hidden ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
      
      {hasError ? (
        <div className="flex items-center justify-center h-full min-h-[200px] text-gray-500">
          <div className="text-center">
            <Eye className="w-12 h-12 mx-auto mb-2" />
            <p className="text-sm">Preview Available in Viewer</p>
          </div>
        </div>
      ) : (
        <iframe
          src={`/api/documents/${documentId}/download?view=inline&preview=true`}
          className="w-full h-full min-h-[200px] border-0"
          title={`Preview of ${documentName}`}
          onLoad={handleLoad}
          onError={handleError}
          sandbox="allow-same-origin"
        />
      )}
    </div>
  );
}