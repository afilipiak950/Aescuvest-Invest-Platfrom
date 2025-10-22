import { Client } from 'pg';

interface MigrationStats {
  tableName: string;
  recordsExported: number;
  recordsInserted: number;
  recordsSkipped: number;
  errors: number;
}

interface MigrationOptions {
  dryRun: boolean;
  productionUrl: string;
  conflictStrategy: 'skip' | 'upsert' | 'overwrite';
  batchSize: number;
  useTransactions: boolean;
}

class DatabaseMigration {
  private devClient: Client;
  private prodClient: Client;
  private stats: MigrationStats[] = [];
  private options: MigrationOptions;

  constructor(options: MigrationOptions) {
    this.options = options;
    
    // Development database connection
    this.devClient = new Client({
      connectionString: process.env.DATABASE_URL,
    });

    // Production database connection
    this.prodClient = new Client({
      connectionString: options.productionUrl,
    });
  }

  async connect() {
    console.log('🔗 Connecting to development database...');
    await this.devClient.connect();
    console.log('✅ Connected to development database');

    if (!this.options.dryRun) {
      console.log('🔗 Connecting to production database...');
      await this.prodClient.connect();
      console.log('✅ Connected to production database');
    } else {
      console.log('🔍 DRY RUN MODE - Not connecting to production');
    }
  }

  async disconnect() {
    console.log('👋 Disconnecting from databases...');
    await this.devClient.end();
    if (!this.options.dryRun) {
      await this.prodClient.end();
    }
    console.log('✅ Disconnected');
  }

  /**
   * Migration order respects foreign key dependencies
   */
  private getMigrationOrder(): Array<{
    table: string;
    primaryKey: string;
    hasSerialId: boolean;
  }> {
    return [
      // Independent tables (no foreign keys)
      { table: 'users', primaryKey: 'id', hasSerialId: true },
      { table: 'system_settings', primaryKey: 'id', hasSerialId: true },
      { table: 'organizations', primaryKey: 'id', hasSerialId: true },
      
      // Deals (references users)
      { table: 'deals', primaryKey: 'id', hasSerialId: true },
      
      // Documents (references deals and users)
      { table: 'documents', primaryKey: 'id', hasSerialId: true },
      
      // Agent analyses (references deals)
      { table: 'agent_analyses', primaryKey: 'id', hasSerialId: true },
      { table: 'comprehensive_analysis', primaryKey: 'id', hasSerialId: true },
      { table: 'comprehensive_hr_analyses', primaryKey: 'id', hasSerialId: true },
      
      // Company research (references deals)
      { table: 'company_research', primaryKey: 'id', hasSerialId: true },
      { table: 'research_jobs', primaryKey: 'job_id', hasSerialId: false },
      
      // Investment memos (references deals)
      { table: 'investment_memos', primaryKey: 'id', hasSerialId: true },
      
      // Embeddings and cache (references documents/deals)
      { table: 'document_embeddings', primaryKey: 'id', hasSerialId: true },
      { table: 'query_cache', primaryKey: 'id', hasSerialId: true },
      
      // Background jobs
      { table: 'background_jobs', primaryKey: 'id', hasSerialId: true },
      { table: 'research_background_jobs', primaryKey: 'id', hasSerialId: true },
      
      // Deal matches
      { table: 'deal_organization_matches', primaryKey: 'id', hasSerialId: true },
      { table: 'deal_investor_matches', primaryKey: 'id', hasSerialId: true },
      
      // Other tables
      { table: 'automations', primaryKey: 'id', hasSerialId: true },
      { table: 'automation_executions', primaryKey: 'id', hasSerialId: true },
      { table: 'evaluation_criteria', primaryKey: 'id', hasSerialId: true },
      { table: 'evaluation_results', primaryKey: 'id', hasSerialId: true },
      { table: 'data_room_connections', primaryKey: 'id', hasSerialId: true },
      { table: 'microsoft_email_connections', primaryKey: 'id', hasSerialId: true },
      { table: 'persistent_upload_sessions', primaryKey: 'session_id', hasSerialId: false },
      { table: 'user_activities', primaryKey: 'id', hasSerialId: true },
      { table: 'user_stats', primaryKey: 'id', hasSerialId: true },
      { table: 'email_campaigns', primaryKey: 'id', hasSerialId: true },
      { table: 'campaign_recipients', primaryKey: 'id', hasSerialId: true },
      { table: 'document_assignment_learning', primaryKey: 'id', hasSerialId: true },
      { table: 'agent_assignment_rules', primaryKey: 'id', hasSerialId: true },
      { table: 'daily_sync_jobs', primaryKey: 'id', hasSerialId: true },
      
      // Sessions (can be skipped or migrated last)
      // { table: 'user_sessions', primaryKey: 'sid', hasSerialId: false },
    ];
  }

