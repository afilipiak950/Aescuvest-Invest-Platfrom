import React, { useState, useRef, useEffect } from 'react';
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

const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({ document, isOpen, onClose, dealId, refetch }) => {
  const queryClient = useQueryClient();
  
  // Fetch agent analyses to determine which agents processed this document
  const { data: agentAnalyses, refetch: refetchAnalyses } = useQuery({
    queryKey: [`/api/analyses/${dealId}`],
    enabled: isOpen
  });

  // Monitor background jobs and auto-refresh when processing completes
  const { data: backgroundJobs } = useQuery({
    queryKey: [`/api/background-jobs/${dealId}`],
    enabled: isOpen && !!dealId,
    refetchInterval: 2000
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
  
  if (!isOpen) return null;

  const analysis = document.analyses ? JSON.parse(document.analyses) : null;
  const analysisData = analysis?.analysis || analysis;
  
  // Get AI summary from document data (automatically generated during upload)
  const aiSummary = document.aiSummary as AIDocumentSummary | null;
  const aiSummaryStatus = document.aiSummaryStatus || 'pending';

  // Intelligent document-to-agent assignment based on weighted analysis
  const getAssignedAgents = () => {
    // Use the assignedAgents field populated by the intelligent assignment system
    if (document.assignedAgents && Array.isArray(document.assignedAgents) && document.assignedAgents.length > 0) {
      console.log(`📋 Document "${document.name}" assigned to agents:`, document.assignedAgents);
      return document.assignedAgents.map(agentType => {
        // Capitalize the agent type for display
        const capitalizedType = agentType.charAt(0).toUpperCase() + agentType.slice(1);
        return getAgentInfo(capitalizedType);
      });
    }
    
    console.log(`⚠️ Document "${document.name}" has no intelligent assignments - showing as unassigned`);
    return [];
  };

  // Sophisticated scoring algorithm for agent relevance
  const calculateAgentRelevanceScores = (docName: string, content: string, aiSummary: any) => {
    const scores = {
      clinical: 0,
      legal: 0,
      commercial: 0,
      financial: 0,
      hr: 0,
      ip: 0,
      research: 0
    };
    
    // Define weighted keywords and patterns for each agent
    const agentKeywords = {
      clinical: {
        high: ['clinical', 'medical', 'fda', 'ce mark', 'regulatory', 'trial', 'patient', 'safety', 'efficacy', 'device', 'pharma', 'therapeutic', 'healthcare', 'treatment', 'diagnosis', 'protocol', 'approval', 'submission'],
        medium: ['health', 'study', 'test', 'validation', 'verification', 'quality', 'compliance', 'risk', 'benefit', 'outcome'],
        low: ['report', 'data', 'analysis', 'documentation', 'procedure']
      },
      legal: {
        high: ['contract', 'agreement', 'legal', 'license', 'patent', 'trademark', 'copyright', 'litigation', 'compliance', 'regulatory', 'terms', 'conditions', 'confidential', 'nda', 'employment', 'consulting', 'executed', 'signed'],
        medium: ['policy', 'clause', 'obligation', 'liability', 'indemnity', 'warranty', 'jurisdiction', 'governing', 'dispute'],
        low: ['document', 'provision', 'section', 'amendment', 'addendum']
      },
      commercial: {
        high: ['market', 'sales', 'revenue', 'customer', 'business', 'strategy', 'competition', 'pricing', 'distribution', 'partnership', 'commercial', 'marketing', 'competitive'],
        medium: ['opportunity', 'growth', 'segment', 'channel', 'brand', 'positioning', 'landscape', 'analysis'],
        low: ['product', 'service', 'offering', 'value', 'proposition']
      },
      financial: {
        high: ['financial', 'revenue', 'cost', 'expense', 'profit', 'loss', 'cash', 'flow', 'budget', 'forecast', 'valuation', 'investment', 'funding', 'accounting', 'tax', 'audit'],
        medium: ['balance', 'sheet', 'income', 'statement', 'margin', 'ebitda', 'capex', 'opex', 'burn', 'rate'],
        low: ['money', 'amount', 'payment', 'financial', 'economic']
      },
      hr: {
        high: ['employee', 'employment', 'salary', 'compensation', 'benefit', 'payroll', 'hiring', 'staff', 'personnel', 'human', 'resources', 'workforce', 'organizational'],
        medium: ['talent', 'recruitment', 'training', 'development', 'performance', 'culture', 'retention'],
        low: ['team', 'people', 'management', 'organization']
      },
      ip: {
        high: ['patent', 'trademark', 'copyright', 'intellectual', 'property', 'invention', 'innovation', 'proprietary', 'technology', 'licensing', 'royalty'],
        medium: ['trade', 'secret', 'know-how', 'technical', 'specification', 'design', 'algorithm'],
        low: ['technology', 'development', 'research', 'innovation']
      },
      research: {
        high: ['research', 'development', 'r&d', 'innovation', 'prototype', 'experiment', 'methodology', 'findings', 'study', 'analysis', 'technical'],
        medium: ['data', 'result', 'conclusion', 'hypothesis', 'testing', 'validation', 'verification'],
        low: ['investigation', 'exploration', 'discovery', 'advancement']
      }
    };
    
    // Calculate base scores from keyword matching
    Object.entries(agentKeywords).forEach(([agent, keywords]) => {
      let score = 0;
      
      // High-weight keywords (3x multiplier)
      keywords.high.forEach(keyword => {
        const matches = (content.match(new RegExp(keyword, 'g')) || []).length;
        score += matches * 3;
      });
      
      // Medium-weight keywords (2x multiplier)
      keywords.medium.forEach(keyword => {
        const matches = (content.match(new RegExp(keyword, 'g')) || []).length;
        score += matches * 2;
      });
      
      // Low-weight keywords (1x multiplier)
      keywords.low.forEach(keyword => {
        const matches = (content.match(new RegExp(keyword, 'g')) || []).length;
        score += matches * 1;
      });
      
      scores[agent as keyof typeof scores] = score;
    });
    
    // Apply document type and AI summary boosters
    if (aiSummary) {
      // Boost scores based on AI summary document type
      const docType = aiSummary.documentType?.toLowerCase() || '';
      if (docType.includes('financial') || docType.includes('budget')) scores.financial *= 1.5;
      if (docType.includes('legal') || docType.includes('contract')) scores.legal *= 1.5;
      if (docType.includes('clinical') || docType.includes('medical')) scores.clinical *= 1.5;
      if (docType.includes('commercial') || docType.includes('business')) scores.commercial *= 1.5;
      if (docType.includes('hr') || docType.includes('employment')) scores.hr *= 1.5;
      
      // Boost based on AI summary critical findings
      const criticalFindings = (aiSummary.criticalFindings || []).join(' ').toLowerCase();
      const keyFinancialData = (aiSummary.keyFinancialData || []).join(' ').toLowerCase();
      
      if (keyFinancialData.length > 0) scores.financial *= 1.3;
      if (criticalFindings.includes('regulatory') || criticalFindings.includes('compliance')) {
        scores.clinical *= 1.3;
        scores.legal *= 1.3;
      }
    }
    
    // Apply filename pattern boosters
    const fileExtension = docName.split('.').pop() || '';
    if (['xls', 'xlsx', 'csv'].includes(fileExtension)) scores.financial *= 1.4;
    if (docName.includes('contract') || docName.includes('agreement')) scores.legal *= 1.6;
    if (docName.includes('clinical') || docName.includes('trial')) scores.clinical *= 1.6;
    if (docName.includes('employee') || docName.includes('salary')) scores.hr *= 1.6;
    
    // Normalize scores to 0-1 range
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore > 0) {
      Object.keys(scores).forEach(agent => {
        scores[agent as keyof typeof scores] = scores[agent as keyof typeof scores] / maxScore;
      });
    }
    
    return scores;
  };

  // Fallback function to assign agents based on document type and name
  const getDefaultAgentsByDocumentType = () => {
    const docName = document.name.toLowerCase();
    const docType = document.documentType?.toLowerCase() || '';
    const category = document.category?.toLowerCase() || '';
    const defaultAgents: Array<{name: string, type: string, colorClasses: string, description: string}> = [];
    
    // Financial documents
    if (docName.includes('financial') || docName.includes('budget') || docName.includes('revenue') || 
        docName.includes('contract') || docName.includes('agreement') || docName.includes('invoice') ||
        category.includes('financial')) {
      defaultAgents.push(getAgentInfo('Financial'));
    }
    
    // Legal documents
    if (docName.includes('legal') || docName.includes('contract') || docName.includes('agreement') || 
        docName.includes('terms') || docName.includes('compliance') || category.includes('legal')) {
      defaultAgents.push(getAgentInfo('Legal'));
    }
    
    // Commercial documents
    if (docName.includes('marketing') || docName.includes('sales') || docName.includes('business') ||
        docName.includes('strategy') || docName.includes('commercial') || category.includes('commercial')) {
      defaultAgents.push(getAgentInfo('Commercial'));
    }
    
    // Clinical/Health documents
    if (docName.includes('health') || docName.includes('clinical') || docName.includes('medical') ||
        docName.includes('patient') || category.includes('clinical')) {
      defaultAgents.push(getAgentInfo('Clinical'));
    }
    
    // HR documents
    if (docName.includes('hr') || docName.includes('employee') || docName.includes('staff') ||
        docName.includes('personnel') || category.includes('hr')) {
      defaultAgents.push(getAgentInfo('HR'));
    }
    
    // IP documents
    if (docName.includes('patent') || docName.includes('trademark') || docName.includes('intellectual') ||
        docName.includes('copyright') || category.includes('ip')) {
      defaultAgents.push(getAgentInfo('IP'));
    }
    
    // If no specific type detected, assign to Commercial as default
    if (defaultAgents.length === 0) {
      defaultAgents.push(getAgentInfo('Commercial'));
    }
    
    return defaultAgents;
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

        <div className="p-6 overflow-y-auto max-h-[85vh]">
          <Tabs defaultValue="analysis" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
              <TabsTrigger value="pdf" disabled={!document.type?.toLowerCase().includes('pdf')}>
                PDF Viewer
              </TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>
            
            <TabsContent value="analysis" className="mt-4">
              {/* Agent Assignment Section */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-white mb-3">Assigned Agents</h3>
                {assignedAgents.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {assignedAgents.map((agent, index) => {
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

          {/* OCR Text - Enhanced formatting for better readability */}
          {document.ocrText && (
            <div className="mb-6">
              <details className={aiSummary ? '' : 'open'}>
                <summary className="text-lg font-medium text-white mb-3 cursor-pointer hover:text-blue-300 transition-colors flex items-center">
                  <span className="mr-2">📄</span>
                  Extracted Document Text 
                  {document.ocrText.length > 1000 && (
                    <span className="ml-2 text-sm bg-blue-500/20 px-2 py-1 rounded text-blue-300">
                      {Math.round(document.ocrText.length / 1000)}k characters
                    </span>
                  )}
                </summary>
                <div className="bg-gray-900 border border-gray-700 rounded-lg mt-3 overflow-hidden">
                  <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Document Content</span>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => navigator.clipboard.writeText(document.ocrText)}
                          className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-white transition-colors"
                        >
                          Copy Text
                        </button>
                        <span className="text-xs text-gray-500">
                          {document.ocrText.split('\n').length} lines
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 max-h-96 overflow-y-auto">
                    <div className="text-sm text-gray-200 leading-relaxed">
                      {document.ocrText.split('\n').map((line: string, index: number) => (
                        <div key={index} className="mb-2">
                          {line.trim() ? (
                            <p className="text-gray-200">{line}</p>
                          ) : (
                            <div className="h-3"></div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </details>
            </div>
          )}

              {/* OCR Text - Enhanced formatting for better readability */}
              {document.ocrText && (
                <div className="mb-6">
                  <details className={aiSummary ? '' : 'open'}>
                    <summary className="text-lg font-medium text-white mb-3 cursor-pointer hover:text-blue-300 transition-colors flex items-center">
                      <span className="mr-2">📄</span>
                      Extracted Document Text 
                      {document.ocrText.length > 1000 && (
                        <span className="ml-2 text-sm bg-blue-500/20 px-2 py-1 rounded text-blue-300">
                          {Math.round(document.ocrText.length / 1000)}k characters
                        </span>
                      )}
                    </summary>
                    <div className="bg-gray-900 border border-gray-700 rounded-lg mt-3 overflow-hidden">
                      <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">Document Content</span>
                          <div className="flex items-center space-x-2">
                            <button 
                              onClick={() => navigator.clipboard.writeText(document.ocrText)}
                              className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-white transition-colors"
                            >
                              Copy Text
                            </button>
                            <span className="text-xs text-gray-500">
                              {document.ocrText.split('\n').length} lines
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 max-h-96 overflow-y-auto">
                        <div className="text-sm text-gray-200 leading-relaxed">
                          {document.ocrText.split('\n').map((line: string, index: number) => (
                            <div key={index} className="mb-2">
                              {line.trim() ? (
                                <p className="text-gray-200">{line}</p>
                              ) : (
                                <div className="h-3"></div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              )}

            </TabsContent>
            
            <TabsContent value="pdf" className="mt-4">
              {document.type?.toLowerCase().includes('pdf') ? (
                <div className="h-[700px] w-full bg-gray-900 rounded-lg overflow-hidden">
                  <InlinePDFPreview 
                    document={document} 
                    dealId={dealId} 
                    className="w-full h-full"
                  />
                </div>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  PDF viewer is only available for PDF documents
                </div>
              )}
            </TabsContent>

            <TabsContent value="details" className="mt-4">
              {/* Additional Analysis Data */}
              {analysisData && (
                <div className="mb-6">
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-purple-300 mb-3 flex items-center">
                      <span className="mr-2">⚙️</span>
                      Technical Analysis
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  </div>
                </div>
              )}

              {/* Complete OCR & Text Extraction Debug Section */}
              <div className="mb-6">
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-orange-300 mb-3 flex items-center">
                    <span className="mr-2">🔍</span>
                    Complete Text Extraction Debug (Mistral OCR)
                  </h3>
                  
                  {/* Basic Document Info */}
                  <div className="bg-gray-900 border border-gray-600 rounded-lg overflow-hidden mb-4">
                    <div className="bg-gray-800 px-3 py-2 border-b border-gray-600">
                      <span className="text-xs text-gray-400">Document Metadata</span>
                    </div>
                    <div className="p-3">
                      <div className="text-xs text-gray-200 space-y-2">
                        <div><span className="text-orange-300">ID:</span> {document.id}</div>
                        <div><span className="text-orange-300">Name:</span> {document.name}</div>
                        <div><span className="text-orange-300">Type:</span> {document.type}</div>
                        <div><span className="text-orange-300">Size:</span> {(document.size / 1024).toFixed(1)} KB</div>
                        <div><span className="text-orange-300">Status:</span> {document.status}</div>
                        <div><span className="text-orange-300">AI Summary Status:</span> {(document as any).aiSummaryStatus || 'Not processed'}</div>
                      </div>
                    </div>
                  </div>

                  {/* OCR Text Analysis */}
                  <div className="bg-gray-900 border border-gray-600 rounded-lg overflow-hidden mb-4">
                    <div className="bg-gray-800 px-3 py-2 border-b border-gray-600">
                      <span className="text-xs text-gray-400">OCR Text Analysis</span>
                    </div>
                    <div className="p-3">
                      <div className="text-xs text-gray-200 space-y-2">
                        <div><span className="text-orange-300">Has ocrText:</span> {document.ocrText ? 'Yes' : 'No'}</div>
                        <div><span className="text-orange-300">OCR Text type:</span> {typeof document.ocrText}</div>
                        <div><span className="text-orange-300">OCR Text length:</span> {document.ocrText ? document.ocrText.length : 'N/A'}</div>
                        <div><span className="text-orange-300">OCR Text preview:</span> {document.ocrText ? `"${document.ocrText.substring(0, 100)}..."` : 'No text'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Complete Document Object Inspection */}
                  <div className="bg-gray-900 border border-gray-600 rounded-lg overflow-hidden">
                    <div className="bg-gray-800 px-3 py-2 border-b border-gray-600 flex items-center justify-between">
                      <span className="text-xs text-gray-400">Complete Document Object</span>
                      <button 
                        onClick={() => navigator.clipboard.writeText(JSON.stringify(document, null, 2))}
                        className="text-xs bg-orange-600 hover:bg-orange-700 px-2 py-1 rounded text-white transition-colors"
                      >
                        Copy JSON
                      </button>
                    </div>
                    <div className="p-3 max-h-64 overflow-y-auto">
                      <pre className="text-xs text-gray-200 whitespace-pre-wrap font-mono">
                        {JSON.stringify(document, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>

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
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => {
                        queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
                        refetch();
                      }}
                      className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-colors"
                    >
                      <span>Refresh</span>
                    </button>
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
            </TabsContent>
          </Tabs>
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
                  {(doc as any).aiSummaryStatus === 'completed' && <Brain className="w-3 h-3 text-purple-400" />}
                  {(doc as any).aiSummaryStatus === 'processing' && <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />}
                  <AlertCircle className="w-3 h-3 text-amber-500" />
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
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfDocument, setPdfDocument] = useState<Document | null>(null);
  const [folderStates, setFolderStates] = useState<Map<string, boolean>>(new Map());
  const [folderName, setFolderName] = useState('Data Room Documents');
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showAdditionalUpload, setShowAdditionalUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ fileName: string; progress: number; status: string } | null>(null);
  const [isProcessingSummaries, setIsProcessingSummaries] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const additionalFileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [chunkedUploadProgress, setChunkedUploadProgress] = useState<ChunkedUploadProgress | null>(null);
  const [isChunkedUpload, setIsChunkedUpload] = useState(false);

  // Enhanced document click handler with PDF viewing support
  const handleDocumentClick = (document: Document) => {
    // Always show document detail modal with extracted content and AI summary
    setSelectedDocument(document);
  };

  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: [`/api/deals/${dealId}/documents`],
    staleTime: 10000, // Cache for 10 seconds to improve performance
    refetchInterval: 5000, // Reduced polling frequency
    refetchIntervalInBackground: false, // Don't poll in background
    refetchOnWindowFocus: false, // Don't refetch on focus to prevent delays
    retry: 2, // Limit retries
    retryDelay: 1000 // Faster retry
  });

  // Real-time WebSocket listener for immediate AI summary updates
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ai_summary_complete' && data.dealId === dealId) {
          console.log('🔄 AI summary completed, updating cached document...', data);
          // Use setQueryData for instant updates instead of invalidating cache
          queryClient.setQueryData([`/api/deals/${dealId}/documents`], (oldData: any) => {
            if (!oldData || !Array.isArray(oldData)) return oldData;
            return oldData.map(doc => 
              doc.id === data.documentId 
                ? { ...doc, aiSummaryStatus: 'completed', ...data.updates }
                : doc
            );
          });
        }
      } catch (error) {
        // Ignore non-JSON messages
      }
    };

    return () => {
      socket.close();
    };
  }, [dealId, queryClient, refetch]);

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
          } else if (xhr.status === 413) {
            // 413 "Request Entity Too Large" - Cloud Run infrastructure limit
            console.log('⚠️ 413 error detected (Cloud Run limit), falling back to chunked upload');
            reject(new Error('Upload failed: 413 - File upload limit exceeded. The system now supports files up to 50GB. If you are still seeing this error, please contact support as this should not occur with our enhanced configuration.'));
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
    onSuccess: (data) => {
      console.log('Files deleted successfully:', data);
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
      setSelectedFiles(new Set());
      setIsSelectionMode(false);
      
      // Show success notification
      if (data && data.deletedCount) {
        alert(`Successfully deleted ${data.deletedCount} file(s)`);
      }
    },
    onError: (error) => {
      console.error('File deletion failed:', error);
      alert(`Failed to delete files: ${error.message}`);
    }
  });

  // Automatic AI summary processing - triggers once when needed with proper cooldown
  const processAISummariesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/deals/${dealId}/process-ai-summaries`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (data) => {
      console.log('Background AI summary processing response:', data);
      if (data.allComplete) {
        setProcessingComplete(true);
      }
      if (data.cooldown) {
        setProcessingCooldown(true);
        setTimeout(() => setProcessingCooldown(false), 5 * 60 * 1000); // 5 minutes
      }
    },
    onError: (error) => {
      console.error('Background AI summary processing failed:', error);
    }
  });

  // Force complete AI processing mutation for stuck jobs
  const forceCompleteProcessingMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/deals/${dealId}/force-complete-processing`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
      queryClient.invalidateQueries({ queryKey: [`/api/background-jobs/${dealId}`] });
      refetch();
    },
    onError: (error) => {
      console.error('Force complete processing failed:', error);
    }
  });



  // AI Document Assignment mutation
  const assignAgentsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/deals/${dealId}/assign-agents`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (data) => {
      console.log('🤖 AI document assignment completed:', data);
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
      alert(`Successfully assigned agents to ${data.assignments?.length || 0} documents`);
    },
    onError: (error) => {
      console.error('❌ AI document assignment failed:', error);
      alert(`Failed to assign agents: ${error.message}`);
    }
  });



  // Track processing state to prevent duplicates
  const [processingComplete, setProcessingComplete] = useState(false);
  const [processingCooldown, setProcessingCooldown] = useState(false);

  // Disabled automatic AI processing to prevent infinite loops
  // Users can manually trigger AI processing when needed
  // React.useEffect(() => {
  //   // Auto AI processing temporarily disabled for stability
  // }, []);

  const handleZipUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check maximum file size - with GCS, we support up to 5TB
    const maxSize = 5 * 1024 * 1024 * 1024 * 1024; // 5TB with GCS
    if (file.size > maxSize) {
      alert(`File size (${(file.size / 1024 / 1024 / 1024).toFixed(1)}GB) exceeds the maximum limit of 5TB.`);
      return;
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      alert('Please select a ZIP file');
      return;
    }

    console.log(`Uploading ZIP file: ${file.name}, Size: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
    
    // Check if file should use GCS (files over 30MB always use GCS now that it's configured)
    const shouldUseGCS = file.size > 30 * 1024 * 1024;
    
    // 🚀 Use GCS direct upload for large files (bypasses Cloud Run 32MB limit entirely)
    if (shouldUseGCS) {
      console.log(`☁️ Using GCS direct upload for ${(file.size / 1024 / 1024).toFixed(1)}MB file (bypasses Cloud Run limit)`);
      
      try {
        setUploadProgress({
          fileName: file.name,
          progress: 0,
          status: 'Requesting secure upload URL from server...'
        });
        
        // Get signed URL for direct GCS upload
        const urlResponse = await fetch('/api/gcs/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dealId: dealId,
            fileName: file.name,
            contentType: 'application/zip'
          })
        });
        
        if (!urlResponse.ok) {
          throw new Error('Failed to get upload URL');
        }
        
        const { uploadUrl, gcsPath } = await urlResponse.json();
        console.log(`✅ Got signed upload URL for direct GCS upload`);
        
        // Upload directly to GCS (bypasses Cloud Run entirely)
        setUploadProgress({
          fileName: file.name,
          progress: 10,
          status: 'Uploading directly to cloud storage...'
        });
        
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': 'application/zip'
          },
          mode: 'cors' // Explicitly set CORS mode
        });
        
        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text().catch(() => 'No error details');
          console.error(`GCS upload failed with status ${uploadResponse.status}: ${errorText}`);
          throw new Error(`Failed to upload to GCS: ${uploadResponse.status} - ${errorText}`);
        }
        
        console.log(`✅ File uploaded directly to GCS: ${gcsPath}`);
        
        // Register the upload with the server for processing
        setUploadProgress({
          fileName: file.name,
          progress: 90,
          status: 'Registering upload for processing...'
        });
        
        const registerResponse = await fetch('/api/gcs/register-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dealId: dealId,
            gcsPath: gcsPath,
            fileName: file.name,
            fileSize: file.size
          })
        });
        
        if (!registerResponse.ok) {
          throw new Error('Failed to register upload');
        }
        
        const { document, jobId } = await registerResponse.json();
        console.log(`✅ Upload registered with job ID: ${jobId}`);
        
        setUploadProgress({
          fileName: file.name,
          progress: 100,
          status: 'Upload complete! Processing will begin shortly...'
        });
        
        // Clear progress after delay
        setTimeout(() => {
          setUploadProgress(null);
          refetch();
        }, 3000);
        
        return;
      } catch (error: any) {
        console.error('GCS upload failed with error:', error);
        console.error('Error message:', error?.message);
        console.error('Error status:', error?.status);
        console.error('Error details:', error);
        // Fall through to chunked upload
        console.log('📤 Falling back to chunked upload due to GCS error');
      }
    }
    
    // 🚨 CRITICAL: Cloud Run has a 32MB hard limit for HTTP requests
    // Files over 30MB MUST use chunked uploads to avoid 413 errors
    const CLOUD_RUN_LIMIT = 30 * 1024 * 1024; // 30MB (below 32MB limit)
    
    if (file.size > CLOUD_RUN_LIMIT) {
      console.log(`📤 File is ${(file.size / 1024 / 1024).toFixed(1)}MB - using CHUNKED upload to avoid Cloud Run 32MB limit`);
      
      try {
        // Inline chunked upload implementation
        const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        
        setUploadProgress({
          fileName: file.name,
          progress: 0,
          status: `Preparing chunked upload (${totalChunks} chunks)...`
        });
        
        // Initialize chunked upload using GET to bypass Vite interference
        const params = new URLSearchParams({
          fileName: file.name,
          totalSize: file.size.toString(),
          chunkSize: CHUNK_SIZE.toString()
        });
        
        const initResponse = await fetch(`/api/upload/chunk/init?${params.toString()}`, {
          method: 'GET'
        });
        
        if (!initResponse.ok) {
          throw new Error('Failed to initialize chunked upload');
        }
        
        const { uploadId } = await initResponse.json();
        console.log(`✅ Upload initialized with ID: ${uploadId}`);
        
        // Upload chunks
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          
          const formData = new FormData();
          formData.append('chunk', chunk);
          
          const chunkResponse = await fetch(`/api/upload/chunk/${uploadId}/${i}`, {
            method: 'POST',
            body: formData
          });
          
          if (!chunkResponse.ok) {
            throw new Error(`Failed to upload chunk ${i + 1}/${totalChunks}`);
          }
          
          const progress = ((i + 1) / totalChunks) * 100;
          setUploadProgress({
            fileName: file.name,
            progress: Math.round(progress),
            status: `Uploading chunk ${i + 1}/${totalChunks} (${Math.round(progress)}%)`
          });
        }
        
        // Complete upload and process
        setUploadProgress({
          fileName: file.name,
          progress: 100,
          status: 'Processing uploaded file...'
        });
        
        const completeResponse = await fetch(`/api/deals/${dealId}/upload-chunked/${uploadId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderName })
        });
        
        if (!completeResponse.ok) {
          throw new Error('Failed to process uploaded file');
        }
        
        const result = await completeResponse.json();
        console.log('✅ Upload complete:', result);
        
        // Refresh data
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/documents`] });
        queryClient.invalidateQueries({ queryKey: [`/api/background-jobs/${dealId}`] });
        
        setUploadProgress(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
      } catch (error: any) {
        console.error('Chunked upload failed:', error);
        alert(`Upload failed: ${error.message || 'Unknown error'}\n\nPlease split your file into parts smaller than 30MB and upload them separately.`);
        setUploadProgress(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
      return;
    } else {
      console.log(`📤 File is ${(file.size / 1024 / 1024).toFixed(1)}MB - using direct upload (under 30MB limit)`);
      
      // Use direct upload for files under 30MB
      setUploadProgress({
        fileName: file.name,
        progress: 0,
        status: 'Starting upload...'
      });

      const formData = new FormData();
      formData.append('zipFile', file);
      formData.append('folderName', folderName);

      uploadZipMutation.mutate(formData);
    }
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

  const buildFolderTree = (docs: Document[]): { folderTree: FolderNode; emailAttachments: Document[] } => {
    console.log('🗂️ Building folder tree with', docs.length, 'documents');
    
    // Separate email attachments from regular documents
    const emailAttachments = docs.filter(doc => doc.folderPath?.includes('email-attachments'));
    const regularDocs = docs.filter(doc => !doc.folderPath?.includes('email-attachments'));
    
    const root: FolderNode = {
      name: '',
      path: '',
      children: new Map(),
      documents: [],
      isExpanded: true
    };

    regularDocs.forEach((doc) => {
      const folderPath = doc.folderPath || '';
      const pathParts = folderPath ? folderPath.split('/').filter(Boolean) : [];
      
      let currentNode = root;
      let currentPath = '';

      // Create folder hierarchy
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

      // Add document to the appropriate folder
      currentNode.documents.push(doc);
    });

    console.log('🗂️ Folder tree built:', {
      rootDocuments: root.documents.length,
      rootFolders: root.children.size,
      folderNames: Array.from(root.children.keys()),
      emailAttachments: emailAttachments.length
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

  const documentsArray = documents as Document[] | undefined;

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
  
  // Note: Auto force complete functionality temporarily disabled due to component lifecycle issues
  // The AI processing timeout service handles stuck processing automatically

  console.log('📊 DataRoomExplorer debug:', { 
    dealId,
    documents: Array.isArray(documents) ? documents.length : 'undefined', 
    isLoading, 
    isArray: Array.isArray(documents),
    firstDoc: Array.isArray(documents) && documents.length > 0 ? documents[0]?.name : 'none',
    queryKey: `/api/deals/${dealId}/documents`
  });
  
  if (isLoading) {
    console.log('📊 DataRoomExplorer: Still loading...');
  }
  
  // Check if we have only email attachments but no regular documents
  const hasOnlyEmailAttachments = documents && Array.isArray(documents) && documents.length > 0 && 
    documents.every(doc => doc.folderPath?.includes('email-attachments'));

  if ((!documents || !Array.isArray(documents) || documents.length === 0) && !hasOnlyEmailAttachments) {
    console.log('📊 DataRoomExplorer: No documents condition met', { 
      documents: Array.isArray(documents) ? documents.length : 'not array', 
      isArray: Array.isArray(documents) 
    });
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
                  {chunkedUploadProgress.eta > 0 && (
                    <span>ETA: {Math.ceil(chunkedUploadProgress.eta / 60)}min</span>
                  )}
                </div>
              </div>
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

  const { folderTree, emailAttachments } = buildFolderTree(documents || []);

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Pitchdeck Section - Only show if there are email attachments */}
      {emailAttachments.length > 0 && (
        <div className="bg-dark-lighter rounded-lg">
          <div className="p-4 border-b border-dark">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center">
                  <span className="mr-2">📊</span>
                  Pitch Deck
                </h3>
                <p className="text-sm text-gray-400 mt-1">{emailAttachments.length} presentation documents</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 max-h-96 overflow-y-auto">
            <div className="space-y-2">
              {emailAttachments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center py-2 px-3 hover:bg-dark-light rounded-lg cursor-pointer"
                  onClick={() => handleDocumentClick(doc)}
                >
                  {doc.type.includes('pdf') ? (
                    <FileTextIcon className="w-4 h-4 text-red-400 mr-3" />
                  ) : (
                    <FileIcon className="w-4 h-4 text-gray-400 mr-3" />
                  )}
                  <span className="text-gray-300 text-sm flex-1">{doc.name}</span>
                  <div className="flex items-center space-x-2">
                    {doc.status === 'Analyzed' && <CheckCircleIcon className="w-3 h-3 text-green-500" />}
                    {doc.status === 'Pending' && <ClockIcon className="w-3 h-3 text-yellow-500" />}
                    {(doc as any).aiSummaryStatus === 'completed' && <Brain className="w-3 h-3 text-purple-400" />}
                    {(doc as any).aiSummaryStatus === 'processing' && <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />}
                    <AlertCircle className="w-3 h-3 text-amber-500" />
                    <EyeIcon className="w-3 h-3 text-gray-500" />
                    <span className="text-xs text-gray-500">{(doc.size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Data Room Explorer Section */}
      <div className="bg-dark-lighter rounded-lg flex-1 flex flex-col">
        {/* Document Availability Notice */}
        <div className="p-3 bg-amber-900/20 border-b border-amber-500/30">
          <div className="flex items-center">
            <AlertCircle className="w-4 h-4 text-amber-400 mr-2 flex-shrink-0" />
            <div className="text-sm text-amber-200">
              <strong>Document Files Notice:</strong> Some document files may be temporarily unavailable due to recent system maintenance. 
              Document metadata and AI summaries remain intact. Files can be re-uploaded if needed.
            </div>
          </div>
        </div>
        
        <div className="p-4 border-b border-dark">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Data Room Explorer</h3>
              <p className="text-sm text-gray-400 mt-1">{(documents?.length || 0) - emailAttachments.length} documents organized by folder structure</p>
            </div>
          
          <div className="flex items-center space-x-2">
            {!isSelectionMode ? (
              <>
                {/* Smart AI Summary Status Indicator */}
                {documents && Array.isArray(documents) && (() => {
                  // Only count documents that have been analyzed and can have AI summaries
                  const analyzedDocs = documents.filter((doc: any) => 
                    doc.status === 'Analyzed'
                  );
                  
                  const totalDocs = analyzedDocs.length;
                  const docsWithSummaries = analyzedDocs.filter((doc: any) => doc.aiSummaryStatus === 'completed').length;
                  const processingDocs = analyzedDocs.filter((doc: any) => doc.aiSummaryStatus === 'processing').length;
                  const docsWithOCR = analyzedDocs.length;
                  const docsNeedingSummaries = analyzedDocs.filter((doc: any) => 
                    (!doc.aiSummaryStatus || doc.aiSummaryStatus === 'pending' || doc.aiSummaryStatus === 'failed')
                  ).length;
                  
                  // Calculate completion percentage and remaining time
                  const completionPercentage = totalDocs > 0 ? Math.round((docsWithSummaries / totalDocs) * 100) : 0;
                  const pendingDocs = totalDocs - docsWithSummaries - processingDocs;
                  const estimatedMinutes = Math.ceil(pendingDocs / 3); // 3 docs per 20-second batch
                  
                  if (processingDocs > 0 || (docsWithSummaries > 0 && pendingDocs > 0)) {
                    return (
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-2 px-3 py-2 bg-blue-900/30 border border-blue-600 rounded-md">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-300" />
                          <span className="text-sm text-blue-300 font-medium">
                            AI Processing: {docsWithSummaries}/{totalDocs} ({completionPercentage}%)
                          </span>
                          {completionPercentage > 85 && (
                            <span className="text-xs text-yellow-300 ml-2">
                              (Auto-timeout: 5min)
                            </span>
                          )}
                        </div>

                      </div>
                    );
                  } else if (docsWithSummaries === totalDocs) {
                    return (
                      <div className="flex items-center space-x-2 px-3 py-2 bg-green-900/30 border border-green-600 rounded-md">
                        <Brain className="w-4 h-4 text-green-300" />
                        <span className="text-sm text-green-300 font-medium">
                          AI Complete: {docsWithSummaries}/{totalDocs} (100%)
                        </span>
                      </div>
                    );
                  } else if (docsWithSummaries > 0) {
                    return (
                      <div className="flex items-center space-x-2 px-3 py-2 bg-green-900/30 border border-green-600 rounded-md">
                        <Brain className="w-4 h-4 text-green-300" />
                        <span className="text-sm text-green-300 font-medium">
                          AI Summaries: {docsWithSummaries}/{totalDocs} ({completionPercentage}%)
                        </span>
                      </div>
                    );
                  } else if (docsNeedingSummaries > 0) {
                    return (
                      <Button
                        onClick={() => processAISummariesMutation.mutate()}
                        size="sm"
                        variant="outline"
                        disabled={processAISummariesMutation.isPending || processingCooldown}
                        className="border-blue-600 text-blue-300 hover:bg-blue-700"
                      >
                        {processAISummariesMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Brain className="w-4 h-4 mr-1" />
                            Generate AI Summaries ({docsNeedingSummaries})
                          </>
                        )}
                      </Button>
                    );
                  }
                  return null;
                })()}

                {/* AI Agent Assignment Button */}
                {documents && Array.isArray(documents) && documents.length > 0 && (
                  <Button
                    onClick={() => assignAgentsMutation.mutate()}
                    size="sm"
                    variant="outline" 
                    disabled={assignAgentsMutation.isPending}
                    className="border-purple-600 text-purple-300 hover:bg-purple-600 hover:text-white"
                  >
                    {assignAgentsMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                        Assigning...
                      </>
                    ) : (
                      <>
                        <Brain className="w-4 h-4 mr-1" />
                        AI Assign Agents
                      </>
                    )}
                  </Button>
                )}
                
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
                    checked={selectedFiles.size === (documents?.length || 0) && (documents?.length || 0) > 0}
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



      {/* Additional File Upload Section */}
      {showAdditionalUpload && (
        <div className="relative border-b border-dark bg-gradient-to-br from-dark to-dark-lighter overflow-hidden">
          {/* Background decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/5 to-transparent rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-blue-500/5 to-transparent rounded-full translate-y-12 -translate-x-12"></div>
          
          <div className="relative p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-blue-500/20 rounded-xl flex items-center justify-center border border-primary/20">
                <UploadIcon className="w-5 h-5 text-primary" />
              </div>
              <h4 className="text-white text-lg font-semibold">Upload Additional Files</h4>
            </div>
            
            <div className="space-y-4">
              {/* Drag and drop area */}
              <div className="relative">
                <Input
                  ref={additionalFileInputRef}
                  type="file"
                  multiple
                  onChange={handleAdditionalFilesUpload}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="border-2 border-dashed border-primary/30 rounded-xl p-8 bg-gradient-to-br from-primary/5 to-blue-500/5 hover:border-primary/50 transition-all duration-300 hover:bg-primary/10">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <UploadIcon className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-white font-medium mb-1">Drag files here or click to browse</p>
                    <p className="text-gray-400 text-sm">Support for PDF, DOC, XLS, PPT, TXT, and images</p>
                  </div>
                </div>
              </div>
              
              {/* Action buttons */}
              <div className="flex space-x-3">
                <Button
                  onClick={() => additionalFileInputRef.current?.click()}
                  disabled={uploadFilesMutation.isPending}
                  className="bg-gradient-to-r from-primary to-green-400 hover:from-primary/80 hover:to-green-400/80 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-300"
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
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500 rounded-lg transition-all duration-300"
                >
                  Cancel
                </Button>
              </div>
            </div>
            
            {uploadFilesMutation.error && (
              <Alert className="mt-4 border-red-500/50 bg-red-900/20 rounded-lg">
                <AlertTriangleIcon className="w-4 h-4" />
                <AlertDescription className="text-red-300">
                  Upload failed: {uploadFilesMutation.error.message}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      )}

      <div className="p-4 h-96 overflow-y-auto">
        {folderTree.children.size > 0 ? (
          Array.from(folderTree.children.values()).map((child) => (
            <FolderTree
              key={child.path}
              node={child}
              level={0}
              onToggle={toggleFolder}
              onDocumentClick={handleDocumentClick}
              isSelectionMode={isSelectionMode}
              selectedFiles={selectedFiles}
              onFileSelection={handleFileSelection}
            />
          ))
        ) : (
          folderTree.documents.length > 0 && (
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
                    onClick={() => !isSelectionMode && handleDocumentClick(doc)}
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
                      {(doc as any).aiSummaryStatus === 'completed' && <Brain className="w-3 h-3 text-purple-400" />}
                      {(doc as any).aiSummaryStatus === 'processing' && <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />}
                      <AlertCircle className="w-3 h-3 text-amber-500" />
                      <EyeIcon className="w-3 h-3 text-gray-500" />
                      <span className="text-xs text-gray-500">{(doc.size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
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

                  {/* Upload Progress */}
                  {uploadProgress && (
                    <div className="space-y-3 p-4 bg-dark-lighter/50 border border-gray-600/50 rounded-xl backdrop-blur-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm text-white font-medium">{uploadProgress.fileName}</p>
                            <p className="text-xs text-gray-400">{uploadProgress.status}</p>
                          </div>
                        </div>
                        <span className="text-sm text-gray-400 font-medium">{uploadProgress.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-blue-400 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${uploadProgress.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

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
                              {chunkedUploadProgress.status === 'uploading' && `Uploading chunk ${chunkedUploadProgress.currentChunk + 1}/${chunkedUploadProgress.totalChunks}`}
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
      </div>

      {selectedDocument && (
        <DocumentDetailModal
          document={selectedDocument}
          isOpen={!!selectedDocument}
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