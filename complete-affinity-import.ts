#!/usr/bin/env tsx

/**
 * Complete Affinity Import - Continue from where we left off
 * Import all remaining organizations from Affinity CRM with proper pagination
 */

import { db } from './server/db';
import { organizations } from './shared/schema';
import { eq } from 'drizzle-orm';

const AFFINITY_API_KEY = process.env.AFFINITY_API_KEY;

async function completeAffinityImport(): Promise<void> {
  console.log('🔄 Completing Affinity organizations import...');
  
  let totalProcessed = 0;
  let newOrganizations = 0;
  let updatedOrganizations = 0;
  let pageCount = 0;
  let pageToken: string | null = null;
  
  // Starting with first page to get initial token
  console.log('📊 Starting from first page to get pagination token...');
  
  try {
    do {
      pageCount++;
      
      // Build URL with pagination
      const baseUrl = 'https://api.affinity.co/organizations';
      const params = new URLSearchParams({
        limit: '500',
        with_interaction_dates: 'true'
      });
      
      if (pageToken) {
        params.append('page_token', pageToken);
      }
      
      const url = `${baseUrl}?${params.toString()}`;
      console.log(`\n📊 Processing page ${pageCount} ${pageToken ? '(continuation)' : '(first page)'}`);
      
      // Make API request
      const response = await fetch(url, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${AFFINITY_API_KEY}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.error(`❌ API Error: ${response.status} ${response.statusText}`);
        break;
      }
      
      const data = await response.json();
      
      if (!data.organizations || data.organizations.length === 0) {
        console.log('✅ No more organizations to process');
        break;
      }
      
      console.log(`📦 Received ${data.organizations.length} organizations`);
      
      // Process all organizations from this page
      for (const org of data.organizations) {
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
            newOrganizations++;
          } else {
            // Update existing organization
            await db.update(organizations)
              .set({ ...orgData, updatedAt: new Date() })
              .where(eq(organizations.id, existing[0].id));
            updatedOrganizations++;
          }
          
          totalProcessed++;
          
        } catch (error) {
          console.error(`❌ Error processing ${org.name}:`, error);
        }
      }
      
      // Progress update
      console.log(`📈 Page ${pageCount} complete: ${totalProcessed} processed, ${newOrganizations} new, ${updatedOrganizations} updated`);
      
      // Get next page token
      pageToken = data.next_page_token || null;
      
      if (pageToken) {
        console.log(`📄 Next page token available, continuing...`);
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        console.log('🏁 No more pages available');
      }
      
    } while (pageToken);
    
    // Final database count
    const finalCount = await db.select().from(organizations);
    
    console.log('\n🎉 Import completed successfully!');
    console.log(`📊 Final Statistics:`);
    console.log(`   - Total organizations processed: ${totalProcessed}`);
    console.log(`   - New organizations added: ${newOrganizations}`);
    console.log(`   - Organizations updated: ${updatedOrganizations}`);
    console.log(`   - Pages processed: ${pageCount}`);
    console.log(`   - Total in database: ${finalCount.length}`);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  }
}

// Run the import
completeAffinityImport()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });