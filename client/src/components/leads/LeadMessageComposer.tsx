import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send } from "lucide-react";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface LeadMessageComposerProps {
  leadId: number;
  leadName: string;
}

const QUICK_REPLIES = [
  "Hi {{name}}, just checking in — still interested in booking?",
  "Hi {{name}}, we have great availability this week. Would you like to book?",
  "Hey {{name}}, just a friendly reminder about your upcoming appointment!",
  "Hi {{name}}, thanks for getting back to us! We'd love to help.",
];

export function LeadMessageComposer({ leadId, leadName }: LeadMessageComposerProps) {
  const [messageBody, setMessageBody] = useState("");
  const [tone, setTone] = useState<"friendly" | "professional" | "casual" | "urgent">("friendly");
  const [useAI, setUseAI] = useState(false);
  const [charCount, setCharCount] = useState(0);

  const utils = trpc.useUtils();

  useEffect(() => {
    setCharCount(messageBody.length);
  }, [messageBody]);

  const sendMessage = trpc.leads.sendMessage.useMutation({
    onMutate: async (input) => {
      const previous = utils.leads.messages.getData({ leadId: input.leadId });
      const optimistic = {
        id: -Date.now(),
        tenantId: 0,
        leadId: input.leadId,
        direction: "outbound" as const,
        body: input.body,
        status: "sent" as const,
        createdAt: new Date(),
        twilioSid: null as string | null,
        provider: null as string | null,
        providerError: null as string | null,
        fromNumber: null as string | null,
        toNumber: null as string | null,
      };
      utils.leads.messages.setData({ leadId: input.leadId }, (old) => [...(old ?? []), optimistic as any]);
      return { previous };
    },
    onError: (err, input, ctx) => {
      if (ctx?.previous !== undefined) {
        utils.leads.messages.setData({ leadId: input.leadId }, ctx.previous);
      }
      toast.error(err.message);
    },
    onSuccess: (data) => {
      if (!data.success) {
        toast.warning("Message saved — SMS delivery failed. Check Twilio config.");
      } else {
        toast.success("Message sent ✓");
      }
      setMessageBody("");
      setCharCount(0);
      utils.leads.messages.invalidate({ leadId });
      utils.leads.list.invalidate();
    },
  });

  const doSend = () => {
    if (!messageBody.trim() || sendMessage.isPending) return;
    sendMessage.mutate({ leadId, body: messageBody, tone });
  };

  const smsLimit = 160;
  const smsSegments = Math.ceil(charCount / smsLimit) || 1;

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4 space-y-3">
        {/* Quick replies placeholder logic */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">Quick start</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_REPLIES.slice(0, 2).map((qr) => (
              <button
                key={qr}
                className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-muted/30 hover:bg-muted/60 hover:border-primary/30 transition-all text-muted-foreground hover:text-foreground text-left"
                onClick={() => setMessageBody(qr.replace("{{name}}", leadName))}
              >
                {qr.replace("{{name}}", leadName).slice(0, 50)}…
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <Textarea
            placeholder="Type your message… (Ctrl+Enter to send)"
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            className="resize-none min-h-[80px] pr-16 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                doSend();
              }
            }}
          />
          <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground tabular-nums">
            {charCount > 0 && (
              <span className={charCount > 160 ? "text-yellow-400" : ""}>
                {charCount}/{smsLimit} · {smsSegments} SMS
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={tone} onValueChange={(v) => setTone(v as any)}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch id="useAI" checked={useAI} onCheckedChange={setUseAI} />
              <Label htmlFor="useAI" className="text-xs flex items-center gap-1 cursor-pointer">
                <Bot className="w-3.5 h-3.5 text-primary" /> AI rewrite
              </Label>
            </div>
          </div>
          <Button
            size="sm"
            disabled={!messageBody.trim() || sendMessage.isPending}
            onClick={doSend}
            className="shrink-0"
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            {sendMessage.isPending ? "Sending…" : "Send"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
