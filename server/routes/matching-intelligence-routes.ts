import { Router, Request, Response } from 'express';
import { matchingIntelligenceService } from '../services/matching-intelligence';
import { db } from '../db';
import { organizations, dealOrganizationMatches, dailySyncJobs } from '@shared/schema';
import { eq, desc, count, and, gte, like } from 'drizzle-orm';

const router = Router();

// Sync all organizations from Affinity (8,000+ organizations)
router.post('/sync-organizations', async (req: Request, res: Response) => {
  try {
    console.log('🔄 Starting organization sync...');
    
    const result = await matchingIntelligenceService.syncAllOrganizations();
    
    if (result.success) {
      res.json({
        success: true,
        message: `Successfully synced ${result.organizations} organizations (${result.newOrganizations} new)`,
        data: {
          totalOrganizations: result.organizations,
          newOrganizations: result.newOrganizations,
          errors: result.errors
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Organization sync failed',
        errors: result.errors
      });
    }
  } catch (error) {
    console.error('❌ Organization sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync organizations',
      error: error.message
    });
  }
});

// Get all organizations with pagination and filters
router.get('/organizations', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string;
    const industry = req.query.industry as string;
    const location = req.query.location as string;
    const minEmployees = req.query.minEmployees ? parseInt(req.query.minEmployees as string) : undefined;
    const maxEmployees = req.query.maxEmployees ? parseInt(req.query.maxEmployees as string) : undefined;
    
    const offset = (page - 1) * limit;
    
    // Build query conditions
    const conditions = [];
    
    if (search) {
      conditions.push(like(organizations.name, `%${search}%`));
    }
    
    if (industry) {
      conditions.push(like(organizations.industry, `%${industry}%`));
    }
    
    if (location) {
      conditions.push(like(organizations.location, `%${location}%`));
    }
    
    if (minEmployees) {
      conditions.push(gte(organizations.employeeCount, minEmployees));
    }
    
    if (maxEmployees) {
      conditions.push(gte(organizations.employeeCount, maxEmployees));
    }
    
    // Get total count
    const [totalCount] = await db
      .select({ count: count() })
      .from(organizations)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    // Get organizations with pagination
    const organizationList = await db
      .select()
      .from(organizations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(organizations.updatedAt))
      .limit(limit)
      .offset(offset);
    
    res.json({
      success: true,
      data: {
        organizations: organizationList,
        pagination: {
          page,
          limit,
          total: totalCount.count,
          totalPages: Math.ceil(totalCount.count / limit)
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching organizations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organizations',
      error: error.message
    });
  }
});

// Generate intelligent matches for a deal
router.post('/generate-matches/:dealId', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    
    console.log(`🤖 Generating intelligent matches for deal ${dealId}...`);
    
    const matches = await matchingIntelligenceService.generateIntelligentMatches(dealId);
    
    res.json({
      success: true,
      message: `Generated ${matches.length} intelligent matches`,
      data: {
        matches: matches.length,
        topMatches: matches.slice(0, 10) // Return top 10 matches
      }
    });
  } catch (error) {
    console.error('❌ Error generating matches:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate matches',
      error: error.message
    });
  }
});

