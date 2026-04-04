import { Link } from "wouter";
import { ArrowLeft, LifeBuoy, Mail, Clock, MessageSquare, BookOpen, HelpCircle, Send } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useState } from "react";

function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", category: "general", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.message) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/support-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setStatus(res.ok ? "sent" : "error");
      if (res.ok) setForm({ name: "", email: "", category: "general", message: "" });
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
          <Send className="w-6 h-6 text-success" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Message sent!</h3>
        <p className="text-sm text-muted-foreground">I'll get back to you within 24 hours. Check your email for a confirmation.</p>
        <button onClick={() => setStatus("idle")} className="mt-4 text-sm text-primary hover:underline">Send another message</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">Send a Message</h2>
      </div>
      <form onSubmit={handleSubmit} className="rounded-xl border border-border/50 bg-card p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="support-name" className="block text-sm font-medium mb-1.5">Name</label>
            <input id="support-name" type="text" placeholder="Your name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div>
            <label htmlFor="support-email" className="block text-sm font-medium mb-1.5">Email <span className="text-destructive">*</span></label>
            <input id="support-email" type="email" required placeholder="you@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
        </div>
        <div>
          <label htmlFor="support-category" className="block text-sm font-medium mb-1.5">Category</label>
          <select id="support-category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option value="general">General Question</option>
            <option value="billing">Billing & Payments</option>
            <option value="technical">Technical Issue</option>
            <option value="automations">Automations & SMS</option>
            <option value="integrations">Calendar Integrations</option>
            <option value="feedback">Feature Request / Feedback</option>
          </select>
        </div>
        <div>
          <label htmlFor="support-message" className="block text-sm font-medium mb-1.5">Message <span className="text-destructive">*</span></label>
          <textarea id="support-message" required rows={4} placeholder="How can I help?" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y" />
        </div>
        {status === "error" && <p className="text-sm text-destructive">Something went wrong. Please try emailing rebooked@rebooked.org directly.</p>}
        <button type="submit" disabled={status === "sending"} className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
          <Send className="w-4 h-4" />
          {status === "sending" ? "Sending..." : "Send Message"}
        </button>
      </form>
    </div>
  );
}

