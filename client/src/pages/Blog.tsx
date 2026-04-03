import { Link } from "wouter";
import { ArrowLeft, Clock, Tag, ChevronRight } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { JsonLd, REBOOKED_ORGANIZATION } from "@/components/seo/JsonLd";
import { BLOG_POSTS, BLOG_CATEGORIES, type BlogPost } from "@/data/blog";
import { trackFunnelEvent } from "@/lib/funnelEvents";
import { useEffect, useState } from "react";

const categoryColors: Record<string, string> = {
  tips: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  "case-study": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  industry: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  product: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

function getCategoryLabel(slug: string): string {
  return BLOG_CATEGORIES.find((c) => c.slug === slug)?.label || slug;
}

function PostCard({ post }: { post: BlogPost }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all duration-200 overflow-hidden"
    >
      <div className="p-6 space-y-3">
        <div className="flex items-center gap-3 text-xs">
          <span
            className={`px-2 py-0.5 rounded-full border font-medium ${categoryColors[post.category] || "bg-muted text-muted-foreground border-border"}`}
          >
            {getCategoryLabel(post.category)}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3" />
            {post.readingTime} min read
          </span>
        </div>

        <h2 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">
          {post.title}
        </h2>

        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {post.excerpt}
        </p>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            {post.author} &middot;{" "}
            {new Date(post.publishedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <span className="text-xs text-primary font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
            Read more <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function Blog() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  usePageMeta({
    title: "Blog — Rebooked",
    description:
      "Tips, case studies, and industry insights on reducing no-shows, recovering cancellations, and growing your appointment-based business with SMS automation.",
    ogUrl: "https://rebooked.org/blog",
    ogImage: "https://rebooked.org/og-image.png",
    canonical: "https://rebooked.org/blog",
  });

  useEffect(() => {
    trackFunnelEvent("page_view_landing", { page: "blog" });
  }, []);

  const filtered = activeCategory
    ? BLOG_POSTS.filter((p) => p.category === activeCategory)
    : BLOG_POSTS;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* JSON-LD */}
      <JsonLd data={REBOOKED_ORGANIZATION} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "Rebooked Blog",
          description:
            "Tips, case studies, and industry insights on reducing no-shows and recovering revenue for appointment-based businesses.",
          url: "https://rebooked.org/blog",
          publisher: {
            "@type": "Organization",
            name: "Rebooked",
            url: "https://rebooked.org",
            logo: {
              "@type": "ImageObject",
              url: "https://rebooked.org/logo.svg",
            },
          },
        }}
      />

      <header className="border-b border-border/50 py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-semibold">Blog</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="space-y-10">
          {/* Hero */}
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-3">
              Insights for Appointment Businesses
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Practical tips, real case studies, and data-driven strategies to
              reduce no-shows, recover cancellations, and grow your revenue.
            </p>
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                activeCategory === null
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border/50 hover:border-primary/30"
              }`}
            >
              All Posts
            </button>
            {BLOG_CATEGORIES.map((cat) => (
              <button
                key={cat.slug}
                onClick={() =>
                  setActiveCategory(
                    activeCategory === cat.slug ? null : cat.slug,
                  )
                }
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  activeCategory === cat.slug
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border/50 hover:border-primary/30"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Posts grid */}
          <div className="grid sm:grid-cols-2 gap-6">
            {filtered.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No posts in this category yet. Check back soon!
            </div>
          )}

          {/* CTA */}
          <div className="text-center rounded-xl border border-border/50 bg-card p-8">
            <h3 className="text-lg font-semibold mb-2">
              Ready to recover lost revenue?
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              See how much no-shows are costing you — and how Rebooked can help.
            </p>
            <Link
              href="/#roi"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              Try the Free ROI Calculator
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/50 py-6 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>&copy; 2026 Rebooked. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link
              href="/privacy"
              className="hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
            <span className="text-border">|</span>
            <Link
              href="/terms"
              className="hover:text-foreground transition-colors"
            >
              Terms
            </Link>
            <span className="text-border">|</span>
            <Link
              href="/tcpa"
              className="hover:text-foreground transition-colors"
            >
              TCPA
            </Link>
            <span className="text-border">|</span>
            <Link
              href="/support"
              className="hover:text-foreground transition-colors"
            >
              Support
            </Link>
            <span className="text-border">|</span>
            <Link href="/blog" className="text-foreground font-medium">
              Blog
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
