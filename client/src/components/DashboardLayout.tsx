import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { getItem, setItem } from "@/utils/storage";
import { useProgressiveDisclosureContext } from "@/components/ui/ProgressiveDisclosure";
import {
  BarChart3,
  Bot,
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
  Moon,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { RebookedAIChat } from "./chat/RebookedAIChat";
import { Button } from "./ui/button";
import { trpc } from "@/lib/trpc";

// Dynamic menu items based on user role, permissions, and skill level
const getDynamicMainMenuItems = (userRole?: string, userSkill?: any) => {
  // All features available at every skill level — just the UI adapts
  return [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: Users, label: "Leads", path: "/leads" },
    { icon: MessageSquare, label: "Inbox", path: "/inbox" },
    { icon: Calendar, label: "Automations", path: "/automations" },
    { icon: FileText, label: "Templates", path: "/templates" },
    { icon: Bot, label: "AI Tools", path: "/ai-tools" },
    { icon: BarChart3, label: "Analytics", path: "/analytics" },
  ];
};

// Dynamic high-impact features based on user skill and business type
const getDynamicHighImpactMenuItems = (userSkill?: any, businessType?: string) => {
  // All features available at every skill level
  const baseFeatures = [
    { icon: Zap, label: "Lead Capture", path: "/lead-capture" },
    { icon: LayoutDashboard, label: "Booking Conversion", path: "/booking-conversion" },
    { icon: Shield, label: "No-Show Recovery", path: "/no-show-recovery" },
    { icon: Heart, label: "Retention Engine", path: "/retention" },
    { icon: Bot, label: "AI Automation", path: "/ai-automation" },
    { icon: Settings, label: "Admin Automation", path: "/admin-automation" },
  ];

  // Business-specific features
  if (businessType?.includes('medical') || businessType?.includes('clinic')) {
    baseFeatures.push(
      { icon: FileText, label: "Patient Forms", path: "/patient-forms" }
    );
  }

  return baseFeatures;
};

const getDynamicSettingsMenuItems = (userRole?: string) => {
  const baseSettings = [
    { icon: Settings, label: "Settings", path: "/settings" },
  ];

  // Add billing for non-admin users
  if (userRole !== 'admin') {
    baseSettings.push({ icon: CreditCard, label: "Billing", path: "/billing" });
  }

  return baseSettings;
};

const getDynamicAdminMenuItems = (userRole?: string, userSkill?: any) => {
  // Only show admin items to admin users (role-based, not skill-based)
  if (userRole !== 'admin') return [];

  return [
    { icon: Shield, label: "Tenants", path: "/admin/tenants" },
    { icon: Users, label: "Users", path: "/admin/users" },
    { icon: BarChart3, label: "System Health", path: "/admin/health" },
  ];
};  

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { context } = useProgressiveDisclosureContext();
  const { data: tenant } = trpc.tenant.get.useQuery();
  
  // Get dynamic menu items
  const mainMenuItems = getDynamicMainMenuItems(user?.role, context.userSkill);
  const highImpactMenuItems = getDynamicHighImpactMenuItems(context.userSkill, tenant?.industry);
  const settingsMenuItems = getDynamicSettingsMenuItems(user?.role);
  const adminMenuItems = getDynamicAdminMenuItems(user?.role, context.userSkill);

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = getItem<number>(SIDEBAR_WIDTH_KEY);
      return saved || DEFAULT_WIDTH;
    }
    return DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    setItem(SIDEBAR_WIDTH_KEY, sidebarWidth);
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Zap className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-center font-display">
              Sign in to Rebooked
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              AI-powered SMS re-engagement for your business. Sign in to access your dashboard.
            </p>
          </div>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            size="lg"
            className="w-full"
          >
            Sign in to continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isAdmin = user?.role === "admin";

  // Get tenant info
  const { data: tenant } = trpc.tenant.get.useQuery(undefined, { retry: false });

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      if (!sidebarRef.current) return;
      const sidebarLeft = sidebarRef.current.getBoundingClientRect().left;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const isActive = (path: string) => {
    // Special case for leads sub-paths
    if (path === "/leads" && location.startsWith("/leads")) return true;
    // Special case for feature routes that might have sub-paths
    const featureRoutes = [
      "/lead-capture",
      "/booking-conversion", 
      "/no-show-recovery",
      "/cancellation-recovery",
      "/retention-engine",
      "/smart-scheduling",
      "/payment-enforcement",
      "/after-hours",
      "/admin-automation"
    ];
    if (featureRoutes.includes(path) && location.startsWith(path)) return true;
    // Default exact match
    return location === path;
  };

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-sidebar-border">
          {/* Header */}
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
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm tracking-tight truncate">
                      Rebooked
                    </p>
                    {tenant && (
                      <p className="text-xs text-muted-foreground truncate">{tenant.name}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </SidebarHeader>

          {/* Main Nav */}
          <SidebarContent className="gap-0 py-2">
            <SidebarGroup>
              {!isCollapsed && <SidebarGroupLabel className="text-xs text-muted-foreground/60 px-4 mb-1">Platform</SidebarGroupLabel>}
              <SidebarMenu className="px-2">
                {mainMenuItems.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        isActive={active}
                        onClick={() => setLocation(item.path)}
                        tooltip={item.label}
                        className="h-9 transition-all"
                      >
                        <item.icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup className="mt-2">
              {!isCollapsed && <SidebarGroupLabel className="text-xs text-muted-foreground/60 px-4 mb-1">High-Impact Features</SidebarGroupLabel>}
              <SidebarMenu className="px-2">
                {highImpactMenuItems.map((item) => {
                  const active = location === item.path;
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        isActive={active}
                        onClick={() => setLocation(item.path)}
                        tooltip={item.label}
                        className="h-9 transition-all"
                      >
                        <item.icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup className="mt-2">
              {!isCollapsed && <SidebarGroupLabel className="text-xs text-muted-foreground/60 px-4 mb-1">Account</SidebarGroupLabel>}
              <SidebarMenu className="px-2">
                {settingsMenuItems.map((item) => {
                  const active = location === item.path;
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        isActive={active}
                        onClick={() => setLocation(item.path)}
                        tooltip={item.label}
                        className="h-9 transition-all"
                      >
                        <item.icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>

            {isAdmin && (
              <SidebarGroup className="mt-2">
                {!isCollapsed && (
                  <SidebarGroupLabel className="text-xs text-muted-foreground/60 px-4 mb-1 flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Admin
                  </SidebarGroupLabel>
                )}
                <SidebarMenu className="px-2">
                  {adminMenuItems.map((item) => {
                    const active = location === item.path;
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          isActive={active}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className="h-9 transition-all"
                        >
                          <item.icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroup>
            )}
          </SidebarContent>

          {/* Footer */}
          <SidebarFooter className="p-3 border-t border-sidebar-border">
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
                        <p className="text-sm font-medium truncate leading-none">{user?.name || "User"}</p>
                        {isAdmin && <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">Admin</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-1">{user?.email || ""}</p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setLocation("/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/billing")}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Billing
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        {!isCollapsed && (
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors"
            onMouseDown={() => setIsResizing(true)}
          />
        )}
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b border-border h-14 items-center justify-between bg-background/95 px-4 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
                  <Zap className="w-3 h-3 text-primary-foreground" />
                </div>
                  <span className="font-bold text-sm">Rebooked</span>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 overflow-auto">{children}</main>
      </SidebarInset>
      <RebookedAIChat />
    </>
  );
}
