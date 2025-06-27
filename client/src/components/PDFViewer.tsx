import { useState, useEffect } from 'react';
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
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [viewMethod, setViewMethod] = useState<'object' | 'iframe' | 'dataurl'>('object');

  // Reset states when dialog opens
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      setError(null);
      setRetryCount(0);
      setPdfDataUrl(null);
      setViewMethod('object');
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
    setPdfDataUrl(null);
    
    // Try different methods on retry
    if (retryCount === 0) {
      setViewMethod('iframe');
    } else if (retryCount === 1) {
      setViewMethod('dataurl');
      loadDataUrl();
    } else {
      setViewMethod('object');
    }
  };

  const loadDataUrl = async () => {
    try {
      console.log(`🔄 Loading PDF as data URL: ${documentName}`);
      const response = await fetch(`/api/documents/${documentId}/download?dataUrl=true`);
      const data = await response.json();
      
      if (data.success && data.dataUrl) {
        console.log(`✅ Data URL loaded successfully: ${data.filename} (${data.size} bytes)`);
        setPdfDataUrl(data.dataUrl);
        setIsLoading(false);
        setError(null);
      } else {
        throw new Error('Failed to generate data URL');
      }
    } catch (error) {
      console.error('❌ Data URL loading failed:', error);
      setError('Failed to load PDF. Please try downloading the file.');
      setIsLoading(false);
    }
  };

  const handleLoad = () => {
    console.log(`PDF loaded successfully: ${documentName} (method: ${viewMethod})`);
    setIsLoading(false);
    setError(null);
  };

  const handleError = () => {
    console.error(`PDF load error for ${documentName} (method: ${viewMethod})`);
    
    // Auto-retry with different methods
    if (viewMethod === 'object' && retryCount === 0) {
      console.log('🔄 Retrying with iframe method...');
      setViewMethod('iframe');
      setRetryCount(1);
      return;
    }
    
    if (viewMethod === 'iframe' && retryCount === 1) {
      console.log('🔄 Retrying with data URL method...');
      setViewMethod('dataurl');
      setRetryCount(2);
      loadDataUrl();
      return;
    }
    
    setIsLoading(false);
    setError('Unable to display PDF in browser. Chrome may be blocking the viewer. Please download or open in new tab.');
  };

  const renderContent = () => {
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-white bg-gray-900">
          <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2 text-white">PDF Display Issue</h3>
          <p className="text-gray-300 mb-6 text-center max-w-md">{error}</p>
          <div className="flex gap-3">
            <Button 
              onClick={handleRetry} 
              variant="outline" 
              className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button 
              onClick={handleDownload} 
              variant="outline" 
              className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button 
              onClick={handleOpenInNewTab} 
              variant="outline" 
              className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
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
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
            <div className="flex flex-col items-center text-white">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mb-4"></div>
              <p>Loading PDF...</p>
              <p className="text-sm text-gray-400 mt-1">Method: {viewMethod} (Attempt {retryCount + 1})</p>
            </div>
          </div>
        )}
        
        {/* Data URL method (Chrome bypass) */}
        {viewMethod === 'dataurl' && pdfDataUrl && (
          <iframe
            src={pdfDataUrl}
            className="w-full h-full border-0"
            title={documentName}
            style={{ backgroundColor: '#1f2937' }}
          />
        )}
        
        {/* Object method (default) */}
        {viewMethod === 'object' && (
          <object
            data={`/api/documents/${documentId}/download?view=inline&t=${Date.now()}&retry=${retryCount}`}
            type="application/pdf"
            className="w-full h-full"
            onLoad={handleLoad}
            onError={handleError}
          >
            <div className="flex items-center justify-center h-full text-white">
              <p>PDF loading failed. Trying alternative method...</p>
            </div>
          </object>
        )}
        
        {/* Iframe method (fallback) */}
        {viewMethod === 'iframe' && (
          <iframe
            src={`/api/documents/${documentId}/download?view=inline&t=${Date.now()}&retry=${retryCount}`}
            className="w-full h-full border-0"
            title={documentName}
            onLoad={handleLoad}
            onError={handleError}
            style={{ backgroundColor: '#1f2937' }}
          />
        )}
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
                disabled={isLoading}
                className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Try Again
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
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Simple PDF preview component for document cards
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
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
      
      {hasError ? (
        <div className="flex items-center justify-center h-full min-h-[200px] text-gray-500">
          <div className="text-center">
            <Eye className="w-12 h-12 mx-auto mb-2" />
            <p className="text-sm">Click to View PDF</p>
          </div>
        </div>
      ) : (
        <object
          data={`/api/documents/${documentId}/download?view=inline&preview=true`}
          type="application/pdf"
          className="w-full h-full min-h-[200px]"
          onLoad={handleLoad}
          onError={handleError}
        >
          <div className="flex items-center justify-center h-full min-h-[200px] text-gray-500">
            <div className="text-center">
              <Eye className="w-12 h-12 mx-auto mb-2" />
              <p className="text-sm">Click to View PDF</p>
            </div>
          </div>
        </object>
      )}
    </div>
  );
}