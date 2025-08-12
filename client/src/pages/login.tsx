import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  email: z.string().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
  stayLoggedIn: z.boolean().default(false),
});

type FormData = z.infer<typeof formSchema>;

export default function Login() {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      stayLoggedIn: false,
    },
  });

  const onSubmit = async (data: FormData) => {
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
  };

  return (
    <div className="login-page-container">
      {/* Left side - Dynamic Interactive Hero */}
      <div className="login-left-panel">
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
              <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
            </svg>
          </div>

          {/* Network Icon */}
          <div className="absolute bottom-20 right-32 text-purple-400/30 animate-pulse" style={{animationDelay: '2s'}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,2A2,2 0 0,1 14,4A2,2 0 0,1 12,6A2,2 0 0,1 10,4A2,2 0 0,1 12,2M21,9V7L15,1L13,3L15,5V7H21M3,7V9H9V7L7,5L9,3L7,1L1,7H3Z"/>
            </svg>
          </div>
        </div>

        {/* Content Container */}
        <div className="relative z-10 flex flex-col justify-center items-center h-full text-center px-12">
          {/* Logo and Tagline */}
          <div className="mb-16">
            <div className="mb-8 animate-fade-in">
              <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mb-4 mx-auto shadow-2xl shadow-primary/25">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                  <path d="M9,11H15L13.5,7.5L9,11M12,2C13.1,2 14,2.9 14,4C14,5.1 13.1,6 12,6C10.9,6 10,5.1 10,4C10,2.9 10.9,2 12,2M21,9V7L15,1L13,3L15,5V7H17V9H21M9,7V5L11,3L9,1L3,7V9H7V7H9M12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5M12,17C14.21,17 16,18.79 16,21H8C8,18.79 9.79,17 12,17Z"/>
                </svg>
              </div>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight animate-fade-in-up" style={{animationDelay: '0.3s'}}>
              <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                AESCUVEST
              </span>
              <br />
              <span className="text-2xl md:text-3xl font-light text-gray-300">
                AI Intelligence
              </span>
            </h1>
            
            <div className="animate-fade-in-up" style={{animationDelay: '0.6s'}}>
              <h2 className="text-xl md:text-2xl font-semibold text-white mb-4 max-w-md mx-auto">
                Venture Capital Revolutionized
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
      </div>

      {/* Right side - Enhanced Login form */}
      <div className="login-right-panel">
        {/* Subtle background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -right-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/3 -left-32 w-48 h-48 bg-blue-400/5 rounded-full blur-2xl"></div>
        </div>
        
        <div className="relative z-10 w-full max-w-md px-8 py-12">
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
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="border-slate-500 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <label className="text-sm font-medium text-gray-300 cursor-pointer">
                        Stay logged in permanently
                      </label>
                      <p className="text-xs text-gray-500">
                        You'll remain signed in until you manually log out
                      </p>
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
  );
}