import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import PageHeader from '@/components/layout/page-header';
import StatsCard from '@/components/dashboard/stats-card';
import DealsTable from '@/components/dashboard/deals-table';
import ActivityCard from '@/components/dashboard/activity-card';
import { DashboardStats, Deal, Activity, Reminder } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Mock data for initial render
const mockDashboardStats: DashboardStats = {
  deals: 14,
  dueDiligence: 7,
  memos: 5,
  investors: 28
};

const mockDeals: Deal[] = [
  {
    id: 1,
    companyName: 'NeuroTech AI',
    description: 'Brain-computer interface',
    sector: 'MedTech',
    stage: 'Series A',
    location: 'Berlin, Germany',
    fundingAmount: 8500000,
    aiScore: 85,
    status: 'Due Diligence',
    createdAt: new Date(Date.now() - 86400000).toISOString(), // yesterday
    documents: []
  },
  {
    id: 2,
    companyName: 'GeneMap+',
    description: 'Genomic sequencing platform',
    sector: 'BioTech',
    stage: 'Seed',
    location: 'Zurich, Switzerland',
    fundingAmount: 2000000,
    aiScore: 92,
    status: 'Screening',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
    documents: []
  },
  {
    id: 3,
    companyName: 'HealthMetrics',
    description: 'Remote patient monitoring',
    sector: 'HealthTech',
    stage: 'Series B',
    location: 'London, UK',
    fundingAmount: 12000000,
    aiScore: 78,
    status: 'Memo Ready',
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(), // 10 days ago
    documents: []
  },
  {
    id: 4,
    companyName: 'MediDrone',
    description: 'Autonomous medical delivery',
    sector: 'MedTech',
    stage: 'Pre-Seed',
    location: 'Munich, Germany',
    fundingAmount: 500000,
    aiScore: 65,
    status: 'New Submission',
    createdAt: new Date(Date.now() - 86400000 * 15).toISOString(), // 15 days ago
    documents: []
  }
];

const mockActivities: Activity[] = [
  {
    id: 1,
    agentType: 'Legal Agent',
    content: 'Completed analysis of NeuroTech AI\'s term sheet and flagged 3 issues for review',
    timestamp: new Date(Date.now() - 7200000).toISOString() // 2 hours ago
  },
  {
    id: 2,
    agentType: 'Finance Agent',
    content: 'Analyzed burn rate and runway for HealthMetrics. See the full financial report.',
    timestamp: new Date(Date.now() - 18000000).toISOString() // 5 hours ago
  },
  {
    id: 3,
    agentType: 'Medical Agent',
    content: 'Completed review of clinical validation studies for DiaPatch. Study design meets FDA requirements.',
    timestamp: new Date(Date.now() - 86400000).toISOString() // yesterday
  },
  {
    id: 4,
    agentType: 'Commercial Agent',
    content: 'Generated market analysis report for PharmaLogic, identifying 3 key competitors.',
    timestamp: new Date(Date.now() - 172800000).toISOString() // 2 days ago
  }
];

