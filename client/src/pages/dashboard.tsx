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
  const [stats, setStats] = useState<DashboardStats>({ deals: 0, dueDiligence: 0, memos: 0, investors: 0 });
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState('User');
  const [pendingTasks, setPendingTasks] = useState(0);
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
        
        if (Array.isArray(dealsData)) {
          setDeals(dealsData);
          
          // Calculate real stats from deals data
          const dueDiligenceCount = dealsData.filter((deal: any) => deal.status === 'Due Diligence').length;
          const memosCount = dealsData.filter((deal: any) => deal.status === 'Investment Committee').length;
          const termSheetCount = dealsData.filter((deal: any) => deal.status === 'Term Sheet').length;
          
          const realStats = {
            deals: dealsData.length,
            dueDiligence: dueDiligenceCount,
            memos: memosCount,
            investors: termSheetCount
          };
          setStats(realStats);
          
          // Calculate additional real statistics
          const documentsCount = dealsData.reduce((total: number, deal: any) => 
            total + (deal.documents?.length || 0), 0);
          const recentDeals = dealsData.filter((deal: any) => 
            new Date(deal.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
          
          setRealStats({
            dueDiligenceActive: documentsCount,
            memosDrafts: dealsData.filter((deal: any) => 
              deal.status === 'screening' || deal.status === 'Due Diligence').length,
            investorMatches: dealsData.filter((deal: any) => 
              deal.status === 'Term Sheet' || deal.status === 'Closed').length,
            recentDealsChange: Math.round((recentDeals.length / dealsData.length) * 100)
          });
          
          // Fetch real AI activities from multiple sources
          const activitiesData: Activity[] = [];
          
          for (const deal of dealsData) {
            try {
              // Fetch documents for OCR activities
              const documentsResponse = await fetch(`/api/deals/${deal.id}/documents`);
              const documentsData = await documentsResponse.json();
              
              if (documentsData.success && documentsData.documents) {
                documentsData.documents.forEach((doc: any) => {
                  // Add OCR activity for all processed documents
                  activitiesData.push({
                    id: doc.id * 1000, // Unique ID for OCR activity
                    agentType: 'Mistral OCR',
                    content: `OCR text extraction from ${doc.name} (${(doc.size / 1024).toFixed(1)}KB) - ${deal.companyName}`,
                    timestamp: doc.createdAt
                  });
                  
                  // Add AI summary activity if available
                  if (doc.aiSummary) {
                    activitiesData.push({
                      id: doc.id * 1000 + 1, // Unique ID for summary activity
                      agentType: 'GPT-4 Summary',
                      content: `AI summary generated for ${doc.name} - ${deal.companyName}`,
                      timestamp: doc.updatedAt || doc.createdAt
                    });
                  }
                  
                  // Add document processing activity
                  activitiesData.push({
                    id: doc.id * 1000 + 2, // Unique ID for processing activity
                    agentType: 'Document Processor',
                    content: `Document ${doc.name} processed and indexed - ${deal.companyName}`,
                    timestamp: doc.updatedAt || doc.createdAt
                  });
                });
              }
              
              // Fetch agent analyses for Mistral activities
              const analysesResponse = await fetch(`/api/analyses/${deal.id}`);
              const analysesData = await analysesResponse.json();
              
              if (Array.isArray(analysesData) && analysesData.length > 0) {
                analysesData.forEach((analysis: any) => {
                  activitiesData.push({
                    id: Number(analysis.id),
                    agentType: `${analysis.agentType} Agent`,
                    content: `Specialized ${analysis.agentType.toLowerCase()} analysis completed for ${deal.companyName}`,
                    timestamp: analysis.createdAt || new Date().toISOString()
                  });
                });
              }
              
              // Add AI evaluation activities if deal has evaluation results
              try {
                const evaluationResponse = await fetch(`/api/deals/${deal.id}/evaluation-results`);
                const evaluationData = await evaluationResponse.json();
                
                if (evaluationData.success && evaluationData.results) {
                  activitiesData.push({
                    id: deal.id * 10000, // Unique ID for evaluation
                    agentType: 'AI Evaluator',
                    content: `Investment evaluation completed for ${deal.companyName} (Score: ${deal.aiScore}/100)`,
                    timestamp: evaluationData.results.createdAt || deal.updatedAt
                  });
                }
              } catch (error) {
                // Add basic evaluation activity based on aiScore
                if (deal.aiScore) {
                  activitiesData.push({
                    id: deal.id * 10000,
                    agentType: 'AI Evaluator',
                    content: `Investment scoring completed for ${deal.companyName} (Score: ${deal.aiScore}/100)`,
                    timestamp: deal.updatedAt || deal.createdAt
                  });
                }
              }
            } catch (error) {
              console.log('No AI activities found for deal:', deal.id);
            }
          }
          
          // Sort activities by timestamp and take the latest 5
          activitiesData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setActivities(activitiesData.slice(0, 5));
          
          // Generate real reminders from deals
          const realReminders = dealsData.slice(0, 3).map((deal: any, index: number) => ({
            id: deal.id,
            title: `Review ${deal.companyName}`,
            description: `${deal.status} stage - Follow up required`,
            deadline: new Date(Date.now() + (index + 1) * 86400000).toISOString(),
            type: deal.status === 'Due Diligence' ? 'due-diligence' : 'memo',
            actions: ['Complete', 'Snooze']
          }));
          
          setReminders(realReminders);
          
          // Fetch user information - try multiple endpoints
          try {
            // First try the settings endpoint
            const userResponse = await fetch('/api/settings/user');
            if (userResponse.ok) {
              const userData = await userResponse.json();
              if (userData.success && userData.user) {
                setUserName(userData.user.firstName || userData.user.name || userData.user.username || 'Admin');
              }
            } else {
              // Fallback to auth session endpoint
              const sessionResponse = await fetch('/api/auth/session');
              if (sessionResponse.ok) {
                const sessionData = await sessionResponse.json();
                if (sessionData.authenticated) {
                  setUserName('Admin');
                }
              } else {
                // Default fallback
                setUserName('Admin');
              }
            }
          } catch (error) {
            console.log('Could not fetch user data, using default');
            setUserName('Admin');
          }
          
          // Calculate pending tasks from reminders and deals
          const tasksCount = realReminders.length + dealsData.filter((deal: any) => 
            deal.status === 'screening' || deal.status === 'Due Diligence'
          ).length;
          setPendingTasks(tasksCount);
        }
        
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        
        // Use mock data as fallback
        setDeals(mockDeals);
        setActivities(mockActivities);
        setReminders(mockReminders);
        setStats(mockDashboardStats);
        setUserName('Admin');
        setPendingTasks(3);
        setRealStats({
          dueDiligenceActive: 14,
          memosDrafts: 3,
          investorMatches: 8,
          recentDealsChange: 15
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="w-full h-full bg-dark">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
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
            <Link href="/workflow" className="text-primary text-sm hover:text-primary/80 transition duration-300">
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
            <Link href="/due-diligence" className="text-primary text-sm hover:text-primary/80 transition duration-300">
              View All
            </Link>
          </CardHeader>
          <CardContent>
            <ActivityCard activities={activities} type="activities" isLoading={isLoading} />
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  );
}
