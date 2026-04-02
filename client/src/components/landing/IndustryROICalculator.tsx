import { useState } from "react";
import { DollarSign, TrendingUp } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import type { IndustryConfig } from "@/data/industries";

interface IndustryROICalculatorProps {
  config: IndustryConfig;
}

export function IndustryROICalculator({ config }: IndustryROICalculatorProps) {
  const [avgValue, setAvgValue] = useState(config.avgAppointmentValue);
  const [noShows, setNoShows] = useState(config.defaultNoShows);
  const [cancellations, setCancellations] = useState(config.defaultCancellations);

  const noShowRecoveryRate = 0.40;
  const cancellationRebookRate = 0.55;

  const recoveredNoShows = Math.floor(noShows * noShowRecoveryRate);
  const recoveredCancellations = Math.floor(cancellations * cancellationRebookRate);
  const totalRecovered = recoveredNoShows + recoveredCancellations;
  const grossRevenue = totalRecovered * avgValue;
  const platformFee = 199;
  const revenueShare = grossRevenue * 0.15;
  const totalCost = platformFee + revenueShare;
  const netProfit = grossRevenue - totalCost;
  const roi = totalCost > 0 ? Math.round((netProfit / totalCost) * 100) : 0;

  const fmtCurrency = (v: number) =>
    v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <section className="py-20 px-6 bg-background">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-primary mb-3">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm font-semibold uppercase tracking-wider">See your numbers</span>
          </div>
          <h2 className="text-3xl font-bold text-foreground"
              style={{ fontFamily: "Space Grotesk, sans-serif", letterSpacing: "-0.02em" }}>
            How much revenue are you leaving on the table?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Adjust the sliders to match your {config.name.toLowerCase()} — see your potential recovery instantly.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Sliders */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-8">
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-medium text-foreground">
                  Average appointment value
                </label>
                <span className="text-sm font-bold text-primary">{fmtCurrency(avgValue)}</span>
              </div>
              <Slider
                min={20} max={500} step={5}
                value={[avgValue]}
                onValueChange={([v]) => setAvgValue(v)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>$20</span><span>$500</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-medium text-foreground">
                  No-shows per month
                </label>
                <span className="text-sm font-bold text-primary">{noShows}</span>
              </div>
              <Slider
                min={1} max={60} step={1}
                value={[noShows]}
                onValueChange={([v]) => setNoShows(v)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1</span><span>60</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-medium text-foreground">
                  Cancellations per month
                </label>
                <span className="text-sm font-bold text-primary">{cancellations}</span>
              </div>
              <Slider
                min={1} max={60} step={1}
                value={[cancellations]}
                onValueChange={([v]) => setCancellations(v)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1</span><span>60</span>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-4">
            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-semibold text-foreground">Monthly recovery estimate</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    No-shows recovered ({recoveredNoShows} x {fmtCurrency(avgValue)})
                  </span>
                  <span className="font-medium">{fmtCurrency(recoveredNoShows * avgValue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Cancellations rebooked ({recoveredCancellations} x {fmtCurrency(avgValue)})
                  </span>
                  <span className="font-medium">{fmtCurrency(recoveredCancellations * avgValue)}</span>
                </div>
                <div className="border-t border-primary/20 pt-3 flex justify-between font-bold">
                  <span>Gross recovered revenue</span>
                  <span className="text-primary">{fmtCurrency(grossRevenue)}</span>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Founder Spot cost</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">$0 forever</span>
                </div>
                <div className="border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground mb-2">Flex Spot cost (after 35-day free trial):</p>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platform fee</span>
                    <span>$199/mo</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">15% revenue share</span>
                    <span>{fmtCurrency(revenueShare)}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">Total cost</span>
                    <span>{fmtCurrency(totalCost)}</span>
                  </div>
                </div>
                <div className="flex justify-between font-bold text-base pt-1">
                  <span>Flex net profit</span>
                  <span className={netProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}>
                    {fmtCurrency(netProfit)}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Founder Spots keep 100% of recovered revenue. Flex Spots are free for 35 days — only pay if you see positive ROI.
              </p>
            </div>

            <div className="bg-primary rounded-2xl p-6 text-primary-foreground text-center">
              <div className="text-4xl font-bold mb-1" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                {roi > 0 ? `${roi}%` : "\u2014"}
              </div>
              <div className="text-sm opacity-90">Estimated monthly ROI</div>
              <div className="text-xs opacity-75 mt-2">
                Based on 40% no-show recovery and 55% cancellation rebook rate
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
