import { useEffect } from "react";

interface PageMeta {
  title: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  canonical?: string;
}

/**
 * Updates document title and meta tags for the current page.
 * OG tags in index.html serve as defaults for crawlers;
 * this hook updates them for client-side navigation.
 */
export function usePageMeta(meta: PageMeta): void {
  useEffect(() => {
    // Title
    document.title = meta.title;

    // Helper to set or create a meta tag
    const setMeta = (property: string, content: string, attr = "property") => {
      let el = document.querySelector(`meta[${attr}="${property}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    // Description
    if (meta.description) {
      setMeta("description", meta.description, "name");
    }

    // Open Graph
    setMeta("og:title", meta.ogTitle || meta.title);
    if (meta.ogDescription || meta.description) {
      setMeta("og:description", meta.ogDescription || meta.description || "");
    }
    if (meta.ogImage) {
      setMeta("og:image", meta.ogImage);
    }
    if (meta.ogUrl) {
      setMeta("og:url", meta.ogUrl);
    }

    // Twitter Card
    setMeta("twitter:title", meta.ogTitle || meta.title, "name");
    if (meta.ogDescription || meta.description) {
      setMeta("twitter:description", meta.ogDescription || meta.description || "", "name");
    }

    // Canonical
    if (meta.canonical) {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
      }
      link.setAttribute("href", meta.canonical);
    }
  }, [meta.title, meta.description, meta.ogTitle, meta.ogDescription, meta.ogImage, meta.ogUrl, meta.canonical]);
}
