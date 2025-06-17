import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { userActivity, aiActivity } from '../../shared/schema';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    name: string;
    email: string;
  };
}

export const activityTracker = (action: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Track the request
    const originalSend = res.send;
    res.send = function(data) {
      const duration = Date.now() - startTime;
      
      // Log activity after response is sent
      if (req.user?.id) {
        setImmediate(async () => {
          try {
            await db.insert(userActivity).values({
              userId: req.user!.id,
              action: action,
              details: {
                method: req.method,
                path: req.path,
                params: req.params,
                query: req.query,
                duration: duration,
                statusCode: res.statusCode,
                userAgent: req.get('User-Agent'),
                timestamp: new Date().toISOString()
              },
              ipAddress: req.ip || req.connection.remoteAddress,
              userAgent: req.get('User-Agent')
            });
          } catch (error) {
            console.error('Failed to log user activity:', error);
          }
        });
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

export const aiActivityLogger = {
  async logStart(dealId?: number, documentId?: number, activityType: string, agentType?: string, model: string = 'gpt-4o', prompt?: string) {
    try {
      const result = await db.insert(aiActivity).values({
        dealId,
        documentId,
        activityType,
        agentType,
        status: 'started',
        model,
        prompt,
        timestamp: new Date()
      }).returning({ id: aiActivity.id });
      
      return result[0]?.id;
    } catch (error) {
      console.error('Failed to log AI activity start:', error);
      return null;
    }
  },

  async logComplete(activityId: number, response?: string, tokenCount?: number, cost?: number, processingTime?: number) {
    try {
      await db.update(aiActivity)
        .set({
          status: 'completed',
          response,
          tokenCount,
          cost,
          processingTime
        })
        .where(eq(aiActivity.id, activityId));
    } catch (error) {
      console.error('Failed to log AI activity completion:', error);
    }
  },

  async logError(activityId: number, errorMessage: string) {
    try {
      await db.update(aiActivity)
        .set({
          status: 'failed',
          errorMessage
        })
        .where(eq(aiActivity.id, activityId));
    } catch (error) {
      console.error('Failed to log AI activity error:', error);
    }
  }
};

// System metrics updater
export const updateSystemMetrics = async () => {
  try {
    // Calculate current metrics
    const totalDeals = await db.select({ count: sql<number>`count(*)` }).from(deals);
    const activeDeals = await db.select({ count: sql<number>`count(*)` }).from(deals)
      .where(notInArray(deals.status, ['Closed', 'Rejected']));
    const documentsProcessed = await db.select({ count: sql<number>`count(*)` }).from(documents)
      .where(isNotNull(documents.ocrText));
    const aiCompleted = await db.select({ count: sql<number>`count(*)` }).from(aiActivity)
      .where(eq(aiActivity.status, 'completed'));
    
    const avgProcessingTime = await db.select({ 
      avg: sql<number>`avg(processing_time)` 
    }).from(aiActivity).where(eq(aiActivity.status, 'completed'));
    
    const successRate = await db.select({
      rate: sql<number>`
        CASE 
          WHEN count(*) > 0 
          THEN count(*) FILTER (WHERE status = 'completed') * 100.0 / count(*)
          ELSE 0 
        END
      `
    }).from(aiActivity);
    
    const recentActivity = await db.select({ count: sql<number>`count(*)` }).from(userActivity)
      .where(gte(userActivity.timestamp, sql`NOW() - INTERVAL '24 hours'`));
    
    const recentApiCalls = await db.select({ count: sql<number>`count(*)` }).from(aiActivity)
      .where(gte(aiActivity.timestamp, sql`NOW() - INTERVAL '24 hours'`));
    
    const storageUsed = await db.select({ total: sql<number>`sum(size)` }).from(documents);

    // Update or insert current metrics
    await db.insert(systemKpis).values({
      totalDeals: totalDeals[0]?.count || 0,
      activeDeals: activeDeals[0]?.count || 0,
      documentsProcessed: documentsProcessed[0]?.count || 0,
      aiAnalysesCompleted: aiCompleted[0]?.count || 0,
      averageProcessingTime: avgProcessingTime[0]?.avg || 0,
      successRate: successRate[0]?.rate || 0,
      userActivity: recentActivity[0]?.count || 0,
      apiCalls: recentApiCalls[0]?.count || 0,
      storageUsed: storageUsed[0]?.total || 0,
      date: new Date()
    });

    console.log('System metrics updated successfully');
  } catch (error) {
    console.error('Failed to update system metrics:', error);
  }
};

// Schedule metrics updates every 5 minutes
setInterval(updateSystemMetrics, 5 * 60 * 1000);

// Import necessary Drizzle functions
import { eq, sql, gte, notInArray, isNotNull } from 'drizzle-orm';
import { deals, documents, systemKpis } from '../../shared/schema';