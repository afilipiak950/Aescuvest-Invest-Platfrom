import { ConfidentialClientApplication, AuthenticationResult } from '@azure/msal-node';

// Microsoft 365 OAuth2 configuration
const msalConfig = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID || '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
    authority: 'https://login.microsoftonline.com/common'
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
export function getMicrosoftAuthUrl(redirectUri: string): string {
  const authCodeUrlParameters = {
    scopes: ['https://outlook.office.com/IMAP.AccessAsUser.All', 'offline_access'],
    redirectUri: redirectUri,
  };

  return msalInstance.getAuthCodeUrl(authCodeUrlParameters);
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