/**
 * Memo Section Rerun Service
 * 
 * Provides Force Rerun functionality for individual memo sections,
 * following the same architecture as agent Force Rerun buttons.
 * 
 * Each section rerun:
 * 1. Creates a background job for progress tracking
 * 2. Gathers all relevant document OCR for the section's required agents
 * 3. Uses AgentDataFusionService to extract structured facts
 * 4. Uses ClaudeOpusMemoSynthesis to generate high-quality content
 * 5. Validates quality against section-specific thresholds
 * 6. Updates the investment memo with new section content
 */

import { storage } from '../storage';
import { db } from '../db';
import { backgroundJobs, investmentMemos } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { agentDataFusionService } from './agentDataFusion';
import { claudeOpusMemoSynthesis } from './claudeOpusMemoSynthesis';
import { MEMO_SECTION_CONFIGS, getSectionConfig, SectionConfig } from './memoSectionConfig';

export interface SectionRerunProgress {
  sectionName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentStep: string;
  qualityScore?: number;
  citationCount?: number;
  metricCount?: number;
}

export interface SectionRerunResult {
  success: boolean;
  sectionName: string;
  content?: string;
  qualityScore?: number;
  citationCount?: number;
  metricCount?: number;
  evidenceCount?: number;
  agentsUsed?: string[];
  error?: string;
}

export class MemoSectionRerunService {
  private static instance: MemoSectionRerunService;
  private activeSectionRuns: Map<string, SectionRerunProgress> = new Map();

  static getInstance(): MemoSectionRerunService {
    if (!MemoSectionRerunService.instance) {
      MemoSectionRerunService.instance = new MemoSectionRerunService();
    }
    return MemoSectionRerunService.instance;
  }

  /**
   * Get unique job ID for a section rerun
   */
  private getJobId(dealId: number, sectionName: string): string {
    return `memo-section-rerun-${sectionName}-${dealId}`;
  }

  /**
   * Get the current status of a section rerun
   */
  async getSectionRerunStatus(dealId: number, sectionName: string): Promise<SectionRerunProgress | null> {
    const jobId = this.getJobId(dealId, sectionName);
    
    // Check in-memory first
    const memoryStatus = this.activeSectionRuns.get(jobId);
    if (memoryStatus) {
      return memoryStatus;
    }
    
    // Check database
    const sectionRun = await storage.getMemoSectionRun(dealId, sectionName);
    if (sectionRun) {
      return {
        sectionName: sectionRun.sectionName,
        status: sectionRun.status as any,
        progress: sectionRun.progress,
        currentStep: sectionRun.currentStep || '',
        qualityScore: sectionRun.qualityScore || undefined,
        citationCount: sectionRun.citationCount || undefined,
        metricCount: sectionRun.metricCount || undefined
      };
    }
    
    return null;
  }

  /**
   * Get status of all section reruns for a deal
   */
  async getAllSectionRerunStatuses(dealId: number): Promise<Record<string, SectionRerunProgress>> {
    const statuses: Record<string, SectionRerunProgress> = {};
    
    const sectionRuns = await storage.getMemoSectionRunsByDealId(dealId);
    
    for (const run of sectionRuns) {
      statuses[run.sectionName] = {
        sectionName: run.sectionName,
        status: run.status as any,
        progress: run.progress,
        currentStep: run.currentStep || '',
        qualityScore: run.qualityScore || undefined,
        citationCount: run.citationCount || undefined,
        metricCount: run.metricCount || undefined
      };
    }
    
    return statuses;
  }

