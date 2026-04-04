export interface IndustryTestimonial {
  quote: string;
  name: string;
  business: string;
  result: string;
}

export interface IndustryConfig {
  slug: string;
  name: string;
  namePlural: string;
  emoji: string;
  metaTitle: string;
  metaDescription: string;
  heroHeadline: string;
  heroSubheadline: string;
  heroStat: string;
  heroStatLabel: string;
  avgAppointmentValue: number;
  defaultNoShows: number;
  defaultCancellations: number;
  painPoints: { title: string; description: string }[];
  testimonials: IndustryTestimonial[];
  featureContext: {
    missedCall: string;
    noShow: string;
    cancellation: string;
    winBack: string;
    review: string;
    reminder: string;
  };
  faq: { question: string; answer: string }[];
}

export const INDUSTRIES: Record<string, IndustryConfig> = {
  salons: {
    slug: "salons",
    name: "Hair Salon & Barbershop",
    namePlural: "Hair Salons & Barbershops",
    emoji: "✂️",
    metaTitle: "Rebooked for Hair Salons & Barbershops — Stop Losing Chairs to No-Shows",
    metaDescription: "Automated SMS recovery for salons. Recapture no-shows, fill empty chairs, and win back lapsed clients on autopilot. 35-day ROI guarantee.",
    heroHeadline: "Stop losing chairs to no-shows and last-minute cancellations",
    heroSubheadline: "Rebooked sends the right text at the right time — so your stylists stay booked, your chairs stay filled, and you stop leaving money on the cutting room floor.",
    heroStat: "62%",
    heroStatLabel: "of no-show clients rebook when texted within 15 minutes",
    avgAppointmentValue: 65,
    defaultNoShows: 18,
    defaultCancellations: 12,
    painPoints: [
      {
        title: "Empty chairs = lost revenue every single day",
        description: "A stylist sitting idle for an hour costs you $65. With 3–4 no-shows a week that's $800–$1,000 vanishing monthly before you even notice.",
      },
      {
        title: "Clients ghost after booking online",
        description: "Online booking is great for convenience — terrible for commitment. Clients who book themselves are 3x more likely to no-show without a personal reminder.",
      },
      {
        title: "You're too busy cutting hair to chase clients",
        description: "You can't stop mid-colour to text someone. By the time you're free, the slot is gone and the client has moved on.",
      },
      {
        title: "Lapsed clients forget you exist",
        description: "That client who used to come every 6 weeks hasn't been in for 4 months. They didn't leave — they just got busy. A single text can bring them back.",
      },
    ],
    testimonials: [
      {
        quote: "We recovered 11 no-shows in the first month. That's almost $700 back in our pocket — and we didn't lift a finger.",
        name: "Kayla M.",
        business: "Studio K Hair Lounge",
        result: "$700 recovered, month 1",
      },
      {
        quote: "I was sceptical but the 35-day guarantee made it a no-brainer. Now I'd never go back.",
        name: "Tony R.",
        business: "Fade & Edge Barbershop",
        result: "ROI in 12 days",
      },
    ],
    featureContext: {
      missedCall: "A potential new client calls your salon and hangs up — Rebooked texts them back instantly: \"Hi! Sorry we missed you, we'd love to book you in. What day works?\"",
      noShow: "A client misses their 2pm appointment — Rebooked texts 15 minutes later: \"Hey [name], we missed you today! Want to reschedule? We have openings this week.\"",
      cancellation: "A client cancels — Rebooked immediately texts your waiting list to fill the slot, then follows up with the canceller to rebook within 48 hours.",
      winBack: "A client hasn't been in for 90 days — Rebooked sends a personalised win-back with a gentle nudge and your booking link.",
      review: "After a successful appointment, Rebooked automatically requests a Google review at exactly the right moment — when your client is still glowing.",
      reminder: "24 hours before each appointment, clients get a personal reminder text with your address, timing, and a one-tap confirmation.",
    },
    faq: [
      {
        question: "How does Rebooked reduce no-shows for hair salons?",
        answer: "Rebooked sends automated SMS reminders 24 hours and 2 hours before each appointment, then follows up within 15 minutes if a client doesn't show. On average, salons using Rebooked recover 40% of no-show clients.",
      },
      {
        question: "What does Rebooked cost for a salon?",
        answer: "Rebooked is $199/month plus 15% of recovered revenue. You only pay the revenue share on appointments that were actually recovered — so if Rebooked doesn't make you money, it costs almost nothing. New clients get a 35-day free trial.",
      },
      {
        question: "Can Rebooked fill last-minute cancellations at my salon?",
        answer: "Yes. When a client cancels, Rebooked instantly texts your waiting list to fill the slot. Most cancellations are filled within 30 minutes, keeping your chairs occupied and revenue flowing.",
      },
      {
        question: "Is Rebooked's SMS messaging TCPA compliant for salons?",
        answer: "Absolutely. Rebooked handles consent management, quiet hours, and opt-out keywords automatically. Every message is sent within TCPA guidelines so you never have to worry about compliance.",
      },
      {
        question: "How quickly do salons see ROI with Rebooked?",
        answer: "Most salons see positive ROI within the first two weeks. Recovering just 3-4 no-shows per month at $65 each already covers the subscription cost, and the 35-day guarantee means you pay nothing if it doesn't work.",
      },
    ],
  },

  dental: {
    slug: "dental",
    name: "Medical & Dental Clinic",
    namePlural: "Medical & Dental Clinics",
    emoji: "🦷",
    metaTitle: "Rebooked for Dental & Medical Clinics — Reduce No-Shows, Fill Cancellations",
    metaDescription: "Automated SMS recovery built for dental and medical practices. Fill last-minute gaps, reduce DNA rates, and keep your schedule full. 35-day ROI guarantee.",
    heroHeadline: "Every empty slot in your schedule is a $150 problem you can automate away",
    heroSubheadline: "Rebooked works silently in the background — texting no-shows, filling cancellations from your waiting list, and winning back overdue patients without your reception team lifting a finger.",
    heroStat: "23%",
    heroStatLabel: "average DNA rate for dental practices — Rebooked cuts this in half",
    avgAppointmentValue: 150,
    defaultNoShows: 12,
    defaultCancellations: 8,
    painPoints: [
      {
        title: "DNA rates eating your revenue every week",
        description: "A single empty 45-minute appointment slot costs $150+. With the industry average DNA rate at 23%, that's thousands lost monthly across your practice.",
      },
      {
        title: "Reception spends hours chasing confirmations",
        description: "Your front desk staff are calling and leaving voicemails instead of helping patients in front of them. Rebooked automates this entirely.",
      },
      {
        title: "Last-minute cancellations leave no time to fill",
        description: "When a patient cancels day-of, you need someone from your waiting list notified instantly — not after a 20-minute manual process.",
      },
      {
        title: "Overdue recall patients are slipping away",
        description: "Patients who are 6 months overdue for a check-up won't call you. But they'll respond to the right text at the right time.",
      },
    ],
    testimonials: [
      {
        quote: "We cut our DNA rate from 18% to 9% in 6 weeks. That's an extra 20+ appointments per month filled. The ROI is extraordinary.",
        name: "Dr. Sarah L.",
        business: "Lakeside Family Dental",
        result: "DNA rate halved in 6 weeks",
      },
      {
        quote: "My receptionist used to spend 2 hours a day on confirmations. Now she spends 10 minutes reviewing what Rebooked handled overnight.",
        name: "Dr. James P.",
        business: "Parkview Medical Centre",
        result: "2 hrs/day saved on admin",
      },
    ],
    featureContext: {
      missedCall: "A patient calls after hours — Rebooked texts back immediately: \"Hi! Thanks for calling [practice]. We'd love to book you in — tap here to choose a time.\"",
      noShow: "A patient misses their appointment — Rebooked texts within 15 minutes with a professional reschedule offer and direct booking link.",
      cancellation: "A cancellation opens a slot — Rebooked instantly notifies the top patients on your waiting list first-come, first-served.",
      winBack: "Overdue patients get a friendly recall message at the 6-month mark: personalised, professional, and completely automated.",
      review: "Post-appointment review requests sent automatically — building your online reputation without asking your staff to chase patients.",
      reminder: "Appointment reminders 24h and 2h before — reducing DNAs without any manual effort from your team.",
    },
    faq: [
      {
        question: "How does Rebooked reduce DNA rates for dental practices?",
        answer: "Rebooked sends automated SMS reminders 24 hours and 2 hours before each appointment, then follows up within 15 minutes of a missed appointment with a rebooking link. Practices using Rebooked cut their DNA rate in half on average.",
      },
      {
        question: "What does Rebooked cost for a dental or medical clinic?",
        answer: "Rebooked is $199/month plus 15% of recovered revenue. At an average appointment value of $150, recovering just two no-shows per month covers the entire subscription. You get a 35-day free trial to prove ROI risk-free.",
      },
      {
        question: "Can Rebooked send patient recall reminders automatically?",
        answer: "Yes. Rebooked automatically sends personalised recall messages to patients who are overdue for check-ups or follow-up appointments. These are timed based on your recall schedule and include a direct booking link.",
      },
      {
        question: "Is Rebooked HIPAA and TCPA compliant for medical practices?",
        answer: "Rebooked is fully TCPA compliant with built-in consent management, opt-out handling, and quiet hours enforcement. Messages are kept professional and scheduling-focused, with no protected health information included in texts.",
      },
      {
        question: "How does the waiting list feature work for dental cancellations?",
        answer: "When a patient cancels, Rebooked instantly texts patients on your waiting list in priority order. The first patient to respond claims the slot, keeping your schedule full without any manual effort from your front desk.",
      },
    ],
  },

  spa: {
    slug: "spa",
    name: "Massage & Spa",
    namePlural: "Massage Therapists & Spas",
    emoji: "💆",
    metaTitle: "Rebooked for Massage & Spa Businesses — Fill Every Treatment Room",
    metaDescription: "Automated SMS for spas and massage therapists. Recover no-shows, fill cancellations, and keep clients coming back. 35-day ROI guarantee.",
    heroHeadline: "Your treatment rooms should never be empty — and they don't have to be",
    heroSubheadline: "Rebooked handles the follow-up, rebooking, and client retention so you can focus on what you do best: making people feel incredible.",
    heroStat: "58%",
    heroStatLabel: "of cancelled spa appointments rebook when followed up within 2 hours",
    avgAppointmentValue: 95,
    defaultNoShows: 10,
    defaultCancellations: 14,
    painPoints: [
      {
        title: "No-shows cost you time you can't get back",
        description: "A massage therapist blocked for 60–90 minutes with an empty table isn't just losing $95 — they're losing energy and momentum for the rest of the day.",
      },
      {
        title: "Clients love you but forget to rebook",
        description: "After a great massage, clients fully intend to come back. But life gets in the way. A simple automated text at the right moment brings them back every time.",
      },
      {
        title: "Cancellations cascade through your day",
        description: "One last-minute cancellation can throw off your whole afternoon. Without a system to fill it fast, that revenue is just gone.",
      },
      {
        title: "You're leaving loyalty on the table",
        description: "Your regular clients deserve a birthday message, a milestone reward, a personal check-in. Rebooked sends all of it automatically.",
      },
    ],
    testimonials: [
      {
        quote: "I went from 6–8 empty slots a week to almost zero. The waiting list automation alone paid for it 10x over.",
        name: "Maria T.",
        business: "Serenity Massage Studio",
        result: "8 empty slots → near zero",
      },
      {
        quote: "My clients think I personally text them. They love it. And I'm doing it all automatically while I'm with other clients.",
        name: "Jen K.",
        business: "The Healing Room",
        result: "Retention up 40%",
      },
    ],
    featureContext: {
      missedCall: "Someone calls to enquire and you're mid-session — Rebooked texts them back in seconds with your booking link so you never lose a new client.",
      noShow: "A no-show triggers an instant, warm text — not aggressive, just caring: \"Hey [name], we missed you today. Hope everything's okay! Want to reschedule?\"",
      cancellation: "Cancellations instantly unlock waiting list alerts — so your treatment room fills itself while you're with your current client.",
      winBack: "Clients who haven't visited in 60 days get a gentle personalised nudge with a soft offer to bring them back.",
      review: "After each appointment, Rebooked requests a review with perfect timing — maximising your 5-star rating with zero awkward asking.",
      reminder: "Clients get a calming pre-appointment reminder 24h before — reducing no-shows and building anticipation.",
    },
    faq: [
      {
        question: "How does Rebooked help spas and massage therapists reduce no-shows?",
        answer: "Rebooked sends calming, on-brand SMS reminders 24 hours before each appointment, then follows up within 15 minutes if a client doesn't show. Spas using Rebooked recover an average of 58% of cancelled appointments.",
      },
      {
        question: "What does Rebooked cost for a massage or spa business?",
        answer: "Rebooked is $199/month plus 15% of recovered revenue. At an average treatment value of $95, recovering just three sessions per month more than covers the subscription. You get a 35-day free trial with no risk.",
      },
      {
        question: "Can Rebooked fill same-day spa cancellations automatically?",
        answer: "Yes. When a client cancels, Rebooked instantly texts people on your waiting list. Most same-day cancellations are filled within 30 minutes, keeping your treatment rooms productive and revenue consistent.",
      },
      {
        question: "Does Rebooked work with spa booking software?",
        answer: "Rebooked integrates with your existing scheduling workflow and sends automated texts based on appointment status changes. It works alongside your current booking system without replacing it.",
      },
      {
        question: "How does Rebooked help with spa client retention?",
        answer: "Rebooked sends automated re-engagement texts to clients who haven't visited in 60+ days, birthday promotions, and loyalty milestones. These personalised touches keep clients coming back without any manual effort from your team.",
      },
    ],
  },

  fitness: {
    slug: "fitness",
    name: "Fitness & Personal Training",
    namePlural: "Personal Trainers & Fitness Studios",
    emoji: "💪",
    metaTitle: "Rebooked for Personal Trainers & Fitness Studios — Keep Clients Accountable",
    metaDescription: "Automated SMS for personal trainers and fitness studios. Reduce cancellations, recover no-shows, and keep clients committed. 35-day ROI guarantee.",
    heroHeadline: "Clients who skip sessions cost you money. Rebooked brings them back.",
    heroSubheadline: "Automated reminders, no-show recovery, and accountability texts that keep your schedule full and your clients consistent — without you chasing anyone.",
    heroStat: "71%",
    heroStatLabel: "of clients who skip a session cancel their next one too — unless followed up",
    avgAppointmentValue: 40,
    defaultNoShows: 20,
    defaultCancellations: 15,
    painPoints: [
      {
        title: "One missed session becomes two becomes quitting",
        description: "The data is clear: clients who miss a session without follow-up are 3x more likely to cancel their next booking and 5x more likely to churn entirely.",
      },
      {
        title: "Last-minute cancellations you can't fill",
        description: "A cancelled PT session with 2 hours notice is nearly impossible to fill manually. Rebooked texts your waiting list and fills it automatically.",
      },
      {
        title: "New leads go cold while you're training",
        description: "Someone enquires about personal training while you're in a session. By the time you see it, they've gone with someone else.",
      },
      {
        title: "Retention is your biggest profit lever",
        description: "Keeping a client costs 5x less than acquiring a new one. Rebooked's re-engagement automations keep your existing clients loyal and active.",
      },
    ],
    testimonials: [
      {
        quote: "I used to lose 4–5 clients a month to 'life getting in the way'. Now I recover most of them before they even think about cancelling.",
        name: "Marcus W.",
        business: "Peak Performance PT",
        result: "Client churn down 60%",
      },
      {
        quote: "The missed call text-back alone brought in 3 new clients in the first two weeks. I was blown away.",
        name: "Amelia S.",
        business: "Transform Fitness Studio",
        result: "3 new clients, week 2",
      },
    ],
    featureContext: {
      missedCall: "A prospect calls about training packages while you're with a client — Rebooked texts them back instantly so you never miss a new sign-up.",
      noShow: "A client no-shows — Rebooked sends a caring accountability text: \"Hey [name], missed you today! Want to reschedule before you lose momentum?\"",
      cancellation: "Cancellations trigger instant waiting list alerts — so your time slot is refilled before you even know it was empty.",
      winBack: "Clients who haven't trained in 30 days get a personalised motivational re-engagement text to bring them back.",
      review: "After each client hits a milestone or completes a programme, Rebooked requests a Google review automatically.",
      reminder: "Pre-session accountability reminders 24h and 2h before — dramatically reducing last-minute cancellations.",
    },
    faq: [
      {
        question: "How does Rebooked reduce client churn for personal trainers?",
        answer: "Rebooked sends accountability texts after missed sessions, automated re-engagement at 30 days of inactivity, and pre-session reminders that keep clients committed. Trainers using Rebooked see client churn drop by up to 60%.",
      },
      {
        question: "What does Rebooked cost for a personal training business?",
        answer: "Rebooked is $199/month plus 15% of recovered revenue. Even at $40 per session, recovering just 5 missed sessions per month covers the subscription and generates profit. You get a risk-free 35-day trial.",
      },
      {
        question: "Can Rebooked help me respond to new fitness leads instantly?",
        answer: "Yes. When a prospect calls or messages while you are training, Rebooked automatically texts them back within seconds with your availability. This instant response converts significantly more enquiries than calling back hours later.",
      },
      {
        question: "Does Rebooked work for group fitness classes and one-on-one sessions?",
        answer: "Rebooked works for both. It sends reminders, recovers no-shows, and manages your waiting list whether you run personal training sessions, small group classes, or a mix of both.",
      },
      {
        question: "How does Rebooked keep fitness clients accountable between sessions?",
        answer: "When a client misses a session, Rebooked sends a motivational follow-up text within 15 minutes. Clients who skip one session are 3x more likely to cancel the next without follow-up, so this single text dramatically improves retention.",
      },
    ],
  },

  tattoo: {
    slug: "tattoo",
    name: "Tattoo Studio",
    namePlural: "Tattoo Studios",
    emoji: "🖋️",
    metaTitle: "Rebooked for Tattoo Studios — Stop Artists Sitting Idle",
    metaDescription: "Automated SMS for tattoo studios. Recover no-shows, fill deposits that ghost, and keep artists booked solid. 35-day ROI guarantee.",
    heroHeadline: "A no-show on a $200 tattoo appointment is a $200 problem. Fix it automatically.",
    heroSubheadline: "Rebooked sends instant recovery texts, fills cancelled slots from your waiting list, and keeps your artists booked — so you spend more time creating and less time chasing.",
    heroStat: "68%",
    heroStatLabel: "of tattoo no-shows rebook within 48 hours when followed up by text",
    avgAppointmentValue: 200,
    defaultNoShows: 8,
    defaultCancellations: 6,
    painPoints: [
      {
        title: "Deposits don't stop people ghosting",
        description: "Even with a deposit, clients no-show. Your artist is blocked, your studio loses the revenue, and chasing them manually wastes everyone's time.",
      },
      {
        title: "Your waiting list is full but unused",
        description: "You have 20 people waiting for an opening but when a cancellation happens, you're mid-session and can't contact them. The slot goes empty.",
      },
      {
        title: "New enquiries come in at all hours",
        description: "Clients browse portfolios late at night and message when you're closed. Without an instant response, they book someone else by morning.",
      },
      {
        title: "Artists losing billable hours to admin",
        description: "Your artists are spending time on confirmations and follow-ups instead of creating. Rebooked handles all of it.",
      },
    ],
    testimonials: [
      {
        quote: "Had 3 no-shows in one week — Rebooked recovered 2 of them within 24 hours. That's $400 that would've just been gone.",
        name: "Dani V.",
        business: "Inkwell Tattoo Collective",
        result: "$400 recovered in one week",
      },
      {
        quote: "The waiting list automation is insane. A cancellation fills itself while I'm literally tattooing. Total game changer.",
        name: "Rowan A.",
        business: "Dark Ink Studio",
        result: "Zero empty slots in month 2",
      },
    ],
    featureContext: {
      missedCall: "Someone enquires about a booking outside hours — Rebooked texts back within seconds: \"Hey! Thanks for reaching out to [studio]. We'd love to work with you — can we chat about your idea?\"",
      noShow: "A no-show on a blocked session gets an immediate recovery text — firm but professional, with a rebooking link to make it easy.",
      cancellation: "A cancellation unlocks your waiting list automatically — the first person to respond gets the slot.",
      winBack: "Clients who haven't returned after their first tattoo get a personal re-engagement text at 90 days.",
      review: "Post-appointment review requests timed perfectly — when the client is showing off their fresh ink and feeling great.",
      reminder: "Pre-appointment reminders with aftercare instructions, studio address, and parking info — reducing no-shows and last-minute cancellations.",
    },
    faq: [
      {
        question: "How does Rebooked recover no-shows for tattoo studios?",
        answer: "Rebooked texts no-show clients within 15 minutes of their missed appointment with a professional rebooking link. At an average of $200 per session, recovering even one no-show per week adds over $800/month in revenue.",
      },
      {
        question: "What does Rebooked cost for a tattoo studio?",
        answer: "Rebooked is $199/month plus 15% of recovered revenue. With high-value sessions averaging $200+, recovering a single no-show per month nearly covers the subscription. You get a 35-day free trial to prove the ROI first.",
      },
      {
        question: "Can Rebooked manage my tattoo studio waiting list automatically?",
        answer: "Yes. When a client cancels a session, Rebooked instantly texts everyone on your waiting list in priority order. The first person to respond claims the slot, keeping your artists productive without any manual coordination.",
      },
      {
        question: "Does Rebooked help tattoo studios respond to late-night enquiries?",
        answer: "Absolutely. Most tattoo enquiries come in outside business hours when clients are browsing portfolios. Rebooked texts them back within seconds, capturing the lead before they message another studio by morning.",
      },
      {
        question: "Is Rebooked's SMS compliant for tattoo studio marketing?",
        answer: "Yes. Rebooked is fully TCPA compliant with automatic consent tracking, opt-out keyword handling, and quiet hours enforcement. Every message follows regulations so your studio stays protected.",
      },
    ],
  },

  "pet-grooming": {
    slug: "pet-grooming",
    name: "Pet Grooming",
    namePlural: "Pet Groomers",
    emoji: "🐾",
    metaTitle: "Rebooked for Pet Groomers — Fill Your Grooming Table Every Day",
    metaDescription: "Automated SMS for pet groomers. Recover no-shows, fill cancellations, and keep pet parents coming back on schedule. 35-day ROI guarantee.",
    heroHeadline: "Fluffy didn't show. Your grooming table is empty. Fix it automatically.",
    heroSubheadline: "Rebooked texts no-shows, fills your cancellations from the waiting list, and keeps pet parents on a regular grooming schedule — all without you picking up the phone.",
    heroStat: "55%",
    heroStatLabel: "of pet grooming no-shows rebook same-week when followed up by text",
    avgAppointmentValue: 55,
    defaultNoShows: 14,
    defaultCancellations: 10,
    painPoints: [
      {
        title: "Pet parents book and forget",
        description: "Unlike human appointments, grooming bookings are often made weeks out. Without a personal reminder, life happens and they completely forget.",
      },
      {
        title: "Your grooming table sits empty while your list is full",
        description: "You have a waiting list of people wanting an appointment — but when a gap opens, you're too busy grooming to contact them.",
      },
      {
        title: "Regular clients drift away between seasons",
        description: "A client who comes every 6 weeks suddenly hasn't been in for 3 months. A single automated text brings 70% of them back.",
      },
      {
        title: "New pet parents need you to reach out first",
        description: "Someone whose puppy just needs their first groom is nervous and won't chase you. An instant response to their enquiry wins the relationship.",
      },
    ],
    testimonials: [
      {
        quote: "I used to have 5–6 no-shows a week. Now it's maybe 1. That's an extra $200+ every single week I'm getting back.",
        name: "Bev H.",
        business: "Pampered Paws Grooming",
        result: "$200/week recovered",
      },
      {
        quote: "The rebooking automation is brilliant. My regulars now rebook automatically without me having to ask. Revenue is so much more predictable.",
        name: "Chris N.",
        business: "Happy Hound Salon",
        result: "Predictable recurring revenue",
      },
    ],
    featureContext: {
      missedCall: "A new pet parent calls while you're mid-groom — Rebooked texts back instantly so you capture the lead before they call someone else.",
      noShow: "A no-show gets a friendly recovery text: \"Hey! We missed [pet name] today — everything okay? Want to reschedule this week?\"",
      cancellation: "Cancellations automatically open the slot to your waiting list — the first to respond gets the appointment.",
      winBack: "Pet parents who haven't visited in 8 weeks get a gentle re-engagement: \"[Pet name] is probably due a groom! We have openings this week.\"",
      review: "After each groom, Rebooked requests a review — helping you stand out in local search results.",
      reminder: "Pre-appointment reminders with your address, parking details, and a request to confirm — dramatically cutting no-shows.",
    },
    faq: [
      {
        question: "How does Rebooked reduce no-shows for pet groomers?",
        answer: "Rebooked sends automated SMS reminders to pet parents the day before and morning of their appointment, then follows up within 15 minutes of a no-show with a rebooking link. Groomers using Rebooked recover 55% of missed appointments same-week.",
      },
      {
        question: "What does Rebooked cost for a pet grooming business?",
        answer: "Rebooked is $199/month plus 15% of recovered revenue. At $55 per groom, recovering just 4 no-shows per month covers the subscription cost entirely. You get a 35-day free trial with no risk.",
      },
      {
        question: "Can Rebooked keep pet parents on a regular grooming schedule?",
        answer: "Yes. Rebooked sends automated rebooking reminders when a pet is due for their next groom based on your recommended schedule. This keeps clients coming back consistently and makes your revenue far more predictable.",
      },
      {
        question: "Does Rebooked help pet groomers get more Google reviews?",
        answer: "Absolutely. After each grooming appointment, Rebooked automatically sends a review request at the perfect moment — when the pet parent is picking up their freshly groomed dog and feeling delighted with the result.",
      },
      {
        question: "How does Rebooked handle new pet parent enquiries for groomers?",
        answer: "When a new pet parent calls while you are mid-groom, Rebooked texts them back instantly with your availability. First-time pet parents are often nervous and shopping around, so an instant response wins the relationship before they call someone else.",
      },
    ],
  },

  therapy: {
    slug: "therapy",
    name: "Counselling & Therapy",
    namePlural: "Counsellors & Therapists",
    emoji: "🧠",
    metaTitle: "Rebooked for Therapists & Counsellors — Professional, TCPA-Compliant Client Recovery",
    metaDescription: "Automated SMS recovery for therapy practices. Professionally reduce no-shows and late cancellations with full TCPA compliance. 35-day ROI guarantee.",
    heroHeadline: "Reduce no-shows and late cancellations without compromising your therapeutic relationship",
    heroSubheadline: "Rebooked's professionally worded, TCPA-compliant automations handle scheduling recovery so you can focus on your clients — not your calendar.",
    heroStat: "35%",
    heroStatLabel: "average late cancellation rate for therapy practices — Rebooked reduces this significantly",
    avgAppointmentValue: 120,
    defaultNoShows: 8,
    defaultCancellations: 10,
    painPoints: [
      {
        title: "Late cancellations with 24h policy are hard to enforce",
        description: "Your cancellation policy exists, but enforcing it feels uncomfortable. Rebooked's gentle automated reminders reduce late cancellations before enforcement is needed.",
      },
      {
        title: "Session gaps hurt continuity of care",
        description: "When a client misses a session, their progress can stall. A professional follow-up keeps the therapeutic relationship warm and gets them back on track.",
      },
      {
        title: "New enquiries need a fast, professional response",
        description: "Someone reaching out for help is in a vulnerable moment. An instant, professional text-back shows you care and secures the first appointment.",
      },
      {
        title: "Your admin time should be with clients, not calendars",
        description: "Every hour spent on scheduling is an hour not spent in session. Rebooked handles the administrative side so you can maximise billable hours.",
      },
    ],
    testimonials: [
      {
        quote: "I was worried about the tone — but Rebooked's messages are warm and professional. My clients actually appreciate the reminders.",
        name: "Dr. Rachel B.",
        business: "Mindful Wellbeing Practice",
        result: "No-shows down 65%",
      },
      {
        quote: "The ROI calculation is simple: 3 fewer no-shows per month at $120 each = $360/month. Rebooked costs $199. The maths speaks for itself.",
        name: "Liam F.",
        business: "Clear Path Counselling",
        result: "ROI clear in first month",
      },
    ],
    featureContext: {
      missedCall: "A new client reaches out after hours — Rebooked sends a warm, professional response: \"Thank you for reaching out. I'll be in touch shortly to arrange a time that works for you.\"",
      noShow: "A missed session triggers a professional, caring follow-up — never pushy, always warm: \"We missed you today. I hope you're well — please reach out when you're ready to reconnect.\"",
      cancellation: "Late cancellations trigger a gentle rebooking message and, when appropriate, a waiting list notification for other clients.",
      winBack: "Clients who have gone quiet receive a professional, warm re-engagement at 30 days — maintaining the relationship without pressure.",
      review: "Discretely requests testimonials or directory reviews after successful engagement — building your referral reputation.",
      reminder: "48h and 24h appointment reminders — reducing DNAs while respecting your clients' time and autonomy.",
    },
    faq: [
      {
        question: "How does Rebooked handle sensitive messaging for therapy practices?",
        answer: "Rebooked's messages for therapists and counsellors are warm, professional, and never pushy. They focus purely on scheduling without referencing session content. Every text is designed to maintain your therapeutic relationship and respect client boundaries.",
      },
      {
        question: "What does Rebooked cost for a therapist or counsellor?",
        answer: "Rebooked is $199/month plus 15% of recovered revenue. At $120 per session, recovering just 2 missed sessions per month covers the subscription. You get a risk-free 35-day trial so you only pay if it works.",
      },
      {
        question: "Is Rebooked TCPA compliant for therapy and counselling practices?",
        answer: "Yes. Rebooked is fully TCPA compliant with automatic consent management, quiet hours enforcement, and opt-out handling. Messages are scheduling-focused only and never include any clinical or sensitive information.",
      },
      {
        question: "Can Rebooked help reduce late cancellations for therapy sessions?",
        answer: "Absolutely. Rebooked sends gentle reminders 48 hours and 24 hours before each session, giving clients time to confirm or reschedule. This significantly reduces late cancellations without you needing to enforce your cancellation policy awkwardly.",
      },
      {
        question: "How does Rebooked re-engage therapy clients who stop attending?",
        answer: "Clients who go quiet receive a warm, professional check-in at 30 days. The message is caring and non-pressuring, maintaining the therapeutic relationship and making it easy for clients to return when they are ready.",
      },
    ],
  },

  chiropractic: {
    slug: "chiropractic",
    name: "Chiropractic",
    namePlural: "Chiropractors",
    emoji: "🦴",
    metaTitle: "Rebooked for Chiropractors — Keep Your Adjustment Schedule Full",
    metaDescription: "Automated SMS recovery for chiropractic practices. Reduce no-shows, fill cancellations, and keep patients on their care plans. 35-day ROI guarantee.",
    heroHeadline: "Patients who miss adjustments fall off their care plan — and your schedule",
    heroSubheadline: "Rebooked keeps patients on track with automated reminders, no-show recovery, and care plan re-engagement — so your tables stay full and patients get the results they came for.",
    heroStat: "42%",
    heroStatLabel: "of chiropractic patients who miss one appointment drop off entirely without follow-up",
    avgAppointmentValue: 85,
    defaultNoShows: 12,
    defaultCancellations: 9,
    painPoints: [
      {
        title: "Patients underestimate how quickly they 'feel better'",
        description: "After 2–3 adjustments patients feel improvement and stop coming. Rebooked's automated care plan follow-ups remind them why completing the plan matters.",
      },
      {
        title: "Your front desk can't chase every missed appointment",
        description: "With multiple practitioners and a full waiting room, individually following up every no-show is impossible. Rebooked does it automatically.",
      },
      {
        title: "Referral patients need fast onboarding",
        description: "A GP or specialist referral is warm for about 48 hours. After that, patients lose urgency. Rebooked ensures instant contact and easy booking.",
      },
      {
        title: "Cancellations cascade through your multi-practitioner schedule",
        description: "One cancellation with the wrong practitioner can leave a block of time empty. Your waiting list can fill it — if they're notified fast enough.",
      },
    ],
    testimonials: [
      {
        quote: "We reduced our no-show rate from 22% to 8% in two months. That's 14 extra appointments per week across our two practitioners.",
        name: "Dr. Michael C.",
        business: "Aligned Chiropractic Centre",
        result: "No-shows down 64%",
      },
      {
        quote: "The care plan re-engagement automation is brilliant. Patients who 'graduated early' are coming back to complete their plan.",
        name: "Dr. Emma T.",
        business: "Spinal Health Clinic",
        result: "Plan completion up 38%",
      },
    ],
    featureContext: {
      missedCall: "A referral patient calls when reception is busy — Rebooked texts back immediately to capture the booking before they call another practice.",
      noShow: "A missed adjustment triggers immediate recovery: \"[Name], we missed you for your adjustment today. Consistent care is key to your results — want to reschedule this week?\"",
      cancellation: "Cancellations notify your waiting list instantly — so practitioners stay productive and patients get the care they need sooner.",
      winBack: "Patients who fell off their care plan get a personalised 30-day re-engagement message: professional, caring, results-focused.",
      review: "After patients complete care milestones, Rebooked requests a Google review — helping new patients find you.",
      reminder: "Appointment reminders 24h and 2h before — with care plan context to reinforce commitment to their treatment.",
    },
    faq: [
      {
        question: "How does Rebooked keep chiropractic patients on their care plans?",
        answer: "Rebooked sends automated follow-ups when patients miss adjustments and re-engagement texts when they fall off their care plan. Patients who feel better after 2-3 visits often stop prematurely, and Rebooked's messages remind them why completing the full plan matters.",
      },
      {
        question: "What does Rebooked cost for a chiropractic practice?",
        answer: "Rebooked is $199/month plus 15% of recovered revenue. At $85 per adjustment, recovering just 3 missed appointments per month covers the subscription. You get a 35-day free trial to prove ROI before you pay anything.",
      },
      {
        question: "Can Rebooked reduce no-show rates for chiropractors?",
        answer: "Yes. Rebooked sends appointment reminders 24 hours and 2 hours before each adjustment, then follows up within 15 minutes of a missed appointment. Practices using Rebooked typically cut their no-show rate by more than half.",
      },
      {
        question: "How does Rebooked handle referral patients for chiropractic practices?",
        answer: "When a GP or specialist refers a patient and they call your office, Rebooked ensures an instant text response if your reception is busy. Referral patients lose urgency within 48 hours, so fast contact is critical to converting them.",
      },
      {
        question: "Does Rebooked help chiropractors get more patient reviews?",
        answer: "Yes. After patients reach care milestones like completing their initial treatment plan, Rebooked automatically requests a Google review. This builds your online reputation and helps new patients find your practice through local search.",
      },
    ],
  },

  photography: {
    slug: "photography",
    name: "Photography Studio",
    namePlural: "Photography Studios",
    emoji: "📸",
    metaTitle: "Rebooked for Photographers — Protect Your Session Revenue",
    metaDescription: "Automated SMS for photography studios. Recover no-shows, fill cancellation gaps, and turn enquiries into bookings instantly. 35-day ROI guarantee.",
    heroHeadline: "A no-show on a $300 photography session leaves your studio dark for hours",
    heroSubheadline: "Rebooked handles instant follow-up, waiting list fills, and re-engagement automation — so your studio stays booked and your revenue stays consistent.",
    heroStat: "74%",
    heroStatLabel: "of photography session enquiries book within 1 hour of first contact",
    avgAppointmentValue: 300,
    defaultNoShows: 5,
    defaultCancellations: 4,
    painPoints: [
      {
        title: "Enquiries come in while you're in a shoot",
        description: "You're 45 minutes into a session when three people enquire. By the time you're done editing, two of them have already booked elsewhere.",
      },
      {
        title: "Last-minute cancellations waste expensive studio time",
        description: "Studio rental, lighting setup, your time — all blocked. A cancellation with 2 hours notice costs far more than just the session fee.",
      },
      {
        title: "Seasonal rush creates a waitlist you can't work through",
        description: "Christmas portraits, graduations, newborns — demand spikes and you lose track of who's waiting. Rebooked manages your waitlist automatically.",
      },
      {
        title: "Clients don't rebook until they need you again",
        description: "A great family portrait client from last year won't think to come back this year unless you remind them. Rebooked sends the reminder at exactly the right time.",
      },
    ],
    testimonials: [
      {
        quote: "I used to lose 2–3 sessions a month to last-minute cancellations I couldn't fill. Now I fill most of them within an hour from my waiting list.",
        name: "Zoe M.",
        business: "Zoe Mitchell Photography",
        result: "Cancellations filled in <1hr",
      },
      {
        quote: "The instant text-back on enquiries changed everything. I booked 4 new clients in the first week who said they chose me because I 'responded so fast'.",
        name: "Derek P.",
        business: "Aperture Studio",
        result: "4 new clients, week 1",
      },
    ],
    featureContext: {
      missedCall: "An enquiry comes in during a shoot — Rebooked texts back in seconds: \"Hi! Thanks for reaching out about a session. I'd love to work with you — what type of shoot are you thinking?\"",
      noShow: "A session no-show triggers an immediate professional follow-up with a reschedule link — protecting your revenue without an awkward phone call.",
      cancellation: "Cancellations unlock your waiting list — the first available client gets an instant notification and can claim the slot before it goes cold.",
      winBack: "Annual re-engagement for portrait clients: \"It's been a year since your last session — time for an update? I have some beautiful openings coming up.\"",
      review: "Post-session review requests timed perfectly — when clients have just seen their proofs and are absolutely thrilled.",
      reminder: "Pre-session reminders with what to expect, what to wear, and how to prepare — reducing no-shows and improving the client experience.",
    },
    faq: [
      {
        question: "How does Rebooked help photographers recover no-shows?",
        answer: "Rebooked texts no-show clients within 15 minutes of their missed session with a professional rebooking link. At $300 per session, recovering even one no-show per month generates significant return on your Rebooked subscription.",
      },
      {
        question: "What does Rebooked cost for a photography studio?",
        answer: "Rebooked is $199/month plus 15% of recovered revenue. With sessions averaging $300, recovering a single no-show per month nearly covers the cost. You get a 35-day free trial so there is zero risk to try it.",
      },
      {
        question: "Can Rebooked respond to photography enquiries while I am shooting?",
        answer: "Yes. When a prospect calls or messages during a session, Rebooked texts them back instantly with a warm, professional response and your booking link. Since 74% of photography clients book within the first hour of contact, this speed is critical.",
      },
      {
        question: "Does Rebooked help photographers fill seasonal demand?",
        answer: "Absolutely. Rebooked manages your waiting list automatically during peak seasons like holiday portraits and graduation photos. When a cancellation opens, waiting list clients are notified instantly so the slot fills itself.",
      },
      {
        question: "How does Rebooked bring back past photography clients annually?",
        answer: "Rebooked sends automated annual re-engagement texts to past portrait and family session clients, timed to when they last booked. A simple reminder that it has been a year since their last session drives repeat bookings consistently.",
      },
    ],
  },

  "auto-detailing": {
    slug: "auto-detailing",
    name: "Auto Detailing",
    namePlural: "Auto Detailers",
    emoji: "🚗",
    metaTitle: "Rebooked for Auto Detailers — Keep Your Bay Full Every Day",
    metaDescription: "Automated SMS for auto detailing businesses. Recover no-shows, fill cancellations, and build repeat business on autopilot. 35-day ROI guarantee.",
    heroHeadline: "An empty detailing bay is burning money. Fill it automatically.",
    heroSubheadline: "Rebooked texts no-shows, notifies your waiting list when a slot opens, and brings past clients back for their next detail — without you touching a phone.",
    heroStat: "61%",
    heroStatLabel: "of auto detailing clients rebook within 90 days when sent a timely follow-up",
    avgAppointmentValue: 150,
    defaultNoShows: 8,
    defaultCancellations: 6,
    painPoints: [
      {
        title: "Clients book and forget — especially for bigger details",
        description: "A full detail booked 2 weeks out is easy to forget. Without a reminder, your bay sits empty and your day is wasted.",
      },
      {
        title: "New enquiries need instant response",
        description: "Someone asking about a ceramic coating or paint correction is comparing 3–4 shops simultaneously. The first to respond wins the job.",
      },
      {
        title: "Regular clients drift away between seasons",
        description: "A client who gets detailed every spring hasn't come back this year. A single well-timed text: \"Spring is here — time to get that finish back?\" brings them in.",
      },
      {
        title: "Last-minute gaps are hard to fill manually",
        description: "A cancellation morning-of leaves your tech standing around. With a waiting list and instant notifications, that gap fills itself.",
      },
    ],
    testimonials: [
      {
        quote: "We went from averaging 3–4 no-shows a week to less than 1. At $150 a pop, that's a massive difference to our monthly revenue.",
        name: "Jake O.",
        business: "ProShine Detailing",
        result: "No-shows cut by 75%",
      },
      {
        quote: "The seasonal re-engagement is brilliant. We sent 40 win-back texts in spring and had 22 bookings within a week. Incredible ROI.",
        name: "Sandra V.",
        business: "DetailWorks Co.",
        result: "22 bookings from 40 texts",
      },
    ],
    featureContext: {
      missedCall: "A prospect calls about a full detail while you're working — Rebooked texts back instantly: \"Hey! Thanks for calling [business]. We'd love to quote you — what service are you interested in?\"",
      noShow: "A no-show triggers an immediate text: \"Hey [name], looks like we missed you today for your detail! Want to reschedule? We have spots this week.\"",
      cancellation: "Cancellations notify your waiting list immediately — first response gets the slot, and your bay stays productive.",
      winBack: "Past clients who haven't returned in 90 days get a seasonal re-engagement text — timed to spring cleaning, pre-summer, or winter prep.",
      review: "Post-detail review requests when the car is gleaming and the client is driving away happy — perfect timing for a 5-star review.",
      reminder: "Day-before reminders with your address, drop-off instructions, and expected completion time — reducing no-shows and setting expectations.",
    },
    faq: [
      {
        question: "How does Rebooked reduce no-shows for auto detailing businesses?",
        answer: "Rebooked sends SMS reminders the day before each detail appointment with drop-off instructions and timing, then follows up within 15 minutes of a no-show. Detailers using Rebooked cut their no-show rate by up to 75%.",
      },
      {
        question: "What does Rebooked cost for an auto detailing business?",
        answer: "Rebooked is $199/month plus 15% of recovered revenue. At $150 per detail, recovering just 2 no-shows per month covers the entire subscription. You get a 35-day free trial with no risk so you can prove the ROI first.",
      },
      {
        question: "Can Rebooked send seasonal reminders to past detailing clients?",
        answer: "Yes. Rebooked sends automated seasonal re-engagement texts timed to spring cleaning, pre-summer prep, and winter protection. One detailer sent 40 win-back texts in spring and received 22 bookings within a week.",
      },
      {
        question: "How does Rebooked help auto detailers respond to new enquiries faster?",
        answer: "When a prospect calls about a ceramic coating or paint correction while you are working, Rebooked texts them back within seconds. Since clients typically compare 3-4 shops at once, the fastest response wins the job.",
      },
      {
        question: "Does Rebooked help auto detailers build repeat business?",
        answer: "Absolutely. Rebooked sends automated follow-ups to past clients at 90 days, seasonal nudges, and review requests after each detail. This turns one-time customers into regulars and builds your Google review profile simultaneously.",
      },
    ],
  },

  tutoring: {
    slug: "tutoring",
    name: "Tutoring & Music Lessons",
    namePlural: "Tutors & Music Teachers",
    emoji: "🎵",
    metaTitle: "Rebooked for Tutors & Music Teachers — Stop Losing Sessions to No-Shows",
    metaDescription: "Automated SMS for tutors and music teachers. Recover missed sessions, reduce last-minute cancellations, and keep students engaged. 35-day ROI guarantee.",
    heroHeadline: "Students who miss lessons fall behind — and stop coming altogether",
    heroSubheadline: "Rebooked keeps students accountable with automated reminders, same-day follow-ups, and re-engagement messages that protect your income and your students' progress.",
    heroStat: "69%",
    heroStatLabel: "of students who miss a lesson without follow-up cancel the next one too",
    avgAppointmentValue: 60,
    defaultNoShows: 10,
    defaultCancellations: 8,
    painPoints: [
      {
        title: "Students (and parents) forget between sessions",
        description: "Weekly lessons are easy to forget, especially with school schedules. A personal reminder text reduces no-shows dramatically and shows you care.",
      },
      {
        title: "Last-minute cancellations leave you with blocked time",
        description: "An hour blocked for a student who cancels 30 minutes before is time you can't sell. Rebooked fills it from your waiting list.",
      },
      {
        title: "New enquiries need instant follow-up",
        description: "A parent asking about piano lessons for their child is actively shopping. The first tutor to respond with enthusiasm and availability wins the student.",
      },
      {
        title: "Students ghost after exam season",
        description: "Students who took a break for exams rarely come back unless you reach out. A simple re-engagement at the right time recaptures the relationship.",
      },
    ],
    testimonials: [
      {
        quote: "I teach 25 students a week. Recovering even 2–3 missed sessions per month at $60 each adds up to real money. Rebooked pays for itself 3x over.",
        name: "Claire M.",
        business: "Melodia Music Studio",
        result: "3x ROI monthly",
      },
      {
        quote: "The parent reminder system is perfect. They get a text the night before and a reminder the morning of. No-shows dropped by half.",
        name: "David S.",
        business: "Academic Edge Tutoring",
        result: "No-shows halved",
      },
    ],
    featureContext: {
      missedCall: "A parent enquires about lessons while you're teaching — Rebooked texts back: \"Hi! Thanks for reaching out. I'd love to tell you more about lessons — what subject/instrument are you interested in?\"",
      noShow: "A missed lesson triggers an instant text: \"Hey [name], we missed you today! Everything okay? Let's find a makeup time that works for you.\"",
      cancellation: "Cancellations notify waiting list students — so your time is never wasted and eager students get their slot.",
      winBack: "Students who paused after exams get a timely re-engagement: \"Hope exams went well! Ready to get back to lessons? I have openings this week.\"",
      review: "After students reach milestones — first recital, exam pass, grade completion — Rebooked requests a review from parents.",
      reminder: "Evening-before and morning-of reminders for students and parents — dramatically reducing same-day cancellations.",
    },
    faq: [
      {
        question: "How does Rebooked reduce missed lessons for tutors and music teachers?",
        answer: "Rebooked sends evening-before and morning-of reminders to students and parents, then follows up within 15 minutes of a missed lesson with a makeup scheduling link. This two-step approach cuts no-shows by roughly half.",
      },
      {
        question: "What does Rebooked cost for a tutoring or music lesson business?",
        answer: "Rebooked is $199/month plus 15% of recovered revenue. At $60 per lesson, recovering just 4 missed sessions per month covers the subscription. You get a 35-day free trial to verify the ROI before paying anything.",
      },
      {
        question: "Can Rebooked re-engage students who stopped lessons after exams?",
        answer: "Yes. Students who pause after exam season rarely return on their own. Rebooked sends a timed re-engagement text once exams are over, making it easy for them to resume with a direct booking link. This recaptures students who would otherwise be lost.",
      },
      {
        question: "Does Rebooked work for both parents and adult students?",
        answer: "Absolutely. Rebooked sends reminders and follow-ups to whichever contact is on file — whether that is a parent managing their child's schedule or an adult student booking their own lessons. The messaging tone adapts to be appropriate for both.",
      },
      {
        question: "How does Rebooked help tutors respond to new parent enquiries?",
        answer: "When a parent enquires about lessons while you are teaching, Rebooked texts them back instantly with a warm response and your availability. Parents actively shopping for a tutor choose the first professional who responds with enthusiasm.",
      },
    ],
  },

  "nail-salons": {
    slug: "nail-salons",
    name: "Nail Salon",
    namePlural: "Nail Salons",
    emoji: "💅",
    metaTitle: "Rebooked for Nail Salons — Keep Your Nail Techs Busy All Day",
    metaDescription: "Automated SMS for nail salons. Recover no-shows, fill cancellations, and keep clients on a regular appointment schedule. 35-day ROI guarantee.",
    heroHeadline: "A nail tech waiting for a no-show is costing you $45 every 30 minutes",
    heroSubheadline: "Rebooked sends reminders, recovers no-shows instantly, and fills your waiting list slots automatically — so every technician stays busy and every client comes back.",
    heroStat: "64%",
    heroStatLabel: "of nail salon no-shows rebook within 72 hours when followed up by text",
    avgAppointmentValue: 45,
    defaultNoShows: 15,
    defaultCancellations: 12,
    painPoints: [
      {
        title: "Clients book weeks out and forget the appointment",
        description: "A gel appointment booked 3 weeks ago is easy to forget. Without a reminder, your tech is waiting and your chair is empty.",
      },
      {
        title: "You lose loyal clients between sets",
        description: "A client who gets a fresh set every 3 weeks slips to every 5 weeks. Over a year, that's 8 fewer appointments. Automated rebooking nudges keep them on schedule.",
      },
      {
        title: "Walk-in traffic isn't reliable enough to fill gaps",
        description: "You can't count on walk-ins to fill last-minute cancellations. A digital waiting list that self-fills is far more reliable.",
      },
      {
        title: "New clients don't rebook after their first visit",
        description: "A first-time client had a great experience but doesn't know your schedule. A single follow-up text converts them from a one-time visitor to a regular.",
      },
    ],
    testimonials: [
      {
        quote: "We had 10–12 no-shows a week. Now it's 2–3 max. At $45 each that's nearly $400 a week in recovered revenue. Wild.",
        name: "Lily C.",
        business: "Luxe Nail Bar",
        result: "$400/week recovered",
      },
      {
        quote: "The rebook reminder after 3 weeks is genius. Clients come back like clockwork now. My techs are busier and happier.",
        name: "Nina P.",
        business: "The Polish Room",
        result: "Rebook rate up 55%",
      },
    ],
    featureContext: {
      missedCall: "A client calls when you're with someone — Rebooked texts back instantly: \"Hi! Sorry we missed your call. We'd love to book you in — what service are you after?\"",
      noShow: "A no-show triggers an immediate caring text: \"Hey [name], looks like we missed you today! No worries — want to reschedule? We have spots this week.\"",
      cancellation: "Cancellations instantly notify your waiting list — the first to respond claims the slot and your tech stays booked.",
      winBack: "Clients overdue for their next set get a personalised nudge: \"Hey [name], your nails are probably ready for a refresh! We have openings this week.\"",
      review: "Post-appointment review requests at the perfect moment — when clients are admiring their fresh nails and feeling great.",
      reminder: "24h and 2h reminders with your location, parking, and a confirmation tap — dramatically reducing no-shows.",
    },
    faq: [
      {
        question: "How does Rebooked reduce no-shows for nail salons?",
        answer: "Rebooked sends automated SMS reminders 24 hours and 2 hours before each appointment, then texts no-show clients within 15 minutes with a rebooking link. Nail salons using Rebooked typically see no-shows drop from 10-12 per week to just 2-3.",
      },
      {
        question: "What does Rebooked cost for a nail salon?",
        answer: "Rebooked is $199/month plus 15% of recovered revenue. At $45 per appointment, recovering just 5 no-shows per month covers the subscription. You get a 35-day free trial with zero risk so you can see the results before you pay.",
      },
      {
        question: "Can Rebooked keep nail clients on a regular appointment schedule?",
        answer: "Yes. Rebooked sends automated rebooking reminders when a client is due for their next set based on your recommended interval. This keeps clients coming back every 2-3 weeks like clockwork instead of drifting to every 5-6 weeks.",
      },
      {
        question: "How does Rebooked fill last-minute nail salon cancellations?",
        answer: "When a client cancels, Rebooked instantly texts your waiting list in priority order. The first client to respond claims the slot. This keeps your nail techs busy all day instead of relying on unpredictable walk-in traffic.",
      },
      {
        question: "Does Rebooked help nail salons convert first-time clients into regulars?",
        answer: "Absolutely. After a first visit, Rebooked sends an automated follow-up thanking the client and offering easy rebooking. This single text converts significantly more first-time visitors into recurring clients who book on a regular schedule.",
      },
    ],
  },

  veterinary: {
    slug: "veterinary",
    name: "Veterinary Clinic",
    namePlural: "Veterinary Clinics",
    emoji: "🐾",
    metaTitle: "Rebooked for Veterinary Clinics — Stop Losing Appointments to Pet No-Shows",
    metaDescription: "Automated SMS recovery for vet clinics. Reduce missed appointments, fill cancellations, and keep pet parents on schedule. 35-day ROI guarantee.",
    heroHeadline: "Pet parents forget appointments. Your clinic schedule shouldn't suffer for it.",
    heroSubheadline: "Rebooked sends timely reminders and instant recovery texts so your exam rooms stay full and pets stay healthy.",
    heroStat: "58%",
    heroStatLabel: "of missed vet appointments rebook when texted within 30 minutes",
    avgAppointmentValue: 85,
    defaultNoShows: 15,
    defaultCancellations: 10,
    painPoints: [
      {
        title: "Missed wellness checks mean missed revenue — and sicker pets",
        description: "When a pet owner no-shows on a $85 wellness exam, you lose revenue and the pet misses critical preventive care. Multiply that by 12-15 no-shows per month and it adds up fast.",
      },
      {
        title: "Vaccination schedules fall behind without automated follow-ups",
        description: "Pet owners intend to come back for boosters but life gets busy. Without a proactive text reminder, vaccination series go incomplete and your schedule has gaps.",
      },
      {
        title: "Staff waste hours making reminder calls that go to voicemail",
        description: "Your front desk team spends 30-60 minutes daily calling clients who don't pick up. A text gets read in 3 minutes and frees your team for in-clinic work.",
      },
    ],
    testimonials: [
      {
        quote: "We went from 15 no-shows a month to 4. That's over $900 in recovered appointments. The texts feel friendly and pet owners love the reminders.",
        name: "Dr. Sarah M.",
        business: "Pawsome Vet Care",
        result: "$935/month recovered",
      },
      {
        quote: "The vaccination follow-up texts are incredible. Our booster completion rate jumped from 60% to 88% in the first month.",
        name: "Dr. Mike T.",
        business: "Greenfield Animal Hospital",
        result: "Booster rate up 47%",
      },
    ],
    featureContext: {
      missedCall: "A pet owner calls during a procedure — Rebooked texts back: \"Hi! Thanks for calling. We're with a patient right now. What can we help with — booking an appointment or a question about your pet?\"",
      noShow: "A no-show triggers a gentle text: \"Hey [name], we noticed [pet name] missed their appointment today. We'd love to reschedule — we have openings this week!\"",
      cancellation: "Same-day cancellations instantly alert clients on your waiting list. The first to confirm gets the slot — keeping your exam rooms full.",
      winBack: "Pets overdue for checkups get a personalised reminder: \"Hey [name], it's been a while since [pet name]'s last visit. Time for a wellness check? We have spots available.\"",
      review: "Post-visit review requests when the pet parent is happiest — right after a successful visit when Fluffy got a clean bill of health.",
      reminder: "24h and 2h appointment reminders with your clinic address and what to bring — dramatically reducing missed visits.",
    },
    faq: [
      {
        question: "How does Rebooked reduce no-shows for veterinary clinics?",
        answer: "Rebooked sends automated SMS reminders 24 hours and 2 hours before each pet appointment, then texts no-show clients within 15 minutes with a rebooking link. Vet clinics using Rebooked typically see no-shows drop by 60-70%.",
      },
      {
        question: "What does Rebooked cost for a veterinary clinic?",
        answer: "Rebooked is $199/month plus 15% of recovered revenue. At $85 per appointment, recovering just 3 no-shows per month more than covers the subscription. You get a 35-day free trial with zero risk.",
      },
      {
        question: "Can Rebooked help with vaccination follow-up reminders?",
        answer: "Yes. Rebooked sends automated follow-ups when pets are due for boosters or annual checkups based on your recommended schedule. This keeps vaccination series on track and pet parents coming back consistently.",
      },
      {
        question: "Is Rebooked compliant for veterinary communications?",
        answer: "Absolutely. All messages are TCPA-compliant with proper opt-in, opt-out handling, and quiet hours. Messages are professional and caring — appropriate for pet parent communication.",
      },
      {
        question: "How does Rebooked fill cancelled vet appointments?",
        answer: "When a client cancels, Rebooked instantly texts your waiting list in priority order. The first client to respond gets the slot, keeping your vets and exam rooms busy all day.",
      },
    ],
  },

  "massage-therapy": {
    slug: "massage-therapy",
    name: "Massage Therapist",
    namePlural: "Massage Therapists",
    emoji: "💆",
    metaTitle: "Rebooked for Massage Therapists — Fill Your Table Every Hour",
    metaDescription: "Automated SMS recovery for massage therapists. Recover no-shows, fill cancellations, and build repeat clientele on autopilot. 35-day ROI guarantee.",
    heroHeadline: "An empty massage table for an hour is an hour of income you never get back.",
    heroSubheadline: "Rebooked keeps your schedule full with automated reminders, no-show recovery, and rebooking texts — so you spend time healing, not chasing clients.",
    heroStat: "65%",
    heroStatLabel: "of massage no-shows rebook when texted the same day",
    avgAppointmentValue: 95,
    defaultNoShows: 12,
    defaultCancellations: 10,
    painPoints: [
      {
        title: "A missed 60-minute session is $95 you can't recover from walk-ins",
        description: "Unlike retail, you can't make up a missed massage appointment later. That hour is gone. With 3-4 no-shows a week, you're losing $1,200+ monthly.",
      },
      {
        title: "Clients book ahead then forget or get busy",
        description: "Massage clients often book 2-4 weeks out. By appointment day, life has gotten in the way. Without a reminder, they simply forget.",
      },
      {
        title: "Building a regular clientele requires consistent follow-up",
        description: "The difference between a one-time client and a monthly regular is a timely rebooking prompt. Most therapists are too busy to follow up manually.",
      },
    ],
    testimonials: [
      {
        quote: "I was losing 3-4 clients a week to no-shows. Now I lose maybe 1. That's an extra $1,100/month and my evenings aren't spent making confirmation calls.",
        name: "Rachel K.",
        business: "Healing Hands Massage",
        result: "$1,100/month recovered",
      },
      {
        quote: "The automated rebooking text after each session is genius. My repeat booking rate went from 40% to 72%. Clients love the convenience.",
        name: "Tom L.",
        business: "Deep Tissue Studio",
        result: "Repeat bookings up 80%",
      },
    ],
    featureContext: {
      missedCall: "A potential client calls while you're mid-session — Rebooked texts back: \"Hi! I'm with a client right now. I'd love to get you booked in — what time works for you?\"",
      noShow: "A no-show triggers a warm text: \"Hey [name], I noticed you couldn't make it today. No worries — want to reschedule? I have openings this week.\"",
      cancellation: "Last-minute cancellations trigger your waiting list. The first person to respond gets the slot — no revenue lost.",
      winBack: "Clients who haven't booked in 30+ days get a personalised nudge: \"Hey [name], your body is probably ready for another session! I have openings this week.\"",
      review: "Post-session review requests at the perfect moment — when clients feel relaxed and grateful for the relief.",
      reminder: "24h and 2h reminders with your location and any pre-session instructions — cutting no-shows dramatically.",
    },
    faq: [
      {
        question: "How does Rebooked help massage therapists reduce no-shows?",
        answer: "Rebooked sends automated SMS reminders before each appointment and recovery texts within minutes of a no-show. Massage therapists typically see no-shows cut by 60-75% within the first month.",
      },
      {
        question: "What does Rebooked cost for a massage therapist?",
        answer: "Rebooked is $199/month plus 15% of recovered revenue. At $95 per session, recovering just 2-3 no-shows per month pays for the subscription. The 35-day free trial lets you see results before paying.",
      },
      {
        question: "Can Rebooked help build a regular massage clientele?",
        answer: "Yes. Post-session rebooking texts prompt clients to schedule their next visit while they're still feeling the benefits. This dramatically increases repeat booking rates.",
      },
      {
        question: "Does Rebooked work for solo massage practitioners?",
        answer: "Absolutely. Rebooked is designed for solo practitioners and small teams. It runs on autopilot so you can focus on clients instead of admin work.",
      },
      {
        question: "How does Rebooked handle last-minute massage cancellations?",
        answer: "When a client cancels, Rebooked instantly texts your waiting list. The first to respond gets the slot. This keeps your table full even with same-day cancellations.",
      },
    ],
  },

  aesthetics: {
    slug: "aesthetics",
    name: "Aesthetics & Lash Studio",
    namePlural: "Aesthetics & Lash Studios",
    emoji: "✨",
    metaTitle: "Rebooked for Aesthetics & Lash Studios — Keep Every Chair Booked",
    metaDescription: "Automated SMS recovery for aesthetics, lash, and brow studios. Recover no-shows, fill gaps, and keep clients on schedule. 35-day ROI guarantee.",
    heroHeadline: "A no-show on a lash fill costs you $75 and an hour you can't get back.",
    heroSubheadline: "Rebooked keeps your aesthetics studio fully booked with automated reminders, recovery texts, and maintenance schedule nudges.",
    heroStat: "61%",
    heroStatLabel: "of lash/aesthetics no-shows rebook with a same-day text",
    avgAppointmentValue: 75,
    defaultNoShows: 14,
    defaultCancellations: 10,
    painPoints: [
      {
        title: "Lash fills and brow appointments have tight scheduling — gaps are costly",
        description: "With appointments running 45-90 minutes back-to-back, a single no-show creates a gap that's nearly impossible to fill on the spot.",
      },
      {
        title: "Clients let maintenance appointments lapse",
        description: "Lash fills need rebooking every 2-3 weeks. Without a reminder, clients stretch to 4-5 weeks — costing you revenue and meaning more work per session.",
      },
      {
        title: "Instagram DMs and phone calls go unanswered during services",
        description: "You're applying lashes and can't answer the phone. That potential client moves on to the next studio that responds instantly.",
      },
    ],
    testimonials: [
      {
        quote: "No-shows were killing my schedule. Rebooked cut them by 70% and the rebooking reminders keep clients on their 2-week fill cycle. Game changer.",
        name: "Jade W.",
        business: "Lash & Brow Studio",
        result: "No-shows down 70%",
      },
      {
        quote: "The missed call text-back alone has booked me 8-10 new clients a month. I used to lose those leads during appointments.",
        name: "Priya S.",
        business: "Glow Aesthetics",
        result: "8-10 new leads/month captured",
      },
    ],
    featureContext: {
      missedCall: "A potential client calls while you're mid-lash set — Rebooked texts back instantly: \"Hi! I'm with a client right now. I'd love to get you booked in — what service are you interested in?\"",
      noShow: "A no-show triggers an immediate text: \"Hey [name], looks like we missed you today! Want to reschedule your lash fill? I have spots this week.\"",
      cancellation: "Cancellations instantly notify your waiting list — keeping your chair filled and your day on track.",
      winBack: "Clients overdue for their fill get a nudge: \"Hey [name], it's been 3 weeks since your last lash fill — ready for a refresh? I have openings!\"",
      review: "Post-appointment review requests when clients feel fabulous — right after their fresh set when they're taking selfies.",
      reminder: "24h and 2h reminders with pre-appointment prep instructions — ensuring clients arrive ready and on time.",
    },
    faq: [
      {
        question: "How does Rebooked reduce no-shows for lash and aesthetics studios?",
        answer: "Rebooked sends automated SMS reminders before appointments and recovery texts within minutes of a no-show. Studios typically see no-shows drop by 60-70%.",
      },
      {
        question: "What does Rebooked cost for an aesthetics studio?",
        answer: "Rebooked is $199/month plus 15% of recovered revenue. At $75 per lash fill, recovering just 3 no-shows monthly covers the cost. The 35-day free trial lets you see results first.",
      },
      {
        question: "Can Rebooked remind clients when they're due for a lash fill?",
        answer: "Yes. Rebooked sends automated maintenance reminders based on your recommended fill interval. This keeps clients on a regular 2-3 week cycle instead of letting appointments lapse.",
      },
      {
        question: "Does Rebooked capture leads when I'm with a client?",
        answer: "Absolutely. When you miss a call, Rebooked texts back instantly offering to book them in. This captures leads that would otherwise go to competitors.",
      },
      {
        question: "How does Rebooked handle same-day cancellations?",
        answer: "When a client cancels, Rebooked instantly texts your waiting list in priority order. The first to respond claims the slot, keeping your schedule full.",
      },
    ],
  },

  counseling: {
    slug: "counseling",
    name: "Counselor & Psychologist",
    namePlural: "Counselors & Psychologists",
    emoji: "🧠",
    metaTitle: "Rebooked for Counselors & Psychologists — Reduce Missed Sessions Professionally",
    metaDescription: "TCPA-compliant automated SMS for mental health practices. Reduce no-shows, fill gaps, and maintain client engagement with sensitive, professional messaging. 35-day ROI guarantee.",
    heroHeadline: "Missed sessions hurt your practice and your clients' progress. Fix both automatically.",
    heroSubheadline: "Rebooked sends sensitive, TCPA-compliant reminders and recovery texts that respect the therapeutic relationship while keeping your schedule full.",
    heroStat: "52%",
    heroStatLabel: "of missed therapy sessions rebook when followed up professionally via text",
    avgAppointmentValue: 150,
    defaultNoShows: 10,
    defaultCancellations: 8,
    painPoints: [
      {
        title: "A missed $150 session is the most expensive empty hour in healthcare",
        description: "Counseling sessions are high-value and difficult to backfill same-day. With 8-10 no-shows per month, practices lose $1,200-$1,500 in revenue.",
      },
      {
        title: "Clients in distress sometimes avoid sessions — they need gentle outreach",
        description: "No-shows in mental health often signal struggle, not disinterest. A caring follow-up text can re-engage clients when they need help most.",
      },
      {
        title: "Confidentiality requirements make manual follow-up tricky",
        description: "You can't leave detailed voicemails or send emails that might be seen by others. SMS with carefully crafted, privacy-conscious wording solves this.",
      },
    ],
    testimonials: [
      {
        quote: "Our no-show rate dropped from 18% to 7%. The texts are tasteful and professional — clients tell us they appreciate the reminders.",
        name: "Dr. Lisa R.",
        business: "Clarity Counseling",
        result: "No-show rate cut to 7%",
      },
      {
        quote: "I was spending 45 minutes a day on reminder calls. Rebooked handles it all and my cancellation fill rate went from 10% to 65%.",
        name: "James B.",
        business: "Mindful Therapy Group",
        result: "65% cancellation fill rate",
      },
    ],
    featureContext: {
      missedCall: "A potential client calls during a session — Rebooked texts: \"Thank you for reaching out. I'm currently in session. I'd be happy to connect — are you looking to schedule an appointment?\"",
      noShow: "A missed appointment triggers a gentle text: \"Hi [name], I noticed we missed our session today. I hope you're doing okay. Would you like to reschedule?\"",
      cancellation: "Late cancellations trigger your availability list — filling the gap with clients who need an earlier appointment.",
      winBack: "Clients who haven't been seen in 30+ days get a caring check-in: \"Hi [name], it's been a while since our last session. I have availability if you'd like to reconnect.\"",
      review: "Professional review requests at the right moment — helping you build your practice reputation while respecting client boundaries.",
      reminder: "24h and 2h session reminders with location details — confidential, professional, and effective at reducing missed appointments.",
    },
    faq: [
      {
        question: "Are Rebooked's messages appropriate for mental health practices?",
        answer: "Yes. All messages are carefully crafted to be professional, sensitive, and confidentiality-aware. They never mention diagnosis, treatment, or clinical details — just appointment logistics.",
      },
      {
        question: "What does Rebooked cost for a counseling practice?",
        answer: "Rebooked is $199/month plus 15% of recovered revenue. At $150 per session, recovering just 2 no-shows per month pays for itself. The 35-day free trial is zero risk.",
      },
      {
        question: "Is Rebooked TCPA and HIPAA-friendly?",
        answer: "Rebooked is fully TCPA-compliant with proper opt-in, opt-out, and quiet hours. Messages contain only appointment logistics — no protected health information — making them appropriate for HIPAA-conscious practices.",
      },
      {
        question: "Can Rebooked handle clients who frequently cancel?",
        answer: "Yes. Rebooked tracks patterns and helps you identify clients who cancel frequently. The system can adjust messaging and help fill their cancelled slots from your waiting list.",
      },
      {
        question: "How does Rebooked protect client confidentiality?",
        answer: "Messages never reference the type of appointment, diagnosis, or treatment. They simply reference a scheduled appointment time and offer rebooking — keeping clinical details confidential.",
      },
    ],
  },

  "med-spa": {
    slug: "med-spa",
    name: "Med Spa & Aesthetic Clinic",
    namePlural: "Med Spas & Aesthetic Clinics",
    emoji: "💉",
    metaTitle: "Rebooked for Med Spas — Recover High-Value Appointment Revenue",
    metaDescription: "Automated SMS recovery for med spas and aesthetic clinics. Recover Botox, filler, and laser no-shows automatically. 35-day ROI guarantee.",
    heroHeadline: "A no-show on a $400 Botox appointment is revenue you can't afford to lose.",
    heroSubheadline: "Rebooked keeps your med spa schedule full with automated reminders, instant no-show recovery, and treatment follow-up scheduling.",
    heroStat: "59%",
    heroStatLabel: "of med spa no-shows rebook when texted within 20 minutes",
    avgAppointmentValue: 350,
    defaultNoShows: 8,
    defaultCancellations: 6,
    painPoints: [
      {
        title: "High-value treatments mean high-cost no-shows",
        description: "A single missed Botox or filler appointment is $300-$500 in lost revenue. With 6-8 no-shows per month, that's $2,000-$4,000 vanishing from your bottom line.",
      },
      {
        title: "Treatment schedules require consistent client follow-up",
        description: "Botox needs refreshing every 3-4 months. Laser packages require multiple sessions. Without automated follow-ups, clients fall off their treatment plans.",
      },
      {
        title: "Consultations that don't convert to treatments are lost opportunities",
        description: "A client books a consultation but doesn't schedule treatment. Without follow-up, that warm lead goes cold — and to your competitor.",
      },
    ],
    testimonials: [
      {
        quote: "We recovered $4,200 in the first month alone. The no-show texts are professional and clients don't feel pressured — they feel cared for.",
        name: "Dr. Amanda C.",
        business: "Glow Med Spa",
        result: "$4,200/month recovered",
      },
      {
        quote: "The treatment follow-up reminders keep clients on their Botox schedule. Our rebooking rate for touch-ups went from 55% to 82%.",
        name: "Kim L.",
        business: "Rejuvenate Aesthetics",
        result: "Rebooking rate up 49%",
      },
    ],
    featureContext: {
      missedCall: "A potential client calls during a treatment — Rebooked texts: \"Hi! Thanks for calling. We're with a client right now. Would you like to schedule a consultation? We have openings this week!\"",
      noShow: "A no-show triggers an immediate text: \"Hey [name], we noticed you couldn't make your appointment today. We'd love to reschedule — we have availability this week!\"",
      cancellation: "Cancellations instantly alert high-priority clients on your waiting list — keeping your injector's schedule optimized.",
      winBack: "Clients due for Botox touch-ups get a timely reminder: \"Hey [name], it's been 3 months since your last treatment. Ready for a refresh? We have spots this week.\"",
      review: "Post-treatment review requests timed for when results are at their best — when clients are admiring their refreshed look.",
      reminder: "24h and 2h reminders with pre-treatment instructions (avoid blood thinners, arrive early for numbing) — reducing no-shows and prepping clients properly.",
    },
    faq: [
      {
        question: "How does Rebooked reduce no-shows for med spas?",
        answer: "Rebooked sends professional SMS reminders before appointments and instant recovery texts for no-shows. Med spas typically see a 60-70% reduction in missed appointments within the first month.",
      },
      {
        question: "What does Rebooked cost for a med spa?",
        answer: "Rebooked is $199/month plus 15% of recovered revenue. At $350 average appointment value, recovering just 1 no-show per month covers the cost. The 35-day free trial is completely risk-free.",
      },
      {
        question: "Can Rebooked manage treatment series and follow-up scheduling?",
        answer: "Yes. Rebooked sends automated follow-ups when clients are due for their next treatment — whether it's a Botox touch-up at 3 months or the next session in a laser package.",
      },
      {
        question: "Is Rebooked appropriate for medical aesthetic communications?",
        answer: "Absolutely. Messages are professional, TCPA-compliant, and never reference specific treatments or medical details unless you configure them to.",
      },
      {
        question: "How does Rebooked convert consultations into booked treatments?",
        answer: "After a consultation, Rebooked sends a follow-up text offering easy scheduling for the recommended treatment. This converts warm leads that might otherwise go cold.",
      },
    ],
  },

  "barber": {
    slug: "barber",
    name: "Barbershop",
    namePlural: "Barbershops",
    emoji: "💈",
    metaTitle: "Rebooked for Barbershops — Stop Losing Cuts to No-Shows",
    metaDescription: "Automated SMS recovery built for barbershops. Recover no-shows, fill empty chairs, and keep your barbers booked solid. 35-day ROI guarantee.",
    heroHeadline: "An empty barber chair is money walking out the door every 30 minutes.",
    heroSubheadline: "Rebooked keeps your barbershop fully booked with automated reminders, instant no-show recovery, and rebooking texts that keep clients on schedule.",
    heroStat: "64%",
    heroStatLabel: "of barbershop no-shows rebook when texted within 15 minutes",
    avgAppointmentValue: 35,
    defaultNoShows: 20,
    defaultCancellations: 15,
    painPoints: [
      {
        title: "High-volume scheduling means more no-shows add up fast",
        description: "With 30-40 minute appointments, a single barber can lose 4-5 slots per week to no-shows. At $35 each, that's $7,000+ per year per barber.",
      },
      {
        title: "Walk-in culture makes appointment commitment feel optional",
        description: "Many barbershop clients treat booked appointments casually. They booked online but figure they'll just walk in another day.",
      },
      {
        title: "Clients drift to every 5-6 weeks instead of the 3-4 you recommend",
        description: "Without a rebooking reminder, clients let their cuts stretch. That's 2-3 fewer cuts per year per client — directly hitting your revenue.",
      },
    ],
    testimonials: [
      {
        quote: "No-shows were our biggest headache. Rebooked cut them in half within two weeks. My barbers are actually busy for their full shifts now.",
        name: "Marcus J.",
        business: "Fade Factory",
        result: "No-shows cut 50%",
      },
      {
        quote: "The rebooking reminders at 3 weeks keep guys coming back on schedule. Our average client now visits 14 times a year instead of 10.",
        name: "Carlos R.",
        business: "Sharp Cuts Barbershop",
        result: "Visit frequency up 40%",
      },
    ],
    featureContext: {
      missedCall: "A client calls while your barber is mid-fade — Rebooked texts back: \"Hey! We're with clients right now. Want to book a slot? We have openings today.\"",
      noShow: "A no-show triggers a quick text: \"Hey [name], looks like we missed you today! Want to reschedule your cut? We've got spots this week.\"",
      cancellation: "Cancellations instantly text your waiting list — the first to respond gets the chair. No revenue lost.",
      winBack: "Clients overdue for a cut get a nudge: \"Hey [name], it's been a month since your last fade. Time for a fresh one? We have openings.\"",
      review: "Post-cut review requests right when the client's looking sharp and feeling confident — peak review time.",
      reminder: "24h and 2h text reminders — keeping barbershop no-shows to a minimum without any phone calls.",
    },
    faq: [
      {
        question: "How does Rebooked reduce no-shows for barbershops?",
        answer: "Rebooked sends automated SMS reminders before appointments and recovery texts within minutes of a no-show. Barbershops typically see no-shows drop by 50-65% in the first month.",
      },
      {
        question: "What does Rebooked cost for a barbershop?",
        answer: "Rebooked is $199/month plus 15% of recovered revenue. With high appointment volume, recovering just 6 no-shows per month at $35 each covers the cost. The 35-day free trial is zero risk.",
      },
      {
        question: "Can Rebooked keep clients on a regular haircut schedule?",
        answer: "Yes. Automated rebooking reminders prompt clients when they're due for their next cut. This increases visit frequency from every 5-6 weeks to the 3-4 weeks you recommend.",
      },
      {
        question: "Does Rebooked work for multi-barber shops?",
        answer: "Absolutely. Rebooked manages scheduling across your entire team. Each barber's no-shows and cancellations are handled individually while the waiting list fills gaps shop-wide.",
      },
      {
        question: "How fast does Rebooked fill cancelled barber appointments?",
        answer: "Within minutes. Cancellations trigger instant texts to your waiting list. In high-demand shops, cancelled slots are typically claimed within 5-10 minutes.",
      },
    ],
  },
};

export const INDUSTRY_SLUGS = Object.keys(INDUSTRIES);
