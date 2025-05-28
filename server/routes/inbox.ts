import { Router, Request, Response } from 'express';
import { emailInboxService, type ImapConfig } from '../services/emailInbox';
import { convertToInsertDeal } from '../services/emailParser';
import { storage } from '../storage';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

/**
 * @route POST /api/inbox/config
 * @desc Configure IMAP settings
 * @access Private (Admin only)
 */
router.post('/config', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { host, port, secure, username, password } = req.body;

    if (!host || !username || !password) {
      return res.status(400).json({
        message: 'Missing required fields: host, username, password'
      });
    }

    // Validate input types
    if (typeof host !== 'string' || typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        message: 'Invalid input types'
      });
    }

    const config: ImapConfig = {
      host,
      port: port || (secure ? 993 : 143),
      secure: secure !== false, // Default to secure
      username,
      password,
    };

    // Test connection
    emailInboxService.setConfig(config);
    const testResult = await emailInboxService.testConnection();

    if (!testResult.success) {
      console.error('IMAP connection test failed:', testResult.error);
      return res.status(400).json({
        message: 'IMAP connection failed',
        error: testResult.error,
        details: 'Please check your credentials and server settings'
      });
    }

    res.json({
      message: 'IMAP configuration successful',
      config: {
        host: config.host,
        port: config.port,
        secure: config.secure,
        username: config.username,
        // Don't return password in response
      }
    });

  } catch (error) {
    console.error('Error configuring IMAP:', error);
    
    // Ensure we always return JSON
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    res.status(500).json({
      message: 'Failed to configure IMAP settings',
      error: errorMessage,
      details: 'Server encountered an unexpected error'
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
    const emails = await emailInboxService.fetchEmails(limit);
    
    res.json({
      emails,
      count: emails.length,
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