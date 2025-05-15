import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./hooks/useAuth";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

import Navbar from "@/components/layout/navbar";
import Sidebar from "@/components/layout/sidebar";
import AuthenticatedLayout from "@/components/layout/AuthenticatedLayout";
import Dashboard from "@/pages/dashboard";
import DealIntake from "@/pages/deal-intake";
import DueDiligence from "@/pages/due-diligence";
import MemoGenerator from "@/pages/memo-generator";
import InvestorMatching from "@/pages/investor-matching";
import WorkflowAutomation from "@/pages/workflow-automation";
import AIInvestorMatching from "@/pages/ai-investor-matching";
import AIWorkflowAutomation from "@/pages/ai-workflow-automation";
import Login from "@/pages/login";
import Register from "@/pages/register";
import NotFound from "@/pages/not-found";

function AppContent() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();
  
  // Auth pages - don't show sidebar/navbar
  const isAuthPage = location === '/login' || location === '/register';
  
  // Only show AuthenticatedLayout if user is authenticated and not on auth pages
  const showAuthenticatedLayout = isAuthenticated && !isAuthPage;
  
  return (
    <ThemeProvider defaultTheme="dark">
      <TooltipProvider>
        {isAuthPage ? (
          // Login/Register pages - full screen without nav/sidebar
          <div className="h-screen bg-dark text-white">
            <Switch>
              <Route path="/login" component={Login} />
              <Route path="/register" component={Register} />
            </Switch>
          </div>
        ) : (
          // Protected routes with authenticated layout
          showAuthenticatedLayout ? (
            <AuthenticatedLayout>
              <Switch>
                <Route path="/">
                  <Dashboard />
                </Route>
                <Route path="/deal-intake">
                  <DealIntake />
                </Route>
                <Route path="/due-diligence">
                  <DueDiligence />
                </Route>
                <Route path="/memo-generator">
                  <MemoGenerator />
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
                <Route component={NotFound} />
              </Switch>
            </AuthenticatedLayout>
          ) : (
            // Redirect to login if not authenticated
            <Switch>
              <Route>
                <ProtectedRoute>
                  <div>Loading...</div>
                </ProtectedRoute>
              </Route>
            </Switch>
          )
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
