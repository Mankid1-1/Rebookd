import { Link } from "wouter";
import { ArrowLeft, FileText } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function Terms() {
  usePageMeta({
    title: "Terms of Service — Rebooked",
    description: "Terms of service for the Rebooked AI-powered SMS revenue recovery platform. $199/mo + 15% revenue share with 35-day ROI guarantee.",
    ogUrl: "https://rebooked.org/terms",
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <FileText className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">Terms of Service</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-sm text-muted-foreground mb-8">Last updated: March 25, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using the Rebooked platform ("Service"), operated by Rebooked ("we," "our," or "us"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service. These terms apply to all users, including business customers ("Subscribers") and their clients who receive SMS messages ("Recipients").</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Description of Service</h2>
            <p>Rebooked is an AI-powered SMS re-engagement platform designed for appointment-based businesses. The Service includes:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Automated SMS messaging for appointment reminders, no-show recovery, cancellation recovery, and client re-engagement</li>
              <li>Lead management and tracking dashboard</li>
              <li>Analytics and revenue recovery reporting</li>
              <li>Integration with scheduling platforms and payment processors</li>
              <li>Template-based messaging with AI-powered personalization</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Account Registration</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>You must provide accurate, current, and complete information during registration.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must be at least 18 years old and have the legal authority to bind the business entity you represent.</li>
              <li>One account per business. Multiple accounts for the same business are not permitted.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Subscription & Billing</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-foreground">Pricing:</strong> Rebooked charges a monthly subscription fee plus usage-based fees for SMS messages sent. Current pricing is displayed on the billing page and may be updated with 30 days' notice.</li>
              <li><strong className="text-foreground">Revenue Share:</strong> Where applicable, Rebooked charges a percentage of recovered revenue as outlined in your subscription plan. Revenue share is calculated based on confirmed rebookings attributed to Rebooked's automated messaging.</li>
              <li><strong className="text-foreground">Payment:</strong> All payments are processed securely through Stripe. By subscribing, you authorize recurring charges to your payment method on file.</li>
              <li><strong className="text-foreground">Refunds:</strong> Subscription fees are non-refundable. Usage-based charges for messages already sent are non-refundable. If you believe you were charged in error, contact us within 30 days.</li>
              <li><strong className="text-foreground">Cancellation:</strong> You may cancel your subscription at any time through the billing page. Your account will remain active until the end of the current billing period.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Acceptable Use</h2>
            <p className="mb-3">You agree NOT to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Send unsolicited messages (spam) or messages to individuals who have not provided consent</li>
              <li>Use the Service for any illegal or unauthorized purpose</li>
              <li>Upload or transmit malicious code, viruses, or harmful data</li>
              <li>Attempt to gain unauthorized access to our systems or other users' accounts</li>
              <li>Use the Service to send messages containing deceptive, misleading, or fraudulent content</li>
              <li>Violate any applicable laws, including TCPA, CAN-SPAM, or state telemarketing regulations</li>
              <li>Resell, sublicense, or redistribute the Service without written consent</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. SMS Compliance Responsibilities</h2>
            <p className="mb-3">As a Subscriber, you are responsible for:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Obtaining proper prior express written consent from all individuals before sending SMS messages through Rebooked</li>
              <li>Maintaining records of consent for each recipient</li>
              <li>Honoring all opt-out requests promptly (Rebooked handles this automatically for messages sent through our platform)</li>
              <li>Ensuring all message content is truthful, not misleading, and complies with applicable laws</li>
              <li>Complying with all applicable federal, state, and local laws regarding SMS messaging</li>
            </ul>
            <p className="mt-3">Rebooked provides tools and automation to help with compliance, but ultimate responsibility for lawful messaging lies with the Subscriber.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Data Ownership & Licensing</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-foreground">Your Data:</strong> You retain ownership of all data you upload to the Service, including client lists, appointment data, and custom templates.</li>
              <li><strong className="text-foreground">License to Us:</strong> You grant Rebooked a limited, non-exclusive license to use your data solely to provide the Service, including sending messages, generating analytics, and improving our platform.</li>
              <li><strong className="text-foreground">Aggregated Data:</strong> We may use anonymized, aggregated data for analytics, benchmarking, and product improvement. This data cannot be used to identify you or your clients.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Software Ownership & License</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-foreground">Ownership Retention:</strong> Rebooked is a cloud-hosted Software-as-a-Service (SaaS) platform. All software, source code, algorithms, data models, APIs, user interfaces, documentation, and related intellectual property are and shall remain the exclusive property of Rebooked. No title or ownership rights in any part of the Service are transferred to you.</li>
              <li><strong className="text-foreground">License to Use:</strong> Subject to these Terms, Rebooked grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Service solely for your internal business purposes during the term of your subscription. This license does not include any right to possess, install, or run the software on your own servers or infrastructure.</li>
              <li><strong className="text-foreground">Usage Restrictions:</strong> You shall not: (a) resell, sublicense, rent, lease, or distribute access to the Service to any third party; (b) reverse engineer, decompile, disassemble, or attempt to derive the source code of any part of the Service; (c) copy, reproduce, modify, or create derivative works of the Service or any component thereof; (d) use the Service to build a competing product or service; (e) remove, alter, or obscure any proprietary notices or labels on the Service.</li>
              <li><strong className="text-foreground">SaaS Delivery Model:</strong> The Service is provided as a hosted, cloud-based application. You access the Service through your web browser or authorized interfaces. Rebooked retains sole control over the hosting environment, infrastructure, and deployment of all software components.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Service Level & Availability</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>We strive for 99.9% uptime but do not guarantee uninterrupted access.</li>
              <li>The Service is provided "as is" and "as available" without warranties of any kind, whether express or implied.</li>
              <li>We do not guarantee specific revenue recovery results, message delivery rates, or response rates. Results vary based on industry, client base, and messaging strategy.</li>
              <li>SMS delivery depends on third-party carriers and telecommunications providers. We are not responsible for carrier-level filtering or delays.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Subscription Model & SLA</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-foreground">Subscription Plans:</strong> Rebooked offers multiple subscription tiers (including Flex and Rebooked plans) with varying feature access, usage limits, and pricing. Plan details and current pricing are available on the billing page.</li>
              <li><strong className="text-foreground">Service Level:</strong> Rebooked targets 99.9% platform availability measured on a monthly basis. Scheduled maintenance windows will be communicated in advance when possible. Downtime caused by third-party services (carriers, payment processors) is excluded from SLA calculations.</li>
              <li><strong className="text-foreground">Data Management:</strong> Rebooked maintains regular backups and employs industry-standard security measures. In the event of service disruption, Rebooked will use commercially reasonable efforts to restore service and data access promptly.</li>
              <li><strong className="text-foreground">Founding Members:</strong> Early subscribers may receive promotional pricing, extended trial periods, and ROI guarantees as outlined during sign-up. These promotional terms are binding for the duration specified at enrollment.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">11. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Rebooked shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of revenue, lost profits, loss of data, or business interruption, arising from your use of the Service. Our total liability for any claim shall not exceed the amount you paid to Rebooked in the 12 months preceding the claim.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">12. Indemnification</h2>
            <p>You agree to indemnify and hold harmless Rebooked, its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including attorneys' fees) arising from: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any applicable law or regulation, including TCPA; or (d) any claim by a third party related to messages sent through your account.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">13. Termination</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>We may suspend or terminate your account if you violate these Terms, engage in abusive messaging practices, or fail to pay fees when due.</li>
              <li>Upon termination, your right to use the Service ceases immediately. We will retain your data for 30 days, after which it may be permanently deleted.</li>
              <li>You may export your data before account termination by contacting us.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">14. Dispute Resolution</h2>
            <p>Any disputes arising from these Terms shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association. The arbitration shall be conducted in the state where Rebooked is incorporated. Each party shall bear its own arbitration costs. Nothing in this section prevents either party from seeking injunctive relief in court for intellectual property matters.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">15. Changes to Terms</h2>
            <p>We reserve the right to modify these Terms at any time. Material changes will be communicated via email or through the platform at least 30 days before they take effect. Continued use of the Service after changes take effect constitutes acceptance of the updated Terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">16. Contact Us</h2>
            <p>If you have questions about these Terms of Service, contact us at:</p>
            <p className="mt-2"><a href="mailto:rebooked@rebooked.org" className="text-primary hover:underline">rebooked@rebooked.org</a></p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border/50 py-6 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>&copy; 2026 Rebooked. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <span className="text-border">|</span>
            <Link href="/terms" className="text-foreground font-medium">Terms</Link>
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
