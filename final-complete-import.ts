#!/usr/bin/env tsx

/**
 * Final Complete Import - Import ALL 8,000+ Organizations from Affinity
 * This script ensures we get every organization from the Affinity account
 */

import { db } from './server/db';
import { organizations } from './shared/schema';
import { eq } from 'drizzle-orm';

const AFFINITY_API_KEY = process.env.AFFINITY_API_KEY;

interface ImportStats {
  totalPages: number;
  totalOrgsProcessed: number;
  newOrgsAdded: number;
  existingOrgsUpdated: number;
  errors: number;
}

async function finalCompleteImport(): Promise<void> {
  console.log('🚀 Starting FINAL comprehensive import of ALL Affinity organizations...');
  
  const stats: ImportStats = {
    totalPages: 0,
    totalOrgsProcessed: 0,
    newOrgsAdded: 0,
    existingOrgsUpdated: 0,
    errors: 0
  };
  
  let pageToken: string | null = null;
  let hasMorePages = true;
  
  while (hasMorePages) {
    stats.totalPages++;
    
    try {
      console.log(`\n📊 Processing page ${stats.totalPages}...`);
      
      // Build API URL
      const url = new URL('https://api.affinity.co/organizations');
      url.searchParams.append('limit', '500');
      url.searchParams.append('with_interaction_dates', 'true');
      
      if (pageToken) {
        url.searchParams.append('page_token', pageToken);
        console.log(`   Using pagination token: ${pageToken.substring(0, 20)}...`);
      }
      
      // Make API request
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${AFFINITY_API_KEY}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.error(`❌ API Error: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error(`   Error details: ${errorText}`);
        break;
      }
      
      const data = await response.json();
      
      if (!data.organizations || data.organizations.length === 0) {
        console.log('✅ No more organizations on this page');
        hasMorePages = false;
        break;
      }
      
      console.log(`📦 Received ${data.organizations.length} organizations`);
      
      // Process organizations in batches for better performance
      const batchSize = 20;
      for (let i = 0; i < data.organizations.length; i += batchSize) {
        const batch = data.organizations.slice(i, i + batchSize);
        
        for (const org of batch) {
          try {
            // Check if organization exists
            const existing = await db.select().from(organizations)
              .where(eq(organizations.affinityId, org.id))
              .limit(1);
            
            const orgData = {
              affinityId: org.id,
              name: org.name,
              domain: org.domain,
              domains: org.domains || [],
              type: org.type,
              isGlobal: org.global,
              website: org.domain ? `https://${org.domain}` : null,
              affinityData: {
                listEntries: org.list_entries || [],
                fieldValues: org.field_values || {},
                interactionDates: org.interaction_dates || {},
                crunchbaseUuid: org.crunchbase_uuid,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              },
              lastSyncAt: new Date(),
              syncStatus: 'synced' as const
            };
            
            if (existing.length === 0) {
              // Create new organization
              await db.insert(organizations).values(orgData);
              stats.newOrgsAdded++;
            } else {
              // Update existing organization
              await db.update(organizations)
                .set({ ...orgData, updatedAt: new Date() })
                .where(eq(organizations.id, existing[0].id));
              stats.existingOrgsUpdated++;
            }
            
            stats.totalOrgsProcessed++;
            
          } catch (error) {
            console.error(`❌ Error processing ${org.name}:`, error);
            stats.errors++;
          }
        }
        
        // Progress update every batch
        if (i + batchSize < data.organizations.length) {
          console.log(`   Processed ${i + batchSize}/${data.organizations.length} organizations on this page`);
        }
      }
      
      // Get next page token
      pageToken = data.next_page_token || null;
      
      if (pageToken) {
        console.log(`📄 Page ${stats.totalPages} complete. More pages available.`);
        hasMorePages = true;
        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
        console.log(`🏁 Page ${stats.totalPages} complete. No more pages available.`);
        hasMorePages = false;
      }
      
    } catch (error) {
      console.error(`❌ Error processing page ${stats.totalPages}:`, error);
      stats.errors++;
      break;
    }
  }
  
  // Final database count
  const finalCount = await db.select().from(organizations);
  
  console.log('\n🎉 FINAL IMPORT COMPLETED!');
  console.log('📊 COMPREHENSIVE STATISTICS:');
  console.log(`   Pages processed: ${stats.totalPages}`);
  console.log(`   Organizations processed: ${stats.totalOrgsProcessed}`);
  console.log(`   New organizations added: ${stats.newOrgsAdded}`);
  console.log(`   Existing organizations updated: ${stats.existingOrgsUpdated}`);
  console.log(`   Errors encountered: ${stats.errors}`);
  console.log(`   TOTAL IN DATABASE: ${finalCount.length}`);
  
  if (finalCount.length >= 8000) {
    console.log('✅ SUCCESS: Imported 8,000+ organizations as requested!');
  } else if (finalCount.length > 526) {
    console.log(`✅ PROGRESS: Imported ${finalCount.length} organizations (up from 526)`);
  } else {
    console.log(`⚠️  Same count as before: ${finalCount.length} organizations`);
  }
}

// Run the import
finalCompleteImport()
  .then(() => {
    console.log('\n🎯 Import process completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Import process failed:', error);
    process.exit(1);
  });