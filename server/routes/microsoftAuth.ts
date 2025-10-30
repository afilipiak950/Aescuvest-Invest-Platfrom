import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { getMicrosoftAuthUrl, exchangeCodeForTokens, refreshMicrosoftTokens } from '../services/microsoftAuth';

const router = Router();

// Store tokens persistently using storage interface
import { storage } from '../storage';

// Token interface for type safety
interface MicrosoftEmailConnection {
  id: number;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  email: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Helper functions for persistent token storage
async function saveMicrosoftTokens(tokens: any): Promise<void> {
  try {
    const connection: MicrosoftEmailConnection = {
      id: 1, // Single connection for now
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      email: 'ideas@aescuvest.vc',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Store in our persistent storage
    await storage.saveMicrosoftEmailConnection(connection);
    console.log('[Microsoft OAuth] Tokens saved to persistent storage');
  } catch (error) {
    console.error('[Microsoft OAuth] Failed to save tokens:', error);
  }
}

async function loadMicrosoftTokens(): Promise<any | null> {
  try {
    const connection = await storage.getMicrosoftEmailConnection();
    if (connection && connection.authenticated) {
      // Check if token is expired and refresh if needed
      const isExpired = Date.now() >= connection.expiresAt;
      
      if (isExpired && connection.refreshToken) {
        console.log('[Microsoft OAuth] Token expired, attempting automatic refresh...');
        try {
          const newTokens = await refreshMicrosoftTokens(connection.refreshToken);
          await saveMicrosoftTokens(newTokens);
          console.log('[Microsoft OAuth] Automatic token refresh successful');
          
          return {
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken,
            expiresAt: newTokens.expiresAt,
            email: connection.email
          };
        } catch (refreshError) {
          console.error('[Microsoft OAuth] Automatic token refresh failed:', refreshError);
          // Token refresh failed, user needs to re-authenticate
          await storage.clearMicrosoftEmailConnection();
          return null;
        }
      }
      
      return {
        accessToken: connection.accessToken,
        refreshToken: connection.refreshToken,
        expiresAt: connection.expiresAt
      };
    }
    return null;
  } catch (error) {
    console.error('[Microsoft OAuth] Failed to load tokens:', error);
    return null;
  }
}

async function clearMicrosoftTokens(): Promise<void> {
  try {
    await storage.clearMicrosoftEmailConnection();
    console.log('[Microsoft OAuth] Tokens cleared from storage');
  } catch (error) {
    console.error('[Microsoft OAuth] Failed to clear tokens:', error);
  }
}

/**
 * @route GET /api/microsoft/auth-url
 * @desc Get Microsoft OAuth2 authorization URL
 * @access Private (Authenticated users)
 */
router.get('/auth-url', authenticate, async (req: Request, res: Response) => {
  try {
    console.log('[Microsoft OAuth] Starting auth URL generation...');
    console.log('[Microsoft OAuth] Protocol:', req.protocol);
    console.log('[Microsoft OAuth] Hostname:', req.hostname);
    
    const redirectUri = `https://${req.hostname}/api/microsoft/callback`;
    console.log('[Microsoft OAuth] Redirect URI:', redirectUri);
    
    const authUrl = await getMicrosoftAuthUrl(redirectUri);
    console.log('[Microsoft OAuth] Generated auth URL:', authUrl);
    
    res.json({
      success: true,
      authUrl: authUrl
    });
  } catch (error) {
    console.error('[Microsoft OAuth] Error generating auth URL:', error);
    console.error('[Microsoft OAuth] Error details:', error.message);
    console.error('[Microsoft OAuth] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to generate authorization URL',
      details: error.message
    });
  }
});

/**
 * @route GET /api/microsoft/callback
 * @desc Handle Microsoft OAuth2 callback
 * @access Public (OAuth callback)
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    console.log('[Microsoft OAuth] Callback received with code:', !!req.query.code);
    const { code } = req.query;
    
    if (!code || typeof code !== 'string') {
      console.error('[Microsoft OAuth] Authorization code missing');
      return res.redirect('/?microsoft-auth=error&reason=no-code');
    }
    
    const redirectUri = `https://${req.hostname}/api/microsoft/callback`;
    console.log('[Microsoft OAuth] Exchanging code for tokens...');
    
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    console.log('[Microsoft OAuth] Tokens received, saving to storage...');
    
    // Save tokens to permanent database storage
    await storage.saveMicrosoftEmailConnection({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      email: tokens.email,
      authenticated: true,
      connectedAt: new Date()
    });
    
    console.log('[Microsoft OAuth] Authentication successful, redirecting...');
    // Redirect back to inbox with success
    res.redirect('/?microsoft-auth=success');
    
  } catch (error) {
    console.error('[Microsoft OAuth] Callback error:', error);
    res.redirect('/?microsoft-auth=error&reason=token-exchange');
  }
});

/**
 * @route GET /api/microsoft/status
 * @desc Check Microsoft authentication status
 * @access Private (Authenticated users)
 */
router.get('/status', authenticate, async (req: Request, res: Response) => {
  try {
    console.log('[Microsoft OAuth] Checking authentication status...');
    const tokens = await loadMicrosoftTokens();
    
    const isAuthenticated = tokens && 
                           tokens.accessToken && 
                           Date.now() < tokens.expiresAt;
    
    console.log('[Microsoft OAuth] Status check result:', {
      hasTokens: !!tokens,
      hasAccessToken: !!(tokens?.accessToken),
      expiresAt: tokens?.expiresAt,
      currentTime: Date.now(),
      isAuthenticated
    });
    
    res.json({
      success: true,
      authenticated: isAuthenticated,
      email: isAuthenticated ? 'ideas@aescuvest.vc' : null,
      expiresAt: tokens?.expiresAt || null
    });
  } catch (error: any) {
    console.error('[Microsoft OAuth] Error checking status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check authentication status'
    });
  }
});

/**
 * @route POST /api/microsoft/refresh
 * @desc Refresh Microsoft tokens
 * @access Private (Authenticated users)
 */
router.post('/refresh', authenticate, async (req: Request, res: Response) => {
  try {
    console.log('[Microsoft OAuth] Attempting token refresh...');
    const tokens = await loadMicrosoftTokens();
    
    if (!tokens?.refreshToken) {
      console.log('[Microsoft OAuth] No refresh token available');
      return res.status(400).json({
        success: false,
        error: 'No refresh token available'
      });
    }
    
    const newTokens = await refreshMicrosoftTokens(tokens.refreshToken);
    await saveMicrosoftTokens(newTokens);
    
    console.log('[Microsoft OAuth] Tokens refreshed successfully');
    res.json({
      success: true,
      message: 'Tokens refreshed successfully'
    });
  } catch (error: any) {
    console.error('[Microsoft OAuth] Error refreshing tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh tokens'
    });
  }
});

export default router;