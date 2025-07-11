#!/usr/bin/env tsx

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, sql } from 'drizzle-orm';
import ws from 'ws';
import * as schema from './shared/schema';

const neonConfig = await import('@neondatabase/serverless').then(mod => mod.neonConfig);
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function fetchAffinityPage(pageToken: string | null = null): Promise<{
  organizations: any[];
  nextPageToken: string | null;
}> {
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
    throw new Error(`API Error: ${response.status}`);
  }
  
  const data = await response.json();
  return {
    organizations: data.organizations || [],
    nextPageToken: data.next_page_token || null
  };
}

async function processOrganizationsBatch(organizations: any[], batchNumber: number): Promise<void> {
  let processed = 0;
  let added = 0;
  
  for (const org of organizations) {
    try {
      const exists = await db
        .select({ id: schema.organizations.id })
        .from(schema.organizations)
        .where(eq(schema.organizations.affinityId, org.id.toString()))
        .limit(1);
      
      if (exists.length === 0) {
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
        added++;
      }
      processed++;
    } catch (error) {
      console.error(`Error processing org ${org.id}: ${error.message}`);
    }
  }
  
  console.log(`Batch ${batchNumber}: ${processed} processed, ${added} added`);
}

async function parallelImport8000Organizations(): Promise<void> {
  console.log('🚀 Starting parallel import of 8,000+ organizations...');
  
  const startCount = await db.select({ count: sql<number>`count(*)` }).from(schema.organizations);
  console.log(`Starting with ${startCount[0].count} organizations`);
  
  let totalProcessed = 0;
  let totalAdded = 0;
  let pageCount = 0;
  let pageToken: string | null = null;
  
  try {
    while (pageCount < 40) { // Process up to 40 pages (20,000 organizations)
      pageCount++;
      
      console.log(`Fetching page ${pageCount}...`);
      const { organizations, nextPageToken } = await fetchAffinityPage(pageToken);
      
      if (organizations.length === 0) {
        console.log('No more organizations to process');
        break;
      }
      
      // Process organizations in parallel batches
      const batchSize = 100;
      const batches = [];
      
      for (let i = 0; i < organizations.length; i += batchSize) {
        const batch = organizations.slice(i, i + batchSize);
        batches.push(processOrganizationsBatch(batch, Math.floor(i / batchSize) + 1));
      }
      
      // Wait for all batches to complete
      await Promise.all(batches);
      
      totalProcessed += organizations.length;
      console.log(`Page ${pageCount} complete: ${organizations.length} organizations processed`);
      
      // Progress update every 10 pages
      if (pageCount % 10 === 0) {
        const currentCount = await db.select({ count: sql<number>`count(*)` }).from(schema.organizations);
        console.log(`Progress: ${currentCount[0].count} total organizations in database`);
      }
      
      pageToken = nextPageToken;
      if (!pageToken) {
        console.log('Reached end of data');
        break;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Final count
    const finalCount = await db.select({ count: sql<number>`count(*)` }).from(schema.organizations);
    const imported = finalCount[0].count - startCount[0].count;
    
    console.log('\n🎉 PARALLEL IMPORT COMPLETE!');
    console.log(`Pages processed: ${pageCount}`);
    console.log(`Total organizations processed: ${totalProcessed}`);
    console.log(`Starting count: ${startCount[0].count}`);
    console.log(`Final count: ${finalCount[0].count}`);
    console.log(`Total imported: ${imported}`);
    
    if (finalCount[0].count >= 8000) {
      console.log('🎯 SUCCESS: 8,000+ organizations imported!');
    } else if (finalCount[0].count >= 5000) {
      console.log('🎯 EXCELLENT: 5,000+ organizations imported!');
    } else if (finalCount[0].count >= 2000) {
      console.log('🎯 GOOD: 2,000+ organizations imported!');
    }
    
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await pool.end();
  }
}

parallelImport8000Organizations()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Import failed:', error);
    process.exit(1);
  });