  /**
   * Force rerun a specific memo section
   * This is the main entry point for section regeneration
   */
  async forceRerunSection(dealId: number, sectionName: string): Promise<SectionRerunResult> {
    const jobId = this.getJobId(dealId, sectionName);
    const sectionConfig = getSectionConfig(sectionName);
    
    if (!sectionConfig) {
      return {
        success: false,
        sectionName,
        error: `Unknown section: ${sectionName}. Valid sections: ${MEMO_SECTION_CONFIGS.map(c => c.sectionName).join(', ')}`
      };
    }
    
    console.log(`\n📝 ========================================`);
    console.log(`📝 MEMO SECTION RERUN: ${sectionConfig.displayName}`);
    console.log(`📝 Deal: ${dealId}, Section: ${sectionName}`);
    console.log(`📝 Required agents: ${sectionConfig.requiredAgents.join(', ')}`);
    console.log(`📝 Quality threshold: ${sectionConfig.qualityThreshold}`);
    console.log(`📝 ========================================\n`);

    try {
      // Clean up any existing jobs for this section
      await this.cleanupExistingSectionJobs(dealId, sectionName);
      
      // Create background job for progress tracking
      await storage.createBackgroundJob({
        jobId,
        jobType: 'memo_section_rerun',
        dealId,
        status: 'processing',
        progress: 0,
        currentStep: `Starting ${sectionConfig.displayName} generation`,
        agentType: `memo-${sectionName}`
      });
      
      // Create or update section run record
      const existingRun = await storage.getMemoSectionRun(dealId, sectionName);
      if (existingRun) {
        await storage.updateMemoSectionRun(existingRun.id, {
          status: 'processing',
          progress: 0,
          currentStep: `Starting ${sectionConfig.displayName} generation`,
          startedAt: new Date()
        });
      } else {
        await storage.createMemoSectionRun({
          dealId,
          sectionName,
          status: 'processing',
          progress: 0,
          currentStep: `Starting ${sectionConfig.displayName} generation`,
          jobId,
          startedAt: new Date()
        });
      }
      
      // Track in memory
      this.activeSectionRuns.set(jobId, {
        sectionName,
        status: 'processing',
        progress: 0,
        currentStep: `Starting ${sectionConfig.displayName} generation`
      });
      
      // Step 1: Get deal info
      await this.updateProgress(dealId, sectionName, 5, 'Loading deal information...');
      const deal = await storage.getDealById(dealId);
      if (!deal) {
        throw new Error(`Deal ${dealId} not found`);
      }
      
      // Step 2: Load agent analyses for required agents
      await this.updateProgress(dealId, sectionName, 10, `Loading agent analyses for: ${sectionConfig.requiredAgents.join(', ')}`);
      const agentAnalyses = await storage.getAnalysesByDealId(dealId);
      const relevantAnalyses = agentAnalyses.filter(a => 
        sectionConfig.requiredAgents.includes(a.agentType?.toLowerCase() || '')
      );
      
      console.log(`📊 Found ${relevantAnalyses.length} relevant agent analyses for ${sectionConfig.displayName}`);
      
      // Step 3: Build fact matrix from agent analyses
      await this.updateProgress(dealId, sectionName, 20, 'Building agent fact matrix...');
      const factMatrix = await agentDataFusionService.buildAgentFactMatrix(
        dealId,
        deal.companyName || 'Unknown Company',
        relevantAnalyses
      );
      
      console.log(`📊 Fact matrix built: ${factMatrix.totalFacts} facts, ${factMatrix.quantitativeMetrics.length} metrics`);
      
      // Step 4: Get document OCR context
      await this.updateProgress(dealId, sectionName, 30, 'Loading document context...');
      const documents = await storage.getDocumentsWithOCRByDealId(dealId);
      const ocrContext = documents
        .filter(doc => doc.ocrText)
        .map(doc => `=== ${doc.fileName} ===\n${doc.ocrText?.substring(0, 5000)}`)
        .join('\n\n')
        .substring(0, 30000);
      
      // Step 5: Get company research if available
      await this.updateProgress(dealId, sectionName, 40, 'Loading company research...');
      const companyResearch = await storage.getCompanyResearchByDealId(dealId);
      
      // Step 6: Get AI evaluation if available
      const comprehensiveAnalysis = await storage.getComprehensiveAnalysis(dealId);
      
      // Step 7: Generate section content using Claude Opus
      await this.updateProgress(dealId, sectionName, 50, `Generating ${sectionConfig.displayName} with AI...`);
      
      const generationResult = await claudeOpusMemoSynthesis.generateSection({
        sectionType: sectionName,
        sectionTitle: sectionConfig.displayName,
        companyName: deal.companyName || 'Unknown Company',
        factMatrix,
        ocrContext,
        companyResearch,
        aiEvaluation: comprehensiveAnalysis,
        maxTokens: 6000
      });
      
      console.log(`📊 Section generated: Quality ${generationResult.qualityScore}/100, ${generationResult.citationsUsed.length} citations`);
      
      // Step 8: Validate quality against threshold
      await this.updateProgress(dealId, sectionName, 70, 'Validating quality...');
      
      const meetsThreshold = generationResult.qualityScore >= sectionConfig.qualityThreshold;
      
      // Step 9: Count evidence metrics from the generated content
      let evidenceCount = generationResult.quantitativeDataPoints || 0;
      console.log(`📊 Found ${evidenceCount} evidence items in generated content`);
      
      // CRITICAL: Only update memo if quality threshold is met
      if (!meetsThreshold) {
        console.log(`❌ Quality ${generationResult.qualityScore} BELOW threshold ${sectionConfig.qualityThreshold} - NOT updating memo`);
        
        // Mark as failed due to quality
        await this.updateProgress(dealId, sectionName, 100, `Quality too low: ${generationResult.qualityScore}/${sectionConfig.qualityThreshold}`);
        
        await storage.updateBackgroundJob(jobId, {
          status: 'failed',
          progress: 100,
          currentStep: `Quality ${generationResult.qualityScore} below required ${sectionConfig.qualityThreshold}`
        });
        
        const runRecord = await storage.getMemoSectionRun(dealId, sectionName);
        if (runRecord) {
          await storage.updateMemoSectionRun(runRecord.id, {
            status: 'failed',
            progress: 100,
            currentStep: `Quality too low: ${generationResult.qualityScore}/${sectionConfig.qualityThreshold}`,
            qualityScore: generationResult.qualityScore,
            citationCount: generationResult.citationsUsed.length,
            metricCount: generationResult.quantitativeDataPoints,
            error: `Generated content quality (${generationResult.qualityScore}) did not meet required threshold (${sectionConfig.qualityThreshold})`,
            completedAt: new Date()
          });
        }
        
        this.activeSectionRuns.delete(jobId);
        
        console.log(`\n❌ ========================================`);
        console.log(`❌ MEMO SECTION RERUN FAILED: ${sectionConfig.displayName}`);
        console.log(`❌ Quality Score: ${generationResult.qualityScore}/100 (Required: ${sectionConfig.qualityThreshold}+)`);
        console.log(`❌ Content NOT saved to memo`);
        console.log(`❌ ========================================\n`);
        
        return {
          success: false,
          sectionName,
          error: `Quality score ${generationResult.qualityScore} below required threshold ${sectionConfig.qualityThreshold}`,
          qualityScore: generationResult.qualityScore,
          citationCount: generationResult.citationsUsed.length,
          metricCount: generationResult.quantitativeDataPoints,
          evidenceCount
        };
      }
      
      // Step 10: Update investment memo with new section content (only if quality met)
      await this.updateProgress(dealId, sectionName, 90, 'Saving to investment memo...');
      
      await this.updateMemoSection(dealId, sectionName, generationResult.content, {
        qualityScore: generationResult.qualityScore,
        citationCount: generationResult.citationsUsed.length,
        metricCount: generationResult.quantitativeDataPoints,
        evidenceCount,
        agentsUsed: sectionConfig.requiredAgents
      });
      
      // Step 11: Mark as completed
      await this.updateProgress(dealId, sectionName, 100, 'Completed');
      
      await storage.updateBackgroundJob(jobId, {
        status: 'completed',
        progress: 100,
        currentStep: `${sectionConfig.displayName} generation complete`
      });
      
      const runRecord = await storage.getMemoSectionRun(dealId, sectionName);
      if (runRecord) {
        await storage.updateMemoSectionRun(runRecord.id, {
          status: 'completed',
          progress: 100,
          currentStep: 'Completed',
          content: generationResult.content,
          qualityScore: generationResult.qualityScore,
          citationCount: generationResult.citationsUsed.length,
          metricCount: generationResult.quantitativeDataPoints,
          evidenceCount,
          agentsUsed: sectionConfig.requiredAgents,
          completedAt: new Date()
        });
      }
      
      this.activeSectionRuns.delete(jobId);
      
      console.log(`\n✅ ========================================`);
      console.log(`✅ MEMO SECTION RERUN COMPLETE: ${sectionConfig.displayName}`);
      console.log(`✅ Quality Score: ${generationResult.qualityScore}/100 (Required: ${sectionConfig.qualityThreshold}+)`);
      console.log(`✅ Citations: ${generationResult.citationsUsed.length}`);
      console.log(`✅ Data Points: ${generationResult.quantitativeDataPoints}`);
      console.log(`✅ Evidence Items: ${evidenceCount}`);
      console.log(`✅ ========================================\n`);
      
      return {
        success: true,
        sectionName,
        content: generationResult.content,
        qualityScore: generationResult.qualityScore,
        citationCount: generationResult.citationsUsed.length,
        metricCount: generationResult.quantitativeDataPoints,
        evidenceCount,
        agentsUsed: sectionConfig.requiredAgents
      };
      
    } catch (error: any) {
      console.error(`❌ Error in section rerun for ${sectionName}:`, error);
      
      await storage.updateBackgroundJob(jobId, {
        status: 'failed',
        progress: 0,
        currentStep: `Failed: ${error.message}`
      });
      
      const runRecord = await storage.getMemoSectionRun(dealId, sectionName);
      if (runRecord) {
        await storage.updateMemoSectionRun(runRecord.id, {
          status: 'failed',
          error: error.message,
          completedAt: new Date()
        });
      }
      
      this.activeSectionRuns.delete(jobId);
      
      return {
        success: false,
        sectionName,
        error: error.message
      };
    }
  }

