import { 
  users, User, InsertUser,
  deals, Deal, InsertDeal,
  documents, Document, InsertDocument,
  agentAnalyses, AgentAnalysis, InsertAgentAnalysis,
  investmentMemos, InvestmentMemo, InsertInvestmentMemo,
  investors, Investor, InsertInvestor,
  investorMatches, InvestorMatch, InsertInvestorMatch,
  automations, Automation, InsertAutomation,
  companyResearch,
  dataRoomConnections, DataRoomConnection, InsertDataRoomConnection,
  microsoftEmailConnections, MicrosoftEmailConnection, InsertMicrosoftEmailConnection
} from "@shared/schema";
import { db, pool } from './db';
import { eq, and, desc, inArray } from 'drizzle-orm';

// Storage interface with all the CRUD methods we need
export interface IStorage {
  // User methods
  getAllUsers(): Promise<User[]>;
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
  updateDocumentWithOCR(id: number, ocrText: string, status: string): Promise<Document | undefined>;
  deleteDocuments(fileIds: number[]): Promise<number>;
  
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
  
  // Evaluation criteria methods
  getAllEvaluationCriteria(): Promise<any[]>;
  getEvaluationCriteriaById(id: number): Promise<any | undefined>;
  createEvaluationCriteria(criteria: any): Promise<any>;
  updateEvaluationCriteria(id: number, data: any): Promise<any | undefined>;
  
  // Evaluation results methods
  getAllEvaluationResults(): Promise<any[]>;
  getEvaluationResultsByDealId(dealId: number): Promise<any[]>;
  createEvaluationResult(result: any): Promise<any>;
  
  // Company research methods
  getCompanyResearchByDealId(dealId: number): Promise<any | undefined>;
  createCompanyResearch(research: any): Promise<any>;
  updateCompanyResearchStatus(dealId: number, status: string): Promise<any | undefined>;
  
  // Data room connection methods
  getDataRoomConnectionByDealId(dealId: number): Promise<any | undefined>;
  createDataRoomConnection(connection: any): Promise<any>;
  
  // Microsoft Email Connection methods
  getMicrosoftEmailConnection(): Promise<MicrosoftEmailConnection | undefined>;
  saveMicrosoftEmailConnection(connection: InsertMicrosoftEmailConnection): Promise<MicrosoftEmailConnection>;
  updateDataRoomConnection(id: number, data: any): Promise<any | undefined>;
  disconnectDataRoom(dealId: number): Promise<any | undefined>;
  
