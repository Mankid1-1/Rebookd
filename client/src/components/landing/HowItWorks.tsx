import { motion } from "framer-motion";
import { UserPlus, ToggleRight, TrendingUp } from "lucide-react";
import { fadeInUp, staggerContainerSlow } from "@/lib/animations";

const STEPS = [
  {
    icon: UserPlus,
    number: "1",
    title: "Sign up & import contacts",
    description: "Create your account in under a minute. Import your existing clients from CSV, Google Contacts, or booking platforms like Square, Vagaro, and Booksy.",
    color: "text-info",
    bg: "bg-info/10",
    border: "border-info/20",
  },
  {
    icon: ToggleRight,
    number: "2",
    title: "Turn on your automations",
    description: "Pick from 29 ready-made SMS workflows — reminders, no-show follow-ups, win-backs, review requests, and more. Just toggle on what fits your business.",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
  },
  {
    icon: TrendingUp,
    number: "3",
    title: "Watch revenue come back",
    description: "Every recovered appointment and dollar is tracked in your live dashboard. If you don't see positive ROI within 35 days, you don't pay a thing.",
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/20",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-6 border-t border-border/30">
      <div className="max-w-4xl mx-auto">
        <motion.div
          className="text-center mb-14"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
        >
          <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Up and running in <span className="text-primary">15 minutes</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            No complicated setup. No coding. No consultants. Just three simple steps.
          </p>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-3 gap-6"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainerSlow}
        >
          {STEPS.map((step) => (
            <motion.div
              key={step.number}
              variants={fadeInUp}
              className={`relative p-6 rounded-2xl border ${step.border} bg-card text-center`}
            >
              {/* Number badge */}
              <div className={`w-10 h-10 rounded-full ${step.bg} flex items-center justify-center mx-auto mb-4`}>
                <span className={`text-lg font-bold ${step.color}`}>{step.number}</span>
              </div>
              <div className={`w-12 h-12 rounded-xl ${step.bg} flex items-center justify-center mx-auto mb-4`}>
                <step.icon className={`w-6 h-6 ${step.color}`} />
              </div>
              <h3 className="font-semibold text-base mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Connecting visual - desktop only */}
        <div className="hidden md:flex items-center justify-center mt-[-160px] mb-[100px] pointer-events-none" aria-hidden>
          <div className="flex items-center gap-0 w-full max-w-2xl mx-auto px-20">
            <div className="flex-1 h-px bg-border/50" />
            <div className="flex-1 h-px bg-border/50" />
          </div>
        </div>
      </div>
    </section>
  );
}
