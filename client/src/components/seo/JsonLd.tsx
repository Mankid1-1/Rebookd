interface JsonLdProps {
  data: Record<string, unknown>;
}

/**
 * Renders a JSON-LD structured data script tag.
 * Usage: <JsonLd data={{ "@context": "https://schema.org", ... }} />
 */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** Pre-built JSON-LD for the Rebooked organization */
export const REBOOKED_ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Rebooked",
  url: "https://rebooked.org",
  logo: "https://rebooked.org/logo.svg",
  contactPoint: {
    "@type": "ContactPoint",
    email: "rebooked@rebooked.org",
    contactType: "customer support",
  },
  sameAs: [],
};

/** Pre-built JSON-LD for the Rebooked software product */
export const REBOOKED_SOFTWARE = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Rebooked",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "AI-powered SMS revenue recovery platform for appointment-based businesses. Reduce no-shows, recover cancellations, and win back lapsed clients automatically.",
  offers: [
    {
      "@type": "Offer",
      name: "Founder Spot",
      price: "0",
      priceCurrency: "USD",
      description: "Free forever for founding clients — full platform access",
    },
    {
      "@type": "Offer",
      name: "Flex Spot",
      price: "199",
      priceCurrency: "USD",
      description: "$199/month + 15% revenue share after 35-day free trial",
    },
  ],
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    ratingCount: "12",
    bestRating: "5",
  },
};

/** Build FAQ JSON-LD from question/answer pairs */
export function buildFaqJsonLd(
  items: { question: string; answer: string }[]
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
