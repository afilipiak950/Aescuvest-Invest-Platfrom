import { storage } from './server/storage';
import { fetchMicrosoftEmails } from './server/services/microsoftEmails';

async function testEmailFetch() {
  try {
    console.log('📧 Testing Microsoft Graph API email fetching...');
    
    // Test Microsoft connection status
    const connection = await storage.getMicrosoftEmailConnection();
    if (!connection) {
      console.log('❌ No Microsoft connection found');
      return;
    }
    
    console.log('📋 Connection status:');
    console.log('- Email:', connection.email);
    console.log('- Authenticated:', connection.authenticated);
    console.log('- Expires at:', new Date(connection.expiresAt));
    console.log('- Is expired:', Date.now() >= connection.expiresAt);
    
    // Test email fetching
    console.log('📬 Fetching emails from Microsoft Graph API...');
    const result = await fetchMicrosoftEmails('inbox', 10);
    
    console.log('📊 Fetch result:');
    console.log('- Success:', result.success);
    console.log('- Email count:', result.emails.length);
    console.log('- Error:', result.error || 'None');
    
    if (result.success && result.emails.length > 0) {
      console.log('✅ Sample emails found:');
      result.emails.slice(0, 3).forEach((email, index) => {
        console.log(`  ${index + 1}. ${email.subject}`);
        console.log(`     From: ${email.from.emailAddress.address}`);
        console.log(`     Date: ${email.receivedDateTime}`);
        console.log(`     Read: ${email.isRead}`);
      });
    } else if (result.success && result.emails.length === 0) {
      console.log('📭 No emails found in inbox');
    } else {
      console.log('❌ Failed to fetch emails:', result.error);
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testEmailFetch().then(() => {
  console.log('🏁 Email fetch test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});