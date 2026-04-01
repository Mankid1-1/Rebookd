import { AlertTriangle } from "lucide-react";
import type { IndustryConfig } from "@/data/industries";

interface IndustryPainPointsProps {
  config: IndustryConfig;
}

export function IndustryPainPoints({ config }: IndustryPainPointsProps) {
  return (
    <section className="py-20 px-6 bg-muted/40">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-destructive mb-3">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-semibold uppercase tracking-wider">Sound familiar?</span>
          </div>
          <h2 className="text-3xl font-bold text-foreground"
              style={{ fontFamily: "Space Grotesk, sans-serif", letterSpacing: "-0.02em" }}>
            The problems every {config.name.toLowerCase()} knows
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {config.painPoints.map((point, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2 leading-snug">
                    {point.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {point.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-muted-foreground text-sm">
            Rebooked fixes all of these automatically — before you even know they happened.
          </p>
        </div>
      </div>
    </section>
  );
}
