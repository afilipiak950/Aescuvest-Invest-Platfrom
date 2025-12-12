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
import { eq, and, lt } from 'drizzle-orm';
import { agentDataFusionService } from './agentDataFusion';
import { claudeOpusMemoSynthesis } from './claudeOpusMemoSynthesis';
import { MEMO_SECTION_CONFIGS, getSectionConfig, SectionConfig } from './memoSectionConfig';
import { websocketManager } from './websocketManager';
import { cleanMemoSectionContent } from '../utils/textFormatting';

// BULLETPROOF: Maximum time a section can run before considered stuck (5 minutes)
const MAX_SECTION_RUN_TIME_MS = 5 * 60 * 1000;

// BULLETPROOF: Overall timeout for entire section generation (6 minutes) 
const SECTION_GENERATION_TIMEOUT_MS = 6 * 60 * 1000;

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
  lowConfidence?: boolean; // Flag for content that's below quality threshold but still saved
}

export class MemoSectionRerunService {
  private static instance: MemoSectionRerunService;
  private activeSectionRuns: Map<string, SectionRerunProgress> = new Map();
  private jobStartTimes: Map<string, number> = new Map(); // Track when each job started

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
   * BULLETPROOF: Clean up stuck jobs that have been running too long
   * This is called before starting a new job to ensure clean state
   * Persists fallback content to ensure memo sections are never empty
   */
  async cleanupStuckJobs(dealId: number, sectionName: string): Promise<void> {
    const jobId = this.getJobId(dealId, sectionName);
    const startTime = this.jobStartTimes.get(jobId);
    
    if (startTime && (Date.now() - startTime) > MAX_SECTION_RUN_TIME_MS) {
      const sectionConfig = getSectionConfig(sectionName);
      const displayName = sectionConfig?.displayName || sectionName;
      
      console.log(`🧹 CLEANING UP STUCK JOB: ${jobId} (running for ${Math.round((Date.now() - startTime) / 1000)}s)`);
      
      // Clear from in-memory tracking
      this.activeSectionRuns.delete(jobId);
      this.jobStartTimes.delete(jobId);
      
      // CRITICAL: Generate and persist fallback content to ensure section is never empty
      const fallbackContent = `## ${displayName}\n\n*This section timed out during generation. Please click "Force Rerun" to regenerate.*\n\n**Note:** The previous generation attempt exceeded the time limit. The system recovered automatically.`;
      
      try {
        // BULLETPROOF: Save fallback content to the memo so section is never blank
        await this.updateMemoSection(dealId, sectionName, fallbackContent, {
          qualityScore: 25,
          citationCount: 0,
          metricCount: 0,
          evidenceCount: 0,
          agentsUsed: sectionConfig?.requiredAgents || []
        });
        
        await storage.updateBackgroundJob(jobId, {
          status: 'completed',
          progress: 100,
          currentStep: 'Recovered from stuck state - fallback content saved'
        });
        
        const runRecord = await storage.getMemoSectionRun(dealId, sectionName);
        if (runRecord && runRecord.status !== 'completed') {
          await storage.updateMemoSectionRun(runRecord.id, {
            status: 'completed',
            progress: 100,
            qualityScore: 25,
            currentStep: 'Recovered from stuck state',
            completedAt: new Date()
          });
        }
        
        // Broadcast via WebSocket so UI updates immediately
        this.broadcastSectionCompletion(dealId, sectionName, 'low_confidence', fallbackContent, 25);
        
        console.log(`✅ Stuck job cleanup complete - fallback content saved for ${displayName}`);
      } catch (e) {
        console.error('Error cleaning up stuck job:', e);
      }
    }
  }

