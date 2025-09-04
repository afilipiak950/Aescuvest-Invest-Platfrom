import { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import PageHeader from '@/components/layout/page-header';
import { DataRoomExplorer } from '@/components/DataRoomExplorer';
import EnhancedAgentCard from '@/components/EnhancedAgentCard';
import DueDiligenceAgents from '@/components/ai/DueDiligenceAgents';
import { SimpleFileUpload } from '@/components/SimpleFileUpload';
import FileUploadAnalysis from '@/components/FileUploadAnalysis';
import CompanyResearchDisplay from '@/components/CompanyResearchDisplay';
import DynamicAIScoring from '@/components/ai/DynamicAIScoring';
import DataRoomManager from '@/components/DataRoomManager';
import UnassignedDocuments from '@/components/UnassignedDocuments';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Link as LinkIcon, Bot } from 'lucide-react';
import { Deal, AgentAnalysis, Document } from '@/types';

export default function DueDiligence() {
  const [location] = useLocation();
  const [selectedDeal, setSelectedDeal] = useState<string>('1'); // Default to first deal
  const [activeAgent, setActiveAgent] = useState<string>('legal');
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadField, setShowUploadField] = useState(false);
  const [showDataRoom, setShowDataRoom] = useState(true); // Always show data room
  const [isRunningAllAnalyses, setIsRunningAllAnalyses] = useState(false);

  const queryClient = useQueryClient();

  // Parse URL parameters and set selected deal
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const dealParam = searchParams.get('deal');
    if (dealParam) {
      setSelectedDeal(dealParam);
    }
  }, [location]);

  // Fetch real deals from database
  const { data: deals, isLoading: isLoadingDeals } = useQuery<Deal[]>({
    queryKey: ['/api/deals'],
    retry: false,
  });

  // Fetch real documents for selected deal
  const { data: documents, isLoading: isLoadingDocuments, error: documentsError } = useQuery({
    queryKey: [`/api/deals/${selectedDeal}/documents`],
    retry: 3,
    enabled: !!selectedDeal,
  });

  // Fetch agent analyses for selected deal
  const { data: agentAnalyses, isLoading: isLoadingAnalyses } = useQuery({
    queryKey: [`/api/analyses/${selectedDeal}`],
    retry: 3,
    enabled: !!selectedDeal,
  });

  // Find selected deal object
  const selectedDealData = useMemo(() => {
    if (!deals || !Array.isArray(deals) || !selectedDeal) return null;
    return deals.find((deal: Deal) => deal.id.toString() === selectedDeal);
  }, [deals, selectedDeal]);

  // Run all agent analyses for the selected deal
  const runAllAnalysesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDeal) throw new Error('No deal selected');
      
      // Use comprehensive endpoints for consistency with blue buttons
      const standardAgentTypes = ['legal', 'commercial', 'hr', 'ip'];
      const standardResults = await Promise.all(
        standardAgentTypes.map(agentType =>
          apiRequest(`/api/deals/${selectedDeal}/agents/${agentType}/analyze`, {
            method: 'POST',
          })
        )
      );
      
      // Use comprehensive endpoints for clinical, financial, and research (same as blue buttons)
      const clinicalResult = await apiRequest(`/api/deals/${selectedDeal}/clinical-analysis/comprehensive`, {
        method: 'POST',
      });
      const financialResult = await apiRequest(`/api/deals/${selectedDeal}/financial-analysis/comprehensive`, {
        method: 'POST',
      });
      const researchResult = await apiRequest(`/api/deals/${selectedDeal}/research-analysis/comprehensive`, {
        method: 'POST',
      });
      
      return [...standardResults, clinicalResult, financialResult, researchResult];
    },
    onSuccess: () => {
      // Invalidate agent analyses to refetch latest data
      queryClient.invalidateQueries({ queryKey: [`/api/analyses/${selectedDeal}`] });
      setIsRunningAllAnalyses(false);
    },
    onError: (error) => {
      console.error('Error running all analyses:', error);
      setIsRunningAllAnalyses(false);
    },
  });

  const handleRunAllAnalyses = () => {
    setIsRunningAllAnalyses(true);
    runAllAnalysesMutation.mutate();
  };

  // Filter documents for unassigned component
  const unassignedDocuments = useMemo(() => {
    if (!documents || !Array.isArray(documents)) return [];
    
    // Simple logic to find unassigned docs - can be enhanced
    return documents.filter((doc: Document) => {
      // This is a placeholder - you might want to implement actual assignment logic
      return !doc.name?.toLowerCase().includes('assigned');
    });
  }, [documents]);

  if (isLoadingDeals) {
    return (
      <div className="min-h-screen bg-dark text-white">
        <PageHeader title="Loading..." />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark text-white">
      <PageHeader title="Due Diligence Dashboard" />
      
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Deal Selection */}
        <Card className="bg-dark-light border-dark-lighter">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Deal Selection & Analysis</span>
              <Select value={selectedDeal} onValueChange={setSelectedDeal}>
                <SelectTrigger className="w-64 bg-dark border-dark-lighter text-white">
                  <SelectValue placeholder="Select a deal" />
                </SelectTrigger>
                <SelectContent className="bg-dark border-dark-lighter">
                  {Array.isArray(deals) && deals.map((deal: Deal) => (
                    <SelectItem 
                      key={deal.id} 
                      value={deal.id.toString()}
                      className="text-white hover:bg-dark-lighter"
                    >
                      {deal.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Selected Deal Info */}
        {selectedDealData && (
          <Card className="bg-dark-light border-dark-lighter">
            <CardHeader>
              <CardTitle className="text-white">{selectedDealData.companyName}</CardTitle>
              <CardDescription className="text-gray-400">
                {selectedDealData.description || 'No description available'}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Data Room Explorer */}
        {showDataRoom && selectedDeal && (
          <DataRoomExplorer dealId={parseInt(selectedDeal)} />
        )}

        {/* AI Agent Analysis Dashboard */}
        <Card className="bg-dark-light border-dark-lighter">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Bot className="h-6 w-6 text-primary" />
                AI Agent Analysis Dashboard
              </span>
              <div className="flex gap-2">
                <Button
                  onClick={handleRunAllAnalyses}
                  disabled={isRunningAllAnalyses || runAllAnalysesMutation.isPending || !Array.isArray(documents) || !documents?.length}
                  className="bg-primary hover:bg-primary-hover"
                >
                  {isRunningAllAnalyses || runAllAnalysesMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Running All Analyses
                    </>
                  ) : (
                    <>
                      <Bot className="h-4 w-4 mr-2" />
                      Run All Analyses
                    </>
                  )}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeAgent} onValueChange={setActiveAgent} className="w-full">
              <TabsList className="border-b border-dark-lighter bg-transparent mb-6 w-full justify-start">
                <TabsTrigger
                  value="clinical"
                  className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                >
                  Clinical
                </TabsTrigger>
                <TabsTrigger
                  value="legal"
                  className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                >
                  Legal
                </TabsTrigger>
                <TabsTrigger
                  value="commercial"
                  className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                >
                  Commercial
                </TabsTrigger>
                <TabsTrigger
                  value="hr"
                  className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                >
                  HR
                </TabsTrigger>
                <TabsTrigger
                  value="financial"
                  className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                >
                  Financial
                </TabsTrigger>
                <TabsTrigger
                  value="ip"
                  className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                >
                  IP
                </TabsTrigger>
                <TabsTrigger
                  value="research"
                  className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
                >
                  Research
                </TabsTrigger>
              </TabsList>

              {/* Agent Tab Contents */}
              {['clinical', 'legal', 'commercial', 'hr', 'financial', 'ip', 'research'].map((agentType) => (
                <TabsContent key={agentType} value={agentType} className="mt-0">
                  <EnhancedAgentCard
                    dealId={parseInt(selectedDeal)}
                    agentType={agentType}
                    documents={documents || []}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* Additional Components */}
        {selectedDeal && (
          <>
            <CompanyResearchDisplay dealId={parseInt(selectedDeal)} />
            <DynamicAIScoring dealId={parseInt(selectedDeal)} />
            
            {unassignedDocuments.length > 0 && (
              <UnassignedDocuments
                dealId={parseInt(selectedDeal)}
                documents={unassignedDocuments}
                onAssignDocument={(docId, agentType) => {
                  // Handle document assignment
                  console.log(`Assigning document ${docId} to ${agentType}`);
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}