import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Search, 
  Filter, 
  RefreshCw, 
  Download, 
  TrendingUp, 
  Users, 
  DollarSign, 
  MapPin,
  Target,
  Mail,
  Calendar,
  BarChart3,
  Zap,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

import FilterSidebar from '@/components/investor-matching/filter-sidebar';
import InvestorCard from '@/components/investor-matching/investor-card';

export default function InvestorMatching() {
  const [selectedDeal, setSelectedDeal] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('match_score');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [isGeneratingMatches, setIsGeneratingMatches] = useState(false);
  const [selectedInvestors, setSelectedInvestors] = useState<Set<number>>(new Set());

  // Fetch deals for dropdown
  const { data: deals = [], isLoading: dealsLoading } = useQuery({
    queryKey: ['/api/deals'],
    select: (data) => data || []
  });

  // Fetch investor matches for selected deal
  const { data: matchesData, isLoading: matchesLoading, refetch: refetchMatches } = useQuery({
    queryKey: ['/api/investor-matching/matches', selectedDeal],
    enabled: !!selectedDeal,
    select: (data) => data || { matches: [], analytics: {} }
  });

  const matches = matchesData?.matches || [];
  const analytics = matchesData?.analytics || {};

  // Set first deal as default when deals load
  useEffect(() => {
    if (deals.length > 0 && !selectedDeal) {
      setSelectedDeal(deals[0].id.toString());
    }
  }, [deals, selectedDeal]);

  const handleGenerateMatches = async () => {
    if (!selectedDeal) return;
    
    setIsGeneratingMatches(true);
    try {
      console.log(`🧠 Generating intelligent matches for deal ${selectedDeal}...`);
      
      const response = await fetch('/api/investor-matching/generate-matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: parseInt(selectedDeal) })
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate intelligent matches');
      }
      
      const data = await response.json();
      console.log(`✅ Generated ${data.totalMatches} intelligent matches:`, data);
      
      // Refresh matches to show new intelligent matches
      refetchMatches();
    } catch (error) {
      console.error('❌ Error generating intelligent matches:', error);
    } finally {
      setIsGeneratingMatches(false);
    }
  };

  const filteredAndSortedMatches = matches
    .filter(match => {
      if (!searchTerm) return true;
      return match.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
             match.firmName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
             match.focus.some(f => f.toLowerCase().includes(searchTerm.toLowerCase()));
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'match_score':
          return b.matchScore - a.matchScore;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'location':
          return a.location.localeCompare(b.location);
        case 'check_size':
          return (b.checkSizeMax || 0) - (a.checkSizeMax || 0);
        default:
          return 0;
      }
    });

  const itemsPerPage = 12;
  const totalPages = Math.ceil(filteredAndSortedMatches.length / itemsPerPage);
  const paginatedMatches = filteredAndSortedMatches.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleInvestorSelect = (investorId: number) => {
    setSelectedInvestors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(investorId)) {
        newSet.delete(investorId);
      } else {
        newSet.add(investorId);
      }
      return newSet;
    });
  };

  const handleBulkEmail = async () => {
    if (selectedInvestors.size === 0) return;
    
    try {
      const response = await fetch('/api/investor-matching/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId: selectedDeal,
          investorIds: Array.from(selectedInvestors),
          type: 'email'
        })
      });
      
      if (response.ok) {
        setSelectedInvestors(new Set());
        // Show success message
      }
    } catch (error) {
      console.error('Failed to send bulk email:', error);
    }
  };

  if (dealsLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading deals...</p>
          </div>
        </div>
      </div>
    );
  }

  if (deals.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No deals found. Please create a deal first to use the investor matching feature.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Investor Matching</h1>
            <p className="text-gray-400">Find the perfect investors for your deals using AI-powered matching</p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={handleGenerateMatches}
              disabled={!selectedDeal || isGeneratingMatches}
              className="bg-primary hover:bg-primary-hover text-dark font-medium"
            >
              {isGeneratingMatches ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Generate Matches
                </>
              )}
            </Button>
            
            {selectedInvestors.size > 0 && (
              <Button
                onClick={handleBulkEmail}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-dark-lighter"
              >
                <Mail className="h-4 w-4 mr-2" />
                Email Selected ({selectedInvestors.size})
              </Button>
            )}
          </div>
        </div>

        {/* Analytics Cards */}
        {analytics && Object.keys(analytics).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-dark-light border-dark-lighter">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Total Matches</p>
                    <p className="text-2xl font-bold text-white">{analytics.totalMatches || 0}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-dark-light border-dark-lighter">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Avg Match Score</p>
                    <p className="text-2xl font-bold text-white">{analytics.averageMatchScore || 0}%</p>
                  </div>
                  <Target className="h-8 w-8 text-green-400" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-dark-light border-dark-lighter">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">High-Quality Matches</p>
                    <p className="text-2xl font-bold text-white">{analytics.highQualityMatches || 0}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-yellow-400" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-dark-light border-dark-lighter">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Contacted</p>
                    <p className="text-2xl font-bold text-white">{analytics.contactedCount || 0}</p>
                  </div>
                  <Mail className="h-8 w-8 text-purple-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filter Sidebar */}
        <div className="lg:col-span-1">
          <FilterSidebar
            deals={deals}
            selectedDeal={selectedDeal}
            onDealChange={setSelectedDeal}
            isLoading={dealsLoading}
          />
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Search and Controls */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search investors by name, firm, or focus area..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-dark-lighter border-dark-lighter text-white"
              />
            </div>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48 bg-dark-lighter border-dark-lighter text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-dark-lighter border-dark-lighter">
                <SelectItem value="match_score">Match Score</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="location">Location</SelectItem>
                <SelectItem value="check_size">Check Size</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="p-2"
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="p-2"
              >
                <Users className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          {matchesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="bg-dark-light border-dark-lighter">
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4 bg-dark-lighter" />
                    <Skeleton className="h-4 w-1/2 bg-dark-lighter" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-full bg-dark-lighter" />
                      <Skeleton className="h-4 w-2/3 bg-dark-lighter" />
                      <Skeleton className="h-8 w-full bg-dark-lighter" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : paginatedMatches.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No matches found</h3>
              <p className="text-gray-400 mb-4">
                {selectedDeal ? 'Try adjusting your filters or generate new matches' : 'Select a deal to start matching'}
              </p>
              {selectedDeal && (
                <Button
                  onClick={handleGenerateMatches}
                  disabled={isGeneratingMatches}
                  className="bg-primary hover:bg-primary-hover text-dark font-medium"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Generate Matches
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Results Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <p className="text-sm text-gray-400">
                    Showing {paginatedMatches.length} of {filteredAndSortedMatches.length} investors
                  </p>
                  {filteredAndSortedMatches.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      Avg Score: {Math.round(filteredAndSortedMatches.reduce((acc, m) => acc + m.matchScore, 0) / filteredAndSortedMatches.length)}%
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-600 text-gray-300 hover:bg-dark-lighter"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>

              {/* Investor Grid */}
              <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
                {paginatedMatches.map((investor) => (
                  <div key={investor.id} className="relative">
                    <InvestorCard investor={investor} />
                    <div className="absolute top-2 right-2">
                      <input
                        type="checkbox"
                        checked={selectedInvestors.has(investor.id)}
                        onChange={() => handleInvestorSelect(investor.id)}
                        className="w-4 h-4 rounded border-gray-600 bg-dark-lighter text-primary focus:ring-primary"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    className="border-gray-600 text-gray-300 hover:bg-dark-lighter"
                  >
                    Previous
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {[...Array(totalPages)].map((_, i) => (
                      <Button
                        key={i}
                        variant={currentPage === i + 1 ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentPage(i + 1)}
                        className={currentPage === i + 1 
                          ? 'bg-primary hover:bg-primary-hover text-dark' 
                          : 'border-gray-600 text-gray-300 hover:bg-dark-lighter'
                        }
                      >
                        {i + 1}
                      </Button>
                    ))}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="border-gray-600 text-gray-300 hover:bg-dark-lighter"
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}