import { Link } from "wouter";
import { ArrowLeft, Phone } from "lucide-react";
import { HelpTooltip, HelpIcon } from "@/components/ui/HelpTooltip";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function TCPACompliance() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent><p>Go back to the home page</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Phone className="w-5 h-5 text-primary" />
          <HelpTooltip content={{ basic: "Rules that keep your text messages legal and compliant", intermediate: "TCPA compliance settings — quiet hours, opt-in consent, and keyword auto-responses", advanced: "Telephone Consumer Protection Act compliance. Enforced at send time in sms.service.ts. Opt-in/out state tracked per lead in tcpa_consent table" }} variant="info">
            <h1 className="text-lg font-semibold">TCPA Compliance</h1>
          </HelpTooltip>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-sm text-muted-foreground mb-8">Last updated: March 25, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <HelpTooltip content="Rebooked is a platform that sends SMS on behalf of your business. Both Rebooked and your business share responsibility for TCPA compliance — this page explains how each party's obligations are divided." variant="info">
              <h2 className="text-xl font-semibold text-foreground mb-3">Overview</h2>
            </HelpTooltip>
            <p>Rebooked is committed to full compliance with the Telephone Consumer Protection Act (TCPA), as amended, and all applicable Federal Communications Commission (FCC) regulations governing automated text messaging. This page outlines how Rebooked ensures compliance and what our business customers ("Subscribers") must do to maintain compliance when using our platform.</p>
          </section>

          <section>
            <HelpTooltip content="Prior express written consent means getting a clear, documented 'yes' from each client before you send them any automated SMS. This must be obtained before adding their number to Rebooked." variant="info">
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Prior Express Written Consent</h2>
            </HelpTooltip>
            <p className="mb-3">The TCPA requires prior express written consent before sending automated or prerecorded text messages. As a Rebooked Subscriber, you must ensure:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-foreground">Consent is obtained before messaging:</strong> You must have written consent from each individual before their phone number is added to Rebooked for automated messaging.</li>
              <li><strong className="text-foreground">Consent is clear and conspicuous:</strong> The consent agreement must clearly disclose that the individual agrees to receive automated text messages from your business.</li>
              <li><strong className="text-foreground">
                <HelpTooltip content="Keep a record of when, where, and how each client gave consent — e.g. a screenshot of a signed booking form checkbox. These records are your defence if a complaint is ever filed." variant="info">
                  Consent is documented:
                </HelpTooltip>
              </strong> You must maintain records of when and how consent was obtained for each recipient. Consent may be collected via signed forms, online booking forms, intake paperwork, or electronic agreements.</li>
              <li><strong className="text-foreground">Consent is not a condition of service:</strong> You may not require consent to receive automated messages as a condition of purchasing goods or services.</li>
            </ul>
          </section>

          <section>
            <HelpTooltip content={{ basic: "People must agree to receive texts — this tracks who has agreed", intermediate: "Consent tracking: explicit opt-in required before automated messages. STOP keyword auto-processes opt-out", advanced: "Opt-in/out state stored in tcpa_consent table per lead. STOP/CANCEL/END/QUIT/UNSUBSCRIBE keywords processed in real-time via webhook. Re-opt-in requires new written consent" }} variant="info">
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Opt-Out Mechanisms</h2>
            </HelpTooltip>
            <p className="mb-3">Rebooked provides robust opt-out handling:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-foreground">Automatic opt-out processing:</strong> When a recipient replies with STOP, CANCEL, END, QUIT, or UNSUBSCRIBE, Rebooked automatically ceases all future messages to that number.</li>
              <li><strong className="text-foreground">Confirmation message:</strong> Upon opt-out, the recipient receives a single confirmation message acknowledging their request.</li>
              <li><strong className="text-foreground">Immediate effect:</strong> Opt-outs are processed in real-time. No further messages are sent after an opt-out is received.</li>
              <li><strong className="text-foreground">Opt-out records:</strong> Rebooked maintains a permanent record of all opt-out requests for compliance purposes.</li>
              <li><strong className="text-foreground">
                <HelpTooltip content="A client who previously opted out can opt back in by providing new written consent directly to your business — for example, by signing a new booking form that includes an SMS consent checkbox." variant="tip">
                  Re-opt-in:
                </HelpTooltip>
              </strong> A recipient who has opted out may re-opt in by providing new written consent directly to the business.</li>
            </ul>
          </section>

          <section>
            <HelpTooltip content="Every SMS sent through Rebooked must meet these content standards to stay TCPA-compliant. Rebooked's default templates are built to include all required elements automatically." variant="info">
              <h2 className="text-xl font-semibold text-foreground mb-3">3. Message Content Requirements</h2>
            </HelpTooltip>
            <p className="mb-3">All messages sent through Rebooked comply with the following standards:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-foreground">Business identification:</strong> Every message identifies the sending business by name.</li>
              <li><strong className="text-foreground">Opt-out instructions:</strong> Messages include clear instructions on how to opt out (e.g., "Reply STOP to unsubscribe").</li>
              <li><strong className="text-foreground">Truthful content:</strong> Messages must be truthful, not misleading, and accurately represent the business and its services.</li>
              <li><strong className="text-foreground">
                <HelpTooltip content={{ basic: "Times when messages won't be sent (usually nighttime)", intermediate: "Default 9 PM - 8 AM local time. Messages queued during quiet hours send when the window opens", advanced: "Quiet hours enforced in sms.service.ts at send time. Recipient timezone derived from phone area code. Queued messages dispatched at 8 AM local" }} variant="info">
                  Appropriate hours:
                </HelpTooltip>
              </strong> Messages are only sent during permissible hours (8:00 AM to 9:00 PM in the recipient's local time zone), in accordance with TCPA quiet hours requirements.</li>
            </ul>
          </section>

          <section>
            <HelpTooltip content="Rebooked enforces rate limits to prevent message flooding. High-frequency messaging increases opt-out rates and can trigger carrier filtering — 1–5 messages per month per recipient is a safe range." variant="info">
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Message Frequency</h2>
            </HelpTooltip>
            <ul className="list-disc pl-6 space-y-1">
              <li>Message frequency varies based on appointment activity and the automation workflows configured by the Subscriber.</li>
              <li>Typical frequency: 1-5 messages per month per recipient.</li>
              <li>Rebooked enforces rate limits to prevent excessive messaging.</li>
              <li>Standard message and data rates may apply to recipients.</li>
            </ul>
          </section>

          <section>
            <HelpTooltip content="The National Do-Not-Call Registry mainly covers telemarketing calls, but Rebooked takes a conservative approach and only allows messaging to people who have an existing business relationship with you." variant="info">
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Do-Not-Call Registry Compliance</h2>
            </HelpTooltip>
            <p>While the TCPA's Do-Not-Call provisions primarily apply to telemarketing calls, Rebooked takes a conservative approach. We recommend that Subscribers only message individuals with whom they have an established business relationship and valid consent. Rebooked does not send cold outreach or marketing messages to purchased lists.</p>
          </section>

          <section>
            <HelpTooltip content="Rebooked stores 5 years of message logs, consent records, and opt-out history. This protects you if a compliance complaint is ever filed, since you can produce a full audit trail." variant="info">
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Record Retention</h2>
            </HelpTooltip>
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
            <HelpTooltip content="10DLC (10-Digit Long Code) is the US carrier standard for business SMS. Rebooked handles the brand and campaign registration process so your messages are delivered reliably and aren't treated as spam." variant="info">
              <h2 className="text-xl font-semibold text-foreground mb-3">7. Carrier Compliance</h2>
            </HelpTooltip>
            <p>Rebooked sends all SMS messages through Telnyx, a registered telecommunications provider. Our messaging infrastructure complies with carrier requirements including:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>
                <HelpTooltip content="10DLC registration identifies your business as a legitimate sender to US mobile carriers, which improves deliverability and protects against spam filtering." variant="info">
                  10DLC (10-Digit Long Code) registration for A2P messaging
                </HelpTooltip>
              </li>
              <li>
                <HelpTooltip content="The Campaign Registry (TCR) is the industry body that vets SMS campaigns for US carriers. Rebooked registers your messaging use case with TCR as part of the onboarding process." variant="info">
                  Campaign registration with The Campaign Registry (TCR)
                </HelpTooltip>
              </li>
              <li>Compliance with carrier content policies and throughput limits</li>
              <li>Proper message encoding and delivery confirmation</li>
            </ul>
          </section>

          <section>
            <HelpTooltip content="As the business using Rebooked, you are the 'sender' under the TCPA. Rebooked provides the platform and safeguards, but you are responsible for ensuring everyone you message has validly consented." variant="info">
              <h2 className="text-xl font-semibold text-foreground mb-3">8. Subscriber Responsibilities</h2>
            </HelpTooltip>
            <p className="mb-3">By using Rebooked, you acknowledge and agree that:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You are solely responsible for obtaining and documenting valid consent from all recipients.</li>
              <li>You will not upload phone numbers of individuals who have not provided consent.</li>
              <li>You will promptly remove contacts who revoke consent through channels outside of Rebooked (e.g., verbal requests, email requests).</li>
              <li>You will comply with all applicable federal, state, and local laws regarding SMS messaging.</li>
              <li>
                <HelpTooltip content="TCPA statutory damages are $500 per negligent violation and up to $1,500 per wilful violation — and each unsolicited message to each recipient is a separate violation. Class action lawsuits are common." variant="info">
                  You understand that violations of the TCPA can result in statutory damages of $500-$1,500 per unsolicited message.
                </HelpTooltip>
              </li>
            </ul>
          </section>

          <section>
            <HelpTooltip content="These technical controls are built into the Rebooked platform and run automatically — you don't need to configure them. They act as a safety net on top of your own consent and opt-out practices." variant="info">
              <h2 className="text-xl font-semibold text-foreground mb-3">9. Platform Safeguards</h2>
            </HelpTooltip>
            <p className="mb-3">Rebooked has implemented the following technical safeguards:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <HelpTooltip content="Rebooked detects the recipient's time zone from their phone number area code and holds any message that would be delivered outside 8 AM–9 PM local time until the window opens." variant="info">
                  Automatic quiet hours enforcement (no messages between 9 PM and 8 AM recipient local time)
                </HelpTooltip>
              </li>
              <li>Real-time opt-out processing across all automation workflows</li>
              <li>
                <HelpTooltip content="Rate limiting caps how many messages any single number can receive per day or per week, preventing accidental flooding caused by misconfigured automations." variant="info">
                  Rate limiting to prevent message flooding
                </HelpTooltip>
              </li>
              <li>Duplicate message detection and prevention</li>
              <li>Invalid number filtering before message dispatch</li>
              <li>
                <HelpTooltip content="Every message send, delivery, opt-out, and error is logged with a timestamp and stored for 5 years. This audit trail is available on request for compliance verification." variant="info">
                  Audit trails for all messaging activity
                </HelpTooltip>
              </li>
            </ul>
          </section>

          <section>
            <HelpTooltip content="Reach out to the Rebooked team if you're unsure whether your consent collection process is TCPA-compliant, or if a client has raised a complaint about receiving messages." variant="info">
              <h2 className="text-xl font-semibold text-foreground mb-3">10. Questions & Reporting</h2>
            </HelpTooltip>
            <p>If you have questions about TCPA compliance, need assistance with consent documentation, or wish to report a compliance concern, contact us at:</p>
            <p className="mt-2"><a href="mailto:rebooked@rebooked.org" className="text-primary hover:underline">rebooked@rebooked.org</a></p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border/50 py-6 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>&copy; 2026 Rebooked. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
                </TooltipTrigger>
                <TooltipContent><p>How Rebooked collects, stores, and uses your data and your clients' data.</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="text-border">|</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
                </TooltipTrigger>
                <TooltipContent><p>The full Terms of Service governing your use of the Rebooked platform.</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="text-border">|</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/tcpa" className="text-foreground font-medium">TCPA</Link>
                </TooltipTrigger>
                <TooltipContent><p>You are here — Rebooked's TCPA compliance policy for SMS messaging.</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="text-border">|</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/support" className="hover:text-foreground transition-colors">Support</Link>
                </TooltipTrigger>
                <TooltipContent><p>Get help from the Rebooked team with setup, compliance questions, or technical issues.</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </footer>
    </div>
  );
}
