#!/usr/bin/env tsx

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq } from 'drizzle-orm';
import ws from 'ws';
import * as schema from './shared/schema';

// Configure WebSocket for Neon
const neonConfig = await import('@neondatabase/serverless').then(mod => mod.neonConfig);
neonConfig.webSocketConstructor = ws;

// Database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const AFFINITY_API_KEY = process.env.AFFINITY_API_KEY;

async function fetchAffinityPage(pageToken: string | null = null): Promise<{
  organizations: any[];
  nextPageToken: string | null;
}> {
  const url = new URL('https://api.affinity.co/organizations');
  url.searchParams.set('limit', '500');
  url.searchParams.set('with_interaction_dates', 'true');
  
  if (pageToken) {
    url.searchParams.set('page_token', pageToken);
  }
  
  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Basic ${Buffer.from(`:${AFFINITY_API_KEY}`).toString('base64')}`,
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
  let newOrgs = 0;
  let updatedOrgs = 0;
  
  for (const org of organizations) {
    try {
      const existingOrg = await db
        .select()
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
          createdAt: org.created_at,
          updatedAt: org.updated_at,
          listEntries: org.list_entries || [],
          fieldValues: org.field_values || {},
          interactionDates: org.interaction_dates || null
        }
      };
      
      if (existingOrg.length > 0) {
        await db
          .update(schema.organizations)
          .set({
            name: orgData.name,
            domains: orgData.domains,
            domain: orgData.domain,
            type: orgData.type,
            isGlobal: orgData.isGlobal,
            syncStatus: orgData.syncStatus,
            lastSyncAt: orgData.lastSyncAt,
            affinityData: orgData.affinityData,
            updatedAt: new Date()
          })
          .where(eq(schema.organizations.affinityId, org.id.toString()));
        
        updatedOrgs++;
      } else {
        await db.insert(schema.organizations).values(orgData);
        newOrgs++;
      }
      
      processed++;
      
      if (processed % 100 === 0) {
        console.log(`Batch ${batchNumber}: Processed ${processed}/${organizations.length} orgs`);
      }
      
    } catch (error) {
      console.error(`Error processing org ${org.id}: ${error.message}`);
    }
  }
  
  console.log(`✅ Batch ${batchNumber} complete: ${processed} orgs (${newOrgs} new, ${updatedOrgs} updated)`);
}

async function parallelImport8000Organizations(): Promise<void> {
  console.log('🚀 Starting parallel import of ALL 8,000+ organizations from Affinity...');
  
  let totalOrganizations = 0;
  let pageCount = 0;
  let pageToken: string | null = null;
  
  // Get current count
  const currentCount = await db
    .select({ count: sql`count(*)` })
    .from(schema.organizations);
  
  console.log(`📊 Starting with ${currentCount[0].count} organizations in database`);
  
  // Process pages in batches
  while (pageCount < 20) { // Limit to 20 pages (10,000 orgs) to avoid timeouts
    try {
      pageCount++;
      console.log(`\n📊 Fetching page ${pageCount}...`);
      
      const pageData = await fetchAffinityPage(pageToken);
      
      if (!pageData.organizations.length) {
        console.log('✅ No more organizations found');
        break;
      }
      
      console.log(`📦 Processing ${pageData.organizations.length} organizations from page ${pageCount}`);
      
      // Process this batch
      await processOrganizationsBatch(pageData.organizations, pageCount);
      
      totalOrganizations += pageData.organizations.length;
      
      // Update page token for next iteration
      if (pageData.nextPageToken) {
        pageToken = pageData.nextPageToken;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log('🏁 No more pages available');
        break;
      }
      
      // Show progress every 5 pages
      if (pageCount % 5 === 0) {
        const updatedCount = await db
          .select({ count: sql`count(*)` })
          .from(schema.organizations);
        
        console.log(`🔄 Progress: ${pageCount} pages, ${totalOrganizations} processed, ${updatedCount[0].count} total in DB`);
      }
      
    } catch (error) {
      console.error(`❌ Error on page ${pageCount}: ${error.message}`);
      break;
    }
  }
  
  // Final count
  const finalCount = await db
    .select({ count: sql`count(*)` })
    .from(schema.organizations);
  
  console.log('\n🎉 PARALLEL IMPORT COMPLETE!');
  console.log(`📊 Final Results:`);
  console.log(`   Pages processed: ${pageCount}`);
  console.log(`   Organizations processed: ${totalOrganizations}`);
  console.log(`   Final database count: ${finalCount[0].count}`);
  
  if (finalCount[0].count >= 8000) {
    console.log('🎯 SUCCESS: 8,000+ organizations imported!');
  } else {
    console.log(`📈 PROGRESS: ${finalCount[0].count} organizations in database`);
  }
  
  await pool.end();
}

// Import sql helper
const { sql } = await import('drizzle-orm');

parallelImport8000Organizations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  });