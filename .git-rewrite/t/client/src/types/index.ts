// User Types
export interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  role: 'Analyst' | 'Partner' | 'Admin';
}

// Deal Types
export interface Deal {
  id: number;
  companyName: string;
  description: string;
  sector: string;
  stage: string;
  location: string;
  fundingAmount: number;
  aiScore: number;
  status: string;
  createdAt: string;
  documents: Document[];
}

export interface Document {
  id: number;
  dealId: number;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  status: 'Analyzing' | 'Analyzed' | 'Pending';
}

// Due Diligence Types
export interface AgentAnalysis {
  id: number;
  dealId: number;
  agentType: 'Legal' | 'Finance' | 'Medical' | 'Commercial';
  status: 'In Progress' | 'Complete' | 'Waiting';
  progress: number;
  findings: Finding[];
  recommendations: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Finding {
  id: number;
  analysisId: number;
  content: string;
  type: 'Positive' | 'Negative' | 'Warning' | 'Info';
}

// Investment Memo Types
export interface InvestmentMemo {
  id: number;
  dealId: number;
  executiveSummary: string;
  productMarket: string;
  team: TeamMember[];
  financials: Financials;
  swot: SWOT;
  status: 'Draft' | 'Final';
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: number;
  name: string;
  title: string;
  background: string;
}

export interface Financials {
  burnRate: number;
  runway: number;
  funding: FundingRound[];
  metrics: { [key: string]: any };
  useOfFunds: { [key: string]: number };
}

export interface FundingRound {
  round: string;
  amount: number;
  date: string;
  investors: string[];
}

export interface SWOT {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

// Investor Matching Types
export interface Investor {
  id: number;
  name: string;
  location: string;
  focus: string[];
  stages: string[];
  checkSize: string;
  matchScore: number;
  portfolio: string[];
  matchInsights: string[];
}

// Workflow Automation Types
export interface Automation {
  id: number;
  name: string;
  description: string;
  trigger: string;
  action: string;
  scope: string;
  isActive: boolean;
  createdAt: string;
}

// Dashboard Types
export interface DashboardStats {
  deals: number;
  dueDiligence: number;
  memos: number;
  investors: number;
}

export interface Activity {
  id: number;
  agentType: string;
  content: string;
  timestamp: string;
}

export interface Reminder {
  id: number;
  title: string;
  description: string;
  deadline: string;
  type: string;
  actions: string[];
}
