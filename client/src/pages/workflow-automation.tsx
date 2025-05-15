import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/layout/page-header';
import AutomationCard from '@/components/workflow/automation-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus } from 'lucide-react';
import { Automation } from '@/types';

// Mock data
const mockAutomations: Automation[] = [
  {
    id: 1,
    name: 'Follow-up Reminders',
    description: 'Sends notifications for pending investor responses',
    trigger: '5 days after outreach with no response',
    action: 'Email notification + Dashboard alert',
    scope: 'All deals in Investor Matching phase',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString()
  },
  {
    id: 2,
    name: 'NDA Status Tracker',
    description: 'Monitors DocuSign status of NDA documents',
    trigger: 'DocuSign status change',
    action: 'Update deal status + Notify team',
    scope: 'New deals with pending NDAs',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString()
  },
  {
    id: 3,
    name: 'Due Diligence Deadline Alerts',
    description: 'Alerts team when DD deadlines are approaching',
    trigger: '3 days before deadline',
    action: 'Slack notification + Email to responsible team member',
    scope: 'Active due diligence deals',
    isActive: false,
    createdAt: new Date(Date.now() - 86400000 * 21).toISOString()
  },
  {
    id: 4,
    name: 'Investment Committee Reminders',
    description: 'Automatically schedules IC meetings for deals with complete memos',
    trigger: 'Memo status changed to Final',
    action: 'Create calendar event + Distribute memo',
    scope: 'Deals with final investment memos',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString()
  }
];

