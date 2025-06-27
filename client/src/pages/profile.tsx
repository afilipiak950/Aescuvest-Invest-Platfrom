import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/layout/page-header';
import { 
  User, 
  Mail, 
  Calendar, 
  Clock, 
  TrendingUp, 
  FileText, 
  Users, 
  DollarSign,
  Activity,
  Settings,
  Eye,
  Download,
  Star,
  Upload,
  BarChart3,
  Zap,
  Brain,
  Moon,
  MessageCircle,
  Flame,
  Shield,
  Lightbulb,
  Trophy,
  Target,
  Rocket,
  Crown,
  Diamond,
  Sparkles,
  Award,
  Medal,
  Gem,
  Puzzle,
  Layers,
  Gauge,
  Timer,
  Compass,
  Telescope,
  Workflow,
  Network,
  Briefcase,
  FileSearch
} from 'lucide-react';

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState('overview');

  // User profile query
  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['/api/auth/user'],
  });

  // User activities query
  const { data: userActivities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['/api/user/activities'],
  });

  // User stats query
  const { data: userStats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/user/stats'],
  });

  // Calculate achievements based on real user statistics
  const achievements = useMemo(() => {
    const stats = userStats as any;
    if (!stats) return [];

    return [
      // Performance Achievements
      {
        id: 'deal_master',
        title: 'Deal Master',
        description: 'Review 50+ investment deals',
        icon: Trophy,
        category: 'performance',
        target: 50,
        current: stats.dealsReviewed || 0,
        progress: Math.min(100, Math.round(((stats.dealsReviewed || 0) / 50) * 100)),
        achieved: (stats.dealsReviewed || 0) >= 50,
        points: 100,
        rarity: 'epic',
        unlockedAt: (stats.dealsReviewed || 0) >= 50 ? new Date().toISOString() : null
      },
      {
        id: 'memo_expert',
        title: 'Memo Expert',
        description: 'Generate 25+ investment memos',
        icon: FileSearch,
        category: 'performance',
        target: 25,
        current: stats.memosGenerated || 0,
        progress: Math.min(100, Math.round(((stats.memosGenerated || 0) / 25) * 100)),
        achieved: (stats.memosGenerated || 0) >= 25,
        points: 75,
        rarity: 'rare',
        unlockedAt: (stats.memosGenerated || 0) >= 25 ? new Date().toISOString() : null
      },
      {
        id: 'perfect_match',
        title: 'Perfect Match',
        description: 'Make 10+ successful investor matches',
        icon: Network,
        category: 'performance',
        target: 10,
        current: stats.investorMatches || 0,
        progress: Math.min(100, Math.round(((stats.investorMatches || 0) / 10) * 100)),
        achieved: (stats.investorMatches || 0) >= 10,
        points: 50,
        rarity: 'uncommon',
        unlockedAt: (stats.investorMatches || 0) >= 10 ? new Date().toISOString() : null
      },
      {
        id: 'analysis_guru',
        title: 'Analysis Guru',
        description: 'Complete 100+ document summaries',
        icon: Puzzle,
        category: 'performance',
        target: 100,
        current: stats.documentsSummarized || 0,
        progress: Math.min(100, Math.round(((stats.documentsSummarized || 0) / 100) * 100)),
        achieved: (stats.documentsSummarized || 0) >= 100,
        points: 150,
        rarity: 'legendary',
        unlockedAt: (stats.documentsSummarized || 0) >= 100 ? new Date().toISOString() : null
      },
      // Efficiency Achievements
      {
        id: 'workflow_wizard',
        title: 'Workflow Wizard',
        description: 'Create 5+ automation workflows',
        icon: Workflow,
        category: 'efficiency',
        target: 5,
        current: stats.automationsCreated || 0,
        progress: Math.min(100, Math.round(((stats.automationsCreated || 0) / 5) * 100)),
        achieved: (stats.automationsCreated || 0) >= 5,
        points: 60,
        rarity: 'rare',
        unlockedAt: (stats.automationsCreated || 0) >= 5 ? new Date().toISOString() : null
      },
      {
        id: 'speed_demon',
        title: 'Speed Demon',
        description: 'Process 20+ deals in one day',
        icon: Rocket,
        category: 'efficiency',
        target: 20,
        current: stats.maxDealsPerDay || 0,
        progress: Math.min(100, Math.round(((stats.maxDealsPerDay || 0) / 20) * 100)),
        achieved: (stats.maxDealsPerDay || 0) >= 20,
        points: 80,
        rarity: 'epic',
        unlockedAt: (stats.maxDealsPerDay || 0) >= 20 ? new Date().toISOString() : null
      },
      {
        id: 'night_owl',
        title: 'Night Owl',
        description: 'Work sessions after 10 PM',
        icon: Moon,
        category: 'efficiency',
        target: 10,
        current: stats.nightSessions || 0,
        progress: Math.min(100, Math.round(((stats.nightSessions || 0) / 10) * 100)),
        achieved: (stats.nightSessions || 0) >= 10,
        points: 40,
        rarity: 'common',
        unlockedAt: (stats.nightSessions || 0) >= 10 ? new Date().toISOString() : null
      },
      // Milestone Achievements
      {
        id: 'early_adopter',
        title: 'Early Adopter',
        description: 'First week platform user',
        icon: Sparkles,
        category: 'milestone',
        target: 1,
        current: 1,
        progress: 100,
        achieved: true,
        points: 25,
        rarity: 'common',
        unlockedAt: new Date().toISOString()
      },
      {
        id: 'data_explorer',
        title: 'Data Explorer',
        description: 'Export 20+ reports',
        icon: Compass,
        category: 'milestone',
        target: 20,
        current: stats.reportsExported || 0,
        progress: Math.min(100, Math.round(((stats.reportsExported || 0) / 20) * 100)),
        achieved: (stats.reportsExported || 0) >= 20,
        points: 35,
        rarity: 'uncommon',
        unlockedAt: (stats.reportsExported || 0) >= 20 ? new Date().toISOString() : null
      },
      {
        id: 'social_butterfly',
        title: 'Social Butterfly',
        description: 'Connect with 50+ investors',
        icon: Briefcase,
        category: 'milestone',
        target: 50,
        current: stats.investorConnections || 0,
        progress: Math.min(100, Math.round(((stats.investorConnections || 0) / 50) * 100)),
        achieved: (stats.investorConnections || 0) >= 50,
        points: 70,
        rarity: 'rare',
        unlockedAt: (stats.investorConnections || 0) >= 50 ? new Date().toISOString() : null
      },
      // Special Achievements
      {
        id: 'streak_master',
        title: 'Streak Master',
        description: 'Maintain 30-day login streak',
        icon: Flame,
        category: 'special',
        target: 30,
        current: stats.currentStreak || 0,
        progress: Math.min(100, Math.round(((stats.currentStreak || 0) / 30) * 100)),
        achieved: (stats.currentStreak || 0) >= 30,
        points: 120,
        rarity: 'epic',
        unlockedAt: (stats.currentStreak || 0) >= 30 ? new Date().toISOString() : null
      },
      {
        id: 'quality_assurance',
        title: 'Quality Assurance',
        description: 'Maintain 95%+ accuracy rating',
        icon: Diamond,
        category: 'special',
        target: 95,
        current: stats.accuracyRating || 0,
        progress: Math.min(100, Math.round(((stats.accuracyRating || 0) / 95) * 100)),
        achieved: (stats.accuracyRating || 0) >= 95,
        points: 200,
        rarity: 'legendary',
        unlockedAt: (stats.accuracyRating || 0) >= 95 ? new Date().toISOString() : null
      },
      {
        id: 'innovation_champion',
        title: 'Innovation Champion',
        description: 'Discover cutting-edge startups',
        icon: Telescope,
        category: 'special',
        target: 5,
        current: stats.innovativeDeals || 0,
        progress: Math.min(100, Math.round(((stats.innovativeDeals || 0) / 5) * 100)),
        achieved: (stats.innovativeDeals || 0) >= 5,
        points: 180,
        rarity: 'legendary',
        unlockedAt: (stats.innovativeDeals || 0) >= 5 ? new Date().toISOString() : null
      }
    ];
  }, [userStats]);

  // Group achievements by category
  const achievementCategories = useMemo(() => {
    return achievements.reduce((acc: any, achievement: any) => {
      if (!acc[achievement.category]) {
        acc[achievement.category] = [];
      }
      acc[achievement.category].push(achievement);
      return acc;
    }, {});
  }, [achievements]);

  // Group activities by date - must be before any conditional returns
  const groupedActivities = useMemo(() => {
    if (!userActivities || !(userActivities as any)?.reduce) return [];

    const grouped = (userActivities as any).reduce((acc: any, activity: any) => {
      const activityDate = new Date(activity.createdAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let dateLabel;
      if (activityDate.toDateString() === today.toDateString()) {
        dateLabel = 'Today';
      } else if (activityDate.toDateString() === yesterday.toDateString()) {
        dateLabel = 'Yesterday';
      } else {
        const daysAgo = Math.floor((today.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysAgo <= 7) {
          dateLabel = `${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`;
        } else {
          dateLabel = activityDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: activityDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
          });
        }
      }

      const timeString = activityDate.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });

      const existingDate = acc.find((item: any) => item.date === dateLabel);
      if (existingDate) {
        existingDate.activities.push({
          time: timeString,
          action: activity.actionDescription,
          type: activity.activityType,
          targetName: activity.targetName,
          metadata: activity.metadata
        });
      } else {
        acc.push({
          date: dateLabel,
          activities: [{
            time: timeString,
            action: activity.actionDescription,
            type: activity.activityType,
            targetName: activity.targetName,
            metadata: activity.metadata
          }]
        });
      }
      return acc;
    }, []);

    // Sort activities within each day by time (newest first)
    grouped.forEach((day: any) => {
      day.activities.sort((a: any, b: any) => b.time.localeCompare(a.time));
    });

    return grouped;
  }, [userActivities]);

  if (profileLoading || activitiesLoading || statsLoading) {
    return (
      <div className="min-h-screen bg-dark text-white">
        <div className="container mx-auto px-4 py-6">
          <PageHeader
            title="Profile"
            description="View your account information and activity"
          />
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-dark-light border-dark-lighter">
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-dark-lighter rounded w-1/4"></div>
                    <div className="h-8 bg-dark-lighter rounded w-1/2"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const userName = (userProfile as any)?.firstName && (userProfile as any)?.lastName 
    ? `${(userProfile as any).firstName} ${(userProfile as any).lastName}` 
    : (userProfile as any)?.username || 'User';
  const userEmail = (userProfile as any)?.email || 'user@aescuvest.vc';

  return (
    <div className="min-h-screen bg-dark text-white">
      <div className="container mx-auto px-4 py-6">
        <PageHeader
          title="Profile"
          description="View your account information and activity"
        />

        {/* Profile Header */}
        <Card className="bg-dark-light border-dark-lighter mb-6">
          <CardContent className="p-6">
            <div className="flex items-start gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={(userProfile as any)?.profileImage} alt={userName} />
                <AvatarFallback className="bg-primary text-dark font-semibold text-lg">
                  {getInitials(userName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h1 className="text-2xl font-bold text-white">{userName}</h1>
                  <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
                    Admin
                  </Badge>
                </div>
                <div className="space-y-2 text-gray-400">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span>{userEmail}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Member since {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>Last active: {new Date().toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <Button variant="outline" className="border-dark-lighter">
                <Settings className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-dark-light border border-dark-lighter">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="achievements" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              Achievements
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-dark-light border-dark-lighter">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Deals Reviewed</p>
                      <p className="text-2xl font-bold text-white">{(userStats as any)?.dealsReviewed || 0}</p>
                    </div>
                    <div className="h-10 w-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <Eye className="h-5 w-5 text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-dark-light border-dark-lighter">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Memos Generated</p>
                      <p className="text-2xl font-bold text-white">{(userStats as any)?.memosGenerated || 0}</p>
                    </div>
                    <div className="h-10 w-10 bg-green-500/20 rounded-full flex items-center justify-center">
                      <FileText className="h-5 w-5 text-green-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-dark-light border-dark-lighter">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Matches Made</p>
                      <p className="text-2xl font-bold text-white">{(userStats as any)?.matchesCreated || 0}</p>
                    </div>
                    <div className="h-10 w-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                      <Users className="h-5 w-5 text-purple-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-dark-light border-dark-lighter">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Documents Uploaded</p>
                      <p className="text-2xl font-bold text-white">{(userStats as any)?.documentsUploaded || 0}</p>
                    </div>
                    <div className="h-10 w-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-yellow-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card className="bg-dark-light border-dark-lighter">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Your latest actions on the platform</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(userActivities as any)?.slice(0, 4).map((activity: any, index: number) => {
                    const getActivityIcon = (type: string) => {
                      switch (type) {
                        case 'deal_view': return Eye;
                        case 'memo_generate': return FileText;
                        case 'match_create': return Users;
                        case 'deal_update': return TrendingUp;
                        case 'document_upload': return Upload;
                        case 'analysis_run': return BarChart3;
                        case 'workflow_create': return Zap;
                        case 'report_export': return Download;
                        default: return Activity;
                      }
                    };
                    
                    const Icon = getActivityIcon(activity.activityType);
                    const timeAgo = new Date(activity.createdAt).toLocaleString();
                    
                    return (
                      <div key={activity.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-dark/50 transition-colors">
                        <div className="h-8 w-8 bg-primary/20 rounded-full flex items-center justify-center">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-white">{activity.actionDescription}</p>
                          <p className="text-xs text-gray-400">{timeAgo}</p>
                        </div>
                      </div>
                    );
                  }) || (
                    <div className="text-center text-gray-400 py-8">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No recent activity found</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <Card className="bg-dark-light border-dark-lighter">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Activity Timeline
                </CardTitle>
                <CardDescription>Detailed history of your platform interactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {groupedActivities.map((day: any, dayIndex: number) => (
                    <div key={dayIndex}>
                      <h4 className="text-sm font-medium text-gray-300 mb-3">{day.date}</h4>
                      <div className="space-y-2 ml-4 border-l border-dark-lighter pl-4">
                        {day.activities.map((activity: any, actIndex: number) => (
                          <div key={actIndex} className="space-y-2 p-3 bg-dark-lighter/50 rounded-lg border border-dark-lighter">
                            <div className="flex items-start gap-3">
                              <span className="text-gray-400 text-xs min-w-[50px] mt-1">{activity.time}</span>
                              <div className="h-2 w-2 bg-primary rounded-full mt-2"></div>
                              <div className="flex-1 space-y-1">
                                <div className="text-gray-300 font-medium">{activity.action}</div>
                                {activity.targetName && (
                                  <div className="text-xs text-gray-400">
                                    <span className="text-primary">Target:</span> {activity.targetName}
                                  </div>
                                )}
                                <div className="text-xs text-gray-500">
                                  <span className="text-primary">Type:</span> {activity.type}
                                </div>
                                {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                                  <div className="text-xs text-gray-500 bg-dark-lighter/50 p-2 rounded border">
                                    <div className="text-primary mb-1">Metadata:</div>
                                    {Object.entries(activity.metadata).map(([key, value]) => (
                                      <div key={key} className="flex justify-between">
                                        <span className="text-gray-400">{key}:</span>
                                        <span className="text-gray-300">{JSON.stringify(value)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="achievements" className="space-y-6">
            {/* Achievement Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card className="bg-gradient-to-r from-primary/20 to-primary/10 border-primary/30">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{achievements.filter(a => a.achieved).length}</div>
                  <div className="text-sm text-gray-300">Unlocked</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-r from-yellow-500/20 to-yellow-500/10 border-yellow-500/30">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-400">{achievements.filter(a => !a.achieved && a.progress >= 75).length}</div>
                  <div className="text-sm text-gray-300">Almost There</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-r from-blue-500/20 to-blue-500/10 border-blue-500/30">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400">{Math.round(achievements.reduce((acc, a) => acc + a.progress, 0) / achievements.length)}%</div>
                  <div className="text-sm text-gray-300">Avg Progress</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-r from-purple-500/20 to-purple-500/10 border-purple-500/30">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-purple-400">{achievements.reduce((acc, a) => acc + (a.achieved ? a.points : 0), 0)}</div>
                  <div className="text-sm text-gray-300">Total Points</div>
                </CardContent>
              </Card>
            </div>

            {/* Achievement Categories */}
            <div className="space-y-8">
              {Object.entries(achievementCategories).map(([category, categoryAchievements]) => (
                <div key={category} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-white capitalize">{category} Achievements</h3>
                    <Badge variant="outline" className="text-xs">
                      {(categoryAchievements as any).filter((a: any) => a.achieved).length}/{(categoryAchievements as any).length}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(categoryAchievements as any).map((achievement: any, index: number) => {
                      const Icon = achievement.icon;
                      return (
                        <Card key={index} className={`bg-dark-light border-dark-lighter ${achievement.achieved ? 'ring-1 ring-primary/50' : ''}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                achievement.achieved 
                                  ? 'bg-primary text-dark' 
                                  : 'bg-gray-600/20 text-gray-400'
                              }`}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium text-white">{achievement.title}</h4>
                                  {achievement.achieved && (
                                    <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30 text-xs">
                                      Achieved
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-400 mb-2">{achievement.description}</p>
                                
                                {/* Achievement Details */}
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-400">Progress: {achievement.current}/{achievement.target}</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-gray-400">{achievement.progress}%</span>
                                      <Badge 
                                        variant="outline" 
                                        className={`text-xs px-1 py-0.5 ${
                                          achievement.rarity === 'legendary' ? 'border-yellow-500 text-yellow-400' :
                                          achievement.rarity === 'epic' ? 'border-purple-500 text-purple-400' :
                                          achievement.rarity === 'rare' ? 'border-blue-500 text-blue-400' :
                                          achievement.rarity === 'uncommon' ? 'border-green-500 text-green-400' :
                                          'border-gray-500 text-gray-400'
                                        }`}
                                      >
                                        {achievement.rarity}
                                      </Badge>
                                    </div>
                                  </div>
                                  
                                  <div className="w-full bg-dark-lighter rounded-full h-2">
                                    <div 
                                      className={`h-2 rounded-full transition-all duration-300 ${
                                        achievement.achieved 
                                          ? achievement.rarity === 'legendary' ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                                            achievement.rarity === 'epic' ? 'bg-gradient-to-r from-purple-500 to-purple-400' :
                                            achievement.rarity === 'rare' ? 'bg-gradient-to-r from-blue-500 to-blue-400' :
                                            achievement.rarity === 'uncommon' ? 'bg-gradient-to-r from-green-500 to-green-400' :
                                            'bg-primary'
                                          : 'bg-gray-600'
                                      }`}
                                      style={{ width: `${achievement.progress}%` }}
                                    ></div>
                                  </div>
                                  
                                  {achievement.achieved && achievement.unlockedAt && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      Unlocked: {new Date(achievement.unlockedAt).toLocaleDateString()}
                                    </div>
                                  )}
                                  
                                  {!achievement.achieved && achievement.progress >= 75 && (
                                    <div className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                                      <Zap className="h-3 w-3" />
                                      Almost there! {achievement.target - achievement.current} more to go
                                    </div>
                                  )}
                                  
                                  <div className="text-xs text-gray-500">
                                    Reward: {achievement.points} points
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}