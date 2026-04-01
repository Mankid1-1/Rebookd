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
  },
};

export const INDUSTRY_SLUGS = Object.keys(INDUSTRIES);