export default function Support() {
  usePageMeta({
    title: "Support — Rebooked",
    description: "Get help with Rebooked. Contact support, browse FAQs, and find resources for the AI-powered SMS revenue recovery platform.",
    ogUrl: "https://rebooked.org/support",
    canonical: "https://rebooked.org/support",
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <LifeBuoy className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">Support</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="space-y-12">
          {/* Hero */}
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-3">How can we help?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">We're here to help you get the most out of Rebooked. Reach out through any of the channels below and we'll get back to you as quickly as possible.</p>
          </div>

          {/* Contact Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="rounded-xl border border-border/50 bg-card p-6 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Email Support</h3>
              <p className="text-sm text-muted-foreground">Send us an email and we'll respond within 24 hours on business days.</p>
              <a href="mailto:rebooked@rebooked.org" className="text-sm text-primary hover:underline font-medium inline-block">rebooked@rebooked.org</a>
            </div>

            <div className="rounded-xl border border-border/50 bg-card p-6 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Business Hours</h3>
              <p className="text-sm text-muted-foreground">Our support team is available during standard business hours.</p>
              <p className="text-sm font-medium text-foreground">Mon - Fri, 9 AM - 6 PM EST</p>
            </div>

            <div className="rounded-xl border border-border/50 bg-card p-6 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Priority Support</h3>
              <p className="text-sm text-muted-foreground">Subscribed customers receive priority support with faster response times.</p>
              <p className="text-sm font-medium text-foreground">Avg. response: under 4 hours</p>
            </div>
          </div>

          {/* FAQ */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <HelpCircle className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Frequently Asked Questions</h2>
            </div>

            <div className="space-y-4">
              <details className="group rounded-lg border border-border/50 bg-card">
                <summary className="flex items-center justify-between cursor-pointer p-4 font-medium text-foreground">
                  How do I get started with Rebooked?
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">&#9662;</span>
                </summary>
                <div className="px-4 pb-4 text-sm text-muted-foreground">
                  <p>Sign up for an account, complete the onboarding wizard to configure your business details, connect your scheduling platform, and set up your automation workflows. You'll be sending your first re-engagement messages within minutes.</p>
                </div>
              </details>

              <details className="group rounded-lg border border-border/50 bg-card">
                <summary className="flex items-center justify-between cursor-pointer p-4 font-medium text-foreground">
                  How does billing work?
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">&#9662;</span>
                </summary>
                <div className="px-4 pb-4 text-sm text-muted-foreground">
                  <p>Rebooked uses a simple subscription model with a monthly base fee plus usage-based charges for SMS messages sent. All billing is handled securely through Stripe. You can view and manage your subscription from the Billing page in your dashboard.</p>
                </div>
              </details>

              <details className="group rounded-lg border border-border/50 bg-card">
                <summary className="flex items-center justify-between cursor-pointer p-4 font-medium text-foreground">
                  Can my clients opt out of messages?
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">&#9662;</span>
                </summary>
                <div className="px-4 pb-4 text-sm text-muted-foreground">
                  <p>Yes. Every message includes opt-out instructions. Recipients can reply STOP at any time to immediately cease all future messages. Opt-outs are processed automatically and in real-time. See our <Link href="/tcpa" className="text-primary hover:underline">TCPA Compliance</Link> page for details.</p>
                </div>
              </details>

              <details className="group rounded-lg border border-border/50 bg-card">
                <summary className="flex items-center justify-between cursor-pointer p-4 font-medium text-foreground">
                  What scheduling platforms do you integrate with?
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">&#9662;</span>
                </summary>
                <div className="px-4 pb-4 text-sm text-muted-foreground">
                  <p>Rebooked integrates with popular scheduling platforms including Google Calendar, Acuity, Calendly, Vagaro, Mindbody, and more. During onboarding, you'll be able to connect your preferred scheduling tool. We're continuously adding new integrations.</p>
                </div>
              </details>

              <details className="group rounded-lg border border-border/50 bg-card">
                <summary className="flex items-center justify-between cursor-pointer p-4 font-medium text-foreground">
                  How do I cancel my subscription?
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">&#9662;</span>
                </summary>
                <div className="px-4 pb-4 text-sm text-muted-foreground">
                  <p>You can cancel your subscription at any time from the Billing page in your dashboard. Your account will remain active until the end of your current billing period. If you need help, email us at <a href="mailto:rebooked@rebooked.org" className="text-primary hover:underline">rebooked@rebooked.org</a>.</p>
                </div>
              </details>

              <details className="group rounded-lg border border-border/50 bg-card">
                <summary className="flex items-center justify-between cursor-pointer p-4 font-medium text-foreground">
                  Is my data secure?
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">&#9662;</span>
                </summary>
                <div className="px-4 pb-4 text-sm text-muted-foreground">
                  <p>Yes. We use industry-standard encryption for data in transit (TLS/SSL) and at rest. Sensitive client data including phone numbers and names are encrypted in our database. Payment information is handled securely by Stripe — we never store card numbers. See our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> for full details.</p>
                </div>
              </details>
            </div>
          </div>

          {/* Getting Started */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <BookOpen className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Getting Started Guide</h2>
            </div>

            <div className="rounded-xl border border-border/50 bg-card p-6">
              <ol className="space-y-4 text-sm">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                  <div>
                    <p className="font-medium text-foreground">Create your account</p>
                    <p className="text-muted-foreground">Sign up and verify your email to access the dashboard.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                  <div>
                    <p className="font-medium text-foreground">Complete onboarding</p>
                    <p className="text-muted-foreground">Set up your business profile, choose your industry, and configure your preferences.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                  <div>
                    <p className="font-medium text-foreground">Configure automations</p>
                    <p className="text-muted-foreground">Choose which automation workflows to enable — no-show recovery, cancellation follow-up, re-engagement, and more.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</span>
                  <div>
                    <p className="font-medium text-foreground">Import your clients</p>
                    <p className="text-muted-foreground">Add your client list manually or connect your scheduling platform for automatic syncing.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">5</span>
                  <div>
                    <p className="font-medium text-foreground">Start recovering revenue</p>
                    <p className="text-muted-foreground">Rebooked will automatically reach out to no-shows and lapsed clients to bring them back.</p>
                  </div>
                </li>
              </ol>
            </div>
          </div>

          {/* Contact Form */}
          <ContactForm />

          {/* Contact CTA */}
          <div className="text-center rounded-xl border border-border/50 bg-card p-8">
            <h3 className="text-lg font-semibold mb-2">Prefer email?</h3>
            <p className="text-sm text-muted-foreground mb-4">You can also reach us directly at any time.</p>
            <a href="mailto:rebooked@rebooked.org" className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors">
              <Mail className="w-4 h-4" />
              rebooked@rebooked.org
            </a>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/50 py-6 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>&copy; 2026 Rebooked. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <span className="text-border hidden sm:inline">|</span>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <span className="text-border hidden sm:inline">|</span>
            <Link href="/tcpa" className="hover:text-foreground transition-colors">TCPA</Link>
            <span className="text-border hidden sm:inline">|</span>
            <Link href="/support" className="text-foreground font-medium">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
