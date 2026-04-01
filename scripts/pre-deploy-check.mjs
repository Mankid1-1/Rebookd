/**
 * Pre-deployment checklist for Rebooked.
 *
 * Runs a series of checks before deploying to production:
 *   1. Environment variables - critical vars are set
 *   2. Build - project compiles without errors
 *   3. Security scan - no hardcoded secrets in source
 *   4. Git status - branch info and uncommitted changes warning
 *
 * Usage:
 *   node scripts/pre-deploy-check.mjs
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const results = [];

function pass(name, detail) {
  results.push({ name, status: 'PASS', detail });
  console.log(`  PASS  ${name}${detail ? ' - ' + detail : ''}`);
}

function fail(name, detail) {
  results.push({ name, status: 'FAIL', detail });
  console.log(`  FAIL  ${name}${detail ? ' - ' + detail : ''}`);
}

function warn(name, detail) {
  results.push({ name, status: 'WARN', detail });
  console.log(`  WARN  ${name}${detail ? ' - ' + detail : ''}`);
}

// ── 1. Environment variable check ──────────────────────────────────────────

console.log('\n=== Check 1/4: Environment Variables ===\n');

const requiredEnvGroups = [
  {
    name: 'SSH credentials',
    vars: ['DEPLOY_SSH_PASSWORD', 'DEPLOY_SSH_KEY_PATH'],
    requireAny: true,
  },
  { name: 'DATABASE_URL', vars: ['DATABASE_URL'] },
  { name: 'STRIPE_SECRET_KEY', vars: ['STRIPE_SECRET_KEY'] },
  { name: 'JWT_SECRET', vars: ['JWT_SECRET'] },
];

for (const group of requiredEnvGroups) {
  if (group.requireAny) {
    const found = group.vars.filter((v) => process.env[v]);
    if (found.length > 0) {
      pass(group.name, `set via ${found.join(', ')}`);
    } else {
      fail(group.name, `need at least one of: ${group.vars.join(', ')}`);
    }
  } else {
    const varName = group.vars[0];
    if (process.env[varName]) {
      pass(group.name, 'set');
    } else {
      fail(group.name, 'not set');
    }
  }
}

// ── 2. Build check ─────────────────────────────────────────────────────────

console.log('\n=== Check 2/4: Build ===\n');

try {
  execSync('pnpm build', { cwd: root, stdio: 'pipe' });
  pass('pnpm build', 'completed successfully');
} catch (e) {
  const stderr = e.stderr ? e.stderr.toString().split('\n').slice(0, 5).join('\n') : 'unknown error';
  fail('pnpm build', `failed:\n${stderr}`);
}

// ── 3. Security scan ───────────────────────────────────────────────────────

console.log('\n=== Check 3/4: Security Scan ===\n');

// 3a. Check that .env files are not tracked by git
const trackedFiles = execSync('git ls-files', { cwd: root, encoding: 'utf8' }).split('\n');
const trackedEnvFiles = trackedFiles.filter(
  (f) => f.match(/^\.env$/) || f.match(/^\.env\.local$/)
);

if (trackedEnvFiles.length > 0) {
  fail('Tracked .env files', `these should not be committed: ${trackedEnvFiles.join(', ')}`);
} else {
  pass('No .env/.env.local tracked in git');
}

// 3b. Scan key source files for hardcoded passwords/secrets
const filesToScan = [
  'scripts/deploy-live.mjs',
  'scripts/pre-deploy-check.mjs',
  'server/_core/env.ts',
  'server/_core/security.ts',
  'server/_core/oauth.ts',
  'ecosystem.config.cjs',
];

const secretPatterns = [
  // Match common secret patterns but not references to env vars or comments
  /password\s*[:=]\s*['"][^'"]{4,}['"]/i,
  /secret\s*[:=]\s*['"][^'"]{4,}['"]/i,
  /api[_-]?key\s*[:=]\s*['"][^'"]{4,}['"]/i,
  /sk_live_[a-zA-Z0-9]+/,
  /sk_test_[a-zA-Z0-9]+/,
];

// Lines containing these patterns are false positives (env references, comments, etc.)
const falsePositivePatterns = [
  /process\.env\./,
  /\/\//,
  /\/\*/,
  /\*\//,
  /DEPLOY_SSH_PASSWORD/,
  /['"]STRIPE_SECRET_KEY['"]/,
  /['"]JWT_SECRET['"]/,
];

let secretsFound = false;

for (const relPath of filesToScan) {
  const fullPath = join(root, relPath);
  if (!existsSync(fullPath)) continue;

  const content = readFileSync(fullPath, 'utf8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip lines that are clearly env var references or comments
    if (falsePositivePatterns.some((p) => p.test(line))) continue;

    for (const pattern of secretPatterns) {
      if (pattern.test(line)) {
        fail('Hardcoded secret', `${relPath}:${i + 1} matches ${pattern}`);
        secretsFound = true;
      }
    }
  }
}

if (!secretsFound) {
  pass('No hardcoded secrets found in scanned files');
}

// ── 4. Git status ──────────────────────────────────────────────────────────

console.log('\n=== Check 4/4: Git Status ===\n');

try {
  const branch = execSync('git rev-parse --abbrev-ref HEAD', {
    cwd: root,
    encoding: 'utf8',
  }).trim();

  const commitHash = execSync('git rev-parse --short HEAD', {
    cwd: root,
    encoding: 'utf8',
  }).trim();

  pass('Current branch', `${branch} @ ${commitHash}`);

  const status = execSync('git status --porcelain', {
    cwd: root,
    encoding: 'utf8',
  }).trim();

  if (status) {
    const changedCount = status.split('\n').length;
    warn('Uncommitted changes', `${changedCount} file(s) modified`);
  } else {
    pass('Working tree clean', 'no uncommitted changes');
  }
} catch {
  warn('Git status', 'could not read git info');
}

// ── Summary ────────────────────────────────────────────────────────────────

console.log('\n========================================');
console.log('         PRE-DEPLOY SUMMARY');
console.log('========================================\n');

const passes = results.filter((r) => r.status === 'PASS').length;
const fails = results.filter((r) => r.status === 'FAIL').length;
const warns = results.filter((r) => r.status === 'WARN').length;

console.log(`  PASS: ${passes}`);
console.log(`  FAIL: ${fails}`);
console.log(`  WARN: ${warns}`);
console.log();

if (fails > 0) {
  console.log('  Result: BLOCKED - fix failures before deploying\n');
  process.exit(1);
} else if (warns > 0) {
  console.log('  Result: OK (with warnings) - review before deploying\n');
  process.exit(0);
} else {
  console.log('  Result: ALL CLEAR - safe to deploy\n');
  process.exit(0);
}
