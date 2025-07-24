import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const agentColorMap = {
  Clinical: 'bg-blue-600',
  Legal: 'bg-purple-600',
  Commercial: 'bg-green-600',
  HR: 'bg-amber-600',
  Financial: 'bg-red-600',
  IP: 'bg-indigo-600',
  Research: 'bg-teal-600'
};

const findingTypeMap = {
  'Positive': { icon: CheckCircle, className: 'text-green-500' },
  'Negative': { icon: AlertCircle, className: 'text-red-500' },
  'Warning': { icon: AlertTriangle, className: 'text-amber-500' },
  'Info': { icon: Info, className: 'text-blue-500' }
};

interface DueDiligenceAgentsProps {
  dealId: number;
}

export default function DueDiligenceAgents({ dealId }: DueDiligenceAgentsProps) {
  const queryClient = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);

  // Fetch agent types
  const { data: agentData } = useQuery({
    queryKey: ['/api/ai/due-diligence/agent-types'],
    retry: false
  });

  // Fetch documents for the deal
  const { data: documents } = useQuery({
    queryKey: [`/api/deals/${dealId}/documents`],
    retry: false
  });

  // Fetch existing analyses for the deal
  const { data: analyses, isLoading: analysesLoading } = useQuery({
    queryKey: [`/api/analyses/${dealId}`],
    retry: false
  });

  // Mutation for analyzing a document
  const analyzeDocument = useMutation({
    mutationFn: async ({ dealId, documentId, agentType }: any) => {
      return apiRequest(`/api/ai/due-diligence/analyze-document`, {
        method: 'POST',
        body: JSON.stringify({ dealId, documentId, agentType }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/analyses', dealId] });
      toast({
        title: 'Document analysis started',
        description: 'The AI agent is analyzing your document. This may take a moment.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Analysis failed',
        description: error.message || 'Failed to start document analysis',
        variant: 'destructive',
      });
    }
  });

  // Generate comprehensive report
  const generateReport = useMutation({
    mutationFn: async (includeAgentTypes?: string[]) => {
      return apiRequest(`/api/ai/due-diligence/generate-report/${dealId}`, {
        method: 'POST',
        body: JSON.stringify({ includeAgentTypes }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: (data) => {
      // In a real application, you'd likely navigate to a report view or open a modal
      toast({
        title: 'Report generated',
        description: 'The comprehensive due diligence report has been created.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Report generation failed',
        description: error.message || 'Failed to generate comprehensive report',
        variant: 'destructive',
      });
    }
  });

  const handleAnalyzeDocument = () => {
    if (!selectedAgent || !selectedDocumentId) {
      toast({
        title: 'Missing information',
        description: 'Please select both an agent type and a document',
        variant: 'destructive',
      });
      return;
    }

    analyzeDocument.mutate({ dealId, documentId: selectedDocumentId, agentType: selectedAgent });
  };

  const handleGenerateReport = () => {
    const analysesArray = Array.isArray(analyses) ? analyses : [];
    const completedAgentTypes = analysesArray
      .filter(analysis => analysis.status === 'completed')
      .map(analysis => analysis.agentType);
    
    if (!completedAgentTypes || completedAgentTypes.length === 0) {
      toast({
        title: 'No completed analyses',
        description: 'Please complete at least one analysis before generating a report',
        variant: 'destructive',
      });
      return;
    }

    generateReport.mutate(completedAgentTypes);
  };

  // Group analyses by agent type
  const analysesArray = Array.isArray(analyses) ? analyses : [];
  const analysesByAgent = analysesArray.reduce((acc: any, analysis: any) => {
    if (!acc[analysis.agentType]) {
      acc[analysis.agentType] = [];
    }
    acc[analysis.agentType].push(analysis);
    return acc;
  }, {});

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Due Diligence AI Agents</span>
          <Button 
            variant="default" 
            onClick={handleGenerateReport}
            disabled={generateReport.isPending || !analysesArray.some(a => a.status === 'completed')}
          >
            Generate Comprehensive Report
          </Button>
        </CardTitle>
        <CardDescription>
          AI-powered analysis for thorough due diligence across multiple domains
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          {/* Agent selection panel */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Select Agent Type</h3>
            <div className="grid grid-cols-2 gap-3">
              {(agentData as any)?.agentTypes?.map((agentType: string) => (
                <Button
                  key={agentType}
                  variant={selectedAgent === agentType ? "default" : "outline"}
                  className={`justify-start ${selectedAgent === agentType ? agentColorMap[agentType as keyof typeof agentColorMap] : ''}`}
                  onClick={() => setSelectedAgent(agentType)}
                >
                  {agentType} Agent
                </Button>
              ))}
            </div>

            {selectedAgent && (
              <div className="mt-4 p-4 bg-black/5 rounded-md">
                <h4 className="font-medium mb-2">Agent Focus Areas:</h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {(agentData as any)?.agentInfo?.[selectedAgent]?.focusAreas?.map((area: string) => (
                    <li key={area}>{area}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Document selection panel */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Select Document</h3>
            {(documents as any)?.length > 0 ? (
              <div className="h-64 overflow-y-auto space-y-2">
                {(documents as any[]).map((doc: any) => (
                  <div 
                    key={doc.id}
                    className={`p-3 border rounded-md cursor-pointer transition-colors ${
                      selectedDocumentId === doc.id ? 'border-primary bg-primary/10' : 'hover:bg-black/5'
                    }`}
                    onClick={() => setSelectedDocumentId(doc.id)}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium truncate max-w-[240px]">{doc.name}</span>
                      <Badge variant={doc.status === 'Analyzed' ? 'default' : doc.status === 'Analyzing' ? 'secondary' : 'outline'}>
                        {doc.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {doc.type?.toUpperCase() || 'UNKNOWN'} • {(doc.size / 1024).toFixed(0)} KB
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center border border-dashed rounded-md">
                <p className="text-muted-foreground">No documents available for this deal</p>
              </div>
            )}

            <Button 
              className="w-full" 
              disabled={!selectedAgent || !selectedDocumentId || analyzeDocument.isPending}
              onClick={handleAnalyzeDocument}
            >
              {analyzeDocument.isPending ? "Analyzing..." : "Analyze Document"}
            </Button>
          </div>
        </div>

        {/* Analysis results */}
        {analysesByAgent && Object.keys(analysesByAgent).length > 0 && (
          <div className="mt-8">
            <h3 className="text-xl font-medium mb-4">Analysis Results</h3>
            <Tabs defaultValue={Object.keys(analysesByAgent)[0]} className="w-full">
              <TabsList className="mb-4">
                {Object.keys(analysesByAgent).map((agentType) => (
                  <TabsTrigger key={agentType} value={agentType}>
                    {agentType} Analysis
                  </TabsTrigger>
                ))}
              </TabsList>

              {Object.entries(analysesByAgent).map(([agentType, agentAnalyses]: [string, any]) => (
                <TabsContent key={agentType} value={agentType} className="space-y-4">
                  {agentAnalyses.map((analysis: any) => (
                    <Card key={analysis.id}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-lg">{agentType} Analysis</CardTitle>
                          <Badge variant={
                            analysis.status === 'Complete' ? 'default' : 
                            analysis.status === 'In Progress' ? 'secondary' : 
                            'outline'
                          }>
                            {analysis.status}
                          </Badge>
                        </div>
                        {analysis.status === 'In Progress' && (
                          <Progress value={analysis.progress} className="h-2 mt-2" />
                        )}
                      </CardHeader>
                      
                      <CardContent className="pb-2">
                        {analysis.findings && analysis.findings.length > 0 ? (
                          <div className="space-y-4">
                            <h4 className="font-medium">Key Findings:</h4>
                            <div className="space-y-3">
                              {analysis.findings.map((finding: any) => {
                                const TypeIcon = findingTypeMap[finding.type as keyof typeof findingTypeMap]?.icon || Info;
                                const typeClass = findingTypeMap[finding.type as keyof typeof findingTypeMap]?.className || '';
                                
                                return (
                                  <div key={finding.id} className="flex items-start gap-2">
                                    <TypeIcon className={`w-5 h-5 mt-0.5 ${typeClass}`} />
                                    <div>
                                      <Badge variant="outline" className={`mb-1 ${typeClass}`}>{finding.type}</Badge>
                                      <p>{finding.content}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <p className="text-muted-foreground italic">No findings available</p>
                        )}
                      </CardContent>
                      
                      {analysis.recommendations && analysis.recommendations.length > 0 && (
                        <>
                          <Separator />
                          <CardFooter className="pt-4">
                            <div className="w-full">
                              <h4 className="font-medium mb-2">Recommendations:</h4>
                              <ul className="list-disc list-inside space-y-1">
                                {analysis.recommendations.map((rec: string, i: number) => (
                                  <li key={i}>{rec}</li>
                                ))}
                              </ul>
                            </div>
                          </CardFooter>
                        </>
                      )}
                    </Card>
                  ))}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}
      </CardContent>
    </Card>
  );
}