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
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { getItem, setItem } from "@/utils/storage";
import {
  BarChart3,
  CreditCard,
  Gift,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PanelLeft,
  Settings,
  Shield,
  TrendingUp,
  Users,
  Zap,
  FileText,
  XCircle,
  Heart,
  Calendar,
  Moon,
  Star,
  Clock,
  ListChecks,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState, type LucideIcon } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { trpc } from "@/lib/trpc";
import { WelcomeTour } from "@/components/WelcomeTour";

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
}

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 360;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { data: tenant } = trpc.tenant.get.useQuery();

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = getItem<number>(SIDEBAR_WIDTH_KEY);
      return saved || DEFAULT_WIDTH;
    }
    return DEFAULT_WIDTH;
  });

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
    if (path === "/leads" && location.startsWith("/leads")) return true;
    return location === path;
  };

  // --- Simple flat navigation ---
  const mainNav: NavItem[] = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: Users, label: "Leads", path: "/leads" },
    { icon: MessageSquare, label: "Inbox", path: "/inbox" },
    { icon: Zap, label: "Automations", path: "/automations" },
    { icon: FileText, label: "Templates", path: "/templates" },
  ];

  const revenueNav: NavItem[] = [
    { icon: Zap, label: "Lead Capture", path: "/lead-capture" },
    { icon: TrendingUp, label: "Booking Conversion", path: "/booking-conversion" },
    { icon: Shield, label: "No-Show Recovery", path: "/no-show-recovery" },
    { icon: XCircle, label: "Cancellation Recovery", path: "/cancellation-recovery" },
    { icon: CreditCard, label: "Payment Enforcement", path: "/payment-enforcement" },
  ];

  const growthNav: NavItem[] = [
    { icon: Heart, label: "Retention Engine", path: "/retention-engine" },
    { icon: Clock, label: "Smart Scheduling", path: "/smart-scheduling" },
    { icon: Calendar, label: "Calendar Sync", path: "/calendar-integration" },
    { icon: ListChecks, label: "Waiting List", path: "/waiting-list" },
    { icon: Moon, label: "After Hours", path: "/after-hours" },
    { icon: Star, label: "Reviews", path: "/review-management" },
    { icon: Gift, label: "Referrals", path: "/referrals" },
  ];

  const bottomNav: NavItem[] = [
    { icon: BarChart3, label: "Analytics", path: "/analytics" },
    { icon: Settings, label: "Settings", path: "/settings" },
    { icon: CreditCard, label: "Billing", path: "/billing" },
  ];

  const adminNav: NavItem[] = [
    { icon: Shield, label: "Tenants", path: "/admin/tenants" },
    { icon: Users, label: "Users", path: "/admin/users" },
    { icon: MessageSquare, label: "Messages", path: "/admin/messages" },
    { icon: BarChart3, label: "System Health", path: "/admin/health" },
  ];

  const renderNavItems = (items: NavItem[]) =>
    items.map((item) => {
      const active = isActive(item.path);
      return (
        <SidebarMenuItem key={item.path}>
          <SidebarMenuButton
            isActive={active}
            onClick={() => setLocation(item.path)}
            tooltip={item.label}
            className="h-8"
          >
            <item.icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : ""}`} />
            <span className="truncate">{item.label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-sidebar-border">
          {/* Header */}
          <SidebarHeader className="h-14 justify-center border-b border-sidebar-border">
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
                    <p className="font-bold text-sm tracking-tight truncate">Rebooked</p>
                    {tenant && (
                      <p className="text-[11px] text-muted-foreground truncate">{tenant.name}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="py-2 overflow-y-auto">
            {/* Main */}
            <SidebarGroup className="py-0 shrink-0">
              <SidebarMenu className="px-2 space-y-0.5">
                {renderNavItems(mainNav)}
              </SidebarMenu>
            </SidebarGroup>

            <SidebarSeparator className="my-2 shrink-0" />

            {/* Revenue Recovery */}
            <SidebarGroup className="py-0 shrink-0">
              {!isCollapsed && (
                <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/50 px-4 mb-0.5">
                  Revenue Recovery
                </SidebarGroupLabel>
              )}
              <SidebarMenu className="px-2 space-y-0.5">
                {renderNavItems(revenueNav)}
              </SidebarMenu>
            </SidebarGroup>

            <SidebarSeparator className="my-2 shrink-0" />

            {/* Growth & Scheduling */}
            <SidebarGroup className="py-0 shrink-0">
              {!isCollapsed && (
                <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/50 px-4 mb-0.5">
                  Growth & Tools
                </SidebarGroupLabel>
              )}
              <SidebarMenu className="px-2 space-y-0.5">
                {renderNavItems(growthNav)}
              </SidebarMenu>
            </SidebarGroup>

            <SidebarSeparator className="my-2 shrink-0" />

            {/* Account */}
            <SidebarGroup className="py-0 shrink-0">
              <SidebarMenu className="px-2 space-y-0.5">
                {renderNavItems(bottomNav)}
              </SidebarMenu>
            </SidebarGroup>

            {/* Admin */}
            {isAdmin && (
              <>
                <SidebarSeparator className="my-2 shrink-0" />
                <SidebarGroup className="py-0 shrink-0">
                  {!isCollapsed && (
                    <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/50 px-4 mb-0.5 flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Admin
                    </SidebarGroupLabel>
                  )}
                  <SidebarMenu className="px-2 space-y-0.5">
                    {renderNavItems(adminNav)}
                  </SidebarMenu>
                </SidebarGroup>
              </>
            )}
          </SidebarContent>

          {/* Footer */}
          <SidebarFooter className="p-2 border-t border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent transition-colors w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-7 w-7 border border-sidebar-border shrink-0">
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
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{user?.email || ""}</p>
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
        <WelcomeTour />
      </SidebarInset>
    </>
  );
}
