import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Mail, 
  Settings, 
  RefreshCw, 
  Eye, 
  Plus, 
  CheckCircle, 
  AlertCircle,
  Clock,
  User,
  Building
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

// HTML sanitization function for safe email display
function sanitizeEmailHtml(html: string): string {
  // Remove script tags and other dangerous elements
  const sanitized = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
    .replace(/on\w+='[^']*'/gi, '') // Remove event handlers
    .replace(/javascript:/gi, ''); // Remove javascript: URLs
  
  return sanitized;
}

// Convert HTML to plain text
function htmlToPlainText(html: string): string {
  if (!html) return '';
  
  // Remove HTML tags and decode HTML entities
  return html
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove style tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<br\s*\/?>/gi, '\n') // Convert <br> to newlines
    .replace(/<\/p>/gi, '\n\n') // Convert </p> to double newlines
    .replace(/<\/div>/gi, '\n') // Convert </div> to newlines
    .replace(/<\/li>/gi, '\n') // Convert </li> to newlines
    .replace(/<[^>]*>/g, '') // Remove all remaining HTML tags
    .replace(/&nbsp;/g, ' ') // Convert &nbsp; to spaces
    .replace(/&amp;/g, '&') // Convert &amp; to &
    .replace(/&lt;/g, '<') // Convert &lt; to <
    .replace(/&gt;/g, '>') // Convert &gt; to >
    .replace(/&quot;/g, '"') // Convert &quot; to "
    .replace(/&#39;/g, "'") // Convert &#39; to '
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Reduce multiple newlines to double
    .trim();
}

interface EmailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  text: string;
  html?: string;
  read: boolean;
  processed: boolean;
  hasAttachments?: boolean;
  attachments?: Array<{
    id: string;
    name: string;
    contentType: string;
    size: number;
    isInline: boolean;
  }>;
}

