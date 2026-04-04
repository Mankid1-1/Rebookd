/**
 * Server-side meta tag injection.
 *
 * Replaces __SEO_*__ tokens in the HTML template with page-specific
 * metadata so that search engine crawlers see real titles, descriptions,
 * and JSON-LD on the very first response — no JavaScript execution needed.
 */

import type { RouteMeta } from "./route-meta";

/**
 * Inject SEO metadata into the HTML template by replacing placeholder tokens.
 */
export function injectMeta(template: string, meta: RouteMeta): string {
  // Build JSON-LD script tags
  const jsonLdHtml = meta.jsonLd
    .map(
      (schema) =>
        `<script type="application/ld+json">${JSON.stringify(schema)}</script>`
    )
    .join("\n    ");

  return template
    .replace("__SEO_TITLE__", escapeHtml(meta.title))
    .replace(/__SEO_DESC__/g, escapeAttr(meta.description))
    .replace(/__SEO_OG_TITLE__/g, escapeAttr(meta.ogTitle))
    .replace(/__SEO_OG_DESC__/g, escapeAttr(meta.ogDesc))
    .replace("__SEO_OG_URL__", escapeAttr(meta.ogUrl))
    .replace("__SEO_OG_IMAGE__", escapeAttr(meta.ogImage))
    .replace("__SEO_CANONICAL__", escapeAttr(meta.canonical))
    .replace("<!-- __SEO_JSONLD__ -->", jsonLdHtml);
}

/** Escape characters that would break HTML attribute values */
function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Escape characters that would break HTML text content (e.g. <title>) */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
