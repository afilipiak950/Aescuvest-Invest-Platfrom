import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import PageHeader from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { FileText, Calendar, TrendingUp, Eye, Edit, Download, Loader2 } from 'lucide-react';

interface InvestmentMemo {
  id: number;
  dealId: number;
  companyName: string;
  executiveSummary?: string;
  investmentThesis?: string;
  recommendation?: {
    investment_recommendation?: string;
  };
  createdAt: string;
  updatedAt: string;
  status?: string;
  aiScore?: number;
  riskLevel?: string;
  jobStatus?: string | null;
  jobProgress?: number | null;
  isGenerating?: boolean;
}

export default function Memos() {
  const [filter, setFilter] = useState<string>('all');

  const { data: memos = [], isLoading, refetch } = useQuery<InvestmentMemo[]>({
    queryKey: ['/api/memos'],
    enabled: true,
    refetchInterval: (query) => {
      // Auto-refresh every 3 seconds if any memo is generating
      const hasGenerating = query.state.data?.some((m: InvestmentMemo) => m.isGenerating);
      return hasGenerating ? 3000 : false;
    }
  });

  // Manually refetch when page becomes visible (for page navigation persistence)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetch();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refetch]);

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'DRAFT': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'REVIEW': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'APPROVED': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'PUBLISHED': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getRecommendationColor = (recommendation?: string) => {
    if (!recommendation) return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    
    const rec = recommendation.toUpperCase();
    if (rec.includes('INVEST') || rec.includes('PASS')) {
      return rec.includes('PASS') 
        ? 'bg-red-500/20 text-red-300 border-red-500/30'
        : 'bg-green-500/20 text-green-300 border-green-500/30';
    }
    if (rec.includes('WATCH') || rec.includes('INVESTIGATE')) {
      return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
    }
    return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  };

  const getRiskColor = (risk?: string) => {
    switch (risk?.toUpperCase()) {
      case 'LOW': return 'text-green-400';
      case 'MEDIUM': return 'text-yellow-400';
      case 'HIGH': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const formatRecommendation = (rec?: { investment_recommendation?: string }): string => {
    if (!rec || !rec.investment_recommendation) return 'PENDING';
    const text = rec.investment_recommendation;
    if (text.includes('PASS')) return 'PASS';
    if (text.includes('INVEST')) return 'INVEST';
    if (text.includes('WATCH') || text.includes('INVESTIGATE')) return 'WATCH';
    return 'PENDING';
  };

  const filteredMemos = filter === 'all' 
    ? memos 
    : memos.filter((memo: InvestmentMemo) => 
        memo.status?.toLowerCase() === filter
      );

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader 
        title="Investment Memos" 
        description="Comprehensive investment analysis and recommendations"
        actions={[
          { label: 'New Memo', icon: 'Plus', href: '/memo-generator', variant: 'default' }
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
                data-testid={`filter-${status}`}
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
            <Card 
              key={memo.id} 
              className="bg-dark-light border-dark-lighter hover:bg-dark-lighter/50 transition-all"
              data-testid={`memo-card-${memo.id}`}
            >
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
                    <Badge variant="outline" className={getStatusColor(memo.status || 'DRAFT')}>
                      {memo.status?.toUpperCase() || 'DRAFT'}
                    </Badge>
                    {memo.aiScore && (
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-300">{memo.aiScore}/100</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                {/* Show generation progress if generating */}
                {memo.isGenerating && (
                  <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                      <span className="text-sm font-medium text-blue-400">
                        Generating memo... {memo.jobProgress || 0}%
                      </span>
                    </div>
                    <Progress value={memo.jobProgress || 0} className="h-2" />
                    <p className="text-xs text-gray-400 mt-2">
                      This continues in background. You can navigate away.
                    </p>
                  </div>
                )}

                <p className="text-sm text-gray-300 mb-4 line-clamp-3">
                  {memo.executiveSummary || 'Investment memo is being generated...'}
                </p>
                
                <div className="flex items-center justify-between mb-4">
                  <Badge 
                    variant="outline" 
                    className={getRecommendationColor(formatRecommendation(memo.recommendation))}
                  >
                    {formatRecommendation(memo.recommendation)}
                  </Badge>
                  {memo.riskLevel && (
                    <span className={`text-xs font-medium ${getRiskColor(memo.riskLevel)}`}>
                      {memo.riskLevel} Risk
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Link href={`/due-diligence?deal=${memo.dealId}`}>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="flex-1"
                      data-testid={`view-details-${memo.id}`}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View Details
                    </Button>
                  </Link>
                  <Link href={`/memo-generator?deal=${memo.dealId}`}>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full hover:bg-dark-lighter hover:text-white"
                      data-testid={`edit-memo-${memo.id}`}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      {memo.isGenerating ? 'View' : 'Edit'}
                    </Button>
                  </Link>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    data-testid={`download-memo-${memo.id}`}
                  >
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
            <Button data-testid="create-first-memo">
              <FileText className="h-4 w-4 mr-2" />
              Create First Memo
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
