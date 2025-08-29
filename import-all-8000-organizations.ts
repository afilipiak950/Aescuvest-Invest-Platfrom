#!/usr/bin/env tsx

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, sql } from 'drizzle-orm';
import ws from 'ws';
import * as schema from './shared/schema';

/**
 * Import ALL 8,000+ Organizations from Affinity
 * This script will continue fetching until ALL organizations are imported
 */

const neonConfig = await import('@neondatabase/serverless').then(mod => mod.neonConfig);
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

interface ImportProgress {
  totalPages: number;
  totalOrganizations: number;
  newOrganizations: number;
  updatedOrganizations: number;
  currentBatch: number;
  lastPageSize: number;
}

async function importAll8000Organizations(): Promise<void> {
  console.log('🚀 IMPORTING ALL 8,000+ ORGANIZATIONS FROM AFFINITY...');
  
  const progress: ImportProgress = {
    totalPages: 0,
    totalOrganizations: 0,
    newOrganizations: 0,
    updatedOrganizations: 0,
    currentBatch: 0,
    lastPageSize: 0
  };
  
  let pageToken: string | null = null;
  const startTime = Date.now();
  
  // Get initial count
  const initialCount = await db.select({ count: sql<number>`count(*)` }).from(schema.organizations);
  console.log(`📊 Starting with ${initialCount[0].count} organizations`);
  
  try {
    // Continue importing until we have all organizations
    while (progress.totalPages < 50) { // Up to 50 pages (25,000 organizations)
      progress.totalPages++;
      progress.currentBatch++;
      
      console.log(`📄 Fetching page ${progress.totalPages}...`);
      
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
        break;
      }
      
      const data = await response.json();
      
      if (!data.organizations || data.organizations.length === 0) {
        console.log('✅ No more organizations to import');
        break;
      }
      
      progress.lastPageSize = data.organizations.length;
      progress.totalOrganizations += progress.lastPageSize;
      
      // Process organizations in batches
      const batchSize = 25;
      const organizations = data.organizations;
      
      for (let i = 0; i < organizations.length; i += batchSize) {
        const batch = organizations.slice(i, i + batchSize);
        
        const promises = batch.map(async (org: any) => {
          try {
            const existingOrg = await db
              .select({ id: schema.organizations.id })
              .from(schema.organizations)
              .where(eq(schema.organizations.affinityId, org.id.toString()))
              .limit(1);
            
            const orgData = {
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
            };
            
            if (existingOrg.length === 0) {
              await db.insert(schema.organizations).values(orgData);
              progress.newOrganizations++;
            } else {
              await db
                .update(schema.organizations)
                .set(orgData)
                .where(eq(schema.organizations.affinityId, org.id.toString()));
              progress.updatedOrganizations++;
            }
          } catch (error) {
            console.error(`❌ Error processing ${org.name}: ${error.message}`);
          }
        });
        
        await Promise.all(promises);
      }
      
      console.log(`✅ Page ${progress.totalPages}: ${progress.lastPageSize} organizations processed`);
      console.log(`   New: ${progress.newOrganizations}, Updated: ${progress.updatedOrganizations}`);
      
      // Progress report every 5 pages
      if (progress.totalPages % 5 === 0) {
        const currentCount = await db.select({ count: sql<number>`count(*)` }).from(schema.organizations);
        const elapsedTime = Math.round((Date.now() - startTime) / 1000);
        console.log(`\n📈 PROGRESS REPORT:`);
        console.log(`   Pages processed: ${progress.totalPages}`);
        console.log(`   Organizations processed: ${progress.totalOrganizations}`);
        console.log(`   Current database count: ${currentCount[0].count}`);
        console.log(`   Time elapsed: ${elapsedTime}s`);
        console.log(`   Rate: ${Math.round(progress.totalOrganizations / (elapsedTime / 60))} orgs/min\n`);
      }
      
      // Check for next page
      pageToken = data.next_page_token;
      if (!pageToken) {
        console.log('🏁 Reached end of all available data');
        break;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    // Final results
    const finalCount = await db.select({ count: sql<number>`count(*)` }).from(schema.organizations);
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    const totalImported = finalCount[0].count - initialCount[0].count;
    
    console.log('\n🎉 IMPORT COMPLETE!');
    console.log(`📊 FINAL RESULTS:`);
    console.log(`   Pages processed: ${progress.totalPages}`);
    console.log(`   Organizations processed: ${progress.totalOrganizations}`);
    console.log(`   New organizations added: ${progress.newOrganizations}`);
    console.log(`   Organizations updated: ${progress.updatedOrganizations}`);
    console.log(`   Starting count: ${initialCount[0].count}`);
    console.log(`   Final count: ${finalCount[0].count}`);
    console.log(`   Net imported: ${totalImported}`);
    console.log(`   Total time: ${totalTime}s`);
    console.log(`   Average rate: ${Math.round(progress.totalOrganizations / (totalTime / 60))} orgs/min`);
    
    if (finalCount[0].count >= 8000) {
      console.log('🎯 SUCCESS: 8,000+ organizations imported!');
    } else if (finalCount[0].count >= 5000) {
      console.log('🎯 EXCELLENT: 5,000+ organizations imported!');
    } else if (finalCount[0].count >= 2000) {
      console.log('🎯 GOOD: 2,000+ organizations imported!');
    }
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  } finally {
    await pool.end();
  }
}

importAll8000Organizations()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  });