  // Microsoft email connection methods
  clearMicrosoftEmailConnection(): Promise<boolean>;
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  async getAllUsers(): Promise<User[]> {
    const result = await db.select().from(users);
    return result;
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Using email field as username field since there's no username column
    const [user] = await db.select().from(users).where(eq(users.email, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getAllDeals(): Promise<Deal[]> {
    const result = await db.select().from(deals).orderBy(desc(deals.createdAt));
    return result;
  }

  async getDealById(id: number): Promise<Deal | undefined> {
    const [deal] = await db.select().from(deals).where(eq(deals.id, id));
    return deal || undefined;
  }

  async createDeal(deal: InsertDeal): Promise<Deal> {
    const [newDeal] = await db.insert(deals).values(deal).returning();
    return newDeal;
  }

  async updateDealAiScore(id: number, score: number): Promise<Deal | undefined> {
    const [updatedDeal] = await db
      .update(deals)
      .set({ aiScore: score.toString() })
      .where(eq(deals.id, id))
      .returning();
    return updatedDeal || undefined;
  }

  async updateDealStatus(id: number, status: string): Promise<Deal | undefined> {
    const [updatedDeal] = await db
      .update(deals)
      .set({ status })
      .where(eq(deals.id, id))
      .returning();
    return updatedDeal || undefined;
  }

  async getAllDocuments(): Promise<Document[]> {
    const result = await db.select().from(documents).orderBy(desc(documents.createdAt));
    return result;
  }

  async getDocumentById(id: number): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document || undefined;
  }

  async getDocumentsByDealId(dealId: number): Promise<Document[]> {
    const result = await db.select().from(documents).where(eq(documents.dealId, dealId));
    return result;
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
    return updatedDocument || undefined;
  }

  async updateDocumentWithOCR(id: number, ocrText: string, status: string): Promise<Document | undefined> {
    const [updatedDocument] = await db
      .update(documents)
      .set({ ocrText, status })
      .where(eq(documents.id, id))
      .returning();
    return updatedDocument || undefined;
  }

  async deleteDocuments(fileIds: number[]): Promise<number> {
    if (fileIds.length === 0) return 0;
    const result = await db.delete(documents).where(inArray(documents.id, fileIds));
    return result.rowCount || 0;
  }

  // Company research methods
  async getCompanyResearchByDealId(dealId: number): Promise<any | undefined> {
    try {
      const [research] = await db
        .select()
        .from(companyResearch)
        .where(eq(companyResearch.dealId, dealId));
      
      if (!research) {
        return undefined;
      }
      
      // Transform database format to frontend format
      return {
        dealId: research.dealId,
        researchStatus: research.researchStatus,
        lastUpdated: research.updatedAt?.toISOString(),
        researchGeneratedAt: research.researchCompletedAt?.toISOString(),
        ceoProfile: research.ceoProfile,
        financialInsights: research.financialData,
        externalSources: research.externalLinks,
        businessIntelligence: research.businessIntelligence,
        investmentHighlights: research.investmentHighlights,
        riskAssessment: research.riskFactors
      };
    } catch (error) {
      console.error('Error fetching company research:', error);
      return undefined;
    }
  }

  async createCompanyResearch(research: any): Promise<any> {
    try {
      const [newResearch] = await db
        .insert(companyResearch)
        .values({
          dealId: research.dealId,
          ceoProfile: research.ceoProfile,
          keyTeamMembers: research.keyTeamMembers,
          financialData: research.financialInsights,
          marketAnalysis: research.businessIntelligence,
          externalLinks: research.externalSources,
          businessIntelligence: research.businessIntelligence,
          riskFactors: research.riskAssessment,
          investmentHighlights: research.investmentHighlights,
          researchStatus: 'completed',
          researchCompletedAt: new Date()
        })
        .returning();
      
      return newResearch;
    } catch (error) {
      console.error('Error creating company research:', error);
      throw error;
    }
  }

  async updateCompanyResearchStatus(dealId: number, status: string): Promise<any | undefined> {
    try {
      const [updated] = await db
        .update(companyResearch)
        .set({ researchStatus: status, updatedAt: new Date() })
        .where(eq(companyResearch.dealId, dealId))
        .returning();
      return updated;
    } catch (error) {
      console.error('Error updating company research status:', error);
      return { dealId, researchStatus: status };
    }
  }

  // Placeholder implementations for other methods
  async getAllAnalyses(): Promise<AgentAnalysis[]> {
    return [];
  }

  async getAnalysisById(id: number): Promise<AgentAnalysis | undefined> {
    return undefined;
  }

  async getAnalysesByDealId(dealId: number): Promise<AgentAnalysis[]> {
    return [];
  }

  async createAgentAnalysis(analysis: InsertAgentAnalysis): Promise<AgentAnalysis> {
    throw new Error('Not implemented');
  }

  async updateAgentAnalysis(id: number, data: Partial<AgentAnalysis>): Promise<AgentAnalysis | undefined> {
    return undefined;
  }

  async getAllMemos(): Promise<InvestmentMemo[]> {
    return [];
  }

  async getMemoById(id: number): Promise<InvestmentMemo | undefined> {
    return undefined;
  }

  async getMemoByDealId(dealId: number): Promise<InvestmentMemo | undefined> {
    return undefined;
  }

  async createInvestmentMemo(memo: InsertInvestmentMemo): Promise<InvestmentMemo> {
    throw new Error('Not implemented');
  }

  async updateMemo(id: number, data: Partial<InvestmentMemo>): Promise<InvestmentMemo | undefined> {
    return undefined;
  }

  async getAllInvestors(): Promise<Investor[]> {
    return [];
  }

  async getInvestorById(id: number): Promise<Investor | undefined> {
    return undefined;
  }

  async createInvestor(investor: InsertInvestor): Promise<Investor> {
    throw new Error('Not implemented');
  }

  async getAllInvestorMatches(): Promise<InvestorMatch[]> {
    return [];
  }

  async getInvestorMatchById(id: number): Promise<InvestorMatch | undefined> {
    return undefined;
  }

  async getInvestorMatchesByDealId(dealId: number): Promise<InvestorMatch[]> {
    return [];
  }

  async createInvestorMatch(match: InsertInvestorMatch): Promise<InvestorMatch> {
    throw new Error('Not implemented');
  }

  async updateInvestorMatchStatus(id: number, status: string): Promise<InvestorMatch | undefined> {
    return undefined;
  }

  async getAllAutomations(): Promise<Automation[]> {
    return [];
  }

  async getAutomationById(id: number): Promise<Automation | undefined> {
    return undefined;
  }

  async createAutomation(automation: InsertAutomation): Promise<Automation> {
    throw new Error('Not implemented');
  }

  async toggleAutomation(id: number): Promise<Automation | undefined> {
    return undefined;
  }

  async getAllEvaluationCriteria(): Promise<any[]> {
    return [];
  }

  async getEvaluationCriteriaById(id: number): Promise<any | undefined> {
    return undefined;
  }

  async createEvaluationCriteria(criteria: any): Promise<any> {
    return criteria;
  }

  async updateEvaluationCriteria(id: number, data: any): Promise<any | undefined> {
    return undefined;
  }

  async getAllEvaluationResults(): Promise<any[]> {
    return [];
  }

  async getEvaluationResultsByDealId(dealId: number): Promise<any[]> {
    return [];
  }

  async createEvaluationResult(result: any): Promise<any> {
    return result;
  }

  async getDataRoomConnectionByDealId(dealId: number): Promise<any | undefined> {
    return undefined;
  }

  async createDataRoomConnection(connection: any): Promise<any> {
    return connection;
  }

  async updateDataRoomConnection(id: number, data: any): Promise<any | undefined> {
    return undefined;
  }

  async disconnectDataRoom(dealId: number): Promise<any | undefined> {
    return undefined;
  }

  async getMicrosoftEmailConnection(): Promise<MicrosoftEmailConnection | undefined> {
    try {
      const [connection] = await db
        .select()
        .from(microsoftEmailConnections)
        .orderBy(desc(microsoftEmailConnections.lastUsedAt));
      return connection || undefined;
    } catch (error) {
      console.error('Error fetching Microsoft email connection:', error);
      return undefined;
    }
  }

  async saveMicrosoftEmailConnection(connection: InsertMicrosoftEmailConnection): Promise<MicrosoftEmailConnection> {
    try {
      const [newConnection] = await db
        .insert(microsoftEmailConnections)
        .values(connection)
        .returning();
      return newConnection;
    } catch (error) {
      console.error('Error saving Microsoft email connection:', error);
      throw error;
    }
  }

  async clearMicrosoftEmailConnection(): Promise<boolean> {
    try {
      await db.delete(microsoftEmailConnections);
      return true;
    } catch (error) {
      console.error('Error clearing Microsoft email connection:', error);
      return false;
    }
  }
}

export const storage = new DatabaseStorage();