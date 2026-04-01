/**
 * Simple {{placeholder}} template engine with business-type aware data.
 */

const BUSINESS_TYPE_KEYWORDS = {
  salon: ['hair', 'salon', 'hairdress', 'cosmetol', 'beauty', 'nail', 'lash', 'brow', 'stylist'],
  barber: ['barber'],
  spa: ['spa', 'wellness', 'massage', 'aesthetic', 'medspa', 'med spa', 'day spa', 'skin care', 'skincare', 'facial'],
  tattoo: ['tattoo', 'piercing', 'body art', 'ink'],
  clinic: ['dental', 'dentist', 'chiropract', 'physiother', 'physical therap', 'veterinar', 'optometr', 'dermatol', 'medical practice', 'doctor', 'physician', 'orthodont', 'podiatr'],
  fitness: ['fitness', 'gym', 'personal train', 'yoga', 'pilates', 'crossfit'],
};

const PAIN_POINTS = {
  salon: {
    pain: 'empty chairs from last-minute cancellations and no-shows',
    stat: 'The average salon loses $67,000 per year to no-shows and cancellations',
    hook: 'How many chairs were empty this week because someone just didn\'t show up?',
    recovery: '40% of no-shows and 55% of cancellations',
  },
  barber: {
    pain: 'clients booking and not turning up — especially on your busiest days',
    stat: 'Barbershops see a 20-30% no-show rate without automated reminders',
    hook: 'How often do you have a full book but half the chairs empty?',
    recovery: '40% of no-shows and 55% of cancellations',
  },
  spa: {
    pain: 'high-value treatment slots going unfilled from last-minute cancellations',
    stat: 'The average spa loses over $1,200 per month to empty appointment slots',
    hook: 'How much revenue are you leaving on the table from cancelled or missed treatments?',
    recovery: '40% of no-shows and 55% of cancellations',
  },
  tattoo: {
    pain: 'clients booking sessions and ghosting — even after deposits',
    stat: 'Tattoo studios report 8-20% no-show rates, with custom work slots hardest to refill',
    hook: 'How many hours did you lose last month to clients who just didn\'t show?',
    recovery: '40% of no-shows and 55% of cancellations',
  },
  clinic: {
    pain: 'patient no-shows costing you thousands in lost chair time and admin overhead',
    stat: 'Medical and dental practices average 5-7% revenue loss from patient no-shows',
    hook: 'How many patient slots went unfilled last week because someone forgot or cancelled last minute?',
    recovery: '40% of no-shows and 55% of cancellations',
  },
  fitness: {
    pain: 'booked sessions where clients don\'t turn up — killing your schedule and revenue',
    stat: 'Personal training studios lose 15-25% of revenue to missed sessions',
    hook: 'How many sessions did you prep for this month where the client just didn\'t show?',
    recovery: '40% of no-shows and 55% of cancellations',
  },
  other: {
    pain: 'missed appointments and last-minute cancellations eating into your revenue',
    stat: 'The average appointment business loses 10-20% of revenue to no-shows',
    hook: 'How much revenue are you losing every month to clients who don\'t show up?',
    recovery: '40% of no-shows and 55% of cancellations',
  },
};

export function classifyBusinessType(text) {
  const lower = (text || '').toLowerCase();
  for (const [type, keywords] of Object.entries(BUSINESS_TYPE_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return type;
  }
  return 'other';
}

export function getPainPoint(businessType) {
  return PAIN_POINTS[businessType] || PAIN_POINTS.other;
}

export function render(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? '');
}

export function buildTemplateData(prospect, business) {
  const businessType = classifyBusinessType(
    [business?.naics_description, business?.sic_description, business?.linkedin_category, business?.business_name].join(' ')
  );
  const pp = getPainPoint(businessType);

  return {
    business_name: business?.business_name || prospect?.company_name || 'your business',
    owner_name: prospect?.first_name || 'there',
    owner_full_name: prospect?.full_name || prospect?.first_name || '',
    owner_title: prospect?.job_title || 'Owner',
    business_type: businessType,
    business_type_label: businessType === 'other' ? 'appointment-based business' : businessType,
    city: prospect?.city || business?.city || '',
    state: prospect?.region || business?.region || '',
    email: prospect?.professional_email || prospect?.email || '',
    phone: prospect?.phone || prospect?.mobile_phone || '',
    website: business?.website || business?.domain || '',
    linkedin: prospect?.linkedin || '',
    pain_point: pp.pain,
    stat: pp.stat,
    hook: pp.hook,
    recovery_rate: pp.recovery,
    pricing: '$199/month + 15% of recovered revenue',
    guarantee: 'free for 35 days — if I don\'t deliver positive ROI, you pay nothing',
    referral: '$50/month for 6 months for every client you refer',
    rebooked_website: 'rebooked.org',
    rebooked_email: 'rebooked@rebooked.org',
    sender_name: 'Brend',
  };
}

export { PAIN_POINTS, BUSINESS_TYPE_KEYWORDS };
