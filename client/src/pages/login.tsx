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
import aescuvestLogo from "@assets/65693c5a89e524678d52208a_Aescuvest Logo 1.png";

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
    <div className="flex h-full w-full items-center justify-center bg-dark p-0">
      <div className="w-full h-full flex">
        {/* Left side - Hero image/content */}
        <div className="hidden lg:flex lg:w-1/2 bg-navy relative overflow-hidden">
          <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-16 z-10">
            <div className="mb-8">
              <img 
                src={aescuvestLogo}
                alt="Aescuvest Logo" 
                className="h-16 w-auto mx-auto mb-6"
              />
            </div>
            <h1 className="text-5xl font-bold text-white leading-tight mb-6">
              AI-Powered<br />Investment<br />Platform
            </h1>
            <p className="text-gray-300 text-lg max-w-md">
              Transforming investment workflows with artificial intelligence
            </p>
          </div>
          <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 text-white/50 text-sm z-10">
            VISION. VENTURE. VALUE.
          </div>
        </div>
        
        {/* Right side - Login form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">Sign In</h2>
              <p className="text-gray-400">Access your investment dashboard</p>
            </div>
            
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                        <FormControl>
                          <Input 
                            placeholder="Username or Email" 
                            className="pl-10 py-6 bg-gray-900/50 border-gray-800 focus:border-primary" 
                            {...field} 
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder="Password" 
                            className="pl-10 py-6 bg-gray-900/50 border-gray-800 focus:border-primary" 
                            {...field} 
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="stayLoggedIn"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="h-4 w-4 text-primary bg-gray-900 border-gray-600 rounded focus:ring-primary focus:ring-2"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <label className="text-sm font-medium text-gray-300">
                          Angemeldet bleiben (90 Tage)
                        </label>
                      </div>
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full py-6 bg-primary hover:bg-primary/90 text-dark font-bold text-lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </Form>
            
            <div className="mt-8 text-center text-sm text-gray-400">
              Don't have an account?{" "}
              <a
                href="/register"
                className="text-primary hover:underline"
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