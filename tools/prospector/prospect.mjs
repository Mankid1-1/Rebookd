#!/usr/bin/env node
/**
 * Rebooked Prospector CLI — 100% Free Business Discovery & Outreach Tool.
 *
 * Data sources (all free, no API keys required):
 *   - OpenStreetMap Overpass API — business discovery (name, address, phone, website)
 *   - Website scraping — extract emails from business contact pages
 *   - Email pattern generation — common email patterns for business domains
 *
 * Optional enhancements (free tier API keys):
 *   - Hunter.io — 25 free email lookups/month
 *   - Reddit API — complaint/pain-point discovery
 *
 * COMMANDS:
 *   search      Find businesses by type and location (via OpenStreetMap)
 *   enrich      Enrich cached businesses with emails (website scraping + patterns)
 *   complaints  Find pain-point complaints on Reddit
 *   outreach    Generate cold emails + call scripts from cached data
 *   pipeline    Run full pipeline (search → enrich → complaints → outreach)
 *   stats       Show cache statistics
 *   export      Export cached data to CSV
 *
 * EXAMPLES:
 *   node prospect.mjs search --type salon --location "Austin" --state "Texas"
 *   node prospect.mjs search --type barber,tattoo --location "Dallas" --state "Texas"
 *   node prospect.mjs enrich
 *   node prospect.mjs complaints --industry salon
 *   node prospect.mjs outreach
 *   node prospect.mjs pipeline --type salon,barber,spa --location "Austin" --state "Texas"
 *   node prospect.mjs stats
 *
 * OPTIONAL ENV VARS (add to .env for bonus features):
 *   HUNTER_API_KEY           — Hunter.io (25 free lookups/month)
 *   REDDIT_CLIENT_ID         — Reddit OAuth app
 *   REDDIT_CLIENT_SECRET     — Reddit OAuth app
 */

import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { config, validateConfig } from './lib/config.mjs';
import { getDb, closeDb, upsertBusiness, getBusinesses, insertProspect, getProspects, updateProspectEnrichment, insertComplaint, getComplaints, logSearch, getStats } from './lib/db.mjs';
import { searchOverpass, searchAllTypes } from './lib/overpass.mjs';
import { enrichContact, guessOwnerFromBusinessName } from './lib/enrichment.mjs';
import { findComplaints, findComplaintsAcrossSubreddits } from './lib/complaints.mjs';
import { classifyBusinessType, buildTemplateData } from './lib/template-engine.mjs';
import { generateEmailSequence } from './lib/email-generator.mjs';
import { generateCallScript } from './lib/script-generator.mjs';
import { generateReport } from './lib/report-generator.mjs';
import { writeCSV } from './lib/csv-parser.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');

// ── CLI Argument Parser ─────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const opts = {
    type: '',
    location: '',
    state: '',
    output: config.defaultOutput,
    useHunter: true,
    industry: '',
    limit: 50,
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--type' && next) { opts.type = next; i++; }
    else if (arg === '--location' && next) { opts.location = next; i++; }
    else if (arg === '--state' && next) { opts.state = next; i++; }
    else if (arg === '--industry' && next) { opts.industry = next; i++; }
    else if (arg === '--output' && next) { opts.output = next; i++; }
    else if (arg === '--limit' && next) { opts.limit = parseInt(next); i++; }
    else if (arg === '--no-hunter') { opts.useHunter = false; }
  }

  return { command, opts };
}

// ── Banner ──────────────────────────────────────────────