  private async getTableColumns(tableName: string): Promise<string[]> {
    const result = await this.devClient.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `, [tableName]);
    
    return result.rows.map(row => row.column_name);
  }

  private async exportTable(tableName: string): Promise<any[]> {
    console.log(`📤 Exporting ${tableName}...`);
    const result = await this.devClient.query(`SELECT * FROM ${tableName}`);
    console.log(`   Found ${result.rows.length} records`);
    return result.rows;
  }

  private async importTable(
    tableName: string,
    primaryKey: string,
    hasSerialId: boolean,
    records: any[]
  ): Promise<{ inserted: number; skipped: number; errors: number }> {
    if (records.length === 0) {
      console.log(`   ⏭️  No records to import for ${tableName}`);
      return { inserted: 0, skipped: 0, errors: 0 };
    }

    const columns = await this.getTableColumns(tableName);
    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    console.log(`📥 Importing ${records.length} records to ${tableName}...`);
    
    // Start transaction if enabled
    if (this.options.useTransactions && !this.options.dryRun) {
      await this.prodClient.query('BEGIN');
      console.log('   🔒 Transaction started for table');
    }

    // Process in batches
    for (let i = 0; i < records.length; i += this.options.batchSize) {
      const batch = records.slice(i, i + this.options.batchSize);
      const progress = Math.round(((i + batch.length) / records.length) * 100);
      
      for (const record of batch) {
        try {
          if (this.options.dryRun) {
            inserted++;
            continue;
          }

          const values = columns.map(col => record[col]);
          const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
          const columnsList = columns.join(', ');

          if (this.options.conflictStrategy === 'skip') {
            // Insert only if doesn't exist
            const checkQuery = `SELECT 1 FROM ${tableName} WHERE ${primaryKey} = $1`;
            const exists = await this.prodClient.query(checkQuery, [record[primaryKey]]);
            
            if (exists.rows.length > 0) {
              skipped++;
              continue;
            }

            const insertQuery = `INSERT INTO ${tableName} (${columnsList}) VALUES (${placeholders})`;
            await this.prodClient.query(insertQuery, values);
            inserted++;
          } else if (this.options.conflictStrategy === 'upsert') {
            // Upsert (insert or update on conflict)
            const updateSet = columns
              .filter(col => col !== primaryKey)
              .map(col => `${col} = EXCLUDED.${col}`)
              .join(', ');

            const upsertQuery = `
              INSERT INTO ${tableName} (${columnsList}) 
              VALUES (${placeholders})
              ON CONFLICT (${primaryKey}) 
              DO UPDATE SET ${updateSet}
            `;
            await this.prodClient.query(upsertQuery, values);
            inserted++;
          } else {
            // Overwrite (delete and insert in transaction for atomicity)
            await this.prodClient.query('BEGIN');
            try {
              await this.prodClient.query(`DELETE FROM ${tableName} WHERE ${primaryKey} = $1`, [record[primaryKey]]);
              const insertQuery = `INSERT INTO ${tableName} (${columnsList}) VALUES (${placeholders})`;
              await this.prodClient.query(insertQuery, values);
              await this.prodClient.query('COMMIT');
              inserted++;
            } catch (error) {
              await this.prodClient.query('ROLLBACK');
              throw error;
            }
          }
        } catch (error: any) {
          console.error(`   ❌ Error inserting record ${record[primaryKey]}:`, error.message);
          errors++;
          
          // Rollback transaction if enabled
          if (this.options.useTransactions && !this.options.dryRun) {
            await this.prodClient.query('ROLLBACK');
            console.log('   ⚠️  Transaction rolled back due to error');
            throw error;
          }
        }
      }

      if (progress % 25 === 0 || i + batch.length >= records.length) {
        console.log(`   Progress: ${progress}% (${inserted} inserted, ${skipped} skipped, ${errors} errors)`);
      }
    }

    // Commit transaction if enabled
    if (this.options.useTransactions && !this.options.dryRun) {
      try {
        await this.prodClient.query('COMMIT');
        console.log('   ✅ Transaction committed successfully');
      } catch (error: any) {
        console.log('   ❌ Transaction commit failed, rolling back...');
        await this.prodClient.query('ROLLBACK');
        throw error;
      }
    }

    // Reset sequence for serial IDs if needed
    if (hasSerialId && inserted > 0 && !this.options.dryRun) {
      try {
        const maxIdQuery = `SELECT MAX(${primaryKey}) as max_id FROM ${tableName}`;
        const result = await this.prodClient.query(maxIdQuery);
        const maxId = result.rows[0].max_id;
        
        if (maxId) {
          const sequenceName = `${tableName}_${primaryKey}_seq`;
          await this.prodClient.query(`SELECT setval('${sequenceName}', ${maxId})`);
          console.log(`   🔢 Reset sequence ${sequenceName} to ${maxId}`);
        }
      } catch (error: any) {
        console.log(`   ⚠️  Could not reset sequence: ${error.message}`);
      }
    }

    return { inserted, skipped, errors };
  }

  async migrateTable(
    tableName: string,
    primaryKey: string,
    hasSerialId: boolean
  ): Promise<MigrationStats> {
    console.log(`\n🔄 Migrating table: ${tableName}`);
    console.log(`   Primary Key: ${primaryKey}, Serial ID: ${hasSerialId}`);

    const stats: MigrationStats = {
      tableName,
      recordsExported: 0,
      recordsInserted: 0,
      recordsSkipped: 0,
      errors: 0,
    };

    try {
      // Export from development
      const records = await this.exportTable(tableName);
      stats.recordsExported = records.length;

      if (records.length === 0) {
        console.log(`   ✅ No data to migrate for ${tableName}`);
        return stats;
      }

      // Import to production
      const importStats = await this.importTable(tableName, primaryKey, hasSerialId, records);
      stats.recordsInserted = importStats.inserted;
      stats.recordsSkipped = importStats.skipped;
      stats.errors = importStats.errors;

      console.log(`   ✅ Completed ${tableName}: ${stats.recordsInserted} inserted, ${stats.recordsSkipped} skipped, ${stats.errors} errors`);
    } catch (error: any) {
      console.error(`   ❌ Fatal error migrating ${tableName}:`, error.message);
      stats.errors = 1;
    }

    return stats;
  }

  async migrate() {
    console.log('\n========================================');
    console.log('🚀 DATABASE MIGRATION STARTING');
    console.log('========================================\n');
    console.log(`Mode: ${this.options.dryRun ? '🔍 DRY RUN' : '⚡ LIVE MIGRATION'}`);
    console.log(`Conflict Strategy: ${this.options.conflictStrategy.toUpperCase()}`);
    console.log(`Batch Size: ${this.options.batchSize}`);
    console.log(`Use Transactions: ${this.options.useTransactions ? 'YES ✅' : 'NO'}`);
    console.log('');

    try {
      await this.connect();

      const migrationOrder = this.getMigrationOrder();
      console.log(`\n📋 Migrating ${migrationOrder.length} tables in dependency order\n`);

      for (const { table, primaryKey, hasSerialId } of migrationOrder) {
        const stats = await this.migrateTable(table, primaryKey, hasSerialId);
        this.stats.push(stats);
      }

      // Print summary
      this.printSummary();

    } catch (error: any) {
      console.error('\n❌ MIGRATION FAILED:', error.message);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  private printSummary() {
    console.log('\n========================================');
    console.log('📊 MIGRATION SUMMARY');
    console.log('========================================\n');

    const totalExported = this.stats.reduce((sum, s) => sum + s.recordsExported, 0);
    const totalInserted = this.stats.reduce((sum, s) => sum + s.recordsInserted, 0);
    const totalSkipped = this.stats.reduce((sum, s) => sum + s.recordsSkipped, 0);
    const totalErrors = this.stats.reduce((sum, s) => sum + s.errors, 0);

    console.log(`Total Records Exported: ${totalExported}`);
    console.log(`Total Records Inserted: ${totalInserted}`);
    console.log(`Total Records Skipped:  ${totalSkipped}`);
    console.log(`Total Errors:           ${totalErrors}`);
    console.log('');

    console.log('Per-Table Breakdown:');
    console.log('─'.repeat(80));
    console.log(
      'Table'.padEnd(35) +
      'Exported'.padStart(10) +
      'Inserted'.padStart(10) +
      'Skipped'.padStart(10) +
      'Errors'.padStart(10)
    );
    console.log('─'.repeat(80));

    for (const stat of this.stats) {
      if (stat.recordsExported > 0 || stat.errors > 0) {
        console.log(
          stat.tableName.padEnd(35) +
          stat.recordsExported.toString().padStart(10) +
          stat.recordsInserted.toString().padStart(10) +
          stat.recordsSkipped.toString().padStart(10) +
          stat.errors.toString().padStart(10)
        );
      }
    }
    console.log('─'.repeat(80));
    console.log('');

    if (totalErrors === 0) {
      console.log('✅ Migration completed successfully!');
    } else {
      console.log(`⚠️  Migration completed with ${totalErrors} errors - review logs above`);
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const dryRun = args.includes('--dry-run');
  const productionUrl = args.find(arg => arg.startsWith('--prod-url='))?.split('=')[1];
  const conflictStrategy = (args.find(arg => arg.startsWith('--strategy='))?.split('=')[1] || 'skip') as 'skip' | 'upsert' | 'overwrite';
  const batchSize = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '100');
  const useTransactions = args.includes('--use-transactions');

  // Validate arguments
  if (!dryRun && !productionUrl) {
    console.error('❌ Error: Production database URL required for live migration');
    console.log('\nUsage:');
    console.log('  npm run migrate:prod -- --prod-url=<PRODUCTION_DATABASE_URL> [OPTIONS]');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run              Run in dry-run mode (no actual changes)');
    console.log('  --strategy=<strategy>  Conflict resolution: skip, upsert, or overwrite (default: skip)');
    console.log('  --batch-size=<size>    Batch size for imports (default: 100)');
    console.log('  --use-transactions     Wrap each table migration in a transaction (safer, slower)');
    console.log('');
    console.log('Examples:');
    console.log('  # Dry run (test without changes)');
    console.log('  npm run migrate:prod -- --dry-run');
    console.log('');
    console.log('  # Live migration with skip strategy');
    console.log('  npm run migrate:prod -- --prod-url=postgresql://user:pass@host:5432/db --strategy=skip');
    console.log('');
    console.log('  # Live migration with upsert strategy (update existing records)');
    console.log('  npm run migrate:prod -- --prod-url=postgresql://user:pass@host:5432/db --strategy=upsert');
    console.log('');
    console.log('  # Safe migration with transactions enabled');
    console.log('  npm run migrate:prod -- --prod-url=postgresql://user:pass@host:5432/db --use-transactions');
    process.exit(1);
  }

  const options: MigrationOptions = {
    dryRun,
    productionUrl: productionUrl || '',
    conflictStrategy,
    batchSize,
    useTransactions,
  };

  const migration = new DatabaseMigration(options);
  await migration.migrate();
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

export { DatabaseMigration, MigrationOptions };
