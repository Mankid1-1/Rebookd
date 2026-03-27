import { build as viteBuild } from "vite";
import { build as esbuild } from "esbuild";
import { existsSync, mkdirSync, renameSync, rmSync } from "fs";
import { join, resolve } from "path";

const root = resolve(process.cwd());
const tempDist = join(root, "dist-build");
const finalDist = join(root, "dist");

if (existsSync(tempDist)) {
  rmSync(tempDist, { recursive: true, force: true });
}
mkdirSync(tempDist, { recursive: true });

try {
  await viteBuild({
    configFile: resolve(root, "vite.config.ts"),
    build: { outDir: join(tempDist, "public"), emptyOutDir: true },
  });

  await esbuild({
    entryPoints: [resolve(root, "server/_core/index.ts")],
    platform: "node",
    packages: "external",
    bundle: true,
    format: "esm",
    outfile: join(tempDist, "index.js"),
    define: {
      "process.env.NODE_ENV": '"production"',
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
  });

  if (existsSync(finalDist)) {
    rmSync(finalDist, { recursive: true, force: true });
  }
  renameSync(tempDist, finalDist);
} catch (error) {
  rmSync(tempDist, { recursive: true, force: true });
  throw error;
}
