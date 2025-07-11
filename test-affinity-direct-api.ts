/**
 * Test Direct Affinity API Calls
 * Test different authentication methods and endpoints for organizations
 */

import { createAffinityService } from './server/services/affinity-service';

async function testAffinityDirectAPI(): Promise<void> {
  console.log('🔍 TESTING DIRECT AFFINITY API CALLS');
  console.log('====================================');

  const apiKey = process.env.AFFINITY_API_KEY;
  if (!apiKey) {
    console.error('❌ AFFINITY_API_KEY not found in environment variables');
    return;
  }

  const baseUrl = 'https://api.affinity.co';
  console.log(`🔗 Using API Key: ${apiKey.slice(0, 10)}...`);
  console.log(`🔗 Base URL: ${baseUrl}`);

  // Test 1: Direct organizations endpoint with Basic auth
  console.log('\n📊 TEST 1: Organizations endpoint with Basic auth');
  try {
    const basicAuth = Buffer.from(`${apiKey}:`).toString('base64');
    const response1 = await fetch(`${baseUrl}/v2/organizations?limit=10`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`- Status: ${response1.status} ${response1.statusText}`);
    const result1 = await response1.text();
    console.log(`- Response: ${result1.slice(0, 200)}...`);
  } catch (error) {
    console.error('❌ Test 1 failed:', error.message);
  }

  // Test 2: Direct organizations endpoint with Bearer token
  console.log('\n📊 TEST 2: Organizations endpoint with Bearer token');
  try {
    const response2 = await fetch(`${baseUrl}/v2/organizations?limit=10`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`- Status: ${response2.status} ${response2.statusText}`);
    const result2 = await response2.text();
    console.log(`- Response: ${result2.slice(0, 200)}...`);
  } catch (error) {
    console.error('❌ Test 2 failed:', error.message);
  }

  // Test 3: Search organizations endpoint
  console.log('\n📊 TEST 3: Search organizations endpoint');
  try {
    const basicAuth = Buffer.from(`${apiKey}:`).toString('base64');
    const response3 = await fetch(`${baseUrl}/v2/organizations/search?limit=10`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`- Status: ${response3.status} ${response3.statusText}`);
    const result3 = await response3.text();
    console.log(`- Response: ${result3.slice(0, 200)}...`);
  } catch (error) {
    console.error('❌ Test 3 failed:', error.message);
  }

  // Test 4: Companies endpoint (alternative naming)
  console.log('\n📊 TEST 4: Companies endpoint');
  try {
    const basicAuth = Buffer.from(`${apiKey}:`).toString('base64');
    const response4 = await fetch(`${baseUrl}/v2/companies?limit=10`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`- Status: ${response4.status} ${response4.statusText}`);
    const result4 = await response4.text();
    console.log(`- Response: ${result4.slice(0, 200)}...`);
  } catch (error) {
    console.error('❌ Test 4 failed:', error.message);
  }

  // Test 5: Validate current working endpoint (lists)
  console.log('\n📊 TEST 5: Validate current working endpoint (lists)');
  try {
    const basicAuth = Buffer.from(`${apiKey}:`).toString('base64');
    const response5 = await fetch(`${baseUrl}/v2/lists`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`- Status: ${response5.status} ${response5.statusText}`);
    const result5 = await response5.text();
    console.log(`- Response: ${result5.slice(0, 200)}...`);
  } catch (error) {
    console.error('❌ Test 5 failed:', error.message);
  }

  // Test 6: Global search endpoint
  console.log('\n📊 TEST 6: Global search endpoint');
  try {
    const basicAuth = Buffer.from(`${apiKey}:`).toString('base64');
    const response6 = await fetch(`${baseUrl}/v2/search?term=&limit=10`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`- Status: ${response6.status} ${response6.statusText}`);
    const result6 = await response6.text();
    console.log(`- Response: ${result6.slice(0, 200)}...`);
  } catch (error) {
    console.error('❌ Test 6 failed:', error.message);
  }

  console.log('\n✅ API TESTING COMPLETED');
  console.log('========================');
}

// Run the test
testAffinityDirectAPI()
  .then(() => {
    console.log('\n🎉 API testing completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ API testing failed:', error);
    process.exit(1);
  });