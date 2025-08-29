-- Database optimization indexes for better performance
-- Run these queries to improve database performance

-- Index for deals table (most frequently queried)
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_company_name ON deals(company_name);

-- Index for documents table (heavy queries)
CREATE INDEX IF NOT EXISTS idx_documents_deal_id ON documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_deal_id_name ON documents(deal_id, name);
CREATE INDEX IF NOT EXISTS idx_documents_ai_summary_status ON documents(ai_summary_status);

-- Index for agent_analyses table
CREATE INDEX IF NOT EXISTS idx_agent_analyses_deal_id ON agent_analyses(deal_id);
CREATE INDEX IF NOT EXISTS idx_agent_analyses_agent_type ON agent_analyses(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_analyses_created_at ON agent_analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_analyses_deal_agent ON agent_analyses(deal_id, agent_type);

-- Index for evaluation_results table
CREATE INDEX IF NOT EXISTS idx_evaluation_results_deal_id ON evaluation_results(deal_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_results_created_at ON evaluation_results(created_at DESC);

-- Index for company_research table
CREATE INDEX IF NOT EXISTS idx_company_research_deal_id ON company_research(deal_id);
CREATE INDEX IF NOT EXISTS idx_company_research_status ON company_research(research_status);

-- Index for background_jobs table
CREATE INDEX IF NOT EXISTS idx_background_jobs_deal_id ON background_jobs(deal_id);
CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON background_jobs(status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_created_at ON background_jobs(created_at DESC);

-- Index for research_jobs table
CREATE INDEX IF NOT EXISTS idx_research_jobs_deal_id ON research_jobs(deal_id);
CREATE INDEX IF NOT EXISTS idx_research_jobs_status ON research_jobs(status);
CREATE INDEX IF NOT EXISTS idx_research_jobs_created_at ON research_jobs(created_at DESC);

-- Index for users table (authentication)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_documents_deal_status ON documents(deal_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_analyses_deal_status ON agent_analyses(deal_id, status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_deal_status ON background_jobs(deal_id, status);