function banner() {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║  REBOOKED PROSPECTOR v2.0                       ║
  ║  100% Free Business Discovery & Outreach Tool   ║
  ║                                                 ║
  ║  Data: OpenStreetMap + Website Scraping          ║
  ║  Cost: $0                                       ║
  ╚══════════════════════════════════════════════════╝
`);
}

// ── SEARCH command ──────────────────────────────────────

async function cmdSearch(opts) {
  const types = opts.type ? opts.type.split(',').map(t => t.trim()) : config.defaults.businessTypes;
  const city = opts.location;
  const state = opts.state;

  if (!city) {
    console.error('  ERROR: --location is required (e.g. --location "Austin" --state "Texas")');
    process.exit(1);
  }

  const db = getDb(PROJECT_ROOT);
  let totalFound = 0;

  console.log(`  Searching OpenStreetMap for businesses in ${city}${state ? ', ' + state : ''}...\n`);

  // Try batch query first (one Overpass call for all types)
  if (types.length > 1) {
    console.log(`  [Overpass] Batch query for ${types.join(', ')}...`);
    const results = await searchAllTypes(city, state, types);

    let newCount = 0;
    for (const biz of results) {
      upsertBusiness(db, biz);
      const existing = getProspects(db, { business_id: biz.id });
      if (existing.length === 0) {
        const guess = guessOwnerFromBusinessName(biz.name);
        insertProspect(db, {
          business_id: biz.id,
          first_name: guess?.firstName || '',
          last_name: guess?.lastName || '',
          full_name: guess ? `${guess.firstName} ${guess.lastName}`.trim() : '',
          job_title: 'Owner',
          phone: biz.phone || '',
        });
      }
      newCount++;
    }
    logSearch(db, `${types.join(',')} in ${city}, ${state}`, 'openstreetmap', results.length);

    // Show breakdown by type
    const byType = {};
    for (const biz of results) {
      byType[biz.business_type] = (byType[biz.business_type] || 0) + 1;
    }
    for (const [type, count] of Object.entries(byType)) {
      console.log(`    ${type}: ${count} businesses`);
    }

    totalFound = results.length;
    console.log(`\n  Total found: ${totalFound}`);
  } else {
    // Single type query
    for (const type of types) {
      console.log(`  [Overpass] Searching for ${type}...`);
      const results = await searchOverpass(type, city, state);

      for (const biz of results) {
        upsertBusiness(db, biz);
        const existing = getProspects(db, { business_id: biz.id });
        if (existing.length === 0) {
          const guess = guessOwnerFromBusinessName(biz.name);
          insertProspect(db, {
            business_id: biz.id,
            first_name: guess?.firstName || '',
            last_name: guess?.lastName || '',
            full_name: guess ? `${guess.firstName} ${guess.lastName}`.trim() : '',
            job_title: 'Owner',
            phone: biz.phone || '',
          });
        }
      }
      logSearch(db, `${type} in ${city}, ${state}`, 'openstreetmap', results.length);
      console.log(`    Found: ${results.length} businesses`);
      totalFound += results.length;

      // Be polite to the public Overpass server
      if (types.indexOf(type) < types.length - 1) await sleep(1500);
    }
    console.log(`\n  Total found: ${totalFound}`);
  }

  printStats(db);
  closeDb();
}

// ── ENRICH command ──────────────────────────────────────

async function cmdEnrich(opts) {
  const db = getDb(PROJECT_ROOT);
  const prospects = getProspects(db, { enriched: false });

  if (prospects.length === 0) {
    console.log('  No unenriched prospects found. Run "search" first.');
    closeDb();
    return;
  }

  console.log(`  Enriching ${prospects.length} prospects via website scraping...\n`);
  let enriched = 0;
  let emailsFound = 0;

  for (const p of prospects) {
    const domain = p.business_website || '';
    if (!domain) {
      console.log(`    [Skip] ${p.business_name || p.full_name || '(unnamed)'} — no website`);
      updateProspectEnrichment(db, p.id, {});
      enriched++;
      continue;
    }

    const label = p.business_name || domain;
    process.stdout.write(`    Enriching: ${label}... `);

    const result = await enrichContact(
      { website: domain, phone: p.phone },
      {
        useHunter: opts.useHunter,
        firstName: p.first_name,
        lastName: p.last_name,
      }
    );

    updateProspectEnrichment(db, p.id, {
      email: result.best_email,
      email_source: result.source,
      phone: result.phone || p.phone,
    });

    enriched++;
    if (result.best_email) emailsFound++;
    console.log(result.best_email ? `${result.best_email} (${result.source})` : `no email found (${result.source})`);

    // Polite delay between website fetches
    await sleep(500);
  }

  console.log(`\n  Enrichment complete: ${enriched} processed, ${emailsFound} emails found`);
  printStats(db);
  closeDb();
}

// ── COMPLAINTS command ──────────────────────────────────

async function cmdComplaints(opts) {
  const db = getDb(PROJECT_ROOT);
  const industry = opts.industry || '';

  if (!config.reddit.clientId) {
    console.log('  Reddit API not configured — using static complaint sources.');
    const statics = getStaticComplaintLeads();
    for (const c of statics) {
      insertComplaint(db, { ...c, source: c.source || 'web' });
    }
    console.log(`  Added ${statics.length} static complaint sources.`);
    printStats(db);
    closeDb();
    return;
  }

  console.log(`  Searching Reddit for pain-point complaints...`);
  if (industry) console.log(`  Industry filter: ${industry}\n`);

  let complaints;
  if (industry) {
    complaints = await findComplaints(industry, { limit: 10 });
  } else {
    complaints = await findComplaintsAcrossSubreddits();
  }

  console.log(`  Found ${complaints.length} complaint threads\n`);
  for (const c of complaints) {
    insertComplaint(db, c);
    console.log(`    [r/${c.subreddit}] ${c.title.slice(0, 70)}... (score: ${c.score})`);
  }

  printStats(db);
  closeDb();
}

// ── OUTREACH command ────────────────────────────────────

async function cmdOutreach(opts) {
  const db = getDb(PROJECT_ROOT);
  const prospects = getProspects(db);
  const businesses = getBusinesses(db);
  const complaints = getComplaints(db);

  if (prospects.length === 0) {
    console.log('  No prospects in cache. Run "search" and "enrich" first.');
    closeDb();
    return;
  }

  console.log(`  Generating outreach for ${prospects.length} prospects...\n`);

  const dateStr = new Date().toISOString().slice(0, 10);
  const runDir = join(opts.output, `${dateStr}-prospecting-run`);
  const dirs = [runDir, join(runDir, 'emails', 'by-type'), join(runDir, 'call-scripts', 'by-type')];
  for (const d of dirs) mkdirSync(d, { recursive: true });

  // Convert DB rows to template format
  const prospectData = prospects.map(p => ({
    first_name: p.first_name || '',
    last_name: p.last_name || '',
    full_name: p.full_name || p.first_name || '',
    job_title: p.job_title || 'Owner',
    professional_email: p.email || '',
    email: p.email || '',
    phone: p.phone || '',
    city: p.business_city || '',
    region: p.business_state || '',
    linkedin: p.linkedin || '',
    company_name: p.business_name || '',
    company_website: p.business_website || '',
    _business: {
      business_name: p.business_name || '',
      domain: p.business_website || '',
      city: p.business_city || '',
      region: p.business_state || '',
      naics_description: '',
      sic_description: '',
      linkedin_category: '',
      street: p.business_address || '',
      zip: p.business_zip || '',
    },
    _business_type: p.business_type || classifyBusinessType(p.business_name || ''),
  }));

  // ── Emails
  console.log('  Generating email sequences...');
  const allEmails = [];
  const emailsByType = {};

  for (const p of prospectData) {
    const seq = generateEmailSequence(p, p._business);
    for (const step of [seq.email1, seq.email2, seq.email3]) {
      allEmails.push({
        to_email: seq.metadata.to_email,
        to_name: seq.metadata.to_name,
        business_name: seq.metadata.business_name,
        business_type: seq.metadata.business_type,
        sequence_step: step.step,
        day: step.day,
        subject: step.subject,
        body: step.body,
      });
    }
    const type = seq.metadata.business_type;
    if (!emailsByType[type]) emailsByType[type] = [];
    emailsByType[type].push(`
--- ${seq.metadata.to_name} @ ${seq.metadata.business_name} ---
To: ${seq.metadata.to_email}

[Email 1 — ${seq.email1.day}]
Subject: ${seq.email1.subject}
${seq.email1.body}

[Email 2 — ${seq.email2.day}]
Subject: ${seq.email2.subject}
${seq.email2.body}

[Email 3 — ${seq.email3.day}]
Subject: ${seq.email3.subject}
${seq.email3.body}
`);
  }

  writeFileSync(join(runDir, 'emails', 'batch-cold-emails.csv'), writeCSV(allEmails));
  for (const [type, emails] of Object.entries(emailsByType)) {
    writeFileSync(join(runDir, 'emails', 'by-type', `${type}.txt`), emails.join('\n\n'));
  }
  console.log(`    -> ${allEmails.length} email rows (${prospectData.length} x 3)`);

  // ── Call scripts
  console.log('  Generating call scripts...');
  const allScripts = [];
  const scriptsByType = {};

  for (const p of prospectData) {
    const cs = generateCallScript(p, p._business);
    allScripts.push({
      phone: cs.phone,
      contact_name: cs.contact_name,
      business_name: cs.business_name,
      business_type: cs.business_type,
      opening_hook: cs.opening_hook,
      full_script: cs.script.replace(/\n/g, ' | '),
    });
    const type = cs.business_type;
    if (!scriptsByType[type]) scriptsByType[type] = [];
    scriptsByType[type].push(cs.script);
  }

  writeFileSync(join(runDir, 'call-scripts', 'batch-call-scripts.csv'), writeCSV(allScripts));
  for (const [type, scripts] of Object.entries(scriptsByType)) {
    writeFileSync(join(runDir, 'call-scripts', 'by-type', `${type}.txt`), scripts.join('\n\n'));
  }
  console.log(`    -> ${allScripts.length} call scripts`);

  // ── Complaints
  console.log('  Writing complaint leads...');
  const complaintRows = complaints.length > 0
    ? complaints.map(c => ({
        source: c.source, subreddit: c.subreddit || '', title: c.title,
        url: c.url, industry: c.industry, pain_point: c.pain_point,
        score: c.score, author: c.author,
      }))
    : getStaticComplaintLeads();
  writeFileSync(join(runDir, 'complaint-leads.csv'), writeCSV(complaintRows));
  console.log(`    -> ${complaintRows.length} complaint sources`);

  // ── Objection handling
  const objections = readFileSync(join(__dirname, 'templates', 'cold-call-objections.txt'), 'utf-8');
  writeFileSync(join(runDir, 'objection-handling.txt'), objections);

  // ── Master prospect list
  console.log('  Building master prospect list...');
  const masterList = prospectData.map(p => {
    const data = buildTemplateData(p, p._business);
    return {
      business_name: data.business_name,
      business_type: data.business_type,
      website: p._business?.domain || p.company_website || '',
      address: [p._business?.street, data.city, data.state, p._business?.zip].filter(Boolean).join(', '),
      city: data.city,
      state: data.state,
      owner_name: data.owner_full_name || data.owner_name,
      owner_title: data.owner_title,
      email: data.email,
      phone: data.phone,
      linkedin: data.linkedin,
      priority: (data.email && data.phone) ? 'HIGH' : (data.email || data.phone) ? 'MEDIUM' : 'LOW',
      email_subject_1: `Quick question about ${data.business_name}`,
      call_hook: data.hook,
    };
  });

  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  masterList.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  writeFileSync(join(runDir, 'master-prospect-list.csv'), writeCSV(masterList));
  console.log(`    -> ${masterList.length} prospects (${masterList.filter(p => p.priority === 'HIGH').length} high-priority)`);

  // ── Summary report
  console.log('  Generating summary report...');
  const bizList = businesses.map(b => ({ business_name: b.name, city: b.city, region: b.state }));
  const report = generateReport(prospectData, bizList, dateStr);
  writeFileSync(join(runDir, 'summary-report.txt'), report);

  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║  OUTREACH GENERATED                             ║
  ╚══════════════════════════════════════════════════╝

  All files saved to: ${runDir}

  Files:
    master-prospect-list.csv
    emails/batch-cold-emails.csv
    emails/by-type/ (${Object.keys(emailsByType).length} files)
    call-scripts/batch-call-scripts.csv
    call-scripts/by-type/ (${Object.keys(scriptsByType).length} files)
    complaint-leads.csv
    objection-handling.txt
    summary-report.txt
`);

  closeDb();
}

