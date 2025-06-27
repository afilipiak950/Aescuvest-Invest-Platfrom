import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  ExternalLink, 
  AlertCircle,
  RefreshCw
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
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Reset states when dialog opens
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      setError(null);
      setRetryCount(0);
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
    
    // Force iframe reload
    if (iframeRef.current) {
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = '';
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = `${currentSrc}&retry=${retryCount + 1}`;
        }
      }, 100);
    }
  };

  const handleIframeLoad = () => {
    console.log(`✅ PDF iframe loaded successfully: ${documentName} (ID: ${documentId})`);
    setIsLoading(false);
    setError(null);
    
    // Check if PDF loaded properly after a short delay
    setTimeout(() => {
      if (iframeRef.current) {
        try {
          const iframeDoc = iframeRef.current.contentDocument;
          if (iframeDoc) {
            const body = iframeDoc.body;
            const bodyText = body?.innerText || '';
            
            // Check for common error messages
            if (bodyText.includes('blocked') || 
                bodyText.includes('cannot be displayed') || 
                bodyText.includes('error') ||
                body?.children.length === 0) {
              console.log(`⚠️ PDF content blocked, showing fallback options`);
              setError('Browser security settings prevent PDF display');
              setIsLoading(false);
            }
          }
        } catch (e) {
          // CORS or security error - this is expected and means PDF is loading
          console.log(`📄 PDF loaded with security restrictions (normal behavior)`);
        }
      }
    }, 1000);
  };

  const handleIframeError = () => {
    console.error(`❌ PDF iframe error for ${documentName} (ID: ${documentId})`);
    setIsLoading(false);
    setError('Failed to load PDF document');
  };

  const renderPDFContent = () => {
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
              Try Again
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
      <div className="relative w-full h-full bg-gray-900">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
            <div className="flex flex-col items-center text-white">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
              <p>Loading PDF...</p>
              {retryCount > 0 && <p className="text-sm text-gray-400 mt-2">Attempt {retryCount + 1}</p>}
            </div>
          </div>
        )}
        
        <iframe
          ref={iframeRef}
          src={`/api/documents/${documentId}/download?view=inline&t=${Date.now()}&retry=${retryCount}`}
          className="w-full h-full border-0"
          title={documentName}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          style={{ 
            display: 'block',
            backgroundColor: '#1f2937'
          }}
          // Enhanced security and compatibility attributes
          sandbox="allow-same-origin allow-scripts"
          allow="fullscreen"
          loading="eager"
        />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-full h-[90vh] p-0 bg-gray-900 border-gray-700">
        <DialogHeader className="px-6 py-4 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-white truncate mr-4">
              {documentName}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleRetry}
                variant="outline"
                size="sm"
                className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={handleDownload}
                variant="outline"
                size="sm"
                className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button
                onClick={handleOpenInNewTab}
                variant="outline"
                size="sm"
                className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                New Tab
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1">
          {renderPDFContent()}
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
            <AlertCircle className="w-12 h-12 mx-auto mb-2" />
            <p className="text-sm">PDF Preview Unavailable</p>
          </div>
        </div>
      ) : (
        <iframe
          src={`/api/documents/${documentId}/download?view=inline&preview=true`}
          className="w-full h-full min-h-[200px] border-0"
          title={`Preview of ${documentName}`}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
          sandbox="allow-same-origin"
        />
      )}
    </div>
  );
}