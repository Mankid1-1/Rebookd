import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { RebookedIcon } from "@/components/RebookedLogo";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BarChart3,
  Bot,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PanelLeft,
  Settings,
  Shield,
  Users,
  Zap,
  FileText,
  XCircle,
  Heart,
  Calendar,
  Gift,
  Inbox,
  TrendingUp,
  Target,
  Clock,
  RefreshCw,
  Star,
  ListOrdered,
  Link2,
  Wrench,
  Compass,
  Rocket,
  Palette,
  Eye,
  Bug,
} from "lucide-react";
import * as React from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLocale } from "@/contexts/LocaleContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useSkillLevel } from "@/contexts/SkillLevelContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme, THEME_META, type ThemeName } from "@/contexts/ThemeContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

// ─── Compact Theme Picker ───────────────────────────────────────────────────

const THEME_COLORS: Record<ThemeName, string> = {
  abyss: "#d4a843",
  light: "#3b7cf5",
  corporate: "#d44030",
  pink: "#d44090",
  emerald: "#2a9060",
};

function CompactThemePicker() {
  const { theme, setTheme } = useTheme();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="h-7 w-7 rounded-md border border-sidebar-border flex items-center justify-center hover:bg-sidebar-accent transition-colors"
          title="Change theme"
        >
          <Palette className="h-3.5 w-3.5 text-sidebar-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-auto p-2">
        <div className="flex gap-1.5">
          {(Object.keys(THEME_META) as ThemeName[]).map((key) => (
            <button
              key={key}
              onClick={() => setTheme(key)}
              className={`h-7 w-7 rounded-full border-2 transition-all ${
                theme === key ? "border-primary scale-110" : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: THEME_COLORS[key] }}
              title={THEME_META[key].label}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Bug Report Button ─────────────────────────────────────────────────────

function BugReportButton() {
  const [open, setOpen] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("bug");
  const [submitting, setSubmitting] = React.useState(false);
  const submitReport = trpc.misc.reportBug.useMutation();

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error("Please describe the issue");
      return;
    }
    setSubmitting(true);
    try {
      await submitReport.mutateAsync({
        description: description.trim(),
        category,
        page: window.location.pathname,
        theme: document.documentElement.getAttribute("data-theme") || "unknown",
      });
      toast.success("Report submitted — our system will analyze and fix the issue automatically.");
      setDescription("");
      setCategory("bug");
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <button
              className="h-7 w-7 rounded-md border border-sidebar-border flex items-center justify-center hover:bg-sidebar-accent transition-colors"
              title="Report a bug or issue"
            >
              <Bug className="h-3.5 w-3.5 text-sidebar-foreground" />
            </button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px] text-xs">
          Report a bug, visual glitch, or issue — our AI will analyze and fix it automatically
        </TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-destructive" />
            Report an Issue
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">Bug / Something broken</SelectItem>
                <SelectItem value="visual">Visual / Theme glitch</SelectItem>
                <SelectItem value="performance">Slow / Performance issue</SelectItem>
                <SelectItem value="feature">Missing feature / Suggestion</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>What happened?</Label>
            <Textarea
              placeholder="Describe what you expected vs what actually happened..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Current page: {typeof window !== "undefined" ? window.location.pathname : "/"}
            </p>
          </div>
          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? "Submitting..." : "Submit Report"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Reports are analyzed by our AI system and fixes are deployed automatically when possible.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Navigation Configuration ────────────────────────────────────────────────

interface NavItem {
  icon: typeof LayoutDashboard;
  labelKey: string;  // Translation key
  fallback: string;  // English fallback
  path: string;
  badge?: string;
}

interface NavGroup {
  icon: typeof LayoutDashboard;
  labelKey: string;
  fallback: string;
  items: NavItem[];
}

// Top-level items (always visible, no dropdown)
const TOP_NAV: NavItem[] = [
  { icon: LayoutDashboard, labelKey: "sidebar.dashboard", fallback: "Dashboard", path: "/dashboard" },
  { icon: Rocket, labelKey: "sidebar.setup", fallback: "Quick Setup", path: "/setup" },
  { icon: Users, labelKey: "sidebar.leads", fallback: "Leads", path: "/leads" },
  { icon: Inbox, labelKey: "sidebar.inbox", fallback: "Inbox", path: "/inbox" },
];

// Collapsible: Services (revenue recovery automations)
const SERVICES_GROUP: NavGroup = {
  icon: Zap,
  labelKey: "sidebar.services",
  fallback: "Services",
  items: [
    { icon: Calendar, labelKey: "sidebar.automations", fallback: "Automations", path: "/automations" },
    { icon: Zap, labelKey: "sidebar.leadCapture", fallback: "Lead Capture", path: "/lead-capture" },
    { icon: Target, labelKey: "sidebar.bookingConversion", fallback: "Booking Conversion", path: "/booking-conversion" },
    { icon: Shield, labelKey: "sidebar.noShowRecovery", fallback: "No-Show Recovery", path: "/no-show-recovery" },
    { icon: XCircle, labelKey: "sidebar.cancellationRecovery", fallback: "Cancellation Recovery", path: "/cancellation-recovery" },
    { icon: Heart, labelKey: "sidebar.retentionEngine", fallback: "Retention Engine", path: "/retention-engine" },
    { icon: Clock, labelKey: "sidebar.smartScheduling", fallback: "Smart Scheduling", path: "/smart-scheduling" },
    { icon: Bot, labelKey: "sidebar.afterHoursAI", fallback: "After Hours AI", path: "/after-hours" },
  ],
};

// Collapsible: Tools
const TOOLS_GROUP: NavGroup = {
  icon: Wrench,
  labelKey: "sidebar.tools",
  fallback: "Tools",
  items: [
    { icon: FileText, labelKey: "sidebar.templates", fallback: "Templates", path: "/templates" },
    { icon: Link2, labelKey: "sidebar.calendarIntegration", fallback: "Calendar Integration", path: "/calendar-integration" },
    { icon: ListOrdered, labelKey: "sidebar.waitingList", fallback: "Waiting List", path: "/waiting-list" },
    { icon: Star, labelKey: "sidebar.reviews", fallback: "Reviews", path: "/review-management" },
    { icon: RefreshCw, labelKey: "sidebar.rescheduling", fallback: "Rescheduling", path: "/rescheduling" },
    { icon: Users, labelKey: "sidebar.contactImport", fallback: "Import Contacts", path: "/contact-import" },
  ],
};

// Bottom items (always visible)
const BOTTOM_NAV: NavItem[] = [
  { icon: BarChart3, labelKey: "sidebar.analytics", fallback: "Analytics", path: "/analytics" },
];

// Collapsible: Billing & Account
const ACCOUNT_GROUP: NavGroup = {
  icon: Settings,
  labelKey: "sidebar.account",
  fallback: "Account",
  items: [
    { icon: Settings, labelKey: "sidebar.settings", fallback: "Settings", path: "/settings" },
    { icon: CreditCard, labelKey: "sidebar.billing", fallback: "Billing", path: "/billing" },
    { icon: Gift, labelKey: "sidebar.referrals", fallback: "Referrals", path: "/referral" },
  ],
};

// Admin top-level items
const ADMIN_NAV: NavItem[] = [
  { icon: Shield, labelKey: "sidebar.tenants", fallback: "Tenants", path: "/admin/tenants" },
  { icon: Users, labelKey: "sidebar.users", fallback: "Users", path: "/admin/users" },
  { icon: TrendingUp, labelKey: "sidebar.systemHealth", fallback: "System Health", path: "/admin/health" },
  { icon: MessageSquare, labelKey: "sidebar.messages", fallback: "Messages", path: "/admin/messages" },
  { icon: Rocket, labelKey: "sidebar.deployments", fallback: "Deployments", path: "/admin/deployments" },
  { icon: Eye, labelKey: "sidebar.sentinel", fallback: "Sentinel", path: "/admin/sentinel" },
];

// Admin collapsible: Platform overview
const ADMIN_PLATFORM_GROUP: NavGroup = {
  icon: LayoutDashboard,
  labelKey: "sidebar.platform",
  fallback: "Platform",
  items: [
    { icon: LayoutDashboard, labelKey: "sidebar.dashboard", fallback: "Dashboard", path: "/dashboard" },
    { icon: Users, labelKey: "sidebar.leads", fallback: "Leads", path: "/leads" },
    { icon: Inbox, labelKey: "sidebar.inbox", fallback: "Inbox", path: "/inbox" },
    { icon: BarChart3, labelKey: "sidebar.analytics", fallback: "Analytics", path: "/analytics" },
  ],
};

// ─── Main Component ─────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { data: tenant } = trpc.tenant.get.useQuery(undefined, { retry: false, enabled: !!user?.tenantId });
  const { t: tFunc } = useLocale();

  if (loading) return <DashboardLayoutSkeleton />;

  // Redirect to onboarding if user has no tenant
  if (user && !user.tenantId) {
    window.location.href = "/onboarding";
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Zap className="w-8 h-8 text-primary" />
            </div>
            <h1
              className="text-2xl font-bold tracking-tight text-center"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {(() => { const v = tFunc("auth.signInTo"); return v !== "auth.signInTo" ? v : "Sign in to Rebooked"; })()}
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {(() => { const v = tFunc("auth.signInDesc"); return v !== "auth.signInDesc" ? v : "AI-powered revenue recovery for appointment-based businesses."; })()}
            </p>
          </div>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            size="lg"
            className="w-full"
          >
            {(() => { const v = tFunc("auth.signInContinue"); return v !== "auth.signInContinue" ? v : "Sign in to continue"; })()}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <DashboardLayoutContent tenant={tenant}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

// ─── Sidebar Content ────────────────────────────────────────────────────────

function DashboardLayoutContent({
  children,
  tenant,
}: {
  children: React.ReactNode;
  tenant: any;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const isMobile = useIsMobile();
  const isAdmin = user?.role === "admin";
  const { skillLevel } = useSkillLevel();

  const isActive = (path: string) => {
    if (path === "/leads" && location.startsWith("/leads")) return true;
    return location === path || location.startsWith(path + "/");
  };

  // Check if any item in a collapsible group is active
  const isGroupActive = (group: NavGroup) => group.items.some((item) => isActive(item.path));

  const { t } = useLocale();

  const getLabel = (item: NavItem | NavGroup | { labelKey: string; fallback: string }) => {
    const translated = t(item.labelKey as any);
    return translated !== item.labelKey ? translated : item.fallback;
  };

  // Render flat nav items (no dropdown)
  const renderFlatItems = (items: NavItem[]) => (
    <SidebarMenu className="px-2 space-y-0.5">
      {items.map((item) => {
        const active = isActive(item.path);
        const label = getLabel(item);
        return (
          <SidebarMenuItem key={item.path}>
            <SidebarMenuButton
              isActive={active}
              onClick={() => setLocation(item.path)}
              tooltip={label}
              className="h-9 transition-all duration-150"
            >
              <item.icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
              <span className={active ? "font-medium" : ""}>{label}</span>
              {item.badge && (
                <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 h-4">
                  {item.badge}
                </Badge>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );

  // Render collapsible dropdown group
  const renderCollapsibleGroup = (group: NavGroup) => {
    const groupActive = isGroupActive(group);
    const label = getLabel(group);
    return (
      <SidebarMenu className="px-2">
        <Collapsible defaultOpen={groupActive} className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                tooltip={label}
                className="h-9 transition-all duration-150"
              >
                <group.icon className={`h-4 w-4 shrink-0 ${groupActive ? "text-primary" : "text-muted-foreground"}`} />
                <span className={groupActive ? "font-medium" : ""}>{label}</span>
                <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {group.items.map((item) => {
                  const active = isActive(item.path);
                  const itemLabel = getLabel(item);
                  return (
                    <SidebarMenuSubItem key={item.path}>
                      <SidebarMenuSubButton
                        isActive={active}
                        onClick={() => setLocation(item.path)}
                        className="cursor-pointer"
                      >
                        <item.icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                        <span>{itemLabel}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  );
                })}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      </SidebarMenu>
    );
  };

  return (
    <>
      {/* Skip navigation link for keyboard/screen reader users (WCAG AA) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md focus:text-sm"
      >
        Skip to main content
      </a>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        {/* Header / Branding */}
        <SidebarHeader className="h-16 justify-center border-b border-sidebar-border">
          <div className="flex items-center gap-3 px-2 w-full">
            <button
              onClick={toggleSidebar}
              className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors shrink-0"
              aria-label="Toggle navigation"
            >
              <PanelLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            {!isCollapsed && (
              <div className="flex items-center gap-2.5 min-w-0">
                <RebookedIcon size={28} />
                <div className="min-w-0">
                  <p
                    className="font-bold text-sm tracking-tight truncate"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    Rebooked
                  </p>
                  {tenant && (
                    <p className="text-[11px] text-muted-foreground truncate leading-tight">
                      {tenant.name}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </SidebarHeader>

        {/* Navigation */}
        <SidebarContent className="gap-1 py-3">
          {isAdmin ? (
            <>
              {/* Admin: flat admin nav */}
              <SidebarGroup>
                {!isCollapsed && (
                  <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/50 px-4 mb-0.5 font-semibold">
                    Administration
                  </SidebarGroupLabel>
                )}
                {renderFlatItems(ADMIN_NAV)}
              </SidebarGroup>

              <div className="mx-4 my-2 shrink-0 border-t border-sidebar-border/50" />

              {/* Admin: collapsible platform overview */}
              <SidebarGroup>
                {renderCollapsibleGroup(ADMIN_PLATFORM_GROUP)}
              </SidebarGroup>

              <div className="mx-4 my-2 shrink-0 border-t border-sidebar-border/50" />

              {/* Admin: collapsible account */}
              <SidebarGroup>
                {renderCollapsibleGroup(ACCOUNT_GROUP)}
              </SidebarGroup>
            </>
          ) : (
            <>
              {/* Regular user: flat top nav (always visible) */}
              <SidebarGroup>
                {renderFlatItems(TOP_NAV)}
              </SidebarGroup>

              <div className="mx-4 my-1 shrink-0 border-t border-sidebar-border/50" />

              {/* Services dropdown — Basic sees top 4 only, Intermediate sees top 4, Advanced sees all */}
              {skillLevel !== "basic" && (
                <SidebarGroup>
                  {renderCollapsibleGroup(
                    skillLevel === "intermediate"
                      ? { ...SERVICES_GROUP, items: SERVICES_GROUP.items.slice(0, 4) }
                      : SERVICES_GROUP
                  )}
                </SidebarGroup>
              )}

              {/* Tools dropdown — Advanced only */}
              {skillLevel === "advanced" && (
                <SidebarGroup>
                  {renderCollapsibleGroup(TOOLS_GROUP)}
                </SidebarGroup>
              )}

              <div className="mx-4 my-1 shrink-0 border-t border-sidebar-border/50" />

              {/* Analytics (flat) — Hidden for basic */}
              {skillLevel !== "basic" && (
                <SidebarGroup>
                  {renderFlatItems(BOTTOM_NAV)}
                </SidebarGroup>
              )}

              {/* Account dropdown (always visible) */}
              <SidebarGroup>
                {renderCollapsibleGroup(ACCOUNT_GROUP)}
              </SidebarGroup>

              {/* Discover More — Basic only */}
              {skillLevel === "basic" && (
                <SidebarGroup className="px-2 pb-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setLocation("/settings")}
                        className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Discover more features"
                      >
                        <Compass className="h-4 w-4 shrink-0" />
                        {!isCollapsed && <span>Discover More</span>}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[200px] text-xs">
                      Upgrade your experience level in Settings to see more features
                    </TooltipContent>
                  </Tooltip>
                </SidebarGroup>
              )}
            </>
          )}
        </SidebarContent>

        {/* User Footer */}
        <SidebarFooter className="p-3 border-t border-sidebar-border relative shrink-0">
          {!isCollapsed && (
            <div className="mb-2 flex items-center justify-end gap-2">
              <BugReportButton />
              <CompactThemePicker />
              <LanguageSelector />
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent transition-colors w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="h-8 w-8 border border-sidebar-border shrink-0">
                  <AvatarFallback className="text-xs font-semibold bg-primary/20 text-primary">
                    {user?.name?.charAt(0).toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate leading-none">
                        {user?.name || "User"}
                      </p>
                      {isAdmin && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                          Admin
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {user?.email || ""}
                    </p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-3 py-2 border-b border-border mb-1">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <DropdownMenuItem onClick={() => setLocation("/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                {getLabel({ labelKey: "sidebar.settings", fallback: "Settings" })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation("/billing")}>
                <CreditCard className="mr-2 h-4 w-4" />
                {getLabel({ labelKey: "sidebar.billing", fallback: "Billing" })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation("/referral")}>
                <Gift className="mr-2 h-4 w-4" />
                {getLabel({ labelKey: "sidebar.referrals", fallback: "Referrals" })}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                {(() => { const v = t("common.signOut"); return v !== "common.signOut" ? v : "Sign out"; })()}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b border-border h-14 items-center justify-between bg-background/95 px-4 backdrop-blur-xl sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <div className="flex items-center gap-2">
                <RebookedIcon size={24} />
                <span
                  className="font-bold text-sm"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  Rebooked
                </span>
              </div>
            </div>
          </div>
        )}
        <main id="main-content" className="flex-1 overflow-auto" role="main">{children}</main>
      </SidebarInset>
    </>
  );
}
