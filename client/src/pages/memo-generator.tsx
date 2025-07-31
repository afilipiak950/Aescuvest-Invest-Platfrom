import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PageHeader from '@/components/layout/page-header';
import MemoSection from '@/components/memo-generator/memo-section';
import MemoControls from '@/components/memo-generator/memo-controls';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, Brain, TrendingUp, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { cleanMarkdown, formatBusinessText, formatObjectContent } from '@/utils/textFormatter';
import { FormattedContent, SectionHeader, InfoGrid } from '@/components/FormattedContent';

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
                        {deal.companyName} - {deal.stage} {deal.id === 33 ? "✅ (100 docs + analyses)" : deal.id === 22 ? "✅ (263 docs)" : deal.id === 18 ? "✅ (263 docs)" : "❌ (no data)"}
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
                    {selectedDealData && ![18, 22, 33].includes(selectedDealData.id) && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
                        <p className="text-yellow-400 text-sm">
                          ⚠️ This deal has no documents or agent analyses. For best results, select Deal 33 (Neteera IM) with 100 documents and completed analyses.
                        </p>
                      </div>
                    )}
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
                          <SectionHeader 
                            title="Investment Memorandum" 
                            subtitle="Professional investment opportunity presentation"
                            className="mb-8"
                          />
                          <FormattedContent content={currentMemo.coverPage} variant="large" />
                        </div>
                      )}
                      
                      {/* Executive Summary */}
                      {currentMemo?.executiveSummary && (
                        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-6">
                          <SectionHeader 
                            title="Executive Summary" 
                            subtitle="Investment opportunity overview and key value proposition"
                            icon={<TrendingUp className="h-5 w-5 text-blue-400" />}
                          />
                          <FormattedContent content={currentMemo.executiveSummary} variant="large" />
                        </div>
                      )}

                      {/* Investment Highlights */}
                      {Array.isArray(currentMemo?.investmentHighlights) && currentMemo.investmentHighlights.length > 0 && (
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
                      {!Array.isArray(currentMemo?.investmentHighlights) && currentMemo?.investmentHighlights && (
                        <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4">Investment Highlights</h3>
                          <div className="text-gray-300 prose prose-invert max-w-none whitespace-pre-line">
                            {formatBusinessText(currentMemo.investmentHighlights)}
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="analysis" className="space-y-8 min-h-[400px]">
                      {/* Market Analysis */}
                      {currentMemo?.marketAnalysis && (
                        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-6">
                          <SectionHeader 
                            title="Market Analysis" 
                            subtitle="Market size, timing, and competitive landscape assessment"
                          />
                          <InfoGrid 
                            items={[
                              { label: "Market Context", content: currentMemo.marketAnalysis.marketContext },
                              { label: "Market Timing", content: currentMemo.marketAnalysis.marketTiming },
                              { 
                                label: "TAM/SAM/SOM", 
                                content: `TAM: ${currentMemo.marketAnalysis.marketSize.tam}\nSAM: ${currentMemo.marketAnalysis.marketSize.sam}\nSOM: ${currentMemo.marketAnalysis.marketSize.som}`
                              },
                              { label: "Competitive Landscape", content: currentMemo.marketAnalysis.competitiveLandscape }
                            ]}
                            columns={2}
                          />
                        </div>
                      )}

                      {/* Product Analysis */}
                      {currentMemo?.productAnalysis && (
                        <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-lg p-6">
                          <SectionHeader 
                            title="Product & Technology Analysis" 
                            subtitle="Product overview and technological differentiation"
                          />
                          <InfoGrid 
                            items={[
                              { label: "Product Overview", content: currentMemo.productAnalysis.productOverview },
                              { label: "Technology Advantage", content: currentMemo.productAnalysis.technologyAdvantage },
                              { label: "Competitive Edge", content: currentMemo.productAnalysis.competitiveEdge },
                              { label: "Development Stage", content: currentMemo.productAnalysis.developmentStage }
                            ]}
                            columns={2}
                          />
                        </div>
                      )}

                      {/* Business Model */}
                      {currentMemo?.businessModel && (
                        <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-lg p-6">
                          <SectionHeader 
                            title="Business Model" 
                            subtitle="Revenue strategy and customer acquisition approach"
                          />
                          <InfoGrid 
                            items={[
                              { label: "Revenue Model", content: currentMemo.businessModel.revenueModel },
                              { label: "Pricing Strategy", content: currentMemo.businessModel.pricingStrategy },
                              { label: "Sales Channels", content: currentMemo.businessModel.salesChannels },
                              { label: "Customer Acquisition", content: currentMemo.businessModel.customerAcquisition }
                            ]}
                            columns={2}
                          />
                        </div>
                      )}

                      {/* Team Assessment */}
                      {currentMemo?.teamAssessment && (
                        <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4">Management Team Assessment</h3>
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Management</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">
                                {formatObjectContent(currentMemo.teamAssessment.management)}
                              </div>
                            </div>
                            {Array.isArray(currentMemo.teamAssessment.keyPersonnel) && currentMemo.teamAssessment.keyPersonnel.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-gray-200 mb-2">Key Personnel</h4>
                                <ul className="space-y-1">
                                  {currentMemo.teamAssessment.keyPersonnel.map((person: any, index: number) => (
                                    <li key={index} className="text-gray-300 text-sm">
                                      {typeof person === 'string' ? person : 
                                       typeof person === 'object' && person !== null ? 
                                       `${person.name || ''} - ${person.role || ''} ${person.background ? `(${person.background})` : ''}`.trim() :
                                       String(person)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {!Array.isArray(currentMemo.teamAssessment.keyPersonnel) && currentMemo.teamAssessment.keyPersonnel && (
                              <div>
                                <h4 className="font-semibold text-gray-200 mb-2">Key Personnel</h4>
                                <div className="text-gray-300 text-sm whitespace-pre-line">
                                  {formatObjectContent(currentMemo.teamAssessment.keyPersonnel)}
                                </div>
                              </div>
                            )}
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Advisors</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">
                                {formatObjectContent(currentMemo.teamAssessment.advisors)}
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-2">Board Composition</h4>
                              <div className="text-gray-300 text-sm whitespace-pre-line">
                                {formatObjectContent(currentMemo.teamAssessment.boardComposition)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Commercial Analysis */}
                      {currentMemo?.commercialAnalysis && (
                        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4">Commercial Analysis</h3>
                          <div className="text-gray-300 prose prose-invert max-w-none whitespace-pre-line">
                            {formatBusinessText(currentMemo.commercialAnalysis)}
                          </div>
                        </div>
                      )}

                      {/* Clinical Assessment */}
                      {currentMemo?.clinicalAssessment && (
                        <div className="bg-gradient-to-r from-red-500/10 to-pink-500/10 rounded-lg p-6">
                          <SectionHeader 
                            title="Clinical Assessment" 
                            subtitle="Clinical evaluation and regulatory pathway analysis"
                          />
                          <FormattedContent content={currentMemo.clinicalAssessment} variant="default" />
                        </div>
                      )}

                      {/* IP Analysis */}
                      {currentMemo?.ipAnalysis && (
                        <div className="bg-gradient-to-r from-indigo-500/10 to-blue-500/10 rounded-lg p-6">
                          <SectionHeader 
                            title="Intellectual Property Analysis" 
                            subtitle="Patent portfolio and IP protection strategy"
                          />
                          <FormattedContent content={currentMemo.ipAnalysis} variant="default" />
                        </div>
                      )}

                      {/* Research Insights */}
                      {currentMemo?.researchInsights && (
                        <div className="bg-gradient-to-r from-teal-500/10 to-cyan-500/10 rounded-lg p-6">
                          <SectionHeader 
                            title="Research Insights" 
                            subtitle="Market research and competitive intelligence"
                          />
                          <FormattedContent content={currentMemo.researchInsights} variant="default" />
                        </div>
                      )}
                      
                      {/* Fallback content if no analysis sections exist */}
                      {!currentMemo?.marketAnalysis && !currentMemo?.productAnalysis && !currentMemo?.businessModel && !currentMemo?.teamAssessment && !currentMemo?.commercialAnalysis && !currentMemo?.clinicalAssessment && !currentMemo?.ipAnalysis && !currentMemo?.researchInsights && (
                        <div className="bg-gradient-to-r from-gray-500/10 to-slate-500/10 rounded-lg p-8 text-center">
                          <h3 className="text-xl font-bold text-white mb-4">Analysis In Progress</h3>
                          <p className="text-gray-300">Detailed analysis sections will appear here once the investment memo is generated.</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="financial" className="space-y-8 min-h-[400px]">
                      {/* Financial Analysis */}
                      {currentMemo?.financialAnalysis && (
                        <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg p-6">
                          <SectionHeader 
                            title="Financial Analysis" 
                            subtitle="Financial performance and projections overview"
                          />
                          <InfoGrid 
                            items={[
                              { label: "Current Financials", content: currentMemo.financialAnalysis.currentFinancials },
                              { label: "Projections", content: currentMemo.financialAnalysis.projections },
                              { label: "Funding History", content: currentMemo.financialAnalysis.fundingHistory },
                              { label: "Use of Funds", content: currentMemo.financialAnalysis.useOfFunds }
                            ]}
                            columns={2}
                          />
                        </div>
                      )}

                      {/* Investment Terms */}
                      {currentMemo?.investmentTerms && (
                        <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-lg p-6">
                          <SectionHeader 
                            title="Investment Terms" 
                            subtitle="Deal structure, valuation, and investment terms"
                          />
                          <InfoGrid 
                            items={[
                              { label: "Valuation", content: formatObjectContent(currentMemo.investmentTerms.valuation) },
                              { label: "Funding Amount", content: currentMemo.investmentTerms.fundingAmount },
                              { label: "Securities", content: formatObjectContent(currentMemo.investmentTerms.securities) },
                              { label: "Board Rights", content: formatObjectContent(currentMemo.investmentTerms.boardRights) },
                              { 
                                label: "Liquidation Preference", 
                                content: currentMemo.investmentTerms.liquidationPreference,
                                className: "md:col-span-2"
                              }
                            ]}
                            columns={2}
                          />
                        </div>
                      )}
                      
                      {/* Fallback content if no financial sections exist */}
                      {!currentMemo?.financialAnalysis && !currentMemo?.investmentTerms && (
                        <div className="bg-gradient-to-r from-gray-500/10 to-slate-500/10 rounded-lg p-8 text-center">
                          <h3 className="text-xl font-bold text-white mb-4">Financial Analysis In Progress</h3>
                          <p className="text-gray-300">Financial analysis and investment terms will appear here once the investment memo is generated.</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="risks" className="space-y-8 min-h-[400px]">
                      {/* Risk Assessment */}
                      {currentMemo?.riskAssessment && (
                        <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4">Risk Assessment</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <h4 className="font-semibold text-red-400 mb-3">Technical Risks</h4>
                              {Array.isArray(currentMemo.riskAssessment.technicalRisks) ? (
                                <ul className="space-y-2">
                                  {currentMemo.riskAssessment.technicalRisks.map((risk: string, index: number) => (
                                    <li key={index} className="text-gray-300 text-sm flex items-start">
                                      <span className="text-red-400 mr-2">⚠</span>
                                      {risk}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-gray-300 text-sm whitespace-pre-line">{formatBusinessText(currentMemo.riskAssessment.technicalRisks) || 'No technical risks identified'}</div>
                              )}
                            </div>
                            <div>
                              <h4 className="font-semibold text-orange-400 mb-3">Market Risks</h4>
                              {Array.isArray(currentMemo.riskAssessment.marketRisks) ? (
                                <ul className="space-y-2">
                                  {currentMemo.riskAssessment.marketRisks.map((risk: string, index: number) => (
                                    <li key={index} className="text-gray-300 text-sm flex items-start">
                                      <span className="text-orange-400 mr-2">⚠</span>
                                      {risk}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-gray-300 text-sm whitespace-pre-line">{formatBusinessText(currentMemo.riskAssessment.marketRisks) || 'No market risks identified'}</div>
                              )}
                            </div>
                            <div>
                              <h4 className="font-semibold text-yellow-400 mb-3">Competitive Risks</h4>
                              {Array.isArray(currentMemo.riskAssessment.competitiveRisks) ? (
                                <ul className="space-y-2">
                                  {currentMemo.riskAssessment.competitiveRisks.map((risk: string, index: number) => (
                                    <li key={index} className="text-gray-300 text-sm flex items-start">
                                      <span className="text-yellow-400 mr-2">⚠</span>
                                      {risk}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-gray-300 text-sm whitespace-pre-line">{formatBusinessText(currentMemo.riskAssessment.competitiveRisks) || 'No competitive risks identified'}</div>
                              )}
                            </div>
                            <div>
                              <h4 className="font-semibold text-pink-400 mb-3">Regulatory Risks</h4>
                              {Array.isArray(currentMemo.riskAssessment.regulatoryRisks) ? (
                                <ul className="space-y-2">
                                  {currentMemo.riskAssessment.regulatoryRisks.map((risk: string, index: number) => (
                                    <li key={index} className="text-gray-300 text-sm flex items-start">
                                      <span className="text-pink-400 mr-2">⚠</span>
                                      {risk}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-gray-300 text-sm whitespace-pre-line">{formatBusinessText(currentMemo.riskAssessment.regulatoryRisks) || 'No regulatory risks identified'}</div>
                              )}
                            </div>
                            <div className="md:col-span-2">
                              <h4 className="font-semibold text-purple-400 mb-3">Management Risks</h4>
                              {Array.isArray(currentMemo.riskAssessment.managementRisks) ? (
                                <ul className="space-y-2">
                                  {currentMemo.riskAssessment.managementRisks.map((risk: string, index: number) => (
                                    <li key={index} className="text-gray-300 text-sm flex items-start">
                                      <span className="text-purple-400 mr-2">⚠</span>
                                      {risk}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-gray-300 text-sm">{currentMemo.riskAssessment.managementRisks || 'No management risks identified'}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Mitigation Strategies */}
                      {currentMemo?.mitigationStrategies && (
                        <div className="bg-gradient-to-r from-green-500/10 to-teal-500/10 rounded-lg p-6">
                          <SectionHeader 
                            title="Risk Mitigation Strategies" 
                            subtitle="Risk management and mitigation approaches"
                          />
                          <FormattedContent content={currentMemo.mitigationStrategies} variant="default" />
                        </div>
                      )}

                      {/* SWOT Analysis */}
                      {currentMemo?.swotAnalysis && (
                        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-lg p-6">
                          <h3 className="text-xl font-bold text-white mb-4">SWOT Analysis</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <h4 className="font-semibold text-green-400 mb-3">Strengths</h4>
                              {Array.isArray(currentMemo.swotAnalysis.strengths) ? (
                                <ul className="space-y-2">
                                  {currentMemo.swotAnalysis.strengths.map((item: string, index: number) => (
                                    <li key={index} className="text-gray-300 text-sm flex items-start">
                                      <span className="text-green-400 mr-2">+</span>
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-gray-300 text-sm whitespace-pre-line">{formatBusinessText(currentMemo.swotAnalysis.strengths) || 'No strengths identified'}</div>
                              )}
                            </div>
                            <div>
                              <h4 className="font-semibold text-red-400 mb-3">Weaknesses</h4>
                              {Array.isArray(currentMemo.swotAnalysis.weaknesses) ? (
                                <ul className="space-y-2">
                                  {currentMemo.swotAnalysis.weaknesses.map((item: string, index: number) => (
                                    <li key={index} className="text-gray-300 text-sm flex items-start">
                                      <span className="text-red-400 mr-2">-</span>
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-gray-300 text-sm whitespace-pre-line">{formatBusinessText(currentMemo.swotAnalysis.weaknesses) || 'No weaknesses identified'}</div>
                              )}
                            </div>
                            <div>
                              <h4 className="font-semibold text-blue-400 mb-3">Opportunities</h4>
                              {Array.isArray(currentMemo.swotAnalysis.opportunities) ? (
                                <ul className="space-y-2">
                                  {currentMemo.swotAnalysis.opportunities.map((item: string, index: number) => (
                                    <li key={index} className="text-gray-300 text-sm flex items-start">
                                      <span className="text-blue-400 mr-2">↗</span>
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-gray-300 text-sm whitespace-pre-line">{formatBusinessText(currentMemo.swotAnalysis.opportunities) || 'No opportunities identified'}</div>
                              )}
                            </div>
                            <div>
                              <h4 className="font-semibold text-yellow-400 mb-3">Threats</h4>
                              {Array.isArray(currentMemo.swotAnalysis.threats) ? (
                                <ul className="space-y-2">
                                  {currentMemo.swotAnalysis.threats.map((item: string, index: number) => (
                                    <li key={index} className="text-gray-300 text-sm flex items-start">
                                      <span className="text-yellow-400 mr-2">⚠</span>
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-gray-300 text-sm whitespace-pre-line">{formatBusinessText(currentMemo.swotAnalysis.threats) || 'No threats identified'}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Fallback content if no risk sections exist */}
                      {!currentMemo?.riskAssessment && !currentMemo?.mitigationStrategies && !currentMemo?.swotAnalysis && (
                        <div className="bg-gradient-to-r from-gray-500/10 to-slate-500/10 rounded-lg p-8 text-center">
                          <h3 className="text-xl font-bold text-white mb-4">Risk Analysis In Progress</h3>
                          <p className="text-gray-300">Risk assessment, mitigation strategies, and SWOT analysis will appear here once the investment memo is generated.</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="legal" className="space-y-8 min-h-[400px]">
                      {/* Legal Assessment */}
                      {currentMemo?.legalAssessment && (
                        <div className="bg-gradient-to-r from-slate-500/10 to-gray-500/10 rounded-lg p-6">
                          <SectionHeader 
                            title="Legal Assessment" 
                            subtitle="Legal structure, IP protection, and compliance evaluation"
                          />
                          <InfoGrid 
                            items={[
                              { label: "Corporate Structure", content: currentMemo.legalAssessment.corporateStructure },
                              { label: "IP Protection", content: currentMemo.legalAssessment.ipProtection },
                              { label: "Regulatory Compliance", content: currentMemo.legalAssessment.regulatoryCompliance },
                              { label: "Contractual Obligations", content: currentMemo.legalAssessment.contractualObligations }
                            ]}
                            columns={2}
                          />
                        </div>
                      )}

                      {/* Regulatory Analysis */}
                      {currentMemo?.regulatoryAnalysis && (
                        <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-lg p-6">
                          <SectionHeader 
                            title="Regulatory Analysis" 
                            subtitle="Regulatory requirements and compliance pathway"
                          />
                          <FormattedContent content={currentMemo.regulatoryAnalysis} variant="default" />
                        </div>
                      )}
                      
                      {/* Fallback content if no legal sections exist */}
                      {!currentMemo?.legalAssessment && !currentMemo?.regulatoryAnalysis && (
                        <div className="bg-gradient-to-r from-gray-500/10 to-slate-500/10 rounded-lg p-8 text-center">
                          <h3 className="text-xl font-bold text-white mb-4">Legal Analysis In Progress</h3>
                          <p className="text-gray-300">Legal assessment and regulatory analysis will appear here once the investment memo is generated.</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="recommendation" className="space-y-8 min-h-[400px]">
                      {/* Investment Recommendation */}
                      {currentMemo?.recommendation && (
                        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-lg p-6">
                          <SectionHeader 
                            title="Investment Recommendation" 
                            subtitle="Final investment decision and strategic rationale"
                          />
                          <div className="space-y-6">
                            <div>
                              <span className="inline-block px-4 py-2 rounded-full text-sm font-medium bg-primary text-white mb-4">
                                {currentMemo.recommendation.investment_recommendation}
                              </span>
                              <FormattedContent content={currentMemo.recommendation.rationale} variant="default" />
                            </div>
                            {(Array.isArray(currentMemo.recommendation.keyMilestones) && currentMemo.recommendation.keyMilestones.length > 0) && (
                              <div>
                                <h4 className="font-semibold text-gray-200 mb-3">Key Milestones</h4>
                                <div className="space-y-2">
                                  {currentMemo.recommendation.keyMilestones.map((milestone: string, index: number) => (
                                    <div key={index} className="flex items-start">
                                      <span className="text-primary mt-1 mr-3 flex-shrink-0">•</span>
                                      <span className="text-gray-300 text-sm">{milestone}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {!Array.isArray(currentMemo.recommendation.keyMilestones) && currentMemo.recommendation.keyMilestones && (
                              <div>
                                <h4 className="font-semibold text-gray-200 mb-3">Key Milestones</h4>
                                <FormattedContent content={currentMemo.recommendation.keyMilestones} variant="small" />
                              </div>
                            )}
                            <div>
                              <h4 className="font-semibold text-gray-200 mb-3">Exit Strategy</h4>
                              <FormattedContent content={currentMemo.recommendation.exitStrategy} variant="small" />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Exit Strategy */}
                      {currentMemo?.exitStrategy && (
                        <div className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 rounded-lg p-6">
                          <SectionHeader 
                            title="Exit Strategy Analysis" 
                            subtitle="Potential exit opportunities and timeline"
                          />
                          <FormattedContent content={currentMemo.exitStrategy} variant="default" />
                        </div>
                      )}

                      {/* Appendices */}
                      {currentMemo?.appendices && (
                        <div className="bg-gradient-to-r from-gray-500/10 to-slate-500/10 rounded-lg p-6">
                          <SectionHeader 
                            title="Appendices" 
                            subtitle="Additional supporting documentation and data"
                          />
                          <FormattedContent content={currentMemo.appendices} variant="default" />
                        </div>
                      )}
                      
                      {/* Fallback content if no recommendation sections exist */}
                      {!currentMemo?.recommendation && !currentMemo?.exitStrategy && !currentMemo?.appendices && (
                        <div className="bg-gradient-to-r from-gray-500/10 to-slate-500/10 rounded-lg p-8 text-center">
                          <h3 className="text-xl font-bold text-white mb-4">Investment Decision In Progress</h3>
                          <p className="text-gray-300">Investment recommendation, exit strategy, and appendices will appear here once the investment memo is generated.</p>
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
                    <div className="space-y-2">
                      <Button 
                        variant="outline" 
                        className="w-full border-dark-lighter text-white hover:bg-dark-lighter"
                        onClick={async () => {
                          try {
                            const response = await fetch(`/api/deals/${selectedDeal}/export-pdf`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                            });
                            
                            if (!response.ok) {
                              throw new Error('Export failed');
                            }
                            
                            // Create blob and download
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `Investment_Memo_${selectedDealData?.companyName || 'Company'}_${new Date().toISOString().split('T')[0]}.pdf`;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);
                            
                            toast({
                              title: "PDF Export Complete",
                              description: "Investment memo has been exported as PDF with BAIBYS structure.",
                            });
                          } catch (error) {
                            toast({
                              title: "Export Failed",
                              description: "Failed to export PDF. Please try again.",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Export PDF
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        className="w-full border-dark-lighter text-white hover:bg-dark-lighter"
                        onClick={async () => {
                          try {
                            const response = await fetch(`/api/deals/${selectedDeal}/export-docx`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                            });
                            
                            if (!response.ok) {
                              throw new Error('Export failed');
                            }
                            
                            // Create blob and download
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `Investment_Memo_${selectedDealData?.companyName || 'Company'}_${new Date().toISOString().split('T')[0]}.docx`;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);
                            
                            toast({
                              title: "Word Export Complete", 
                              description: "Investment memo has been exported as Word document with BAIBYS structure.",
                            });
                          } catch (error) {
                            toast({
                              title: "Export Failed",
                              description: "Failed to export Word document. Please try again.",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export Word
                      </Button>
                    </div>
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
