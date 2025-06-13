import { storage } from '../storage';
import { refreshMicrosoftTokens } from './microsoftAuth';

// Load Microsoft tokens with automatic refresh
async function loadMicrosoftTokens(): Promise<any | null> {
  try {
    const connection = await storage.getMicrosoftEmailConnection();
    if (connection && connection.authenticated) {
      // Check if token is expired and refresh if needed
      const isExpired = Date.now() >= connection.expiresAt;
      
      if (isExpired && connection.refreshToken) {
        console.log('[Microsoft Emails] Token expired, attempting automatic refresh...');
        try {
          const newTokens = await refreshMicrosoftTokens(connection.refreshToken);
          
          // Save refreshed tokens
          await storage.saveMicrosoftEmailConnection({
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken,
            expiresAt: newTokens.expiresAt,
            email: connection.email,
            authenticated: true,
            connectedAt: connection.connectedAt || new Date()
          });
          
          console.log('[Microsoft Emails] Automatic token refresh successful');
          
          return {
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken,
            expiresAt: newTokens.expiresAt,
            email: connection.email
          };
        } catch (refreshError) {
          console.error('[Microsoft Emails] Automatic token refresh failed:', refreshError);
          // Token refresh failed, user needs to re-authenticate
          await storage.clearMicrosoftEmailConnection();
          return null;
        }
      }
      
      return {
        accessToken: connection.accessToken,
        refreshToken: connection.refreshToken,
        expiresAt: connection.expiresAt,
        email: connection.email
      };
    }
    return null;
  } catch (error) {
    console.error('[Microsoft Emails] Failed to load tokens:', error);
    return null;
  }
}

export interface MicrosoftEmailMessage {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  receivedDateTime: string;
  isRead: boolean;
  bodyPreview: string;
  body: {
    contentType: string;
    content: string;
  };
  hasAttachments: boolean;
  importance: string;
  flag: {
    flagStatus: string;
  };
}

/**
 * Fetch emails from Microsoft Graph API
 */
