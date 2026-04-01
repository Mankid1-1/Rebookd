import { memo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { Settings2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import type { AutomationTemplate, AutomationCategory } from "./types";

const CATEGORY_CONFIG: Record<AutomationCategory, { label: string; bg: string }> = {
  appointment: { label: "Appointment", bg: "bg-success/15 text-success border-success/30" },
  no_show: { label: "No-Show", bg: "bg-destructive/15 text-destructive border-destructive/30" },
  cancellation: { label: "Cancellation", bg: "bg-warning/15 text-warning border-warning/30" },
  follow_up: { label: "Follow-Up", bg: "bg-info/15 text-info border-info/30" },
  reactivation: { label: "Re-Engagement", bg: "bg-accent/15 text-accent-foreground border-accent/30" },
  welcome: { label: "Welcome", bg: "bg-warning/15 text-warning border-warning/30" },
  loyalty: { label: "Loyalty", bg: "bg-primary/15 text-primary border-primary/30" },
};

const PLAN_BADGE: Record<string, string> = {
  starter: "bg-muted/20 text-muted-foreground border-muted-foreground/30",
  growth: "bg-info/20 text-info border-info/30",
  scale: "bg-accent/20 text-accent-foreground border-accent/30",
};

interface AutomationRowProps {
  template: AutomationTemplate;
  saved?: { id?: number; enabled: boolean; runCount: number; errorCount?: number; config?: Record<string, string | number> };
  onToggle: (enabled: boolean) => void;
  onConfigure: () => void;
  isToggling?: boolean;
}

export const AutomationRow = memo(function AutomationRow({
  template,
  saved,
  onToggle,
  onConfigure,
  isToggling,
}: AutomationRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const testMutation = trpc.automations.test.useMutation({
    onSuccess: () => {
      setTestPhone("");
      toast.success("Test automation sent");
    },
    onError: (err: { message: string }) => {
      toast.error(err.message);
    },
  });

  const Icon = template.icon;
  const isEnabled = saved?.enabled ?? false;
  const cat = CATEGORY_CONFIG[template.category];

  return (
    <Card className={`border transition-all ${isEnabled ? "border-primary/20 bg-card" : "border-border bg-card/60"}`}>
      <CardContent className="p-0">
        <div className="flex items-center gap-4 p-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isEnabled ? "bg-primary/10" : "bg-muted"}`}>
            <Icon className={`w-4 h-4 ${isEnabled ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{template.name}</span>
              {template.recommended && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-warning/10 text-warning border-warning/30">Recommended</Badge>
                    </TooltipTrigger>
                    <TooltipContent><p>Expected revenue recovery impact based on industry benchmarks</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cat.bg}`}>{cat.label}</Badge>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PLAN_BADGE[template.planRequired]}`}>{template.planRequired}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{template.description}</p>
            {saved && (
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                Ran {saved.runCount} times{saved.errorCount ? ` · ${saved.errorCount} errors` : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant={saved ? "ghost" : "outline"}
              size="sm"
              className={saved ? "h-8 w-8 p-0 text-muted-foreground hover:text-foreground" : "h-8 px-2.5 text-xs text-primary border-primary/30 hover:bg-primary/5"}
              onClick={onConfigure}
              aria-label={`Configure ${template.name}`}
            >
              {saved ? <Settings2 className="w-3.5 h-3.5" /> : <><Settings2 className="w-3 h-3 mr-1" />Configure</>}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground" onClick={() => setExpanded(!expanded)} aria-label={expanded ? "Collapse details" : "Expand details"}>
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <span className="text-xs text-muted-foreground">{isToggling ? "..." : isEnabled ? "On" : "Off"}</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Switch checked={isEnabled} onCheckedChange={onToggle} disabled={isToggling} aria-label={`Toggle ${template.name}`} />
                  </TooltipTrigger>
                  <TooltipContent><p>Toggle this automation on or off. When on, messages are sent automatically.</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
        {expanded && (
          <div className="px-4 pb-4 border-t border-border/50 pt-3">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Default message preview</p>
              <p className="text-xs text-foreground/80 leading-relaxed">{template.defaultMessage}</p>
            </div>
            {saved?.config && Object.keys(saved.config).filter(k => k !== "message").length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(saved.config).filter(([k]) => k !== "message").map(([k, v]) => (
                  <div key={k} className="flex items-center gap-1 bg-muted/50 rounded px-2 py-1 text-xs">
                    <span className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1").toLowerCase()}:</span>
                    <span className="font-medium">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Test this automation</p>
              <div className="flex gap-2">
                <Input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="Phone (e.g. +15551112222)"
                  className="text-xs"
                />
                <Button
                  size="sm"
                  disabled={!testPhone || !saved?.id || testMutation.isPending}
                  onClick={() => {
                    if (!saved?.id || !testPhone) return;
                    testMutation.mutate({ automationId: saved.id, testPhone: testPhone.trim() });
                  }}
                >
                  {testMutation.isPending ? "Sending..." : "Send Test"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
