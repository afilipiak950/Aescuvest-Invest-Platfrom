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
  executiveSummary: string;
  investmentHighlights: string[];
  marketAnalysis: {
    marketContext: string;
    marketSize: {
      tam: string;
      sam: string;
      som: string;
    };
    competitiveLandscape: string;
    marketTiming: string;
  };
  productAnalysis: {
    productOverview: string;
    technologyAdvantage: string;
    competitiveEdge: string;
    developmentStage: string;
  };
  businessModel: {
    revenueModel: string;
    pricingStrategy: string;
    salesChannels: string;
    customerAcquisition: string;
  };
  teamAssessment: {
    management: string;
    keyPersonnel: string[];
    advisors: string;
    boardComposition: string;
  };
  financialAnalysis: {
    currentFinancials: string;
    projections: string;
    fundingHistory: string;
    useOfFunds: string;
  };
  riskAssessment: {
    technicalRisks: string[];
    marketRisks: string[];
    competitiveRisks: string[];
    regulatoryRisks: string[];
    managementRisks: string[];
  };
  legalAssessment: {
    corporateStructure: string;
    ipProtection: string;
    regulatoryCompliance: string;
    contractualObligations: string;
  };
  swotAnalysis: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  investmentTerms: {
    valuation: string;
    fundingAmount: string;
    securities: string;
    boardRights: string;
    liquidationPreference: string;
  };
  recommendation: {
    investment_recommendation: string;
    rationale: string;
    keyMilestones: string[];
    exitStrategy: string;
  };
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
                  <div className="space-y-8">
                    {/* Executive Summary */}
                    <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-6">
                      <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                        <TrendingUp className="h-5 w-5 mr-2 text-blue-400" />
                        Executive Summary
                      </h3>
                      <p className="text-gray-300 leading-relaxed">{currentMemo?.executiveSummary}</p>
                    </div>

                    {/* Investment Highlights */}
                    {currentMemo?.investmentHighlights && currentMemo.investmentHighlights.length > 0 && (
                      <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-lg p-6">
                        <h3 className="text-xl font-bold text-white mb-4">Investment Highlights</h3>
                        <ul className="space-y-3">
                          {currentMemo.investmentHighlights.map((highlight, index) => (
                            <li key={index} className="flex items-start text-gray-300">
                              <span className="text-green-400 mr-3 mt-1">▪</span>
                              {highlight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Market Analysis */}
                    {currentMemo?.marketAnalysis && (
                      <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-6">
                        <h3 className="text-xl font-bold text-white mb-4">Market Analysis</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-semibold text-gray-200 mb-2">Market Context</h4>
                            <p className="text-gray-300 text-sm">{currentMemo.marketAnalysis.marketContext}</p>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-200 mb-2">Market Timing</h4>
                            <p className="text-gray-300 text-sm">{currentMemo.marketAnalysis.marketTiming}</p>
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
                            <p className="text-gray-300 text-sm">{currentMemo.marketAnalysis.competitiveLandscape}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SWOT Analysis */}
                    {currentMemo?.swotAnalysis && (
                      <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-lg p-6">
                        <h3 className="text-xl font-bold text-white mb-4">SWOT Analysis</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-semibold text-green-400 mb-3">Strengths</h4>
                            <ul className="space-y-2">
                              {currentMemo.swotAnalysis.strengths.map((item, index) => (
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
                              {currentMemo.swotAnalysis.weaknesses.map((item, index) => (
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
                              {currentMemo.swotAnalysis.opportunities.map((item, index) => (
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
                              {currentMemo.swotAnalysis.threats.map((item, index) => (
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

                    {/* Investment Recommendation */}
                    {currentMemo?.recommendation && (
                      <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-lg p-6">
                        <h3 className="text-xl font-bold text-white mb-4">Investment Recommendation</h3>
                        <div className="space-y-4">
                          <div>
                            <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-primary text-white mb-3">
                              {currentMemo.recommendation.investment_recommendation}
                            </span>
                            <p className="text-gray-300">{currentMemo.recommendation.rationale}</p>
                          </div>
                          {currentMemo.recommendation.keyMilestones.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Key Milestones</h4>
                              <ul className="space-y-1">
                                {currentMemo.recommendation.keyMilestones.map((milestone, index) => (
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
                            <p className="text-gray-300 text-sm">{currentMemo.recommendation.exitStrategy}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
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
