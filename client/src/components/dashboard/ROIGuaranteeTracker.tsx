import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { Shield, TrendingUp, Clock, Users } from "lucide-react";

// Theme-aware colors via CSS variables
const GOLD = "hsl(var(--primary))";
const GOLD_BG = "hsl(var(--primary) / 0.08)";
const GOLD_BORDER = "hsl(var(--primary) / 0.2)";

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(n);
}

export default function ROIGuaranteeTracker() {
  const { data, isLoading } = (trpc.billing as any).roiGuarantee.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  }) as { data: any; isLoading: boolean };

  if (isLoading || !data) return null;

  const roiClamped = Math.min(100, Math.max(0, data.roiPercent));
  const guaranteeDays = 35;

  return (
    <Card
      className="border bg-card/80 backdrop-blur-sm"
      style={{ borderColor: GOLD_BORDER }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4" style={{ color: GOLD }} />
            <span>ROI Guarantee</span>
          </CardTitle>
          <Badge
            variant="outline"
            className="text-xs font-medium"
            style={{
              color: data.guaranteeActive ? GOLD : "hsl(var(--success))",
              borderColor: data.guaranteeActive ? GOLD_BORDER : "hsl(var(--success) / 0.2)",
              backgroundColor: data.guaranteeActive ? GOLD_BG : "hsl(var(--success) / 0.08)",
            }}
          >
            {data.guaranteeActive ? "Guarantee Active" : "ROI Positive"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ROI Progress */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">ROI Progress</span>
            <span className="font-mono font-medium" style={{ color: GOLD }}>
              {data.roiPercent}%
            </span>
          </div>
          <Progress
            value={roiClamped}
            className="h-2 [&>div]:transition-all"
            style={{
              // @ts-expect-error CSS custom property
              "--progress-foreground": data.hasPositiveRoi ? "hsl(var(--success))" : GOLD,
            }}
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            {data.hasPositiveRoi
              ? "You've hit positive ROI - my promise delivered."
              : `I guarantee positive ROI within ${guaranteeDays} days or it's free.`}
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
              <TrendingUp className="w-3 h-3" />
              <span className="text-[10px] uppercase tracking-wider">Recovered</span>
            </div>
            <p className="text-sm font-semibold">{fmtUSD(data.recoveredRevenue)}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
              <Clock className="w-3 h-3" />
              <span className="text-[10px] uppercase tracking-wider">Net Savings</span>
            </div>
            <p className="text-sm font-semibold">{fmtUSD(data.netSavings)}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
              <Users className="w-3 h-3" />
              <span className="text-[10px] uppercase tracking-wider">Slots Left</span>
            </div>
            <p className="text-sm font-semibold">{data.slotsRemaining}</p>
          </div>
        </div>

        {/* Founder badge */}
        {data.isFounder && (
          <div
            className="rounded-md px-3 py-2 text-xs text-center"
            style={{ backgroundColor: GOLD_BG, color: GOLD }}
          >
            <Shield className="w-3 h-3 inline mr-1" />
            Founder Client — free forever, revenue share only
          </div>
        )}
      </CardContent>
    </Card>
  );
}
