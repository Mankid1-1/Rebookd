import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/EnhancedErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { lazy, Suspense } from "react";

// Lazy load heavy components for code splitting
const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Leads = lazy(() => import("./pages/Leads"));
const LeadDetail = lazy(() => import("./pages/LeadDetail"));
const Automations = lazy(() => import("./pages/Automations"));
const Templates = lazy(() => import("./pages/Templates"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Settings = lazy(() => import("./pages/Settings"));
const Billing = lazy(() => import("./pages/Billing"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Inbox = lazy(() => import("./pages/Inbox"));

// Admin pages - lazy loaded
const AdminTenants = lazy(() => import("./pages/admin/AdminTenants"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminSystemHealth = lazy(() => import("./pages/admin/AdminSystemHealth"));
const AdminMessages = lazy(() => import("./pages/admin/AdminMessages"));

// High-impact feature pages - lazy loaded
const LeadCapture = lazy(() => import("@/pages/LeadCapture"));
const BookingConversion = lazy(() => import("@/pages/BookingConversion"));
const StripeConnect = lazy(() => import("./pages/StripeConnect"));
const NoShowRecovery = lazy(() => import("@/pages/NoShowRecovery"));
const CancellationRecovery = lazy(() => import("@/pages/CancellationRecovery"));
const RetentionEngine = lazy(() => import("@/pages/RetentionEngine"));
const SmartScheduling = lazy(() => import("@/pages/SmartScheduling"));
const PaymentEnforcement = lazy(() => import("@/pages/PaymentEnforcement"));
const AfterHours = lazy(() => import("@/pages/AfterHours"));
const AdminAutomation = lazy(() => import("@/pages/AdminAutomation"));

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
      <Route path="/stripe-connect" component={StripeConnect} />

      {/* Admin */}
      <Route path="/admin/tenants" component={AdminTenants} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/health" component={AdminSystemHealth} />
      <Route path="/admin/messages" component={AdminMessages} />

      {/* High-Impact Feature Routes */}
      <Route path="/lead-capture" component={LeadCapture} />
      <Route path="/booking-conversion" component={BookingConversion} />
      <Route path="/no-show-recovery" component={NoShowRecovery} />
      <Route path="/cancellation-recovery" component={CancellationRecovery} />
      <Route path="/retention-engine" component={RetentionEngine} />
      <Route path="/smart-scheduling" component={SmartScheduling} />
      <Route path="/payment-enforcement" component={PaymentEnforcement} />
      <Route path="/after-hours" component={AfterHours} />
      <Route path="/admin-automation" component={AdminAutomation} />

      {/* Fallback */}
      <Route path="/404" component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
            <Router />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
