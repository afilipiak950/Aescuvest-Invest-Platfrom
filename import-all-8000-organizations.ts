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

/**
 * Import ALL 8,000+ Organizations from Affinity
 * This script will continue fetching until ALL organizations are imported
 */

interface ImportProgress {
  totalPages: number;
  totalOrganizations: number;
  newOrganizations: number;
  updatedOrganizations: number;
  currentBatch: number;
  lastPageSize: number;
}

async function importAll8000Organizations(): Promise<void> {
  console.log('🚀 Starting import of ALL 8,000+ organizations from Affinity...');
  
  const progress: ImportProgress = {
    totalPages: 0,
    totalOrganizations: 0,
    newOrganizations: 0,
    updatedOrganizations: 0,
    currentBatch: 0,
    lastPageSize: 0
  };
  
  let pageToken: string | null = null;
  let consecutiveErrors = 0;
  const maxErrors = 5;
  
  while (consecutiveErrors < maxErrors) {
    progress.totalPages++;
    progress.currentBatch++;
    
    try {
      console.log(`\n📊 Page ${progress.totalPages} - Fetching next batch...`);
      
      // Build API request URL
      const url = new URL('https://api.affinity.co/organizations');
      url.searchParams.set('limit', '500');
      url.searchParams.set('with_interaction_dates', 'true');
      
      if (pageToken) {
        url.searchParams.set('page_token', pageToken);
      }
      
      // Make API request
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${AFFINITY_API_KEY}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error: ${response.status} - ${errorText}`);
        consecutiveErrors++;
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      
      const data = await response.json();
      
      // Check if we have organizations
      if (!data.organizations || data.organizations.length === 0) {
        console.log('✅ No more organizations - import complete!');
        break;
      }
      
      // Process organizations
      const organizations = data.organizations;
      progress.lastPageSize = organizations.length;
      
      console.log(`📦 Processing ${organizations.length} organizations from page ${progress.totalPages}`);
      
      // Process each organization with simple, clean data
      for (const org of organizations) {
        try {
          // Check if organization exists
          const existingOrg = await db
            .select()
            .from(schema.organizations)
            .where(eq(schema.organizations.affinityId, org.id.toString()))
            .limit(1);
          
          // Simple organization data that matches schema exactly
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
            // Update existing organization
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
            
            progress.updatedOrganizations++;
          } else {
            // Insert new organization
            await db
              .insert(schema.organizations)
              .values(orgData);
            
            progress.newOrganizations++;
          }
          
          progress.totalOrganizations++;
          
        } catch (error) {
          console.error(`❌ Error processing organization ${org.id}: ${error.message}`);
          consecutiveErrors++;
          
          if (consecutiveErrors >= maxErrors) {
            console.error('❌ Too many consecutive errors, stopping import');
            break;
          }
        }
      }
      
      // Show progress
      console.log(`✅ Batch ${progress.currentBatch} completed: ${organizations.length} organizations`);
      console.log(`📊 Total: ${progress.totalOrganizations} | New: ${progress.newOrganizations} | Updated: ${progress.updatedOrganizations}`);
      
      // Check for next page
      if (data.next_page_token) {
        pageToken = data.next_page_token;
        consecutiveErrors = 0; // Reset error count on success
        
        // Rate limiting - wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Show progress every 10 pages
        if (progress.totalPages % 10 === 0) {
          console.log(`🔄 Progress: ${progress.totalPages} pages processed, ${progress.totalOrganizations} organizations total`);
        }
      } else {
        console.log('🏁 No more pages - import complete!');
        break;
      }
      
    } catch (error) {
      console.error(`❌ Error on page ${progress.totalPages}: ${error.message}`);
      consecutiveErrors++;
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  // Final statistics
  console.log('\n🎉 IMPORT COMPLETE!');
  console.log('📊 Final Statistics:');
  console.log(`   Total Pages: ${progress.totalPages}`);
  console.log(`   Total Organizations: ${progress.totalOrganizations}`);
  console.log(`   New Organizations: ${progress.newOrganizations}`);
  console.log(`   Updated Organizations: ${progress.updatedOrganizations}`);
  
  // Verify final database count
  const finalCount = await db
    .select({ count: sql`count(*)` })
    .from(schema.organizations);
  
  console.log(`\n✅ Final database count: ${finalCount[0].count} organizations`);
  
  if (progress.totalOrganizations >= 8000) {
    console.log('🎯 SUCCESS: Imported 8,000+ organizations!');
  } else {
    console.log(`📈 PROGRESS: Imported ${progress.totalOrganizations} organizations`);
  }
  
  await pool.end();
}

// Import sql helper
const { sql } = await import('drizzle-orm');

importAll8000Organizations()
  .then(() => {
    console.log('✅ Import script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Import script failed:', error);
    process.exit(1);
  });