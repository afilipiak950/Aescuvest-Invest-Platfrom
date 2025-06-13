import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/layout/page-header';
import MemoSection from '@/components/memo-generator/memo-section';
import MemoControls from '@/components/memo-generator/memo-controls';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { Deal, InvestmentMemo } from '@/types';

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
    documents: []
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
    status: 'Memo Ready',
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
    status: 'New Submission',
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
    status: 'Screening',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    documents: []
  }
];

const mockMemo: InvestmentMemo = {
  id: 1,
  dealId: 1,
  executiveSummary: "NeuroTech AI is developing a next-generation brain-computer interface (BCI) for patients with movement disorders and paralysis. The company's proprietary neural decoding algorithms allow for high-fidelity control of prosthetic devices and digital interfaces with minimal invasiveness compared to competitors.",
  productMarket: "Over 75 million people worldwide have movement disorders or paralysis that significantly impact quality of life and independence. Current solutions are either highly invasive (implanted electrodes) or provide limited functionality (EEG-based). NeuroTech's BCI system combines minimally invasive subdermal sensors with AI-powered neural decoding, enabling precise control of assistive devices. The platform is modular, supporting a range of applications from prosthetic limbs to digital interface control.",
  team: [
    {
      id: 1,
      name: 'Dr. Julia Schmidt',
      title: 'CEO & Co-founder',
      background: 'PhD Neuroscience, MIT • Previously: Researcher at Max Planck Institute'
    },
    {
      id: 2,
      name: 'Dr. Marco Reis',
      title: 'CTO & Co-founder',
      background: 'PhD Biomedical Engineering, ETH Zurich • Previously: Technical Lead at Medtronic'
    },
    {
      id: 3,
      name: 'Anna Lehmann',
      title: 'COO',
      background: 'MBA, INSEAD • Previously: VP Operations at Siemens Healthineers'
    }
  ],
  financials: {
    burnRate: 175000,
    runway: 6,
    funding: [
      {
        round: 'Seed',
        amount: 2500000,
        date: '2021',
        investors: ['High-Tech Gründerfonds', 'Business Angels']
      },
      {
        round: 'Grant',
        amount: 1200000,
        date: '2022',
        investors: ['EU Horizon Program']
      }
    ],
    metrics: {
      revenue2024: 1800000,
      revenue2025: 7500000
    },
    useOfFunds: {
      clinicalTrials: 40,
      rd: 30,
      regulatory: 15,
      operations: 15
    }
  },
  swot: {
    strengths: [
      'Proprietary algorithm with 92% accuracy in trials',
      'Strong IP portfolio with 3 granted patents',
      'Experienced team with domain expertise',
      'Minimally invasive approach balances precision with safety'
    ],
    weaknesses: [
      'Pre-revenue with long pathway to commercialization',
      'Limited clinical data compared to competitors',
      'Manufacturing scalability remains unproven',
      'High customer acquisition costs in medical market'
    ],
    opportunities: [
      'Aging population driving demand for assistive technologies',
      'Expansion into consumer applications (VR/AR control)',
      'Potential partnerships with prosthetics manufacturers',
      'Government reimbursement programs in EU and US'
    ],
    threats: [
      'Regulatory delays could extend time to market',
      'Well-funded competitors (Neuralink, Kernel)',
      'Potential privacy concerns with neural data',
      'Reimbursement uncertainty in key markets'
    ]
  },
  status: 'Draft',
  createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  updatedAt: new Date(Date.now() - 43200000).toISOString()
};

export default function MemoGenerator() {
  const [selectedDeal, setSelectedDeal] = useState<string>('1');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Simulate fetch deals query
  const { data: deals, isLoading: isLoadingDeals } = useQuery({
    queryKey: ['/api/deals'],
    queryFn: async () => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));
      return mockDeals;
    }
  });
  
  // Simulate fetch memo query
  const { data: memo, isLoading: isLoadingMemo } = useQuery({
    queryKey: ['/api/memos', selectedDeal],
    queryFn: async () => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1200));
      return mockMemo;
    },
    enabled: !!selectedDeal
  });
  
  const handleGenerateMemo = async () => {
    setIsGenerating(true);
    // Simulate memo generation
    await new Promise(resolve => setTimeout(resolve, 3000));
    setIsGenerating(false);
  };
  
  const isLoading = isLoadingDeals || isLoadingMemo;
  
  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader 
        title="Investment Memo Generator" 
        description="Create comprehensive investment memos with AI assistance."
      />
      
      <div className="mb-6">
        <Card className="bg-dark-light border-dark-lighter">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <label className="text-sm text-gray-400 mb-1 block">Select Company</label>
                <Select 
                  value={selectedDeal} 
                  onValueChange={setSelectedDeal}
                  disabled={isLoadingDeals}
                >
                  <SelectTrigger className="bg-dark border-dark-lighter text-white focus:ring-primary">
                    <SelectValue placeholder="Select a company" />
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
            </div>
          </CardContent>
        </Card>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Memo Content */}
          <div className="lg:col-span-2">
            <Card className="bg-dark-light border-dark-lighter mb-6">
              <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Investment Memo</h2>
                  <div>
                    <Select defaultValue="standard">
                      <SelectTrigger className="bg-dark-lighter border-dark-lighter text-white focus:ring-primary">
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent className="bg-dark-lighter border-dark-lighter">
                        <SelectItem value="standard">Standard VC Memo</SelectItem>
                        <SelectItem value="term-sheet">Term Sheet Memo</SelectItem>
                        <SelectItem value="executive">Executive Brief (2-3 pages)</SelectItem>
                        <SelectItem value="comprehensive">Comprehensive Analysis</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <MemoSection 
                  title="Executive Summary"
                  content={memo?.executiveSummary || ''}
                  editable
                />
                
                <MemoSection 
                  title="Product & Market"
                  content={memo?.productMarket || ''}
                  editable
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <MemoSection 
                    title="Team"
                    team={memo?.team || []}
                    editable
                  />
                  
                  <MemoSection 
                    title="Financials"
                    financials={memo?.financials}
                    editable
                  />
                </div>
                
                <MemoSection 
                  title="SWOT Analysis"
                  swot={memo?.swot}
                  editable
                />
              </CardContent>
            </Card>
          </div>
          
          {/* Right Column - Controls */}
          <div>
            <MemoControls 
              onGenerate={handleGenerateMemo} 
              isGenerating={isGenerating}
              currentDeal={deals?.find(d => d.id.toString() === selectedDeal)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
