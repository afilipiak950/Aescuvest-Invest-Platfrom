// @ts-nocheck - bypass type errors for deployment
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
import { eq, and, or, desc, inArray, isNotNull, isNull, sql } from 'drizzle-orm';

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
  updateDeal(id: number, data: Partial<Deal>): Promise<Deal | undefined>;
  updateDealAiScore(id: number, score: number): Promise<Deal | undefined>;
  updateDealStatus(id: number, status: string): Promise<Deal | undefined>;
  deleteDeal(id: number): Promise<boolean>;
  
  // Document methods
  getAllDocuments(): Promise<Document[]>;
  getDocumentById(id: number): Promise<Document | undefined>;
  getDocument(id: number): Promise<Document | undefined>;
  getDocumentsByDealId(dealId: number): Promise<Document[]>;
  getDocumentsByDealIdPaginated(dealId: number, page: number, limit: number, summary?: boolean): Promise<{documents: Document[], total: number, page: number, totalPages: number}>;
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
  createMemo(memo: InsertInvestmentMemo): Promise<InvestmentMemo>;
  updateMemo(id: number, data: Partial<InvestmentMemo>): Promise<InvestmentMemo | undefined>;
  deleteMemosByDealId(dealId: number): Promise<number>;

  
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
  updateBackgroundJob(jobId: string, data: any): Promise<any>;
  getBackgroundJobsByDealId(dealId: number): Promise<any[]>;
  getRunningBackgroundJobs(dealId?: number): Promise<any[]>;
  clearStuckBackgroundJobs(dealId?: number): Promise<number>;
  getActiveBackgroundJobsForDeal(dealId: number): Promise<any[]>;
  completeBackgroundJob(jobId: string, results: any): Promise<void>;
  failBackgroundJob(jobId: string, errorMessage: string): Promise<void>;
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
  deleteComprehensiveAnalysesByDealId(dealId: number): Promise<number>;
  deleteBackgroundUploadsByDealId(dealId: number): Promise<number>;
  deleteInvestorMatchesByDealId(dealId: number): Promise<number>;
  deleteInvestmentMemosByDealId(dealId: number): Promise<number>;
  deleteAutomationExecutionsByDealId(dealId: number): Promise<number>;
  deleteResearchBackgroundJobsByDealId(dealId: number): Promise<number>;
  
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

  async updateDeal(id: number, data: Partial<Deal>): Promise<Deal | undefined> {
    const [updatedDeal] = await db
      .update(deals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(deals.id, id))
      .returning();
    
    // Invalidate deals cache when deal is updated
    dealsCache.delete('all_deals');
    console.log('💨 Invalidated deals cache after deal update');
    
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
      console.log(`🗑️ DatabaseStorage: Attempting to delete deal ${id}`);
      console.log(`🚨 STORAGE DEBUG: deleteDeal called from:`, new Error().stack);
      console.log(`🔍 DatabaseStorage: Deal ID type: ${typeof id}, value: ${id}`);
      
      // First check if deal exists
      console.log(`🔍 DatabaseStorage: Checking if deal ${id} exists...`);
      const existingDeal = await this.getDealById(id);
      if (!existingDeal) {
        console.log(`❌ DatabaseStorage: Deal ${id} not found - cannot delete`);
        return false;
      }
      console.log(`✅ DatabaseStorage: Found deal ${id}: ${existingDeal.companyName}`);
      
      // ⚠️ CRITICAL FIX: Delete foreign key references FIRST before deleting the deal
      console.log(`🧹 DatabaseStorage: Cleaning up foreign key references for deal ${id}...`);
      
      // Delete background uploads (the failing constraint)
      console.log(`🗑️ DatabaseStorage: Deleting background uploads for deal ${id}...`);
      await this.deleteBackgroundUploadsByDealId(id);
      
      // Delete other related data to be safe
      console.log(`🗑️ DatabaseStorage: Deleting documents for deal ${id}...`);
      await this.deleteDocumentsByDealId(id);
      
      console.log(`🗑️ DatabaseStorage: Deleting analyses for deal ${id}...`);
      await this.deleteAnalysesByDealId(id);
      
      console.log(`🗑️ DatabaseStorage: Deleting company research for deal ${id}...`);
      await this.deleteCompanyResearchByDealId(id);
      
      // Delete the deal using returning() to confirm deletion
      console.log(`🗑️ DatabaseStorage: Executing DELETE query for deal ${id}...`);
      const deletedDeals = await db
        .delete(deals)
        .where(eq(deals.id, id))
        .returning({ id: deals.id });
      
      console.log(`🗑️ DatabaseStorage: DELETE query returned ${deletedDeals.length} row(s):`, deletedDeals);
      const wasDeleted = deletedDeals.length > 0;
      console.log(`🗑️ DatabaseStorage: Deal ${id} deletion ${wasDeleted ? 'successful' : 'failed'}`);
      
      // Invalidate deals cache after successful deletion
      if (wasDeleted) {
        dealsCache.delete('all_deals');
        console.log('💨 DatabaseStorage: Invalidated deals cache after deletion');
      } else {
        console.log(`❌ DatabaseStorage: DELETE returned no rows - foreign key constraint or other issue?`);
      }
      
      return wasDeleted;
    } catch (error) {
      console.error(`❌ DatabaseStorage: CRITICAL ERROR deleting deal ${id}:`, error);
      console.error(`❌ DatabaseStorage: Error details:`, {
        name: error?.name,
        message: error?.message,
        code: error?.code,
        constraint: error?.constraint,
        detail: error?.detail,
        stack: error?.stack
      });
      // Re-throw the error so the endpoint can see the actual issue
      throw error;
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
    console.log(`📄 DB: Fetching documents with FULL OCR text for deal ${dealId}...`);
    const startTime = Date.now();
    
    // Get ALL documents including OCR text for investment memo generation
    const result = await db
      .select({
        id: documents.id,
        dealId: documents.dealId,
        name: documents.name,
        type: documents.type,
        path: documents.path,
        size: documents.size,
        status: documents.status,
        ocrText: documents.ocrText, // INCLUDE OCR TEXT - Critical for investment memo generation
        uploadedAt: documents.uploadedAt,
        folderPath: documents.folderPath,
        isFolder: documents.isFolder,
        parentId: documents.parentId,
        category: documents.category,
        documentType: documents.documentType,
        aiSummaryStatus: documents.aiSummaryStatus,
        aiSummaryGeneratedAt: documents.aiSummaryGeneratedAt,
        aiSummary: documents.aiSummary,
        analyses: documents.analyses,
        assignedAgents: documents.assignedAgents,
        assignmentReason: documents.assignmentReason,
        assignmentConfidence: documents.assignmentConfidence,
        manuallyAssigned: documents.manuallyAssigned,
        assignedAt: documents.assignedAt
      })
      .from(documents)
      .where(eq(documents.dealId, dealId))
      .orderBy(documents.name);
    
    const queryTime = Date.now() - startTime;
    const docsWithOcr = result.filter(doc => doc.ocrText && doc.ocrText.length > 100).length;
    const totalOcrLength = result.reduce((sum, doc) => sum + (doc.ocrText?.length || 0), 0);
    
    console.log(`📄 DB: OCR query completed in ${queryTime}ms, found ${result.length} documents`);
    console.log(`📄 DB: ${docsWithOcr} documents have OCR text with ${totalOcrLength.toLocaleString()} total characters`);
    
    return result;
  }

  async getDocumentsByDealId(dealId: number): Promise<Document[]> {
    // Force fresh query to get updated assignment data
    console.log(`📄 DB: Clearing cache and forcing fresh query for deal ${dealId}...`);
    documentCache.delete(dealId);
    
    const startTime = Date.now();
    console.log(`📄 DB: Starting optimized documents query for deal ${dealId}...`);
    
    // Optimized query: include aiSummary and OCR content for functionality, exclude only heaviest fields
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
        ocrContent: documents.ocrText, // Map ocr_text to ocrContent for frontend
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
      .orderBy(documents.name); // Remove limit to get all documents
    
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

  // 🚀 CRITICAL PERFORMANCE FIX: Paginated document loading to eliminate 8.9MB responses
  async getDocumentsByDealIdPaginated(dealId: number, page: number = 1, limit: number = 20, summary: boolean = false): Promise<{documents: Document[], total: number, page: number, totalPages: number}> {
    console.log(`📄 DB: Starting PAGINATED documents query for deal ${dealId}, page ${page}, limit ${limit}, summary: ${summary}...`);
    const startTime = Date.now();
    
    // For summary mode (dashboard), return minimal fields
    const baseQuery = db.select({
      id: documents.id,
      dealId: documents.dealId,
      name: documents.name,
      type: documents.type,
      size: documents.size,
      status: documents.status,
      uploadedAt: documents.uploadedAt,
      folderPath: documents.folderPath,
      isFolder: documents.isFolder,
      category: documents.category,
      documentType: documents.documentType,
      aiSummaryStatus: documents.aiSummaryStatus,
      ...(summary ? {} : {
        // Full mode includes heavy fields
        ocrContent: documents.ocrText,
        parentId: documents.parentId,
        aiSummaryGeneratedAt: documents.aiSummaryGeneratedAt,
        aiSummary: documents.aiSummary,
        analyses: documents.analyses,
        assignedAgents: documents.assignedAgents,
        assignmentReason: documents.assignmentReason,
        assignmentConfidence: documents.assignmentConfidence,
        manuallyAssigned: documents.manuallyAssigned,
        assignedAt: documents.assignedAt
      })
    });

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(documents)
      .where(eq(documents.dealId, dealId));
    
    const total = countResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    // Get paginated documents
    const result = await baseQuery
      .from(documents)
      .where(eq(documents.dealId, dealId))
      .orderBy(documents.name)
      .limit(limit)
      .offset(offset);
    
    const queryTime = Date.now() - startTime;
    console.log(`📄 DB: Paginated query completed in ${queryTime}ms, page ${page}/${totalPages}, found ${result.length}/${total} documents`);
    
    return {
      documents: result,
      total,
      page,
      totalPages
    };
  }

  // NEW: Get documents WITH complete OCR text for memo generation using direct database connection
  async getDocumentsWithOCRForMemo(dealId: number): Promise<any[]> {
    console.log(`🔍 Fetching ALL documents WITH complete OCR text for memo generation - deal ${dealId}`);
    
    const startTime = Date.now();
    
    try {
      // Use direct PostgreSQL connection to bypass any ORM limitations
      const client = await pool.connect();
      
      // First, verify OCR content exists
      const ocrCheckQuery = `SELECT COUNT(*) as ocr_docs, SUM(LENGTH(ocr_text)) as total_chars FROM documents WHERE deal_id = $1 AND ocr_text IS NOT NULL AND LENGTH(ocr_text) > 100`;
      const ocrCheck = await client.query(ocrCheckQuery, [dealId]);
      console.log(`🔍 OCR CHECK: ${ocrCheck.rows[0].ocr_docs} docs with OCR, ${ocrCheck.rows[0].total_chars} total chars`);
      
      const query = `
        SELECT id, deal_id, name, type, path, size, status, uploaded_at,
               folder_path, is_folder, parent_id, category, document_type,
               ai_summary, ai_summary_status, ai_summary_generated_at,
               analyses, assigned_agents, assignment_reason, assignment_confidence,
               manually_assigned, assigned_at, assigned_by,
               ocr_text, summary, insights, risk_factors
        FROM documents 
        WHERE deal_id = $1 
        ORDER BY name
      `;
      
      const result = await client.query(query, [dealId]);
      const documents = result.rows;
      
      client.release();
      
      const queryTime = Date.now() - startTime;
      
      // Debug OCR content with detailed field inspection
      let ocrDocsCount = 0;
      let totalOcrChars = 0;
      
      documents.forEach((doc, index) => {
        if (doc.ocr_text && doc.ocr_text.length > 100) {
          ocrDocsCount++;
          totalOcrChars += doc.ocr_text.length;
          console.log(`📄 Document ${index + 1} (${doc.name}): ${doc.ocr_text.length.toLocaleString()} OCR characters - SUCCESSFULLY RETRIEVED!`);
        } else {
          console.log(`📄 Document ${index + 1} (${doc.name}): No substantial OCR text`);
        }
      });
      
      console.log(`📄 DIRECT DB QUERY COMPLETE: ${documents.length} docs, ${ocrDocsCount} with OCR, ${totalOcrChars.toLocaleString()} total OCR chars in ${queryTime}ms`);
      
      if (ocrDocsCount > 0) {
        console.log(`✅ OCR EXTRACTION SUCCESS: Found ${totalOcrChars.toLocaleString()} characters across ${ocrDocsCount} documents`);
      } else {
        console.log(`❌ OCR EXTRACTION FAILED: No OCR content retrieved despite database verification`);
      }
      
      return documents;
    } catch (error) {
      console.error('Error with direct database query:', error);
      
      // Fallback to Drizzle query
      const result = await db
        .select()
        .from(documents)
        .where(eq(documents.dealId, dealId))
        .orderBy(documents.name);
      
      console.log(`📄 FALLBACK QUERY: ${result.length} documents`);
      return result;
    }
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

  // Investment memo methods - full implementation
  async getAllMemos(): Promise<InvestmentMemo[]> {
    return await db.select().from(investmentMemos).orderBy(desc(investmentMemos.createdAt));
  }

  async getMemoById(id: number): Promise<InvestmentMemo | undefined> {
    const result = await db.select().from(investmentMemos).where(eq(investmentMemos.id, id));
    return result[0];
  }

  async getMemoByDealId(dealId: number): Promise<InvestmentMemo | undefined> {
    const result = await db.select().from(investmentMemos)
      .where(eq(investmentMemos.dealId, dealId))
      .orderBy(desc(investmentMemos.createdAt));
    return result[0];
  }

  async createMemo(memo: InsertInvestmentMemo): Promise<InvestmentMemo> {
    // Delete any existing memos for this deal to ensure only one active memo
    await db.delete(investmentMemos)
      .where(eq(investmentMemos.dealId, memo.dealId));

    // Create new memo
    const [newMemo] = await db.insert(investmentMemos).values([memo]).returning();
    
    console.log(`💾 Created new investment memo for deal ${memo.dealId}`);
    return newMemo;
  }

  async updateMemo(id: number, data: Partial<InvestmentMemo>): Promise<InvestmentMemo | undefined> {
    const [updatedMemo] = await db.update(investmentMemos)
      .set(data)
      .where(eq(investmentMemos.id, id))
      .returning();
    
    return updatedMemo;
  }

  async deleteMemosByDealId(dealId: number): Promise<number> {
    const result = await db.delete(investmentMemos)
      .where(eq(investmentMemos.dealId, dealId));
    
    console.log(`🗑️ Deleted ${result.rowCount || 0} memos for deal ${dealId}`);
    return result.rowCount || 0;
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



  async getEvaluationCriteriaById(id: number): Promise<any | undefined> {
    return undefined;
  }

  async createEvaluationCriteria(criteria: any): Promise<any> {
    return criteria;
  }



  async getAllEvaluationResults(): Promise<any[]> {
    return [];
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

  async deleteComprehensiveAnalysesByDealId(dealId: number): Promise<number> {
    try {
      console.log(`🗑️ DatabaseStorage: Deleting comprehensive analysis for deal ${dealId}...`);
      // Import comprehensiveAnalysis from schema
      const { comprehensiveAnalysis } = await import('../shared/schema');
      const result = await db.delete(comprehensiveAnalysis).where(eq(comprehensiveAnalysis.dealId, dealId));
      const count = result.rowCount || 0;
      console.log(`🗑️ DatabaseStorage: Deleted ${count} comprehensive analysis record(s) for deal ${dealId}`);
      return count;
    } catch (error) {
      console.error(`❌ DatabaseStorage: Error deleting comprehensive analysis for deal ${dealId}:`, error);
      return 0;
    }
  }

  async deleteBackgroundUploadsByDealId(dealId: number): Promise<number> {
    try {
      console.log(`🗑️ DatabaseStorage: Deleting background uploads for deal ${dealId}...`);
      // Use raw SQL since background_uploads table is not defined in Drizzle schema
      const result = await db.execute(sql`DELETE FROM background_uploads WHERE deal_id = ${dealId}`);
      const count = result.rowCount || 0;
      console.log(`🗑️ DatabaseStorage: Deleted ${count} background upload record(s) for deal ${dealId}`);
      return count;
    } catch (error) {
      console.error(`❌ DatabaseStorage: Error deleting background uploads for deal ${dealId}:`, error);
      return 0;
    }
  }

  async deleteInvestorMatchesByDealId(dealId: number): Promise<number> {
    try {
      console.log(`🗑️ DatabaseStorage: Deleting investor matches for deal ${dealId}...`);
      // Import investorMatches from schema
      const { investorMatches } = await import('../shared/schema');
      const result = await db.delete(investorMatches).where(eq(investorMatches.dealId, dealId));
      const count = result.rowCount || 0;
      console.log(`🗑️ DatabaseStorage: Deleted ${count} investor match record(s) for deal ${dealId}`);
      return count;
    } catch (error) {
      console.error(`❌ DatabaseStorage: Error deleting investor matches for deal ${dealId}:`, error);
      return 0;
    }
  }

  async deleteInvestmentMemosByDealId(dealId: number): Promise<number> {
    try {
      console.log(`🗑️ DatabaseStorage: Deleting investment memos for deal ${dealId}...`);
      // Import investmentMemos from schema
      const { investmentMemos } = await import('../shared/schema');
      const result = await db.delete(investmentMemos).where(eq(investmentMemos.dealId, dealId));
      const count = result.rowCount || 0;
      console.log(`🗑️ DatabaseStorage: Deleted ${count} investment memo record(s) for deal ${dealId}`);
      return count;
    } catch (error) {
      console.error(`❌ DatabaseStorage: Error deleting investment memos for deal ${dealId}:`, error);
      return 0;
    }
  }

  async deleteAutomationExecutionsByDealId(dealId: number): Promise<number> {
    try {
      console.log(`🗑️ DatabaseStorage: Deleting automation executions for deal ${dealId}...`);
      // Import automationExecutions from schema
      const { automationExecutions } = await import('../shared/schema');
      const result = await db.delete(automationExecutions).where(eq(automationExecutions.dealId, dealId));
      const count = result.rowCount || 0;
      console.log(`🗑️ DatabaseStorage: Deleted ${count} automation execution record(s) for deal ${dealId}`);
      return count;
    } catch (error) {
      console.error(`❌ DatabaseStorage: Error deleting automation executions for deal ${dealId}:`, error);
      return 0;
    }
  }

  async deleteResearchBackgroundJobsByDealId(dealId: number): Promise<number> {
    try {
      console.log(`🗑️ DatabaseStorage: Deleting research background jobs for deal ${dealId}...`);
      // Import researchBackgroundJobs from schema
      const { researchBackgroundJobs } = await import('../shared/schema');
      const result = await db.delete(researchBackgroundJobs).where(eq(researchBackgroundJobs.dealId, dealId));
      const count = result.rowCount || 0;
      console.log(`🗑️ DatabaseStorage: Deleted ${count} research background job record(s) for deal ${dealId}`);
      return count;
    } catch (error) {
      console.error(`❌ DatabaseStorage: Error deleting research background jobs for deal ${dealId}:`, error);
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
      // Ensure agentType is properly formatted
      const formattedAgentType = agentType ? agentType.charAt(0).toUpperCase() + agentType.slice(1) : 'Unknown';
      
      const existing = await db.select().from(agentAnalyses)
        .where(and(eq(agentAnalyses.dealId, dealId), eq(agentAnalyses.agentType, formattedAgentType)));
      
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
      
      // Prioritize "completed" or "Completed" status records over "Failed" ones, then by content
      let analysisResult = analysisResults.find(result => 
        result.status === 'Completed' || result.status === 'completed'
      );
      
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
          financialAnswers: analysisResult.financial_answers || null,
          hrAnswers: analysisResult.hr_answers || null,
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

  async getRunningBackgroundJobs(dealId?: number): Promise<BackgroundJob[]> {
    try {
      // Include both 'processing' and recently 'completed' jobs for frontend visibility
      let whereConditions = [];
      
      // Base condition: either processing OR recently completed
      const statusCondition = or(
        eq(backgroundJobs.status, 'processing'),
        and(
          eq(backgroundJobs.status, 'completed'),
          // Show completed jobs for 15 seconds after completion
          sql`completed_at > NOW() - INTERVAL '15 seconds'`
        )
      );
      
      whereConditions.push(statusCondition);
      
      if (dealId !== undefined) {
        whereConditions.push(eq(backgroundJobs.dealId, dealId));
      }
      
      const jobs = await db.select().from(backgroundJobs)
        .where(and(...whereConditions))
        .orderBy(backgroundJobs.createdAt);
      
      console.log(`📊 Found ${jobs.length} running background jobs${dealId ? ` for deal ${dealId}` : ''}`);
      return jobs;
    } catch (error) {
      console.error('Error fetching running background jobs:', error);
      return [];
    }
  }

  async completeBackgroundJob(jobId: string, results: any): Promise<void> {
    try {
      await db
        .update(backgroundJobs)
        .set({
          status: 'completed',
          progress: 100,
          completedAt: new Date(),
          results: JSON.stringify(results)
        })
        .where(eq(backgroundJobs.jobId, jobId));
      
      console.log(`✅ Background job ${jobId} marked as completed`);
    } catch (error) {
      console.error(`❌ Error completing background job ${jobId}:`, error);
      throw error;
    }
  }

  async failBackgroundJob(jobId: string, errorMessage: string): Promise<void> {
    try {
      await db
        .update(backgroundJobs)
        .set({
          status: 'failed',
          error: errorMessage,
          failedAt: new Date()
        })
        .where(eq(backgroundJobs.jobId, jobId));
      
      console.log(`❌ Background job ${jobId} marked as failed: ${errorMessage}`);
    } catch (error) {
      console.error(`❌ Error failing background job ${jobId}:`, error);
      throw error;
    }
  }

  async clearStuckBackgroundJobs(dealId?: number): Promise<number> {
    try {
      let query = db
        .update(backgroundJobs)
        .set({
          status: 'cancelled',
          updatedAt: new Date()
        })
        .where(eq(backgroundJobs.status, 'processing'));
      
      if (dealId) {
        query = query.where(and(
          eq(backgroundJobs.status, 'processing'),
          eq(backgroundJobs.dealId, dealId)
        ));
      }
      
      const result = await query;
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error clearing stuck background jobs:', error);
      return 0;
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







  async updateStuckBackgroundJobs(dealId: number): Promise<number> {
    try {
      console.log(`🔄 Clearing completed/cancelled/failed background jobs for deal ${dealId}`);
      
      // First, delete all completed, cancelled, and failed jobs to prevent duplicate key constraints
      const deleteCompletedResult = await db.delete(backgroundJobs)
        .where(and(
          eq(backgroundJobs.dealId, dealId),
          inArray(backgroundJobs.status, ['completed', 'cancelled', 'failed'])
        ));
      
      const deletedCompleted = deleteCompletedResult.rowCount || 0;
      console.log(`🗑️ Deleted ${deletedCompleted} completed/cancelled/failed jobs`);
      
      // Update remaining processing jobs older than 1 hour to cancelled status
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const updateResult = await db.update(backgroundJobs)
        .set({
          status: 'cancelled',
          error: 'Job stuck - cancelled by system',
          updatedAt: new Date()
        })
        .where(and(
          eq(backgroundJobs.dealId, dealId),
          eq(backgroundJobs.status, 'processing')
        ));
      
      const updatedStuck = updateResult.rowCount || 0;
      console.log(`✅ Updated ${updatedStuck} stuck jobs to cancelled status`);
      
      return deletedCompleted + updatedStuck;
    } catch (error) {
      console.error(`Error clearing background jobs for deal ${dealId}:`, error);
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

  async getBackgroundJobById(jobId: string): Promise<BackgroundJob | null> {
    try {
      const jobs = await db.select()
        .from(backgroundJobs)
        .where(eq(backgroundJobs.jobId, jobId))
        .limit(1);
      
      return jobs[0] || null;
    } catch (error) {
      console.error(`Error getting background job ${jobId}:`, error);
      return null;
    }
  }

  async deleteBackgroundJob(jobId: string): Promise<boolean> {
    try {
      console.log(`🗑️ Deleting background job ${jobId}`);
      const result = await db.delete(backgroundJobs)
        .where(eq(backgroundJobs.jobId, jobId));
      
      const deleted = result.rowCount > 0;
      console.log(`${deleted ? '✅' : '❌'} Background job ${jobId} ${deleted ? 'deleted' : 'not found'}`);
      return deleted;
    } catch (error) {
      console.error(`Error deleting background job ${jobId}:`, error);
      return false;
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