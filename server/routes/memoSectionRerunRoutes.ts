/**
 * Memo Section Rerun Routes
 * 
 * API endpoints for per-section memo regeneration with Force Rerun buttons.
 * Follows the same architecture as agent Force Rerun routes.
 */

import { Router } from 'express';
import { memoSectionRerunService } from '../services/memoSectionRerunService';
import { MEMO_SECTION_CONFIGS } from '../services/memoSectionConfig';

export const memoSectionRerunRoutes = Router();

/**
 * Get all available memo sections with their configurations
 */
memoSectionRerunRoutes.get('/api/memo/sections', async (req, res) => {
  try {
    const sections = MEMO_SECTION_CONFIGS.map(config => ({
      sectionName: config.sectionName,
      displayName: config.displayName,
      requiredAgents: config.requiredAgents,
      qualityThreshold: config.qualityThreshold,
      description: config.description,
      orderIndex: config.orderIndex,
      isRequired: config.isRequired
    }));
    
    res.json({
      success: true,
      sections
    });
  } catch (error: any) {
    console.error('Error getting memo sections:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get status of all section reruns for a deal
 */
memoSectionRerunRoutes.get('/api/deals/:dealId/memo/sections/status', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid deal ID'
      });
    }
    
    const statuses = await memoSectionRerunService.getAllSectionRerunStatuses(dealId);
    
    res.json({
      success: true,
      dealId,
      sections: statuses
    });
  } catch (error: any) {
    console.error('Error getting section rerun statuses:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get status of a specific section rerun
 */
memoSectionRerunRoutes.get('/api/deals/:dealId/memo/sections/:sectionName/status', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const { sectionName } = req.params;
    
    if (isNaN(dealId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid deal ID'
      });
    }
    
    const status = await memoSectionRerunService.getSectionRerunStatus(dealId, sectionName);
    
    if (!status) {
      return res.json({
        success: true,
        dealId,
        sectionName,
        status: null,
        message: 'No rerun found for this section'
      });
    }
    
    res.json({
      success: true,
      dealId,
      sectionName,
      ...status
    });
  } catch (error: any) {
    console.error(`Error getting section rerun status for ${req.params.sectionName}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Force rerun a specific memo section
 * This is the main endpoint for per-section regeneration
 */
memoSectionRerunRoutes.post('/api/deals/:dealId/memo/sections/:sectionName/force-rerun', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const { sectionName } = req.params;
    
    if (isNaN(dealId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid deal ID'
      });
    }
    
    // Validate section name
    const validSections = MEMO_SECTION_CONFIGS.map(c => c.sectionName);
    if (!validSections.includes(sectionName)) {
      return res.status(400).json({
        success: false,
        error: `Invalid section name: ${sectionName}. Valid sections: ${validSections.join(', ')}`
      });
    }
    
    console.log(`\n🚀 [API] Force rerun requested for section: ${sectionName}, deal: ${dealId}`);
    
    // Respond immediately that the job has started
    res.json({
      success: true,
      message: `Force rerun started for ${sectionName}`,
      dealId,
      sectionName,
      status: 'processing'
    });
    
    // Run the section rerun asynchronously
    memoSectionRerunService.forceRerunSection(dealId, sectionName)
      .then(result => {
        if (result.success) {
          console.log(`✅ [API] Section rerun completed: ${sectionName} - Quality: ${result.qualityScore}`);
        } else {
          console.error(`❌ [API] Section rerun failed: ${sectionName} - ${result.error}`);
        }
      })
      .catch(error => {
        console.error(`❌ [API] Section rerun error: ${sectionName}`, error);
      });
      
  } catch (error: any) {
    console.error(`Error starting section rerun for ${req.params.sectionName}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Cancel a running section rerun
 */
memoSectionRerunRoutes.post('/api/deals/:dealId/memo/sections/:sectionName/cancel', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const { sectionName } = req.params;
    
    if (isNaN(dealId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid deal ID'
      });
    }
    
    const cancelled = await memoSectionRerunService.cancelSectionRerun(dealId, sectionName);
    
    res.json({
      success: cancelled,
      message: cancelled ? `Cancelled ${sectionName} rerun` : 'No active rerun to cancel',
      dealId,
      sectionName
    });
  } catch (error: any) {
    console.error(`Error cancelling section rerun for ${req.params.sectionName}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Force rerun all sections sequentially
 * This is a convenience endpoint to regenerate the entire memo section by section
 */
memoSectionRerunRoutes.post('/api/deals/:dealId/memo/force-rerun-all-sections', async (req, res) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid deal ID'
      });
    }
    
    console.log(`\n🚀 [API] Force rerun ALL sections requested for deal: ${dealId}`);
    
    // Respond immediately
    res.json({
      success: true,
      message: 'Force rerun started for all sections',
      dealId,
      totalSections: MEMO_SECTION_CONFIGS.length
    });
    
    // Run sections sequentially in background
    (async () => {
      for (const config of MEMO_SECTION_CONFIGS.sort((a, b) => a.orderIndex - b.orderIndex)) {
        try {
          console.log(`\n📝 Starting section: ${config.sectionName}`);
          const result = await memoSectionRerunService.forceRerunSection(dealId, config.sectionName);
          
          if (result.success) {
            console.log(`✅ Section complete: ${config.sectionName} - Quality: ${result.qualityScore}`);
          } else {
            console.error(`❌ Section failed: ${config.sectionName} - ${result.error}`);
          }
          
          // Brief pause between sections
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error: any) {
          console.error(`❌ Error in section ${config.sectionName}:`, error);
        }
      }
      console.log(`\n🎉 All sections complete for deal ${dealId}`);
    })();
    
  } catch (error: any) {
    console.error('Error starting all sections rerun:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
