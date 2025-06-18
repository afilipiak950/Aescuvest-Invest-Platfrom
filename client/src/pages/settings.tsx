import { useState, useEffect } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import PageHeader from '@/components/layout/page-header';
import { Settings, User, Bell, Shield, Key, Database, Mail, Palette, Globe, AlertCircle, CheckCircle, Copy } from 'lucide-react';

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
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [showApiKey, setShowApiKey] = useState(false);

  // User settings query with refetch interval to ensure UI sync
  const { data: userSettings, isLoading: userLoading, refetch: refetchUser } = useQuery<UserSettings>({
    queryKey: ['/api/settings/user'],
    refetchOnWindowFocus: true,
  });

  // System settings query with refetch interval to ensure UI sync
  const { data: systemSettings, isLoading: systemLoading, refetch: refetchSystem } = useQuery<SystemSettings>({
    queryKey: ['/api/settings/system'],
    refetchOnWindowFocus: true,
  });

  // Update user settings mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('🔄 Sending user settings update:', data);
      const response = await apiRequest('/api/settings/user', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      console.log('✅ User settings update response:', response);
      return response;
    },
    onSuccess: async (data, variables) => {
      console.log('✅ User settings update successful:', { data, variables });
      // Force immediate refetch to update UI state
      await refetchUser();
      // Also invalidate cache for good measure
      queryClient.invalidateQueries({ queryKey: ['/api/settings/user'] });
      toast({
        title: "Settings Updated",
        description: "Your preferences have been saved successfully.",
      });
    },
    onError: (error, variables) => {
      console.error('❌ User settings update failed:', { error, variables });
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
      console.log('🔄 Sending system settings update:', data);
      const response = await apiRequest('/api/settings/system', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      console.log('✅ System settings update response:', response);
      return response;
    },
    onSuccess: async (data, variables) => {
      console.log('✅ System settings update successful:', { data, variables });
      // Force immediate refetch to update UI state
      await refetchSystem();
      // Also invalidate cache for good measure
      queryClient.invalidateQueries({ queryKey: ['/api/settings/system'] });
      toast({
        title: "System Settings Updated",
        description: "System configuration has been updated successfully.",
      });
    },
    onError: (error, variables) => {
      console.error('❌ System settings update failed:', { error, variables });
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
      console.log('🔄 Generating new API key...');
      const response = await apiRequest('/api/settings/generate-api-key', {
        method: 'POST',
      });
      console.log('✅ API key generation response:', response);
      return response;
    },
    onSuccess: (data: any) => {
      console.log('✅ API key generation successful:', data);
      setApiKey(data.apiKey);
      queryClient.invalidateQueries({ queryKey: ['/api/settings/user'] });
      toast({
        title: "API Key Generated",
        description: "New API key has been generated successfully.",
      });
    },
    onError: (error) => {
      console.error('❌ API key generation failed:', error);
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
      console.log('🔄 Changing password...');
      const response = await apiRequest('/api/settings/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      console.log('✅ Password change response:', response);
      return response;
    },
    onSuccess: (data, variables) => {
      console.log('✅ Password change successful:', data);
      // Clear password fields
      const currentPasswordField = document.getElementById('currentPassword') as HTMLInputElement;
      const newPasswordField = document.getElementById('newPassword') as HTMLInputElement;
      if (currentPasswordField) currentPasswordField.value = '';
      if (newPasswordField) newPasswordField.value = '';
      
      toast({
        title: "Password Changed",
        description: "Your password has been updated successfully.",
      });
    },
    onError: (error, variables) => {
      console.error('❌ Password change failed:', { error, variables });
      toast({
        title: "Error",
        description: "Failed to change password. Please check your current password.",
        variant: "destructive",
      });
    },
  });

  // Password validation function
  const validatePassword = (data: typeof passwordData): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    if (!data.currentPassword) {
      errors.currentPassword = 'Current password is required';
    }
    
    if (!data.newPassword) {
      errors.newPassword = 'New password is required';
    } else if (data.newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(data.newPassword)) {
      errors.newPassword = 'Password must contain uppercase, lowercase, and number';
    }
    
    if (!data.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (data.newPassword !== data.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    return errors;
  };

  // Handle password change with validation
  const handlePasswordChange = () => {
    const errors = validatePassword(passwordData);
    setPasswordErrors(errors);
    
    if (Object.keys(errors).length === 0) {
      changePasswordMutation.mutate({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
    }
  };

  // Clear password form after successful change
  useEffect(() => {
    if (changePasswordMutation.isSuccess) {
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setPasswordErrors({});
    }
  }, [changePasswordMutation.isSuccess]);

  // Copy API key to clipboard
  const copyApiKey = async () => {
    const keyToCopy = apiKey || (userSettings as UserSettings)?.apiKey;
    if (keyToCopy) {
      try {
        await navigator.clipboard.writeText(keyToCopy);
        toast({
          title: "Copied",
          description: "API key copied to clipboard",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to copy API key",
          variant: "destructive",
        });
      }
    }
  };

  const handleUserSettingChange = (key: string, value: any) => {
    console.log('🔧 User Setting Change:', { key, value, currentData: userSettings });
    updateUserMutation.mutate({ [key]: value });
  };

  const handleSystemSettingChange = (key: string, value: any) => {
    console.log('🔧 System Setting Change:', { key, value, currentData: systemSettings });
    
    // Optimistic UI update
    queryClient.setQueryData(['/api/settings/system'], (oldData: any) => ({
      ...oldData,
      [key]: value
    }));
    
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
                  
                  {/* Password Requirements Alert */}
                  <Alert className="bg-dark-light border-dark-lighter">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Password must be at least 8 characters and include uppercase, lowercase, and number.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                        className={`bg-dark border-dark-lighter ${passwordErrors.currentPassword ? 'border-red-500' : ''}`}
                        placeholder="Enter current password"
                      />
                      {passwordErrors.currentPassword && (
                        <p className="text-sm text-red-400">{passwordErrors.currentPassword}</p>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                          className={`bg-dark border-dark-lighter ${passwordErrors.newPassword ? 'border-red-500' : ''}`}
                          placeholder="Enter new password"
                        />
                        {passwordErrors.newPassword && (
                          <p className="text-sm text-red-400">{passwordErrors.newPassword}</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                          className={`bg-dark border-dark-lighter ${passwordErrors.confirmPassword ? 'border-red-500' : ''}`}
                          placeholder="Confirm new password"
                        />
                        {passwordErrors.confirmPassword && (
                          <p className="text-sm text-red-400">{passwordErrors.confirmPassword}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    onClick={handlePasswordChange}
                    disabled={changePasswordMutation.isPending}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {changePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
                  </Button>
                  
                  {changePasswordMutation.isSuccess && (
                    <Alert className="bg-green-900/20 border-green-500/50">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <AlertDescription className="text-green-400">
                        Password updated successfully
                      </AlertDescription>
                    </Alert>
                  )}
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
                      className="border-dark-lighter hover:bg-dark-lighter"
                    >
                      <Key className="h-4 w-4 mr-2" />
                      {generateApiKeyMutation.isPending ? 'Generating...' : 'Generate New Key'}
                    </Button>
                  </div>
                  
                  {(apiKey || (userSettings as UserSettings)?.apiKey) && (
                    <div className="space-y-3">
                      <Label>Current API Key</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          value={showApiKey ? (apiKey || (userSettings as UserSettings)?.apiKey || '') : '••••••••••••••••••••••••••••••••'}
                          readOnly
                          className="bg-dark border-dark-lighter font-mono text-xs"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="border-dark-lighter hover:bg-dark-lighter"
                        >
                          {showApiKey ? 'Hide' : 'Show'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copyApiKey}
                          className="border-dark-lighter hover:bg-dark-lighter"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Badge variant="secondary" className="bg-green-900/20 text-green-400 border-green-500/50">
                          Active
                        </Badge>
                      </div>
                      
                      <Alert className="bg-blue-900/20 border-blue-500/50">
                        <AlertCircle className="h-4 w-4 text-blue-400" />
                        <AlertDescription className="text-blue-400">
                          Keep your API key secure. It provides full access to your account via the API.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                  
                  {generateApiKeyMutation.isSuccess && (
                    <Alert className="bg-green-900/20 border-green-500/50">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <AlertDescription className="text-green-400">
                        New API key generated successfully. Make sure to copy it now as it won't be shown again.
                      </AlertDescription>
                    </Alert>
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
                  <div className="p-4 rounded-lg border border-dark-lighter bg-dark-light/30">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="aiModel" className="text-sm font-medium">Default AI Model</Label>
                        <Badge variant="secondary" className="text-xs">
                          Current: {(systemSettings as SystemSettings)?.defaultAiModel?.toUpperCase() || 'GPT-4O'}
                        </Badge>
                      </div>
                      <Select
                        value={(systemSettings as SystemSettings)?.defaultAiModel || 'gpt-4o'}
                        onValueChange={(value) => handleSystemSettingChange('defaultAiModel', value)}
                        disabled={updateSystemMutation.isPending}
                      >
                        <SelectTrigger className="bg-dark border-dark-lighter hover:border-primary/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-dark border-dark-lighter">
                          <SelectItem value="gpt-4o">🤖 GPT-4 Omni (Recommended)</SelectItem>
                          <SelectItem value="gpt-4-turbo">⚡ GPT-4 Turbo</SelectItem>
                          <SelectItem value="claude-3-sonnet">🎭 Claude 3 Sonnet</SelectItem>
                          <SelectItem value="claude-3-opus">🎨 Claude 3 Opus</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-400">Primary AI model for document analysis, summaries, and investment insights</p>
                    </div>
                  </div>
                </div>

                <Separator className="bg-dark-lighter" />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Integration
                  </h4>
                  <div className="p-4 rounded-lg border border-dark-lighter bg-dark-light/30">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Auto-process Emails</Label>
                        <p className="text-sm text-gray-400">Automatically analyze emails sent to ideas@aescuvest.vc and create investment deals</p>
                        <div className="flex items-center gap-2">
                          <Badge variant={(systemSettings as SystemSettings)?.autoProcessEmails ? "default" : "secondary"} className="text-xs">
                            {(systemSettings as SystemSettings)?.autoProcessEmails ? "🟢 Enabled" : "🔴 Disabled"}
                          </Badge>
                          {(systemSettings as SystemSettings)?.autoProcessEmails && (
                            <Badge variant="outline" className="text-xs border-green-500/50 text-green-400">
                              Monitoring Active
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Switch
                        checked={(systemSettings as SystemSettings)?.autoProcessEmails || false}
                        onCheckedChange={(checked) => handleSystemSettingChange('autoProcessEmails', checked)}
                        disabled={updateSystemMutation.isPending}
                      />
                    </div>
                    {(systemSettings as SystemSettings)?.autoProcessEmails && (
                      <Alert className="mt-3 bg-blue-900/20 border-blue-500/50">
                        <AlertCircle className="h-4 w-4 text-blue-400" />
                        <AlertDescription className="text-blue-400 text-sm">
                          Email processing is active. New deals will be automatically created from qualifying emails.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>

                <Separator className="bg-dark-lighter" />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Interface Settings
                  </h4>
                  <div className="p-4 rounded-lg border border-dark-lighter bg-dark-light/30">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="theme" className="text-sm font-medium">Theme Preference</Label>
                          <Badge variant="secondary" className="text-xs">
                            {(systemSettings as SystemSettings)?.theme === 'dark' ? '🌙 Dark' : 
                             (systemSettings as SystemSettings)?.theme === 'light' ? '☀️ Light' : '🔄 Auto'}
                          </Badge>
                        </div>
                        <Select
                          value={(systemSettings as SystemSettings)?.theme || 'dark'}
                          onValueChange={(value) => handleSystemSettingChange('theme', value)}
                          disabled={updateSystemMutation.isPending}
                        >
                          <SelectTrigger className="bg-dark border-dark-lighter hover:border-primary/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-dark border-dark-lighter">
                            <SelectItem value="dark">🌙 Dark Mode</SelectItem>
                            <SelectItem value="light">☀️ Light Mode</SelectItem>
                            <SelectItem value="auto">🔄 Auto-detect</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-400">Choose your preferred interface appearance</p>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="language" className="text-sm font-medium">System Language</Label>
                          <Badge variant="secondary" className="text-xs">
                            {(systemSettings as SystemSettings)?.language === 'en' ? '🇺🇸 EN' :
                             (systemSettings as SystemSettings)?.language === 'de' ? '🇩🇪 DE' :
                             (systemSettings as SystemSettings)?.language === 'fr' ? '🇫🇷 FR' : '🇪🇸 ES'}
                          </Badge>
                        </div>
                        <Select
                          value={(systemSettings as SystemSettings)?.language || 'en'}
                          onValueChange={(value) => handleSystemSettingChange('language', value)}
                          disabled={updateSystemMutation.isPending}
                        >
                          <SelectTrigger className="bg-dark border-dark-lighter hover:border-primary/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-dark border-dark-lighter">
                            <SelectItem value="en">🇺🇸 English</SelectItem>
                            <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                            <SelectItem value="fr">🇫🇷 Français</SelectItem>
                            <SelectItem value="es">🇪🇸 Español</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-400">Interface and report language</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Success/Error Feedback with Real-time Status */}
                {updateSystemMutation.isSuccess && (
                  <Alert className="bg-green-900/20 border-green-500/50">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <AlertDescription className="text-green-400">
                      System settings updated successfully. Changes are now active across the platform.
                    </AlertDescription>
                  </Alert>
                )}

                {updateSystemMutation.isError && (
                  <Alert className="bg-red-900/20 border-red-500/50">
                    <AlertCircle className="h-4 w-4 text-red-400" />
                    <AlertDescription className="text-red-400">
                      Failed to update system settings: {updateSystemMutation.error?.message || 'Please verify admin permissions and try again.'}
                    </AlertDescription>
                  </Alert>
                )}

                {updateSystemMutation.isPending && (
                  <Alert className="bg-blue-900/20 border-blue-500/50">
                    <AlertCircle className="h-4 w-4 text-blue-400" />
                    <AlertDescription className="text-blue-400">
                      Updating system configuration in database...
                    </AlertDescription>
                  </Alert>
                )}

                {/* Real-time Settings Status Display */}
                <div className="mt-4 p-3 rounded-lg bg-dark-light/20 border border-dark-lighter">
                  <h5 className="text-sm font-medium mb-2 text-gray-300">Current System Configuration</h5>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">AI Model:</span>
                      <span className="text-white font-mono">{(systemSettings as SystemSettings)?.defaultAiModel || 'gpt-4o'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Email Processing:</span>
                      <span className={`font-mono ${(systemSettings as SystemSettings)?.autoProcessEmails ? 'text-green-400' : 'text-red-400'}`}>
                        {(systemSettings as SystemSettings)?.autoProcessEmails ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Theme:</span>
                      <span className="text-white font-mono">{(systemSettings as SystemSettings)?.theme || 'dark'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Language:</span>
                      <span className="text-white font-mono">{(systemSettings as SystemSettings)?.language || 'en'}</span>
                    </div>
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