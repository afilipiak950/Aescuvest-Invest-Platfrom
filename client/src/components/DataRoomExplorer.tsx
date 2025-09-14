import React, { useState, useRef, useEffect, useMemo, memo } from 'react';
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
  XIcon,
  Brain,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiRequest } from '@/lib/queryClient';
import { Document } from '@shared/schema';
import { BackgroundJobProgress } from './BackgroundJobProgress';
import { PDFViewer, InlinePDFPreview } from './PDFViewer';
import { chunkedUploadService, type ChunkedUploadProgress } from '../services/chunkedUploadService';
import { frontendPersistentUploadService } from '../services/persistentUploadService';
import { backgroundUploadService } from '../services/backgroundUploadService';

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
  onClose: () => void;
  dealId: number;
  refetch: () => void;
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

const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({ document, onClose, dealId, refetch }) => {
  const queryClient = useQueryClient();
  
  // Fetch agent analyses to determine which agents processed this document
  const { data: agentAnalyses, refetch: refetchAnalyses } = useQuery({
    queryKey: [`/api/analyses/${dealId}`],
    enabled: !!dealId
  });

  // 🚀 INTELLIGENT POLLING: Monitor background jobs with smart intervals
  const { data: backgroundJobs } = useQuery({
    queryKey: [`/api/background-jobs/${dealId}`],
    enabled: !!dealId,
    refetchInterval: (data: any) => {
      // Smart polling: faster when jobs active, slower when idle
      const hasActiveJobs = data?.jobs?.some((job: any) => job.status === 'processing');
      return hasActiveJobs ? 10000 : 30000; // 🚀 OPTIMIZED: 10s when active, 30s when idle - reduced for performance
    },
  });

  // Auto-refresh when document processing completes
  useEffect(() => {
    if (backgroundJobs && typeof backgroundJobs === 'object' && 'jobs' in backgroundJobs && Array.isArray(backgroundJobs.jobs)) {
      const hasActiveJobs = backgroundJobs.jobs.some((job: any) => 
        job.status === 'processing' || job.status === 'pending'
      );
      
      // Check if jobs just completed (no active jobs but we're still monitoring)
      if (!hasActiveJobs && backgroundJobs.jobs.length === 0) {
        // Refresh agent analyses and document data after a brief delay
        setTimeout(() => {
          refetchAnalyses();
          refetch();
        }, 1000);
      }
    }
  }, [backgroundJobs, refetchAnalyses, refetch]);

  // 🚀 SMART CACHE: Get the latest document data from cache with proper typing
  const documentsRawData = queryClient.getQueryData([`/api/deals/${dealId}/documents`]) as any;
  const documentsData = Array.isArray(documentsRawData) ? documentsRawData : documentsRawData?.documents || [];
  const latestDocument = documentsData?.find((doc: any) => doc.id === document.id) || document;
  
  const analysis = latestDocument.analyses ? JSON.parse(latestDocument.analyses) : null;
  const analysisData = analysis?.analysis || analysis;
  
  // Get AI summary from latest document data (with real-time updates)
  const aiSummary = latestDocument.aiSummary as AIDocumentSummary | null;
  const aiSummaryStatus = latestDocument.aiSummaryStatus || 'pending';

  // Intelligent document-to-agent assignment based on weighted analysis
  const getAssignedAgents = () => {
    // Use the assignedAgents field populated by the intelligent assignment system
    if (latestDocument.assignedAgents && Array.isArray(latestDocument.assignedAgents) && latestDocument.assignedAgents.length > 0) {
      console.log(`📋 Document "${latestDocument.name}" assigned to agents:`, latestDocument.assignedAgents);
      return latestDocument.assignedAgents.map((agentType: string) => {
        // Capitalize the agent type for display
        const capitalizedType = agentType.charAt(0).toUpperCase() + agentType.slice(1);
        return getAgentInfo(capitalizedType);
      });
    }
    
    console.log(`⚠️ Document "${latestDocument.name}" has no intelligent assignments - showing as unassigned`);
    return [];
  };

  const getAgentInfo = (agentType: string) => {
    const agentMap: Record<string, {name: string, type: string, colorClasses: string, description: string}> = {
      'Clinical': { 
        name: 'Clinical Agent', 
        type: 'clinical', 
        colorClasses: 'bg-red-500/10 border-red-500/20 text-red-300 bg-red-500', 
        description: 'Healthcare services & medical analysis' 
      },
      'Legal': { 
        name: 'Legal Agent', 
        type: 'legal', 
        colorClasses: 'bg-blue-500/10 border-blue-500/20 text-blue-300 bg-blue-500', 
        description: 'Legal compliance & regulatory analysis' 
      },
      'Commercial': { 
        name: 'Commercial Agent', 
        type: 'commercial', 
        colorClasses: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300 bg-indigo-500', 
        description: 'Business operations & market analysis' 
      },
      'Financial': { 
        name: 'Financial Agent', 
        type: 'financial', 
        colorClasses: 'bg-green-500/10 border-green-500/20 text-green-300 bg-green-500', 
        description: 'Financial metrics & risk assessment' 
      },
      'HR': { 
        name: 'HR Agent', 
        type: 'hr', 
        colorClasses: 'bg-purple-500/10 border-purple-500/20 text-purple-300 bg-purple-500', 
        description: 'Human resources & workforce analysis' 
      },
      'IP': { 
        name: 'IP Agent', 
        type: 'ip', 
        colorClasses: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300 bg-yellow-500', 
        description: 'Intellectual property & technology analysis' 
      },
      'Research': { 
        name: 'Research Agent', 
        type: 'research', 
        colorClasses: 'bg-teal-500/10 border-teal-500/20 text-teal-300 bg-teal-500', 
        description: 'Research & development analysis' 
      }
    };
    
    return agentMap[agentType] || { 
      name: `${agentType} Agent`, 
      type: agentType.toLowerCase(), 
      colorClasses: 'bg-gray-500/10 border-gray-500/20 text-gray-300 bg-gray-500', 
      description: 'Specialized analysis' 
    };
  };

  const assignedAgents = getAssignedAgents();

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
      <div className="bg-dark-lighter rounded-lg max-w-7xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-dark">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">{latestDocument.name}</h2>
              <div className="flex items-center space-x-4 text-sm text-gray-400">
                <span>Type: {latestDocument.documentType || latestDocument.type}</span>
                <span>Category: {latestDocument.category || 'General'}</span>
                <span>Size: {(latestDocument.size / 1024).toFixed(1)} KB</span>
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

        <div className="p-6 overflow-y-auto max-h-[85vh]">
          <Tabs defaultValue="analysis" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
              <TabsTrigger value="pdf" disabled={!document.name?.toLowerCase().endsWith('.pdf')}>
                PDF Viewer {!document.name?.toLowerCase().endsWith('.pdf') && '(PDF only)'}
              </TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>
            
            <TabsContent value="analysis" className="mt-4">
              {/* Agent Assignment Section */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-white mb-3">Assigned Agents</h3>
                {assignedAgents.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {assignedAgents.map((agent: any, index: number) => {
                      const colorClasses = agent.colorClasses.split(' ');
                      return (
                        <div key={index} className={`${colorClasses[0]} border ${colorClasses[1]} rounded-lg p-3`}>
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${colorClasses[3]}`}></div>
                            <span className={`${colorClasses[2]} font-medium text-sm`}>{agent.name}</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">{agent.description}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-3">
                    <div className="text-center text-gray-400 text-sm">
                      No agents have analyzed this document yet
                    </div>
                  </div>
                )}
              </div>

              {/* AI Document Analysis - Automatically Generated */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-white">AI Document Analysis</h3>
                  <div className="text-sm text-gray-400">
                    {aiSummaryStatus === 'completed' && '✓ Analysis Complete'}
                    {aiSummaryStatus === 'processing' && '⏳ Analyzing...'}
                    {aiSummaryStatus === 'failed' && '⚠ Analysis Failed'}
                    {aiSummaryStatus === 'pending' && '⏳ Processing...'}
                  </div>
                </div>

                {aiSummaryStatus === 'failed' && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
                    <p className="text-red-300 text-sm">AI analysis failed during processing. The document text may be insufficient or processing encountered an error.</p>
                  </div>
                )}

                {(aiSummaryStatus === 'processing' || aiSummaryStatus === 'pending') && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-4">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                      <p className="text-blue-300 text-sm">AI analysis in progress...</p>
                    </div>
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
                          <AlertTriangleIcon className="w-5 h-5 mr-2" />
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

                    {/* Strategic Implications */}
                    {aiSummary.strategicImplications && (
                      <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                        <h4 className="text-md font-medium text-purple-300 mb-3 flex items-center">
                          <span className="mr-2">🎯</span>
                          Strategic Implications
                        </h4>
                        <p className="text-gray-300 leading-relaxed">{aiSummary.strategicImplications}</p>
                      </div>
                    )}

                    {/* Confidence Score */}
                    <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-4">
                      <h4 className="text-md font-medium text-gray-300 mb-3">Analysis Confidence</h4>
                      <div className="flex items-center space-x-3">
                        <div className="flex-1 bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${aiSummary.confidenceScore * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-400">{Math.round(aiSummary.confidenceScore * 100)}%</span>
                      </div>
                    </div>
                  </div>
                )}

                {!aiSummary && aiSummaryStatus !== 'processing' && aiSummaryStatus !== 'pending' && (
                  <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-4">
                    <p className="text-gray-400 text-sm text-center">No AI analysis available for this document</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="pdf" className="mt-4">
              {document.name?.toLowerCase().endsWith('.pdf') ? (
                <InlinePDFPreview document={document} dealId={dealId} />
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400">PDF viewer is only available for PDF documents</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="details" className="mt-4">
              <div className="space-y-6">
                {/* Document Information */}
                <div className="bg-dark border border-gray-600 rounded-lg p-4">
                  <h4 className="text-md font-medium text-white mb-3">Document Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Name:</span>
                      <span className="text-white ml-2">{latestDocument.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Size:</span>
                      <span className="text-white ml-2">{(latestDocument.size / 1024).toFixed(1)} KB</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Type:</span>
                      <span className="text-white ml-2">{latestDocument.documentType || latestDocument.type || 'Unknown'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Category:</span>
                      <span className="text-white ml-2">{latestDocument.category || 'General'}</span>
                    </div>
                    {latestDocument.folderPath && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Path:</span>
                        <span className="text-white ml-2">{latestDocument.folderPath}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* OCR Content Preview */}
                {latestDocument.ocrContent && (
                  <div className="bg-dark border border-gray-600 rounded-lg p-4">
                    <h4 className="text-md font-medium text-white mb-3">Extracted Text (Preview)</h4>
                    <div className="bg-gray-900 rounded p-3 max-h-64 overflow-y-auto">
                      <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                        {latestDocument.ocrContent.substring(0, 1000)}
                        {latestDocument.ocrContent.length > 1000 && '...'}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex space-x-3">
                  <Button onClick={handleDownload} variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white">
                    <DownloadIcon className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  {document.name?.toLowerCase().endsWith('.pdf') && (
                    <Button 
                      onClick={() => window.open(`/api/documents/${document.id}/preview`, '_blank')}
                      variant="outline" 
                      className="border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white"
                    >
                      <EyeIcon className="w-4 h-4 mr-2" />
                      Open PDF
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

// Memoized folder tree component for performance
const FolderTree = memo<{
  node: FolderNode;
  level: number;
  onToggle: (path: string) => void;
  onDocumentClick: (document: Document) => void;
  isSelectionMode: boolean;
  selectedFiles: Set<number>;
  onFileSelection: (fileId: number, checked: boolean) => void;
}>(({ node, level, onToggle, onDocumentClick, isSelectionMode, selectedFiles, onFileSelection }) => {
  return (
    <div>
      {/* Folder Header */}
      {node.name && (
        <div
          className={`flex items-center space-x-2 py-2 px-3 cursor-pointer hover:bg-dark-lighter rounded-md transition-colors ${
            level === 0 ? 'border-l-4 border-primary' : ''
          }`}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={() => onToggle(node.path)}
        >
          {node.isExpanded ? (
            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRightIcon className="w-4 h-4 text-gray-400" />
          )}
          <FolderIcon className="w-4 h-4 text-yellow-500" />
          <span className="text-white text-sm font-medium">{node.name}</span>
          <span className="text-xs text-gray-500 ml-auto">
            {node.documents.length} files
          </span>
        </div>
      )}

      {/* Folder Contents */}
      {node.isExpanded && (
        <div>
          {/* Documents in this folder */}
          {node.documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center space-x-3 py-2 px-3 hover:bg-dark-lighter cursor-pointer rounded-md transition-colors group"
              style={{ paddingLeft: `${(level + 1) * 16 + 12}px` }}
              onClick={() => onDocumentClick(doc)}
              data-testid={`document-${doc.id}`}
            >
              {isSelectionMode && (
                <Checkbox
                  checked={selectedFiles.has(doc.id)}
                  onCheckedChange={(checked) => onFileSelection(doc.id, !!checked)}
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`checkbox-document-${doc.id}`}
                />
              )}
              
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <div className="flex-shrink-0">
                  {doc.name.endsWith('.pdf') ? (
                    <FileTextIcon className="w-4 h-4 text-red-400" />
                  ) : doc.name.match(/\.(jpg|jpeg|png|gif|bmp|svg)$/i) ? (
                    <FileIcon className="w-4 h-4 text-green-400" />
                  ) : doc.name.match(/\.(doc|docx|txt|rtf)$/i) ? (
                    <FileTextIcon className="w-4 h-4 text-blue-400" />
                  ) : doc.name.match(/\.(xls|xlsx|csv)$/i) ? (
                    <FileIcon className="w-4 h-4 text-green-400" />
                  ) : doc.name.match(/\.(ppt|pptx)$/i) ? (
                    <FileIcon className="w-4 h-4 text-orange-400" />
                  ) : (
                    <FileIcon className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-300 truncate">{doc.name}</div>
                </div>
                
                <div className="flex items-center space-x-2 flex-shrink-0">
                  {/* OCR Status */}
                  {doc.ocrContent && doc.ocrContent.length > 0 && (
                    <div title="OCR completed">
                      <CheckCircleIcon className="w-3 h-3 text-green-500" />
                    </div>
                  )}
                  {(!doc.ocrContent || doc.ocrContent.length === 0) && !doc.name.endsWith('.zip') && (
                    <div title="OCR pending">
                      <ClockIcon className="w-3 h-3 text-yellow-500" />
                    </div>
                  )}
                  
                  {/* AI Summary Status */}
                  {(doc as any).aiSummary && (doc as any).aiSummaryStatus !== 'processing' && (
                    <div title="AI summary completed">
                      <Brain className="w-3 h-3 text-purple-400" />
                    </div>
                  )}
                  {((doc as any).aiSummaryStatus === 'processing' || (doc as any).aiSummaryStatus === 'analyzing') && (
                    <div title="AI summary processing">
                      <Brain className="w-3 h-3 text-blue-400 animate-pulse" />
                    </div>
                  )}
                  {(doc as any).aiSummaryStatus === 'extracting' && (
                    <div title="Extracting text">
                      <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />
                    </div>
                  )}
                  
                  <div title="View document">
                    <EyeIcon className="w-3 h-3 text-gray-500 group-hover:text-gray-300" />
                  </div>
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
});

export const DataRoomExplorer: React.FC<DataRoomExplorerProps> = ({ dealId, onUploadComplete }) => {
  // 🚨 CRITICAL FIX: ALL useState hooks MUST be at the very top before any other hooks or logic
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfDocument, setPdfDocument] = useState<Document | null>(null);
  const [folderStates, setFolderStates] = useState<Map<string, boolean>>(new Map());
  const [folderName, setFolderName] = useState('Data Room Documents');
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showAdditionalUpload, setShowAdditionalUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ sessionId?: string; fileName: string; progress: number; status: string } | null>(null);
  // Local state for immediate UI feedback - synced with persistent upload service
  const [chunkedUploadProgress, setChunkedUploadProgress] = useState<ChunkedUploadProgress | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  // 🚨 CRITICAL FIX: ALL useRef hooks after useState but before useQuery/useEffect
  const fileInputRef = useRef<HTMLInputElement>(null);
  const additionalFileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Query for documents
  const { data: paginatedData, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: [`/api/deals/${dealId}/documents`],
    enabled: !!dealId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: 1,
    retryDelay: 500,
    queryFn: async () => {
      const response = await fetch(`/api/deals/${dealId}/documents`, {
        credentials: 'include',
        signal: AbortSignal.timeout(30000),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const documentCount = Array.isArray(data) ? data.length : data.documents?.length || 0;
      console.log(`✅ DataRoomExplorer received ${documentCount} documents for deal ${dealId}`);
      return data || [];
    }
  });

  // Extract documents from paginated response for backward compatibility
  const documents = Array.isArray(paginatedData) ? paginatedData : paginatedData?.documents || [];
  
  // Resume monitoring active uploads on mount or dealId change
  useEffect(() => {
    const checkActiveUploads = async () => {
      const activeUploads = backgroundUploadService.getActiveUploads();
      
      if (activeUploads.length > 0) {
        console.log('🔄 Found active uploads, resuming monitoring:', activeUploads);
        
        // Resume monitoring the first active upload
        const sessionId = activeUploads[0];
        
        // Get upload details from persistent storage
        try {
          const response = await fetch(`/api/persistent-uploads/${sessionId}`);
          if (response.ok) {
            const session = await response.json();
            
            // Resume monitoring with progress callback
            backgroundUploadService.resumeUploadMonitoring(sessionId, {
              dealId,
              file: new File([], session.fileName), // Placeholder file
              onProgress: (progress) => {
                console.log(`📊 Resumed upload progress: ${progress.progress}%`);
                setUploadProgress({
                  sessionId: progress.sessionId,
                  fileName: progress.fileName,
                  progress: progress.progress,
                  status: progress.status
                });
                setActiveSessionId(progress.sessionId);
              },
              onComplete: (completedSessionId) => {
                console.log(`✅ Resumed upload completed: ${completedSessionId}`);
                setUploadProgress(null);
                setActiveSessionId(null);
                queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
                if (onUploadComplete) {
                  onUploadComplete();
                }
              },
              onError: (error) => {
                console.error(`❌ Resumed upload failed: ${error}`);
                setUploadProgress(null);
                setActiveSessionId(null);
              }
            });
          }
        } catch (error) {
          console.error('Failed to resume upload monitoring:', error);
        }
      }
    };
    
    checkActiveUploads();
  }, [dealId, onUploadComplete]); // Removed queryClient from dependencies as it doesn't change
  
  // Store last non-empty documents to prevent UI flicker during processing
  const lastNonEmptyDocumentsRef = useRef<Document[]>([]);
  const lastNonEmptyFolderTreeRef = useRef<FolderNode | null>(null);
  
  // Update refs when we have valid documents
  useEffect(() => {
    if (documents && documents.length > 0 && !isFetching) {
      lastNonEmptyDocumentsRef.current = documents;
    }
  }, [documents, isFetching]);
  
  // Use last known documents during fetching to prevent UI flicker
  const stableDocuments = (isFetching && documents.length === 0) 
    ? lastNonEmptyDocumentsRef.current 
    : documents;

  // Enhanced document click handler with PDF viewing support
  const handleDocumentClick = (document: Document) => {
    // Always show document detail modal with extracted content and AI summary
    setSelectedDocument(document);
  };

  // ZIP upload mutation with background upload service
  const uploadZipMutation = useMutation({
    mutationFn: async (file: File) => {
      console.log(`🚀 Starting background ZIP upload: ${file.name}, Size: ${(file.size / 1024 / 1024).toFixed(1)}MB`);

      try {
        // ALL ZIP uploads use background service which creates persistent sessions
        const sessionId = await backgroundUploadService.startZipUpload({
          dealId,
          file,
          onProgress: (progress) => {
            console.log(`📊 Upload progress: ${progress.progress}%`);
            // 🔧 FIX: Only show ONE upload progress bar to avoid duplication
            setUploadProgress(null); // Clear the blue progress bar
            setChunkedUploadProgress({
              fileName: progress.fileName,
              progress: progress.progress,
              status: progress.status === 'uploading' ? `Uploading to cloud (${progress.progress}%)...` : progress.status,
              speed: 0,
              currentChunk: undefined,
              totalChunks: undefined
            });
            setActiveSessionId(progress.sessionId);
          },
          onComplete: (sessionId) => {
            console.log(`✅ Background upload completed: ${sessionId}`);
            setUploadProgress(null);
            setChunkedUploadProgress(null);
            setActiveSessionId(null);
            queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
            if (onUploadComplete) {
              onUploadComplete();
            }
          },
          onError: (error) => {
            console.error(`❌ Background upload failed: ${error}`);
            setUploadProgress(null);
            setChunkedUploadProgress(null);
            setActiveSessionId(null);
            alert(`Upload failed: ${error}`);
          }
        });

        console.log(`📝 Started background upload session: ${sessionId}`);
        setActiveSessionId(sessionId);
        return { sessionId, success: true };
      } catch (error) {
        console.error('Failed to start background upload:', error);
        throw error;
      }
    },
    onSuccess: () => {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (error) => {
      console.error('ZIP upload failed:', error);
      setUploadProgress(null);
      alert(`Upload failed: ${error.message}`);
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
    onSuccess: async () => {
      setUploadProgress(null);
      await queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
      await queryClient.refetchQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
      
      if (additionalFileInputRef.current) {
        additionalFileInputRef.current.value = '';
      }
      setShowAdditionalUpload(false);
    },
    onError: (error) => {
      console.error('Files upload failed:', error);
      setUploadProgress(null);
      alert(`Upload failed: ${error.message}`);
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
    onMutate: async (fileIds) => {
      await queryClient.cancelQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
      
      const previousDocuments = queryClient.getQueryData([`/api/deals/${dealId}/documents`]);
      
      queryClient.setQueryData([`/api/deals/${dealId}/documents`], (old: any) => {
        if (!old) return old;
        
        if (Array.isArray(old)) {
          return old.filter((doc: any) => !fileIds.includes(doc.id));
        } else if (old?.documents) {
          return {
            ...old,
            documents: old.documents.filter((doc: any) => !fileIds.includes(doc.id)),
            total: Math.max(0, (old.total || 0) - fileIds.length)
          };
        }
        return old;
      });
      
      setSelectedFiles(new Set());
      setIsSelectionMode(false);
      
      return { previousDocuments };
    },
    onSuccess: async (data) => {
      console.log('Files deleted successfully:', data);
      
      await queryClient.removeQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
      await queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
      await refetch();
      
      if (data && data.deletedCount) {
        console.log(`✅ Successfully deleted ${data.deletedCount} file${data.deletedCount > 1 ? 's' : ''}`);
      }
    },
    onError: (error, fileIds, context) => {
      console.error('File deletion failed:', error);
      
      if (context?.previousDocuments) {
        queryClient.setQueryData([`/api/deals/${dealId}/documents`], context.previousDocuments);
      }
      
      setSelectedFiles(new Set(fileIds));
      setIsSelectionMode(true);
      
      alert(`Failed to delete files: ${error.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
    }
  });

  const handleZipUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      alert('Please select a ZIP file');
      return;
    }

    uploadZipMutation.mutate(file);
  };

  const handleAdditionalFilesUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

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

  // Build folder tree
  const buildFolderTree = (docs: Document[]): { folderTree: FolderNode; emailAttachments: Document[] } => {
    if (!docs || docs.length === 0) {
      return {
        folderTree: { name: '', path: '', children: new Map(), documents: [], isExpanded: true },
        emailAttachments: []
      };
    }
    
    // Separate email attachments from regular documents
    const emailAttachments = docs.filter(doc => 
      doc.folderPath?.includes('email-attachments') || 
      doc.path?.includes('email-attachments')
    );
    const regularDocs = docs.filter(doc => 
      !doc.folderPath?.includes('email-attachments') && 
      !doc.path?.includes('email-attachments')
    );
    
    const root: FolderNode = {
      name: '',
      path: '',
      children: new Map(),
      documents: [],
      isExpanded: true
    };

    regularDocs.forEach((doc) => {
      let folderPath = doc.folderPath || doc.path || '';
      
      if (folderPath.includes('extracted/') || folderPath.includes('/')) {
        const pathSegments = folderPath.split('/');
        if (pathSegments.length > 1 && pathSegments[pathSegments.length - 1].includes('.')) {
          pathSegments.pop();
          folderPath = pathSegments.join('/');
        }
      }
      
      const pathParts = folderPath ? folderPath.split('/').filter(Boolean) : [];
      
      let currentNode = root;
      let currentPath = '';

      pathParts.forEach((part: string, index: number) => {
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

      currentNode.documents.push(doc);
    });

    return { folderTree: root, emailAttachments };
  };

  const toggleFolder = (path: string) => {
    setFolderStates(prev => {
      const newStates = new Map(prev);
      newStates.set(path, !newStates.get(path));
      return newStates;
    });
  };

  // Ultra-smart folder tree with progressive building
  const { folderTree, emailAttachments } = useMemo(() => {
    const docsToUse = stableDocuments;
    
    if (!docsToUse || docsToUse.length === 0) {
      if (!isFetching && lastNonEmptyDocumentsRef.current.length === 0) {
        return { 
          folderTree: { name: '', path: '', children: new Map(), documents: [], isExpanded: true },
          emailAttachments: [] 
        };
      }
      if (lastNonEmptyFolderTreeRef.current) {
        return {
          folderTree: lastNonEmptyFolderTreeRef.current,
          emailAttachments: []
        };
      }
    }
    
    const result = buildFolderTree(docsToUse);
    
    if (result.folderTree.documents.length > 0 || result.folderTree.children.size > 0) {
      lastNonEmptyFolderTreeRef.current = result.folderTree;
    }
    
    return result;
  }, [stableDocuments, deleteFilesMutation.isSuccess, isFetching, folderStates]);

  if (isLoading) {
    return (
      <div className="bg-dark-lighter rounded-lg">
        <div className="p-4 border-b border-dark">
          <div className="animate-pulse">
            <div className="h-6 bg-dark rounded mb-2 w-1/3"></div>
            <div className="h-4 bg-dark rounded w-1/2"></div>
          </div>
        </div>
        <div className="p-4">
          <div className="animate-pulse space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="h-4 w-4 bg-dark rounded"></div>
                <div className="h-4 bg-dark rounded flex-1"></div>
                <div className="h-3 w-16 bg-dark rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  // Check if we have only email attachments but no regular documents
  const hasOnlyEmailAttachments = documents && Array.isArray(documents) && documents.length > 0 && 
    documents.every(doc => doc.folderPath?.includes('email-attachments'));

  const showEmptyState = (!documents || !Array.isArray(documents) || documents.length === 0) && !hasOnlyEmailAttachments;
  
  if (showEmptyState) {
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
              data-testid="input-folder-name"
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
                data-testid="input-zip-file"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadZipMutation.isPending}
                variant="outline"
                className="border-primary text-primary hover:bg-primary hover:text-white"
                data-testid="button-upload-zip"
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

          {/* Chunked Upload Progress Display for Large Files */}
          {chunkedUploadProgress && (
            <div className="space-y-3 p-4 bg-dark border border-green-600 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin text-green-400" />
                  <span className="text-sm font-medium text-white">{chunkedUploadProgress.fileName}</span>
                </div>
                <span className="text-sm text-green-400">{chunkedUploadProgress.progress.toFixed(1)}%</span>
              </div>
              
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-green-500 to-green-400 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${chunkedUploadProgress.progress}%` }}
                />
              </div>
              
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{chunkedUploadProgress.status}</span>
                <div className="flex items-center space-x-4">
                  {chunkedUploadProgress.speed > 0 && (
                    <span>Speed: {(chunkedUploadProgress.speed / 1024 / 1024).toFixed(1)} MB/s</span>
                  )}
                  {chunkedUploadProgress.currentChunk !== undefined && chunkedUploadProgress.totalChunks && (
                    <span>Chunk: {chunkedUploadProgress.currentChunk + 1}/{chunkedUploadProgress.totalChunks}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-lighter rounded-lg">
      <div className="p-4 border-b border-dark">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-white">Data Room Explorer</h3>
            <p className="text-sm text-gray-400 mt-1">
              {documents.length} documents • AI-powered analysis and insights
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Selection Mode Toggle */}
            <Button
              onClick={() => setIsSelectionMode(!isSelectionMode)}
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
              data-testid="button-toggle-selection"
            >
              {isSelectionMode ? 'Cancel' : 'Select'}
            </Button>

            {/* Add Files Button */}
            <Button
              onClick={() => setShowAdditionalUpload(!showAdditionalUpload)}
              variant="outline"
              size="sm"
              className="border-primary text-primary hover:bg-primary hover:text-white"
              data-testid="button-add-files"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Files
            </Button>
          </div>
        </div>

        {/* Selection Mode Controls */}
        {isSelectionMode && (
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Checkbox
                checked={selectedFiles.size === documents.length && documents.length > 0}
                onCheckedChange={handleSelectAll}
                data-testid="checkbox-select-all"
              />
              <span className="text-sm text-gray-300">
                {selectedFiles.size} of {documents.length} selected
              </span>
            </div>
            
            {selectedFiles.size > 0 && (
              <Button
                onClick={handleDeleteSelected}
                variant="destructive"
                size="sm"
                disabled={deleteFilesMutation.isPending}
                data-testid="button-delete-selected"
              >
                {deleteFilesMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <TrashIcon className="h-4 w-4 mr-1" />
                )}
                Delete ({selectedFiles.size})
              </Button>
            )}
          </div>
        )}

        {/* Additional Upload Interface */}
        {showAdditionalUpload && (
          <div className="mt-4 p-4 bg-dark border border-gray-600 rounded-lg">
            <div className="space-y-3">
              <Label htmlFor="additionalFiles" className="text-white">Upload Additional Files</Label>
              <Input
                ref={additionalFileInputRef}
                id="additionalFiles"
                type="file"
                multiple
                onChange={handleAdditionalFilesUpload}
                disabled={uploadFilesMutation.isPending}
                className="cursor-pointer bg-dark-lighter border-gray-600 text-white"
                data-testid="input-additional-files"
              />
            </div>
          </div>
        )}

        {/* Upload Progress for Additional Files */}
        {uploadProgress && !uploadZipMutation.isPending && (
          <div className="mt-4 space-y-2 p-4 bg-dark border border-gray-600 rounded-lg">
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
      </div>

      <div className="p-4">
        {/* Background Job Progress Component */}
        <BackgroundJobProgress dealId={dealId} />

        {/* Folder Tree */}
        <div className="space-y-1">
          <FolderTree
            node={folderTree}
            level={0}
            onToggle={toggleFolder}
            onDocumentClick={handleDocumentClick}
            isSelectionMode={isSelectionMode}
            selectedFiles={selectedFiles}
            onFileSelection={handleFileSelection}
          />
        </div>

        {/* Email Attachments Section */}
        {emailAttachments.length > 0 && (
          <div className="mt-6 border-t border-gray-600 pt-4">
            <h4 className="text-md font-medium text-white mb-3 flex items-center">
              <span className="mr-2">📧</span>
              Email Attachments ({emailAttachments.length})
            </h4>
            <div className="space-y-1">
              {emailAttachments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center space-x-3 py-2 px-3 hover:bg-dark-lighter cursor-pointer rounded-md transition-colors group"
                  onClick={() => handleDocumentClick(doc)}
                  data-testid={`email-attachment-${doc.id}`}
                >
                  {isSelectionMode && (
                    <Checkbox
                      checked={selectedFiles.has(doc.id)}
                      onCheckedChange={(checked) => handleFileSelection(doc.id, !!checked)}
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`checkbox-email-${doc.id}`}
                    />
                  )}
                  
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <FileIcon className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span className="text-gray-300 text-sm flex-1">{doc.name}</span>
                    <div className="flex items-center space-x-2">
                      {/* OCR Completion Status */}
                      {doc.ocrContent && doc.ocrContent.length > 0 && (
                        <div title="OCR completed">
                          <CheckCircleIcon className="w-3 h-3 text-green-500" />
                        </div>
                      )}
                      {(!doc.ocrContent || doc.ocrContent.length === 0) && !doc.name.endsWith('.zip') && (
                        <div title="OCR pending">
                          <ClockIcon className="w-3 h-3 text-yellow-500" />
                        </div>
                      )}
                      
                      {/* AI Summary Status */}
                      {(doc as any).aiSummary && (doc as any).aiSummaryStatus !== 'processing' && (
                        <div title="AI summary completed">
                          <Brain className="w-3 h-3 text-purple-400" />
                        </div>
                      )}
                      {((doc as any).aiSummaryStatus === 'processing' || (doc as any).aiSummaryStatus === 'analyzing') && (
                        <div title="AI summary processing - analyzing document">
                          <Brain className="w-3 h-3 text-blue-400 animate-pulse" />
                        </div>
                      )}
                      {(doc as any).aiSummaryStatus === 'extracting' && (
                        <div title="Extracting text from document">
                          <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />
                        </div>
                      )}
                      {!(doc as any).aiSummary && !(doc as any).aiSummaryStatus && doc.ocrContent && doc.ocrContent.length > 0 && (
                        <div title="AI summary pending">
                          <Brain className="w-3 h-3 text-gray-400" />
                        </div>
                      )}
                      
                      {/* File Actions */}
                      <div title="View document">
                        <EyeIcon className="w-3 h-3 text-gray-500" />
                      </div>
                      <span className="text-xs text-gray-500">{(doc.size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No documents message or upload interface when only email attachments exist */}
        {folderTree.children.size === 0 && folderTree.documents.length === 0 && (
          <div className="p-6">
            {emailAttachments.length > 0 ? (
              // Show upload interface when email attachments exist but no regular documents
              <div className="relative">
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5 rounded-xl"></div>
                
                <div className="relative space-y-6 p-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
                      <UploadIcon className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Upload Documents</h3>
                    <p className="text-gray-400 text-sm">Add additional documents to your data room for AI analysis</p>
                  </div>
                  
                  {/* Folder Name Input */}
                  <div className="space-y-3">
                    <Label htmlFor="folderName" className="text-white text-sm font-medium">Folder Name</Label>
                    <Input
                      id="folderName"
                      value={folderName}
                      onChange={(e) => setFolderName(e.target.value)}
                      placeholder="Enter folder name"
                      className="bg-dark-lighter border-gray-600 text-white rounded-lg focus:border-primary focus:ring-primary/20"
                      data-testid="input-folder-name-alt"
                    />
                  </div>

                  {/* ZIP Upload */}
                  <div className="space-y-3">
                    <Label htmlFor="zipFile" className="text-white text-sm font-medium">Upload ZIP File</Label>
                    <div className="relative">
                      <Input
                        ref={fileInputRef}
                        id="zipFile"
                        type="file"
                        accept=".zip"
                        onChange={handleZipUpload}
                        disabled={uploadZipMutation.isPending}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        data-testid="input-zip-file-alt"
                      />
                      <div className="border-2 border-dashed border-primary/40 rounded-xl p-6 bg-gradient-to-br from-primary/5 to-blue-500/5 hover:border-primary/60 transition-all duration-300 hover:bg-primary/10">
                        <div className="flex items-center justify-center space-x-3">
                          <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                            {uploadZipMutation.isPending ? (
                              <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            ) : (
                              <UploadIcon className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div className="text-center">
                            <p className="text-white font-medium">
                              {uploadZipMutation.isPending ? 'Uploading...' : 'Drop ZIP file here or click to browse'}
                            </p>
                            <p className="text-gray-400 text-xs mt-1">Maximum file size: 5GB (automatic chunked upload)</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 🔧 FIX: Removed duplicate blue upload progress - only show chunked progress below */}

                  {/* Chunked Upload Progress */}
                  {chunkedUploadProgress && (
                    <div className="space-y-3 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl backdrop-blur-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                          </div>
                          <div>
                            <p className="text-sm text-white font-medium">{chunkedUploadProgress.fileName}</p>
                            <p className="text-xs text-purple-300">
                              {chunkedUploadProgress.status === 'initializing' && 'Preparing large file upload...'}
                              {chunkedUploadProgress.status === 'uploading' && `Uploading chunk ${(chunkedUploadProgress.currentChunk ?? 0) + 1}/${chunkedUploadProgress.totalChunks}`}
                              {chunkedUploadProgress.status === 'assembling' && 'Assembling file on server...'}
                              {chunkedUploadProgress.status === 'complete' && 'Upload complete!'}
                              {chunkedUploadProgress.status === 'error' && 'Upload failed'}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm text-purple-300 font-medium">{chunkedUploadProgress.progress.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-purple-500 to-pink-400 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${chunkedUploadProgress.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Error Display */}
                  {uploadZipMutation.error && (
                    <Alert className="border-red-500/50 bg-red-900/20 rounded-xl">
                      <AlertTriangleIcon className="h-4 w-4" />
                      <AlertDescription className="text-red-300">
                        Upload failed: {uploadZipMutation.error.message}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            ) : (
              // Show default message when no documents at all
              <div className="relative">
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-blue-500/10 rounded-xl"></div>
                
                <div className="relative text-center py-12 px-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-blue-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-primary/20">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary/30 to-blue-500/30 rounded-2xl flex items-center justify-center">
                      <UploadIcon className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-semibold text-white mb-3">No Documents Yet</h3>
                  <p className="text-gray-400 text-sm mb-8 max-w-md mx-auto">
                    Upload a ZIP file containing your documents to get started. 
                    Our AI will automatically extract and analyze all files.
                  </p>
                  
                  <div className="flex flex-col items-center space-y-4">
                    <div className="flex items-center space-x-6 text-xs text-gray-400">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        <span>PDF Support</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                        <span>Office Documents</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                        <span>Images</span>
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-500">
                      Connect your data room to start analyzing documents with AI
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedDocument && (
        <DocumentDetailModal
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
          dealId={dealId}
          refetch={refetch}
        />
      )}

      {pdfDocument && (
        <PDFViewer
          documentId={pdfDocument.id}
          documentName={pdfDocument.name}
          open={pdfViewerOpen}
          onOpenChange={(open) => {
            setPdfViewerOpen(open);
            if (!open) {
              setPdfDocument(null);
            }
          }}
        />
      )}
    </div>
  );
};