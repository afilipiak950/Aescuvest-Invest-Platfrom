import { Request, Response } from 'express';
import { comprehensiveAnalysisEngine } from '../services/comprehensiveAnalysisEngine';

/**
 * GET COMPLETION REPORT - Generate comprehensive final verification report
 */
export const getCompletionReport = async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    if (isNaN(dealId)) {
      return res.status(400).json({ error: 'Invalid deal ID' });
    }
    
    const report = await comprehensiveAnalysisEngine.getCompletionReport(dealId);
    
    res.json({
      success: true,
      dealId,
      timestamp: new Date().toISOString(),
      ...report
    });
    
  } catch (error) {
    console.error('Failed to generate completion report:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to generate completion report' 
    });
  }
};