import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { lazy, Suspense } from "react";
import { AuthGuard } from "./components/AuthGuard";

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

// New required pages
const CalendarIntegration = lazy(() => import("@/pages/CalendarIntegration"));
const WaitingList = lazy(() => import("@/pages/WaitingList"));
const ReviewManagement = lazy(() => import("@/pages/ReviewManagement"));
const Referrals = lazy(() => import("@/pages/Referrals"));

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Home} />

      {/* Onboarding */}
      <Route path="/onboarding" component={Onboarding} />

      {/* App - Protected Routes */}
      <Route path="/dashboard">
        <AuthGuard>
          <Dashboard />
        </AuthGuard>
      </Route>
      <Route path="/leads">
        <AuthGuard>
          <Leads />
        </AuthGuard>
      </Route>
      <Route path="/leads/:id">
        <AuthGuard>
          <LeadDetail />
        </AuthGuard>
      </Route>
      <Route path="/inbox">
        <AuthGuard>
          <Inbox />
        </AuthGuard>
      </Route>
      <Route path="/automations">
        <AuthGuard>
          <Automations />
        </AuthGuard>
      </Route>
      <Route path="/templates">
        <AuthGuard>
          <Templates />
        </AuthGuard>
      </Route>
      <Route path="/analytics">
        <AuthGuard>
          <Analytics />
        </AuthGuard>
      </Route>
      <Route path="/settings">
        <AuthGuard>
          <Settings />
        </AuthGuard>
      </Route>
      <Route path="/billing">
        <AuthGuard>
          <Billing />
        </AuthGuard>
      </Route>
      <Route path="/stripe-connect">
        <AuthGuard>
          <StripeConnect />
        </AuthGuard>
      </Route>

      {/* High-Impact Feature Routes - Protected */}
      <Route path="/lead-capture">
        <AuthGuard>
          <LeadCapture />
        </AuthGuard>
      </Route>
      <Route path="/booking-conversion">
        <AuthGuard>
          <BookingConversion />
        </AuthGuard>
      </Route>
      <Route path="/no-show-recovery">
        <AuthGuard>
          <NoShowRecovery />
        </AuthGuard>
      </Route>
      <Route path="/cancellation-recovery">
        <AuthGuard>
          <CancellationRecovery />
        </AuthGuard>
      </Route>
      <Route path="/retention-engine">
        <AuthGuard>
          <RetentionEngine />
        </AuthGuard>
      </Route>
      <Route path="/smart-scheduling">
        <AuthGuard>
          <SmartScheduling />
        </AuthGuard>
      </Route>
      <Route path="/payment-enforcement">
        <AuthGuard>
          <PaymentEnforcement />
        </AuthGuard>
      </Route>
      <Route path="/after-hours">
        <AuthGuard>
          <AfterHours />
        </AuthGuard>
      </Route>
      <Route path="/admin-automation">
        <AuthGuard>
          <AdminAutomation />
        </AuthGuard>
      </Route>
      <Route path="/calendar-integration">
        <AuthGuard>
          <CalendarIntegration />
        </AuthGuard>
      </Route>
      <Route path="/waiting-list">
        <AuthGuard>
          <WaitingList />
        </AuthGuard>
      </Route>
      <Route path="/review-management">
        <AuthGuard>
          <ReviewManagement />
        </AuthGuard>
      </Route>
      <Route path="/referrals">
        <AuthGuard>
          <Referrals />
        </AuthGuard>
      </Route>

      {/* Admin - Admin Only Routes */}
      <Route path="/admin/tenants">
        <AuthGuard adminOnly>
          <AdminTenants />
        </AuthGuard>
      </Route>
      <Route path="/admin/users">
        <AuthGuard adminOnly>
          <AdminUsers />
        </AuthGuard>
      </Route>
      <Route path="/admin/health">
        <AuthGuard adminOnly>
          <AdminSystemHealth />
        </AuthGuard>
      </Route>
      <Route path="/admin/messages">
        <AuthGuard adminOnly>
          <AdminMessages />
        </AuthGuard>
      </Route>

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
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-background">
              <div className="flex flex-col items-center space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <div className="text-muted-foreground">Loading Rebooked...</div>
              </div>
            </div>
          }>
            <Router />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
