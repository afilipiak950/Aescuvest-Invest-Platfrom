import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/layout/page-header';
import InvestorCard from '@/components/investor-matching/investor-card';
import FilterSidebar from '@/components/investor-matching/filter-sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search } from 'lucide-react';
import { Deal, Investor } from '@/types';

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
  }
];

const mockInvestors: Investor[] = [
  {
    id: 1,
    name: 'Health Ventures Capital',
    location: 'Berlin, Germany',
    focus: ['HealthTech', 'MedTech', 'Digital Health'],
    stages: ['Series A', 'Series B'],
    checkSize: '€2M - €8M',
    matchScore: 94,
    portfolio: ['Cortex Medical', 'DigiHealth', 'MedSense', 'NeuraTech'],
    matchInsights: [
      'Previously invested in neural interface startup Cortex Medical',
      'Portfolio includes 3 medical device companies',
      'Led Series A round for similar German healthtech startup',
      'Has co-investment history with existing investor HTGF'
    ]
  },
  {
    id: 2,
    name: 'Innovation Neuro Fund',
    location: 'Zurich, Switzerland',
    focus: ['Neurotechnology', 'BCI', 'Medical Devices'],
    stages: ['Series A', 'Series B'],
    checkSize: '€3M - €10M',
    matchScore: 92,
    portfolio: ['NeuraTech', 'BrainSync', 'NeuroPulse', 'Minder'],
    matchInsights: [
      'Specialist fund focused exclusively on neurotechnology',
      'Partner Dr. Müller has background in neural interfaces',
      'Looking specifically for BCI investments in 2023',
      'Recently closed a competitive investment (potential conflict)'
    ]
  },
  {
    id: 3,
    name: 'MedTech Partners',
    location: 'Munich, Germany',
    focus: ['MedTech', 'HealthTech', 'Life Sciences'],
    stages: ['Series A', 'Series B', 'Growth'],
    checkSize: '€5M - €15M',
    matchScore: 88,
    portfolio: ['MedSense', 'ImplantTech', 'Cardios', 'NeuroSolutions'],
    matchInsights: [
      'Strong track record in medical device investments',
      'Strategic partnerships with major healthcare providers',
      'Supports portfolio with regulatory expertise',
      'Typically invests larger amounts than current round size'
    ]
  }
];

