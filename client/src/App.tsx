import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

import Navbar from "@/components/layout/navbar";
import Sidebar from "@/components/layout/sidebar";
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider defaultTheme="dark">
          <TooltipProvider>
            <div className="flex h-screen overflow-hidden bg-dark text-white">
              <Sidebar />
              <div className="flex flex-col flex-1 overflow-hidden">
                <Navbar />
                <main className="flex-1 overflow-y-auto">
                  <Switch>
                    <Route path="/login" component={Login} />
                    <Route path="/register" component={Register} />
                    <Route path="/">
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    </Route>
                    <Route path="/deal-intake">
                      <ProtectedRoute>
                        <DealIntake />
                      </ProtectedRoute>
                    </Route>
                    <Route path="/due-diligence">
                      <ProtectedRoute>
                        <DueDiligence />
                      </ProtectedRoute>
                    </Route>
                    <Route path="/memo-generator">
                      <ProtectedRoute>
                        <MemoGenerator />
                      </ProtectedRoute>
                    </Route>
                    <Route path="/investor-matching">
                      <ProtectedRoute>
                        <InvestorMatching />
                      </ProtectedRoute>
                    </Route>
                    <Route path="/workflow">
                      <ProtectedRoute>
                        <WorkflowAutomation />
                      </ProtectedRoute>
                    </Route>
                    <Route path="/ai-investor-matching/:dealId">
                      <ProtectedRoute>
                        <AIInvestorMatching />
                      </ProtectedRoute>
                    </Route>
                    <Route path="/ai-workflow-automation">
                      <ProtectedRoute>
                        <AIWorkflowAutomation />
                      </ProtectedRoute>
                    </Route>
                    <Route component={NotFound} />
                  </Switch>
                </main>
              </div>
            </div>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
