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
