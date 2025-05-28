import { Router, Request, Response } from 'express';
import multer from 'multer';
import { parseEmailForDealInfo, convertToInsertDeal, generateFounderResponse } from '../services/emailParser';
import { storage } from '../storage';
import { MailService } from '@sendgrid/mail';

const router = Router();

// Configure multer for handling SendGrid webhook data
const upload = multer();

// Initialize SendGrid
const mailService = new MailService();
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * @route POST /api/email/webhook
 * @desc Receive parsed emails from SendGrid Inbound Parse
 * @access Public (SendGrid webhook)
 */
router.post('/webhook', upload.any(), async (req: Request, res: Response) => {
  try {
    console.log('Email webhook received:', {
      headers: req.headers,
      bodyKeys: Object.keys(req.body),
      hasFiles: req.files ? req.files.length : 0
    });

    // Extract email data from SendGrid webhook
    const emailData = {
      from: req.body.from || '',
      subject: req.body.subject || '',
      text: req.body.text || '',
      html: req.body.html || '',
      to: req.body.to || '',
      attachments: req.files && Array.isArray(req.files) ? req.files.map((file: any) => ({
        filename: file.originalname,
        content: file.buffer.toString('base64'),
        contentType: file.mimetype
      })) : []
    };

    console.log('Parsed email data:', {
      from: emailData.from,
      subject: emailData.subject,
      to: emailData.to,
      textLength: emailData.text.length,
      hasHtml: !!emailData.html,
      attachmentCount: emailData.attachments.length
    });

    // Check if email is sent to ideas@aescuvest.vc
    const targetEmail = 'ideas@aescuvest.vc';
    if (!emailData.to.includes(targetEmail)) {
      console.log(`Email not sent to ${targetEmail}, ignoring`);
      return res.status(200).json({ message: 'Email received but not for ideas address' });
    }

    // Parse email content using AI
    const dealInfo = await parseEmailForDealInfo(emailData);

    if (!dealInfo) {
      console.log('No deal information found in email');
      return res.status(200).json({ message: 'Email received but no deal information extracted' });
    }

    console.log('Extracted deal info:', dealInfo);

    // Convert to deal format and create in database
    const insertDeal = convertToInsertDeal(dealInfo);
    const createdDeal = await storage.createDeal(insertDeal);

    console.log('Created deal:', createdDeal);

    // Generate and send response email to founder
    if (dealInfo.founderInfo?.email && process.env.SENDGRID_API_KEY) {
      try {
        const responseContent = await generateFounderResponse(dealInfo);
        
        await mailService.send({
          to: dealInfo.founderInfo.email,
          from: 'ideas@aescuvest.vc',
          subject: `Thank you for your submission - ${dealInfo.companyName}`,
          text: responseContent,
          html: responseContent.replace(/\n/g, '<br>')
        });

        console.log('Response email sent to:', dealInfo.founderInfo.email);
      } catch (emailError) {
        console.error('Error sending response email:', emailError);
        // Don't fail the whole process if email sending fails
      }
    }

    res.status(200).json({
      message: 'Deal created successfully from email',
      dealId: createdDeal.id,
      companyName: createdDeal.companyName
    });

  } catch (error) {
    console.error('Error processing email webhook:', error);
    res.status(500).json({ 
      message: 'Error processing email',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/email/test
 * @desc Test endpoint to verify email service is working
 * @access Public
 */
router.get('/test', (req: Request, res: Response) => {
  res.json({
    message: 'Email service is running',
    hasApiKey: !!process.env.SENDGRID_API_KEY,
    timestamp: new Date().toISOString()
  });
});

/**
 * @route POST /api/email/test-parse
 * @desc Test email parsing functionality
 * @access Public (for testing)
 */
router.post('/test-parse', async (req: Request, res: Response) => {
  try {
    const { from, subject, text, html } = req.body;

    if (!from || !subject || !text) {
      return res.status(400).json({
        message: 'Missing required fields: from, subject, text'
      });
    }

    const emailData = { from, subject, text, html };
    const dealInfo = await parseEmailForDealInfo(emailData);

    if (!dealInfo) {
      return res.status(200).json({
        message: 'No deal information could be extracted from the email',
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
    console.error('Error testing email parse:', error);
    res.status(500).json({
      message: 'Error parsing email',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;