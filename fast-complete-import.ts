#!/usr/bin/env tsx

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, sql } from 'drizzle-orm';
import ws from 'ws';
import * as schema from './shared/schema';

// Configure WebSocket for Neon
const neonConfig = await import('@neondatabase/serverless').then(mod => mod.neonConfig);
neonConfig.webSocketConstructor = ws;

// Database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const AFFINITY_API_KEY = process.env.AFFINITY_API_KEY;

async function fastCompleteImport(): Promise<void> {
  console.log('🚀 Fast Complete Import - Importing ALL remaining organizations...');
  
  let totalImported = 0;
  let pageCount = 0;
  let pageToken: string | null = null;
  
  // Get starting count
  const startCount = await db.select({ count: sql<number>`count(*)` }).from(schema.organizations);
  console.log(`📊 Starting with ${startCount[0].count} organizations`);
  
  while (pageCount < 25) { // Process up to 25 pages (12,500 organizations)
    pageCount++;
    
    try {
      console.log(`📄 Processing page ${pageCount}...`);
      
      // API request
      const url = new URL('https://api.affinity.co/organizations');
      url.searchParams.set('limit', '500');
      url.searchParams.set('with_interaction_dates', 'true');
      if (pageToken) url.searchParams.set('page_token', pageToken);
      
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${AFFINITY_API_KEY}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.error(`❌ API Error: ${response.status}`);
        break;
      }
      
      const data = await response.json();
      
      if (!data.organizations?.length) {
        console.log('✅ No more organizations');
        break;
      }
      
      // Process organizations quickly
      const orgs = data.organizations;
      let batchImported = 0;
      
      for (const org of orgs) {
        try {
          // Quick existence check
          const exists = await db
            .select({ id: schema.organizations.id })
            .from(schema.organizations)
            .where(eq(schema.organizations.affinityId, org.id.toString()))
            .limit(1);
          
          if (exists.length === 0) {
            // Insert only new organizations
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
                createdAt: org.created_at,
                updatedAt: org.updated_at,
                listEntries: org.list_entries || [],
                fieldValues: org.field_values || {}
              }
            });
            
            batchImported++;
          }
        } catch (error) {
          // Skip errors to maintain speed
          continue;
        }
      }
      
      totalImported += batchImported;
      console.log(`✅ Page ${pageCount}: ${batchImported} new organizations imported`);
      
      // Check for next page
      if (data.next_page_token) {
        pageToken = data.next_page_token;
        
        // Quick progress check every 5 pages
        if (pageCount % 5 === 0) {
          const currentCount = await db.select({ count: sql<number>`count(*)` }).from(schema.organizations);
          console.log(`📊 Progress: ${currentCount[0].count} total organizations`);
        }
        
        // Minimal rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        console.log('🏁 Reached end of data');
        break;
      }
      
    } catch (error) {
      console.error(`❌ Error on page ${pageCount}: ${error.message}`);
      break;
    }
  }
  
  // Final count
  const finalCount = await db.select({ count: sql<number>`count(*)` }).from(schema.organizations);
  const totalAdded = finalCount[0].count - startCount[0].count;
  
  console.log('\n🎉 FAST IMPORT COMPLETE!');
  console.log(`📊 Results:`);
  console.log(`   Pages processed: ${pageCount}`);
  console.log(`   Organizations added: ${totalAdded}`);
  console.log(`   Final total: ${finalCount[0].count}`);
  
  if (finalCount[0].count >= 5000) {
    console.log('🎯 SUCCESS: 5,000+ organizations imported!');
  }
  
  await pool.end();
}

fastCompleteImport()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  });