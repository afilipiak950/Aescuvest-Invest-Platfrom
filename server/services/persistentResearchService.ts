import { storage } from '../storage';
import { type InsertResearchJob } from '@shared/schema';
import { authenticResearchService } from './authenticResearchService';

interface ResearchStep {
  name: string;
  description: string;
  weight: number; // Percentage weight of this step
}

const RESEARCH_STEPS: ResearchStep[] = [
  { name: "Initializing", description: "Setting up research parameters", weight: 5 },
  { name: "Website Analysis", description: "Scraping company website content", weight: 15 },
  { name: "CEO Research", description: "Analyzing leadership and executive team", weight: 15 },
  { name: "Financial Analysis", description: "Gathering funding and financial data", weight: 20 },
  { name: "Market Research", description: "Analyzing market position and competitors", weight: 15 },
  { name: "Business Intelligence", description: "Collecting news and business insights", weight: 15 },
  { name: "Risk Assessment", description: "Evaluating potential risks and challenges", weight: 10 },
  { name: "Final Processing", description: "Consolidating and storing research data", weight: 5 }
];

export class PersistentResearchService {
  private static instance: PersistentResearchService;
  private activeJobs = new Map<number, boolean>();

  static getInstance(): PersistentResearchService {
    if (!PersistentResearchService.instance) {
      PersistentResearchService.instance = new PersistentResearchService();
    }
    return PersistentResearchService.instance;
  }

  // Start a new background research job
  async startResearchJob(dealId: number, companyName: string, website: string): Promise<number> {
    console.log(`🔬 Starting persistent research job for deal ${dealId} - ${companyName}`);
    
    // Check if a job is already running for this deal
    const existingJob = await this.getActiveJob(dealId);
    if (existingJob) {
      console.log(`📋 Research job already running for deal ${dealId}, returning existing job ID: ${existingJob.id}`);
      return existingJob.id;
    }

    // Create new research job record using storage layer
    const jobData: InsertResearchJob = {
      dealId,
      companyName,
      website,
      status: 'processing',
      progress: 0,
      currentStep: 0,
      stepProgress: 0,
      totalSteps: RESEARCH_STEPS.length,
      debugInfo: JSON.stringify({
        companyName,
        website,
        startTime: new Date().toISOString(),
        steps: RESEARCH_STEPS
      })
    };

    const job = await storage.createResearchJob(jobData);

    console.log(`✅ Created background research job ${job.id} for deal ${dealId}`);

    // Start the research process in background
    this.runResearchInBackground(job.id, dealId, companyName, website);

    return job.id;
  }

  // Get active job for a deal
  async getActiveJob(dealId: number) {
    return await storage.getActiveResearchJobByDealId(dealId);
  }

  // Get job progress
  async getJobProgress(dealId: number) {
    const job = await this.getActiveJob(dealId);
    if (!job) {
      // Check for completed job
      const [completedJob] = await db
        .select()
        .from(researchBackgroundJobs)
        .where(and(
          eq(researchBackgroundJobs.dealId, dealId),
          eq(researchBackgroundJobs.status, 'completed')
        ))
        .orderBy(researchBackgroundJobs.createdAt)
        .limit(1);

      return completedJob || null;
    }

    return job;
  }

  // Update job progress
  async updateJobProgress(jobId: number, step: number, progress: number, stage: string, debugInfo?: any) {
    console.log(`📊 Updating job ${jobId}: Step ${step}/8 (${progress}%) - ${stage}`);
    
    const updateData: any = {
      currentStep: step,
      progress,
      progressStage: stage,
      updatedAt: new Date()
    };

    if (debugInfo) {
      updateData.debugInfo = debugInfo;
    }

    await db
      .update(researchBackgroundJobs)
      .set(updateData)
      .where(eq(researchBackgroundJobs.id, jobId));
  }

  // Complete job
  async completeJob(jobId: number, result: any) {
    console.log(`✅ Completing research job ${jobId}`);
    
    await db
      .update(researchBackgroundJobs)
      .set({
        status: 'completed',
        progress: 100,
        progressStage: 'Research completed successfully',
        currentStep: RESEARCH_STEPS.length,
        completedAt: new Date(),
        result,
        updatedAt: new Date()
      })
      .where(eq(researchBackgroundJobs.id, jobId));

    this.activeJobs.delete(jobId);
  }

  // Fail job
  async failJob(jobId: number, error: string) {
    console.log(`❌ Failing research job ${jobId}: ${error}`);
    
    await db
      .update(researchBackgroundJobs)
      .set({
        status: 'failed',
        progressStage: 'Research failed',
        error,
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(researchBackgroundJobs.id, jobId));

    this.activeJobs.delete(jobId);
  }

  // Run research in background with detailed progress tracking
  private async runResearchInBackground(jobId: number, dealId: number, companyName: string, website: string) {
    if (this.activeJobs.has(jobId)) {
      console.log(`🔄 Job ${jobId} already running, skipping duplicate execution`);
      return;
    }

    this.activeJobs.set(jobId, true);
    console.log(`🚀 Starting background research execution for job ${jobId}`);

    try {
      let cumulativeProgress = 0;
      let result: any = {};

      // Step 1: Initialize (5%)
      cumulativeProgress += RESEARCH_STEPS[0].weight;
      await this.updateJobProgress(jobId, 1, cumulativeProgress, "Initializing research parameters", {
        step: "initialization",
        timestamp: new Date().toISOString()
      });
      await this.delay(2000);

      // Step 2: Website Analysis (15%)
      cumulativeProgress += RESEARCH_STEPS[1].weight;
      await this.updateJobProgress(jobId, 2, cumulativeProgress, "Scraping company website content", {
        step: "website_analysis",
        url: website,
        timestamp: new Date().toISOString()
      });

      console.log(`🌐 Starting comprehensive research for ${companyName}`);
      
      // Use the main research method which handles all steps internally
      const researchData = await authenticResearchService.conductComprehensiveResearch(dealId);
      result = researchData;
      console.log(`✅ Comprehensive research complete`);

      // Update progress through all steps
      for (let step = 2; step <= 8; step++) {
        cumulativeProgress += RESEARCH_STEPS[step - 1].weight;
        await this.updateJobProgress(jobId, step, cumulativeProgress, RESEARCH_STEPS[step - 1].description, {
          step: `step_${step}`,
          timestamp: new Date().toISOString()
        });
        await this.delay(1000); // Small delay to show progress
      }

      await this.completeJob(jobId, result);
      console.log(`🎉 Research job ${jobId} completed successfully for deal ${dealId}`);

    } catch (error) {
      console.error(`❌ Research job ${jobId} failed:`, error);
      await this.failJob(jobId, error.message);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const persistentResearchService = PersistentResearchService.getInstance();