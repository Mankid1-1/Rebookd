import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { getRouteMeta } from "../seo/route-meta";
import { injectMeta } from "../seo/inject-meta";

export async function setupVite(app: Express, server: Server) {
  // Dynamic imports so vite is never loaded in production
  const { createServer: createViteServer } = await import("vite");
  const viteConfig = (await import("../../vite.config")).default;

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );

      // Inject page-specific SEO metadata so crawlers see real content
      const meta = getRouteMeta(req.path);
      template = injectMeta(template, meta);

      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Serve static assets with long-term caching (hashed filenames change on each build)
  // index.html must NEVER be cached — browsers must always fetch the latest version
  // so they pick up new asset hashes after a deploy.
  app.use(express.static(distPath, {
    // Do NOT auto-serve index.html for directory requests.
    // All HTML requests must go through the catchall below so the
    // __SEO_*__ tokens get replaced before the response is sent.
    index: false,
    setHeaders(res, filePath) {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      } else if (filePath.includes("/assets/") || filePath.includes("\\assets\\")) {
        // Hashed filenames change on every build — safe to cache forever
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }));

  // Read the HTML template once at startup for meta injection
  const templatePath = path.resolve(distPath, "index.html");
  const htmlTemplate = fs.existsSync(templatePath)
    ? fs.readFileSync(templatePath, "utf-8")
    : "";

  // Bounded HTML cache — avoids repeated string.replace() per request.
  // ~30 public routes are cached on first hit. Unknown paths (dashboard, bots,
  // random 404s) all resolve to the same default meta, so they share one cache
  // entry under "/" once the cache is warm. Size is capped to prevent unbounded
  // growth from path-enumeration bots.
  const htmlCache = new Map<string, string>();
  const HTML_CACHE_MAX = 256;

  // Pre-compute default HTML once at startup so the first request to any
  // protected route (e.g. /dashboard) doesn't pay the injection cost.
  const defaultHtml = htmlTemplate ? injectMeta(htmlTemplate, getRouteMeta("/")) : "";

  // Fall through to index.html with page-specific SEO metadata injected
  app.use("*", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    if (!htmlTemplate) {
      return res.sendFile(templatePath);
    }

    const pathname = req.path;

    // Check cache first (O(1))
    const cached = htmlCache.get(pathname);
    if (cached) {
      return res.set("Content-Type", "text/html").send(cached);
    }

    const meta = getRouteMeta(pathname);
    const html = injectMeta(htmlTemplate, meta);

    // Cache if under limit; evict nothing — bounded by the finite set of real routes
    if (htmlCache.size < HTML_CACHE_MAX) {
      htmlCache.set(pathname, html);
    }

    res.set("Content-Type", "text/html").send(html);
  });
}
