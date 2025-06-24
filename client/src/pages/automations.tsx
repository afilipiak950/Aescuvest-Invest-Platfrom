import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Play, 
  Pause, 
  Plus, 
  Settings, 
  Clock, 
  Zap, 
  FileText, 
  Mail, 
  Calendar,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const automationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  trigger: z.string().min(1, 'Trigger condition is required'),
  action: z.string().min(1, 'Action is required'),
  scope: z.string().min(1, 'Scope is required'),
  isActive: z.boolean().default(false),
  triggerType: z.enum(['time_based', 'event_based', 'condition_based']),
  actionType: z.enum(['email', 'notification', 'status_update', 'document_action', 'meeting_schedule'])
});

type AutomationFormData = z.infer<typeof automationSchema>;

interface AutomationExecution {
  id: number;
  automationId: number;
  dealId: number;
  executedAt: string;
  status: 'success' | 'failed' | 'pending';
  result: string;
  error?: string;
}

export default function AutomationsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<AutomationFormData>({
    resolver: zodResolver(automationSchema),
    defaultValues: {
      name: '',
      description: '',
      trigger: '',
      action: '',
      scope: '',
      isActive: false,
      triggerType: 'event_based',
      actionType: 'notification'
    }
  });

  // Fetch automations
  const { data: automations = [], isLoading } = useQuery({
    queryKey: ['/api/automations'],
    retry: false
  });

  // Fetch automation execution history
  const { data: executions = [], isLoading: executionsLoading } = useQuery({
    queryKey: ['/api/automations/executions'],
    retry: false
  });

  // Create automation mutation
  const createAutomation = useMutation({
    mutationFn: async (data: AutomationFormData) => {
      return apiRequest('/api/automations', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automations'] });
      toast({
        title: 'Automation Created',
        description: 'Your new automation has been successfully created and is ready to use.'
      });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Create Automation',
        description: error.message || 'There was an error creating the automation.',
        variant: 'destructive'
      });
    }
  });

  // Toggle automation mutation
  const toggleAutomation = useMutation({
    mutationFn: async (automationId: number) => {
      return apiRequest(`/api/automations/${automationId}/toggle`, {
        method: 'PATCH'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automations'] });
      toast({
        title: 'Automation Updated',
        description: 'Automation status has been successfully changed.'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Update Automation',
        description: error.message || 'There was an error updating the automation.',
        variant: 'destructive'
      });
    }
  });

  // Delete automation mutation
  const deleteAutomation = useMutation({
    mutationFn: async (automationId: number) => {
      return apiRequest(`/api/automations/${automationId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automations'] });
      toast({
        title: 'Automation Deleted',
        description: 'The automation has been successfully removed.'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Delete Automation',
        description: error.message || 'There was an error deleting the automation.',
        variant: 'destructive'
      });
    }
  });

  const onSubmit = (data: AutomationFormData) => {
    createAutomation.mutate(data);
  };

  const activeAutomations = automations.filter((a: any) => a.isActive);
  const recentExecutions = executions.slice(0, 10);
  const successfulExecutions = executions.filter((e: any) => e.status === 'success').length;
  const failedExecutions = executions.filter((e: any) => e.status === 'failed').length;

  const getTriggerIcon = (triggerType: string) => {
    switch (triggerType) {
      case 'time_based': return <Clock className="h-4 w-4" />;
      case 'event_based': return <Zap className="h-4 w-4" />;
      case 'condition_based': return <Settings className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'notification': return <Activity className="h-4 w-4" />;
      case 'status_update': return <CheckCircle2 className="h-4 w-4" />;
      case 'document_action': return <FileText className="h-4 w-4" />;
      case 'meeting_schedule': return <Calendar className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Workflow Automation</h1>
          <p className="text-gray-400 mt-2">Automate repetitive tasks and streamline your investment workflow</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              New Automation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl bg-dark-light border-dark-lighter">
            <DialogHeader>
              <DialogTitle className="text-white">Create New Automation</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Name</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-dark border-dark-lighter text-white" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="triggerType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Trigger Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-dark border-dark-lighter text-white">
                              <SelectValue placeholder="Select trigger type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-dark-light border-dark-lighter">
                            <SelectItem value="time_based">Time Based</SelectItem>
                            <SelectItem value="event_based">Event Based</SelectItem>
                            <SelectItem value="condition_based">Condition Based</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="bg-dark border-dark-lighter text-white" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="trigger"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Trigger Condition</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-dark border-dark-lighter text-white" placeholder="e.g., Deal status changes to 'Due Diligence'" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="actionType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Action Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-dark border-dark-lighter text-white">
                              <SelectValue placeholder="Select action type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-dark-light border-dark-lighter">
                            <SelectItem value="email">Send Email</SelectItem>
                            <SelectItem value="notification">Send Notification</SelectItem>
                            <SelectItem value="status_update">Update Status</SelectItem>
                            <SelectItem value="document_action">Document Action</SelectItem>
                            <SelectItem value="meeting_schedule">Schedule Meeting</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="action"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Action Details</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-dark border-dark-lighter text-white" placeholder="e.g., Send email to team lead" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="scope"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Scope</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-dark border-dark-lighter text-white" placeholder="e.g., All active deals" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-dark-lighter p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-white">Activate Immediately</FormLabel>
                        <div className="text-sm text-gray-400">
                          Start this automation as soon as it's created
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createAutomation.isPending}>
                    {createAutomation.isPending ? 'Creating...' : 'Create Automation'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-dark-light border-dark-lighter">
          <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-dark">
            Overview
          </TabsTrigger>
          <TabsTrigger value="automations" className="data-[state=active]:bg-primary data-[state=active]:text-dark">
            Automations
          </TabsTrigger>
          <TabsTrigger value="executions" className="data-[state=active]:bg-primary data-[state=active]:text-dark">
            Execution History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-dark-light border-dark-lighter">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Total Automations</p>
                    <p className="text-3xl font-bold text-white">{automations.length}</p>
                  </div>
                  <Settings className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-dark-light border-dark-lighter">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Active</p>
                    <p className="text-3xl font-bold text-green-400">{activeAutomations.length}</p>
                  </div>
                  <Play className="h-8 w-8 text-green-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-dark-light border-dark-lighter">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Successful Executions</p>
                    <p className="text-3xl font-bold text-green-400">{successfulExecutions}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-green-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-dark-light border-dark-lighter">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Failed Executions</p>
                    <p className="text-3xl font-bold text-red-400">{failedExecutions}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card className="bg-dark-light border-dark-lighter">
            <CardHeader>
              <CardTitle className="text-white">Recent Automation Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {executionsLoading ? (
                <div className="text-gray-400">Loading recent activity...</div>
              ) : recentExecutions.length > 0 ? (
                <div className="space-y-4">
                  {recentExecutions.map((execution: any) => (
                    <div key={execution.id} className="flex items-center justify-between p-4 bg-dark rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${
                          execution.status === 'success' ? 'bg-green-400/10 text-green-400' :
                          execution.status === 'failed' ? 'bg-red-400/10 text-red-400' :
                          'bg-yellow-400/10 text-yellow-400'
                        }`}>
                          {execution.status === 'success' ? <CheckCircle2 className="h-4 w-4" /> :
                           execution.status === 'failed' ? <AlertTriangle className="h-4 w-4" /> :
                           <Clock className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="text-white font-medium">{execution.automationName}</p>
                          <p className="text-sm text-gray-400">{execution.result}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={execution.status === 'success' ? 'default' : 'destructive'}>
                          {execution.status}
                        </Badge>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(execution.executedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  No automation executions yet. Create your first automation to get started.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automations" className="space-y-6">
          {isLoading ? (
            <div className="text-center text-gray-400">Loading automations...</div>
          ) : automations.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {automations.map((automation: any) => (
                <Card key={automation.id} className="bg-dark-light border-dark-lighter">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-white text-lg">{automation.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={automation.isActive}
                        onCheckedChange={() => toggleAutomation.mutate(automation.id)}
                        disabled={toggleAutomation.isPending}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteAutomation.mutate(automation.id)}
                        disabled={deleteAutomation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-gray-400 text-sm">{automation.description}</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          {getTriggerIcon(automation.triggerType)}
                          <p className="text-xs font-medium text-gray-400">TRIGGER</p>
                        </div>
                        <p className="text-sm text-white">{automation.trigger}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          {getActionIcon(automation.actionType)}
                          <p className="text-xs font-medium text-gray-400">ACTION</p>
                        </div>
                        <p className="text-sm text-white">{automation.action}</p>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-xs font-medium text-gray-400 mb-2">SCOPE</p>
                      <p className="text-sm text-white">{automation.scope}</p>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-dark-lighter">
                      <Badge variant={automation.isActive ? 'default' : 'secondary'}>
                        {automation.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <p className="text-xs text-gray-400">
                        Created {new Date(automation.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-dark-light border-dark-lighter">
              <CardContent className="text-center py-12">
                <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No Automations Yet</h3>
                <p className="text-gray-400 mb-6">
                  Create your first automation to streamline your investment workflow and save time on repetitive tasks.
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Automation
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="executions" className="space-y-6">
          <Card className="bg-dark-light border-dark-lighter">
            <CardHeader>
              <CardTitle className="text-white">Execution History</CardTitle>
            </CardHeader>
            <CardContent>
              {executionsLoading ? (
                <div className="text-center text-gray-400">Loading execution history...</div>
              ) : executions.length > 0 ? (
                <div className="space-y-4">
                  {executions.map((execution: any) => (
                    <div key={execution.id} className="flex items-center justify-between p-4 bg-dark rounded-lg border border-dark-lighter">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${
                          execution.status === 'success' ? 'bg-green-400/10 text-green-400' :
                          execution.status === 'failed' ? 'bg-red-400/10 text-red-400' :
                          'bg-yellow-400/10 text-yellow-400'
                        }`}>
                          {execution.status === 'success' ? <CheckCircle2 className="h-4 w-4" /> :
                           execution.status === 'failed' ? <AlertTriangle className="h-4 w-4" /> :
                           <Clock className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="text-white font-medium">{execution.automationName}</p>
                          <p className="text-sm text-gray-400">{execution.result}</p>
                          {execution.error && (
                            <p className="text-sm text-red-400 mt-1">{execution.error}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={execution.status === 'success' ? 'default' : execution.status === 'failed' ? 'destructive' : 'secondary'}>
                          {execution.status}
                        </Badge>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(execution.executedAt).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-400">
                          Deal: {execution.dealId}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  No execution history available. Automations will appear here once they start running.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}