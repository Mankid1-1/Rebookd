import DashboardLayout from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";

export default function Inbox() {
  const [activeLeadId, setActiveLeadId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  const { data: leads } = trpc.leads.list.useQuery({ page: 1, limit: 50 });
  const { data: messages } = trpc.leads.messages.useQuery({ leadId: activeLeadId ?? 0 }, { enabled: activeLeadId !== null });
  const sendMessageMutation = trpc.leads.sendMessage.useMutation();

  const activeLead = useMemo(() => leads?.leads?.find((x) => x.id === activeLeadId), [leads, activeLeadId]);

  return (
    <DashboardLayout>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4">
          <Card className="h-[calc(100vh-5rem)] overflow-y-auto">
            <CardContent>
              <h2 className="text-lg font-semibold mb-2">Leads</h2>
              {leads?.leads?.map((lead) => (
                <button
                  key={lead.id}
                  className={`block w-full text-left bg-white/5 border rounded p-2 mb-2 ${activeLeadId === lead.id ? "border-blue-500" : "border-transparent"}`}
                  onClick={() => setActiveLeadId(lead.id)}
                >
                  {lead.name || lead.phone}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="col-span-8">
          <Card className="h-[calc(100vh-5rem)] flex flex-col">
            <CardContent className="flex-1 overflow-y-auto">
              <h2 className="text-lg font-semibold mb-2">Conversation</h2>
              {!activeLead && <p className="text-muted-foreground">Select a lead to view messages.</p>}
              {activeLead && (
                <div>
                  <p className="mb-4 text-sm text-muted-foreground">{activeLead.name || activeLead.phone}</p>
                  <div className="space-y-2">
                    {messages?.map((msg) => (
                      <div key={msg.id} className={`p-2 rounded ${msg.direction === "outbound" ? "bg-blue-100" : "bg-gray-100"}`}>
                        <p className="text-sm">{msg.body}</p>
                        <p className="text-xs text-muted-foreground">{new Date(msg.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>

            {activeLead && (
              <div className="p-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a reply..." />
                  <Button
                    onClick={async () => {
                      if (!activeLeadId || !draft.trim()) return;
                      await sendMessageMutation.mutateAsync({ leadId: activeLeadId, body: draft.trim() });
                      setDraft("");
                    }}
                  >
                    Send
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
