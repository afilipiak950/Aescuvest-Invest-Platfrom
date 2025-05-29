import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  User, 
  Shield, 
  Bell, 
  Database, 
  Key, 
  Mail, 
  Palette, 
  Globe, 
  FileText, 
  Bot,
  Trash2,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle,
  Settings as SettingsIcon
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import EvaluationCriteriaManager from '@/components/EvaluationCriteriaManager';

interface UserSettings {
  id: number;
  name: string;
  email: string;
  role: string;
  preferences: {
    theme: string;
    language: string;
    timezone: string;
    emailNotifications: boolean;
    pushNotifications: boolean;
    weeklyReports: boolean;
    dealAlerts: boolean;
    documentAnalysisNotifications: boolean;
  };
  security: {
    twoFactorEnabled: boolean;
    sessionTimeout: number;
    passwordLastChanged: string;
  };
  apiAccess: {
    hasApiKey: boolean;
    apiKeyCreated: string;
    requestsThisMonth: number;
    rateLimit: number;
  };
}

interface SystemSettings {
  aiModels: {
    ocrModel: string;
    analysisModel: string;
    summaryModel: string;
  };
  integrations: {
    emailService: string;
    crmConnected: boolean;
    documentStorage: string;
  };
  automation: {
    autoAnalyzeDocuments: boolean;
    autoGenerateReports: boolean;
    autoMatchInvestors: boolean;
    analysisFrequency: string;
  };
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showApiKey, setShowApiKey] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Fetch user settings
  const { data: userSettings, isLoading: isLoadingUser } = useQuery<UserSettings>({
    queryKey: ['/api/settings/user'],
    retry: false,
  });

  // Fetch system settings (admin only)
  const { data: systemSettings, isLoading: isLoadingSystem } = useQuery<SystemSettings>({
    queryKey: ['/api/settings/system'],
    retry: false,
    enabled: user?.role === 'admin'
  });

  // Update user settings mutation
  const updateUserSettings = useMutation({
    mutationFn: (settings: Partial<UserSettings>) => 
      apiRequest('/api/settings/user', {
        method: 'PATCH',
        body: JSON.stringify(settings)
      }),
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Your settings have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/user'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Update system settings mutation
  const updateSystemSettings = useMutation({
    mutationFn: (settings: Partial<SystemSettings>) => 
      apiRequest('/api/settings/system', {
        method: 'PATCH',
        body: JSON.stringify(settings)
      }),
    onSuccess: () => {
      toast({
        title: "System Settings Updated",
        description: "System configuration has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/system'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update system settings.",
        variant: "destructive",
      });
    }
  });

  // Generate API key mutation
  const generateApiKey = useMutation({
    mutationFn: () => apiRequest('/api/settings/generate-api-key', { method: 'POST' }),
    onSuccess: () => {
      toast({
        title: "API Key Generated",
        description: "A new API key has been created for your account.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/user'] });
    }
  });

  // Change password mutation
  const changePassword = useMutation({
    mutationFn: (data: { newPassword: string }) => 
      apiRequest('/api/settings/change-password', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      toast({
        title: "Password Changed",
        description: "Your password has been updated successfully.",
      });
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to change password. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handlePasswordChange = () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }
    changePassword.mutate({ newPassword });
  };

  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-dark text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <SettingsIcon className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-dark-light">
            <TabsTrigger value="profile" className="data-[state=active]:bg-primary">
              Profile
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-primary">
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-primary">
              Security
            </TabsTrigger>
            <TabsTrigger value="api" className="data-[state=active]:bg-primary">
              API Access
            </TabsTrigger>
            <TabsTrigger value="evaluation" className="data-[state=active]:bg-primary">
              AI Evaluation
            </TabsTrigger>
            {user?.role === 'admin' && (
              <TabsTrigger value="system" className="data-[state=active]:bg-primary">
                System
              </TabsTrigger>
            )}
          </TabsList>

          {/* Profile Settings */}
          <TabsContent value="profile" className="space-y-6">
            <Card className="bg-dark-light border-dark-lighter">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>
                  Manage your account details and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={userSettings?.name || ''}
                      onChange={(e) => {
                        if (userSettings) {
                          updateUserSettings.mutate({ 
                            ...userSettings, 
                            name: e.target.value 
                          });
                        }
                      }}
                      className="bg-dark border-dark-lighter"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={userSettings?.email || ''}
                      onChange={(e) => {
                        if (userSettings) {
                          updateUserSettings.mutate({ 
                            ...userSettings, 
                            email: e.target.value 
                          });
                        }
                      }}
                      className="bg-dark border-dark-lighter"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="theme">Theme</Label>
                    <Select
                      value={userSettings?.preferences?.theme || 'dark'}
                      onValueChange={(value) => {
                        if (userSettings) {
                          updateUserSettings.mutate({
                            ...userSettings,
                            preferences: { ...userSettings.preferences, theme: value }
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="bg-dark border-dark-lighter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-dark-lighter border-dark-lighter">
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="auto">Auto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select
                      value={userSettings?.preferences?.language || 'en'}
                      onValueChange={(value) => {
                        if (userSettings) {
                          updateUserSettings.mutate({
                            ...userSettings,
                            preferences: { ...userSettings.preferences, language: value }
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="bg-dark border-dark-lighter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-dark-lighter border-dark-lighter">
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="de">Deutsch</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={userSettings?.preferences?.timezone || 'UTC'}
                      onValueChange={(value) => {
                        if (userSettings) {
                          updateUserSettings.mutate({
                            ...userSettings,
                            preferences: { ...userSettings.preferences, timezone: value }
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="bg-dark border-dark-lighter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-dark-lighter border-dark-lighter">
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="Europe/Berlin">Europe/Berlin</SelectItem>
                        <SelectItem value="America/New_York">America/New_York</SelectItem>
                        <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={user?.role === 'admin' ? 'default' : 'secondary'}>
                    {user?.role?.toUpperCase()}
                  </Badge>
                  <span className="text-sm text-gray-400">Account Role</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notification Settings */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="bg-dark-light border-dark-lighter">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>
                  Configure how you receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Email Notifications</Label>
                      <p className="text-sm text-gray-400">Receive notifications via email</p>
                    </div>
                    <Switch
                      checked={userSettings?.preferences?.emailNotifications || false}
                      onCheckedChange={(checked) => {
                        if (userSettings) {
                          updateUserSettings.mutate({
                            ...userSettings,
                            preferences: { ...userSettings.preferences, emailNotifications: checked }
                          });
                        }
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Push Notifications</Label>
                      <p className="text-sm text-gray-400">Receive browser push notifications</p>
                    </div>
                    <Switch
                      checked={userSettings?.preferences?.pushNotifications || false}
                      onCheckedChange={(checked) => {
                        if (userSettings) {
                          updateUserSettings.mutate({
                            ...userSettings,
                            preferences: { ...userSettings.preferences, pushNotifications: checked }
                          });
                        }
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Weekly Reports</Label>
                      <p className="text-sm text-gray-400">Receive weekly deal analytics reports</p>
                    </div>
                    <Switch
                      checked={userSettings?.preferences?.weeklyReports || false}
                      onCheckedChange={(checked) => {
                        if (userSettings) {
                          updateUserSettings.mutate({
                            ...userSettings,
                            preferences: { ...userSettings.preferences, weeklyReports: checked }
                          });
                        }
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Deal Alerts</Label>
                      <p className="text-sm text-gray-400">Get notified about new deals and updates</p>
                    </div>
                    <Switch
                      checked={userSettings?.preferences?.dealAlerts || false}
                      onCheckedChange={(checked) => {
                        if (userSettings) {
                          updateUserSettings.mutate({
                            ...userSettings,
                            preferences: { ...userSettings.preferences, dealAlerts: checked }
                          });
                        }
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Document Analysis Notifications</Label>
                      <p className="text-sm text-gray-400">Get notified when document analysis is complete</p>
                    </div>
                    <Switch
                      checked={userSettings?.preferences?.documentAnalysisNotifications || false}
                      onCheckedChange={(checked) => {
                        if (userSettings) {
                          updateUserSettings.mutate({
                            ...userSettings,
                            preferences: { ...userSettings.preferences, documentAnalysisNotifications: checked }
                          });
                        }
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security" className="space-y-6">
            <Card className="bg-dark-light border-dark-lighter">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security Settings
                </CardTitle>
                <CardDescription>
                  Manage your account security and authentication
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Two-Factor Authentication</Label>
                      <p className="text-sm text-gray-400">Add an extra layer of security to your account</p>
                    </div>
                    <Switch
                      checked={userSettings?.security?.twoFactorEnabled || false}
                      onCheckedChange={(checked) => {
                        if (userSettings) {
                          updateUserSettings.mutate({
                            ...userSettings,
                            security: { ...userSettings.security, twoFactorEnabled: checked }
                          });
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Session Timeout (minutes)</Label>
                    <Select
                      value={userSettings?.security?.sessionTimeout?.toString() || '60'}
                      onValueChange={(value) => {
                        if (userSettings) {
                          updateUserSettings.mutate({
                            ...userSettings,
                            security: { ...userSettings.security, sessionTimeout: parseInt(value) }
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="bg-dark border-dark-lighter w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-dark-lighter border-dark-lighter">
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                        <SelectItem value="480">8 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator className="bg-dark-lighter" />

                  <div className="space-y-4">
                    <h4 className="font-medium">Change Password</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="bg-dark border-dark-lighter"
                          placeholder="Enter new password"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="bg-dark border-dark-lighter"
                          placeholder="Confirm new password"
                        />
                      </div>
                    </div>
                    <Button 
                      onClick={handlePasswordChange}
                      disabled={!newPassword || !confirmPassword || changePassword.isPending}
                      className="w-fit"
                    >
                      {changePassword.isPending ? (
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Change Password
                    </Button>
                  </div>

                  <div className="p-4 bg-amber-900/20 border border-amber-500/30 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-300">Password last changed:</p>
                        <p className="text-sm text-gray-400">
                          {userSettings?.security?.passwordLastChanged || 'Never'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Access */}
          <TabsContent value="api" className="space-y-6">
            <Card className="bg-dark-light border-dark-lighter">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  API Access
                </CardTitle>
                <CardDescription>
                  Manage your API keys and access tokens
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <h4 className="font-medium">API Status</h4>
                    </div>
                    <p className="text-sm text-gray-400">
                      {userSettings?.apiAccess?.hasApiKey ? 'Active' : 'Inactive'}
                    </p>
                  </div>

                  <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="w-5 h-5 text-blue-400" />
                      <h4 className="font-medium">Requests This Month</h4>
                    </div>
                    <p className="text-2xl font-bold text-blue-400">
                      {userSettings?.apiAccess?.requestsThisMonth || 0}
                    </p>
                  </div>

                  <div className="p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Bot className="w-5 h-5 text-purple-400" />
                      <h4 className="font-medium">Rate Limit</h4>
                    </div>
                    <p className="text-sm text-gray-400">
                      {userSettings?.apiAccess?.rateLimit || 1000} requests/hour
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <div className="flex gap-2">
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        value={userSettings?.apiAccess?.hasApiKey ? '••••••••••••••••••••••••••••••••' : 'No API key generated'}
                        readOnly
                        className="bg-dark border-dark-lighter"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="border-dark-lighter"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={() => generateApiKey.mutate()}
                      disabled={generateApiKey.isPending}
                    >
                      {generateApiKey.isPending ? (
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Key className="w-4 h-4 mr-2" />
                      )}
                      {userSettings?.apiAccess?.hasApiKey ? 'Regenerate' : 'Generate'} API Key
                    </Button>
                  </div>

                  {userSettings?.apiAccess?.hasApiKey && (
                    <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
                      <p className="text-sm text-gray-400">
                        API Key created: {userSettings.apiAccess.apiKeyCreated || 'Unknown'}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Evaluation Criteria */}
          <TabsContent value="evaluation" className="space-y-6">
            <Card className="bg-dark-light border-dark-lighter">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  AI Evaluation Criteria
                </CardTitle>
                <CardDescription>
                  Configure investment criteria weights for automated deal scoring
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EvaluationCriteriaManager />
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Settings (Admin Only) */}
          {user?.role === 'admin' && (
            <TabsContent value="system" className="space-y-6">
              <Card className="bg-dark-light border-dark-lighter">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    System Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure system-wide settings and integrations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoadingSystem ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        <h4 className="font-medium flex items-center gap-2">
                          <Bot className="w-4 h-4" />
                          AI Models Configuration
                        </h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>OCR Model</Label>
                            <Select
                              value={systemSettings?.aiModels?.ocrModel || 'mistral-ocr-latest'}
                              onValueChange={(value) => {
                                if (systemSettings) {
                                  updateSystemSettings.mutate({
                                    ...systemSettings,
                                    aiModels: { ...systemSettings.aiModels, ocrModel: value }
                                  });
                                }
                              }}
                            >
                              <SelectTrigger className="bg-dark border-dark-lighter">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-dark-lighter border-dark-lighter">
                                <SelectItem value="mistral-ocr-latest">Mistral OCR Latest</SelectItem>
                                <SelectItem value="mistral-ocr-2505">Mistral OCR 2505</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Analysis Model</Label>
                            <Select
                              value={systemSettings?.aiModels?.analysisModel || 'gpt-4o'}
                              onValueChange={(value) => {
                                if (systemSettings) {
                                  updateSystemSettings.mutate({
                                    ...systemSettings,
                                    aiModels: { ...systemSettings.aiModels, analysisModel: value }
                                  });
                                }
                              }}
                            >
                              <SelectTrigger className="bg-dark border-dark-lighter">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-dark-lighter border-dark-lighter">
                                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                                <SelectItem value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet</SelectItem>
                                <SelectItem value="mistral-large-latest">Mistral Large</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Summary Model</Label>
                            <Select
                              value={systemSettings?.aiModels?.summaryModel || 'gpt-4o'}
                              onValueChange={(value) => {
                                if (systemSettings) {
                                  updateSystemSettings.mutate({
                                    ...systemSettings,
                                    aiModels: { ...systemSettings.aiModels, summaryModel: value }
                                  });
                                }
                              }}
                            >
                              <SelectTrigger className="bg-dark border-dark-lighter">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-dark-lighter border-dark-lighter">
                                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                                <SelectItem value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet</SelectItem>
                                <SelectItem value="mistral-large-latest">Mistral Large</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <Separator className="bg-dark-lighter" />

                      <div className="space-y-4">
                        <h4 className="font-medium flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          Integrations
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label>CRM Integration</Label>
                              <p className="text-sm text-gray-400">Connect with Affinity CRM</p>
                            </div>
                            <Switch
                              checked={systemSettings?.integrations?.crmConnected || false}
                              onCheckedChange={(checked) => {
                                if (systemSettings) {
                                  updateSystemSettings.mutate({
                                    ...systemSettings,
                                    integrations: { ...systemSettings.integrations, crmConnected: checked }
                                  });
                                }
                              }}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Email Service</Label>
                            <Select
                              value={systemSettings?.integrations?.emailService || 'sendgrid'}
                              onValueChange={(value) => {
                                if (systemSettings) {
                                  updateSystemSettings.mutate({
                                    ...systemSettings,
                                    integrations: { ...systemSettings.integrations, emailService: value }
                                  });
                                }
                              }}
                            >
                              <SelectTrigger className="bg-dark border-dark-lighter">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-dark-lighter border-dark-lighter">
                                <SelectItem value="sendgrid">SendGrid</SelectItem>
                                <SelectItem value="microsoft365">Microsoft 365</SelectItem>
                                <SelectItem value="gmail">Gmail API</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <Separator className="bg-dark-lighter" />

                      <div className="space-y-4">
                        <h4 className="font-medium flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Automation Settings
                        </h4>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label>Auto-Analyze Documents</Label>
                              <p className="text-sm text-gray-400">Automatically analyze uploaded documents</p>
                            </div>
                            <Switch
                              checked={systemSettings?.automation?.autoAnalyzeDocuments || false}
                              onCheckedChange={(checked) => {
                                if (systemSettings) {
                                  updateSystemSettings.mutate({
                                    ...systemSettings,
                                    automation: { ...systemSettings.automation, autoAnalyzeDocuments: checked }
                                  });
                                }
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label>Auto-Generate Reports</Label>
                              <p className="text-sm text-gray-400">Automatically generate deal reports</p>
                            </div>
                            <Switch
                              checked={systemSettings?.automation?.autoGenerateReports || false}
                              onCheckedChange={(checked) => {
                                if (systemSettings) {
                                  updateSystemSettings.mutate({
                                    ...systemSettings,
                                    automation: { ...systemSettings.automation, autoGenerateReports: checked }
                                  });
                                }
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label>Auto-Match Investors</Label>
                              <p className="text-sm text-gray-400">Automatically match deals with investors</p>
                            </div>
                            <Switch
                              checked={systemSettings?.automation?.autoMatchInvestors || false}
                              onCheckedChange={(checked) => {
                                if (systemSettings) {
                                  updateSystemSettings.mutate({
                                    ...systemSettings,
                                    automation: { ...systemSettings.automation, autoMatchInvestors: checked }
                                  });
                                }
                              }}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Analysis Frequency</Label>
                            <Select
                              value={systemSettings?.automation?.analysisFrequency || 'immediate'}
                              onValueChange={(value) => {
                                if (systemSettings) {
                                  updateSystemSettings.mutate({
                                    ...systemSettings,
                                    automation: { ...systemSettings.automation, analysisFrequency: value }
                                  });
                                }
                              }}
                            >
                              <SelectTrigger className="bg-dark border-dark-lighter w-48">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-dark-lighter border-dark-lighter">
                                <SelectItem value="immediate">Immediate</SelectItem>
                                <SelectItem value="hourly">Hourly</SelectItem>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}