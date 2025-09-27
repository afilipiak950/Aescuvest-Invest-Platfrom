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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDealSchema = createInsertSchema(deals).omit({
  id: true,
  aiScore: true,
  createdAt: true,
  updatedAt: true,
});

// Documents
export const documents: any = pgTable("documents", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").references(() => deals.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  path: text("path").notNull(),
  size: integer("size").notNull(),
  status: text("status").notNull().default("Pending"),
  ocrText: text("ocr_text"),
  analyses: text("analyses"), // JSON string for AI analyses
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  // Enhanced folder structure support
  folderPath: text("folder_path").default(""),
  isFolder: boolean("is_folder").default(false),
  parentId: integer("parent_id").references(() => documents.id),
  category: varchar("category", { length: 100 }),
  documentType: varchar("document_type", { length: 100 }),
  summary: text("summary"),
  insights: text("insights"),
  riskFactors: text("risk_factors"),
  // AI Summary fields
  aiSummary: json("ai_summary").$type<{
    executiveSummary: string;
    criticalFindings: string[];
    keyFinancialData: string[];
    riskAssessment: string[];
    neutralFindings: string[];
    strategicImplications: string;
    documentType: string;
    confidenceScore: number;
  }>(),
  aiSummaryStatus: varchar("ai_summary_status", { length: 20 }).default("pending"), // 'pending', 'processing', 'completed', 'failed'
  aiSummaryGeneratedAt: timestamp("ai_summary_generated_at"),
  // Agent assignment fields
  assignedAgents: json("assigned_agents").$type<string[]>().default([]),
  agentType: text("agent_type"), // Primary agent for UI compatibility
  assignmentReason: text("assignment_reason"), // AI explanation for assignment
  assignmentConfidence: numeric("assignment_confidence", { precision: 3, scale: 2 }), // 0.00-1.00
  manuallyAssigned: boolean("manually_assigned").default(false),
  assignedAt: timestamp("assigned_at"),
  assignedBy: integer("assigned_by").references(() => users.id),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadedAt: true,
});

// Document Assignment Learning Table
export const documentAssignmentLearning = pgTable("document_assignment_learning", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documents.id),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  agentType: text("agent_type").notNull(),
  assignmentType: text("assignment_type").notNull(), // 'ai', 'manual', 'corrected'
  userComment: text("user_comment"), // User's reason for assignment
  aiReasoning: text("ai_reasoning"), // AI's reasoning for assignment
  documentSummary: text("document_summary"), // Summary at time of assignment
  keyTerms: json("key_terms").$type<string[]>(), // Key terms that influenced assignment
  confidence: numeric("confidence", { precision: 3, scale: 2 }), // AI confidence score
  vectorSimilarity: numeric("vector_similarity", { precision: 5, scale: 4 }), // Similarity to training examples
  feedbackPositive: boolean("feedback_positive"), // User feedback on assignment quality
  feedbackComment: text("feedback_comment"), // User feedback comment
  assignedBy: integer("assigned_by").notNull().references(() => users.id),
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

export const insertAutomationSchema = createInsertSchema(automations).omit({
  id: true,
  executionCount: true,
  lastExecutedAt: true,
  createdAt: true,
  updatedAt: true,
});

