import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FolderIcon, 
  FileTextIcon, 
  FileIcon, 
  ChevronRightIcon, 
  ChevronDownIcon,
  DownloadIcon,
  EyeIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  UploadIcon,
  Loader2,
  TrashIcon,
  PlusIcon,
  XIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { apiRequest } from '@/lib/queryClient';
import { Document } from '@shared/schema';
import { BackgroundJobProgress } from './BackgroundJobProgress';

interface DataRoomExplorerProps {
  dealId: number;
  onUploadComplete?: () => void;
}

interface FolderNode {
  name: string;
  path: string;
  children: Map<string, FolderNode>;
  documents: Document[];
  isExpanded: boolean;
}

interface DocumentDetailModalProps {
  document: Document;
  isOpen: boolean;
  onClose: () => void;
}

interface AIDocumentSummary {
  executiveSummary: string;
  criticalFindings: string[];
  neutralFindings: string[];
  keyFinancialData: string[];
  riskAssessment: string[];
  strategicImplications: string;
  documentType: string;
  confidenceScore: number;
}

const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({ document, isOpen, onClose }) => {
  const [aiSummary, setAiSummary] = useState<AIDocumentSummary | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  if (!isOpen) return null;

  const analysis = document.analyses ? JSON.parse(document.analyses) : null;
  const analysisData = analysis?.analysis || analysis;

  const generateAISummary = async () => {
    if (!document.ocrText || document.ocrText.trim().length === 0) {
      setSummaryError('No text content available to summarize');
      return;
    }

    setIsGeneratingSummary(true);
    setSummaryError(null);
    setAiSummary(null);

    try {
      console.log(`Generating AI summary for document ${document.id}: ${document.name}`);
      
      const response = await fetch('/api/ai/generate-document-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ documentId: document.id })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate summary');
      }

      const data = await response.json();
      setAiSummary(data.summary);
      console.log('AI summary generated successfully');
      
    } catch (error) {
      console.error('Error generating AI summary:', error);
      setSummaryError(error instanceof Error ? error.message : 'Failed to generate summary');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleDownload = async () => {
    try {
      console.log(`Starting download for document ${document.id}: ${document.name}`);
      
      // First, try direct window.open approach (most reliable for downloads)
      const downloadUrl = `${window.location.origin}/api/documents/${document.id}/download`;
      console.log('Opening download URL:', downloadUrl);
      
      // Open in new window which should trigger download
      const downloadWindow = window.open(downloadUrl, '_blank');
      
      // Check if popup was blocked
      if (!downloadWindow) {
        console.log('Popup blocked, trying fetch approach...');
        
        // Fallback to fetch approach
        const response = await fetch(downloadUrl, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': '*/*'
          }
        });

        console.log('Download response status:', response.status);
        console.log('Download response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Download response error:', errorText);
          throw new Error(`Download failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        // Check content type to ensure we're getting a file, not HTML
        const contentType = response.headers.get('content-type');
        console.log('Content type:', contentType);
        
        if (contentType && contentType.includes('text/html')) {
          throw new Error('Received HTML instead of file content. Check server routing.');
        }

        // Get the blob and create download link
        const blob = await response.blob();
        console.log('Blob size:', blob.size, 'bytes');
        
        if (blob.size === 0) {
          throw new Error('Downloaded file is empty');
        }

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = document.name;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        // Close the download window after a short delay
        setTimeout(() => {
          if (downloadWindow) {
            downloadWindow.close();
          }
        }, 1000);
      }
      
      console.log(`Successfully initiated download: ${document.name}`);
    } catch (error) {
      console.error('Download failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to download file: ${errorMessage}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-lighter rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-dark">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">{document.name}</h2>
              <div className="flex items-center space-x-4 text-sm text-gray-400">
                <span>Type: {document.documentType || document.type}</span>
                <span>Category: {document.category || 'General'}</span>
                <span>Size: {(document.size / 1024).toFixed(1)} KB</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {/* AI Summary Generation */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">AI Document Analysis</h3>
              <button
                onClick={generateAISummary}
                disabled={isGeneratingSummary || !document.ocrText}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGeneratingSummary ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <span>🤖</span>
                    <span>Generate AI Summary</span>
                  </>
                )}
              </button>
            </div>

            {summaryError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
                <p className="text-red-300 text-sm">{summaryError}</p>
              </div>
            )}

            {aiSummary && (
              <div className="space-y-6">
                {/* Executive Summary */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <h4 className="text-md font-medium text-blue-300 mb-3 flex items-center">
                    <span className="mr-2">📋</span>
                    Executive Summary
                  </h4>
                  <p className="text-gray-300 leading-relaxed">{aiSummary.executiveSummary}</p>
                </div>

                {/* Critical Findings */}
                {aiSummary.criticalFindings && aiSummary.criticalFindings.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                    <h4 className="text-md font-medium text-red-300 mb-3 flex items-center">
                      <AlertTriangleIcon className="w-5 h-5 mr-2" />
                      Critical Information
                    </h4>
                    <ul className="space-y-2">
                      {aiSummary.criticalFindings.map((finding, index) => (
                        <li key={index} className="text-red-200 text-sm flex items-start">
                          <span className="text-red-400 mr-2 mt-1">•</span>
                          <span>{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Key Financial Data */}
                {aiSummary.keyFinancialData && aiSummary.keyFinancialData.length > 0 && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                    <h4 className="text-md font-medium text-green-300 mb-3 flex items-center">
                      <span className="mr-2">💰</span>
                      Key Financial Data
                    </h4>
                    <ul className="space-y-2">
                      {aiSummary.keyFinancialData.map((data, index) => (
                        <li key={index} className="text-green-200 text-sm flex items-start">
                          <span className="text-green-400 mr-2 mt-1">•</span>
                          <span>{data}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Risk Assessment */}
                {aiSummary.riskAssessment && aiSummary.riskAssessment.length > 0 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                    <h4 className="text-md font-medium text-yellow-300 mb-3 flex items-center">
                      <span className="mr-2">⚠️</span>
                      Risk Assessment
                    </h4>
                    <ul className="space-y-2">
                      {aiSummary.riskAssessment.map((risk, index) => (
                        <li key={index} className="text-yellow-200 text-sm flex items-start">
                          <span className="text-yellow-400 mr-2 mt-1">•</span>
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Neutral Information */}
                {aiSummary.neutralFindings && aiSummary.neutralFindings.length > 0 && (
                  <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-4">
                    <h4 className="text-md font-medium text-gray-300 mb-3 flex items-center">
                      <span className="mr-2">📄</span>
                      Background Information
                    </h4>
                    <ul className="space-y-2">
                      {aiSummary.neutralFindings.map((finding, index) => (
                        <li key={index} className="text-gray-300 text-sm flex items-start">
                          <span className="text-gray-400 mr-2 mt-1">•</span>
                          <span>{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Strategic Implications */}
                {aiSummary.strategicImplications && (
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                    <h4 className="text-md font-medium text-purple-300 mb-3 flex items-center">
                      <span className="mr-2">🎯</span>
                      Strategic Implications
                    </h4>
                    <p className="text-purple-200 leading-relaxed">{aiSummary.strategicImplications}</p>
                  </div>
                )}

                {/* Analysis Metadata */}
                <div className="bg-dark p-3 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Document Type: {aiSummary.documentType}</span>
                    <span className="text-gray-400">
                      Confidence: {Math.round((aiSummary.confidenceScore || 0) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* OCR Text - Collapsed by default when AI summary is available */}
          {document.ocrText && (
            <div className="mb-6">
              <details className={aiSummary ? '' : 'open'}>
                <summary className="text-lg font-medium text-white mb-3 cursor-pointer hover:text-blue-300 transition-colors">
                  Extracted Text {document.ocrText.length > 1000 && `(${Math.round(document.ocrText.length / 1000)}k chars)`}
                </summary>
                <div className="bg-dark p-4 rounded-lg max-h-60 overflow-y-auto mt-3">
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap">{document.ocrText}</pre>
                </div>
              </details>
            </div>
          )}

          {/* Additional Analysis Data */}
          {analysisData && (
            <div className="mb-6">
              <details>
                <summary className="text-lg font-medium text-white mb-3 cursor-pointer hover:text-blue-300 transition-colors">
                  Technical Analysis
                </summary>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-3">
                  {analysisData.documentType && (
                    <div>
                      <h4 className="text-md font-medium text-white mb-2">Document Type</h4>
                      <p className="text-gray-300">{analysisData.documentType}</p>
                    </div>
                  )}
                  
                  {analysisData.category && (
                    <div>
                      <h4 className="text-md font-medium text-white mb-2">Business Category</h4>
                      <p className="text-gray-300">{analysisData.category}</p>
                    </div>
                  )}
                </div>
              </details>
            </div>
          )}

          {/* Status and Metadata */}
          <div className="mt-6 pt-6 border-t border-dark">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  {document.status === 'Analyzed' && <CheckCircleIcon className="w-4 h-4 text-green-500 mr-1" />}
                  {document.status === 'Pending' && <ClockIcon className="w-4 h-4 text-yellow-500 mr-1" />}
                  <span className="text-sm text-gray-400">Status: {document.status}</span>
                </div>
                <span className="text-sm text-gray-400">
                  Uploaded: {new Date(document.uploadedAt).toLocaleDateString()}
                </span>
              </div>
              <button 
                onClick={handleDownload}
                className="flex items-center space-x-2 px-4 py-2 bg-primary hover:bg-primary-light rounded-lg text-white text-sm hover:bg-primary/80 transition-colors"
              >
                <DownloadIcon className="w-4 h-4" />
                <span>Download</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FolderTree: React.FC<{
  node: FolderNode;
  level: number;
  onToggle: (path: string) => void;
  onDocumentClick: (document: Document) => void;
  isSelectionMode: boolean;
  selectedFiles: Set<number>;
  onFileSelection: (fileId: number, checked: boolean) => void;
}> = ({ node, level, onToggle, onDocumentClick, isSelectionMode, selectedFiles, onFileSelection }) => {
  const hasChildren = node.children.size > 0 || node.documents.length > 0;
  const paddingLeft = level * 20;

  return (
    <div>
      {/* Folder Header */}
      {node.name && (
        <div
          className="flex items-center py-2 px-3 hover:bg-dark-light cursor-pointer rounded-lg"
          style={{ paddingLeft: `${paddingLeft}px` }}
          onClick={() => onToggle(node.path)}
        >
          {hasChildren && (
            node.isExpanded ? 
              <ChevronDownIcon className="w-4 h-4 text-gray-400 mr-2" /> :
              <ChevronRightIcon className="w-4 h-4 text-gray-400 mr-2" />
          )}
          <FolderIcon className="w-4 h-4 text-blue-400 mr-2" />
          <span className="text-white text-sm font-medium">{node.name}</span>
          <span className="ml-auto text-xs text-gray-500">
            {node.documents.length + Array.from(node.children.values()).reduce((sum, child) => sum + child.documents.length, 0)} items
          </span>
        </div>
      )}

      {/* Expanded Content */}
      {node.isExpanded && (
        <div>
          {/* Documents in this folder */}
          {node.documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center py-2 px-3 hover:bg-dark-light rounded-lg"
              style={{ paddingLeft: `${paddingLeft + 20}px` }}
            >
              {isSelectionMode && (
                <Checkbox
                  checked={selectedFiles.has(doc.id)}
                  onCheckedChange={(checked) => onFileSelection(doc.id, !!checked)}
                  className="mr-2"
                />
              )}
              
              <div 
                className="flex items-center flex-1 cursor-pointer"
                onClick={() => !isSelectionMode && onDocumentClick(doc)}
              >
                {doc.type.includes('pdf') ? (
                  <FileTextIcon className="w-4 h-4 text-red-400 mr-2" />
                ) : (
                  <FileIcon className="w-4 h-4 text-gray-400 mr-2" />
                )}
                <span className="text-gray-300 text-sm flex-1">{doc.name}</span>
                <div className="flex items-center space-x-2">
                  {doc.status === 'Analyzed' && <CheckCircleIcon className="w-3 h-3 text-green-500" />}
                  {doc.status === 'Pending' && <ClockIcon className="w-3 h-3 text-yellow-500" />}
                  <EyeIcon className="w-3 h-3 text-gray-500" />
                  <span className="text-xs text-gray-500">{(doc.size / 1024).toFixed(1)} KB</span>
                </div>
              </div>
            </div>
          ))}

          {/* Subfolders */}
          {Array.from(node.children.values()).map((child) => (
            <FolderTree
              key={child.path}
              node={child}
              level={level + 1}
              onToggle={onToggle}
              onDocumentClick={onDocumentClick}
              isSelectionMode={isSelectionMode}
              selectedFiles={selectedFiles}
              onFileSelection={onFileSelection}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const DataRoomExplorer: React.FC<DataRoomExplorerProps> = ({ dealId, onUploadComplete }) => {
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [folderStates, setFolderStates] = useState<Map<string, boolean>>(new Map());
  const [folderName, setFolderName] = useState('Data Room Documents');
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showAdditionalUpload, setShowAdditionalUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ fileName: string; progress: number; status: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const additionalFileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: [`/api/deals/${dealId}/documents`],
  });

  // ZIP upload mutation with streaming progress
  const uploadZipMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const xhr = new XMLHttpRequest();
      
      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            console.log(`Upload progress: ${percentComplete.toFixed(1)}%`);
            setUploadProgress(prev => prev ? {
              ...prev,
              progress: percentComplete,
              status: percentComplete < 100 ? 'Uploading...' : 'Processing...'
            } : null);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (e) {
              resolve({ success: true, message: 'Upload completed' });
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed due to network error'));
        });

        xhr.addEventListener('timeout', () => {
          reject(new Error('Upload timed out'));
        });

        xhr.open('POST', `/api/deals/${dealId}/data-room/upload-zip`);
        xhr.timeout = 600000; // 10 minutes
        xhr.withCredentials = true; // Include cookies for auth
        xhr.send(formData);
      });
    },
    onSuccess: () => {
      setUploadProgress(prev => prev ? { ...prev, status: 'Complete', progress: 100 } : null);
      setTimeout(() => setUploadProgress(null), 3000); // Clear after 3 seconds
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // Call the callback to hide the data room after successful upload
      if (onUploadComplete) {
        onUploadComplete();
      }
    },
    onError: (error) => {
      console.error('ZIP upload failed:', error);
      setUploadProgress(prev => prev ? { ...prev, status: 'Failed', progress: 0 } : null);
      setTimeout(() => setUploadProgress(null), 5000); // Clear after 5 seconds
    }
  });

  // Additional files upload mutation
  const uploadFilesMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const xhr = new XMLHttpRequest();
      
      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            console.log(`Files upload progress: ${percentComplete.toFixed(1)}%`);
            setUploadProgress(prev => prev ? {
              ...prev,
              progress: percentComplete,
              status: percentComplete < 100 ? 'Uploading...' : 'Processing...'
            } : null);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText);
              resolve(result);
            } catch (e) {
              resolve(xhr.responseText);
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed due to network error'));
        });

        xhr.addEventListener('timeout', () => {
          reject(new Error('Upload timed out'));
        });

        xhr.open('POST', `/api/deals/${dealId}/documents`);
        xhr.timeout = 10 * 60 * 1000; // 10 minutes timeout
        xhr.withCredentials = true;
        xhr.send(formData);
      });
    },
    onSuccess: () => {
      setUploadProgress(prev => prev ? { ...prev, status: 'Complete', progress: 100 } : null);
      setTimeout(() => setUploadProgress(null), 3000);
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
      if (additionalFileInputRef.current) {
        additionalFileInputRef.current.value = '';
      }
      setShowAdditionalUpload(false);
    },
    onError: (error) => {
      console.error('Files upload failed:', error);
      setUploadProgress(prev => prev ? { ...prev, status: 'Failed', progress: 0 } : null);
      setTimeout(() => setUploadProgress(null), 5000);
    }
  });

  // Delete files mutation
  const deleteFilesMutation = useMutation({
    mutationFn: async (fileIds: number[]) => {
      return await apiRequest(`/api/documents/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
      setSelectedFiles(new Set());
      setIsSelectionMode(false);
    }
  });

  const handleZipUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024 * 1024) { // 500MB limit
      alert(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the maximum limit of 500MB. Please select a smaller file.`);
      return;
    }

    console.log(`Uploading ZIP file: ${file.name}, Size: ${(file.size / 1024 / 1024).toFixed(1)}MB`);

    // Initialize upload progress
    setUploadProgress({
      fileName: file.name,
      progress: 0,
      status: 'Starting upload...'
    });

    const formData = new FormData();
    formData.append('zipFile', file);
    formData.append('folderName', folderName);

    uploadZipMutation.mutate(formData);
  };

  const handleAdditionalFilesUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Initialize upload progress for multiple files
    const fileNames = Array.from(files).map(f => f.name).join(', ');
    setUploadProgress({
      fileName: files.length > 1 ? `${files.length} files: ${fileNames}` : files[0].name,
      progress: 0,
      status: 'Starting upload...'
    });

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });
    formData.append('dealId', dealId.toString());

    uploadFilesMutation.mutate(formData);
  };

  const handleFileSelection = (fileId: number, checked: boolean) => {
    const newSelection = new Set(selectedFiles);
    if (checked) {
      newSelection.add(fileId);
    } else {
      newSelection.delete(fileId);
    }
    setSelectedFiles(newSelection);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && documents && Array.isArray(documents)) {
      const allFileIds = new Set(documents.map((doc: Document) => doc.id));
      setSelectedFiles(allFileIds);
    } else {
      setSelectedFiles(new Set());
    }
  };

  const handleDeleteSelected = () => {
    if (selectedFiles.size === 0) return;
    
    if (confirm(`Delete ${selectedFiles.size} selected files? This action cannot be undone.`)) {
      deleteFilesMutation.mutate(Array.from(selectedFiles));
    }
  };

  const buildFolderTree = (docs: Document[]): FolderNode => {
    const root: FolderNode = {
      name: '',
      path: '',
      children: new Map(),
      documents: [],
      isExpanded: true
    };

    docs.forEach((doc) => {
      const folderPath = doc.folderPath || '';
      const pathParts = folderPath ? folderPath.split('/').filter(Boolean) : [];
      
      let currentNode = root;
      let currentPath = '';

      // Create folder hierarchy
      pathParts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        if (!currentNode.children.has(part)) {
          currentNode.children.set(part, {
            name: part,
            path: currentPath,
            children: new Map(),
            documents: [],
            isExpanded: folderStates.get(currentPath) ?? true
          });
        }
        currentNode = currentNode.children.get(part)!;
      });

      // Add document to the appropriate folder
      currentNode.documents.push(doc);
    });

    return root;
  };

  const toggleFolder = (path: string) => {
    setFolderStates(prev => {
      const newStates = new Map(prev);
      newStates.set(path, !newStates.get(path));
      return newStates;
    });
  };

  if (isLoading) {
    return (
      <div className="bg-dark-lighter rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-dark rounded mb-4 w-1/3"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-dark rounded w-full"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!documents || !Array.isArray(documents) || documents.length === 0) {
    return (
      <div className="bg-dark-lighter rounded-lg">
        <div className="p-4 border-b border-dark">
          <h3 className="text-lg font-semibold text-white">Data Room Explorer</h3>
          <p className="text-sm text-gray-400 mt-1">Upload ZIP files to analyze deal documents with AI-powered insights</p>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Upload Interface */}
          <div className="space-y-3">
            <Label htmlFor="folderName" className="text-white">Folder Name</Label>
            <Input
              id="folderName"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Enter folder name"
              className="bg-dark border-gray-600 text-white"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="zipFile" className="text-white">Upload ZIP File</Label>
            <div className="flex items-center gap-3">
              <Input
                ref={fileInputRef}
                id="zipFile"
                type="file"
                accept=".zip"
                onChange={handleZipUpload}
                disabled={uploadZipMutation.isPending}
                className="cursor-pointer bg-dark border-gray-600 text-white"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadZipMutation.isPending}
                variant="outline"
                className="border-primary text-primary hover:bg-primary hover:text-white"
              >
                {uploadZipMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UploadIcon className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <Alert className="bg-dark border-gray-600">
            <UploadIcon className="h-4 w-4" />
            <AlertDescription className="text-gray-300">
              Upload a ZIP file containing your deal documents. All files will be automatically 
              analyzed using AI-powered OCR for document intelligence and insights.
            </AlertDescription>
          </Alert>

          {/* Upload Progress Display */}
          {uploadProgress && (
            <div className="space-y-2 p-4 bg-dark border border-gray-600 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  <span className="text-sm font-medium text-white">{uploadProgress.fileName}</span>
                </div>
                <span className="text-sm text-gray-400">{uploadProgress.progress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress.progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">{uploadProgress.status}</p>
            </div>
          )}

          {/* Background Job Progress */}
          <BackgroundJobProgress 
            dealId={dealId} 
            onJobComplete={() => {
              queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
              refetch(); // Refresh documents immediately
              if (onUploadComplete) onUploadComplete();
            }}
          />

          {/* Error Display */}
          {uploadZipMutation.error && (
            <Alert variant="destructive">
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertDescription>
                Upload failed: {uploadZipMutation.error.message}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    );
  }

  const folderTree = buildFolderTree(documents);

  return (
    <div className="bg-dark-lighter rounded-lg">
      <div className="p-4 border-b border-dark">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Data Room Explorer</h3>
            <p className="text-sm text-gray-400 mt-1">{documents.length} documents organized by folder structure</p>
          </div>
          
          <div className="flex items-center space-x-2">
            {!isSelectionMode ? (
              <>
                <Button
                  onClick={() => setShowAdditionalUpload(true)}
                  size="sm"
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  <PlusIcon className="w-4 h-4 mr-1" />
                  Add Files
                </Button>
                <Button
                  onClick={() => setIsSelectionMode(true)}
                  size="sm"
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  <TrashIcon className="w-4 h-4 mr-1" />
                  Manage
                </Button>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={selectedFiles.size === documents.length && documents.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm text-gray-300">Select All</span>
                </div>
                <Button
                  onClick={handleDeleteSelected}
                  disabled={selectedFiles.size === 0 || deleteFilesMutation.isPending}
                  size="sm"
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleteFilesMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <TrashIcon className="w-4 h-4 mr-1" />
                  )}
                  Delete ({selectedFiles.size})
                </Button>
                <Button
                  onClick={() => {
                    setIsSelectionMode(false);
                    setSelectedFiles(new Set());
                  }}
                  size="sm"
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  <XIcon className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Background Job Progress Tracking */}
      <div className="p-4 border-b border-dark">
        <BackgroundJobProgress 
          dealId={dealId}
          onJobComplete={(jobId, result) => {
            console.log(`Job ${jobId} completed:`, result);
            // Refetch documents to show updated OCR results
            refetch();
            if (onUploadComplete) {
              onUploadComplete();
            }
          }}
        />
      </div>

      {/* Additional File Upload Section */}
      {showAdditionalUpload && (
        <div className="p-4 border-b border-dark bg-dark">
          <h4 className="text-white text-sm font-medium mb-3">Upload Additional Files</h4>
          <div className="space-y-3">
            <Input
              ref={additionalFileInputRef}
              type="file"
              multiple
              onChange={handleAdditionalFilesUpload}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png"
              className="bg-dark border-gray-600 text-white file:bg-blue-600 file:text-white file:border-0 file:rounded file:px-3 file:py-1"
            />
            <div className="flex space-x-2">
              <Button
                onClick={() => additionalFileInputRef.current?.click()}
                disabled={uploadFilesMutation.isPending}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                {uploadFilesMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <UploadIcon className="w-4 h-4 mr-2" />
                    Select Files
                  </>
                )}
              </Button>
              <Button
                onClick={() => setShowAdditionalUpload(false)}
                size="sm"
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </Button>
            </div>
          </div>
          {uploadFilesMutation.error && (
            <Alert className="mt-3 border-red-500 bg-red-900/20">
              <AlertTriangleIcon className="w-4 h-4" />
              <AlertDescription className="text-red-300">
                Upload failed: {uploadFilesMutation.error.message}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="p-4 max-h-96 overflow-y-auto">
        {folderTree.children.size > 0 ? (
          Array.from(folderTree.children.values()).map((child) => (
            <FolderTree
              key={child.path}
              node={child}
              level={0}
              onToggle={toggleFolder}
              onDocumentClick={setSelectedDocument}
              isSelectionMode={isSelectionMode}
              selectedFiles={selectedFiles}
              onFileSelection={handleFileSelection}
            />
          ))
        ) : (
          <div className="space-y-2">
            {folderTree.documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center py-2 px-3 hover:bg-dark-light rounded-lg"
              >
                {isSelectionMode && (
                  <Checkbox
                    checked={selectedFiles.has(doc.id)}
                    onCheckedChange={(checked) => handleFileSelection(doc.id, !!checked)}
                    className="mr-2"
                  />
                )}
                
                <div 
                  className="flex items-center flex-1 cursor-pointer"
                  onClick={() => !isSelectionMode && setSelectedDocument(doc)}
                >
                  {doc.type.includes('pdf') ? (
                    <FileTextIcon className="w-4 h-4 text-red-400 mr-2" />
                  ) : (
                    <FileIcon className="w-4 h-4 text-gray-400 mr-2" />
                  )}
                  <span className="text-gray-300 text-sm flex-1">{doc.name}</span>
                  <div className="flex items-center space-x-2">
                    {doc.status === 'Analyzed' && <CheckCircleIcon className="w-3 h-3 text-green-500" />}
                    {doc.status === 'Pending' && <ClockIcon className="w-3 h-3 text-yellow-500" />}
                    <EyeIcon className="w-3 h-3 text-gray-500" />
                    <span className="text-xs text-gray-500">{(doc.size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedDocument && (
        <DocumentDetailModal
          document={selectedDocument}
          isOpen={!!selectedDocument}
          onClose={() => setSelectedDocument(null)}
        />
      )}
    </div>
  );
};