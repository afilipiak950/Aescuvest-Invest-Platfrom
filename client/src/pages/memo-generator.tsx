import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/layout/page-header';
import MemoSection from '@/components/memo-generator/memo-section';
import MemoControls from '@/components/memo-generator/memo-controls';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, Brain, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ComprehensiveMemo {
  coverPage: string;                        // Professional cover page
  tableOfContents: string;                  // Comprehensive table of contents
  executiveSummary: string;                 // Executive summary
  investmentHighlights: string[];           // Key investment highlights
  marketAnalysis: {                         // Comprehensive market analysis (5-6 pages)
    marketContext: string;
    marketSize: {
      tam: string;
      sam: string;
      som: string;
    };
    competitiveLandscape: string;
    marketTiming: string;
  };
  productAnalysis: {                        // Detailed product and technology analysis (4-5 pages)
    productOverview: string;
    technologyAdvantage: string;
    competitiveEdge: string;
    developmentStage: string;
  };
  businessModel: {                          // Business model analysis (3-4 pages)
    revenueModel: string;
    pricingStrategy: string;
    salesChannels: string;
    customerAcquisition: string;
  };
  teamAssessment: {                         // Management team assessment (3-4 pages)
    management: string;
    keyPersonnel: string[];
    advisors: string;
    boardComposition: string;
  };
  financialAnalysis: {                      // Financial analysis and projections (4-5 pages)
    currentFinancials: string;
    projections: string;
    fundingHistory: string;
    useOfFunds: string;
  };
  commercialAnalysis: string;               // Commercial analysis and market penetration (3-4 pages)
  regulatoryAnalysis: string;               // Regulatory landscape and compliance (2-3 pages)
  clinicalAssessment: string;               // Clinical development and regulatory pathway (3-4 pages)
  ipAnalysis: string;                       // Intellectual property analysis (2-3 pages)
  researchInsights: string;                 // Research insights and technical differentiation (2-3 pages)
  riskAssessment: {                         // Risk assessment overview
    technicalRisks: string[];
    marketRisks: string[];
    competitiveRisks: string[];
    regulatoryRisks: string[];
    managementRisks: string[];
  };
  mitigationStrategies: string;             // Risk mitigation strategies (2-3 pages)
  legalAssessment: {                        // Legal assessment
    corporateStructure: string;
    ipProtection: string;
    regulatoryCompliance: string;
    contractualObligations: string;
  };
  swotAnalysis: {                           // SWOT analysis
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  investmentTerms: {                        // Investment terms and structure
    valuation: string;
    fundingAmount: string;
    securities: string;
    boardRights: string;
    liquidationPreference: string;
  };
  exitStrategy: string;                     // Exit strategy analysis (2-3 pages)
  recommendation: {                         // Investment recommendation and rationale (2-3 pages)
    investment_recommendation: string;
    rationale: string;
    keyMilestones: string[];
    exitStrategy: string;
  };
  appendices: string;                       // Comprehensive appendices with supporting data (5-10 pages)
}

export default function MemoGenerator() {
  const [selectedDeal, setSelectedDeal] = useState<string>('');
  const [generatedMemo, setGeneratedMemo] = useState<ComprehensiveMemo | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch real deals from API
  const { data: deals, isLoading: isLoadingDeals } = useQuery({
    queryKey: ['/api/deals'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  // Fetch existing memo if available
  const { data: existingMemo, isLoading: isLoadingMemo } = useQuery({
    queryKey: ['/api/deals', selectedDeal, 'memo'],
    enabled: !!selectedDeal
  });

  // Memo generation mutation
  const generateMemoMutation = useMutation({
    mutationFn: async (dealId: string) => {
      console.log(`🔄 Generating comprehensive investment memo for deal ${dealId}`);
      
      const response = await apiRequest(`/api/deals/${dealId}/generate-memo`, {
        method: 'POST',
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to generate memo');
      }
      
      return response.memo;
    },
    onSuccess: (memo: ComprehensiveMemo) => {
      console.log('✅ Investment memo generated successfully');
      setGeneratedMemo(memo);
      toast({
        title: "Investment Memo Generated",
        description: "Comprehensive memo created using all documents and agent analyses.",
      });
      // Invalidate memo query to refetch if stored
      queryClient.invalidateQueries({ queryKey: ['/api/deals', selectedDeal, 'memo'] });
    },
    onError: (error: any) => {
      console.error('❌ Memo generation failed:', error);
      toast({
        title: "Generation Failed",
        description: error?.message || "Failed to generate investment memo. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleGenerateMemo = () => {
    if (!selectedDeal) {
      toast({
        title: "No Deal Selected",
        description: "Please select a deal to generate an investment memo.",
        variant: "destructive",
      });
      return;
    }

    generateMemoMutation.mutate(selectedDeal);
  };
  
  const isLoading = isLoadingDeals || isLoadingMemo;
  const isGenerating = generateMemoMutation.isPending;
  const currentMemo = generatedMemo || existingMemo?.memo;
  const selectedDealData = deals?.find(d => d.id.toString() === selectedDeal);
  
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
                <label className="text-sm text-gray-400 mb-1 block">Select Deal</label>
                <Select 
                  value={selectedDeal} 
                  onValueChange={setSelectedDeal}
                  disabled={isLoadingDeals}
                >
                  <SelectTrigger className="bg-dark border-dark-lighter text-white focus:ring-primary">
                    <SelectValue placeholder="Select a deal to generate memo" />
                  </SelectTrigger>
                  <SelectContent className="bg-dark-lighter border-dark-lighter">
                    {deals?.map(deal => (
                      <SelectItem key={deal.id} value={deal.id.toString()}>
                        {deal.companyName} - {deal.stage} ({deal.status})
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
                
{!selectedDeal ? (
                  <div className="text-center py-12">
                    <FileText className="h-16 w-16 text-gray-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-300 mb-2">Select a Deal</h3>
                    <p className="text-gray-500">Choose a deal from the dropdown to generate a comprehensive investment memo.</p>
                  </div>
                ) : !currentMemo && !isGenerating ? (
                  <div className="text-center py-12">
                    <Brain className="h-16 w-16 text-primary mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">Ready to Generate</h3>
                    <p className="text-gray-400 mb-6">
                      Create a comprehensive investment memo using all documents, agent analyses, and market research for <span className="text-primary font-medium">{selectedDealData?.companyName}</span>.
                    </p>
                    <Button onClick={handleGenerateMemo} className="bg-primary hover:bg-primary/90">
                      <Brain className="h-4 w-4 mr-2" />
                      Generate Investment Memo
                    </Button>
                  </div>
                ) : isGenerating ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-16 w-16 text-primary mx-auto mb-4 animate-spin" />
                    <h3 className="text-lg font-medium text-white mb-2">Generating Comprehensive Memo</h3>
                    <p className="text-gray-400">
                      Analyzing all documents and agent reports for {selectedDealData?.companyName}...
                    </p>
                  </div>
                ) : (
                  <Tabs defaultValue="overview" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-6 bg-dark-lighter">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="analysis">Analysis</TabsTrigger>
                      <TabsTrigger value="financial">Financial</TabsTrigger>
                      <TabsTrigger value="risks">Risks</TabsTrigger>
                      <TabsTrigger value="legal">Legal</TabsTrigger>
                      <TabsTrigger value="recommendation">Decision</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="overview" className="space-y-8">
                      {/* Cover Page */}
                      {currentMemo?.coverPage && (
                        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg p-8">
                          <h3 className="text-2xl font-bold text-white mb-4">Investment Memorandum</h3>
                          <div className="text-gray-300 whitespace-pre-line">{currentMemo.coverPage}</div>
                        </div>
                      )}
                      
                      {/* Executive Summary */}
                      {currentMemo?.executiveSummary && (
                        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                            <TrendingUp className="h-5 w-5 mr-2 text-blue-400" />
                            Executive Summary
                          </h3>
                          <div className="text-gray-300 leading-relaxed whitespace-pre-line">{currentMemo.executiveSummary}</div>
                        </div>
                      )}

                      {/* Investment Highlights */}
                      {currentMemo?.investmentHighlights && currentMemo.investmentHighlights.length > 0 && (
                        <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4">Investment Highlights</h3>
                          <ul className="space-y-3">
                            {currentMemo.investmentHighlights.map((highlight: string, index: number) => (
                              <li key={index} className="flex items-start text-gray-300">
                                <span className="text-green-400 mr-3 mt-1">▪</span>
                                {highlight}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="analysis" className="space-y-8">
                      {/* Market Analysis */}
                      {currentMemo?.marketAnalysis && (
                        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4">Market Analysis</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Market Context</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">{currentMemo.marketAnalysis.marketContext}</div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Market Timing</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">{currentMemo.marketAnalysis.marketTiming}</div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">TAM/SAM/SOM</h4>
                              <div className="text-gray-300 text-sm space-y-1">
                                <div>TAM: {currentMemo.marketAnalysis.marketSize.tam}</div>
                                <div>SAM: {currentMemo.marketAnalysis.marketSize.sam}</div>
                                <div>SOM: {currentMemo.marketAnalysis.marketSize.som}</div>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Competitive Landscape</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">{currentMemo.marketAnalysis.competitiveLandscape}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Product Analysis */}
                      {currentMemo?.productAnalysis && (
                        <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4">Product & Technology Analysis</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Product Overview</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">{currentMemo.productAnalysis.productOverview}</div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Technology Advantage</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">{currentMemo.productAnalysis.technologyAdvantage}</div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Competitive Edge</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">{currentMemo.productAnalysis.competitiveEdge}</div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Development Stage</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">{currentMemo.productAnalysis.developmentStage}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Business Model */}
                      {currentMemo?.businessModel && (
                        <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4">Business Model</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Revenue Model</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">{currentMemo.businessModel.revenueModel}</div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Pricing Strategy</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">{currentMemo.businessModel.pricingStrategy}</div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Sales Channels</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">{currentMemo.businessModel.salesChannels}</div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Customer Acquisition</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">{currentMemo.businessModel.customerAcquisition}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Team Assessment */}
                      {currentMemo?.teamAssessment && (
                        <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4">Management Team Assessment</h3>
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Management</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">{currentMemo.teamAssessment.management}</div>
                            </div>
                            {currentMemo.teamAssessment.keyPersonnel.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-gray-200 mb-2">Key Personnel</h4>
                                <ul className="space-y-1">
                                  {currentMemo.teamAssessment.keyPersonnel.map((person: string, index: number) => (
                                    <li key={index} className="text-gray-300 text-sm">{person}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Advisors</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">{currentMemo.teamAssessment.advisors}</div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Board Composition</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">{currentMemo.teamAssessment.boardComposition}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Commercial Analysis */}
                      {currentMemo?.commercialAnalysis && (
                        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4">Commercial Analysis</h3>
                          <div className="text-gray-300 whitespace-pre-line">{currentMemo.commercialAnalysis}</div>
                        </div>
                      )}

                      {/* Clinical Assessment */}
                      {currentMemo?.clinicalAssessment && (
                        <div className="bg-gradient-to-r from-red-500/10 to-pink-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4">Clinical Assessment</h3>
                          <div className="text-gray-300 whitespace-pre-line">{currentMemo.clinicalAssessment}</div>
                        </div>
                      )}

                      {/* IP Analysis */}
                      {currentMemo?.ipAnalysis && (
                        <div className="bg-gradient-to-r from-indigo-500/10 to-blue-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4">Intellectual Property Analysis</h3>
                          <div className="text-gray-300 whitespace-pre-line">{currentMemo.ipAnalysis}</div>
                        </div>
                      )}

                      {/* Research Insights */}
                      {currentMemo?.researchInsights && (
                        <div className="bg-gradient-to-r from-teal-500/10 to-cyan-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4">Research Insights</h3>
                          <div className="text-gray-300 whitespace-pre-line">{currentMemo.researchInsights}</div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="financial" className="space-y-8">
                      {/* Financial Analysis */}
                      {currentMemo?.financialAnalysis && (
                        <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4">Financial Analysis</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Current Financials</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">{currentMemo.financialAnalysis.currentFinancials}</div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Projections</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">{currentMemo.financialAnalysis.projections}</div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Funding History</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">{currentMemo.financialAnalysis.fundingHistory}</div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Use of Funds</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">{currentMemo.financialAnalysis.useOfFunds}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Investment Terms */}
                      {currentMemo?.investmentTerms && (
                        <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4">Investment Terms</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Valuation</h4>
                              <div className="text-gray-300 text-sm">{currentMemo.investmentTerms.valuation}</div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Funding Amount</h4>
                              <div className="text-gray-300 text-sm">{currentMemo.investmentTerms.fundingAmount}</div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Securities</h4>
                              <div className="text-gray-300 text-sm">{currentMemo.investmentTerms.securities}</div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Board Rights</h4>
                              <div className="text-gray-300 text-sm">{currentMemo.investmentTerms.boardRights}</div>
                            </div>
                            <div className="md:col-span-2">
                              <h4 className="font-semibold text-gray-200 mb-2">Liquidation Preference</h4>
                              <div className="text-gray-300 text-sm">{currentMemo.investmentTerms.liquidationPreference}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="risks" className="space-y-8">
                      {/* Risk Assessment */}
                      {currentMemo?.riskAssessment && (
                        <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4">Risk Assessment</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <h4 className="font-semibold text-red-400 mb-3">Technical Risks</h4>
                              <ul className="space-y-2">
                                {currentMemo.riskAssessment.technicalRisks.map((risk: string, index: number) => (
                                  <li key={index} className="text-gray-300 text-sm flex items-start">
                                    <span className="text-red-400 mr-2">⚠</span>
                                    {risk}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <h4 className="font-semibold text-orange-400 mb-3">Market Risks</h4>
                              <ul className="space-y-2">
                                {currentMemo.riskAssessment.marketRisks.map((risk: string, index: number) => (
                                  <li key={index} className="text-gray-300 text-sm flex items-start">
                                    <span className="text-orange-400 mr-2">⚠</span>
                                    {risk}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <h4 className="font-semibold text-yellow-400 mb-3">Competitive Risks</h4>
                              <ul className="space-y-2">
                                {currentMemo.riskAssessment.competitiveRisks.map((risk: string, index: number) => (
                                  <li key={index} className="text-gray-300 text-sm flex items-start">
                                    <span className="text-yellow-400 mr-2">⚠</span>
                                    {risk}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <h4 className="font-semibold text-pink-400 mb-3">Regulatory Risks</h4>
                              <ul className="space-y-2">
                                {currentMemo.riskAssessment.regulatoryRisks.map((risk: string, index: number) => (
                                  <li key={index} className="text-gray-300 text-sm flex items-start">
                                    <span className="text-pink-400 mr-2">⚠</span>
                                    {risk}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="md:col-span-2">
                              <h4 className="font-semibold text-purple-400 mb-3">Management Risks</h4>
                              <ul className="space-y-2">
                                {currentMemo.riskAssessment.managementRisks.map((risk: string, index: number) => (
                                  <li key={index} className="text-gray-300 text-sm flex items-start">
                                    <span className="text-purple-400 mr-2">⚠</span>
                                    {risk}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Mitigation Strategies */}
                      {currentMemo?.mitigationStrategies && (
                        <div className="bg-gradient-to-r from-green-500/10 to-teal-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4">Risk Mitigation Strategies</h3>
                          <div className="text-gray-300 whitespace-pre-line">{currentMemo.mitigationStrategies}</div>
                        </div>
                      )}

                      {/* SWOT Analysis */}
                      {currentMemo?.swotAnalysis && (
                        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4">SWOT Analysis</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <h4 className="font-semibold text-green-400 mb-3">Strengths</h4>
                              <ul className="space-y-2">
                                {currentMemo.swotAnalysis.strengths.map((item: string, index: number) => (
                                  <li key={index} className="text-gray-300 text-sm flex items-start">
                                    <span className="text-green-400 mr-2">+</span>
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <h4 className="font-semibold text-red-400 mb-3">Weaknesses</h4>
                              <ul className="space-y-2">
                                {currentMemo.swotAnalysis.weaknesses.map((item: string, index: number) => (
                                  <li key={index} className="text-gray-300 text-sm flex items-start">
                                    <span className="text-red-400 mr-2">-</span>
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <h4 className="font-semibold text-blue-400 mb-3">Opportunities</h4>
                              <ul className="space-y-2">
                                {currentMemo.swotAnalysis.opportunities.map((item: string, index: number) => (
                                  <li key={index} className="text-gray-300 text-sm flex items-start">
                                    <span className="text-blue-400 mr-2">↗</span>
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <h4 className="font-semibold text-yellow-400 mb-3">Threats</h4>
                              <ul className="space-y-2">
                                {currentMemo.swotAnalysis.threats.map((item: string, index: number) => (
                                  <li key={index} className="text-gray-300 text-sm flex items-start">
                                    <span className="text-yellow-400 mr-2">⚠</span>
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="legal" className="space-y-8">
                      {/* Legal Assessment */}
                      {currentMemo?.legalAssessment && (
                        <div className="bg-gradient-to-r from-slate-500/10 to-gray-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4">Legal Assessment</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Corporate Structure</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">{currentMemo.legalAssessment.corporateStructure}</div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">IP Protection</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">{currentMemo.legalAssessment.ipProtection}</div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Regulatory Compliance</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">{currentMemo.legalAssessment.regulatoryCompliance}</div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Contractual Obligations</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">{currentMemo.legalAssessment.contractualObligations}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Regulatory Analysis */}
                      {currentMemo?.regulatoryAnalysis && (
                        <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4">Regulatory Analysis</h3>
                          <div className="text-gray-300 whitespace-pre-line">{currentMemo.regulatoryAnalysis}</div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="recommendation" className="space-y-8">
                      {/* Investment Recommendation */}
                      {currentMemo?.recommendation && (
                        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4">Investment Recommendation</h3>
                          <div className="space-y-4">
                            <div>
                              <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-primary text-white mb-3">
                                {currentMemo.recommendation.investment_recommendation}
                              </span>
                              <div className="text-gray-300 whitespace-pre-line">{currentMemo.recommendation.rationale}</div>
                            </div>
                            {currentMemo.recommendation.keyMilestones.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-gray-200 mb-2">Key Milestones</h4>
                                <ul className="space-y-1">
                                  {currentMemo.recommendation.keyMilestones.map((milestone: string, index: number) => (
                                    <li key={index} className="text-gray-300 text-sm flex items-start">
                                      <span className="text-primary mr-2">•</span>
                                      {milestone}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Exit Strategy</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">{currentMemo.recommendation.exitStrategy}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Exit Strategy */}
                      {currentMemo?.exitStrategy && (
                        <div className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4">Exit Strategy Analysis</h3>
                          <div className="text-gray-300 whitespace-pre-line">{currentMemo.exitStrategy}</div>
                        </div>
                      )}

                      {/* Appendices */}
                      {currentMemo?.appendices && (
                        <div className="bg-gradient-to-r from-gray-500/10 to-slate-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4">Appendices</h3>
                          <div className="text-gray-300 whitespace-pre-line">{currentMemo.appendices}</div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Right Column - Controls */}
          <div>
            <Card className="bg-dark-light border-dark-lighter sticky top-6">
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Generation Controls</h3>
                
                {selectedDealData && (
                  <div className="space-y-4 mb-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-1">Selected Deal</h4>
                      <p className="text-white font-medium">{selectedDealData.companyName}</p>
                      <p className="text-sm text-gray-400">{selectedDealData.stage} • {selectedDealData.status}</p>
                    </div>
                    
                    <div className="flex space-x-4 text-sm">
                      <div>
                        <span className="text-gray-400">Sector:</span>
                        <span className="text-white ml-1">{selectedDealData.sector}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Location:</span>
                        <span className="text-white ml-1">{selectedDealData.location}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <Button 
                    onClick={handleGenerateMemo}
                    disabled={!selectedDeal || isGenerating}
                    className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Brain className="h-4 w-4 mr-2" />
                        Generate Comprehensive Memo
                      </>
                    )}
                  </Button>
                  
                  {currentMemo && (
                    <Button 
                      variant="outline" 
                      className="w-full border-dark-lighter text-white hover:bg-dark-lighter"
                      onClick={() => {
                        // TODO: Implement export functionality
                        toast({
                          title: "Export Feature",
                          description: "Export functionality will be added soon.",
                        });
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Export PDF
                    </Button>
                  )}
                </div>
                
                {selectedDeal && (
                  <div className="mt-6 pt-6 border-t border-dark-lighter">
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Memo will include:</h4>
                    <ul className="space-y-2 text-sm text-gray-300">
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                        All uploaded documents
                      </li>
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                        7 agent analyses (Legal, Financial, etc.)
                      </li>
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                        AI-powered market research
                      </li>
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-orange-400 rounded-full mr-2"></span>
                        Investment recommendation
                      </li>
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
