// @ts-ignore - No types available for imapflow
import { ImapFlow } from 'imapflow';
import { parseEmailForDealInfo, generateFounderResponse } from './emailParser';
import { MailService } from '@sendgrid/mail';
import crypto from 'crypto';

// Initialize SendGrid for sending responses (keep this for outgoing emails)
const mailService = new MailService();
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

// Email configuration encryption using AES-256-GCM
const ENCRYPTION_KEY = process.env.EMAIL_CONFIG_KEY || 'aescuvest-email-config-encryption-key-32b';
const KEY = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();

function encryptPassword(password: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decryptPassword(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export interface EmailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: Date;
  text: string;
  html?: string;
  read: boolean;
  processed: boolean; // Whether this email has been processed into a deal
}

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}

export class EmailInboxService {
  private config: ImapConfig | null = null;
  private client: ImapFlow | null = null;

  /**
   * Configure IMAP connection settings and persist to database
   */
  async setConfig(config: ImapConfig) {
    this.config = config;
    
    // Persist to database with encrypted password
    try {
      const { storage } = await import('../storage');
      const configToStore = { ...config, password: encryptPassword(config.password) };
      await storage.setSystemSetting('email_imap_config', JSON.stringify(configToStore), 'IMAP email configuration', 'email');
      console.log('📧 IMAP configuration persisted to database');
    } catch (error) {
      console.error('Failed to persist IMAP config to database:', error);
    }
  }

  /**
   * Load IMAP configuration from database
   */
  async loadConfigFromDatabase() {
    try {
      const { storage } = await import('../storage');
      const setting = await storage.getSystemSetting('email_imap_config');
      
      if (setting && setting.value) {
        const savedConfig = JSON.parse(setting.value);
        
        // Decrypt password if it's encrypted (backward compatibility)
        if (savedConfig.password) {
          try {
            // Check if password is encrypted (contains colons in format iv:authTag:encrypted)
            if (savedConfig.password.includes(':') && savedConfig.password.split(':').length === 3) {
              savedConfig.password = decryptPassword(savedConfig.password);
            }
            // If no colons, it's plaintext (old format) - use as-is
          } catch (decryptError) {
            console.warn('Failed to decrypt password, using as-is:', decryptError);
          }
        }
        
        this.config = savedConfig;
        console.log('📧 Loaded IMAP configuration from database');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to load IMAP config from database:', error);
      return false;
    }
  }

  /**
   * Get current configuration (without sensitive data)
   */
  getConfigStatus() {
    if (!this.config) {
      return { configured: false };
    }
    
    return {
      configured: true,
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      username: this.config.username
    };
  }

  /**
   * Test IMAP connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.config) {
      return { success: false, error: 'No IMAP configuration provided' };
    }

    try {
      console.log('Testing IMAP connection to:', this.config.host, 'port:', this.config.port);
      
      const client = new ImapFlow({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.username,
          pass: this.config.password, // Don't decode - keep password as-is
        },
        logger: false // Disable logging for cleaner output
      });

      await client.connect();
      console.log('IMAP connection successful');
      await client.logout();
      
      return { success: true };
    } catch (error) {
      console.error('IMAP connection test failed:', error);
      
      let errorMessage = 'Unknown connection error';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Provide specific error messages for common issues
        if (errorMessage.includes('authentication')) {
          errorMessage = 'Authentication failed. For Outlook, you need an App Password instead of your regular password.';
        } else if (errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED')) {
          errorMessage = 'Connection timeout. Check server address and port.';
        } else if (errorMessage.includes('certificate') || errorMessage.includes('SSL')) {
          errorMessage = 'SSL/TLS certificate error. Try with different security settings.';
        }
      }
      
      return { 
        success: false, 
        error: errorMessage
      };
    }
  }

  /**
   * Connect to IMAP server
   */
  private async connect(): Promise<ImapFlow> {
    if (!this.config) {
      throw new Error('No IMAP configuration provided');
    }

    if (this.client && !this.client.closed) {
      return this.client;
    }

    this.client = new ImapFlow({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.username,
        pass: this.config.password,
      },
    });

    await this.client.connect();
    return this.client;
  }

