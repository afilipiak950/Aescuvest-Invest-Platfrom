import { 
  users, User, InsertUser,
  deals, Deal, InsertDeal,
  documents, Document, InsertDocument,
  agentAnalyses, AgentAnalysis, InsertAgentAnalysis,
  investmentMemos, InvestmentMemo, InsertInvestmentMemo,
  investors, Investor, InsertInvestor,
  investorMatches, InvestorMatch, InsertInvestorMatch,
  automations, Automation, InsertAutomation
} from "@shared/schema";

// Storage interface with all the CRUD methods we need
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Deal methods
  getAllDeals(): Promise<Deal[]>;
  getDealById(id: number): Promise<Deal | undefined>;
  createDeal(deal: InsertDeal): Promise<Deal>;
  updateDealAiScore(id: number, score: number): Promise<Deal | undefined>;
  updateDealStatus(id: number, status: string): Promise<Deal | undefined>;
  
  // Document methods
  getAllDocuments(): Promise<Document[]>;
  getDocumentById(id: number): Promise<Document | undefined>;
  getDocumentsByDealId(dealId: number): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocumentStatus(id: number, status: string): Promise<Document | undefined>;
  
  // Agent analysis methods
  getAllAnalyses(): Promise<AgentAnalysis[]>;
  getAnalysisById(id: number): Promise<AgentAnalysis | undefined>;
  getAnalysesByDealId(dealId: number): Promise<AgentAnalysis[]>;
  createAgentAnalysis(analysis: InsertAgentAnalysis): Promise<AgentAnalysis>;
  updateAgentAnalysis(id: number, data: Partial<AgentAnalysis>): Promise<AgentAnalysis | undefined>;
  
  // Investment memo methods
  getAllMemos(): Promise<InvestmentMemo[]>;
  getMemoById(id: number): Promise<InvestmentMemo | undefined>;
  getMemoByDealId(dealId: number): Promise<InvestmentMemo | undefined>;
  createInvestmentMemo(memo: InsertInvestmentMemo): Promise<InvestmentMemo>;
  updateMemo(id: number, data: Partial<InvestmentMemo>): Promise<InvestmentMemo | undefined>;
  
  // Investor methods
  getAllInvestors(): Promise<Investor[]>;
  getInvestorById(id: number): Promise<Investor | undefined>;
  createInvestor(investor: InsertInvestor): Promise<Investor>;
  
  // Investor match methods
  getAllInvestorMatches(): Promise<InvestorMatch[]>;
  getInvestorMatchById(id: number): Promise<InvestorMatch | undefined>;
  getInvestorMatchesByDealId(dealId: number): Promise<InvestorMatch[]>;
  createInvestorMatch(match: InsertInvestorMatch): Promise<InvestorMatch>;
  updateInvestorMatchStatus(id: number, status: string): Promise<InvestorMatch | undefined>;
  
  // Automation methods
  getAllAutomations(): Promise<Automation[]>;
  getAutomationById(id: number): Promise<Automation | undefined>;
  createAutomation(automation: InsertAutomation): Promise<Automation>;
  toggleAutomation(id: number): Promise<Automation | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private deals: Map<number, Deal>;
  private documents: Map<number, Document>;
  private analyses: Map<number, AgentAnalysis>;
  private memos: Map<number, InvestmentMemo>;
  private investors: Map<number, Investor>;
  private matches: Map<number, InvestorMatch>;
  private automations: Map<number, Automation>;
  
  private userIdCounter: number;
  private dealIdCounter: number;
  private documentIdCounter: number;
  private analysisIdCounter: number;
  private memoIdCounter: number;
  private investorIdCounter: number;
  private matchIdCounter: number;
  private automationIdCounter: number;
  
  constructor() {
    this.users = new Map();
    this.deals = new Map();
    this.documents = new Map();
    this.analyses = new Map();
    this.memos = new Map();
    this.investors = new Map();
    this.matches = new Map();
    this.automations = new Map();
    
    this.userIdCounter = 1;
    this.dealIdCounter = 1;
    this.documentIdCounter = 1;
    this.analysisIdCounter = 1;
    this.memoIdCounter = 1;
    this.investorIdCounter = 1;
    this.matchIdCounter = 1;
    this.automationIdCounter = 1;
    
    this.initializeMockData();
  }
  
  // Initialize some mock data for demo purposes
  private initializeMockData() {
    // Add a default user
    this.createUser({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password123',
      role: 'Analyst'
    });
    
    // Add mock deals
    const deal1 = this.createDeal({
      companyName: 'NeuroTech AI',
      description: 'Brain-computer interface',
      sector: 'MedTech',
      stage: 'Series A',
      location: 'Berlin, Germany',
      website: 'https://neurotech.ai',
      fundingAmount: 8500000,
      status: 'Due Diligence'
    });
    
    this.updateDealAiScore(deal1.id, 85);
    
    const deal2 = this.createDeal({
      companyName: 'GeneMap+',
      description: 'Genomic sequencing platform',
      sector: 'BioTech',
      stage: 'Seed',
      location: 'Zurich, Switzerland',
      website: 'https://genemap.bio',
      fundingAmount: 2000000,
      status: 'Screening'
    });
    
    this.updateDealAiScore(deal2.id, 92);
    
    const deal3 = this.createDeal({
      companyName: 'HealthMetrics',
      description: 'Remote patient monitoring',
      sector: 'HealthTech',
      stage: 'Series B',
      location: 'London, UK',
      website: 'https://healthmetrics.io',
      fundingAmount: 12000000,
      status: 'Memo Ready'
    });
    
    this.updateDealAiScore(deal3.id, 78);
    
    const deal4 = this.createDeal({
      companyName: 'MediDrone',
      description: 'Autonomous medical delivery',
      sector: 'MedTech',
      stage: 'Pre-Seed',
      location: 'Munich, Germany',
      website: 'https://medidrone.com',
      fundingAmount: 500000,
      status: 'New Submission'
    });
    
    this.updateDealAiScore(deal4.id, 65);
    
    // Add sample documents for first deal
    this.createDocument({
      dealId: 1,
      name: 'NeuroTech_Pitch_Deck.pdf',
      type: 'pdf',
      path: '/uploads/sample/pitch_deck.pdf',
      size: 2500000,
      status: 'Analyzed'
    });
    
    this.createDocument({
      dealId: 1,
      name: 'Financial_Model_2023.xlsx',
      type: 'xlsx',
      path: '/uploads/sample/financials.xlsx',
      size: 1500000,
      status: 'Analyzed'
    });
    
    this.createDocument({
      dealId: 1,
      name: 'Clinical_Trial_Results.docx',
      type: 'docx',
      path: '/uploads/sample/clinical_trials.docx',
      size: 3800000,
      status: 'Analyzing'
    });
    
    this.createDocument({
      dealId: 1,
      name: 'Cap_Table_May2023.pdf',
      type: 'pdf',
      path: '/uploads/sample/cap_table.pdf',
      size: 900000,
      status: 'Analyzed'
    });
    
    this.createDocument({
      dealId: 1,
      name: 'Patents_Overview.pdf',
      type: 'pdf',
      path: '/uploads/sample/patents.pdf',
      size: 1200000,
      status: 'Analyzed'
    });
    
    // Add agent analyses for first deal
    this.createAgentAnalysis({
      dealId: 1,
      agentType: 'Legal',
      status: 'Complete',
      findings: [
        { id: 1, content: 'Company incorporation documents are valid and complete', type: 'Positive' },
        { id: 2, content: 'IP ownership is properly documented for core technology', type: 'Positive' },
        { id: 3, content: 'Potential issue with employee stock option plan documentation', type: 'Warning' }
      ],
      recommendations: [
        'Request formal regulatory timeline and FDA communication history to validate submission plans.',
        'Verify all inventor employment agreements to ensure IP ownership is properly assigned to the company.',
        'Schedule expert review of EU MDR strategy given recent regulatory changes affecting neural interface devices.'
      ]
    });
    
    this.createAgentAnalysis({
      dealId: 1,
      agentType: 'Finance',
      status: 'Complete',
      findings: [
        { id: 4, content: 'Financial projections are conservative and well-documented', type: 'Positive' },
        { id: 5, content: 'Customer acquisition costs are higher than industry benchmark', type: 'Negative' }
      ],
      recommendations: [
        'Review sensitivity analysis for customer acquisition efficiency improvements.',
        'Benchmark financial projections against recent comparable company exits in the neurotech space.',
        'Validate hardware manufacturing cost assumptions with industry experts.'
      ]
    });
    
    this.createAgentAnalysis({
      dealId: 1,
      agentType: 'Medical',
      status: 'In Progress',
      progress: 68,
      findings: [
        { id: 6, content: 'Clinical validation study design meets industry standards', type: 'Positive' },
        { id: 7, content: 'Regulatory pathway is clearly defined for FDA clearance', type: 'Positive' }
      ],
      recommendations: []
    });
    
    this.createAgentAnalysis({
      dealId: 1,
      agentType: 'Commercial',
      status: 'Waiting',
      progress: 0,
      findings: [],
      recommendations: []
    });
    
    // Add investment memo for first deal
    this.createInvestmentMemo({
      dealId: 1,
      executiveSummary: "NeuroTech AI is developing a next-generation brain-computer interface (BCI) for patients with movement disorders and paralysis. The company's proprietary neural decoding algorithms allow for high-fidelity control of prosthetic devices and digital interfaces with minimal invasiveness compared to competitors.",
      productMarket: "Over 75 million people worldwide have movement disorders or paralysis that significantly impact quality of life and independence. Current solutions are either highly invasive (implanted electrodes) or provide limited functionality (EEG-based). NeuroTech's BCI system combines minimally invasive subdermal sensors with AI-powered neural decoding, enabling precise control of assistive devices. The platform is modular, supporting a range of applications from prosthetic limbs to digital interface control.",
      team: [
        {
          id: 1,
          name: 'Dr. Julia Schmidt',
          title: 'CEO & Co-founder',
          background: 'PhD Neuroscience, MIT • Previously: Researcher at Max Planck Institute'
        },
        {
          id: 2,
          name: 'Dr. Marco Reis',
          title: 'CTO & Co-founder',
          background: 'PhD Biomedical Engineering, ETH Zurich • Previously: Technical Lead at Medtronic'
        },
        {
          id: 3,
          name: 'Anna Lehmann',
          title: 'COO',
          background: 'MBA, INSEAD • Previously: VP Operations at Siemens Healthineers'
        }
      ],
      financials: {
        burnRate: 175000,
        runway: 6,
        funding: [
          {
            round: 'Seed',
            amount: 2500000,
            date: '2021',
            investors: ['High-Tech Gründerfonds', 'Business Angels']
          },
          {
            round: 'Grant',
            amount: 1200000,
            date: '2022',
            investors: ['EU Horizon Program']
          }
        ],
        metrics: {
          revenue2024: 1800000,
          revenue2025: 7500000
        },
        useOfFunds: {
          clinicalTrials: 40,
          rd: 30,
          regulatory: 15,
          operations: 15
        }
      },
      swot: {
        strengths: [
          'Proprietary algorithm with 92% accuracy in trials',
          'Strong IP portfolio with 3 granted patents',
          'Experienced team with domain expertise',
          'Minimally invasive approach balances precision with safety'
        ],
        weaknesses: [
          'Pre-revenue with long pathway to commercialization',
          'Limited clinical data compared to competitors',
          'Manufacturing scalability remains unproven',
          'High customer acquisition costs in medical market'
        ],
        opportunities: [
          'Aging population driving demand for assistive technologies',
          'Expansion into consumer applications (VR/AR control)',
          'Potential partnerships with prosthetics manufacturers',
          'Government reimbursement programs in EU and US'
        ],
        threats: [
          'Regulatory delays could extend time to market',
          'Well-funded competitors (Neuralink, Kernel)',
          'Potential privacy concerns with neural data',
          'Reimbursement uncertainty in key markets'
        ]
      },
      status: 'Draft'
    });
    
    // Add mock investors
    this.createInvestor({
      name: 'Health Ventures Capital',
      location: 'Berlin, Germany',
      focus: ['HealthTech', 'MedTech', 'Digital Health'],
      stages: ['Series A', 'Series B'],
      checkSize: '€2M - €8M',
      portfolio: ['Cortex Medical', 'DigiHealth', 'MedSense', 'NeuraTech']
    });
    
    this.createInvestor({
      name: 'Innovation Neuro Fund',
      location: 'Zurich, Switzerland',
      focus: ['Neurotechnology', 'BCI', 'Medical Devices'],
      stages: ['Series A', 'Series B'],
      checkSize: '€3M - €10M',
      portfolio: ['NeuraTech', 'BrainSync', 'NeuroPulse', 'Minder']
    });
    
    this.createInvestor({
      name: 'MedTech Partners',
      location: 'Munich, Germany',
      focus: ['MedTech', 'HealthTech', 'Life Sciences'],
      stages: ['Series A', 'Series B', 'Growth'],
      checkSize: '€5M - €15M',
      portfolio: ['MedSense', 'ImplantTech', 'Cardios', 'NeuroSolutions']
    });
    
    // Add investor matches
    this.createInvestorMatch({
      dealId: 1,
      investorId: 1,
      matchScore: 94,
      matchInsights: [
        'Previously invested in neural interface startup Cortex Medical',
        'Portfolio includes 3 medical device companies',
        'Led Series A round for similar German healthtech startup',
        'Has co-investment history with existing investor HTGF'
      ],
      status: 'New Match'
    });
    
    this.createInvestorMatch({
      dealId: 1,
      investorId: 2,
      matchScore: 92,
      matchInsights: [
        'Specialist fund focused exclusively on neurotechnology',
        'Partner Dr. Müller has background in neural interfaces',
        'Looking specifically for BCI investments in 2023',
        'Recently closed a competitive investment (potential conflict)'
      ],
      status: 'New Match'
    });
    
    this.createInvestorMatch({
      dealId: 1,
      investorId: 3,
      matchScore: 88,
      matchInsights: [
        'Strong track record in medical device investments',
        'Strategic partnerships with major healthcare providers',
        'Supports portfolio with regulatory expertise',
        'Typically invests larger amounts than current round size'
      ],
      status: 'New Match'
    });
    
    // Add automations
    this.createAutomation({
      name: 'Follow-up Reminders',
      description: 'Sends notifications for pending investor responses',
      trigger: '5 days after outreach with no response',
      action: 'Email notification + Dashboard alert',
      scope: 'All deals in Investor Matching phase',
      isActive: true
    });
    
    this.createAutomation({
      name: 'NDA Status Tracker',
      description: 'Monitors DocuSign status of NDA documents',
      trigger: 'DocuSign status change',
      action: 'Update deal status + Notify team',
      scope: 'New deals with pending NDAs',
      isActive: true
    });
    
    this.createAutomation({
      name: 'Due Diligence Deadline Alerts',
      description: 'Alerts team when DD deadlines are approaching',
      trigger: '3 days before deadline',
      action: 'Slack notification + Email to responsible team member',
      scope: 'Active due diligence deals',
      isActive: false
    });
    
    this.createAutomation({
      name: 'Investment Committee Reminders',
      description: 'Automatically schedules IC meetings for deals with complete memos',
      trigger: 'Memo status changed to Final',
      action: 'Create calendar event + Distribute memo',
      scope: 'Deals with final investment memos',
      isActive: true
    });
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.name === username);
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }
  
  async createUser(userData: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const now = new Date().toISOString();
    
    const user: User = {
      id,
      ...userData,
      createdAt: now,
      updatedAt: now
    };
    
    this.users.set(id, user);
    return user;
  }
  
  // Deal methods
  async getAllDeals(): Promise<Deal[]> {
    return Array.from(this.deals.values());
  }
  
  async getDealById(id: number): Promise<Deal | undefined> {
    return this.deals.get(id);
  }
  
  async createDeal(dealData: InsertDeal): Promise<Deal> {
    const id = this.dealIdCounter++;
    const now = new Date().toISOString();
    
    const deal: Deal = {
      id,
      ...dealData,
      aiScore: 0, // Will be updated later
      createdAt: now,
      updatedAt: now
    };
    
    this.deals.set(id, deal);
    return deal;
  }
  
  async updateDealAiScore(id: number, score: number): Promise<Deal | undefined> {
    const deal = this.deals.get(id);
    if (!deal) return undefined;
    
    const updatedDeal: Deal = {
      ...deal,
      aiScore: score,
      updatedAt: new Date().toISOString()
    };
    
    this.deals.set(id, updatedDeal);
    return updatedDeal;
  }
  
  async updateDealStatus(id: number, status: string): Promise<Deal | undefined> {
    const deal = this.deals.get(id);
    if (!deal) return undefined;
    
    const updatedDeal: Deal = {
      ...deal,
      status,
      updatedAt: new Date().toISOString()
    };
    
    this.deals.set(id, updatedDeal);
    return updatedDeal;
  }
  
  // Document methods
  async getAllDocuments(): Promise<Document[]> {
    return Array.from(this.documents.values());
  }
  
  async getDocumentById(id: number): Promise<Document | undefined> {
    return this.documents.get(id);
  }
  
  async getDocumentsByDealId(dealId: number): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(doc => doc.dealId === dealId);
  }
  
  async createDocument(documentData: InsertDocument): Promise<Document> {
    const id = this.documentIdCounter++;
    const now = new Date().toISOString();
    
    const document: Document = {
      id,
      ...documentData,
      uploadedAt: now
    };
    
    this.documents.set(id, document);
    return document;
  }
  
  async updateDocumentStatus(id: number, status: string): Promise<Document | undefined> {
    const document = this.documents.get(id);
    if (!document) return undefined;
    
    const updatedDocument: Document = {
      ...document,
      status
    };
    
    this.documents.set(id, updatedDocument);
    return updatedDocument;
  }
  
  // Agent analysis methods
  async getAllAnalyses(): Promise<AgentAnalysis[]> {
    return Array.from(this.analyses.values());
  }
  
  async getAnalysisById(id: number): Promise<AgentAnalysis | undefined> {
    return this.analyses.get(id);
  }
  
  async getAnalysesByDealId(dealId: number): Promise<AgentAnalysis[]> {
    return Array.from(this.analyses.values()).filter(analysis => analysis.dealId === dealId);
  }
  
  async createAgentAnalysis(analysisData: InsertAgentAnalysis): Promise<AgentAnalysis> {
    const id = this.analysisIdCounter++;
    const now = new Date().toISOString();
    
    const analysis: AgentAnalysis = {
      id,
      ...analysisData,
      progress: analysisData.status === 'Complete' ? 100 : (analysisData.status === 'Waiting' ? 0 : 50),
      findings: analysisData.findings || [],
      recommendations: analysisData.recommendations || [],
      createdAt: now,
      updatedAt: now
    };
    
    this.analyses.set(id, analysis);
    return analysis;
  }
  
  async updateAgentAnalysis(id: number, data: Partial<AgentAnalysis>): Promise<AgentAnalysis | undefined> {
    const analysis = this.analyses.get(id);
    if (!analysis) return undefined;
    
    const updatedAnalysis: AgentAnalysis = {
      ...analysis,
      ...data,
      updatedAt: new Date().toISOString()
    };
    
    this.analyses.set(id, updatedAnalysis);
    return updatedAnalysis;
  }
  
  // Investment memo methods
  async getAllMemos(): Promise<InvestmentMemo[]> {
    return Array.from(this.memos.values());
  }
  
  async getMemoById(id: number): Promise<InvestmentMemo | undefined> {
    return this.memos.get(id);
  }
  
  async getMemoByDealId(dealId: number): Promise<InvestmentMemo | undefined> {
    return Array.from(this.memos.values()).find(memo => memo.dealId === dealId);
  }
  
  async createInvestmentMemo(memoData: InsertInvestmentMemo): Promise<InvestmentMemo> {
    const id = this.memoIdCounter++;
    const now = new Date().toISOString();
    
    const memo: InvestmentMemo = {
      id,
      ...memoData,
      team: memoData.team || [],
      financials: memoData.financials || { 
        burnRate: 0, 
        runway: 0, 
        funding: [], 
        metrics: {}, 
        useOfFunds: {} 
      },
      swot: memoData.swot || { 
        strengths: [], 
        weaknesses: [], 
        opportunities: [], 
        threats: [] 
      },
      createdAt: now,
      updatedAt: now
    };
    
    this.memos.set(id, memo);
    return memo;
  }
  
  async updateMemo(id: number, data: Partial<InvestmentMemo>): Promise<InvestmentMemo | undefined> {
    const memo = this.memos.get(id);
    if (!memo) return undefined;
    
    const updatedMemo: InvestmentMemo = {
      ...memo,
      ...data,
      updatedAt: new Date().toISOString()
    };
    
    this.memos.set(id, updatedMemo);
    return updatedMemo;
  }
  
  // Investor methods
  async getAllInvestors(): Promise<Investor[]> {
    return Array.from(this.investors.values());
  }
  
  async getInvestorById(id: number): Promise<Investor | undefined> {
    return this.investors.get(id);
  }
  
  async createInvestor(investorData: InsertInvestor): Promise<Investor> {
    const id = this.investorIdCounter++;
    const now = new Date().toISOString();
    
    const investor: Investor = {
      id,
      ...investorData,
      focus: investorData.focus || [],
      stages: investorData.stages || [],
      portfolio: investorData.portfolio || [],
      createdAt: now,
      updatedAt: now
    };
    
    this.investors.set(id, investor);
    return investor;
  }
  
  // Investor match methods
  async getAllInvestorMatches(): Promise<InvestorMatch[]> {
    return Array.from(this.matches.values());
  }
  
  async getInvestorMatchById(id: number): Promise<InvestorMatch | undefined> {
    return this.matches.get(id);
  }
  
  async getInvestorMatchesByDealId(dealId: number): Promise<InvestorMatch[]> {
    return Array.from(this.matches.values()).filter(match => match.dealId === dealId);
  }
  
  async createInvestorMatch(matchData: InsertInvestorMatch): Promise<InvestorMatch> {
    const id = this.matchIdCounter++;
    const now = new Date().toISOString();
    
    const match: InvestorMatch = {
      id,
      ...matchData,
      matchInsights: matchData.matchInsights || [],
      createdAt: now,
      updatedAt: now
    };
    
    this.matches.set(id, match);
    return match;
  }
  
  async updateInvestorMatchStatus(id: number, status: string): Promise<InvestorMatch | undefined> {
    const match = this.matches.get(id);
    if (!match) return undefined;
    
    const updatedMatch: InvestorMatch = {
      ...match,
      status,
      updatedAt: new Date().toISOString()
    };
    
    this.matches.set(id, updatedMatch);
    return updatedMatch;
  }
  
  // Automation methods
  async getAllAutomations(): Promise<Automation[]> {
    return Array.from(this.automations.values());
  }
  
  async getAutomationById(id: number): Promise<Automation | undefined> {
    return this.automations.get(id);
  }
  
  async createAutomation(automationData: InsertAutomation): Promise<Automation> {
    const id = this.automationIdCounter++;
    const now = new Date().toISOString();
    
    const automation: Automation = {
      id,
      ...automationData,
      createdAt: now,
      updatedAt: now
    };
    
    this.automations.set(id, automation);
    return automation;
  }
  
  async toggleAutomation(id: number): Promise<Automation | undefined> {
    const automation = this.automations.get(id);
    if (!automation) return undefined;
    
    const updatedAutomation: Automation = {
      ...automation,
      isActive: !automation.isActive,
      updatedAt: new Date().toISOString()
    };
    
    this.automations.set(id, updatedAutomation);
    return updatedAutomation;
  }
}

export const storage = new MemStorage();
