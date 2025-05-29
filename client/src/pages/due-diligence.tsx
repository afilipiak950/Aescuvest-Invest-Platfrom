import { useState } from 'react';
import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/layout/page-header';
import DocumentList from '@/components/due-diligence/document-list';
import AgentCard from '@/components/due-diligence/AgentCard';
import DueDiligenceAgents from '@/components/ai/DueDiligenceAgents';
import { SimpleFileUpload } from '@/components/SimpleFileUpload';
import FileUploadAnalysis from '@/components/FileUploadAnalysis';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Link as LinkIcon } from 'lucide-react';
import { Deal, AgentAnalysis, Document } from '@/types';



export default function DueDiligence() {
  const [selectedDeal, setSelectedDeal] = useState<string>('1'); // Default to first deal
  const [activeAgent, setActiveAgent] = useState<string>('legal');
  const [isUploading, setIsUploading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Fetch real deals from database
  const { data: deals, isLoading: isLoadingDeals } = useQuery({
    queryKey: ['/api/deals'],
    retry: false,
  });

  // Fetch real documents for selected deal
  const { data: documents, isLoading: isLoadingDocuments } = useQuery({
    queryKey: ['/api/deals', selectedDeal, 'documents'],
    retry: false,
    enabled: !!selectedDeal
  });

  // Fetch real analysis data
  const { data: analyses, isLoading: isLoadingAnalyses } = useQuery({
    queryKey: [`/api/analyses/${selectedDeal}`],
    retry: false,
    enabled: !!selectedDeal
  });

  const currentDeal = Array.isArray(deals) ? deals.find((deal: any) => deal.id.toString() === selectedDeal) : undefined;
  
  const handleConnect = async () => {
    setIsConnecting(true);
    // Simulate connection to data room
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsConnecting(false);
  };

  const handleFileUpload = async () => {
    setIsUploading(true);
    // Simulate file upload
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsUploading(false);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader 
        title="Due Diligence Analysis" 
        description="Analyze company documents and generate insights with AI agents."
      />
      
      {/* Deal Selection */}
      <Card className="bg-dark-light border-dark-lighter mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <label className="text-sm text-gray-400 mb-1 block">Select Deal</label>
              <Select 
                value={selectedDeal} 
                onValueChange={setSelectedDeal}
                disabled={isLoadingDeals}
              >
                <SelectTrigger className="bg-dark border-dark-lighter text-white focus:ring-primary">
                  <SelectValue placeholder="Select a deal" />
                </SelectTrigger>
                <SelectContent className="bg-dark-lighter border-dark-lighter">
                  {Array.isArray(deals) ? deals.map((deal: any) => (
                    <SelectItem key={deal.id} value={deal.id.toString()}>
                      {deal.companyName}
                    </SelectItem>
                  )) : null}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="bg-dark-lighter hover:bg-dark border-dark-lighter"
                onClick={handleFileUpload}
                disabled={isUploading}
              >
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Upload Files
              </Button>
              
              <Button
                onClick={handleConnect}
                disabled={isConnecting}
              >
                {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
                Connect Data Room
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {isLoadingDeals ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : currentDeal ? (
        <>
          {/* File Upload & Analysis */}
          <FileUploadAnalysis dealId={selectedDeal} />
          
          {/* Documents */}
          <Card className="bg-dark-light border-dark-lighter mb-6">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold">{currentDeal.companyName}</CardTitle>
                  <CardDescription>{currentDeal.description} • {currentDeal.stage}</CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" className="bg-dark-lighter hover:bg-dark border-dark-lighter">
                    Export
                  </Button>
                  <Button>
                    Generate Memo
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DocumentList documents={Array.isArray(documents) ? documents : []} />
            </CardContent>
          </Card>
          
          {/* AI Analysis Results */}
          <Card className="bg-dark-light border-dark-lighter">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl font-semibold">AI Analysis Results</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeAgent} onValueChange={setActiveAgent} className="w-full">
                <TabsList className="border-b border-dark-lighter bg-transparent mb-6 w-full justify-start">
                  <TabsTrigger
                    value="legal"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    Legal
                  </TabsTrigger>
                  <TabsTrigger
                    value="finance"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    Finance
                  </TabsTrigger>
                  <TabsTrigger
                    value="medical"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    Medical
                  </TabsTrigger>
                  <TabsTrigger
                    value="commercial"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    Commercial
                  </TabsTrigger>
                  <TabsTrigger
                    value="ai-agents"
                    className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                  >
                    AI Agents
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="legal">
                  <AgentCard 
                    analysis={Array.isArray(analyses) ? analyses.find((a: any) => a.agentType === 'Legal') : undefined}
                    isLoading={isLoadingAnalyses}
                  />
                </TabsContent>
                
                <TabsContent value="finance">
                  <AgentCard 
                    analysis={Array.isArray(analyses) ? analyses.find((a: any) => a.agentType === 'Finance') : undefined}
                    isLoading={isLoadingAnalyses}
                  />
                </TabsContent>
                
                <TabsContent value="medical">
                  <AgentCard 
                    analysis={Array.isArray(analyses) ? analyses.find((a: any) => a.agentType === 'Medical') : undefined}
                    isLoading={isLoadingAnalyses}
                  />
                </TabsContent>
                
                <TabsContent value="commercial">
                  <AgentCard 
                    analysis={Array.isArray(analyses) ? analyses.find((a: any) => a.agentType === 'Commercial') : undefined}
                    isLoading={isLoadingAnalyses}
                  />
                </TabsContent>
                
                <TabsContent value="ai-agents">
                  <div className="pt-4">
                    <DueDiligenceAgents dealId={parseInt(selectedDeal)} />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="bg-dark-light border-dark-lighter">
          <CardContent className="py-12 text-center">
            <h3 className="text-xl font-semibold mb-2">No Deal Selected</h3>
            <p className="text-gray-400 mb-4">Please select a deal to view its due diligence analysis.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
