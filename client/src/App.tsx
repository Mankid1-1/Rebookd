import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { CookieConsent } from "./components/CookieConsent";
import { DataEncryptionConsent } from "./components/DataEncryptionConsent";
import { LiveUpdateBanner } from "./components/LiveUpdateBanner";
import { LocaleOnboardingModal } from "./components/LanguageSelector";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LocaleProvider } from "./contexts/LocaleContext";
import { SkillLevelProvider } from "./contexts/SkillLevelContext";
import { lazy, Suspense, useEffect } from "react";
import { AuthGuard } from "./components/layout/AuthGuard";
import { GlobalAIChat } from "./components/chat/GlobalAIChat";
import { captureAttribution } from "./lib/attribution";

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
const AdminRepairs = lazy(() => import("@/pages/admin/AdminRepairs"));
const AdminSentinelDashboard = lazy(() => import("@/pages/admin/AdminSentinelDashboard"));
const N8nStatus = lazy(() => import("@/pages/admin/N8nStatus"));
const N8nAnalytics = lazy(() => import("@/pages/admin/N8nAnalytics"));

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
const LiveCallTracking = lazy(() => import("@/pages/LiveCallTracking"));
const Setup = lazy(() => import("@/pages/Setup"));

// Industry landing pages
const IndustryLanding = lazy(() => import("@/pages/IndustryLanding"));

// Blog pages - lazy loaded
const Blog = lazy(() => import("@/pages/Blog"));
const BlogPost = lazy(() => import("@/pages/BlogPost"));

// Legal / Public pages - lazy loaded
const Privacy = lazy(() => import("@/pages/Privacy"));
const Terms = lazy(() => import("@/pages/Terms"));
const TCPACompliance = lazy(() => import("@/pages/TCPACompliance"));
const Support = lazy(() => import("@/pages/Support"));
const Login = lazy(() => import("@/pages/Login"));

function AppSkeleton() {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar skeleton */}
      <div className="hidden md:flex w-64 flex-col border-r border-border bg-card p-4 space-y-6">
        <div className="h-8 w-32 rounded bg-muted animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-5 w-5 rounded bg-muted animate-pulse" />
              <div className="h-4 rounded bg-muted animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
            </div>
          ))}
        </div>
      </div>
      {/* Main content skeleton */}
      <div className="flex-1 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 rounded bg-muted animate-pulse" />
          <div className="h-9 w-28 rounded bg-muted animate-pulse" />
        </div>
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              <div className="h-7 w-16 rounded bg-muted animate-pulse" />
              <div className="h-3 w-32 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
        {/* Content area */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="h-5 w-36 rounded bg-muted animate-pulse" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 rounded bg-muted animate-pulse" style={{ width: `${50 + Math.random() * 30}%` }} />
                <div className="h-3 w-24 rounded bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Home} />

      {/* Industry-specific landing pages */}
      <Route path="/for/:industry" component={IndustryLanding} />

      {/* Blog */}
      <Route path="/blog" component={Blog} />
      <Route path="/blog/:slug" component={BlogPost} />

      {/* Public pages */}
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/tcpa" component={TCPACompliance} />
      <Route path="/support" component={Support} />

      {/* Auth */}
      <Route path="/login" component={Login} />
      {/* Redirect /signup to /login preserving query params (for referral links) */}
      <Route path="/signup">
        {() => {
          window.location.replace(`/login${window.location.search}`);
          return null;
        }}
      </Route>

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
      <Route path="/setup">
        <ErrorBoundary>
          <AuthGuard tenantOnly>
            <Setup />
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

      <Route path="/call-tracking">
        <ErrorBoundary>
          <AuthGuard tenantOnly>
            <LiveCallTracking />
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
      <Route path="/admin/repairs">
        <ErrorBoundary>
          <AuthGuard adminOnly>
            <AdminRepairs />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/admin/sentinel">
        <ErrorBoundary>
          <AuthGuard adminOnly>
            <AdminSentinelDashboard />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/admin/n8n">
        <ErrorBoundary>
          <AuthGuard adminOnly>
            <N8nStatus />
          </AuthGuard>
        </ErrorBoundary>
      </Route>
      <Route path="/admin/n8n/analytics">
        <ErrorBoundary>
          <AuthGuard adminOnly>
            <N8nAnalytics />
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
  useEffect(() => { captureAttribution(); }, []);

  return (
    <ErrorBoundary>
      <LiveUpdateBanner />
      <ThemeProvider defaultTheme="corporate">
        <LocaleProvider>
          <TooltipProvider>
            <Toaster richColors position="top-right" />
            <SkillLevelProvider>
              <Suspense fallback={<AppSkeleton />}>
                <Router />
                <GlobalAIChat />
                <LocaleOnboardingModal />
                <CookieConsent />
                <DataEncryptionConsent />
              </Suspense>
            </SkillLevelProvider>
          </TooltipProvider>
        </LocaleProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
