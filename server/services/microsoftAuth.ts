import { ConfidentialClientApplication, AuthenticationResult } from '@azure/msal-node';

// Validate Microsoft credentials
if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
  throw new Error('Microsoft OAuth2 credentials not configured');
}

// Microsoft 365 OAuth2 configuration
const msalConfig = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID!,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
    authority: 'https://login.microsoftonline.com/common'
  },
  system: {
    loggerOptions: {
      loggerCallback(loglevel: any, message: string) {
        console.log(`[Microsoft OAuth] ${message}`);
      },
      piiLoggingEnabled: false,
      logLevel: 1, // Info level for debugging
    }
  }
};

const msalInstance = new ConfidentialClientApplication(msalConfig);

export interface MicrosoftTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

/**
 * Get authorization URL for Microsoft OAuth2
 */
export async function getMicrosoftAuthUrl(redirectUri: string): Promise<string> {
  try {
    console.log('[Microsoft OAuth Service] Creating auth URL manually...');
    console.log('[Microsoft OAuth Service] Client ID:', process.env.MICROSOFT_CLIENT_ID?.substring(0, 8) + '...');
    console.log('[Microsoft OAuth Service] Redirect URI:', redirectUri);
    
    // Manual Microsoft OAuth2 URL construction - bypassing MSAL issues
    const clientId = process.env.MICROSOFT_CLIENT_ID!;
    const scopes = encodeURIComponent('https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite offline_access');
    const responseType = 'code';
    const redirectUriEncoded = encodeURIComponent(redirectUri);
    const state = Math.random().toString(36).substring(2, 15);
    
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` +
      `?client_id=${clientId}` +
      `&response_type=${responseType}` +
      `&redirect_uri=${redirectUriEncoded}` +
      `&scope=${scopes}` +
      `&state=${state}` +
      `&response_mode=query`;
    
    console.log('[Microsoft OAuth Service] Manual auth URL created:', authUrl);
    
    if (!authUrl || !authUrl.startsWith('http')) {
      throw new Error(`Invalid manual auth URL: ${authUrl}`);
    }
    
    return authUrl;
  } catch (error) {
    console.error('[Microsoft OAuth Service] Error creating manual auth URL:', error);
    throw error;
  }
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string, 
  redirectUri: string
): Promise<MicrosoftTokens> {
  const tokenRequest = {
    code: code,
    scopes: ['https://outlook.office.com/IMAP.AccessAsUser.All', 'offline_access'],
    redirectUri: redirectUri,
  };

  const response: AuthenticationResult = await msalInstance.acquireTokenByCode(tokenRequest);
  
  if (!response.accessToken) {
    throw new Error('Failed to acquire access token');
  }

  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    expiresAt: response.expiresOn?.getTime() || Date.now() + 3600000
  };
}

/**
 * Refresh expired tokens
 */
export async function refreshMicrosoftTokens(refreshToken: string): Promise<MicrosoftTokens> {
  const refreshTokenRequest = {
    refreshToken: refreshToken,
    scopes: ['https://outlook.office.com/IMAP.AccessAsUser.All'],
  };

  const response: AuthenticationResult = await msalInstance.acquireTokenByRefreshToken(refreshTokenRequest);
  
  if (!response.accessToken) {
    throw new Error('Failed to refresh access token');
  }

  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken || refreshToken,
    expiresAt: response.expiresOn?.getTime() || Date.now() + 3600000
  };
}