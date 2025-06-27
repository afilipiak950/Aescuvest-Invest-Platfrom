import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Download, 
  ExternalLink,
  Maximize,
  AlertCircle
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
  const [fallbackMode, setFallbackMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  
  const handleDownload = () => {
    window.open(`/api/documents/${documentId}/download`, '_blank');
  };

  const handleOpenNewTab = () => {
    window.open(`/api/documents/${documentId}/download?view=inline`, '_blank');
  };

  const resetControls = () => {
    setZoom(1);
    setRotation(0);
  };

  const renderPDFContent = () => {
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-white">
          <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">PDF Viewing Error</h3>
          <p className="text-gray-300 text-center mb-4">{error}</p>
          <div className="flex gap-2">
            <Button onClick={handleDownload} variant="outline" className="text-white border-gray-600">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button onClick={handleOpenNewTab} variant="outline" className="text-white border-gray-600">
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in New Tab
            </Button>
          </div>
        </div>
      );
    }

    if (fallbackMode) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-white">
          <Maximize className="w-16 h-16 text-blue-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">PDF Ready for Viewing</h3>
          <p className="text-gray-300 text-center mb-4">
            The PDF is loaded and ready. Choose your preferred viewing method:
          </p>
          <div className="flex gap-2">
            <Button onClick={handleOpenNewTab} className="bg-blue-600 hover:bg-blue-700">
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in New Tab
            </Button>
            <Button onClick={handleDownload} variant="outline" className="text-white border-gray-600">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      );
    }

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
        
        <iframe
          src={`/api/documents/${documentId}/download?view=inline&t=${Date.now()}`}
          className="w-full h-full border-0"
          title={documentName}
          allow="fullscreen"
          onLoad={(e) => {
            console.log(`🔍 PDF IFRAME LOADED - Document: ${documentName} (ID: ${documentId})`);
            setIsLoading(false);
            setError(null);
            
            // Chrome security detection - check for blocked content
            setTimeout(() => {
              const iframe = e.currentTarget;
              try {
                // Test if we can access iframe content or if it's blocked
                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                if (!doc) {
                  console.log(`⚠️ Chrome blocked PDF access - enabling fallback mode`);
                  setFallbackMode(true);
                  return;
                }
                
                // Check if iframe shows Chrome's blocked content message
                const bodyText = doc.body?.innerText || '';
                if (bodyText.includes('blockiert') || bodyText.includes('blocked') || bodyText.includes('Diese Seite wurde von Chrome blockiert')) {
                  console.log(`🚫 Chrome security blocking detected - switching to fallback mode`);
                  setFallbackMode(true);
                  return;
                }
                
                // Check iframe dimensions for successful loading
                if (iframe.offsetWidth === 0 || iframe.offsetHeight === 0) {
                  console.log(`❌ Iframe dimensions invalid - enabling fallback`);
                  setFallbackMode(true);
                } else {
                  console.log(`✅ PDF iframe loaded successfully`);
                }
              } catch (err) {
                console.log(`⚠️ CORS/Security restriction detected - using fallback mode`);
                setFallbackMode(true);
              }
            }, 2000);
          }}
          onError={(e) => {
            console.error(`❌ PDF iframe error for ${documentName} (ID: ${documentId}):`, e);
            setIsLoading(false);
            setError('PDF konnte nicht im Iframe geladen werden');
          }}
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transformOrigin: 'center center'
          }}
        />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] p-0 bg-gray-900 border-gray-700">
        <DialogHeader className="p-4 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl text-white truncate max-w-md">
              {documentName}
            </DialogTitle>
            
            <div className="flex items-center gap-2">
              {/* Navigation Controls */}
              <div className="flex items-center gap-1 mr-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomOut}
                  className="text-white hover:bg-gray-700"
                  disabled={zoom <= 0.5}
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                
                <span className="text-white text-sm min-w-[4rem] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomIn}
                  className="text-white hover:bg-gray-700"
                  disabled={zoom >= 3}
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRotate}
                  className="text-white hover:bg-gray-700"
                >
                  <RotateCw className="w-4 h-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetControls}
                  className="text-white hover:bg-gray-700 text-xs"
                >
                  Reset
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenNewTab}
                  className="text-white hover:bg-gray-700"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  className="text-white hover:bg-gray-700"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {renderPDFContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InlinePDFPreview({ documentId, documentName, className = "" }: {
  documentId: number;
  documentName: string;
  className?: string;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded ${className}`}>
        <div className="text-center p-4">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Error loading PDF</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-gray-100 rounded overflow-hidden ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      )}
      
      <iframe
        src={`/api/documents/${documentId}/download?view=inline&t=${Date.now()}`}
        className="w-full h-full border-0"
        title={documentName}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setError('Failed to load PDF');
        }}
      />
    </div>
  );
}