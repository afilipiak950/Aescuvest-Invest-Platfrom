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

async function completeRemainingImport(): Promise<void> {
  console.log('🚀 Starting complete import of remaining organizations...');
  
  let totalPages = 0;
  let totalImported = 0;
  let pageToken: string | null = null;
  
  const startCount = await db.select({ count: sql<number>`count(*)` }).from(schema.organizations);
  console.log(`Starting with ${startCount[0].count} organizations`);
  
  while (totalPages < 30) { // Process up to 30 pages
    totalPages++;
    
    try {
      // Fetch page
      const url = new URL('https://api.affinity.co/organizations');
      url.searchParams.set('limit', '500');
      if (pageToken) url.searchParams.set('page_token', pageToken);
      
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${process.env.AFFINITY_API_KEY}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) break;
      
      const data = await response.json();
      if (!data.organizations?.length) break;
      
      // Process organizations in batch
      const organizations = data.organizations;
      const batchResults = await Promise.allSettled(
        organizations.map(async (org: any) => {
          const exists = await db
            .select({ id: schema.organizations.id })
            .from(schema.organizations)
            .where(eq(schema.organizations.affinityId, org.id.toString()))
            .limit(1);
          
          if (exists.length === 0) {
            return db.insert(schema.organizations).values({
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
          }
          return null;
        })
      );
      
      const successful = batchResults.filter(r => r.status === 'fulfilled' && r.value !== null).length;
      totalImported += successful;
      
      console.log(`Page ${totalPages}: ${successful} new organizations imported`);
      
      // Check for next page
      pageToken = data.next_page_token;
      if (!pageToken) break;
      
      // Progress update every 5 pages
      if (totalPages % 5 === 0) {
        const currentCount = await db.select({ count: sql<number>`count(*)` }).from(schema.organizations);
        console.log(`Progress: ${currentCount[0].count} total organizations`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 800));
      
    } catch (error) {
      console.error(`Error on page ${totalPages}: ${error.message}`);
      break;
    }
  }
  
  const finalCount = await db.select({ count: sql<number>`count(*)` }).from(schema.organizations);
  console.log(`\nCOMPLETE! Final count: ${finalCount[0].count} organizations`);
  console.log(`Total imported: ${finalCount[0].count - startCount[0].count}`);
  
  await pool.end();
}

completeRemainingImport()
  .then(() => console.log('Import finished'))
  .catch(error => console.error('Import failed:', error));