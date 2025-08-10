/**
 * GRANULAR RESET AND PROCESSING ROUTES
 * 
 * Implements true reset semantics and granular document×question processing
 * to eliminate "No specific evidence found" responses.
 */

import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { eq, and, or } from 'drizzle-orm';

const router = Router();

// TRUE RESET ENDPOINT - Clear outputs only, preserve ingestion
router.post('/api/deals/:dealId/reset-granular', async (req: Request, res: Response) => {
  const dealId = parseInt(req.params.dealId);
  
  try {
    console.log(`🔄 GRANULAR RESET for deal ${dealId} - clearing outputs only`);
    
    // 1. Delete agent analyses outputs but preserve documents
    try {
      await storage.clearAllAnalysesByDealId?.(dealId);
    } catch (error) {
      // Fallback if method doesn't exist
      console.log('Using fallback analysis clearing method');
      const existingAnalyses = await storage.getAnalysesByDealId(dealId);
      for (const analysis of existingAnalyses) {
        await storage.deleteAnalysis(analysis.id);
      }
    }
    
    // 2. Clear analysis job results (including granular jobs)
    const existingJobs = await storage.getBackgroundJobsByDealId(dealId);
    for (const job of existingJobs) {
      if (job.jobType === 'agent_analysis' || 
          job.jobType === 'comprehensive_analysis' ||
          job.jobType === 'granular_analysis' ||
          job.jobType === 'document_question_analysis') {
        await storage.updateBackgroundJob(job.id.toString(), { status: 'cancelled' });
      }
    }
    
    // 3. Clear all caches and job queues
    (globalThis as any).agentCache = {};
    (globalThis as any).analysisCache = {};
    (globalThis as any).questionAnswerCache = {};
    (globalThis as any).granularJobProcessor = null;
    (globalThis as any).documentQuestionJobs = {};
    
    console.log(`✅ Granular reset completed for deal ${dealId} - ready for document×question processing`);
    res.json({ 
      success: true, 
      message: 'All outputs cleared, ready for granular document×question processing',
      resetType: 'granular',
      preservedDocuments: true
    });
    
  } catch (error) {
    console.error('❌ Granular reset failed:', error);
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    });
  }
});

// GRANULAR DOCUMENT×QUESTION JOB CREATION
router.post('/api/deals/:dealId/agents/:agentType/create-granular-jobs', async (req: Request, res: Response) => {
  const dealId = parseInt(req.params.dealId);
  const agentType = req.params.agentType;
  
  try {
    console.log(`📋 Creating granular document×question jobs for ${agentType} on deal ${dealId}`);
    
    // Get assigned documents for agent
    const allDocs = await storage.getDocumentsByDealId(dealId);
    const assignedDocs = allDocs.filter(doc => {
      if (!doc.assignedAgents) return false;
      const agents = Array.isArray(doc.assignedAgents) ? doc.assignedAgents : 
                    (typeof doc.assignedAgents === 'string' ? JSON.parse(doc.assignedAgents || '[]') : []);
      return agents.some((agent: string) => 
        agent.toLowerCase() === agentType.toLowerCase() || agent === agentType
      );
    });
    
    // Define comprehensive question sets per agent
    const questionSets = getAgentQuestionSets();
    const agentQuestions = questionSets[agentType as keyof typeof questionSets] || [];
    
    console.log(`📊 Creating ${assignedDocs.length} docs × ${agentQuestions.length} questions = ${assignedDocs.length * agentQuestions.length} jobs`);
    
    const jobs = [];
    
    // Create individual document×question jobs
    for (const doc of assignedDocs) {
      // Verify document has content
      if (!doc.ocrText && !doc.aiSummary) {
        console.log(`⚠️ Skipping doc ${doc.id} - no OCR or AI summary available`);
        continue;
      }
      
      for (const question of agentQuestions) {
        const jobId = `${agentType}-${doc.id}-${question.id}-${Date.now()}`;
        
        // Create background job
        await storage.createBackgroundJob({
          jobId,
          dealId,
          jobType: 'document_question_analysis',
          agentType,
          status: 'pending',
          progress: 0,
          result: null,
          currentStep: `Processing ${question.category}: ${question.question}`
        });
        
        jobs.push(jobId);
      }
    }
    
    console.log(`✅ Created ${jobs.length} granular jobs for ${agentType}`);
    res.json({ 
      success: true, 
      jobsCreated: jobs.length,
      documentCount: assignedDocs.length,
      questionCount: agentQuestions.length,
      jobIds: jobs.slice(0, 5), // Return sample job IDs
      totalExpected: assignedDocs.length * agentQuestions.length
    });
    
  } catch (error) {
    console.error('❌ Granular job creation failed:', error);
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    });
  }
});

