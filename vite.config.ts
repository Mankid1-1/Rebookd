import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const config = {
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // ── Specific libs first (before broad React patterns) ──
            if (id.includes("@sentry")) return "vendor-sentry";
            if (id.includes("@tanstack") || id.includes("@trpc") || id.includes("superjson")) return "vendor-query";
            if (id.includes("lucide-react")) return "vendor-icons";
            if (id.includes("date-fns") || id.includes("react-day-picker")) return "vendor-date";
            if (id.includes("recharts") || id.includes("d3-") || id.includes("react-smooth") || id.includes("lodash")) return "vendor-charts";
            if (id.includes("@stripe") || id.includes("stripe")) return "vendor-stripe";
            if (id.includes("framer-motion")) return "vendor-motion";
            // ── UI framework — Radix primitives + small utils shared across pages ──
            if (
              id.includes("@radix-ui") || id.includes("@floating-ui") ||
              id.includes("class-variance-authority") || id.includes("clsx") ||
              id.includes("tailwind-merge") || id.includes("node_modules/sonner/")
            ) return "vendor-ui";
            // ── React core last — precise paths to avoid catching @sentry/react, @floating-ui/react-dom, etc. ──
            if (
              id.includes("node_modules/react-dom/") ||
              id.includes("node_modules/react/") ||
              id.includes("node_modules/scheduler/")
            ) return "vendor-react";
          }
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: ["localhost", "127.0.0.1"],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./client/src/test-setup.ts"],
    include: [
      "../shared/**/*.test.ts",
      "../server/**/*.test.ts",
      "./src/**/*.test.{ts,tsx}",
    ],
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
    env: {
      ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    },
  },
};

// Cast required because vitest extends vite config with 'test' property
export default defineConfig(config as any);
