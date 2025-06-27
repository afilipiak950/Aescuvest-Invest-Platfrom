import { pgTable, text, varchar, serial, integer, numeric, boolean, timestamp, json, bigint } from "drizzle-orm/pg-core";
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
  // User preferences and settings
  timezone: text("timezone").default("UTC"),
  emailNotifications: boolean("email_notifications").default(true),
  dealNotifications: boolean("deal_notifications").default(true),
  aiNotifications: boolean("ai_notifications").default(true),
  weeklyReports: boolean("weekly_reports").default(false),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAgentAnalysisSchema = createInsertSchema(agentAnalyses).omit({
  id: true,
  progress: true,
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
  status: text("status").notNull().default("Draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertInvestmentMemoSchema = createInsertSchema(investmentMemos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Investors
export const investors = pgTable("investors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  focus: json("focus").$type<string[]>(),
  stages: json("stages").$type<string[]>(),
  checkSize: text("check_size"),
  portfolio: json("portfolio").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertInvestorSchema = createInsertSchema(investors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Investor Matches
export const investorMatches = pgTable("investor_matches", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  investorId: integer("investor_id").notNull().references(() => investors.id),
  matchScore: integer("match_score").notNull(),
  matchInsights: json("match_insights").$type<string[]>(),
  status: text("status").notNull().default("New Match"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertInvestorMatchSchema = createInsertSchema(investorMatches).omit({
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

export const insertAutomationExecutionSchema = createInsertSchema(automationExecutions).omit({
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

export type Investor = typeof investors.$inferSelect;
export type InsertInvestor = z.infer<typeof insertInvestorSchema>;

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
  externalLinks: json("external_links"),
  businessIntelligence: json("business_intelligence"),
  investmentHighlights: json("investment_highlights"),
  riskFactors: json("risk_factors"),
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
  jobType: varchar("job_type", { length: 50 }).notNull(), // 'document_ocr', 'document_analysis', 'zip_processing', 'agent_analysis'
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




