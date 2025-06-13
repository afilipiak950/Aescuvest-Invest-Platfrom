import { storage } from './server/storage';
import { refreshMicrosoftTokens } from './server/services/microsoftAuth';

async function testTokenRefresh() {
  try {
    console.log('🔄 Testing Microsoft OAuth token refresh...');
    
    // Get current connection
    const connection = await storage.getMicrosoftEmailConnection();
    if (!connection) {
      console.log('❌ No Microsoft connection found');
      return;
    }
    
    console.log('📋 Current token status:');
    console.log('- Access token:', connection.accessToken ? 'Present' : 'Missing');
    console.log('- Refresh token:', connection.refreshToken ? 'Present' : 'Missing');
    console.log('- Expires at:', new Date(connection.expiresAt));
    console.log('- Current time:', new Date());
    console.log('- Is expired:', Date.now() >= connection.expiresAt);
    console.log('- Authenticated:', connection.authenticated);
    
    if (!connection.refreshToken) {
      console.log('❌ No refresh token available');
      return;
    }
    
    if (Date.now() < connection.expiresAt) {
      console.log('✅ Token is still valid, no refresh needed');
      return;
    }
    
    console.log('🔄 Attempting to refresh expired token...');
    
    const newTokens = await refreshMicrosoftTokens(connection.refreshToken);
    console.log('✅ Token refresh successful!');
    console.log('- New access token:', newTokens.accessToken ? 'Present' : 'Missing');
    console.log('- New refresh token:', newTokens.refreshToken ? 'Present' : 'Missing');
    console.log('- New expires at:', new Date(newTokens.expiresAt));
    
    // Save the new tokens
    await storage.saveMicrosoftEmailConnection({
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      expiresAt: newTokens.expiresAt,
      email: connection.email,
      authenticated: true,
      connectedAt: connection.connectedAt || new Date()
    });
    
    console.log('✅ New tokens saved to database');
    
    // Verify the tokens are saved
    const updatedConnection = await storage.getMicrosoftEmailConnection();
    if (updatedConnection) {
      console.log('✅ Verification: Tokens successfully updated');
      console.log('- New expires at:', new Date(updatedConnection.expiresAt));
      console.log('- Is expired:', Date.now() >= updatedConnection.expiresAt);
    }
    
  } catch (error) {
    console.error('❌ Token refresh failed:', error);
  }
}

testTokenRefresh().then(() => {
  console.log('🏁 Token refresh test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});