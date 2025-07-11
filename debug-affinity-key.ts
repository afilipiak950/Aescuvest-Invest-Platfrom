/**
 * Debug Affinity API Key and Test Real Endpoint
 */

async function debugAffinityKey(): Promise<void> {
  console.log('🔍 DEBUGGING AFFINITY API KEY');
  console.log('=============================');
  
  const apiKey = process.env.AFFINITY_API_KEY;
  console.log('Raw API Key:', apiKey);
  console.log('API Key length:', apiKey?.length || 0);
  console.log('API Key first 20 chars:', apiKey?.slice(0, 20) || 'undefined');
  
  if (!apiKey) {
    console.error('❌ No API key found in environment');
    return;
  }
  
  // Test the proper global search endpoint which should work with organizations
  console.log('\n📊 Testing Global Search Endpoint');
  try {
    const basicAuth = Buffer.from(`${apiKey}:`).toString('base64');
    const response = await fetch('https://api.affinity.co/global_search?term=&limit=10', {
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
      console.log('Organizations found:', data.organizations?.length || 0);
      console.log('Total entities:', data.total_count || 0);
    }
  } catch (error) {
    console.error('❌ Global search failed:', error.message);
  }
  
  // Test the entity search endpoint for organizations
  console.log('\n📊 Testing Entity Search Endpoint');
  try {
    const basicAuth = Buffer.from(`${apiKey}:`).toString('base64');
    const response = await fetch('https://api.affinity.co/entity_search?term=&type=organization&limit=10', {
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
      console.log('Organizations found:', data.organizations?.length || 0);
    }
  } catch (error) {
    console.error('❌ Entity search failed:', error.message);
  }
}

debugAffinityKey().catch(console.error);