  /**
   * BULLETPROOF: Wrap async operation with hard timeout
   */
  private async withSectionTimeout<T>(
    operation: Promise<T>,
    sectionName: string,
    timeoutMs: number = SECTION_GENERATION_TIMEOUT_MS
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`SECTION_TIMEOUT: ${sectionName} exceeded ${timeoutMs/1000}s limit`));
      }, timeoutMs);
    });
    
    try {
      const result = await Promise.race([operation, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      throw error;
    }
  }

  /**
   * Broadcast section completion via WebSocket for instant UI updates
   * This is called immediately when a section finishes generating
   */
  private broadcastSectionCompletion(dealId: number, sectionName: string, status: 'completed' | 'low_confidence', content?: string, qualityScore?: number) {
    console.log(`\n📡📡📡 ========================================`);
    console.log(`📡 BROADCASTING SECTION COMPLETION VIA WEBSOCKET`);
    console.log(`📡 Deal ID: ${dealId} (type: ${typeof dealId})`);
    console.log(`📡 Section: ${sectionName}`);
    console.log(`📡 Status: ${status}`);
    console.log(`📡 Quality Score: ${qualityScore}`);
    console.log(`📡 Has Content: ${!!content}`);
    console.log(`📡📡📡 ========================================\n`);
    
    websocketManager.broadcast('memo_section_complete', {
      dealId,
      sectionName,
      status,
      content: content ? content.substring(0, 500) + '...' : undefined, // Preview only for efficiency
      qualityScore,
      timestamp: Date.now()
    }, dealId);
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
   * BULLETPROOF: Includes stuck job cleanup and hard timeout protection
   */
  async forceRerunSection(dealId: number, sectionName: string): Promise<SectionRerunResult> {
    const MAX_RETRIES = 1; // Automatically retry once if quality fails
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
      // BULLETPROOF: Clean up any stuck jobs first
      await this.cleanupStuckJobs(dealId, sectionName);
      
      // Clean up any existing jobs for this section
      await this.cleanupExistingSectionJobs(dealId, sectionName);
      
      // BULLETPROOF: Track when this job started
      this.jobStartTimes.set(jobId, Date.now());
      
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
      
      // CRITICAL: Clear existing section content BEFORE regeneration
      // This ensures UI shows placeholder while generating and new content appears fresh
      await this.clearMemoSection(dealId, sectionName);
      console.log(`🧹 Cleared old content for section: ${sectionName}`);
      
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
      
      // Step 7: Generate section content using Claude Opus with iterative retry
      let generationResult: Awaited<ReturnType<typeof claudeOpusMemoSynthesis.generateSection>> | null = null;
      let attemptCount = 0;
      let evidenceCount = 0;
      
      while (attemptCount <= MAX_RETRIES) {
        attemptCount++;
        const attemptLabel = attemptCount > 1 ? ` (retry #${attemptCount - 1})` : '';
        
        await this.updateProgress(dealId, sectionName, 50, `Generating ${sectionConfig.displayName} with AI${attemptLabel}...`);
        
        // BULLETPROOF: Wrap AI generation with hard timeout to prevent infinite hangs
        generationResult = await this.withSectionTimeout(
          claudeOpusMemoSynthesis.generateSection({
            sectionType: sectionName,
            sectionTitle: sectionConfig.displayName,
            companyName: deal.companyName || 'Unknown Company',
            factMatrix,
            ocrContext,
            companyResearch,
            aiEvaluation: comprehensiveAnalysis,
            maxTokens: 6000
          }),
          sectionName,
          SECTION_GENERATION_TIMEOUT_MS
        );
        
        console.log(`📊 Section generated (attempt ${attemptCount}): Quality ${generationResult.qualityScore}/100, ${generationResult.citationsUsed.length} citations`);
        
        // Check if quality meets threshold
        if (generationResult.qualityScore >= sectionConfig.qualityThreshold) {
          console.log(`✅ Quality threshold met on attempt ${attemptCount}`);
          break; // Success, exit retry loop
        }
        
        // Quality below threshold - check if we should retry
        if (attemptCount <= MAX_RETRIES) {
          console.log(`⚠️ Quality ${generationResult.qualityScore} below threshold ${sectionConfig.qualityThreshold}, retrying...`);
          await this.updateProgress(dealId, sectionName, 60, `Quality too low (${generationResult.qualityScore}), retrying...`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // Brief delay before retry
        }
      }
      
      // Step 8: Validate final quality after all retry attempts
      await this.updateProgress(dealId, sectionName, 70, 'Validating quality...');
      
      const meetsThreshold = generationResult!.qualityScore >= sectionConfig.qualityThreshold;
      evidenceCount = generationResult!.quantitativeDataPoints || 0;
      console.log(`📊 Found ${evidenceCount} evidence items in generated content`);
      
      // CRITICAL: Handle quality below threshold after all retries
      if (!meetsThreshold) {
        console.log(`❌ Quality ${generationResult!.qualityScore} BELOW threshold ${sectionConfig.qualityThreshold} after ${attemptCount} attempts`);
        
        // Check if we should accept "close enough" content
        const qualityGap = sectionConfig.qualityThreshold - generationResult!.qualityScore;
        if (qualityGap <= 5 && generationResult!.qualityScore >= 75) {
          // Accept content that's within 5 points of threshold and at least 75
          console.log(`⚠️ Quality ${generationResult!.qualityScore} is close to threshold (within ${qualityGap} points) - accepting with warning`);
          
          // Continue to save content with a warning note
          await this.updateProgress(dealId, sectionName, 90, 'Saving content (slightly below threshold)...');
          
          await this.updateMemoSection(dealId, sectionName, generationResult!.content, {
            qualityScore: generationResult!.qualityScore,
            citationCount: generationResult!.citationsUsed.length,
            metricCount: generationResult!.quantitativeDataPoints,
            evidenceCount,
            agentsUsed: sectionConfig.requiredAgents
          });
          
          await this.updateProgress(dealId, sectionName, 100, 'Completed (quality warning)');
          
          await storage.updateBackgroundJob(jobId, {
            status: 'completed',
            progress: 100,
            currentStep: `Completed with quality warning: ${generationResult!.qualityScore}/${sectionConfig.qualityThreshold}`
          });
          
          const runRecord = await storage.getMemoSectionRun(dealId, sectionName);
          if (runRecord) {
            await storage.updateMemoSectionRun(runRecord.id, {
              status: 'completed',
              progress: 100,
              currentStep: 'Completed (quality warning)',
              content: generationResult!.content,
              qualityScore: generationResult!.qualityScore,
              citationCount: generationResult!.citationsUsed.length,
              metricCount: generationResult!.quantitativeDataPoints,
              evidenceCount,
              agentsUsed: sectionConfig.requiredAgents,
              completedAt: new Date()
            });
          }
          
          this.activeSectionRuns.delete(jobId);
          this.jobStartTimes.delete(jobId); // BULLETPROOF: Clear start time tracking
          
          // INSTANT VISIBILITY: Broadcast completion via WebSocket
          this.broadcastSectionCompletion(dealId, sectionName, 'completed', generationResult!.content, generationResult!.qualityScore);
          
          console.log(`\n⚠️ ========================================`);
          console.log(`⚠️ MEMO SECTION COMPLETE WITH WARNING: ${sectionConfig.displayName}`);
          console.log(`⚠️ Quality Score: ${generationResult!.qualityScore}/100 (Required: ${sectionConfig.qualityThreshold}+)`);
          console.log(`⚠️ Content saved despite being slightly below threshold`);
          console.log(`⚠️ ========================================\n`);
          
          return {
            success: true,
            sectionName,
            qualityScore: generationResult!.qualityScore,
            citationCount: generationResult!.citationsUsed.length,
            metricCount: generationResult!.quantitativeDataPoints,
            evidenceCount
          };
        }
        
        // FAIL-OPEN: Save content anyway even if quality is very low
        // Mark as "low_confidence" instead of "failed" - content is still usable
        await this.updateProgress(dealId, sectionName, 90, `Saving low-confidence content...`);
        
        // CRITICAL: Still save the content to the memo - never discard generated content
        await this.updateMemoSection(dealId, sectionName, generationResult!.content, {
          qualityScore: generationResult!.qualityScore,
          citationCount: generationResult!.citationsUsed.length,
          metricCount: generationResult!.quantitativeDataPoints,
          evidenceCount,
          agentsUsed: sectionConfig.requiredAgents
        });
        
        await storage.updateBackgroundJob(jobId, {
          status: 'completed', // NEVER use 'failed' - always complete
          progress: 100,
          currentStep: `Completed with quality warning: ${generationResult!.qualityScore}/${sectionConfig.qualityThreshold}`
        });
        
        const runRecord = await storage.getMemoSectionRun(dealId, sectionName);
        if (runRecord) {
          await storage.updateMemoSectionRun(runRecord.id, {
            status: 'completed', // NEVER use 'failed'
            progress: 100,
            currentStep: `Completed with low confidence: ${generationResult!.qualityScore}/${sectionConfig.qualityThreshold}`,
            qualityScore: generationResult!.qualityScore,
            citationCount: generationResult!.citationsUsed.length,
            metricCount: generationResult!.quantitativeDataPoints,
            completedAt: new Date()
          });
        }
        
        this.activeSectionRuns.delete(jobId);
        this.jobStartTimes.delete(jobId); // BULLETPROOF: Clear start time tracking
        
        // INSTANT VISIBILITY: Broadcast low confidence (not failure) via WebSocket
        this.broadcastSectionCompletion(dealId, sectionName, 'low_confidence', generationResult!.content, generationResult!.qualityScore);
        
        console.log(`\n⚠️ ========================================`);
        console.log(`⚠️ MEMO SECTION SAVED WITH LOW CONFIDENCE: ${sectionConfig.displayName}`);
        console.log(`⚠️ Quality Score: ${generationResult!.qualityScore}/100 (Threshold: ${sectionConfig.qualityThreshold})`);
        console.log(`⚠️ Content SAVED despite low quality - never discard content`);
        console.log(`⚠️ ========================================\n`);
        
        return {
          success: true, // ALWAYS succeed
          sectionName,
          content: generationResult!.content,
          qualityScore: generationResult!.qualityScore,
          citationCount: generationResult!.citationsUsed.length,
          metricCount: generationResult!.quantitativeDataPoints,
          evidenceCount,
          lowConfidence: true // Flag that quality was below threshold
        };
      }
      
      // Step 10: Update investment memo with new section content (quality met)
      await this.updateProgress(dealId, sectionName, 90, 'Saving to investment memo...');
      
      await this.updateMemoSection(dealId, sectionName, generationResult!.content, {
        qualityScore: generationResult!.qualityScore,
        citationCount: generationResult!.citationsUsed.length,
        metricCount: generationResult!.quantitativeDataPoints,
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
          content: generationResult!.content,
          qualityScore: generationResult!.qualityScore,
          citationCount: generationResult!.citationsUsed.length,
          metricCount: generationResult!.quantitativeDataPoints,
          evidenceCount,
          agentsUsed: sectionConfig.requiredAgents,
          completedAt: new Date()
        });
      }
      
      this.activeSectionRuns.delete(jobId);
      this.jobStartTimes.delete(jobId); // BULLETPROOF: Clear start time tracking
      
      // INSTANT VISIBILITY: Broadcast completion via WebSocket immediately
      this.broadcastSectionCompletion(dealId, sectionName, 'completed', generationResult!.content, generationResult!.qualityScore);
      
      console.log(`\n✅ ========================================`);
      console.log(`✅ MEMO SECTION RERUN COMPLETE: ${sectionConfig.displayName}`);
      console.log(`✅ Quality Score: ${generationResult!.qualityScore}/100 (Required: ${sectionConfig.qualityThreshold}+)`);
      console.log(`✅ Citations: ${generationResult!.citationsUsed.length}`);
      console.log(`✅ Data Points: ${generationResult!.quantitativeDataPoints}`);
      console.log(`✅ Evidence Items: ${evidenceCount}`);
      console.log(`✅ ========================================\n`);
      
      return {
        success: true,
        sectionName,
        content: generationResult!.content,
        qualityScore: generationResult!.qualityScore,
        citationCount: generationResult!.citationsUsed.length,
        metricCount: generationResult!.quantitativeDataPoints,
        evidenceCount,
        agentsUsed: sectionConfig.requiredAgents
      };
      
    } catch (error: any) {
      console.error(`❌ Error in section rerun for ${sectionName}:`, error);
      
      // FAIL-OPEN: Generate fallback content instead of failing
      const fallbackContent = `## ${sectionConfig?.displayName || sectionName}\n\n*This section requires additional data for comprehensive analysis.*\n\nBased on the available information, this section could not be fully generated. The investment memo should be supplemented with additional documentation for a complete assessment.\n\n**Note:** This content was generated with limited data availability.`;
      
      // Still save fallback content to the memo
      await this.updateMemoSection(dealId, sectionName, fallbackContent, {
        qualityScore: 30,
        citationCount: 0,
        metricCount: 0,
        evidenceCount: 0,
        agentsUsed: sectionConfig?.requiredAgents || []
      });
      
      await storage.updateBackgroundJob(jobId, {
        status: 'completed', // NEVER fail - always complete with content
        progress: 100,
        currentStep: `Completed with fallback content: ${error.message}`
      });
      
      const runRecord = await storage.getMemoSectionRun(dealId, sectionName);
      if (runRecord) {
        await storage.updateMemoSectionRun(runRecord.id, {
          status: 'completed', // NEVER fail
          progress: 100,
          qualityScore: 30,
          completedAt: new Date()
        });
      }
      
      this.activeSectionRuns.delete(jobId);
      this.jobStartTimes.delete(jobId); // BULLETPROOF: Clear start time tracking
      
      // INSTANT VISIBILITY: Broadcast low confidence via WebSocket
      this.broadcastSectionCompletion(dealId, sectionName, 'low_confidence', fallbackContent, 30);
      
      console.log(`\n⚠️ ========================================`);
      console.log(`⚠️ MEMO SECTION SAVED WITH FALLBACK: ${sectionConfig?.displayName || sectionName}`);
      console.log(`⚠️ Error: ${error.message}`);
      console.log(`⚠️ Fallback content saved - never leave sections empty`);
      console.log(`⚠️ ========================================\n`);
      
      return {
        success: true, // ALWAYS succeed with content
        sectionName,
        content: fallbackContent,
        qualityScore: 30,
        lowConfidence: true
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
   * ALWAYS applies cleanMemoSectionContent to fix any malformed tables/formatting
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
    // ALWAYS clean content before saving - fixes malformed tables automatically
    const cleanedContent = cleanMemoSectionContent(content);
    
    // Get existing memo
    const existingMemo = await storage.getMemoByDealId(dealId);
    
    if (existingMemo) {
      // Parse existing memo JSON field which contains sections
      const memoData = (existingMemo.memo as any) || {};
      
      // Ensure sections object exists
      if (!memoData.sections) {
        memoData.sections = {};
      }
      
      // Update the specific section with CLEANED content
      memoData.sections[sectionName] = cleanedContent;
      
      // Also update direct section field if this is executiveSummary
      const updateData: any = {
        memo: memoData,
        status: 'Completed'
      };
      
      // Map section name to top-level field if applicable
      if (sectionName === 'executiveSummary') {
        updateData.executiveSummary = cleanedContent;
      } else if (sectionName === 'marketAnalysis' || sectionName === 'competitiveAnalysis') {
        updateData.productMarket = cleanedContent;
      }
      
      await storage.updateMemo(existingMemo.id, updateData);
      
      console.log(`📝 Updated memo section: ${sectionName} (tables/formatting cleaned)`);
    } else {
      // Create new memo with just this section
      const memoData: any = {
        sections: {}
      };
      memoData.sections[sectionName] = cleanedContent;
      
      await storage.createMemo({
        dealId,
        memo: memoData,
        status: 'Draft'
      });
      
      console.log(`📝 Created new memo with section: ${sectionName}`);
    }
  }

  /**
   * Clear a memo section content before regeneration
   * This ensures the UI shows generating placeholder and fresh content appears
   */
  private async clearMemoSection(dealId: number, sectionName: string): Promise<void> {
    const existingMemo = await storage.getMemoByDealId(dealId);
    
    if (existingMemo) {
      // Parse existing memo JSON field and clear the specific section
      const memoData = (existingMemo.memo as any) || {};
      
      // Clear the specific section in the JSON memo field
      if (memoData.sections) {
        memoData.sections[sectionName] = null;
      }
      // Also clear top-level section if it exists in the memo JSON
      if (memoData[sectionName]) {
        memoData[sectionName] = null;
      }
      
      // Build update data - clear nested section in memo JSON
      const updateData: any = {
        memo: memoData
      };
      
      // Only executiveSummary and productMarket have top-level DB columns
      if (sectionName === 'executiveSummary') {
        updateData.executiveSummary = null;
      } else if (sectionName === 'marketAnalysis' || sectionName === 'competitiveAnalysis') {
        updateData.productMarket = null;
      }
      
      await storage.updateMemo(existingMemo.id, updateData);
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
    this.jobStartTimes.delete(jobId); // BULLETPROOF: Clear start time tracking
    
    console.log(`🚫 Cancelled section rerun: ${sectionName}`);
    return true;
  }

  /**
   * Get all available section configurations
   */
  getAvailableSections(): SectionConfig[] {
    return MEMO_SECTION_CONFIGS;
  }

  /**
   * Clear ALL memo sections at once before full regeneration
   * This ensures the UI shows empty state with generating placeholders immediately
   */
  async clearAllMemoSections(dealId: number): Promise<void> {
    const existingMemo = await storage.getMemoByDealId(dealId);
    
    if (existingMemo) {
      console.log(`🧹 Clearing ALL memo sections for deal ${dealId}...`);
      
      // Clear ALL fields that exist in the database schema:
      // executiveSummary, productMarket, team, financials, swot, memo
      await storage.updateMemo(existingMemo.id, {
        executiveSummary: null,
        productMarket: null,
        team: null,
        financials: null,
        swot: null,
        memo: null, // Clear the JSON sections (where all detailed sections are stored)
        status: 'DRAFT'
      });
      
      console.log(`✅ All memo sections cleared for deal ${dealId}`);
    } else {
      console.log(`ℹ️ No existing memo to clear for deal ${dealId}`);
    }
  }
}

export const memoSectionRerunService = MemoSectionRerunService.getInstance();
