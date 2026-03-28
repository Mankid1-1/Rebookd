import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { getItem, setItem } from "@/utils/storage";
import {
  CheckCircle2,
  Circle,
  Building2,
  Phone,
  Zap,
  Users,
  PartyPopper,
  X,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const DISMISSED_KEY = "setup-checklist-dismissed";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  complete: boolean;
  icon: React.ReactNode;
  path: string;
}

export function SetupChecklist() {
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState(
    () => getItem<boolean>(DISMISSED_KEY) === true
  );

  const { data: tenant } = trpc.tenant.get.useQuery(undefined, { retry: false });
  const { data: dashboardData } = trpc.analytics.dashboard.useQuery(undefined, {
    retry: false,
  });

  if (dismissed || !tenant) return null;

  const metrics = dashboardData?.metrics;

  const items: ChecklistItem[] = [
    {
      id: "profile",
      label: "Business profile complete",
      description: "Set your business name and industry",
      complete: Boolean(tenant.name && tenant.industry),
      icon: <Building2 className="w-4 h-4" />,
      path: "/settings",
    },
    {
      id: "phone",
      label: "Phone number configured",
      description: "Add your business phone number",
      complete: Boolean((tenant as any).businessPhone || (tenant as any).twilioPhoneNumber),
      icon: <Phone className="w-4 h-4" />,
      path: "/settings",
    },
    {
      id: "automation",
      label: "First automation enabled",
      description: "Turn on an SMS automation",
      complete: (metrics?.automationCount ?? 0) > 0,
      icon: <Zap className="w-4 h-4" />,
      path: "/automations",
    },
    {
      id: "lead",
      label: "First lead added",
      description: "Add a lead to start recovering revenue",
      complete: (metrics?.leadCount ?? 0) > 0,
      icon: <Users className="w-4 h-4" />,
      path: "/leads",
    },
  ];

  const completedCount = items.filter((i) => i.complete).length;
  const allComplete = completedCount === items.length;
  const progressPercent = Math.round((completedCount / items.length) * 100);

  const handleDismiss = () => {
    setItem(DISMISSED_KEY, true);
    setDismissed(true);
  };

  if (allComplete) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <PartyPopper className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Setup complete!</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your Rebooked platform is fully configured and ready to recover revenue.
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={handleDismiss}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            Getting Started
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {completedCount} of {items.length} complete
          </span>
        </div>
        <Progress value={progressPercent} className="h-1.5 mt-2" />
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0">
        <div className="space-y-1">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setLocation(item.path)}
              className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
            >
              {item.complete ? (
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground/40 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    item.complete
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  }`}
                >
                  {item.label}
                </p>
                {!item.complete && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.description}
                  </p>
                )}
              </div>
              {item.complete ? (
                <span className="text-xs text-primary font-medium">Done</span>
              ) : (
                <span className="text-xs text-muted-foreground">{item.icon}</span>
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
