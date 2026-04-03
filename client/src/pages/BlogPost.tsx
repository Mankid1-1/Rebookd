import { Link, useParams } from "wouter";
import { ArrowLeft, Clock, Tag, ChevronLeft, ChevronRight } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { JsonLd, REBOOKED_ORGANIZATION } from "@/components/seo/JsonLd";
import { getBlogPost, BLOG_POSTS, BLOG_CATEGORIES, type BlogPost as BlogPostType } from "@/data/blog";
import { trackFunnelEvent } from "@/lib/funnelEvents";
import { useEffect } from "react";

const categoryColors: Record<string, string> = {
  tips: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  "case-study": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  industry: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  product: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

function getCategoryLabel(slug: string): string {
  return BLOG_CATEGORIES.find((c) => c.slug === slug)?.label || slug;
}

export default function BlogPost() {
  const params = useParams<{ slug: string }>();
  const post = getBlogPost(params.slug || "");

  // Find adjacent posts for nav
  const currentIndex = BLOG_POSTS.findIndex((p) => p.slug === params.slug);
  const prevPost = currentIndex > 0 ? BLOG_POSTS[currentIndex - 1] : null;
  const nextPost =
    currentIndex < BLOG_POSTS.length - 1 ? BLOG_POSTS[currentIndex + 1] : null;

  usePageMeta({
    title: post?.metaTitle || "Post Not Found — Rebooked Blog",
    description: post?.metaDescription || "This blog post could not be found.",
    ogUrl: post ? `https://rebooked.org/blog/${post.slug}` : "https://rebooked.org/blog",
    ogImage: "https://rebooked.org/og-image.png",
    canonical: post ? `https://rebooked.org/blog/${post.slug}` : "https://rebooked.org/blog",
  });

  useEffect(() => {
    if (post) {
      trackFunnelEvent("page_view_landing", {
        page: "blog_post",
        slug: post.slug,
      });
    }
  }, [post?.slug]);

  if (!post) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Post not found</h1>
          <p className="text-muted-foreground">
            The blog post you're looking for doesn't exist.
          </p>
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-primary hover:underline font-medium text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  const publishedDate = new Date(post.publishedAt);
  const formattedDate = publishedDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Article JSON-LD */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          description: post.metaDescription,
          image: "https://rebooked.org/og-image.png",
          datePublished: post.publishedAt,
          dateModified: post.publishedAt,
          author: {
            "@type": "Person",
            name: post.author,
          },
          publisher: {
            "@type": "Organization",
            name: "Rebooked",
            url: "https://rebooked.org",
            logo: {
              "@type": "ImageObject",
              url: "https://rebooked.org/logo.svg",
            },
          },
          mainEntityOfPage: {
            "@type": "WebPage",
            "@id": `https://rebooked.org/blog/${post.slug}`,
          },
          wordCount: post.content.replace(/<[^>]+>/g, "").split(/\s+/).length,
          keywords: post.tags.join(", "),
        }}
      />
      <JsonLd data={REBOOKED_ORGANIZATION} />

      {/* BreadcrumbList for rich snippets */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: "https://rebooked.org",
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Blog",
              item: "https://rebooked.org/blog",
            },
            {
              "@type": "ListItem",
              position: 3,
              name: post.title,
              item: `https://rebooked.org/blog/${post.slug}`,
            },
          ],
        }}
      />

      <header className="border-b border-border/50 py-4 px-6">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link
            href="/blog"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="text-sm text-muted-foreground">Blog</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <article>
          {/* Article header */}
          <div className="space-y-4 mb-10">
            <div className="flex items-center gap-3 text-xs">
              <span
                className={`px-2.5 py-1 rounded-full border font-medium ${categoryColors[post.category] || "bg-muted text-muted-foreground border-border"}`}
              >
                {getCategoryLabel(post.category)}
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-3 h-3" />
                {post.readingTime} min read
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold leading-tight text-foreground">
              {post.title}
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed">
              {post.excerpt}
            </p>

            <div className="flex items-center gap-3 pt-2 text-sm text-muted-foreground border-b border-border/50 pb-6">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                {post.author[0]}
              </div>
              <div>
                <p className="font-medium text-foreground">{post.author}</p>
                <p className="text-xs">{formattedDate}</p>
              </div>
            </div>
          </div>

          {/* Article body */}
          <div
            className="prose prose-invert max-w-none
              prose-headings:text-foreground prose-headings:font-semibold
              prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4
              prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3
              prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:mb-4
              prose-li:text-muted-foreground prose-li:leading-relaxed
              prose-strong:text-foreground prose-strong:font-semibold
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-blockquote:border-l-primary prose-blockquote:bg-primary/5 prose-blockquote:rounded-r-lg prose-blockquote:py-3 prose-blockquote:px-4 prose-blockquote:not-italic prose-blockquote:text-muted-foreground
              prose-table:border-border/50 prose-td:px-4 prose-td:py-2 prose-td:border-border/50 prose-tr:border-border/50
              prose-ul:space-y-1 prose-ol:space-y-1"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-2 mt-10 pt-6 border-t border-border/50">
            <Tag className="w-4 h-4 text-muted-foreground" />
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs border border-border/50"
              >
                {tag}
              </span>
            ))}
          </div>
        </article>

        {/* Prev/Next navigation */}
        <div className="grid sm:grid-cols-2 gap-4 mt-10 pt-6 border-t border-border/50">
          {prevPost ? (
            <Link
              href={`/blog/${prevPost.slug}`}
              className="group flex items-start gap-3 rounded-lg border border-border/50 bg-card p-4 hover:border-primary/30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 mt-0.5 text-muted-foreground group-hover:text-primary flex-shrink-0" />
              <div>
                <span className="text-xs text-muted-foreground">Previous</span>
                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
                  {prevPost.title}
                </p>
              </div>
            </Link>
          ) : (
            <div />
          )}
          {nextPost ? (
            <Link
              href={`/blog/${nextPost.slug}`}
              className="group flex items-start gap-3 rounded-lg border border-border/50 bg-card p-4 hover:border-primary/30 transition-colors text-right sm:text-right"
            >
              <div className="flex-1">
                <span className="text-xs text-muted-foreground">Next</span>
                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
                  {nextPost.title}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 mt-0.5 text-muted-foreground group-hover:text-primary flex-shrink-0" />
            </Link>
          ) : (
            <div />
          )}
        </div>

        {/* CTA */}
        <div className="text-center rounded-xl border border-border/50 bg-card p-8 mt-10">
          <h3 className="text-lg font-semibold mb-2">
            Stop losing revenue to no-shows
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Rebooked automatically recovers missed appointments with
            AI-powered SMS — no extra staff, no phone calls, no hassle.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/#roi"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              Calculate Your Lost Revenue
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-2.5 border border-border/50 text-foreground rounded-lg font-medium text-sm hover:bg-muted transition-colors"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/50 py-6 px-6">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
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
