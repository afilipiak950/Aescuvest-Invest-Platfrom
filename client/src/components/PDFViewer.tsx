import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  ExternalLink, 
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

// Pure iframe-based PDF viewer - no PDF.js dependencies

interface PDFViewerProps {
  documentId: number;
  documentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PDFViewer({ documentId, documentName, open, onOpenChange }: PDFViewerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Initialize iframe-based PDF viewing when dialog opens
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      setError(null);
      setFallbackMode(false);
      
      // Reset controls
      setZoom(1);
      setRotation(0);
      setCurrentPage(1);
      
      console.log(`📄 Loading PDF via iframe: ${documentName} (ID: ${documentId})`);
      
      // Set a reasonable timeout for iframe loading
      const timeout = setTimeout(() => {
        setIsLoading(false);
      }, 3000);
      
      return () => clearTimeout(timeout);
    }
  }, [open, documentId, documentName]);

  // Clean iframe-based approach - no PDF.js needed

  const handleDownload = () => {
    window.open(`/api/documents/${documentId}/download?attachment=true`, '_blank');
  };

  const handleOpenInNewTab = () => {
    window.open(`/api/documents/${documentId}/download?view=inline`, '_blank');
  };

  const renderPDFContent = () => {
    if (error && !fallbackMode) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-white bg-gray-800">
          <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">PDF Loading Error</h3>
          <p className="text-gray-300 mb-6 text-center max-w-md">{error}</p>
          <div className="flex gap-3">
            <Button onClick={handleDownload} variant="outline" className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button onClick={handleOpenInNewTab} variant="outline" className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600">
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in New Tab
            </Button>
          </div>
        </div>
      );
    }

    if (fallbackMode) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-white bg-gray-800">
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold mb-2">PDF Viewer Restricted</h3>
            <p className="text-gray-300 mb-4">Chrome security settings prevent inline PDF viewing.</p>
            <p className="text-sm text-gray-400">Use the options below to view the PDF:</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleDownload} variant="outline" className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button onClick={handleOpenInNewTab} variant="outline" className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600">
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in New Tab
            </Button>
          </div>
        </div>
      );
    }

    // Chrome-compatible PDF viewer with multiple fallback strategies
    return (
      <div className="relative w-full h-full overflow-auto bg-gray-800">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
            <div className="flex flex-col items-center text-white">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
              <p>Loading PDF...</p>
            </div>
          </div>
        )}
        
        {/* Primary: HTML object tag for better Chrome compatibility */}
        <object
          data={`/api/documents/${documentId}/download?view=inline&t=${Date.now()}`}
          type="application/pdf"
          className="w-full h-full"
          onLoad={() => {
            console.log(`✅ PDF object loaded successfully: ${documentName} (ID: ${documentId})`);
            setIsLoading(false);
            setError(null);
          }}
          onError={() => {
            console.log(`⚠️ PDF object failed, trying iframe fallback`);
            setIsLoading(false);
            // Try iframe as secondary approach
            setFallbackMode(false);
          }}
        >
          {/* Secondary: iframe fallback when object fails */}
          <iframe
            ref={iframeRef}
            src={`/api/documents/${documentId}/download?view=inline&t=${Date.now()}`}
            className="w-full h-full border-0"
            title={documentName}
            onLoad={(e) => {
              console.log(`✅ PDF iframe fallback loaded: ${documentName} (ID: ${documentId})`);
              setIsLoading(false);
              setError(null);
              
              // Chrome security detection with improved handling
              setTimeout(() => {
                const iframe = e.currentTarget;
                try {
                  const doc = iframe.contentDocument || iframe.contentWindow?.document;
                  if (!doc || doc.body?.innerText?.includes('blocked')) {
                    console.log(`⚠️ Chrome security detected, enabling fallback buttons`);
                    setFallbackMode(true);
                  } else {
                    console.log(`📄 PDF displayed successfully in iframe fallback`);
                  }
                } catch (err) {
                  console.log(`🔒 CORS restriction detected, showing fallback options`);
                  setFallbackMode(true);
                }
              }, 1500);
            }}
            onError={(e) => {
              console.error(`❌ PDF iframe fallback error for ${documentName} (ID: ${documentId}):`, e);
              setIsLoading(false);
              setError('Could not load PDF in viewer');
              setFallbackMode(true);
            }}
          />
          
          {/* Tertiary: Embedded fallback message */}
          <div className="flex flex-col items-center justify-center h-full text-white bg-gray-800 p-8">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold mb-2">PDF Viewer Not Available</h3>
              <p className="text-gray-300 mb-4">Your browser settings prevent inline PDF viewing.</p>
              <p className="text-sm text-gray-400">Use the options below to view the PDF:</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handleDownload}
                className="bg-gray-700 border border-gray-600 text-white hover:bg-gray-600 px-4 py-2 rounded-md flex items-center gap-2"
              >
                <span>↓</span> Download PDF
              </button>
              <button 
                onClick={handleOpenInNewTab}
                className="bg-gray-700 border border-gray-600 text-white hover:bg-gray-600 px-4 py-2 rounded-md flex items-center gap-2"
              >
                <span>↗</span> Open in New Tab
              </button>
            </div>
          </div>
        </object>
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
        
        <div className="flex-1 flex flex-col">
          <div className="flex-1">
            {renderPDFContent()}
          </div>
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
        />
      )}
    </div>
  );
}