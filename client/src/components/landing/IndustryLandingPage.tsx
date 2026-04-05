import { useEffect } from "react";
import type { IndustryConfig } from "@/data/industries";
import { IndustryHero } from "./IndustryHero";
import { IndustryPainPoints } from "./IndustryPainPoints";
import { IndustryROICalculator } from "./IndustryROICalculator";
import { IndustryFeatures } from "./IndustryFeatures";
import { IndustryTestimonials } from "./IndustryTestimonials";
import { IndustryCTA } from "./IndustryCTA";
import { IndustryFAQ } from "./IndustryFAQ";
import { RelatedIndustries } from "./RelatedIndustries";
import { RelatedBlogPosts } from "./RelatedBlogPosts";
import { usePageMeta } from "@/hooks/usePageMeta";
import { JsonLd, REBOOKED_ORGANIZATION, buildBreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { trackFunnelEvent } from "@/lib/funnelEvents";

interface IndustryLandingPageProps {
  config: IndustryConfig;
}

export function IndustryLandingPage({ config }: IndustryLandingPageProps) {
  usePageMeta({
    title: config.metaTitle,
    description: config.metaDescription,
    ogUrl: `https://rebooked.org/for/${config.slug}`,
    canonical: `https://rebooked.org/for/${config.slug}`,
  });

  useEffect(() => {
    trackFunnelEvent("page_view_industry", { industry: config.slug });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <JsonLd data={REBOOKED_ORGANIZATION} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": config.metaTitle,
        "description": config.metaDescription,
        "url": `https://rebooked.org/for/${config.slug}`,
        "isPartOf": { "@type": "WebSite", "name": "Rebooked", "url": "https://rebooked.org" },
      }} />
      <JsonLd data={buildBreadcrumbJsonLd([
        { name: "Rebooked", url: "https://rebooked.org/" },
        { name: config.namePlural, url: `https://rebooked.org/for/${config.slug}` },
      ])} />
      <IndustryHero config={config} />
      <IndustryPainPoints config={config} />
      <IndustryROICalculator config={config} />
      <IndustryFeatures config={config} />
      <IndustryTestimonials config={config} />
      {config.faq && config.faq.length > 0 && <IndustryFAQ config={config} />}
      <RelatedBlogPosts industrySlug={config.slug} />
      <RelatedIndustries currentSlug={config.slug} />
      <IndustryCTA config={config} />
    </div>
  );
}
