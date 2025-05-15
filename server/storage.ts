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
import { db } from './db';
import { eq, and, desc } from 'drizzle-orm';

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

// Database implementation of the storage interface
export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Since we don't have a username field, search by email as a fallback
    return this.getUserByEmail(username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }
  
  // Deal methods
  async getAllDeals(): Promise<Deal[]> {
    const dealList = await db.select().from(deals).orderBy(desc(deals.createdAt));
    return dealList;
  }

  async getDealById(id: number): Promise<Deal | undefined> {
    const [deal] = await db.select().from(deals).where(eq(deals.id, id));
    return deal;
  }

  async createDeal(deal: InsertDeal): Promise<Deal> {
    const [newDeal] = await db.insert(deals).values(deal).returning();
    return newDeal;
  }

  async updateDealAiScore(id: number, score: number): Promise<Deal | undefined> {
    const [updatedDeal] = await db
      .update(deals)
      .set({ aiScore: score })
      .where(eq(deals.id, id))
      .returning();
    return updatedDeal;
  }

  async updateDealStatus(id: number, status: string): Promise<Deal | undefined> {
    const [updatedDeal] = await db
      .update(deals)
      .set({ status })
      .where(eq(deals.id, id))
      .returning();
    return updatedDeal;
  }
  
  // Document methods
  async getAllDocuments(): Promise<Document[]> {
    const documentList = await db.select().from(documents).orderBy(desc(documents.uploadedAt));
    return documentList;
  }

  async getDocumentById(id: number): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document;
  }

  async getDocumentsByDealId(dealId: number): Promise<Document[]> {
    const documentList = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, dealId))
      .orderBy(desc(documents.uploadedAt));
    return documentList;
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db.insert(documents).values(document).returning();
    return newDocument;
  }

  async updateDocumentStatus(id: number, status: string): Promise<Document | undefined> {
    const [updatedDocument] = await db
      .update(documents)
      .set({ status })
      .where(eq(documents.id, id))
      .returning();
    return updatedDocument;
  }
  
  // Agent analysis methods
  async getAllAnalyses(): Promise<AgentAnalysis[]> {
    const analysisList = await db.select().from(agentAnalyses).orderBy(desc(agentAnalyses.createdAt));
    return analysisList;
  }

  async getAnalysisById(id: number): Promise<AgentAnalysis | undefined> {
    const [analysis] = await db.select().from(agentAnalyses).where(eq(agentAnalyses.id, id));
    return analysis;
  }

  async getAnalysesByDealId(dealId: number): Promise<AgentAnalysis[]> {
    const analysisList = await db
      .select()
      .from(agentAnalyses)
      .where(eq(agentAnalyses.dealId, dealId))
      .orderBy(desc(agentAnalyses.createdAt));
    return analysisList;
  }

  async createAgentAnalysis(analysis: InsertAgentAnalysis): Promise<AgentAnalysis> {
    const [newAnalysis] = await db.insert(agentAnalyses).values(analysis).returning();
    return newAnalysis;
  }

  async updateAgentAnalysis(id: number, data: Partial<AgentAnalysis>): Promise<AgentAnalysis | undefined> {
    // Create a safe update object
    const updateData: any = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.progress !== undefined) updateData.progress = data.progress;
    if (data.findings !== undefined) updateData.findings = data.findings;
    if (data.recommendations !== undefined) updateData.recommendations = data.recommendations;
    updateData.updatedAt = new Date();

    const [updatedAnalysis] = await db
      .update(agentAnalyses)
      .set(updateData)
      .where(eq(agentAnalyses.id, id))
      .returning();
    return updatedAnalysis;
  }
  
  // Investment memo methods
  async getAllMemos(): Promise<InvestmentMemo[]> {
    const memoList = await db.select().from(investmentMemos).orderBy(desc(investmentMemos.createdAt));
    return memoList;
  }

  async getMemoById(id: number): Promise<InvestmentMemo | undefined> {
    const [memo] = await db.select().from(investmentMemos).where(eq(investmentMemos.id, id));
    return memo;
  }

  async getMemoByDealId(dealId: number): Promise<InvestmentMemo | undefined> {
    const [memo] = await db
      .select()
      .from(investmentMemos)
      .where(eq(investmentMemos.dealId, dealId))
      .orderBy(desc(investmentMemos.createdAt));
    return memo;
  }

  async createInvestmentMemo(memo: InsertInvestmentMemo): Promise<InvestmentMemo> {
    const [newMemo] = await db.insert(investmentMemos).values(memo).returning();
    return newMemo;
  }

  async updateMemo(id: number, data: Partial<InvestmentMemo>): Promise<InvestmentMemo | undefined> {
    // Create a safe update object
    const updateData: any = {};
    if (data.executiveSummary !== undefined) updateData.executiveSummary = data.executiveSummary;
    if (data.productMarket !== undefined) updateData.productMarket = data.productMarket;
    if (data.team !== undefined) updateData.team = data.team;
    if (data.financials !== undefined) updateData.financials = data.financials;
    if (data.swot !== undefined) updateData.swot = data.swot;
    if (data.status !== undefined) updateData.status = data.status;
    updateData.updatedAt = new Date();

    const [updatedMemo] = await db
      .update(investmentMemos)
      .set(updateData)
      .where(eq(investmentMemos.id, id))
      .returning();
    return updatedMemo;
  }
  
  // Investor methods
  async getAllInvestors(): Promise<Investor[]> {
    const investorList = await db.select().from(investors).orderBy(desc(investors.createdAt));
    return investorList;
  }

  async getInvestorById(id: number): Promise<Investor | undefined> {
    const [investor] = await db.select().from(investors).where(eq(investors.id, id));
    return investor;
  }

  async createInvestor(investor: InsertInvestor): Promise<Investor> {
    const [newInvestor] = await db.insert(investors).values(investor).returning();
    return newInvestor;
  }
  
  // Investor match methods
  async getAllInvestorMatches(): Promise<InvestorMatch[]> {
    const matchList = await db.select().from(investorMatches).orderBy(desc(investorMatches.createdAt));
    return matchList;
  }

  async getInvestorMatchById(id: number): Promise<InvestorMatch | undefined> {
    const [match] = await db.select().from(investorMatches).where(eq(investorMatches.id, id));
    return match;
  }

  async getInvestorMatchesByDealId(dealId: number): Promise<InvestorMatch[]> {
    const matchList = await db
      .select()
      .from(investorMatches)
      .where(eq(investorMatches.dealId, dealId))
      .orderBy(desc(investorMatches.createdAt));
    return matchList;
  }

  async createInvestorMatch(match: InsertInvestorMatch): Promise<InvestorMatch> {
    const [newMatch] = await db.insert(investorMatches).values(match).returning();
    return newMatch;
  }

  async updateInvestorMatchStatus(id: number, status: string): Promise<InvestorMatch | undefined> {
    const [updatedMatch] = await db
      .update(investorMatches)
      .set({ 
        status,
        updatedAt: new Date()
      })
      .where(eq(investorMatches.id, id))
      .returning();
    return updatedMatch;
  }
  
  // Automation methods
  async getAllAutomations(): Promise<Automation[]> {
    const automationList = await db.select().from(automations).orderBy(desc(automations.createdAt));
    return automationList;
  }

  async getAutomationById(id: number): Promise<Automation | undefined> {
    const [automation] = await db.select().from(automations).where(eq(automations.id, id));
    return automation;
  }

  async createAutomation(automation: InsertAutomation): Promise<Automation> {
    const [newAutomation] = await db.insert(automations).values(automation).returning();
    return newAutomation;
  }

  async toggleAutomation(id: number): Promise<Automation | undefined> {
    // First get the current automation to toggle its status
    const [currentAutomation] = await db.select().from(automations).where(eq(automations.id, id));
    
    if (!currentAutomation) return undefined;
    
    const [updatedAutomation] = await db
      .update(automations)
      .set({ 
        isActive: !currentAutomation.isActive,
        updatedAt: new Date() 
      })
      .where(eq(automations.id, id))
      .returning();
    
    return updatedAutomation;
  }
}

// Export the database storage instance
export const storage = new DatabaseStorage();