/**
 * Rebooked Platform Launch Kit — PDF Generator
 *
 * Generates a branded PDF with ready-to-paste copy for 10 free
 * launch platforms. Callable as a module or standalone.
 *
 * Usage (module):
 *   import { generateLaunchKit } from './lib/launch-kit-generator.mjs';
 *   await generateLaunchKit('/path/to/output/Rebooked_Launch_Kit.pdf');
 *
 * Usage (standalone):
 *   node tools/prospector/lib/launch-kit-generator.mjs [outputPath]
 */

import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─── Brand colors ────────────────────────────────────────────────────────────
const NAVY  = [13,  27,  42];
const TEAL  = [0,  168, 150];
const GOLD  = [232,146,  10];
const WHITE = [255,255,255];
const LIGHT = [245,248,252];
const GRAY  = [100,110,120];

// ─── Sanitize — strip every character pdfkit's built-in fonts can't render ──
function s(str) {
  if (typeof str !== 'string') return String(str);
  return str
    .replace(/\u2192/g, '>')         // → arrow
    .replace(/\u2022/g, '-')         // • bullet
    .replace(/\u2014/g, ' - ')       // — em dash
    .replace(/\u2013/g, '-')         // – en dash
    .replace(/\u2026/g, '...')       // … ellipsis
    .replace(/\u2018|\u2019/g, "'")  // smart single quotes
    .replace(/\u201C|\u201D/g, '"')  // smart double quotes
    .replace(/\u00B7/g, '|')         // · middle dot (used as separator)
    .replace(/[^\x00-\xFF]/g, '');   // strip anything else outside Latin-1
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fillRect(doc, x, y, w, h, rgb) {
  doc.save().rect(x, y, w, h).fill(`rgb(${rgb.join(',')})`).restore();
}

function sectionHeader(doc, title) {
  doc.addPage();
  fillRect(doc, 0, 0, doc.page.width, 8, TEAL);
  doc.moveDown(1.5);
  doc.font('Helvetica-Bold').fontSize(22).fillColor(`rgb(${NAVY.join(',')})`).text(s(title));
  doc.moveDown(0.3);
  doc.rect(50, doc.y, doc.page.width - 100, 2).fill(`rgb(${GOLD.join(',')})`);
  doc.moveDown(1);
}

function platformBlock(doc, platform, url, items) {
  const startY = doc.y;
  const cardX = 50, cardW = doc.page.width - 100;

  doc.save()
     .roundedRect(cardX, startY - 4, cardW, 22, 4)
     .fill(`rgb(${NAVY.join(',')})`);
  doc.font('Helvetica-Bold').fontSize(13).fillColor(`rgb(${WHITE.join(',')})`);
  doc.text(`  ${s(platform)}`, cardX + 8, startY, { lineBreak: false });
  doc.font('Helvetica').fontSize(9).fillColor(`rgb(${TEAL.join(',')})`)
     .text(`  ${s(url)}`, cardX + 8, startY + 14, { lineBreak: false });
  doc.restore();
  doc.moveDown(1.8);

  for (const [label, content] of items) {
    if (doc.y > doc.page.height - 150) {
      doc.addPage();
      fillRect(doc, 0, 0, doc.page.width, 8, TEAL);
      doc.moveDown(1);
    }

    const safeLabel   = s(label).toUpperCase();
    const safeContent = s(content);

    doc.font('Helvetica-Bold').fontSize(9).fillColor(`rgb(${GOLD.join(',')})`)
       .text(safeLabel, { continued: false });
    doc.moveDown(0.15);

    const bgY = doc.y;
    const contentHeight = doc.heightOfString(safeContent, { width: doc.page.width - 116 });
    fillRect(doc, 50, bgY - 3, doc.page.width - 100, contentHeight + 14, LIGHT);

    doc.font('Helvetica').fontSize(9).fillColor(`rgb(${NAVY.join(',')})`)
       .text(safeContent, 58, bgY + 4, { width: doc.page.width - 116, lineBreak: true });
    doc.moveDown(0.8);
  }
  doc.moveDown(0.5);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateLaunchKit(outputPath) {
  return new Promise((resolvePromise, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: { Title: 'Rebooked Launch Kit', Author: 'Rebooked' },
    });

    const stream = createWriteStream(outputPath);
    doc.pipe(stream);
    stream.on('error', reject);
    stream.on('finish', resolvePromise);

    // ── COVER ───────────────────────────────────────────────────────────────
    fillRect(doc, 0, 0, doc.page.width, doc.page.height, NAVY);
    fillRect(doc, 0, 0, doc.page.width, 8, TEAL);
    fillRect(doc, 0, doc.page.height - 8, doc.page.width, 8, GOLD);

    doc.font('Helvetica-Bold').fontSize(52).fillColor(`rgb(${TEAL.join(',')})`).text('Rebooked', 50, 160);
    doc.font('Helvetica').fontSize(16).fillColor(`rgb(${GOLD.join(',')})`)
       .text('Platform Launch Kit', 50, 225);
    doc.font('Helvetica').fontSize(12).fillColor(`rgb(${WHITE.join(',')})`)
       .text('AI-powered SMS revenue recovery for appointment businesses.', 50, 270, { width: 400 });

    const stats = [['10', 'Free Platforms'], ['35 days', 'ROI Guarantee'], ['19', 'SMS Automations'], ['$199/mo', 'Base Price']];
    let sx = 50;
    for (const [val, lbl] of stats) {
      doc.font('Helvetica-Bold').fontSize(20).fillColor(`rgb(${GOLD.join(',')})`)
         .text(val, sx, 360, { lineBreak: false, width: 110, align: 'center' });
      doc.font('Helvetica').fontSize(8).fillColor(`rgb(${TEAL.join(',')})`)
         .text(lbl, sx, 386, { lineBreak: false, width: 110, align: 'center' });
      sx += 118;
    }

    doc.font('Helvetica').fontSize(9).fillColor(`rgb(${GRAY.join(',')})`)
       .text('rebooked.org  |  rebooked@rebooked.org', 50, doc.page.height - 50, { align: 'center', width: doc.page.width - 100 });

    // ── TABLE OF CONTENTS ───────────────────────────────────────────────────
    doc.addPage();
    fillRect(doc, 0, 0, doc.page.width, 8, TEAL);
    doc.moveDown(1.5);
    doc.font('Helvetica-Bold').fontSize(22).fillColor(`rgb(${NAVY.join(',')})`).text('Table of Contents');
    doc.moveDown(0.5);
    doc.rect(50, doc.y, doc.page.width - 100, 2).fill(`rgb(${GOLD.join(',')})`);
    doc.moveDown(1);

    const toc = [
      ['01', 'Product Hunt',          'producthunt.com'],
      ['02', 'PeerPush',              'peerpush.net'],
      ['03', 'Indie Hackers',         'indiehackers.com'],
      ['04', 'Hacker News (Show HN)', 'news.ycombinator.com'],
      ['05', 'Reddit r/SaaS',         'reddit.com/r/SaaS'],
      ['06', 'Reddit r/smallbusiness','reddit.com/r/smallbusiness'],
      ['07', 'AlternativeTo',         'alternativeto.net'],
      ['08', 'MicroLaunch',           'microlaunch.net'],
      ['09', 'Uneed.app',             'uneed.app'],
      ['10', 'Fazier',                'fazier.com'],
      ['11', 'Launch Day Checklist',  ''],
    ];

    for (const [num, name, url] of toc) {
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(12).fillColor(`rgb(${TEAL.join(',')})`)
         .text(num, 50, y, { lineBreak: false, width: 30 });
      doc.font('Helvetica-Bold').fontSize(12).fillColor(`rgb(${NAVY.join(',')})`)
         .text(name, 85, y, { lineBreak: false, width: 260 });
      if (url) {
        doc.font('Helvetica').fontSize(9).fillColor(`rgb(${GRAY.join(',')})`)
           .text(url, 350, y + 2, { lineBreak: false });
      }
      doc.moveDown(0.9);
    }

    // ── 01 PRODUCT HUNT ─────────────────────────────────────────────────────
    sectionHeader(doc, '01 - Product Hunt');
    platformBlock(doc, 'Product Hunt', 'producthunt.com/posts/new', [
      ['Name', 'Rebooked'],
      ['Tagline (60 chars)', 'AI SMS that recovers revenue from no-shows & cancellations'],
      ['Description (260 chars)', 'Rebooked turns missed calls, no-shows, and cancellations into recovered bookings - automatically. 19 pre-built SMS automations for appointment businesses. $199/month + 15% of recovered revenue. Free if no positive ROI within 35 days.'],
      ['Topics (5)', 'SMS Marketing | Appointment Scheduling | Revenue Recovery | AI Automation | Small Business'],
      ["Hunter's Comment (~300 words)",
`Hey Product Hunt! I'm Brendan, the solo founder behind Rebooked.

I built this because I kept watching appointment businesses - salons, clinics, consultants - silently bleed revenue every single month. A no-show here. A last-minute cancellation there. A missed call that never got followed up. None of it feels catastrophic in the moment, but it adds up to thousands of dollars gone every year.

The problem isn't that owners don't care. It's that following up manually is exhausting, inconsistent, and easy to skip when you're already stretched thin. SMS follow-ups work - response rates are 6x higher than email - but setting them up properly takes time nobody has.

Rebooked fixes this with 19 pre-built SMS automations that run automatically:
- 24hr & 2hr appointment reminders
- No-show check-in + rebook offer
- Cancellation flurry to your waiting list
- 30-day and 90-day win-backs
- Review requests after successful visits
- Birthday promos, loyalty milestones, and more

The model is simple: $199/month + 15% of recovered revenue. Backed by a 35-day ROI guarantee - if Rebooked doesn't pay for itself, you pay nothing.

I'd love your feedback, questions, and upvotes if you think this solves a real problem!`],
      ['Maker Comment (pin after launch)',
`Thanks so much for the support everyone!

A few things I'm asked most:

> Does it work with my booking software?
Yes - Rebooked integrates with your existing calendar and booking tools.

> What about TCPA compliance?
Built-in. Every automation respects opt-outs and quiet hours automatically.

> Is the 35-day guarantee real?
100%. If you don't see positive ROI in 35 days, you walk away paying nothing. No fine print.

Drop your questions below - I read every comment personally.`],
    ]);

    // ── 02 PEERPUSH ─────────────────────────────────────────────────────────
    sectionHeader(doc, '02 - PeerPush');
    platformBlock(doc, 'PeerPush', 'peerpush.net (submit via dashboard)', [
      ['Name', 'Rebooked'],
      ['Tagline', "AI SMS revenue recovery for appointment businesses - free if it doesn't pay for itself"],
      ['Description (300 words)',
`Rebooked is an AI-powered SMS platform built specifically for appointment businesses - salons, clinics, spas, consultants, and anyone who lives and dies by their booking calendar.

Every month, appointment businesses lose thousands in revenue from no-shows, last-minute cancellations, and missed calls that never get followed up. The fixes are simple - a timely text here, a rebook offer there - but doing it manually is exhausting and inconsistent.

Rebooked automates all of it with 19 pre-built SMS automations:

- Appointment reminders (24hr + 2hr)
- No-show check-in and rebook offer
- Cancellation acknowledgement + post-cancellation rebook
- Cancellation flurry - instant SMS blast to your waiting list when a slot opens
- Post-visit feedback and upsell
- 3-day and 7-day lead follow-ups
- 30-day and 90-day win-back campaigns
- New lead welcome message
- Birthday promos and loyalty milestones
- Review requests after successful appointments
- Calendar sync and rescheduling automations

The pricing is straightforward: $199/month + 15% of recovered revenue. I only make money when you make money.

35-day ROI guarantee. If you don't see positive ROI within 35 days, you pay nothing. No contracts. No fine print.

Referral program: earn $50/month for 6 months for every active client you refer.

Built by a solo founder who got tired of watching great small businesses leave money on the table.`],
      ['Categories', 'Automation & Workflow | AI Tools | Customer Support | Product Marketing'],
      ['Audiences', 'Small Businesses | Solopreneurs | Founders & CEOs | Non-Technical Users'],
      ['Use Cases', 'Scheduling & Booking | Workflow Automation | Lead Generation | SMS Marketing'],
    ]);

    // ── 03 INDIE HACKERS ────────────────────────────────────────────────────
    sectionHeader(doc, '03 - Indie Hackers');
    platformBlock(doc, 'Indie Hackers', 'indiehackers.com/products (submit your product)', [
      ['Post Title', "I built an AI SMS tool that recovers revenue from no-shows - here's what I learned"],
      ['Full Post (~400 words)',
`I've been working on Rebooked for the past several months, and I want to share what I've built and why.

The problem is simple: appointment businesses (salons, clinics, consultants) lose a massive chunk of revenue every month to no-shows and cancellations. Industry estimates put no-show rates at 10-30% depending on the sector. That's not a rounding error - for a busy salon doing $15k/month, that could be $1,500-$4,500 walking out the door.

The fix is simple too. SMS follow-ups work. People read texts. A "Hey, we noticed you missed your appointment - want to rebook?" message sent at the right time converts surprisingly well.

But nobody does it consistently because it's manual, time-consuming, and easy to deprioritize when you're already running a business.

So I built Rebooked.

It's a multi-tenant SaaS with 19 pre-built SMS automations. Owners connect their calendar, toggle on the automations they want, and walk away. The system handles reminders, no-show follow-ups, cancellation flurries to waiting lists, win-backs, review requests, birthday promos - everything.

Pricing: $199/month + 15% of recovered revenue. I only win when my customers win. 35-day ROI guarantee - if the platform doesn't pay for itself in the first 35 days, the client pays nothing.

I'm currently running a crowdfunding campaign with a "Founder Client" tier - 20 lifetime free spots for early believers.

Some honest numbers so far:
- Built solo over ~4 months
- 19 automations live and tested
- Stack: React 19, Node/tRPC, MySQL, Drizzle ORM
- First clients onboarding now

If you run or know an appointment business, I'd genuinely love your feedback. And if you're an indie hacker building in the SMB space, I'd love to compare notes.

Check it out at rebooked.org or drop a comment - I'm active and read everything.`],
    ]);

    // ── 04 HACKER NEWS ──────────────────────────────────────────────────────
    sectionHeader(doc, '04 - Hacker News (Show HN)');
    platformBlock(doc, 'Hacker News', 'news.ycombinator.com/submit', [
      ['Post Title (80 chars max)', 'Show HN: Rebooked - AI SMS revenue recovery for appointment businesses'],
      ['Body Post (~200 words)',
`I built Rebooked after noticing that appointment-based small businesses (salons, clinics, consultants) consistently lose 10-30% of potential revenue to no-shows and cancellations - not because they don't care, but because manual follow-up is inconsistent.

SMS has 98% open rates and 6x higher response rates than email, but setting up automations properly requires tools that are either too generic or too expensive for a solo salon owner.

Rebooked is a multi-tenant SaaS with 19 pre-built SMS automations:
- Reminders (24hr, 2hr)
- No-show check-in + rebook offer
- Cancellation flurry to waiting list
- Win-back campaigns (30-day, 90-day)
- Review requests, birthday promos, loyalty milestones

Stack: React 19 + Vite, Node.js + tRPC, MySQL + Drizzle ORM, Stripe for billing.

Business model: $199/month + 15% of recovered revenue. 35-day ROI guarantee.

Would appreciate technical feedback on the approach - particularly around multi-tenant data isolation and the automation trigger architecture.

rebooked.org`],
    ]);

    // ── 05 REDDIT r/SaaS ────────────────────────────────────────────────────
    sectionHeader(doc, '05 - Reddit r/SaaS');
    platformBlock(doc, 'Reddit', 'reddit.com/r/SaaS', [
      ['Post Title', 'I built a SMS automation tool for appointment businesses after seeing how much revenue they lose to no-shows'],
      ['Body (~300 words)',
`Not a pitch - genuinely want feedback from this community.

Background: I kept bumping into appointment business owners who were frustrated by the same problem. A customer books, then doesn't show. Or cancels last minute. Or a missed call never gets followed up. Each one feels small, but the cumulative revenue loss is significant.

I looked at the existing tools. Most are either:
a) Generic SMS platforms that require you to build automations from scratch
b) All-in-one booking platforms that charge a ton and treat SMS as a footnote
c) Enterprise solutions priced for chains, not solo operators

So I built Rebooked - a SaaS specifically for appointment businesses with 19 pre-built SMS automations ready to toggle on. Reminders, no-show recovery, cancellation flurry to waiting list, win-backs, review requests, loyalty, birthday promos.

Pricing: $199/month + 15% of recovered revenue. The revenue share keeps me aligned with customers - I only win when they win.

35-day ROI guarantee: if the platform doesn't generate positive ROI in 35 days, they pay nothing.

I'm a solo founder. Built it over ~4 months. Currently in early access.

A few things I'd genuinely appreciate feedback on:
1. Is $199/month + 15% rev share the right model, or would flat-rate be less friction?
2. How would you position this against GoHighLevel for small businesses?
3. Any experience targeting this specific vertical (salons, clinics, etc.)?

Happy to answer questions and share more details. Not here to spam - just genuinely want to build something useful and would love input from people who understand SaaS.

rebooked.org if you want to look`],
    ]);

    // ── 06 REDDIT r/smallbusiness ───────────────────────────────────────────
    sectionHeader(doc, '06 - Reddit r/smallbusiness');
    platformBlock(doc, 'Reddit', 'reddit.com/r/smallbusiness', [
      ['Post Title', 'Built a tool to help appointment businesses recover revenue from no-shows - happy to share what I learned'],
      ['Body (~300 words)',
`Hey everyone. I'm a solo founder and I built a tool called Rebooked specifically for appointment businesses - salons, clinics, spas, consultants, anyone who runs on a booking calendar.

The problem I kept hearing: business owners losing significant revenue every month to no-shows and cancellations, but not having time to manually follow up with every customer.

Rebooked sends automated SMS messages at exactly the right moment:
- 24 hours before the appointment: a friendly reminder
- 2 hours before: a quick check-in
- If someone no-shows: a gentle follow-up with a rebook offer
- If someone cancels: an instant SMS to your waiting list to fill the slot
- After a great visit: a review request
- After 30 days of no contact: a win-back offer

Every message is customizable. Everything runs automatically in the background.

Pricing: $199/month + 15% of revenue you recover through the platform. If it doesn't pay for itself within 35 days, you pay nothing.

I wanted to build something that actually makes sense for a small business owner - not $500/month enterprise software, not a DIY tool that requires hours to set up. Just something that works out of the box for the specific problems appointment businesses face.

If you run a salon, clinic, or any kind of appointment business and this sounds useful - or if you think I've got something wrong - I'd genuinely love to hear from you.

You can check it out at rebooked.org or email me directly at rebooked@rebooked.org.

Thanks for reading.`],
    ]);

    // ── 07 ALTERNATIVETO ────────────────────────────────────────────────────
    sectionHeader(doc, '07 - AlternativeTo');
    platformBlock(doc, 'AlternativeTo', 'alternativeto.net/software/add/', [
      ['Product Name', 'Rebooked'],
      ['Short Description (500 chars)',
`AI-powered SMS revenue recovery for appointment businesses. 19 pre-built automations handle no-show follow-ups, cancellation recovery, waiting list flurries, win-back campaigns, review requests, birthday promos, and loyalty milestones. $199/month + 15% of recovered revenue. 35-day ROI guarantee - free if it doesn't pay for itself. Built for salons, clinics, spas, and consultants.`],
      ['Categories', 'SMS Marketing | Appointment Scheduling | Business Automation | Customer Retention'],
      ['List as Alternative To', 'GoHighLevel | Podium | NexHealth | Mindbody | Acuity Scheduling'],
      ['Website', 'rebooked.org'],
      ['License', 'Commercial (SaaS)'],
      ['Platforms', 'Web'],
    ]);

    // ── 08 MICROLAUNCH ──────────────────────────────────────────────────────
    sectionHeader(doc, '08 - MicroLaunch');
    platformBlock(doc, 'MicroLaunch', 'microlaunch.net/submit', [
      ['Name', 'Rebooked'],
      ['Tagline', 'AI SMS revenue recovery for appointment businesses'],
      ['Short Description (150 words)',
`Rebooked helps appointment businesses - salons, clinics, consultants - automatically recover revenue from no-shows, cancellations, and missed follow-ups using AI-powered SMS.

19 pre-built automations toggle on in seconds: appointment reminders, no-show rebook offers, cancellation flurries to your waiting list, 30/90-day win-backs, review requests, birthday promos, and loyalty milestones.

Pricing: $199/month + 15% of recovered revenue. 35-day ROI guarantee - if it doesn't pay for itself, you pay nothing.`],
      ['Long Description (300 words)',
`Appointment businesses silently lose thousands every month. A no-show here, a last-minute cancellation there, a missed call that never gets followed up. It adds up.

The fix isn't complicated - a well-timed SMS converts. Studies consistently show SMS has 98% open rates and customers respond within minutes. But sending those messages manually is exhausting and falls apart the moment you're busy.

Rebooked automates all of it. Here's what the 19 automations cover:

Reminders: 24-hour and 2-hour appointment reminders that dramatically cut no-shows.

Recovery: When someone doesn't show, an automated check-in message goes out. When someone cancels, the slot gets offered to your waiting list instantly.

Re-engagement: 3-day and 7-day lead follow-ups. 30-day and 90-day win-back campaigns for customers who've gone quiet.

Relationship: Post-visit feedback, upsell offers, review requests, birthday promos, and loyalty milestone messages.

Everything is customizable and TCPA-compliant. Multi-tenant architecture means your data stays yours.

Pricing: $199/month + 15% of the revenue you recover. I only make money when you make money. If Rebooked doesn't generate positive ROI within 35 days, you pay nothing.

Referral program: earn $50/month for 6 months for every active client you refer.

Built by a solo founder. rebooked.org`],
    ]);

    // ── 09 UNEED.APP ────────────────────────────────────────────────────────
    sectionHeader(doc, '09 - Uneed.app');
    platformBlock(doc, 'Uneed.app', 'uneed.app/submit', [
      ['Name', 'Rebooked'],
      ['Tagline (50 chars max)', 'SMS revenue recovery for appointment businesses'],
      ['Description (200 chars max)', 'AI-powered SMS automations recover revenue from no-shows & cancellations. 19 ready-to-toggle flows. $199/mo + 15% of recovered revenue. Free if no ROI in 35 days.'],
      ['Tags', 'SMS | Automation | Appointments | Revenue Recovery | AI | Small Business | Bookings'],
      ['Website', 'rebooked.org'],
      ['Pricing Type', 'Subscription + Revenue Share'],
    ]);

    // ── 10 FAZIER ───────────────────────────────────────────────────────────
    sectionHeader(doc, '10 - Fazier');
    platformBlock(doc, 'Fazier', 'fazier.com/submit (upvote 2 products first)', [
      ['Name', 'Rebooked'],
      ['Tagline', 'AI SMS that turns no-shows and cancellations into recovered revenue'],
      ['Description (250 words)',
`Rebooked is an AI-powered SMS platform built for appointment businesses - salons, clinics, spas, and consultants who lose revenue every month to no-shows, cancellations, and missed follow-ups.

Instead of chasing customers manually, Rebooked runs 19 pre-built automations in the background:

> Appointment reminders (24hr + 2hr before)
> No-show check-in and rebook offer
> Cancellation flurry - instant SMS to your waiting list when a slot opens
> Post-cancellation rebook campaign
> 3-day and 7-day new lead follow-ups
> 30-day and 90-day win-back campaigns
> Post-visit review requests and upsell messages
> Birthday promos and loyalty milestones
> Calendar sync and rescheduling automations

Set it up once, then forget it. Every message is customizable and TCPA-compliant.

Pricing: $199/month + 15% of recovered revenue. I only succeed when you succeed.

35-day ROI guarantee: if Rebooked doesn't generate positive ROI in your first 35 days, you pay nothing.

rebooked.org | rebooked@rebooked.org`],
      ['Categories', 'Automation & Workflow | AI Tools | Marketing | Small Business'],
    ]);

    // ── 11 LAUNCH DAY CHECKLIST ─────────────────────────────────────────────
    sectionHeader(doc, '11 - Launch Day Checklist');

    doc.font('Helvetica-Bold').fontSize(13).fillColor(`rgb(${NAVY.join(',')})`).text('Recommended Launch Order');
    doc.moveDown(0.5);

    const order = [
      ['1. Indie Hackers',          'Post 2-3 days before launch. Build a warm audience and collect early feedback. Pin the post.'],
      ['2. Hacker News',            'Post Show HN between 8-10am EST on a weekday (Tuesday-Thursday best). Watch comments live.'],
      ['3. Reddit r/SaaS',          'Post same morning as HN. Engage comments within first hour - Reddit rewards early engagement.'],
      ['4. Reddit r/smallbusiness', 'Post 1-2 hours after r/SaaS to avoid looking like spam. Different audience, different angle.'],
      ['5. Product Hunt',           'Schedule for 12:01am PST (PH resets daily). Best days: Tuesday-Thursday. Tell your network in advance.'],
      ['6. PeerPush',               'Submit the same day as Product Hunt. Cross-promote both in your Indie Hackers post.'],
      ['7. MicroLaunch',            'Submit day of launch - runs for 30 days so more forgiving on timing.'],
      ['8. Uneed.app',              'Submit in the evening of launch day. Daily competition resets, so pick a quieter day if possible.'],
      ['9. Fazier',                 'Upvote 2 products first, then submit. Good for ongoing discovery, less time-sensitive.'],
      ['10. AlternativeTo',         'Submit any time - this is an evergreen SEO play. Shows up in Google searches for alternatives.'],
    ];

    for (const [step, tip] of order) {
      if (doc.y > doc.page.height - 100) {
        doc.addPage();
        fillRect(doc, 0, 0, doc.page.width, 8, TEAL);
        doc.moveDown(1);
      }
      doc.font('Helvetica-Bold').fontSize(10).fillColor(`rgb(${TEAL.join(',')})`).text(s(step), { continued: false });
      doc.font('Helvetica').fontSize(9).fillColor(`rgb(${NAVY.join(',')})`)
         .text(s(tip), { width: doc.page.width - 100 });
      doc.moveDown(0.7);
    }

    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(`rgb(${NAVY.join(',')})`).text('Cross-Promotion Strategy');
    doc.moveDown(0.5);

    const tips = [
      'Link your Product Hunt launch in your Indie Hackers post - ask IH followers to upvote on PH.',
      'Reply to every comment on every platform on launch day. Algorithms reward engagement velocity.',
      'Screenshot your Product Hunt ranking and post it as an update on Indie Hackers and Reddit.',
      'DM past connections (LinkedIn, Twitter/X) the morning of your PH launch asking for an upvote.',
      "Add a banner to rebooked.org on launch day: \"We're live on Product Hunt today!\"",
      '"We hit #2 on Product Hunt - thank you!" - cross-posting wins drives more traffic.',
      'AlternativeTo is evergreen - update your listing monthly to stay fresh in search results.',
      'Collect emails from every platform during launch week for your early access list.',
    ];

    for (const tip of tips) {
      if (doc.y > doc.page.height - 80) {
        doc.addPage();
        fillRect(doc, 0, 0, doc.page.width, 8, TEAL);
        doc.moveDown(1);
      }
      doc.save().circle(56, doc.y + 5, 3).fill(`rgb(${GOLD.join(',')})`).restore();
      doc.font('Helvetica').fontSize(9).fillColor(`rgb(${NAVY.join(',')})`)
         .text(s(tip), 65, doc.y, { width: doc.page.width - 115 });
      doc.moveDown(0.6);
    }

    // ── BACK COVER ──────────────────────────────────────────────────────────
    doc.addPage();
    fillRect(doc, 0, 0, doc.page.width, doc.page.height, NAVY);
    fillRect(doc, 0, 0, doc.page.width, 8, TEAL);
    fillRect(doc, 0, doc.page.height - 8, doc.page.width, 8, GOLD);

    const midY = doc.page.height / 2 - 60;
    doc.font('Helvetica-Bold').fontSize(28).fillColor(`rgb(${TEAL.join(',')})`)
       .text('Ready to launch?', 50, midY, { align: 'center', width: doc.page.width - 100 });
    doc.font('Helvetica').fontSize(14).fillColor(`rgb(${WHITE.join(',')})`)
       .text('Go recover some revenue.', 50, midY + 45, { align: 'center', width: doc.page.width - 100 });
    doc.font('Helvetica-Bold').fontSize(12).fillColor(`rgb(${GOLD.join(',')})`)
       .text('rebooked.org  |  rebooked@rebooked.org', 50, midY + 90, { align: 'center', width: doc.page.width - 100 });

    doc.end();
  });
}

// ── Standalone entry point ───────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  const outPath = process.argv[2] || resolve(dirname(__filename), '../../../Rebooked_Launch_Kit.pdf');
  generateLaunchKit(outPath)
    .then(() => console.log('PDF written to:', outPath))
    .catch(err => { console.error('Error:', err); process.exit(1); });
}
