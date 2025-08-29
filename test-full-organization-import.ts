#!/usr/bin/env tsx

/**
 * Test Full Organization Import from Affinity
 * This script will import ALL organizations from Affinity with proper pagination
 */

import { db } from './server/db';
import { organizations } from './shared/schema';
import { eq } from 'drizzle-orm';

const AFFINITY_API_KEY = process.env.AFFINITY_API_KEY;

if (!AFFINITY_API_KEY) {
  console.error('❌ AFFINITY_API_KEY environment variable is required');
  process.exit(1);
}

async function fetchAllOrganizations(): Promise<void> {
  console.log('🔄 Starting comprehensive organization import from Affinity...');
  
  let totalOrganizations = 0;
  let newOrganizations = 0;
  let pageToken: string | null = null;
  let pageCount = 0;
  
  do {
    pageCount++;
    console.log(`📊 Fetching page ${pageCount} ${pageToken ? `(token: ${pageToken.slice(0, 20)}...)` : '(first page)'}`);
    
    try {
      // Build the API URL with proper pagination
      const baseUrl = 'https://api.affinity.co/organizations';
      const params = new URLSearchParams({
        limit: '500', // Maximum allowed limit
        with_interaction_dates: 'true'
      });
      
      if (pageToken) {
        params.append('page_token', pageToken);
      }
      
      const url = `${baseUrl}?${params.toString()}`;
      console.log(`🔗 API Request: ${url.replace(pageToken || '', '...')}`);
      
      // Make the API request
      const response = await fetch(url, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${AFFINITY_API_KEY}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error: ${response.status} ${response.statusText}`, errorText);
        break;
      }
      
      const data = await response.json();
      console.log(`📊 Received ${data.organizations?.length || 0} organizations`);
      
      if (!data.organizations || data.organizations.length === 0) {
        console.log('✅ No more organizations to process');
        break;
      }
      
      // Process organizations
      for (const org of data.organizations) {
        try {
          // Check if organization already exists
          const existingOrg = await db.select().from(organizations).where(eq(organizations.affinityId, org.id)).limit(1);
          
          const organizationData = {
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
          
          if (existingOrg.length > 0) {
            // Update existing organization
            await db.update(organizations)
              .set({
                ...organizationData,
                updatedAt: new Date()
              })
              .where(eq(organizations.id, existingOrg[0].id));
          } else {
            // Create new organization
            await db.insert(organizations).values(organizationData);
            newOrganizations++;
          }
          
          totalOrganizations++;
          
          // Progress update
          if (totalOrganizations % 100 === 0) {
            console.log(`📈 Progress: ${totalOrganizations} organizations processed, ${newOrganizations} new`);
          }
          
        } catch (error) {
          console.error(`❌ Error processing organization ${org.name}:`, error);
        }
      }
      
      // Get next page token
      pageToken = data.next_page_token || null;
      console.log(`📊 Page ${pageCount} completed. Next token: ${pageToken ? 'available' : 'none'}`);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`❌ Error fetching page ${pageCount}:`, error);
      break;
    }
    
  } while (pageToken);
  
  console.log('✅ Organization import completed!');
  console.log(`📊 Final Stats:`);
  console.log(`   - Total organizations processed: ${totalOrganizations}`);
  console.log(`   - New organizations added: ${newOrganizations}`);
  console.log(`   - Updated organizations: ${totalOrganizations - newOrganizations}`);
  console.log(`   - Pages processed: ${pageCount}`);
  
  // Final database count
  const finalCount = await db.select().from(organizations);
  console.log(`📊 Total organizations in database: ${finalCount.length}`);
}

// Run the import
fetchAllOrganizations()
  .then(() => {
    console.log('🎉 Import completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  });