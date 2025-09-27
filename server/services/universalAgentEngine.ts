/**
 * Universal Agent Engine
 * Single engine that processes any agent type using configuration-only differences
 * Replaces all agent-specific analysis services (persistentClinicalAnalysis, etc.)
 */

import { storage } from '../storage';
import { websocketManager } from './websocketManager';
import { getAgentConfig, type AgentType, isValidAgentType } from '../../shared/agents';
import openai from './openai';

// Universal job state interface (replaces agent-specific state interfaces)
interface UniversalJobState {
  dealId: number;
  agentType: AgentType;
  jobKey: string;
  progress: number;
  currentQuestionIndex: number;
  totalQuestions: number;
  currentBatch: number;
  totalBatches: number;
  currentStep: string;
  documentsAnalyzed: number;
  totalDocuments: number;
  startTime: Date;
  lastUpdate: Date;
}

export class UniversalAgentEngine {
  private static instance: UniversalAgentEngine;
  private activeJobs = new Map<string, UniversalJobState>();
  private jobIntervals = new Map<string, NodeJS.Timeout>();

  static getInstance(): UniversalAgentEngine {
    if (!UniversalAgentEngine.instance) {
      UniversalAgentEngine.instance = new UniversalAgentEngine();
    }
    return UniversalAgentEngine.instance;
  }

  /**
   * Initialize the universal engine and restore incomplete jobs
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Universal Agent Engine...');
      
      // Find incomplete jobs for all agent types
      const incompleteJobs = await this.findIncompleteJobs();
      console.log(`🔄 Found ${incompleteJobs.length} incomplete agent jobs to resume`);

      for (const job of incompleteJobs) {
        await this.resumeAgentAnalysis(job.dealId, job.agentType, job.jobKey);
      }

      console.log('✅ Universal Agent Engine initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Universal Agent Engine:', error);
    }
  }

  /**
   * Start analysis for any agent type using unified logic
   */
  async startAgentAnalysis(dealId: number, agentType: string, forceRerun: boolean = false): Promise<string> {
    // Validate agent type
    if (!isValidAgentType(agentType)) {
      throw new Error(`Invalid agent type: ${agentType}`);
    }

    const typedAgentType = agentType as AgentType;
    const jobKey = `${dealId}:${agentType}:analysis`;
    
    console.log(`🚀 Starting universal ${agentType} analysis for deal ${dealId}`);

    // Check if job already exists and is running
    const existingJob = await storage.getJobByKey(jobKey);
    if (existingJob && existingJob.status === 'processing' && !forceRerun) {
      console.log(`🔄 ${agentType} analysis already running for deal ${dealId}, resuming...`);
      await this.resumeAgentAnalysis(dealId, typedAgentType, jobKey);
      return jobKey;
    }

    // Clean up any old jobs if force rerun
    if (existingJob && forceRerun) {
      console.log(`🧹 Force rerun: cleaning up existing ${agentType} job for deal ${dealId}`);
      await storage.updateJob(jobKey, { status: 'cancelled', finishedAt: new Date() });
    }

    // Start the universal analysis process
    await this.processUniversalAnalysis(dealId, typedAgentType, jobKey);
    
    return jobKey;
  }

