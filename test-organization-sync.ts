/**
 * Test Organization Sync Service
 * Quick test to verify Affinity organization sync works properly
 */

import { db } from "./server/db";
import { matchingIntelligenceService } from "./server/services/matching-intelligence";
import { organizations } from "./shared/schema";
import { count } from "drizzle-orm";

async function testOrganizationSync(): Promise<void> {
  console.log('🔄 Testing Organization Sync Service...');
  
  try {
    // Check initial count
    const [initialCount] = await db.select({ count: count() }).from(organizations);
    console.log(`📊 Initial organization count: ${initialCount.count}`);
    
    // Run sync
    console.log('🚀 Starting organization sync...');
    const result = await matchingIntelligenceService.syncAllOrganizations();
    
    console.log('✅ Sync completed with result:', {
      success: result.success,
      totalOrganizations: result.organizations,
      newOrganizations: result.newOrganizations,
      errors: result.errors.length
    });
    
    // Check final count
    const [finalCount] = await db.select({ count: count() }).from(organizations);
    console.log(`📊 Final organization count: ${finalCount.count}`);
    
    // Show sample organizations
    if (finalCount.count > 0) {
      const sampleOrgs = await db.query.organizations.findMany({
        limit: 10,
        orderBy: (orgs, { desc }) => [desc(orgs.createdAt)]
      });
      
      console.log('\n📋 Sample organizations:');
      sampleOrgs.forEach(org => {
        console.log(`  - ${org.name} (${org.domain || 'no domain'})`);
      });
    }
    
    if (result.success && result.organizations >= 100) {
      console.log('\n🎉 SUCCESS: Retrieved 100+ organizations from Affinity!');
    } else {
      console.log('\n⚠️  Limited sync - may need API configuration');
    }
    
  } catch (error) {
    console.error('❌ Organization sync test failed:', error);
  }
}

// Run the test
testOrganizationSync().catch(console.error);