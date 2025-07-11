#!/usr/bin/env tsx

/**
 * Import ALL Organizations from Affinity at Once
 * Comprehensive import of all organizations from Affinity CRM
 */

import { db } from './server/db';
import { organizations } from './shared/schema';
import { eq } from 'drizzle-orm';

const AFFINITY_API_KEY = process.env.AFFINITY_API_KEY;

interface AffinityOrganization {
  id: number;
  name: string;
  domain?: string;
  domains?: string[];
  isGlobal?: boolean;
  type?: string;
}

async function makeAffinityRequest(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Basic ${Buffer.from(`:${AFFINITY_API_KEY}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} - ${errorText}`);
  }
  
  return response.json();
}

async function importAllAffinityOrganizations(): Promise<void> {
  console.log('🔄 Starting comprehensive Affinity organizations import...');
  
  let totalImported = 0;
  let newOrganizations = 0;
  let pageToken: string | null = null;
  let pageCount = 0;
  
  do {
    pageCount++;
    console.log(`\n📊 Processing page ${pageCount}`);
    
    try {
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
      console.log(`🔗 Fetching: ${url.replace(pageToken || '', '***')}`);
      
      // Make API request
      const response = await makeAffinityRequest(url);
      
      if (!response.organizations || response.organizations.length === 0) {
        console.log('✅ No more organizations available');
        break;
      }
      
      console.log(`📦 Received ${response.organizations.length} organizations`);
      
      // Process in batches for better performance
      const batchSize = 50;
      for (let i = 0; i < response.organizations.length; i += batchSize) {
        const batch = response.organizations.slice(i, i + batchSize);
        
        for (const org of batch) {
          try {
            // Check if exists
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
              await db.insert(organizations).values(orgData);
              newOrganizations++;
            } else {
              await db.update(organizations)
                .set({ ...orgData, updatedAt: new Date() })
                .where(eq(organizations.id, existing[0].id));
            }
            
            totalImported++;
            
          } catch (error) {
            console.error(`❌ Error processing ${org.name}:`, error);
          }
        }
        
        // Progress update
        console.log(`📈 Processed ${totalImported} organizations (${newOrganizations} new)`);
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Get next page token
      pageToken = response.next_page_token || null;
      console.log(`📄 Page ${pageCount} completed. Next page: ${pageToken ? 'YES' : 'NO'}`);
      
    } catch (error) {
      console.error(`❌ Error on page ${pageCount}:`, error);
      break;
    }
    
  } while (pageToken);
  
  // Final stats
  const finalCount = await db.select().from(organizations);
  
  console.log('\n🎉 Import completed!');
  console.log(`📊 Total organizations imported: ${totalImported}`);
  console.log(`📊 New organizations added: ${newOrganizations}`);
  console.log(`📊 Total organizations in database: ${finalCount.length}`);
  console.log(`📊 Pages processed: ${pageCount}`);
}

// Run the import
importAllAffinityOrganizations()
  .then(() => {
    console.log('\n✅ All organizations imported successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });