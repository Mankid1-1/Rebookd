import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { ErrorBoundary } from "./components/layout/ErrorBoundary";
import { CookieConsent } from "./components/CookieConsent";
import { LiveUpdateBanner } from "./components/LiveUpdateBanner";
import { LocaleOnboardingModal } from "./components/LanguageSelector";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LocaleProvider } from "./contexts/LocaleContext";
import { SkillLevelProvider } from "./contexts/SkillLevelContext";
import { lazy, Suspense } from "react";
import { AuthGuard } from "./components/layout/AuthGuard";
import { GlobalAIChat } from "./components/chat/GlobalAIChat";

// Lazy load heavy components for code splitting
const Home = lazy(() => import("@/pages/Home"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Leads = lazy(() => import("@/pages/Leads"));
const LeadDetail = lazy(() => import("@/pages/LeadDetail"));
const Automations = lazy(() => import("@/pages/Automations"));
const Templates = lazy(() => import("@/pages/Templates"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const Settings = lazy(() => import("@/pages/Settings"));
const Billing = lazy(() => import("@/pages/Billing"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Inbox = lazy(() => import("@/pages/Inbox"));

// Admin pages - lazy loaded
const AdminTenants = lazy(() => import("@/pages/admin/AdminTenants"));
const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminSystemHealth = lazy(() => import("@/pages/admin/AdminSystemHealth"));
const AdminMessages = lazy(() => import("@/pages/admin/AdminMessages"));
const AdminDeployments = lazy(() => import("@/pages/admin/AdminDeployments"));

// High-impact feature pages - lazy loaded
const LeadCapture = lazy(() => import("@/pages/LeadCapture"));
const BookingConversion = lazy(() => import("@/pages/BookingConversion"));
const StripeConnect = lazy(() => import("@/pages/StripeConnect"));
const NoShowRecovery = lazy(() => import("@/pages/NoShowRecovery"));
const CancellationRecovery = lazy(() => import("@/pages/CancellationRecovery"));
const RetentionEngine = lazy(() => import("@/pages/RetentionEngine"));
const SmartScheduling = lazy(() => import("@/pages/SmartScheduling"));
const PaymentEnforcement = lazy(() => import("@/pages/PaymentEnforcement"));
const AfterHours = lazy(() => import("@/pages/AfterHours"));
const AdminAutomation = lazy(() => import("@/pages/AdminAutomation"));
const Referral = lazy(() => import("@/pages/Referral"));
const CalendarIntegration = lazy(() => import("@/pages/CalendarIntegration"));
const WaitingList = lazy(() => import("@/pages/WaitingList"));
const ReviewManagement = lazy(() => import("@/pages/ReviewManagement"));
const Rescheduling = lazy(() => import("@/pages/Rescheduling"));
const AiTools = lazy(() => import("@/pages/AiTools"));
const ContactImport = lazy(() => import("@/pages/ContactImport"));

// Legal / Public pages - lazy loaded
const Privacy = lazy(() => import("@/pages/Privacy"));
const Terms = lazy(() => import("@/pages/Terms"));
const TCPACompliance = lazy(() => import("@/pages/TCPACompliance"));
const Support = lazy(() => import("@/pages/Support"));
const Login = lazy(() => import("@/pages/Login"));

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

      {/* Auth */}
      <Route path="/login" component={Login} />

      {/* Onboarding */}
      <Route path="/onboarding" component={Onboarding} />

      {/* App - Protected Routes (all wrapped in ErrorBoundary) */}
      <Route path="/dashboard">
        <ErrorBoundary>
          <AuthGuard>
            <Dashboard />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/leads">
        <ErrorBoundary>
          <AuthGuard>
            <Leads />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/leads/:id">
        <ErrorBoundary>
          <AuthGuard>
            <LeadDetail />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/inbox">
        <ErrorBoundary>
          <AuthGuard>
            <Inbox />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/automations">
        <ErrorBoundary>
          <AuthGuard tenantOnly>
            <Automations />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/templates">
        <ErrorBoundary>
          <AuthGuard tenantOnly>
            <Templates />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/analytics">
        <ErrorBoundary>
          <AuthGuard>
            <Analytics />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/settings">
        <ErrorBoundary>
          <AuthGuard>
            <Settings />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/billing">
        <ErrorBoundary>
          <AuthGuard>
            <Billing />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/stripe-connect">
        <ErrorBoundary>
          <AuthGuard tenantOnly>
            <StripeConnect />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/ai-tools">
        <ErrorBoundary>
          <AuthGuard tenantOnly>
            <AiTools />
          </AuthGuard>
        </ErrorBoundary>
      </Route>

      {/* High-Impact Feature Routes - Tenant Only */}
      <Route path="/lead-capture">
        <ErrorBoundary>
          <AuthGuard tenantOnly>
            <LeadCapture />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/booking-conversion">
        <ErrorBoundary>
          <AuthGuard tenantOnly>
            <BookingConversion />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/no-show-recovery">
        <ErrorBoundary>
          <AuthGuard tenantOnly>
            <NoShowRecovery />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/cancellation-recovery">
        <ErrorBoundary>
          <AuthGuard tenantOnly>
            <CancellationRecovery />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/retention-engine">
        <ErrorBoundary>
          <AuthGuard tenantOnly>
            <RetentionEngine />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/smart-scheduling">
        <ErrorBoundary>
          <AuthGuard tenantOnly>
            <SmartScheduling />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/payment-enforcement">
        <ErrorBoundary>
          <AuthGuard tenantOnly>
            <PaymentEnforcement />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/after-hours">
        <ErrorBoundary>
          <AuthGuard tenantOnly>
            <AfterHours />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/admin-automation">
        <ErrorBoundary>
          <AuthGuard tenantOnly>
            <AdminAutomation />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/referral">
        <ErrorBoundary>
          <AuthGuard tenantOnly>
            <Referral />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/calendar-integration">
        <ErrorBoundary>
          <AuthGuard tenantOnly>
            <CalendarIntegration />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/waiting-list">
        <ErrorBoundary>
          <AuthGuard tenantOnly>
            <WaitingList />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/review-management">
        <ErrorBoundary>
          <AuthGuard tenantOnly>
            <ReviewManagement />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/rescheduling">
        <ErrorBoundary>
          <AuthGuard tenantOnly>
            <Rescheduling />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/contact-import">
        <ErrorBoundary>
          <AuthGuard tenantOnly>
            <ContactImport />
          </AuthGuard>
        </ErrorBoundary>
      </Route>

      {/* Admin - Admin Only Routes */}
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
      <Route path="/admin/deployments">
        <ErrorBoundary>
          <AuthGuard adminOnly>
            <AdminDeployments />
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
      <LiveUpdateBanner />
      <ThemeProvider defaultTheme="dark">
        <LocaleProvider>
          <TooltipProvider>
            <Toaster richColors position="top-right" />
            <SkillLevelProvider>
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-screen bg-background">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <div className="text-muted-foreground">Loading Rebooked...</div>
                  </div>
                </div>
              }>
                <Router />
                <GlobalAIChat />
                <LocaleOnboardingModal />
                <CookieConsent />
              </Suspense>
            </SkillLevelProvider>
          </TooltipProvider>
        </LocaleProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
