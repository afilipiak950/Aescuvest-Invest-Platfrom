import { loadMicrosoftTokens } from './microsoftAuth';

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

    // Check if token is expired
    if (Date.now() >= tokens.expiresAt) {
      return {
        emails: [],
        success: false,
        error: 'Microsoft token expired'
      };
    }

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