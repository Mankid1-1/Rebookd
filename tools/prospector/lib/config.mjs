/**
 * Configuration loader for Rebooked Prospector.
 * All primary data sources are 100% free (no API keys required).
 * Optional keys enhance results but are not required.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function findEnvFile() {
  const dir = join(__dirname, '..', '..', '..');
  const envPath = join(dir, '.env');
  if (existsSync(envPath)) return envPath;
  return null;
}

function loadDotEnv() {
  const envPath = findEnvFile();
  if (!envPath) return {};
  const vars = {};
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

const dotEnv = loadDotEnv();

function env(key, fallback = '') {
  return process.env[key] || dotEnv[key] || fallback;
}

export const config = {
  // ── FREE: No key required ──────────────────────────

  // OpenStreetMap Overpass API — completely free, no key, no signup
  overpass: {
    url: 'https://overpass-api.de/api/interpreter',
    timeout: 30000,
  },

  // Website scraping for emails — no API needed
  scraper: {
    timeout: 8000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },

  // ── OPTIONAL: Free tier keys (enhance results) ─────

  // Hunter.io — 25 free searches/month (optional)
  hunter: {
    apiKey: env('HUNTER_API_KEY'),
    baseUrl: 'https://api.hunter.io/v2',
  },

  // Reddit API — free read access with OAuth app (optional)
  reddit: {
    clientId: env('REDDIT_CLIENT_ID'),
    clientSecret: env('REDDIT_CLIENT_SECRET'),
    userAgent: 'RebookedProspector/1.0',
  },

  // Output
  defaultOutput: 'C:\\Users\\Brend\\Desktop\\Outreach',

  // Search defaults
  defaults: {
    businessTypes: ['salon', 'barber', 'spa', 'tattoo', 'clinic', 'fitness'],
  },
};

export function validateConfig(modules = []) {
  const issues = [];
  // Primary sources need no config — they're always available
  if (modules.includes('hunter') && !config.hunter.apiKey) {
    issues.push('HUNTER_API_KEY not set — Hunter.io disabled (website scraping + patterns still work)');
  }
  if (modules.includes('reddit') && !config.reddit.clientId) {
    issues.push('REDDIT_CLIENT_ID not set — Reddit complaint search disabled (static complaint list still works)');
  }
  return issues;
}
