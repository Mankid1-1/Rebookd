import { build as viteBuild } from "vite";
import { build as esbuild } from "esbuild";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync, cpSync } from "fs";
import { join, resolve } from "path";

const root = resolve(process.cwd());
const tempDist = join(root, "dist-build");
const finalDist = join(root, "dist");

// Unique build ID — used by the live-update system to detect new deployments
const BUILD_VERSION = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
console.log(`Build version: ${BUILD_VERSION}`);

if (existsSync(tempDist)) {
  rmSync(tempDist, { recursive: true, force: true });
}
mkdirSync(tempDist, { recursive: true });

try {
  await viteBuild({
    configFile: resolve(root, "vite.config.ts"),
    build: { outDir: join(tempDist, "public"), emptyOutDir: true },
    define: {
      "globalThis.__BUILD_VERSION__": JSON.stringify(BUILD_VERSION),
    },
  });

  // Write version file for the live-update system
  writeFileSync(join(tempDist, "version.json"), JSON.stringify({ version: BUILD_VERSION, builtAt: new Date().toISOString() }));

  await esbuild({
    entryPoints: [resolve(root, "server/_core/index.ts")],
    platform: "node",
    packages: "external",
    bundle: true,
    format: "esm",
    outfile: join(tempDist, "index.js"),
    define: {
      "process.env.NODE_ENV": '"production"',
      "globalThis.__BUILD_VERSION__": JSON.stringify(BUILD_VERSION),
    },
    plugins: [{
      name: "exclude-vite-dev",
      setup(build) {
        // Replace vite dev server module with a production stub
        build.onResolve({ filter: /\/vite\.ts$/ }, (args) => {
          if (args.importer.includes("index.ts")) {
            return { path: args.path, namespace: "vite-stub" };
          }
        });
        build.onLoad({ filter: /.*/, namespace: "vite-stub" }, () => ({
          contents: `
            import express from "express";
            import fs from "fs";
            import path from "path";
            export async function setupVite() {}
            export function serveStatic(app) {
              const distPath = path.resolve(import.meta.dirname, "public");
              if (!fs.existsSync(distPath)) {
                console.error("Build directory not found:", distPath);
              }
              app.use(express.static(distPath));
              app.use("*", (_req, res) => {
                res.sendFile(path.resolve(distPath, "index.html"));
              });
            }
          `,
          loader: "js",
        }));
      },
    }],
  });

  await esbuild({
    entryPoints: [resolve(root, "server/worker.ts")],
    platform: "node",
    packages: "external",
    bundle: true,
    format: "esm",
    outfile: join(tempDist, "worker.js"),
    define: {
      "globalThis.__BUILD_VERSION__": JSON.stringify(BUILD_VERSION),
    },
  });

  await esbuild({
    entryPoints: [resolve(root, "server/sentinel.ts")],
    platform: "node",
    packages: "external",
    bundle: true,
    format: "esm",
    outfile: join(tempDist, "sentinel.js"),
    define: {
      "globalThis.__BUILD_VERSION__": JSON.stringify(BUILD_VERSION),
    },
  });

  // Windows file locks can prevent rename — use copy instead
  if (existsSync(finalDist)) {
    rmSync(finalDist, { recursive: true, force: true });
  }
  cpSync(tempDist, finalDist, { recursive: true });
  rmSync(tempDist, { recursive: true, force: true });
} catch (error) {
  rmSync(tempDist, { recursive: true, force: true });
  throw error;
}
