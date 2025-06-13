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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// We'll extend this schema with validation in the registration component
export const insertUserSchema = createInsertSchema(users).omit({
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
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadedAt: true,
});

// Agent Analyses
export const agentAnalyses = pgTable("agent_analyses", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  agentType: text("agent_type").notNull(),
  status: text("status").notNull().default("Waiting"),
  progress: integer("progress").notNull().default(0),
  findings: json("findings").$type<{ id: number; content: string; type: string }[]>(),
  recommendations: json("recommendations").$type<string[]>(),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAutomationSchema = createInsertSchema(automations).omit({
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

// AI Evaluation Criteria table
export const evaluationCriteria = pgTable("evaluation_criteria", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description").notNull(),
  weight: integer("weight").notNull().default(20), // Weight percentage (0-100)
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AI Evaluation Results table
export const evaluationResults = pgTable("evaluation_results", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").references(() => deals.id, { onDelete: "cascade" }),
  criteriaId: integer("criteria_id").references(() => evaluationCriteria.id),
  score: integer("score").notNull(), // Score 0-100 for this criteria
  analysis: text("analysis"), // AI's detailed analysis for this criteria
  confidence: integer("confidence"), // AI confidence level 0-100
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEvaluationCriteriaSchema = createInsertSchema(evaluationCriteria).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEvaluationResultSchema = createInsertSchema(evaluationResults).omit({
  id: true,
  createdAt: true,
});

export type EvaluationCriteria = typeof evaluationCriteria.$inferSelect;
export type InsertEvaluationCriteria = z.infer<typeof insertEvaluationCriteriaSchema>;

export type EvaluationResult = typeof evaluationResults.$inferSelect;
export type InsertEvaluationResult = z.infer<typeof insertEvaluationResultSchema>;

// Company Research table
export const companyResearch = pgTable("company_research", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").references(() => deals.id).notNull(),
  // Executive Information
  ceoProfile: json("ceo_profile"),
  keyTeamMembers: json("key_team_members"),
  // Financial Information
  financialData: json("financial_data"),
  // Market Analysis
  marketAnalysis: json("market_analysis"),
  // External Links
  externalLinks: json("external_links"),
  // Business Intelligence
  businessIntelligence: json("business_intelligence"),
  // Risk Assessment
  riskFactors: json("risk_factors"),
  // Investment Highlights
  investmentHighlights: json("investment_highlights"),
  // Status tracking
  researchStatus: varchar("research_status", { length: 50 }).default("pending").notNull(),
  researchCompletedAt: timestamp("research_completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCompanyResearchSchema = createInsertSchema(companyResearch);

export type CompanyResearch = typeof companyResearch.$inferSelect;
export type InsertCompanyResearch = z.infer<typeof insertCompanyResearchSchema>;

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

// Background Job Processing table
export const backgroundJobs = pgTable("background_jobs", {
  id: serial("id").primaryKey(),
  jobType: varchar("job_type", { length: 50 }).notNull(), // 'document_ocr', 'document_analysis', 'zip_processing'
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
  progress: integer("progress").notNull().default(0), // 0-100 percentage
  dealId: integer("deal_id").references(() => deals.id),
  documentId: integer("document_id").references(() => documents.id, { onDelete: "cascade" }),
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