  /**
   * Update progress for a section rerun
   */
  private async updateProgress(
    dealId: number, 
    sectionName: string, 
    progress: number, 
    currentStep: string
  ): Promise<void> {
    const jobId = this.getJobId(dealId, sectionName);
    
    console.log(`📊 [${sectionName}] ${progress}% - ${currentStep}`);
    
    // Update in-memory
    this.activeSectionRuns.set(jobId, {
      sectionName,
      status: 'processing',
      progress,
      currentStep
    });
    
    // Update database
    await storage.updateBackgroundJob(jobId, {
      progress,
      currentStep
    });
    
    const runRecord = await storage.getMemoSectionRun(dealId, sectionName);
    if (runRecord) {
      await storage.updateMemoSectionRun(runRecord.id, {
        progress,
        currentStep
      });
    }
  }

  /**
   * Clean up existing section jobs before starting new one
   */
  private async cleanupExistingSectionJobs(dealId: number, sectionName: string): Promise<void> {
    const jobId = this.getJobId(dealId, sectionName);
    
    // Delete existing background job if any
    await db.delete(backgroundJobs)
      .where(and(
        eq(backgroundJobs.jobId, jobId)
      ));
    
    console.log(`🧹 Cleaned up existing jobs for section: ${sectionName}`);
  }

