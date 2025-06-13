import { db } from '../db';
import { backgroundJobs } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { optimizedZipProcessor } from './optimizedZipProcessor';
import { backgroundJobManager } from './backgroundJobManager';

export async function triggerOptimizedProcessing() {
  try {
    // Get the new optimized job
    const [job] = await db.select().from(backgroundJobs)
      .where(eq(backgroundJobs.id, 2));
    
    if (!job) {
      console.error('Job 2 not found');
      return;
    }
    
    const jobData = job.jobData as any;
    console.log('🚀 Starting optimized ZIP processing for job 2');
    
    // Start processing immediately
    const result = await optimizedZipProcessor.processZipFileOptimized(
      jobData.zipPath,
      job.dealId || 0,
      jobData.folderName || 'Data Room Documents',
      job.id
    );
    
    // Mark job as completed
    await backgroundJobManager.updateProgress(
      job.id,
      100,
      `Completed analysis of ${result.totalFiles} documents`,
      'completed'
    );
    
    console.log('✅ Optimized ZIP processing completed successfully');
    
  } catch (error) {
    console.error('❌ Error in optimized processing:', error);
    
    // Mark job as failed
    await backgroundJobManager.updateProgress(
      2,
      0,
      `Error: ${(error as Error).message}`,
      'failed'
    );
  }
}

// Trigger immediately
triggerOptimizedProcessing();