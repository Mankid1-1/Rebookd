import DashboardLayout from "@/components/layout/DashboardLayout";
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
import { HelpTooltip } from "@/components/ui/HelpTooltip";
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
  ArrowDown
} from "lucide-react";

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

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "add-lead":
        // Open add lead dialog
        (document.querySelector('[data-testid="add-lead-button"]') as HTMLElement)?.click();
        break;
      case "send-message":
        // Navigate to compose message
        window.location.href = "/inbox";
        break;
      case "make-call":
        // Open phone dialer or show call interface
        console.log("Make call action");
        break;
      case "schedule-appointment":
        // Open appointment scheduler
        console.log("Schedule appointment action");
        break;
      case "import-leads":
        // Open import dialog
        console.log("Import leads action");
        break;
      case "search-leads":
        // Focus search input
        (document.querySelector('[data-testid="search-input"]') as HTMLElement)?.focus();
        break;
    }
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
              <HelpTooltip 
                content="Manage all your potential customers and track their journey through your sales pipeline"
                variant="info"
              >
                <span />
              </HelpTooltip>
            </div>
            <p className="text-muted-foreground text-sm">
              {total.toLocaleString()} lead{total !== 1 ? "s" : ""}
              {statusFilter !== "all" && ` · filtered by ${statusFilter}`}
              {debouncedSearch && ` · matching "${debouncedSearch}"`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              {t('common.export')}
            </Button>
            <AddLeadDialog />
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Leads</p>
                  <p className="text-2xl font-bold">{total.toLocaleString()}</p>
                </div>
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">New Today</p>
                  <p className="text-2xl font-bold">{statusCounts.new || 0}</p>
                </div>
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Qualified</p>
                  <p className="text-2xl font-bold">{statusCounts.qualified || 0}</p>
                </div>
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Zap className="h-4 w-4 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Booked</p>
                  <p className="text-2xl font-bold">{statusCounts.booked || 0}</p>
                </div>
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
                    className="w-full pl-10 pr-4 py-2 border rounded-md bg-background"
                    data-testid="search-input"
                  />
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

