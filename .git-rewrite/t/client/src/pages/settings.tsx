import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import PageHeader from '@/components/layout/page-header';
import { Settings, User, Bell, Shield, Key, Database, Mail, Palette, Globe } from 'lucide-react';

interface UserSettings {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  timezone: string;
  emailNotifications: boolean;
  dealNotifications: boolean;
  aiNotifications: boolean;
  weeklyReports: boolean;
  apiKey?: string;
}

interface SystemSettings {
  defaultAiModel: string;
  autoProcessEmails: boolean;
  theme: string;
  language: string;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('profile');
  const [userSettingsState, setUserSettingsState] = useState<UserSettings | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  // User settings query
  const { data: userSettings, isLoading: userLoading } = useQuery<UserSettings>({
    queryKey: ['/api/settings/user'],
  });

  // System settings query
  const { data: systemSettings, isLoading: systemLoading } = useQuery<SystemSettings>({
    queryKey: ['/api/settings/system'],
  });

  // Update user settings mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/settings/user', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/user'] });
      toast({
        title: "Settings Updated",
        description: "Your preferences have been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update system settings mutation
  const updateSystemMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/settings/system', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/system'] });
      toast({
        title: "System Settings Updated",
        description: "System configuration has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update system settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Generate API key mutation
  const generateApiKeyMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/settings/generate-api-key', {
        method: 'POST',
      });
    },
    onSuccess: (data: any) => {
      setApiKey(data.apiKey);
      queryClient.invalidateQueries({ queryKey: ['/api/settings/user'] });
      toast({
        title: "API Key Generated",
        description: "New API key has been generated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate API key. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      return await apiRequest('/api/settings/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Password Changed",
        description: "Your password has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to change password. Please check your current password.",
        variant: "destructive",
      });
    },
  });

  const handleUserSettingChange = (key: string, value: any) => {
    updateUserMutation.mutate({ [key]: value });
  };

  const handleSystemSettingChange = (key: string, value: any) => {
    updateSystemMutation.mutate({ [key]: value });
  };

  if (userLoading || systemLoading) {
    return (
      <div className="min-h-screen bg-dark text-white">
        <div className="container mx-auto px-4 py-6">
          <PageHeader
            title="Settings"
            description="Manage your account preferences and system configuration"
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

  return (
    <div className="min-h-screen bg-dark text-white">
      <div className="container mx-auto px-4 py-6">
        <PageHeader
          title="Settings"
          description="Manage your account preferences and system configuration"
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-dark-light border border-dark-lighter">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              System
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card className="bg-dark-light border-dark-lighter">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>
                  Update your personal information and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      defaultValue={(userSettings as UserSettings)?.firstName || ''}
                      onChange={(e) => handleUserSettingChange('firstName', e.target.value)}
                      className="bg-dark border-dark-lighter"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      defaultValue={(userSettings as UserSettings)?.lastName || ''}
                      onChange={(e) => handleUserSettingChange('lastName', e.target.value)}
                      className="bg-dark border-dark-lighter"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue={(userSettings as UserSettings)?.email || ''}
                    onChange={(e) => handleUserSettingChange('email', e.target.value)}
                    className="bg-dark border-dark-lighter"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    defaultValue={(userSettings as UserSettings)?.timezone || 'UTC'}
                    onValueChange={(value) => handleUserSettingChange('timezone', value)}
                  >
                    <SelectTrigger className="bg-dark border-dark-lighter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time</SelectItem>
                      <SelectItem value="America/Chicago">Central Time</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                      <SelectItem value="Europe/London">London</SelectItem>
                      <SelectItem value="Europe/Berlin">Berlin</SelectItem>
                      <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card className="bg-dark-light border-dark-lighter">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>
                  Choose what notifications you want to receive
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-gray-400">Receive email updates about deals and activities</p>
                  </div>
                  <Switch
                    checked={(userSettings as UserSettings)?.emailNotifications || false}
                    onCheckedChange={(checked) => handleUserSettingChange('emailNotifications', checked)}
                  />
                </div>
                <Separator className="bg-dark-lighter" />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Deal Updates</Label>
                    <p className="text-sm text-gray-400">Get notified when deals move through pipeline stages</p>
                  </div>
                  <Switch
                    checked={(userSettings as UserSettings)?.dealNotifications || true}
                    onCheckedChange={(checked) => handleUserSettingChange('dealNotifications', checked)}
                  />
                </div>
                <Separator className="bg-dark-lighter" />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>AI Analysis Alerts</Label>
                    <p className="text-sm text-gray-400">Receive notifications when AI analysis is complete</p>
                  </div>
                  <Switch
                    checked={(userSettings as UserSettings)?.aiNotifications || true}
                    onCheckedChange={(checked) => handleUserSettingChange('aiNotifications', checked)}
                  />
                </div>
                <Separator className="bg-dark-lighter" />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Weekly Reports</Label>
                    <p className="text-sm text-gray-400">Get weekly summary of pipeline activity</p>
                  </div>
                  <Switch
                    checked={(userSettings as UserSettings)?.weeklyReports || false}
                    onCheckedChange={(checked) => handleUserSettingChange('weeklyReports', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card className="bg-dark-light border-dark-lighter">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Settings
                </CardTitle>
                <CardDescription>
                  Manage your account security and API access
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Change Password</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        className="bg-dark border-dark-lighter"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        className="bg-dark border-dark-lighter"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      const currentPassword = (document.getElementById('currentPassword') as HTMLInputElement)?.value;
                      const newPassword = (document.getElementById('newPassword') as HTMLInputElement)?.value;
                      if (currentPassword && newPassword) {
                        changePasswordMutation.mutate({ currentPassword, newPassword });
                      }
                    }}
                    disabled={changePasswordMutation.isPending}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {changePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
                  </Button>
                </div>

                <Separator className="bg-dark-lighter" />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">API Key</h4>
                      <p className="text-sm text-gray-400">Use this key to access the API programmatically</p>
                    </div>
                    <Button
                      onClick={() => generateApiKeyMutation.mutate()}
                      disabled={generateApiKeyMutation.isPending}
                      variant="outline"
                      className="border-dark-lighter"
                    >
                      <Key className="h-4 w-4 mr-2" />
                      {generateApiKeyMutation.isPending ? 'Generating...' : 'Generate New Key'}
                    </Button>
                  </div>
                  {(apiKey || (userSettings as UserSettings)?.apiKey) && (
                    <div className="space-y-2">
                      <Label>Current API Key</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          value={apiKey || (userSettings as UserSettings)?.apiKey || ''}
                          readOnly
                          className="bg-dark border-dark-lighter font-mono text-xs"
                        />
                        <Badge variant="secondary">Active</Badge>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <Card className="bg-dark-light border-dark-lighter">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  System Configuration
                </CardTitle>
                <CardDescription>
                  Configure system-wide settings and integrations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    AI Model Settings
                  </h4>
                  <div className="space-y-2">
                    <Label htmlFor="aiModel">Default AI Model</Label>
                    <Select
                      defaultValue={(systemSettings as SystemSettings)?.defaultAiModel || 'gpt-4o'}
                      onValueChange={(value) => handleSystemSettingChange('defaultAiModel', value)}
                    >
                      <SelectTrigger className="bg-dark border-dark-lighter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                        <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                        <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator className="bg-dark-lighter" />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Integration
                  </h4>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto-process Emails</Label>
                      <p className="text-sm text-gray-400">Automatically create deals from emails sent to ideas@aescuvest.vc</p>
                    </div>
                    <Switch
                      checked={(systemSettings as SystemSettings)?.autoProcessEmails || false}
                      onCheckedChange={(checked) => handleSystemSettingChange('autoProcessEmails', checked)}
                    />
                  </div>
                </div>

                <Separator className="bg-dark-lighter" />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Interface Settings
                  </h4>
                  <div className="space-y-2">
                    <Label htmlFor="theme">Theme</Label>
                    <Select
                      defaultValue={(systemSettings as SystemSettings)?.theme || 'dark'}
                      onValueChange={(value) => handleSystemSettingChange('theme', value)}
                    >
                      <SelectTrigger className="bg-dark border-dark-lighter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="auto">Auto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select
                      defaultValue={(systemSettings as SystemSettings)?.language || 'en'}
                      onValueChange={(value) => handleSystemSettingChange('language', value)}
                    >
                      <SelectTrigger className="bg-dark border-dark-lighter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="de">Deutsch</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}