import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Plus, Eye, FileText, Users, TrendingUp, Search, Filter } from 'lucide-react';
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
    <div className="container mx-auto px-4 py-6">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Deal Management</h1>
            <p className="text-gray-400">Verwalte alle Investment-Opportunities</p>
          </div>
          <Button 
            onClick={() => setShowCreateForm(true)}
            className="bg-primary hover:bg-primary-hover text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            Neuen Deal erstellen
          </Button>
        </div>
      </div>

      <div className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-dark-light border-dark-lighter">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Total Deals</CardTitle>
                <FileText className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{deals.length}</div>
                <p className="text-xs text-gray-400 mt-1">Aktive Opportunities</p>
              </CardContent>
            </Card>

            <Card className="bg-dark-light border-dark-lighter">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">In Due Diligence</CardTitle>
                <Users className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {deals.filter(deal => deal.status === 'Due Diligence').length}
                </div>
                <p className="text-xs text-gray-400 mt-1">Deals in Prüfung</p>
              </CardContent>
            </Card>

            <Card className="bg-dark-light border-dark-lighter">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Avg. AI Score</CardTitle>
                <TrendingUp className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {deals.length > 0 ? Math.round(deals.reduce((acc, deal) => acc + (deal.aiScore || 0), 0) / deals.length) : 0}
                </div>
                <p className="text-xs text-gray-400 mt-1">Durchschnittlicher Score</p>
              </CardContent>
            </Card>

            <Card className="bg-dark-light border-dark-lighter">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">This Month</CardTitle>
                <Plus className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {deals.filter(deal => {
                    const dealDate = new Date(deal.createdAt);
                    const now = new Date();
                    return dealDate.getMonth() === now.getMonth() && dealDate.getFullYear() === now.getFullYear();
                  }).length}
                </div>
                <p className="text-xs text-gray-400 mt-1">Neue Deals</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="bg-dark-light border-dark-lighter">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Suche nach Unternehmen oder Beschreibung..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-dark border-dark-lighter focus:ring-primary"
                    />
                  </div>
                </div>
                
                <Select value={sectorFilter} onValueChange={setSectorFilter}>
                  <SelectTrigger className="w-full md:w-48 bg-dark border-dark-lighter">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Sektor" />
                  </SelectTrigger>
                  <SelectContent className="bg-dark-lighter border-dark-lighter">
                    <SelectItem value="all">Alle Sektoren</SelectItem>
                    {uniqueSectors.map(sector => (
                      <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-48 bg-dark border-dark-lighter">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-dark-lighter border-dark-lighter">
                    <SelectItem value="all">Alle Status</SelectItem>
                    {uniqueStatuses.map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Deals Table */}
          <Card className="bg-dark-light border-dark-lighter">
            <CardHeader>
              <CardTitle>Alle Deals ({filteredDeals.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-[250px]" />
                        <Skeleton className="h-4 w-[200px]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredDeals.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Keine Deals gefunden</h3>
                  <p className="text-gray-400 mb-4">
                    {searchTerm || sectorFilter !== 'all' || statusFilter !== 'all' 
                      ? 'Keine Deals entsprechen den aktuellen Filterkriterien.'
                      : 'Erstelle deinen ersten Deal, um loszulegen.'
                    }
                  </p>
                  <Button onClick={() => {
                    setSearchTerm('');
                    setSectorFilter('all');
                    setStatusFilter('all');
                  }}>
                    Filter zurücksetzen
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-dark-lighter">
                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Unternehmen</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Sektor</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Stage</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Funding</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">AI Score</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Status</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Erstellt</th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDeals.map((deal) => {
                        const firstLetter = deal.companyName.charAt(0);
                        const bgColor = getRandomColor();
                        
                        return (
                          <tr key={deal.id} className="border-b border-dark-lighter hover:bg-dark-lighter/50 transition">
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
                              <Badge variant="outline" className="border-gray-600 text-gray-300">
                                {deal.sector}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                              {deal.stage}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                              {deal.fundingAmount ? `€${(deal.fundingAmount / 1000000).toFixed(1)}M` : 'N/A'}
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
                            <td className="px-6 py-4 whitespace-nowrap text-gray-400 text-sm">
                              {new Date(deal.createdAt).toLocaleDateString('de-DE')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <Link href={`/due-diligence?deal=${deal.id}`}>
                                <Button variant="ghost" size="sm" className="text-primary hover:text-primary-hover">
                                  <Eye className="h-4 w-4 mr-1" />
                                  Anzeigen
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