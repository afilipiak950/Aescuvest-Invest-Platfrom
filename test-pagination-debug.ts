#!/usr/bin/env tsx

/**
 * Test Pagination Debug - Find why we're not getting all 8,000+ organizations
 */

const AFFINITY_API_KEY = process.env.AFFINITY_API_KEY;

async function testPaginationDebug(): Promise<void> {
  console.log('🔍 Testing Affinity API pagination to find all 8,000+ organizations...');
  
  let pageCount = 0;
  let totalOrgs = 0;
  let pageToken: string | null = null;
  let uniqueTokens: Set<string> = new Set();
  
  while (pageCount < 20) { // Test up to 20 pages
    pageCount++;
    
    try {
      const url = new URL('https://api.affinity.co/organizations');
      url.searchParams.set('limit', '500');
      url.searchParams.set('with_interaction_dates', 'true');
      
      if (pageToken) {
        url.searchParams.set('page_token', pageToken);
      }
      
      console.log(`\n📊 Page ${pageCount}:`);
      console.log(`   URL: ${url.toString().replace(pageToken || '', '***')}`);
      
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${AFFINITY_API_KEY}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Error: ${response.status} - ${errorText}`);
        break;
      }
      
      const data = await response.json();
      
      if (!data.organizations || data.organizations.length === 0) {
        console.log('✅ No organizations - end of data');
        break;
      }
      
      totalOrgs += data.organizations.length;
      console.log(`   Organizations: ${data.organizations.length}`);
      console.log(`   Total so far: ${totalOrgs}`);
      
      // Check next page token
      if (data.next_page_token) {
        const tokenPreview = data.next_page_token.substring(0, 30);
        console.log(`   Next token: ${tokenPreview}...`);
        
        // Check if we've seen this token before (infinite loop detection)
        if (uniqueTokens.has(data.next_page_token)) {
          console.log('⚠️  Token already seen - breaking to avoid infinite loop');
          break;
        }
        
        uniqueTokens.add(data.next_page_token);
        pageToken = data.next_page_token;
        
        // Sample organization names from this page
        const sampleNames = data.organizations.slice(0, 3).map((org: any) => org.name);
        console.log(`   Sample orgs: ${sampleNames.join(', ')}`);
        
      } else {
        console.log('🏁 No next page token - end of data');
        break;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ Error on page ${pageCount}:`, error);
      break;
    }
  }
  
  console.log(`\n📊 PAGINATION TEST RESULTS:`);
  console.log(`   Pages tested: ${pageCount}`);
  console.log(`   Total organizations found: ${totalOrgs}`);
  console.log(`   Unique tokens: ${uniqueTokens.size}`);
  
  if (totalOrgs >= 8000) {
    console.log('✅ SUCCESS: Found 8,000+ organizations as expected!');
  } else if (totalOrgs > 526) {
    console.log(`📈 FOUND MORE: ${totalOrgs} organizations (more than current 526)`);
  } else {
    console.log(`⚠️  ISSUE: Only found ${totalOrgs} organizations`);
  }
}

testPaginationDebug()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });