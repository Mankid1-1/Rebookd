/**
 * Generates a summary report of the prospecting run.
 */

export function generateReport(prospects, businesses, dateStr) {
  const byType = {};
  const byState = {};
  let withEmail = 0;
  let withPhone = 0;
  let withBoth = 0;

  for (const p of prospects) {
    const type = p._business_type || 'other';
    byType[type] = (byType[type] || 0) + 1;

    const state = p.region || p.state || 'Unknown';
    byState[state] = (byState[state] || 0) + 1;

    const hasEmail = !!(p.professional_email || p.email);
    const hasPhone = !!(p.phone || p.mobile_phone);
    if (hasEmail) withEmail++;
    if (hasPhone) withPhone++;
    if (hasEmail && hasPhone) withBoth++;
  }

  const sortedTypes = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const sortedStates = Object.entries(byState).sort((a, b) => b[1] - a[1]).slice(0, 15);

  let report = `
=====================================
  REBOOKED PROSPECTING REPORT
  Generated: ${dateStr}
=====================================

SUMMARY
-------
Total Businesses Found:    ${businesses.length}
Total Prospects Found:     ${prospects.length}
Prospects with Email:      ${withEmail}
Prospects with Phone:      ${withPhone}
Prospects with Both:       ${withBoth} (highest priority)

BREAKDOWN BY BUSINESS TYPE
--------------------------
${sortedTypes.map(([type, count]) => `  ${type.padEnd(15)} ${count}`).join('\n')}

TOP REGIONS
-----------
${sortedStates.map(([state, count]) => `  ${state.padEnd(20)} ${count}`).join('\n')}

PRIORITY TARGETS
----------------
Prospects with both email AND phone in appointment-heavy
categories (salon, barber, spa, tattoo, clinic) are your
highest-priority outreach targets.

High-priority count: ${withBoth}

OUTREACH STRATEGY
-----------------
1. EMAIL SEQUENCE (3 touches over 7 days)
   - Day 0: Initial cold email — pain point + guarantee
   - Day 3: Follow-up — stat + urgency
   - Day 7: Breakup email — final touch + referral mention

2. COLD CALL (parallel to email)
   - Call within 24hrs of first email
   - Use the personalized scripts in call-scripts/
   - Reference objection-handling.txt for common pushbacks

3. LINKEDIN (supplement)
   - Connect with prospects who have LinkedIn profiles
   - Personalize connection note with business-specific hook

FILES GENERATED
---------------
  master-prospect-list.csv    All prospects with contact info
  emails/batch-cold-emails.csv    Mail-merge ready emails
  emails/by-type/              Emails grouped by business type
  call-scripts/batch-call-scripts.csv    Dialer-ready scripts
  call-scripts/by-type/        Scripts grouped by business type
  complaint-leads.csv          Leads from web research
  objection-handling.txt       Common objections + responses
  summary-report.txt           This file

=====================================
  rebooked.org | rebooked@rebooked.org
=====================================
`.trim();

  return report;
}