// ── PIPELINE command ────────────────────────────────────

async function cmdPipeline(opts) {
  console.log('  Running full pipeline: search -> enrich -> complaints -> outreach\n');

  console.log('  == STEP 1: SEARCH (OpenStreetMap) ====================\n');
  await cmdSearch(opts);

  console.log('\n  == STEP 2: ENRICH (Website Scraping) =================\n');
  await cmdEnrich(opts);

  console.log('\n  == STEP 3: COMPLAINTS ================================\n');
  await cmdComplaints(opts);

  console.log('\n  == STEP 4: OUTREACH ==================================\n');
  await cmdOutreach(opts);
}

// ── STATS command ───────────────────────────────────────

function cmdStats() {
  const db = getDb(PROJECT_ROOT);
  printStats(db);
  closeDb();
}

// ── EXPORT command ──────────────────────────────────────

function cmdExport(opts) {
  const db = getDb(PROJECT_ROOT);
  const dateStr = new Date().toISOString().slice(0, 10);
  const outDir = join(opts.output, `${dateStr}-export`);
  mkdirSync(outDir, { recursive: true });

  const businesses = getBusinesses(db);
  const prospects = getProspects(db);
  const complaints = getComplaints(db);

  if (businesses.length > 0) {
    writeFileSync(join(outDir, 'businesses.csv'), writeCSV(businesses.map(b => ({
      id: b.id, source: b.source, name: b.name, type: b.business_type,
      address: b.address, city: b.city, state: b.state, zip: b.zip,
      phone: b.phone, website: b.website, rating: b.rating || '', reviews: b.review_count || '',
    }))));
    console.log(`  Exported ${businesses.length} businesses -> businesses.csv`);
  }

  if (prospects.length > 0) {
    writeFileSync(join(outDir, 'prospects.csv'), writeCSV(prospects.map(p => ({
      business: p.business_name, type: p.business_type, name: p.full_name,
      title: p.job_title, email: p.email, email_source: p.email_source,
      phone: p.phone, linkedin: p.linkedin, enriched: p.enriched ? 'yes' : 'no',
      city: p.business_city, state: p.business_state,
    }))));
    console.log(`  Exported ${prospects.length} prospects -> prospects.csv`);
  }

  if (complaints.length > 0) {
    writeFileSync(join(outDir, 'complaints.csv'), writeCSV(complaints.map(c => ({
      source: c.source, subreddit: c.subreddit, title: c.title,
      url: c.url, industry: c.industry, pain_point: c.pain_point,
      score: c.score, author: c.author,
    }))));
    console.log(`  Exported ${complaints.length} complaints -> complaints.csv`);
  }

  console.log(`\n  All exports saved to: ${outDir}`);
  closeDb();
}

