/**
 * Unified Document Processor
 * Processes ALL 65 documents across ALL agent types with ONE progress bar (0-100%)
 * Replaces the individual agent processing with a comprehensive single-job system
 */

import { db } from '../db';
import { backgroundJobs, agentAnalyses } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { storage } from '../storage';
import { websocketManager } from './websocketManager';
import OpenAI from 'openai';

interface UnifiedProcessingJob {
  jobId: string;
  dealId: number;
  totalDocuments: number;
  processedDocuments: number;
  currentDocument: string;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startTime: Date;
  agentResults: {
    clinical: any[];
    legal: any[];
    commercial: any[];
    hr: any[];
    financial: any[];
    ip: any[];
    research: any[];
  };
}

class UnifiedDocumentProcessor {
  private activeJobs = new Map<number, UnifiedProcessingJob>();
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Start unified processing for all documents in a deal
   * Creates ONE job that processes ALL 65 documents across ALL agent types
   */
  async startUnifiedProcessing(dealId: number): Promise<string> {
    // Check if already processing
    if (this.activeJobs.has(dealId)) {
      throw new Error(`Unified processing already running for deal ${dealId}`);
    }

    // Get all documents for the deal
    const documents = await storage.getDocumentsByDealId(dealId);
    const relevantDocs = documents.filter(doc => 
      doc.ocrText && doc.ocrText.trim().length > 100
    );

    if (relevantDocs.length === 0) {
      throw new Error('No documents with content found for analysis');
    }

    const jobId = `unified-analysis-${dealId}-${Date.now()}`;
    
    // Create unified job
    const job: UnifiedProcessingJob = {
      jobId,
      dealId,
      totalDocuments: relevantDocs.length,
      processedDocuments: 0,
      currentDocument: '',
      progress: 0,
      status: 'pending',
      startTime: new Date(),
      agentResults: {
        clinical: [],
        legal: [],
        commercial: [],
        hr: [],
        financial: [],
        ip: [],
        research: []
      }
    };

    this.activeJobs.set(dealId, job);

    // Create database record
    await db.insert(backgroundJobs).values({
      jobId,
      dealId,
      jobType: 'unified_document_analysis',
      status: 'processing',
      progress: 0,
      currentStep: 'Starting unified document analysis...',
      metadata: {
        totalDocuments: relevantDocs.length,
        agentTypes: ['clinical', 'legal', 'commercial', 'hr', 'financial', 'ip', 'research'],
        startTime: new Date().toISOString()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log(`🚀 Starting unified processing for deal ${dealId} with ${relevantDocs.length} documents`);

    // Start processing in background
    this.processDocumentsUnified(job, relevantDocs).catch(error => {
      console.error(`❌ Unified processing failed for deal ${dealId}:`, error);
      this.handleJobError(job, error);
    });

    return jobId;
  }

  /**
   * Process all documents with unified progress tracking
   */
  private async processDocumentsUnified(job: UnifiedProcessingJob, documents: any[]): Promise<void> {
    console.log(`📄 Processing ${documents.length} documents for deal ${job.dealId}`);

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      job.currentDocument = doc.name;
      job.processedDocuments = i;
      job.progress = Math.round((i / documents.length) * 100);

      // Update progress
      await this.updateJobProgress(job, `Processing ${doc.name} (${i + 1}/${documents.length})`);

      try {
        // Process document for ALL agent types simultaneously
        const agentResults = await this.processDocumentForAllAgents(doc);
        
        // Store results in job
        Object.keys(agentResults).forEach(agentType => {
          if (agentResults[agentType] && agentResults[agentType].length > 0) {
            job.agentResults[agentType].push(...agentResults[agentType]);
          }
        });

        console.log(`✅ Processed document ${i + 1}/${documents.length}: ${doc.name}`);

      } catch (error) {
        console.error(`❌ Error processing document ${doc.name}:`, error);
        // Continue with next document instead of failing entire job
      }

      // Small delay to prevent overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Complete the job
    job.status = 'completed';
    job.progress = 100;
    job.processedDocuments = documents.length;

    await this.finalizeJobResults(job);
    console.log(`✅ Unified processing completed for deal ${job.dealId}`);
  }

  /**
   * Process a single document for ALL agent types at once
   */
  private async processDocumentForAllAgents(document: any): Promise<any> {
    const prompt = `You are an expert multi-domain investment analyst. Analyze this document for ALL of the following aspects simultaneously:

1. CLINICAL: Medical device regulations, clinical trials, FDA compliance, safety data
2. LEGAL: Contracts, IP, compliance, corporate structure, litigation risks  
3. COMMERCIAL: Market size, competition, go-to-market strategy, business model
4. HR: Team composition, key personnel, organizational structure, hiring plans
5. FINANCIAL: Revenue, costs, projections, unit economics, funding needs
6. IP: Patents, trademarks, trade secrets, IP strategy, freedom to operate
7. RESEARCH: Technology innovation, R&D capabilities, scientific publications

Document: "${document.name}"
Content: ${document.ocrText.substring(0, 8000)}

Return a JSON object with findings for each relevant category:
{
  "clinical": [{"finding": "...", "impact": "high|medium|low", "evidence": "..."}],
  "legal": [{"finding": "...", "impact": "high|medium|low", "evidence": "..."}],
  "commercial": [{"finding": "...", "impact": "high|medium|low", "evidence": "..."}],
  "hr": [{"finding": "...", "impact": "high|medium|low", "evidence": "..."}],
  "financial": [{"finding": "...", "impact": "high|medium|low", "evidence": "..."}],
  "ip": [{"finding": "...", "impact": "high|medium|low", "evidence": "..."}],
  "research": [{"finding": "...", "impact": "high|medium|low", "evidence": "..."}]
}

Only include categories that have relevant findings. Empty arrays are fine for irrelevant categories.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 3000
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      console.error(`❌ OpenAI processing failed for ${document.name}:`, error);
      return {};
    }
  }

  /**
   * Update job progress in database and via WebSocket
   */
  private async updateJobProgress(job: UnifiedProcessingJob, currentStep: string): Promise<void> {
    try {
      // Update database
      await db
        .update(backgroundJobs)
        .set({
          progress: job.progress,
          currentStep,
          updatedAt: new Date()
        })
        .where(eq(backgroundJobs.jobId, job.jobId));

      // Send WebSocket update
      websocketManager.notifyJobUpdate(job.dealId, {
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        currentStep,
        processedDocuments: job.processedDocuments,
        totalDocuments: job.totalDocuments
      });

    } catch (error) {
      console.error(`❌ Failed to update job progress:`, error);
    }
  }

  /**
   * Finalize job and save all agent results to database
   */
  private async finalizeJobResults(job: UnifiedProcessingJob): Promise<void> {
    try {
      // Save results for each agent type
      const agentTypes = Object.keys(job.agentResults);
      
      for (const agentType of agentTypes) {
        const findings = job.agentResults[agentType];
        
        if (findings.length > 0) {
          // Create or update agent analysis record
          const existingAnalysis = await storage.getAnalysisByDealIdAndType(job.dealId, agentType);
          
          if (existingAnalysis) {
            // Update existing
            await storage.updateAnalysis(existingAnalysis.id, {
              findings: findings.map(f => f.finding),
              recommendations: findings.filter(f => f.impact === 'high').map(f => `Address: ${f.finding}`),
              status: 'Completed',
              progress: 100
            });
          } else {
            // Create new
            await storage.createAgentAnalysis({
              dealId: job.dealId,
              agentType,
              status: 'Completed',
              progress: 100,
              findings: findings.map(f => f.finding),
              recommendations: findings.filter(f => f.impact === 'high').map(f => `Address: ${f.finding}`)
            });
          }
        }
      }

      // Update job status to completed
      await db
        .update(backgroundJobs)
        .set({
          status: 'completed',
          progress: 100,
          currentStep: 'Analysis completed successfully',
          updatedAt: new Date()
        })
        .where(eq(backgroundJobs.jobId, job.jobId));

      // Send final WebSocket update
      websocketManager.notifyJobUpdate(job.dealId, {
        jobId: job.jobId,
        status: 'completed',
        progress: 100,
        currentStep: 'Analysis completed successfully',
        message: `Processed ${job.totalDocuments} documents across all agent categories`
      });

      // Remove from active jobs
      this.activeJobs.delete(job.dealId);

      console.log(`✅ Finalized unified analysis for deal ${job.dealId}`);

    } catch (error) {
      console.error(`❌ Failed to finalize job results:`, error);
      await this.handleJobError(job, error);
    }
  }

  /**
   * Handle job errors
   */
  private async handleJobError(job: UnifiedProcessingJob, error: any): Promise<void> {
    job.status = 'failed';
    
    try {
      await db
        .update(backgroundJobs)
        .set({
          status: 'failed',
          error: error.message || 'Unknown error occurred',
          updatedAt: new Date()
        })
        .where(eq(backgroundJobs.jobId, job.jobId));

      websocketManager.notifyJobUpdate(job.dealId, {
        jobId: job.jobId,
        status: 'failed',
        progress: job.progress,
        currentStep: 'Processing failed',
        error: error.message
      });

    } catch (updateError) {
      console.error(`❌ Failed to update job error status:`, updateError);
    }

    this.activeJobs.delete(job.dealId);
  }

  /**
   * Get job status
   */
  getJobStatus(dealId: number): UnifiedProcessingJob | null {
    return this.activeJobs.get(dealId) || null;
  }

  /**
   * Cancel a running job
   */
  async cancelJob(dealId: number): Promise<boolean> {
    const job = this.activeJobs.get(dealId);
    if (!job) return false;

    job.status = 'failed';
    this.activeJobs.delete(dealId);

    try {
      await db
        .update(backgroundJobs)
        .set({
          status: 'cancelled',
          updatedAt: new Date()
        })
        .where(eq(backgroundJobs.jobId, job.jobId));
    } catch (error) {
      console.error(`❌ Failed to cancel job:`, error);
    }

    return true;
  }
}

export const unifiedDocumentProcessor = new UnifiedDocumentProcessor();