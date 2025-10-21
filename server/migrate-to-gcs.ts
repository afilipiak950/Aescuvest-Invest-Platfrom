/**
 * AUTOMATIC GCS MIGRATION SCRIPT
 * 
 * This script migrates all locally-stored documents to Google Cloud Storage
 * so they persist in production deployments at https://aescuvest.replit.app
 * 
 * What it does:
 * 1. Scans database for all documents with local filesystem paths
 * 2. Uploads each file to Google Cloud Storage
 * 3. Updates database with new GCS paths (gs://bucket-name/...)
 * 4. Logs all changes for rollback if needed
 * 5. Handles errors gracefully and can resume from interruption
 */

import { db } from './db';
import { documents } from '../shared/schema';
import { gcsService } from './services/googleCloudStorage';
import fs from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';

interface MigrationLog {
  documentId: number;
  originalPath: string;
  gcsPath: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  timestamp: string;
}

class GCSMigrationService {
  private logFile = 'gcs-migration-log.json';
  private logs: MigrationLog[] = [];
  
  /**
   * Main migration entry point
   */
  async migrateAllDocuments() {
    console.log('🚀 STARTING GCS MIGRATION');
    console.log('=' .repeat(70));
    
    // Load previous logs if migration was interrupted
    this.loadPreviousLogs();
    
    // Get all documents that need migration
    const allDocs = await db.select().from(documents);
    
    const needsMigration = allDocs.filter(doc => 
      doc.path && !doc.path.startsWith('gs://')
    );
    
    console.log(`\n📊 MIGRATION STATS:`);
    console.log(`Total documents: ${allDocs.length}`);
    console.log(`Already in GCS: ${allDocs.length - needsMigration.length}`);
    console.log(`Need migration: ${needsMigration.length}`);
    
    if (needsMigration.length === 0) {
      console.log('\n✅ All documents are already in GCS. No migration needed!');
      return;
    }
    
    console.log(`\n🔄 Starting migration of ${needsMigration.length} documents...`);
    console.log('');
    
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < needsMigration.length; i++) {
      const doc = needsMigration[i];
      const progress = `[${i + 1}/${needsMigration.length}]`;
      
      console.log(`${progress} Processing: ${doc.name}`);
      console.log(`  Original path: ${doc.path}`);
      
      try {
        const result = await this.migrateDocument(doc);
        
        if (result.status === 'success') {
          successCount++;
          console.log(`  ✅ SUCCESS: Uploaded to ${result.gcsPath}`);
        } else if (result.status === 'skipped') {
          skippedCount++;
          console.log(`  ⏭️  SKIPPED: ${result.error}`);
        } else {
          failedCount++;
          console.log(`  ❌ FAILED: ${result.error}`);
        }
        
        this.logs.push(result);
        this.saveLogs();
        
      } catch (error) {
        failedCount++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.log(`  ❌ ERROR: ${errorMsg}`);
        
        this.logs.push({
          documentId: doc.id,
          originalPath: doc.path,
          gcsPath: '',
          status: 'failed',
          error: errorMsg,
          timestamp: new Date().toISOString()
        });
        this.saveLogs();
      }
      
      console.log('');
    }
    
