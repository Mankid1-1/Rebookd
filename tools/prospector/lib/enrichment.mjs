/**
 * Contact enrichment module — 100% free.
 *
 * 1. Website scraping — fetch contact/about pages, extract emails
 * 2. Email pattern generation — common patterns for small businesses
 * 3. DNS MX check — verify domain accepts email before generating patterns
 * 4. Hunter.io (optional, 25 free/month) — bonus if key is set
 */

import axios from 'axios';
import dns from 'dns/promises';
import { config } from './config.mjs';

// ── Website email scraping ──────────────────────────────

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// Pages most likely to have contact info
const CONTACT_PATHS = ['/', '/contact', '/contact-us', '/about', '/about-us'];

/**
 * Scrape a business website for email addresses.
 * Tries common contact page paths.
 * @param {string} domain - Business domain (e.g. "joessalon.com")
 * @returns {Promise<string[]>} Found email addresses
 */
export async function scrapeWebsiteEmails(domain) {
  if (!domain) return [];

  const cleanDom = cleanDomain(domain);
  const baseUrl = `https://${cleanDom}`;
  const foundEmails = new Set();

  for (const path of CONTACT_PATHS) {
    try {
      const resp = await axios.get(`${baseUrl}${path}`, {
        timeout: 8000,
        maxRedirects: 3,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
        validateStatus: (s) => s < 400,
      });

      const html = typeof resp.data === 'string' ? resp.data : '';
      const emails = html.match(EMAIL_REGEX) || [];

      for (const email of emails) {
        const lower = email.toLowerCase();
        // Filter out common false positives
        if (isValidBusinessEmail(lower, cleanDom)) {
          foundEmails.add(lower);
        }
      }
    } catch {
      // Page doesn't exist or errored — skip
    }

    // Small delay between page fetches
    await sleep(300);
  }

  return [...foundEmails];
}

function isValidBusinessEmail(email, domain) {
  // Skip image files, CSS, JS references that look like emails
  if (/\.(png|jpg|jpeg|gif|svg|css|js|webp)$/i.test(email)) return false;
  // Skip very long emails (likely parsing errors)
  if (email.length > 60) return false;
  // Skip common non-contact addresses
  if (/^(noreply|no-reply|donotreply|mailer-daemon|postmaster)@/.test(email)) return false;
  // Skip example domains
  if (/@(example|test|localhost|sentry)\./i.test(email)) return false;
  // Prefer emails from the business domain itself
  return true;
}

// ── DNS MX Check ────────────────────────────────────────

/**
 * Check if a domain has MX records (can receive email).
 * @param {string} domain
 * @returns {Promise<boolean>}
 */
export async function hasMxRecords(domain) {
  if (!domain) return false;
  try {
    const records = await dns.resolveMx(cleanDomain(domain));
    return records && records.length > 0;
  } catch {
    return false;
  }
}

// ── Email pattern generation ────────────────────────────

const COMMON_PATTERNS = [
  { pattern: 'info@{domain}', confidence: 85, label: 'Generic info' },
  { pattern: '{first}@{domain}', confidence: 80, label: 'First name' },
  { pattern: 'contact@{domain}', confidence: 75, label: 'Generic contact' },
  { pattern: 'hello@{domain}', confidence: 70, label: 'Generic hello' },
  { pattern: '{first}.{last}@{domain}', confidence: 65, label: 'First.Last' },
  { pattern: 'bookings@{domain}', confidence: 60, label: 'Bookings' },
  { pattern: 'appointments@{domain}', confidence: 55, label: 'Appointments' },
  { pattern: '{first}{last}@{domain}', confidence: 50, label: 'FirstLast' },
  { pattern: 'admin@{domain}', confidence: 45, label: 'Admin' },
  { pattern: 'owner@{domain}', confidence: 40, label: 'Owner' },
];

/**
 * Generate likely email addresses from domain and name.
 */
export function generateEmailPatterns(domain, firstName, lastName) {
  if (!domain) return [];

  const d = cleanDomain(domain);
  const first = (firstName || '').toLowerCase().replace(/[^a-z]/g, '');
  const last = (lastName || '').toLowerCase().replace(/[^a-z]/g, '');

  const emails = [];
  for (const { pattern, confidence, label } of COMMON_PATTERNS) {
    if (pattern.includes('{first}') && !first) continue;
    if (pattern.includes('{last}') && !last) continue;

    const email = pattern
      .replace('{first}', first)
      .replace('{last}', last)
      .replace('{domain}', d);

    emails.push({ email, confidence, source: 'pattern', label });
  }

  return emails;
}

// ── Hunter.io (optional, 25 free/month) ─────────────────

async function hunterDomainSearch(domain) {
  const apiKey = config.hunter.apiKey;
  if (!apiKey) return { emails: [], source: 'hunter_unavailable' };

  try {
    const resp = await axios.get(`${config.hunter.baseUrl}/domain-search`, {
      params: { domain: cleanDomain(domain), api_key: apiKey, limit: 10 },
      timeout: 10000,
    });

    const data = resp.data.data || {};
    const emails = (data.emails || []).map(e => ({
      email: e.value,
      first_name: e.first_name || '',
      last_name: e.last_name || '',
      position: e.position || '',
      confidence: e.confidence || 0,
      source: 'hunter',
    }));

    return { emails, pattern: data.pattern || null, source: 'hunter' };
  } catch (err) {
    if (err.response?.status === 429) {
      console.error('    [Hunter] Rate limit reached');
    }
    return { emails: [], source: 'hunter_error' };
  }
}

// ── Combined enrichment ─────────────────────────────────

/**
 * Enrich a business with contact info using all free methods.
 * Priority: website scraping > Hunter.io > email patterns
 */
export async function enrichContact(business, opts = {}) {
  const domain = business.website || '';
  if (!domain) {
    return {
      emails: [],
      phone: business.phone || '',
      best_email: '',
      source: 'no_domain',
    };
  }

  let emails = [];
  let source = 'none';

  // Step 1: Scrape the website for emails
  const scraped = await scrapeWebsiteEmails(domain);
  if (scraped.length > 0) {
    emails = scraped.map(e => ({ email: e, confidence: 95, source: 'website_scrape' }));
    source = 'website';
  }

  // Step 2: Try Hunter.io if we still have no emails and key is set
  if (emails.length === 0 && opts.useHunter !== false && config.hunter.apiKey) {
    const hunter = await hunterDomainSearch(domain);
    if (hunter.emails.length > 0) {
      emails = hunter.emails;
      source = 'hunter';
    }
  }

  // Step 3: Fall back to email patterns
  if (emails.length === 0) {
    emails = generateEmailPatterns(domain, opts.firstName || '', opts.lastName || '');
    source = 'pattern';
  }

  // Sort by confidence
  emails.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

  // Pick best: prefer scraped emails from the business domain
  const domainClean = cleanDomain(domain);
  const onDomain = emails.filter(e => e.email.endsWith(`@${domainClean}`));
  const bestEmail = onDomain[0]?.email || emails[0]?.email || '';

  return {
    emails,
    phone: business.phone || '',
    best_email: bestEmail,
    source,
  };
}

/**
 * Extract likely owner name from business name.
 */
export function guessOwnerFromBusinessName(businessName) {
  if (!businessName) return null;
  const possessiveMatch = businessName.match(/^([A-Z][a-z]+)(?:'s|s)\s/);
  if (possessiveMatch) {
    return { firstName: possessiveMatch[1], lastName: '' };
  }
  return null;
}

// ── Helpers ─────────────────────────────────────────────

function cleanDomain(domain) {
  return (domain || '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
    .trim();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
