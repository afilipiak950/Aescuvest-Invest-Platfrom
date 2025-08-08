import { Router, Request, Response } from 'express';
import { jobRecoveryService } from '../services/jobRecoveryService';

const router = Router();

// Get job recovery statistics
router.get('/api/job-recovery/stats', async (req: Request, res: Response) => {
  try {
    const stats = await jobRecoveryService.getRecoveryStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching recovery stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch recovery stats' });
  }
});

// Manually trigger stuck job check
router.post('/api/job-recovery/check', async (req: Request, res: Response) => {
  try {
    await jobRecoveryService.checkForStuckJobs();
    res.json({ success: true, message: 'Stuck job check completed' });
  } catch (error) {
    console.error('Error in manual stuck job check:', error);
    res.status(500).json({ success: false, error: 'Failed to check for stuck jobs' });
  }
});

export default router;