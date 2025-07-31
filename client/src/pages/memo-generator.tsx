import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PageHeader from '@/components/layout/page-header';
import MemoSection from '@/components/memo-generator/memo-section';
import MemoControls from '@/components/memo-generator/memo-controls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, Brain, TrendingUp, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { cleanMarkdown, formatBusinessText, formatObjectContent } from '@/utils/textFormatter';
import { FormattedContent, SectionHeader, InfoGrid } from '@/components/FormattedContent';
import { ProfessionalFormattedContent, ProfessionalInfoGrid } from '@/components/ProfessionalFormattedContent';

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
  const selectedDealData = Array.isArray(deals) ? deals.find((d: any) => d.id.toString() === selectedDeal) : null;
  
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
                    {Array.isArray(deals) && deals.map((deal: any) => (
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
                    
                    <TabsContent value="overview" className="space-y-6">
                      {/* Cover Page */}
                      {currentMemo?.coverPage && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
                              <div>
                                <CardTitle className="text-2xl text-white">Investment Memorandum</CardTitle>
                                <p className="text-slate-400 text-sm">Professional investment opportunity presentation</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-invert max-w-none">
                              <ProfessionalFormattedContent 
                                content={currentMemo.coverPage} 
                                variant="large"
                                className="text-slate-200 leading-relaxed"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      
                      {/* Executive Summary */}
                      {currentMemo?.executiveSummary && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center gap-3">
                              <TrendingUp className="h-6 w-6 text-blue-400" />
                              <div>
                                <CardTitle className="text-xl text-white">Executive Summary</CardTitle>
                                <p className="text-slate-400 text-sm">Investment opportunity overview and key value proposition</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-invert max-w-none">
                              <ProfessionalFormattedContent 
                                content={currentMemo.executiveSummary} 
                                variant="large"
                                className="text-slate-200 leading-relaxed"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Investment Highlights */}
                      {Array.isArray(currentMemo?.investmentHighlights) && currentMemo.investmentHighlights.length > 0 && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-8 bg-green-500 rounded-full"></div>
                              <div>
                                <CardTitle className="text-xl text-white">Investment Highlights</CardTitle>
                                <p className="text-slate-400 text-sm">Key value propositions and investment attractiveness factors</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="grid gap-3">
                              {currentMemo.investmentHighlights.map((highlight: string, index: number) => (
                                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                                  <span className="text-slate-200 leading-relaxed">{highlight}</span>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      {!Array.isArray(currentMemo?.investmentHighlights) && currentMemo?.investmentHighlights && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-8 bg-green-500 rounded-full"></div>
                              <div>
                                <CardTitle className="text-xl text-white">Investment Highlights</CardTitle>
                                <p className="text-slate-400 text-sm">Key value propositions and investment attractiveness factors</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-invert max-w-none">
                              <ProfessionalFormattedContent 
                                content={currentMemo.investmentHighlights} 
                                variant="default"
                                className="text-slate-200 leading-relaxed"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>

                    <TabsContent value="analysis" className="space-y-6 min-h-[400px]">
                      {/* Market Analysis */}
                      {currentMemo?.marketAnalysis && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-8 bg-purple-500 rounded-full"></div>
                              <div>
                                <CardTitle className="text-xl text-white">Market Analysis</CardTitle>
                                <p className="text-slate-400 text-sm">Market size, timing, and competitive landscape assessment</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-4">
                                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                  <h4 className="font-semibold text-slate-200 mb-2">Market Context</h4>
                                  <ProfessionalFormattedContent 
                                    content={currentMemo.marketAnalysis.marketContext} 
                                    variant="small"
                                    className="text-slate-300"
                                  />
                                </div>
                                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                  <h4 className="font-semibold text-slate-200 mb-2">Market Timing</h4>
                                  <ProfessionalFormattedContent 
                                    content={currentMemo.marketAnalysis.marketTiming} 
                                    variant="small"
                                    className="text-slate-300"
                                  />
                                </div>
                              </div>
                              <div className="space-y-4">
                                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                  <h4 className="font-semibold text-slate-200 mb-2">Market Size (TAM/SAM/SOM)</h4>
                                  <div className="space-y-2 text-slate-300">
                                    <div><span className="font-medium text-blue-400">TAM:</span> {currentMemo.marketAnalysis.marketSize.tam}</div>
                                    <div><span className="font-medium text-green-400">SAM:</span> {currentMemo.marketAnalysis.marketSize.sam}</div>
                                    <div><span className="font-medium text-yellow-400">SOM:</span> {currentMemo.marketAnalysis.marketSize.som}</div>
                                  </div>
                                </div>
                                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                  <h4 className="font-semibold text-slate-200 mb-2">Competitive Landscape</h4>
                                  <ProfessionalFormattedContent 
                                    content={currentMemo.marketAnalysis.competitiveLandscape} 
                                    variant="small"
                                    className="text-slate-300"
                                  />
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Product Analysis */}
                      {currentMemo?.productAnalysis && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-8 bg-cyan-500 rounded-full"></div>
                              <div>
                                <CardTitle className="text-xl text-white">Product & Technology Analysis</CardTitle>
                                <p className="text-slate-400 text-sm">Product overview and technological differentiation</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-2">Product Overview</h4>
                                <ProfessionalFormattedContent 
                                  content={currentMemo.productAnalysis.productOverview} 
                                  variant="small"
                                  className="text-slate-300"
                                />
                              </div>
                              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-2">Technology Advantage</h4>
                                <ProfessionalFormattedContent 
                                  content={currentMemo.productAnalysis.technologyAdvantage} 
                                  variant="small"
                                  className="text-slate-300"
                                />
                              </div>
                              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-2">Competitive Edge</h4>
                                <ProfessionalFormattedContent 
                                  content={currentMemo.productAnalysis.competitiveEdge} 
                                  variant="small"
                                  className="text-slate-300"
                                />
                              </div>
                              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-2">Development Stage</h4>
                                <ProfessionalFormattedContent 
                                  content={currentMemo.productAnalysis.developmentStage} 
                                  variant="small"
                                  className="text-slate-300"
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Business Model */}
                      {currentMemo?.businessModel && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
                              <div>
                                <CardTitle className="text-xl text-white">Business Model</CardTitle>
                                <p className="text-slate-400 text-sm">Revenue strategy and customer acquisition approach</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-2">Revenue Model</h4>
                                <ProfessionalFormattedContent 
                                  content={currentMemo.businessModel.revenueModel} 
                                  variant="small"
                                  className="text-slate-300"
                                />
                              </div>
                              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-2">Pricing Strategy</h4>
                                <ProfessionalFormattedContent 
                                  content={currentMemo.businessModel.pricingStrategy} 
                                  variant="small"
                                  className="text-slate-300"
                                />
                              </div>
                              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-2">Sales Channels</h4>
                                <ProfessionalFormattedContent 
                                  content={currentMemo.businessModel.salesChannels} 
                                  variant="small"
                                  className="text-slate-300"
                                />
                              </div>
                              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-2">Customer Acquisition</h4>
                                <ProfessionalFormattedContent 
                                  content={currentMemo.businessModel.customerAcquisition} 
                                  variant="small"
                                  className="text-slate-300"
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Team Assessment */}
                      {currentMemo?.teamAssessment && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-8 bg-violet-500 rounded-full"></div>
                              <div>
                                <CardTitle className="text-xl text-white">Management Team Assessment</CardTitle>
                                <p className="text-slate-400 text-sm">Leadership team evaluation and key personnel analysis</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-6">
                              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-3">Management</h4>
                                <ProfessionalFormattedContent 
                                  content={formatObjectContent(currentMemo.teamAssessment.management)} 
                                  variant="small" 
                                  className="text-slate-300"
                                />
                              </div>
                              
                              {Array.isArray(currentMemo.teamAssessment.keyPersonnel) && currentMemo.teamAssessment.keyPersonnel.length > 0 && (
                                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                  <h4 className="font-semibold text-slate-200 mb-3">Key Personnel</h4>
                                  <div className="space-y-3">
                                    {currentMemo.teamAssessment.keyPersonnel.map((person: any, index: number) => (
                                      <div key={index} className="flex items-start gap-3 p-3 rounded-md bg-slate-700/50">
                                        <div className="w-2 h-2 bg-violet-400 rounded-full mt-2 flex-shrink-0"></div>
                                        <span className="text-slate-300">
                                          {typeof person === 'string' ? person : 
                                           typeof person === 'object' && person !== null ? 
                                           `${person.name || ''} - ${person.role || ''} ${person.background ? `(${person.background})` : ''}`.trim() :
                                           String(person)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {!Array.isArray(currentMemo.teamAssessment.keyPersonnel) && currentMemo.teamAssessment.keyPersonnel && (
                                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                  <h4 className="font-semibold text-slate-200 mb-3">Key Personnel</h4>
                                  <ProfessionalFormattedContent 
                                    content={formatObjectContent(currentMemo.teamAssessment.keyPersonnel)} 
                                    variant="small" 
                                    className="text-slate-300"
                                  />
                                </div>
                              )}
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">  
                                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                  <h4 className="font-semibold text-slate-200 mb-3">Advisors</h4>
                                  <ProfessionalFormattedContent 
                                    content={formatObjectContent(currentMemo.teamAssessment.advisors)} 
                                    variant="small" 
                                    className="text-slate-300"
                                  />
                                </div>
                                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                  <h4 className="font-semibold text-slate-200 mb-3">Board Composition</h4>
                                  <ProfessionalFormattedContent 
                                    content={formatObjectContent(currentMemo.teamAssessment.boardComposition)} 
                                    variant="small" 
                                    className="text-slate-300"
                                  />
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Commercial Analysis */}
                      {currentMemo?.commercialAnalysis && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-8 bg-amber-500 rounded-full"></div>
                              <div>
                                <CardTitle className="text-xl text-white">Commercial Analysis</CardTitle>
                                <p className="text-slate-400 text-sm">Commercial viability and market readiness assessment</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-invert max-w-none">
                              <ProfessionalFormattedContent 
                                content={currentMemo.commercialAnalysis} 
                                variant="default" 
                                className="text-slate-200 leading-relaxed"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Clinical Assessment */}
                      {currentMemo?.clinicalAssessment && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-8 bg-red-500 rounded-full"></div>
                              <div>
                                <CardTitle className="text-xl text-white">Clinical Assessment</CardTitle>
                                <p className="text-slate-400 text-sm">Clinical evaluation and regulatory pathway analysis</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-invert max-w-none">
                              <ProfessionalFormattedContent 
                                content={currentMemo.clinicalAssessment} 
                                variant="default" 
                                className="text-slate-200 leading-relaxed"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* IP Analysis */}
                      {currentMemo?.ipAnalysis && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-8 bg-indigo-500 rounded-full"></div>
                              <div>
                                <CardTitle className="text-xl text-white">Intellectual Property Analysis</CardTitle>
                                <p className="text-slate-400 text-sm">Patent portfolio and IP protection strategy</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-invert max-w-none">
                              <ProfessionalFormattedContent 
                                content={currentMemo.ipAnalysis} 
                                variant="default" 
                                className="text-slate-200 leading-relaxed"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Research Insights */}
                      {currentMemo?.researchInsights && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-8 bg-teal-500 rounded-full"></div>
                              <div>
                                <CardTitle className="text-xl text-white">Research Insights</CardTitle>
                                <p className="text-slate-400 text-sm">Market research and competitive intelligence</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-invert max-w-none">
                              <ProfessionalFormattedContent 
                                content={currentMemo.researchInsights} 
                                variant="default"
                                className="text-slate-200 leading-relaxed"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      
                      {/* Fallback content if no analysis sections exist */}
                      {!currentMemo?.marketAnalysis && !currentMemo?.productAnalysis && !currentMemo?.businessModel && !currentMemo?.teamAssessment && !currentMemo?.commercialAnalysis && !currentMemo?.clinicalAssessment && !currentMemo?.ipAnalysis && !currentMemo?.researchInsights && (
                        <Card className="border-slate-600 bg-slate-800/30">
                          <CardContent className="pt-6">
                            <div className="text-center py-12">
                              <div className="w-16 h-16 bg-slate-700 rounded-full mx-auto mb-4 flex items-center justify-center">
                                <TrendingUp className="h-8 w-8 text-slate-400" />
                              </div>
                              <h3 className="text-xl font-semibold text-white mb-2">Analysis In Progress</h3>
                              <p className="text-slate-400 max-w-md mx-auto">Detailed analysis sections will appear here once the investment memo is generated.</p>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>

                    <TabsContent value="financial" className="space-y-6 min-h-[400px]">
                      {/* Financial Analysis */}
                      {currentMemo?.financialAnalysis && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-8 bg-green-500 rounded-full"></div>
                              <div>
                                <CardTitle className="text-xl text-white">Financial Analysis</CardTitle>
                                <p className="text-slate-400 text-sm">Financial performance and projections overview</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-2">Current Financials</h4>
                                <ProfessionalFormattedContent 
                                  content={currentMemo.financialAnalysis.currentFinancials} 
                                  variant="small"
                                  className="text-slate-300"
                                />
                              </div>
                              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-2">Projections</h4>
                                <ProfessionalFormattedContent 
                                  content={currentMemo.financialAnalysis.projections} 
                                  variant="small"
                                  className="text-slate-300"
                                />
                              </div>
                              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-2">Funding History</h4>
                                <ProfessionalFormattedContent 
                                  content={currentMemo.financialAnalysis.fundingHistory} 
                                  variant="small"
                                  className="text-slate-300"
                                />
                              </div>
                              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-2">Use of Funds</h4>
                                <ProfessionalFormattedContent 
                                  content={currentMemo.financialAnalysis.useOfFunds} 
                                  variant="small"
                                  className="text-slate-300"
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Investment Terms */}
                      {currentMemo?.investmentTerms && (
                        <Card className="border-slate-700 bg-slate-900/50">
                          <CardHeader className="pb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
                              <div>
                                <CardTitle className="text-xl text-white">Investment Terms</CardTitle>
                                <p className="text-slate-400 text-sm">Deal structure, valuation, and investment terms</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-2">Valuation</h4>
                                <ProfessionalFormattedContent 
                                  content={formatObjectContent(currentMemo.investmentTerms.valuation)} 
                                  variant="small"
                                  className="text-slate-300"
                                />
                              </div>
                              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-2">Funding Amount</h4>
                                <ProfessionalFormattedContent 
                                  content={currentMemo.investmentTerms.fundingAmount} 
                                  variant="small"
                                  className="text-slate-300"
                                />
                              </div>
                              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-2">Securities</h4>
                                <ProfessionalFormattedContent 
                                  content={formatObjectContent(currentMemo.investmentTerms.securities)} 
                                  variant="small"
                                  className="text-slate-300"
                                />
                              </div>
                              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-2">Board Rights</h4>
                                <ProfessionalFormattedContent 
                                  content={formatObjectContent(currentMemo.investmentTerms.boardRights)} 
                                  variant="small"
                                  className="text-slate-300"
                                />
                              </div>
                              <div className="md:col-span-2 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                                <h4 className="font-semibold text-slate-200 mb-2">Liquidation Preference</h4>
                                <ProfessionalFormattedContent 
                                  content={currentMemo.investmentTerms.liquidationPreference} 
                                  variant="small"
                                  className="text-slate-300"
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      
                      {/* Fallback content if no financial sections exist */}
                      {!currentMemo?.financialAnalysis && !currentMemo?.investmentTerms && (
                        <Card className="border-slate-600 bg-slate-800/30">
                          <CardContent className="pt-6">
                            <div className="text-center py-12">
                              <div className="w-16 h-16 bg-slate-700 rounded-full mx-auto mb-4 flex items-center justify-center">
                                <TrendingUp className="h-8 w-8 text-slate-400" />
                              </div>
                              <h3 className="text-xl font-semibold text-white mb-2">Financial Analysis In Progress</h3>
                              <p className="text-slate-400 max-w-md mx-auto">Financial analysis and investment terms will appear here once the investment memo is generated.</p>
                            </div>
                          </CardContent>
                        </Card>
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
