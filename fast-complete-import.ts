#!/usr/bin/env tsx

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, sql } from 'drizzle-orm';
import ws from 'ws';
import * as schema from './shared/schema';

/**
 * Fast Complete Import - Import ALL remaining organizations from Affinity
 * Fixed timestamp handling to prevent "value.toISOString is not a function" errors
 */

const neonConfig = await import('@neondatabase/serverless').then(mod => mod.neonConfig);
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

function safeTimestamp(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

async function fastCompleteImport(): Promise<void> {
  console.log('🚀 FAST COMPLETE IMPORT - Getting ALL remaining organizations from Affinity...');
  
  let totalProcessed = 0;
  let totalAdded = 0;
  let totalUpdated = 0;
  let totalErrors = 0;
  let pageCount = 0;
  
  const startCount = await db.select({ count: sql<number>`count(*)` }).from(schema.organizations);
  console.log(`📊 Starting with ${startCount[0].count} organizations`);
  
  let pageToken: string | null = null;
  
  // Process ALL pages until we get everything
  while (pageCount < 100) { // Up to 100 pages (50,000 organizations)
    pageCount++;
    
    try {
      console.log(`📄 Processing page ${pageCount}...`);
      
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
        totalErrors++;
        if (totalErrors > 5) break;
        continue;
      }
      
      const data = await response.json();
      
      if (!data.organizations || data.organizations.length === 0) {
        console.log('✅ No more organizations to process');
        break;
      }
      
      const organizations = data.organizations;
      totalProcessed += organizations.length;
      
      console.log(`🔄 Processing ${organizations.length} organizations from page ${pageCount}...`);
      
      // Process organizations in smaller batches for better performance
      const batchSize = 25;
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
            
            // Prepare organization data with safe timestamp handling
            const organizationData = {
              affinityId: org.id.toString(),
              name: org.name,
              domains: org.domains || [],
              domain: org.domain || null,
              type: org.type || "organization",
              isGlobal: org.is_global || false,
              syncStatus: "synced",
              lastSyncAt: new Date(), // Always use current date
              affinityData: {
                createdAt: org.created_at || null,
                updatedAt: org.updated_at || null,
                listEntries: org.list_entries || [],
                fieldValues: org.field_values || {},
                interactionDates: org.interaction_dates || {}
              }
            };
            
            if (existingOrg.length === 0) {
              // Insert new organization
              await db.insert(schema.organizations).values(organizationData);
              totalAdded++;
            } else {
              // Update existing organization
              await db
                .update(schema.organizations)
                .set(organizationData)
                .where(eq(schema.organizations.affinityId, org.id.toString()));
              totalUpdated++;
            }
            
          } catch (error) {
            console.error(`❌ Error processing org ${org.id}: ${error.message}`);
            totalErrors++;
          }
        }
      }
      
      console.log(`✅ Page ${pageCount} complete: ${totalAdded} new, ${totalUpdated} updated, ${totalErrors} errors`);
      
      // Check for next page
      pageToken = data.next_page_token || null;
      if (!pageToken) {
        console.log('✅ No more pages to process');
        break;
      }
      
      // Small delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Error processing page ${pageCount}: ${error.message}`);
      totalErrors++;
      if (totalErrors > 10) break;
    }
  }
  
  const finalCount = await db.select({ count: sql<number>`count(*)` }).from(schema.organizations);
  
  console.log(`\n🎉 IMPORT COMPLETE!`);
  console.log(`📊 Final Statistics:`);
  console.log(`   • Total Pages Processed: ${pageCount}`);
  console.log(`   • Total Organizations Processed: ${totalProcessed}`);
  console.log(`   • New Organizations Added: ${totalAdded}`);
  console.log(`   • Existing Organizations Updated: ${totalUpdated}`);
  console.log(`   • Errors Encountered: ${totalErrors}`);
  console.log(`   • Final Database Count: ${finalCount[0].count}`);
  console.log(`   • Net Growth: ${finalCount[0].count - startCount[0].count}`);
  
  await pool.end();
}

// Run the import
fastCompleteImport().catch(console.error);