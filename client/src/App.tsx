import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import Automations from "./pages/Automations";
import Templates from "./pages/Templates";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Billing from "./pages/Billing";
import Onboarding from "./pages/Onboarding";
import Inbox from "./pages/Inbox";
import AdminTenants from "./pages/admin/AdminTenants";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSystemHealth from "./pages/admin/AdminSystemHealth";
import AdminMessages from "./pages/admin/AdminMessages";

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Home} />

      {/* Onboarding */}
      <Route path="/onboarding" component={Onboarding} />

      {/* App */}
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/leads" component={Leads} />
      <Route path="/leads/:id" component={LeadDetail} />
      <Route path="/inbox" component={Inbox} />
      <Route path="/automations" component={Automations} />
      <Route path="/templates" component={Templates} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/settings" component={Settings} />
      <Route path="/billing" component={Billing} />

      {/* Admin */}
      <Route path="/admin/tenants" component={AdminTenants} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/health" component={AdminSystemHealth} />
      <Route path="/admin/messages" component={AdminMessages} />

      {/* Fallback */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
