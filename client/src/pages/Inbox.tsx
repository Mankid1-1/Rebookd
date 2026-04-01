import DashboardLayout from "@/components/layout/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useMemo, useState, useRef, useEffect } from "react";
import { HelpTooltip, HelpIcon } from "@/components/ui/HelpTooltip";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function Inbox() {
  const [activeLeadId, setActiveLeadId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data: leads } = trpc.leads.list.useQuery({ page: 1, limit: 50 });
  const { data: messages, isLoading: messagesLoading } = trpc.leads.messages.useQuery({ leadId: activeLeadId ?? 0 }, { enabled: !!activeLeadId });
  const sendMessageMutation = trpc.leads.sendMessage.useMutation();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const activeLead = useMemo(() => leads?.leads?.find((x) => x.id === activeLeadId), [leads, activeLeadId]);

  return (
    <DashboardLayout>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4">
          <Card className="h-[calc(100vh-5rem)] overflow-y-auto">
            <CardContent>
              <HelpTooltip content={{ basic: "Your text message conversations", intermediate: "Unified inbox for all SMS conversations across leads", advanced: "Messages table joined with leads, ordered by last_message_at. Real-time polling every 10s" }} variant="info">
                <h2 className="text-lg font-semibold mb-2">Inbox</h2>
              </HelpTooltip>
              {leads?.leads?.map((lead) => (
                <button
                  key={lead.id}
                  className={`block w-full text-left bg-white/5 border rounded p-2 mb-2 ${activeLeadId === lead.id ? "border-info" : "border-transparent"}`}
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
              <HelpTooltip content={{ basic: "Find a conversation by name or number", intermediate: "Search across all conversations by lead name, phone, or message content", advanced: "Full-text search against leads.name, leads.phone, and messages.body columns" }} variant="info">
                <h2 className="text-lg font-semibold mb-2">Conversation</h2>
              </HelpTooltip>
              {!activeLead && <p className="text-muted-foreground">Select a lead to view messages.</p>}
              {activeLead && (
                <div>
                  <p className="mb-4 text-sm text-muted-foreground">{activeLead.name || activeLead.phone}</p>
                  {messagesLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="p-2 rounded bg-muted animate-pulse">
                          <div className="h-4 bg-muted-foreground/20 rounded w-3/4 mb-1"></div>
                          <div className="h-3 bg-muted-foreground/10 rounded w-1/4"></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {messages?.map((msg) => (
                        <TooltipProvider key={msg.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`p-2 rounded cursor-default ${msg.direction === "outbound" ? "bg-info/10" : "bg-muted"}`}>
                                <p className="text-sm">{msg.body}</p>
                                <p className="text-xs text-muted-foreground">{new Date(msg.createdAt).toLocaleString()}</p>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{msg.direction === "outbound" ? "Sent by Rebooked" : "Reply from lead"} · {new Date(msg.createdAt).toLocaleString()}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>
              )}
            </CardContent>

            {activeLead && (
              <div className="p-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <HelpTooltip content="Type a manual reply to send to this lead via SMS. This is logged in the conversation history and counts toward your monthly message allowance." variant="info">
                    <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a reply..." className="flex-1" />
                  </HelpTooltip>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                  <Button
                    onClick={() => {
                      if (!activeLeadId || !draft.trim()) return;
                      sendMessageMutation.mutate(
                        { leadId: activeLeadId, body: draft.trim() },
                        {
                          onSuccess: () => {
                            setDraft("");
                            // Immediately invalidate messages query to show new message
                            utils.leads.messages.invalidate({ leadId: activeLeadId });
                          },
                          onError: (error) => {
                            console.error("Failed to send message:", error);
                          },
                        }
                      );
                    }}
                    disabled={sendMessageMutation.isPending}
                  >
                    Send
                  </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Send this message as an SMS to the selected lead</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
