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
import { MessageSquare, Users, Plus, Phone, Mail, Calendar, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { StatusBadge, CommunicationBadge, ActivityBadge } from "@/components/ui/StatusBadge";
import { HelpTooltip } from "@/components/ui/HelpTooltip";
import { useDynamicStatuses } from "@/hooks/useDynamicConfiguration";
import type { Lead } from "../../../shared/interfaces";

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

  const updateLeadStatus = trpc.leads.update.useMutation({
    onSuccess: () => {
      toast.success("Lead status updated");
      utils.leads.list.invalidate();
      utils.analytics.dashboard.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleStatusChange = (leadId: number, newStatus: string) => {
    updateLeadStatus.mutate({ id: leadId, status: newStatus as any });
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

  const handleSendMessage = (leadId: number, leadName: string | null) => {
    const [, setLocation] = useLocation();
    setLocation(`/inbox?lead=${leadId}`);
  };

  const handleCall = (phone: string) => {
    window.open(`tel:${phone}`, '_blank');
  };

  const handleEmail = (email: string) => {
    window.open(`mailto:${email}`, '_blank');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (leads.length === 0) {
    return (
      <Card>
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
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">
                  <div className="flex items-center gap-2">
                    Lead
                    <HelpTooltip 
                      content="Contact information and basic details about the lead"
                      variant="info"
                    >
                      <span />
                    </HelpTooltip>
                  </div>
                </TableHead>
                <TableHead className="w-[120px]">
                  <div className="flex items-center gap-2">
                    Status
                    <HelpTooltip 
                      content="Current stage in your sales pipeline"
                      variant="info"
                    >
                      <span />
                    </HelpTooltip>
                  </div>
                </TableHead>
                <TableHead className="w-[100px]">Source</TableHead>
                <TableHead className="w-[150px]">
                  <div className="flex items-center gap-2">
                    Last Activity
                    <HelpTooltip 
                      content="Most recent communication or interaction"
                      variant="info"
                    >
                      <span />
                    </HelpTooltip>
                  </div>
                </TableHead>
                <TableHead className="w-[120px]">Added</TableHead>
                <TableHead className="text-right w-[200px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {getInitials(lead.name)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {lead.name || "Unknown Lead"}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{lead.phone}</span>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={lead.status}
                      onValueChange={(value) => handleStatusChange(lead.id, value)}
                    >
                      <SelectTrigger className="w-fit">
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
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{formatDate(lead.lastMessageAt)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(lead.createdAt)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendMessage(lead.id, lead.name)}
                        className="gap-1"
                      >
                        <MessageSquare className="h-3 w-3" />
                        Message
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCall(lead.phone)}
                        className="gap-1"
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
