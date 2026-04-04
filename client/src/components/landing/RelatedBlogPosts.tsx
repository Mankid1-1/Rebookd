import { Link } from "wouter";
import { ArrowRight, BookOpen } from "lucide-react";
import { BLOG_POSTS, type BlogPost } from "@/data/blog";

/** Map each industry slug to relevant blog post slugs for cross-linking */
const INDUSTRY_BLOG_MAP: Record<string, string[]> = {
  salons: [
    "salon-recovered-2400-month",
    "sms-templates-that-rebook-no-shows",
    "real-cost-of-no-shows",
  ],
  dental: [
    "dentists-guide-reducing-dna-rates",
    "real-cost-of-no-shows",
    "why-cancellation-fees-dont-work",
  ],
  spa: [
    "spa-wellness-revenue-recovery-guide",
    "sms-templates-that-rebook-no-shows",
    "psychology-behind-no-shows",
  ],
  fitness: [
    "fitness-studio-filled-cancellations-30-days",
    "why-cancellation-fees-dont-work",
    "best-businesses-automate-not-chase",
  ],
  tattoo: [
    "real-cost-of-no-shows",
    "sms-templates-that-rebook-no-shows",
    "psychology-behind-no-shows",
  ],
  "pet-grooming": [
    "reasons-reminder-texts-get-ignored",
    "first-sms-automation-under-10-minutes",
    "best-businesses-automate-not-chase",
  ],
  therapy: [
    "psychology-behind-no-shows",
    "why-cancellation-fees-dont-work",
    "appointment-sms-vs-email-response-rates",
  ],
  chiropractic: [
    "real-cost-of-no-shows",
    "reasons-reminder-texts-get-ignored",
    "best-businesses-automate-not-chase",
  ],
  photography: [
    "real-cost-of-no-shows",
    "sms-templates-that-rebook-no-shows",
    "first-sms-automation-under-10-minutes",
  ],
  "auto-detailing": [
    "sms-templates-that-rebook-no-shows",
    "best-businesses-automate-not-chase",
    "first-sms-automation-under-10-minutes",
  ],
  tutoring: [
    "reasons-reminder-texts-get-ignored",
    "appointment-sms-vs-email-response-rates",
    "psychology-behind-no-shows",
  ],
  "nail-salons": [
    "salon-recovered-2400-month",
    "sms-templates-that-rebook-no-shows",
    "why-cancellation-fees-dont-work",
  ],
  veterinary: [
    "real-cost-of-no-shows",
    "reasons-reminder-texts-get-ignored",
    "appointment-confirmation-text-examples",
  ],
  "massage-therapy": [
    "spa-wellness-revenue-recovery-guide",
    "psychology-behind-no-shows",
    "client-retention-strategies-appointment-businesses",
  ],
  aesthetics: [
    "salon-recovered-2400-month",
    "sms-templates-that-rebook-no-shows",
    "client-retention-strategies-appointment-businesses",
  ],
  counseling: [
    "psychology-behind-no-shows",
    "why-cancellation-fees-dont-work",
    "no-show-policy-template",
  ],
  "med-spa": [
    "spa-wellness-revenue-recovery-guide",
    "client-retention-strategies-appointment-businesses",
    "best-appointment-reminder-software-2026",
  ],
  barber: [
    "salon-recovered-2400-month",
    "how-to-reduce-salon-no-shows",
    "sms-templates-that-rebook-no-shows",
  ],
};

interface RelatedBlogPostsProps {
  industrySlug: string;
}

export function RelatedBlogPosts({ industrySlug }: RelatedBlogPostsProps) {
  const slugs = INDUSTRY_BLOG_MAP[industrySlug] || [];
  const posts = slugs
    .map((slug) => BLOG_POSTS.find((p) => p.slug === slug))
    .filter(Boolean) as BlogPost[];

  if (!posts.length) return null;

  return (
    <section className="py-12 px-6 bg-background border-t border-border/50">
      <div className="max-w-4xl mx-auto">
        <h2
          className="text-xl font-bold text-foreground mb-2"
          style={{ fontFamily: "Space Grotesk, sans-serif" }}
        >
          Related reading
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Strategies and case studies to help you recover more revenue.
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col gap-3 p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <BookOpen className="w-3.5 h-3.5" />
                <span>{post.readingTime} min read</span>
              </div>
              <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2 flex-1">
                {post.title}
              </p>
              <span className="text-xs text-primary flex items-center gap-1">
                Read article
                <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
