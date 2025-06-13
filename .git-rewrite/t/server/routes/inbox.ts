import { Router, Request, Response } from 'express';
import { emailInboxService, type ImapConfig } from '../services/emailInbox';
import { convertToInsertDeal } from '../services/emailParser';
import { storage } from '../storage';
import { authenticate, requireAdmin } from '../middleware/auth';
import { fetchMicrosoftEmails, markEmailAsRead, getMicrosoftEmailFolders, searchMicrosoftEmails } from '../services/microsoftEmails';
import { loadMicrosoftTokens } from '../services/microsoftAuth';

const router = Router();

/**
 * @route POST /api/inbox/config
 * @desc Configure IMAP settings
 * @access Private (Admin only)
 */
router.post('/config', authenticate, requireAdmin, (req: Request, res: Response) => {
  // Force JSON response header IMMEDIATELY
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

    // Create safe config object
    const config: ImapConfig = {
      host: String(host).trim(),
      port: Number(port) || (secure ? 993 : 143),
      secure: Boolean(secure),
      username: String(username).trim(),
      password: String(password),
    };

    // Save config safely without any async operations that could crash
    try {
      emailInboxService.setConfig(config);
      console.log('IMAP config saved successfully:', { 
        host: config.host, 
        port: config.port, 
        secure: config.secure, 
        username: config.username 
      });
    } catch (configError) {
      console.error('Config save error:', configError);
      return res.status(500).json({
        success: false,
        message: 'Failed to save configuration',
        error: 'Configuration service error'
      });
    }

    // Return success immediately
    return res.status(200).json({
      success: true,
      message: 'IMAP configuration saved successfully',
      config: {
        host: config.host,
        port: config.port,
        secure: config.secure,
        username: config.username,
      }
    });

  } catch (error) {
    console.error('Inbox config route error:', error);
    
    // Absolutely ensure JSON response
    return res.status(500).json({
      success: false,
      message: 'Configuration failed',
      error: error instanceof Error ? error.message : 'Unknown server error'
    });
  }
});

/**
 * @route GET /api/inbox/test
 * @desc Test IMAP connection
 * @access Private (Admin only)
 */
router.get('/test', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const testResult = await emailInboxService.testConnection();
    
    res.json({
      success: testResult.success,
      error: testResult.error,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error testing IMAP connection:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/inbox/emails
 * @desc Fetch emails from inbox
 * @access Private
 */
router.get('/emails', authenticate, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    
    // Check if Microsoft authentication is available
    const tokens = await loadMicrosoftTokens();
    if (tokens && tokens.accessToken && Date.now() < tokens.expiresAt) {
      console.log('Using Microsoft Graph API to fetch emails...');
      const result = await fetchMicrosoftEmails('inbox', limit);
      
      if (result.success) {
        console.log(`Successfully fetched ${result.emails.length} emails from Microsoft Graph`);
        return res.json({
          emails: result.emails.map(email => ({
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
          })),
          count: result.emails.length,
          source: 'microsoft',
          authenticated: true,
          timestamp: new Date().toISOString()
        });
      } else {
        console.log('Microsoft Graph API failed:', result.error);
      }
    }
    
    // Fallback to IMAP
    console.log('Using IMAP to fetch emails...');
    const emails = await emailInboxService.fetchEmails(limit);
    
    res.json({
      emails: emails.map(email => ({
        ...email,
        source: 'imap'
      })),
      count: emails.length,
      source: 'imap',
      authenticated: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({
      message: 'Failed to fetch emails',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/inbox/emails/:id
 * @desc Get specific email by ID
 * @access Private
 */
router.get('/emails/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const emailId = req.params.id;
    const email = await emailInboxService.getEmail(emailId);
    
    if (!email) {
      return res.status(404).json({
        message: 'Email not found'
      });
    }

    res.json(email);

  } catch (error) {
    console.error('Error fetching email:', error);
    res.status(500).json({
      message: 'Failed to fetch email',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route POST /api/inbox/emails/:id/mark-read
 * @desc Mark email as read
 * @access Private
 */
router.post('/emails/:id/mark-read', authenticate, async (req: Request, res: Response) => {
  try {
    const emailId = req.params.id;
    await emailInboxService.markAsRead(emailId);
    
    res.json({
      message: 'Email marked as read',
      emailId
    });

  } catch (error) {
    console.error('Error marking email as read:', error);
    res.status(500).json({
      message: 'Failed to mark email as read',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route POST /api/inbox/emails/:id/parse
 * @desc Parse email for deal information
 * @access Private
 */
router.post('/emails/:id/parse', authenticate, async (req: Request, res: Response) => {
  try {
    const emailId = req.params.id;
    const email = await emailInboxService.getEmail(emailId);
    
    if (!email) {
      return res.status(404).json({
        message: 'Email not found'
      });
    }

    const dealInfo = await emailInboxService.parseEmailForDeal(email);
    
    if (!dealInfo) {
      return res.json({
        message: 'No deal information found in email',
        extracted: null
      });
    }

    const insertDeal = convertToInsertDeal(dealInfo);

    res.json({
      message: 'Email parsed successfully',
      extracted: dealInfo,
      dealFormat: insertDeal
    });

  } catch (error) {
    console.error('Error parsing email:', error);
    res.status(500).json({
      message: 'Failed to parse email',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route POST /api/inbox/emails/:id/create-deal
 * @desc Create deal from email
 * @access Private
 */
router.post('/emails/:id/create-deal', authenticate, async (req: Request, res: Response) => {
  try {
    const emailId = req.params.id;
    const email = await emailInboxService.getEmail(emailId);
    
    if (!email) {
      return res.status(404).json({
        message: 'Email not found'
      });
    }

    // Parse email for deal information
    const dealInfo = await emailInboxService.parseEmailForDeal(email);
    
    if (!dealInfo) {
      return res.status(400).json({
        message: 'No deal information could be extracted from this email'
      });
    }

    // Create deal in database
    const insertDeal = convertToInsertDeal(dealInfo);
    const createdDeal = await storage.createDeal(insertDeal);

    // Mark email as read
    await emailInboxService.markAsRead(emailId);

    // Send response email to founder if email provided
    let responseSent = false;
    if (dealInfo.founderInfo?.email) {
      responseSent = await emailInboxService.sendFounderResponse(
        dealInfo.founderInfo.email, 
        dealInfo
      );
    }

    res.json({
      message: 'Deal created successfully from email',
      deal: createdDeal,
      responseSent,
      founderEmail: dealInfo.founderInfo?.email
    });

  } catch (error) {
    console.error('Error creating deal from email:', error);
    res.status(500).json({
      message: 'Failed to create deal from email',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;