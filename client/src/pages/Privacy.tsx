import { Link } from "wouter";
import { ArrowLeft, Shield } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">Privacy Policy</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-sm text-muted-foreground mb-8">Last updated: March 25, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Introduction</h2>
            <p>Rebooked ("we," "our," or "us") operates the rebooked.org platform, an AI-powered SMS re-engagement service for appointment-based businesses. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Information We Collect</h2>
            <h3 className="text-base font-medium text-foreground mt-4 mb-2">Account Information</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Business name, contact name, email address, and phone number</li>
              <li>Billing information (processed securely by Stripe; we do not store card numbers)</li>
              <li>Business category and scheduling platform details</li>
            </ul>
            <h3 className="text-base font-medium text-foreground mt-4 mb-2">Client Data (provided by our business customers)</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Client names and phone numbers</li>
              <li>Appointment dates, times, and service types</li>
              <li>Appointment status (no-show, cancellation, completed)</li>
              <li>SMS message history and opt-in/opt-out status</li>
            </ul>
            <h3 className="text-base font-medium text-foreground mt-4 mb-2">Usage Data</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Log data (IP addresses, browser type, pages visited)</li>
              <li>Feature usage and interaction analytics</li>
              <li>Performance metrics and error reports</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To provide, maintain, and improve the Rebooked platform</li>
              <li>To send automated SMS messages on behalf of our business customers</li>
              <li>To process payments and manage subscriptions via Stripe</li>
              <li>To deliver SMS messages via our telecommunications provider (Telnyx)</li>
              <li>To generate analytics and revenue recovery reports</li>
              <li>To communicate with you about your account, updates, and support</li>
              <li>To detect, prevent, and address technical issues and fraud</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. SMS Messaging & TCPA Compliance</h2>
            <p className="mb-3">Rebooked sends SMS messages on behalf of our business customers to their clients. All SMS messaging complies with the Telephone Consumer Protection Act (TCPA) and applicable regulations:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-foreground">Consent:</strong> Messages are only sent to individuals who have provided prior express written consent to the business they patronize.</li>
              <li><strong className="text-foreground">Opt-Out:</strong> Every SMS includes instructions to opt out. Recipients can reply STOP, CANCEL, END, QUIT, or UNSUBSCRIBE at any time to immediately cease all messages.</li>
              <li><strong className="text-foreground">Frequency:</strong> Message frequency varies based on appointment activity. Typically 1-5 messages per month per recipient.</li>
              <li><strong className="text-foreground">Message & Data Rates:</strong> Standard message and data rates may apply.</li>
              <li><strong className="text-foreground">Record Keeping:</strong> We maintain records of consent, opt-outs, and message delivery for compliance purposes.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Third-Party Services</h2>
            <p className="mb-3">We share data with the following third-party services to operate our platform:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-foreground">Stripe:</strong> Payment processing. Subject to <a href="https://stripe.com/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Stripe's Privacy Policy</a>.</li>
              <li><strong className="text-foreground">Telnyx:</strong> SMS delivery. Subject to <a href="https://telnyx.com/privacy-policy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Telnyx's Privacy Policy</a>.</li>
              <li><strong className="text-foreground">Cloudflare:</strong> CDN and security. Subject to Cloudflare's Privacy Policy.</li>
              <li><strong className="text-foreground">Sentry:</strong> Error tracking and monitoring (no personal data sent).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Data Retention</h2>
            <p>We retain account data for as long as your account is active. Client data (names, phone numbers, appointment records) is retained for up to 24 months after last activity or until the business customer requests deletion. SMS message logs are retained for 12 months for compliance purposes. You may request deletion of your data at any time by contacting us.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Data Security</h2>
            <p>We implement industry-standard security measures including encryption in transit (TLS/SSL), encryption at rest for sensitive data, secure authentication, rate limiting, and regular security audits. However, no method of electronic transmission or storage is 100% secure.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-foreground">Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong className="text-foreground">Correction:</strong> Request correction of inaccurate data.</li>
              <li><strong className="text-foreground">Deletion:</strong> Request deletion of your personal data.</li>
              <li><strong className="text-foreground">Opt-Out:</strong> Opt out of marketing communications at any time.</li>
              <li><strong className="text-foreground">Data Portability:</strong> Request your data in a portable format.</li>
            </ul>
            <p className="mt-3">To exercise these rights, contact us at <a href="mailto:rebooked@rebooked.org" className="text-primary hover:underline">rebooked@rebooked.org</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Cookies</h2>
            <p>We use essential cookies for authentication and session management. We do not use third-party advertising or tracking cookies. Analytics are collected in aggregate without personally identifiable information.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Children's Privacy</h2>
            <p>Our service is not directed to individuals under 18. We do not knowingly collect personal information from children.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">11. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on this page and updating the "Last updated" date.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">12. Contact Us</h2>
            <p>If you have questions about this Privacy Policy, contact us at:</p>
            <p className="mt-2"><a href="mailto:rebooked@rebooked.org" className="text-primary hover:underline">rebooked@rebooked.org</a></p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border/50 py-6 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>&copy; 2026 Rebooked. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-foreground font-medium">Privacy</Link>
            <span className="text-border">|</span>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <span className="text-border">|</span>
            <Link href="/tcpa" className="hover:text-foreground transition-colors">TCPA</Link>
            <span className="text-border">|</span>
            <Link href="/support" className="hover:text-foreground transition-colors">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
