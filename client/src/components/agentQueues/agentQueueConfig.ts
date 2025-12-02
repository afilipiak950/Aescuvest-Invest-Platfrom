/**
 * Agent Queue Configuration
 * Centralized configuration for all 7 agent queue buttons
 * Ensures identical architecture and behavior across all agents
 */

export type AgentType = 'clinical' | 'legal' | 'commercial' | 'hr' | 'financial' | 'ip' | 'research';

export interface AgentQueueConfig {
  agentType: AgentType;
  displayName: string;
  apiPath: string;
  processingGradient: string;
  pollInterval: number;
  cacheKeysToInvalidate: (dealId: number) => string[];
  testId: string;
}

export const AGENT_CONFIGS: Record<AgentType, AgentQueueConfig> = {
  clinical: {
    agentType: 'clinical',
    displayName: 'Clinical',
    apiPath: 'clinical-analysis',
    processingGradient: 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20',
    pollInterval: 2000,
    cacheKeysToInvalidate: (dealId: number) => [
      `/api/deals/${dealId}/clinical-analysis/comprehensive/results`,
      `/api/deals/${dealId}/agents/clinical/results`,
      `/api/deals/${dealId}/agents/analysis`,
    ],
    testId: 'clinical',
  },
  legal: {
    agentType: 'legal',
    displayName: 'Legal',
    apiPath: 'legal-analysis',
    processingGradient: 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20',
    pollInterval: 2000,
    cacheKeysToInvalidate: (dealId: number) => [
      `/api/deals/${dealId}/legal-analysis/comprehensive/results`,
      `/api/deals/${dealId}/agents/legal/results`,
      `/api/deals/${dealId}/agents/analysis`,
    ],
    testId: 'legal',
  },
  commercial: {
    agentType: 'commercial',
    displayName: 'Commercial',
    apiPath: 'commercial-analysis',
    processingGradient: 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20',
    pollInterval: 2000,
    cacheKeysToInvalidate: (dealId: number) => [
      `/api/deals/${dealId}/commercial-analysis/comprehensive/results`,
      `/api/deals/${dealId}/agents/commercial/results`,
      `/api/deals/${dealId}/agents/analysis`,
    ],
    testId: 'commercial',
  },
  hr: {
    agentType: 'hr',
    displayName: 'HR',
    apiPath: 'hr-analysis',
    processingGradient: 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20',
    pollInterval: 2000,
    cacheKeysToInvalidate: (dealId: number) => [
      `/api/deals/${dealId}/hr-analysis/comprehensive/results`,
      `/api/deals/${dealId}/agents/hr/results`,
      `/api/deals/${dealId}/agents/analysis`,
    ],
    testId: 'hr',
  },
  financial: {
    agentType: 'financial',
    displayName: 'Financial',
    apiPath: 'financial-analysis',
    processingGradient: 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20',
    pollInterval: 2000,
    cacheKeysToInvalidate: (dealId: number) => [
      `/api/deals/${dealId}/financial-analysis/comprehensive/results`,
      `/api/deals/${dealId}/agents/financial/results`,
      `/api/deals/${dealId}/agents/analysis`,
    ],
    testId: 'financial',
  },
  ip: {
    agentType: 'ip',
    displayName: 'IP',
    apiPath: 'ip-analysis',
    processingGradient: 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20',
    pollInterval: 2000,
    cacheKeysToInvalidate: (dealId: number) => [
      `/api/deals/${dealId}/ip-analysis/comprehensive`,
      `/api/deals/${dealId}/ip-analysis/comprehensive/results`,
      `/api/deals/${dealId}/agents/ip/results`,
      `/api/deals/${dealId}/agents/analysis`,
    ],
    testId: 'ip',
  },
  research: {
    agentType: 'research',
    displayName: 'Research',
    apiPath: 'research-analysis',
    processingGradient: 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20',
    pollInterval: 2000,
    cacheKeysToInvalidate: (dealId: number) => [
      `/api/deals/${dealId}/research-analysis/comprehensive/results`,
      `/api/deals/${dealId}/agents/research/results`,
      `/api/deals/${dealId}/agents/analysis`,
    ],
    testId: 'research',
  },
};

export interface QueueStatus {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  progress: number;
  currentQuestion: string | null;
  currentQuestionId?: string | null;
  isProcessing: boolean;
}

export interface AgentRunQueueEntry {
  agentType: string;
  status: string;
  position: number;
  totalQuestions: number;
  completedQuestions: number;
  currentStep: string | null;
}
