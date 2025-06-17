import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  FileText, 
  Brain, 
  DollarSign, 
  Clock, 
  AlertCircle,
  CheckCircle,
  Activity,
  Target,
  Zap,
  BarChart3,
  PieChart
} from "lucide-react";
import { format } from "date-fns";
import { useEffect } from "react";

interface KPIData {
  totalDeals: number;
  activeDeals: number;
  documentsProcessed: number;
  aiAnalysesCompleted: number;
  averageProcessingTime: number;
  successRate: number;
  userActivity: number;
  apiCalls: number;
}

interface PerformanceData {
  dealsPipeline: {
    newSubmissions: number;
    underReview: number;
    dueDiligence: number;
    negotiation: number;
    approved: number;
    rejected: number;
    closed: number;
  };
  documentStats: {
    totalProcessed: number;
    ocrCompleted: number;
    aiAnalyzed: number;
    averageProcessingTime: number;
    errorRate: number;
  };
  aiPerformance: {
    totalQueries: number;
    successfulAnalyses: number;
    failedAnalyses: number;
    averageResponseTime: number;
    totalTokensUsed: number;
    totalCost: number;
  };
  userEngagement: {
    activeUsers: number;
    totalSessions: number;
    averageSessionDuration: number;
    totalActions: number;
  };
}

interface AIActivity {
  id: number;
  dealId?: number;
  documentId?: number;
  activityType: string;
  agentType?: string;
  status: string;
  processingTime?: number;
  tokenCount?: number;
  cost?: number;
  model?: string;
  timestamp: string;
}

interface Reminder {
  id: number;
  title: string;
  description?: string;
  type: string;
  priority: string;
  dueDate?: string;
  metadata?: any;
}

interface Deal {
  id: number;
  companyName: string;
  sector: string;
  stage: string;
  status: string;
  fundingAmount?: number;
  createdAt: string;
}

