import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Users, Plus, Phone, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useDynamicStatuses } from "@/hooks/useDynamicConfiguration";
import type { Lead } from "../../../../shared/interfaces";

interface LeadsTableProps {
  leads: Lead[];
  isLoading: boolean;
  onAddClick: () => void;
  isFiltered: boolean;
  onClearFilters: () => void;
}

export function LeadsTable({ leads, isLoading, onAddClick, isFiltered, onClearFilters }: LeadsTableProps) {
  const statuses = useDynamicStatuses();
  const [, setLocation] = useLocation();

  const statusOptions = statuses;
  const utils = trpc.useUtils();

  const updateLeadStatus = trpc.leads.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Lead status updated");
      utils.leads.list.invalidate();
      utils.analytics.dashboard.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleStatusChange = (leadId: number, newStatus: string) => {
    updateLeadStatus.mutate({ leadId, status: newStatus as any });
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "Never";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleRowClick = (leadId: number) => {
    setLocation(`/leads/${leadId}`);
  };

  const handleSendMessage = (e: React.MouseEvent, leadId: number) => {
    e.stopPropagation();
    setLocation(`/inbox?lead=${leadId}`);
  };

  const handleCall = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    window.open(`tel:${phone}`, '_blank');
  };

  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[220px]">Lead</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[100px]">Source</TableHead>
                  <TableHead className="w-[140px]">Last Activity</TableHead>
                  <TableHead className="w-[110px]">Added</TableHead>
                  <TableHead className="text-right w-[160px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Skeleton className="h-8 w-20 rounded-md" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (leads.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No leads found</h3>
          <p className="text-muted-foreground mb-4">
            {isFiltered
              ? "Try adjusting your search or filters to find leads."
              : "Start by adding your first lead to begin tracking potential customers."}
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={onAddClick}>
              <Plus className="h-4 w-4 mr-2" />
              Add Lead
            </Button>
            {isFiltered && (
              <Button variant="outline" onClick={onClearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[220px]">Lead</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[100px]">Source</TableHead>
                <TableHead className="w-[140px]">Last Activity</TableHead>
                <TableHead className="w-[110px]">Added</TableHead>
                <TableHead className="text-right w-[160px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleRowClick(lead.id)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-sm font-medium text-primary">
                          {getInitials(lead.name)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {lead.name || "Unknown Lead"}
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span className="truncate">{lead.phone}</span>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={lead.status}
                      onValueChange={(value) => handleStatusChange(lead.id, value)}
                    >
                      <SelectTrigger className="w-fit border-none bg-transparent p-0 h-auto shadow-none">
                        <StatusBadge status={lead.status} size="sm" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${option.color}`} />
                              {option.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {lead.source ? (
                      <Badge variant="outline" className="text-xs">
                        {lead.source}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">--</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-sm text-muted-foreground">{formatDate((lead as any).lastMessageAt)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(lead.createdAt)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => handleSendMessage(e, lead.id)}
                        className="gap-1 h-8 text-xs"
                      >
                        <MessageSquare className="h-3 w-3" />
                        Message
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => handleCall(e, lead.phone)}
                        className="h-8 w-8 p-0"
                      >
                        <Phone className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
