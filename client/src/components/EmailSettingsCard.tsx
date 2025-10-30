import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Mail,
  Key,
  Server,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Shield,
  Loader2,
  Info,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

const emailProviders = {
  gmail: {
    name: "Gmail",
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    instructions: [
      "Go to your Google Account settings",
      "Navigate to Security → 2-Step Verification",
      "Scroll to 'App Passwords' at the bottom",
      "Generate a new app password for 'Mail'",
      "Copy the 16-character password",
    ],
    helpUrl: "https://support.google.com/accounts/answer/185833",
  },
  outlook: {
    name: "Outlook / Office 365",
    host: "outlook.office365.com",
    port: 993,
    secure: true,
    instructions: [
      "Sign in to your Microsoft Account",
      "Go to Security → Advanced Security Options",
      "Select 'App Passwords'",
      "Create a new app password",
      "Copy the generated password",
    ],
    helpUrl: "https://support.microsoft.com/account-billing",
  },
  other: {
    name: "Other / Custom",
    host: "",
    port: 993,
    secure: true,
    instructions: [
      "Contact your email provider for IMAP settings",
      "Common IMAP ports: 143 (non-SSL) or 993 (SSL)",
      "Enable IMAP access in your email settings",
      "Use app-specific passwords if required",
    ],
    helpUrl: "",
  },
};

const formSchema = z.object({
  provider: z.enum(["gmail", "outlook", "other"]),
  host: z.string().min(1, "Host is required"),
  port: z.coerce
    .number()
    .int()
    .min(1, "Port must be greater than 0")
    .max(65535, "Port must be less than 65536"),
  secure: z.boolean(),
  username: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof formSchema>;

interface ConfigStatus {
  configured: boolean;
  config?: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
  };
}

export default function EmailSettingsCard() {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<
    keyof typeof emailProviders
  >("gmail");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      provider: "gmail",
      host: emailProviders.gmail.host,
      port: emailProviders.gmail.port,
      secure: emailProviders.gmail.secure,
      username: "",
      password: "",
    },
  });

  const { data: configStatus, isLoading: isLoadingStatus } =
    useQuery<ConfigStatus>({
      queryKey: ["/api/inbox/config/status"],
      retry: false,
    });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest<{ success: boolean; error?: string }>(
        "/api/inbox/test",
        {
          method: "GET",
        }
      );
      return response;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Connection Successful",
          description: "IMAP connection test passed successfully.",
          variant: "default",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: data.error || "Unable to connect to the IMAP server.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Test Failed",
        description: error.message || "An error occurred while testing the connection.",
        variant: "destructive",
      });
    },
  });

  const saveConfigMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest<{
        success: boolean;
        message: string;
      }>("/api/inbox/config", {
        method: "POST",
        body: JSON.stringify({
          host: data.host,
          port: data.port,
          secure: data.secure,
          username: data.username,
          password: data.password,
        }),
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Configuration Saved",
        description: "IMAP settings have been saved successfully.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/config/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/emails"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save configuration.",
        variant: "destructive",
      });
    },
  });

  const handleProviderChange = (provider: keyof typeof emailProviders) => {
    setSelectedProvider(provider);
    const providerConfig = emailProviders[provider];
    form.setValue("provider", provider);
    form.setValue("host", providerConfig.host);
    form.setValue("port", providerConfig.port);
    form.setValue("secure", providerConfig.secure);
  };

  const handleTestConnection = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast({
        title: "Validation Error",
        description: "Please fix all errors before testing the connection.",
        variant: "destructive",
      });
      return;
    }

    const formData = form.getValues();
    await saveConfigMutation.mutateAsync(formData);
    await testConnectionMutation.mutateAsync();
  };

  const onSubmit = async (data: FormData) => {
    await saveConfigMutation.mutateAsync(data);
  };

  const isLoading =
    testConnectionMutation.isPending || saveConfigMutation.isPending;
  const providerInstructions = emailProviders[selectedProvider].instructions;

  return (
    <Card data-testid="card-email-settings">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Inbox Configuration
            </CardTitle>
            <CardDescription>
              Configure IMAP settings to receive emails directly into the system
            </CardDescription>
          </div>
          {!isLoadingStatus && (
            <div className="flex items-center gap-2">
              {configStatus?.configured ? (
                <div
                  className="flex items-center gap-2 text-green-500"
                  data-testid="status-configured"
                >
                  <Check className="h-5 w-5" />
                  <span className="text-sm font-medium">Configured</span>
                </div>
              ) : (
                <div
                  className="flex items-center gap-2 text-yellow-500"
                  data-testid="status-not-configured"
                >
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">Not Configured</span>
                </div>
              )}
            </div>
          )}
        </div>
        {configStatus?.configured && configStatus.config && (
          <div
            className="mt-4 flex items-center gap-2 text-sm text-gray-400"
            data-testid="text-current-email"
          >
            <Mail className="h-4 w-4" />
            <span>Current: {configStatus.config.username}</span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Provider</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) =>
                      handleProviderChange(
                        value as keyof typeof emailProviders
                      )
                    }
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-provider">
                        <SelectValue placeholder="Select your email provider" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="gmail">Gmail</SelectItem>
                      <SelectItem value="outlook">
                        Outlook / Office 365
                      </SelectItem>
                      <SelectItem value="other">Other / Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-blue-300">
                    {emailProviders[selectedProvider].name} Setup Instructions:
                  </p>
                  <ol className="space-y-1 text-sm text-gray-300">
                    {providerInstructions.map((instruction, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="font-semibold text-blue-400">
                          {index + 1}.
                        </span>
                        <span>{instruction}</span>
                      </li>
                    ))}
                  </ol>
                  {emailProviders[selectedProvider].helpUrl && (
                    <a
                      href={emailProviders[selectedProvider].helpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                      data-testid="link-help"
                    >
                      <Shield className="h-4 w-4" />
                      Learn more about app passwords
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="host"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      IMAP Host
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="imap.example.com"
                        disabled={isLoading}
                        data-testid="input-host"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="port"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Port</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        placeholder="993"
                        disabled={isLoading}
                        data-testid="input-port"
                      />
                    </FormControl>
                    <FormDescription>
                      Common: 993 (SSL) or 143 (non-SSL)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="secure"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-dark-border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      SSL/TLS Encryption
                    </FormLabel>
                    <FormDescription>
                      Enable secure connection (recommended)
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isLoading}
                      data-testid="switch-secure"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Address
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="your.email@example.com"
                      disabled={isLoading}
                      data-testid="input-username"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    App Password
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your app password"
                        disabled={isLoading}
                        className="pr-10"
                        data-testid="input-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                        disabled={isLoading}
                        data-testid="button-toggle-password"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Use an app-specific password, not your regular password
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isLoading}
                className="flex-1"
                data-testid="button-test"
              >
                {testConnectionMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Server className="mr-2 h-4 w-4" />
                    Test Connection
                  </>
                )}
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1"
                data-testid="button-save"
              >
                {saveConfigMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Save Configuration
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