// Automation Executions
export const automationExecutions = pgTable("automation_executions", {
  id: serial("id").primaryKey(),
  automationId: integer("automation_id").notNull().references(() => automations.id, { onDelete: "cascade" }),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'success', 'failed', 'pending'
  result: text("result").notNull(),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAutomationExecutionSchema = createInsertSchema(automationExecutions, {
  success: z.boolean().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

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

// Evaluation Criteria table for AI scoring
export const evaluationCriteria = pgTable("evaluation_criteria", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  weight: integer("weight").notNull(), // Percentage weight (0-100)
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEvaluationCriteriaSchema = createInsertSchema(evaluationCriteria).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Company Research table for storing comprehensive intelligence data
export const companyResearch = pgTable("company_research", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  companyName: text("company_name").notNull(),
  website: text("website"),
  websiteAnalysis: text("website_analysis"),
  newsAndPress: text("news_and_press"),
  fundingInformation: text("funding_information"),
  leadershipTeam: text("leadership_team"),
  industryClassification: text("industry_classification"),
  technologyStack: text("technology_stack"),
  regulatoryCompliance: text("regulatory_compliance"),
  sources: integer("sources").notNull().default(0),
  // Additional fields for enhanced research
  ceoProfile: json("ceo_profile"),
  financialData: json("financial_data"),
  marketAnalysis: json("market_analysis"),
  externalLinks: json("external_links"),
  businessIntelligence: json("business_intelligence"),
  investmentHighlights: json("investment_highlights"),
  riskFactors: json("risk_factors"),
  aiAnalysis: json("ai_analysis"),
  researchStatus: varchar("research_status", { length: 50 }).default("pending").notNull(),
  researchCompletedAt: timestamp("research_completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCompanyResearchSchema = createInsertSchema(companyResearch).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EvaluationCriteria = typeof evaluationCriteria.$inferSelect;
export type InsertEvaluationCriteria = z.infer<typeof insertEvaluationCriteriaSchema>;

export type CompanyResearch = typeof companyResearch.$inferSelect;
export type InsertCompanyResearch = z.infer<typeof insertCompanyResearchSchema>;

// Research Background Jobs table for persistent research processing
export const researchBackgroundJobs = pgTable("research_background_jobs", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  jobType: varchar("job_type", { length: 50 }).notNull().default("company_research"),
  status: varchar("status", { length: 20 }).notNull().default("processing"), // 'processing', 'completed', 'failed'
  progress: integer("progress").notNull().default(0), // 0-100 percentage
  progressStage: varchar("progress_stage", { length: 100 }).default("Initializing research"),
  currentStep: integer("current_step").notNull().default(0),
  totalSteps: integer("total_steps").notNull().default(8),
  error: text("error"),
  result: json("result"),
  debugInfo: json("debug_info"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertResearchBackgroundJobSchema = createInsertSchema(researchBackgroundJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ResearchBackgroundJob = typeof researchBackgroundJobs.$inferSelect;
export type InsertResearchBackgroundJob = z.infer<typeof insertResearchBackgroundJobSchema>;

// Evaluation Results table for storing AI scoring results
export const evaluationResults = pgTable("evaluation_results", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").references(() => deals.id, { onDelete: "cascade" }).notNull(),
  criteriaId: integer("criteria_id").references(() => evaluationCriteria.id).notNull(),
  score: integer("score").notNull(), // Score for this criteria (0-100)
  reasoning: text("reasoning"),
  keyFactors: text("key_factors").array(),
  riskLevel: varchar("risk_level", { length: 20 }), // 'low', 'medium', 'high'
  confidence: numeric("confidence", { precision: 3, scale: 2 }), // 0.00-1.00
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEvaluationResultSchema = createInsertSchema(evaluationResults).omit({
  id: true,
  createdAt: true,
});

export type EvaluationResult = typeof evaluationResults.$inferSelect;
export type InsertEvaluationResult = z.infer<typeof insertEvaluationResultSchema>;







// Data Room Connections table
export const dataRoomConnections = pgTable("data_room_connections", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").references(() => deals.id).notNull(),
  connectionType: varchar("connection_type", { length: 50 }).notNull(), // 'google_drive', 'zip_upload', etc.
  connectionData: json("connection_data"), // Store folder ID, access tokens, etc.
  folderName: varchar("folder_name", { length: 255 }),
  isActive: boolean("is_active").default(true).notNull(),
  lastSyncAt: timestamp("last_sync_at"),
  totalFiles: integer("total_files").default(0),
  processedFiles: integer("processed_files").default(0),
  status: varchar("status", { length: 50 }).default("connected").notNull(), // 'connected', 'syncing', 'error', 'disconnected'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDataRoomConnectionSchema = createInsertSchema(dataRoomConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DataRoomConnection = typeof dataRoomConnections.$inferSelect;
export type InsertDataRoomConnection = z.infer<typeof insertDataRoomConnectionSchema>;

// Microsoft Email Connections table for permanent token storage
export const microsoftEmailConnections = pgTable("microsoft_email_connections", {
  id: serial("id").primaryKey(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  email: varchar("email", { length: 255 }),
  authenticated: boolean("authenticated").default(true).notNull(),
  connectedAt: timestamp("connected_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at").defaultNow(),
});

export const insertMicrosoftEmailConnectionSchema = createInsertSchema(microsoftEmailConnections).omit({
  id: true,
});

export type MicrosoftEmailConnection = typeof microsoftEmailConnections.$inferSelect;
export type InsertMicrosoftEmailConnection = z.infer<typeof insertMicrosoftEmailConnectionSchema>;

// Background Job Processing table - supports both ZIP processing and agent analysis
export const backgroundJobs = pgTable("background_jobs", {
  id: serial("id").primaryKey(),
  jobId: text("job_id").notNull().unique(), // Unique job identifier
  jobType: varchar("job_type", { length: 50 }).notNull(), // 'document_ocr', 'document_analysis', 'zip_processing', 'agent_analysis', 'document_assignment'
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
  progress: integer("progress").notNull().default(0), // 0-100 percentage
  dealId: integer("deal_id").references(() => deals.id),
  documentId: integer("document_id").references(() => documents.id, { onDelete: "cascade" }),
  agentType: text("agent_type"), // For agent analysis jobs
  totalDocuments: integer("total_documents").default(0), // Total documents to process
  processedDocuments: integer("processed_documents").default(0), // Documents processed so far
  currentDocumentName: text("current_document_name"), // Current document being processed
  jobData: json("job_data"), // Store file paths, parameters, etc.
  currentStep: text("current_step"), // Current processing step description
  result: json("result"), // Store processing results
  error: text("error"), // Error message if failed
  runId: text("run_id"), // Run ID for binding progress to specific comprehensive analysis runs
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBackgroundJobSchema = createInsertSchema(backgroundJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// 🎯 CRITICAL: Persistent Upload Sessions for Complete Background Processing
export const persistentUploadSessions = pgTable("persistent_upload_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  fileName: text("file_name").notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull(),
  uploadType: text("upload_type").notNull(), // 'gcs_direct', 'chunked', 'zip_processing'
  status: text("status").notNull().default("uploading"), // 'uploading', 'processing', 'completed', 'failed'
  progress: integer("progress").default(0),
  uploadedBytes: bigint("uploaded_bytes", { mode: "number" }).default(0),
  gcsPath: text("gcs_path"),
  jobId: text("job_id"), // Links to background_jobs for processing
  currentStep: text("current_step"),
  errorMessage: text("error_message"),
  metadata: json("metadata"), // JSON for additional data like chunk info, retry count, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at")
});

export const insertPersistentUploadSessionSchema = createInsertSchema(persistentUploadSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BackgroundJob = typeof backgroundJobs.$inferSelect;
export type InsertBackgroundJob = z.infer<typeof insertBackgroundJobSchema>;

// Comprehensive Analysis for investment decision making
export const comprehensiveAnalysis = pgTable("comprehensive_analysis", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").references(() => deals.id).notNull(),
  overallScore: integer("overall_score").notNull().default(0), // 0-100 investment score
  positiveFactors: json("positive_factors").$type<{
    category: 'positive';
    agent: string;
    title: string;
    description: string;
    confidence: number;
    documentSource?: string;
  }[]>().default([]),
  neutralFactors: json("neutral_factors").$type<{
    category: 'neutral';
    agent: string;
    title: string;
    description: string;
    confidence: number;
    documentSource?: string;
  }[]>().default([]),
  riskFactors: json("risk_factors").$type<{
    category: 'risk';
    agent: string;
    title: string;
    description: string;
    confidence: number;
    severity?: 'low' | 'medium' | 'high';
    documentSource?: string;
  }[]>().default([]),
  analysisStatus: varchar("analysis_status", { length: 20 }).notNull().default("pending"), // 'pending', 'running', 'completed', 'failed'
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  documentsCovered: integer("documents_covered").notNull().default(0),
  totalDocuments: integer("total_documents").notNull().default(0),
  agentResults: json("agent_results").$type<{
    clinical?: any;
    legal?: any;
    commercial?: any;
    hr?: any;
    financial?: any;
    ip?: any;
    research?: any;
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertComprehensiveAnalysisSchema = createInsertSchema(comprehensiveAnalysis).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ComprehensiveAnalysis = typeof comprehensiveAnalysis.$inferSelect;
export type InsertComprehensiveAnalysis = z.infer<typeof insertComprehensiveAnalysisSchema>;

// Research Jobs table for persistent background processing
export const researchJobs = pgTable("research_jobs", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 20 }).notNull().default("processing"), // 'processing', 'completed', 'failed'
  progress: integer("progress").notNull().default(0), // 0-100
  progressStage: varchar("progress_stage", { length: 255 }).notNull().default("Initializing"),
  currentStep: integer("current_step").notNull().default(1),
  totalSteps: integer("total_steps").notNull().default(8),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  website: varchar("website", { length: 500 }),
  debugInfo: json("debug_info").$type<{
    step?: string;
    timestamp?: string;
    url?: string;
    error?: string;
    [key: string]: any;
  }>().default({}),
  result: json("result").$type<{
    companyName?: string;
    website?: string;
    websiteAnalysis?: string;
    ceoProfile?: any;
    financialData?: any;
    marketAnalysis?: any;
    businessIntelligence?: any;
    riskFactors?: any;
    researchStatus?: string;
    sources?: number;
    lastUpdated?: string;
    aiConfidenceScore?: number;
  }>(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertResearchJobSchema = createInsertSchema(researchJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ResearchJob = typeof researchJobs.$inferSelect;
export type InsertResearchJob = z.infer<typeof insertResearchJobSchema>;

// User Activity table for tracking real user actions
export const userActivities = pgTable("user_activities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activityType: text("activity_type").notNull(), // 'deal_view', 'memo_generate', 'deal_update', 'match_create', 'document_upload', 'analysis_run', etc.
  actionDescription: text("action_description").notNull(),
  targetType: text("target_type"), // 'deal', 'document', 'memo', 'match', etc.
  targetId: integer("target_id"), // ID of the target entity
  targetName: text("target_name"), // Human-readable name of the target
  metadata: json("metadata").$type<{
    oldValue?: any;
    newValue?: any;
    dealName?: string;
    documentCount?: number;
    agentType?: string;
    [key: string]: any;
  }>(),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserActivitySchema = createInsertSchema(userActivities).omit({
  id: true,
  createdAt: true,
});

export type UserActivity = typeof userActivities.$inferSelect;
export type InsertUserActivity = z.infer<typeof insertUserActivitySchema>;

// User Stats table for performance tracking
export const userStats = pgTable("user_stats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  dealsViewed: integer("deals_viewed").notNull().default(0),
  memosGenerated: integer("memos_generated").notNull().default(0),
  documentsUploaded: integer("documents_uploaded").notNull().default(0),
  analysesRun: integer("analyses_run").notNull().default(0),
  matchesCreated: integer("matches_created").notNull().default(0),
  loginCount: integer("login_count").notNull().default(0),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserStatsSchema = createInsertSchema(userStats).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserStats = typeof userStats.$inferSelect;
export type InsertUserStats = z.infer<typeof insertUserStatsSchema>;

// Investors table (legacy table kept for compatibility)
export const investors = pgTable("investors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  firm: text("firm"),
  email: text("email"),
  phone: text("phone"),
  focus: text("focus"),
  checkSize: text("check_size"),
  location: text("location"),
  website: text("website"),
  linkedin: text("linkedin"),
  twitter: text("twitter"),
  bio: text("bio"),
  preferences: json("preferences"),
  isActive: boolean("is_active").default(true),
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

// Organizations table for storing all Affinity organizations
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  affinityId: text("affinity_id").notNull().unique(),
  name: text("name").notNull(),
  domain: text("domain"),
  domains: text("domains").array().default([]),
  type: text("type").notNull().default("organization"),
  isGlobal: boolean("is_global").default(false),
  // Business information
  description: text("description"),
  industry: text("industry"),
  website: text("website"),
  foundingYear: integer("founding_year"),
  employeeCount: integer("employee_count"),
  location: text("location"),
  headquarters: text("headquarters"),
  // Financial information
  revenue: bigint("revenue", { mode: "number" }),
  fundingRaised: bigint("funding_raised", { mode: "number" }),
  valuation: bigint("valuation", { mode: "number" }),
  lastFundingDate: timestamp("last_funding_date"),
  fundingStage: text("funding_stage"),
  // AI-powered insights
  businessModel: text("business_model"),
  keyProducts: text("key_products").array().default([]),
  competitors: text("competitors").array().default([]),
  targetMarket: text("target_market"),
  technologyStack: text("technology_stack").array().default([]),
  // Affinity data
  affinityData: json("affinity_data").$type<{
    listEntries?: any[];
    fieldValues?: Record<string, any>;
    interactionDates?: any;
    createdAt?: string;
    updatedAt?: string;
  }>().default({}),
  // Matching intelligence
  matchingScore: integer("matching_score").default(0), // 0-100
  relevanceScore: integer("relevance_score").default(0), // 0-100
  investmentPotential: text("investment_potential").default("unknown"), // 'high', 'medium', 'low', 'unknown'
  // Sync tracking
  lastSyncAt: timestamp("last_sync_at"),
  syncStatus: text("sync_status").default("pending"), // 'pending', 'synced', 'error'
  syncErrors: text("sync_errors").array().default([]),
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

// Deal-Organization matches table for intelligent matching
export const dealOrganizationMatches = pgTable("deal_organization_matches", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  matchScore: integer("match_score").notNull().default(0), // AI-calculated match score 0-100
  matchReasons: text("match_reasons").array().default([]), // Array of match reasons
  matchDetails: json("match_details").$type<{
    industryMatch?: boolean;
    sizeMatch?: boolean;
    stageMatch?: boolean;
    geoMatch?: boolean;
    technologyMatch?: boolean;
    businessModelMatch?: boolean;
    competitorAnalysis?: any;
    marketAnalysis?: any;
  }>().default({}),
  status: text("status").notNull().default("pending"), // 'pending', 'contacted', 'interested', 'declined', 'invested'
  contactAttempts: integer("contact_attempts").default(0),
  lastContactAt: timestamp("last_contact_at"),
  notes: text("notes"),
  aiGeneratedPitch: text("ai_generated_pitch"),
  expectedInvestment: bigint("expected_investment", { mode: "number" }),
  probabilityScore: integer("probability_score").default(0), // 0-100 probability of investment
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

// Daily sync jobs for automated data retrieval
export const dailySyncJobs = pgTable("daily_sync_jobs", {
  id: serial("id").primaryKey(),
  jobType: text("job_type").notNull(), // 'affinity_organizations', 'affinity_persons', 'matching_intelligence'
  status: text("status").notNull().default("pending"), // 'pending', 'running', 'completed', 'failed'
  progress: integer("progress").default(0), // 0-100
  totalItems: integer("total_items").default(0),
  processedItems: integer("processed_items").default(0),
  newItems: integer("new_items").default(0),
  updatedItems: integer("updated_items").default(0),
  errors: text("errors").array().default([]),
  result: json("result").$type<{
    organizations?: number;
    persons?: number;
    matches?: number;
    duration?: number;
    stats?: Record<string, any>;
  }>().default({}),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  scheduledFor: timestamp("scheduled_for").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDailySyncJobSchema = createInsertSchema(dailySyncJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DailySyncJob = typeof dailySyncJobs.$inferSelect;
export type InsertDailySyncJob = z.infer<typeof insertDailySyncJobSchema>;

// Deal-Investor matches table
export const dealInvestorMatches = pgTable("deal_investor_matches", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
  investorId: integer("investor_id").notNull().references(() => investors.id, { onDelete: "cascade" }),
  matchScore: integer("match_score").notNull(), // 0-100
  matchReason: text("match_reason").array().notNull().default([]), // Array of match reasons
  // AI-generated insights
  matchInsights: json("match_insights").$type<{
    strengths?: string[];
    concerns?: string[];
    recommendations?: string[];
    competitiveAdvantage?: string;
    riskFactors?: string[];
  }>().default({}),
  // Fit analysis
  sectorFit: integer("sector_fit").default(0), // 0-100
  stageFit: integer("stage_fit").default(0), // 0-100
  geographyFit: integer("geography_fit").default(0), // 0-100
  checkSizeFit: integer("check_size_fit").default(0), // 0-100
  thesisFit: integer("thesis_fit").default(0), // 0-100
  // Engagement tracking
  status: text("status").notNull().default("potential"), // 'potential', 'contacted', 'interested', 'declined', 'invested'
  outreachStatus: text("outreach_status").default("not_contacted"), // 'not_contacted', 'email_sent', 'meeting_scheduled', 'follow_up', 'closed'
  lastContactDate: timestamp("last_contact_date"),
  nextFollowUpDate: timestamp("next_follow_up_date"),
  meetingScheduled: boolean("meeting_scheduled").default(false),
  // Campaign tracking
  campaignId: integer("campaign_id"), // Reference to email campaigns
  emailsSent: integer("emails_sent").default(0),
  emailsOpened: integer("emails_opened").default(0),
  emailsClicked: integer("emails_clicked").default(0),
  materialsSent: text("materials_sent").array().notNull().default([]), // Array of sent materials
  // Notes and feedback
  notes: text("notes"),
  feedback: text("feedback"),
  declineReason: text("decline_reason"),
  // Metadata
  createdBy: integer("created_by").references(() => users.id),
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
