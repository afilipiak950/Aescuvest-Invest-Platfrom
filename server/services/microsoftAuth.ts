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
    console.log('[Microsoft OAuth Service] Creating auth URL...');
    console.log('[Microsoft OAuth Service] Client ID:', process.env.MICROSOFT_CLIENT_ID?.substring(0, 8) + '...');
    console.log('[Microsoft OAuth Service] Redirect URI:', redirectUri);
    
    // Create a new MSAL instance to ensure fresh configuration
    const freshMsalConfig = {
      auth: {
        clientId: process.env.MICROSOFT_CLIENT_ID!,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
        authority: 'https://login.microsoftonline.com/common'
      }
    };
    
    const freshMsalInstance = new ConfidentialClientApplication(freshMsalConfig);
    
    const authCodeUrlParameters = {
      scopes: [
        'https://graph.microsoft.com/Mail.Read',
        'https://graph.microsoft.com/Mail.ReadWrite',
        'offline_access'
      ],
      redirectUri: redirectUri,
    };

    console.log('[Microsoft OAuth Service] Auth parameters:', authCodeUrlParameters);
    
    const authUrl = await freshMsalInstance.getAuthCodeUrl(authCodeUrlParameters);
    console.log('[Microsoft OAuth Service] Raw auth URL result:', typeof authUrl, authUrl);
    
    // Handle different return types from MSAL
    let finalAuthUrl: string;
    if (typeof authUrl === 'string') {
      finalAuthUrl = authUrl;
    } else if (authUrl && typeof authUrl === 'object' && 'toString' in authUrl) {
      finalAuthUrl = authUrl.toString();
    } else {
      throw new Error(`MSAL returned unexpected type: ${typeof authUrl}`);
    }
    
    console.log('[Microsoft OAuth Service] Final auth URL:', finalAuthUrl);
    
    if (!finalAuthUrl || finalAuthUrl.length === 0 || !finalAuthUrl.startsWith('http')) {
      throw new Error(`Invalid auth URL generated: ${finalAuthUrl}`);
    }
    
    return finalAuthUrl;
  } catch (error) {
    console.error('[Microsoft OAuth Service] Error in getMicrosoftAuthUrl:', error);
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