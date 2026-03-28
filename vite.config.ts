import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
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
            if (id.includes("react-dom") || id.includes("react/jsx") || id.includes("/react/")) return "vendor-react";
            if (id.includes("@radix-ui") || id.includes("class-variance-authority") || id.includes("clsx") || id.includes("tailwind-merge")) return "vendor-ui";
            if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
            if (id.includes("@stripe") || id.includes("stripe")) return "vendor-stripe";
            if (id.includes("framer-motion")) return "vendor-motion";
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
});
