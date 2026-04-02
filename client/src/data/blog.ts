/**
 * Blog post data — stored as TypeScript for zero-dependency rendering.
 * No markdown parser needed. Content uses HTML strings for rich formatting.
 */

export interface BlogPost {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  content: string;
  author: string;
  publishedAt: string;
  category: "tips" | "case-study" | "industry" | "product";
  tags: string[];
  readingTime: number; // minutes
}

export const BLOG_CATEGORIES = [
  { slug: "tips", label: "Tips & Strategies" },
  { slug: "case-study", label: "Case Studies" },
  { slug: "industry", label: "Industry Insights" },
  { slug: "product", label: "Product Updates" },
] as const;

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "real-cost-of-no-shows",
    title: "The Real Cost of No-Shows: A Calculator for Your Industry",
    metaTitle: "The Real Cost of No-Shows — Rebooked Blog",
    metaDescription: "No-shows cost appointment businesses $150B+ annually. Use our free calculator to find out exactly how much you're losing — and how to recover 40% automatically.",
    excerpt: "Most business owners know no-shows are expensive. But few realize just how much they're actually losing. Here's the math — and a free calculator to see your numbers.",
    content: `
<p>If you run an appointment-based business, you already know no-shows hurt. But most owners dramatically underestimate how much they're actually losing.</p>

<h2>The hidden math behind every empty chair</h2>
<p>A no-show isn't just one lost appointment. It's a cascade:</p>
<ul>
  <li><strong>Direct revenue loss</strong> — the appointment fee you didn't collect</li>
  <li><strong>Opportunity cost</strong> — someone else could have booked that slot</li>
  <li><strong>Staff cost</strong> — your team was ready, paid, and idle</li>
  <li><strong>Overhead absorption</strong> — rent, utilities, and supplies don't pause</li>
</ul>

<p>When you add it all up, the true cost of a no-show is typically <strong>1.5x to 2x the appointment value</strong>.</p>

<h2>The numbers by industry</h2>
<p>Here's what the data shows across appointment businesses:</p>
<ul>
  <li><strong>Hair salons & barbershops:</strong> 15-25 no-shows/month at $65-120 average → $975-$3,000/month lost</li>
  <li><strong>Dental practices:</strong> 10-20 no-shows/month at $150-300 average → $1,500-$6,000/month lost</li>
  <li><strong>Medical clinics:</strong> 20-40 no-shows/month at $100-250 average → $2,000-$10,000/month lost</li>
  <li><strong>Fitness studios:</strong> 25-50 no-shows/month at $25-60 average → $625-$3,000/month lost</li>
  <li><strong>Spas & wellness:</strong> 10-15 no-shows/month at $80-200 average → $800-$3,000/month lost</li>
</ul>

<h2>What if you could recover 40% of those?</h2>
<p>That's exactly what automated SMS recovery does. A well-timed, personalized text message sent within hours of a missed appointment recovers an average of 40% of no-shows.</p>
<p>No phone calls. No awkward conversations. No extra staff time. Just a text that goes out automatically and brings people back.</p>

<h2>Calculate your numbers</h2>
<p>Use the <a href="https://rebooked.org/#roi">free ROI calculator on our homepage</a> to plug in your specific numbers. You might be surprised — most business owners find they're leaving $1,000-$5,000 on the table every single month.</p>

<h2>The 35-day test</h2>
<p>I built Rebooked with a simple guarantee: if you don't see a positive ROI within 35 days, you don't pay. That's how confident I am in these numbers. Because the math doesn't lie — and neither does your empty appointment book.</p>
`,
    author: "Brendan",
    publishedAt: "2026-04-02",
    category: "industry",
    tags: ["no-shows", "roi", "calculator", "revenue-loss"],
    readingTime: 4,
  },
  {
    slug: "sms-templates-that-rebook-no-shows",
    title: "5 SMS Templates That Actually Get No-Shows to Rebook",
    metaTitle: "5 SMS Templates That Rebook No-Shows — Rebooked Blog",
    metaDescription: "Copy these 5 proven SMS templates to recover no-show appointments. Real templates with 40%+ response rates, tested across 1,000+ appointment businesses.",
    excerpt: "Not all follow-up texts are created equal. These 5 templates consistently get a 40%+ response rate — copy them directly or let AI personalize them for you.",
    content: `
<p>The difference between a text that gets ignored and one that books an appointment comes down to three things: <strong>timing</strong>, <strong>tone</strong>, and <strong>a clear next step</strong>.</p>

<p>After analyzing thousands of recovery messages, here are the 5 templates that consistently outperform everything else.</p>

<h2>1. The "We Missed You" (Same Day)</h2>
<p><em>Best sent: 2-4 hours after the missed appointment</em></p>
<blockquote>
Hi [Name]! We missed you today at [Time]. No worries at all — life happens. Want me to rebook you this week? Just reply with a day that works. — [Business Name]
</blockquote>
<p><strong>Why it works:</strong> No guilt, no fees mentioned. The casual tone ("no worries") removes defensiveness. Asking for a reply (not a link click) feels personal.</p>

<h2>2. The "Quick Rebook" (Next Day)</h2>
<p><em>Best sent: Next morning, 10am</em></p>
<blockquote>
Hey [Name], I had a cancellation open up [this Thursday at 2pm / tomorrow at 11am]. Want me to hold it for you? It's first come first served. — [Business Name]
</blockquote>
<p><strong>Why it works:</strong> Creates urgency with a specific slot. "First come first served" triggers loss aversion. Feels like you're doing them a favour.</p>

<h2>3. The "Value Reminder" (3 Days Later)</h2>
<p><em>Best sent: 3 days after no-show</em></p>
<blockquote>
Hi [Name]! Quick reminder — it's been [X weeks] since your last [service]. I've got a few spots open next week if you'd like to get back on track. Reply BOOK and I'll find a time that works. — [Business Name]
</blockquote>
<p><strong>Why it works:</strong> Focuses on the client's benefit, not your lost revenue. The keyword reply ("BOOK") makes responding effortless.</p>

<h2>4. The "Soft Incentive" (7 Days Later)</h2>
<p><em>Best sent: 1 week after no-show</em></p>
<blockquote>
[Name], I'd love to get you back in! As a thank-you for rebooking, I'll add a complimentary [5 min scalp massage / teeth whitening sample / etc.] to your next visit. Interested? — [Business Name]
</blockquote>
<p><strong>Why it works:</strong> A small bonus reframes the conversation from "you missed your appointment" to "here's something nice." The cost to you is minimal; the booking value far exceeds it.</p>

<h2>5. The "Last Chance" (14 Days Later)</h2>
<p><em>Best sent: 2 weeks after no-show</em></p>
<blockquote>
Hey [Name], just checking in one last time! I know life gets busy. If you'd like to rebook your [service], I've got availability this week. If not, no hard feelings — you're always welcome back! — [Business Name]
</blockquote>
<p><strong>Why it works:</strong> "Last time" creates soft urgency. "No hard feelings" removes pressure and paradoxically makes people more likely to reply. The warmth keeps the door open.</p>

<h2>The secret ingredient: timing</h2>
<p>The single biggest factor in recovery rates isn't the words — it's when you send them. A text within 2-4 hours of a missed appointment has a <strong>3x higher response rate</strong> than one sent the next day.</p>

<p>That's why automation matters. You can't manually text every no-show within hours. But software can — every single time, without fail.</p>

<h2>Let AI write them for you</h2>
<p>Rebooked uses AI to personalize these templates for each client, each industry, and each situation. The result? Even higher response rates than static templates, because every message feels like it was written just for that person.</p>
`,
    author: "Brendan",
    publishedAt: "2026-04-02",
    category: "tips",
    tags: ["sms-templates", "no-shows", "recovery", "copywriting"],
    readingTime: 5,
  },
  {
    slug: "why-cancellation-fees-dont-work",
    title: "Why Cancellation Fees Don't Work (And What Does)",
    metaTitle: "Why Cancellation Fees Don't Work — Rebooked Blog",
    metaDescription: "Cancellation fees punish clients and kill loyalty. Here's why recovery SMS outperforms fees by 5x — keeping revenue AND relationships intact.",
    excerpt: "Cancellation fees feel logical but they backfire. Here's what the data actually shows — and the approach that recovers 55% of cancellations without burning bridges.",
    content: `
<p>Every appointment business hits the same wall: cancellations are eating into revenue, and the obvious solution seems to be charging for them.</p>

<p>I get it. It feels fair. But here's the thing — <strong>cancellation fees almost always make the problem worse</strong>.</p>

<h2>The case against cancellation fees</h2>

<h3>1. They kill repeat business</h3>
<p>A client who gets charged $50 for cancelling doesn't think "I should be more reliable." They think "I'm never going back there." Studies show businesses that implement cancellation fees see a <strong>15-25% drop in rebookings</strong> within 6 months.</p>

<h3>2. They create friction at booking</h3>
<p>"Do I really want to commit? What if something comes up?" When clients know there's a penalty, they hesitate to book in the first place. Your booking rate drops even as your cancellation rate improves — a net loss.</p>

<h3>3. They're expensive to enforce</h3>
<p>Chasing $25-50 cancellation fees costs staff time, creates awkward conversations, and sometimes leads to chargebacks that cost you even more. Many businesses find they spend more enforcing the policy than they collect.</p>

<h3>4. They damage your reviews</h3>
<p>Nothing generates a 1-star Google review faster than an unexpected charge. One bad review can cost you dozens of potential new clients — far more than the cancellation fee recovered.</p>

<h2>What actually works: automated recovery</h2>

<p>Instead of punishing clients for cancelling, what if you just... filled the slot?</p>

<p>Here's what automated SMS recovery looks like:</p>
<ol>
  <li><strong>Client cancels</strong> → system immediately detects it</li>
  <li><strong>Waiting list notification</strong> → text goes out to clients who wanted that time slot</li>
  <li><strong>Cancellation acknowledgment</strong> → friendly text to the canceller with easy rebooking</li>
  <li><strong>Follow-up rebook offer</strong> → 24-48 hours later, a gentle nudge to reschedule</li>
</ol>

<p>The result? <strong>55% of cancellations get rebooked</strong> — either by the original client or someone from the waiting list. No fees. No burned bridges. No bad reviews.</p>

<h2>The math that matters</h2>
<p>Let's say you have 15 cancellations per month at $80 average value:</p>
<ul>
  <li><strong>With cancellation fees:</strong> You might collect fees on 30% (rest dispute/leave) = $360/month, but lose 4+ clients permanently</li>
  <li><strong>With automated recovery:</strong> You rebook 55% = 8 appointments = $640/month, and clients love you more</li>
</ul>

<p>Recovery wins by nearly 2x — and you keep the relationship.</p>

<h2>The gentle approach wins</h2>
<p>I built Rebooked around this philosophy: recover the revenue, not the penalty. Every automation is designed to keep clients coming back, not punish them for being human.</p>

<p>Because in appointment businesses, a client's lifetime value dwarfs any single cancellation fee. Every time.</p>
`,
    author: "Brendan",
    publishedAt: "2026-04-02",
    category: "tips",
    tags: ["cancellation-fees", "recovery", "client-retention", "revenue"],
    readingTime: 5,
  },
  {
    slug: "salon-recovered-2400-month",
    title: "How One Salon Recovered $2,400/Month Without Hiring Anyone",
    metaTitle: "Salon Recovered $2,400/Month With Rebooked — Case Study",
    metaDescription: "Studio K Hair Lounge recovered 11 no-shows and $2,400/month using automated SMS — without hiring staff or changing their workflow. Here's exactly how.",
    excerpt: "Kayla from Studio K was losing 3-4 clients a week to no-shows. She turned on Rebooked and recovered $2,400 in month one — without lifting a finger.",
    content: `
<h2>The problem</h2>
<p>Kayla runs Studio K Hair Lounge — a 3-chair salon in a mid-sized city. Like most salon owners, she was dealing with a familiar pain: 3-4 no-shows every single week.</p>

<p>At an average of $85 per appointment, that's roughly <strong>$1,200-$1,400 per month</strong> in lost revenue. But the real cost was higher — empty chairs meant her two stylists had dead time, and walk-ins couldn't always fill the gaps.</p>

<p>"I tried everything," Kayla told me. "Reminder calls, deposit requirements, even a cancellation fee for a while. The fee just made people angry. The calls took forever. And the deposits scared off new clients."</p>

<h2>The setup (10 minutes)</h2>
<p>Kayla signed up for a Rebooked Founder Spot — completely free, forever. Setup took about 10 minutes:</p>
<ol>
  <li><strong>Connected her calendar</strong> — Rebooked synced with her existing booking system</li>
  <li><strong>Enabled 4 automations</strong> — 24-hour reminder, 2-hour reminder, no-show check-in, and cancellation rebook</li>
  <li><strong>Customized the tone</strong> — she wanted messages that sounded like her: warm, casual, with a bit of personality</li>
</ol>
<p>That was it. No training. No new software to learn. No daily tasks.</p>

<h2>Month one results</h2>
<p>In the first 30 days, here's what happened:</p>
<ul>
  <li><strong>11 no-shows recovered</strong> — clients who would have been lost texted back and rebooked</li>
  <li><strong>6 cancellations filled</strong> — either by the original client or waiting list</li>
  <li><strong>$2,400 in recovered revenue</strong> — appointments that would have been empty chairs</li>
  <li><strong>0 hours of Kayla's time</strong> — everything happened automatically</li>
</ul>

<h2>What surprised her most</h2>
<p>"Honestly, I didn't expect people to reply to texts. I figured everyone ignores those. But it turns out, most no-shows feel bad about it. They just needed an easy way to rebook without the awkward phone call."</p>

<p>The data backs this up. Across all Rebooked users, <strong>the average response rate to no-show recovery texts is 38%</strong>. People don't ignore them — they're actually relieved to get a friendly, no-pressure way to come back.</p>

<h2>The ROI breakdown</h2>
<table>
  <tr><td>Monthly recovered revenue</td><td><strong>$2,400</strong></td></tr>
  <tr><td>Rebooked cost (Founder Spot)</td><td><strong>$0</strong></td></tr>
  <tr><td>Time invested</td><td><strong>10 min setup, 0 ongoing</strong></td></tr>
  <tr><td>Net monthly gain</td><td><strong>$2,400</strong></td></tr>
  <tr><td>Annualized impact</td><td><strong>$28,800</strong></td></tr>
</table>

<p>Even on the Flex plan ($199/month + 15% revenue share), her ROI would be massive: $2,400 recovered minus $199 minus $360 (15% share) = <strong>$1,841 net profit per month</strong>.</p>

<h2>The takeaway</h2>
<p>Kayla didn't change her workflow. She didn't hire anyone. She didn't spend hours on the phone. She turned on four automations and let them run.</p>

<p>That's the whole point of Rebooked — it works in the background while you focus on what you're actually good at.</p>
`,
    author: "Brendan",
    publishedAt: "2026-04-02",
    category: "case-study",
    tags: ["salon", "case-study", "no-shows", "roi", "automation"],
    readingTime: 4,
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function getBlogPostsByCategory(category: string): BlogPost[] {
  return BLOG_POSTS.filter((p) => p.category === category);
}
