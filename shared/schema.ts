import { pgTable, text, varchar, serial, integer, numeric, boolean, timestamp, json, bigint, vector, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define roles enum
export const UserRole = {
  ADMIN: "admin",
  USER: "user"
} as const;

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default(UserRole.USER),
  avatar: text("avatar"),
  // Extended profile fields
  phone: text("phone"),
  location: text("location"),
  bio: text("bio"),
  title: text("title"),
  company: text("company"),
  website: text("website"),
  linkedin: text("linkedin"),
  twitter: text("twitter"),
  language: text("language").default("en"),
  // User preferences and settings
  timezone: text("timezone").default("UTC"),
  emailNotifications: boolean("email_notifications").default(true),
  dealNotifications: boolean("deal_notifications").default(true),
  aiNotifications: boolean("ai_notifications").default(true),
  weeklyReports: boolean("weekly_reports").default(false),
  browserNotifications: boolean("browser_notifications").default(true),
  matchNotifications: boolean("match_notifications").default(true),
  reportNotifications: boolean("report_notifications").default(true),
  // Privacy settings
  showEmail: boolean("show_email").default(false),
  showPhone: boolean("show_phone").default(false),
  publicProfile: boolean("public_profile").default(true),
  apiKey: text("api_key"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// We'll extend this schema with validation in the registration component
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// System Settings table for global configuration
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  category: text("category").default("general"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Document Embeddings for RAG system
export const documentEmbeddings = pgTable("document_embeddings", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  dealId: integer("deal_id").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  chunkText: text("chunk_text").notNull(),
  embedding: json("embedding").notNull(), // Store as JSON array for now
  tokenCount: integer("token_count").notNull(),
  metadata: json("metadata"), // Store document name, type, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDocumentEmbeddingSchema = createInsertSchema(documentEmbeddings).omit({
  id: true,
  createdAt: true,
});

// Query Cache for semantic caching
export const queryCache = pgTable("query_cache", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull(),
  queryText: text("query_text").notNull(),
  queryEmbedding: json("query_embedding").notNull(),
  response: text("response").notNull(),
  similarity: real("similarity"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const insertQueryCacheSchema = createInsertSchema(queryCache).omit({
  id: true,
  createdAt: true,
});

// Login schema for validation
export const loginUserSchema = z.object({
  email: z.string().min(1, "Email or username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  stayLoggedIn: z.boolean().optional().default(false),
});

// Deals
export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  description: text("description").notNull(),
  sector: text("sector").notNull(),
  stage: text("stage").notNull(),
  location: text("location"),
  website: text("website"),
  fundingAmount: integer("funding_amount"),
  aiScore: text("ai_score"),
  status: text("status").notNull().default("New Submission"),
  createdBy: integer("created_by").references(() => users.id),
  pitchDeck: text("pitch_deck"),
  teamSize: integer("team_size"),
  founderInfo: text("founder_info"),
  additionalInfo: text("additional_info"),
  email: text("email"),
  tags: text("tags").array().default([]),
  riskLevel: text("risk_level"),
  dueDiligence: json("due_diligence").$type<{ notes?: string[]; documents?: string[] }>(),
  // AI Evaluation fields
  aiEvaluation: json("ai_evaluation").$type<{ score?: number; reasoning?: string; risks?: string[]; opportunities?: string[]; keyInsights?: string[] }>(),
  aiScore_New: integer("ai_score_new"),
  // Company Research fields
  researchData: json("research_data").$type<any>(),
  // CEO Background Info
  ceoBackgroundInfo: json("ceo_background_info").$type<any>(),
  // Founder Success Score
  founderSuccessScore: json("founder_success_score").$type<any>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDealSchema = createInsertSchema(deals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Background Jobs
export const backgroundJobs = pgTable("background_jobs", {
  id: serial("id").primaryKey(),
  jobId: text("job_id").notNull().unique(),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"), // pending, running, completed, failed
  dealId: integer("deal_id").references(() => deals.id),
  documentId: integer("document_id").references(() => documents.id),
  result: json("result"),
  error: text("error"),
  progress: integer("progress").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertBackgroundJobSchema = createInsertSchema(backgroundJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Documents
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  processedContent: text("processed_content"),
  aiSummary: text("ai_summary"),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  extractedText: text("extracted_text"),
  tags: text("tags").array().default([]),
  // Document Assignment fields
  assignedAgents: text("assigned_agents").array().default([]), // Array of agent types: ['legal', 'clinical', 'financial', etc.]
  assignmentReason: text("assignment_reason"), // AI explanation for assignment
  assignmentConfidence: numeric("assignment_confidence", { precision: 3, scale: 2 }), // Confidence score (0.00-1.00)
  // Advanced extraction fields
  ragExtractedText: text("rag_extracted_text"), // Full extracted text for RAG
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Document Assignment Learning table (for improving assignment accuracy over time)
export const documentAssignmentLearning = pgTable("document_assignment_learning", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documents.id),
  dealId: integer("deal_id").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type"), // 'legal', 'clinical', 'financial', etc.
  assignedAgents: text("assigned_agents").array().notNull(),
  correctAgents: text("correct_agents").array(), // User feedback on correct assignment
  keywords: text("keywords").array(), // Important keywords found in document
  confidence: numeric("confidence", { precision: 3, scale: 2 }),
  feedback: text("feedback"), // User feedback on assignment
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDocumentAssignmentLearningSchema = createInsertSchema(documentAssignmentLearning).omit({
  id: true,
  createdAt: true,
});

// Agent Assignment Rules Table (for learning patterns)
export const agentAssignmentRules = pgTable("agent_assignment_rules", {
  id: serial("id").primaryKey(),
  agentType: text("agent_type").notNull(),
  ruleType: text("rule_type").notNull(), // 'keyword', 'content_type', 'pattern'
  ruleValue: text("rule_value").notNull(), // The actual rule (keyword, regex, etc.)
  priority: integer("priority").default(0), // Higher priority rules are checked first
  confidence: numeric("confidence", { precision: 3, scale: 2 }), // How confident this rule is
  successRate: numeric("success_rate", { precision: 3, scale: 2 }), // Historical success rate
  usageCount: integer("usage_count").default(0), // How many times this rule was used
  lastUsed: timestamp("last_used"),
  createdBy: text("created_by").default("system"), // 'system' or 'user'
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAgentAssignmentRuleSchema = createInsertSchema(agentAssignmentRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Agent Analyses
export const agentAnalyses = pgTable("agent_analyses", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  agentType: text("agent_type").notNull(),
  status: text("status").notNull().default("Waiting"),
  progress: integer("progress").notNull().default(0),
  findings: json("findings").$type<{ id: number; content: string; type: string }[]>(),
  recommendations: json("recommendations").$type<{ title: string; description: string; priority: string; category: string; impact: string }[]>(),
  documentSources: json("document_sources").$type<string[]>(),
  legalAnswers: json("legal_answers").$type<{
    [key: string]: {
      question: string;
      answer: string;
      confidence: number;
      sources: string[];
    };
  }>(),
  clinicalAnswers: json("clinical_answers").$type<{
    [key: string]: {
      question: string;
      answer: string;
      confidence: number;
      sources: string[];
      detailedEvidence?: any[];
      keyFindings?: string[];
      recommendations?: string[];
    };
  }>(),
  commercialAnswers: json("commercial_answers").$type<{
    [key: string]: {
      question: string;
      answer: string;
      confidence: number;
      sources: string[];
      detailedEvidence?: any[];
      keyFindings?: string[];
      recommendations?: string[];
    };
  }>(),
  ip_answers: json("ip_answers").$type<{
    [key: string]: {
      question: string;
      answer: string;
      confidence: number;
      sources: string[];
      keyFindings?: string[];
      evidenceSummary?: string;
      ipAssessment?: string;
      recommendations?: string[];
      jurisdiction?: string;
      patentStatus?: string;
      trademarkClass?: string;
      licenseType?: string;
    };
  }>(),
  hr_answers: json("hr_answers").$type<{
    [key: string]: {
      question: string;
      answer: string;
      confidence: number;
      sources: string[];
      detailedEvidence?: any[];
      keyFindings?: string[];
      recommendations?: string[];
    };
  }>(),
  financial_answers: json("financial_answers").$type<{
    [key: string]: {
      question: string;
      answer: string;
      confidence: number;
      sources: string[];
      detailedEvidence?: any[];
      keyFindings?: string[];
      recommendations?: string[];
    };
  }>(),
  research_answers: json("research_answers").$type<{
    [key: string]: {
      question: string;
      answer: string;
      confidence: number;
      sources: string[];
      detailedEvidence?: any[];
      keyFindings?: string[];
      recommendations?: string[];
    };
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAgentAnalysisSchema = createInsertSchema(agentAnalyses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Investment Memos
export const investmentMemos = pgTable("investment_memos", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  executiveSummary: text("executive_summary"),
  productMarket: text("product_market"),
  team: json("team").$type<{ id: number; name: string; title: string; background: string }[]>(),
  financials: json("financials").$type<{
    burnRate: number;
    runway: number;
    funding: { round: string; amount: number; date: string; investors: string[] }[];
    metrics: { [key: string]: any };
    useOfFunds: { [key: string]: number };
  }>(),
  swot: json("swot").$type<{
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  }>(),
  // New comprehensive memo field for 30-50 page detailed memos
  memo: json("memo"),
  status: text("status").notNull().default("Draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertInvestmentMemoSchema = createInsertSchema(investmentMemos, {
  isPublic: z.boolean().optional(),
  showInDashboard: z.boolean().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Legacy investor matches table (kept for backward compatibility)
export const investorMatches = pgTable("investor_matches", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  investorId: integer("investor_id"),
  matchScore: integer("match_score").notNull(),
  matchInsights: json("match_insights").$type<string[]>(),
  status: text("status").notNull().default("New Match"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertInvestorMatchSchema = createInsertSchema(investorMatches, {
  isActive: z.boolean().optional(),
  contacted: z.boolean().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Automations
export const automations = pgTable("automations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  trigger: text("trigger").notNull(),
  action: text("action").notNull(),
  scope: text("scope").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  triggerType: varchar("trigger_type", { length: 50 }).notNull().default("event_based"), // 'time_based', 'event_based', 'condition_based'
  actionType: varchar("action_type", { length: 50 }).notNull().default("notification"), // 'email', 'notification', 'status_update', 'document_action', 'meeting_schedule'
  executionCount: integer("execution_count").notNull().default(0),
  lastExecutedAt: timestamp("last_executed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAutomationSchema = createInsertSchema(automations, {
  isActive: z.boolean().default(false),
  runImmediately: z.boolean().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  executionCount: true,
  lastExecutedAt: true,
});

// Automation Executions
export const automationExecutions = pgTable("automation_executions", {
  id: serial("id").primaryKey(),
  automationId: integer("automation_id").notNull().references(() => automations.id),
  dealId: integer("deal_id").references(() => deals.id),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
  status: text("status").notNull(), // 'success' or 'failure'
  result: json("result"), // Any execution results
  error: text("error"), // Any errors that occurred
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAutomationExecutionSchema = createInsertSchema(automationExecutions).omit({
  id: true,
  executedAt: true,
  createdAt: true,
});

// Company Research
export const companyResearch = pgTable("company_research", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id).unique(),
  companyName: text("company_name"),
  industry: text("industry"),
  founded: text("founded"),
  headquarters: text("headquarters"),
  employees: text("employees"),
  revenue: text("revenue"),
  funding: json("funding"),
  competitors: json("competitors"),
  products: json("products"),
  keyPeople: json("key_people"),
  newsArticles: json("news_articles"),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCompanyResearchSchema = createInsertSchema(companyResearch).omit({
  id: true,
  lastUpdated: true,
  createdAt: true,
});

// Data Room Connections
export const dataRoomConnections = pgTable("data_room_connections", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id).unique(),
  provider: text("provider").notNull(), // 'google_drive', 'sharepoint', 'dropbox'
  connectionData: json("connection_data"), // Encrypted connection details
  lastSynced: timestamp("last_synced"),
  syncStatus: text("sync_status").default("pending"), // 'pending', 'syncing', 'completed', 'error'
  syncError: text("sync_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDataRoomConnectionSchema = createInsertSchema(dataRoomConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Microsoft Email Connections
export const microsoftEmailConnections = pgTable("microsoft_email_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiry: timestamp("token_expiry").notNull(),
  email: text("email").notNull(),
  tenantId: text("tenant_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMicrosoftEmailConnectionSchema = createInsertSchema(microsoftEmailConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Evaluation Criteria
export const evaluationCriteria = pgTable("evaluation_criteria", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // 'team', 'product', 'market', 'financials', 'technology'
  weight: numeric("weight", { precision: 3, scale: 2 }).default("1.00"),
  questions: json("questions").$type<string[]>(),
  scoringGuidelines: json("scoring_guidelines"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEvaluationCriteriaSchema = createInsertSchema(evaluationCriteria).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Evaluation Results
export const evaluationResults = pgTable("evaluation_results", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  criteriaId: integer("criteria_id").notNull().references(() => evaluationCriteria.id),
  score: numeric("score", { precision: 3, scale: 2 }).notNull(),
  comments: text("comments"),
  evidence: json("evidence"),
  evaluatedBy: integer("evaluated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEvaluationResultSchema = createInsertSchema(evaluationResults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Research Jobs
export const researchJobs = pgTable("research_jobs", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  jobType: text("job_type").notNull(), // 'company', 'ceo', 'founder_score', 'comprehensive'
  status: text("status").notNull().default("pending"), // 'pending', 'running', 'completed', 'failed'
  progress: integer("progress").default(0),
  result: json("result"),
  error: text("error"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertResearchJobSchema = createInsertSchema(researchJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Daily Sync Jobs for matching intelligence
export const dailySyncJobs = pgTable("daily_sync_jobs", {
  id: serial("id").primaryKey(),
  jobType: text("job_type").notNull(), // 'affinity_sync', 'linkedin_sync', 'enrichment'
  status: text("status").notNull().default("pending"), // 'pending', 'running', 'completed', 'failed'
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  recordsProcessed: integer("records_processed").default(0),
  recordsFailed: integer("records_failed").default(0),
  errorMessage: text("error_message"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDailySyncJobSchema = createInsertSchema(dailySyncJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// User Activities
export const userActivities = pgTable("user_activities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  activityType: text("activity_type").notNull(), // 'login', 'deal_created', 'document_uploaded', etc.
  entityType: text("entity_type"), // 'deal', 'document', 'investor', etc.
  entityId: integer("entity_id"),
  description: text("description"),
  metadata: json("metadata"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserActivitySchema = createInsertSchema(userActivities).omit({
  id: true,
  createdAt: true,
});

// User Stats
export const userStats = pgTable("user_stats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  totalDeals: integer("total_deals").default(0),
  totalDocuments: integer("total_documents").default(0),
  totalAnalyses: integer("total_analyses").default(0),
  totalMemos: integer("total_memos").default(0),
  lastActive: timestamp("last_active"),
  loginCount: integer("login_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserStatSchema = createInsertSchema(userStats).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Persistent Upload Sessions for chunked uploads
export const persistentUploadSessions = pgTable("persistent_upload_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  uploadedSize: integer("uploaded_size").default(0),
  chunkSize: integer("chunk_size").notNull(),
  totalChunks: integer("total_chunks").notNull(),
  uploadedChunks: json("uploaded_chunks").$type<number[]>().default([]),
  status: text("status").notNull().default("pending"), // 'pending', 'uploading', 'completed', 'failed'
  error: text("error"),
  filePath: text("file_path"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPersistentUploadSessionSchema = createInsertSchema(persistentUploadSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Workflow templates
export const workflowTemplates = pgTable("workflow_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 50 }).notNull(), // 'due_diligence', 'communication', 'document_processing', 'reporting', 'matching'
  icon: text("icon").notNull().default("Zap"),
  steps: json("steps").$type<{
    id: string;
    name: string;
    type: string;
    config: any;
    dependencies?: string[];
  }[]>().notNull(),
  triggers: json("triggers").$type<{
    type: string;
    config: any;
  }[]>().notNull(),
  actions: json("actions").$type<{
    type: string;
    config: any;
  }[]>().notNull(),
  isPublic: boolean("is_public").notNull().default(false),
  popularity: integer("popularity").notNull().default(0),
  timeSaved: text("time_saved"), // e.g., "2-3 hours per deal"
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWorkflowTemplateSchema = createInsertSchema(workflowTemplates, {
  steps: z.array(z.any()).min(1, "At least one step is required"),
  triggers: z.array(z.any()).min(1, "At least one trigger is required"),
  actions: z.array(z.any()).min(1, "At least one action is required"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  popularity: true,
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;
export type Deal = typeof deals.$inferSelect;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type AgentAnalysis = typeof agentAnalyses.$inferSelect;
export type InsertAgentAnalysis = z.infer<typeof insertAgentAnalysisSchema>;
export type InvestmentMemo = typeof investmentMemos.$inferSelect;
export type InsertInvestmentMemo = z.infer<typeof insertInvestmentMemoSchema>;
export type InvestorMatch = typeof investorMatches.$inferSelect;
export type InsertInvestorMatch = z.infer<typeof insertInvestorMatchSchema>;
export type Automation = typeof automations.$inferSelect;
export type InsertAutomation = z.infer<typeof insertAutomationSchema>;
export type AutomationExecution = typeof automationExecutions.$inferSelect;
export type InsertAutomationExecution = z.infer<typeof insertAutomationExecutionSchema>;
export type CompanyResearch = typeof companyResearch.$inferSelect;
export type InsertCompanyResearch = z.infer<typeof insertCompanyResearchSchema>;
export type DataRoomConnection = typeof dataRoomConnections.$inferSelect;
export type InsertDataRoomConnection = z.infer<typeof insertDataRoomConnectionSchema>;
export type MicrosoftEmailConnection = typeof microsoftEmailConnections.$inferSelect;
export type InsertMicrosoftEmailConnection = z.infer<typeof insertMicrosoftEmailConnectionSchema>;
export type EvaluationCriteria = typeof evaluationCriteria.$inferSelect;
export type InsertEvaluationCriteria = z.infer<typeof insertEvaluationCriteriaSchema>;
export type EvaluationResult = typeof evaluationResults.$inferSelect;
export type InsertEvaluationResult = z.infer<typeof insertEvaluationResultSchema>;
export type ResearchJob = typeof researchJobs.$inferSelect;
export type InsertResearchJob = z.infer<typeof insertResearchJobSchema>;
export type DailySyncJob = typeof dailySyncJobs.$inferSelect;
export type InsertDailySyncJob = z.infer<typeof insertDailySyncJobSchema>;
export type UserActivity = typeof userActivities.$inferSelect;
export type InsertUserActivity = z.infer<typeof insertUserActivitySchema>;
export type UserStat = typeof userStats.$inferSelect;
export type InsertUserStat = z.infer<typeof insertUserStatSchema>;
export type PersistentUploadSession = typeof persistentUploadSessions.$inferSelect;
export type InsertPersistentUploadSession = z.infer<typeof insertPersistentUploadSessionSchema>;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type BackgroundJob = typeof backgroundJobs.$inferSelect;
export type InsertBackgroundJob = z.infer<typeof insertBackgroundJobSchema>;
export type WorkflowTemplate = typeof workflowTemplates.$inferSelect;
export type InsertWorkflowTemplate = z.infer<typeof insertWorkflowTemplateSchema>;
export type DocumentAssignmentLearning = typeof documentAssignmentLearning.$inferSelect;
export type InsertDocumentAssignmentLearning = z.infer<typeof insertDocumentAssignmentLearningSchema>;
export type AgentAssignmentRule = typeof agentAssignmentRules.$inferSelect;
export type InsertAgentAssignmentRule = z.infer<typeof insertAgentAssignmentRuleSchema>;

// Comprehensive analyses table
export const comprehensiveAnalyses = pgTable("comprehensive_analyses", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  clinicalAnswers: text("clinical_answers"), // JSON string containing all clinical question answers
  findings: text("findings"), // JSON string containing findings
  recommendations: text("recommendations"), // JSON string containing recommendations
  status: text("status").notNull().default("Pending"),
  progress: integer("progress").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertComprehensiveAnalysisSchema = createInsertSchema(comprehensiveAnalyses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ComprehensiveAnalysis = typeof comprehensiveAnalyses.$inferSelect;
export type InsertComprehensiveAnalysis = z.infer<typeof insertComprehensiveAnalysisSchema>;

// Comprehensive Commercial Analyses table
export const comprehensiveCommercialAnalyses = pgTable("comprehensive_commercial_analyses", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  commercialAnswers: text("commercial_answers"), // JSON string containing all commercial question answers
  findings: text("findings"), // JSON string containing commercial findings
  recommendations: text("recommendations"), // JSON string containing commercial recommendations
  status: text("status").notNull().default("In Progress"),
  progress: integer("progress").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertComprehensiveCommercialAnalysisSchema = createInsertSchema(comprehensiveCommercialAnalyses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ComprehensiveCommercialAnalysis = typeof comprehensiveCommercialAnalyses.$inferSelect;
export type InsertComprehensiveCommercialAnalysis = z.infer<typeof insertComprehensiveCommercialAnalysisSchema>;

// Organizations table (for matching intelligence)
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'VC', 'PE', 'Corporate VC', 'Accelerator', 'Family Office', 'Angel Group', 'Government', 'Bank', 'Strategic'
  website: text("website"),
  description: text("description"),
  foundedYear: integer("founded_year"),
  // Investment Profile
  checkSize: json("check_size").$type<{ min: number; max: number; currency: string }>(),
  sweetSpot: integer("sweet_spot"), // Typical investment amount in thousands
  sectors: text("sectors").array().default([]),
  stages: text("stages").array().default([]),
  geographies: text("geographies").array().default([]),
  investmentThesis: text("investment_thesis"),
  // Portfolio & Track Record
  portfolioCompanies: integer("portfolio_companies"),
  totalInvestments: integer("total_investments"),
  exits: integer("exits"),
  aum: bigint("aum", { mode: 'number' }), // Assets Under Management in USD
  dryPowder: bigint("dry_powder", { mode: 'number' }), // Available capital to deploy
  // Team & Contacts
  teamSize: integer("team_size"),
  keyPartners: json("key_partners").$type<{ name: string; title: string; focus: string; bio: string }[]>(),
  // Metadata
  source: text("source"), // 'affinity', 'manual', 'import', 'enriched'
  affinityOrgId: text("affinity_org_id"), // External ID from Affinity CRM
  lastEnriched: timestamp("last_enriched"),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  // Contact Information
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  linkedin: text("linkedin"),
  twitter: text("twitter"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;

// Investors table (individuals within organizations)
export const investors = pgTable("investors", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id),
  // Personal Information
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").unique(),
  phone: text("phone"),
  title: text("title"),
  bio: text("bio"),
  // Investment Focus
  focusSectors: text("focus_sectors").array().default([]),
  focusStages: text("focus_stages").array().default([]),
  focusGeographies: text("focus_geographies").array().default([]),
  checkSizeRange: json("check_size_range").$type<{ min: number; max: number }>(),
  // Track Record
  dealsLed: integer("deals_led"),
  boardSeats: json("board_seats").$type<string[]>(),
  notableInvestments: json("notable_investments").$type<{ company: string; outcome: string }[]>(),
  // Social & Professional
  linkedin: text("linkedin"),
  twitter: text("twitter"),
  personalWebsite: text("personal_website"),
  education: json("education").$type<{ school: string; degree: string; year: number }[]>(),
  previousRoles: json("previous_roles").$type<{ company: string; title: string; duration: string }[]>(),
  // Metadata
  source: text("source"), // 'affinity', 'manual', 'linkedin', 'enriched'
  affinityPersonId: text("affinity_person_id"), // External ID from Affinity CRM
  lastEnriched: timestamp("last_enriched"),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  tags: text("tags").array().default([]),
  // Engagement Tracking
  lastContacted: timestamp("last_contacted"),
  preferredContactMethod: text("preferred_contact_method"), // 'email', 'phone', 'linkedin'
  relationshipStrength: integer("relationship_strength"), // 1-10 scale
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertInvestorSchema = createInsertSchema(investors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Investor = typeof investors.$inferSelect;
export type InsertInvestor = z.infer<typeof insertInvestorSchema>;

// Deal-Organization matching table (Intelligent matching results)
export const dealOrganizationMatches = pgTable("deal_organization_matches", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  // Match Scoring
  overallScore: integer("overall_score").notNull(), // 0-100
  sectorScore: integer("sector_score"), // Sector alignment score
  stageScore: integer("stage_score"), // Stage alignment score
  checkSizeScore: integer("check_size_score"), // Funding amount alignment
  geographyScore: integer("geography_score"), // Geographic alignment
  thesisScore: integer("thesis_score"), // Investment thesis alignment
  // Match Insights
  matchReasons: json("match_reasons").$type<string[]>(),
  concerns: json("concerns").$type<string[]>(),
  strengthFactors: json("strength_factors").$type<{ factor: string; score: number }[]>(),
  // AI Analysis
  aiInsights: text("ai_insights"), // AI-generated match explanation
  aiConfidence: numeric("ai_confidence", { precision: 3, scale: 2 }), // AI confidence in match
  // Status Tracking
  status: text("status").notNull().default("New"), // 'New', 'Qualified', 'Contacted', 'In Discussion', 'Term Sheet', 'Closed', 'Passed'
  priority: text("priority"), // 'High', 'Medium', 'Low'
  nextAction: text("next_action"),
  // Engagement
  lastContactDate: timestamp("last_contact_date"),
  contactHistory: json("contact_history").$type<{ date: Date; type: string; notes: string }[]>(),
  decisionMaker: integer("decision_maker").references(() => investors.id),
  // Metadata
  createdBy: integer("created_by").references(() => users.id),
  assignedTo: integer("assigned_to").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDealOrganizationMatchSchema = createInsertSchema(dealOrganizationMatches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DealOrganizationMatch = typeof dealOrganizationMatches.$inferSelect;
export type InsertDealOrganizationMatch = z.infer<typeof insertDealOrganizationMatchSchema>;

// Deal-Investor specific matches (individual investor matches within organizations)
export const dealInvestorMatches = pgTable("deal_investor_matches", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  investorId: integer("investor_id").notNull().references(() => investors.id),
  organizationMatchId: integer("organization_match_id").references(() => dealOrganizationMatches.id),
  // Individual Match Scoring
  personalScore: integer("personal_score").notNull(), // 0-100
  expertiseScore: integer("expertise_score"), // Domain expertise alignment
  networkScore: integer("network_score"), // Network/connections value
  trackRecordScore: integer("track_record_score"), // Relevant past investments
  // Insights
  matchReasons: json("match_reasons").$type<string[]>(),
  relevantExperience: json("relevant_experience").$type<string[]>(),
  mutualConnections: json("mutual_connections").$type<string[]>(),
  // Engagement Status
  status: text("status").notNull().default("Identified"), // 'Identified', 'Warm Intro', 'Connected', 'Meeting Set', 'Due Diligence', 'Negotiating', 'Committed', 'Declined'
  engagementLevel: text("engagement_level"), // 'Cold', 'Warm', 'Hot'
  // Communication
  lastContactDate: timestamp("last_contact_date"),
  preferredIntro: text("preferred_intro"), // How to best approach this investor
  notes: text("notes"),
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDealInvestorMatchSchema = createInsertSchema(dealInvestorMatches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DealInvestorMatch = typeof dealInvestorMatches.$inferSelect;
export type InsertDealInvestorMatch = z.infer<typeof insertDealInvestorMatchSchema>;

// Email campaigns table
export const emailCampaigns = pgTable("email_campaigns", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  template: text("template").notNull(), // Email template with placeholders
  // Campaign settings
  scheduledDate: timestamp("scheduled_date"),
  sendTime: text("send_time"), // Time of day to send
  followUpEnabled: boolean("follow_up_enabled").default(false),
  followUpDays: integer("follow_up_days").default(5),
  // Materials included
  attachments: text("attachments").array().notNull().default([]), // Array of file paths
  includeInvestmentMemo: boolean("include_investment_memo").default(true),
  includeTeaserDeck: boolean("include_teaser_deck").default(true),
  includeFinancials: boolean("include_financials").default(false),
  // Tracking
  totalRecipients: integer("total_recipients").default(0),
  emailsSent: integer("emails_sent").default(0),
  emailsDelivered: integer("emails_delivered").default(0),
  emailsOpened: integer("emails_opened").default(0),
  emailsClicked: integer("emails_clicked").default(0),
  emailsReplied: integer("emails_replied").default(0),
  // Status
  status: text("status").notNull().default("draft"), // 'draft', 'scheduled', 'sending', 'sent', 'completed'
  sentAt: timestamp("sent_at"),
  completedAt: timestamp("completed_at"),
  // Metadata
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEmailCampaignSchema = createInsertSchema(emailCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;

// Campaign recipients table
export const campaignRecipients = pgTable("campaign_recipients", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => emailCampaigns.id, { onDelete: "cascade" }),
  investorId: integer("investor_id").notNull().references(() => investors.id, { onDelete: "cascade" }),
  matchId: integer("match_id").references(() => dealInvestorMatches.id, { onDelete: "cascade" }),
  // Email tracking
  emailAddress: text("email_address").notNull(),
  personalizedSubject: text("personalized_subject"),
  personalizedContent: text("personalized_content"),
  // Delivery tracking
  status: text("status").notNull().default("pending"), // 'pending', 'sent', 'delivered', 'bounced', 'failed'
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  repliedAt: timestamp("replied_at"),
  // Engagement
  openCount: integer("open_count").default(0),
  clickCount: integer("click_count").default(0),
  replyReceived: boolean("reply_received").default(false),
  // Follow-up
  followUpSent: boolean("follow_up_sent").default(false),
  followUpSentAt: timestamp("follow_up_sent_at"),
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCampaignRecipientSchema = createInsertSchema(campaignRecipients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CampaignRecipient = typeof campaignRecipients.$inferSelect;
export type InsertCampaignRecipient = z.infer<typeof insertCampaignRecipientSchema>;

// Comprehensive HR Analyses table
export const comprehensiveHrAnalyses = pgTable("comprehensive_hr_analyses", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  hrAnswers: text("hr_answers"), // JSON string containing all HR question answers
  findings: text("findings"), // JSON string containing HR findings
  recommendations: text("recommendations"), // JSON string containing HR recommendations
  status: text("status").notNull().default("In Progress"),
  progress: integer("progress").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertComprehensiveHrAnalysisSchema = createInsertSchema(comprehensiveHrAnalyses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ComprehensiveHrAnalysis = typeof comprehensiveHrAnalyses.$inferSelect;
export type InsertComprehensiveHrAnalysis = z.infer<typeof insertComprehensiveHrAnalysisSchema>;

// AI Query Cache table for semantic caching
export const aiQueryCache = pgTable("ai_query_cache", {
  id: text("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  queryEmbedding: vector("query_embedding", { dimensions: 1536 }), // OpenAI text-embedding-3-small
  query: text("query").notNull(),
  response: text("response").notNull(),
  language: text("language").notNull().default("English"),
  contextHash: text("context_hash").notNull(), // Hash of context for invalidation
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const insertAiQueryCacheSchema = createInsertSchema(aiQueryCache).omit({
  createdAt: true,
});

export type AiQueryCache = typeof aiQueryCache.$inferSelect;
export type InsertAiQueryCache = z.infer<typeof insertAiQueryCacheSchema>;

// ============================================
// UNIFIED AGENT ARCHITECTURE SCHEMAS
// ============================================

// Unified Agent Questions table - Defines all questions for all agent types
export const unifiedAgentQuestions = pgTable("unified_agent_questions", {
  id: serial("id").primaryKey(),
  agentType: text("agent_type").notNull(), // 'legal', 'clinical', 'commercial', 'hr', 'financial', 'ip', 'research'
  category: text("category").notNull(), // Question category/section
  questionId: text("question_id").notNull().unique(), // Unique question identifier
  question: text("question").notNull(), // Main question text
  subQuestions: text("sub_questions").array().default([]), // Sub-questions for detailed analysis
  ragQueries: text("rag_queries").array().default([]), // Multiple RAG queries for better retrieval
  priority: integer("priority").default(0), // Question priority/order
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUnifiedAgentQuestionSchema = createInsertSchema(unifiedAgentQuestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Unified Agent Answers table - Stores all answers with consistent structure
export const unifiedAgentAnswers = pgTable("unified_agent_answers", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  runId: text("run_id").notNull(), // Links to agent run
  agentType: text("agent_type").notNull(),
  questionId: text("question_id").notNull(),
  // Core answer fields
  answer: text("answer").notNull(),
  confidence: numeric("confidence", { precision: 3, scale: 2 }).notNull(), // 0.00 to 1.00
  
  // Evidence and sources
  sources: json("sources").$type<{
    documentId: number;
    documentName: string;
    page?: number;
    chunkId?: string;
    snippet: string;
    relevance: number;
  }[]>().notNull(),
  
  // Analysis results
  keyFindings: text("key_findings").array().default([]),
  recommendations: text("recommendations").array().default([]),
  riskScore: integer("risk_score"), // 1-10 scale
  
  // Domain-specific metrics (extensible)
  metrics: json("metrics").$type<{
    name: string;
    value: any;
    unit?: string;
    period?: string;
    confidence: number;
  }[]>(),
  
  // Processing metadata
  processingTime: integer("processing_time"), // milliseconds
  modelUsed: text("model_used"),
  tokenCount: integer("token_count"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUnifiedAgentAnswerSchema = createInsertSchema(unifiedAgentAnswers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Unified Agent Runs table - Tracks each agent analysis run
export const unifiedAgentRuns = pgTable("unified_agent_runs", {
  id: serial("id").primaryKey(),
  runId: text("run_id").notNull().unique(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  agentType: text("agent_type").notNull(),
  
  // Status tracking
  status: text("status").notNull().default("initializing"), // 'initializing', 'processing', 'completed', 'failed', 'cancelled'
  progress: integer("progress").notNull().default(0), // 0-100
  currentQuestion: text("current_question"),
  
  // Results summary
  totalQuestions: integer("total_questions").notNull().default(0),
  completedQuestions: integer("completed_questions").notNull().default(0),
  failedQuestions: integer("failed_questions").notNull().default(0),
  averageConfidence: numeric("average_confidence", { precision: 3, scale: 2 }),
  
  // Aggregated findings and recommendations
  findings: json("findings").$type<{
    id: number;
    type: string;
    content: string;
    confidence: number;
    category: string;
    sources: string[];
  }[]>(),
  
  recommendations: json("recommendations").$type<{
    id: number;
    title: string;
    description: string;
    priority: string;
    impact: string;
    category: string;
  }[]>(),
  
  // Error tracking
  errors: json("errors").$type<{
    questionId: string;
    error: string;
    timestamp: string;
    retryCount: number;
  }[]>(),
  
  // Metadata
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUnifiedAgentRunSchema = createInsertSchema(unifiedAgentRuns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Unified Background Jobs table - Generic job tracking for all agents
export const unifiedBackgroundJobs = pgTable("unified_background_jobs", {
  id: serial("id").primaryKey(),
  jobId: text("job_id").notNull().unique(),
  type: text("type").notNull(), // 'unified_agent_analysis'
  agentType: text("agent_type").notNull(),
  runId: text("run_id").references(() => unifiedAgentRuns.runId),
  
  // Job status
  status: text("status").notNull().default("pending"), // 'pending', 'running', 'completed', 'failed', 'cancelled'
  priority: integer("priority").default(0),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  
  // Job data
  dealId: integer("deal_id").references(() => deals.id),
  payload: json("payload"),
  result: json("result"),
  
  // Error tracking
  lastError: text("last_error"),
  errorCount: integer("error_count").default(0),
  
  // Progress tracking
  progress: integer("progress").default(0),
  progressMessage: text("progress_message"),
  
  // Timing
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUnifiedBackgroundJobSchema = createInsertSchema(unifiedBackgroundJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports for unified schemas
export type UnifiedAgentQuestion = typeof unifiedAgentQuestions.$inferSelect;
export type InsertUnifiedAgentQuestion = z.infer<typeof insertUnifiedAgentQuestionSchema>;

export type UnifiedAgentAnswer = typeof unifiedAgentAnswers.$inferSelect;
export type InsertUnifiedAgentAnswer = z.infer<typeof insertUnifiedAgentAnswerSchema>;

export type UnifiedAgentRun = typeof unifiedAgentRuns.$inferSelect;
export type InsertUnifiedAgentRun = z.infer<typeof insertUnifiedAgentRunSchema>;

export type UnifiedBackgroundJob = typeof unifiedBackgroundJobs.$inferSelect;
export type InsertUnifiedBackgroundJob = z.infer<typeof insertUnifiedBackgroundJobSchema>;

// Zod schemas for validation
export const AgentAnswerBaseSchema = z.object({
  questionId: z.string(),
  answer: z.string(),
  confidence: z.number().min(0).max(1),
  sources: z.array(z.object({
    documentId: z.number(),
    documentName: z.string(),
    page: z.number().optional(),
    chunkId: z.string().optional(),
    snippet: z.string(),
    relevance: z.number(),
  })),
  keyFindings: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
  riskScore: z.number().min(1).max(10).optional(),
  metrics: z.array(z.object({
    name: z.string(),
    value: z.any(),
    unit: z.string().optional(),
    period: z.string().optional(),
    confidence: z.number(),
  })).optional(),
});

// Domain-specific extensions
export const LegalAnswerSchema = AgentAnswerBaseSchema.extend({
  contractTerms: z.array(z.string()).optional(),
  liabilityCaps: z.array(z.string()).optional(),
  jurisdictions: z.array(z.string()).optional(),
});

export const ClinicalAnswerSchema = AgentAnswerBaseSchema.extend({
  trialPhase: z.string().optional(),
  endpoints: z.array(z.string()).optional(),
  adverseEvents: z.array(z.string()).optional(),
  regulatoryStatus: z.string().optional(),
});

export const CommercialAnswerSchema = AgentAnswerBaseSchema.extend({
  marketSize: z.number().optional(),
  growthRate: z.number().optional(),
  competitiveAdvantage: z.array(z.string()).optional(),
  customerSegments: z.array(z.string()).optional(),
});

export const HRAnswerSchema = AgentAnswerBaseSchema.extend({
  teamSize: z.number().optional(),
  keyRoles: z.array(z.string()).optional(),
  compensationRange: z.object({
    min: z.number(),
    max: z.number(),
    currency: z.string(),
  }).optional(),
  cultureFit: z.number().min(1).max(10).optional(),
});

export const FinancialAnswerSchema = AgentAnswerBaseSchema.extend({
  revenue: z.number().optional(),
  burnRate: z.number().optional(),
  runway: z.number().optional(),
  valuation: z.number().optional(),
  financialMetrics: z.record(z.number()).optional(),
});

export const IPAnswerSchema = AgentAnswerBaseSchema.extend({
  patentCount: z.number().optional(),
  patentStatus: z.string().optional(),
  trademarks: z.array(z.string()).optional(),
  ipStrength: z.number().min(1).max(10).optional(),
  freedomToOperate: z.boolean().optional(),
});

export const ResearchAnswerSchema = AgentAnswerBaseSchema.extend({
  marketTrends: z.array(z.string()).optional(),
  competitorAnalysis: z.record(z.any()).optional(),
  industryInsights: z.array(z.string()).optional(),
  futurePotential: z.number().min(1).max(10).optional(),
});