// COMPREHENSIVE QUESTION SETS - Eliminates "No specific evidence found"
function getAgentQuestionSets(): Record<string, Array<{id: string, question: string, category: string}>> {
  return {
    Legal: [
      { id: 'ip_1', question: 'Are IP assignment agreements in place for all team members?', category: 'IP Assignment' },
      { id: 'ip_2', question: 'Are there pending patent applications or issued patents?', category: 'IP Portfolio' },
      { id: 'ip_3', question: 'Are trademark and copyright protections established?', category: 'IP Portfolio' },
      { id: 'commercial_1', question: 'Are SLAs, warranties, and indemnity clauses present in key agreements?', category: 'Commercial Terms' },
      { id: 'commercial_2', question: 'Are termination clauses and dispute resolution mechanisms defined?', category: 'Commercial Terms' },
      { id: 'commercial_3', question: 'Are pricing models and payment terms clearly specified?', category: 'Commercial Terms' },
      { id: 'reg_1', question: 'Are there FDA submissions or other regulatory approvals in progress?', category: 'Regulatory' },
      { id: 'reg_2', question: 'Are compliance frameworks (HIPAA, GDPR, SOC2) implemented?', category: 'Regulatory' },
      { id: 'reg_3', question: 'Are there regulatory risks or pending investigations?', category: 'Regulatory' },
      { id: 'gov_1', question: 'Is board composition clearly defined?', category: 'Governance' },
      { id: 'gov_2', question: 'Are voting rights and control mechanisms established?', category: 'Governance' },
      { id: 'gov_3', question: 'Are there drag-along and tag-along provisions?', category: 'Governance' }
    ],
    Commercial: [
      { id: 'market_1', question: 'Is the market size and growth potential clearly defined?', category: 'Market Analysis' },
      { id: 'market_2', question: 'Are competitive advantages and differentiation factors articulated?', category: 'Market Analysis' },
      { id: 'market_3', question: 'Is the target customer segment well-defined?', category: 'Market Analysis' },
      { id: 'business_1', question: 'Is the revenue model scalable and defensible?', category: 'Business Model' },
      { id: 'business_2', question: 'Are customer acquisition costs and lifetime value metrics available?', category: 'Business Model' },
      { id: 'business_3', question: 'Are there recurring revenue streams or subscription models?', category: 'Business Model' },
      { id: 'sales_1', question: 'Is there evidence of product-market fit?', category: 'Sales & Marketing' },
      { id: 'sales_2', question: 'Are sales processes and pipeline management systems established?', category: 'Sales & Marketing' },
      { id: 'sales_3', question: 'Are marketing channels and customer acquisition strategies defined?', category: 'Sales & Marketing' },
      { id: 'competition_1', question: 'Are key competitors and their market positions identified?', category: 'Competitive Analysis' },
      { id: 'competition_2', question: 'Are barriers to entry and competitive moats established?', category: 'Competitive Analysis' },
      { id: 'competition_3', question: 'Is the competitive response strategy articulated?', category: 'Competitive Analysis' }
    ],
    Clinical: [
      { id: 'trial_1', question: 'Are trial phases and designs clearly defined?', category: 'Clinical Trial Protocols' },
      { id: 'trial_2', question: 'What are primary and secondary endpoints?', category: 'Clinical Trial Protocols' },
      { id: 'trial_3', question: 'How is efficacy/safety assessed?', category: 'Clinical Trial Protocols' },
      { id: 'regulatory_1', question: 'What is current approval status?', category: 'Regulatory Filings' },
      { id: 'regulatory_2', question: 'Are fast-track or orphan designations received?', category: 'Regulatory Filings' },
      { id: 'regulatory_3', question: 'Are adverse events disclosed?', category: 'Regulatory Filings' },
      { id: 'study_1', question: 'Are inclusion/exclusion criteria consistent?', category: 'Study Reports' },
      { id: 'study_2', question: 'What patient population is used?', category: 'Study Reports' },
      { id: 'study_3', question: 'Are SAE (Serious Adverse Events) tracked?', category: 'Study Reports' },
      { id: 'advisory_1', question: 'Are trial results debated by experts?', category: 'Advisory Board' },
      { id: 'advisory_2', question: 'What recommendations were made by advisors?', category: 'Advisory Board' },
      { id: 'advisory_3', question: 'Are there concerns raised by independent experts?', category: 'Advisory Board' }
    ],
    HR: [
      { id: 'team_1', question: 'Is the leadership team experienced in the target market?', category: 'Team Composition' },
      { id: 'team_2', question: 'Are there gaps in key functional areas?', category: 'Team Composition' },
      { id: 'team_3', question: 'Is there evidence of successful team scaling?', category: 'Team Composition' },
      { id: 'compensation_1', question: 'Are equity compensation plans established?', category: 'Compensation' },
      { id: 'compensation_2', question: 'Are there retention mechanisms for key employees?', category: 'Compensation' },
      { id: 'compensation_3', question: 'Is executive compensation competitive and aligned?', category: 'Compensation' },
      { id: 'culture_1', question: 'Are company values and culture clearly defined?', category: 'Culture' },
      { id: 'culture_2', question: 'Are there diversity and inclusion initiatives?', category: 'Culture' },
      { id: 'culture_3', question: 'Is employee satisfaction and engagement measured?', category: 'Culture' },
      { id: 'hiring_1', question: 'Are hiring plans and recruitment strategies defined?', category: 'Talent Acquisition' },
      { id: 'hiring_2', question: 'Are there partnerships with universities or talent pipelines?', category: 'Talent Acquisition' },
      { id: 'hiring_3', question: 'Is the employee onboarding process structured?', category: 'Talent Acquisition' }
    ],
    Financial: [
      { id: 'revenue_1', question: 'Are revenue recognition policies appropriate?', category: 'Revenue' },
      { id: 'revenue_2', question: 'Is revenue diversified across customers and products?', category: 'Revenue' },
      { id: 'revenue_3', question: 'Are there predictable recurring revenue streams?', category: 'Revenue' },
      { id: 'profitability_1', question: 'Is there a clear path to profitability?', category: 'Profitability' },
      { id: 'profitability_2', question: 'Are unit economics attractive and improving?', category: 'Profitability' },
      { id: 'profitability_3', question: 'Are operating leverage opportunities identified?', category: 'Profitability' },
      { id: 'cash_1', question: 'Is cash burn rate sustainable with current funding?', category: 'Cash Management' },
      { id: 'cash_2', question: 'Are cash flow projections realistic and achievable?', category: 'Cash Management' },
      { id: 'cash_3', question: 'Are there contingency plans for funding shortfalls?', category: 'Cash Management' }
    ],
    IP: [
      { id: 'patents_1', question: 'Are core technologies protected by patents?', category: 'Patent Portfolio' },
      { id: 'patents_2', question: 'Are patent applications properly prosecuted?', category: 'Patent Portfolio' },
      { id: 'patents_3', question: 'Is there freedom to operate in key markets?', category: 'Patent Portfolio' },
      { id: 'trademarks_1', question: 'Are trademarks registered and protected?', category: 'Trademarks' },
      { id: 'trademarks_2', question: 'Is brand identity legally protected?', category: 'Trademarks' },
      { id: 'trademarks_3', question: 'Are there trademark conflicts or infringement risks?', category: 'Trademarks' },
      { id: 'trade_secrets_1', question: 'Are trade secrets properly protected?', category: 'Trade Secrets' },
      { id: 'trade_secrets_2', question: 'Are confidentiality agreements in place?', category: 'Trade Secrets' },
      { id: 'trade_secrets_3', question: 'Is proprietary information access controlled?', category: 'Trade Secrets' }
    ],
    Research: [
      { id: 'technology_1', question: 'Is the core technology scientifically validated?', category: 'Technology Validation' },
      { id: 'technology_2', question: 'Are there peer-reviewed publications supporting the approach?', category: 'Technology Validation' },
      { id: 'technology_3', question: 'Is the technology scalable and reproducible?', category: 'Technology Validation' },
      { id: 'development_1', question: 'Is the product development roadmap realistic?', category: 'Product Development' },
      { id: 'development_2', question: 'Are development milestones clearly defined and achievable?', category: 'Product Development' },
      { id: 'development_3', question: 'Are there alternative development pathways identified?', category: 'Product Development' },
      { id: 'data_1', question: 'Is clinical or preclinical data compelling?', category: 'Data Quality' },
      { id: 'data_2', question: 'Are data collection and analysis methods appropriate?', category: 'Data Quality' },
      { id: 'data_3', question: 'Is there independent validation of key results?', category: 'Data Quality' }
    ]
  };
}

export default router;