  /**
   * Update the investment memo with new section content
   * Uses the 'memo' JSON field which stores all section content
   */
  private async updateMemoSection(
    dealId: number, 
    sectionName: string, 
    content: string,
    metadata: {
      qualityScore: number;
      citationCount: number;
      metricCount: number;
      evidenceCount: number;
      agentsUsed: string[];
    }
  ): Promise<void> {
    // Get existing memo
    const existingMemo = await storage.getMemoByDealId(dealId);
    
    if (existingMemo) {
      // Parse existing memo JSON field which contains sections
      const memoData = (existingMemo.memo as any) || {};
      
      // Ensure sections object exists
      if (!memoData.sections) {
        memoData.sections = {};
      }
      
      // Update the specific section
      memoData.sections[sectionName] = content;
      
      // Also update direct section field if this is executiveSummary
      const updateData: any = {
        memo: memoData,
        status: 'Completed'
      };
      
      // Map section name to top-level field if applicable
      if (sectionName === 'executiveSummary') {
        updateData.executiveSummary = content;
      } else if (sectionName === 'marketAnalysis' || sectionName === 'competitiveAnalysis') {
        updateData.productMarket = content;
      }
      
      await storage.updateMemo(existingMemo.id, updateData);
      
      console.log(`📝 Updated memo section: ${sectionName}`);
    } else {
      // Create new memo with just this section
      const memoData: any = {
        sections: {}
      };
      memoData.sections[sectionName] = content;
      
      await storage.createMemo({
        dealId,
        memo: memoData,
        status: 'Draft'
      });
      
      console.log(`📝 Created new memo with section: ${sectionName}`);
    }
  }

  /**
   * Cancel a running section rerun
   */
  async cancelSectionRerun(dealId: number, sectionName: string): Promise<boolean> {
    const jobId = this.getJobId(dealId, sectionName);
    
    // Update background job
    await storage.updateBackgroundJob(jobId, {
      status: 'cancelled',
      currentStep: 'Cancelled by user'
    });
    
    // Update section run record
    const runRecord = await storage.getMemoSectionRun(dealId, sectionName);
    if (runRecord) {
      await storage.updateMemoSectionRun(runRecord.id, {
        status: 'cancelled',
        currentStep: 'Cancelled by user',
        completedAt: new Date()
      });
    }
    
    // Remove from memory
    this.activeSectionRuns.delete(jobId);
    
    console.log(`🚫 Cancelled section rerun: ${sectionName}`);
    return true;
  }

  /**
   * Get all available section configurations
   */
  getAvailableSections(): SectionConfig[] {
    return MEMO_SECTION_CONFIGS;
  }
}

export const memoSectionRerunService = MemoSectionRerunService.getInstance();