// ── HELP ────────────────────────────────────────────────

function cmdHelp() {
  console.log(`  COMMANDS:
    search       Find businesses via OpenStreetMap (free, no key needed)
                 --type salon,barber,spa,tattoo,clinic,fitness
                 --location "City Name"
                 --state "State Name"

    enrich       Scrape business websites for emails + phone numbers
                 --no-hunter  Skip Hunter.io, use website scraping only

    complaints   Find pain-point threads (Reddit API or static list)
                 --industry salon|barber|tattoo|spa|clinic|fitness

    outreach     Generate cold emails + call scripts from cache
                 --output "C:\\Users\\Brend\\Desktop\\Outreach"

    pipeline     Run all steps: search -> enrich -> complaints -> outreach
                 --type salon,barber --location "Austin" --state "Texas"

    stats        Show cache statistics
    export       Export cache to CSV files
    help         Show this message

  EXAMPLES:
    node prospect.mjs search --type salon --location "Austin" --state "Texas"
    node prospect.mjs pipeline --type salon,barber,spa --location "Miami" --state "Florida"
    node prospect.mjs enrich
    node prospect.mjs outreach

  DATA SOURCES (all free):
    OpenStreetMap    Business discovery — name, address, phone, website
    Website Scraping Email extraction from business contact pages
    Email Patterns   Common patterns (info@, contact@, etc.)

  OPTIONAL ENV VARS (free tier — enhances results):
    HUNTER_API_KEY           Hunter.io — 25 free email lookups/month
    REDDIT_CLIENT_ID         Reddit OAuth — complaint discovery
    REDDIT_CLIENT_SECRET     Reddit OAuth
`);
}

