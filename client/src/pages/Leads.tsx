import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { MessageSquare, Plus, Search, Users, Phone } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const STATUS_STYLES: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  contacted: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  qualified: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  booked: "bg-green-500/20 text-green-300 border-green-500/30",
  lost: "bg-red-500/20 text-red-300 border-red-500/30",
  unsubscribed: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

const STATUSES = ["all", "new", "contacted", "qualified", "booked", "lost", "unsubscribed"];
const STATUS_COUNTS_INIT = Object.fromEntries(STATUSES.slice(1).map((s) => [s, 0]));

export default function Leads() {
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [newLead, setNewLead] = useState({ phone: "", name: "", email: "", source: "", notes: "" });

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.leads.list.useQuery({
    page,
    limit: 20,
    status: statusFilter === "all" ? undefined : statusFilter,
    search: debouncedSearch || undefined,
  });

  // Fetch status breakdown for tab counts
  const { data: dashData } = trpc.analytics.dashboard.useQuery(undefined, { retry: false });
  const statusCounts = (dashData?.statusBreakdown ?? []).reduce(
    (acc: Record<string, number>, s: any) => ({ ...acc, [s.status]: s.count }),
    {} as Record<string, number>
  );

  const createLead = trpc.leads.create.useMutation({
    onSuccess: () => {
      toast.success("Lead added ✓");
      setShowAdd(false);
      setNewLead({ phone: "", name: "", email: "", source: "", notes: "" });
      utils.leads.list.invalidate();
      utils.analytics.dashboard.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateStatus = trpc.leads.updateStatus.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
      utils.analytics.dashboard.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const leads = data?.leads ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const handleAddSubmit = () => {
    if (!newLead.phone.trim()) return toast.error("Phone number is required");
    createLead.mutate({
      phone: newLead.phone,
      name: newLead.name || undefined,
      email: newLead.email || undefined,
      source: newLead.source || undefined,
      notes: newLead.notes || undefined,
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Leads
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {total.toLocaleString()} lead{total !== 1 ? "s" : ""}
              {statusFilter !== "all" && ` · filtered by ${statusFilter}`}
            </p>
          </div>
          <Dialog
            open={showAdd}
            onOpenChange={(v) => {
              setShowAdd(v);
              if (!v) setNewLead({ phone: "", name: "", email: "", source: "", notes: "" });
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1.5" /> Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Lead</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>
                    Phone number <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="+1 (555) 000-0000"
                      value={newLead.phone}
                      onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleAddSubmit()}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input
                      placeholder="Jane Smith"
                      value={newLead.name}
                      onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input
                      placeholder="jane@example.com"
                      type="email"
                      value={newLead.email}
                      onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Source <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    placeholder="e.g. Walk-in, Referral, Instagram"
                    value={newLead.source}
                    onChange={(e) => setNewLead({ ...newLead, source: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Textarea
                    placeholder="Any notes about this lead…"
                    value={newLead.notes}
                    onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                    className="resize-none min-h-[70px] text-sm"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={!newLead.phone.trim() || createLead.isPending}
                    onClick={handleAddSubmit}
                  >
                    {createLead.isPending ? "Adding…" : "Add Lead"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search + Status filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone or email…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-44 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="flex items-center justify-between gap-3 w-full">
                    <span>{s === "all" ? "All statuses" : s.charAt(0).toUpperCase() + s.slice(1)}</span>
                    {s !== "all" && statusCounts[s] != null && (
                      <span className="text-muted-foreground text-xs">{statusCounts[s]}</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card className="border-border bg-card">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center">
                <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Loading leads…</p>
              </div>
            ) : leads.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="font-medium mb-1">
                  {debouncedSearch || statusFilter !== "all" ? "No leads match your filters" : "No leads yet"}
                </p>
                <p className="text-muted-foreground text-sm mb-4">
                  {debouncedSearch || statusFilter !== "all"
                    ? "Try adjusting your search or filter"
                    : "Add your first lead to start sending messages"}
                </p>
                {!debouncedSearch && statusFilter === "all" && (
                  <Button size="sm" onClick={() => setShowAdd(true)}>
                    <Plus className="w-4 h-4 mr-1.5" /> Add Lead
                  </Button>
                )}
                {(debouncedSearch || statusFilter !== "all") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setSearch(""); setStatusFilter("all"); }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs">Name / Phone</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                    <TableHead className="text-muted-foreground text-xs hidden sm:table-cell">Source</TableHead>
                    <TableHead className="text-muted-foreground text-xs hidden md:table-cell">Last Message</TableHead>
                    <TableHead className="text-muted-foreground text-xs hidden lg:table-cell">Added</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="border-border cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setLocation(`/leads/${lead.id}`)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{lead.name || <span className="text-muted-foreground italic">Unnamed</span>}</p>
                          <p className="text-xs text-muted-foreground font-mono">{lead.phone}</p>
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={lead.status}
                          onValueChange={(v) => updateStatus.mutate({ leadId: lead.id, status: v as any })}
                        >
                          <SelectTrigger className={`w-32 h-7 text-xs border ${STATUS_STYLES[lead.status] ?? ""}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["new", "contacted", "qualified", "booked", "lost", "unsubscribed"].map((s) => (
                              <SelectItem key={s} value={s}>
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground">{lead.source || "—"}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {lead.lastMessageAt
                            ? new Date(lead.lastMessageAt).toLocaleDateString([], { month: "short", day: "numeric" })
                            : <span className="italic">Never</span>}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {new Date(lead.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 opacity-60 hover:opacity-100"
                          onClick={(e) => { e.stopPropagation(); setLocation(`/leads/${lead.id}`); }}
                          title="Open conversation"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Page {page} of {totalPages} · {total} leads
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
