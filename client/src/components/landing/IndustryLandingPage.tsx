import { useEffect } from "react";
import type { IndustryConfig } from "@/data/industries";
import { IndustryHero } from "./IndustryHero";
import { IndustryPainPoints } from "./IndustryPainPoints";
import { IndustryROICalculator } from "./IndustryROICalculator";
import { IndustryFeatures } from "./IndustryFeatures";
import { IndustryTestimonials } from "./IndustryTestimonials";
import { IndustryCTA } from "./IndustryCTA";

interface IndustryLandingPageProps {
  config: IndustryConfig;
}

export function IndustryLandingPage({ config }: IndustryLandingPageProps) {
  useEffect(() => {
    document.title = config.metaTitle;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", config.metaDescription);
  }, [config]);

  return (
    <div className="min-h-screen bg-background">
      <IndustryHero config={config} />
      <IndustryPainPoints config={config} />
      <IndustryROICalculator config={config} />
      <IndustryFeatures config={config} />
      <IndustryTestimonials config={config} />
      <IndustryCTA config={config} />
    </div>
  );
}