  /**
   * Universal analysis processing that works for any agent type
   */
  private async processUniversalAnalysis(dealId: number, agentType: AgentType, jobKey: string): Promise<void> {
    try {
      // Get agent configuration
      const agentConfig = getAgentConfig(agentType);
      const questions = agentConfig.questions;

      // Create job record using unified storage
      await storage.startAgentJob(jobKey, {
        dealId,
        agentType,
        status: 'processing',
        progress: 0,
        processedDocuments: 0,
        totalDocuments: 0,
        currentStep: `Initializing ${agentType} analysis...`,
        startedAt: new Date()
      });

      // Create or update analysis record
      await storage.upsertUnifiedAnalysis(dealId, agentType, {
        status: 'processing',
        progress: 0,
        totalQuestions: questions.length,
        analysisStartedAt: new Date()
      });

      // Initialize job state
      const jobState: UniversalJobState = {
        dealId,
        agentType,
        jobKey,
        progress: 0,
        currentQuestionIndex: 0,
        totalQuestions: questions.length,
        currentBatch: 1,
        totalBatches: Math.ceil(questions.length / 3), // Process 3 questions per batch
        currentStep: `Starting ${agentType} analysis`,
        documentsAnalyzed: 0,
        totalDocuments: 0,
        startTime: new Date(),
        lastUpdate: new Date()
      };

      this.activeJobs.set(jobKey, jobState);

      // Get documents for this agent
      const allDocuments = await storage.getDocumentsByDealId(dealId);
      // Filter to agent-specific documents (for now use all documents)
      const agentDocuments = allDocuments; // TODO: Implement agent filtering
      jobState.totalDocuments = agentDocuments.length;

      // Update total documents in job and analysis
      await storage.updateJob(jobKey, {
        totalDocuments: agentDocuments.length,
        currentStep: `Processing ${agentDocuments.length} ${agentType} documents`
      });

      await storage.upsertUnifiedAnalysis(dealId, agentType, {
        processedDocumentCount: 0,
        documentSources: agentDocuments.map(d => d.title || d.filename || 'Unknown')
      });

      // Process questions in batches using universal logic
      await this.processQuestionBatches(jobState, agentConfig, agentDocuments);

    } catch (error) {
      console.error(`❌ Error in universal ${agentType} analysis:`, error);
      
      // Mark job as failed
      await storage.failJob(jobKey, error.message || 'Unknown error');
      await storage.setUnifiedAnalysisStatus(dealId, agentType, 'failed', 0);
      
      // Clean up
      this.activeJobs.delete(jobKey);
      this.clearJobInterval(jobKey);
    }
  }

