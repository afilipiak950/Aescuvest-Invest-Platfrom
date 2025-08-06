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
    <div className="flex h-screen w-full bg-dark overflow-hidden">
      <div className="w-full h-full flex">
        {/* Left side - Enhanced Hero content */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 relative overflow-hidden">
          {/* Subtle background pattern */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent"></div>
            <div className="absolute top-0 left-0 w-full h-full opacity-5">
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-400/10 rounded-full blur-2xl"></div>
            </div>
          </div>
          
          <div className="relative z-10 flex flex-col justify-between p-16 w-full h-full">
            {/* Top section with branding */}
            <div className="space-y-6">
              <div className="space-y-3">
                <h1 className="text-3xl font-bold text-white tracking-wider leading-tight">AESCUVEST</h1>
                <div className="space-y-2">
                  <p className="text-primary text-base font-medium">AI-Powered Investment Platform</p>
                  <p className="text-gray-300 text-base leading-relaxed max-w-md">
                    Transforming investment workflows with artificial intelligence
                  </p>
                </div>
              </div>
            </div>
            
            {/* Bottom tagline */}
            <div className="pb-8">
              <p className="text-gray-300 text-xl font-bold tracking-widest">
                VISION. VENTURE. VALUE.
              </p>
            </div>
          </div>
        </div>
        
        {/* Right side - Enhanced Login form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center bg-slate-900 relative">
          {/* Subtle background elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 -right-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl"></div>
            <div className="absolute bottom-1/3 -left-32 w-48 h-48 bg-blue-400/5 rounded-full blur-2xl"></div>
          </div>
          
          <div className="relative z-10 w-full max-w-md p-8">
            <div className="mb-10">
              <h2 className="text-3xl font-bold text-white mb-4">Sign In</h2>
              <p className="text-gray-400 text-base">Access your investment dashboard</p>
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
                      <FormControl>
                        <Input 
                          placeholder="Username or Email" 
                          className="w-full py-4 px-4 bg-slate-800/80 border border-slate-600 rounded-lg text-white placeholder-gray-400 text-base focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-200 backdrop-blur-sm" 
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
                          className="w-full py-4 px-4 bg-slate-800/80 border border-slate-600 rounded-lg text-white placeholder-gray-400 text-base focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-200 backdrop-blur-sm" 
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
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 py-3">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="h-5 w-5 text-primary bg-slate-800 border-slate-600 rounded focus:ring-primary focus:ring-2 focus:ring-offset-0 cursor-pointer"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <label className="text-base text-gray-300 cursor-pointer">
                          Angemeldet bleiben (90 Tage)
                        </label>
                      </div>
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full py-4 bg-primary hover:bg-primary/90 hover:scale-[1.02] text-black font-semibold text-base rounded-lg transition-all duration-200 shadow-lg hover:shadow-primary/25"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </Form>
            
            <div className="mt-8 text-center text-base text-gray-400">
              Don't have an account?{" "}
              <a
                href="/register"
                className="text-primary hover:text-primary/80 hover:underline font-medium transition-colors duration-200"
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