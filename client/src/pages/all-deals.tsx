import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Search, Eye, Filter, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Deal } from '@shared/schema';
import { AIScoreBadge } from '@/components/ai/AIEvaluationDisplay';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const getScoreColor = (score: string | number | null) => {
  const numScore = typeof score === 'string' ? parseInt(score) : (score || 0);
  if (numScore >= 80) return 'bg-green-500/20 text-green-400 border-green-500/30';
  if (numScore >= 60) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  return 'bg-red-500/20 text-red-400 border-red-500/30';
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Screening':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'Due Diligence':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'Investment Committee':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'Closed':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'Rejected':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

const getRandomColor = () => {
  const colors = [
    'bg-green-500 text-white',
    'bg-red-500 text-white',
    'bg-blue-500 text-white',
    'bg-purple-500 text-white',
    'bg-orange-500 text-white',
    'bg-pink-500 text-white',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

export default function AllDealsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Delete deal mutation with optimistic updates
  const deleteDealMutation = useMutation({
    mutationFn: async (dealId: number) => {
      // Only prevent deletion of demo deals when actually using demo data
      // and the deal ID matches demo deal IDs
      if (dealId <= 8 && apiDeals.length === 0 && demoDeals.some(demo => demo.id === dealId)) {
        throw new Error('Cannot delete demo deals. Please refresh the page to load real deals from the database.');
      }
      
      console.log(`🗑️ Frontend: Attempting to delete deal ${dealId}`);
      console.log(`🔍 Frontend: Making DELETE request to /api/deals/${dealId}`);
      
      // First test if we can connect to the API at all
      try {
        console.log(`🧪 Frontend: Testing API connectivity first...`);
        const testResult = await apiRequest('/api/deals', { method: 'GET' });
        console.log(`🧪 Frontend: API connectivity test successful:`, testResult);
      } catch (connectError) {
        console.error(`🧪 Frontend: API connectivity test failed:`, connectError);
        const errorMessage = connectError instanceof Error ? connectError.message : String(connectError);
        throw new Error(`Cannot connect to API: ${errorMessage}`);
      }
      
      try {
        const result = await apiRequest(`/api/deals/${dealId}`, {
          method: 'DELETE',
        });
        console.log(`✅ Frontend: Delete success for deal ${dealId}:`, result);
        return result;
      } catch (error) {
        console.error(`❌ Frontend: Delete failed for deal ${dealId}:`, error);
        throw error;
      }
    },
    onMutate: async (dealId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/deals'] });
      
      // Snapshot the previous value
      const previousDeals = queryClient.getQueryData<Deal[]>(['/api/deals']);
      
      // Optimistically remove the deal from cache
      queryClient.setQueryData<Deal[]>(['/api/deals'], (old) => 
        old ? old.filter(deal => deal.id !== dealId) : []
      );
      
      // Return a context object with the snapshotted value
      return { previousDeals };
    },
    onError: (error: any, dealId, context) => {
      console.error(`❌ DELETION ERROR for deal ${dealId}:`, error);
      console.error(`❌ Error type:`, typeof error);
      console.error(`❌ Error constructor:`, error.constructor.name);
      console.error(`❌ Error message:`, error.message);
      console.error(`❌ Error stack:`, error.stack);
      console.error(`❌ Full error object:`, JSON.stringify(error, null, 2));
      
      // Rollback on error
      if (context?.previousDeals) {
        queryClient.setQueryData(['/api/deals'], context.previousDeals);
      }
      
      // Show appropriate error message
      let errorMessage = `Failed to delete deal. Error: ${error.message || 'Unknown error'}`;
      if (error.message?.includes('Cannot delete demo deals')) {
        errorMessage = error.message;
      } else if (error.message?.includes('Deal not found')) {
        errorMessage = "Deal not found. It may have been already deleted.";
      } else if (error.message?.includes('API error')) {
        errorMessage = "Unable to connect to server. Please check your connection.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
    onSuccess: (data, dealId) => {
      toast({
        title: "Deal deleted",
        description: "The deal has been successfully deleted.",
      });
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
    },
  });

  // Demo deals until API connection is fixed
  const demoDeals: Deal[] = [
    {
      id: 1,
      companyName: 'TechFlow AI',
      description: 'AI-powered workflow automation platform for enterprises. Reduces manual tasks by 80% through intelligent process optimization.',
      sector: 'Artificial Intelligence',
      stage: 'Series A',
      location: 'San Francisco, CA',
      website: 'https://techflow.ai',
      fundingAmount: 15000000,
      aiScore: '92',
      status: 'under_review',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 2,
      companyName: 'GreenEnergy Solutions',
      description: 'Revolutionary solar panel technology with 40% higher efficiency. Targeting residential and commercial markets across Europe.',
      sector: 'Clean Energy',
      stage: 'Seed',
      location: 'Berlin, Germany',
      website: 'https://greenenergy.com',
      fundingAmount: 5000000,
      aiScore: '88',
      status: 'approved',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 3,
      companyName: 'HealthTrack Pro',
      description: 'Digital health platform connecting patients with specialists. AI-driven diagnostics and personalized treatment plans.',
      sector: 'Healthcare Technology',
      stage: 'Series B',
      location: 'Boston, MA',
      website: 'https://healthtrack.pro',
      fundingAmount: 25000000,
      aiScore: '95',
      status: 'due_diligence',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 4,
      companyName: 'FinanceFlow',
      description: 'Modern banking platform for SMEs with integrated accounting and cash flow management. Serving 10,000+ businesses.',
      sector: 'FinTech',
      stage: 'Pre-Seed',
      location: 'London, UK',
      website: 'https://financeflow.io',
      fundingAmount: 2000000,
      aiScore: '72',
      status: 'rejected',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 5,
      companyName: 'SpaceLogistics',
      description: 'Satellite-based logistics tracking for global supply chains. Real-time monitoring and predictive analytics for cargo.',
      sector: 'Aerospace',
      stage: 'Series A',
      location: 'Austin, TX',
      website: 'https://spacelogistics.com',
      fundingAmount: 18000000,
      aiScore: '89',
      status: 'under_review',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 6,
      companyName: 'FoodTech Innovations',
      description: 'Plant-based protein manufacturing using precision fermentation. Targeting B2B food manufacturers and restaurants.',
      sector: 'Food Technology',
      stage: 'Seed',
      location: 'Amsterdam, Netherlands',
      website: 'https://foodtech.innovation',
      fundingAmount: 8000000,
      aiScore: '86',
      status: 'approved',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 7,
      companyName: 'CyberShield Security',
      description: 'AI-powered threat detection and response platform. Zero-day attack prevention for enterprise networks.',
      sector: 'Cybersecurity',
      stage: 'Series A',
      location: 'Tel Aviv, Israel',
      website: 'https://cybershield.security',
      fundingAmount: 12000000,
      aiScore: '91',
      status: 'due_diligence',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 8,
      companyName: 'EduTech Future',
      description: 'Personalized learning platform using AI tutors. Adapts to individual learning styles and tracks progress in real-time.',
      sector: 'Education Technology',
      stage: 'Seed',
      location: 'Barcelona, Spain',
      website: 'https://edutech.future',
      fundingAmount: 6000000,
      aiScore: '84',
      status: 'under_review',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const { data: apiDeals = [], isLoading } = useQuery<Deal[]>({
    queryKey: ['/api/deals'],
  });

  // Use demo data if API returns empty or if there's an issue
  // Show a warning when using demo data
  const deals = apiDeals.length > 0 ? apiDeals : demoDeals;
  const isUsingDemoData = apiDeals.length === 0;

  const filteredDeals = deals.filter(deal => {
    const matchesSearch = deal.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         deal.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSector = sectorFilter === 'all' || deal.sector === sectorFilter;
    const matchesStatus = statusFilter === 'all' || deal.status === statusFilter;
    
    return matchesSearch && matchesSector && matchesStatus;
  });

  const uniqueSectors = Array.from(new Set(deals.map(deal => deal.sector)));
  const uniqueStatuses = Array.from(new Set(deals.map(deal => deal.status)));

  return (
    <div className="min-h-screen bg-dark">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Recent Deals</h1>
            {isUsingDemoData && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4">
                <p className="text-yellow-400 text-sm">
                  ⚠️ Showing demo data. <button 
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/deals'] })}
                    className="underline hover:text-yellow-300"
                  >
                    Click here to refresh and load real deals
                  </button>
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search deals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-dark-lighter text-white border-dark-lighter focus:ring-primary/50 focus:border-primary w-64"
              />
            </div>
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="w-48 bg-dark-lighter border-dark-lighter text-white">
                <SelectValue placeholder="All Deals" />
              </SelectTrigger>
              <SelectContent className="bg-dark-lighter border-dark-lighter">
                <SelectItem value="all">All Deals</SelectItem>
                {uniqueSectors.map(sector => (
                  <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link href="/deal-intake">
              <Button variant="outline" className="bg-primary hover:bg-primary/80 border-primary text-white">
                Create Deal
              </Button>
            </Link>
          </div>
        </div>

        {/* Deals Table */}
        <Card className="bg-dark-light border-dark-lighter">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 p-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-[300px]" />
                      <Skeleton className="h-4 w-[200px]" />
                    </div>
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                ))}
              </div>
            ) : filteredDeals.length === 0 ? (
              <div className="text-center py-12 px-6">
                <h3 className="text-lg font-medium text-white mb-2">No deals found</h3>
                <p className="text-gray-400">
                  {searchTerm || sectorFilter !== 'all' || statusFilter !== 'all' 
                    ? 'No deals match your current filter criteria.'
                    : 'No deals available yet.'
                  }
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-dark/50">
                    <tr className="border-b border-dark-lighter">
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Company</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Sector</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Stage</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">AI Score</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Status</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-lighter">
                    {filteredDeals.map((deal) => {
                      const firstLetter = deal.companyName.charAt(0);
                      const bgColor = getRandomColor();
                      
                      return (
                        <tr key={deal.id} className="hover:bg-dark-lighter/30 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className={cn("flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm", bgColor)}>
                                {firstLetter}
                              </div>
                              <div className="ml-4">
                                <div className="font-medium text-white">{deal.companyName}</div>
                                <div className="text-gray-400 text-sm truncate max-w-[200px]">
                                  {deal.description}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-gray-300">{deal.sector}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-gray-300">{deal.stage}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge className={cn("border", getScoreColor(deal.aiScore))}>
                              {deal.aiScore || '0'}/100
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge className={cn("border", getStatusColor(deal.status))}>
                              {deal.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Link href={`/due-diligence?deal=${deal.id}`}>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-green-400 hover:text-green-300 hover:bg-green-400/10"
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  View
                                </Button>
                              </Link>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-dark-light border-dark-lighter">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-white">
                                      Delete Deal
                                    </AlertDialogTitle>
                                    <AlertDialogDescription className="text-gray-400">
                                      Are you sure you want to delete "{deal.companyName}"? This action cannot be undone and will permanently remove all deal data, documents, and analyses.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-dark border-dark-lighter text-white hover:bg-dark-lighter">
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => deleteDealMutation.mutate(deal.id)}
                                      disabled={deleteDealMutation.isPending}
                                      className="bg-red-600 hover:bg-red-700 text-white"
                                    >
                                      {deleteDealMutation.isPending ? 'Deleting...' : 'Delete Deal'}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}