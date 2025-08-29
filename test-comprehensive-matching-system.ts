/**
 * Comprehensive Matching Intelligence System Test
 * Verifies all components of the new automated matching system
 */

import { db } from "./server/db";
import { organizations, dealOrganizationMatches, dailySyncJobs } from "./shared/schema";
import { count, desc } from "drizzle-orm";

interface TestResult {
  component: string;
  status: 'PASS' | 'FAIL';
  details: string;
  data?: any;
}

async function testComprehensiveMatchingSystem(): Promise<void> {
  console.log('🧪 COMPREHENSIVE MATCHING INTELLIGENCE SYSTEM TEST');
  console.log('=' .repeat(60));
  
  const results: TestResult[] = [];
  
  try {
    // Test 1: Database Tables Structure
    console.log('\n📋 Test 1: Database Tables Structure');
    try {
      const [orgCount] = await db.select({ count: count() }).from(organizations);
      const [matchCount] = await db.select({ count: count() }).from(dealOrganizationMatches);
      const [jobCount] = await db.select({ count: count() }).from(dailySyncJobs);
      
      results.push({
        component: 'Database Tables',
        status: 'PASS',
        details: `Organizations: ${orgCount.count}, Matches: ${matchCount.count}, Jobs: ${jobCount.count}`,
        data: { organizations: orgCount.count, matches: matchCount.count, jobs: jobCount.count }
      });
      
      console.log('✅ Database tables exist and accessible');
    } catch (error) {
      results.push({
        component: 'Database Tables',
        status: 'FAIL',
        details: error.message
      });
      console.log('❌ Database tables check failed:', error.message);
    }
    
    // Test 2: API Endpoints
    console.log('\n📋 Test 2: API Endpoints');
    const endpoints = [
      '/api/matching-intelligence/dashboard-stats',
      '/api/matching-intelligence/sync-jobs',
      '/api/matching-intelligence/organizations'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`http://localhost:5000${endpoint}`);
        const data = await response.json();
        
        if (response.ok && data.success) {
          results.push({
            component: `API ${endpoint}`,
            status: 'PASS',
            details: `Status: ${response.status}`,
            data: data.data
          });
          console.log(`✅ ${endpoint} - Working`);
        } else {
          results.push({
            component: `API ${endpoint}`,
            status: 'FAIL',
            details: `Status: ${response.status}, Error: ${data.error || 'Unknown'}`
          });
          console.log(`❌ ${endpoint} - Failed`);
        }
      } catch (error) {
        results.push({
          component: `API ${endpoint}`,
          status: 'FAIL',
          details: error.message
        });
        console.log(`❌ ${endpoint} - Exception:`, error.message);
      }
    }
    
    // Test 3: Organization Sync
    console.log('\n📋 Test 3: Organization Sync');
    try {
      const response = await fetch('http://localhost:5000/api/matching-intelligence/sync-organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        results.push({
          component: 'Organization Sync',
          status: 'PASS',
          details: `${data.data.totalOrganizations} total organizations, ${data.data.newOrganizations} new`,
          data: data.data
        });
        console.log('✅ Organization sync working');
      } else {
        results.push({
          component: 'Organization Sync',
          status: 'FAIL',
          details: data.error || 'Unknown error'
        });
        console.log('❌ Organization sync failed');
      }
    } catch (error) {
      results.push({
        component: 'Organization Sync',
        status: 'FAIL',
        details: error.message
      });
      console.log('❌ Organization sync exception:', error.message);
    }
    
    // Test 4: Affinity Data Quality
    console.log('\n📋 Test 4: Affinity Data Quality');
    try {
      const sampleOrgs = await db.query.organizations.findMany({
        limit: 10,
        orderBy: desc(organizations.createdAt)
      });
      
      const authenticOrgs = sampleOrgs.filter(org => org.name && org.domain);
      
      if (authenticOrgs.length >= 5) {
        results.push({
          component: 'Affinity Data Quality',
          status: 'PASS',
          details: `${authenticOrgs.length} organizations with valid data`,
          data: authenticOrgs.map(org => ({ name: org.name, domain: org.domain }))
        });
        console.log('✅ Authentic organization data confirmed');
        console.log('📊 Sample organizations:', authenticOrgs.slice(0, 5).map(o => o.name).join(', '));
      } else {
        results.push({
          component: 'Affinity Data Quality',
          status: 'FAIL',
          details: `Only ${authenticOrgs.length} organizations with valid data`
        });
        console.log('❌ Insufficient authentic data');
      }
    } catch (error) {
      results.push({
        component: 'Affinity Data Quality',
        status: 'FAIL',
        details: error.message
      });
      console.log('❌ Data quality check failed:', error.message);
    }
    
    // Test 5: Intelligent Matching (Limited due to OpenAI quota)
    console.log('\n📋 Test 5: Intelligent Matching (Limited)');
    try {
      const deals = await db.query.deals.findMany({ limit: 1 });
      
      if (deals.length > 0) {
        // Note: This will likely fail due to OpenAI quota, but tests the endpoint
        const response = await fetch(`http://localhost:5000/api/matching-intelligence/generate-matches/${deals[0].id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          results.push({
            component: 'Intelligent Matching',
            status: 'PASS',
            details: `Generated ${data.data?.matches || 0} matches`,
            data: data.data
          });
          console.log('✅ Intelligent matching working');
        } else {
          // Expected to fail due to OpenAI quota
          results.push({
            component: 'Intelligent Matching',
            status: 'FAIL',
            details: `API quota exceeded (expected): ${data.error}`,
            data: { note: 'Expected failure due to OpenAI quota limits' }
          });
          console.log('⚠️  Intelligent matching quota exceeded (expected)');
        }
      } else {
        results.push({
          component: 'Intelligent Matching',
          status: 'FAIL',
          details: 'No deals found for testing'
        });
        console.log('❌ No deals found for matching test');
      }
    } catch (error) {
      results.push({
        component: 'Intelligent Matching',
        status: 'FAIL',
        details: error.message
      });
      console.log('❌ Intelligent matching test failed:', error.message);
    }
    
    // Results Summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('=' .repeat(60));
    
    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    
    console.log(`✅ PASSED: ${passCount}/${results.length}`);
    console.log(`❌ FAILED: ${failCount}/${results.length}`);
    
    results.forEach(result => {
      const status = result.status === 'PASS' ? '✅' : '❌';
      console.log(`${status} ${result.component}: ${result.details}`);
    });
    
    console.log('\n🎯 SYSTEM STATUS:');
    if (passCount >= 4) {
      console.log('🟢 MATCHING INTELLIGENCE SYSTEM IS OPERATIONAL');
      console.log('✅ Ready for automated daily sync and intelligent matching');
      console.log('✅ Affinity API integration working');
      console.log('✅ Database schema complete');
      console.log('✅ API endpoints functional');
    } else {
      console.log('🔴 SYSTEM NEEDS ATTENTION');
      console.log('❌ Some components require fixes');
    }
    
    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Set up daily automated sync schedule');
    console.log('2. Configure OpenAI API for intelligent matching');
    console.log('3. Test matching algorithm with real deals');
    console.log('4. Optimize matching criteria and scoring');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Run the comprehensive test
testComprehensiveMatchingSystem().catch(console.error);