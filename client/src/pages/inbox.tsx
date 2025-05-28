import { useState } from "react";
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

  const handleViewEmail = (email: EmailMessage) => {
    setSelectedEmail(email);
    setEmailDialogOpen(true);
  };

  const handleCreateDeal = (emailId: string) => {
    createDealMutation.mutate(emailId);
  };

  const refreshEmails = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/inbox/emails'] });
  };

  const emails = emailsData?.emails || [];
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
      {connectionStatus && (
        <Alert className={connectionStatus.success ? "border-green-500" : "border-red-500"}>
          {connectionStatus.success ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-500" />
          )}
          <AlertDescription>
            E-Mail Verbindung: {connectionStatus.success ? 'Aktiv' : 'Nicht verbunden'}
            {connectionStatus.error && ` - ${connectionStatus.error}`}
          </AlertDescription>
        </Alert>
      )}

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
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewEmail(email)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Anzeigen
                      </Button>
                      
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleCreateDeal(email.id)}
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
        <DialogContent className="bg-gray-900 border-gray-800 max-w-4xl max-h-[80vh] overflow-y-auto">
          {selectedEmail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedEmail.subject}</DialogTitle>
                <DialogDescription>
                  Von: {selectedEmail.from} • {formatDistanceToNow(new Date(selectedEmail.date), { addSuffix: true })}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="content" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="content">E-Mail Inhalt</TabsTrigger>
                  <TabsTrigger value="preview">Deal Vorschau</TabsTrigger>
                </TabsList>
                
                <TabsContent value="content" className="space-y-4">
                  <div className="bg-gray-800 p-4 rounded-lg">
                    <pre className="whitespace-pre-wrap text-sm text-gray-300 font-mono">
                      {selectedEmail.text}
                    </pre>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleCreateDeal(selectedEmail.id)}
                      disabled={createDealMutation.isPending}
                    >
                      <Building className="h-4 w-4 mr-2" />
                      Deal aus dieser E-Mail erstellen
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="preview" className="space-y-4">
                  <Button
                    onClick={() => parseEmailMutation.mutate(selectedEmail.id)}
                    disabled={parseEmailMutation.isPending}
                    variant="outline"
                  >
                    {parseEmailMutation.isPending ? 'Analysiere...' : 'E-Mail analysieren'}
                  </Button>
                  
                  {parseEmailMutation.data && (
                    <div className="bg-gray-800 p-4 rounded-lg">
                      {parseEmailMutation.data.extracted ? (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-primary">Extrahierte Deal-Informationen:</h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><strong>Unternehmen:</strong> {parseEmailMutation.data.extracted.companyName}</div>
                            <div><strong>Sektor:</strong> {parseEmailMutation.data.extracted.sector}</div>
                            <div><strong>Phase:</strong> {parseEmailMutation.data.extracted.stage}</div>
                            <div><strong>Standort:</strong> {parseEmailMutation.data.extracted.location || 'Nicht angegeben'}</div>
                          </div>
                          <div className="mt-4">
                            <strong>Beschreibung:</strong>
                            <p className="text-gray-300 mt-1">{parseEmailMutation.data.extracted.description}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-400">Keine Deal-Informationen in dieser E-Mail gefunden.</p>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}