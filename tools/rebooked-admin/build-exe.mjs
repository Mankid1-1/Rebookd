#!/usr/bin/env node
/**
 * Build script for Rebooked Admin Console .exe
 *
 * Creates a standalone Windows executable that:
 *   1. Embeds the dashboard HTML directly into the JS source
 *   2. Bundles ESM → CJS via esbuild (pkg requires CommonJS)
 *   3. Packages with @yao-pkg/pkg into a single .exe
 *   4. Generates a launcher batch file and config template
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "dist");
const projectRoot = join(__dirname, "../..");

console.log("\n  Building Rebooked Admin Console .exe\n");
console.log("  Step 1/5: Preparing build directory...");

if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });

// Step 2: Read dashboard HTML and embed it into the console script
console.log("  Step 2/5: Embedding dashboard HTML...");

const dashboardHTML = readFileSync(join(__dirname, "dashboard.html"), "utf8");
const consoleScript = readFileSync(join(__dirname, "admin-console.mjs"), "utf8");

// Replace the fallback embedded dashboard with the real HTML
const withEmbeddedHTML = consoleScript.replace(
  'const EMBEDDED_DASHBOARD = "<!-- fallback -->";',
  `const EMBEDDED_DASHBOARD = ${JSON.stringify(dashboardHTML)};`
);

// Write the intermediate ESM file
const esmPath = join(distDir, "_admin-console-esm.mjs");
writeFileSync(esmPath, withEmbeddedHTML);
console.log("  Dashboard HTML embedded.");

// Step 3: Bundle ESM → CJS with esbuild (pkg only supports CommonJS)
console.log("  Step 3/5: Bundling ESM → CJS with esbuild...");

const cjsPath = join(distDir, "admin-console-bundled.cjs");
try {
  execSync(
    `npx esbuild "${esmPath}" --bundle --platform=node --format=cjs --outfile="${cjsPath}" --external:ssh2 --external:cpu-features`,
    { cwd: projectRoot, stdio: "inherit" }
  );
  console.log("  CJS bundle created.");
} catch (err) {
  console.error("\n  esbuild failed:", err.message);
  process.exit(1);
}

// Step 4: Run pkg to create the .exe
console.log("  Step 4/5: Compiling to .exe with pkg...");

try {
  execSync(
    `npx @yao-pkg/pkg "${cjsPath}" --targets node20-win-x64 --output "${join(distDir, "rebooked-admin.exe")}" --compress GZip`,
    { cwd: __dirname, stdio: "inherit" }
  );
  console.log("\n  .exe compiled successfully!");
} catch (err) {
  console.error("\n  Failed to compile .exe:", err.message);
  console.error("  Make sure @yao-pkg/pkg is installed: npm install -D @yao-pkg/pkg");
  process.exit(1);
}

// Step 5: Create companion files
console.log("  Step 5/5: Creating companion files...");

// Default config template
const configTemplate = {
  _comment: "Rebooked Admin Console — Connection Configuration",
  _instructions: "Fill in your VPS details below. The console will use these to connect.",
  host: "173.249.56.141",
  port: 3000,
  sshUser: "root",
  sshPassword: "",
  sshKeyPath: "",
  sshPort: 22,
  apiToken: "",
};

writeFileSync(
  join(distDir, "rebooked-admin-config.json"),
  JSON.stringify(configTemplate, null, 2)
);

// Launcher batch file
const launcherBat = `@echo off
title Rebooked Admin Console
echo.
echo   Starting Rebooked Admin Console...
echo   Your browser will open automatically.
echo   Keep this window open while using the console.
echo.
"%~dp0rebooked-admin.exe" %*
pause
`;
writeFileSync(join(distDir, "Start Rebooked Admin.bat"), launcherBat);

// README
const readme = `REBOOKED ADMIN CONSOLE v2.0
===========================

Quick Start:
  1. Double-click "Start Rebooked Admin.bat" (or run rebooked-admin.exe directly)
  2. Your browser opens to http://localhost:4896
  3. The console auto-detects your project .env for SSH credentials

Auto-Connect (recommended):
  Place this folder inside your Rebooked project, or run the .exe from the project root.
  It reads DEPLOY_SSH_HOST, DEPLOY_SSH_USER, DEPLOY_SSH_PASSWORD from your .env file.

Manual Config:
  Edit rebooked-admin-config.json next to the .exe with your VPS connection details.

Command Line:
  rebooked-admin.exe --host 1.2.3.4 --user root --password xxx
  rebooked-admin.exe --host 1.2.3.4 --user root --key C:\\path\\to\\id_rsa

Features:
  - Real-time server health monitoring (memory, uptime, CPU)
  - PM2 process management (reload, restart, view logs)
  - Zero-downtime deployment trigger
  - SSH connection testing
  - Auto-refreshing dashboard (5s intervals)
`;
writeFileSync(join(distDir, "README.txt"), readme);

// Copy ssh2 native module next to exe (pkg can't bundle native addons)
console.log("  Copying ssh2 native module...");
const nodeModulesSrc = join(__dirname, "node_modules");
const nodeModulesDst = join(distDir, "node_modules");
try {
  execSync(`xcopy "${join(nodeModulesSrc, "ssh2")}" "${join(nodeModulesDst, "ssh2")}\\" /E /I /Y /Q 2>nul`, { stdio: "pipe" });
  // Also copy ssh2's dependencies
  const ssh2Pkg = JSON.parse(readFileSync(join(nodeModulesSrc, "ssh2", "package.json"), "utf8"));
  for (const dep of Object.keys(ssh2Pkg.dependencies || {})) {
    const depSrc = join(nodeModulesSrc, dep);
    if (existsSync(depSrc)) {
      execSync(`xcopy "${depSrc}" "${join(nodeModulesDst, dep)}\\" /E /I /Y /Q 2>nul`, { stdio: "pipe" });
    }
  }
  // Copy cpu-features if it exists (optional ssh2 dep)
  const cpuFeatures = join(nodeModulesSrc, "cpu-features");
  if (existsSync(cpuFeatures)) {
    execSync(`xcopy "${cpuFeatures}" "${join(nodeModulesDst, "cpu-features")}\\" /E /I /Y /Q 2>nul`, { stdio: "pipe" });
  }
  console.log("  Native modules copied.");
} catch (e) {
  console.warn("  Warning: Could not copy ssh2 module — SSH features may not work in .exe");
  console.warn("  " + e.message);
}

console.log("\n  Build complete!\n");
console.log("  Output files:");
console.log("    " + join(distDir, "rebooked-admin.exe"));
console.log("    " + join(distDir, "node_modules/    (ssh2 native module)"));
console.log("    " + join(distDir, "Start Rebooked Admin.bat"));
console.log("    " + join(distDir, "rebooked-admin-config.json"));
console.log("    " + join(distDir, "README.txt"));
console.log("\n  To install: copy the entire dist/ folder wherever you like and run the .bat or .exe.\n");
