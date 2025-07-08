import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Settings, 
  Users, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Clock,
  Database,
  Download,
  Upload,
  ExternalLink,
  Building2,
  User
} from 'lucide-react';

interface AffinityStatus {
  configured: boolean;
  connected: boolean;
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
  };
  error?: string;
}

interface SyncMetrics {
  total: number;
  synced: number;
  pending: number;
  errors: number;
  lastSync: number | null;
}

export default function AffinitySettings() {
  const [apiKey, setApiKey] = useState('');
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get Affinity status
  const { data: status, isLoading: statusLoading } = useQuery<AffinityStatus>({
    queryKey: ['/api/affinity/status'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Get sync metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery<SyncMetrics>({
    queryKey: ['/api/affinity/sync-metrics'],
    enabled: status?.connected,
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Configure API key mutation
  const configureApiKey = useMutation({
    mutationFn: async (key: string) => {
      return await apiRequest('/api/affinity/configure', {
        method: 'POST',
        body: JSON.stringify({ apiKey: key })
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Affinity API key configured successfully",
      });
      setApiKey('');
      setIsConfiguring(false);
      queryClient.invalidateQueries({ queryKey: ['/api/affinity/status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Configuration Failed",
        description: error.details || error.message || "Failed to configure API key",
        variant: "destructive"
      });
    }
  });

  // Sync investors mutation
  const syncInvestors = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/affinity/sync-investors', {
        method: 'POST'
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Sync Complete",
        description: `Processed ${data.metrics.personsProcessed} entries, created ${data.metrics.investorsCreated} new investors, updated ${data.metrics.investorsUpdated} existing investors`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/affinity/sync-metrics'] });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync investors",
        variant: "destructive"
      });
    }
  });

  // Search investors query
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['/api/affinity/search-investors', searchTerm],
    enabled: !!searchTerm && searchTerm.length > 2 && status?.connected,
    queryFn: async () => {
      const response = await apiRequest(`/api/affinity/search-investors?term=${encodeURIComponent(searchTerm)}`);
      return response.results;
    }
  });

  // Get Affinity lists
  const { data: lists, isLoading: listsLoading } = useQuery({
    queryKey: ['/api/affinity/lists'],
    enabled: status?.connected,
    queryFn: async () => {
      const response = await apiRequest('/api/affinity/lists');
      return response.lists;
    }
  });

  const handleConfigure = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter your Affinity API key",
        variant: "destructive"
      });
      return;
    }

    configureApiKey.mutate(apiKey);
  };

  const handleSync = () => {
    if (!status?.connected) {
      toast({
        title: "Not Connected",
        description: "Please configure your Affinity API key first",
        variant: "destructive"
      });
      return;
    }

    syncInvestors.mutate();
  };

  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (connected: boolean) => {
    return connected ? 'bg-green-500' : 'bg-red-500';
  };

  const getStatusText = (status: AffinityStatus) => {
    if (!status.configured) return 'Not Configured';
    if (!status.connected) return 'Connection Failed';
    return 'Connected';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Affinity CRM Integration</h1>
          <p className="text-gray-400">Connect and sync your investor data from Affinity CRM</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${getStatusColor(status?.connected || false)}`} />
          <span className="text-sm font-medium">
            {statusLoading ? 'Checking...' : getStatusText(status!)}
          </span>
        </div>
      </div>

      <Tabs defaultValue="configuration" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="sync">Sync & Metrics</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="lists">Lists</TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                API Configuration
              </CardTitle>
              <CardDescription>
                Configure your Affinity CRM API key to enable investor synchronization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {status?.connected && status.user && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Connected as {status.user.first_name} {status.user.last_name} ({status.user.email})
                  </AlertDescription>
                </Alert>
              )}

              {status?.error && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>{status.error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="apiKey">Affinity API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="apiKey"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your Affinity API key"
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleConfigure}
                    disabled={configureApiKey.isPending}
                  >
                    {configureApiKey.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        Testing...
                      </>
                    ) : (
                      'Configure'
                    )}
                  </Button>
                </div>
              </div>

              <div className="pt-4 space-y-2">
                <h4 className="font-medium">How to get your API key:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-400">
                  <li>Log in to your Affinity CRM account</li>
                  <li>Navigate to Settings → API Keys</li>
                  <li>Generate a new API key with read permissions</li>
                  <li>Copy the key and paste it above</li>
                </ol>
                <Button variant="outline" size="sm" asChild>
                  <a href="https://developer.affinity.co/" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View API Documentation
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Sync Status & Metrics
              </CardTitle>
              <CardDescription>
                Monitor investor synchronization and view sync statistics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!status?.connected ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please configure your Affinity API key first to enable synchronization
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <Button 
                      onClick={handleSync}
                      disabled={syncInvestors.isPending}
                      className="flex items-center gap-2"
                    >
                      {syncInvestors.isPending ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" />
                          Sync All Investors
                        </>
                      )}
                    </Button>
                    <div className="text-sm text-gray-400">
                      Last sync: {formatLastSync(metrics?.lastSync || null)}
                    </div>
                  </div>

                  {metrics && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gray-800 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-blue-400">{metrics.total}</div>
                        <div className="text-sm text-gray-400">Total Investors</div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-green-400">{metrics.synced}</div>
                        <div className="text-sm text-gray-400">Synced</div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-yellow-400">{metrics.pending}</div>
                        <div className="text-sm text-gray-400">Pending</div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-red-400">{metrics.errors}</div>
                        <div className="text-sm text-gray-400">Errors</div>
                      </div>
                    </div>
                  )}

                  {metrics && metrics.total > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Sync Progress</span>
                        <span>{Math.round((metrics.synced / metrics.total) * 100)}%</span>
                      </div>
                      <Progress 
                        value={(metrics.synced / metrics.total) * 100} 
                        className="h-2"
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Search Investors
              </CardTitle>
              <CardDescription>
                Search for investors in your Affinity CRM
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!status?.connected ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please configure your Affinity API key first to enable search
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search investors by name, company, or email..."
                      className="flex-1"
                    />
                    <Button 
                      disabled={searchLoading || !searchTerm.trim()}
                      variant="outline"
                    >
                      {searchLoading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        'Search'
                      )}
                    </Button>
                  </div>

                  {searchResults && (
                    <div className="space-y-4">
                      <Separator />
                      <div>
                        <h4 className="font-medium mb-2">
                          People ({searchResults.persons?.length || 0})
                        </h4>
                        <div className="grid gap-2">
                          {searchResults.persons?.map((person: any) => (
                            <div key={person.id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                              <User className="h-5 w-5 text-gray-400" />
                              <div className="flex-1">
                                <div className="font-medium">
                                  {person.first_name} {person.last_name}
                                </div>
                                <div className="text-sm text-gray-400">
                                  {person.emails?.[0] || 'No email'}
                                </div>
                              </div>
                              <Badge variant="secondary">{person.id}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">
                          Companies ({searchResults.companies?.length || 0})
                        </h4>
                        <div className="grid gap-2">
                          {searchResults.companies?.map((company: any) => (
                            <div key={company.id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                              <Building2 className="h-5 w-5 text-gray-400" />
                              <div className="flex-1">
                                <div className="font-medium">{company.name}</div>
                                <div className="text-sm text-gray-400">
                                  {company.domain || 'No domain'}
                                </div>
                              </div>
                              <Badge variant="secondary">{company.id}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lists" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Affinity Lists
              </CardTitle>
              <CardDescription>
                View and manage your Affinity lists
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!status?.connected ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please configure your Affinity API key first to view lists
                  </AlertDescription>
                </Alert>
              ) : listsLoading ? (
                <div className="flex items-center justify-center p-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading lists...
                </div>
              ) : (
                <div className="grid gap-2">
                  {lists?.map((list: any) => (
                    <div key={list.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <div>
                        <div className="font-medium">{list.name}</div>
                        <div className="text-sm text-gray-400">
                          {list.list_size} entries • {list.public ? 'Public' : 'Private'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{list.type}</Badge>
                        <Badge variant="secondary">{list.id}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}