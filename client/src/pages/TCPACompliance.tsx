import { Link } from "wouter";
import { ArrowLeft, Phone } from "lucide-react";

export default function TCPACompliance() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Phone className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">TCPA Compliance</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-sm text-muted-foreground mb-8">Last updated: March 25, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Overview</h2>
            <p>Rebooked is committed to full compliance with the Telephone Consumer Protection Act (TCPA), as amended, and all applicable Federal Communications Commission (FCC) regulations governing automated text messaging. This page outlines how Rebooked ensures compliance and what our business customers ("Subscribers") must do to maintain compliance when using our platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Prior Express Written Consent</h2>
            <p className="mb-3">The TCPA requires prior express written consent before sending automated or prerecorded text messages. As a Rebooked Subscriber, you must ensure:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-foreground">Consent is obtained before messaging:</strong> You must have written consent from each individual before their phone number is added to Rebooked for automated messaging.</li>
              <li><strong className="text-foreground">Consent is clear and conspicuous:</strong> The consent agreement must clearly disclose that the individual agrees to receive automated text messages from your business.</li>
              <li><strong className="text-foreground">Consent is documented:</strong> You must maintain records of when and how consent was obtained for each recipient. Consent may be collected via signed forms, online booking forms, intake paperwork, or electronic agreements.</li>
              <li><strong className="text-foreground">Consent is not a condition of service:</strong> You may not require consent to receive automated messages as a condition of purchasing goods or services.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Opt-Out Mechanisms</h2>
            <p className="mb-3">Rebooked provides robust opt-out handling:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-foreground">Automatic opt-out processing:</strong> When a recipient replies with STOP, CANCEL, END, QUIT, or UNSUBSCRIBE, Rebooked automatically ceases all future messages to that number.</li>
              <li><strong className="text-foreground">Confirmation message:</strong> Upon opt-out, the recipient receives a single confirmation message acknowledging their request.</li>
              <li><strong className="text-foreground">Immediate effect:</strong> Opt-outs are processed in real-time. No further messages are sent after an opt-out is received.</li>
              <li><strong className="text-foreground">Opt-out records:</strong> Rebooked maintains a permanent record of all opt-out requests for compliance purposes.</li>
              <li><strong className="text-foreground">Re-opt-in:</strong> A recipient who has opted out may re-opt in by providing new written consent directly to the business.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Message Content Requirements</h2>
            <p className="mb-3">All messages sent through Rebooked comply with the following standards:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-foreground">Business identification:</strong> Every message identifies the sending business by name.</li>
              <li><strong className="text-foreground">Opt-out instructions:</strong> Messages include clear instructions on how to opt out (e.g., "Reply STOP to unsubscribe").</li>
              <li><strong className="text-foreground">Truthful content:</strong> Messages must be truthful, not misleading, and accurately represent the business and its services.</li>
              <li><strong className="text-foreground">Appropriate hours:</strong> Messages are only sent during permissible hours (8:00 AM to 9:00 PM in the recipient's local time zone), in accordance with TCPA quiet hours requirements.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Message Frequency</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Message frequency varies based on appointment activity and the automation workflows configured by the Subscriber.</li>
              <li>Typical frequency: 1-5 messages per month per recipient.</li>
              <li>Rebooked enforces rate limits to prevent excessive messaging.</li>
              <li>Standard message and data rates may apply to recipients.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Do-Not-Call Registry Compliance</h2>
            <p>While the TCPA's Do-Not-Call provisions primarily apply to telemarketing calls, Rebooked takes a conservative approach. We recommend that Subscribers only message individuals with whom they have an established business relationship and valid consent. Rebooked does not send cold outreach or marketing messages to purchased lists.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Record Retention</h2>
            <p className="mb-3">Rebooked maintains compliance records including:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Message delivery logs with timestamps and recipient numbers</li>
              <li>Opt-in and opt-out records with dates</li>
              <li>Message content and template history</li>
              <li>Delivery status and carrier responses</li>
            </ul>
            <p className="mt-3">Records are retained for a minimum of 5 years in accordance with FCC guidelines and statute of limitations requirements.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Carrier Compliance</h2>
            <p>Rebooked sends all SMS messages through Telnyx, a registered telecommunications provider. Our messaging infrastructure complies with carrier requirements including:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>10DLC (10-Digit Long Code) registration for A2P messaging</li>
              <li>Campaign registration with The Campaign Registry (TCR)</li>
              <li>Compliance with carrier content policies and throughput limits</li>
              <li>Proper message encoding and delivery confirmation</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Subscriber Responsibilities</h2>
            <p className="mb-3">By using Rebooked, you acknowledge and agree that:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You are solely responsible for obtaining and documenting valid consent from all recipients.</li>
              <li>You will not upload phone numbers of individuals who have not provided consent.</li>
              <li>You will promptly remove contacts who revoke consent through channels outside of Rebooked (e.g., verbal requests, email requests).</li>
              <li>You will comply with all applicable federal, state, and local laws regarding SMS messaging.</li>
              <li>You understand that violations of the TCPA can result in statutory damages of $500-$1,500 per unsolicited message.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Platform Safeguards</h2>
            <p className="mb-3">Rebooked has implemented the following technical safeguards:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Automatic quiet hours enforcement (no messages between 9 PM and 8 AM recipient local time)</li>
              <li>Real-time opt-out processing across all automation workflows</li>
              <li>Rate limiting to prevent message flooding</li>
              <li>Duplicate message detection and prevention</li>
              <li>Invalid number filtering before message dispatch</li>
              <li>Audit trails for all messaging activity</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Questions & Reporting</h2>
            <p>If you have questions about TCPA compliance, need assistance with consent documentation, or wish to report a compliance concern, contact us at:</p>
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
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <span className="text-border">|</span>
            <Link href="/tcpa" className="text-foreground font-medium">TCPA</Link>
            <span className="text-border">|</span>
            <Link href="/support" className="hover:text-foreground transition-colors">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
