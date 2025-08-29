/**
 * Fresh API Test with Direct Environment Variable Access
 */
import { execSync } from 'child_process';

async function freshAPITest(): Promise<void> {
  console.log('🔍 FRESH API TEST');
  console.log('================');
  
  // Get the API key directly from environment
  const apiKey = process.env.AFFINITY_API_KEY;
  
  console.log('API Key from process.env:', apiKey ? `${apiKey.slice(0, 15)}...` : 'not found');
  console.log('API Key length:', apiKey?.length || 0);
  
  if (!apiKey) {
    console.error('❌ No API key in environment');
    return;
  }
  
  // Test with the API key
  const basicAuth = Buffer.from(`${apiKey}:`).toString('base64');
  
  console.log('\n📊 Testing Affinity API with current key');
  
  try {
    // Test authentication endpoint
    const response = await fetch('https://api.affinity.co/v2/auth/whoami', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Auth test - Status: ${response.status} ${response.statusText}`);
    const result = await response.text();
    console.log('Auth test response:', result);
    
    if (response.ok) {
      console.log('✅ Authentication successful!');
      
      // Now test the organizations endpoint
      console.log('\n📊 Testing organizations endpoint');
      
      const orgResponse = await fetch('https://api.affinity.co/v2/organizations?limit=10', {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Organizations - Status: ${orgResponse.status} ${orgResponse.statusText}`);
      const orgResult = await orgResponse.text();
      console.log('Organizations response:', orgResult.slice(0, 500));
      
      if (orgResponse.ok) {
        const orgData = JSON.parse(orgResult);
        console.log('🎉 Organizations endpoint working!');
        console.log('Total organizations found:', orgData.organizations?.length || 0);
        
        if (orgData.organizations && orgData.organizations.length > 0) {
          console.log('Sample organization:', orgData.organizations[0].name);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ API test failed:', error.message);
  }
}

freshAPITest().catch(console.error);