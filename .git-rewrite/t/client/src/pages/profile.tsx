import { useState } from 'react';
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
  Star
} from 'lucide-react';

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState('overview');

  // User profile query
  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['/api/auth/user'],
  });

  // User activity query
  const { data: userActivity, isLoading: activityLoading } = useQuery({
    queryKey: ['/api/user/activity'],
  });

  // User stats query
  const { data: userStats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/user/stats'],
  });

  if (profileLoading || activityLoading || statsLoading) {
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

  const userName = userProfile?.username || 'Admin User';
  const userEmail = userProfile?.email || 'admin@aescuvest.vc';

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
                <AvatarImage src={userProfile?.profileImage} alt={userName} />
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
                      <p className="text-2xl font-bold text-white">{userStats?.dealsReviewed || 47}</p>
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
                      <p className="text-2xl font-bold text-white">{userStats?.memosGenerated || 23}</p>
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
                      <p className="text-2xl font-bold text-white">{userStats?.matchesMade || 12}</p>
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
                      <p className="text-sm text-gray-400">Total Value</p>
                      <p className="text-2xl font-bold text-white">€{userStats?.totalValue || '15.2M'}</p>
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
                  {[
                    {
                      action: 'Reviewed Tesla deal',
                      time: '2 hours ago',
                      type: 'review',
                      icon: Eye
                    },
                    {
                      action: 'Generated investment memo for SpaceX',
                      time: '4 hours ago',
                      type: 'memo',
                      icon: FileText
                    },
                    {
                      action: 'Matched Neuralink with Sequoia Capital',
                      time: '1 day ago',
                      type: 'match',
                      icon: Users
                    },
                    {
                      action: 'Updated deal status for Anthropic',
                      time: '2 days ago',
                      type: 'update',
                      icon: TrendingUp
                    }
                  ].map((activity, index) => {
                    const Icon = activity.icon;
                    return (
                      <div key={index} className="flex items-center gap-3 p-3 rounded-lg hover:bg-dark/50 transition-colors">
                        <div className="h-8 w-8 bg-primary/20 rounded-full flex items-center justify-center">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-white">{activity.action}</p>
                          <p className="text-xs text-gray-400">{activity.time}</p>
                        </div>
                      </div>
                    );
                  })}
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
                  {[
                    {
                      date: 'Today',
                      activities: [
                        { time: '14:30', action: 'Reviewed Tesla deal documentation', type: 'review' },
                        { time: '12:15', action: 'Generated investment memo for SpaceX Series B', type: 'memo' },
                        { time: '09:45', action: 'Updated pipeline stage for 3 deals', type: 'update' }
                      ]
                    },
                    {
                      date: 'Yesterday',
                      activities: [
                        { time: '16:20', action: 'Matched Neuralink with 2 potential investors', type: 'match' },
                        { time: '14:10', action: 'Completed due diligence for Anthropic', type: 'review' },
                        { time: '11:30', action: 'Uploaded 5 new deal documents', type: 'upload' }
                      ]
                    },
                    {
                      date: '2 days ago',
                      activities: [
                        { time: '15:45', action: 'Created new automation workflow', type: 'automation' },
                        { time: '13:20', action: 'Exported investor matching report', type: 'export' },
                        { time: '10:15', action: 'Updated system settings', type: 'settings' }
                      ]
                    }
                  ].map((day, dayIndex) => (
                    <div key={dayIndex}>
                      <h4 className="text-sm font-medium text-gray-300 mb-3">{day.date}</h4>
                      <div className="space-y-2 ml-4 border-l border-dark-lighter pl-4">
                        {day.activities.map((activity, actIndex) => (
                          <div key={actIndex} className="flex items-center gap-3 text-sm">
                            <span className="text-gray-400 min-w-[50px]">{activity.time}</span>
                            <div className="h-2 w-2 bg-primary rounded-full"></div>
                            <span className="text-gray-300">{activity.action}</span>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: 'Deal Master',
                  description: 'Reviewed 50+ deals',
                  icon: Eye,
                  progress: 94,
                  achieved: false
                },
                {
                  title: 'Memo Expert',
                  description: 'Generated 25+ investment memos',
                  icon: FileText,
                  progress: 92,
                  achieved: false
                },
                {
                  title: 'Perfect Match',
                  description: 'Made 10+ successful investor matches',
                  icon: Users,
                  progress: 100,
                  achieved: true
                },
                {
                  title: 'Early Adopter',
                  description: 'First week platform user',
                  icon: Star,
                  progress: 100,
                  achieved: true
                },
                {
                  title: 'Workflow Wizard',
                  description: 'Created 5+ automation workflows',
                  icon: Activity,
                  progress: 60,
                  achieved: false
                },
                {
                  title: 'Data Explorer',
                  description: 'Exported 20+ reports',
                  icon: Download,
                  progress: 35,
                  achieved: false
                }
              ].map((achievement, index) => {
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
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Progress</span>
                              <span className="text-gray-400">{achievement.progress}%</span>
                            </div>
                            <div className="w-full bg-dark-lighter rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full ${
                                  achievement.achieved ? 'bg-primary' : 'bg-gray-600'
                                }`}
                                style={{ width: `${achievement.progress}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}