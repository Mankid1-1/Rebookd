import { motion } from "framer-motion";
import { fadeIn } from "@/lib/animations";

const INDUSTRIES_SERVED = [
  { emoji: "✂️", label: "Hair Salons" },
  { emoji: "💆", label: "Spas" },
  { emoji: "🏥", label: "Clinics" },
  { emoji: "🏋️", label: "Gyms" },
  { emoji: "🦷", label: "Dentists" },
  { emoji: "💅", label: "Nail Salons" },
  { emoji: "🧘", label: "Wellness Studios" },
  { emoji: "🐾", label: "Pet Groomers" },
  { emoji: "📸", label: "Photographers" },
  { emoji: "🎓", label: "Tutors" },
];

export function SocialProofBar() {
  return (
    <motion.section
      className="py-8 px-6 border-b border-border/30 bg-muted/20"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      variants={fadeIn}
    >
      <div className="max-w-5xl mx-auto">
        <p className="text-center text-xs text-muted-foreground mb-4 uppercase tracking-widest">
          Built for appointment-based businesses
        </p>
        <div className="flex items-center justify-center gap-6 flex-wrap">
          {INDUSTRIES_SERVED.map(({ emoji, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="text-base">{emoji}</span>
              {label}
            </span>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
