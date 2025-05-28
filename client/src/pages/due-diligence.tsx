import { useState } from 'react';
import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/layout/page-header';
import DocumentList from '@/components/due-diligence/document-list';
import AgentCard from '@/components/due-diligence/agent-card';
import DueDiligenceAgents from '@/components/ai/DueDiligenceAgents';
import { SimpleFileUpload } from '@/components/SimpleFileUpload';
import FileUploadAnalysis from '@/components/FileUploadAnalysis';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Link as LinkIcon } from 'lucide-react';
import { Deal, AgentAnalysis, Document } from '@/types';

// Mock data
const mockDeals: Deal[] = [
  {
    id: 1,
    companyName: 'NeuroTech AI',
    description: 'Brain-computer interface',
    sector: 'MedTech',
    stage: 'Series A',
    location: 'Berlin, Germany',
    fundingAmount: 8500000,
    aiScore: 85,
    status: 'Due Diligence',
    createdAt: new Date(Date.now() - 86400000).toISOString(), // yesterday
    documents: [
      {
        id: 1,
        dealId: 1,
        name: 'NeuroTech_Pitch_Deck.pdf',
        type: 'pdf',
        size: 2500000,
        uploadedAt: new Date(Date.now() - 86400000).toISOString(),
        status: 'Analyzed'
      },
      {
        id: 2,
        dealId: 1,
        name: 'Financial_Model_2023.xlsx',
        type: 'xlsx',
        size: 1500000,
        uploadedAt: new Date(Date.now() - 86400000).toISOString(),
        status: 'Analyzed'
      },
      {
        id: 3,
        dealId: 1,
        name: 'Clinical_Trial_Results.docx',
        type: 'docx',
        size: 3800000,
        uploadedAt: new Date(Date.now() - 43200000).toISOString(),
        status: 'Analyzing'
      },
      {
        id: 4,
        dealId: 1,
        name: 'Cap_Table_May2023.pdf',
        type: 'pdf',
        size: 900000,
        uploadedAt: new Date(Date.now() - 86400000).toISOString(),
        status: 'Analyzed'
      },
      {
        id: 5,
        dealId: 1,
        name: 'Patents_Overview.pdf',
        type: 'pdf',
        size: 1200000,
        uploadedAt: new Date(Date.now() - 43200000).toISOString(),
        status: 'Analyzed'
      }
    ]
  },
  {
    id: 2,
    companyName: 'HealthMetrics',
    description: 'Remote patient monitoring',
    sector: 'HealthTech',
    stage: 'Series B',
    location: 'London, UK',
    fundingAmount: 12000000,
    aiScore: 78,
    status: 'Due Diligence',
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    documents: []
  },
  {
    id: 3,
    companyName: 'MediDrone',
    description: 'Autonomous medical delivery',
    sector: 'MedTech',
    stage: 'Pre-Seed',
    location: 'Munich, Germany',
    fundingAmount: 500000,
    aiScore: 65,
    status: 'Due Diligence',
    createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
    documents: []
  },
  {
    id: 4,
    companyName: 'GeneMap+',
    description: 'Genomic sequencing platform',
    sector: 'BioTech',
    stage: 'Seed',
    location: 'Zurich, Switzerland',
    fundingAmount: 2000000,
    aiScore: 92,
    status: 'Due Diligence',
    createdAt: new Date(Date.now() - 86400000 * 22).toISOString(),
    documents: []
  }
];

const mockAgentAnalyses: AgentAnalysis[] = [
  {
    id: 1,
    dealId: 1,
    agentType: 'Legal',
    status: 'Complete',
    progress: 100,
    findings: [
      {
        id: 1,
        analysisId: 1,
        content: 'Company incorporation documents are valid and complete',
        type: 'Positive'
      },
      {
        id: 2,
        analysisId: 1,
        content: 'IP ownership is properly documented for core technology',
        type: 'Positive'
      },
      {
        id: 3,
        analysisId: 1,
        content: 'Potential issue with employee stock option plan documentation',
        type: 'Warning'
      }
    ],
    recommendations: [
      'Request formal regulatory timeline and FDA communication history to validate submission plans.',
      'Verify all inventor employment agreements to ensure IP ownership is properly assigned to the company.',
      'Schedule expert review of EU MDR strategy given recent regulatory changes affecting neural interface devices.'
    ],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 2,
    dealId: 1,
    agentType: 'Finance',
    status: 'Complete',
    progress: 100,
    findings: [
      {
        id: 4,
        analysisId: 2,
        content: 'Financial projections are conservative and well-documented',
        type: 'Positive'
      },
      {
        id: 5,
        analysisId: 2,
        content: 'Customer acquisition costs are higher than industry benchmark',
        type: 'Negative'
      }
    ],
    recommendations: [
      'Review sensitivity analysis for customer acquisition efficiency improvements.',
      'Benchmark financial projections against recent comparable company exits in the neurotech space.',
      'Validate hardware manufacturing cost assumptions with industry experts.'
    ],
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 3,
    dealId: 1,
    agentType: 'Medical',
    status: 'In Progress',
    progress: 68,
    findings: [
      {
        id: 6,
        analysisId: 3,
        content: 'Clinical validation study design meets industry standards',
        type: 'Positive'
      },
      {
        id: 7,
        analysisId: 3,
        content: 'Regulatory pathway is clearly defined for FDA clearance',
        type: 'Positive'
      }
    ],
    recommendations: [],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 43200000).toISOString()
  },
  {
    id: 4,
    dealId: 1,
    agentType: 'Commercial',
    status: 'Waiting',
    progress: 0,
    findings: [],
    recommendations: [],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString()
  }
];

export default function DueDiligence() {
  const [selectedDeal, setSelectedDeal] = useState<string>('1'); // Default to first deal
  const [activeAgent, setActiveAgent] = useState<string>('legal');
  const [isUploading, setIsUploading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Simulate fetch deals query
  const { data: deals, isLoading: isLoadingDeals } = useQuery({
    queryKey: ['/api/deals'],
    queryFn: async () => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));
      return mockDeals;
    }
  });

  // Simulate fetch analysis query
  const { data: analyses, isLoading: isLoadingAnalyses } = useQuery({
    queryKey: ['/api/analyses', selectedDeal],
    queryFn: async () => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      return mockAgentAnalyses;
    },
    enabled: !!selectedDeal
  });

  const currentDeal = deals?.find(deal => deal.id.toString() === selectedDeal);
  
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
                  {deals?.map(deal => (
                    <SelectItem key={deal.id} value={deal.id.toString()}>
                      {deal.companyName}
                    </SelectItem>
                  ))}
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
              <DocumentList documents={currentDeal.documents} />
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
                    analysis={analyses?.find(a => a.agentType === 'Legal')}
                    isLoading={isLoadingAnalyses}
                  />
                </TabsContent>
                
                <TabsContent value="finance">
                  <AgentCard 
                    analysis={analyses?.find(a => a.agentType === 'Finance')}
                    isLoading={isLoadingAnalyses}
                  />
                </TabsContent>
                
                <TabsContent value="medical">
                  <AgentCard 
                    analysis={analyses?.find(a => a.agentType === 'Medical')}
                    isLoading={isLoadingAnalyses}
                  />
                </TabsContent>
                
                <TabsContent value="commercial">
                  <AgentCard 
                    analysis={analyses?.find(a => a.agentType === 'Commercial')}
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
