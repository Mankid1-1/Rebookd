import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { INDUSTRIES, type IndustryConfig } from "@/data/industries";

/** Map each industry slug to 3-4 related industry slugs for cross-linking */
const RELATED_MAP: Record<string, string[]> = {
  salons: ["nail-salons", "barber", "spa"],
  dental: ["chiropractic", "veterinary", "counseling"],
  spa: ["massage-therapy", "aesthetics", "med-spa"],
  fitness: ["chiropractic", "massage-therapy", "photography"],
  tattoo: ["salons", "barber", "photography"],
  "pet-grooming": ["veterinary", "auto-detailing", "tutoring"],
  therapy: ["counseling", "chiropractic", "massage-therapy"],
  chiropractic: ["therapy", "dental", "massage-therapy"],
  photography: ["tattoo", "auto-detailing", "aesthetics"],
  "auto-detailing": ["pet-grooming", "barber", "photography"],
  tutoring: ["therapy", "counseling", "pet-grooming"],
  "nail-salons": ["salons", "aesthetics", "spa"],
  veterinary: ["pet-grooming", "dental", "chiropractic"],
  "massage-therapy": ["spa", "chiropractic", "fitness"],
  aesthetics: ["nail-salons", "med-spa", "spa"],
  counseling: ["therapy", "chiropractic", "massage-therapy"],
  "med-spa": ["aesthetics", "spa", "dental"],
  barber: ["salons", "tattoo", "nail-salons"],
};

interface RelatedIndustriesProps {
  currentSlug: string;
}

export function RelatedIndustries({ currentSlug }: RelatedIndustriesProps) {
  const relatedSlugs = RELATED_MAP[currentSlug] || [];
  const related = relatedSlugs
    .map((slug) => INDUSTRIES[slug])
    .filter(Boolean) as IndustryConfig[];

  if (!related.length) return null;

  return (
    <section className="py-12 px-6 bg-background border-t border-border/50">
      <div className="max-w-4xl mx-auto">
        <h2
          className="text-xl font-bold text-foreground mb-6"
          style={{ fontFamily: "Space Grotesk, sans-serif" }}
        >
          Rebooked works for other industries too
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {related.map((industry) => (
            <Link
              key={industry.slug}
              href={`/for/${industry.slug}`}
              className="group flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all"
            >
              <span className="text-2xl">{industry.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                  {industry.namePlural}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  SMS recovery for {industry.name.toLowerCase()}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
