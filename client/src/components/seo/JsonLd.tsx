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
  sameAs: [
    "https://www.reddit.com/user/rebookd/",
    "https://www.instagram.com/rebookeddotorg/",
  ],
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

/** Build BreadcrumbList JSON-LD from ordered path items */
export function buildBreadcrumbJsonLd(
  items: { name: string; url: string }[]
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** Build Article JSON-LD for blog posts */
export function buildArticleJsonLd(opts: {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  image?: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.title,
    description: opts.description,
    url: opts.url,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified ?? opts.datePublished,
    image: opts.image ?? "https://rebooked.org/og-image.png",
    author: { "@type": "Organization", name: "Rebooked", url: "https://rebooked.org" },
    publisher: REBOOKED_ORGANIZATION,
  };
}

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
