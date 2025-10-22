# Database Migration to Production

This script migrates all data from the development database to the production database.

## ⚠️ CRITICAL SAFETY WARNINGS

### Overwrite Strategy Risk
**WARNING**: The `overwrite` strategy is DANGEROUS and can cause data loss:
- Each record is DELETED then re-inserted in a transaction
- Network failures or constraint errors can lose data permanently
- **DO NOT USE in production without full database backup**
- **Recommended**: Use `skip` or `upsert` instead

### Transaction Safety
- Add `--use-transactions` flag for atomic table migrations
- Without transactions, failures leave partial imports
- With transactions, entire table rolls back on any error
- Trade-off: Slower but safer (recommended for production)

### Best Practices
1. **Always backup production database before migration**
2. **Test with `--dry-run` first**
3. **Use `skip` strategy for initial migrations**
4. **Use `upsert` strategy for syncing updates**
5. **Avoid `overwrite` strategy unless absolutely necessary**
6. **Enable `--use-transactions` for critical migrations**

## Features

- ✅ **Safe Migration**: Respects foreign key dependencies
- ✅ **Dry Run Mode**: Test migration without making changes
- ✅ **Conflict Resolution**: Skip, upsert, or overwrite existing records
- ✅ **Batch Processing**: Handles large datasets efficiently
- ✅ **Progress Tracking**: Real-time progress updates
- ✅ **Sequence Reset**: Automatically resets PostgreSQL sequences
- ✅ **Error Handling**: Continues on errors and reports them

## Usage

### 1. Dry Run (Recommended First Step)

Test the migration without making any changes:

```bash
npm run migrate:prod -- --dry-run
```

This will:
- Connect to development database
- Count records in each table
- Show what would be migrated
- NOT connect to production or make any changes

### 2. Live Migration with Skip Strategy

Migrate data, skipping existing records (safest):

```bash
npm run migrate:prod -- --prod-url=postgresql://user:password@host:5432/production_db --strategy=skip
```

### 3. Live Migration with Upsert Strategy

Migrate data, updating existing records:

```bash
npm run migrate:prod -- --prod-url=postgresql://user:password@host:5432/production_db --strategy=upsert
```

### 4. Live Migration with Overwrite Strategy

Migrate data, replacing existing records (use with caution):

```bash
npm run migrate:prod -- --prod-url=postgresql://user:password@host:5432/production_db --strategy=overwrite
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--prod-url=<url>` | Production database connection string (required for live migration) | - |
| `--dry-run` | Run without making changes | false |
| `--strategy=<strategy>` | Conflict resolution: `skip`, `upsert`, or `overwrite` | `skip` |
| `--batch-size=<size>` | Number of records per batch | 100 |
| `--use-transactions` | Wrap each table migration in a transaction (safer, slower) | false |

## Migration Order

Tables are migrated in dependency order to respect foreign keys:

1. **Independent tables**: users, system_settings, organizations
2. **Deals**: deals (references users)
3. **Documents**: documents (references deals)
4. **Analyses**: agent_analyses, comprehensive_analysis, comprehensive_hr_analyses
5. **Research**: company_research, research_jobs
6. **Memos**: investment_memos
7. **Embeddings**: document_embeddings, query_cache
8. **Jobs**: background_jobs, research_background_jobs
9. **Matches**: deal_organization_matches, deal_investor_matches
10. **Other**: automations, evaluation_criteria, etc.

## Conflict Resolution Strategies

### Skip (Safest) ✅
- Inserts new records only
- Skips records that already exist
- **No data loss risk**
- Best for: Initial migration or adding new data

### Upsert (Recommended) ✅
- Inserts new records
- Updates existing records with new data
- **No data loss risk** (preserves existing data, updates it)
- Best for: Syncing changes between environments

### Overwrite ⚠️ DANGEROUS
- **Deletes** existing records, then re-inserts them
- **Protected by transaction**: DELETE and INSERT are atomic (both succeed or both fail)
- **Risk**: Can lose data if there are constraint errors or transaction failures
- **Use**: Only with full backup and testing
- **Better alternative**: Drop and recreate tables manually, then use skip strategy

## Examples

### Example 1: First-time Migration

