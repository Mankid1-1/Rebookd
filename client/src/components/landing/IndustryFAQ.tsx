import type { IndustryConfig } from "@/data/industries";
import { JsonLd, buildFaqJsonLd } from "@/components/seo/JsonLd";

interface IndustryFAQProps {
  config: IndustryConfig;
}

export function IndustryFAQ({ config }: IndustryFAQProps) {
  if (!config.faq || !config.faq.length) return null;

  return (
    <section className="py-20 px-6 bg-background">
      <JsonLd data={buildFaqJsonLd(config.faq)} />
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2
            className="text-3xl font-bold text-foreground"
            style={{ fontFamily: "Space Grotesk, sans-serif", letterSpacing: "-0.02em" }}
          >
            Frequently Asked Questions About Rebooked for {config.namePlural}
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            Everything you need to know about how Rebooked helps {config.namePlural.toLowerCase()} recover lost revenue automatically.
          </p>
        </div>

        <div className="space-y-4">
          {config.faq.map((item, i) => (
            <details
              key={i}
              className="group rounded-lg border border-border/50 bg-card"
            >
              <summary className="flex items-center justify-between cursor-pointer p-4 font-medium text-foreground [&::-webkit-details-marker]:hidden list-none">
                {item.question}
                <span className="ml-4 flex-shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180">
                  &#9662;
                </span>
              </summary>
              <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
                <p>{item.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
