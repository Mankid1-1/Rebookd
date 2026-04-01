import { Quote } from "lucide-react";
import type { IndustryConfig } from "@/data/industries";

interface IndustryTestimonialsProps {
  config: IndustryConfig;
}

export function IndustryTestimonials({ config }: IndustryTestimonialsProps) {
  if (!config.testimonials.length) return null;

  return (
    <section className="py-20 px-6 bg-background">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground"
              style={{ fontFamily: "Space Grotesk, sans-serif", letterSpacing: "-0.02em" }}>
            {config.namePlural} are recovering real revenue
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {config.testimonials.map((t, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-2xl p-6 relative"
            >
              <Quote className="absolute top-4 right-4 h-8 w-8 text-primary/15" />
              <p className="text-foreground leading-relaxed mb-6 italic">
                "{t.quote}"
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-foreground text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.business}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                    {t.result}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
