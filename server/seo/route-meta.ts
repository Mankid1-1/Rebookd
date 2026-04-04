/**
 * Server-side SEO route metadata map.
 *
 * Imports industry and blog data from the client data files (pure TS, no React)
 * to keep a single source of truth. The server injects this metadata into the
 * HTML template before sending it to crawlers, so Google sees page-specific
 * titles, descriptions, and JSON-LD in the initial response.
 */

import { INDUSTRIES } from "../../client/src/data/industries";
import { BLOG_POSTS } from "../../client/src/data/blog";

const BASE = "https://rebooked.org";

// ── JSON-LD helpers (server-side equivalents of client JsonLd.tsx) ───────────

const ORGANIZATION_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Rebooked",
  url: BASE,
  logo: `${BASE}/logo.svg`,
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

const SOFTWARE_JSONLD = {
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
      description:
        "Free forever for founding clients — full platform access",
    },
    {
      "@type": "Offer",
      name: "Flex Spot",
      price: "199",
      priceCurrency: "USD",
      description:
        "$199/month + 15% revenue share after 35-day free trial",
    },
  ],
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    ratingCount: "12",
    bestRating: "5",
  },
};

function breadcrumb(items: { name: string; url: string }[]) {
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

function faqSchema(items: { question: string; answer: string }[]) {
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

function articleSchema(opts: {
  title: string;
  description: string;
  url: string;
  datePublished: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.title,
    description: opts.description,
    url: opts.url,
    datePublished: opts.datePublished,
    dateModified: opts.datePublished,
    image: `${BASE}/og-image.png`,
    author: {
      "@type": "Organization",
      name: "Rebooked",
      url: BASE,
    },
    publisher: ORGANIZATION_JSONLD,
  };
}

// ── Route metadata type ─────────────────────────────────────────────────────

export interface RouteMeta {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDesc: string;
  ogUrl: string;
  ogImage: string;
  jsonLd: Record<string, unknown>[];
}

// ── Default / fallback metadata (homepage) ──────────────────────────────────

const DEFAULT_META: RouteMeta = {
  title: "Rebooked — AI-Powered SMS Revenue Recovery for Appointment Businesses",
  description:
    "Reduce no-shows, recover cancellations, and win back lapsed clients automatically. AI-powered SMS re-engagement with a 35-day ROI guarantee.",
  canonical: `${BASE}/`,
  ogTitle: "Rebooked — AI-Powered SMS Revenue Recovery",
  ogDesc:
    "Reduce no-shows, recover cancellations, and win back lapsed clients automatically. 35-day ROI guarantee for appointment businesses.",
  ogUrl: BASE,
  ogImage: `${BASE}/og-image.png`,
  jsonLd: [ORGANIZATION_JSONLD, SOFTWARE_JSONLD],
};

// ── Static route map ────────────────────────────────────────────────────────

const staticRoutes: Record<string, RouteMeta> = {
  "/": DEFAULT_META,

  "/blog": {
    title: "Blog — Rebooked | SMS Recovery Tips, Case Studies & Industry Insights",
    description:
      "Tips, case studies, and industry insights on reducing no-shows and recovering revenue with automated SMS for appointment businesses.",
    canonical: `${BASE}/blog`,
    ogTitle: "Rebooked Blog — SMS Recovery Tips & Case Studies",
    ogDesc:
      "Tips, case studies, and industry insights on reducing no-shows and recovering revenue with automated SMS.",
    ogUrl: `${BASE}/blog`,
    ogImage: `${BASE}/og-image.png`,
    jsonLd: [ORGANIZATION_JSONLD],
  },

  "/login": {
    title: "Log In — Rebooked",
    description: "Log in to your Rebooked dashboard to manage SMS automations, view analytics, and recover revenue.",
    canonical: `${BASE}/login`,
    ogTitle: "Log In — Rebooked",
    ogDesc: "Access your Rebooked dashboard.",
    ogUrl: `${BASE}/login`,
    ogImage: `${BASE}/og-image.png`,
    jsonLd: [],
  },

  "/privacy": {
    title: "Privacy Policy — Rebooked",
    description: "Rebooked's privacy policy. How we collect, use, and protect your data.",
    canonical: `${BASE}/privacy`,
    ogTitle: "Privacy Policy — Rebooked",
    ogDesc: "How Rebooked collects, uses, and protects your data.",
    ogUrl: `${BASE}/privacy`,
    ogImage: `${BASE}/og-image.png`,
    jsonLd: [ORGANIZATION_JSONLD],
  },

  "/terms": {
    title: "Terms of Service — Rebooked",
    description: "Rebooked's terms of service for the AI-powered SMS revenue recovery platform.",
    canonical: `${BASE}/terms`,
    ogTitle: "Terms of Service — Rebooked",
    ogDesc: "Terms of service for the Rebooked platform.",
    ogUrl: `${BASE}/terms`,
    ogImage: `${BASE}/og-image.png`,
    jsonLd: [ORGANIZATION_JSONLD],
  },

  "/tcpa": {
    title: "TCPA Compliance — Rebooked",
    description: "How Rebooked ensures full TCPA compliance for every SMS sent. Prior express consent, opt-out handling, and quiet hours built in.",
    canonical: `${BASE}/tcpa`,
    ogTitle: "TCPA Compliance — Rebooked",
    ogDesc: "Full TCPA compliance for every SMS. Prior express consent, opt-out handling, and quiet hours built in.",
    ogUrl: `${BASE}/tcpa`,
    ogImage: `${BASE}/og-image.png`,
    jsonLd: [ORGANIZATION_JSONLD],
  },

  "/support": {
    title: "Support — Rebooked",
    description: "Get help with Rebooked. Contact support, browse FAQs, and find answers to common questions.",
    canonical: `${BASE}/support`,
    ogTitle: "Support — Rebooked",
    ogDesc: "Get help with Rebooked. Contact support and browse FAQs.",
    ogUrl: `${BASE}/support`,
    ogImage: `${BASE}/og-image.png`,
    jsonLd: [ORGANIZATION_JSONLD],
  },
};

// ── Build dynamic routes from client data ───────────────────────────────────

// Industry pages: /for/:slug
const industryRoutes: Record<string, RouteMeta> = {};
for (const [slug, cfg] of Object.entries(INDUSTRIES)) {
  industryRoutes[`/for/${slug}`] = {
    title: cfg.metaTitle,
    description: cfg.metaDescription,
    canonical: `${BASE}/for/${slug}`,
    ogTitle: cfg.metaTitle,
    ogDesc: cfg.metaDescription,
    ogUrl: `${BASE}/for/${slug}`,
    ogImage: `${BASE}/og-image.png`,
    jsonLd: [
      ORGANIZATION_JSONLD,
      breadcrumb([
        { name: "Home", url: BASE },
        { name: cfg.namePlural, url: `${BASE}/for/${slug}` },
      ]),
      ...(cfg.faq?.length ? [faqSchema(cfg.faq)] : []),
    ],
  };
}

// Blog posts: /blog/:slug
const blogRoutes: Record<string, RouteMeta> = {};
for (const post of BLOG_POSTS) {
  const url = `${BASE}/blog/${post.slug}`;
  blogRoutes[`/blog/${post.slug}`] = {
    title: post.metaTitle,
    description: post.metaDescription,
    canonical: url,
    ogTitle: post.metaTitle,
    ogDesc: post.metaDescription,
    ogUrl: url,
    ogImage: `${BASE}/og-image.png`,
    jsonLd: [
      ORGANIZATION_JSONLD,
      breadcrumb([
        { name: "Home", url: BASE },
        { name: "Blog", url: `${BASE}/blog` },
        { name: post.title, url },
      ]),
      articleSchema({
        title: post.title,
        description: post.metaDescription,
        url,
        datePublished: post.publishedAt,
      }),
    ],
  };
}

// ── Lookup function ─────────────────────────────────────────────────────────

const allRoutes: Record<string, RouteMeta> = {
  ...staticRoutes,
  ...industryRoutes,
  ...blogRoutes,
};

/**
 * Look up SEO metadata for a given URL path.
 * Returns page-specific metadata if the route is a known public page,
 * or the default homepage metadata as a fallback (for dashboard routes, etc.).
 */
export function getRouteMeta(pathname: string): RouteMeta {
  // Normalize: strip trailing slash (except root)
  const normalized =
    pathname !== "/" && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  return allRoutes[normalized] ?? DEFAULT_META;
}
