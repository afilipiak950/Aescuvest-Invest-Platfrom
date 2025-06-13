import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  DollarSign, 
  ExternalLink, 
  TrendingUp, 
  AlertTriangle, 
  Building2, 
  RefreshCw,
  Eye
} from "lucide-react";

interface CompanyResearchProps {
  dealId: number;
}

export function CompanyResearchDisplay({ dealId }: CompanyResearchProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: researchData, isLoading, refetch } = useQuery({
    queryKey: [`/api/deals/${dealId}/research`],
    enabled: !!dealId
  }) as { data: any; isLoading: boolean; refetch: () => void };

  const handleRefreshResearch = async () => {
    setIsRefreshing(true);
    try {
      // Trigger new research
      await fetch(`/api/deals/${dealId}/research`, { method: 'POST' });
      // Refresh data after a delay
      setTimeout(() => {
        refetch();
        setIsRefreshing(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to refresh research:', error);
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-400">Loading company research...</p>
        </div>
      </div>
    );
  }

  if (!researchData) {
    return (
      <Card className="bg-dark border-dark-lighter">
        <CardContent className="py-12 text-center">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Research Data Available</h3>
          <p className="text-gray-400 mb-4">Click below to initiate AI research for this company.</p>
          <Button onClick={handleRefreshResearch} disabled={isRefreshing}>
            {isRefreshing ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            Start AI Research
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold">AI Company Research</h3>
          <p className="text-gray-400">Comprehensive investor intelligence for {researchData?.companyName || 'this company'}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-green-600/10 text-green-400 border-green-600/30">
            {researchData?.researchStatus === 'completed' ? 'Research Complete' : 'Processing'}
          </Badge>
          <Button variant="outline" size="sm" onClick={handleRefreshResearch} disabled={isRefreshing}>
            {isRefreshing ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="executive" className="w-full">
        <TabsList className="border-b border-dark-lighter bg-transparent mb-6 w-full justify-start">
          <TabsTrigger
            value="executive"
            className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
          >
            Executive Team
          </TabsTrigger>
          <TabsTrigger
            value="financial"
            className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
          >
            Financial Intelligence
          </TabsTrigger>
          <TabsTrigger
            value="external"
            className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
          >
            External Sources
          </TabsTrigger>
          <TabsTrigger
            value="business"
            className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
          >
            Business Intelligence
          </TabsTrigger>
          <TabsTrigger
            value="investment"
            className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
          >
            Investment Highlights
          </TabsTrigger>
          <TabsTrigger
            value="risks"
            className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent pb-2 px-1"
          >
            Risk Assessment
          </TabsTrigger>
        </TabsList>

        <TabsContent value="executive">
          <Card className="bg-dark border-dark-lighter">
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5" />
                <CardTitle>CEO & Leadership Team</CardTitle>
              </div>
              <CardDescription>Executive profiles and leadership assessment</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {researchData?.ceoProfile && (
                <div className="bg-dark-light p-4 rounded-lg border border-dark-lighter">
                  <h4 className="font-semibold text-lg mb-3">Chief Executive Officer</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-400">Name</label>
                      <p className="text-white">{researchData?.ceoProfile?.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-400">LinkedIn Profile</label>
                      <p className="text-blue-400">{researchData?.ceoProfile?.linkedinUrl || 'Profile located'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-400">Background</label>
                      <p className="text-gray-300">{researchData?.ceoProfile?.background}</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-400">Experience</label>
                      <p className="text-gray-300">{researchData?.ceoProfile?.experience}</p>
                    </div>
                    {researchData?.ceoProfile?.previousCompanies?.length > 0 && (
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-400">Previous Companies</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {researchData.ceoProfile.previousCompanies.map((company: string, index: number) => (
                            <Badge key={index} variant="outline" className="bg-blue-600/10 text-blue-400 border-blue-600/30">
                              {company}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial">
          <Card className="bg-dark border-dark-lighter">
            <CardHeader>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                <CardTitle>Financial Intelligence</CardTitle>
              </div>
              <CardDescription>Funding history, revenue, and financial metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-dark-light p-4 rounded-lg border border-dark-lighter">
                  <label className="text-sm font-medium text-gray-400">Revenue</label>
                  <p className="text-white font-semibold">{researchData.financialInsights?.revenue}</p>
                </div>
                <div className="bg-dark-light p-4 rounded-lg border border-dark-lighter">
                  <label className="text-sm font-medium text-gray-400">Valuation</label>
                  <p className="text-white font-semibold">{researchData.financialInsights?.valuation}</p>
                </div>
                <div className="bg-dark-light p-4 rounded-lg border border-dark-lighter">
                  <label className="text-sm font-medium text-gray-400">Team Size</label>
                  <p className="text-white font-semibold">{researchData.financialInsights?.employeeCount}</p>
                </div>
              </div>

              {researchData.financialInsights?.fundingHistory?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-lg mb-3">Funding History</h4>
                  <div className="space-y-3">
                    {researchData.financialInsights.fundingHistory.map((round, index) => (
                      <div key={index} className="bg-dark-light p-4 rounded-lg border border-dark-lighter">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-400">Round</label>
                            <p className="text-white">{round.round}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Amount</label>
                            <p className="text-white">{round.amount}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Date</label>
                            <p className="text-white">{round.date}</p>
                          </div>
                          {round.investors?.length > 0 && (
                            <div className="md:col-span-3">
                              <label className="text-sm font-medium text-gray-400">Investors</label>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {round.investors.map((investor, idx) => (
                                  <Badge key={idx} variant="outline" className="bg-green-600/10 text-green-400 border-green-600/30">
                                    {investor}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="external">
          <Card className="bg-dark border-dark-lighter">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                <CardTitle>External Data Sources</CardTitle>
              </div>
              <CardDescription>Links to Pitchbook, Crunchbase, Northdata, and other databases</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {researchData.externalSources?.pitchbookUrl && (
                  <div className="bg-dark-light p-4 rounded-lg border border-dark-lighter">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">Pitchbook Profile</h4>
                        <p className="text-sm text-gray-400">Company profile and data</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                    </div>
                    <p className="text-blue-400 mt-2">{researchData.externalSources.pitchbookUrl}</p>
                  </div>
                )}
                
                {researchData.externalSources?.crunchbaseUrl && (
                  <div className="bg-dark-light p-4 rounded-lg border border-dark-lighter">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">Crunchbase Profile</h4>
                        <p className="text-sm text-gray-400">Startup database profile</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                    </div>
                    <p className="text-blue-400 mt-2">{researchData.externalSources.crunchbaseUrl}</p>
                  </div>
                )}
                
                {researchData.externalSources?.northdataUrl && (
                  <div className="bg-dark-light p-4 rounded-lg border border-dark-lighter">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">Northdata Profile</h4>
                        <p className="text-sm text-gray-400">European company database</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                    </div>
                    <p className="text-blue-400 mt-2">{researchData.externalSources.northdataUrl}</p>
                  </div>
                )}
                
                {researchData.externalSources?.linkedinCompanyUrl && (
                  <div className="bg-dark-light p-4 rounded-lg border border-dark-lighter">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">LinkedIn Company</h4>
                        <p className="text-sm text-gray-400">Company LinkedIn page</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                    </div>
                    <p className="text-blue-400 mt-2">{researchData.externalSources.linkedinCompanyUrl}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="business">
          <Card className="bg-dark border-dark-lighter">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                <CardTitle>Business Intelligence</CardTitle>
              </div>
              <CardDescription>Market position, competitors, and recent developments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold text-lg mb-3">Market Position</h4>
                <p className="text-gray-300">{researchData.businessIntelligence?.marketPosition}</p>
              </div>

              {researchData.businessIntelligence?.competitors?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-lg mb-3">Competitors</h4>
                  <div className="flex flex-wrap gap-2">
                    {researchData.businessIntelligence.competitors.map((competitor, index) => (
                      <Badge key={index} variant="outline" className="bg-orange-600/10 text-orange-400 border-orange-600/30">
                        {competitor}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {researchData.businessIntelligence?.partnerships?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-lg mb-3">Strategic Partnerships</h4>
                  <div className="flex flex-wrap gap-2">
                    {researchData.businessIntelligence.partnerships.map((partner, index) => (
                      <Badge key={index} variant="outline" className="bg-purple-600/10 text-purple-400 border-purple-600/30">
                        {partner}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {researchData.businessIntelligence?.recentNews?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-lg mb-3">Recent News</h4>
                  <div className="space-y-3">
                    {researchData.businessIntelligence.recentNews.map((news, index) => (
                      <div key={index} className="bg-dark-light p-4 rounded-lg border border-dark-lighter">
                        <h5 className="font-medium text-white">{news.title}</h5>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-sm text-gray-400">{news.source}</span>
                          <span className="text-sm text-gray-400">{news.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="investment">
          <Card className="bg-dark border-dark-lighter">
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                <CardTitle>Investment Highlights</CardTitle>
              </div>
              <CardDescription>Key factors supporting the investment case</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold text-lg mb-3">Market Opportunity</h4>
                <p className="text-gray-300">{researchData.investmentHighlights?.marketOpportunity}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {researchData.investmentHighlights?.traction?.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Traction Metrics</h4>
                    <div className="space-y-2">
                      {researchData.investmentHighlights.traction.map((metric, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-gray-300">{metric}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {researchData.investmentHighlights?.teamStrength?.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Team Strengths</h4>
                    <div className="space-y-2">
                      {researchData.investmentHighlights.teamStrength.map((strength, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                          <span className="text-gray-300">{strength}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {researchData.investmentHighlights?.differentiation?.length > 0 && (
                  <div className="md:col-span-2">
                    <h4 className="font-semibold mb-3">Competitive Differentiation</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {researchData.investmentHighlights.differentiation.map((factor, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                          <span className="text-gray-300">{factor}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risks">
          <Card className="bg-dark border-dark-lighter">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <CardTitle>Risk Assessment</CardTitle>
              </div>
              <CardDescription>Identified risks and potential challenges</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {researchData.riskAssessment?.competitiveRisks?.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 text-orange-400">Competitive Risks</h4>
                    <div className="space-y-2">
                      {researchData.riskAssessment.competitiveRisks.map((risk, index) => (
                        <div key={index} className="bg-orange-600/10 p-3 rounded border border-orange-600/30">
                          <span className="text-orange-300 text-sm">{risk}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {researchData.riskAssessment?.marketRisks?.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 text-red-400">Market Risks</h4>
                    <div className="space-y-2">
                      {researchData.riskAssessment.marketRisks.map((risk, index) => (
                        <div key={index} className="bg-red-600/10 p-3 rounded border border-red-600/30">
                          <span className="text-red-300 text-sm">{risk}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {researchData.riskAssessment?.executionRisks?.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 text-yellow-400">Execution Risks</h4>
                    <div className="space-y-2">
                      {researchData.riskAssessment.executionRisks.map((risk, index) => (
                        <div key={index} className="bg-yellow-600/10 p-3 rounded border border-yellow-600/30">
                          <span className="text-yellow-300 text-sm">{risk}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}