import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CheckCircle, Send, Users, BarChart } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getInitials, getScoreColor } from '@/lib/utils';

interface InvestorMatchingProps {
  dealId: number;
}

export default function InvestorMatching({ dealId }: InvestorMatchingProps) {
  const queryClient = useQueryClient();
  const [minMatchScore, setMinMatchScore] = useState<number>(70);
  const [selectedInvestor, setSelectedInvestor] = useState<number | null>(null);
  const [communicationType, setCommunicationType] = useState<'initial-outreach' | 'follow-up' | 'meeting-request'>('initial-outreach');

  // Fetch deal information
  const { data: deal } = useQuery({
    queryKey: ['/api/deals', dealId],
    retry: false
  });

  // Fetch existing investor matches
  const { data: matches, isLoading: matchesLoading } = useQuery({
    queryKey: ['/api/investors', dealId],
    retry: false
  });

  // Mutation for finding new investor matches
  const findMatches = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/ai/advisory/match-investors`, {
        method: 'POST',
        body: JSON.stringify({ dealId, minMatchScore }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/investors', dealId] });
      toast({
        title: 'Investor matching complete',
        description: 'New potential investors have been identified based on AI analysis.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Matching failed',
        description: error.message || 'Failed to find investor matches',
        variant: 'destructive',
      });
    }
  });

  // Mutation for generating an investment teaser
  const generateTeaser = useMutation({
    mutationFn: async (includeConfidential: boolean = false) => {
      return apiRequest(`/api/ai/advisory/generate-teaser`, {
        method: 'POST',
        body: JSON.stringify({ dealId, includeConfidential }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Teaser generated',
        description: 'Investment teaser has been created successfully.',
      });
      // In a real application, you might open a modal to show the teaser or save it
    },
    onError: (error) => {
      toast({
        title: 'Teaser generation failed',
        description: error.message || 'Failed to generate investment teaser',
        variant: 'destructive',
      });
    }
  });

  // Mutation for generating investor communication
  const generateCommunication = useMutation({
    mutationFn: async ({ investorId, communicationType }: { investorId: number, communicationType: string }) => {
      return apiRequest(`/api/ai/advisory/generate-communication`, {
        method: 'POST',
        body: JSON.stringify({ dealId, investorId, communicationType }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Communication generated',
        description: 'Email template has been created successfully.',
      });
      // In a real application, you might open a modal to show the email or send it
    },
    onError: (error) => {
      toast({
        title: 'Communication generation failed',
        description: error.message || 'Failed to generate investor communication',
        variant: 'destructive',
      });
    }
  });

  const handleFindMatches = () => {
    findMatches.mutate();
  };

  const handleGenerateTeaser = (includeConfidential: boolean) => {
    generateTeaser.mutate(includeConfidential);
  };

  const handleGenerateCommunication = () => {
    if (!selectedInvestor) {
      toast({
        title: 'No investor selected',
        description: 'Please select an investor first',
        variant: 'destructive',
      });
      return;
    }

    generateCommunication.mutate({ 
      investorId: selectedInvestor, 
      communicationType 
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-6">
        {/* Match settings */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Investor Matching</CardTitle>
            <CardDescription>Find the perfect investors for {deal?.companyName || 'this deal'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Minimum Match Score</span>
                <span className="text-sm">{minMatchScore}%</span>
              </div>
              <Slider
                value={[minMatchScore]}
                min={50}
                max={95}
                step={5}
                onValueChange={(value) => setMinMatchScore(value[0])}
                className="py-4"
              />
              <p className="text-xs text-muted-foreground">Higher thresholds yield fewer but higher-quality matches</p>
            </div>

            <Button 
              onClick={handleFindMatches} 
              className="w-full"
              disabled={findMatches.isPending}
            >
              {findMatches.isPending ? 'Finding Matches...' : 'Find Investor Matches'}
            </Button>

            <Separator className="my-4" />

            <div className="space-y-3">
              <h3 className="text-sm font-medium">Investment Teaser</h3>
              <p className="text-xs text-muted-foreground">
                Generate a compelling investment teaser to share with potential investors
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleGenerateTeaser(false)}
                  disabled={generateTeaser.isPending}
                >
                  Public Teaser
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleGenerateTeaser(true)}
                  disabled={generateTeaser.isPending}
                >
                  NDA-Required
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Matched investors */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span>Matched Investors</span>
              {matches?.length > 0 && (
                <Badge variant="secondary" className="ml-2">{matches.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>AI-identified investors based on deal characteristics</CardDescription>
          </CardHeader>
          <CardContent>
            {matchesLoading ? (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">Loading investor matches...</p>
              </div>
            ) : matches?.length ? (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                {matches.map((match: any) => (
                  <div 
                    key={match.id} 
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedInvestor === match.investorId ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'
                    }`}
                    onClick={() => setSelectedInvestor(match.investorId)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary-foreground">
                            {match.investor ? getInitials(match.investor.name) : 'IN'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-medium">{match.investor?.name || 'Investor'}</h4>
                          <p className="text-sm text-muted-foreground">
                            {match.investor?.location || 'Unknown location'} • {match.investor?.checkSize || 'Unknown check size'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge 
                          variant="outline" 
                          className={`${getScoreColor(match.matchScore)}`}
                        >
                          {match.matchScore}% Match
                        </Badge>
                      </div>
                    </div>
                    
                    {match.matchInsights && match.matchInsights.length > 0 && (
                      <div className="mt-3 pl-13">
                        <h5 className="text-xs font-medium mb-1 flex items-center gap-1">
                          <BarChart className="h-3.5 w-3.5" />
                          <span>Match Insights</span>
                        </h5>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {match.matchInsights.slice(0, 3).map((insight: string, i: number) => (
                            <li key={i} className="flex items-start gap-1">
                              <CheckCircle className="h-3.5 w-3.5 mt-0.5 text-primary/70" />
                              <span>{insight}</span>
                            </li>
                          ))}
                          {match.matchInsights.length > 3 && (
                            <li className="text-xs text-muted-foreground italic">
                              +{match.matchInsights.length - 3} more insights...
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center border border-dashed rounded-lg">
                <p className="text-muted-foreground">No investor matches yet</p>
                <p className="text-sm text-muted-foreground mt-1">Use the investor matching engine to find suitable investors</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Communication generator */}
      {selectedInvestor && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              <span>Communication Generator</span>
            </CardTitle>
            <CardDescription>Generate tailored investor communications</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs 
              defaultValue="initial-outreach" 
              className="w-full"
              onValueChange={(value) => setCommunicationType(value as any)}
            >
              <TabsList className="mb-4 grid w-full grid-cols-3">
                <TabsTrigger value="initial-outreach">Initial Outreach</TabsTrigger>
                <TabsTrigger value="follow-up">Follow-up</TabsTrigger>
                <TabsTrigger value="meeting-request">Meeting Request</TabsTrigger>
              </TabsList>
              
              <TabsContent value="initial-outreach">
                <p className="text-sm mb-4">
                  Generate a personalized first contact email introducing the investment opportunity.
                </p>
              </TabsContent>
              
              <TabsContent value="follow-up">
                <p className="text-sm mb-4">
                  Create a follow-up message for investors who haven't responded to the initial outreach.
                </p>
              </TabsContent>
              
              <TabsContent value="meeting-request">
                <p className="text-sm mb-4">
                  Draft an email to schedule a meeting with interested investors.
                </p>
              </TabsContent>
              
              <Button 
                onClick={handleGenerateCommunication}
                disabled={generateCommunication.isPending}
                className="w-full mt-2"
              >
                {generateCommunication.isPending ? 'Generating...' : 'Generate Communication'}
              </Button>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}