export default function InvestorMatching() {
  const [selectedDeal, setSelectedDeal] = useState<string>('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('match');
  
  // Simulate fetch deals query
  const { data: deals, isLoading: isLoadingDeals } = useQuery({
    queryKey: ['/api/deals'],
    queryFn: async () => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));
      return mockDeals;
    }
  });
  
  // Simulate fetch investors query
  const { data: investors, isLoading: isLoadingInvestors } = useQuery({
    queryKey: ['/api/investors', selectedDeal],
    queryFn: async () => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1200));
      return mockInvestors;
    },
    enabled: !!selectedDeal
  });
  
  const filteredInvestors = investors?.filter(investor => 
    investor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    investor.focus.some(f => f.toLowerCase().includes(searchQuery.toLowerCase())) ||
    investor.location.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const sortedInvestors = [...(filteredInvestors || [])].sort((a, b) => {
    if (sortBy === 'match') return b.matchScore - a.matchScore;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'check') {
      const extractNumber = (str: string) => {
        const match = str.match(/\d+/g);
        return match ? parseInt(match[0]) : 0;
      };
      return extractNumber(b.checkSize) - extractNumber(a.checkSize);
    }
    return 0;
  });
  
  const isLoading = isLoadingDeals || isLoadingInvestors;
  const currentDeal = deals?.find(d => d.id.toString() === selectedDeal);
  
  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader 
        title="Investor Matching" 
        description="Find the right investors for your deals based on AI-powered analysis."
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Column - Filters */}
        <div className="lg:col-span-1">
          <FilterSidebar 
            deals={deals || []} 
            selectedDeal={selectedDeal}
            onDealChange={setSelectedDeal}
            isLoading={isLoadingDeals}
          />
        </div>
        
        {/* Right Column - Investor List */}
        <div className="lg:col-span-3">
          <Card className="bg-dark-light border-dark-lighter mb-6">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                  <CardTitle className="text-xl font-semibold">Top Investor Matches</CardTitle>
                  {!isLoading && currentDeal && (
                    <p className="text-gray-400 text-sm">
                      {sortedInvestors?.length} investors matched for {currentDeal.companyName}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="Search investors..."
                      className="bg-dark-lighter border-dark-lighter text-white pl-9 pr-4 w-full md:w-64 focus-visible:ring-primary"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Search className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
                  </div>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="bg-dark-lighter border-dark-lighter text-white focus:ring-primary w-40">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent className="bg-dark-lighter border-dark-lighter">
                      <SelectItem value="match">Sort by Match</SelectItem>
                      <SelectItem value="name">Sort by Name</SelectItem>
                      <SelectItem value="check">Sort by Size</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : sortedInvestors && sortedInvestors.length > 0 ? (
                <div className="space-y-4">
                  {sortedInvestors.map(investor => (
                    <InvestorCard key={investor.id} investor={investor} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-400">No investors found matching your criteria.</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Email Template Section */}
          <Card className="bg-dark-light border-dark-lighter">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl font-semibold">Outreach Campaign</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-dark-lighter rounded-lg p-5 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium">Email Template</h4>
                  <button className="bg-dark px-3 py-1 text-xs rounded">Edit</button>
                </div>
                <div className="bg-dark rounded-lg p-4 text-sm">
                  <p className="mb-2"><strong>Subject:</strong> NeuroTech AI - Series A Investment Opportunity in Neural Interface Technology</p>
                  <p className="mb-2">Dear {'{investor_name}'},</p>
                  <p className="mb-2">I hope this email finds you well. I'm reaching out regarding NeuroTech AI, a promising startup in the neural interface space that aligns well with {'{firm_name}'}'s investment focus in {'{focus_area}'}.</p>
                  <p className="mb-2">NeuroTech AI is developing a next-generation brain-computer interface with proprietary neural decoding algorithms that show 92% accuracy in trials - significantly outperforming competitors while remaining minimally invasive.</p>
                  <p className="mb-2">Key highlights:</p>
                  <ul className="list-disc pl-5 mb-2 space-y-1">
                    <li>Experienced team with backgrounds from MIT, ETH Zurich, and Medtronic</li>
                    <li>Strong IP portfolio with 3 granted patents and 5 pending applications</li>
                    <li>Regulatory pathway defined with FDA pre-submission completed</li>
                    <li>€2.5M seed round closed in 2021, now raising €8.5M Series A</li>
                  </ul>
                  <p className="mb-2">We've completed our due diligence and would be happy to share our investment memo and introduce you to the founding team if there's interest.</p>
                  <p className="mb-2">Would you be available for a brief call next week to discuss this opportunity?</p>
                  <p>Best regards,</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Selected Investors</h4>
                  <div className="bg-dark-lighter rounded-lg p-3 max-h-48 overflow-y-auto">
                    <div className="space-y-2">
                      {sortedInvestors?.slice(0, 3).map(investor => (
                        <div key={investor.id} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center font-semibold text-dark text-xs mr-2">
                              {investor.name.charAt(0)}
                            </div>
                            <span className="text-sm">{investor.name}</span>
                          </div>
                          <button className="text-gray-400 hover:text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3">Materials</h4>
                  <div className="bg-dark-lighter rounded-lg p-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm">Investment Memo.pdf</span>
                        </div>
                        <div className="flex">
                          <input type="checkbox" className="mr-1 h-4 w-4 text-primary" defaultChecked />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm">Teaser Deck.pdf</span>
                        </div>
                        <div className="flex">
                          <input type="checkbox" className="mr-1 h-4 w-4 text-primary" defaultChecked />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3">Schedule</h4>
                  <div className="bg-dark-lighter rounded-lg p-3">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Send Date</label>
                        <input type="date" className="w-full bg-dark border-dark-lighter rounded p-2 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Time</label>
                        <select className="w-full bg-dark border-dark-lighter rounded p-2 text-sm">
                          <option>9:00 AM</option>
                          <option>10:00 AM</option>
                          <option>11:00 AM</option>
                          <option>12:00 PM</option>
                          <option>1:00 PM</option>
                          <option>2:00 PM</option>
                        </select>
                      </div>
                      <div>
                        <label className="flex items-center text-xs">
                          <input type="checkbox" className="mr-2 h-4 w-4 text-primary" defaultChecked />
                          <span>Schedule follow-up reminder (5 days)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button className="bg-dark-lighter hover:bg-dark px-4 py-2 rounded-lg text-sm mr-3">
                  Save Draft
                </button>
                <button className="bg-primary hover:bg-primary-hover text-dark font-medium px-4 py-2 rounded-lg text-sm">
                  Send Campaign
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