  /**
   * Process questions in batches - universal logic for all agents
   */
  private async processQuestionBatches(
    jobState: UniversalJobState, 
    agentConfig: any, 
    documents: any[]
  ): Promise<void> {
    const { jobKey, dealId, agentType } = jobState;
    const questions = agentConfig.questions;
    const batchSize = 3;

    let allAnswers: Record<string, any> = {};
    let allFindings: any[] = [];
    let allRecommendations: any[] = [];

    // Process questions in batches
    for (let batchIndex = 0; batchIndex < Math.ceil(questions.length / batchSize); batchIndex++) {
      const batchStart = batchIndex * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, questions.length);
      const batchQuestions = questions.slice(batchStart, batchEnd);

      jobState.currentBatch = batchIndex + 1;
      jobState.currentStep = `Processing questions ${batchStart + 1}-${batchEnd} of ${questions.length}`;

      console.log(`📊 ${agentType} batch ${jobState.currentBatch}/${jobState.totalBatches}: Processing ${batchQuestions.length} questions`);

      // Update job progress
      const batchProgress = Math.floor((batchIndex / jobState.totalBatches) * 100);
      jobState.progress = batchProgress;
      
      await storage.updateJob(jobKey, {
        progress: batchProgress,
        currentStep: jobState.currentStep
      });

      await storage.setUnifiedAnalysisStatus(dealId, agentType, 'processing', batchProgress);

      // Process batch using AI
      try {
        const batchResults = await this.processQuestionBatch(
          batchQuestions,
          documents,
          agentConfig,
          agentType
        );

        // Merge results
        allAnswers = { ...allAnswers, ...batchResults.answers };
        allFindings.push(...batchResults.findings);
        allRecommendations.push(...batchResults.recommendations);

        // Update analysis with batch results
        await storage.upsertUnifiedAnalysis(dealId, agentType, {
          answers: allAnswers,
          recommendations: allRecommendations,
          progress: batchProgress,
          processedDocumentCount: documents.length
        });

        // Save findings to separate table
        for (const finding of batchResults.findings) {
          await storage.createFinding(dealId, agentType, {
            type: finding.type || 'Info',
            title: finding.title,
            description: finding.description,
            confidence: finding.confidence || 75,
            evidence: finding.evidence || [],
            category: finding.category,
            priority: finding.priority || 'medium',
            impact: finding.impact
          });
        }

        console.log(`✅ ${agentType} batch ${jobState.currentBatch} completed: ${batchResults.findings.length} findings, ${batchResults.recommendations.length} recommendations`);

      } catch (error) {
        console.error(`❌ Error processing ${agentType} batch ${jobState.currentBatch}:`, error);
        // Continue with next batch rather than failing entire job
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Complete the analysis
    await this.completeAnalysis(jobState, allAnswers, allFindings, allRecommendations);
  }

  /**
   * Process a single batch of questions using AI
   */
  private async processQuestionBatch(
    questions: string[],
    documents: any[],
    agentConfig: any,
    agentType: AgentType
  ): Promise<{
    answers: Record<string, any>;
    findings: any[];
    recommendations: any[];
  }> {
    // Prepare document context
    const documentContext = documents
      .map(doc => `Document: ${doc.title || doc.filename}\nContent: ${doc.content || doc.summary || 'No content available'}`)
      .join('\n\n---\n\n');

    // Build AI prompt using agent configuration
    const prompt = `${agentConfig.promptTemplate}

FOCUS AREAS:
${agentConfig.focusAreas.map(area => `- ${area}`).join('\n')}

QUESTIONS TO ANALYZE:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

DOCUMENT CONTEXT:
${documentContext}

Please provide:
1. Specific answers to each question with evidence
2. Key findings (positive, negative, warnings, or info)
3. Actionable recommendations

Format your response as JSON with this structure:
{
  "answers": {
    "question1": {
      "question": "...",
      "answer": "...",
      "confidence": 0-100,
      "sources": ["..."],
      "evidence": [{"quote": "...", "documentId": 1, "documentName": "..."}]
    }
  },
  "findings": [
    {
      "type": "Positive|Negative|Warning|Info",
      "title": "...",
      "description": "...",
      "confidence": 0-100,
      "evidence": [{"quote": "...", "documentId": 1, "documentName": "..."}],
      "category": "...",
      "priority": "low|medium|high|critical",
      "impact": "..."
    }
  ],
  "recommendations": [
    {
      "title": "...",
      "description": "...",
      "priority": "low|medium|high|critical",
      "category": "...",
      "impact": "...",
      "actionRequired": true|false
    }
  ]
}`;

    try {
      // Call OpenAI API using the service wrapper
      const aiResponse = await openai.generateResponse(
        `You are an expert ${agentType} due diligence analyst. Provide thorough, evidence-based analysis.`,
        prompt,
        {
          model: 'gpt-4o',
          temperature: 0.3,
          jsonResponse: true
        }
      );
      
      // Parse the response
      const results = JSON.parse(aiResponse);
      return {
        answers: results.answers || {},
        findings: results.findings || [],
        recommendations: results.recommendations || []
      };

    } catch (error) {
      console.error(`❌ Error calling AI for ${agentType} analysis:`, error);
      
      // Return empty results on AI failure
      return {
        answers: {},
        findings: [],
        recommendations: []
      };
    }

    /* OLD CODE - Remove this block:
      const response = await openai.chat.completions.create({
    */ // END OLD CODE BLOCK
  }

  /**
   * Complete the analysis process
   */
  private async completeAnalysis(
    jobState: UniversalJobState,
    answers: Record<string, any>,
    findings: any[],
    recommendations: any[]
  ): Promise<void> {
    const { jobKey, dealId, agentType } = jobState;

    try {
      // Calculate metrics
      const avgConfidence = this.calculateAverageConfidence(answers);
      const keyRisks = findings
        .filter(f => f.type === 'Negative' || f.type === 'Warning')
        .map(f => f.title)
        .slice(0, 5);
      const keyOpportunities = findings
        .filter(f => f.type === 'Positive')
        .map(f => f.title)
        .slice(0, 5);

      // Generate executive summary
      const executiveSummary = this.generateExecutiveSummary(agentType, findings, recommendations);

      // Complete the analysis
      await storage.upsertUnifiedAnalysis(dealId, agentType, {
        status: 'completed',
        progress: 100,
        answers,
        recommendations,
        averageConfidence: avgConfidence,
        keyRisks,
        keyOpportunities,
        executiveSummary,
        analysisCompletedAt: new Date()
      });

      // Complete the job
      await storage.completeJob(jobKey, {
        result: {
          totalQuestions: Object.keys(answers).length,
          totalFindings: findings.length,
          totalRecommendations: recommendations.length,
          avgConfidence
        }
      });

      console.log(`✅ Universal ${agentType} analysis completed for deal ${dealId}`);
      console.log(`📊 Results: ${Object.keys(answers).length} answers, ${findings.length} findings, ${recommendations.length} recommendations`);

      // Clean up
      this.activeJobs.delete(jobKey);
      this.clearJobInterval(jobKey);

      // Send WebSocket update
      websocketManager.sendToRoom(`deal-${dealId}`, {
        type: 'analysis_completed',
        agentType,
        dealId,
        summary: {
          questions: Object.keys(answers).length,
          findings: findings.length,
          recommendations: recommendations.length
        }
      });

    } catch (error) {
      console.error(`❌ Error completing ${agentType} analysis:`, error);
      await storage.failJob(jobKey, error.message || 'Error completing analysis');
      await storage.setUnifiedAnalysisStatus(dealId, agentType, 'failed', jobState.progress);
    }
  }

  /**
   * Resume an interrupted analysis job
   */
  private async resumeAgentAnalysis(dealId: number, agentType: AgentType, jobKey: string): Promise<void> {
    try {
      console.log(`🔄 Resuming universal ${agentType} analysis for deal ${dealId}`);

      const job = await storage.getJobByKey(jobKey);
      if (!job) {
        console.error(`❌ Job ${jobKey} not found in database`);
        return;
      }

      // Check if analysis is already completed
      const existingAnalysis = await storage.getUnifiedAnalysis(dealId, agentType);
      if (existingAnalysis?.status === 'completed') {
        console.log(`✅ ${agentType} analysis already completed for deal ${dealId}`);
        await storage.completeJob(jobKey, { result: { resumed: true, alreadyCompleted: true } });
        return;
      }

      // Resume processing from where it left off
      await this.processUniversalAnalysis(dealId, agentType, jobKey);

    } catch (error) {
      console.error(`❌ Error resuming ${agentType} analysis:`, error);
      await storage.failJob(jobKey, error.message || 'Error resuming analysis');
    }
  }

  /**
   * Find incomplete jobs across all agent types
   */
  private async findIncompleteJobs(): Promise<Array<{ dealId: number; agentType: AgentType; jobKey: string }>> {
    try {
      const allJobs = await storage.listUnifiedJobs();
      const processingJobs = allJobs.filter(job => job.status === 'processing');
      return processingJobs
        .filter(job => job.agentType && isValidAgentType(job.agentType))
        .map(job => ({
          dealId: job.dealId,
          agentType: job.agentType as AgentType,
          jobKey: job.jobKey
        }));
    } catch (error) {
      console.error('❌ Error finding incomplete jobs:', error);
      return [];
    }
  }

  /**
   * Utility: Calculate average confidence from answers
   */
  private calculateAverageConfidence(answers: Record<string, any>): number {
    const confidenceValues = Object.values(answers)
      .map((answer: any) => answer.confidence || 0)
      .filter(c => c > 0);
    
    if (confidenceValues.length === 0) return 0;
    return Math.round(confidenceValues.reduce((sum, c) => sum + c, 0) / confidenceValues.length);
  }

  /**
   * Utility: Generate executive summary
   */
  private generateExecutiveSummary(agentType: AgentType, findings: any[], recommendations: any[]): string {
    const positives = findings.filter(f => f.type === 'Positive').length;
    const negatives = findings.filter(f => f.type === 'Negative').length;
    const warnings = findings.filter(f => f.type === 'Warning').length;

    return `${agentType.charAt(0).toUpperCase() + agentType.slice(1)} analysis identified ${findings.length} key findings: ${positives} positive insights, ${negatives} risk factors, and ${warnings} areas requiring attention. Generated ${recommendations.length} actionable recommendations for stakeholder consideration.`;
  }

  /**
   * Utility: Clear job interval
   */
  private clearJobInterval(jobKey: string): void {
    const interval = this.jobIntervals.get(jobKey);
    if (interval) {
      clearInterval(interval);
      this.jobIntervals.delete(jobKey);
    }
  }
}

// Export singleton instance
export const universalAgentEngine = UniversalAgentEngine.getInstance();