  /**
   * Fetch emails from inbox
   */
  async fetchEmails(limit: number = 50): Promise<EmailMessage[]> {
    try {
      const client = await this.connect();
      
      // Select INBOX
      const lock = await client.getMailboxLock('INBOX');
      
      try {
        // Search for recent emails
        const messages = client.fetch('1:*', {
          envelope: true,
          bodyText: true,
          flags: true,
          uid: true,
        }, { reverse: true });

        const emails: EmailMessage[] = [];
        let count = 0;

        for await (const message of messages) {
          if (count >= limit) break;

          // Parse email content
          const text = message.bodyText?.toString() || '';
          const from = message.envelope?.from?.[0] ? 
            `${message.envelope.from[0].name || ''} <${message.envelope.from[0].address}>`.trim() : 
            'Unknown';
          const to = message.envelope?.to?.[0] ? 
            `${message.envelope.to[0].name || ''} <${message.envelope.to[0].address}>`.trim() : 
            'Unknown';

          emails.push({
            id: message.uid?.toString() || message.seq.toString(),
            from: from,
            to: to,
            subject: message.envelope?.subject || 'No Subject',
            date: message.envelope?.date || new Date(),
            text: text,
            read: !message.flags?.has('\\Unseen'),
            processed: false, // We'll track this separately
          });

          count++;
        }

        return emails;
      } finally {
        lock.release();
      }
    } catch (error) {
      console.error('Error fetching emails:', error);
      throw new Error('Failed to fetch emails from inbox');
    }
  }

  /**
   * Mark email as read
   */
  async markAsRead(emailId: string): Promise<void> {
    try {
      const client = await this.connect();
      const lock = await client.getMailboxLock('INBOX');
      
      try {
        await client.messageFlagsAdd({ uid: emailId }, ['\\Seen']);
      } finally {
        lock.release();
      }
    } catch (error) {
      console.error('Error marking email as read:', error);
      throw new Error('Failed to mark email as read');
    }
  }

  /**
   * Get a specific email by ID
   */
  async getEmail(emailId: string): Promise<EmailMessage | null> {
    try {
      const client = await this.connect();
      const lock = await client.getMailboxLock('INBOX');
      
      try {
        const message = await client.fetchOne(emailId, {
          envelope: true,
          bodyText: true,
          bodyParts: true,
          flags: true,
          uid: true,
        });

        if (!message) return null;

        const text = message.bodyText?.toString() || '';
        const from = message.envelope?.from?.[0] ? 
          `${message.envelope.from[0].name || ''} <${message.envelope.from[0].address}>`.trim() : 
          'Unknown';
        const to = message.envelope?.to?.[0] ? 
          `${message.envelope.to[0].name || ''} <${message.envelope.to[0].address}>`.trim() : 
          'Unknown';

        return {
          id: message.uid?.toString() || emailId,
          from: from,
          to: to,
          subject: message.envelope?.subject || 'No Subject',
          date: message.envelope?.date || new Date(),
          text: text,
          html: message.bodyParts?.html || undefined,
          read: !message.flags?.has('\\Unseen'),
          processed: false,
        };
      } finally {
        lock.release();
      }
    } catch (error) {
      console.error('Error fetching email:', error);
      return null;
    }
  }

  /**
   * Parse email content for deal information
   */
  async parseEmailForDeal(email: EmailMessage) {
    return await parseEmailForDealInfo({
      from: email.from,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  }

  /**
   * Send response email to founder
   */
  async sendFounderResponse(founderEmail: string, dealInfo: any): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('No SendGrid API key, skipping response email');
      return false;
    }

    try {
      const responseContent = await generateFounderResponse(dealInfo);
      
      await mailService.send({
        to: founderEmail,
        from: 'ideas@aescuvest.vc',
        subject: `Thank you for your submission - ${dealInfo.companyName}`,
        text: responseContent,
        html: responseContent.replace(/\n/g, '<br>'),
      });

      return true;
    } catch (error) {
      console.error('Error sending founder response:', error);
      return false;
    }
  }

  /**
   * Close connection
   */
  async disconnect(): Promise<void> {
    if (this.client && !this.client.closed) {
      await this.client.logout();
      this.client = null;
    }
  }
}

// Global instance
export const emailInboxService = new EmailInboxService();