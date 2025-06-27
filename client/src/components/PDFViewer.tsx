import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  ExternalLink, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw
} from 'lucide-react';

// Custom PDF.js viewer that bypasses Chrome restrictions

interface PDFViewerProps {
  documentId: number;
  documentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PDFViewer({ documentId, documentName, open, onOpenChange }: PDFViewerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [renderingPage, setRenderingPage] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load PDF.js worker and document
  useEffect(() => {
    if (!open) return;
    
    let mounted = true;
    
    const loadPDF = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Import PDF.js dynamically
        const pdfjsLib = await import('pdfjs-dist');
        
        // Set worker path
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
        
        console.log(`📄 Loading PDF document: ${documentName} (ID: ${documentId})`);
        
        // Fetch PDF as ArrayBuffer
        const response = await fetch(`/api/documents/${documentId}/download?view=inline&t=${Date.now()}`, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        console.log(`📄 PDF data fetched: ${arrayBuffer.byteLength} bytes`);
        
        // Load PDF document
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        if (!mounted) return;
        
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
        
        console.log(`✅ PDF loaded successfully: ${pdf.numPages} pages`);
        
        // Render first page
        await renderPage(pdf, 1, zoom, rotation);
        
      } catch (err) {
        console.error('❌ PDF loading error:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load PDF');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    
    loadPDF();
    
    return () => {
      mounted = false;
    };
  }, [open, documentId, documentName]);

  // Render specific page
  const renderPage = async (pdf: any, pageNum: number, scale: number = 1.0, rotate: number = 0) => {
    if (!pdf || !canvasRef.current) return;
    
    try {
      setRenderingPage(true);
      
      const page = await pdf.getPage(pageNum);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      // Calculate viewport with scale and rotation
      const viewport = page.getViewport({ scale, rotation: rotate });
      
      // Set canvas dimensions
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      // Clear previous content
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // Render page
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      console.log(`📄 Rendered page ${pageNum}/${totalPages} at ${Math.round(scale * 100)}% zoom`);
      
    } catch (err) {
      console.error(`❌ Error rendering page ${pageNum}:`, err);
      setError(`Failed to render page ${pageNum}`);
    } finally {
      setRenderingPage(false);
    }
  };

  // Handle page navigation
  const goToPage = async (pageNum: number) => {
    if (!pdfDoc || pageNum < 1 || pageNum > totalPages) return;
    
    setCurrentPage(pageNum);
    await renderPage(pdfDoc, pageNum, zoom, rotation);
  };

  // Handle zoom
  const handleZoom = async (newZoom: number) => {
    if (!pdfDoc) return;
    
    const clampedZoom = Math.min(Math.max(newZoom, 0.5), 3.0);
    setZoom(clampedZoom);
    await renderPage(pdfDoc, currentPage, clampedZoom, rotation);
  };

  // Handle rotation
  const handleRotation = async () => {
    if (!pdfDoc) return;
    
    const newRotation = (rotation + 90) % 360;
    setRotation(newRotation);
    await renderPage(pdfDoc, currentPage, zoom, newRotation);
  };

  const handleDownload = () => {
    window.open(`/api/documents/${documentId}/download?attachment=true`, '_blank');
  };

  const handleOpenInNewTab = () => {
    window.open(`/api/documents/${documentId}/download?view=inline`, '_blank');
  };

  const renderPDFContent = () => {
    if (error) {
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

    return (
      <div className="flex flex-col h-full bg-gray-800">
        {/* PDF Controls */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-700 border-b border-gray-600">
          <div className="flex items-center gap-2">
            <Button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1 || renderingPage}
              variant="outline"
              size="sm"
              className="bg-gray-600 border-gray-500 text-white hover:bg-gray-500"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <span className="text-white text-sm px-3">
              {currentPage} / {totalPages}
            </span>
            
            <Button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages || renderingPage}
              variant="outline"
              size="sm"
              className="bg-gray-600 border-gray-500 text-white hover:bg-gray-500"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={() => handleZoom(zoom - 0.25)}
              disabled={zoom <= 0.5 || renderingPage}
              variant="outline"
              size="sm"
              className="bg-gray-600 border-gray-500 text-white hover:bg-gray-500"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            
            <span className="text-white text-sm px-2">
              {Math.round(zoom * 100)}%
            </span>
            
            <Button
              onClick={() => handleZoom(zoom + 0.25)}
              disabled={zoom >= 3.0 || renderingPage}
              variant="outline"
              size="sm"
              className="bg-gray-600 border-gray-500 text-white hover:bg-gray-500"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            
            <Button
              onClick={handleRotation}
              disabled={renderingPage}
              variant="outline"
              size="sm"
              className="bg-gray-600 border-gray-500 text-white hover:bg-gray-500"
            >
              <RotateCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* PDF Canvas Container */}
        <div ref={containerRef} className="flex-1 overflow-auto bg-gray-900 p-4">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                <p>Loading PDF...</p>
              </div>
            </div>
          )}
          
          {renderingPage && !isLoading && (
            <div className="flex items-center justify-center py-4">
              <div className="flex items-center text-white">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-2"></div>
                <span>Rendering page...</span>
              </div>
            </div>
          )}
          
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              className="max-w-full shadow-lg border border-gray-600"
              style={{ display: isLoading ? 'none' : 'block' }}
            />
          </div>
        </div>
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
        />
      )}
    </div>
  );
}