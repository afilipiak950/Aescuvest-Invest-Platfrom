import { Router, Request, Response } from 'express';
import { persistentJobManager } from '../services/persistentJobManager';
import { db } from '../db';
import { agentAnalyses, backgroundJobs, documents } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

/**
 * Comprehensive Analysis - Full reset and fresh start with proper progress tracking
 * This endpoint provides the "Comprehensive Analysis" button functionality
 */
router.post('/api/deals/:dealId/comprehensive-analysis', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    console.log(`🚀 COMPREHENSIVE ANALYSIS - Starting fresh analysis run for deal ${dealId}`);
    
    // Step 1: Clear all previous analysis data (like legacy reset)
    console.log(`🗑️ Clearing previous analysis data...`);
    
    // Delete all agent analyses for this deal
    await db.delete(agentAnalyses)
      .where(eq(agentAnalyses.dealId, dealId));
    
    // Delete all background jobs for this deal
    await db.delete(backgroundJobs)
      .where(eq(backgroundJobs.dealId, dealId));
    
    // Clear in-memory active jobs
    if (global.activeJobs) {
      const keysToDelete = [];
      for (const [key, job] of global.activeJobs.entries()) {
        if (job.dealId === dealId) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => global.activeJobs.delete(key));
    }
    
    // Step 2: Get document counts for proper progress calculation
    const allDocs = await db.select().from(documents)
      .where(eq(documents.dealId, dealId));
    
    const docsByAgent = {
      Clinical: allDocs.filter(doc => doc.assignedAgents?.includes('Clinical') || 
                              doc.category === 'clinical' || 
                              doc.documentType === 'clinical').length,
      Legal: allDocs.filter(doc => doc.assignedAgents?.includes('Legal') || 
                           doc.category === 'legal' || 
                           doc.documentType === 'legal').length,
      Commercial: allDocs.filter(doc => doc.assignedAgents?.includes('Commercial') || 
                                doc.category === 'commercial' || 
                                doc.documentType === 'commercial').length,
      HR: allDocs.filter(doc => doc.assignedAgents?.includes('HR') || 
                        doc.category === 'hr' || 
                        doc.documentType === 'hr').length,
      Financial: allDocs.filter(doc => doc.assignedAgents?.includes('Financial') || 
                               doc.category === 'financial' || 
                               doc.documentType === 'financial').length,
      IP: allDocs.filter(doc => doc.assignedAgents?.includes('IP') || 
                        doc.category === 'ip' || 
                        doc.documentType === 'ip').length,
      Research: allDocs.filter(doc => doc.assignedAgents?.includes('Research') || 
                              doc.category === 'research' || 
                              doc.documentType === 'research').length
    };
    
    console.log(`📊 Document distribution:`, docsByAgent);
    
    // Step 3: Generate new run ID for this comprehensive analysis
    const runId = `comprehensive_${dealId}_${Date.now()}`;
    console.log(`🆔 Generated run ID: ${runId}`);
    
    // Step 4: Start all 7 agents with proper progress tracking
    const agentTypes = ['Clinical', 'Legal', 'Commercial', 'HR', 'Financial', 'IP', 'Research'];
    const startedJobs = [];
    
    // Predefined questions per agent (for total job calculation)
    const questionCounts = {
      Clinical: 15,    // Based on typical clinical due diligence
      Legal: 20,       // Based on typical legal due diligence
      Commercial: 12,  // Based on typical commercial due diligence
      HR: 10,          // Based on typical HR due diligence
      Financial: 18,   // Based on typical financial due diligence
      IP: 8,           // Based on typical IP due diligence
      Research: 6      // Based on typical research due diligence
    };
    
    for (const agentType of agentTypes) {
      try {
        const assignedDocs = docsByAgent[agentType] || 0;
        const questions = questionCounts[agentType] || 10;
        const totalJobs = Math.max(assignedDocs * questions, 1); // At least 1 job
        
        // Get analysis service
        const analysisService = getAnalysisServiceForAgent(agentType);
        
        // Create background job with proper totals
        const jobId = `${agentType.toLowerCase()}_comprehensive_${dealId}_${Date.now()}`;
        
        const { storage } = await import('../storage');
        await storage.createBackgroundJob({
          jobId,
          jobType: `comprehensive_${agentType.toLowerCase()}_analysis`,
          dealId,
          agentType,
          status: 'processing',
          progress: 0,
          currentStep: `Initializing ${agentType} comprehensive analysis`,
          totalDocuments: totalJobs,
          processedDocuments: 0,
          currentDocumentName: 'Starting analysis...'
        });
        
        // Start the analysis in background with progress tracking
        setImmediate(async () => {
          try {
            const progressCallback = async (progress: number, step: string, currentDoc?: string) => {
              const processedDocs = Math.floor((progress / 100) * totalJobs);
              
              await storage.updateBackgroundJob(jobId, {
                progress: Math.min(progress, 100),
                currentStep: step,
                processedDocuments: processedDocs,
                currentDocumentName: currentDoc || step,
                updatedAt: new Date()
              });
              
              console.log(`📈 ${agentType} Progress: ${progress}% - ${step}`);
            };
            
            // Run comprehensive analysis
            await analysisService.runComprehensiveAnalysis(dealId, storage, jobId, progressCallback);
            
            // Mark as completed
            await storage.updateBackgroundJob(jobId, {
              status: 'completed',
              progress: 100,
              completedAt: new Date(),
              currentStep: `${agentType} comprehensive analysis completed`,
              processedDocuments: totalJobs
            });
            
            console.log(`✅ ${agentType} comprehensive analysis completed`);
            
          } catch (error) {
            console.error(`❌ ${agentType} analysis failed:`, error);
            await storage.updateBackgroundJob(jobId, {
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
              currentStep: `${agentType} analysis failed`
            });
          }
        });
        
        startedJobs.push({
          agentType,
          jobId,
          assignedDocuments: assignedDocs,
          questions: questions,
          totalJobs: totalJobs,
          status: 'started'
        });
        
        console.log(`✅ Started ${agentType} analysis: ${totalJobs} total jobs`);
        
      } catch (error) {
        console.error(`❌ Failed to start ${agentType} analysis:`, error);
        startedJobs.push({
          agentType,
          jobId: null,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    console.log(`🎯 COMPREHENSIVE ANALYSIS STARTED`);
    console.log(`   - Run ID: ${runId}`);
    console.log(`   - Total agents: 7`);
    console.log(`   - Started successfully: ${startedJobs.filter(j => j.status === 'started').length}`);
    console.log(`   - Failed to start: ${startedJobs.filter(j => j.status === 'failed').length}`);
    
    res.json({
      success: true,
      message: `Comprehensive analysis started for deal ${dealId}`,
      runId,
      startedJobs,
      summary: {
        totalAgents: 7,
        startedSuccessfully: startedJobs.filter(j => j.status === 'started').length,
        failedToStart: startedJobs.filter(j => j.status === 'failed').length,
        totalExpectedJobs: startedJobs.reduce((sum, job) => sum + (job.totalJobs || 0), 0)
      }
    });
    
  } catch (error) {
    console.error(`❌ Comprehensive analysis failed for deal ${req.params.dealId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Comprehensive analysis failed',
      details: error.message
    });
  }
});

/**
 * Get analysis service for specific agent type
 */
function getAnalysisServiceForAgent(agentType: string): any {
  switch (agentType.toLowerCase()) {
    case 'legal':
      const { comprehensiveLegalAnalysisService } = require('../comprehensiveLegalAnalysisService');
      return comprehensiveLegalAnalysisService;
      
    case 'clinical':
      const { comprehensiveClinicalAnalysisService } = require('../comprehensiveClinicalAnalysisService');
      return comprehensiveClinicalAnalysisService;
      
    case 'commercial':
      const { comprehensiveCommercialAnalysisService } = require('../comprehensiveCommercialAnalysisService');
      return comprehensiveCommercialAnalysisService;
      
    case 'hr':
      const { comprehensiveHrAnalysisService } = require('../comprehensiveHrAnalysisService');
      return comprehensiveHrAnalysisService;
      
    case 'financial':
      const { comprehensiveFinancialAnalysisService } = require('../comprehensiveFinancialAnalysisService');
      return comprehensiveFinancialAnalysisService;
      
    case 'ip':
      const { comprehensiveIpAnalysisService } = require('../comprehensiveIpAnalysisService');
      return comprehensiveIpAnalysisService;
      
    case 'research':
      const { comprehensiveResearchAnalysisService } = require('../comprehensiveResearchAnalysisService');
      return comprehensiveResearchAnalysisService;
      
    default:
      // Return generic service for fallback
      return createGenericAnalysisService(agentType);
  }
}

/**
 * Create a generic analysis service for agent types without specific implementations
 */
function createGenericAnalysisService(agentType: string): any {
  return {
    runComprehensiveAnalysis: async (
      dealId: number, 
      storage: any, 
      jobId: string, 
      progressCallback: Function
    ) => {
      console.log(`🔄 Running ${agentType} analysis with generic service`);
      
      const steps = [
        'Initializing analysis',
        'Processing documents',
        'Analyzing content',
        'Generating insights',
        'Finalizing results'
      ];
      
      for (let i = 0; i < steps.length; i++) {
        const progress = Math.floor(((i + 1) / steps.length) * 100);
        await progressCallback(progress, steps[i]);
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
      }
      
      console.log(`✅ ${agentType} generic analysis completed`);
    }
  };
}

export default router;