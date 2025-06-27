import { Router, Request, Response } from 'express';
import { emailInboxService, type ImapConfig } from '../services/emailInbox';
import { convertToInsertDeal } from '../services/emailParser';
import { storage } from '../storage';
import { authenticate, requireAdmin } from '../middleware/auth';
import { fetchMicrosoftEmails, markEmailAsRead, getMicrosoftEmailFolders, searchMicrosoftEmails, getMicrosoftEmail, getMicrosoftEmailAttachments } from '../services/microsoftEmails';
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
    
    // Try Microsoft Graph API first
    console.log('Attempting to fetch emails via Microsoft Graph API...');
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
          text: email.body?.content || email.bodyPreview || '',
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
 * @desc Get specific email by ID with full content and attachments
 * @access Private
 */
router.get('/emails/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const emailId = req.params.id;
    
    // Try Microsoft Graph API first
    console.log('Fetching email details for ID:', emailId);
    const email = await getMicrosoftEmail(emailId);
    
    if (email) {
      // Fetch attachments if email has them
      let attachments = [];
      console.log('Email attachment check:', {
        hasAttachments: email.hasAttachments,
        attachmentPropertyExists: 'hasAttachments' in email,
        attachmentValue: email.hasAttachments
      });
      
      if (email.hasAttachments) {
        console.log('Email has attachments, fetching...');
        attachments = await getMicrosoftEmailAttachments(emailId);
        console.log('Attachment fetch result:', {
          attachmentCount: attachments.length,
          attachments: attachments.map(att => ({
            id: att.id,
            name: att.name,
            contentType: att.contentType,
            size: att.size
          }))
        });
      } else {
        console.log('Email reports no attachments');
      }
      
      // Debug email content structure
      console.log('Email body structure:', {
        contentType: email.body?.contentType,
        contentLength: email.body?.content?.length,
        bodyPreviewLength: email.bodyPreview?.length,
        hasContent: !!email.body?.content
      });
      
      // Determine if content is HTML or text based on contentType
      const isHtmlContent = email.body?.contentType === 'html';
      
      const emailData = {
        id: email.id,
        from: email.from?.emailAddress?.address || 'Unknown',
        fromName: email.from?.emailAddress?.name || email.from?.emailAddress?.address || 'Unknown',
        to: email.toRecipients?.[0]?.emailAddress?.address || 'Unknown',
        subject: email.subject || '(No Subject)',
        date: email.receivedDateTime,
        text: isHtmlContent ? email.bodyPreview || '' : (email.body?.content || email.bodyPreview || ''),
        html: isHtmlContent ? email.body?.content || '' : '',
        read: email.isRead,
        processed: false,
        hasAttachments: email.hasAttachments,
        attachments: attachments.map(att => ({
          id: att.id,
          name: att.name,
          contentType: att.contentType,
          size: att.size,
          isInline: att.isInline || false
        })),
        importance: email.importance,
        source: 'microsoft'
      };
      
      console.log('🔍 DETAILED EMAIL DATA DEBUG:', {
        emailId: emailData.id,
        subject: emailData.subject,
        hasAttachments: emailData.hasAttachments,
        attachmentsCount: emailData.attachments.length,
        attachmentsArray: emailData.attachments,
        fullEmailDataKeys: Object.keys(emailData),
        attachmentDetails: emailData.attachments.map(att => ({
          id: att.id,
          name: att.name,
          contentType: att.contentType,
          size: att.size,
          isInline: att.isInline
        }))
      });
      console.log(`Email details fetched: ${emailData.attachments.length} attachments`);
      return res.json(emailData);
    }
    
    // Fallback to IMAP
    const imapEmail = await emailInboxService.getEmail(emailId);
    if (!imapEmail) {
      return res.status(404).json({
        message: 'Email not found'
      });
    }

    res.json(imapEmail);

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
    console.log('🔄 Deal creation started for email ID:', req.params.id);
    const emailId = req.params.id;
    
    // Step 1: Fetch email (try Microsoft Graph API first, then fallback to IMAP)
    console.log('📧 Fetching email from service...');
    
    let email = null;
    
    // Try Microsoft Graph API first
    const tokens = await loadMicrosoftTokens();
    if (tokens && tokens.accessToken && Date.now() < tokens.expiresAt) {
      console.log('🔄 Using Microsoft Graph API to fetch email...');
      const microsoftEmail = await getMicrosoftEmail(emailId);
      
      if (microsoftEmail) {
        // Convert Microsoft email format to standard email format
        email = {
          id: microsoftEmail.id,
          from: microsoftEmail.from?.emailAddress?.address || 'Unknown',
          to: microsoftEmail.toRecipients?.[0]?.emailAddress?.address || 'Unknown',
          subject: microsoftEmail.subject || '(No Subject)',
          date: new Date(microsoftEmail.receivedDateTime),
          text: microsoftEmail.body?.content || microsoftEmail.bodyPreview || '',
          html: microsoftEmail.body?.contentType === 'html' ? microsoftEmail.body.content : undefined,
          read: microsoftEmail.isRead,
          processed: false
        };
        console.log('✅ Email fetched via Microsoft Graph API');
      } else {
        console.log('❌ Failed to fetch email via Microsoft Graph API');
      }
    }
    
    // Fallback to IMAP if Microsoft Graph failed
    if (!email) {
      console.log('🔄 Fallback to IMAP...');
      try {
        email = await emailInboxService.getEmail(emailId);
        if (email) {
          console.log('✅ Email fetched via IMAP');
        }
      } catch (imapError) {
        console.log('❌ IMAP also failed:', imapError);
      }
    }
    
    if (!email) {
      console.log('❌ Email not found for ID:', emailId);
      return res.status(404).json({
        message: 'Email not found',
        emailId: emailId,
        triedMicrosoft: !!(tokens && tokens.accessToken),
        triedImap: true
      });
    }

    console.log('✅ Email found:', {
      id: email.id,
      subject: email.subject,
      from: email.from,
      textLength: email.text?.length || 0,
      hasHtml: !!email.html,
      source: tokens && tokens.accessToken ? 'microsoft' : 'imap'
    });

    // Step 2: Parse email for deal information
    console.log('🤖 Parsing email for deal information...');
    const dealInfo = await emailInboxService.parseEmailForDeal(email);
    
    if (!dealInfo) {
      console.log('❌ No deal information could be extracted from email');
      console.log('📄 Email content preview:', {
        subject: email.subject,
        from: email.from,
        textPreview: email.text?.substring(0, 200) + '...'
      });
      return res.status(400).json({
        message: 'No deal information could be extracted from this email',
        emailInfo: {
          subject: email.subject,
          from: email.from,
          textLength: email.text?.length || 0
        }
      });
    }

    console.log('✅ Deal information extracted:', dealInfo);

    // Step 3: Convert to deal format
    console.log('🔄 Converting to database format...');
    const insertDeal = convertToInsertDeal(dealInfo);
    console.log('📝 Insert deal format:', insertDeal);

    // Step 4: Create deal in database
    console.log('💾 Creating deal in database...');
    const createdDeal = await storage.createDeal(insertDeal);
    console.log('✅ Deal created successfully:', {
      id: createdDeal.id,
      companyName: createdDeal.companyName,
      status: createdDeal.status
    });

    // Step 4.5: Download and upload email attachments to deal's data room
    let uploadedAttachments: any[] = [];
    if (tokens && tokens.accessToken && Date.now() < tokens.expiresAt) {
      console.log('📎 Checking for email attachments...');
      try {
        const attachments = await getMicrosoftEmailAttachments(emailId);
        console.log(`📎 Found ${attachments?.length || 0} attachments in email`);
        
        if (attachments && attachments.length > 0) {
          console.log('📎 Processing email attachments for upload to data room...');
          const path = await import('path');
          const fs = await import('fs/promises');
          const multer = await import('multer');
          
          for (const attachment of attachments) {
            try {
              console.log(`📎 Processing attachment: ${attachment.name}`);
              
              // Download attachment content
              const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${emailId}/attachments/${attachment.id}/$value`, {
                headers: {
                  'Authorization': `Bearer ${tokens.accessToken}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (!response.ok) {
                console.warn(`⚠️ Failed to download attachment ${attachment.name}: ${response.status}`);
                continue;
              }
              
              const arrayBuffer = await response.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              
              // Create uploads directory if it doesn't exist
              const uploadsDir = path.join(process.cwd(), 'uploads');
              await fs.mkdir(uploadsDir, { recursive: true });
              
              // Save file temporarily
              const tempFileName = `${Date.now()}_${attachment.name}`;
              const tempFilePath = path.join(uploadsDir, tempFileName);
              await fs.writeFile(tempFilePath, buffer);
              
              // Create document in database
              const document = await storage.createDocument({
                dealId: createdDeal.id,
                name: attachment.name,
                type: attachment.contentType || 'application/octet-stream',
                path: tempFilePath,
                size: attachment.size || buffer.length,
                status: 'Completed',
                category: 'Email Attachment',
                documentType: attachment.name.toLowerCase().endsWith('.pdf') ? 'Pitch Deck' : 'Document',
                folderPath: 'email-attachments',
                assignedAgents: []
              });
              
              uploadedAttachments.push({
                id: document.id,
                name: attachment.name,
                size: attachment.size || buffer.length,
                contentType: attachment.contentType
              });
              
              console.log(`✅ Uploaded attachment: ${attachment.name} (${document.id})`);
              
            } catch (attachmentError) {
              console.error(`💥 Error processing attachment ${attachment.name}:`, attachmentError);
            }
          }
          
          console.log(`✅ Successfully uploaded ${uploadedAttachments.length}/${attachments.length} attachments`);
        }
      } catch (attachmentError) {
        console.error('💥 Error processing email attachments:', attachmentError);
      }
    }

    // Step 5: Mark email as read
    console.log('📧 Marking email as read...');
    try {
      // Try Microsoft Graph API first
      if (tokens && tokens.accessToken && Date.now() < tokens.expiresAt) {
        console.log('🔄 Using Microsoft Graph API to mark email as read...');
        const marked = await markEmailAsRead(emailId, true);
        if (marked) {
          console.log('✅ Email marked as read via Microsoft Graph API');
        } else {
          console.warn('⚠️ Failed to mark email as read via Microsoft Graph API');
        }
      } else {
        // Fallback to IMAP
        console.log('🔄 Using IMAP to mark email as read...');
        await emailInboxService.markAsRead(emailId);
        console.log('✅ Email marked as read via IMAP');
      }
    } catch (markReadError) {
      console.warn('⚠️ Failed to mark email as read:', markReadError);
    }

    // Step 6: Send response email to founder if email provided
    let responseSent = false;
    if (dealInfo.founderInfo?.email) {
      console.log('📤 Sending response email to founder:', dealInfo.founderInfo.email);
      try {
        responseSent = await emailInboxService.sendFounderResponse(
          dealInfo.founderInfo.email, 
          dealInfo
        );
        console.log('✅ Response email sent:', responseSent);
      } catch (emailError) {
        console.warn('⚠️ Failed to send response email:', emailError);
      }
    } else {
      console.log('ℹ️ No founder email provided, skipping response email');
    }

    console.log('🎉 Deal creation process completed successfully');
    res.json({
      message: 'Deal created successfully from email',
      deal: createdDeal,
      responseSent,
      founderEmail: dealInfo.founderInfo?.email,
      extractedInfo: dealInfo,
      uploadedAttachments: uploadedAttachments,
      attachmentCount: uploadedAttachments.length
    });

  } catch (error) {
    console.error('💥 Error creating deal from email:', error);
    console.error('📊 Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({
      message: 'Failed to create deal from email',
      error: error instanceof Error ? error.message : 'Unknown error',
      emailId: req.params.id
    });
  }
});

export default router;