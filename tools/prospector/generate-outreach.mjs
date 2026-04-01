#!/usr/bin/env node
/**
 * Rebooked Prospector — Outreach Generator
 *
 * Reads Explorium CSV exports (businesses + prospects),
 * generates personalized cold emails, call scripts, and reports,
 * then saves everything to the Outreach folder.
 *
 * Usage:
 *   node tools/prospector/generate-outreach.mjs \
 *     --businesses path/to/businesses.csv \
 *     --prospects  path/to/prospects.csv \
 *     [--output    "C:\Users\Brend\Desktop\Outreach"]
 *
 * Or with no CSVs (generates from built-in sample data for testing):
 *   node tools/prospector/generate-outreach.mjs --demo
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseCSV, writeCSV } from './lib/csv-parser.mjs';
import { classifyBusinessType, buildTemplateData } from './lib/template-engine.mjs';
import { generateEmailSequence } from './lib/email-generator.mjs';
import { generateCallScript } from './lib/script-generator.mjs';
import { generateReport } from './lib/report-generator.mjs';
import { generateLaunchKit } from './lib/launch-kit-generator.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT = 'C:\\Users\\Brend\\Desktop\\Outreach';

// ── Parse CLI args ───────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { output: DEFAULT_OUTPUT, demo: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--businesses' && args[i + 1]) opts.businesses = resolve(args[++i]);
    else if (args[i] === '--prospects' && args[i + 1]) opts.prospects = resolve(args[++i]);
    else if (args[i] === '--output' && args[i + 1]) opts.output = resolve(args[++i]);
    else if (args[i] === '--demo') opts.demo = true;
  }
  return opts;
}

// ── Normalize column names from Explorium exports ────────
const COL_MAP_BUSINESS = {
  business_name: ['business_name', 'firmo_name', 'name', 'company_name'],
  domain: ['business_domain', 'firmo_website', 'business_website', 'domain', 'website'],
  city: ['business_city_name', 'firmo_city_name', 'city'],
  region: ['business_region', 'firmo_region_name', 'region', 'state'],
  naics_description: ['business_naics_description', 'firmo_naics_description', 'naics_description'],
  sic_description: ['business_sic_code_description', 'firmo_sic_code_description', 'sic_description'],
  linkedin_category: ['firmo_linkedin_industry_category', 'linkedin_category'],
  employees: ['business_number_of_employees_range', 'firmo_number_of_employees_range', 'employees'],
  revenue: ['business_yearly_revenue_range', 'firmo_yearly_revenue_range', 'revenue'],
  street: ['firmo_street', 'street', 'address'],
  zip: ['firmo_zip_code', 'zip_code', 'zip'],
  business_id: ['business_id'],
  linkedin_profile: ['business_linkedin_profile', 'firmo_linkedin_profile'],
};

const COL_MAP_PROSPECT = {
  first_name: ['prospect_first_name', 'profile_first_name', 'first_name'],
  last_name: ['prospect_last_name', 'profile_last_name', 'last_name'],
  full_name: ['prospect_full_name', 'profile_full_name', 'full_name'],
  job_title: ['prospect_job_title', 'profile_job_title', 'job_title', 'title'],
  professional_email: ['contact_professions_email', 'contact_professional_email', 'professional_email', 'email'],
  email: ['contact_emails', 'email'],
  phone: ['contact_mobile_phone', 'phone', 'mobile_phone'],
  city: ['prospect_city', 'profile_city', 'city'],
  region: ['prospect_region_name', 'profile_region_name', 'region', 'state'],
  linkedin: ['prospect_linkedin', 'profile_linkedin', 'linkedin'],
  company_name: ['prospect_company_name', 'profile_company_name', 'company_name'],
  company_website: ['prospect_company_website', 'profile_company_website', 'company_website'],
  business_id: ['business_id'],
  mobile_phone: ['contact_mobile_phone', 'mobile_phone'],
};

function normalizeRow(row, colMap) {
  const out = {};
  for (const [key, candidates] of Object.entries(colMap)) {
    for (const col of candidates) {
      if (row[col] !== undefined && row[col] !== '' && row[col] !== null) {
        out[key] = row[col];
        break;
      }
    }
    if (!out[key]) out[key] = '';
  }
  return out;
}

// ── Demo data for testing without CSVs ───────────────────
function getDemoData() {
  const businesses = [
    { business_name: 'Luxe Hair Studio', domain: 'luxehairstudio.com', city: 'Austin', region: 'Texas', naics_description: 'Beauty Salons', sic_description: 'Beauty shops', linkedin_category: 'personal care services', employees: '1-10', revenue: '0-500K', street: '123 Main St', zip: '78701', business_id: 'demo-1', linkedin_profile: '' },
    { business_name: 'Sharp Cuts Barbershop', domain: 'sharpcutsbarber.com', city: 'Dallas', region: 'Texas', naics_description: 'Barber Shops', sic_description: 'Barber shops', linkedin_category: 'personal care services', employees: '1-10', revenue: '0-500K', street: '456 Oak Ave', zip: '75201', business_id: 'demo-2', linkedin_profile: '' },
    { business_name: 'Serenity Day Spa', domain: 'serenitydayspa.com', city: 'Miami', region: 'Florida', naics_description: 'Other Personal Care Services', sic_description: 'Massage parlors', linkedin_category: 'wellness and fitness services', employees: '11-50', revenue: '500K-1M', street: '789 Palm Blvd', zip: '33101', business_id: 'demo-3', linkedin_profile: '' },
    { business_name: 'Iron Rose Tattoo', domain: 'ironrosetattoo.com', city: 'Portland', region: 'Oregon', naics_description: 'Other Personal Care Services', sic_description: 'Tattoo parlors', linkedin_category: 'personal care services', employees: '1-10', revenue: '0-500K', street: '321 Vine St', zip: '97201', business_id: 'demo-4', linkedin_profile: '' },
    { business_name: 'Bright Smile Dental', domain: 'brightsmile.com', city: 'Chicago', region: 'Illinois', naics_description: 'Offices of Dentists', sic_description: 'Dentists', linkedin_category: 'dentists', employees: '11-50', revenue: '1M-5M', street: '555 Lake Dr', zip: '60601', business_id: 'demo-5', linkedin_profile: '' },
    { business_name: 'Flex Fitness Studio', domain: 'flexfitness.com', city: 'Denver', region: 'Colorado', naics_description: 'Fitness and Recreational Sports Centers', sic_description: 'Physical fitness facilities', linkedin_category: 'wellness and fitness services', employees: '1-10', revenue: '0-500K', street: '888 Mountain Rd', zip: '80201', business_id: 'demo-6', linkedin_profile: '' },
  ];

  const prospects = [
    { first_name: 'Jessica', last_name: 'Rivera', full_name: 'Jessica Rivera', job_title: 'Owner & Lead Stylist', professional_email: 'jessica@luxehairstudio.com', email: 'jessica@luxehairstudio.com', phone: '+15125551234', city: 'Austin', region: 'Texas', linkedin: '', company_name: 'Luxe Hair Studio', company_website: 'luxehairstudio.com', business_id: 'demo-1', mobile_phone: '+15125551234' },
    { first_name: 'Marcus', last_name: 'Johnson', full_name: 'Marcus Johnson', job_title: 'Owner', professional_email: 'marcus@sharpcutsbarber.com', email: 'marcus@sharpcutsbarber.com', phone: '+12145559876', city: 'Dallas', region: 'Texas', linkedin: '', company_name: 'Sharp Cuts Barbershop', company_website: 'sharpcutsbarber.com', business_id: 'demo-2', mobile_phone: '+12145559876' },
    { first_name: 'Elena', last_name: 'Vasquez', full_name: 'Elena Vasquez', job_title: 'Spa Director', professional_email: 'elena@serenitydayspa.com', email: 'elena@serenitydayspa.com', phone: '+13055554321', city: 'Miami', region: 'Florida', linkedin: '', company_name: 'Serenity Day Spa', company_website: 'serenitydayspa.com', business_id: 'demo-3', mobile_phone: '+13055554321' },
    { first_name: 'Jake', last_name: 'Morrison', full_name: 'Jake Morrison', job_title: 'Shop Owner & Artist', professional_email: 'jake@ironrosetattoo.com', email: 'jake@ironrosetattoo.com', phone: '+15035556789', city: 'Portland', region: 'Oregon', linkedin: '', company_name: 'Iron Rose Tattoo', company_website: 'ironrosetattoo.com', business_id: 'demo-4', mobile_phone: '+15035556789' },
    { first_name: 'Dr. Priya', last_name: 'Sharma', full_name: 'Dr. Priya Sharma', job_title: 'Practice Owner', professional_email: 'priya@brightsmile.com', email: 'priya@brightsmile.com', phone: '+13125552468', city: 'Chicago', region: 'Illinois', linkedin: '', company_name: 'Bright Smile Dental', company_website: 'brightsmile.com', business_id: 'demo-5', mobile_phone: '+13125552468' },
    { first_name: 'Tony', last_name: 'Chen', full_name: 'Tony Chen', job_title: 'Founder', professional_email: 'tony@flexfitness.com', email: 'tony@flexfitness.com', phone: '+17205551357', city: 'Denver', region: 'Colorado', linkedin: '', company_name: 'Flex Fitness Studio', company_website: 'flexfitness.com', business_id: 'demo-6', mobile_phone: '+17205551357' },
  ];

  return { businesses, prospects };
}

// ── Complaint leads from web research ────────────────────
function getComplaintLeads() {
  return [
    { source: 'Behindthechair.com Forum', url: 'https://behindthechair.com/articles/tired-of-no-shows-cancellations-read-this/', industry: 'Salon/Hair', pain_point: 'No-shows and cancellations', notes: 'Active community of salon professionals discussing no-show frustrations. High-value outreach target.' },
    { source: 'Booksy Blog', url: 'https://biz.booksy.com/en-us/blog/no-show-policy-tips', industry: 'Salon/Barber', pain_point: 'No-show policy creation', notes: 'Businesses searching for no-show solutions — ready for Rebooked pitch.' },
    { source: 'InkDesk Tattoo Forum', url: 'https://inkdesk.app/blog/avoiding-no-shows-best-practices-for-tattoo-artists', industry: 'Tattoo', pain_point: 'Client ghosting after booking', notes: 'Tattoo artists actively seeking solutions to 8-20% no-show rates.' },
    { source: 'TattooStudioPro', url: 'https://tattoostudiopro.com/no-shows-cancellations-complete-strategies/', industry: 'Tattoo', pain_point: 'No-shows and cancellations', notes: 'Comprehensive discussion — studio owners looking for automated solutions.' },
    { source: 'RingMyBarber Blog', url: 'https://www.ringmybarber.com/why-barbers-are-moving-to-appointments-deposits-and-digital-booking-in-2026/', industry: 'Barber', pain_point: 'Transitioning to digital booking', notes: 'Barbers frustrated with no-shows moving to appointment systems — prime for SMS recovery upsell.' },
    { source: 'Fresha Blog', url: 'https://www.fresha.com/blog/cancellations-cost-study', industry: 'Beauty/Wellness', pain_point: 'Revenue loss from cancellations', notes: 'Study: salons lose 7% of revenue monthly to missed appointments. Over a third consider quitting.' },
    { source: 'Kitomba Blog', url: 'https://www.kitomba.com/blog/how-to-stop-losing-money-to-no-shows-without-the-awkward-conversation/', industry: 'Salon', pain_point: 'Money lost to no-shows', notes: 'Salon owners seeking non-confrontational solutions — perfect for automated SMS approach.' },
    { source: 'SalonBizSoftware', url: 'https://salonbizsoftware.com/blog/7-tips-to-reduce-no-shows-and-last-minute-cancellations-at-your-salon/', industry: 'Salon', pain_point: 'Reducing no-shows', notes: 'Business owners actively searching for tips — warm audience for Rebooked outreach.' },
    { source: 'Appointible Blog', url: 'https://appointible.com/biz/blog/stop-losing-money-no-shows-deposits/', industry: 'General Appointment', pain_point: 'Financial impact of no-shows', notes: 'Businesses losing $7,800+/year — data point for cold email/call scripts.' },
    { source: 'Zenoti Blog', url: 'https://www.zenoti.com/thecheckin/salon-cancellation-policies', industry: 'Salon', pain_point: 'Cancellation policy gaps', notes: 'Salon owners struggling with cancellation policies — Rebooked automates the recovery instead.' },
  ];
}

// ── Main ─────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  const dateStr = new Date().toISOString().slice(0, 10);
  const runDir = join(opts.output, `${dateStr}-prospecting-run`);

  console.log('\n  ╔══════════════════════════════════════╗');
  console.log('  ║  REBOOKED PROSPECTOR v1.0            ║');
  console.log('  ║  Automated Outreach Generator        ║');
  console.log('  ╚══════════════════════════════════════╝\n');

  // Load data
  let businesses, prospects;
  if (opts.demo) {
    console.log('  [DEMO MODE] Using built-in sample data\n');
    ({ businesses, prospects } = getDemoData());
  } else {
    if (!opts.businesses || !opts.prospects) {
      console.log('  Usage: node generate-outreach.mjs --businesses <file> --prospects <file> [--output <dir>]');
      console.log('  Or:    node generate-outreach.mjs --demo\n');
      process.exit(1);
    }
    console.log(`  Loading businesses: ${opts.businesses}`);
    const rawBiz = parseCSV(opts.businesses);
    businesses = rawBiz.map(r => normalizeRow(r, COL_MAP_BUSINESS));
    console.log(`  -> ${businesses.length} businesses loaded`);

    console.log(`  Loading prospects:  ${opts.prospects}`);
    const rawProspects = parseCSV(opts.prospects);
    prospects = rawProspects.map(r => normalizeRow(r, COL_MAP_PROSPECT));
    console.log(`  -> ${prospects.length} prospects loaded\n`);
  }

  // Build business lookup by ID and domain
  const bizById = new Map();
  const bizByDomain = new Map();
  for (const b of businesses) {
    if (b.business_id) bizById.set(b.business_id, b);
    if (b.domain) bizByDomain.set(b.domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase(), b);
  }

  // Match prospects to businesses
  for (const p of prospects) {
    let biz = bizById.get(p.business_id);
    if (!biz && p.company_website) {
      const domain = p.company_website.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
      biz = bizByDomain.get(domain);
    }
    p._business = biz || null;
    p._business_type = classifyBusinessType(
      [biz?.naics_description, biz?.sic_description, biz?.linkedin_category, biz?.business_name, p.company_name].join(' ')
    );
  }

  // Create output directories
  const dirs = [
    runDir,
    join(runDir, 'emails', 'by-type'),
    join(runDir, 'call-scripts', 'by-type'),
  ];
  for (const d of dirs) mkdirSync(d, { recursive: true });
  console.log(`  Output directory: ${runDir}\n`);

  // ── Generate emails ────────────────────────────────────
  console.log('  Generating email sequences...');
  const allEmails = [];
  const emailsByType = {};

  for (const p of prospects) {
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

  // Write batch emails CSV
  writeFileSync(join(runDir, 'emails', 'batch-cold-emails.csv'), writeCSV(allEmails));
  console.log(`    -> ${allEmails.length} email rows (${prospects.length} prospects x 3 steps)`);

  // Write emails by type
  for (const [type, emails] of Object.entries(emailsByType)) {
    writeFileSync(join(runDir, 'emails', 'by-type', `${type}.txt`), emails.join('\n\n'));
  }
  console.log(`    -> ${Object.keys(emailsByType).length} business type files`);

  // ── Generate call scripts ──────────────────────────────
  console.log('  Generating call scripts...');
  const allScripts = [];
  const scriptsByType = {};

  for (const p of prospects) {
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
  console.log(`    -> ${allScripts.length} call scripts`);

  for (const [type, scripts] of Object.entries(scriptsByType)) {
    writeFileSync(join(runDir, 'call-scripts', 'by-type', `${type}.txt`), scripts.join('\n\n'));
  }
  console.log(`    -> ${Object.keys(scriptsByType).length} business type files`);

  // ── Complaint leads ────────────────────────────────────
  console.log('  Writing complaint leads...');
  const complaints = getComplaintLeads();
  writeFileSync(join(runDir, 'complaint-leads.csv'), writeCSV(complaints));
  console.log(`    -> ${complaints.length} complaint sources`);

  // ── Objection handling ─────────────────────────────────
  console.log('  Copying objection handling guide...');
  const objections = readFileSync(join(__dirname, 'templates', 'cold-call-objections.txt'), 'utf-8');
  writeFileSync(join(runDir, 'objection-handling.txt'), objections);

  // ── Master prospect list ───────────────────────────────
  console.log('  Building master prospect list...');
  const masterList = prospects.map(p => {
    const data = buildTemplateData(p, p._business);
    return {
      business_name: data.business_name,
      business_type: data.business_type,
      website: p._business?.domain || p.company_website || '',
      address: [p._business?.street, data.city, data.state, p._business?.zip].filter(Boolean).join(', '),
      city: data.city,
      state: data.state,
      owner_name: data.owner_full_name,
      owner_title: data.owner_title,
      email: data.email,
      phone: data.phone,
      linkedin: data.linkedin,
      priority: (data.email && data.phone) ? 'HIGH' : (data.email || data.phone) ? 'MEDIUM' : 'LOW',
      email_subject_1: `Quick question about ${data.business_name}`,
      call_hook: data.hook,
    };
  });

  // Sort by priority
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  masterList.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  writeFileSync(join(runDir, 'master-prospect-list.csv'), writeCSV(masterList));
  console.log(`    -> ${masterList.length} prospects (${masterList.filter(p => p.priority === 'HIGH').length} high-priority)`);

  // ── Summary report ─────────────────────────────────────
  console.log('  Generating summary report...');
  const report = generateReport(prospects, businesses, dateStr);
  writeFileSync(join(runDir, 'summary-report.txt'), report);

  // ── Platform launch kit PDF ────────────────────────────
  console.log('  Generating platform launch kit PDF...');
  const pdfPath = join(runDir, 'Rebooked_Launch_Kit.pdf');
  try {
    await generateLaunchKit(pdfPath);
    console.log('    -> Rebooked_Launch_Kit.pdf');
  } catch (err) {
    console.warn('    [WARN] PDF generation failed:', err.message);
  }

  // ── Done ───────────────────────────────────────────────
  console.log('\n  ╔══════════════════════════════════════╗');
  console.log('  ║  COMPLETE                            ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log(`\n  All files saved to:\n  ${runDir}\n`);
  console.log('  Files generated:');
  console.log('    master-prospect-list.csv');
  console.log('    emails/batch-cold-emails.csv');
  console.log(`    emails/by-type/ (${Object.keys(emailsByType).length} files)`);
  console.log('    call-scripts/batch-call-scripts.csv');
  console.log(`    call-scripts/by-type/ (${Object.keys(scriptsByType).length} files)`);
  console.log('    complaint-leads.csv');
  console.log('    objection-handling.txt');
  console.log('    summary-report.txt');
  console.log('    Rebooked_Launch_Kit.pdf\n');
}

main();