export default function WorkflowAutomation() {
  const [activeTab, setActiveTab] = useState('automations');
  
  // Simulate fetch automations query
  const { data: automations, isLoading } = useQuery({
    queryKey: ['/api/automations'],
    queryFn: async () => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));
      return mockAutomations;
    }
  });
  
  const activeAutomations = automations?.filter(a => a.isActive);
  const inactiveAutomations = automations?.filter(a => !a.isActive);
  
  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader 
        title="Workflow Automation" 
        description="Automate repetitive tasks and track progress across your investment workflow."
        actions={[
          { label: 'New Automation', icon: 'Plus', href: '#', variant: 'default' }
        ]}
      />
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="bg-dark-light border-dark-lighter mb-6">
          <TabsTrigger value="automations" className="data-[state=active]:bg-primary data-[state=active]:text-dark">
            Automations
          </TabsTrigger>
          <TabsTrigger value="integrations" className="data-[state=active]:bg-primary data-[state=active]:text-dark">
            Integrations
          </TabsTrigger>
          <TabsTrigger value="activity" className="data-[state=active]:bg-primary data-[state=active]:text-dark">
            Activity Log
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="automations">
          <div className="space-y-6">
            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Active Automations */}
                <Card className="bg-dark-light border-dark-lighter">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-xl font-semibold">Active Automations</CardTitle>
                      <Button variant="outline" className="bg-dark-lighter hover:bg-dark border-dark-lighter" size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add New
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {activeAutomations?.map(automation => (
                        <AutomationCard key={automation.id} automation={automation} />
                      ))}
                      
                      {activeAutomations?.length === 0 && (
                        <div className="text-center py-8">
                          <p className="text-gray-400">No active automations. Add one to get started.</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                {/* Inactive Automations */}
                {inactiveAutomations && inactiveAutomations.length > 0 && (
                  <Card className="bg-dark-light border-dark-lighter">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xl font-semibold">Inactive Automations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {inactiveAutomations.map(automation => (
                          <AutomationCard key={automation.id} automation={automation} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
            
            {/* Automation Templates */}
            <Card className="bg-dark-light border-dark-lighter">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl font-semibold">Automation Templates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-dark-lighter rounded-lg p-4 cursor-pointer hover:bg-dark transition">
                    <h3 className="font-medium mb-2">Deal Progress Notifications</h3>
                    <p className="text-sm text-gray-400 mb-3">Notify team when a deal moves to a new stage in the pipeline.</p>
                    <Button variant="outline" className="w-full border-dark" size="sm">
                      Use Template
                    </Button>
                  </div>
                  
                  <div className="bg-dark-lighter rounded-lg p-4 cursor-pointer hover:bg-dark transition">
                    <h3 className="font-medium mb-2">Document Expiry Warning</h3>
                    <p className="text-sm text-gray-400 mb-3">Send alerts when NDAs or term sheets are nearing expiration.</p>
                    <Button variant="outline" className="w-full border-dark" size="sm">
                      Use Template
                    </Button>
                  </div>
                  
                  <div className="bg-dark-lighter rounded-lg p-4 cursor-pointer hover:bg-dark transition">
                    <h3 className="font-medium mb-2">Weekly Deal Digest</h3>
                    <p className="text-sm text-gray-400 mb-3">Send a weekly summary of all deal activity to the team.</p>
                    <Button variant="outline" className="w-full border-dark" size="sm">
                      Use Template
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="integrations">
          <Card className="bg-dark-light border-dark-lighter">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl font-semibold">Available Integrations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-dark-lighter rounded-lg p-5 flex flex-col items-center">
                  <div className="w-16 h-16 bg-dark rounded-full flex items-center justify-center mb-4">
                    <svg className="h-8 w-8 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.3 5c-.9-.9-2.1-1.3-3.4-1.3-1.3 0-2.5.4-3.4 1.4L12 5.5l-.5-.5c-.9-.9-2.1-1.4-3.4-1.4-1.3 0-2.5.5-3.4 1.3C2.5 7.3 2.5 10.9 6 14c.3.3.7.3 1 0s.3-.7 0-1c-2.8-2.5-2.8-5.3-.7-7 .6-.5 1.3-.7 2.1-.7.8 0 1.5.3 2.1.7l1 .9c.3.3.7.3 1 0l1-1c.6-.5 1.3-.7 2.1-.7.8 0 1.5.3 2.1.7 2 2 1.9 4.3-.7 7-2.6 2.6-6.3 4.7-8.2 5.9-.3.2-.7.1-.9-.2-.2-.3-.1-.7.2-.9 1.4-.9 4.9-2.9 7.4-5.3 3.5-3.1 3.5-6.8 1.3-8.9z"/>
                    </svg>
                  </div>
                  <h3 className="font-medium mb-1">DocuSign</h3>
                  <p className="text-sm text-gray-400 text-center mb-4">Automate document signing and tracking.</p>
                  <Button className="w-full" size="sm">Connect</Button>
                </div>
                
                <div className="bg-dark-lighter rounded-lg p-5 flex flex-col items-center">
                  <div className="w-16 h-16 bg-dark rounded-full flex items-center justify-center mb-4">
                    <svg className="h-8 w-8 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.9 2H5.1C3.4 2 2 3.4 2 5.1v10.8C2 17.6 3.4 19 5.1 19h3.6v3l5.4-3h4.8c1.7 0 3.1-1.4 3.1-3.1V5.1C22 3.4 20.6 2 18.9 2zm-9.8 11.6c-1 0-1.8-.8-1.8-1.8s.8-1.8 1.8-1.8 1.8.8 1.8 1.8-.8 1.8-1.8 1.8zm3.8 0c-1 0-1.8-.8-1.8-1.8s.8-1.8 1.8-1.8 1.8.8 1.8 1.8-.8 1.8-1.8 1.8zm3.8 0c-1 0-1.8-.8-1.8-1.8s.8-1.8 1.8-1.8 1.8.8 1.8 1.8-.8 1.8-1.8 1.8z"/>
                    </svg>
                  </div>
                  <h3 className="font-medium mb-1">Slack</h3>
                  <p className="text-sm text-gray-400 text-center mb-4">Send notifications to your team channels.</p>
                  <Button variant="outline" className="w-full border-dark text-primary" size="sm">Connected</Button>
                </div>
                
                <div className="bg-dark-lighter rounded-lg p-5 flex flex-col items-center">
                  <div className="w-16 h-16 bg-dark rounded-full flex items-center justify-center mb-4">
                    <svg className="h-8 w-8 text-red-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 22c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 19.42 7.7 22 12 22z" fill="#34A853"/>
                      <path d="M5.84 13.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V6.06H2.18C1.43 7.9 1 9.9 1 12s.43 4.1 1.18 5.94l2.85-2.22.81-2.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.58 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  </div>
                  <h3 className="font-medium mb-1">Google Drive</h3>
                  <p className="text-sm text-gray-400 text-center mb-4">Sync documents and files automatically.</p>
                  <Button className="w-full" size="sm">Connect</Button>
                </div>
                
                <div className="bg-dark-lighter rounded-lg p-5 flex flex-col items-center">
                  <div className="w-16 h-16 bg-dark rounded-full flex items-center justify-center mb-4">
                    <svg className="h-8 w-8 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M1.5 0h21C23.328 0 24 .672 24 1.5v21c0 .828-.672 1.5-1.5 1.5h-21C.672 24 0 23.328 0 22.5v-21C0 .672.672 0 1.5 0z" fill="#673AB7"/>
                      <path d="M16.56 10.87c-.96-.44-1.95-.84-2.37-1.46-.42-.62-.31-1.52.21-2.05.52-.53 1.42-.52 2.01-.08.6.44.74 1.33.5 2-.29.2-.75.21-.91-.05-.16-.26-.08-.58.14-.78s.6-.3.8-.11c.2.19.25.49.13.73-.12.24-.37.38-.6.5-.23.12-.47.2-.7.32-.23.12-.44.28-.53.52-.09.24-.05.53.15.71.2.18.51.2.77.08.26-.12.44-.38.46-.66.02-.28-.12-.57-.38-.7-.26-.13-.59-.04-.78.17-.19.21-.27.54-.18.81.09.27.35.47.63.51.28.04.59-.09.77-.32.18-.23.22-.56.12-.84-.1-.28-.33-.48-.59-.62-.26-.14-.55-.22-.78-.38-.23-.16-.41-.42-.38-.7.03-.28.28-.52.56-.51.28.01.54.22.59.5.05.28-.17.57-.45.61-.28.04-.58-.19-.58-.47 0-.28.27-.5.54-.51.27-.01.55.15.66.41.11.26.02.59-.2.8-.22.21-.56.27-.85.17-.29-.1-.5-.43-.43-.72" fill="#fff"/>
                    </svg>
                  </div>
                  <h3 className="font-medium mb-1">Notion</h3>
                  <p className="text-sm text-gray-400 text-center mb-4">Sync tasks and project management.</p>
                  <Button className="w-full" size="sm">Connect</Button>
                </div>
                
                <div className="bg-dark-lighter rounded-lg p-5 flex flex-col items-center">
                  <div className="w-16 h-16 bg-dark rounded-full flex items-center justify-center mb-4">
                    <svg className="h-8 w-8 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M4 6h16v12H4V6z" fill="#0078D4"/>
                      <path d="M14 6h2v2h-2V6zm-2 4h2v2h-2v-2zm-2-4h2v2h-2V6zm-2 4h2v2H8v-2zm-2-4h2v2H6V6z" fill="#fff"/>
                    </svg>
                  </div>
                  <h3 className="font-medium mb-1">Calendar</h3>
                  <p className="text-sm text-gray-400 text-center mb-4">Schedule meetings and reminders.</p>
                  <Button variant="outline" className="w-full border-dark text-primary" size="sm">Connected</Button>
                </div>
                
                <div className="bg-dark-lighter rounded-lg p-5 flex flex-col items-center">
                  <div className="w-16 h-16 bg-dark rounded-full flex items-center justify-center mb-4">
                    <svg className="h-8 w-8 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5.52 4.5 10.02 10 10.02 5.5 0 10-4.5 10-10.02 0-5.53-4.5-10.02-10-10.02zm3.47 13.77c-.29.79-1.49 1.46-2.57.92-.63-.31-3.68-2.04-4.76-3.07-.52-.5-.76-1.08-.76-1.72 0-.64.24-1.23.76-1.72 1.08-1.04 4.15-2.78 4.76-3.07 1.08-.54 2.28.13 2.57.92.3.8.31 3.31.31 3.87 0 .56-.01 3.08-.31 3.87z"/>
                    </svg>
                  </div>
                  <h3 className="font-medium mb-1">Affinity CRM</h3>
                  <p className="text-sm text-gray-400 text-center mb-4">Sync investor contacts and interactions.</p>
                  <Button className="w-full" size="sm">Connect</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="activity">
          <Card className="bg-dark-light border-dark-lighter">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl font-semibold">Automation Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-dark-lighter rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="min-w-[50px] text-xs text-gray-400">Today</div>
                    <div className="flex-1">
                      <div className="flex items-start mb-4">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary mr-3">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium">Follow-up Reminder Sent</p>
                          <p className="text-sm text-gray-400">For NeuroTech AI investor outreach to Health Ventures Capital</p>
                          <p className="text-xs text-gray-500">9:45 AM</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary mr-3">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium">NDA Signed</p>
                          <p className="text-sm text-gray-400">DocuSign completed for MediDrone NDA with Innovation Neuro Fund</p>
                          <p className="text-xs text-gray-500">8:12 AM</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-dark-lighter rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="min-w-[50px] text-xs text-gray-400">Yesterday</div>
                    <div className="flex-1">
                      <div className="flex items-start mb-4">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary mr-3">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium">IC Meeting Scheduled</p>
                          <p className="text-sm text-gray-400">Investment Committee meeting created for HealthMetrics deal</p>
                          <p className="text-xs text-gray-500">3:30 PM</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary mr-3">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium">Documents Synced</p>
                          <p className="text-sm text-gray-400">GeneMap+ documents synchronized from Google Drive</p>
                          <p className="text-xs text-gray-500">10:15 AM</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="text-center">
                  <button className="text-primary hover:text-primary-hover transition-colors text-sm">
                    Load More Activity
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
