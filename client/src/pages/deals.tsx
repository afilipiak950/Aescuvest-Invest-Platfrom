import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Plus, Eye, FileText, Users, TrendingUp, Search, Filter, Briefcase } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Deal } from '@shared/schema';
import DealForm from '../components/forms/DealForm';

const getScoreColor = (score: number) => {
  if (score >= 80) return 'bg-green-500/20 text-green-400 border-green-500/30';
  if (score >= 60) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
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
    'bg-blue-500 text-white',
    'bg-green-500 text-white',
    'bg-purple-500 text-white',
    'bg-orange-500 text-white',
    'bg-pink-500 text-white',
    'bg-indigo-500 text-white',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

export default function DealsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: deals = [], isLoading } = useQuery<Deal[]>({
    queryKey: ['/api/deals'],
  });

  const filteredDeals = deals.filter(deal => {
    const matchesSearch = deal.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         deal.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSector = sectorFilter === 'all' || deal.sector === sectorFilter;
    const matchesStatus = statusFilter === 'all' || deal.status === statusFilter;
    
    return matchesSearch && matchesSector && matchesStatus;
  });

  const uniqueSectors = Array.from(new Set(deals.map(deal => deal.sector)));
  const uniqueStatuses = Array.from(new Set(deals.map(deal => deal.status)));

  if (showCreateForm) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => setShowCreateForm(false)}
            className="mb-4 bg-dark-lighter hover:bg-dark border-dark-lighter"
          >
            ← Zurück zur Deal-Übersicht
          </Button>
          <h1 className="text-3xl font-bold mb-2">Neuen Deal anlegen</h1>
          <p className="text-gray-400">Erstelle eine neue Investment-Opportunity im System</p>
        </div>

        <Card className="bg-dark-light border-dark-lighter">
          <CardContent className="pt-6">
            <DealForm />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-dark-light to-dark">
      {/* Header Section */}
      <div className="border-b border-dark-lighter bg-dark/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-3">
                Investment Deals
              </h1>
              <p className="text-gray-400 text-lg">
                Verwalte dein Deal-Portfolio und entdecke neue Opportunities
              </p>
            </div>
            
            {/* Create Deal Button - Premium Design */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-400">Deals verwalten</p>
                <p className="text-2xl font-bold text-white">{deals.length}</p>
              </div>
              <Button 
                onClick={() => setShowCreateForm(true)}
                className="bg-gradient-to-r from-primary to-primary-hover hover:from-primary-hover hover:to-primary text-white px-8 py-3 h-auto text-lg font-semibold shadow-xl hover:shadow-primary/25 transition-all duration-300 transform hover:scale-105"
              >
                <Plus className="mr-3 h-5 w-5" />
                Create New Deal
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Modern Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-dark-light to-dark border-dark-lighter/50 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-medium mb-1">Total Portfolio</p>
                  <p className="text-3xl font-bold text-white">{deals.length}</p>
                  <p className="text-green-400 text-xs mt-1">↗ Active deals</p>
                </div>
                <div className="h-12 w-12 bg-primary/20 rounded-xl flex items-center justify-center">
                  <Briefcase className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-dark-light to-dark border-dark-lighter/50 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-medium mb-1">Due Diligence</p>
                  <p className="text-3xl font-bold text-white">
                    {deals.filter(deal => deal.status === 'Due Diligence').length}
                  </p>
                  <p className="text-blue-400 text-xs mt-1">↻ In review</p>
                </div>
                <div className="h-12 w-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <Search className="h-6 w-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-dark-light to-dark border-dark-lighter/50 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-medium mb-1">AI Score Avg</p>
                  <p className="text-3xl font-bold text-white">
                    {deals.length > 0 ? Math.round(deals.reduce((acc, deal) => acc + (deal.aiScore || 0), 0) / deals.length) : 0}
                  </p>
                  <p className="text-purple-400 text-xs mt-1">⚡ AI powered</p>
                </div>
                <div className="h-12 w-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-dark-light to-dark border-dark-lighter/50 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-medium mb-1">This Month</p>
                  <p className="text-3xl font-bold text-white">
                    {deals.filter(deal => {
                      const dealDate = new Date(deal.createdAt);
                      const now = new Date();
                      return dealDate.getMonth() === now.getMonth() && dealDate.getFullYear() === now.getFullYear();
                    }).length}
                  </p>
                  <p className="text-orange-400 text-xs mt-1">✨ New opportunities</p>
                </div>
                <div className="h-12 w-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                  <Plus className="h-6 w-6 text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modern Search & Filter Bar */}
        <Card className="bg-gradient-to-r from-dark-light/80 to-dark/80 border-dark-lighter/50 backdrop-blur-md">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-6 items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search companies, descriptions, or sectors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 pr-4 py-3 bg-dark/50 border-dark-lighter/50 focus:ring-2 focus:ring-primary/50 focus:border-primary text-white placeholder-gray-400 text-lg"
                />
              </div>
              
              <div className="flex gap-4">
                <Select value={sectorFilter} onValueChange={setSectorFilter}>
                  <SelectTrigger className="w-48 bg-dark/50 border-dark-lighter/50 focus:ring-2 focus:ring-primary/50">
                    <SelectValue placeholder="All Sectors" />
                  </SelectTrigger>
                  <SelectContent className="bg-dark border-dark-lighter">
                    <SelectItem value="all">All Sectors</SelectItem>
                    {uniqueSectors.map(sector => (
                      <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48 bg-dark/50 border-dark-lighter/50 focus:ring-2 focus:ring-primary/50">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-dark border-dark-lighter">
                    <SelectItem value="all">All Status</SelectItem>
                    {uniqueStatuses.map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Premium Deals Table */}
        <Card className="bg-gradient-to-br from-dark-light/90 to-dark/90 border-dark-lighter/50 backdrop-blur-md shadow-2xl">
          <CardHeader className="border-b border-dark-lighter/50 pb-6">
            <div className="flex justify-between items-center">
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Portfolio Overview ({filteredDeals.length} deals)
              </CardTitle>
              <div className="text-sm text-gray-400">
                Last updated: {new Date().toLocaleDateString('de-DE')}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-6 p-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-5 w-[300px]" />
                      <Skeleton className="h-4 w-[200px]" />
                    </div>
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                ))}
              </div>
            ) : filteredDeals.length === 0 ? (
              <div className="text-center py-16 px-8">
                <div className="mx-auto w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                  <Briefcase className="h-12 w-12 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">No deals found</h3>
                <p className="text-gray-400 text-lg mb-6 max-w-md mx-auto">
                  {searchTerm || sectorFilter !== 'all' || statusFilter !== 'all' 
                    ? 'No deals match your current filter criteria. Try adjusting your search.'
                    : 'Start building your investment portfolio by creating your first deal.'
                  }
                </p>
                <div className="flex gap-3 justify-center">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSearchTerm('');
                      setSectorFilter('all');
                      setStatusFilter('all');
                    }}
                    className="bg-dark-lighter hover:bg-dark border-dark-lighter"
                  >
                    Clear Filters
                  </Button>
                  <Button 
                    onClick={() => setShowCreateForm(true)}
                    className="bg-primary hover:bg-primary-hover"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Deal
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-dark/30">
                    <tr className="border-b border-dark-lighter/50">
                      <th className="px-8 py-5 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">Company</th>
                      <th className="px-6 py-5 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">Sector</th>
                      <th className="px-6 py-5 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">Stage</th>
                      <th className="px-6 py-5 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">Funding</th>
                      <th className="px-6 py-5 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">AI Score</th>
                      <th className="px-6 py-5 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-5 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">Created</th>
                      <th className="px-8 py-5 text-right text-sm font-semibold text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-lighter/30">
                    {filteredDeals.map((deal, index) => {
                      const firstLetter = deal.companyName.charAt(0);
                      const bgColor = getRandomColor();
                      
                      return (
                        <tr key={deal.id} className="hover:bg-dark-lighter/20 transition-all duration-200 group">
                          <td className="px-8 py-6 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className={cn("flex-shrink-0 h-12 w-12 rounded-xl flex items-center justify-center font-bold text-sm shadow-lg", bgColor)}>
                                {firstLetter}
                              </div>
                              <div className="ml-4">
                                <div className="font-semibold text-white text-lg group-hover:text-primary transition-colors">
                                  {deal.companyName}
                                </div>
                                <div className="text-gray-400 text-sm mt-1 truncate max-w-[250px]">
                                  {deal.description}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-6 whitespace-nowrap">
                            <Badge variant="outline" className="border-gray-500/50 text-gray-300 bg-gray-500/10 font-medium">
                              {deal.sector}
                            </Badge>
                          </td>
                          <td className="px-6 py-6 whitespace-nowrap">
                            <span className="text-gray-300 font-medium">{deal.stage}</span>
                          </td>
                          <td className="px-6 py-6 whitespace-nowrap">
                            <span className="text-white font-semibold">
                              {deal.fundingAmount ? `€${(deal.fundingAmount / 1000000).toFixed(1)}M` : 'TBD'}
                            </span>
                          </td>
                          <td className="px-6 py-6 whitespace-nowrap">
                            <Badge className={cn("border font-semibold", getScoreColor(deal.aiScore || 0))}>
                              {deal.aiScore || 0}/100
                            </Badge>
                          </td>
                          <td className="px-6 py-6 whitespace-nowrap">
                            <Badge className={cn("border font-medium", getStatusColor(deal.status))}>
                              {deal.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-6 whitespace-nowrap">
                            <span className="text-gray-400 text-sm">
                              {new Date(deal.createdAt).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </span>
                          </td>
                          <td className="px-8 py-6 whitespace-nowrap text-right">
                            <Link href={`/due-diligence?deal=${deal.id}`}>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-primary hover:text-white hover:bg-primary/20 transition-all duration-200 font-medium"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Deal
                              </Button>
                            </Link>
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