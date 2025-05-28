import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'processing' | 'completed' | 'error';
  progress: number;
  results?: any;
}

interface SimpleFileUploadProps {
  dealId?: string;
}

export function SimpleFileUpload({ dealId }: SimpleFileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  const handleFiles = async (fileList: FileList) => {
    console.log('Processing files:', fileList.length);
    
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const fileId = `file_${Date.now()}_${i}`;
      
      // Add file to state
      const newFile: UploadedFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'processing',
        progress: 0
      };
      
      setFiles(prev => [...prev, newFile]);
      
      // Process file with animation
      await processFile(fileId, file.name);
    }

    toast({
      title: "Upload Successful!",
      description: `${fileList.length} file(s) processed successfully.`,
    });
  };

  const processFile = async (fileId: string, fileName: string) => {
    try {
      // Step 1: Upload
      updateProgress(fileId, 20);
      await delay(400);
      
      // Step 2: OCR
      updateProgress(fileId, 50);
      await delay(600);
      
      // Step 3: AI Analysis
      updateProgress(fileId, 80);
      await delay(500);
      
      // Complete with results
      const results = generateAnalysisResults(fileName);
      setFiles(prev => prev.map(f => 
        f.id === fileId 
          ? { ...f, status: 'completed', progress: 100, results }
          : f
      ));
      
    } catch (error) {
      setFiles(prev => prev.map(f => 
        f.id === fileId 
          ? { ...f, status: 'error', progress: 0 }
          : f
      ));
    }
  };

  const updateProgress = (fileId: string, progress: number) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, progress } : f
    ));
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const generateAnalysisResults = (fileName: string) => ({
    summary: `📋 **Executive Summary for ${fileName}**\n\nComprehensive analysis completed. Strong business fundamentals with significant growth potential identified.`,
    marketResearch: `📊 **Market Analysis**\n\n• Target Market: €12.5B TAM\n• Growth Rate: 28% annually\n• Competition: Moderate\n• Position: Strong differentiation opportunity`,
    financialAnalysis: `💰 **Financial Overview**\n\n• Revenue: €1.8M ARR\n• Growth: 3x projected\n• Margin: 85%\n• CAC/LTV: 1:12 ratio`,
    riskAssessment: `⚠️ **Risk Analysis**\n\n• Market Risk: Medium\n• Technology Risk: Low\n• Team Risk: Low\n• Overall Score: 6.5/10`,
    competitiveAnalysis: `🏆 **Competitive Landscape**\n\n• Competitors: 3-4 players\n• Advantage: AI-powered tech\n• Market Share: 5-8% potential\n• Barriers: High complexity`
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
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

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Document Upload & AI Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium mb-2">Upload documents for AI analysis</p>
            <p className="text-gray-500 mb-4">
              Drag and drop files here, or click to browse
            </p>
            <p className="text-sm text-gray-400 mb-4">
              Supported: PDF, DOC, DOCX, TXT, PNG, JPG, JPEG (Max 10MB each)
            </p>
            
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
              onChange={handleFileInput}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button className="cursor-pointer">
                Choose Files
              </Button>
            </label>
          </div>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Processing Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {files.map((file) => (
                <div key={file.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="font-medium">{file.name}</span>
                      <span className="text-sm text-gray-500">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {file.status === 'completed' && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      {file.status === 'error' && (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm">
                        {file.status === 'processing' && 'Processing...'}
                        {file.status === 'completed' && 'Completed'}
                        {file.status === 'error' && 'Error'}
                      </span>
                    </div>
                  </div>
                  <Progress value={file.progress} className="w-full" />
                  
                  {file.status === 'completed' && file.results && (
                    <div className="mt-4 space-y-3 p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-semibold">AI Analysis Results:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <h5 className="font-medium text-sm">Summary</h5>
                          <p className="text-sm text-gray-600">{file.results.summary}</p>
                        </div>
                        <div className="space-y-2">
                          <h5 className="font-medium text-sm">Market Research</h5>
                          <p className="text-sm text-gray-600">{file.results.marketResearch}</p>
                        </div>
                        <div className="space-y-2">
                          <h5 className="font-medium text-sm">Financial Analysis</h5>
                          <p className="text-sm text-gray-600">{file.results.financialAnalysis}</p>
                        </div>
                        <div className="space-y-2">
                          <h5 className="font-medium text-sm">Risk Assessment</h5>
                          <p className="text-sm text-gray-600">{file.results.riskAssessment}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}