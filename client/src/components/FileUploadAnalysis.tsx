import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, Eye, Download, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'uploading' | 'processing' | 'analyzing' | 'complete' | 'error';
  progress: number;
  extractedText?: string;
  analyses?: {
    summary?: string;
    marketResearch?: string;
    financialAnalysis?: string;
    riskAssessment?: string;
    competitiveAnalysis?: string;
  };
}

interface FileUploadAnalysisProps {
  dealId?: string;
}

export default function FileUploadAnalysis({ dealId }: FileUploadAnalysisProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (fileList: FileList) => {
      const formData = new FormData();
      Array.from(fileList).forEach(file => formData.append('files', file));
      if (dealId) formData.append('dealId', dealId);

      const response = await fetch('/api/documents/upload-analyze', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Upload Successful",
        description: `${data.files.length} file(s) uploaded and analysis started.`,
      });
      // Start processing each file
      data.files.forEach((file: any) => {
        processFile(file);
      });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const processFile = async (uploadedFile: any) => {
    const fileId = uploadedFile.id;
    
    // Add file to state
    const newFile: UploadedFile = {
      id: fileId,
      name: uploadedFile.name,
      size: uploadedFile.size,
      type: uploadedFile.type,
      status: 'processing',
      progress: 0
    };
    
    setFiles(prev => [...prev, newFile]);

    try {
      // Step 1: OCR Processing
      updateFileStatus(fileId, 'processing', 20);
      
      const ocrResponse = await fetch('/api/documents/ocr/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ documentId: fileId })
      });

      if (!ocrResponse.ok) {
        throw new Error('OCR processing failed');
      }

      const ocrResult = await ocrResponse.json();
      updateFileStatus(fileId, 'analyzing', 40, ocrResult.extractedText);

      // Step 2: Run predefined analyses
      const analyses = {};
      const analysisTypes = [
        { key: 'summary', name: 'AI Summary', progress: 50 },
        { key: 'marketResearch', name: 'Market Research', progress: 60 },
        { key: 'financialAnalysis', name: 'Financial Analysis', progress: 70 },
        { key: 'riskAssessment', name: 'Risk Assessment', progress: 80 },
        { key: 'competitiveAnalysis', name: 'Competitive Analysis', progress: 90 }
      ];

      for (const analysis of analysisTypes) {
        updateFileStatus(fileId, 'analyzing', analysis.progress);
        
        const analysisResponse = await fetch('/api/documents/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            documentId: fileId,
            analysisType: analysis.key,
            extractedText: ocrResult.extractedText,
            prompt: getPredefinedPrompt(analysis.key)
          })
        });

        if (analysisResponse.ok) {
          const result = await analysisResponse.json();
          (analyses as any)[analysis.key] = result.analysis;
        }
      }

      // Complete
      updateFileStatus(fileId, 'complete', 100, undefined, analyses);

    } catch (error) {
      console.error('File processing failed:', error);
      updateFileStatus(fileId, 'error', 0);
    }
  };

  const updateFileStatus = (
    fileId: string, 
    status: UploadedFile['status'], 
    progress: number, 
    extractedText?: string,
    analyses?: any
  ) => {
    setFiles(prev => prev.map(file => 
      file.id === fileId 
        ? { ...file, status, progress, extractedText, analyses }
        : file
    ));
  };

  const getPredefinedPrompt = (analysisType: string) => {
    const prompts: Record<string, string> = {
      summary: "Provide a comprehensive executive summary of this document in 3-5 paragraphs, highlighting key points, main objectives, and critical information.",
      marketResearch: "Analyze the market opportunity, target market size, competitive landscape, and market positioning. Include market trends and growth potential.",
      financialAnalysis: "Extract and analyze all financial information including revenue models, projections, costs, and funding requirements. Assess financial viability.",
      riskAssessment: "Identify and evaluate potential risks including technical, market, regulatory, financial, and operational risks. Rate risk levels.",
      competitiveAnalysis: "Analyze competitive positioning, competitive advantages, differentiation factors, and competitive threats."
    };
    return prompts[analysisType] || "Analyze this document and provide insights.";
  };

  const handleFileUpload = (uploadedFiles: FileList) => {
    if (uploadedFiles.length > 0) {
      uploadMutation.mutate(uploadedFiles);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
      case 'analyzing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />;
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-400" />;
      default:
        return <FileText className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading': return 'Uploading...';
      case 'processing': return 'OCR Processing...';
      case 'analyzing': return 'AI Analysis...';
      case 'complete': return 'Complete';
      case 'error': return 'Error';
      default: return 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card className="bg-dark-light border-dark-lighter">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Document Upload & AI Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              dragActive 
                ? "border-primary bg-primary/10" 
                : "border-dark-lighter hover:border-gray-400"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2">Upload documents for AI analysis</h3>
            <p className="text-gray-400 mb-4">
              Drag and drop files here, or click to browse
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Supported: PDF, DOC, DOCX, TXT, PNG, JPG, JPEG (Max 10MB each)
            </p>
            <Button
              variant="outline"
              className="bg-dark-lighter hover:bg-dark border-dark-lighter"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.accept = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg';
                input.onchange = (e) => {
                  const files = (e.target as HTMLInputElement).files;
                  if (files) handleFileUpload(files);
                };
                input.click();
              }}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Choose Files
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <Card className="bg-dark-light border-dark-lighter">
          <CardHeader>
            <CardTitle>Processing Files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {files.map((file) => (
              <div key={file.id} className="border border-dark-lighter rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(file.status)}
                    <span className="font-medium">{file.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </Badge>
                  </div>
                  <span className="text-sm text-gray-400">{getStatusText(file.status)}</span>
                </div>
                
                <Progress value={file.progress} className="mb-4" />
                
                {file.status === 'complete' && file.analyses && (
                  <Tabs defaultValue="summary" className="w-full">
                    <TabsList className="grid w-full grid-cols-5">
                      <TabsTrigger value="summary">Summary</TabsTrigger>
                      <TabsTrigger value="market">Market</TabsTrigger>
                      <TabsTrigger value="financial">Financial</TabsTrigger>
                      <TabsTrigger value="risks">Risks</TabsTrigger>
                      <TabsTrigger value="competitive">Competitive</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="summary" className="mt-4">
                      <div className="bg-dark rounded-lg p-4">
                        <h4 className="font-medium mb-2">AI Summary</h4>
                        <p className="text-gray-300 text-sm">{file.analyses.summary || 'Analysis in progress...'}</p>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="market" className="mt-4">
                      <div className="bg-dark rounded-lg p-4">
                        <h4 className="font-medium mb-2">Market Research Analysis</h4>
                        <p className="text-gray-300 text-sm">{file.analyses.marketResearch || 'Analysis in progress...'}</p>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="financial" className="mt-4">
                      <div className="bg-dark rounded-lg p-4">
                        <h4 className="font-medium mb-2">Financial Analysis</h4>
                        <p className="text-gray-300 text-sm">{file.analyses.financialAnalysis || 'Analysis in progress...'}</p>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="risks" className="mt-4">
                      <div className="bg-dark rounded-lg p-4">
                        <h4 className="font-medium mb-2">Risk Assessment</h4>
                        <p className="text-gray-300 text-sm">{file.analyses.riskAssessment || 'Analysis in progress...'}</p>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="competitive" className="mt-4">
                      <div className="bg-dark rounded-lg p-4">
                        <h4 className="font-medium mb-2">Competitive Analysis</h4>
                        <p className="text-gray-300 text-sm">{file.analyses.competitiveAnalysis || 'Analysis in progress...'}</p>
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}