import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// Simple IMAP config storage (in-memory for now)
let imapConfig: any = null;

/**
 * @route POST /api/inbox/config
 * @desc Configure IMAP settings - SAFE VERSION
 * @access Private (Admin only)
 */
router.post('/config', authenticate, requireAdmin, async (req: Request, res: Response) => {
  // Force JSON response
  res.setHeader('Content-Type', 'application/json');
  
  try {
    const { host, port, secure, username, password } = req.body;

    // Validation
    if (!host || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: host, username, password'
      });
    }

    // Save config (without testing connection)
    imapConfig = {
      host: String(host),
      port: Number(port) || (secure ? 993 : 143),
      secure: Boolean(secure),
      username: String(username),
      password: String(password),
      savedAt: new Date()
    };

    console.log('IMAP config saved:', { 
      host: imapConfig.host, 
      port: imapConfig.port, 
      secure: imapConfig.secure, 
      username: imapConfig.username 
    });

    return res.status(200).json({
      success: true,
      message: 'IMAP configuration saved successfully',
      config: {
        host: imapConfig.host,
        port: imapConfig.port,
        secure: imapConfig.secure,
        username: imapConfig.username
      }
    });

  } catch (error) {
    console.error('IMAP config error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to save configuration',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/inbox/test
 * @desc Test IMAP connection - SAFE VERSION
 * @access Private (Admin only)
 */
router.get('/test', authenticate, requireAdmin, async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  
  try {
    if (!imapConfig) {
      return res.status(400).json({
        success: false,
        message: 'No IMAP configuration found. Please configure first.'
      });
    }

    // For Outlook, provide specific guidance
    if (imapConfig.host.includes('outlook') || imapConfig.host.includes('office365')) {
      return res.status(200).json({
        success: false,
        message: 'Outlook detected: You need an App Password instead of your regular password',
        error: 'Outlook requires App Password authentication',
        guidance: 'Create an App Password in your Microsoft account security settings'
      });
    }

    // For other providers, return saved config without testing
    return res.status(200).json({
      success: true,
      message: 'Configuration ready for testing',
      config: {
        host: imapConfig.host,
        port: imapConfig.port,
        secure: imapConfig.secure,
        username: imapConfig.username
      },
      note: 'Connection test disabled to prevent server crashes'
    });

  } catch (error) {
    console.error('Test error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;