export default function InboxPage() {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [imapConfig, setImapConfig] = useState({
    host: '',
    port: 993,
    secure: true,
    username: '',
    password: ''
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch emails
  const { data: emailsData, isLoading: emailsLoading, error: emailsError } = useQuery({
    queryKey: ['/api/inbox/emails'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Test connection
  const { data: connectionStatus } = useQuery({
    queryKey: ['/api/inbox/test'],
    refetchInterval: 60000, // Check every minute
  });

  // Check Microsoft authentication status
  const { data: microsoftStatus, refetch: refetchMicrosoftStatus } = useQuery({
    queryKey: ['/api/microsoft/status'],
    refetchInterval: 30000, // Check every 30 seconds
  });

  // Check for Microsoft OAuth callback success/failure
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const microsoftAuth = urlParams.get('microsoft-auth');
    
    if (microsoftAuth === 'success') {
      console.log('Microsoft OAuth success detected, refreshing status...');
      toast({
        title: "Microsoft-Anmeldung erfolgreich!",
        description: "E-Mail-Verbindung wurde erfolgreich eingerichtet.",
      });
      
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Refresh Microsoft status and email data
      refetchMicrosoftStatus();
      queryClient.invalidateQueries({ queryKey: ['/api/inbox/test'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inbox/emails'] });
    } else if (microsoftAuth === 'error') {
      console.log('Microsoft OAuth error detected');
      toast({
        title: "Microsoft-Anmeldung fehlgeschlagen",
        description: "Bitte versuche es erneut oder verwende die manuelle IMAP-Konfiguration.",
        variant: "destructive",
      });
      
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast, refetchMicrosoftStatus, queryClient]);

  // Configure IMAP mutation
  const configMutation = useMutation({
    mutationFn: async (config: typeof imapConfig) => {
      const response = await fetch('/api/inbox/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('IMAP config error:', errorText);
        
        try {
          const error = JSON.parse(errorText);
          throw new Error(error.error || error.message || 'Failed to configure IMAP');
        } catch (parseError) {
          throw new Error(`Server error: ${response.status}. Please check server logs.`);
        }
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "IMAP Configuration Successful!",
        description: "E-Mail-Verbindung wurde erfolgreich eingerichtet.",
      });
      setConfigDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/inbox/test'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inbox/emails'] });
    },
    onError: (error) => {
      toast({
        title: "Konfiguration fehlgeschlagen",
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
        variant: "destructive",
      });
    },
  });

  // Create deal from email mutation
  const createDealMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const response = await fetch(`/api/inbox/emails/${emailId}/create-deal`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create deal');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Deal erfolgreich erstellt!",
        description: `Deal für ${data.deal.companyName} wurde angelegt.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inbox/emails'] });
    },
    onError: (error) => {
      toast({
        title: "Deal-Erstellung fehlgeschlagen",
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
        variant: "destructive",
      });
    },
  });

  // Parse email mutation
  const parseEmailMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const response = await fetch(`/api/inbox/emails/${emailId}/parse`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to parse email');
      }

      return response.json();
    },
  });

  const handleConfigSave = () => {
    configMutation.mutate(imapConfig);
  };

  // Microsoft 365 OAuth authentication
  const handleMicrosoftAuth = async () => {
    try {
      const response = await fetch('/api/microsoft/auth-url', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to get authorization URL');
      }
      
      const data = await response.json();
      
      if (data.success && data.authUrl) {
        console.log('Microsoft auth response:', data);
        console.log('Auth URL type:', typeof data.authUrl);
        console.log('Auth URL value:', data.authUrl);
        
        // Ensure authUrl is a string
        const authUrl = typeof data.authUrl === 'string' ? data.authUrl : String(data.authUrl);
        
        if (authUrl && authUrl !== '[object Object]' && authUrl.startsWith('http')) {
          // Open Microsoft login in new window
          window.open(authUrl, '_blank');
          
          toast({
            title: "Microsoft-Anmeldung geöffnet",
            description: "Melde dich in dem neuen Fenster mit deinen Microsoft 365-Zugangsdaten an.",
          });
        } else {
          toast({
            title: "Fehler bei Microsoft-Anmeldung",
            description: `Ungültige Auth-URL: ${authUrl}`,
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      toast({
        title: "Fehler bei Microsoft-Anmeldung",
        description: "Konnte Anmeldung nicht starten. Versuche es erneut.",
        variant: "destructive",
      });
    }
  };

  // Fetch full email details
  const { data: fullEmailData, isLoading: emailLoading } = useQuery({
    queryKey: ['/api/inbox/emails', selectedEmail?.id],
    queryFn: async () => {
      if (!selectedEmail?.id) return null;
      const response = await fetch(`/api/inbox/emails/${selectedEmail.id}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch email details');
      }
      return response.json();
    },
    enabled: !!selectedEmail?.id,
  });

  const handleViewEmail = (email: EmailMessage) => {
    console.log('🔍 handleViewEmail called with email:', email.id, email.subject);
    setSelectedEmail(email);
    setEmailDialogOpen(true);
  };

  const handleCreateDeal = (emailId: string) => {
    console.log('🔍 handleCreateDeal called with emailId:', emailId);
    console.log('🔍 createDealMutation.isPending:', createDealMutation.isPending);
    
    if (createDealMutation.isPending) {
      console.log('🔍 Deal creation already in progress, skipping');
      return;
    }
    
    console.log('🔍 Starting deal creation mutation...');
    createDealMutation.mutate(emailId);
  };

  const refreshEmails = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/inbox/emails'] });
  };

  const handleDownloadAttachment = async (emailId: string, attachmentId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/inbox/emails/${emailId}/attachments/${attachmentId}/download`);
      if (!response.ok) {
        throw new Error(`Failed to download attachment: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download erfolgreich",
        description: `${fileName} wurde heruntergeladen.`,
      });
    } catch (error) {
      console.error('Error downloading attachment:', error);
      toast({
        title: "Download fehlgeschlagen",
        description: "Der Anhang konnte nicht heruntergeladen werden.",
        variant: "destructive",
      });
    }
  };

  const emails = (emailsData as any)?.emails || [];
  const unreadCount = emails.filter((email: EmailMessage) => !email.read).length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-white">E-Mail Inbox</h1>
            <p className="text-gray-400">
              {emails.length} E-Mails ({unreadCount} ungelesen)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshEmails}
            disabled={emailsLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${emailsLoading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>

          <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                E-Mail Einstellungen
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-800">
              <DialogHeader>
                <DialogTitle>IMAP E-Mail Konfiguration</DialogTitle>
                <DialogDescription>
                  Verbinde dein E-Mail-Postfach für ideas@aescuvest.vc
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Microsoft 365 OAuth Setup */}
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-green-300 mb-2">🚀 Microsoft 365 Business - Sichere Anmeldung</h3>
                  <p className="text-xs text-gray-400 mb-3">
                    Für Business-Accounts: Einfach mit deinen normalen Microsoft-Zugangsdaten anmelden
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMicrosoftAuth}
                    className="w-full bg-green-600 hover:bg-green-700 border-green-500"
                  >
                    Mit Microsoft 365 verbinden
                  </Button>
                </div>

                <div>
                  <Label htmlFor="host">IMAP Server</Label>
                  <Input
                    id="host"
                    value={imapConfig.host}
                    onChange={(e) => setImapConfig({ ...imapConfig, host: e.target.value })}
                    placeholder="outlook.office365.com"
                    className="bg-gray-800 border-gray-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      type="number"
                      value={imapConfig.port}
                      onChange={(e) => setImapConfig({ ...imapConfig, port: parseInt(e.target.value) })}
                      className="bg-gray-800 border-gray-700"
                    />
                  </div>
                  <div className="flex items-center space-x-2 pt-6">
                    <Switch
                      id="secure"
                      checked={imapConfig.secure}
                      onCheckedChange={(checked) => setImapConfig({ ...imapConfig, secure: checked })}
                    />
                    <Label htmlFor="secure">SSL/TLS</Label>
                  </div>
                </div>

                <div>
                  <Label htmlFor="username">Benutzername/E-Mail</Label>
                  <Input
                    id="username"
                    value={imapConfig.username}
                    onChange={(e) => setImapConfig({ ...imapConfig, username: e.target.value })}
                    placeholder="ideas@aescuvest.vc"
                    className="bg-gray-800 border-gray-700"
                  />
                </div>

                <div>
                  <Label htmlFor="password">Passwort/App-Passwort</Label>
                  <Input
                    id="password"
                    type="password"
                    value={imapConfig.password}
                    onChange={(e) => setImapConfig({ ...imapConfig, password: e.target.value })}
                    placeholder="Dein Microsoft App-Passwort (16 Zeichen)"
                    className="bg-gray-800 border-gray-700"
                  />
                  
                  {/* App-Passwort Hilfe für Outlook */}
                  {imapConfig.host.includes('outlook') && (
                    <div className="mt-2 bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3">
                      <h4 className="text-xs font-medium text-yellow-300 mb-1">🔑 Microsoft App-Passwort benötigt</h4>
                      <div className="text-xs text-gray-400 space-y-1">
                        <p>1. Gehe zu: <span className="text-blue-400">account.microsoft.com</span></p>
                        <p>2. Klicke auf "Sicherheit" → "Erweiterte Sicherheitsoptionen"</p>
                        <p>3. Suche "App-Passwörter" und erstelle ein neues</p>
                        <p>4. Kopiere das 16-stellige Passwort hierher</p>
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-blue-400 text-xs mt-1"
                        onClick={() => window.open('https://account.microsoft.com/security', '_blank')}
                      >
                        Microsoft-Sicherheitseinstellungen öffnen →
                      </Button>
                    </div>
                  )}
                </div>

                <Button 
                  onClick={handleConfigSave}
                  disabled={configMutation.isPending}
                  className="w-full"
                >
                  {configMutation.isPending ? 'Teste Verbindung...' : 'Konfiguration speichern'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Connection Status */}
      <div className="space-y-2">
        {/* Microsoft OAuth Status */}
        {microsoftStatus && (() => {
          const status = microsoftStatus as any;
          return (
            <Alert className={status?.authenticated ? "border-green-500" : "border-yellow-500"}>
              {status?.authenticated ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              )}
              <AlertDescription>
                Microsoft 365: {status?.authenticated ? 'Verbunden' : 'Nicht verbunden'}
                {status?.authenticated && status?.email ? ` - ${status.email}` : ''}
              </AlertDescription>
            </Alert>
          );
        })()}
        

      </div>

      {/* Email List */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle>Eingehende E-Mails</CardTitle>
          <CardDescription>
            Klicke auf "Deal erstellen" um automatisch einen Deal aus der E-Mail zu generieren.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>Lade E-Mails...</span>
            </div>
          ) : emailsError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Fehler beim Laden der E-Mails. Überprüfe deine IMAP-Konfiguration.
              </AlertDescription>
            </Alert>
          ) : emails.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Keine E-Mails gefunden</p>
              <p className="text-sm">Konfiguriere zuerst deine E-Mail-Verbindung</p>
            </div>
          ) : (
            <div className="space-y-3">
              {emails.map((email: EmailMessage) => (
                <div
                  key={email.id}
                  className={`p-4 rounded-lg border ${
                    email.read ? 'bg-gray-800 border-gray-700' : 'bg-gray-800/80 border-primary/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium truncate">
                          {email.from}
                        </span>
                        {!email.read && (
                          <Badge variant="secondary" className="text-xs">Neu</Badge>
                        )}
                      </div>
                      
                      <h3 className="font-medium text-white mb-1 truncate">
                        {email.subject}
                      </h3>
                      
                      <p className="text-sm text-gray-400 line-clamp-2 mb-2">
                        {email.text.substring(0, 150)}...
                      </p>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(email.date), { addSuffix: true })}
                        </div>
                        {email.hasAttachments && (
                          <div className="flex items-center gap-1 text-blue-400">
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 1110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd"/>
                            </svg>
                            Anhang
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          console.log('🔍 View button clicked for email:', email.id);
                          e.preventDefault();
                          e.stopPropagation();
                          handleViewEmail(email);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Anzeigen
                      </Button>
                      
                      <Button
                        variant="default"
                        size="sm"
                        onClick={(e) => {
                          console.log('🔍 Create deal button clicked for email:', email.id);
                          e.preventDefault();
                          e.stopPropagation();
                          handleCreateDeal(email.id);
                        }}
                        disabled={createDealMutation.isPending}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Deal erstellen
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Detail Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-[95vw] w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden">
          {selectedEmail && (
            <>
              <DialogHeader className="p-6 pb-0 shrink-0">
                <DialogTitle className="text-xl">{selectedEmail.subject}</DialogTitle>
                <DialogDescription>
                  Von: {selectedEmail.from} • {formatDistanceToNow(new Date(selectedEmail.date), { addSuffix: true })}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto space-y-4">
                {emailLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                    <span>Lade vollständigen E-Mail-Inhalt...</span>
                  </div>
                ) : (
                  <>
                    {/* Email Header */}
                    <div className="bg-gray-800 p-4 mx-6 rounded-lg border-b border-gray-700">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-white">
                            {fullEmailData?.subject || selectedEmail.subject}
                          </h3>
                          <span className="text-sm text-gray-400">
                            {formatDistanceToNow(new Date(fullEmailData?.date || selectedEmail.date), { addSuffix: true })}
                          </span>
                        </div>
                        
                        <div className="text-sm text-gray-300">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">Von:</span>
                            <span>{fullEmailData?.from || selectedEmail.from}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">An:</span>
                            <span>{fullEmailData?.to || selectedEmail.to}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Email Content */}
                    <div className="flex-1 bg-gray-800 p-6 mx-6 rounded-lg overflow-y-auto min-h-[400px]">
                      <div className="w-full max-w-none">
                        <div className="text-gray-100 leading-relaxed whitespace-pre-wrap break-words w-full">
                          {(() => {
                            const emailData = fullEmailData || selectedEmail;
                            
                            // Try HTML content first
                            if (emailData?.html && emailData.html.trim()) {
                              return htmlToPlainText(emailData.html);
                            }
                            
                            // Try text content
                            if (emailData?.text && emailData.text.trim()) {
                              return emailData.text;
                            }
                            
                            return 'Keine E-Mail-Inhalte verfügbar';
                          })()}
                        </div>
                      </div>
                    </div>
                    
                    {/* Enhanced Attachment Debug Section */}
                    <div className="bg-gray-700 p-4 mx-6 rounded-lg text-xs">
                      <div className="text-yellow-400 mb-3 font-semibold">🔍 Enhanced Attachment Debug Info:</div>
                      <div className="space-y-2 text-gray-300">
                        {/* Email Data Status */}
                        <div className="bg-gray-800 p-2 rounded">
                          <div className="text-blue-400 font-medium mb-1">Email Data Status:</div>
                          <div>• Selected Email ID: {selectedEmail?.id || 'N/A'}</div>
                          <div>• Full Email Data ID: {fullEmailData?.id || 'N/A'}</div>
                          <div>• Email Loading: {emailLoading ? 'Yes' : 'No'}</div>
                          <div>• Data Fetch Complete: {fullEmailData ? 'Yes' : 'No'}</div>
                        </div>

                        {/* Attachment Flags */}
                        <div className="bg-gray-800 p-2 rounded">
                          <div className="text-green-400 font-medium mb-1">Attachment Flags:</div>
                          <div>• Selected Email hasAttachments: {selectedEmail?.hasAttachments ? 'Yes' : 'No'}</div>
                          <div>• Full Email hasAttachments: {fullEmailData?.hasAttachments ? 'Yes' : 'No'}</div>
                          <div>• Selected Email attachmentProperty: {selectedEmail?.attachmentProperty ? 'Yes' : 'No'}</div>
                          <div>• Selected Email attachmentValue: {selectedEmail?.attachmentValue ? 'Yes' : 'No'}</div>
                        </div>

                        {/* Attachment Data */}
                        <div className="bg-gray-800 p-2 rounded">
                          <div className="text-purple-400 font-medium mb-1">Attachment Data:</div>
                          <div>• Attachments Array Type: {typeof fullEmailData?.attachments}</div>
                          <div>• Attachments Array Length: {fullEmailData?.attachments ? fullEmailData.attachments.length : 'N/A'}</div>
                          <div>• Attachments Exists: {fullEmailData?.attachments ? 'Yes' : 'No'}</div>
                          <div>• Is Array: {Array.isArray(fullEmailData?.attachments) ? 'Yes' : 'No'}</div>
                        </div>

                        {/* Full Email Data Keys */}
                        <div className="bg-gray-800 p-2 rounded">
                          <div className="text-orange-400 font-medium mb-1">Full Email Data Keys:</div>
                          <div className="text-xs">
                            {fullEmailData ? Object.keys(fullEmailData).join(', ') : 'No full email data'}
                          </div>
                        </div>

                        {/* Raw Attachment Data */}
                        {fullEmailData?.attachments && (
                          <div className="bg-gray-800 p-2 rounded max-h-40 overflow-y-auto">
                            <div className="text-red-400 font-medium mb-1">Raw Attachment Data:</div>
                            <pre className="whitespace-pre-wrap text-xs">
                              {JSON.stringify(fullEmailData.attachments, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Server Response Debug */}
                        <div className="bg-gray-800 p-2 rounded">
                          <div className="text-cyan-400 font-medium mb-1">Server Response Debug:</div>
                          <div>• Response Status: {emailError ? 'Error' : 'Success'}</div>
                          <div>• Error Message: {emailError || 'None'}</div>
                          <div>• Last Fetch Time: {new Date().toLocaleTimeString()}</div>
                        </div>
                      </div>
                    </div>

                    {/* Attachment Display */}
                    {(fullEmailData?.hasAttachments || selectedEmail?.hasAttachments) && (
                      <div className="bg-gray-800 p-4 mx-6 rounded-lg">
                        <h4 className="font-semibold text-white mb-3 flex items-center">
                          <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z"/>
                          </svg>
                          Anhänge {fullEmailData?.attachments ? `(${fullEmailData.attachments.length})` : '(wird geladen...)'}
                        </h4>
                        
                        {fullEmailData?.attachments && fullEmailData.attachments.length > 0 ? (
                          <div className="space-y-2">
                            {fullEmailData.attachments.map((attachment: any, index: number) => (
                              <div key={attachment.id || index} className="flex items-center justify-between p-3 bg-gray-700 rounded hover:bg-gray-600 transition-colors">
                                <div className="flex items-center flex-1">
                                  <svg className="h-5 w-5 mr-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/>
                                  </svg>
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-white">{attachment.name || 'Unnamed attachment'}</div>
                                    <div className="text-xs text-gray-400 flex items-center gap-2">
                                      <span>{attachment.size ? Math.round(attachment.size / 1024) + ' KB' : 'Unknown size'}</span>
                                      <span>•</span>
                                      <span>{attachment.contentType || 'Unknown type'}</span>
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDownloadAttachment(selectedEmail?.id || '', attachment.id, attachment.name)}
                                  className="ml-3 shrink-0"
                                >
                                  <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/>
                                  </svg>
                                  Download
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-gray-400 text-sm">
                            {fullEmailData?.attachments === undefined ? 
                              'Lade Anhänge...' : 
                              'E-Mail hat Anhänge laut Microsoft, aber keine Details verfügbar'
                            }
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {/* Bottom Action Button */}
              <div className="px-6 py-4 border-t border-gray-700 shrink-0">
                <Button
                  onClick={() => handleCreateDeal(selectedEmail.id)}
                  disabled={createDealMutation.isPending}
                  className="w-full"
                >
                  <Building className="h-4 w-4 mr-2" />
                  Deal aus dieser E-Mail erstellen
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}