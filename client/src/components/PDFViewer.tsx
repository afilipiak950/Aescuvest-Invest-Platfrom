import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, Eye } from 'lucide-react';

interface PDFViewerProps {
  documentId: number;
  documentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PDFViewer({ documentId, documentName, open, onOpenChange }: PDFViewerProps) {
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

  const pdfUrl = `/api/documents/${documentId}/download?view=inline&t=${Date.now()}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-full h-[90vh] p-0 bg-white border-gray-300">
        <DialogHeader className="px-6 py-4 border-b border-gray-300 bg-gray-50">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-gray-900 truncate mr-4">
              {documentName}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleDownload}
                variant="outline"
                size="sm"
                className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button
                onClick={handleOpenInNewTab}
                variant="outline"
                size="sm"
                className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                New Tab
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 w-full h-full">
          <iframe
            src={pdfUrl}
            className="w-full h-full border-0"
            title={documentName}
            style={{ minHeight: '600px' }}
          />
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
      <object
        data={`/api/documents/${documentId}/download?view=inline&preview=true`}
        type="application/pdf"
        className="w-full h-full min-h-[200px]"
      >
        <div className="flex items-center justify-center h-full min-h-[200px] text-gray-500">
          <div className="text-center">
            <Eye className="w-12 h-12 mx-auto mb-2" />
            <p className="text-sm">Click to View PDF</p>
          </div>
        </div>
      </object>
    </div>
  );
}