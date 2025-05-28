import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Search, Eye, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Deal } from '@shared/schema';

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

  return (
    <div className="min-h-screen bg-dark">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Recent Deals</h1>
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
            <Button variant="outline" className="bg-dark-lighter hover:bg-dark border-dark-lighter text-white">
              All Deals
            </Button>
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
                            <Badge className={cn("border", getScoreColor(deal.aiScore || 0))}>
                              {deal.aiScore || 0}/100
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge className={cn("border", getStatusColor(deal.status))}>
                              {deal.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
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