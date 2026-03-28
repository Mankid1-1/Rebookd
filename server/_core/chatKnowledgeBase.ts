/**
 * Rebooked AI Chat Knowledge Base
 * In-house help system — zero external API tokens.
 */

export interface KBEntry {
  id: string;
  keywords: string[];
  patterns: RegExp[];
  category: "getting-started" | "automations" | "leads" | "templates" | "billing" | "analytics" | "troubleshooting" | "features" | "messaging" | "settings";
  question: string;
  answer: string;
  relatedIds?: string[];
  priority?: number;
  /** Which skill levels should see this entry prioritized */
  skillLevels?: Array<"beginner" | "intermediate" | "advanced" | "expert">;
  /** Extra tip appended for beginners */
  beginnerTip?: string;
  /** Extra note appended for advanced/expert users */
  advancedNote?: string;
  /** Completely different answers per skill level (overrides default answer) */
  answerBySkill?: Partial<Record<"beginner" | "intermediate" | "advanced" | "expert", string>>;
}

export const KNOWLEDGE_BASE: KBEntry[] = [
  // ═══════════════════════════════════════════
  // GETTING STARTED
  // ═══════════════════════════════════════════
  {
    id: "what-is-rebooked",
    keywords: ["what", "rebooked", "about", "platform", "does", "overview"],
    patterns: [/what (is|does) rebooked/i, /tell me about/i, /overview/i],
    category: "getting-started",
    question: "What is Rebooked?",
    answer: "Rebooked is an SMS automation platform for salons and service businesses. It helps you recover no-shows, fill cancellations, capture leads 24/7, and automate follow-ups — all via text message. Everything runs automatically so you can focus on your clients.",
    relatedIds: ["how-automations-work", "getting-started-first"],
    priority: 10,
    skillLevels: ["beginner"],
    beginnerTip: "You don't need to understand everything right away — the key automations were already enabled for you during onboarding. Start by adding a few leads and watching the automations work!",
    advancedNote: "All 25+ automations and analytics features are available. Explore Automations, Analytics, and Settings for full configuration control.",
  },
  {
    id: "getting-started-first",
    keywords: ["start", "begin", "setup", "first", "new", "get started", "onboarding"],
    patterns: [/how (do i|to) (get started|start|begin)/i, /first steps/i, /set up/i],
    category: "getting-started",
    question: "How do I get started?",
    answer: "1. Complete onboarding by adding your business name and phone number.\n2. Go to **Leads** to add your first contacts.\n3. Visit **Automations** and enable your first automation (we recommend 'Welcome New Lead').\n4. Check **Templates** to customize your messages.\n5. View your **Dashboard** to track results!",
    relatedIds: ["add-leads", "enable-automation"],
    priority: 9,
    skillLevels: ["beginner", "intermediate"],
    beginnerTip: "Good news — essential automations were already enabled for you! Just add your first lead and Rebooked will start working in the background automatically.",
    advancedNote: "Skip to Automations to configure triggers, templates, and timing to your exact specifications.",
  },
  {
    id: "what-plan-do-i-need",
    keywords: ["plan", "pricing", "cost", "subscription", "starter", "growth", "scale", "price"],
    patterns: [/what plan/i, /how much/i, /pricing/i, /which plan/i],
    category: "billing",
    question: "What plan do I need?",
    answer: "Rebooked offers 3 plans:\n- **Starter** ($49/mo): Basic automations, up to 500 leads, core features.\n- **Growth** ($99/mo): All automations, unlimited leads, analytics, smart scheduling.\n- **Scale** ($199/mo): Everything in Growth + multi-location, priority support, advanced reporting.\n\nYou can manage your plan in **Settings > Billing**.",
    relatedIds: ["change-plan", "billing-portal"],
    priority: 8,
  },
  {
    id: "how-sms-works",
    keywords: ["sms", "text", "message", "send", "twilio", "telnyx", "phone"],
    patterns: [/how (does|do) (sms|text|messaging) work/i, /send (text|sms)/i],
    category: "getting-started",
    question: "How does SMS messaging work?",
    answer: "Rebooked sends SMS messages through Twilio or Telnyx (configured by your admin). Messages are sent from your business phone number. Each automation or manual message goes out as a standard text. Leads can reply directly, and their responses appear in your **Inbox**.",
    relatedIds: ["inbox-overview", "sms-not-sending"],
    priority: 7,
  },

  // ═══════════════════════════════════════════
  // LEADS
  // ═══════════════════════════════════════════
  {
    id: "add-leads",
    keywords: ["add", "create", "new", "lead", "contact", "import"],
    patterns: [/how (do i|to) add (a )?lead/i, /create (a )?lead/i, /add (contact|client)/i],
    category: "leads",
    question: "How do I add a new lead?",
    answer: "Go to **Leads** and click the **+ Add Lead** button. Enter their name and phone number. You can also set their status and add notes. Leads are automatically created when someone texts your business number or fills out a web form with Lead Capture enabled.",
    relatedIds: ["lead-statuses", "lead-capture-feature"],
    priority: 7,
    beginnerTip: "Start with just a name and phone number — that's all you need! Once you add a lead, the Welcome New Lead automation will text them automatically.",
  },
  {
    id: "lead-statuses",
    keywords: ["status", "statuses", "lead", "new", "contacted", "qualified", "booked", "lost"],
    patterns: [/what (are|do) (the )?lead status/i, /status mean/i],
    category: "leads",
    question: "What do the lead statuses mean?",
    answer: "- **New**: Just added, hasn't been contacted yet.\n- **Contacted**: You've sent at least one message.\n- **Qualified**: Interested and likely to book.\n- **Booked**: Has a confirmed appointment.\n- **Lost**: Didn't convert or unsubscribed.\n\nStatuses update automatically as automations run, or you can change them manually.",
    relatedIds: ["add-leads", "leads-filter"],
    priority: 6,
  },
  {
    id: "leads-filter",
    keywords: ["filter", "search", "find", "sort", "leads"],
    patterns: [/how (do i|to) filter/i, /search leads/i, /find (a )?lead/i],
    category: "leads",
    question: "How do I filter and search leads?",
    answer: "On the **Leads** page, use the search bar to find leads by name or phone. Use the status filter dropdown to show only leads in a specific status (New, Contacted, Booked, etc.). You can also sort by date added or last activity.",
    relatedIds: ["lead-statuses"],
    priority: 5,
  },
  {
    id: "send-manual-message",
    keywords: ["send", "message", "manual", "text", "reply", "inbox"],
    patterns: [/how (do i|to) send (a )?(message|text|sms)/i, /reply to/i, /message a lead/i],
    category: "leads",
    question: "How do I send a message to a lead?",
    answer: "Go to **Leads**, click on a lead's name to open their detail page, then type your message in the composer at the bottom. You can also pick a tone (friendly, professional, etc.) and Rebooked AI will adjust the wording for you. Click Send to deliver via SMS.",
    relatedIds: ["tone-rewrite", "inbox-overview"],
    priority: 7,
  },
  {
    id: "inbox-overview",
    keywords: ["inbox", "conversations", "messages", "replies"],
    patterns: [/what is (the )?inbox/i, /inbox/i, /see (my )?messages/i],
    category: "leads",
    question: "What is the Inbox?",
    answer: "The **Inbox** shows all conversations with your leads in one place. You can see incoming replies, send messages, and track conversation history. Unread messages are highlighted so you never miss a response.",
    relatedIds: ["send-manual-message"],
    priority: 6,
  },

  // ═══════════════════════════════════════════
  // AUTOMATIONS
  // ═══════════════════════════════════════════
  {
    id: "how-automations-work",
    keywords: ["automation", "automations", "how", "work", "trigger", "automatic"],
    patterns: [/how (do|does) automation/i, /what (is|are) automation/i, /automation work/i],
    category: "automations",
    question: "How do automations work?",
    answer: "Automations are pre-built workflows that run automatically. They have:\n- **Trigger**: What starts it (new lead, missed appointment, etc.)\n- **Actions**: What happens (send SMS, wait, follow up)\n- **Templates**: The message content with personalization.\n\nGo to **Automations** to browse, enable, and customize them. Each one shows its expected impact.",
    relatedIds: ["enable-automation", "automation-types"],
    priority: 9,
    beginnerTip: "Don't worry about the technical details — just think of automations as \"when X happens, send this text\". The essentials are already running for you!",
    advancedNote: "Each automation supports custom trigger configs, delay timing, and message templates. Use the Configure button for full control over every parameter.",
  },
  {
    id: "enable-automation",
    keywords: ["enable", "turn on", "activate", "start", "automation"],
    patterns: [/how (do i|to) (enable|turn on|activate)/i, /start (an )?automation/i],
    category: "automations",
    question: "How do I enable an automation?",
    answer: "Go to **Automations**, find the one you want, and click the toggle switch to enable it. Some automations require configuration first (like setting delay times). Enabled automations will start running automatically on matching events.",
    relatedIds: ["how-automations-work", "automation-types", "one-click-enable"],
    priority: 8,
    answerBySkill: {
      beginner: "Go to **Automations** and look for the green **Enable** button next to any automation. Just click it and it's on — no setup needed! The smart defaults work great out of the box. You can also hit **Enable All Recommended** at the top to turn on the best ones at once.",
      intermediate: "Go to **Automations** and click **Quick Setup** on any automation. You can adjust the timing or just enable with defaults. For more control, click **Full config** to customize everything.",
      advanced: "Go to **Automations** and click **Configure** to set up trigger types, delay timing, message templates, and conditions. Use the toggle switch to enable/disable any automation.",
    },
  },
  {
    id: "automation-types",
    keywords: ["types", "kinds", "list", "available", "automations", "what automations"],
    patterns: [/what (kind|type)s? of automation/i, /list (of )?automation/i, /available automation/i],
    category: "automations",
    question: "What automations are available?",
    answer: "Rebooked includes 16+ pre-built automations:\n- **Welcome New Lead**: Instant greeting for new contacts\n- **Confirmation Chase**: Confirm appointments before they happen\n- **No-Show Recovery**: Win back missed appointments\n- **Cancellation Rescue**: Fill cancelled slots fast\n- **Follow-Up**: Check in after appointments\n- **VIP Win-Back**: Re-engage inactive clients\n- **After-Hours Response**: 24/7 booking links\n- **Payment Reminders**: Card on file & deposits\n\nSome are plan-gated (Growth or Scale required).",
    relatedIds: ["no-show-feature", "cancellation-feature", "lead-capture-feature"],
    priority: 8,
  },
  {
    id: "one-click-enable",
    keywords: ["one click", "one-click", "auto", "enable", "quick", "button", "instant"],
    patterns: [/one[- ]?click/i, /quick (setup|enable)/i, /auto[- ]?(config|configure|enable)/i, /enable all/i],
    category: "automations",
    question: "What are the one-click enable buttons?",
    answer: "One-click enables let you activate automations instantly with smart defaults — no configuration needed. Just click the **Enable** button and the automation starts working. The default timing and messages are optimized for your industry.",
    relatedIds: ["enable-automation", "auto-enabled-automations", "automation-types"],
    priority: 8,
    skillLevels: ["beginner", "intermediate"],
    answerBySkill: {
      beginner: "The green **Enable** button next to each automation turns it on instantly with smart defaults. No setup needed! You can also hit **Enable All Recommended** at the top of the Automations page to activate the best ones at once. Everything just works out of the box.",
      intermediate: "Click **Quick Setup** on any automation to see the timing options and message preview before enabling. You can adjust the delay, or just click **Enable** to go with smart defaults. Click **Full config** for the complete configuration dialog.",
      advanced: "One-click buttons are available but you may prefer the full **Configure** dialog for precise control over triggers, timing, and templates. The defaults are sensible starting points you can customize later.",
    },
  },
  {
    id: "auto-enabled-automations",
    keywords: ["auto", "enabled", "automatic", "onboarding", "essential", "default"],
    patterns: [/auto[- ]?enabled/i, /automatically enabled/i, /essential automation/i, /which ones are on/i, /what got enabled/i, /default automation/i],
    category: "automations",
    question: "Which automations were auto-enabled for me?",
    answer: "Based on your experience level, Rebooked auto-enabled essential automations during onboarding to get you started right away. You can see which ones are active and toggle any of them off in the **Automations** page.",
    relatedIds: ["enable-automation", "one-click-enable", "skill-level-explained"],
    priority: 8,
    skillLevels: ["beginner", "intermediate"],
    answerBySkill: {
      beginner: "All 6 essential automations were enabled for you during onboarding:\n- **Booking Confirmation** — confirms new appointments\n- **Inbound Auto-Reply** — replies to incoming texts instantly\n- **Welcome New Lead** — greets new contacts\n- **No-Show Follow-Up** — reaches out after missed appointments\n- **1-Day Lead Follow-Up** — checks in with new leads\n- **Cancellation Rescue** — offers to rebook cancellations\n\nYou can toggle any of these off in **Automations** if you'd rather handle them manually.",
      intermediate: "The 3 core automations were enabled for you:\n- **Booking Confirmation** — confirms new appointments\n- **Inbound Auto-Reply** — replies to incoming texts\n- **Welcome New Lead** — greets new contacts\n\nThe extended automations (No-Show Follow-Up, Lead Follow-Up, Cancellation Rescue) are available but not auto-enabled — turn them on in **Automations** when you're ready.",
      advanced: "No automations were auto-enabled for your experience level — you have full manual control. Browse the **Automations** page to configure and enable each one to your specifications.",
      expert: "No automations were auto-enabled. You have complete manual control over all 25+ automations. Configure each one precisely in the **Automations** page.",
    },
  },
  {
    id: "skill-level-explained",
    keywords: ["skill", "level", "experience", "beginner", "intermediate", "advanced", "expert", "complexity"],
    patterns: [/skill level/i, /experience level/i, /beginner|intermediate|advanced|expert/i, /change (my )?level/i, /ui complexity/i],
    category: "settings",
    question: "What are skill levels and how do they affect my experience?",
    answer: "Rebooked adapts its interface based on your skill level. All features are always available — only the presentation changes:\n- **Beginner**: One-click buttons, auto-enabled automations, guided help\n- **Intermediate**: Quick setup panels, some auto-enables, moderate detail\n- **Advanced**: Full configuration dialogs, no auto-enables, all controls visible\n- **Expert**: Same as advanced with compact layout\n\nYour skill level was set during onboarding. All features remain accessible regardless of level.",
    relatedIds: ["auto-enabled-automations", "one-click-enable"],
    priority: 7,
    skillLevels: ["beginner", "intermediate", "advanced", "expert"],
  },
  {
    id: "automation-not-firing",
    keywords: ["automation", "not", "working", "firing", "trigger", "running", "broken"],
    patterns: [/automation (not|isn't|isnt) (working|firing|running|triggering)/i, /why (isn't|isnt|is not) my automation/i],
    category: "troubleshooting",
    question: "Why isn't my automation running?",
    answer: "Check these common causes:\n1. **Is it enabled?** Check the toggle in Automations.\n2. **Correct trigger?** Make sure the event type matches (e.g., 'new_lead' for Welcome automation).\n3. **Lead has phone?** SMS automations need a valid phone number.\n4. **Rate limits?** Rebooked limits SMS per hour/day to prevent spam.\n5. **Plan required?** Some automations need Growth or Scale plan.\n\nCheck **Admin > System Health** for error logs.",
    relatedIds: ["enable-automation", "sms-not-sending"],
    priority: 9,
  },

  // ═══════════════════════════════════════════
  // TEMPLATES
  // ═══════════════════════════════════════════
  {
    id: "templates-overview",
    keywords: ["template", "templates", "message", "customize"],
    patterns: [/what (is|are) template/i, /how (do )?template/i],
    category: "templates",
    question: "What are templates?",
    answer: "Templates are pre-written message blueprints with personalization variables like {{name}}, {{date}}, and {{time}}. When an automation runs, these variables get replaced with real lead data. Go to **Templates** to create, edit, or preview your messages.",
    relatedIds: ["template-variables", "create-template"],
    priority: 7,
    beginnerTip: "You don't need to create templates from scratch — each automation comes with a great default message that uses your business name and the client's name automatically.",
    advancedNote: "Templates support {{name}}, {{first_name}}, {{phone}}, {{business}}, {{date}}, {{time}}, {{link}}, and {{amount}} variables. Use the Message Generator tab in this chat to preview variations.",
  },
  {
    id: "template-variables",
    keywords: ["variable", "variables", "placeholder", "name", "date", "time", "personalize"],
    patterns: [/what variables/i, /template variable/i, /personali[sz]/i, /placeholder/i],
    category: "templates",
    question: "What template variables can I use?",
    answer: "Available variables:\n- **{{name}}** — Lead's full name\n- **{{first_name}}** — Lead's first name\n- **{{phone}}** — Lead's phone number\n- **{{business}}** — Your business name\n- **{{date}}** — Appointment date\n- **{{time}}** — Appointment time\n- **{{link}}** — Booking link\n- **{{amount}}** — Payment amount\n\nWrap them in double curly braces in your template body.",
    relatedIds: ["templates-overview", "create-template"],
    priority: 7,
  },
  {
    id: "create-template",
    keywords: ["create", "new", "add", "template", "write"],
    patterns: [/how (do i|to) (create|add|make) (a )?template/i, /new template/i],
    category: "templates",
    question: "How do I create a template?",
    answer: "Go to **Templates** and click **+ Create Template**. Give it a name, choose a category and tone, then write the message body using variables like {{name}} and {{date}}. The character counter shows SMS length. Click Save when done. You can preview the AI-rewritten version too!",
    relatedIds: ["template-variables", "tone-rewrite"],
    priority: 6,
  },

  // ═══════════════════════════════════════════
  // MESSAGING / AI
  // ═══════════════════════════════════════════
  {
    id: "tone-rewrite",
    keywords: ["tone", "rewrite", "friendly", "professional", "casual", "urgent", "ai", "rebooked ai"],
    patterns: [/tone/i, /rewrite/i, /change tone/i, /rebooked ai/i],
    category: "messaging",
    question: "How does tone rewriting work?",
    answer: "When composing a message, select a tone (friendly, professional, casual, urgent, or empathetic). Rebooked AI rewrites your message to match that tone while keeping it under 160 characters. This works for manual messages and template previews. Best part — it's all in-house, no extra cost!",
    relatedIds: ["send-manual-message", "templates-overview"],
    priority: 7,
  },
  {
    id: "message-generator",
    keywords: ["generate", "message", "create", "write", "ai", "compose"],
    patterns: [/generate (a )?(message|sms|text)/i, /create (a )?message/i, /write (a )?message/i],
    category: "messaging",
    question: "How do I generate a message?",
    answer: "Use the **Message Generator** in the chat widget or Templates page. Select a message type (confirmation, follow-up, no-show recovery, etc.), choose a tone, and add variables like {{name}}. Rebooked AI generates multiple variations instantly — all in-house, zero API cost. Pick your favorite and send!",
    relatedIds: ["tone-rewrite", "template-variables"],
    priority: 7,
    answerBySkill: {
      beginner: "Click the **Message Generator** tab at the top of this chat! Just pick a type (like \"Appointment Reminder\"), choose a tone (like \"Friendly\"), enter a client name, and hit **Generate**. You'll get 3 ready-to-use messages instantly. Copy whichever you like!",
      advanced: "Use the **Message Generator** tab for quick drafts across 17 message types × 5 tones. Fill in variables (name, business, date, time, link, amount) for personalized output. All generation is template-based and in-house — zero API cost. Output variations are randomized from the template pool.",
    },
  },
  {
    id: "sms-character-limit",
    keywords: ["character", "limit", "160", "sms", "length", "long"],
    patterns: [/character limit/i, /how long/i, /160 char/i, /sms length/i],
    category: "messaging",
    question: "What's the SMS character limit?",
    answer: "Standard SMS messages are 160 characters. Rebooked automatically keeps generated messages under this limit. If a message exceeds 160 characters, it will be split into multiple segments (which costs more). The character counter in the composer helps you stay within limits.",
    relatedIds: ["tone-rewrite"],
    priority: 5,
  },

  // ═══════════════════════════════════════════
  // FEATURES
  // ═══════════════════════════════════════════
  {
    id: "no-show-feature",
    keywords: ["no show", "no-show", "noshow", "missed", "appointment", "recovery"],
    patterns: [/no[- ]?show/i, /missed appointment/i],
    category: "features",
    question: "How does No-Show Recovery work?",
    answer: "No-Show Recovery sends automatic follow-ups when a client misses their appointment. It:\n1. Detects the no-show event\n2. Sends an empathetic message offering to rebook\n3. Can apply no-show fees (if enabled)\n4. Tracks recovery rate in Analytics\n\nEnable it in **Automations** or visit the dedicated **No-Show Recovery** page for advanced settings.",
    relatedIds: ["automation-types", "cancellation-feature"],
    priority: 8,
  },
  {
    id: "cancellation-feature",
    keywords: ["cancellation", "cancel", "cancelled", "recovery", "waitlist", "fill"],
    patterns: [/cancellation/i, /cancel(led)? recovery/i, /fill cancel/i],
    category: "features",
    question: "How does Cancellation Recovery work?",
    answer: "When a client cancels, Rebooked instantly:\n1. Notifies waitlisted clients about the open slot\n2. Broadcasts the opening to qualified leads\n3. Auto-fills the slot with the first responder\n\nThis recovers 10-15% of cancellations. Configure urgency tiers and broadcast radius in the **Cancellation Recovery** page.",
    relatedIds: ["no-show-feature", "smart-scheduling-feature"],
    priority: 8,
  },
  {
    id: "lead-capture-feature",
    keywords: ["lead capture", "capture", "web form", "instant", "response", "24/7"],
    patterns: [/lead capture/i, /web form/i, /instant response/i, /capture leads/i],
    category: "features",
    question: "How does Lead Capture work?",
    answer: "Lead Capture automatically responds to new inquiries within 60 seconds. When someone contacts you via web form or text:\n1. A lead is created automatically\n2. An instant SMS response is sent with a booking link\n3. After-hours messages include 24/7 online booking\n\nConfigure it in the **Lead Capture** page. No leads slip through the cracks!",
    relatedIds: ["after-hours-feature", "add-leads"],
    priority: 8,
  },
  {
    id: "after-hours-feature",
    keywords: ["after hours", "after-hours", "closed", "overnight", "weekend"],
    patterns: [/after[- ]?hours/i, /when (closed|we're closed)/i, /overnight/i],
    category: "features",
    question: "How does After-Hours Response work?",
    answer: "When someone texts outside business hours, Rebooked auto-replies with a friendly message and a 24/7 online booking link. This captures leads that would otherwise be lost overnight or on weekends. Configure your business hours and response in the **After-Hours** page.",
    relatedIds: ["lead-capture-feature"],
    priority: 7,
  },
  {
    id: "smart-scheduling-feature",
    keywords: ["smart", "scheduling", "gap", "fill", "off-peak", "utilization"],
    patterns: [/smart scheduling/i, /gap fill/i, /off[- ]?peak/i, /utilization/i],
    category: "features",
    question: "How does Smart Scheduling work?",
    answer: "Smart Scheduling detects gaps in your calendar and proactively fills them:\n- **Gap Detection**: Finds empty time slots in your schedule\n- **Auto-Fill**: Notifies matching leads about available slots\n- **Off-Peak Offers**: Promotes less popular time slots\n\nThis increases utilization by 5-15%. Configure in the **Smart Scheduling** page.",
    relatedIds: ["cancellation-feature"],
    priority: 7,
  },
  {
    id: "retention-feature",
    keywords: ["retention", "loyalty", "reactivation", "win back", "inactive", "churn"],
    patterns: [/retention/i, /loyalty/i, /reactivat/i, /win[- ]?back/i, /inactive client/i],
    category: "features",
    question: "How does the Retention Engine work?",
    answer: "The Retention Engine keeps clients coming back:\n- **Rebooking Reminders**: Prompts clients to book again after their visit\n- **Loyalty Rewards**: Sends special offers to frequent clients\n- **Reactivation Campaigns**: Reaches out to clients who haven't booked in a while\n\nAll messages are personalized. Configure in the **Retention Engine** page.",
    relatedIds: ["no-show-feature"],
    priority: 7,
  },
  {
    id: "payment-feature",
    keywords: ["payment", "card", "file", "deposit", "fee", "enforce", "prepaid"],
    patterns: [/payment/i, /card on file/i, /deposit/i, /cancellation fee/i, /no[- ]?show (fee|penalty)/i],
    category: "features",
    question: "How does Payment Enforcement work?",
    answer: "Payment Enforcement reduces no-shows through financial accountability:\n- **Card on File**: Request clients save a card before their appointment\n- **Deposits**: Require a deposit to confirm bookings\n- **Cancellation Fees**: Apply fees for late cancellations\n- **No-Show Penalties**: Charge for missed appointments\n\nAll with automatic SMS notifications. Configure in the **Payment Enforcement** page.",
    relatedIds: ["no-show-feature"],
    priority: 7,
  },
  {
    id: "booking-conversion-feature",
    keywords: ["booking", "conversion", "convert", "book"],
    patterns: [/booking conversion/i, /convert leads/i],
    category: "features",
    question: "How does Booking Conversion work?",
    answer: "Booking Conversion optimizes the journey from lead to booked appointment. It tracks conversion rates, identifies drop-off points, and suggests improvements. View your funnel in the **Booking Conversion** page to see where leads are getting stuck and how to improve.",
    relatedIds: ["lead-capture-feature", "analytics-overview"],
    priority: 6,
  },

  // ═══════════════════════════════════════════
  // ANALYTICS
  // ═══════════════════════════════════════════
  {
    id: "analytics-overview",
    keywords: ["analytics", "dashboard", "metrics", "stats", "performance", "data"],
    patterns: [/analytics/i, /dashboard/i, /my (metrics|stats|numbers)/i, /how am i doing/i],
    category: "analytics",
    question: "What analytics are available?",
    answer: "Your **Dashboard** shows key metrics at a glance:\n- Total leads and conversion rate\n- Messages sent and response rate\n- Revenue recovered from no-shows and cancellations\n- Automation performance\n\nThe **Analytics** page has deeper insights including trends, revenue leakage analysis, and per-automation breakdowns.",
    relatedIds: ["revenue-leakage"],
    priority: 7,
    skillLevels: ["advanced", "expert"],
    beginnerTip: "Just check your **Dashboard** — it shows the important numbers. As your automations run, you'll see messages sent, leads converted, and revenue recovered all in one place.",
    advancedNote: "The Analytics page supports financial, operational, compliance, and forecast reports. Revenue Leakage dashboard shows per-category loss analysis with actionable recovery strategies.",
  },
  {
    id: "revenue-leakage",
    keywords: ["revenue", "leakage", "lost", "money", "recovery", "impact"],
    patterns: [/revenue (leakage|lost|recovery)/i, /how much (money|revenue)/i],
    category: "analytics",
    question: "What is Revenue Leakage?",
    answer: "Revenue Leakage shows money lost from no-shows, cancellations, and unfilled gaps. The Analytics dashboard calculates this based on your average appointment value and missed opportunities. Rebooked's automations work to minimize this — you can see the recovery impact in real-time.",
    relatedIds: ["analytics-overview", "no-show-feature"],
    priority: 6,
  },

  // ═══════════════════════════════════════════
  // BILLING
  // ═══════════════════════════════════════════
  {
    id: "change-plan",
    keywords: ["change", "upgrade", "downgrade", "plan", "switch"],
    patterns: [/change (my )?plan/i, /upgrade/i, /downgrade/i, /switch plan/i],
    category: "billing",
    question: "How do I change my plan?",
    answer: "Go to **Settings > Billing** or visit the **Billing** page directly. Click **Manage Subscription** to upgrade, downgrade, or cancel. Changes take effect immediately for upgrades or at the end of the billing cycle for downgrades.",
    relatedIds: ["what-plan-do-i-need", "billing-portal"],
    priority: 7,
  },
  {
    id: "billing-portal",
    keywords: ["billing", "invoice", "receipt", "payment method", "stripe"],
    patterns: [/billing (portal|page)/i, /invoice/i, /receipt/i, /update (my )?payment/i],
    category: "billing",
    question: "How do I manage billing?",
    answer: "Visit **Billing** to access the Stripe customer portal. There you can:\n- Update your payment method\n- View past invoices and receipts\n- Cancel or modify your subscription\n- Download invoices for tax purposes",
    relatedIds: ["change-plan"],
    priority: 6,
  },

  // ═══════════════════════════════════════════
  // SETTINGS
  // ═══════════════════════════════════════════
  {
    id: "settings-overview",
    keywords: ["settings", "configure", "setup", "business", "phone number"],
    patterns: [/settings/i, /configure (my )?business/i, /change (my )?(business|phone)/i],
    category: "settings",
    question: "What can I configure in Settings?",
    answer: "The **Settings** page lets you:\n- Update your business name and info\n- Configure phone numbers for SMS\n- Set your timezone and industry type\n- Manage API keys for integrations\n- Access billing and subscription management\n- Configure automation preferences",
    relatedIds: ["getting-started-first"],
    priority: 6,
  },

  // ═══════════════════════════════════════════
  // TROUBLESHOOTING
  // ═══════════════════════════════════════════
  {
    id: "sms-not-sending",
    keywords: ["sms", "not", "sending", "failed", "error", "message", "not delivered"],
    patterns: [/sms (not|isn't|isnt) (sending|working|delivering)/i, /message (not|isn't|failed)/i, /can't send/i],
    category: "troubleshooting",
    question: "Why aren't my SMS messages sending?",
    answer: "Common causes for SMS failures:\n1. **No phone number configured**: Check Settings > Phone Numbers\n2. **Invalid lead phone**: Verify the lead has a valid phone number\n3. **Rate limited**: Rebooked limits messages per hour/day to prevent spam\n4. **Provider issue**: Check Twilio/Telnyx dashboard for errors\n5. **Usage cap reached**: Your plan may have a monthly SMS limit\n\nCheck **Admin > System Health** for detailed error logs.",
    relatedIds: ["automation-not-firing"],
    priority: 9,
  },
  {
    id: "lead-not-receiving",
    keywords: ["lead", "not", "receiving", "getting", "messages", "unsubscribed", "stop"],
    patterns: [/lead (not|isn't) (receiving|getting)/i, /unsubscribed/i, /replied stop/i],
    category: "troubleshooting",
    question: "Why isn't a lead receiving messages?",
    answer: "If a lead isn't getting your messages:\n1. **Unsubscribed**: They may have replied STOP. Check their status.\n2. **Invalid number**: The phone number may be incorrect or disconnected.\n3. **Carrier blocked**: Some carriers filter business SMS. Try a different message.\n4. **Already contacted**: Rate limits prevent over-messaging the same lead.\n\nCheck the lead's message history in their detail page for delivery status.",
    relatedIds: ["sms-not-sending"],
    priority: 8,
  },
  {
    id: "data-not-showing",
    keywords: ["data", "not", "showing", "empty", "blank", "dashboard", "nothing"],
    patterns: [/data (not|isn't) showing/i, /dashboard (is )?(empty|blank)/i, /no data/i, /nothing showing/i],
    category: "troubleshooting",
    question: "Why is my dashboard showing no data?",
    answer: "Your dashboard needs data to show metrics:\n1. **New account**: Add leads and enable automations first.\n2. **No activity yet**: Metrics appear after messages are sent and automations run.\n3. **Date range**: Try adjusting the time period filter.\n4. **Refresh**: Pull to refresh or reload the page.\n\nOnce you have some leads and automations running, data will populate automatically.",
    relatedIds: ["analytics-overview", "getting-started-first"],
    priority: 7,
  },
  {
    id: "stripe-connect",
    keywords: ["stripe", "connect", "integration", "payment", "setup"],
    patterns: [/stripe connect/i, /stripe (setup|integration)/i, /connect stripe/i],
    category: "settings",
    question: "How do I set up Stripe Connect?",
    answer: "Go to **Stripe Connect** from the sidebar. Click **Connect with Stripe** to link your Stripe account. This enables payment features like card on file, deposits, and cancellation fees. Once connected, you can manage products and pricing directly in Rebooked.",
    relatedIds: ["payment-feature", "billing-portal"],
    priority: 7,
  },
  {
    id: "rebooked-ai-chat",
    keywords: ["rebooked ai", "chat", "assistant", "help", "bot", "this chat"],
    patterns: [/what (is|can) (rebooked ai|this chat|this bot)/i, /how does this (chat|assistant) work/i, /what can you do/i],
    category: "getting-started",
    question: "What can Rebooked AI help me with?",
    answer: "I'm Rebooked AI — your in-house assistant. I can help with:\n- **Understanding features**: Ask about any Rebooked feature\n- **Troubleshooting**: Diagnose issues with automations or messages\n- **Generating messages**: Use the Message Generator tab to create SMS content\n- **Getting started**: Walk you through setup and best practices\n\nI run entirely in-house with zero external API costs. My answers adapt to your experience level!",
    relatedIds: ["getting-started-first", "message-generator", "skill-level-explained"],
    priority: 8,
    skillLevels: ["beginner"],
    answerBySkill: {
      beginner: "I'm **Rebooked AI**, your helper! Here's what I can do:\n\n- **Answer questions** — Ask me anything about Rebooked (\"How do I add a lead?\")\n- **Generate messages** — Switch to the **Message Generator** tab to create SMS texts\n- **Guide you** — I'll give you step-by-step instructions tailored to beginners\n\nTry clicking one of the suggested questions below to get started!",
      advanced: "Rebooked AI is an in-house chat helper (zero API cost, rule-based matching against a knowledge base). Two tabs:\n- **Help Chat**: KB-backed Q&A covering all features, automations, billing, and troubleshooting\n- **Message Generator**: Template-based SMS generation across 17 types × 5 tones\n\nResponses adapt to your skill level. The KB currently covers ~50 topics.",
    },
  },
  {
    id: "help-support",
    keywords: ["help", "support", "contact", "issue", "bug", "problem"],
    patterns: [/need help/i, /contact support/i, /report (a )?bug/i, /have (a )?(problem|issue)/i],
    category: "troubleshooting",
    question: "How do I get support?",
    answer: "For help with Rebooked:\n- Use this **Rebooked AI** chat for instant answers\n- Check **Settings** for configuration help\n- View **Admin > System Health** for error diagnostics\n- Contact support via the help section in Settings\n\nMost common issues can be resolved by checking the troubleshooting tips above!",
    relatedIds: ["sms-not-sending", "automation-not-firing"],
    priority: 8,
  },
];
