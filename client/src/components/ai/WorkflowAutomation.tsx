import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PlusCircle, Zap, AlertTriangle, Play, Pause, Settings, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const automationSchema = z.object({
  name: z.string().min(3, { message: 'Name must be at least 3 characters' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters' }),
  trigger: z.string().min(3, { message: 'Trigger must be specified' }),
  action: z.string().min(3, { message: 'Action must be specified' }),
  scope: z.string().min(3, { message: 'Scope must be specified' }),
  isActive: z.boolean().optional()
});

type AutomationFormValues = z.infer<typeof automationSchema>;

export default function WorkflowAutomation() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  // Fetch all automations
  const { data: automations, isLoading: automationsLoading } = useQuery({
    queryKey: ['/api/automations'],
    retry: false
  });

  // Fetch automation recommendations
  const { data: recommendations, isLoading: recommendationsLoading } = useQuery({
    queryKey: ['/api/ai/automation/recommend'],
    retry: false
  });

  // Mutation for creating a new automation
  const createAutomation = useMutation({
    mutationFn: async (data: AutomationFormValues) => {
      return apiRequest(`/api/ai/automation/create`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automations'] });
      toast({
        title: 'Automation created',
        description: 'The new automation has been added to your workflow',
      });
      setIsCreating(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Failed to create automation',
        description: error.message || 'There was an error creating the automation',
        variant: 'destructive',
      });
    }
  });

  // Mutation for toggling an automation's status
  const toggleAutomation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/ai/automation/toggle/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automations'] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to toggle automation',
        description: error.message || 'There was an error updating the automation status',
        variant: 'destructive',
      });
    }
  });

  // Form for creating new automations
  const form = useForm<AutomationFormValues>({
    resolver: zodResolver(automationSchema),
    defaultValues: {
      name: '',
      description: '',
      trigger: '',
      action: '',
      scope: '',
      isActive: false
    }
  });

  const onSubmit = (values: AutomationFormValues) => {
    createAutomation.mutate(values);
  };

  const handleUseRecommendation = (recommendation: any) => {
    form.reset({
      name: recommendation.name,
      description: recommendation.description,
      trigger: recommendation.trigger,
      action: recommendation.action,
      scope: recommendation.scope,
      isActive: false
    });
    setIsCreating(true);
  };

  // Group automations by scope for better organization
  const groupedAutomations = automations?.reduce((acc: any, automation: any) => {
    const scope = automation.scope.includes('all-deals') 
      ? 'All Deals'
      : automation.scope.includes('stage:') 
        ? 'Stage-Specific' 
        : automation.scope.includes('sector:')
          ? 'Sector-Specific'
          : 'Other';
    
    if (!acc[scope]) {
      acc[scope] = [];
    }
    acc[scope].push(automation);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Workflow Automation</h2>
          <p className="text-muted-foreground">Automate repetitive tasks with AI-powered workflows</p>
        </div>
        <Button onClick={() => setIsCreating(!isCreating)}>
          {isCreating ? (
            'Cancel'
          ) : (
            <>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Automation
            </>
          )}
        </Button>
      </div>

      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Automation</CardTitle>
            <CardDescription>
              Automate repetitive tasks based on triggers and actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Automation Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Deal Submission Alert" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="trigger"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trigger</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a trigger" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="new-deal-submission">New Deal Submission</SelectItem>
                            <SelectItem value="document-uploaded">Document Uploaded</SelectItem>
                            <SelectItem value="status-change">Status Change</SelectItem>
                            <SelectItem value="investor-match-found">Investor Match Found</SelectItem>
                            <SelectItem value="time-based-reminder">Time-Based Reminder</SelectItem>
                            <SelectItem value="analysis-completed">Analysis Completed</SelectItem>
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Detailed description of what this automation does" 
                          {...field} 
                          className="min-h-[80px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="action"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Action</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select an action" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="send-email">Send Email</SelectItem>
                            <SelectItem value="create-task">Create Task</SelectItem>
                            <SelectItem value="update-status">Update Status</SelectItem>
                            <SelectItem value="schedule-meeting">Schedule Meeting</SelectItem>
                            <SelectItem value="run-analysis">Run Analysis</SelectItem>
                            <SelectItem value="generate-report">Generate Report</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="scope"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Scope</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select scope" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="all-deals">All Deals</SelectItem>
                            <SelectItem value="stage:Series A">Series A Deals</SelectItem>
                            <SelectItem value="stage:Series B">Series B Deals</SelectItem>
                            <SelectItem value="stage:Seed">Seed Deals</SelectItem>
                            <SelectItem value="sector:MedTech">MedTech Deals</SelectItem>
                            <SelectItem value="sector:BioTech">BioTech Deals</SelectItem>
                            <SelectItem value="sector:HealthTech">HealthTech Deals</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active Status</FormLabel>
                        <FormDescription>
                          Enable this automation immediately after creation
                        </FormDescription>
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

                <Button type="submit" disabled={createAutomation.isPending} className="w-full">
                  {createAutomation.isPending ? 'Creating...' : 'Create Automation'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="active">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active">Active Automations</TabsTrigger>
          <TabsTrigger value="inactive">Inactive Automations</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        {/* Active Automations */}
        <TabsContent value="active" className="space-y-4">
          {automationsLoading ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">Loading automations...</p>
            </div>
          ) : automations?.some((a: any) => a.isActive) ? (
            Object.entries(groupedAutomations || {}).map(([scope, items]: [string, any]) => {
              const activeItems = items.filter((item: any) => item.isActive);
              if (activeItems.length === 0) return null;
              
              return (
                <div key={scope} className="space-y-3">
                  <h3 className="text-lg font-medium">{scope}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeItems.map((automation: any) => (
                      <Card key={automation.id} className="border-l-4 border-l-green-500">
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-base">{automation.name}</CardTitle>
                            <Switch 
                              checked={automation.isActive} 
                              onCheckedChange={() => toggleAutomation.mutate(automation.id)}
                            />
                          </div>
                          <CardDescription>{automation.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="pb-2">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">
                              <Zap className="mr-1 h-3 w-3" />
                              {automation.trigger}
                            </Badge>
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">
                              <Play className="mr-1 h-3 w-3" />
                              {automation.action}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center border border-dashed rounded-lg">
              <Zap className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No active automations</p>
              <p className="text-sm text-muted-foreground mt-1">Set up automations to streamline your workflow</p>
            </div>
          )}
        </TabsContent>

        {/* Inactive Automations */}
        <TabsContent value="inactive" className="space-y-4">
          {automationsLoading ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">Loading automations...</p>
            </div>
          ) : automations?.some((a: any) => !a.isActive) ? (
            Object.entries(groupedAutomations || {}).map(([scope, items]: [string, any]) => {
              const inactiveItems = items.filter((item: any) => !item.isActive);
              if (inactiveItems.length === 0) return null;
              
              return (
                <div key={scope} className="space-y-3">
                  <h3 className="text-lg font-medium">{scope}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {inactiveItems.map((automation: any) => (
                      <Card key={automation.id} className="border-l-4 border-l-gray-400">
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-base">{automation.name}</CardTitle>
                            <Switch 
                              checked={automation.isActive} 
                              onCheckedChange={() => toggleAutomation.mutate(automation.id)}
                            />
                          </div>
                          <CardDescription>{automation.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="pb-2">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="bg-gray-500/10 text-gray-500 hover:bg-gray-500/20">
                              <Pause className="mr-1 h-3 w-3" />
                              {automation.trigger}
                            </Badge>
                            <Badge variant="outline" className="bg-gray-500/10 text-gray-500 hover:bg-gray-500/20">
                              <Settings className="mr-1 h-3 w-3" />
                              {automation.action}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center border border-dashed rounded-lg">
              <Pause className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No inactive automations</p>
              <p className="text-sm text-muted-foreground mt-1">All your configured automations are currently active</p>
            </div>
          )}
        </TabsContent>

        {/* Recommendations */}
        <TabsContent value="recommendations" className="space-y-4">
          {recommendationsLoading ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">Generating recommendations...</p>
            </div>
          ) : recommendations?.recommendations?.length ? (
            <div className="grid grid-cols-1 gap-4">
              {recommendations.recommendations.map((rec: any, index: number) => (
                <Card key={index} className="border-l-4 border-l-amber-500">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base">{rec.name}</CardTitle>
                      <Badge variant="outline" className={`
                        ${rec.implementationComplexity === 'low' ? 'bg-green-500/10 text-green-500' : 
                          rec.implementationComplexity === 'medium' ? 'bg-amber-500/10 text-amber-500' : 
                          'bg-red-500/10 text-red-500'}
                      `}>
                        {rec.implementationComplexity} complexity
                      </Badge>
                    </div>
                    <CardDescription>{rec.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="mb-2">
                      <p className="text-sm font-medium">Benefit:</p>
                      <p className="text-sm text-muted-foreground">{rec.benefit}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
                        <RefreshCw className="mr-1 h-3 w-3" />
                        {rec.trigger}
                      </Badge>
                      <Badge variant="outline" className="bg-purple-500/10 text-purple-500">
                        <Zap className="mr-1 h-3 w-3" />
                        {rec.action}
                      </Badge>
                      <Badge variant="outline">
                        {rec.scope}
                      </Badge>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => handleUseRecommendation(rec)}
                    >
                      Use This Recommendation
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center border border-dashed rounded-lg">
              <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No recommendations available</p>
              <p className="text-sm text-muted-foreground mt-1">Add more deals to generate intelligent automation recommendations</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}