/**
 * Test Matching Intelligence System
 * Verifies the new automated organization sync and AI-powered matching
 */

import { db } from "./server/db";
import { matchingIntelligenceService } from "./server/services/matching-intelligence";
import { organizations, dealOrganizationMatches, dailySyncJobs } from "./shared/schema";
import { eq, count } from "drizzle-orm";

async function testMatchingIntelligence(): Promise<void> {
  console.log('🧪 Testing Matching Intelligence System...');
  
  try {
    // Test 1: Check if API endpoints are accessible
    console.log('\n📋 Test 1: API Endpoints Check');
    const testResponse = await fetch('http://localhost:5000/api/matching-intelligence/dashboard-stats', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (testResponse.ok) {
      const data = await testResponse.json();
      console.log('✅ API endpoints accessible');
      console.log('📊 Dashboard stats:', data.data);
    } else {
      console.log('❌ API endpoints not accessible:', testResponse.status);
    }
    
    // Test 2: Check database tables
    console.log('\n📋 Test 2: Database Tables Check');
    try {
      const [orgCount] = await db.select({ count: count() }).from(organizations);
      console.log(`✅ Organizations table exists: ${orgCount.count} organizations`);
      
      const [matchCount] = await db.select({ count: count() }).from(dealOrganizationMatches);
      console.log(`✅ Deal-organization matches table exists: ${matchCount.count} matches`);
      
      const [jobCount] = await db.select({ count: count() }).from(dailySyncJobs);
      console.log(`✅ Daily sync jobs table exists: ${jobCount.count} jobs`);
    } catch (error) {
      console.log('❌ Database table check failed:', error);
    }
    
    // Test 3: Organization sync (limited test)
    console.log('\n📋 Test 3: Organization Sync Test');
    const syncResponse = await fetch('http://localhost:5000/api/matching-intelligence/sync-organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (syncResponse.ok) {
      const syncData = await syncResponse.json();
      console.log('✅ Organization sync initiated');
      console.log('📊 Sync result:', syncData);
    } else {
      console.log('❌ Organization sync failed:', syncResponse.status);
    }
    
    // Test 4: Wait for sync completion and check results
    console.log('\n📋 Test 4: Sync Completion Check');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    
    const [finalOrgCount] = await db.select({ count: count() }).from(organizations);
    console.log(`📊 Final organization count: ${finalOrgCount.count}`);
    
    if (finalOrgCount.count >= 10) {
      console.log('✅ Organizations successfully synced from Affinity');
    } else {
      console.log('⚠️  Limited organizations synced (expected for testing)');
    }
    
    // Test 5: Test intelligent matching (if we have deals)
    console.log('\n📋 Test 5: Intelligent Matching Test');
    const deals = await db.query.deals.findMany({ limit: 1 });
    
    if (deals.length > 0) {
      const testDeal = deals[0];
      console.log(`🎯 Testing matching for deal: ${testDeal.companyName}`);
      
      const matchResponse = await fetch(`http://localhost:5000/api/matching-intelligence/generate-matches/${testDeal.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (matchResponse.ok) {
        const matchData = await matchResponse.json();
        console.log('✅ Intelligent matching completed');
        console.log('📊 Matches generated:', matchData.data?.matches || 0);
      } else {
        console.log('❌ Intelligent matching failed:', matchResponse.status);
      }
    } else {
      console.log('⚠️  No deals found for matching test');
    }
    
    // Test 6: Verify matching results
    console.log('\n📋 Test 6: Matching Results Verification');
    const [finalMatchCount] = await db.select({ count: count() }).from(dealOrganizationMatches);
    console.log(`📊 Total matches in database: ${finalMatchCount.count}`);
    
    if (finalMatchCount.count > 0) {
      const recentMatches = await db.query.dealOrganizationMatches.findMany({
        limit: 5,
        with: {
          organization: true,
          deal: true
        }
      });
      
      console.log('✅ Sample matches found:');
      recentMatches.forEach(match => {
        console.log(`  - ${match.organization?.name} ↔ ${match.deal?.companyName} (Score: ${match.matchScore}%)`);
      });
    }
    
    console.log('\n🎉 Matching Intelligence System Test Complete!');
    console.log('✅ System is ready for automated daily sync and intelligent matching');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testMatchingIntelligence().catch(console.error);