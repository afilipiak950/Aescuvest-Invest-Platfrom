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

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // In a real app, you'd fetch data from your API
        // const response = await fetch('/api/dashboard');
        // const data = await response.json();
        // setStats(data.stats);
        // setDeals(data.deals);
        // setActivities(data.activities);
        // setReminders(data.reminders);
        
        // For demo, we'll just use the mock data and add a delay
        setTimeout(() => {
          setIsLoading(false);
        }, 800);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader 
        title="Dashboard" 
        description="Welcome back, Alex. You have 4 pending tasks."
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
          change="+8%"
          changeText="from last month"
          isLoading={isLoading}
        />
        <StatsCard 
          title="Due Diligence"
          value={stats.dueDiligence}
          icon="Search"
          change="4 active"
          changeText="data rooms"
          isLoading={isLoading}
        />
        <StatsCard 
          title="Investment Memos"
          value={stats.memos}
          icon="FileText"
          change="2 drafts"
          changeText="to review"
          isLoading={isLoading}
        />
        <StatsCard 
          title="Investor Matching"
          value={stats.investors}
          icon="Users"
          change="12 new"
          changeText="matches this week"
          isLoading={isLoading}
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
