import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    bio: '',
    title: '',
    company: '',
    location: '',
    phone: '',
    linkedin: '',
    twitter: '',
    website: '',
    timezone: '',
    language: '',
    avatar: '',
    notifications: {
      email: true,
      browser: true,
      deals: true,
      matches: true,
      reports: true
    },
    privacy: {
      showEmail: false,
      showPhone: false,
      publicProfile: true
    }
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/settings/user', {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setIsEditDialogOpen(false);
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

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

  // Initialize form with user data
  useEffect(() => {
    if (userProfile) {
      setProfileForm({
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || '',
        email: userProfile.email || '',
        bio: userProfile.bio || '',
        title: userProfile.title || '',
        company: userProfile.company || '',
        location: userProfile.location || '',
        phone: userProfile.phone || '',
        linkedin: userProfile.linkedin || '',
        twitter: userProfile.twitter || '',
        website: userProfile.website || '',
        timezone: userProfile.timezone || 'UTC',
        language: userProfile.language || 'en',
        avatar: userProfile.avatar || '',
        notifications: {
          email: userProfile.notifications?.email ?? true,
          browser: userProfile.notifications?.browser ?? true,
          deals: userProfile.notifications?.deals ?? true,
          matches: userProfile.notifications?.matches ?? true,
          reports: userProfile.notifications?.reports ?? true
        },
        privacy: {
          showEmail: userProfile.privacy?.showEmail ?? false,
          showPhone: userProfile.privacy?.showPhone ?? false,
          publicProfile: userProfile.privacy?.publicProfile ?? true
        }
      });
    }
  }, [userProfile]);

  // Form handlers
  const handleInputChange = (field: string, value: any) => {
    setProfileForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNestedChange = (section: string, field: string, value: any) => {
    setProfileForm(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [field]: value
      }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(profileForm);
  };

  const handleDialogClose = () => {
    setIsEditDialogOpen(false);
    // Reset form to original values
    if (userProfile) {
      setProfileForm({
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || '',
        email: userProfile.email || '',
        bio: userProfile.bio || '',
        title: userProfile.title || '',
        company: userProfile.company || '',
        location: userProfile.location || '',
        phone: userProfile.phone || '',
        linkedin: userProfile.linkedin || '',
        twitter: userProfile.twitter || '',
        website: userProfile.website || '',
        timezone: userProfile.timezone || 'UTC',
        language: userProfile.language || 'en',
        avatar: userProfile.avatar || '',
        notifications: {
          email: userProfile.notifications?.email ?? true,
          browser: userProfile.notifications?.browser ?? true,
          deals: userProfile.notifications?.deals ?? true,
          matches: userProfile.notifications?.matches ?? true,
          reports: userProfile.notifications?.reports ?? true
        },
        privacy: {
          showEmail: userProfile.privacy?.showEmail ?? false,
          showPhone: userProfile.privacy?.showPhone ?? false,
          publicProfile: userProfile.privacy?.publicProfile ?? true
        }
      });
    }
  };

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
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-dark-lighter">
                    <Settings className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-dark border-dark-lighter">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-white">
                      <Settings className="h-5 w-5" />
                      Edit Profile
                    </DialogTitle>
                  </DialogHeader>
                  
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <Tabs defaultValue="personal" className="w-full">
                      <TabsList className="grid w-full grid-cols-4 bg-dark-light border border-dark-lighter">
                        <TabsTrigger value="personal">Personal</TabsTrigger>
                        <TabsTrigger value="professional">Professional</TabsTrigger>
                        <TabsTrigger value="social">Social</TabsTrigger>
                        <TabsTrigger value="preferences">Preferences</TabsTrigger>
                      </TabsList>

                      <TabsContent value="personal" className="space-y-4 mt-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="firstName" className="text-white">First Name</Label>
                            <Input
                              id="firstName"
                              value={profileForm.firstName}
                              onChange={(e) => handleInputChange('firstName', e.target.value)}
                              className="bg-dark-light border-dark-lighter text-white"
                              placeholder="Enter your first name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="lastName" className="text-white">Last Name</Label>
                            <Input
                              id="lastName"
                              value={profileForm.lastName}
                              onChange={(e) => handleInputChange('lastName', e.target.value)}
                              className="bg-dark-light border-dark-lighter text-white"
                              placeholder="Enter your last name"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-white">Email Address</Label>
                          <Input
                            id="email"
                            type="email"
                            value={profileForm.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            className="bg-dark-light border-dark-lighter text-white"
                            placeholder="Enter your email address"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="phone" className="text-white">Phone Number</Label>
                            <Input
                              id="phone"
                              value={profileForm.phone}
                              onChange={(e) => handleInputChange('phone', e.target.value)}
                              className="bg-dark-light border-dark-lighter text-white"
                              placeholder="Enter your phone number"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="location" className="text-white">Location</Label>
                            <Input
                              id="location"
                              value={profileForm.location}
                              onChange={(e) => handleInputChange('location', e.target.value)}
                              className="bg-dark-light border-dark-lighter text-white"
                              placeholder="Enter your location"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="bio" className="text-white">Bio</Label>
                          <Textarea
                            id="bio"
                            value={profileForm.bio}
                            onChange={(e) => handleInputChange('bio', e.target.value)}
                            className="bg-dark-light border-dark-lighter text-white min-h-[100px]"
                            placeholder="Tell us about yourself"
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="professional" className="space-y-4 mt-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="title" className="text-white">Job Title</Label>
                            <Input
                              id="title"
                              value={profileForm.title}
                              onChange={(e) => handleInputChange('title', e.target.value)}
                              className="bg-dark-light border-dark-lighter text-white"
                              placeholder="Enter your job title"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="company" className="text-white">Company</Label>
                            <Input
                              id="company"
                              value={profileForm.company}
                              onChange={(e) => handleInputChange('company', e.target.value)}
                              className="bg-dark-light border-dark-lighter text-white"
                              placeholder="Enter your company"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="website" className="text-white">Website</Label>
                          <Input
                            id="website"
                            type="url"
                            value={profileForm.website}
                            onChange={(e) => handleInputChange('website', e.target.value)}
                            className="bg-dark-light border-dark-lighter text-white"
                            placeholder="https://your-website.com"
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="social" className="space-y-4 mt-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="linkedin" className="text-white">LinkedIn Profile</Label>
                            <Input
                              id="linkedin"
                              value={profileForm.linkedin}
                              onChange={(e) => handleInputChange('linkedin', e.target.value)}
                              className="bg-dark-light border-dark-lighter text-white"
                              placeholder="https://linkedin.com/in/username"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="twitter" className="text-white">Twitter Profile</Label>
                            <Input
                              id="twitter"
                              value={profileForm.twitter}
                              onChange={(e) => handleInputChange('twitter', e.target.value)}
                              className="bg-dark-light border-dark-lighter text-white"
                              placeholder="https://twitter.com/username"
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-sm font-medium text-white">Privacy Settings</h4>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="showEmail" className="text-white">Show Email Publicly</Label>
                              <Switch
                                id="showEmail"
                                checked={profileForm.privacy.showEmail}
                                onCheckedChange={(checked) => handleNestedChange('privacy', 'showEmail', checked)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="showPhone" className="text-white">Show Phone Publicly</Label>
                              <Switch
                                id="showPhone"
                                checked={profileForm.privacy.showPhone}
                                onCheckedChange={(checked) => handleNestedChange('privacy', 'showPhone', checked)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="publicProfile" className="text-white">Public Profile</Label>
                              <Switch
                                id="publicProfile"
                                checked={profileForm.privacy.publicProfile}
                                onCheckedChange={(checked) => handleNestedChange('privacy', 'publicProfile', checked)}
                              />
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="preferences" className="space-y-4 mt-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="timezone" className="text-white">Timezone</Label>
                            <Select value={profileForm.timezone} onValueChange={(value) => handleInputChange('timezone', value)}>
                              <SelectTrigger className="bg-dark-light border-dark-lighter text-white">
                                <SelectValue placeholder="Select timezone" />
                              </SelectTrigger>
                              <SelectContent className="bg-dark border-dark-lighter">
                                <SelectItem value="UTC">UTC</SelectItem>
                                <SelectItem value="America/New_York">Eastern Time</SelectItem>
                                <SelectItem value="America/Chicago">Central Time</SelectItem>
                                <SelectItem value="America/Denver">Mountain Time</SelectItem>
                                <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                                <SelectItem value="Europe/London">London</SelectItem>
                                <SelectItem value="Europe/Paris">Paris</SelectItem>
                                <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                                <SelectItem value="Asia/Shanghai">Shanghai</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="language" className="text-white">Language</Label>
                            <Select value={profileForm.language} onValueChange={(value) => handleInputChange('language', value)}>
                              <SelectTrigger className="bg-dark-light border-dark-lighter text-white">
                                <SelectValue placeholder="Select language" />
                              </SelectTrigger>
                              <SelectContent className="bg-dark border-dark-lighter">
                                <SelectItem value="en">English</SelectItem>
                                <SelectItem value="es">Spanish</SelectItem>
                                <SelectItem value="fr">French</SelectItem>
                                <SelectItem value="de">German</SelectItem>
                                <SelectItem value="zh">Chinese</SelectItem>
                                <SelectItem value="ja">Japanese</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-sm font-medium text-white">Notification Preferences</h4>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="emailNotifications" className="text-white">Email Notifications</Label>
                              <Switch
                                id="emailNotifications"
                                checked={profileForm.notifications.email}
                                onCheckedChange={(checked) => handleNestedChange('notifications', 'email', checked)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="browserNotifications" className="text-white">Browser Notifications</Label>
                              <Switch
                                id="browserNotifications"
                                checked={profileForm.notifications.browser}
                                onCheckedChange={(checked) => handleNestedChange('notifications', 'browser', checked)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="dealNotifications" className="text-white">Deal Updates</Label>
                              <Switch
                                id="dealNotifications"
                                checked={profileForm.notifications.deals}
                                onCheckedChange={(checked) => handleNestedChange('notifications', 'deals', checked)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="matchNotifications" className="text-white">Match Notifications</Label>
                              <Switch
                                id="matchNotifications"
                                checked={profileForm.notifications.matches}
                                onCheckedChange={(checked) => handleNestedChange('notifications', 'matches', checked)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="reportNotifications" className="text-white">Report Updates</Label>
                              <Switch
                                id="reportNotifications"
                                checked={profileForm.notifications.reports}
                                onCheckedChange={(checked) => handleNestedChange('notifications', 'reports', checked)}
                              />
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>

                    <div className="flex justify-end gap-3 pt-4 border-t border-dark-lighter">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleDialogClose}
                        className="border-dark-lighter text-gray-300 hover:text-white"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={updateProfileMutation.isPending}
                        className="bg-primary hover:bg-primary-hover text-dark"
                      >
                        {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
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
                        <Card key={index} className={`relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl group ${
                          achievement.achieved 
                            ? achievement.rarity === 'legendary' 
                              ? 'bg-gradient-to-br from-yellow-500/20 via-yellow-600/10 to-amber-500/5 border-yellow-500/40 shadow-yellow-500/20' 
                              : achievement.rarity === 'epic' 
                              ? 'bg-gradient-to-br from-purple-500/20 via-purple-600/10 to-violet-500/5 border-purple-500/40 shadow-purple-500/20'
                              : achievement.rarity === 'rare' 
                              ? 'bg-gradient-to-br from-blue-500/20 via-blue-600/10 to-cyan-500/5 border-blue-500/40 shadow-blue-500/20'
                              : achievement.rarity === 'uncommon' 
                              ? 'bg-gradient-to-br from-green-500/20 via-green-600/10 to-emerald-500/5 border-green-500/40 shadow-green-500/20'
                              : 'bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border-primary/40 shadow-primary/20'
                            : 'bg-dark-light border-dark-lighter hover:border-gray-600'
                        }`}>
                          {achievement.achieved && achievement.rarity === 'legendary' && (
                            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-yellow-400/30 to-transparent rounded-bl-full"></div>
                          )}
                          {achievement.achieved && achievement.rarity === 'epic' && (
                            <div className="absolute top-0 right-0 w-12 h-12 bg-gradient-to-bl from-purple-400/30 to-transparent rounded-bl-full"></div>
                          )}
                          <CardContent className="p-5">
                            <div className="flex items-start gap-4">
                              <div className={`relative h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${
                                achievement.achieved 
                                  ? achievement.rarity === 'legendary' 
                                    ? 'bg-gradient-to-br from-yellow-500 to-yellow-400 text-dark shadow-lg shadow-yellow-500/30' 
                                    : achievement.rarity === 'epic' 
                                    ? 'bg-gradient-to-br from-purple-500 to-purple-400 text-white shadow-lg shadow-purple-500/30'
                                    : achievement.rarity === 'rare' 
                                    ? 'bg-gradient-to-br from-blue-500 to-blue-400 text-white shadow-lg shadow-blue-500/30'
                                    : achievement.rarity === 'uncommon' 
                                    ? 'bg-gradient-to-br from-green-500 to-green-400 text-white shadow-lg shadow-green-500/30'
                                    : 'bg-gradient-to-br from-primary to-primary-hover text-dark shadow-lg shadow-primary/30'
                                  : 'bg-gray-700/50 text-gray-400 group-hover:bg-gray-600/50'
                              }`}>
                                <Icon className="h-6 w-6 relative z-10" />
                                {achievement.achieved && (
                                  <div className="absolute inset-0 bg-white/20 rounded-xl animate-pulse"></div>
                                )}
                                {achievement.rarity === 'legendary' && achievement.achieved && (
                                  <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-yellow-300 animate-pulse" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-semibold text-white text-base group-hover:text-primary transition-colors">{achievement.title}</h4>
                                  {achievement.achieved && (
                                    <div className="flex items-center gap-1">
                                      <Badge 
                                        variant="secondary" 
                                        className={`text-xs font-medium ${
                                          achievement.rarity === 'legendary' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                                          achievement.rarity === 'epic' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                                          achievement.rarity === 'rare' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                          achievement.rarity === 'uncommon' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                          'bg-primary/20 text-primary border-primary/30'
                                        }`}
                                      >
                                        ✓ Achieved
                                      </Badge>
                                      {achievement.rarity === 'legendary' && <Crown className="h-3 w-3 text-yellow-400" />}
                                      {achievement.rarity === 'epic' && <Gem className="h-3 w-3 text-purple-400" />}
                                      {achievement.rarity === 'rare' && <Award className="h-3 w-3 text-blue-400" />}
                                      {achievement.rarity === 'uncommon' && <Medal className="h-3 w-3 text-green-400" />}
                                    </div>
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