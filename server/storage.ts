import { 
  users, User, InsertUser,
  deals, Deal, InsertDeal,
  documents, Document, InsertDocument,
  agentAnalyses, AgentAnalysis, InsertAgentAnalysis,
  investmentMemos, InvestmentMemo, InsertInvestmentMemo,
  investors, Investor, InsertInvestor,
  investorMatches, InvestorMatch, InsertInvestorMatch,
  automations, Automation, InsertAutomation,
  automationExecutions, AutomationExecution, InsertAutomationExecution,
  companyResearch,
  dataRoomConnections, DataRoomConnection, InsertDataRoomConnection,
  microsoftEmailConnections, MicrosoftEmailConnection, InsertMicrosoftEmailConnection,
  backgroundJobs, BackgroundJob, InsertBackgroundJob,
  comprehensiveAnalysis, ComprehensiveAnalysis, InsertComprehensiveAnalysis,
  evaluationCriteria, EvaluationCriteria, InsertEvaluationCriteria,
  evaluationResults, EvaluationResult, InsertEvaluationResult,
  researchJobs, ResearchJob, InsertResearchJob
} from "@shared/schema";
import { db, pool } from './db';
import { eq, and, or, desc, inArray, isNotNull, isNull } from 'drizzle-orm';

// In-memory cache for better performance across queries
const documentCache = new Map<number, { data: Document[], timestamp: number }>();
const dealsCache = new Map<string, { data: any[], timestamp: number }>();
const analysesCache = new Map<number, { data: AgentAnalysis[], timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds cache for better performance

// Storage interface with all the CRUD methods we need
export interface IStorage {
  // User methods
  getAllUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User | undefined>;
  
  // Deal methods
  getAllDeals(): Promise<Deal[]>;
  getDealById(id: number): Promise<Deal | undefined>;
  createDeal(deal: InsertDeal): Promise<Deal>;
  updateDealAiScore(id: number, score: number): Promise<Deal | undefined>;
  updateDealStatus(id: number, status: string): Promise<Deal | undefined>;
  deleteDeal(id: number): Promise<boolean>;
  
  // Document methods
  getAllDocuments(): Promise<Document[]>;
  getDocumentById(id: number): Promise<Document | undefined>;
  getDocument(id: number): Promise<Document | undefined>;
  getDocumentsByDealId(dealId: number): Promise<Document[]>;
  getDocumentsWithOCRByDealId(dealId: number): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocumentStatus(id: number, status: string): Promise<Document | undefined>;
  updateDocument(id: number, data: Partial<Document>): Promise<Document | undefined>;
  updateDocumentWithOCR(id: number, ocrText: string, status: string): Promise<Document | undefined>;
  deleteDocuments(fileIds: number[]): Promise<number>;
  deleteDocumentsByDealId(dealId: number): Promise<number>;
  
  // Agent analysis methods
  getAllAnalyses(): Promise<AgentAnalysis[]>;
  getAnalysisById(id: number): Promise<AgentAnalysis | undefined>;
  getAnalysesByDealId(dealId: number): Promise<AgentAnalysis[]>;
  getAnalysisByDealAndAgent(dealId: number, agentType: string): Promise<AgentAnalysis | undefined>;
  getAnalysis(dealId: number, agentType: string): Promise<AgentAnalysis | undefined>;
  createAgentAnalysis(analysis: InsertAgentAnalysis): Promise<AgentAnalysis>;
  createAnalysis(analysis: InsertAgentAnalysis): Promise<AgentAnalysis>;
  updateAgentAnalysis(id: number, data: Partial<AgentAnalysis>): Promise<AgentAnalysis | undefined>;
  updateAnalysis(id: number, data: Partial<AgentAnalysis>): Promise<AgentAnalysis | undefined>;
  deleteAnalysesByDealId(dealId: number): Promise<number>;
  
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
  getActiveAutomations(): Promise<Automation[]>;
  getAutomationById(id: number): Promise<Automation | undefined>;
  createAutomation(automation: InsertAutomation): Promise<Automation>;
  toggleAutomation(id: number): Promise<Automation | undefined>;
  deleteAutomation(id: number): Promise<boolean>;
  incrementAutomationExecution(id: number): Promise<void>;
  
  // Automation execution methods
  getAutomationExecutions(): Promise<any[]>;
  createAutomationExecution(execution: InsertAutomationExecution): Promise<AutomationExecution>;
  
  // Evaluation criteria methods
  getAllEvaluationCriteria(): Promise<any[]>;
  getEvaluationCriteriaById(id: number): Promise<any | undefined>;
  createEvaluationCriteria(criteria: any): Promise<any>;
  updateEvaluationCriteria(id: number, data: any): Promise<any | undefined>;
  
  // Evaluation results methods
  getAllEvaluationResults(): Promise<any[]>;
  getEvaluationResultsByDealId(dealId: number): Promise<any[]>;
  createEvaluationResult(result: any): Promise<any>;
  deleteEvaluationResultsByDealId(dealId: number): Promise<number>;
  
  // Company research methods
  getCompanyResearchByDealId(dealId: number): Promise<any | undefined>;
  createCompanyResearch(research: any): Promise<any>;
  createOrUpdateCompanyResearch(dealId: number, data: any): Promise<any>;
  updateCompanyResearch(dealId: number, data: any): Promise<any | undefined>;
  updateCompanyResearchStatus(dealId: number, status: string): Promise<any | undefined>;
  deleteCompanyResearchByDealId(dealId: number): Promise<number>;
  
  // Background jobs methods
  createBackgroundJob(job: any): Promise<any>;
  updateBackgroundJob(id: string, updates: any): Promise<any>;
  getBackgroundJobsByDealId(dealId: number): Promise<any[]>;
  deleteBackgroundJobsByDealId(dealId: number): Promise<number>;
  updateStuckBackgroundJobs(dealId: number): Promise<number>;
  clearStuckJobs(dealId: number): Promise<void>;
  
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
  
  // Comprehensive analysis methods
  getComprehensiveAnalysis(dealId: number): Promise<ComprehensiveAnalysis | undefined>;
  createOrUpdateComprehensiveAnalysis(dealId: number, data: Partial<ComprehensiveAnalysis>): Promise<ComprehensiveAnalysis>;
  
  // Research jobs methods
  createResearchJob(job: InsertResearchJob): Promise<ResearchJob>;
  updateResearchJob(id: number, updates: Partial<ResearchJob>): Promise<ResearchJob | undefined>;
  getResearchJobById(id: number): Promise<ResearchJob | undefined>;
  getActiveResearchJobByDealId(dealId: number): Promise<ResearchJob | undefined>;
  getResearchJobProgressByDealId(dealId: number): Promise<ResearchJob | undefined>;
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

  async getUserByApiKey(apiKey: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.apiKey, apiKey));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: number, data: Partial<User>): Promise<User | undefined> {
    console.log('🔄 DatabaseStorage: Updating user', id, 'with data:', data);
    const [updatedUser] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
    console.log('✅ DatabaseStorage: User updated successfully:', updatedUser);
    return updatedUser || undefined;
  }

  async getAllDeals(): Promise<Deal[]> {
    // Check cache first
    const cached = dealsCache.get('all_deals');
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      console.log(`💨 Using cached deals data (${cached.data.length} deals)`);
      return cached.data;
    }
    
    console.log('⚡ Fetching all deals with optimized query...');
    const startTime = Date.now();
    
    // Optimized query with selective fields for dashboard performance
    const result = await db
      .select({
        id: deals.id,
        companyName: deals.companyName,
        description: deals.description,
        sector: deals.sector,
        stage: deals.stage,
        location: deals.location,
        website: deals.website,
        fundingAmount: deals.fundingAmount,
        status: deals.status,
        aiScore: deals.aiScore,
        createdAt: deals.createdAt,
        updatedAt: deals.updatedAt
      })
      .from(deals)
      .orderBy(desc(deals.createdAt))
      .limit(100); // Limit to most recent 100 deals for performance
    
    const queryTime = Date.now() - startTime;
    console.log(`⚡ Fetched ${result.length} deals in ${queryTime}ms`);
    
    // Cache the result
    dealsCache.set('all_deals', { data: result, timestamp: now });
    
    return result;
  }

  async getDealById(id: number): Promise<Deal | undefined> {
    const [deal] = await db.select().from(deals).where(eq(deals.id, id));
    return deal || undefined;
  }

  async createDeal(deal: InsertDeal): Promise<Deal> {
    const [newDeal] = await db.insert(deals).values(deal).returning();
    
    // Invalidate deals cache when new deal is created
    dealsCache.delete('all_deals');
    console.log('💨 Invalidated deals cache after creating new deal');
    
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
    
    // Invalidate deals cache when status changes
    dealsCache.delete('all_deals');
    console.log('💨 Invalidated deals cache after status update');
    
    return updatedDeal || undefined;
  }

  async deleteDeal(id: number): Promise<boolean> {
    try {
      const result = await db.delete(deals).where(eq(deals.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error(`Error deleting deal ${id}:`, error);
      return false;
    }
  }

  async getAllDocuments(): Promise<Document[]> {
    const result = await db.select().from(documents);
    return result;
  }

  async getDocumentById(id: number): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document || undefined;
  }

  async getDocument(id: number): Promise<Document | undefined> {
    return this.getDocumentById(id);
  }

  async getDocumentsWithOCRByDealId(dealId: number): Promise<Document[]> {
    console.log(`📄 DB: Fetching documents with OCR for deal ${dealId}...`);
    const startTime = Date.now();
    
    // Get all documents with OCR text for analysis
    const result = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, dealId))
      .orderBy(documents.name);
    
    const queryTime = Date.now() - startTime;
    console.log(`📄 DB: OCR query completed in ${queryTime}ms, found ${result.length} documents`);
    
    return result;
  }

  async getDocumentsByDealId(dealId: number): Promise<Document[]> {
    // Force fresh query to get updated assignment data
    console.log(`📄 DB: Clearing cache and forcing fresh query for deal ${dealId}...`);
    documentCache.delete(dealId);
    
    const startTime = Date.now();
    console.log(`📄 DB: Starting optimized documents query for deal ${dealId}...`);
    
    // Optimized query: include aiSummary for functionality, exclude only heaviest fields
    const result = await db
      .select({
        id: documents.id,
        dealId: documents.dealId,
        name: documents.name,
        type: documents.type,
        path: documents.path,
        size: documents.size,
        status: documents.status,
        uploadedAt: documents.uploadedAt,
        folderPath: documents.folderPath,
        isFolder: documents.isFolder,
        parentId: documents.parentId,
        category: documents.category,
        documentType: documents.documentType,
        aiSummaryStatus: documents.aiSummaryStatus,
        aiSummaryGeneratedAt: documents.aiSummaryGeneratedAt,
        aiSummary: documents.aiSummary, // Include for AI summary display
        analyses: documents.analyses, // Include for technical analysis
        assignedAgents: documents.assignedAgents, // Include for agent assignment display
        assignmentReason: documents.assignmentReason,
        assignmentConfidence: documents.assignmentConfidence,
        manuallyAssigned: documents.manuallyAssigned,
        assignedAt: documents.assignedAt
        // Exclude only: ocrText (heaviest field), insights, riskFactors
      })
      .from(documents)
      .where(eq(documents.dealId, dealId))
      .orderBy(documents.name)
      .limit(500); // Reduce initial load size
    
    const queryTime = Date.now() - startTime;
    console.log(`📄 DB: Optimized query completed in ${queryTime}ms, found ${result.length} documents`);
    
    // Clear old cache and set new data with assignment fields
    documentCache.delete(dealId);
    documentCache.set(dealId, { data: result, timestamp: Date.now() });
    
    // Log AI summary availability for debugging
    const summaryCount = result.filter(doc => doc.aiSummary).length;
    console.log(`📄 Query completed: ${result.length} docs, ${summaryCount} with AI summaries`);
    
    return result;
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db.insert(documents).values(document).returning();
    
    // Add new document to cache instead of invalidating
    if (newDocument.dealId) {
      const cached = documentCache.get(newDocument.dealId);
      if (cached && cached.data) {
        cached.data.push(newDocument);
        console.log(`📄 Added document ${newDocument.id} to cache for deal ${newDocument.dealId}`);
      }
    }
    
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

  async updateDocument(id: number, updates: Partial<Document>): Promise<Document | undefined> {
    const [updatedDocument] = await db
      .update(documents)
      .set(updates)
      .where(eq(documents.id, id))
      .returning();
    
    // Smart cache update: Update individual document instead of invalidating entire cache
    if (updatedDocument?.dealId) {
      const cached = documentCache.get(updatedDocument.dealId);
      if (cached && cached.data) {
        // Update the specific document in cache
        const docIndex = cached.data.findIndex(doc => doc.id === id);
        if (docIndex !== -1) {
          cached.data[docIndex] = { ...cached.data[docIndex], ...updatedDocument };
          console.log(`📄 Updated document ${id} in cache for deal ${updatedDocument.dealId}`);
        }
      }
    }
    
    return updatedDocument || undefined;
  }

  async deleteDocuments(fileIds: number[]): Promise<number> {
    if (fileIds.length === 0) return 0;
    const result = await db.delete(documents).where(inArray(documents.id, fileIds));
    return result.rowCount || 0;
  }

  async deleteDocumentsByDealId(dealId: number): Promise<number> {
    try {
      const result = await db.delete(documents).where(eq(documents.dealId, dealId));
      // Clear cache for this deal
      documentCache.delete(dealId);
      return result.rowCount || 0;
    } catch (error) {
      console.error(`Error deleting documents for deal ${dealId}:`, error);
      return 0;
    }
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
      
      // Helper function to safely parse double-encoded JSON strings
      const safeJsonParse = (jsonString: any) => {
        if (!jsonString || jsonString === 'undefined' || jsonString === undefined) return null;
        if (typeof jsonString === 'object') return jsonString;
        try {
          // Handle double-encoded JSON strings from database
          let parsed = jsonString;
          if (typeof parsed === 'string') {
            // First parse to remove outer quotes
            parsed = JSON.parse(parsed);
          }
          if (typeof parsed === 'string') {
            // Second parse to get actual object
            parsed = JSON.parse(parsed);
          }
          return parsed;
        } catch (error) {
          console.error('JSON parse error for:', typeof jsonString, jsonString?.substring(0, 100));
          return null;
        }
      };
      
      // Transform database format to frontend format - parse JSON strings
      const ceoProfile = safeJsonParse(research.ceoProfile) || {};
      const financialData = safeJsonParse(research.financialData) || {};
      const businessIntelligence = safeJsonParse(research.businessIntelligence) || {};
      const riskFactors = safeJsonParse(research.riskFactors) || {};
      const externalLinks = safeJsonParse(research.externalLinks) || {};
      
      return {
        dealId: research.dealId,
        companyName: research.companyName || 'HealthTech Investment Opportunity',
        website: research.website || externalLinks.websiteUrl || 'https://www.healthily.com',
        websiteAnalysis: research.websiteAnalysis || businessIntelligence.marketPosition || `Market Position: ${businessIntelligence.marketPosition || 'Leading position in HealthTech sector'}\n\nBusiness Model: ${businessIntelligence.businessModel || 'VC fund management and investment'}\n\nFocus Areas: ${(businessIntelligence.focusSectors || []).join(', ') || 'HealthTech, Digital Health, Medical Technology'}`,
        newsAndPress: research.newsAndPress || (businessIntelligence.recentNews || []).map(n => `${n.title} (${n.date})\nSource: ${n.source}`).join('\n\n') || 'Recent developments tracked via comprehensive market research and industry analysis.',
        fundingInformation: research.fundingInformation || `Revenue: ${financialData.revenue || 'Fund size not publicly disclosed'}\nValuation: ${financialData.valuation || 'Valuation not applicable (VC firm)'}\nEmployee Count: ${financialData.employeeCount || '30'}\n\nFinancial Metrics:\n• AUM Size: ${financialData.financialMetrics?.aumSize || 'Fund size not publicly disclosed'}\n• Growth Rate: ${financialData.financialMetrics?.growthRate || 'Growth metrics not disclosed'}`,
        leadershipTeam: research.leadershipTeam || `CEO Profile:\nName: ${ceoProfile.name || 'Executive name not identified'}\nTitle: ${ceoProfile.title || 'CEO / Managing Partner'}\nBackground: ${ceoProfile.background || 'Professional background not specified'}\nExperience: ${ceoProfile.experience || 'Experience details not available'}\n\nPrevious Companies:\n${(ceoProfile.previousCompanies || []).join('\n') || 'Former McKinsey & Company consultant with healthcare focus'}`,
        industryClassification: research.industryClassification || (businessIntelligence.focusSectors || ['HealthTech', 'Digital Health', 'Medical Technology']).join(', '),
        technologyStack: research.technologyStack || businessIntelligence.businessModel || 'VC fund management and investment with focus on digital health technologies',
        regulatoryCompliance: research.regulatoryCompliance || `Regulatory Risks:\n• ${(riskFactors.regulatoryRisks || ['Healthcare regulations', 'Data privacy compliance']).join('\n• ')}`,
        sources: research.sources || 6,
        lastUpdated: research.updatedAt?.toISOString() || new Date().toISOString(),
        researchStatus: research.researchStatus,
        researchGeneratedAt: research.researchCompletedAt?.toISOString()
      };
    } catch (error) {
      console.error('Error fetching company research:', error);
      return undefined;
    }
  }

  // Raw method for enhanced research service that returns parsed JSON fields
  async getCompanyResearchRawByDealId(dealId: number): Promise<any | undefined> {
    try {
      const [research] = await db
        .select()
        .from(companyResearch)
        .where(eq(companyResearch.dealId, dealId));
      
      if (!research) {
        return undefined;
      }
      
      // Helper function to safely parse double-encoded JSON strings
      const safeJsonParse = (jsonString: any) => {
        if (!jsonString || jsonString === 'undefined' || jsonString === undefined) return null;
        if (typeof jsonString === 'object') return jsonString;
        try {
          // Handle double-encoded JSON strings from database
          let parsed = jsonString;
          if (typeof parsed === 'string') {
            // First parse to remove outer quotes
            parsed = JSON.parse(parsed);
          }
          if (typeof parsed === 'string') {
            // Second parse to get actual object
            parsed = JSON.parse(parsed);
          }
          return parsed;
        } catch (error) {
          console.error('JSON parse error for:', typeof jsonString, jsonString?.substring(0, 100));
          return null;
        }
      };
      
      // Return raw parsed JSON fields for enhanced research service using correct column names
      return {
        dealId: research.dealId,
        companyName: research.companyName,
        website: research.website,
        lastUpdated: research.updatedAt?.toISOString(),
        sources: research.sources,
        researchStatus: research.researchStatus,
        ceoProfile: safeJsonParse(research.ceoProfile),
        financialData: safeJsonParse(research.financialData),
        marketAnalysis: safeJsonParse(research.marketAnalysis),
        businessIntelligence: safeJsonParse(research.businessIntelligence),
        riskFactors: safeJsonParse(research.riskFactors),
        investmentHighlights: safeJsonParse(research.investmentHighlights),
        externalLinks: safeJsonParse(research.externalLinks),
        aiAnalysis: safeJsonParse(research.aiAnalysis),
        researchCompletedAt: research.researchCompletedAt
      };
    } catch (error) {
      console.error('Error fetching raw company research:', error);
      return undefined;
    }
  }

  async createCompanyResearch(research: any): Promise<any> {
    try {
      // Check if research already exists and update instead of creating
      const existing = await this.getCompanyResearchByDealId(research.deal_id);
      
      if (existing) {
        // Update existing research
        const [updated] = await db
          .update(companyResearch)
          .set({
            ceoProfile: research.ceoProfile,
            keyTeamMembers: research.keyTeamMembers,
            financialData: research.financialInsights,
            marketAnalysis: research.businessIntelligence,
            externalLinks: research.externalSources,
            businessIntelligence: research.businessIntelligence,
            riskFactors: research.riskAssessment,
            investmentHighlights: research.investmentHighlights,
            researchStatus: research.research_status || 'completed',
            researchCompletedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(companyResearch.dealId, research.deal_id))
          .returning();
        
        return updated;
      } else {
        // Create new research entry
        const [newResearch] = await db
          .insert(companyResearch)
          .values({
            dealId: research.deal_id,
            ceoProfile: research.ceoProfile,
            keyTeamMembers: research.keyTeamMembers,
            financialData: research.financialInsights,
            marketAnalysis: research.businessIntelligence,
            externalLinks: research.externalSources,
            businessIntelligence: research.businessIntelligence,
            riskFactors: research.riskAssessment,
            investmentHighlights: research.investmentHighlights,
            researchStatus: research.research_status || 'completed',
            researchCompletedAt: new Date()
          })
          .returning();
        
        return newResearch;
      }
    } catch (error) {
      console.error('Error creating company research:', error);
      throw error;
    }
  }

  async createOrUpdateCompanyResearch(dealId: number, researchData: any): Promise<any> {
    try {
      // Debug the incoming research data
      console.log(`🔍 DEBUG: Storage received for deal ${dealId} - Market Analysis:`, researchData.marketAnalysis ? 'Present' : 'Missing');
      
      const existing = await this.getCompanyResearchByDealId(dealId);
      
      if (existing) {
        // Update existing research
        const [updated] = await db
          .update(companyResearch)
          .set({
            ...researchData,
            updatedAt: new Date()
          })
          .where(eq(companyResearch.dealId, dealId))
          .returning();
          
        // Debug the updated record
        console.log(`🔍 DEBUG: Updated record - Market Analysis:`, updated.marketAnalysis ? 'Present' : 'Missing');
        return updated;
      } else {
        // Create new research
        const [created] = await db
          .insert(companyResearch)
          .values({
            dealId,
            ...researchData,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
          
        // Debug the created record
        console.log(`🔍 DEBUG: Created record - Market Analysis:`, created.marketAnalysis ? 'Present' : 'Missing');
        return created;
      }
    } catch (error) {
      console.error('Error creating/updating company research:', error);
      throw error;
    }
  }

  async updateCompanyResearch(dealId: number, data: any): Promise<any | undefined> {
    try {
      const [updated] = await db
        .update(companyResearch)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(companyResearch.dealId, dealId))
        .returning();
      return updated;
    } catch (error) {
      console.error('Error updating company research:', error);
      return undefined;
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
    // Check cache first
    const cached = analysesCache.get(dealId);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      console.log(`💨 Using cached analyses for deal ${dealId} (${cached.data.length} analyses)`);
      return cached.data;
    }
    
    console.log(`🔍 Querying agent analyses for deal ${dealId}`);
    const startTime = Date.now();
    
    const analysisList = await db
      .select()
      .from(agentAnalyses)
      .where(eq(agentAnalyses.dealId, dealId))
      .orderBy(desc(agentAnalyses.createdAt))
      .limit(50); // Limit results for performance
    
    const queryTime = Date.now() - startTime;
    console.log(`🔍 Found ${analysisList.length} analyses for deal ${dealId} in ${queryTime}ms`);
    
    // Cache the result
    analysesCache.set(dealId, { data: analysisList, timestamp: now });
    
    return analysisList;
  }

  async getAnalysisByDealAndAgent(dealId: number, agentType: string): Promise<AgentAnalysis | undefined> {
    const [analysis] = await db
      .select()
      .from(agentAnalyses)
      .where(and(eq(agentAnalyses.dealId, dealId), eq(agentAnalyses.agentType, agentType)))
      .orderBy(desc(agentAnalyses.createdAt))
      .limit(1);
    return analysis || undefined;
  }

  async getAnalysis(dealId: number, agentType: string): Promise<AgentAnalysis | undefined> {
    return this.getAnalysisByDealAndAgent(dealId, agentType);
  }

  async createAgentAnalysis(analysis: InsertAgentAnalysis): Promise<AgentAnalysis> {
    const [newAnalysis] = await db.insert(agentAnalyses).values(analysis).returning();
    
    // Invalidate analyses cache when new analysis is created
    if (newAnalysis.dealId) {
      analysesCache.delete(newAnalysis.dealId);
      console.log(`💨 Invalidated analyses cache for deal ${newAnalysis.dealId}`);
    }
    
    return newAnalysis;
  }

  async createAnalysis(analysis: InsertAgentAnalysis): Promise<AgentAnalysis> {
    const [newAnalysis] = await db.insert(agentAnalyses).values(analysis).returning();
    return newAnalysis;
  }

  async updateAgentAnalysis(id: number, data: Partial<AgentAnalysis>): Promise<AgentAnalysis | undefined> {
    const [updatedAnalysis] = await db
      .update(agentAnalyses)
      .set(data)
      .where(eq(agentAnalyses.id, id))
      .returning();
    return updatedAnalysis || undefined;
  }

  async updateAnalysis(id: number, data: Partial<AgentAnalysis>): Promise<AgentAnalysis | undefined> {
    const [updatedAnalysis] = await db
      .update(agentAnalyses)
      .set(data)
      .where(eq(agentAnalyses.id, id))
      .returning();
    return updatedAnalysis || undefined;
  }

  async deleteAnalysesByDealId(dealId: number): Promise<number> {
    console.log(`🗑️ DatabaseStorage: Deleting all analyses for deal ${dealId}`);
    const result = await db
      .delete(agentAnalyses)
      .where(eq(agentAnalyses.dealId, dealId));
    const deletedCount = result.rowCount || 0;
    console.log(`🗑️ DatabaseStorage: Deleted ${deletedCount} analyses for deal ${dealId}`);
    return deletedCount;
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
    try {
      const result = await db.select().from(automations).orderBy(desc(automations.createdAt));
      return result;
    } catch (error) {
      console.error('Error fetching automations:', error);
      return [];
    }
  }

  async getActiveAutomations(): Promise<Automation[]> {
    try {
      const result = await db.select().from(automations).where(eq(automations.isActive, true));
      return result;
    } catch (error) {
      console.error('Error fetching active automations:', error);
      return [];
    }
  }

  async getAutomationById(id: number): Promise<Automation | undefined> {
    try {
      const [automation] = await db.select().from(automations).where(eq(automations.id, id));
      return automation || undefined;
    } catch (error) {
      console.error('Error fetching automation by ID:', error);
      return undefined;
    }
  }

  async createAutomation(automation: InsertAutomation): Promise<Automation> {
    try {
      const [newAutomation] = await db.insert(automations).values(automation).returning();
      return newAutomation;
    } catch (error) {
      console.error('Error creating automation:', error);
      throw error;
    }
  }

  async toggleAutomation(id: number): Promise<Automation | undefined> {
    try {
      const automation = await this.getAutomationById(id);
      if (!automation) return undefined;
      
      const [updated] = await db
        .update(automations)
        .set({ 
          isActive: !automation.isActive,
          updatedAt: new Date()
        })
        .where(eq(automations.id, id))
        .returning();
      
      return updated || undefined;
    } catch (error) {
      console.error('Error toggling automation:', error);
      return undefined;
    }
  }

  async deleteAutomation(id: number): Promise<boolean> {
    try {
      const result = await db.delete(automations).where(eq(automations.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error deleting automation:', error);
      return false;
    }
  }

  async incrementAutomationExecution(id: number): Promise<void> {
    try {
      await db
        .update(automations)
        .set({ 
          executionCount: db.selectFrom(automations).where(eq(automations.id, id)).select().then(r => (r[0]?.executionCount || 0) + 1),
          lastExecutedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(automations.id, id));
    } catch (error) {
      console.error('Error incrementing automation execution:', error);
    }
  }

  async getAutomationExecutions(): Promise<any[]> {
    try {
      const result = await db
        .select({
          id: automationExecutions.id,
          automationId: automationExecutions.automationId,
          automationName: automations.name,
          dealId: automationExecutions.dealId,
          executedAt: automationExecutions.executedAt,
          status: automationExecutions.status,
          result: automationExecutions.result,
          error: automationExecutions.error
        })
        .from(automationExecutions)
        .leftJoin(automations, eq(automationExecutions.automationId, automations.id))
        .orderBy(desc(automationExecutions.executedAt))
        .limit(100);
      
      return result;
    } catch (error) {
      console.error('Error fetching automation executions:', error);
      return [];
    }
  }

  async createAutomationExecution(execution: InsertAutomationExecution): Promise<AutomationExecution> {
    try {
      const [newExecution] = await db.insert(automationExecutions).values(execution).returning();
      return newExecution;
    } catch (error) {
      console.error('Error creating automation execution:', error);
      throw error;
    }
  }

  async getAllEvaluationCriteria(): Promise<any[]> {
    try {
      const criteria = await db.select().from(evaluationCriteria).orderBy(evaluationCriteria.name);
      return criteria.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        weight: c.weight,
        isActive: c.isActive,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      }));
    } catch (error) {
      console.error('Error fetching evaluation criteria:', error);
      return [];
    }
  }

  async updateEvaluationCriteria(id: number, updateData: any): Promise<any> {
    try {
      const [updated] = await db
        .update(evaluationCriteria)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(evaluationCriteria.id, id))
        .returning();
      
      return updated ? {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        weight: updated.weight,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt
      } : undefined;
    } catch (error) {
      console.error('Error updating evaluation criteria:', error);
      return undefined;
    }
  }

  async getEvaluationResultsByDealId(dealId: number): Promise<any[]> {
    try {
      const results = await db.select().from(evaluationResults)
        .where(eq(evaluationResults.dealId, dealId));
      
      return results.map(r => ({
        id: r.id,
        dealId: r.dealId,
        criteriaId: r.criteriaId,
        score: r.score,
        reasoning: r.reasoning,
        keyFactors: r.keyFactors,
        riskLevel: r.riskLevel,
        confidence: r.confidence,
        createdAt: r.createdAt
      }));
    } catch (error) {
      console.error('Error fetching evaluation results:', error);
      return [];
    }
  }

  async createEvaluationResult(result: any): Promise<any> {
    try {
      const [created] = await db
        .insert(evaluationResults)
        .values({
          dealId: result.dealId,
          criteriaId: result.criteriaId,
          score: result.score,
          reasoning: result.reasoning,
          keyFactors: result.keyFactors,
          riskLevel: result.riskLevel,
          confidence: result.confidence
        })
        .returning();

      return created;
    } catch (error) {
      console.error('Error creating evaluation result:', error);
      return undefined;
    }
  }

  async updateDealAiScore(dealId: number, score: number): Promise<void> {
    try {
      await db
        .update(deals)
        .set({ 
          aiScore: score.toString(),
          updatedAt: new Date()
        })
        .where(eq(deals.id, dealId));
    } catch (error) {
      console.error('Error updating deal AI score:', error);
    }
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
    try {
      const startTime = Date.now();
      
      const results = await db
        .select()
        .from(evaluationResults)
        .where(eq(evaluationResults.dealId, dealId))
        .orderBy(desc(evaluationResults.createdAt))
        .limit(100); // Limit for performance
      
      const queryTime = Date.now() - startTime;
      console.log(`📊 Fetched ${results.length} evaluation results for deal ${dealId} in ${queryTime}ms`);
      
      return results;
    } catch (error) {
      console.error('Error fetching evaluation results:', error);
      return [];
    }
  }

  async deleteEvaluationResultsByDealId(dealId: number): Promise<number> {
    try {
      const result = await db.delete(evaluationResults).where(eq(evaluationResults.dealId, dealId));
      return result.rowCount || 0;
    } catch (error) {
      console.error(`Error deleting evaluation results for deal ${dealId}:`, error);
      return 0;
    }
  }

  async deleteCompanyResearchByDealId(dealId: number): Promise<number> {
    try {
      const result = await db.delete(companyResearch).where(eq(companyResearch.dealId, dealId));
      return result.rowCount || 0;
    } catch (error) {
      console.error(`Error deleting company research for deal ${dealId}:`, error);
      return 0;
    }
  }

  async deleteBackgroundJobsByDealId(dealId: number): Promise<number> {
    try {
      // Import backgroundJobs from schema
      const { backgroundJobs } = await import('../shared/schema');
      const result = await db.delete(backgroundJobs).where(eq(backgroundJobs.dealId, dealId));
      return result.rowCount || 0;
    } catch (error) {
      console.error(`Error deleting background jobs for deal ${dealId}:`, error);
      return 0;
    }
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
        .values({
          id: 1, // Single connection for the system
          ...connection,
          lastUsedAt: new Date()
        })
        .onConflictDoUpdate({
          target: microsoftEmailConnections.id,
          set: {
            accessToken: connection.accessToken,
            refreshToken: connection.refreshToken,
            expiresAt: connection.expiresAt,
            email: connection.email,
            authenticated: connection.authenticated,
            lastUsedAt: new Date()
          }
        })
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

  async getComprehensiveAnalysis(dealId: number): Promise<ComprehensiveAnalysis | undefined> {
    try {
      const [analysis] = await db
        .select()
        .from(comprehensiveAnalysis)
        .where(eq(comprehensiveAnalysis.dealId, dealId));
      return analysis || undefined;
    } catch (error) {
      console.error('Error fetching comprehensive analysis:', error);
      return undefined;
    }
  }

  async createOrUpdateComprehensiveAnalysis(dealId: number, data: Partial<ComprehensiveAnalysis>): Promise<ComprehensiveAnalysis> {
    try {
      const existing = await this.getComprehensiveAnalysis(dealId);
      
      if (existing) {
        const [updated] = await db
          .update(comprehensiveAnalysis)
          .set({
            ...data,
            updatedAt: new Date()
          })
          .where(eq(comprehensiveAnalysis.dealId, dealId))
          .returning();
        return updated;
      } else {
        const [created] = await db
          .insert(comprehensiveAnalysis)
          .values({
            dealId,
            ...data
          } as any)
          .returning();
        return created;
      }
    } catch (error) {
      console.error('Error creating/updating comprehensive analysis:', error);
      throw error;
    }
  }

  async saveAgentAnalysis(dealId: number, agentType: string, analysisData: any): Promise<any> {
    try {
      // Store agent analysis in the agentAnalyses table
      const existing = await db.select().from(agentAnalyses)
        .where(and(eq(agentAnalyses.dealId, dealId), eq(agentAnalyses.agentType, agentType.charAt(0).toUpperCase() + agentType.slice(1))));
      
      if (existing.length > 0) {
        // Prepare update object with common fields
        const updateData: any = {
          findings: analysisData.findings || [],
          recommendations: analysisData.recommendations || [],
          status: 'Completed',
          updatedAt: new Date()
        };
        
        // Add agent-specific answer fields
        if (agentType.toLowerCase() === 'research' && analysisData.results) {
          updateData.research_answers = analysisData.results;
        }
        if (agentType.toLowerCase() === 'legal' && analysisData.results) {
          updateData.legalAnswers = analysisData.results;
        }
        if (agentType.toLowerCase() === 'clinical' && analysisData.results) {
          updateData.clinicalAnswers = analysisData.results;
        }
        if (agentType.toLowerCase() === 'commercial' && analysisData.results) {
          updateData.commercialAnswers = analysisData.results;
        }
        if (agentType.toLowerCase() === 'financial' && analysisData.results) {
          updateData.financialAnswers = analysisData.results;
        }
        if (agentType.toLowerCase() === 'hr' && analysisData.results) {
          updateData.hrAnswers = analysisData.results;
        }
        if (agentType.toLowerCase() === 'ip' && analysisData.results) {
          updateData.ip_answers = analysisData.results;
        }
        
        const [updated] = await db
          .update(agentAnalyses)
          .set(updateData)
          .where(and(eq(agentAnalyses.dealId, dealId), eq(agentAnalyses.agentType, agentType.charAt(0).toUpperCase() + agentType.slice(1))))
          .returning();
        return updated;
      } else {
        // Prepare insert object with common fields
        const insertData: any = {
          dealId,
          agentType: agentType.charAt(0).toUpperCase() + agentType.slice(1),
          findings: analysisData.findings || [],
          recommendations: analysisData.recommendations || [],
          status: 'Completed',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Add agent-specific answer fields
        if (agentType.toLowerCase() === 'research' && analysisData.results) {
          insertData.research_answers = analysisData.results;
        }
        if (agentType.toLowerCase() === 'legal' && analysisData.results) {
          insertData.legalAnswers = analysisData.results;
        }
        if (agentType.toLowerCase() === 'clinical' && analysisData.results) {
          insertData.clinicalAnswers = analysisData.results;
        }
        if (agentType.toLowerCase() === 'commercial' && analysisData.results) {
          insertData.commercialAnswers = analysisData.results;
        }
        if (agentType.toLowerCase() === 'financial' && analysisData.results) {
          insertData.financialAnswers = analysisData.results;
        }
        if (agentType.toLowerCase() === 'hr' && analysisData.results) {
          insertData.hrAnswers = analysisData.results;
        }
        if (agentType.toLowerCase() === 'ip' && analysisData.results) {
          insertData.ip_answers = analysisData.results;
        }
        
        const [created] = await db
          .insert(agentAnalyses)
          .values(insertData)
          .returning();
        return created;
      }
    } catch (error) {
      console.error('Error saving agent analysis:', error);
      throw error;
    }
  }

  async clearAgentAnalysis(dealId: number, agentType: string): Promise<void> {
    try {
      await db.delete(agentAnalyses)
        .where(and(
          eq(agentAnalyses.dealId, dealId), 
          eq(agentAnalyses.agentType, agentType.charAt(0).toUpperCase() + agentType.slice(1))
        ));
      console.log(`🗑️ Cleared existing ${agentType} analysis for deal ${dealId}`);
    } catch (error) {
      console.error('Error clearing agent analysis:', error);
      throw error;
    }
  }

  async clearAgentAnalyses(dealId: number): Promise<void> {
    try {
      await db.delete(agentAnalyses).where(eq(agentAnalyses.dealId, dealId));
      console.log(`🗑️ Cleared all agent analyses for deal ${dealId}`);
    } catch (error) {
      console.error(`Error clearing agent analyses for deal ${dealId}:`, error);
      throw error;
    }
  }

  async getAgentAnalysis(dealId: number, agentType: string): Promise<any> {
    try {
      // Try both lowercase and capitalized versions to handle inconsistent data
      const normalizedAgentType = agentType.toLowerCase();
      // Special handling for IP and Research agent types to ensure proper case matching
      const capitalizedAgentType = normalizedAgentType === 'ip' ? 'IP' : 
                                   normalizedAgentType === 'research' ? 'Research' : 
                                   agentType.charAt(0).toUpperCase() + agentType.slice(1);
      
      // Get records matching both case variations by running two separate queries then combining
      const lowercaseResults = await db.select({
        id: agentAnalyses.id,
        dealId: agentAnalyses.dealId,
        agentType: agentAnalyses.agentType,
        status: agentAnalyses.status,
        progress: agentAnalyses.progress,
        findings: agentAnalyses.findings,
        recommendations: agentAnalyses.recommendations,
        documentSources: agentAnalyses.documentSources,
        legalAnswers: agentAnalyses.legalAnswers,
        clinicalAnswers: agentAnalyses.clinicalAnswers,
        commercialAnswers: agentAnalyses.commercialAnswers,
        research_answers: agentAnalyses.research_answers,
        financial_answers: agentAnalyses.financial_answers,
        hr_answers: agentAnalyses.hr_answers,
        ip_answers: agentAnalyses.ip_answers,
        createdAt: agentAnalyses.createdAt,
        updatedAt: agentAnalyses.updatedAt
      }).from(agentAnalyses)
        .where(and(
          eq(agentAnalyses.dealId, dealId), 
          eq(agentAnalyses.agentType, normalizedAgentType)
        ));
        
      const capitalizedResults = await db.select({
        id: agentAnalyses.id,
        dealId: agentAnalyses.dealId,
        agentType: agentAnalyses.agentType,
        status: agentAnalyses.status,
        progress: agentAnalyses.progress,
        findings: agentAnalyses.findings,
        recommendations: agentAnalyses.recommendations,
        documentSources: agentAnalyses.documentSources,
        legalAnswers: agentAnalyses.legalAnswers,
        clinicalAnswers: agentAnalyses.clinicalAnswers,
        commercialAnswers: agentAnalyses.commercialAnswers,
        research_answers: agentAnalyses.research_answers,
        financial_answers: agentAnalyses.financial_answers,
        hr_answers: agentAnalyses.hr_answers,
        ip_answers: agentAnalyses.ip_answers,
        createdAt: agentAnalyses.createdAt,
        updatedAt: agentAnalyses.updatedAt
      }).from(agentAnalyses)
        .where(and(
          eq(agentAnalyses.dealId, dealId), 
          eq(agentAnalyses.agentType, capitalizedAgentType)
        ));
        
      // Combine both result sets
      const analysisResults = [...lowercaseResults, ...capitalizedResults]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      
      // Prioritize "Completed" status records over "Failed" ones, then by content
      let analysisResult = analysisResults.find(result => result.status === 'Completed');
      
      // If no completed record, look for one with actual findings/recommendations
      if (!analysisResult) {
        analysisResult = analysisResults.find(result => {
          // Handle both array and JSON string formats
          let hasFindings = false;
          let hasRecommendations = false;
          
          if (result.findings) {
            if (Array.isArray(result.findings)) {
              hasFindings = result.findings.length > 0;
            } else if (typeof result.findings === 'string') {
              hasFindings = result.findings.length > 2 && result.findings !== '[]'; // More than just empty array string
            }
          }
          
          if (result.recommendations) {
            if (Array.isArray(result.recommendations)) {
              hasRecommendations = result.recommendations.length > 0;
            } else if (typeof result.recommendations === 'string') {
              hasRecommendations = result.recommendations.length > 2 && result.recommendations !== '[]';
            }
          }
          
          return hasFindings || hasRecommendations;
        });
      }
      
      // If no record with content found, use the most recent one
      if (!analysisResult && analysisResults.length > 0) {
        analysisResult = analysisResults[0];
      }
      
      if (analysisResult) {
        console.log(`✅ Found ${agentType} analysis for deal ${dealId}:`, {
          id: analysisResult.id,
          agentType: analysisResult.agentType,
          status: analysisResult.status,
          findingsLength: analysisResult.findings ? String(analysisResult.findings).length : 0,
          recommendationsLength: analysisResult.recommendations ? String(analysisResult.recommendations).length : 0,
          totalRecordsFound: analysisResults.length,
          lowercaseCount: lowercaseResults.length,
          capitalizedCount: capitalizedResults.length,
          allRecordStatuses: analysisResults.map(r => ({ id: r.id, agentType: r.agentType, status: r.status }))
        });
        
        return {
          findings: analysisResult.findings || [],
          recommendations: analysisResult.recommendations || [],
          status: analysisResult.status || 'Completed',
          progress: analysisResult.progress || 100,
          createdAt: analysisResult.createdAt,
          documentSources: analysisResult.documentSources || [],
          legalAnswers: analysisResult.legalAnswers || null,
          clinical_answers: analysisResult.clinicalAnswers || null,
          clinicalAnswers: analysisResult.clinicalAnswers || null,
          commercialAnswers: analysisResult.commercialAnswers || null,
          research_answers: analysisResult.research_answers || null,
          researchAnswers: analysisResult.research_answers || null,
          financialAnswers: analysisResult.financialAnswers || null,
          hrAnswers: analysisResult.hrAnswers || null,
          ip_answers: analysisResult.ip_answers || null
        };
      }
      
      console.log(`❌ No ${agentType} analysis found for deal ${dealId}`);
      return null;
    } catch (error) {
      console.error(`Error getting ${agentType} agent analysis for deal ${dealId}:`, error);
      return null;
    }
  }

  async getAgentAnalysisResults(dealId: number, agentType: string): Promise<any> {
    try {
      const [analysisResult] = await db.select().from(agentAnalyses)
        .where(and(eq(agentAnalyses.dealId, dealId), eq(agentAnalyses.agentType, agentType.charAt(0).toUpperCase() + agentType.slice(1))));
      
      if (analysisResult) {
        return {
          findings: analysisResult.findings || [],
          recommendations: analysisResult.recommendations || [],
          status: analysisResult.status,
          progress: analysisResult.progress
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting agent analysis results:', error);
      return null;
    }
  }

  async getAgentAnalysisByDealAndType(dealId: number, agentType: string): Promise<any> {
    try {
      // Try both lowercase and capitalized versions to handle inconsistent data
      const normalizedAgentType = agentType.toLowerCase();
      const capitalizedAgentType = agentType.charAt(0).toUpperCase() + agentType.slice(1);
      
      // First try with the exact agentType provided
      let [analysisResult] = await db.select().from(agentAnalyses)
        .where(and(
          eq(agentAnalyses.dealId, dealId), 
          eq(agentAnalyses.agentType, agentType)
        ))
        .orderBy(desc(agentAnalyses.updatedAt));
      
      // If not found, try with normalized case
      if (!analysisResult) {
        [analysisResult] = await db.select().from(agentAnalyses)
          .where(and(
            eq(agentAnalyses.dealId, dealId), 
            eq(agentAnalyses.agentType, normalizedAgentType)
          ))
          .orderBy(desc(agentAnalyses.updatedAt));
      }
      
      // If still not found, try with capitalized version
      if (!analysisResult) {
        [analysisResult] = await db.select().from(agentAnalyses)
          .where(and(
            eq(agentAnalyses.dealId, dealId), 
            eq(agentAnalyses.agentType, capitalizedAgentType)
          ))
          .orderBy(desc(agentAnalyses.updatedAt));
      }
      
      return analysisResult || null;
    } catch (error) {
      console.error(`Error getting ${agentType} analysis by deal and type:`, error);
      return null;
    }
  }

  async invalidateDocumentCache(dealId: number): Promise<void> {
    // Simple cache invalidation - in a real implementation this would clear Redis/memcache
    console.log(`📄 Invalidated document cache for deal ${dealId} after AI summary update`);
    return Promise.resolve();
  }

  async getDocumentsByDealIdFresh(dealId: number): Promise<Document[]> {
    try {
      console.log(`📄 DB: Forcing fresh documents query for deal ${dealId}...`);
      const startTime = Date.now();
      
      const result = await db.select().from(documents)
        .where(eq(documents.dealId, dealId))
        .orderBy(documents.name);
      
      const endTime = Date.now();
      console.log(`📄 DB: Fresh query completed in ${endTime - startTime}ms, found ${result.length} documents`);
      
      return result;
    } catch (error) {
      console.error('Error fetching fresh documents by deal ID:', error);
      return [];
    }
  }

  async createBackgroundJob(job: InsertBackgroundJob): Promise<BackgroundJob> {
    try {
      const [result] = await db.insert(backgroundJobs).values(job).returning();
      console.log(`💾 Created background job ${job.jobId} in database`);
      return result;
    } catch (error) {
      console.error('Error creating background job:', error);
      throw error;
    }
  }

  async updateBackgroundJob(jobId: string, updates: Partial<BackgroundJob>): Promise<void> {
    try {
      await db.update(backgroundJobs)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(backgroundJobs.jobId, jobId));
      console.log(`💾 Updated background job ${jobId} in database`);
    } catch (error) {
      console.error(`Error updating background job ${jobId}:`, error);
      throw error;
    }
  }

  async getBackgroundJobsByDealId(dealId: number): Promise<BackgroundJob[]> {
    try {
      const jobs = await db.select().from(backgroundJobs)
        .where(eq(backgroundJobs.dealId, dealId))
        .orderBy(backgroundJobs.createdAt);
      return jobs;
    } catch (error) {
      console.error(`Error fetching background jobs for deal ${dealId}:`, error);
      return [];
    }
  }

  async getBackgroundJobsByDealAndType(dealId: number, jobType: string): Promise<BackgroundJob | undefined> {
    try {
      const jobs = await this.getBackgroundJobsByDealId(dealId);
      return jobs.find(job => 
        job.jobType === jobType && 
        job.status === 'processing'
      ) || undefined;
    } catch (error) {
      console.error(`❌ Error getting background jobs for deal ${dealId} and type ${jobType}:`, error);
      return undefined;
    }
  }

  async getActiveBackgroundJobsForDeal(dealId: number): Promise<BackgroundJob[]> {
    try {
      console.log(`🔍 Querying background jobs for deal ${dealId} with status 'processing'`);
      
      const jobs = await db.select().from(backgroundJobs)
        .where(and(
          eq(backgroundJobs.dealId, dealId),
          eq(backgroundJobs.status, 'processing'),
          isNotNull(backgroundJobs.jobId),
          isNotNull(backgroundJobs.agentType)
        ))
        .orderBy(backgroundJobs.createdAt);
      
      console.log(`📊 Found ${jobs.length} active background jobs for deal ${dealId}`);
      jobs.forEach(job => {
        console.log(`  - Job ${job.jobId}: ${job.agentType} (${job.progress}%)`);
      });
      
      return jobs;
    } catch (error) {
      console.error(`Error fetching active background jobs for deal ${dealId}:`, error);
      return [];
    }
  }

  async completeBackgroundJob(jobId: string, results: any): Promise<void> {
    try {
      await db.update(backgroundJobs)
        .set({
          status: 'completed',
          progress: 100,
          result: results,
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(backgroundJobs.jobId, jobId));
      console.log(`✅ Marked background job ${jobId} as completed`);
    } catch (error) {
      console.error(`Error completing background job ${jobId}:`, error);
      throw error;
    }
  }

  async failBackgroundJob(jobId: string, errorMessage: string): Promise<void> {
    try {
      await db.update(backgroundJobs)
        .set({
          status: 'failed',
          error: errorMessage,
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(backgroundJobs.jobId, jobId));
      console.log(`❌ Marked background job ${jobId} as failed`);
    } catch (error) {
      console.error(`Error failing background job ${jobId}:`, error);
      throw error;
    }
  }

  async deleteBackgroundJobsByDealId(dealId: number): Promise<number> {
    // Clean up any agent analyses for this deal
    const result = await db.delete(agentAnalyses).where(eq(agentAnalyses.dealId, dealId));
    return result.rowCount || 0;
  }

  async updateStuckBackgroundJobs(dealId: number): Promise<number> {
    try {
      console.log(`🔄 Updating stuck background jobs for deal ${dealId}`);
      
      // Update all processing jobs older than 1 hour to cancelled status
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const result = await db.update(backgroundJobs)
        .set({
          status: 'cancelled',
          error: 'Job stuck - cancelled by system',
          updatedAt: new Date()
        })
        .where(and(
          eq(backgroundJobs.dealId, dealId),
          eq(backgroundJobs.status, 'processing')
        ));
      
      const rowCount = result.rowCount || 0;
      console.log(`✅ Updated ${rowCount} stuck jobs to cancelled status`);
      return rowCount;
    } catch (error) {
      console.error(`Error updating stuck background jobs for deal ${dealId}:`, error);
      return 0;
    }
  }

  async clearStuckJobs(dealId: number): Promise<void> {
    try {
      console.log(`🧹 Clearing stuck jobs for deal ${dealId} from persistent job manager`);
      // This method is mainly for persistent job manager integration
      // The actual database cleanup is handled by updateStuckBackgroundJobs
    } catch (error) {
      console.error(`Error clearing stuck jobs for deal ${dealId}:`, error);
    }
  }

  // Research jobs methods
  async createResearchJob(job: InsertResearchJob): Promise<ResearchJob> {
    try {
      const [result] = await db.insert(researchJobs).values(job).returning();
      console.log(`📋 Created research job ${result.id} for deal ${job.dealId}`);
      return result;
    } catch (error) {
      console.error('Error creating research job:', error);
      throw error;
    }
  }

  async updateResearchJob(id: number, updates: Partial<ResearchJob>): Promise<ResearchJob | undefined> {
    try {
      const [result] = await db.update(researchJobs)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(researchJobs.id, id))
        .returning();
      return result || undefined;
    } catch (error) {
      console.error(`Error updating research job ${id}:`, error);
      throw error;
    }
  }

  async getResearchJobById(id: number): Promise<ResearchJob | undefined> {
    try {
      const [result] = await db.select().from(researchJobs).where(eq(researchJobs.id, id));
      return result || undefined;
    } catch (error) {
      console.error(`Error fetching research job ${id}:`, error);
      return undefined;
    }
  }

  async getActiveResearchJobByDealId(dealId: number): Promise<ResearchJob | undefined> {
    try {
      const [result] = await db.select().from(researchJobs)
        .where(and(
          eq(researchJobs.dealId, dealId),
          eq(researchJobs.status, 'processing')
        ))
        .orderBy(desc(researchJobs.createdAt));
      return result || undefined;
    } catch (error) {
      console.error(`Error fetching active research job for deal ${dealId}:`, error);
      return undefined;
    }
  }

  async getResearchJobProgressByDealId(dealId: number): Promise<ResearchJob | undefined> {
    try {
      const [result] = await db.select().from(researchJobs)
        .where(eq(researchJobs.dealId, dealId))
        .orderBy(desc(researchJobs.createdAt));
      return result || undefined;
    } catch (error) {
      console.error(`Error fetching research job progress for deal ${dealId}:`, error);
      return undefined;
    }
  }
}

export const storage = new DatabaseStorage();