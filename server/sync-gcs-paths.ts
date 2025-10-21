/**
 * Sync GCS Paths - Update Database to Match Files Already in GCS
 * 
 * Since files are already in GCS, this script:
 * 1. Lists all files in the GCS bucket
 * 2. Matches them to database records by filename
 * 3. Updates database paths from local to GCS paths
 */

import { db } from './db';
import { documents } from '../shared/schema';
import { gcsService } from './services/googleCloudStorage';
import { eq } from 'drizzle-orm';
import path from 'path';

interface GCSFile {
  name: string;  // Full GCS path like "deals/1/documents/123_filename.pdf"
  basename: string;  // Just "filename.pdf"
  gcsPath: string;  // Full gs:// URL
}

class GCSSyncService {
  /**
   * Main sync entry point
   */
  async syncDatabaseWithGCS() {
    console.log('🔄 SYNCING DATABASE WITH GCS FILES');
    console.log('=' .repeat(70));
    
    // Step 1: Get all files from GCS bucket
    console.log('\n📦 Step 1: Listing files in GCS bucket...');
    const gcsFiles = await this.listAllGCSFiles();
    console.log(`   Found ${gcsFiles.length} files in GCS`);
    
    if (gcsFiles.length === 0) {
      console.log('\n❌ No files found in GCS bucket!');
      console.log('Please verify files were uploaded to GCS.');
      return;
    }
    
    // Show sample GCS files
    console.log('\n   Sample GCS files:');
    gcsFiles.slice(0, 5).forEach(f => {
      console.log(`   - ${f.basename}`);
      console.log(`     GCS: ${f.gcsPath}`);
    });
    
    // Step 2: Get all documents from database
    console.log('\n📊 Step 2: Loading database records...');
    const allDocs = await db.select().from(documents);
    const needsUpdate = allDocs.filter(doc => !doc.path?.startsWith('gs://'));
    console.log(`   Total documents: ${allDocs.length}`);
    console.log(`   Need GCS paths: ${needsUpdate.length}`);
    console.log(`   Already have GCS paths: ${allDocs.length - needsUpdate.length}`);
    
    // Step 3: Match and update
    console.log('\n🔗 Step 3: Matching database records to GCS files...');
    
    let matchedCount = 0;
    let notFoundCount = 0;
    
    for (const doc of needsUpdate) {
      const docBasename = path.basename(doc.name);
      
      // Try to find matching GCS file by basename
      const matchingFile = this.findMatchingGCSFile(docBasename, gcsFiles, doc.dealId);
      
      if (matchingFile) {
        // Update database with GCS path
        await db.update(documents)
          .set({ path: matchingFile.gcsPath })
          .where(eq(documents.id, doc.id));
        
        matchedCount++;
        console.log(`   ✅ ${docBasename}`);
        console.log(`      Updated to: ${matchingFile.gcsPath}`);
      } else {
        notFoundCount++;
        console.log(`   ❌ ${docBasename} - No matching GCS file found`);
      }
    }
    
    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ SYNC COMPLETE');
    console.log('');
    console.log(`Matched and updated: ${matchedCount}`);
    console.log(`Not found in GCS: ${notFoundCount}`);
    console.log('');
    
    if (matchedCount > 0) {
      console.log('✅ Your production deployment should now have access to PDFs!');
      console.log('   Deploy at: https://aescuvest.replit.app');
    }
    
    if (notFoundCount > 0) {
      console.log(`⚠️  ${notFoundCount} documents don't have matching files in GCS`);
      console.log('   These will need to be re-uploaded.');
    }
    
    console.log('=' .repeat(70));
  }
  
  /**
   * List all files in the GCS bucket
   */
  private async listAllGCSFiles(): Promise<GCSFile[]> {
    try {
      const files = await gcsService.listAllFiles();
      
      return files.map(file => ({
        name: file,
        basename: path.basename(file),
        gcsPath: `gs://${process.env.GOOGLE_CLOUD_STORAGE_BUCKET}/${file}`
      }));
    } catch (error) {
      console.error('❌ Failed to list GCS files:', error);
      return [];
    }
  }
  
  /**
   * Find matching GCS file for a document
   */
  private findMatchingGCSFile(
    docFilename: string, 
    gcsFiles: GCSFile[],
    dealId?: number
  ): GCSFile | null {
    // Try exact basename match first
    let match = gcsFiles.find(f => f.basename === docFilename);
    if (match) return match;
    
    // Try to match by filename without timestamp prefix
    // GCS files are named: {timestamp}_{original_filename}
    match = gcsFiles.find(f => {
      const parts = f.basename.split('_');
      if (parts.length > 1) {
        const filenameWithoutTimestamp = parts.slice(1).join('_');
        return filenameWithoutTimestamp === docFilename;
      }
      return false;
    });
    if (match) return match;
    
    // Try fuzzy match (contains filename)
    match = gcsFiles.find(f => f.basename.includes(docFilename.replace(/\.[^/.]+$/, '')));
    if (match) return match;
    
    // Try match within same deal folder
    if (dealId) {
      match = gcsFiles.find(f => 
        f.name.includes(`deals/${dealId}/`) && 
        (f.basename === docFilename || f.basename.includes(docFilename.replace(/\.[^/.]+$/, '')))
      );
      if (match) return match;
    }
    
    return null;
  }
}

const sync = new GCSSyncService();
sync.syncDatabaseWithGCS().catch(console.error);
