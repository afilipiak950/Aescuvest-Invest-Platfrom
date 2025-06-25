import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/layout/page-header';
import AutomationCard from '@/components/workflow/automation-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
      
      <div className="space-y-6 mt-6">
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
    </div>
  );
}
