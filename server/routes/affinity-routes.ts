import { Express, Request, Response } from 'express';
import { createAffinityService } from '../services/affinity-service';
import { db } from '../db';
import { systemSettings } from '../../shared/schema';
import { eq } from 'drizzle-orm';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    email: string;
    role: string;
  };
}

// Middleware to check if user is authenticated (assuming it exists)
function authenticate(req: AuthenticatedRequest, res: Response, next: any) {
  // This assumes you have authentication middleware already set up
  // For now, we'll just check if user exists in session
  if (req.session && (req.session as any).user) {
    req.user = (req.session as any).user;
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
}

export function registerAffinityRoutes(app: Express) {
  // Helper function to get Affinity API key from system settings
  async function getAffinityApiKey(): Promise<string | null> {
    try {
      const setting = await db.query.systemSettings.findFirst({
        where: eq(systemSettings.key, 'affinity_api_key')
      });
      return setting?.value || null;
    } catch (error) {
      console.error('Error fetching Affinity API key:', error);
      return null;
    }
  }

  // Helper function to create Affinity service instance
  async function createAffinityServiceInstance(): Promise<any> {
    const apiKey = await getAffinityApiKey();
    if (!apiKey) {
      throw new Error('Affinity API key not configured');
    }
    return createAffinityService(apiKey);
  }

  // Test Affinity connection
  app.get('/api/affinity/test-connection', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const affinityService = await createAffinityServiceInstance();
      const result = await affinityService.testConnection();
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Set or update Affinity API key
  app.post('/api/affinity/configure', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { apiKey } = req.body;
      
      if (!apiKey) {
        return res.status(400).json({ error: 'API key is required' });
      }

      // Test the API key first
      const affinityService = createAffinityService(apiKey);
      const testResult = await affinityService.testConnection();
      
      if (!testResult.success) {
        return res.status(400).json({ 
          error: 'Invalid API key', 
          details: testResult.error 
        });
      }

      // Save the API key to system settings
      const existingSetting = await db.query.systemSettings.findFirst({
        where: eq(systemSettings.key, 'affinity_api_key')
      });

      if (existingSetting) {
        await db.update(systemSettings)
          .set({ value: apiKey, updatedAt: new Date() })
          .where(eq(systemSettings.id, existingSetting.id));
      } else {
        await db.insert(systemSettings).values({
          key: 'affinity_api_key',
          value: apiKey,
          description: 'Affinity CRM API key for investor synchronization'
        });
      }

      res.json({ 
        success: true, 
        message: 'Affinity API key configured successfully',
        user: testResult.user 
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Configuration failed' 
      });
    }
  });

  // Get Affinity configuration status
  app.get('/api/affinity/status', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const apiKey = await getAffinityApiKey();
      
      if (!apiKey) {
        return res.json({ 
          configured: false, 
          connected: false,
          message: 'Affinity API key not configured' 
        });
      }

      const affinityService = createAffinityService(apiKey);
      const testResult = await affinityService.testConnection();
      
      res.json({
        configured: true,
        connected: testResult.success,
        user: testResult.user,
        error: testResult.error
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Status check failed' 
      });
    }
  });

  // Sync all investors from Affinity
  app.post('/api/affinity/sync-investors', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const affinityService = await createAffinityServiceInstance();
      const metrics = await affinityService.syncAllInvestors();
      
      res.json({
        success: true,
        metrics
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Sync failed' 
      });
    }
  });

  // Search investors in Affinity
  app.get('/api/affinity/search-investors', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { term } = req.query;
      
      if (!term || typeof term !== 'string') {
        return res.status(400).json({ error: 'Search term is required' });
      }

      const affinityService = await createAffinityServiceInstance();
      const results = await affinityService.searchInvestors(term);
      
      res.json({
        success: true,
        results
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Search failed' 
      });
    }
  });

  // Get investor details from Affinity
  app.get('/api/affinity/investors/:affinityId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { affinityId } = req.params;
      
      const affinityService = await createAffinityServiceInstance();
      const investor = await affinityService.getInvestorDetails(affinityId);
      
      if (!investor) {
        return res.status(404).json({ error: 'Investor not found in Affinity' });
      }

      res.json({
        success: true,
        investor
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get investor details' 
      });
    }
  });

  // Sync specific investor by Affinity ID
  app.post('/api/affinity/sync-investor/:affinityId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { affinityId } = req.params;
      
      const affinityService = await createAffinityServiceInstance();
      const success = await affinityService.syncInvestorById(affinityId);
      
      if (!success) {
        return res.status(404).json({ error: 'Investor not found or sync failed' });
      }

      res.json({
        success: true,
        message: 'Investor synced successfully'
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Sync failed' 
      });
    }
  });

  // Get all Affinity lists
  app.get('/api/affinity/lists', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const affinityService = await createAffinityServiceInstance();
      const lists = await affinityService.getLists();
      
      res.json({
        success: true,
        lists: lists || []
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get lists',
        lists: []
      });
    }
  });

  // Get list entries for a specific list
  app.get('/api/affinity/lists/:listId/entries', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { listId } = req.params;
      const { cursor, limit } = req.query;
      
      const affinityService = await createAffinityServiceInstance();
      const result = await affinityService.getListEntries(listId, {
        cursor: cursor as string,
        limit: limit ? parseInt(limit as string) : undefined
      });
      
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get list entries' 
      });
    }
  });

  // Get all persons from Affinity
  app.get('/api/affinity/persons', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { cursor, limit, term } = req.query;
      
      const affinityService = await createAffinityServiceInstance();
      const result = await affinityService.getPersons({
        cursor: cursor as string,
        limit: limit ? parseInt(limit as string) : undefined,
        term: term as string,
        with_interaction_dates: true
      });
      
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get persons' 
      });
    }
  });

  // Get all companies from Affinity
  app.get('/api/affinity/companies', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { cursor, limit, term } = req.query;
      
      const affinityService = await createAffinityServiceInstance();
      const result = await affinityService.getCompanies({
        cursor: cursor as string,
        limit: limit ? parseInt(limit as string) : undefined,
        term: term as string,
        with_interaction_dates: true
      });
      
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get companies' 
      });
    }
  });

  // Get opportunities from Affinity
  app.get('/api/affinity/opportunities', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { cursor, limit, term, list_id } = req.query;
      
      const affinityService = await createAffinityServiceInstance();
      const result = await affinityService.getOpportunities({
        cursor: cursor as string,
        limit: limit ? parseInt(limit as string) : undefined,
        term: term as string,
        list_id: list_id as string
      });
      
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get opportunities' 
      });
    }
  });

  // Get field values for a list entry
  app.get('/api/affinity/lists/:listId/entries/:entryId/fields', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { listId, entryId } = req.params;
      
      const affinityService = await createAffinityServiceInstance();
      const fieldValues = await affinityService.getFieldValues(listId, entryId);
      
      res.json({
        success: true,
        field_values: fieldValues
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get field values' 
      });
    }
  });

  // Update field values for a list entry
  app.patch('/api/affinity/lists/:listId/entries/:entryId/fields', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { listId, entryId } = req.params;
      const { field_values } = req.body;
      
      if (!field_values || !Array.isArray(field_values)) {
        return res.status(400).json({ error: 'field_values array is required' });
      }

      const affinityService = await createAffinityServiceInstance();
      await affinityService.updateFieldValues(listId, entryId, field_values);
      
      res.json({
        success: true,
        message: 'Field values updated successfully'
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to update field values' 
      });
    }
  });

  // Get sync metrics and statistics
  app.get('/api/affinity/sync-metrics', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Get sync statistics from database
      const [
        totalInvestors,
        syncedInvestors,
        pendingInvestors,
        errorInvestors
      ] = await Promise.all([
        db.query.investors.findMany(),
        db.query.investors.findMany({
          where: eq(investors.syncStatus, 'synced')
        }),
        db.query.investors.findMany({
          where: eq(investors.syncStatus, 'pending')
        }),
        db.query.investors.findMany({
          where: eq(investors.syncStatus, 'error')
        })
      ]);

      res.json({
        success: true,
        metrics: {
          total: totalInvestors.length,
          synced: syncedInvestors.length,
          pending: pendingInvestors.length,
          errors: errorInvestors.length,
          lastSync: syncedInvestors.length > 0 ? 
            Math.max(...syncedInvestors.map(i => i.lastSyncAt?.getTime() || 0)) : null
        }
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get sync metrics' 
      });
    }
  });

  console.log('✅ Affinity CRM API routes registered successfully');
}