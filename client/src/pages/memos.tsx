import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import PageHeader from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Calendar, TrendingUp, Users, Eye, Edit, Download } from 'lucide-react';

interface InvestmentMemo {
  id: number;
  dealId: number;
  companyName: string;
  executiveSummary: string;
  investmentThesis: string;
  recommendation: 'INVEST' | 'PASS' | 'WATCH';
  createdAt: string;
  updatedAt: string;
  status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED';
  aiScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export default function Memos() {
  const [filter, setFilter] = useState<string>('all');

  const { data: memos = [], isLoading } = useQuery({
    queryKey: ['/api/memos'],
    enabled: true
  });

  // Mock data for demonstration
  const mockMemos: InvestmentMemo[] = [
    {
      id: 1,
      dealId: 21,
      companyName: 'Tesla Company',
      executiveSummary: 'Tesla is a leading electric vehicle and clean energy company with strong market position...',
      investmentThesis: 'Compelling investment opportunity in the rapidly growing EV market with innovative technology...',
      recommendation: 'INVEST',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
      status: 'REVIEW',
      aiScore: 92,
      riskLevel: 'MEDIUM'
    },
    {
      id: 2,
      dealId: 20,
      companyName: 'NeuroTech Solutions',
      executiveSummary: 'Innovative medical technology company developing brain-computer interfaces...',
      investmentThesis: 'Revolutionary technology with significant medical applications and market potential...',
      recommendation: 'WATCH',
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      status: 'DRAFT',
      aiScore: 78,
      riskLevel: 'HIGH'
    },
    {
      id: 3,
      dealId: 19,
      companyName: 'GreenEnergy Systems',
      executiveSummary: 'Renewable energy infrastructure company with focus on solar and wind solutions...',
      investmentThesis: 'Strong fundamentals in growing renewable energy sector with proven technology...',
      recommendation: 'INVEST',
      createdAt: new Date(Date.now() - 259200000).toISOString(),
      updatedAt: new Date(Date.now() - 172800000).toISOString(),
      status: 'APPROVED',
      aiScore: 88,
      riskLevel: 'LOW'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'REVIEW': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'APPROVED': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'PUBLISHED': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'INVEST': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'PASS': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'WATCH': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'LOW': return 'text-green-400';
      case 'MEDIUM': return 'text-yellow-400';
      case 'HIGH': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const displayMemos = mockMemos;
  const filteredMemos = filter === 'all' ? displayMemos : displayMemos.filter((memo: InvestmentMemo) => memo.status.toLowerCase() === filter);

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader 
        title="Investment Memos" 
        description="Comprehensive investment analysis and recommendations"
        actions={[
          { label: 'New Memo', icon: 'Plus', href: '/memo-generator', variant: 'default' },
          { label: 'Templates', icon: 'FileText', href: '/memo-templates', variant: 'outline' }
        ]}
      />

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-300">Filter by status:</span>
          <div className="flex gap-2">
            {['all', 'draft', 'review', 'approved', 'published'].map((status) => (
              <Button
                key={status}
                variant={filter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(status)}
                className="capitalize"
              >
                {status}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Memos Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-dark-light border-dark-lighter">
              <CardHeader>
                <Skeleton className="h-6 w-3/4 bg-dark-lighter" />
                <Skeleton className="h-4 w-1/2 bg-dark-lighter" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full bg-dark-lighter mb-4" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16 bg-dark-lighter" />
                  <Skeleton className="h-6 w-20 bg-dark-lighter" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          filteredMemos.map((memo: InvestmentMemo) => (
            <Card key={memo.id} className="bg-dark-light border-dark-lighter hover:bg-dark-lighter/50 transition-all">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-white mb-1">
                      {memo.companyName}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Calendar className="h-3 w-3" />
                      {new Date(memo.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className={getStatusColor(memo.status)}>
                      {memo.status}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-300">{memo.aiScore}/100</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <p className="text-sm text-gray-300 mb-4 line-clamp-3">
                  {memo.executiveSummary}
                </p>
                
                <div className="flex items-center justify-between mb-4">
                  <Badge variant="outline" className={getRecommendationColor(memo.recommendation)}>
                    {memo.recommendation}
                  </Badge>
                  <span className={`text-xs font-medium ${getRiskColor(memo.riskLevel)}`}>
                    {memo.riskLevel} Risk
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Link href={`/due-diligence?deal=${memo.dealId}`}>
                    <Button variant="ghost" size="sm" className="flex-1">
                      <Eye className="h-3 w-3 mr-1" />
                      View Details
                    </Button>
                  </Link>
                  <Link href={`/memo-generator?deal=${memo.dealId}&edit=${memo.id}`}>
                    <Button variant="ghost" size="sm">
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm">
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Empty State */}
      {!isLoading && filteredMemos.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">No memos found</h3>
          <p className="text-gray-500 mb-4">
            {filter === 'all' 
              ? 'No investment memos have been created yet.' 
              : `No memos with status "${filter}" found.`
            }
          </p>
          <Link href="/memo-generator">
            <Button>
              <FileText className="h-4 w-4 mr-2" />
              Create First Memo
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}