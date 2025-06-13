import { db } from '../db';
import { backgroundJobs } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { optimizedZipProcessor } from './optimizedZipProcessor';
import { backgroundJobManager } from './backgroundJobManager';

export async function restartStuckJob(jobId: number) {
  try {
    console.log(`🔄 Restarting stuck job ${jobId}`);
    
    // Get job details
    const [job] = await db.select().from(backgroundJobs)
      .where(eq(backgroundJobs.id, jobId));
    
    if (!job) {
      console.error(`Job ${jobId} not found`);
      return;
    }
    
    if (job.status !== 'processing') {
      console.log(`Job ${jobId} is not stuck (status: ${job.status})`);
      return;
    }
    
    const jobData = job.jobData as any;
    if (!jobData.zipPath || !jobData.fileName) {
      console.error(`Job ${jobId} missing required data`);
      return;
    }
    
    console.log(`🚀 Restarting ZIP processing for job ${jobId}`);
    
    // Update job to indicate restart
    await backgroundJobManager.updateProgress(
      jobId, 
      5, 
      'Restarting analysis with optimized processor...'
    );
    
    // Start optimized processing in background
    setImmediate(async () => {
      try {
        const result = await optimizedZipProcessor.processZipFileOptimized(
          jobData.zipPath,
          job.dealId || 0,
          jobData.folderName || 'Data Room Documents',
          jobId
        );
        
        // Mark job as completed
        await backgroundJobManager.updateProgress(
          jobId,
          100,
          `Completed analysis of ${result.totalFiles} documents`,
          'completed'
        );
        
        console.log(`✅ Job ${jobId} completed successfully`);
        
      } catch (error) {
        console.error(`❌ Error restarting job ${jobId}:`, error);
        await backgroundJobManager.updateProgress(
          jobId,
          0,
          `Error: ${(error as Error).message}`,
          'failed'
        );
      }
    });
    
    console.log(`📋 Job ${jobId} restart initiated`);
    
  } catch (error) {
    console.error(`Error restarting job ${jobId}:`, error);
  }
}

export async function restartAllStuckJobs() {
  try {
    console.log('🔍 Checking for stuck jobs...');
    
    // Find jobs that have been processing for more than 5 minutes without progress
    const stuckJobs = await db.select()
      .from(backgroundJobs)
      .where(eq(backgroundJobs.status, 'processing'));
    
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    for (const job of stuckJobs) {
      if (job.updatedAt && job.updatedAt < fiveMinutesAgo && job.progress && job.progress < 10) {
        console.log(`🔄 Found stuck job ${job.id}, restarting...`);
        await restartStuckJob(job.id);
      }
    }
    
  } catch (error) {
    console.error('Error checking for stuck jobs:', error);
  }
}