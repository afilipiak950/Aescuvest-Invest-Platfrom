import { ConfidentialClientApplication, AuthenticationResult } from '@azure/msal-node';
import { storage } from '../storage';

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
  email?: string;
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
      `&response_mode=query` +
      `&prompt=consent`;
    
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
 * Exchange authorization code for tokens using direct HTTP call
 */
export async function exchangeCodeForTokens(
  code: string, 
  redirectUri: string
): Promise<MicrosoftTokens> {
  console.log('[Microsoft OAuth] Starting token exchange...');
  console.log('[Microsoft OAuth] Code:', code.substring(0, 10) + '...');
  console.log('[Microsoft OAuth] Redirect URI:', redirectUri);
  
  if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
    throw new Error('Microsoft OAuth credentials not configured');
  }

  const tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET,
    code: code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    scope: 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite offline_access'
  });

  console.log('[Microsoft OAuth] Making token request to:', tokenEndpoint);

  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    const responseText = await response.text();
    console.log('[Microsoft OAuth] Token response status:', response.status);
    console.log('[Microsoft OAuth] Token response body:', responseText);

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status} - ${responseText}`);
    }

    const tokenData = JSON.parse(responseText);
    
    if (!tokenData.access_token) {
      throw new Error('No access token in response');
    }

    const expiresAt = Date.now() + (tokenData.expires_in * 1000);
    
    console.log('[Microsoft OAuth] Token exchange successful');
    console.log('[Microsoft OAuth] Access token received:', !!tokenData.access_token);
    console.log('[Microsoft OAuth] Refresh token received:', !!tokenData.refresh_token);
    console.log('[Microsoft OAuth] Expires at:', new Date(expiresAt));

    const tokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: expiresAt
    };

    // Fetch user profile to get email
    try {
      const userProfile = await fetchUserProfile(tokens.accessToken);
      (tokens as any).email = userProfile.mail || userProfile.userPrincipalName;
    } catch (profileError) {
      console.warn('[Microsoft OAuth] Could not fetch user profile:', profileError);
    }

    return tokens;
  } catch (error) {
    console.error('[Microsoft OAuth] Token exchange error:', error);
    throw error;
  }
}

/**
 * Fetch user profile from Microsoft Graph API
 */
export async function fetchUserProfile(accessToken: string): Promise<any> {
  console.log('[Microsoft OAuth] Fetching user profile...');
  
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user profile: ${response.status}`);
  }

  const profile = await response.json();
  console.log('[Microsoft OAuth] User profile fetched:', profile.mail || profile.userPrincipalName);
  
  return profile;
}

/**
 * Refresh expired tokens
 */
export async function refreshMicrosoftTokens(refreshToken: string): Promise<MicrosoftTokens> {
  console.log('[Microsoft OAuth] Refreshing tokens...');
  
  if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
    throw new Error('Microsoft OAuth credentials not configured');
  }

  const tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite offline_access'
  });

  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    const tokenData = await response.json();
    
    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status} - ${JSON.stringify(tokenData)}`);
    }

    const expiresAt = Date.now() + (tokenData.expires_in * 1000);
    
    console.log('[Microsoft OAuth] Token refresh successful');

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken,
      expiresAt: expiresAt
    };
  } catch (error) {
    console.error('[Microsoft OAuth] Token refresh error:', error);
    throw error;
  }
}

/**
 * Load Microsoft tokens from storage
 */
export async function loadMicrosoftTokens(): Promise<MicrosoftTokens | null> {
  try {
    const connection = await storage.getMicrosoftEmailConnection();
    if (!connection) {
      return null;
    }
    
    return {
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken || undefined,
      expiresAt: connection.expiresAt,
      email: connection.email || undefined
    };
  } catch (error) {
    console.error('[Microsoft OAuth] Error loading tokens:', error);
    return null;
  }
}

/**
 * Save Microsoft tokens to storage
 */
export async function saveMicrosoftTokens(tokens: MicrosoftTokens): Promise<void> {
  try {
    await storage.saveMicrosoftEmailConnection({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      email: tokens.email,
      authenticated: true,
      connectedAt: new Date()
    });
    console.log('[Microsoft OAuth] Tokens saved to storage successfully');
  } catch (error) {
    console.error('[Microsoft OAuth] Error saving tokens:', error);
    throw error;
  }
}