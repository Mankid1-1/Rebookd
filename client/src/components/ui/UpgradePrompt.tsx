import { ArrowUpRight } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import { useLocation } from "wouter";

interface UpgradePromptProps {
  feature: string;
  currentPlan: string;
  requiredPlan: string;
  message?: string;
}

export function UpgradePrompt({ feature, currentPlan, requiredPlan, message }: UpgradePromptProps) {
  const [, navigate] = useLocation();

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="flex items-center justify-between p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {feature} requires the <span className="font-bold capitalize">{requiredPlan}</span> plan
          </p>
          <p className="text-xs text-muted-foreground">
            {message ?? `You're on the ${currentPlan} plan. Upgrade to unlock this feature.`}
          </p>
        </div>
        <Button size="sm" onClick={() => navigate("/billing")} className="shrink-0 ml-4">
          Upgrade <ArrowUpRight className="h-3 w-3 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}

interface UsageMeterProps {
  label: string;
  used: number;
  limit: number;
  unit?: string;
}

export function UsageMeter({ label, used, limit, unit = "" }: UsageMeterProps) {
  const percentage = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const isNearLimit = percentage >= 80;
  const isOverLimit = percentage >= 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={isOverLimit ? "text-destructive font-medium" : isNearLimit ? "text-warning font-medium" : ""}>
          {used.toLocaleString()}{unit} / {limit.toLocaleString()}{unit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isOverLimit ? "bg-destructive" : isNearLimit ? "bg-warning" : "bg-primary"
          }`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
      {isNearLimit && !isOverLimit && (
        <p className="text-xs text-warning">
          Approaching limit — consider upgrading for more capacity
        </p>
      )}
    </div>
  );
}
