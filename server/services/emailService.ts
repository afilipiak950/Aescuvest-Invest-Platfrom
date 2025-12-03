import { Resend } from 'resend';

// Lazy initialization to avoid crashing on startup if API key is missing
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// Use Resend's default test sender for development
// For production, set RESEND_FROM_EMAIL env var to your verified domain email
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const APP_NAME = 'Aescuvest';

interface SendPasswordResetEmailParams {
  email: string;
  name: string;
  resetToken: string;
  resetUrl: string;
}

export async function sendPasswordResetEmail({
  email,
  name,
  resetToken,
  resetUrl
}: SendPasswordResetEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResendClient();
    if (!resend) {
      console.error('RESEND_API_KEY is not configured');
      return { success: false, error: 'Email service not configured. Please contact support.' };
    }

    const { data, error } = await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [email],
      subject: `Reset Your ${APP_NAME} Password`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: #4ade80; margin: 0; font-size: 28px;">${APP_NAME}</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1a1a2e; margin-top: 0;">Password Reset Request</h2>
            
            <p>Hi ${name || 'there'},</p>
            
            <p>We received a request to reset your password for your ${APP_NAME} account. Click the button below to create a new password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); 
                        color: #1a1a2e; 
                        padding: 14px 32px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        font-weight: 600;
                        display: inline-block;
                        font-size: 16px;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">
              This link will expire in <strong>1 hour</strong> for security reasons.
            </p>
            
            <p style="color: #6b7280; font-size: 14px;">
              If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="color: #4ade80; font-size: 12px; word-break: break-all; margin-top: 5px;">
              ${resetUrl}
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
            <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
            <p>AI-Powered Investment Intelligence Platform</p>
          </div>
        </body>
        </html>
      `,
      text: `
Hi ${name || 'there'},

We received a request to reset your password for your ${APP_NAME} account.

Click this link to reset your password (expires in 1 hour):
${resetUrl}

If you didn't request a password reset, you can safely ignore this email.

- The ${APP_NAME} Team
      `.trim()
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Password reset email sent to ${email}, ID: ${data?.id}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send email' 
    };
  }
}

export async function testEmailConfiguration(): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: 'RESEND_API_KEY is not configured' };
  }
  return { success: true };
}
