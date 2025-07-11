/**
 * Import ALL Organizations from Affinity at Once
 * Comprehensive import of all organizations from Affinity CRM
 */

import { db } from "./server/db";
import { organizations } from "./shared/schema";
import { eq } from "drizzle-orm";

interface AffinityOrganization {
  id: number;
  name: string;
  domain?: string;
  domains?: string[];
  isGlobal?: boolean;
  type?: string;
}

interface AffinityListEntry {
  id: number;
  listId: number;
  type: string;
  createdAt: string;
  entity: AffinityOrganization;
}

interface AffinityResponse {
  data: AffinityListEntry[];
  pagination?: {
    nextUrl?: string;
    prevUrl?: string;
  };
}

async function makeAffinityRequest(url: string): Promise<any> {
  const apiKey = process.env.AFFINITY_API_KEY;
  if (!apiKey) {
    throw new Error('AFFINITY_API_KEY is not configured');
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Affinity API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function importAllAffinityOrganizations(): Promise<void> {
  console.log('🚀 Starting comprehensive import of ALL Affinity organizations...');
  
  try {
    // Step 1: Get all lists
    console.log('📋 Step 1: Fetching all Affinity lists...');
    const listsResponse = await makeAffinityRequest('https://api.affinity.co/v2/lists');
    const allLists = listsResponse.data || [];
    
    console.log(`📊 Found ${allLists.length} lists in Affinity`);
    allLists.forEach(list => {
      console.log(`  - ${list.name} (ID: ${list.id}, Type: ${list.type})`);
    });
    
    // Step 2: Get organizations from all company lists
    const companyLists = allLists.filter(list => list.type === 'company');
    console.log(`\n🏢 Found ${companyLists.length} company lists`);
    
    let totalOrganizations = 0;
    let newOrganizations = 0;
    
    for (const list of companyLists) {
      console.log(`\n📁 Processing list: ${list.name} (ID: ${list.id})`);
      
      let cursor: string | undefined;
      let pageCount = 0;
      
      do {
        pageCount++;
        console.log(`  📄 Fetching page ${pageCount}...`);
        
        // Build URL with cursor if available
        let url = `https://api.affinity.co/v2/lists/${list.id}/list-entries?limit=100&with_interaction_dates=true`;
        if (cursor) {
          url += `&cursor=${encodeURIComponent(cursor)}`;
        }
        
        const response: AffinityResponse = await makeAffinityRequest(url);
        const organizations = response.data || [];
        
        console.log(`    ✓ Found ${organizations.length} organizations in this page`);
        
        // Process each organization
        for (const entry of organizations) {
          if (entry.type === 'company' && entry.entity) {
            const org = entry.entity;
            
            try {
              // Check if organization already exists
              const existingOrg = await db.query.organizations.findFirst({
                where: eq(organizations.affinityId, org.id.toString())
              });
              
              if (!existingOrg) {
                // Insert new organization
                await db.insert(organizations).values({
                  affinityId: org.id.toString(),
                  name: org.name,
                  domain: org.domain || null,
                  domains: org.domains || [],
                  type: 'organization',
                  isGlobal: org.isGlobal || false,
                  lastSyncAt: new Date(),
                  syncStatus: 'completed'
                });
                
                newOrganizations++;
                console.log(`    ✅ Added: ${org.name} (${org.domain || 'no domain'})`);
              } else {
                // Update existing organization
                await db.update(organizations)
                  .set({
                    name: org.name,
                    domain: org.domain || null,
                    domains: org.domains || [],
                    isGlobal: org.isGlobal || false,
                    lastSyncAt: new Date(),
                    syncStatus: 'completed'
                  })
                  .where(eq(organizations.affinityId, org.id.toString()));
                
                console.log(`    🔄 Updated: ${org.name}`);
              }
              
              totalOrganizations++;
            } catch (error) {
              console.error(`    ❌ Error processing ${org.name}:`, error.message);
            }
          }
        }
        
        // Check for next page
        cursor = response.pagination?.nextUrl ? 
          new URL(response.pagination.nextUrl).searchParams.get('cursor') : undefined;
        
        console.log(`    📊 Page ${pageCount} complete. Cursor: ${cursor ? 'Yes' : 'No'}`);
        
        // Add small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } while (cursor);
      
      console.log(`  ✅ Completed list "${list.name}": processed ${totalOrganizations} organizations`);
    }
    
    // Step 3: Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 COMPREHENSIVE IMPORT COMPLETE!');
    console.log('='.repeat(60));
    console.log(`✅ Total organizations processed: ${totalOrganizations}`);
    console.log(`🆕 New organizations added: ${newOrganizations}`);
    console.log(`🔄 Existing organizations updated: ${totalOrganizations - newOrganizations}`);
    
    // Step 4: Verify final count
    const finalCount = await db.query.organizations.findMany();
    console.log(`📈 Final database count: ${finalCount.length} organizations`);
    
    // Step 5: Show sample organizations
    if (finalCount.length > 0) {
      console.log('\n📋 Sample organizations in database:');
      finalCount.slice(0, 10).forEach((org, index) => {
        console.log(`${index + 1}. ${org.name} (${org.domain || 'no domain'})`);
      });
    }
    
    console.log('\n🎉 All Affinity organizations successfully imported!');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  }
}

// Run the comprehensive import
importAllAffinityOrganizations().catch(console.error);