import { ZipProcessor } from './services/zipProcessor';
import { backgroundJobManager } from './services/backgroundJobManager';

async function restartZipProcessing() {
  try {
    const zipProcessor = new ZipProcessor();
    const zipPath = '/home/runner/workspace/uploads/1749240592378_ACP_Structured_Data_Room-20250606T185336Z-1-001.zip';
    const dealId = 22;
    const folderName = 'Data Room Documents';
    const jobId = 1;

    console.log('🔄 Restarting ZIP processing...');
    console.log(`📦 ZIP file: ${zipPath}`);
    console.log(`🎯 Deal ID: ${dealId}`);
    console.log(`📋 Job ID: ${jobId}`);

    // Process the ZIP file with proper job tracking
    const result = await zipProcessor.processZipFile(zipPath, dealId, folderName, jobId);
    
    console.log('✅ ZIP processing completed successfully!');
    console.log(`📊 Processed ${result.totalFiles} files`);

  } catch (error) {
    console.error('❌ Error restarting ZIP processing:', error);
    await backgroundJobManager.completeJob(1, null, `Processing failed: ${error.message}`);
  }
}

restartZipProcessing().catch(console.error);