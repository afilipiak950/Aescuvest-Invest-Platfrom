import { useState } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Loader2, Lock, Mail } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
// Logo removed during deployment optimization - using text-based branding

const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Username or email is required" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" }),
  stayLoggedIn: z.boolean().default(true),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      stayLoggedIn: true,
    },
  });

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await login(data.email, data.password, data.stayLoggedIn);
      
      if (result.success) {
        toast({
          title: "Login Successful",
          description: data.stayLoggedIn ? "You will stay logged in permanently." : "You have been logged in successfully.",
        });
        // App.tsx will handle the redirect automatically based on auth state
      } else {
        setError(result.error || "Failed to login. Please try again.");
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-full bg-dark">
      <div className="w-full h-full flex">
        {/* Left side - Hero content */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
          {/* Background pattern overlay */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent"></div>
          </div>
          
          <div className="relative z-10 flex flex-col justify-start p-12 w-full">
            {/* Header with logo */}
            <div className="mb-12">
              <h1 className="text-2xl font-bold text-white tracking-wider">AESCUVEST</h1>
              <p className="text-primary text-sm font-medium mt-1">AI-Powered Investment Platform</p>
              <p className="text-gray-400 text-sm mt-2 max-w-sm">
                Transforming investment workflows with artificial intelligence
              </p>
            </div>
            
            {/* Tagline */}
            <div className="mt-8">
              <p className="text-gray-300 text-lg font-semibold tracking-wide">
                VISION. VENTURE. VALUE.
              </p>
            </div>
          </div>
        </div>
        
        {/* Right side - Login form */}
        <div className="w-full lg:w-1/2 flex items-start justify-start p-12 bg-dark">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-3">Sign In</h2>
              <p className="text-gray-400 text-sm">Access your investment dashboard</p>
            </div>
            
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input 
                          placeholder="Username or Email" 
                          className="w-full py-3 px-3 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 text-sm focus:border-primary focus:outline-none" 
                          {...field} 
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
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Password" 
                          className="w-full py-3 px-3 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 text-sm focus:border-primary focus:outline-none" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="stayLoggedIn"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0 py-2">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="h-4 w-4 text-primary bg-gray-800 border-gray-600 rounded focus:ring-primary focus:ring-1"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <label className="text-sm text-gray-300 cursor-pointer">
                          Angemeldet bleiben (90 Tage)
                        </label>
                      </div>
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full py-3 bg-primary hover:bg-primary/90 text-dark font-medium text-sm rounded"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </Form>
            
            <div className="mt-6 text-left text-sm text-gray-400">
              Don't have an account?{" "}
              <a
                href="/register"
                className="text-primary hover:underline font-medium"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = '/register';
                }}
              >
                Sign Up
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}