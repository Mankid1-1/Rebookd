/**
 * Dynamic Sitemap Generator
 *
 * Generates /sitemap.xml with:
 * - Static public pages
 * - Industry-specific landing pages
 * - Blog listing + individual blog posts
 */

import type { Express } from "express";

// Industry slugs — keep in sync with client/src/data/industries.ts
const INDUSTRY_SLUGS = [
  "salons",
  "dental",
  "clinics",
  "consultants",
  "fitness",
  "spa",
  "veterinary",
  "therapy",
];

// Blog post slugs + publish dates — keep in sync with client/src/data/blog.ts
const BLOG_POSTS = [
  { slug: "real-cost-of-no-shows", publishedAt: "2026-04-02" },
  { slug: "sms-templates-that-rebook-no-shows", publishedAt: "2026-04-02" },
  { slug: "why-cancellation-fees-dont-work", publishedAt: "2026-04-02" },
  { slug: "salon-recovered-2400-month", publishedAt: "2026-04-02" },
];

const STATIC_PAGES = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/blog", changefreq: "weekly", priority: "0.8" },
  { path: "/login", changefreq: "monthly", priority: "0.6" },
  { path: "/privacy", changefreq: "monthly", priority: "0.3" },
  { path: "/terms", changefreq: "monthly", priority: "0.3" },
  { path: "/tcpa", changefreq: "monthly", priority: "0.3" },
  { path: "/support", changefreq: "monthly", priority: "0.4" },
];

const BASE_URL = process.env.BASE_URL || "https://rebooked.org";

export function registerSitemapEndpoint(app: Express): void {
  app.get("/sitemap.xml", (_req, res) => {
    const today = new Date().toISOString().split("T")[0];

    const urls: string[] = [];

    // Static pages
    for (const page of STATIC_PAGES) {
      urls.push(`
  <url>
    <loc>${BASE_URL}${page.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`);
    }

    // Industry pages
    for (const slug of INDUSTRY_SLUGS) {
      urls.push(`
  <url>
    <loc>${BASE_URL}/for/${slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
    }

    // Blog posts
    for (const post of BLOG_POSTS) {
      urls.push(`
  <url>
    <loc>${BASE_URL}/blog/${post.slug}</loc>
    <lastmod>${post.publishedAt}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("")}
</urlset>`;

    res.set("Content-Type", "application/xml");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(xml);
  });
}
