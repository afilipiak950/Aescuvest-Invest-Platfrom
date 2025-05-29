import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import PageHeader from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Eye, 
  Building2, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  FileText,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Deal } from '@/types';

// Define pipeline stages with descriptions and colors
const PIPELINE_STAGES = [
  {
    id: 'incoming',
    name: 'Incoming',
    description: 'New submissions and leads',
    color: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
    icon: Building2,
    count: 0
  },
  {
    id: 'screening',
    name: 'Initial Screening',
    description: 'First review and evaluation',
    color: 'bg-purple-500/20 border-purple-500/30 text-purple-400',
    icon: FileText,
    count: 0
  },
  {
    id: 'due-diligence',
    name: 'Due Diligence',
    description: 'Deep analysis and investigation',
    color: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
    icon: Target,
    count: 0
  },
  {
    id: 'negotiation',
    name: 'Negotiation',
    description: 'Terms and conditions discussion',
    color: 'bg-orange-500/20 border-orange-500/30 text-orange-400',
    icon: Users,
    count: 0
  },
  {
    id: 'final-review',
    name: 'Final Review',
    description: 'Investment committee decision',
    color: 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400',
    icon: CheckCircle,
    count: 0
  },
  {
    id: 'closed-won',
    name: 'Closed Won',
    description: 'Successfully invested',
    color: 'bg-green-500/20 border-green-500/30 text-green-400',
    icon: TrendingUp,
    count: 0
  },
  {
    id: 'closed-lost',
    name: 'Closed Lost',
    description: 'Not proceeded with investment',
    color: 'bg-red-500/20 border-red-500/30 text-red-400',
    icon: AlertCircle,
    count: 0
  }
];

export default function Pipeline() {
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);
  const queryClient = useQueryClient();

  // Fetch deals from the database
  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['/api/deals'],
    retry: false,
  });

  // Mutation to update deal status (stage)
  const updateDealStatus = useMutation({
    mutationFn: async ({ dealId, status }: { dealId: number; status: string }) => {
      const response = await fetch(`/api/deals/${dealId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
    }
  });

  // Map deal status to pipeline stages
  const mapDealStatusToStage = (status: string): string => {
    const statusMapping: { [key: string]: string } = {
      'submitted': 'incoming',
      'screening': 'screening',
      'under-review': 'due-diligence',
      'negotiating': 'negotiation',
      'final-review': 'final-review',
      'invested': 'closed-won',
      'rejected': 'closed-lost',
      'declined': 'closed-lost'
    };
    return statusMapping[status] || 'incoming';
  };

  // Group deals by stage
  const dealsByStage = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage.id] = deals.filter((deal: Deal) => mapDealStatusToStage(deal.status) === stage.id);
    return acc;
  }, {} as Record<string, Deal[]>);

  // Update stage counts
  const stagesWithCounts = PIPELINE_STAGES.map(stage => ({
    ...stage,
    count: dealsByStage[stage.id]?.length || 0
  }));

  // Handle drag and drop
  const handleDragStart = (e: React.DragEvent, deal: Deal) => {
    setDraggedDeal(deal);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    if (!draggedDeal) return;

    const newStatus = getStatusFromStage(targetStage);
    if (newStatus !== draggedDeal.status) {
      updateDealStatus.mutate({
        dealId: draggedDeal.id,
        status: newStatus
      });
    }
    setDraggedDeal(null);
  };

  // Map stage back to status
  const getStatusFromStage = (stage: string): string => {
    const stageMapping: { [key: string]: string } = {
      'incoming': 'submitted',
      'screening': 'screening',
      'due-diligence': 'under-review',
      'negotiation': 'negotiating',
      'final-review': 'final-review',
      'closed-won': 'invested',
      'closed-lost': 'rejected'
    };
    return stageMapping[stage] || 'submitted';
  };

  const getAIScoreColor = (score: number | string) => {
    const numScore = typeof score === 'string' ? parseFloat(score) : score;
    if (numScore >= 85) return 'text-green-400';
    if (numScore >= 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getConsistentColor = (id: number) => {
    const colors = [
      'bg-blue-500',
      'bg-purple-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-indigo-500',
      'bg-pink-500',
      'bg-teal-500',
    ];
    return colors[id % colors.length];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark text-white p-6">
        <PageHeader
          title="Investment Pipeline"
          description="Manage deals through the investment process"
        />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-400">Loading pipeline...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark text-white">
      <div className="container mx-auto px-4 py-6">
        <PageHeader
          title="Investment Pipeline"
          description="Manage deals through the investment process with drag & drop"
        />

        {/* Pipeline Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {stagesWithCounts.map((stage) => {
          const Icon = stage.icon;
          return (
            <Card key={stage.id} className="bg-dark-light border-dark-lighter hover:bg-dark-lighter/50 transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-4 w-4 text-gray-400" />
                      <p className="text-xs text-gray-400 font-medium">{stage.name}</p>
                    </div>
                    <p className="text-2xl font-bold text-white">{stage.count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

        {/* Kanban Board */}
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-4">
          {stagesWithCounts.map((stage) => {
            const Icon = stage.icon;
            const stageDeals = dealsByStage[stage.id] || [];
            
            return (
              <div
                key={stage.id}
                className="flex-shrink-0 w-72"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {/* Stage Header */}
                <Card className="bg-dark-light border-dark-lighter mb-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-gray-400" />
                        <span className="text-white text-lg font-semibold">{stage.name}</span>
                      </div>
                      <Badge className={cn("border font-medium", stage.color)}>
                        {stage.count}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-gray-400">{stage.description}</p>
                  </CardHeader>
                </Card>

                {/* Deal Cards */}
                <div className="space-y-3 min-h-[200px]">
                  {stageDeals.map((deal) => {
                    const firstLetter = deal.companyName.charAt(0);
                    const bgColor = getConsistentColor(deal.id);
                    
                    return (
                      <Card
                        key={deal.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, deal)}
                        className="bg-dark border-dark-lighter hover:bg-dark-lighter/50 transition-all cursor-move hover:shadow-lg"
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2 mb-2">
                            <div className={cn("flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center font-semibold text-white text-xs", bgColor)}>
                              {firstLetter}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-white text-sm mb-1 truncate">
                                {deal.companyName}
                              </h3>

                              <p className="text-xs text-gray-400 mb-2 line-clamp-1">
                                {deal.description}
                              </p>
                            </div>
                          </div>

                          {/* Deal Metrics */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3 text-gray-400" />
                              <span className="text-xs text-gray-300 font-medium">
                                {deal.fundingAmount 
                                  ? `€${(deal.fundingAmount / 1000000).toFixed(1)}M` 
                                  : 'TBD'
                                }
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3 text-gray-400" />
                              <span className={cn("text-xs font-medium", getAIScoreColor(deal.aiScore || 0))}>
                                {deal.aiScore || 0}/100
                              </span>
                            </div>
                          </div>

                          {/* Created Date */}
                          <div className="flex items-center gap-1 mb-2">
                            <Calendar className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-400">
                              {new Date(deal.createdAt).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </span>
                          </div>

                          {/* Action Button */}
                          <Link href={`/due-diligence?deal=${deal.id}`}>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full text-primary hover:text-white hover:bg-primary/20 transition-all"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View Details
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {/* Empty State */}
                  {stageDeals.length === 0 && (
                    <div className="border-2 border-dashed border-dark-lighter rounded-lg p-6 text-center">
                      <Icon className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No deals in this stage</p>
                      <p className="text-xs text-gray-600 mt-1">Drag deals here to move them</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}