const mockReminders: Reminder[] = [
  {
    id: 1,
    title: 'Complete NeuroTech AI Memo',
    description: 'First draft of investment memo needs to be reviewed before partner meeting',
    deadline: new Date(Date.now() + 86400000).toISOString(), // tomorrow
    type: 'memo',
    actions: ['Complete', 'Snooze']
  },
  {
    id: 2,
    title: 'HealthMatrix Team Call',
    description: 'Follow-up on technical due diligence findings',
    deadline: new Date(Date.now() + 172800000).toISOString(), // in 2 days
    type: 'call',
    actions: ['Join Call', 'Reschedule']
  },
  {
    id: 3,
    title: 'Due Diligence for CareCore',
    description: 'Submit regulatory documents for AI analysis',
    deadline: new Date(Date.now() + 604800000).toISOString(), // next week
    type: 'due-diligence',
    actions: ['Start', 'Remind Later']
  }
];

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>(mockDashboardStats);
  const [deals, setDeals] = useState<Deal[]>(mockDeals);
  const [activities, setActivities] = useState<Activity[]>(mockActivities);
  const [reminders, setReminders] = useState<Reminder[]>(mockReminders);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState('User');
  const [pendingTasks, setPendingTasks] = useState(4);
  const [realStats, setRealStats] = useState({
    dueDiligenceActive: 0,
    memosDrafts: 0,
    investorMatches: 0,
    recentDealsChange: 0
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch real deals data
        const dealsResponse = await fetch('/api/deals');
        const dealsData = await dealsResponse.json();
        
        if (dealsData.success && dealsData.deals) {
          setDeals(dealsData.deals);
          
          // Calculate real stats from deals data
          const dueDiligenceCount = dealsData.deals.filter((deal: any) => deal.status === 'Due Diligence').length;
          const memosCount = dealsData.deals.filter((deal: any) => deal.status === 'Investment Committee').length;
          const termSheetCount = dealsData.deals.filter((deal: any) => deal.status === 'Term Sheet').length;
          
          const realStats = {
            deals: dealsData.deals.length,
            dueDiligence: dueDiligenceCount,
            memos: memosCount,
            investors: termSheetCount
          };
          setStats(realStats);
          
          // Calculate additional real statistics
          const documentsCount = dealsData.deals.reduce((total: number, deal: any) => 
            total + (deal.documents?.length || 0), 0);
          const recentDeals = dealsData.deals.filter((deal: any) => 
            new Date(deal.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
          
          setRealStats({
            dueDiligenceActive: documentsCount,
            memosDrafts: dealsData.deals.filter((deal: any) => 
              deal.status === 'Screening' || deal.status === 'Due Diligence').length,
            investorMatches: dealsData.deals.filter((deal: any) => 
              deal.status === 'Term Sheet' || deal.status === 'Closed').length,
            recentDealsChange: Math.round((recentDeals.length / dealsData.deals.length) * 100)
          });
        }
        
        // Fetch real activities (analyses and memos)
        const activitiesData: Activity[] = [];
        for (const deal of dealsData.deals || []) {
          try {
            const analysesResponse = await fetch(`/api/analyses/${deal.id}`);
            const analysesData = await analysesResponse.json();
            
            if (analysesData.success && analysesData.analyses) {
              analysesData.analyses.forEach((analysis: any) => {
                activitiesData.push({
                  id: Number(analysis.id),
                  agentType: analysis.analysisType,
                  content: `${deal.companyName} - ${analysis.analysisType} analysis completed`,
                  timestamp: analysis.createdAt || new Date().toISOString()
                });
              });
            }
          } catch (error) {
            console.log('No analyses found for deal:', deal.id);
          }
        }
        
        // Sort activities by timestamp and take the latest 5
        activitiesData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setActivities(activitiesData.slice(0, 5));
        
        // Generate real reminders from deals
        const realReminders = dealsData.deals?.slice(0, 3).map((deal: any, index: number) => ({
          id: deal.id,
          title: `Review ${deal.companyName}`,
          description: `${deal.status} stage - Follow up required`,
          deadline: new Date(Date.now() + (index + 1) * 86400000).toISOString(),
          type: deal.status === 'Due Diligence' ? 'due-diligence' : 'memo',
          actions: ['Complete', 'Snooze']
        })) || [];
        
        setReminders(realReminders);
        
        // Fetch user information
        try {
          const userResponse = await fetch('/api/settings/user');
          const userData = await userResponse.json();
          if (userData.success && userData.user) {
            setUserName(userData.user.name || userData.user.username || 'User');
          }
        } catch (error) {
          console.log('Could not fetch user data');
        }
        
        // Calculate pending tasks from reminders and deals
        const tasksCount = realReminders.length + dealsData.deals?.filter((deal: any) => 
          deal.status === 'Screening' || deal.status === 'Due Diligence'
        ).length || 0;
        setPendingTasks(tasksCount);
        
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Keep existing mock data on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader 
        title="Dashboard" 
        description={`Welcome back, ${userName}. You have ${pendingTasks} pending tasks.`}
        actions={[
          { label: 'New Deal', icon: 'Plus', href: '/deal-intake', variant: 'outline' },
          { label: 'Generate Memo', icon: 'FileText', href: '/memo-generator', variant: 'default' }
        ]}
      />

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard 
          title="Deal Pipeline"
          value={stats.deals}
          icon="FileText"
          change={realStats.recentDealsChange > 0 ? `+${realStats.recentDealsChange}%` : `${realStats.recentDealsChange}%`}
          changeText="from last month"
          isLoading={isLoading}
          href="/pipeline"
        />
        <StatsCard 
          title="Due Diligence"
          value={stats.dueDiligence}
          icon="Search"
          change={`${realStats.dueDiligenceActive} documents`}
          changeText="under review"
          isLoading={isLoading}
          href="/due-diligence"
        />
        <StatsCard 
          title="Investment Memos"
          value={stats.memos}
          icon="FileText"
          change={`${realStats.memosDrafts} pending`}
          changeText="to review"
          isLoading={isLoading}
          href="/memos"
        />
        <StatsCard 
          title="Investor Matching"
          value={stats.investors}
          icon="Users"
          change={`${realStats.investorMatches} matched`}
          changeText="this quarter"
          isLoading={isLoading}
          href="/investor-matching"
        />
      </div>

      {/* Recent Deals */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Recent Deals</h2>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search deals..." 
                className="bg-dark-lighter text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 w-full md:w-64"
              />
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <select className="bg-dark-lighter text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none">
              <option>All Deals</option>
              <option>HealthTech</option>
              <option>MedTech</option>
              <option>BioTech</option>
            </select>
          </div>
        </div>

        <DealsTable deals={deals} isLoading={isLoading} />
      </div>

      {/* Reminders and Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Reminders */}
        <Card className="bg-dark-light border-dark-lighter">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xl font-semibold text-white">Upcoming Reminders</CardTitle>
            <Link href="/workflow" className="text-primary text-sm hover:text-primary-hover transition duration-300">
              View All
            </Link>
          </CardHeader>
          <CardContent>
            <ActivityCard activities={reminders} type="reminders" isLoading={isLoading} />
          </CardContent>
        </Card>

        {/* Latest AI Activity */}
        <Card className="bg-dark-light border-dark-lighter">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xl font-semibold text-white">Latest AI Activity</CardTitle>
            <Link href="/due-diligence" className="text-primary text-sm hover:text-primary-hover transition duration-300">
              View All
            </Link>
          </CardHeader>
          <CardContent>
            <ActivityCard activities={activities} type="activities" isLoading={isLoading} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
