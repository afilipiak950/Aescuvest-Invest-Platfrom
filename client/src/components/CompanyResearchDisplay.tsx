import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Globe, DollarSign, Users, Cpu, FileText, Shield, Building, TrendingUp, Eye } from 'lucide-react';
import { useState } from 'react';

interface CompanyResearchProps {
  dealId: number;
}

interface ResearchData {
  companyName: string;
  website: string;
  websiteAnalysis?: string;
  newsAndPress?: string;
  fundingInformation?: string;
  leadershipTeam?: string;
  industryClassification?: string;
  technologyStack?: string;
  regulatoryCompliance?: string;
  lastUpdated: string;
  sources: number;
}

export default function CompanyResearchDisplay({ dealId }: CompanyResearchProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: researchData, isLoading, error, refetch } = useQuery<ResearchData>({
    queryKey: [`/api/deals/${dealId}/research`],
    enabled: !!dealId,
    retry: false,
  });

  console.log('🔍 CompanyResearch Debug:', {
    dealId,
    isLoading,
    hasData: !!researchData,
    error: error?.message,
    queryKey: `/api/deals/${dealId}/research`,
    researchDataKeys: researchData ? Object.keys(researchData) : null
  });

  const handleRefreshResearch = async () => {
    console.log('🔍 Starting research refresh for deal:', dealId);
    setIsRefreshing(true);
    try {
      console.log('🔍 Making POST request to:', `/api/deals/${dealId}/research`);
      const response = await fetch(`/api/deals/${dealId}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      
      console.log('🔍 Research POST response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 Research POST failed:', errorText);
        throw new Error(`Research request failed: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      console.log('🔍 Research POST result:', result);
      
      console.log('🔍 Refetching research data...');
      await refetch();
      console.log('🔍 Research refetch completed');
    } catch (error) {
      console.error('🔍 Research refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-dark-lighter rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-dark-lighter rounded w-full"></div>
            <div className="h-4 bg-dark-lighter rounded w-5/6"></div>
            <div className="h-4 bg-dark-lighter rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !researchData) {
    return (
      <Card className="bg-dark border-dark-lighter">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Eye className="h-8 w-8 text-amber-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Research Data Available</h3>
          <p className="text-gray-400 mb-6">
            Start comprehensive company research to gather intelligence from multiple sources including website analysis, 
            funding data, leadership information, and regulatory compliance.
          </p>
          <Button 
            onClick={handleRefreshResearch}
            disabled={isRefreshing}
            className="bg-primary hover:bg-primary/80"
          >
            {isRefreshing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Gathering Intelligence...
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Start Company Research
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const researchSections = [
    {
      id: 'overview',
      title: 'Company Overview',
      icon: Building,
      content: researchData.websiteAnalysis || 'No website analysis available',
      badge: 'Website Analysis'
    },
    {
      id: 'news',
      title: 'News & Press',
      icon: FileText,
      content: researchData.newsAndPress || 'No recent news found',
      badge: 'Media Coverage'
    },
    {
      id: 'funding',
      title: 'Funding & Investment',
      icon: DollarSign,
      content: researchData.fundingInformation || 'No funding information available',
      badge: 'Financial Data'
    },
    {
      id: 'leadership',
      title: 'Leadership & Team',
      icon: Users,
      content: researchData.leadershipTeam || 'No leadership information available',
      badge: 'Team Analysis'
    },
    {
      id: 'industry',
      title: 'Industry Classification',
      icon: TrendingUp,
      content: researchData.industryClassification || 'No industry analysis available',
      badge: 'Market Analysis'
    },
    {
      id: 'technology',
      title: 'Technology & Products',
      icon: Cpu,
      content: researchData.technologyStack || 'No technology analysis available',
      badge: 'Tech Stack'
    },
    {
      id: 'regulatory',
      title: 'Regulatory & Compliance',
      icon: Shield,
      content: researchData.regulatoryCompliance || 'No regulatory information available',
      badge: 'Compliance'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Research Header */}
      <Card className="bg-dark border-dark-lighter">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl text-white flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Company Research: {researchData.companyName}
              </CardTitle>
              <CardDescription className="mt-2">
                Comprehensive intelligence gathered from {researchData.sources} sources
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm text-gray-400">Last Updated</div>
                <div className="text-sm text-white">
                  {new Date(researchData.lastUpdated).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleRefreshResearch}
                disabled={isRefreshing}
                className="bg-dark-lighter hover:bg-dark border-dark-lighter"
              >
                {isRefreshing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Globe className="h-4 w-4" />
            <span>{researchData.website}</span>
          </div>
        </CardContent>
      </Card>

      {/* Research Content Tabs */}
      <Card className="bg-dark border-dark-lighter">
        <CardContent className="p-0">
          <Tabs defaultValue="overview" className="w-full">
            <div className="border-b border-dark-lighter px-6 py-4">
              <TabsList className="bg-dark-lighter border border-dark-lighter h-auto p-1">
                {researchSections.map((section) => {
                  const IconComponent = section.icon;
                  return (
                    <TabsTrigger
                      key={section.id}
                      value={section.id}
                      className="data-[state=active]:bg-primary data-[state=active]:text-white px-4 py-2 text-sm font-medium"
                    >
                      <IconComponent className="h-4 w-4 mr-2" />
                      {section.title}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {researchSections.map((section) => (
              <TabsContent key={section.id} value={section.id} className="p-6 pt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">{section.title}</h3>
                    <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
                      {section.badge}
                    </Badge>
                  </div>
                  
                  <Separator className="border-dark-lighter" />
                  
                  <ScrollArea className="h-[400px] w-full">
                    <div className="prose prose-invert max-w-none">
                      <div className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {section.content}
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Research Summary */}
      <Card className="bg-dark border-dark-lighter">
        <CardHeader>
          <CardTitle className="text-lg text-white">Research Summary</CardTitle>
          <CardDescription>Key insights from comprehensive company analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-dark-lighter rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Building className="h-4 w-4 text-blue-400" />
                </div>
                <div className="text-sm font-medium text-white">Company Profile</div>
              </div>
              <div className="text-xs text-gray-400">
                {researchData.websiteAnalysis ? 'Complete' : 'Incomplete'} website analysis with 
                {researchData.industryClassification ? ' industry classification' : ' missing classification'}
              </div>
            </div>

            <div className="bg-dark-lighter rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-green-400" />
                </div>
                <div className="text-sm font-medium text-white">Financial Intelligence</div>
              </div>
              <div className="text-xs text-gray-400">
                {researchData.fundingInformation ? 'Funding data available' : 'No funding data'} with 
                {researchData.leadershipTeam ? ' leadership analysis' : ' missing team info'}
              </div>
            </div>

            <div className="bg-dark-lighter rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Shield className="h-4 w-4 text-purple-400" />
                </div>
                <div className="text-sm font-medium text-white">Risk Assessment</div>
              </div>
              <div className="text-xs text-gray-400">
                {researchData.regulatoryCompliance ? 'Regulatory analysis' : 'No regulatory data'} and 
                {researchData.technologyStack ? ' technology review' : ' missing tech analysis'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}