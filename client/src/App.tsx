import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AuthProvider } from "./contexts/AuthContext";
import { SidebarProvider } from "./contexts/SidebarContext";
import { useAuth } from "./hooks/useAuth";
import { useEffect } from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { GlobalPersistentUploadMonitor, useGlobalPersistentUploads } from "@/components/GlobalPersistentUploads";

import Navbar from "@/components/layout/navbar";
import Sidebar from "@/components/layout/sidebar";
import AuthenticatedLayout from "@/components/layout/AuthenticatedLayout";
import Dashboard from "@/pages/dashboard";
import DealsPage from "@/pages/deals";
import AllDealsPage from "@/pages/all-deals";
import Pipeline from "@/pages/pipeline";
import DealIntake from "@/pages/deal-intake";
import DueDiligence from "@/pages/due-diligence";
import MemoGenerator from "@/pages/memo-generator";
import MemoTemplates from "@/pages/memo-templates";
import Memos from "@/pages/memos";
import GlobalAIAssistant from "@/pages/global-ai-assistant";
import InvestorMatching from "@/pages/investor-matching";
import WorkflowAutomation from "@/pages/workflow-automation";
import AIInvestorMatching from "@/pages/ai-investor-matching";
import AIWorkflowAutomation from "@/pages/ai-workflow-automation";
import AutomationsPage from "@/pages/automations";
import EmailTestPage from "@/pages/email-test";
import InboxPage from "@/pages/inbox";
import SettingsPage from "@/pages/settings";
import ProfilePage from "@/pages/profile";
import Login from "@/pages/login";
import Register from "@/pages/register";
import NotFound from "@/pages/not-found";

function AppContent() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, isLoading, user } = useAuth();
  
  // 🎯 CRITICAL: Global persistent upload monitoring
  const {
    showMonitor,
    isMinimized,
    activeUploadsCount,
    toggleMinimize,
    closeMonitor
  } = useGlobalPersistentUploads();
  
  // Auth pages - don't show sidebar/navbar
  const isAuthPage = location === '/login' || location === '/register';
  
  // Force redirection based on auth state
  useEffect(() => {
    // Don't redirect during loading
    if (isLoading) return;
    
    // Redirect authenticated users away from auth pages to dashboard
    if (isAuthenticated && user && isAuthPage) {
      console.log("Auth state: Authenticated, redirecting from auth page to dashboard");
      setLocation('/');
    }
    
    // Redirect unauthenticated users to login
    if (!isAuthenticated && !isAuthPage) {
      console.log("Auth state: Not authenticated, redirecting to login");
      setLocation('/login');
    }
  }, [isAuthenticated, isLoading, isAuthPage, location, user, setLocation]);
  
  return (
    <ThemeProvider defaultTheme="dark">
      <TooltipProvider>
        {isAuthPage ? (
          // Login/Register pages - full screen without nav/sidebar
          <div className="h-screen bg-dark text-white">
            <Switch>
              <Route path="/login" component={Login} />
              <Route path="/register" component={Register} />
              <Route component={NotFound} />
            </Switch>
          </div>
        ) : isAuthenticated ? (
          // Protected routes with authenticated layout
          <AuthenticatedLayout>
            <Switch>
              <Route path="/">
                <Dashboard />
              </Route>
              <Route path="/all-deals">
                <AllDealsPage />
              </Route>
              <Route path="/deals">
                <DealsPage />
              </Route>
              <Route path="/deals/:dealId">
                <DealsPage />
              </Route>
              <Route path="/pipeline">
                <Pipeline />
              </Route>
              <Route path="/deal-intake">
                <DealIntake />
              </Route>
              <Route path="/due-diligence">
                <DueDiligence />
              </Route>
              <Route path="/due-diligence/:dealId">
                <DueDiligence />
              </Route>
              <Route path="/memo-generator">
                <MemoGenerator />
              </Route>
              <Route path="/memo-templates">
                <MemoTemplates />
              </Route>
              <Route path="/memos">
                <Memos />
              </Route>
              <Route path="/ai-assistant">
                <GlobalAIAssistant />
              </Route>
              <Route path="/investor-matching">
                <InvestorMatching />
              </Route>
              <Route path="/workflow">
                <WorkflowAutomation />
              </Route>
              <Route path="/ai-investor-matching/:dealId">
                <AIInvestorMatching />
              </Route>
              <Route path="/ai-workflow-automation">
                <AIWorkflowAutomation />
              </Route>
              <Route path="/automations">
                <AutomationsPage />
              </Route>
              <Route path="/email-test">
                <EmailTestPage />
              </Route>
              <Route path="/inbox">
                <InboxPage />
              </Route>
              <Route path="/settings">
                <SettingsPage />
              </Route>
              <Route path="/profile">
                <ProfilePage />
              </Route>
              <Route component={NotFound} />
            </Switch>
          </AuthenticatedLayout>
        ) : (
          // Show loading state when determining auth state
          <div className="flex h-screen w-full items-center justify-center">
            <div className="animate-spin mr-2 h-6 w-6 border-t-2 border-primary border-r-2 rounded-full"></div>
            <span>Loading...</span>
          </div>
        )}
        
        {/* 🎯 CRITICAL: Global Persistent Upload Monitor - Shows across ALL pages */}
        {/* TEMP FIX: Force component to render to test hook */}
        {isAuthenticated && (
          <GlobalPersistentUploadMonitor
            isMinimized={isMinimized}
            onToggleMinimize={toggleMinimize}
            onClose={closeMonitor}
          />
        )}
        
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
