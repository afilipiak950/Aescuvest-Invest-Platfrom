import { db } from '../db';
import { backgroundJobs, documents } from '@shared/schema';
import { eq, and, gte, desc } from 'drizzle-orm';

interface OCRHealthMetrics {
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  pendingJobs: number;
  averageProcessingTime: number;
  successRate: number;
  commonFailureReasons: { reason: string; count: number }[];
  documentsWithoutOCR: number;
  documentsWithoutAISummary: number;
}

export class OCRMonitoringService {
  
  /**
   * Get comprehensive OCR health metrics
   */
  async getHealthMetrics(dealId?: number): Promise<OCRHealthMetrics> {
    try {
      // Get OCR job statistics
      let jobQuery = db.select().from(backgroundJobs)
        .where(eq(backgroundJobs.jobType, 'document_ocr'));
      
      if (dealId) {
        jobQuery = jobQuery.where(and(
          eq(backgroundJobs.jobType, 'document_ocr'),
          eq(backgroundJobs.dealId, dealId)
        )) as any;
      }
      
      const jobs = await jobQuery.orderBy(desc(backgroundJobs.createdAt));
      
      const totalJobs = jobs.length;
      const successfulJobs = jobs.filter(job => job.status === 'completed').length;
      const failedJobs = jobs.filter(job => job.status === 'failed').length;
      const pendingJobs = jobs.filter(job => job.status === 'pending' || job.status === 'processing').length;
      
      // Calculate average processing time for completed jobs
      const completedJobs = jobs.filter(job => job.status === 'completed' && job.completedAt && job.startedAt);
      const totalProcessingTime = completedJobs.reduce((acc, job) => {
        const startTime = job.startedAt?.getTime() || job.createdAt.getTime();
        const endTime = job.completedAt?.getTime() || Date.now();
        return acc + (endTime - startTime);
      }, 0);
      
      const averageProcessingTime = completedJobs.length > 0 
        ? Math.round(totalProcessingTime / completedJobs.length / 1000) // Convert to seconds
        : 0;
      
      const successRate = totalJobs > 0 ? (successfulJobs / totalJobs) * 100 : 0;
      
      // Analyze common failure reasons
      const failedJobsWithErrors = jobs.filter(job => job.status === 'failed' && job.error);
      const failureReasons = failedJobsWithErrors.reduce((acc, job) => {
        const error = job.error || 'Unknown error';
        let reason = 'Unknown error';
        
        if (error.includes('timeout')) reason = 'Timeout';
        else if (error.includes('not found')) reason = 'File not found';
        else if (error.includes('corrupted')) reason = 'Corrupted file';
        else if (error.includes('API key')) reason = 'API configuration';
        else if (error.includes('memory')) reason = 'Memory limit';
        else if (error.includes('network')) reason = 'Network error';
        
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const commonFailureReasons = Object.entries(failureReasons)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // Top 5 failure reasons
      
      // Get document statistics
      let docQuery = db.select().from(documents);
      if (dealId) {
        docQuery = docQuery.where(eq(documents.dealId, dealId)) as any;
      }
      
      const allDocs = await docQuery;
      const documentsWithoutOCR = allDocs.filter(doc => !doc.ocrText || doc.ocrText.length === 0).length;
      const documentsWithoutAISummary = allDocs.filter(doc => !doc.aiSummary).length;
      
      return {
        totalJobs,
        successfulJobs,
        failedJobs,
        pendingJobs,
        averageProcessingTime,
        successRate: Math.round(successRate * 100) / 100,
        commonFailureReasons,
        documentsWithoutOCR,
        documentsWithoutAISummary
      };
      
    } catch (error) {
      console.error('Failed to get OCR health metrics:', error);
      throw error;
    }
  }
  
  /**
   * Get recent failed OCR jobs for investigation
   */
  async getRecentFailures(dealId?: number, limit = 20): Promise<any[]> {
    try {
      let query = db.select().from(backgroundJobs)
        .where(and(
          eq(backgroundJobs.jobType, 'document_ocr'),
          eq(backgroundJobs.status, 'failed')
        ));
      
      if (dealId) {
        query = query.where(and(
          eq(backgroundJobs.jobType, 'document_ocr'),
          eq(backgroundJobs.status, 'failed'),
          eq(backgroundJobs.dealId, dealId)
        )) as any;
      }
      
      const failures = await query
        .orderBy(desc(backgroundJobs.updatedAt))
        .limit(limit);
      
      return failures.map(job => ({
        id: job.id,
        jobId: job.jobId,
        dealId: job.dealId,
        error: job.error,
        fileName: (job.jobData as any)?.fileName || 'Unknown',
        fileType: (job.jobData as any)?.fileType || 'Unknown',
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        progress: job.progress
      }));
      
    } catch (error) {
      console.error('Failed to get recent failures:', error);
      return [];
    }
  }
  
  /**
   * Check for stuck jobs and clean them up
   */
  async checkStuckJobs(dealId?: number): Promise<{ stuckJobs: number; cleanedUp: number }> {
    try {
      const now = new Date();
      const stuckThreshold = 30 * 60 * 1000; // 30 minutes
      
      let query = db.select().from(backgroundJobs)
        .where(and(
          eq(backgroundJobs.jobType, 'document_ocr'),
          eq(backgroundJobs.status, 'processing')
        ));
      
      if (dealId) {
        query = query.where(and(
          eq(backgroundJobs.jobType, 'document_ocr'),
          eq(backgroundJobs.status, 'processing'),
          eq(backgroundJobs.dealId, dealId)
        )) as any;
      }
      
      const processingJobs = await query;
      
      const stuckJobs = processingJobs.filter(job => {
        const lastUpdate = job.updatedAt || job.startedAt || job.createdAt;
        const timeSinceUpdate = now.getTime() - lastUpdate.getTime();
        return timeSinceUpdate > stuckThreshold;
      });
      
      let cleanedUp = 0;
      for (const job of stuckJobs) {
        try {
          await db.update(backgroundJobs)
            .set({
              status: 'failed',
              error: 'Job automatically marked as failed - stuck for over 30 minutes',
              completedAt: now,
              updatedAt: now
            })
            .where(eq(backgroundJobs.id, job.id));
          
          cleanedUp++;
          console.log(`🧹 Cleaned up stuck OCR job ${job.id}`);
        } catch (cleanupError) {
          console.error(`Failed to cleanup job ${job.id}:`, cleanupError);
        }
      }
      
      return {
        stuckJobs: stuckJobs.length,
        cleanedUp
      };
      
    } catch (error) {
      console.error('Failed to check stuck jobs:', error);
      return { stuckJobs: 0, cleanedUp: 0 };
    }
  }
  
  /**
   * Generate health report
   */
  async generateHealthReport(dealId?: number): Promise<string> {
    try {
      const metrics = await this.getHealthMetrics(dealId);
      const recentFailures = await this.getRecentFailures(dealId, 5);
      const stuckJobCheck = await this.checkStuckJobs(dealId);
      
      const report = `
📊 OCR HEALTH REPORT ${dealId ? `for Deal ${dealId}` : '(Global)'}
Generated: ${new Date().toISOString()}

📈 Overall Statistics:
- Total OCR Jobs: ${metrics.totalJobs}
- Success Rate: ${metrics.successRate}%
- Average Processing Time: ${metrics.averageProcessingTime}s
- Pending/Processing: ${metrics.pendingJobs}
- Failed Jobs: ${metrics.failedJobs}

📄 Document Status:
- Documents without OCR: ${metrics.documentsWithoutOCR}
- Documents without AI Summary: ${metrics.documentsWithoutAISummary}

⚠️ Common Failure Reasons:
${metrics.commonFailureReasons.map(f => `- ${f.reason}: ${f.count} occurrences`).join('\n')}

🧹 Stuck Job Cleanup:
- Stuck jobs found: ${stuckJobCheck.stuckJobs}
- Cleaned up: ${stuckJobCheck.cleanedUp}

🔍 Recent Failures:
${recentFailures.slice(0, 3).map(f => 
  `- ${f.fileName} (${f.fileType}): ${f.error?.substring(0, 100)}...`
).join('\n')}

🎯 Recommendations:
${metrics.successRate < 80 ? '- Success rate is below 80% - investigate common failures' : ''}
${metrics.documentsWithoutOCR > 0 ? `- ${metrics.documentsWithoutOCR} documents need OCR processing` : ''}
${metrics.averageProcessingTime > 300 ? '- Average processing time is high - consider optimization' : ''}
`;
      
      return report;
      
    } catch (error) {
      console.error('Failed to generate health report:', error);
      return `Error generating health report: ${error}`;
    }
  }
}

export const ocrMonitoringService = new OCRMonitoringService();