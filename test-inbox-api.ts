import { storage } from './server/storage';
import { fetchMicrosoftEmails } from './server/services/microsoftEmails';

async function testInboxAPI() {
  try {
    console.log('🔧 Testing inbox API functionality...');
    
    // Test Microsoft Graph API directly
    console.log('📧 Testing Microsoft Graph API...');
    const result = await fetchMicrosoftEmails('inbox', 10);
    
    if (result.success) {
      console.log(`✅ Microsoft Graph API working: ${result.emails.length} emails`);
      
      // Format emails like the API endpoint does
      const formattedEmails = result.emails.map(email => ({
        id: email.id,
        from: email.from?.emailAddress?.address || 'Unknown',
        fromName: email.from?.emailAddress?.name || email.from?.emailAddress?.address || 'Unknown',
        to: email.toRecipients?.[0]?.emailAddress?.address || 'Unknown',
        subject: email.subject || '(No Subject)',
        date: email.receivedDateTime,
        text: email.bodyPreview || '',
        html: email.body?.content || '',
        read: email.isRead,
        processed: false,
        hasAttachments: email.hasAttachments,
        importance: email.importance,
        source: 'microsoft'
      }));
      
      console.log('📋 Sample formatted email data:');
      console.log('- ID:', formattedEmails[0]?.id);
      console.log('- From:', formattedEmails[0]?.from);
      console.log('- Subject:', formattedEmails[0]?.subject);
      console.log('- Date:', formattedEmails[0]?.date);
      console.log('- Read:', formattedEmails[0]?.read);
      
      // Test response format
      const apiResponse = {
        emails: formattedEmails,
        count: formattedEmails.length,
        source: 'microsoft',
        authenticated: true,
        timestamp: new Date().toISOString()
      };
      
      console.log('📊 API Response format ready:', {
        emailCount: apiResponse.emails.length,
        source: apiResponse.source,
        authenticated: apiResponse.authenticated
      });
      
    } else {
      console.log('❌ Microsoft Graph API failed:', result.error);
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testInboxAPI().then(() => {
  console.log('🏁 Inbox API test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});