```bash
# Step 1: Dry run to verify
npm run migrate:prod -- --dry-run

# Step 2: Live migration with skip strategy
npm run migrate:prod -- --prod-url=$PRODUCTION_DATABASE_URL --strategy=skip
```

### Example 2: Sync Updates

```bash
# Upsert to update existing records and add new ones
npm run migrate:prod -- --prod-url=$PRODUCTION_DATABASE_URL --strategy=upsert
```

### Example 3: Large Dataset

```bash
# Use larger batch size for faster migration
npm run migrate:prod -- --prod-url=$PRODUCTION_DATABASE_URL --batch-size=500
```

### Example 4: Safe Migration with Transactions

```bash
# Enable transactions for atomic table migrations (recommended for production)
npm run migrate:prod -- --prod-url=$PRODUCTION_DATABASE_URL --strategy=upsert --use-transactions
```

## Output

The script provides detailed output:

```
========================================
🚀 DATABASE MIGRATION STARTING
========================================

Mode: ⚡ LIVE MIGRATION
Conflict Strategy: SKIP
Batch Size: 100
Use Transactions: YES ✅

🔗 Connecting to development database...
✅ Connected to development database
🔗 Connecting to production database...
✅ Connected to production database

📋 Migrating 30 tables in dependency order

🔄 Migrating table: users
   Primary Key: id, Serial ID: true
📤 Exporting users...
   Found 5 records
📥 Importing 5 records to users...
   Progress: 100% (5 inserted, 0 skipped, 0 errors)
   🔢 Reset sequence users_id_seq to 5
   ✅ Completed users: 5 inserted, 0 skipped, 0 errors

...

========================================
📊 MIGRATION SUMMARY
========================================

Total Records Exported: 1,234
Total Records Inserted: 1,234
Total Records Skipped:  0
Total Errors:           0

Per-Table Breakdown:
────────────────────────────────────────────────────────────────────────────────
Table                              Exported  Inserted   Skipped    Errors
────────────────────────────────────────────────────────────────────────────────
users                                     5         5         0         0
deals                                   123       123         0         0
documents                               456       456         0         0
...
────────────────────────────────────────────────────────────────────────────────

✅ Migration completed successfully!
```

## Safety Notes

1. **Always test with --dry-run first** to verify migration plan
2. **Backup production database before migration** (CRITICAL)
3. **Use skip strategy for first migration** (safest option)
4. **Use upsert strategy for sync updates** (safe and efficient)
5. **Avoid overwrite strategy** unless you have a full backup
6. **Enable --use-transactions** for atomic table migrations (recommended)
7. **Monitor for errors in the output** during migration
8. **Verify data after migration** with spot checks

## Troubleshooting

### Connection Errors

If you get connection errors:
- Verify production database URL is correct
- Check network connectivity to production
- Ensure database user has necessary permissions

### Foreign Key Errors

If you get foreign key constraint errors:
- The migration order should handle this automatically
- Check if production database has existing data that conflicts
- **DO NOT use `--strategy=overwrite`** without a full backup
- Consider manually cleaning up conflicting data first

### Sequence Errors

If auto-increment IDs don't work after migration:
- The script automatically resets sequences
- If you see sequence errors, manually reset: `SELECT setval('table_id_seq', (SELECT MAX(id) FROM table));`

## Advanced Usage

### Environment Variable for Production URL

Set the production URL as an environment variable:

```bash
export PRODUCTION_DATABASE_URL="postgresql://user:password@host:5432/production_db"
npm run migrate:prod -- --prod-url=$PRODUCTION_DATABASE_URL --strategy=skip
```

### Programmatic Usage

You can also use the script programmatically:

```typescript
import { DatabaseMigration, MigrationOptions } from './server/scripts/migrate-to-production';

const options: MigrationOptions = {
  dryRun: false,
  productionUrl: process.env.PRODUCTION_DATABASE_URL!,
  conflictStrategy: 'skip',
  batchSize: 100,
  useTransactions: true,
};

const migration = new DatabaseMigration(options);
await migration.migrate();
```

## Support

If you encounter issues, check:
1. Database connection strings are correct
2. Both databases have the same schema (run migrations on production first)
3. User has proper permissions (SELECT on dev, INSERT/UPDATE on prod)
4. Network connectivity between environments
