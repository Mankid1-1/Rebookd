import DashboardLayout from "@/components/layout/DashboardLayout";
import { EncryptionBadge } from "@/components/ui/EncryptionBadge";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { AddLeadDialog } from "@/components/leads/AddLeadDialog";
import { LeadsFilter } from "@/components/leads/LeadsFilter";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { LeadsPagination } from "@/components/leads/LeadsPagination";
import { QuickActions, getLeadsQuickActions } from "@/components/ui/QuickActions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HelpTooltip, HelpIcon } from "@/components/ui/HelpTooltip";
import { OnboardingTour, useOnboardingTour } from "@/components/ui/OnboardingTour";
import {
  Users,
  TrendingUp,
  Phone,
  MessageSquare,
  Search,
  Filter,
  Download,
  Zap,
  ArrowUp,
  ArrowDown,
  Calendar,
  Link2,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

export default function Leads() {
  const { t } = useLocale();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { isOpen, hasSeenTour, startTour, closeTour, completeTour } = useOnboardingTour();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = trpc.leads.list.useQuery({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
  });

  const { data: dashData } = trpc.analytics.dashboard.useQuery(undefined, { retry: false });
  const statusCounts: Record<string, number> = (dashData?.statusBreakdown ?? []).reduce(
    (acc: Record<string, number>, s: any) => ({ ...acc, [s.status]: s.count }),
    {} as Record<string, number>
  );

  const leads = data?.leads ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const { data: calendarConnections } = trpc.calendar.listConnections.useQuery(undefined, { retry: false });
  const connectedCalendars = calendarConnections?.length ?? 0;
  const lastSyncAt = calendarConnections?.reduce((latest: Date | null, c: any) => {
    const t = c.lastSyncAt ? new Date(c.lastSyncAt) : null;
    return t && (!latest || t > latest) ? t : latest;
  }, null as Date | null);

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "add-lead":
        (document.querySelector('[data-testid="add-lead-button"]') as HTMLElement)?.click();
        break;
      case "send-message":
        window.location.href = "/inbox";
        break;
      case "make-call":
        toast.info("Select a lead from the table below to call them");
        break;
      case "schedule-appointment":
        window.location.href = "/calendar-integration";
        break;
      case "import-leads":
        window.location.href = "/contact-import";
        break;
      case "search-leads":
        (document.querySelector('[data-testid="search-input"]') as HTMLElement)?.focus();
        break;
    }
  };

  const handleExport = () => {
    if (leads.length === 0) {
      toast.info("No leads to export");
      return;
    }
    const header = "Name,Phone,Email,Status,Source,Created At";
    const rows = leads.map((l: any) =>
      [l.name || "", l.phone || "", l.email || "", l.status || "", l.source || "", l.createdAt ? new Date(l.createdAt).toISOString() : ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rebooked-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${leads.length} leads`);
  };

  const quickActions = getLeadsQuickActions(handleQuickAction);

  return (
    <DashboardLayout>
      <OnboardingTour 
        isOpen={isOpen} 
        onClose={closeTour} 
        onComplete={completeTour}
      />
      
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {t('sidebar.leads')}
              </h1>
              <HelpIcon
                content={{
                  basic: "Your contacts — everyone who has called, texted, or been added to your list",
                  intermediate: "Manage leads through their lifecycle: new, contacted, qualified, booked, or lost",
                  advanced: "Leads table with tenant isolation. Status transitions trigger automation_jobs. Full-text search via LIKE queries",
                }}
                variant="info"
              />
            </div>
            <p className="text-muted-foreground text-sm">
              {total.toLocaleString()} lead{total !== 1 ? "s" : ""}
              {statusFilter !== "all" && ` · filtered by ${statusFilter}`}
              {debouncedSearch && ` · matching "${debouncedSearch}"`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="h-4 w-4 mr-2" />
                    {t('common.export')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Export all leads to CSV</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="flex items-center gap-1">
              <AddLeadDialog />
              <HelpIcon content={{
                basic: "Add a new contact manually — just enter their phone number",
                intermediate: "Create a lead manually. The Welcome automation will trigger if enabled",
                advanced: "Inserts into leads table, fires eventBus lead.created which triggers matching automation rules",
              }} variant="help" />
            </span>
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    Total Leads
                    <HelpIcon content={{
                      basic: "Everyone in your contact list",
                      intermediate: "All contacts in your pipeline, regardless of status",
                      advanced: "Count of all lead rows for this tenant, unfiltered by status enum",
                    }} variant="info" />
                  </p>
                  <p className="text-2xl font-bold">{total.toLocaleString()}</p>
                </div>
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    New Today
                    <HelpIcon content={{
                      basic: "People added to your list today",
                      intermediate: "Leads added or imported in the last 24 hours",
                      advanced: "Count of leads with status='new' from dashboard statusBreakdown aggregation",
                    }} variant="info" />
                  </p>
                  <p className="text-2xl font-bold">{statusCounts.new || 0}</p>
                </div>
                <div className="w-8 h-8 bg-success/10 rounded-full flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    Qualified
                    <HelpIcon content={{
                      basic: "People who are interested and ready to book",
                      intermediate: "Leads who have been engaged and are ready to book — warm prospects",
                      advanced: "Leads with status='qualified'. Transition from 'contacted' is manual or automation-driven",
                    }} variant="info" />
                  </p>
                  <p className="text-2xl font-bold">{statusCounts.qualified || 0}</p>
                </div>
                <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center">
                  <Zap className="h-4 w-4 text-accent-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    Booked
                    <HelpIcon content={{
                      basic: "People who have an appointment scheduled",
                      intermediate: "Leads who have successfully converted to a booked appointment",
                      advanced: "Leads with status='booked'. This status change is counted toward recovered revenue and ROI calculations",
                    }} variant="info" />
                  </p>
                  <p className="text-2xl font-bold">{statusCounts.booked || 0}</p>
                </div>
                <div className="w-8 h-8 bg-warning/10 rounded-full flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Calendar Sync Status */}
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-success" />
                </div>
                <div>
                  <p className="text-sm font-medium flex items-center gap-1">
                    {connectedCalendars > 0
                      ? `${connectedCalendars} calendar${connectedCalendars > 1 ? "s" : ""} connected`
                      : "No calendars connected"}
                    <HelpIcon content={{
                      basic: "Connect your calendar so new bookings show up here automatically",
                      intermediate: "When your booking software is connected, new appointment contacts are automatically imported as leads",
                      advanced: "Calendar sync polls via calendar-sync.service on a cron interval. New contacts are upserted into leads table with source='calendar'",
                    }} variant="info" />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {lastSyncAt
                      ? `Last synced ${new Date(lastSyncAt).toLocaleString()}`
                      : "Connect your booking software to auto-import contacts"}
                  </p>
                  <EncryptionBadge variant="badge" className="mt-1" />
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => (window.location.href = "/calendar-integration")}
              >
                <Link2 className="h-4 w-4 mr-2" />
                {connectedCalendars > 0 ? "Manage" : "Connect Calendar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
            <CardDescription>
              Common tasks to manage your leads efficiently
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuickActions actions={quickActions} />
          </CardContent>
        </Card>

        {/* Search and Filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search leads by name, phone, or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 border rounded-md bg-background"
                    data-testid="search-input"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <HelpIcon content={{
                      basic: "Type a name or phone number to find someone",
                      intermediate: "Search by name, phone, email, or status. Filters combine with AND logic",
                      advanced: "Client-side filtering with server pagination. Search debounced at 300ms",
                    }} variant="help" />
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <LeadsFilter
                  search=""
                  onSearchChange={() => {}}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  statusCounts={statusCounts}
                />
                {(search || statusFilter !== "all") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                    }}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leads Table */}
        <div className="flex items-center gap-2 mb-[-0.75rem]">
          <span className="text-sm font-medium text-muted-foreground">Lead Status</span>
          <HelpIcon content={{
            basic: "This shows where each person is in your booking process",
            intermediate: "Lead lifecycle: New \u2192 Contacted \u2192 Qualified \u2192 Booked. Status changes can trigger automations",
            advanced: "Status enum in leads table. Transitions logged in lead_status_history. Each change evaluated against automation conditions",
          }} variant="info" />
        </div>
        <LeadsTable
          leads={leads}
          isLoading={isLoading}
          onAddClick={() => (document.querySelector('[data-testid="add-lead-button"]') as HTMLElement)?.click()}
          isFiltered={!!(search || statusFilter !== "all")}
          onClearFilters={() => {
            setSearch("");
            setStatusFilter("all");
          }}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <LeadsPagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            total={total}
          />
        )}

        {/* Empty State */}
        {!isLoading && leads.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No leads found</h3>
              <p className="text-muted-foreground mb-4">
                {search || statusFilter !== "all"
                  ? "Try adjusting your search or filters to find leads."
                  : "Get started by adding your first lead to begin tracking potential customers."}
              </p>
              <AddLeadDialog />
              {!hasSeenTour && (
                <Button variant="outline" onClick={startTour} className="ml-2">
                  Take a Tour
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

