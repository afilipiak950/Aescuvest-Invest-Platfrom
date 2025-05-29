import { Document } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { 
  FileText, FileSpreadsheet, File as FileIcon,
  Clock, Check, MoreHorizontal
 } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface DocumentListProps {
  documents: Document[];
}

export default function DocumentList({ documents }: DocumentListProps) {
  if (!documents || documents.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-gray-400">No documents uploaded yet.</p>
        <p className="text-sm text-gray-500 mt-2">
          Upload documents or connect a data room to analyze the deal.
        </p>
      </div>
    );
  }

  const getFileIcon = (fileType: string) => {
    switch ((fileType || '').toLowerCase()) {
      case 'pdf':
        return <FileText className="h-6 w-6 text-red-400" />;
      case 'xlsx':
      case 'xls':
      case 'csv':
        return <FileSpreadsheet className="h-6 w-6 text-blue-400" />;
      case 'docx':
      case 'doc':
        return <FileText className="h-6 w-6 text-blue-400" />;
      default:
        return <FileIcon className="h-6 w-6 text-gray-400" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Analyzed':
        return <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Analyzed</span>;
      case 'Analyzing':
        return <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Processing</span>;
      default:
        return <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded">Pending</span>;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div>
      <div className="flex space-x-4 mb-6">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search documents..." 
            className="w-64 bg-dark-lighter rounded-lg pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 absolute left-3 top-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((doc) => (
          <div 
            key={doc.id} 
            className="bg-dark-lighter p-4 rounded-lg cursor-pointer hover:bg-dark-light transition"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="w-10 h-10 rounded-lg bg-dark flex items-center justify-center">
                {getFileIcon(doc.type)}
              </div>
              {getStatusIcon(doc.status)}
            </div>

            <h3 className="font-medium text-sm mb-1">{doc.name}</h3>
            <p className="text-xs text-gray-400">
              Added {formatDate(doc.uploadedAt)} • {formatFileSize(doc.size)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
