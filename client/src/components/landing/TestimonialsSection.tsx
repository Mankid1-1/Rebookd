import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { fadeInUp, staggerContainerSlow } from "@/lib/animations";

const TESTIMONIALS = [
  {
    quote: "I was losing 15-20 appointments a month to no-shows. Rebooked got that down to 3 in the first month. The automated follow-ups feel personal, not spammy.",
    name: "Sarah M.",
    business: "Hair Salon Owner",
    result: "Recovered $2,400/mo",
  },
  {
    quote: "The setup took me 10 minutes. I imported my clients from Vagaro, turned on the automations, and started getting rebookings the same week. Honestly blown away.",
    name: "James K.",
    business: "Barbershop Owner",
    result: "40% fewer no-shows",
  },
  {
    quote: "The waitlist fill feature alone pays for itself. Every time someone cancels, the next person in line gets a text automatically. My schedule stays full.",
    name: "Dr. Priya R.",
    business: "Dental Clinic Manager",
    result: "92% chair utilization",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-16 px-6 border-t border-border/30">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-10"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
        >
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Early results from <span className="text-primary">founding clients</span>
          </h2>
          <p className="text-sm text-muted-foreground">Real feedback from businesses in our soft launch.</p>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-3 gap-5"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainerSlow}
        >
          {TESTIMONIALS.map((t) => (
            <motion.div
              key={t.name}
              variants={fadeInUp}
              className="p-6 rounded-2xl border border-border bg-card"
            >
              <Quote className="w-5 h-5 text-primary/30 mb-3" />
              <p className="text-sm text-foreground leading-relaxed mb-4">"{t.quote}"</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.business}</p>
                </div>
                <span className="text-xs font-semibold text-success bg-success/10 px-2.5 py-1 rounded-full">
                  {t.result}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
