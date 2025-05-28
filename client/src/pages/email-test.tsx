import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Mail, TestTube, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function EmailTestPage() {
  const [testEmail, setTestEmail] = useState({
    from: 'founder@startup.com',
    subject: 'Investment Opportunity - TechCorp AI Platform',
    text: `Dear Aescuvest Team,

I hope this email finds you well. I'm reaching out to introduce you to TechCorp, an innovative AI-powered platform that's revolutionizing the fintech industry.

Company: TechCorp
Sector: FinTech
Stage: Series A
Location: Berlin, Germany
Website: www.techcorp.ai
Funding: €2.5M

We're building an AI-driven financial analytics platform that helps small businesses make better investment decisions. Our platform has already gained significant traction with over 10,000 users and €500K in ARR.

As the founder and CEO, I have 8 years of experience in fintech and previously founded two successful startups. Our team consists of experienced engineers from Google and McKinsey.

We're currently raising €2.5M in Series A funding to expand our team and accelerate growth across European markets.

I'd love to schedule a call to discuss this opportunity further.

Best regards,
Alex Johnson
CEO & Founder
alex@techcorp.ai
+49 30 12345678`,
    html: ''
  });

  const { toast } = useToast();

  // Test email service status
  const { data: serviceStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/email/test'],
    refetchInterval: 30000, // Check every 30 seconds
  });

  // Test email parsing mutation
  const parseEmailMutation = useMutation({
    mutationFn: async (emailData: typeof testEmail) => {
      const response = await fetch('/api/email/test-parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(emailData),
      });

      if (!response.ok) {
        throw new Error('Failed to parse email');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Email Parsed Successfully!",
        description: `Extracted information for ${data.extracted?.companyName || 'Unknown Company'}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Parsing Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    },
  });

  const handleTestParse = () => {
    parseEmailMutation.mutate(testEmail);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Mail className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold text-white">Email Integration Test</h1>
      </div>

      {/* Service Status */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Service Status
          </CardTitle>
          <CardDescription>
            Check if the email service is properly configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div className="animate-pulse">Loading...</div>
          ) : serviceStatus ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {serviceStatus.hasApiKey ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <span>SendGrid API Key: {serviceStatus.hasApiKey ? 'Configured' : 'Missing'}</span>
              </div>
              <div className="text-sm text-gray-400">
                Last checked: {new Date(serviceStatus.timestamp).toLocaleString()}
              </div>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Unable to check service status</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Email Test Form */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle>Test Email Parsing</CardTitle>
          <CardDescription>
            Test the AI-powered email parsing functionality with sample pitch emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">From Email:</label>
            <Input
              value={testEmail.from}
              onChange={(e) => setTestEmail({ ...testEmail, from: e.target.value })}
              placeholder="founder@startup.com"
              className="bg-gray-800 border-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Subject:</label>
            <Input
              value={testEmail.subject}
              onChange={(e) => setTestEmail({ ...testEmail, subject: e.target.value })}
              placeholder="Investment Opportunity - Company Name"
              className="bg-gray-800 border-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Email Content:</label>
            <Textarea
              value={testEmail.text}
              onChange={(e) => setTestEmail({ ...testEmail, text: e.target.value })}
              placeholder="Enter the email content here..."
              rows={12}
              className="bg-gray-800 border-gray-700"
            />
          </div>

          <Button 
            onClick={handleTestParse}
            disabled={parseEmailMutation.isPending}
            className="w-full"
          >
            {parseEmailMutation.isPending ? 'Parsing...' : 'Test Email Parsing'}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {parseEmailMutation.data && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle>Parsing Results</CardTitle>
            <CardDescription>
              Extracted deal information from the email
            </CardDescription>
          </CardHeader>
          <CardContent>
            {parseEmailMutation.data.extracted ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold text-primary mb-2">Company Information</h3>
                    <div className="space-y-2 text-sm">
                      <div><strong>Name:</strong> {parseEmailMutation.data.extracted.companyName}</div>
                      <div><strong>Sector:</strong> <Badge variant="secondary">{parseEmailMutation.data.extracted.sector}</Badge></div>
                      <div><strong>Stage:</strong> <Badge variant="outline">{parseEmailMutation.data.extracted.stage}</Badge></div>
                      <div><strong>Location:</strong> {parseEmailMutation.data.extracted.location || 'Not specified'}</div>
                      <div><strong>Website:</strong> {parseEmailMutation.data.extracted.website || 'Not provided'}</div>
                      <div><strong>Funding Amount:</strong> {parseEmailMutation.data.extracted.fundingAmount ? `€${parseEmailMutation.data.extracted.fundingAmount.toLocaleString()}` : 'Not specified'}</div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-primary mb-2">Founder Information</h3>
                    <div className="space-y-2 text-sm">
                      <div><strong>Name:</strong> {parseEmailMutation.data.extracted.founderInfo?.name || 'Not provided'}</div>
                      <div><strong>Email:</strong> {parseEmailMutation.data.extracted.founderInfo?.email || 'Not provided'}</div>
                      <div><strong>Background:</strong> {parseEmailMutation.data.extracted.founderInfo?.background || 'Not provided'}</div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold text-primary mb-2">Description</h3>
                  <p className="text-sm text-gray-300 bg-gray-800 p-3 rounded">
                    {parseEmailMutation.data.extracted.description}
                  </p>
                </div>
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No deal information could be extracted from this email content.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Integration Instructions */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle>SendGrid Webhook Setup</CardTitle>
          <CardDescription>
            Instructions to configure SendGrid for incoming emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-semibold mb-2">1. Configure Inbound Parse</h4>
            <p className="text-gray-300 mb-2">
              In your SendGrid dashboard, go to Settings → Inbound Parse and add:
            </p>
            <div className="bg-gray-800 p-3 rounded font-mono text-xs">
              Hostname: ideas.aescuvest.vc<br/>
              URL: https://your-domain.com/api/email/webhook<br/>
              Check "POST the raw, full MIME message"
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">2. DNS Configuration</h4>
            <p className="text-gray-300 mb-2">
              Add these MX records to your domain:
            </p>
            <div className="bg-gray-800 p-3 rounded font-mono text-xs">
              MX Record: ideas.aescuvest.vc → mx.sendgrid.net (Priority: 10)
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Once configured, emails sent to ideas@aescuvest.vc will automatically create deals in the system.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}