export function RealTimeDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch KPIs
  const { data: kpis } = useQuery<{ success: boolean; data: KPIData }>({
    queryKey: ['/api/dashboard/kpis'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch performance metrics
  const { data: performance } = useQuery<{ success: boolean; data: PerformanceData }>({
    queryKey: ['/api/dashboard/performance'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch AI activity
  const { data: aiActivity } = useQuery<{ success: boolean; data: AIActivity[] }>({
    queryKey: ['/api/dashboard/ai-activity'],
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Fetch reminders
  const { data: reminders } = useQuery<{ success: boolean; data: Reminder[] }>({
    queryKey: ['/api/dashboard/reminders'],
    refetchInterval: 120000, // Refresh every 2 minutes
  });

  // Fetch recent deals
  const { data: recentDeals } = useQuery<{ success: boolean; data: Deal[] }>({
    queryKey: ['/api/dashboard/recent-deals'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch comprehensive stats
  const { data: stats } = useQuery<{ success: boolean; data: any }>({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const completeReminder = async (id: number) => {
    try {
      const response = await fetch(`/api/dashboard/reminders/${id}/complete`, {
        method: 'POST',
      });
      
      if (response.ok) {
        toast({
          title: "Reminder completed",
          description: "The reminder has been marked as completed.",
        });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/reminders'] });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete reminder.",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-500';
      case 'failed': return 'text-red-500';
      case 'started': case 'processing': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-dark text-white p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Operational Dashboard</h1>
          <p className="text-gray-400">Real-time insights and analytics</p>
        </div>
        <div className="flex items-center space-x-2">
          <Activity className="h-4 w-4 text-green-500" />
          <span className="text-sm text-gray-400">Live data</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-300">Total Deals</h3>
            <Target className="h-4 w-4 text-gray-500" />
          </div>
          <div className="text-2xl font-bold text-white">{kpis?.data?.totalDeals || 0}</div>
          <p className="text-xs text-gray-400">
            {kpis?.data?.activeDeals || 0} active
          </p>
        </div>

        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-300">Documents Processed</h3>
            <FileText className="h-4 w-4 text-gray-500" />
          </div>
          <div className="text-2xl font-bold text-white">{kpis?.data?.documentsProcessed || 0}</div>
          <p className="text-xs text-gray-400">
            {Math.round((kpis?.data?.successRate || 0))}% success rate
          </p>
        </div>

        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-300">AI Analyses</h3>
            <Brain className="h-4 w-4 text-gray-500" />
          </div>
          <div className="text-2xl font-bold text-white">{kpis?.data?.aiAnalysesCompleted || 0}</div>
          <p className="text-xs text-gray-400">
            {formatDuration(kpis?.data?.averageProcessingTime || 0)} avg time
          </p>
        </div>

        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-300">User Activity</h3>
            <Users className="h-4 w-4 text-gray-500" />
          </div>
          <div className="text-2xl font-bold text-white">{kpis?.data?.userActivity || 0}</div>
          <p className="text-xs text-gray-400">
            {kpis?.data?.apiCalls || 0} API calls
          </p>
        </div>
      </div>

      {/* Pipeline Overview */}
      {performance?.data && (
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="h-5 w-5 text-white" />
            <h2 className="text-lg font-semibold text-white">Deal Pipeline</h2>
          </div>
          <p className="text-gray-400 text-sm mb-6">Current deal distribution by stage</p>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {Object.entries(performance.data.dealsPipeline).map(([stage, count]) => (
              <div key={stage} className="text-center">
                <div className="text-2xl font-bold text-white">{count as number}</div>
                <div className="text-xs text-gray-400 capitalize">
                  {stage.replace(/([A-Z])/g, ' $1').trim()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Performance */}
        {performance?.data && (
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-white" />
              <h2 className="text-lg font-semibold text-white">AI Performance</h2>
            </div>
            <p className="text-gray-400 text-sm mb-6">Recent AI analysis metrics</p>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Total Queries</span>
                <span className="font-bold text-white">{performance.data.aiPerformance.totalQueries}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Success Rate</span>
                <span className="font-bold text-white">
                  {performance.data.aiPerformance.totalQueries > 0 
                    ? Math.round((performance.data.aiPerformance.successfulAnalyses / performance.data.aiPerformance.totalQueries) * 100)
                    : 0}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Avg Response Time</span>
                <span className="font-bold text-white">
                  {formatDuration(performance.data.aiPerformance.averageResponseTime)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Total Cost</span>
                <span className="font-bold text-white">
                  {formatCurrency(performance.data.aiPerformance.totalCost)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Tokens Used</span>
                <span className="font-bold text-white">
                  {performance.data.aiPerformance.totalTokensUsed.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Recent AI Activity */}
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-white" />
            <h2 className="text-lg font-semibold text-white">Recent AI Activity</h2>
          </div>
          <p className="text-gray-400 text-sm mb-6">Latest AI processing activities</p>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {aiActivity?.data?.slice(0, 10).map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-800/50 border border-gray-600 rounded">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs bg-gray-700 text-gray-200 border-gray-600">
                      {activity.activityType}
                    </Badge>
                    {activity.agentType && (
                      <Badge variant="secondary" className="text-xs bg-gray-600 text-gray-200">
                        {activity.agentType}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    {format(new Date(activity.timestamp), 'MMM d, HH:mm')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {activity.processingTime && (
                    <span className="text-xs text-gray-400">
                      {formatDuration(activity.processingTime)}
                    </span>
                  )}
                  <div className={`h-2 w-2 rounded-full ${
                    activity.status === 'completed' ? 'bg-green-500' :
                    activity.status === 'failed' ? 'bg-red-500' :
                    activity.status === 'started' || activity.status === 'processing' ? 'bg-yellow-500' :
                    'bg-gray-500'
                  }`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Reminders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Active Reminders
            </CardTitle>
            <CardDescription>Pending tasks and follow-ups</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {reminders?.data?.map((reminder) => (
                <div key={reminder.id} className="flex items-start justify-between p-3 border rounded">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{reminder.title}</span>
                      <Badge variant={getPriorityColor(reminder.priority)} className="text-xs">
                        {reminder.priority}
                      </Badge>
                    </div>
                    {reminder.description && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {reminder.description}
                      </p>
                    )}
                    {reminder.dueDate && (
                      <div className="text-xs text-muted-foreground">
                        Due: {format(new Date(reminder.dueDate), 'MMM d, yyyy')}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => completeReminder(reminder.id)}
                  >
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Deals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Recent Deals
            </CardTitle>
            <CardDescription>Latest deal submissions and updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recentDeals?.data?.map((deal) => (
                <div key={deal.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex-1">
                    <div className="font-medium">{deal.companyName}</div>
                    <div className="text-sm text-muted-foreground">
                      {deal.sector} • {deal.stage}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(new Date(deal.createdAt), 'MMM d, yyyy')}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-xs mb-1">
                      {deal.status}
                    </Badge>
                    {deal.fundingAmount && (
                      <div className="text-sm font-medium">
                        {formatCurrency(deal.fundingAmount)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}