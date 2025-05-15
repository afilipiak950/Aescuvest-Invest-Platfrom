import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import InvestorMatching from '@/components/ai/InvestorMatching';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AIInvestorMatchingPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const dealIdNum = dealId ? parseInt(dealId) : undefined;
  
  // Fetch deal information
  const { data: deal, isLoading } = useQuery({
    queryKey: [`/api/deals/${dealId}`],
    enabled: !!dealId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-[250px]" />
        </div>
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">
          AI Investor Matching: {deal?.companyName || 'Unknown Company'}
        </h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Stage:</span>
          <span className="font-medium px-2 py-1 bg-primary/10 rounded-md">{deal?.stage || 'Unknown'}</span>
        </div>
      </div>
      
      <Card className="border rounded-lg shadow-md overflow-hidden">
        <CardHeader className="bg-card">
          <CardTitle>Deal Overview</CardTitle>
          <CardDescription>Key information about this investment opportunity</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Company</h3>
              <p className="font-medium">{deal?.companyName}</p>
              <p className="text-sm text-muted-foreground mt-1">{deal?.description}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Sector</h3>
              <p className="font-medium">{deal?.sector}</p>
              <h3 className="text-sm font-medium text-muted-foreground mb-1 mt-3">Location</h3>
              <p className="font-medium">{deal?.location || 'N/A'}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Funding Target</h3>
              <p className="font-medium">
                {deal?.fundingAmount ? `$${(deal.fundingAmount / 1000000).toFixed(1)}M` : 'N/A'}
              </p>
              <h3 className="text-sm font-medium text-muted-foreground mb-1 mt-3">AI Score</h3>
              <div className="flex items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  deal?.aiScore && deal.aiScore >= 85 ? 'bg-green-100 text-green-800' :
                  deal?.aiScore && deal.aiScore >= 70 ? 'bg-blue-100 text-blue-800' :
                  deal?.aiScore && deal.aiScore >= 50 ? 'bg-amber-100 text-amber-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {deal?.aiScore || 'N/A'}
                </div>
                <span className="text-sm text-muted-foreground">
                  {deal?.aiScore && deal.aiScore >= 85 ? 'Excellent' :
                   deal?.aiScore && deal.aiScore >= 70 ? 'Good' :
                   deal?.aiScore && deal.aiScore >= 50 ? 'Fair' :
                   'Poor'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {dealIdNum && <InvestorMatching dealId={dealIdNum} />}
    </div>
  );
}