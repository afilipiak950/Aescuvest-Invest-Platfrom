/**
 * Verify API Key Format and Test Basic Authentication
 */

async function verifyAPIKey(): Promise<void> {
  const apiKey = process.env.AFFINITY_API_KEY;
  
  console.log('🔍 API KEY VERIFICATION');
  console.log('=======================');
  console.log('API Key exists:', !!apiKey);
  console.log('API Key length:', apiKey?.length || 0);
  console.log('API Key (masked):', `${apiKey?.slice(0, 8)}...${apiKey?.slice(-4)}` || 'undefined');
  
  if (!apiKey) {
    console.error('❌ No API key found');
    return;
  }
  
  // Test basic auth encoding
  const basicAuth = Buffer.from(`${apiKey}:`).toString('base64');
  console.log('Basic Auth (first 20 chars):', basicAuth.slice(0, 20));
  
  // Test the whoami endpoint to verify authentication
  console.log('\n📊 Testing whoami endpoint');
  try {
    const response = await fetch('https://api.affinity.co/v2/auth/whoami', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    const result = await response.text();
    console.log('Response:', result);
    
    if (response.ok) {
      const data = JSON.parse(result);
      console.log('✅ Authentication successful!');
      console.log('User info:', data);
    } else {
      console.log('❌ Authentication failed');
    }
  } catch (error) {
    console.error('❌ Whoami test failed:', error.message);
  }
}

verifyAPIKey().catch(console.error);