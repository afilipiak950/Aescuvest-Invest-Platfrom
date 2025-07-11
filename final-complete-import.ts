#!/usr/bin/env tsx

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, sql } from 'drizzle-orm';
import ws from 'ws';
import * as schema from './shared/schema';

/**
 * Final Complete Import - Import ALL 8,000+ Organizations from Affinity
 * This script ensures we get every organization from the Affinity account
 */

const neonConfig = await import('@neondatabase/serverless').then(mod => mod.neonConfig);
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

interface ImportStats {
  totalPages: number;
  totalOrgsProcessed: number;
  newOrgsAdded: number;
  existingOrgsUpdated: number;
  errors: number;
}

async function finalCompleteImport(): Promise<void> {
  console.log('🚀 FINAL COMPLETE IMPORT - Getting ALL organizations from Affinity...');
  
  const stats: ImportStats = {
    totalPages: 0,
    totalOrgsProcessed: 0,
    newOrgsAdded: 0,
    existingOrgsUpdated: 0,
    errors: 0
  };
  
  let pageToken: string | null = null;
  const startCount = await db.select({ count: sql<number>`count(*)` }).from(schema.organizations);
  console.log(`📊 Starting with ${startCount[0].count} organizations`);
  
  // Process ALL pages until we get everything
  while (stats.totalPages < 50) { // Up to 50 pages (25,000 organizations)
    stats.totalPages++;
    
    try {
      console.log(`📄 Processing page ${stats.totalPages}...`);
      
      const url = new URL('https://api.affinity.co/organizations');
      url.searchParams.set('limit', '500');
      url.searchParams.set('with_interaction_dates', 'true');
      if (pageToken) url.searchParams.set('page_token', pageToken);
      
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${process.env.AFFINITY_API_KEY}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.error(`❌ API Error: ${response.status} ${response.statusText}`);
        stats.errors++;
        if (stats.errors > 3) break;
        continue;
      }
      
      const data = await response.json();
      
      if (!data.organizations || data.organizations.length === 0) {
        console.log('✅ No more organizations to process');
        break;
      }
      
      const organizations = data.organizations;
      stats.totalOrgsProcessed += organizations.length;
      
      // Process organizations in smaller batches for better performance
      const batchSize = 50;
      for (let i = 0; i < organizations.length; i += batchSize) {
        const batch = organizations.slice(i, i + batchSize);
        
        for (const org of batch) {
          try {
            // Check if organization exists
            const existingOrg = await db
              .select({ id: schema.organizations.id })
              .from(schema.organizations)
              .where(eq(schema.organizations.affinityId, org.id.toString()))
              .limit(1);
            
            if (existingOrg.length === 0) {
              // Insert new organization with proper timestamp handling
              await db.insert(schema.organizations).values({
                affinityId: org.id.toString(),
                name: org.name,
                domains: org.domains || [],
                domain: org.domain || null,
                type: org.type || "organization",
                isGlobal: org.is_global || false,
                syncStatus: "synced",
                lastSyncAt: new Date(),
                affinityData: {
                  createdAt: org.created_at ? new Date(org.created_at).toISOString() : null,
                  updatedAt: org.updated_at ? new Date(org.updated_at).toISOString() : null,
                  listEntries: org.list_entries || [],
                  fieldValues: org.field_values || {}
                }
              });
              
              stats.newOrgsAdded++;
            } else {
              // Update existing organization with proper timestamp handling
              await db
                .update(schema.organizations)
                .set({
                  name: org.name,
                  domains: org.domains || [],
                  domain: org.domain || null,
                  type: org.type || "organization",
                  isGlobal: org.is_global || false,
                  syncStatus: "synced",
                  lastSyncAt: new Date(),
                  affinityData: {
                    createdAt: org.created_at ? new Date(org.created_at).toISOString() : null,
                    updatedAt: org.updated_at ? new Date(org.updated_at).toISOString() : null,
                    listEntries: org.list_entries || [],
                    fieldValues: org.field_values || {}
                  }
                })
                .where(eq(schema.organizations.affinityId, org.id.toString()));
              
              stats.existingOrgsUpdated++;
            }
          } catch (error) {
            console.error(`❌ Error processing org ${org.id}: ${error.message}`);
            stats.errors++;
          }
        }
      }
      
      console.log(`✅ Page ${stats.totalPages} complete: ${stats.newOrgsAdded} new, ${stats.existingOrgsUpdated} updated`);
      
      // Check for next page
      pageToken = data.next_page_token;
      if (!pageToken) {
        console.log('🏁 Reached end of data - no more pages');
        break;
      }
      
      // Progress report every 10 pages
      if (stats.totalPages % 10 === 0) {
        const currentCount = await db.select({ count: sql<number>`count(*)` }).from(schema.organizations);
        console.log(`📈 Progress Report:`);
        console.log(`   Pages processed: ${stats.totalPages}`);
        console.log(`   Total orgs processed: ${stats.totalOrgsProcessed}`);
        console.log(`   New orgs added: ${stats.newOrgsAdded}`);
        console.log(`   Current database count: ${currentCount[0].count}`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Error on page ${stats.totalPages}: ${error.message}`);
      stats.errors++;
      if (stats.errors > 5) {
        console.log('❌ Too many errors, stopping import');
        break;
      }
    }
  }
  
  // Final statistics
  const finalCount = await db.select({ count: sql<number>`count(*)` }).from(schema.organizations);
  const totalImported = finalCount[0].count - startCount[0].count;
  
  console.log('\n🎉 FINAL IMPORT COMPLETE!');
  console.log(`📊 Final Statistics:`);
  console.log(`   Pages processed: ${stats.totalPages}`);
  console.log(`   Total organizations processed: ${stats.totalOrgsProcessed}`);
  console.log(`   New organizations added: ${stats.newOrgsAdded}`);
  console.log(`   Existing organizations updated: ${stats.existingOrgsUpdated}`);
  console.log(`   Errors encountered: ${stats.errors}`);
  console.log(`   Starting count: ${startCount[0].count}`);
  console.log(`   Final count: ${finalCount[0].count}`);
  console.log(`   Total imported this session: ${totalImported}`);
  
  if (finalCount[0].count >= 8000) {
    console.log('🎯 SUCCESS: 8,000+ organizations imported!');
  } else if (finalCount[0].count >= 5000) {
    console.log('🎯 EXCELLENT: 5,000+ organizations imported!');
  } else if (finalCount[0].count >= 2000) {
    console.log('🎯 GOOD: 2,000+ organizations imported!');
  }
  
  await pool.end();
}

finalCompleteImport()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  });