export async function fetchMicrosoftEmails(
  folderId: string = 'inbox',
  top: number = 50
): Promise<{ emails: MicrosoftEmailMessage[]; success: boolean; error?: string }> {
  try {
    console.log('[Microsoft Emails] Fetching emails from folder:', folderId);
    
    const tokens = await loadMicrosoftTokens();
    if (!tokens || !tokens.accessToken) {
      return {
        emails: [],
        success: false,
        error: 'No Microsoft authentication available'
      };
    }

    // Token expiration is handled by loadMicrosoftTokens() with automatic refresh
    console.log('[Microsoft Emails] Using tokens that expire at:', new Date(tokens.expiresAt));

    const graphUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/${folderId}/messages?$top=${top}&$orderby=receivedDateTime desc&$select=id,subject,from,toRecipients,receivedDateTime,isRead,bodyPreview,body,hasAttachments,importance,flag`;
    
    console.log('[Microsoft Emails] Making Graph API request:', graphUrl);

    const response = await fetch(graphUrl, {
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Microsoft Emails] Graph API error:', response.status, errorText);
      return {
        emails: [],
        success: false,
        error: `Microsoft Graph API error: ${response.status} - ${errorText}`
      };
    }

    const data = await response.json();
    console.log('[Microsoft Emails] Successfully fetched', data.value?.length || 0, 'emails');

    const emails: MicrosoftEmailMessage[] = data.value || [];

    return {
      emails,
      success: true
    };

  } catch (error) {
    console.error('[Microsoft Emails] Error fetching emails:', error);
    return {
      emails: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get email attachments from Microsoft Graph API
 */
export async function getMicrosoftEmailAttachments(emailId: string): Promise<any[]> {
  try {
    console.log('[Microsoft Emails] 🔍 DEBUGGING: Fetching attachments for email:', emailId);
    
    const tokens = await loadMicrosoftTokens();
    if (!tokens || !tokens.accessToken) {
      console.error('[Microsoft Emails] 🔍 DEBUGGING: No Microsoft authentication available');
      return [];
    }

    // First, let's try to get the email details again to verify hasAttachments
    const emailDetailsUrl = `https://graph.microsoft.com/v1.0/me/messages/${emailId}?$select=id,subject,hasAttachments`;
    const emailResponse = await fetch(emailDetailsUrl, {
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (emailResponse.ok) {
      const emailData = await emailResponse.json();
      console.log('[Microsoft Emails] 🔍 DEBUGGING: Email verification:', {
        id: emailData.id,
        subject: emailData.subject,
        hasAttachments: emailData.hasAttachments,
        hasAttachmentsType: typeof emailData.hasAttachments
      });
    }

    // Try multiple attachment endpoints to handle different scenarios
    const attachmentEndpoints = [
      `https://graph.microsoft.com/v1.0/me/messages/${emailId}/attachments`,
      `https://graph.microsoft.com/v1.0/me/messages/${emailId}/attachments?$expand=microsoft.graph.itemattachment/item`,
      `https://graph.microsoft.com/v1.0/me/messages/${emailId}/attachments?$select=id,name,contentType,size,@odata.type`
    ];

    for (let i = 0; i < attachmentEndpoints.length; i++) {
      const graphUrl = attachmentEndpoints[i];
      console.log(`[Microsoft Emails] 🔍 DEBUGGING: Trying endpoint ${i + 1}:`, graphUrl);
      
      const response = await fetch(graphUrl, {
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      console.log(`[Microsoft Emails] 🔍 DEBUGGING: Endpoint ${i + 1} response:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Microsoft Emails] 🔍 DEBUGGING: Endpoint ${i + 1} error:`, response.status, errorText);
        continue;
      }

      const data = await response.json();
      console.log(`[Microsoft Emails] 🔍 DEBUGGING: Endpoint ${i + 1} data:`, {
        hasValue: !!data.value,
        valueType: typeof data.value,
        attachmentCount: data.value?.length || 0,
        dataKeys: Object.keys(data),
        fullResponse: data
      });
      
      if (data.value && data.value.length > 0) {
        console.log(`[Microsoft Emails] 🔍 DEBUGGING: Found ${data.value.length} attachments:`, 
          data.value.map((att: any) => ({
            id: att.id,
            name: att.name,
            contentType: att.contentType,
            size: att.size,
            type: att['@odata.type'],
            isInline: att.isInline
          })));
        return data.value;
      }
    }
    
    console.log('[Microsoft Emails] 🔍 DEBUGGING: No attachments found in any endpoint');
    return [];
  } catch (error) {
    console.error('[Microsoft Emails] 🔍 DEBUGGING: Error fetching attachments:', error);
    return [];
  }
}

/**
 * Get a specific email by ID from Microsoft Graph API
 */
export async function getMicrosoftEmail(emailId: string): Promise<MicrosoftEmailMessage | null> {
  try {
    console.log('[Microsoft Emails] Fetching email by ID:', emailId);
    
    const tokens = await loadMicrosoftTokens();
    if (!tokens || !tokens.accessToken) {
      console.error('[Microsoft Emails] No Microsoft authentication available');
      return null;
    }

    // Token expiration is handled by loadMicrosoftTokens() with automatic refresh
    console.log('[Microsoft Emails] Using tokens for individual email fetch');

    const graphUrl = `https://graph.microsoft.com/v1.0/me/messages/${emailId}?$select=id,subject,from,toRecipients,receivedDateTime,isRead,bodyPreview,body,hasAttachments,importance,flag`;
    
    console.log('[Microsoft Emails] Making Graph API request for email:', graphUrl);

    const response = await fetch(graphUrl, {
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Microsoft Emails] Graph API error fetching email:', response.status, errorText);
      return null;
    }

    const email: MicrosoftEmailMessage = await response.json();
    console.log('[Microsoft Emails] Successfully fetched email:', {
      id: email.id,
      subject: email.subject,
      from: email.from?.emailAddress?.address,
      hasAttachments: email.hasAttachments,
      attachmentProperty: 'hasAttachments' in email,
      attachmentValue: email.hasAttachments
    });

    return email;

  } catch (error) {
    console.error('[Microsoft Emails] Error fetching email by ID:', error);
    return null;
  }
}

/**
 * Mark email as read/unread
 */
export async function markEmailAsRead(emailId: string, isRead: boolean = true): Promise<boolean> {
  try {
    const tokens = await loadMicrosoftTokens();
    if (!tokens || !tokens.accessToken) {
      throw new Error('No Microsoft authentication available');
    }

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${emailId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        isRead: isRead
      })
    });

    if (!response.ok) {
      console.error('[Microsoft Emails] Error marking email as read:', response.status, await response.text());
      return false;
    }

    console.log('[Microsoft Emails] Email marked as', isRead ? 'read' : 'unread');
    return true;

  } catch (error) {
    console.error('[Microsoft Emails] Error marking email as read:', error);
    return false;
  }
}

/**
 * Get email folders
 */
export async function getMicrosoftEmailFolders(): Promise<Array<{ id: string; displayName: string; totalItemCount: number; unreadItemCount: number }>> {
  try {
    const tokens = await loadMicrosoftTokens();
    if (!tokens || !tokens.accessToken) {
      return [];
    }

    const response = await fetch('https://graph.microsoft.com/v1.0/me/mailFolders?$select=id,displayName,totalItemCount,unreadItemCount', {
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('[Microsoft Emails] Error fetching folders:', response.status);
      return [];
    }

    const data = await response.json();
    return data.value || [];

  } catch (error) {
    console.error('[Microsoft Emails] Error fetching folders:', error);
    return [];
  }
}

/**
 * Search emails
 */
export async function searchMicrosoftEmails(
  query: string,
  folderId: string = 'inbox',
  top: number = 25
): Promise<{ emails: MicrosoftEmailMessage[]; success: boolean; error?: string }> {
  try {
    const tokens = await loadMicrosoftTokens();
    if (!tokens || !tokens.accessToken) {
      return {
        emails: [],
        success: false,
        error: 'No Microsoft authentication available'
      };
    }

    const searchUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/${folderId}/messages?$search="${encodeURIComponent(query)}"&$top=${top}&$orderby=receivedDateTime desc&$select=id,subject,from,toRecipients,receivedDateTime,isRead,bodyPreview,body,hasAttachments,importance,flag`;

    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        emails: [],
        success: false,
        error: `Search failed: ${response.status} - ${errorText}`
      };
    }

    const data = await response.json();
    
    return {
      emails: data.value || [],
      success: true
    };

  } catch (error) {
    console.error('[Microsoft Emails] Error searching emails:', error);
    return {
      emails: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}