// ── Helpers ─────────────────────────────────────────────

function printStats(db) {
  const stats = getStats(db);
  console.log(`
  -- Cache Stats --------------------------------
    Businesses:     ${stats.businesses}
    Prospects:      ${stats.prospects}
    Enriched:       ${stats.enrichedProspects}
    With Email:     ${stats.withEmail}
    With Phone:     ${stats.withPhone}
    Complaints:     ${stats.complaints}
    API Searches:   ${stats.searches}
  -----------------------------------------------
`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getStaticComplaintLeads() {
  return [
    { source: 'Behindthechair.com', title: 'Tired of No-Shows & Cancellations', url: 'https://behindthechair.com/articles/tired-of-no-shows-cancellations-read-this/', industry: 'Salon', pain_point: 'No-shows and cancellations', score: '', author: '' },
    { source: 'Booksy Blog', title: 'No-Show Policy Tips for Salons', url: 'https://biz.booksy.com/en-us/blog/no-show-policy-tips', industry: 'Salon/Barber', pain_point: 'No-show policy', score: '', author: '' },
    { source: 'InkDesk', title: 'Avoiding No-Shows: Best Practices for Tattoo Artists', url: 'https://inkdesk.app/blog/avoiding-no-shows-best-practices-for-tattoo-artists', industry: 'Tattoo', pain_point: 'Client ghosting', score: '', author: '' },
    { source: 'Fresha Blog', title: 'Cancellations Cost Study', url: 'https://www.fresha.com/blog/cancellations-cost-study', industry: 'Beauty/Wellness', pain_point: 'Revenue loss from cancellations', score: '', author: '' },
    { source: 'Zenoti Blog', title: 'Salon Cancellation Policies', url: 'https://www.zenoti.com/thecheckin/salon-cancellation-policies', industry: 'Salon', pain_point: 'Cancellation policy gaps', score: '', author: '' },
    { source: 'Kitomba Blog', title: 'Stop Losing Money to No-Shows', url: 'https://www.kitomba.com/blog/how-to-stop-losing-money-to-no-shows-without-the-awkward-conversation/', industry: 'Salon', pain_point: 'Revenue loss from no-shows', score: '', author: '' },
    { source: 'Appointible', title: 'Stop Losing Money: No-Shows & Deposits', url: 'https://appointible.com/biz/blog/stop-losing-money-no-shows-deposits/', industry: 'General', pain_point: 'Financial impact of no-shows', score: '', author: '' },
    { source: 'RingMyBarber', title: 'Why Barbers Are Moving to Digital Booking', url: 'https://www.ringmybarber.com/why-barbers-are-moving-to-appointments-deposits-and-digital-booking-in-2026/', industry: 'Barber', pain_point: 'No-show prevention', score: '', author: '' },
  ];
}

// ── Main ────────────────────────────────────────────────

async function main() {
  banner();

  const { command, opts } = parseArgs();

  // Validate optional config
  const moduleNeeds = {
    enrich: ['hunter'],
    complaints: ['reddit'],
    pipeline: ['hunter', 'reddit'],
  };
  const needed = moduleNeeds[command] || [];
  const issues = validateConfig(needed);
  if (issues.length > 0) {
    console.log('  Optional features:');
    for (const issue of issues) console.log(`    - ${issue}`);
    console.log('');
  }

  try {
    switch (command) {
      case 'search': await cmdSearch(opts); break;
      case 'enrich': await cmdEnrich(opts); break;
      case 'complaints': await cmdComplaints(opts); break;
      case 'outreach': await cmdOutreach(opts); break;
      case 'pipeline': await cmdPipeline(opts); break;
      case 'stats': cmdStats(); break;
      case 'export': cmdExport(opts); break;
      case 'help': cmdHelp(); break;
      default:
        console.log(`  Unknown command: "${command}". Run "help" for usage.`);
        process.exit(1);
    }
  } catch (err) {
    console.error(`\n  ERROR: ${err.message}`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  }
}

main();
