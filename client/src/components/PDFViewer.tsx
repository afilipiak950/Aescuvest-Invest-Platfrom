import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';

// TypeScript declarations for PDF.js
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

interface PDFViewerProps {
  documentId: number;
  documentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PDFViewer({ documentId, documentName, open, onOpenChange }: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1.5);

  // Load PDF.js dynamically
  useEffect(() => {
    if (!open) return;

    const loadPDFJS = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Load PDF.js from CDN
        if (!window.pdfjsLib) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          document.head.appendChild(script);
          
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
          });
          
          // Set worker
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        // Fetch PDF as ArrayBuffer
        const response = await fetch(`/api/documents/${documentId}/download`);
        if (!response.ok) throw new Error('Failed to fetch PDF');
        
        const arrayBuffer = await response.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        setPdfDoc(pdf);
        setPageCount(pdf.numPages);
        setPageNum(1);
        setIsLoading(false);
        
      } catch (err) {
        console.error('PDF loading error:', err);
        setError('Failed to load PDF. Please try downloading or opening in new tab.');
        setIsLoading(false);
      }
    };

    loadPDFJS();
  }, [documentId, open]);

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        
        await page.render(renderContext).promise;
      } catch (err) {
        console.error('Page rendering error:', err);
      }
    };

    renderPage();
  }, [pdfDoc, pageNum, scale]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `/api/documents/${documentId}/download`;
    link.download = documentName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    window.open(`/api/documents/${documentId}/download?view=inline`, '_blank');
  };

  const nextPage = () => {
    if (pageNum < pageCount) setPageNum(pageNum + 1);
  };

  const prevPage = () => {
    if (pageNum > 1) setPageNum(pageNum - 1);
  };

  const zoomIn = () => {
    setScale(Math.min(scale + 0.25, 3));
  };

  const zoomOut = () => {
    setScale(Math.max(scale - 0.25, 0.5));
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
              {!error && pdfDoc && (
                <>
                  <div className="flex items-center gap-1 text-sm text-gray-300 mr-4">
                    <Button
                      onClick={prevPage}
                      variant="outline"
                      size="sm"
                      disabled={pageNum <= 1}
                      className="h-8 w-8 p-0 bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="mx-2 min-w-[60px] text-center">
                      {pageNum} / {pageCount}
                    </span>
                    <Button
                      onClick={nextPage}
                      variant="outline"
                      size="sm"
                      disabled={pageNum >= pageCount}
                      className="h-8 w-8 p-0 bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1 mr-4">
                    <Button
                      onClick={zoomOut}
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="mx-2 text-sm text-gray-300 min-w-[40px] text-center">
                      {Math.round(scale * 100)}%
                    </span>
                    <Button
                      onClick={zoomIn}
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}
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
        
        <div className="flex-1 p-6 bg-gray-900 overflow-auto">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mb-4"></div>
                <p className="text-white">Loading PDF...</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <p className="text-red-400 mb-4">{error}</p>
                <div className="flex gap-3 justify-center">
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
            </div>
          )}
          
          {!isLoading && !error && (
            <div className="flex justify-center">
              <canvas
                ref={canvasRef}
                className="border border-gray-600 shadow-lg bg-white"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            </div>
          )}
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
  return (
    <div className={`relative bg-gray-100 rounded-lg overflow-hidden ${className}`}>
      <div className="flex items-center justify-center h-full min-h-[200px] text-gray-500">
        <div className="text-center">
          <Download className="w-12 h-12 mx-auto mb-2" />
          <p className="text-sm">Click to View PDF</p>
        </div>
      </div>
    </div>
  );
}