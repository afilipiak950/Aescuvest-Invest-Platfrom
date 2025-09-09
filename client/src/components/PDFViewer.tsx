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

        // 🔧 BULLETPROOF PDF FETCHING: Validate content type before processing
        console.log(`🔍 Attempting to fetch PDF for document ${documentId}: ${documentName}`);
        
        let response;
        let finalError = 'Failed to fetch PDF';
        
        // Fetch document with proper error handling
        try {
          response = await fetch(`/api/documents/${documentId}/download`);
          console.log(`🔍 Response status: ${response.status}, Content-Type: ${response.headers.get('content-type')}`);
          
          if (!response.ok) {
            // Handle error responses
            const contentType = response.headers.get('content-type') || '';
            
            if (contentType.includes('application/json')) {
              // This is a JSON error response, not a PDF
              try {
                const errorData = await response.json();
                console.log(`❌ JSON error response:`, errorData);
                
                if (errorData.message === 'Document file not available') {
                  finalError = `📄 Document "${documentName}" is currently unavailable.\n\n` +
                             `This typically happens when:\n` +
                             `• Files were cleaned up during system maintenance\n` +
                             `• The document needs to be re-uploaded\n` +
                             `• File storage is being reorganized\n\n` +
                             `💡 Try downloading the document directly - it may still be accessible.`;
                } else {
                  finalError = errorData.message || 'Document access failed';
                }
              } catch {
                finalError = `Server error (${response.status}): Unable to access document`;
              }
            } else {
              finalError = `HTTP ${response.status}: Server error occurred`;
            }
            throw new Error(finalError);
          }
          
          // Validate that we received a PDF
          const contentType = response.headers.get('content-type') || '';
          if (!contentType.includes('application/pdf')) {
            console.warn(`⚠️ Unexpected content type: ${contentType}`);
            // Try to handle as PDF anyway, but with a warning
          }
          
        } catch (fetchError) {
          console.error('❌ PDF fetch failed:', fetchError);
          throw fetchError;
        }
        
        // Convert to ArrayBuffer for PDF.js
        let arrayBuffer;
        try {
          arrayBuffer = await response.arrayBuffer();
          console.log(`✅ Received PDF data: ${arrayBuffer.byteLength} bytes`);
        } catch (bufferError) {
          console.error('❌ Failed to convert response to ArrayBuffer:', bufferError);
          throw new Error('Failed to process PDF data from server');
        }
        
        // Load PDF with additional error handling
        let pdf;
        try {
          pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          console.log(`✅ PDF loaded successfully: ${pdf.numPages} pages`);
        } catch (pdfError) {
          console.error('❌ PDF.js parsing failed:', pdfError);
          throw new Error(`Unable to parse PDF file. The document may be corrupted or in an unsupported format.`);
        }
        
        setPdfDoc(pdf);
        setPageCount(pdf.numPages);
        setPageNum(1);
        setIsLoading(false);
        
      } catch (err) {
        console.error('PDF loading error:', err);
        let errorMessage = 'Failed to load PDF. Please try downloading or opening in new tab.';
        if (err instanceof Error) {
          if (err.message.includes('Document file not available') || err.message.includes('not found')) {
            errorMessage = `This document appears to have been removed during system maintenance. Please re-upload "${documentName}" to restore access.`;
          } else {
            errorMessage = err.message;
          }
        }
        setError(errorMessage);
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
        if (!canvas) return;
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
              <div className="text-center max-w-lg space-y-6">
                {/* Enhanced Visual Design */}
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Download className="w-10 h-10 text-red-400" />
                </div>
                
                <div>
                  <h3 className="text-xl font-semibold text-red-400 mb-3">
                    PDF Preview Unavailable
                  </h3>
                  <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-line max-w-md mx-auto">
                    {error}
                  </div>
                </div>
                
                {/* Helpful Tips */}
                {error.includes('temporarily unavailable') && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 max-w-md mx-auto">
                    <p className="text-blue-300 text-sm">
                      💡 <strong>Quick Fix:</strong> Try the download button - it often works even when preview doesn't.
                    </p>
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex gap-3 justify-center">
                  <Button onClick={handleDownload} className="bg-red-600 hover:bg-red-700 text-white border-none">
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

// Inline PDF preview component for tabs
export function InlinePDFPreview({ document: pdfDocument, dealId, className = "" }: {
  document: any;
  dealId: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1.2);

  // Load PDF.js and document
  useEffect(() => {
    const loadPDF = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Load PDF.js from CDN if not already loaded
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
        const response = await fetch(`/api/documents/${pdfDocument.id}/download`);
        if (!response.ok) throw new Error('Failed to fetch PDF');
        
        const arrayBuffer = await response.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        setPdfDoc(pdf);
        setPageCount(pdf.numPages);
        setPageNum(1);
        setIsLoading(false);
        
      } catch (err) {
        console.error('Inline PDF loading error:', err);
        setError('Failed to load PDF. Please try downloading the document.');
        setIsLoading(false);
      }
    };

    loadPDF();
  }, [pdfDocument.id]);

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        
        await page.render(renderContext).promise;
      } catch (err) {
        console.error('Inline PDF page rendering error:', err);
        setError('Failed to render PDF page');
      }
    };

    renderPage();
  }, [pdfDoc, pageNum, scale]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `/api/documents/${pdfDocument.id}/download`;
    link.download = pdfDocument.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const nextPage = () => {
    if (pageNum < pageCount) setPageNum(pageNum + 1);
  };

  const prevPage = () => {
    if (pageNum > 1) setPageNum(pageNum - 1);
  };

  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 3));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.5));
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-gray-800 ${className}`}>
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mb-4"></div>
          <p className="text-white text-sm">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-800 ${className}`}>
        <div className="text-center max-w-lg p-6">
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-4">
            <p className="text-red-300 mb-2 text-sm whitespace-pre-line">{error}</p>
          </div>
          
          <div className="flex flex-col gap-2">
            <Button 
              onClick={() => window.open(`/api/documents/${pdfDocument.id}/download`, '_blank')} 
              variant="outline" 
              className="bg-blue-600 border-blue-500 text-white hover:bg-blue-500"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Try Alternative Access
            </Button>
            
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline" 
              className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
            >
              Refresh Page
            </Button>
          </div>
          
          <p className="text-gray-400 text-xs mt-3">
            If the document is critical, contact support for file recovery assistance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-gray-800 ${className}`}>
      {/* PDF Controls */}
      <div className="flex items-center justify-between bg-gray-700 px-4 py-2 border-b border-gray-600">
        <div className="flex items-center space-x-2">
          <Button
            onClick={prevPage}
            disabled={pageNum <= 1}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 bg-gray-600 border-gray-500 text-white hover:bg-gray-500 disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-gray-300 min-w-[80px] text-center">
            Page {pageNum} of {pageCount}
          </span>
          <Button
            onClick={nextPage}
            disabled={pageNum >= pageCount}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 bg-gray-600 border-gray-500 text-white hover:bg-gray-500 disabled:opacity-50"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            onClick={zoomOut}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 bg-gray-600 border-gray-500 text-white hover:bg-gray-500"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm text-gray-300 min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            onClick={zoomIn}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 bg-gray-600 border-gray-500 text-white hover:bg-gray-500"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <div className="w-px h-6 bg-gray-500 mx-2"></div>
          <Button
            onClick={handleDownload}
            variant="outline"
            size="sm"
            className="bg-gray-600 border-gray-500 text-white hover:bg-gray-500"
          >
            <Download className="w-4 h-4 mr-1" />
            Download
          </Button>
        </div>
      </div>

      {/* PDF Canvas */}
      <div className="flex-1 overflow-auto bg-gray-900 p-4">
        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            className="border border-gray-600 shadow-lg bg-white max-w-full"
            style={{ height: 'auto' }}
          />
        </div>
      </div>
    </div>
  );
}