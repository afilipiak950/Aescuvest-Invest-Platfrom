import { ZipProcessor } from './server/services/zipProcessor';
import { backgroundJobManager } from './server/services/backgroundJobManager';

async function processRealZip() {
  console.log('🔄 Processing user\'s actual OneDrive ZIP file...');
  
  const zipPath = 'uploads/f8c08c07-2870-4d21-af11-d05826dbf4da_OneDrive_1_30.7.2025-20250818T102908Z-1-001.zip';
  const dealId = 29;
  const folderName = 'OneDrive_Data_Room';
  
  // Create background job for progress tracking
  const jobId = await backgroundJobManager.createJob({
    jobType: 'zip_upload',
    dealId: dealId,
    jobName: 'Processing OneDrive ZIP',
    details: `Processing large OneDrive ZIP with 300+ files for deal ${dealId}`,
    progress: 0,
    status: 'processing'
  });
  
  try {
    console.log(`📋 Created background job ${jobId} for processing`);
    
    const zipProcessor = new ZipProcessor();
    const result = await zipProcessor.processZipFile(zipPath, dealId, folderName, jobId);
    
    console.log(`✅ ZIP processing completed!`);
    console.log(`📄 Total files found: ${result.totalFiles}`);
    console.log(`🎯 Processed files: ${result.processedFiles.length}`);
    
    await backgroundJobManager.updateProgress(jobId, 100, `Completed: ${result.processedFiles.length} files processed successfully`);
    
  } catch (error) {
    console.error('❌ ZIP processing failed:', error);
    await backgroundJobManager.updateProgress(jobId, 0, `Failed: ${error.message}`);
  }
}

processRealZip().catch(console.error);