import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  Maximize2,
  X
} from "lucide-react";

interface PDFViewerProps {
  documentId: number;
  documentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PDFViewer({ documentId, documentName, open, onOpenChange }: PDFViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/documents/${documentId}/download`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = documentName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  // Simple PDF viewer using browser's built-in PDF support
  const renderPDFViewer = () => {
    if (error) {
      return (
        <div className="flex items-center justify-center h-full bg-gray-900 text-white">
          <div className="text-center">
            <p className="text-lg mb-4">Fehler beim Laden des PDFs</p>
            <p className="text-sm text-gray-400">{error}</p>
            <Button onClick={handleDownload} className="mt-4">
              <Download className="h-4 w-4 mr-2" />
              Herunterladen
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="relative w-full h-full bg-gray-900">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
              <p>PDF wird geladen...</p>
            </div>
          </div>
        )}
        
        <iframe
          src={`/api/documents/${documentId}/download?view=inline&t=${Date.now()}`}
          className="w-full h-full border-0"
          title={documentName}
          allow="fullscreen"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          onLoad={(e) => {
            console.log(`📄 PDF iframe loaded: ${documentName} (ID: ${documentId})`);
            setIsLoading(false);
            
            // Reset error state on successful load
            setError(null);
            
            // Try to detect if PDF actually loaded
            setTimeout(() => {
              try {
                const iframe = e.currentTarget;
                if (iframe && iframe.contentWindow) {
                  // For PDF files, the browser typically shows the PDF viewer
                  console.log('📄 PDF viewer should be visible now');
                }
              } catch (err) {
                console.log('📄 PDF viewer security restrictions normal for cross-origin content');
              }
            }, 1000);
          }}
          onError={(e) => {
            console.error(`❌ PDF iframe error for ${documentName} (ID: ${documentId}):`, e);
            setIsLoading(false);
            setError('PDF konnte nicht geladen werden');
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
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1}
                  className="text-white hover:bg-gray-700"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <span className="text-sm text-gray-300 min-w-[80px] text-center">
                  {currentPage} / {totalPages}
                </span>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages}
                  className="text-white hover:bg-gray-700"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1 mr-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.5}
                  className="text-white hover:bg-gray-700"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                
                <span className="text-sm text-gray-300 min-w-[50px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomIn}
                  disabled={zoom >= 3.0}
                  className="text-white hover:bg-gray-700"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>

              {/* Action Controls */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRotate}
                className="text-white hover:bg-gray-700"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="text-white hover:bg-gray-700"
              >
                <Download className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-white hover:bg-gray-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {renderPDFViewer()}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Simplified PDF viewer for inline display in cards
export function InlinePDFPreview({ documentId, documentName, className = "" }: {
  documentId: number;
  documentName: string;
  className?: string;
}) {
  const [fullViewerOpen, setFullViewerOpen] = useState(false);

  return (
    <>
      <Card className={`cursor-pointer hover:shadow-lg transition-shadow ${className}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm truncate">{documentName}</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div 
            className="relative bg-gray-100 rounded aspect-[3/4] overflow-hidden"
            onClick={() => setFullViewerOpen(true)}
          >
            <iframe
              src={`/api/documents/${documentId}/download#page=1&zoom=50&toolbar=0&navpanes=0&scrollbar=0`}
              className="w-full h-full border-0 pointer-events-none"
              title={`${documentName} Preview`}
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all flex items-center justify-center">
              <Maximize2 className="h-6 w-6 text-white opacity-0 hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full mt-2"
            onClick={() => setFullViewerOpen(true)}
          >
            <Maximize2 className="h-4 w-4 mr-2" />
            Vollansicht
          </Button>
        </CardContent>
      </Card>

      <PDFViewer
        documentId={documentId}
        documentName={documentName}
        open={fullViewerOpen}
        onOpenChange={setFullViewerOpen}
      />
    </>
  );
}