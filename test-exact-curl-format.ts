/**
 * Test Exact cURL Format from Documentation
 * Test: curl "https://api.affinity.co/organizations?term=affinity" -u :$APIKEY
 */

async function testExactCurlFormat(): Promise<void> {
  console.log('🔍 TESTING EXACT CURL FORMAT FROM DOCUMENTATION');
  console.log('================================================');
  
  const apiKey = process.env.AFFINITY_API_KEY;
  if (!apiKey) {
    console.error('❌ No API key found');
    return;
  }
  
  console.log('API Key:', `${apiKey.slice(0, 15)}...`);
  
  // Test the exact format from documentation: -u :$APIKEY means username=empty, password=apikey
  const basicAuth = Buffer.from(`:${apiKey}`).toString('base64');
  
  console.log('\n📊 Testing organizations endpoint with exact format');
  
  try {
    const response = await fetch('https://api.affinity.co/organizations?term=affinity&limit=10', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    const result = await response.text();
    console.log('Response:', result.slice(0, 500));
    
    if (response.ok) {
      const data = JSON.parse(result);
      console.log('✅ SUCCESS! Organizations endpoint working!');
      console.log('Total organizations found:', data.organizations?.length || 0);
      
      if (data.organizations && data.organizations.length > 0) {
        console.log('Sample organizations:');
        data.organizations.slice(0, 3).forEach((org: any, idx: number) => {
          console.log(`${idx + 1}. ${org.name} (${org.domain || 'no domain'})`);
        });
      }
      
      // Test pagination
      if (data.next_page_token) {
        console.log('Next page token available:', data.next_page_token);
      }
      
    } else {
      console.log('❌ Request failed');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  
  // Test with empty term to get all organizations
  console.log('\n📊 Testing organizations endpoint with empty term (all organizations)');
  
  try {
    const response = await fetch('https://api.affinity.co/organizations?term=&limit=100', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    const result = await response.text();
    console.log('Response length:', result.length);
    
    if (response.ok) {
      const data = JSON.parse(result);
      console.log('✅ SUCCESS! All organizations endpoint working!');
      console.log('Total organizations found:', data.organizations?.length || 0);
      
      if (data.organizations && data.organizations.length > 0) {
        console.log('First 5 organizations:');
        data.organizations.slice(0, 5).forEach((org: any, idx: number) => {
          console.log(`${idx + 1}. ${org.name} (${org.domain || 'no domain'})`);
        });
      }
      
      // Check if we have pagination for more results
      if (data.next_page_token) {
        console.log('🎉 More organizations available - pagination token:', data.next_page_token);
      }
      
    } else {
      console.log('❌ Request failed');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testExactCurlFormat().catch(console.error);