// Get intelligent matches for a deal
router.get('/matches/:dealId', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const minScore = parseInt(req.query.minScore as string) || 0;
    
    const offset = (page - 1) * limit;
    
    console.log(`📊 Fetching intelligent matches for deal ${dealId}...`);
    
    const matches = await db
      .select({
        organization: organizations,
        match: dealOrganizationMatches
      })
      .from(dealOrganizationMatches)
      .innerJoin(organizations, eq(dealOrganizationMatches.organizationId, organizations.id))
      .where(and(
        eq(dealOrganizationMatches.dealId, dealId),
        gte(dealOrganizationMatches.matchScore, minScore)
      ))
      .orderBy(desc(dealOrganizationMatches.matchScore))
      .limit(limit)
      .offset(offset);
    
    const formattedMatches = matches.map(({ organization, match }) => ({
      ...organization,
      matchScore: match.matchScore,
      matchReasons: match.matchReasons,
      matchDetails: match.matchDetails,
      probabilityScore: match.probabilityScore,
      aiGeneratedPitch: match.aiGeneratedPitch,
      expectedInvestment: match.expectedInvestment,
      status: match.status
    }));
    
    // Get analytics
    const [totalMatches] = await db
      .select({ count: count() })
      .from(dealOrganizationMatches)
      .where(eq(dealOrganizationMatches.dealId, dealId));
    
    const avgScore = matches.length > 0 
      ? matches.reduce((sum, m) => sum + m.match.matchScore, 0) / matches.length 
      : 0;
    
    res.json({
      success: true,
      data: {
        matches: formattedMatches,
        analytics: {
          totalMatches: totalMatches.count,
          avgMatchScore: Math.round(avgScore),
          highProbabilityMatches: matches.filter(m => m.match.probabilityScore >= 70).length,
          contactedMatches: matches.filter(m => m.match.status === 'contacted').length
        },
        pagination: {
          page,
          limit,
          total: totalMatches.count,
          totalPages: Math.ceil(totalMatches.count / limit)
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching matches:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch matches',
      error: error.message
    });
  }
});

// Update match status
router.patch('/matches/:matchId/status', async (req: Request, res: Response) => {
  try {
    const matchId = parseInt(req.params.matchId);
    const { status, notes } = req.body;
    
    await db.update(dealOrganizationMatches)
      .set({
        status,
        notes,
        contactAttempts: status === 'contacted' ? 1 : undefined,
        lastContactAt: status === 'contacted' ? new Date() : undefined,
        updatedAt: new Date()
      })
      .where(eq(dealOrganizationMatches.id, matchId));
    
    res.json({
      success: true,
      message: 'Match status updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating match status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update match status',
      error: error.message
    });
  }
});

// Get sync job status
router.get('/sync-jobs', async (req: Request, res: Response) => {
  try {
    const jobs = await db
      .select()
      .from(dailySyncJobs)
      .orderBy(desc(dailySyncJobs.createdAt))
      .limit(10);
    
    res.json({
      success: true,
      data: {
        jobs,
        latestJob: jobs[0] || null
      }
    });
  } catch (error) {
    console.error('❌ Error fetching sync jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sync jobs',
      error: error.message
    });
  }
});

// Get matching intelligence dashboard stats
router.get('/dashboard-stats', async (req: Request, res: Response) => {
  try {
    // Get total organizations
    const [totalOrgs] = await db
      .select({ count: count() })
      .from(organizations);
    
    // Get total matches
    const [totalMatches] = await db
      .select({ count: count() })
      .from(dealOrganizationMatches);
    
    // Get high-probability matches
    const [highProbMatches] = await db
      .select({ count: count() })
      .from(dealOrganizationMatches)
      .where(gte(dealOrganizationMatches.probabilityScore, 70));
    
    // Get contacted matches
    const [contactedMatches] = await db
      .select({ count: count() })
      .from(dealOrganizationMatches)
      .where(eq(dealOrganizationMatches.status, 'contacted'));
    
    // Get latest sync job
    const [latestSync] = await db
      .select()
      .from(dailySyncJobs)
      .where(eq(dailySyncJobs.jobType, 'organization_sync'))
      .orderBy(desc(dailySyncJobs.createdAt))
      .limit(1);
    
    res.json({
      success: true,
      data: {
        totalOrganizations: totalOrgs.count,
        totalMatches: totalMatches.count,
        highProbabilityMatches: highProbMatches.count,
        contactedMatches: contactedMatches.count,
        lastSync: latestSync ? {
          date: latestSync.completedAt || latestSync.startedAt,
          status: latestSync.status,
          organizationsProcessed: latestSync.organizationsProcessed
        } : null
      }
    });
  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats',
      error: error.message
    });
  }
});

// Schedule daily automated sync
router.post('/schedule-daily-sync', async (req: Request, res: Response) => {
  try {
    await matchingIntelligenceService.scheduleDailySync();
    
    res.json({
      success: true,
      message: 'Daily sync scheduled successfully'
    });
  } catch (error) {
    console.error('❌ Error scheduling daily sync:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to schedule daily sync',
      error: error.message
    });
  }
});

export default router;