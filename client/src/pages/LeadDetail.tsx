import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Zap } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { LeadInfoSidebar } from "@/components/leads/LeadInfoSidebar";
import { LeadConversation } from "@/components/leads/LeadConversation";
import { LeadMessageComposer } from "@/components/leads/LeadMessageComposer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const STATUS_STYLES: Record<string, string> = {
  new: "bg-info/20 text-info border-info/30",
  contacted: "bg-warning/20 text-warning border-warning/30",
  qualified: "bg-accent/20 text-accent-foreground border-accent/30",
  booked: "bg-success/20 text-success border-success/30",
  lost: "bg-destructive/20 text-destructive border-destructive/30",
  unsubscribed: "bg-muted text-muted-foreground border-muted-foreground/30",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  booked: "Booked ✓",
  lost: "Lost",
  unsubscribed: "Unsubscribed",
};

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const leadId = parseInt(id ?? "0");
  const [, setLocation] = useLocation();

  const utils = trpc.useUtils();

  const { data: lead, isLoading } = trpc.leads.get.useQuery({ leadId }, { enabled: !!leadId });

  const { data: messages = [] } = trpc.leads.messages.useQuery(
    { leadId },
    { enabled: !!leadId && !!lead, refetchInterval: 25_000, refetchIntervalInBackground: false }
  );

  const { data: statusHistory = [] } = trpc.leads.statusHistory.useQuery(
    { leadId, limit: 1 },
    { enabled: !!leadId && !!lead },
  );

  const lastTransition = statusHistory[0];
  const isAutoSet = lastTransition && !lastTransition.triggeredBy?.startsWith("user:");

  const TRIGGER_LABELS: Record<string, string> = {
    outbound_sms: "outbound SMS sent",
    inbound_sms: "inbound reply received",
    stop_keyword: "STOP keyword received",
    start_keyword: "START keyword received",
    worker_stale: "no activity detected",
    manual: "manually updated",
    manual_no_show: "marked as no-show",
    manual_booked: "marked as booked",
    manual_cancelled: "marked as cancelled",
  };

  const updateStatus = trpc.leads.updateStatus.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
      utils.leads.get.invalidate({ leadId });
      utils.leads.statusHistory.invalidate({ leadId });
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-6xl mx-auto space-y-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-24" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-8 w-36" />
          </div>
          <div className="grid lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-3">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
            <Skeleton className="h-80 w-full" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Lead not found.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setLocation("/leads")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Leads
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const outboundCount = messages.filter((m) => m.direction === "outbound").length;
  const inboundCount = messages.filter((m) => m.direction === "inbound").length;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/leads")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {lead.name || lead.phone}
              </h1>
              {lead.name && (
                <span className="text-sm text-muted-foreground">{lead.phone}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isAutoSet && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      <Zap className="w-3 h-3" /> Auto
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                    Auto-updated: {TRIGGER_LABELS[lastTransition.trigger] ?? lastTransition.trigger}. You can change this manually.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Select
              value={lead.status}
              onValueChange={(v) => updateStatus.mutate({ leadId, status: v as any })}
            >
              <SelectTrigger className={`w-36 h-8 text-xs border ${STATUS_STYLES[lead.status] ?? ""}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 flex flex-col gap-3">
            <LeadConversation
              messages={messages as any}
              outboundCount={outboundCount}
              inboundCount={inboundCount}
            />
            <LeadMessageComposer
              leadId={leadId}
              leadName={lead.name || "there"}
            />
          </div>

          <LeadInfoSidebar
            lead={lead as any}
            outboundCount={outboundCount}
            inboundCount={inboundCount}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
