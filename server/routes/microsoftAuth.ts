import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { getMicrosoftAuthUrl, exchangeCodeForTokens, refreshMicrosoftTokens } from '../services/microsoftAuth';

const router = Router();

// Store tokens temporarily (in production, store in database)
let microsoftTokens: any = null;

/**
 * @route GET /api/microsoft/auth-url
 * @desc Get Microsoft OAuth2 authorization URL
 * @access Private (Admin only)
 */
router.get('/auth-url', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const redirectUri = `${req.protocol}://${req.hostname}/api/microsoft/callback`;
    const authUrl = await getMicrosoftAuthUrl(redirectUri);
    
    res.json({
      success: true,
      authUrl: authUrl
    });
  } catch (error) {
    console.error('Error generating Microsoft auth URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate authorization URL'
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
    const { code } = req.query;
    
    if (!code || typeof code !== 'string') {
      return res.status(400).send('Authorization code missing');
    }
    
    const redirectUri = `${req.protocol}://${req.hostname}/api/microsoft/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    
    // Store tokens (in production, store securely in database)
    microsoftTokens = tokens;
    
    // Redirect back to inbox with success
    res.redirect('/?microsoft-auth=success');
    
  } catch (error) {
    console.error('Microsoft OAuth callback error:', error);
    res.redirect('/?microsoft-auth=error');
  }
});

/**
 * @route GET /api/microsoft/status
 * @desc Check Microsoft authentication status
 * @access Private (Admin only)
 */
router.get('/status', authenticate, requireAdmin, (req: Request, res: Response) => {
  try {
    const isAuthenticated = microsoftTokens && 
                           microsoftTokens.accessToken && 
                           Date.now() < microsoftTokens.expiresAt;
    
    res.json({
      success: true,
      authenticated: isAuthenticated,
      email: isAuthenticated ? 'ideas@aescuvest.vc' : null,
      expiresAt: microsoftTokens?.expiresAt || null
    });
  } catch (error) {
    console.error('Error checking Microsoft status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check authentication status'
    });
  }
});

/**
 * @route POST /api/microsoft/refresh
 * @desc Refresh Microsoft tokens
 * @access Private (Admin only)
 */
router.post('/refresh', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!microsoftTokens?.refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'No refresh token available'
      });
    }
    
    const newTokens = await refreshMicrosoftTokens(microsoftTokens.refreshToken);
    microsoftTokens = newTokens;
    
    res.json({
      success: true,
      message: 'Tokens refreshed successfully'
    });
  } catch (error) {
    console.error('Error refreshing Microsoft tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh tokens'
    });
  }
});

export default router;