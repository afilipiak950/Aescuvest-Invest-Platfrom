import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
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
  aiScore: integer("ai_score"),
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
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  path: text("path").notNull(),
  size: integer("size").notNull(),
  status: text("status").notNull().default("Pending"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
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
