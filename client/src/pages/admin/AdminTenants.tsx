import DashboardLayout from "@/components/layout/DashboardLayout";
import { useTheme } from "@/contexts/ThemeContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpTooltip } from "@/components/ui/HelpTooltip";
import { Building2, Search, Shield, MoreHorizontal, Eye, Ban, TrendingUp, DollarSign, Users, Activity, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";

// Dynamic plan styles based on user theme
const getDynamicPlanStyles = (isDarkMode: boolean) => {
  return {
    free: isDarkMode ? "bg-slate-500/25 text-slate-300 border-slate-500/40" : "bg-slate-500/15 text-slate-400 border-slate-500/30",
    rebooked: isDarkMode ? "bg-success/25 text-success border-success/40" : "bg-success/15 text-success border-success/30",
    flex: isDarkMode ? "bg-info/25 text-info border-info/40" : "bg-info/15 text-info border-info/30",
    trialing: isDarkMode ? "bg-warning/25 text-warning border-warning/40" : "bg-warning/15 text-warning border-warning/30",
  };
};

// Dynamic plan prices from real API data
const getDynamicPlanPrices = (plans?: any[]) => {
  if (!plans || plans.length === 0) {
    return { rebooked: 199, flex: 0 };
  }

  const prices: Record<string, number> = {};
  plans.forEach(plan => {
    prices[plan.slug] = plan.priceMonthly ?? plan.price ?? 0;
  });

  return prices;
};

// Build a planId→slug lookup from plans data
const buildPlanLookup = (plans?: any[]): Record<number, string> => {
  if (!plans || plans.length === 0) return {};
  const lookup: Record<number, string> = {};
  plans.forEach(plan => { lookup[plan.id] = plan.slug; });
  return lookup;
};

export default function AdminTenants() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { isDark: isDarkMode } = useTheme();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Dynamic configurations
  const planStyles = getDynamicPlanStyles(isDarkMode);

  useEffect(() => {
    if (user && user.role !== "admin") setLocation("/dashboard");
  }, [user, setLocation]);

  const [planDialog, setPlanDialog] = useState<{ tenantId: number; tenantName: string; currentPlanSlug: string } | null>(null);

  const { data, isLoading, refetch } = trpc.admin.tenants.list.useQuery({ page, limit: 20 }, { retry: false });
  const { data: plansData } = trpc.plans.list.useQuery();

  const changePlanMutation = trpc.admin.changePlan.useMutation({
    onSuccess: () => {
      toast.success("Plan updated successfully");
      setPlanDialog(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const tenants = data?.tenants ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);
  const activeCount = tenants.filter((t: any) => t.active).length;
  
  // Dynamic pricing from real data
  const planPrices = getDynamicPlanPrices(plansData);
  const mrrEstimate = tenants.reduce((sum: number, t: any) => {
    return sum + (planPrices[t.planSlug ?? 'free'] ?? 0);
  }, 0);

  const filtered = tenants.filter((t: any) => {
    const matchSearch = !search || t.name?.toLowerCase().includes(search.toLowerCase()) || t.slug?.toLowerCase().includes(search.toLowerCase());
    const matchPlan = planFilter === "all" || t.planSlug === planFilter;
    const matchStatus = statusFilter === "all" || (statusFilter === "active" ? t.active : !t.active);
    return matchSearch && matchPlan && matchStatus;
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-warning" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Tenants</h1>
              <p className="text-muted-foreground text-sm">{total} total businesses</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Tenants", value: total, icon: Building2, color: "text-info", bg: "bg-info/10", tooltip: null },
            { label: "Active", value: activeCount, icon: Activity, color: "text-success", bg: "bg-success/10", tooltip: null },
            { label: "MRR (est.)", value: `$${mrrEstimate.toLocaleString()}`, icon: DollarSign, color: "text-accent-foreground", bg: "bg-accent/10", tooltip: "Total monthly subscription revenue across all active tenants" },
            { label: "Showing", value: filtered.length, icon: Users, color: "text-primary", bg: "bg-primary/10", tooltip: null },
          ].map((s) => (
            <Card key={s.label} className="border-border bg-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {s.tooltip ? (
                        <HelpTooltip content={s.tooltip} variant="info">{s.label}</HelpTooltip>
                      ) : s.label}
                    </p>
                    <p className="text-lg font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{s.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search tenants..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-36"><SelectValue placeholder="All plans" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All plans</SelectItem>
                  <SelectItem value="rebooked">Rebooked ($199)</SelectItem>
                  <SelectItem value="flex">Flex</SelectItem>
                  <SelectItem value="trialing">Trial</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36"><SelectValue placeholder="All status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-border bg-card">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Loading tenants...</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center"><Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground text-sm">No tenants found.</p></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs">Business</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Industry</TableHead>
                    <TableHead className="text-muted-foreground text-xs">
                      <HelpTooltip content="How this tenant is billed: Standard = $199/mo + revenue share, Founder = free forever, Flex = usage-based" variant="info">Plan</HelpTooltip>
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                    <TableHead className="text-muted-foreground text-xs">
                      <HelpTooltip content="Date this business account was created" variant="info">Joined</HelpTooltip>
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((tenant: any) => (
                    <TableRow key={tenant.id} className="border-border hover:bg-muted/20">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Building2 className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{tenant.name || "Unnamed"}</p>
                            <p className="text-xs text-muted-foreground">#{tenant.id} · {tenant.slug}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><span className="text-xs text-muted-foreground capitalize">{tenant.industry || "—"}</span></TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${planStyles[tenant.planSlug] ?? planStyles.free}`}>
                          {tenant.subscriptionStatus === "trialing" ? "Trial" : (tenant.planSlug === "rebooked" ? "Rebooked $199" : tenant.planSlug === "flex" ? "Flex" : "Free")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${tenant.active ? "text-success border-success/30" : "text-destructive border-destructive/30"}`}>
                          {tenant.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell><span className="text-xs text-muted-foreground">{new Date(tenant.createdAt).toLocaleDateString()}</span></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="w-3.5 h-3.5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => toast.info(`Viewing tenant #${tenant.id} — impersonation coming soon`)}>
                              <Eye className="w-3.5 h-3.5 mr-2" /> View as tenant
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setPlanDialog({ tenantId: tenant.id, tenantName: tenant.name, currentPlanSlug: tenant.planSlug })}>
                              <TrendingUp className="w-3.5 h-3.5 mr-2" /> Override plan
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => toast.info(`Suspend tenant #${tenant.id} — coming soon`)}>
                                    <Ban className="w-3.5 h-3.5 mr-2" /> Suspend tenant
                                  </DropdownMenuItem>
                                </TooltipTrigger>
                                <TooltipContent side="left"><p>Temporarily blocks tenant access to the platform. Subscription is paused.</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Plan Override Dialog */}
      <Dialog open={!!planDialog} onOpenChange={() => setPlanDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Override Plan — {planDialog?.tenantName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            {(plansData ?? []).map((plan: any) => (
              <Button
                key={plan.id}
                variant={planDialog?.currentPlanSlug === plan.slug ? "default" : "outline"}
                className="w-full justify-between"
                disabled={changePlanMutation.isPending}
                onClick={() => changePlanMutation.mutate({ tenantId: planDialog!.tenantId, planId: plan.id })}
              >
                <span>{plan.name}</span>
                <span className="text-xs opacity-60">${(plan.priceMonthly / 100).toFixed(0)}/mo</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
