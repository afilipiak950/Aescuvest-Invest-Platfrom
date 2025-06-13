import openaiService from './openai';
import { storage } from '../storage';
import { InsertAutomation } from '@shared/schema';

/**
 * Define automation triggers
 */
export type AutomationTrigger = 
  | 'new-deal-submission'
  | 'document-uploaded'
  | 'status-change'
  | 'investor-match-found'
  | 'time-based-reminder'
  | 'analysis-completed';

/**
 * Define automation actions
 */
export type AutomationAction =
  | 'send-email'
  | 'create-task'
  | 'update-status'
  | 'schedule-meeting'
  | 'run-analysis'
  | 'generate-report';

/**
 * Create a new automation rule
 */
export async function createAutomation(
  name: string,
  description: string,
  trigger: string,
  action: string,
  scope: string,
  isActive: boolean = false
): Promise<number> {
  const automationData: InsertAutomation = {
    name,
    description,
    trigger,
    action,
    scope,
    isActive
  };

  const newAutomation = await storage.createAutomation(automationData);
  return newAutomation.id;
}

/**
 * Toggle an automation's active status
 */
export async function toggleAutomation(automationId: number): Promise<boolean> {
  const updatedAutomation = await storage.toggleAutomation(automationId);
  return updatedAutomation ? updatedAutomation.isActive : false;
}

/**
 * Check if an automation should run based on event and context
 */
export function shouldRunAutomation(
  automation: any,
  eventType: AutomationTrigger,
  context: any
): boolean {
  if (!automation.isActive) {
    return false;
  }

  // Check if event type matches trigger
  if (automation.trigger !== eventType) {
    return false;
  }

  // Parse scope to determine if this context applies
  try {
    // Simplistic scope check - in a real system this would be more robust
    if (automation.scope.includes('all-deals')) {
      return true;
    }
    
    if (automation.scope.includes('stage:') && context.deal) {
      const stageCriteria = automation.scope.match(/stage:([^,]+)/);
      if (stageCriteria && stageCriteria[1] === context.deal.stage) {
        return true;
      }
    }
    
    if (automation.scope.includes('sector:') && context.deal) {
      const sectorCriteria = automation.scope.match(/sector:([^,]+)/);
      if (sectorCriteria && sectorCriteria[1] === context.deal.sector) {
        return true;
      }
    }
    
    // Additional scope checks can be added here
    
    return false;
  } catch (error) {
    console.error("Error parsing automation scope:", error);
    return false;
  }
}

/**
 * Generate action parameters based on automation and context
 */
export async function generateActionParameters(
  automation: any,
  context: any
): Promise<any> {
  // For email actions, generate appropriate content
  if (automation.action === 'send-email') {
    // Different email types based on context and trigger
    let emailType = 'general';
    
    if (automation.trigger === 'new-deal-submission') {
      emailType = 'new-deal-notification';
    } else if (automation.trigger === 'document-uploaded') {
      emailType = 'document-notification';
    } else if (automation.trigger === 'investor-match-found') {
      emailType = 'investor-match-notification';
    } else if (automation.trigger === 'analysis-completed') {
      emailType = 'analysis-completed-notification';
    }
    
    const emailPrompt = `
      Generate parameters for an automated email notification.
      
      Email type: ${emailType}
      Context: ${JSON.stringify(context)}
      
      Return the parameters as a JSON object with:
      {
        "to": "recipient email or placeholder",
        "subject": "email subject line",
        "body": "email body text",
        "priority": "normal" | "high" | "low"
      }
    `;

    const emailResult = await openaiService.generateResponse(
      emailPrompt,
      JSON.stringify(context),
      { jsonResponse: true, temperature: 0.5 }
    );

    try {
      return JSON.parse(emailResult);
    } catch (error) {
      console.error("Failed to parse email parameters:", error);
      return {
        to: "team@aescuvest.com",
        subject: `[Automated] Notification regarding ${context.deal?.companyName || 'a deal'}`,
        body: "An automated action was triggered. Please check the platform for details.",
        priority: "normal"
      };
    }
  }
  
  // For task creation actions
  if (automation.action === 'create-task') {
    const taskPrompt = `
      Generate parameters for an automated task creation.
      
      Trigger: ${automation.trigger}
      Context: ${JSON.stringify(context)}
      
      Return the parameters as a JSON object with:
      {
        "title": "task title",
        "description": "task description",
        "assignedTo": "team member or role",
        "dueDate": "relative due date (e.g., '3 days')",
        "priority": "high" | "medium" | "low"
      }
    `;

    const taskResult = await openaiService.generateResponse(
      taskPrompt,
      JSON.stringify(context),
      { jsonResponse: true, temperature: 0.5 }
    );

    try {
      return JSON.parse(taskResult);
    } catch (error) {
      console.error("Failed to parse task parameters:", error);
      return {
        title: `Review ${context.deal?.companyName || 'new item'}`,
        description: "Automated task created by workflow automation",
        assignedTo: "analyst",
        dueDate: "3 days",
        priority: "medium"
      };
    }
  }
  
  // Default parameters if no specific handling
  return {
    automationId: automation.id,
    action: automation.action,
    trigger: automation.trigger,
    context
  };
}

/**
 * Recommend potential automations based on team behavior and patterns
 */
export async function recommendAutomations(
  dealCount: number = 5,
  activeDuration: number = 30 // days
): Promise<{
  name: string;
  description: string;
  trigger: string;
  action: string;
  scope: string;
  benefit: string;
  implementationComplexity: "low" | "medium" | "high";
}[]> {
  // Get recent deals and activities to analyze patterns
  const deals = await storage.getAllDeals();
  const recentDeals = deals.slice(0, dealCount);
  
  // Prepare data for analysis
  const analysisData = {
    deals: recentDeals,
    activeDuration
  };
  
  const recommendationPrompt = `
    Analyze this investment activity data and recommend workflow automations that would improve efficiency.
    
    For each recommendation, include:
    - Name: Clear, descriptive name for the automation
    - Description: What the automation does and why it's valuable
    - Trigger: When the automation should run
    - Action: What the automation should do
    - Scope: What deals/contexts it applies to
    - Benefit: The specific efficiency gain or problem it solves
    - Implementation Complexity: How difficult it would be to implement (low/medium/high)
    
    Focus on practical, high-value automations that address real workflow pain points.
    
    Return 3-5 recommendations as a JSON array.
  `;

  const recommendationsResult = await openaiService.generateResponse(
    recommendationPrompt,
    JSON.stringify(analysisData),
    { jsonResponse: true, temperature: 0.7 }
  );

  try {
    return JSON.parse(recommendationsResult);
  } catch (error) {
    console.error("Failed to parse automation recommendations:", error);
    return [
      {
        name: "New Deal Notification",
        description: "Automatically notify the team when a new deal is submitted",
        trigger: "new-deal-submission",
        action: "send-email",
        scope: "all-deals",
        benefit: "Ensures timely review of new opportunities",
        implementationComplexity: "low"
      },
      {
        name: "Document Analysis Trigger",
        description: "Automatically trigger AI analysis when new documents are uploaded",
        trigger: "document-uploaded",
        action: "run-analysis",
        scope: "all-deals",
        benefit: "Streamlines due diligence process",
        implementationComplexity: "medium"
      }
    ];
  }
}

export default {
  createAutomation,
  toggleAutomation,
  shouldRunAutomation,
  generateActionParameters,
  recommendAutomations
};