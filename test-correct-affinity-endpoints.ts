/**
 * Test Correct Affinity API Endpoints
 * Based on Affinity API v2 documentation
 */

async function testCorrectAffinityEndpoints(): Promise<void> {
  console.log('🔍 TESTING CORRECT AFFINITY API V2 ENDPOINTS');
  console.log('============================================');
  
  const apiKey = process.env.AFFINITY_API_KEY;
  if (!apiKey) {
    console.error('❌ No API key found');
    return;
  }
  
  const basicAuth = Buffer.from(`${apiKey}:`).toString('base64');
  const headers = {
    'Authorization': `Basic ${basicAuth}`,
    'Content-Type': 'application/json'
  };
  
  // Test 1: Organizations endpoint (correct v2 path)
  console.log('\n📊 TEST 1: Organizations endpoint');
  try {
    const response = await fetch('https://api.affinity.co/v2/organizations?limit=10', {
      method: 'GET',
      headers
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    const result = await response.text();
    console.log('Response:', result.slice(0, 500));
    
    if (response.ok) {
      const data = JSON.parse(result);
      console.log('Organizations found:', data.organizations?.length || 0);
      console.log('Sample org:', data.organizations?.[0]?.name || 'none');
    }
  } catch (error) {
    console.error('❌ Organizations endpoint failed:', error.message);
  }
  
  // Test 2: Lists endpoint (we know this works)
  console.log('\n📊 TEST 2: Lists endpoint (known working)');
  try {
    const response = await fetch('https://api.affinity.co/v2/lists', {
      method: 'GET',
      headers
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    const result = await response.text();
    console.log('Response:', result.slice(0, 500));
    
    if (response.ok) {
      const data = JSON.parse(result);
      console.log('Lists found:', data.length || 0);
      console.log('Sample list:', data[0]?.name || 'none');
    }
  } catch (error) {
    console.error('❌ Lists endpoint failed:', error.message);
  }
  
  // Test 3: Search endpoint  
  console.log('\n📊 TEST 3: Search endpoint');
  try {
    const response = await fetch('https://api.affinity.co/v2/search?term=&limit=10', {
      method: 'GET',
      headers
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    const result = await response.text();
    console.log('Response:', result.slice(0, 500));
    
    if (response.ok) {
      const data = JSON.parse(result);
      console.log('Search results:', data.results?.length || 0);
      console.log('Organizations in search:', data.results?.filter(r => r.type === 'organization').length || 0);
    }
  } catch (error) {
    console.error('❌ Search endpoint failed:', error.message);
  }
  
  // Test 4: Entity search endpoint
  console.log('\n📊 TEST 4: Entity search endpoint');
  try {
    const response = await fetch('https://api.affinity.co/v2/entity-search?term=&type=organization&limit=10', {
      method: 'GET',
      headers
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    const result = await response.text();
    console.log('Response:', result.slice(0, 500));
    
    if (response.ok) {
      const data = JSON.parse(result);
      console.log('Entity search results:', data.results?.length || 0);
    }
  } catch (error) {
    console.error('❌ Entity search endpoint failed:', error.message);
  }
  
  // Test 5: Get the first list and check ALL its entries
  console.log('\n📊 TEST 5: Get all entries from first list');
  try {
    // First get lists
    const listsResponse = await fetch('https://api.affinity.co/v2/lists', {
      method: 'GET',
      headers
    });
    
    if (listsResponse.ok) {
      const lists = await listsResponse.json();
      if (lists.length > 0) {
        const firstList = lists[0];
        console.log(`Checking list: ${firstList.name} (ID: ${firstList.id})`);
        
        // Get all entries from this list
        const entriesResponse = await fetch(`https://api.affinity.co/v2/lists/${firstList.id}/list-entries?limit=100`, {
          method: 'GET',
          headers
        });
        
        console.log(`List entries status: ${entriesResponse.status} ${entriesResponse.statusText}`);
        const entriesResult = await entriesResponse.text();
        console.log('List entries response:', entriesResult.slice(0, 500));
        
        if (entriesResponse.ok) {
          const entriesData = JSON.parse(entriesResult);
          console.log('Total entries:', entriesData.data?.length || 0);
          console.log('Organization entries:', entriesData.data?.filter(e => e.type === 'company').length || 0);
          console.log('Person entries:', entriesData.data?.filter(e => e.type === 'person').length || 0);
        }
      }
    }
  } catch (error) {
    console.error('❌ List entries test failed:', error.message);
  }
}

testCorrectAffinityEndpoints().catch(console.error);