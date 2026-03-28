import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { ErrorBoundary } from "./components/layout/ErrorBoundary";
import { CookieConsent } from "./components/CookieConsent";
import { LocaleOnboardingModal } from "./components/LanguageSelector";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LocaleProvider } from "./contexts/LocaleContext";
import { lazy, Suspense } from "react";
import { AuthGuard } from "./components/layout/AuthGuard";

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
const Referral = lazy(() => import("./pages/Referral"));
const CalendarIntegration = lazy(() => import("./pages/CalendarIntegration"));
const WaitingList = lazy(() => import("./pages/WaitingList"));
const ReviewManagement = lazy(() => import("./pages/ReviewManagement"));
const Rescheduling = lazy(() => import("./pages/Rescheduling"));

// Legal / Public pages - lazy loaded
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const TCPACompliance = lazy(() => import("./pages/TCPACompliance"));
const Support = lazy(() => import("./pages/Support"));

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Home} />

      {/* Public pages */}
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/tcpa" component={TCPACompliance} />
      <Route path="/support" component={Support} />

      {/* Onboarding */}
      <Route path="/onboarding" component={Onboarding} />

      {/* App - Protected Routes (wrapped in ErrorBoundary per section) */}
      <Route path="/dashboard">
        <ErrorBoundary>
          <AuthGuard>
            <Dashboard />
          </AuthGuard>
        </ErrorBoundary>
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
        <AuthGuard tenantOnly>
          <Automations />
        </AuthGuard>
      </Route>
      <Route path="/templates">
        <AuthGuard tenantOnly>
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
        <AuthGuard tenantOnly>
          <StripeConnect />
        </AuthGuard>
      </Route>

      {/* High-Impact Feature Routes - Tenant Only */}
      <Route path="/lead-capture">
        <AuthGuard tenantOnly>
          <LeadCapture />
        </AuthGuard>
      </Route>
      <Route path="/booking-conversion">
        <AuthGuard tenantOnly>
          <BookingConversion />
        </AuthGuard>
      </Route>
      <Route path="/no-show-recovery">
        <AuthGuard tenantOnly>
          <NoShowRecovery />
        </AuthGuard>
      </Route>
      <Route path="/cancellation-recovery">
        <AuthGuard tenantOnly>
          <CancellationRecovery />
        </AuthGuard>
      </Route>
      <Route path="/retention-engine">
        <AuthGuard tenantOnly>
          <RetentionEngine />
        </AuthGuard>
      </Route>
      <Route path="/smart-scheduling">
        <AuthGuard tenantOnly>
          <SmartScheduling />
        </AuthGuard>
      </Route>
      <Route path="/payment-enforcement">
        <AuthGuard tenantOnly>
          <PaymentEnforcement />
        </AuthGuard>
      </Route>
      <Route path="/after-hours">
        <AuthGuard tenantOnly>
          <AfterHours />
        </AuthGuard>
      </Route>
      <Route path="/admin-automation">
        <AuthGuard tenantOnly>
          <AdminAutomation />
        </AuthGuard>
      </Route>
      <Route path="/referral">
        <AuthGuard tenantOnly>
          <Referral />
        </AuthGuard>
      </Route>
      <Route path="/calendar-integration">
        <AuthGuard tenantOnly>
          <CalendarIntegration />
        </AuthGuard>
      </Route>
      <Route path="/waiting-list">
        <AuthGuard tenantOnly>
          <WaitingList />
        </AuthGuard>
      </Route>
      <Route path="/review-management">
        <AuthGuard tenantOnly>
          <ReviewManagement />
        </AuthGuard>
      </Route>
      <Route path="/rescheduling">
        <AuthGuard tenantOnly>
          <Rescheduling />
        </AuthGuard>
      </Route>

      {/* Admin - Admin Only Routes (isolated error boundary) */}
      <Route path="/admin">
        <ErrorBoundary>
          <AuthGuard adminOnly>
            <AdminTenants />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/admin/tenants">
        <ErrorBoundary>
          <AuthGuard adminOnly>
            <AdminTenants />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/admin/users">
        <ErrorBoundary>
          <AuthGuard adminOnly>
            <AdminUsers />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/admin/health">
        <ErrorBoundary>
          <AuthGuard adminOnly>
            <AdminSystemHealth />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/admin/messages">
        <ErrorBoundary>
          <AuthGuard adminOnly>
            <AdminMessages />
          </AuthGuard>
        </ErrorBoundary>
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
        <LocaleProvider>
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
              <LocaleOnboardingModal />
              <CookieConsent />
            </Suspense>
          </TooltipProvider>
        </LocaleProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
