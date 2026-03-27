import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { AddLeadDialog } from "@/components/leads/AddLeadDialog";
import { LeadsFilter } from "@/components/leads/LeadsFilter";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { LeadsPagination } from "@/components/leads/LeadsPagination";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Phone,
  CalendarCheck,
  TrendingUp,
  Search,
  Filter,
  Download,
} from "lucide-react";

export default function Leads() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

  const { data: dashData, isLoading: dashLoading } = trpc.analytics.dashboard.useQuery(undefined, { retry: false });
  const statusCounts: Record<string, number> = (dashData?.statusBreakdown ?? []).reduce(
    (acc: Record<string, number>, s: any) => ({ ...acc, [s.status]: s.count }),
    {} as Record<string, number>
  );

  const leads = data?.leads ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const totalLeads = total;
  const contactedCount = (statusCounts.contacted ?? 0) + (statusCounts.qualified ?? 0) + (statusCounts.booked ?? 0);
  const bookedCount = statusCounts.booked ?? 0;
  const conversionRate = totalLeads > 0 ? ((bookedCount / totalLeads) * 100).toFixed(1) : "0.0";

  const stats = [
    {
      label: "Total Leads",
      value: totalLeads.toLocaleString(),
      icon: Users,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Contacted",
      value: contactedCount.toLocaleString(),
      icon: Phone,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
    },
    {
      label: "Booked",
      value: bookedCount.toLocaleString(),
      icon: CalendarCheck,
      color: "text-green-400",
      bg: "bg-green-500/10",
    },
    {
      label: "Conversion Rate",
      value: `${conversionRate}%`,
      icon: TrendingUp,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Leads
            </h1>
            <p className="text-muted-foreground text-sm">
              {total.toLocaleString()} lead{total !== 1 ? "s" : ""}
              {statusFilter !== "all" && ` · filtered by ${statusFilter}`}
              {debouncedSearch && ` · matching "${debouncedSearch}"`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <AddLeadDialog />
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {dashLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="border-border bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-7 w-14" />
                      </div>
                      <Skeleton className="h-9 w-9 rounded-full" />
                    </div>
                  </CardContent>
                </Card>
              ))
            : stats.map((stat) => (
                <Card key={stat.label} className="border-border bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                        <p className="text-2xl font-bold mt-1">{stat.value}</p>
                      </div>
                      <div className={`w-9 h-9 ${stat.bg} rounded-full flex items-center justify-center`}>
                        <stat.icon className={`h-4 w-4 ${stat.color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>

        {/* Search and Filter */}
        <Card className="border-border bg-card">
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
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    data-testid="search-input"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <LeadsFilter
                  search={search}
                  onSearchChange={setSearch}
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
                    Clear
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
      </div>
    </DashboardLayout>
  );
}
