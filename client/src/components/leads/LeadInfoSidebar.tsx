import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Phone, User, Mail, Calendar } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { Lead } from "../../../../shared/interfaces";

interface LeadInfoSidebarProps {
  lead: Lead;
  outboundCount: number;
  inboundCount: number;
}

export function LeadInfoSidebar({ lead, outboundCount, inboundCount }: LeadInfoSidebarProps) {
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    name: lead.name ?? "",
    email: lead.email ?? "",
    notes: lead.notes ?? "",
    appointmentAt: lead.appointmentAt
      ? new Date(lead.appointmentAt).toISOString().slice(0, 16)
      : "",
  });

  const utils = trpc.useUtils();
  const updateLead = trpc.leads.update.useMutation({
    onSuccess: () => {
      toast.success("Saved ✓");
      setEditMode(false);
      utils.leads.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card">
        <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Lead Info</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              if (!editMode) {
                setEditData({
                  name: lead.name ?? "",
                  email: lead.email ?? "",
                  notes: lead.notes ?? "",
                  appointmentAt: lead.appointmentAt
                    ? new Date(lead.appointmentAt).toISOString().slice(0, 16)
                    : "",
                });
              }
              setEditMode(!editMode);
            }}
          >
            {editMode ? "Cancel" : "Edit"}
          </Button>
        </CardHeader>
        <CardContent className="p-4">
          {editMode ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="h-8 text-sm"
                  placeholder="Client name"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  className="h-8 text-sm"
                  placeholder="email@example.com"
                  type="email"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Appointment</Label>
                <Input
                  type="datetime-local"
                  value={editData.appointmentAt}
                  onChange={(e) => setEditData({ ...editData, appointmentAt: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  value={editData.notes}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  className="text-sm min-h-[70px] resize-none"
                  placeholder="Internal notes…"
                />
              </div>
              <Button
                size="sm"
                className="w-full"
                disabled={updateLead.isPending}
                onClick={() =>
                  updateLead.mutate({
                    leadId: lead.id,
                    name: editData.name || undefined,
                    email: editData.email || undefined,
                    notes: editData.notes || undefined,
                    appointmentAt: editData.appointmentAt
                      ? new Date(editData.appointmentAt)
                      : null,
                  })
                }
              >
                {updateLead.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                className="flex items-center gap-2.5 w-full text-left group"
                onClick={() => {
                  navigator.clipboard.writeText(lead.phone);
                  toast.success("Phone copied");
                }}
                title="Click to copy"
              >
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm group-hover:text-primary transition-colors">{lead.phone}</span>
              </button>
              {lead.name && (
                <div className="flex items-center gap-2.5">
                  <User className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">{lead.name}</span>
                </div>
              )}
              {lead.email && (
                <button
                  className="flex items-center gap-2.5 w-full text-left group"
                  onClick={() => {
                    navigator.clipboard.writeText(lead.email!);
                    toast.success("Email copied");
                  }}
                  title="Click to copy"
                >
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate group-hover:text-primary transition-colors">{lead.email}</span>
                </button>
              )}
              <div className="flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  {lead.appointmentAt ? (
                    <>
                      <p className="text-sm">
                        {new Date(lead.appointmentAt).toLocaleDateString([], {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(lead.appointmentAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">No appointment set</span>
                  )}
                </div>
              </div>
              {lead.source && (
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                  </div>
                  <span className="text-xs text-muted-foreground">Source: {lead.source}</span>
                </div>
              )}
              {lead.notes && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Notes</p>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {lead.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-sm font-semibold">Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-2.5">
          {[
            { label: "Messages sent", value: outboundCount },
            { label: "Replies received", value: inboundCount },
            {
              label: "Last activity",
              value: lead.lastMessageAt
                ? new Date(lead.lastMessageAt).toLocaleDateString([], { month: "short", day: "numeric" })
                : "Never",
            },
            {
              label: "Added",
              value: new Date(lead.createdAt).toLocaleDateString([], {
                month: "short",
                day: "numeric",
                year: "numeric",
              }),
            },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
          {lead.status === "unsubscribed" && (
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground bg-red-500/10 text-red-400 rounded p-2 leading-relaxed">
                ⛔ This contact replied STOP and has been unsubscribed.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
