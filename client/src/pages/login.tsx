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
// Aescuvest logo now available at /aescuvest-logo.png

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
        {/* Left side - Dynamic Interactive Hero */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
          {/* Animated Background Elements */}
          <div className="absolute inset-0">
            {/* Primary gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-blue-500/10"></div>
            
            {/* Moving geometric shapes */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
              {/* Floating circles with animation */}
              <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
              <div className="absolute top-3/4 right-1/4 w-24 h-24 bg-blue-400/20 rounded-full blur-lg animate-bounce" style={{animationDuration: '3s'}}></div>
              <div className="absolute top-1/2 left-1/3 w-16 h-16 bg-green-400/30 rounded-full blur-md animate-ping" style={{animationDuration: '4s'}}></div>
              
              {/* Moving lines/paths */}
              <div className="absolute top-1/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent animate-pulse"></div>
              <div className="absolute top-2/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-400/20 to-transparent animate-pulse" style={{animationDelay: '1s'}}></div>
            </div>
          </div>

          {/* Floating Icons */}
          <div className="absolute inset-0 pointer-events-none">
            {/* AI Brain Icon */}
            <div className="absolute top-20 right-20 text-primary/40 animate-float">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="animate-pulse">
                <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1L13 3L15 5V7H17V9H21ZM9 7V5L11 3L9 1L3 7V9H7V7H9ZM12 8C14.21 8 16 9.79 16 12S14.21 16 12 16S8 14.21 8 12S9.79 8 12 8ZM12 18C13.1 18 14 18.9 14 20C14 21.1 13.1 22 12 22C10.9 22 10 21.1 10 20C10 18.9 10.9 18 12 18Z"/>
              </svg>
            </div>
            
            {/* Chart Icon */}
            <div className="absolute bottom-32 left-16 text-blue-400/30 animate-bounce" style={{animationDuration: '2.5s'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16,11V3H8V7H16V11M16,21H8V13H16V21Z"/>
              </svg>
            </div>

            {/* Dollar Sign */}
            <div className="absolute top-1/2 right-12 text-green-400/40 animate-spin" style={{animationDuration: '8s'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7,15H9C9,16.08 10.37,17 12,17C13.63,17 15,16.08 15,15C15,13.9 13.96,13.5 11.76,12.97C9.64,12.44 7,11.78 7,9C7,7.21 8.47,5.69 10.5,5.18V3H13.5V5.18C15.53,5.69 17,7.21 17,9H15C15,7.92 13.63,7 12,7C10.37,7 9,7.92 9,9C9,10.1 10.04,10.5 12.24,11.03C14.36,11.56 17,12.22 17,15C17,16.79 15.53,18.31 13.5,18.82V21H10.5V18.82C8.47,18.31 7,16.79 7,15Z"/>
              </svg>
            </div>
          </div>

          {/* Main Content Container */}
          <div className="relative z-20 flex flex-col justify-center items-center text-center w-full h-full p-16">
            
            {/* Logo Section */}
            <div className="mb-12">
              {/* Aescuvest Logo */}
              <div className="relative mb-6 group">
                <div className="w-20 h-20 mx-auto bg-white rounded-2xl flex items-center justify-center transform transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-2xl p-2">
                  <img 
                    src="/aescuvest-logo.png" 
                    alt="Aescuvest Logo" 
                    className="w-16 h-16 object-contain"
                  />
                </div>
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-blue-400 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-300"></div>
              </div>
              
              {/* Brand Name with animation */}
              <h1 className="text-4xl font-bold text-white tracking-widest mb-2 animate-fade-in-up">
                AESCUVEST
              </h1>
              <div className="h-1 w-24 bg-gradient-to-r from-primary to-green-400 mx-auto rounded-full animate-pulse"></div>
            </div>

            {/* Dynamic Stats */}
            <div className="grid grid-cols-3 gap-8 mb-12 w-full max-w-md">
              <div className="text-center group cursor-default">
                <div className="text-2xl font-bold text-primary mb-1 transition-all duration-300 group-hover:scale-110 animate-count-up">
                  250+
                </div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">Deals</div>
              </div>
              <div className="text-center group cursor-default">
                <div className="text-2xl font-bold text-blue-400 mb-1 transition-all duration-300 group-hover:scale-110 animate-count-up" style={{animationDelay: '0.5s'}}>
                  50M+
                </div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">Analyzed</div>
              </div>
              <div className="text-center group cursor-default">
                <div className="text-2xl font-bold text-green-400 mb-1 transition-all duration-300 group-hover:scale-110 animate-count-up" style={{animationDelay: '1s'}}>
                  99%
                </div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">Accuracy</div>
              </div>
            </div>

            {/* Main Description */}
            <div className="space-y-4 mb-12">
              <h2 className="text-xl font-semibold text-primary animate-fade-in-up" style={{animationDelay: '0.3s'}}>
                AI-Powered Investment Platform
              </h2>
              <p className="text-gray-300 text-base leading-relaxed max-w-sm animate-fade-in-up" style={{animationDelay: '0.6s'}}>
                Transforming investment workflows with artificial intelligence and advanced analytics
              </p>
            </div>

            {/* Features List */}
            <div className="space-y-3 mb-12">
              <div className="flex items-center justify-center space-x-3 text-sm text-gray-400 animate-fade-in-up" style={{animationDelay: '0.9s'}}>
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span>Document Analysis</span>
              </div>
              <div className="flex items-center justify-center space-x-3 text-sm text-gray-400 animate-fade-in-up" style={{animationDelay: '1.2s'}}>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                <span>Risk Assessment</span>
              </div>
              <div className="flex items-center justify-center space-x-3 text-sm text-gray-400 animate-fade-in-up" style={{animationDelay: '1.5s'}}>
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>Portfolio Optimization</span>
              </div>
            </div>

            {/* Bottom Tagline */}
            <div className="animate-fade-in-up" style={{animationDelay: '1.8s'}}>
              <p className="text-gray-300 text-lg font-bold tracking-[0.3em] uppercase">
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