    // Final summary
    console.log('=' .repeat(70));
    console.log('🎉 MIGRATION COMPLETE');
    console.log('');
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`⏭️  Skipped (file not found): ${skippedCount}`);
    console.log(`❌ Failed: ${failedCount}`);
    console.log('');
    console.log(`📋 Full migration log saved to: ${this.logFile}`);
    console.log('=' .repeat(70));
    
    if (failedCount > 0) {
      console.log('\n⚠️  Some files failed to migrate. Check the log file for details.');
      console.log('You can re-run this script to retry failed migrations.');
    }
    
    if (successCount > 0) {
      console.log('\n✅ Your production deployment will now have access to migrated files!');
      console.log('Deploy at: https://aescuvest.replit.app');
    }
  }
  
  /**
   * Migrate a single document to GCS
   */
  private async migrateDocument(doc: any): Promise<MigrationLog> {
    const log: MigrationLog = {
      documentId: doc.id,
      originalPath: doc.path,
      gcsPath: '',
      status: 'failed',
      timestamp: new Date().toISOString()
    };
    
    try {
      // Check if already migrated in previous run
      const alreadyMigrated = this.logs.find(
        l => l.documentId === doc.id && l.status === 'success'
      );
      
      if (alreadyMigrated) {
        log.status = 'skipped';
        log.error = 'Already migrated in previous run';
        log.gcsPath = alreadyMigrated.gcsPath;
        return log;
      }
      
      // Resolve local file path
      const localPath = this.resolveLocalPath(doc.path);
      
      // Check if file exists
      if (!fs.existsSync(localPath)) {
        log.status = 'skipped';
        log.error = `File not found at: ${localPath}`;
        return log;
      }
      
      // Get file stats
      const stats = fs.statSync(localPath);
      console.log(`  📁 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      
      // Upload to GCS
      const gcsPath = await gcsService.uploadFile(
        localPath,
        doc.dealId,
        doc.name
      );
      
      // Update database with new GCS path
      await db.update(documents)
        .set({ path: gcsPath })
        .where(eq(documents.id, doc.id));
      
      log.gcsPath = gcsPath;
      log.status = 'success';
      
      return log;
      
    } catch (error) {
      log.error = error instanceof Error ? error.message : 'Unknown error';
      log.status = 'failed';
      return log;
    }
  }
  
  /**
   * Convert database path to actual filesystem path
   */
  private resolveLocalPath(dbPath: string): string {
    // Handle different path formats
    if (dbPath.startsWith('extracted/')) {
      return path.join(process.cwd(), 'uploads', dbPath);
    } else if (dbPath.startsWith('uploads/')) {
      return path.join(process.cwd(), dbPath);
    } else if (dbPath.startsWith('/')) {
      return dbPath;
    } else {
      // Relative path
      return path.join(process.cwd(), 'uploads', dbPath);
    }
  }
  
  /**
   * Save migration logs to disk
   */
  private saveLogs() {
    fs.writeFileSync(
      this.logFile,
      JSON.stringify(this.logs, null, 2),
      'utf-8'
    );
  }
  
  /**
   * Load previous migration logs (for resuming)
   */
  private loadPreviousLogs() {
    if (fs.existsSync(this.logFile)) {
      try {
        const content = fs.readFileSync(this.logFile, 'utf-8');
        this.logs = JSON.parse(content);
        console.log(`\n📋 Loaded ${this.logs.length} previous migration records`);
      } catch (error) {
        console.log('\n⚠️  Could not load previous logs, starting fresh');
        this.logs = [];
      }
    }
  }
  
  /**
   * Rollback migration (restore original paths from log)
   */
  async rollback() {
    console.log('🔄 ROLLING BACK GCS MIGRATION');
    console.log('=' .repeat(70));
    
    if (!fs.existsSync(this.logFile)) {
      console.log('❌ No migration log found. Nothing to rollback.');
      return;
    }
    
    this.loadPreviousLogs();
    const successfulMigrations = this.logs.filter(l => l.status === 'success');
    
    console.log(`\nRolling back ${successfulMigrations.length} documents...`);
    
    for (const log of successfulMigrations) {
      try {
        await db.update(documents)
          .set({ path: log.originalPath })
          .where(eq(documents.id, log.documentId));
        
        console.log(`✅ Restored document ${log.documentId} to: ${log.originalPath}`);
      } catch (error) {
        console.log(`❌ Failed to restore document ${log.documentId}: ${error}`);
      }
    }
    
    console.log('\n✅ Rollback complete');
    console.log('=' .repeat(70));
  }
  
  /**
   * Verify migration success by checking random samples
   */
  async verifyMigration() {
    console.log('🔍 VERIFYING GCS MIGRATION');
    console.log('=' .repeat(70));
    
    const allDocs = await db.select().from(documents);
    const gcsDocs = allDocs.filter(doc => doc.path?.startsWith('gs://'));
    const localDocs = allDocs.filter(doc => doc.path && !doc.path.startsWith('gs://'));
    
    console.log(`\n📊 VERIFICATION RESULTS:`);
    console.log(`Total documents: ${allDocs.length}`);
    console.log(`In GCS: ${gcsDocs.length} ✅`);
    console.log(`Still local: ${localDocs.length} ${localDocs.length > 0 ? '⚠️' : '✅'}`);
    
    if (gcsDocs.length > 0) {
      console.log(`\n✅ SUCCESS: ${((gcsDocs.length / allDocs.length) * 100).toFixed(1)}% of documents are in GCS`);
    }
    
    if (localDocs.length > 0) {
      console.log(`\n⚠️  WARNING: ${localDocs.length} documents still have local paths`);
      console.log('These will NOT be accessible in production deployment.');
      console.log('\nSample local paths:');
      localDocs.slice(0, 3).forEach(doc => {
        console.log(`  - ${doc.name}: ${doc.path}`);
      });
    }
    
    console.log('\n' + '='.repeat(70));
  }
}

// CLI interface
const migration = new GCSMigrationService();
const command = process.argv[2];

async function main() {
  switch (command) {
    case 'migrate':
      await migration.migrateAllDocuments();
      break;
      
    case 'verify':
      await migration.verifyMigration();
      break;
      
    case 'rollback':
      await migration.rollback();
      break;
      
    default:
      console.log('GCS Migration Tool');
      console.log('');
      console.log('Usage:');
      console.log('  npx tsx server/migrate-to-gcs.ts migrate   - Migrate all local files to GCS');
      console.log('  npx tsx server/migrate-to-gcs.ts verify    - Verify migration status');
      console.log('  npx tsx server/migrate-to-gcs.ts rollback  - Rollback migration (restore local paths)');
      console.log('');
      console.log('Example:');
      console.log('  npx tsx server/migrate-to-gcs.ts migrate');
  }
}

main().catch(console.error);
