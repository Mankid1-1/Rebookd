# 🔬 SECOND EXHAUSTIVE CRITIQUE — Rebookd v2
## Deep-Dive #2: Infrastructure, UX, Edge Cases, and Production Readiness

**Focus Areas**: Shared hosting constraints, deployment patterns, frontend UX, event system architecture, phone normalization, encryption patterns

---

## 1. SHARED HOSTING CONSTRAINTS ANALYSIS

**Your Infrastructure**:
- **40GB disk space** (shared hosting)
- **5 MySQL databases** (limited to 5 tenant databases total)
- **Unlimited bandwidth**
- **40MB per virtual domain**
- **Shared IP**: 173.249.56.141
- **SSL**: ✓ Available
- **SSH**: ✓ Available
- **FTP**: 1 account
- **Email**: 10 POP accounts

### 🔴 CRITICAL DEPLOYMENT MISMATCH

**Issue #1: Docker Not Suitable for Shared Hosting**
```
Current Architecture: Docker (app + worker + db containers)
Shared Hosting Limitation: NO Docker support
Result: DEPLOYMENT IMPOSSIBLE without changes
```

**Your current docker-compose.yml is unusable** because:
- ✗ Shared hosting doesn't support Docker/containers
- ✗ No way to run `docker-compose up`
- ✗ No way to manage `migrate`, `app`, `worker` services separately
- ✗ Database must be MySQL on the shared host (not containerized)

**Fix: Refactor for Shared Hosting**
```bash
# Instead of Docker:
1. Node.js app runs via cPanel/SSH directly
2. MySQL database uses shared hosting's MySQL
3. Worker runs as background process (Node cron or PHP cron)
4. Use PM2 or supervisor for process management
```

### 🟡 Database Constraints

**Issue #2: Limited to 5 Databases**
```
Max databases: 5
Your schema tables: ~15 tables
Current approach: 1 app database

Scenario at scale:
- 1000 tenants × minimal data = ~10-100MB per tenant
- 40GB disk ÷ 1000 tenants = 40MB per tenant
- You can fit ~1000 tenants max
- If you shard tenants → only 5 shards allowed
```

**Problem**: Each shard would be a separate MySQL database (consuming your 5-database limit).

**Solution**:
```
Option A: Single multi-tenant database (current approach)
✓ Works with 1 database, unlimited tenants
✓ Limited to 40GB total (scales to ~5000-10K tenants with reasonable data)
✓ Simpler deployment

Option B: Hard-sharded by tenant (1 database per shard)
✗ Consumes 2-5 databases per shard
✗ Complex routing
✗ Better isolation but hits database limit
```

**Recommendation**: Stick with **Option A** (single database, all tenants).

### 🟡 Disk Space Constraints

**Issue #3: 40GB Max Storage**
```
Estimation at scale (1000 tenants, 2000 leads each):
- 2M lead records × 500 bytes = 1GB
- 2M messages × 1KB = 2GB
- Indices × 1.5 = 4.5GB total
- Logs × 500KB/day × 365 = 180GB/year ← EXCEEDS DISK

Problem: Log files will fill disk in ~1 month
```

**Fixes**:
```yaml
# 1. Enable log rotation in docker-compose or PM2
logging:
  options:
    max-size: "10m"      # 10MB per log file
    max-file: "5"        # Keep 5 files → 50MB total logs

# 2. Archive old messages to separate table (monthly)
# 3. Implement log cleanup (delete logs older than 30 days)
```

---

## 2. INFRASTRUCTURE & DEPLOYMENT ASSESSMENT

### 🔴 Critical: Worker Deployment Model Broken

**Current Model** (Docker Compose):
```yaml
migrate:
  runs once at startup
  
app:
  HTTP server (port 3000)
  
worker:
  Background job processor
```

**Problem on Shared Hosting**:
- ✗ No way to run parallel services
- ✗ Worker can't run independently of app
- ✗ If worker crashes, no auto-restart

**New Model for Shared Hosting**:
```typescript
// Option A: Embed worker in app process
// app.ts
import { startWorker } from "./worker";
if (process.env.ROLE === "worker") {
  startWorker();  // Run instead of HTTP server
} else {
  startHttpServer();  // Run app normally
}

// Start 2 processes: one as app, one as worker
pm2 start app.ts -i 1 --name rebookd-app
pm2 start app.ts --name rebookd-worker -- --role=worker

// Option B: Use node-cron in app process
// Runs automation cycle every 60 seconds in the same process
import cron from "node-cron";
cron.schedule("*/1 * * * *", async () => {
  await runWorkerCycle();
});
```

### 🟡 Email Configuration Issues

**Current Setup**:
```
POP Server: mail.rebooked.org
SMTP Server: mail.rebooked.org
```

**Problem #1: SendGrid Integration Broken**
```typescript
// File: server/_core/email.ts
const sendGridKey = ENV.sendGridApiKey;
if (!sendGridKey) {
  console.warn("SendGrid API key not configured");
  return { success: true };  // ← Silently fails!
}
```

**Better**: Use shared hosting's SMTP instead of SendGrid
```typescript
// Use nodemailer + mail.rebooked.org SMTP
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "mail.rebooked.org",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,     // Your POP account
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function sendEmail(options: {...}) {
  const result = await transporter.sendMail({
    from: "hello@rebookd.org",
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });
  return { success: true };
}
```

**Benefit**: No third-party dependency, uses included email

### 🟡 Bandwidth Utilization

**Current Estimate** (at 1000 tenants, 2K leads each):
```
API requests: 1000 tenants × 100 req/day = 100K req/day
Bandwidth: 100K × 50KB avg = 5GB/day = 150GB/month

Your hosting: "Unlimited bandwidth"
✓ This is actually fine (unlimited means you can scale)
✓ Not a bottleneck
```

---

## 3. FRONTEND UX ASSESSMENT

### ✅ Strengths

**3.1 LeadDetail Component Structure**
```typescript
// Clean component hierarchy
DashboardLayout
  ↓
LeadDetail (main)
  ↓
LeadConversation + LeadMessageComposer + LeadInfoSidebar
```

**3.2 Status Badge Styling**
```typescript
const STATUS_STYLES: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  // ✓ Tailwind classes, consistent
  // ✓ Easy to update
}
```

### 🔴 Critical UX Issues

**Issue #4: Lead List Fetches All Leads (Unbounded)**
```typescript
// File: client/src/pages/LeadDetail.tsx
const { data: leadsData, isLoading } = trpc.leads.list.useQuery(
  { page: 1, limit: 1000 },  // ← LOADS 1000 LEADS
  { enabled: !!leadId }
);
const lead = leadsData?.leads?.find((l) => l.id === leadId);
```

**Problems**:
- ✗ Fetches 1000 leads just to find 1 by ID
- ✗ With 10K leads, this is 10 requests just to load
- ✗ Terrible performance on slow connections

**Fix**:
```typescript
// Better: Load single lead by ID
const { data: lead } = trpc.leads.get.useQuery(
  { leadId },
  { enabled: !!leadId }
);
```

**Issue #5: Message Refetch Every 5 Seconds**
```typescript
const { data: messages = [] } = trpc.leads.messages.useQuery(
  { leadId },
  { enabled: !!leadId, refetchInterval: 5000 }  // ← Polls every 5s
);
```

**Problems**:
- ✗ 12 requests/minute per open conversation
- ✗ Wastes bandwidth (polling when no messages)
- ✗ Wasteful on mobile data
- ✗ Server load from constant polling

**Fix: WebSocket or Polling Optimization**
```typescript
// Option A: Smart polling (only if user is idle <30s)
const { data: messages } = trpc.leads.messages.useQuery(
  { leadId },
  {
    enabled: !!leadId,
    refetchInterval: userIsActive ? 5000 : 30000,  // Poll slower if idle
  }
);

// Option B: WebSocket push (better)
const messages = useWebSocketMessages(leadId);  // Real-time from server
```

**Issue #6: No Error Handling on Lead Not Found**
```typescript
if (!lead) {
  return (
    <DashboardLayout>
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Lead not found.</p>
        // ✗ User sees generic message, doesn't understand why
        // ✗ No option to retry or go back
      </div>
    </DashboardLayout>
  );
}
```

**Better**:
```typescript
if (isError) {
  return (
    <DashboardLayout>
      <div className="p-6 text-center space-y-3">
        <p className="text-red-400">⚠️ Failed to load lead</p>
        <p className="text-sm text-muted-foreground">{error?.message}</p>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => refetch()}>Try Again</Button>
          <Button variant="outline" onClick={() => setLocation("/leads")}>Back</Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
```

### 🟡 Frontend Performance Issues

**Issue #7: No Skeleton Loading States**
```typescript
// While loading, entire page shows spinner
// Better: Load sections progressively with skeletons

// Skeleton structure:
<div className="space-y-4">
  <Skeleton className="h-12 w-40" /> {/* Name */}
  <Skeleton className="h-20 w-full" /> {/* Status selector */}
</div>
```

**Issue #8: No Optimistic Updates**
```typescript
const updateStatus = trpc.leads.updateStatus.useMutation({
  onSuccess: () => utils.leads.list.invalidate(),
});

// Problem: Click "Booked" → spinner → wait for server response
// Better: Update UI immediately
const updateStatus = trpc.leads.updateStatus.useMutation({
  onMutate: (variables) => {
    // Optimistically update lead status in UI
    setLead(old => ({ ...old, status: variables.status }));
  },
  onSuccess: () => {
    // Confirm from server
    utils.leads.list.invalidate();
  },
  onError: () => {
    // Revert if error
    refetch();
  },
});
```

---

## 4. PHONE NORMALIZATION & ENCRYPTION DEEP-DIVE

### ✅ Excellent Phone Handling

**File: shared/phone.ts**
```typescript
export function normalizePhoneE164(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(NON_DIGIT, "");
  const withCountry = trimmed.startsWith("+")
    ? `+${digits}`
    : digits.length === 10
      ? `+1${digits}`        // ← Assumes US if 10 digits
      : `+${digits}`;

  if (!/^\+[1-9]\d{7,14}$/.test(withCountry)) return null;
  return withCountry;  // ← E.164 format
}
```

**Strengths**:
- ✓ Handles "+1-555-0000", "5550000", "+15550000" all correctly
- ✓ E.164 format (international standard)
- ✓ Validates format before encryption
- ✓ Used in both server and client (shared code)

**But Issue #9: Country Code Assumption**
```typescript
digits.length === 10 ? `+1${digits}` : `+${digits}`

// Assumes all 10-digit numbers are US (+1)
// Problem: What if tenant is in Canada? UK? Australia?

// Should use tenant.timezone or ask user to specify country code
```

**Fix: Country-aware normalization**
```typescript
export function normalizePhoneE164(input: string, countryCode = "US"): string | null {
  const parseResult = parsePhoneNumberFromString(input, countryCode);
  if (!parseResult?.isValid()) return null;
  return parseResult.format("E.164");
}
```

### ✅ Encryption Strategy

**File: server/_core/crypto.ts**
```typescript
const ALGO = "aes-256-gcm";
export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;  // ← Dev mode: no encryption
  
  const iv = randomBytes(12);  // ← Random IV each time
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([...]);
  const authTag = cipher.getAuthTag();  // ← Auth tag prevents tampering
  
  return [iv, authTag, ciphertext].join(":");  // ← Format: "iv:tag:ciphertext"
}

export function decrypt(value: string): string {
  // Handles both encrypted and plaintext (backward compatible)
  const parts = value.split(":");
  if (parts.length !== 3) return value;  // ← Not encrypted
  
  // Decrypt and verify auth tag
}
```

**Strengths**:
- ✓ AES-256-GCM (strong, authenticated encryption)
- ✓ Random IV per message (prevents patterns)
- ✓ Auth tag (prevents tampering)
- ✓ Backward compatible (reads plaintext if not encrypted)
- ✓ Dev mode allows plaintext

### 🟡 Encryption Issues

**Issue #10: Phone Hash Not Used Consistently**
```typescript
// File: server/_core/inboundWebhook.ts
const encryptedFrom = encrypt(from);
const phoneHash = hashPhoneNumber(from);

const [existingLead] = await db
  .select()
  .from(leads)
  .where(and(
    eq(leads.tenantId, tenantId),
    eq(leads.phoneHash, phoneHash)  // ← Good: queries by hash
  ))
  .limit(1);
```

**But in lead.service.ts**:
```typescript
// Not shown, but likely queries by encrypted phone:
// WHERE phone = encrypt(...)

// Problem: Can't use indexes on encrypted fields
// Should query by phoneHash instead
```

**Issue #11: No Key Rotation Strategy**
```typescript
// Current: Single ENCRYPTION_KEY in env
// If compromised: ALL data exposed

// Fix: Support multiple keys
{
  keyVersion: 1,
  iv: "...",
  ciphertext: "...",
  authTag: "..."
}

// Then decrypt with any key version
// Rotate quarterly by:
// 1. Generate new key
// 2. Re-encrypt all data with new key
// 3. Deprecate old key
```

**Issue #12: Encryption Key in Environment Variable**
```
ENV file on shared hosting:
ENCRYPTION_KEY=abc123...

Problem: If .env is exposed, all PII compromised
Better: Use vault (AWS Secrets Manager, etc.)
Or: Use cPanel/hosting's secure environment variables
```

---

## 5. EVENT SYSTEM ARCHITECTURE

### ✅ Good Design

**File: server/services/eventBus.ts**
```typescript
const processedEvents = new Set<string>();

export async function emitEvent(event: EventPayload) {
  if (event.id && processedEvents.has(event.id)) {
    console.log("[EventBus] Duplicate event ignored:", event.id);
    return;  // ← Deduplication!
  }

  if (event.id) {
    processedEvents.add(event.id);
    setTimeout(() => processedEvents.delete(event.id!), 5 * 60_000);  // ← 5min TTL
  }

  await runAutomationsForEvent(event);
}
```

**Strengths**:
- ✓ In-memory deduplication
- ✓ 5-minute window for replays
- ✓ Prevents double-firing automations

### 🔴 Critical Issues

**Issue #13: Deduplication Lost on Process Restart**
```typescript
// If app crashes and restarts:
// - processedEvents Set is cleared
// - Event replay from queue → processed twice

// Scenario:
// 1. Event arrives: "lead.created"
// 2. Add to Set, emit event
// 3. App crashes
// 4. Queue re-delivers event (3x delivery guarantee)
// 5. App starts, Set is empty
// 6. Event fired twice

// Fix: Use database for deduplication
const existing = await db.select().from(processedEvents)
  .where(eq(processedEvents.id, event.id));
if (existing.length > 0) return;

await db.insert(processedEvents).values({ id: event.id, ... });
```

**Issue #14: Event Payload Not Validated**
```typescript
// File: server/routers.ts
webhooks.receive: publicProcedure
  .input(z.object({
    event: z.enum([...]),
    data: z.record(z.string(), z.any()),  // ← Any JSON allowed
  }))

// Problem: data can contain anything
// { event: "lead.created", data: { injection: "SELECT * FROM users" } }

// Fix: Validate event.data schema based on event type
```

---

## 6. INBOUND WEBHOOK SECURITY DEEP-DIVE

### ✅ Excellent Implementations

**File: server/_core/inboundWebhook.ts**
```typescript
// ✓ Telnyx Ed25519 signature verification
function verifyTelnyxSignature(req: Request): boolean {
  const publicKey = process.env.TELNYX_PUBLIC_KEY;
  const signature = req.headers["telnyx-signature-ed25519"];
  const timestamp = req.headers["telnyx-timestamp"];
  
  // ✓ Replay protection (300s window)
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;
}

// ✓ Twilio SHA1 HMAC verification
function verifyTwilioSignature(req: Request): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioSignature = req.headers["x-twilio-signature"];
  // ✓ Computes HMAC and compares safely
  return timingSafeEqual(...);
}

// ✓ STOP keyword compliance
const STOP_KEYWORDS = new Set(["stop", "unsubscribe", "quit", "cancel"]);
if (STOP_KEYWORDS.has(bodyNorm)) {
  await db.update(leads).set({ status: "unsubscribed", ... });
}
```

### 🟡 Issues

**Issue #15: Inbound SMS Creates Leads Automatically**
```typescript
if (!lead) {
  await db.insert(leads).values({
    tenantId,
    phone: encryptedFrom,
    phoneHash,
    status: "new",  // ← New lead created
    lastInboundAt: new Date(),
  });
}
```

**Problems**:
- ✗ Spam SMS creates leads in system
- ✗ No way to prevent (SMTP backend doesn't screen)
- ✗ Leads to data bloat

**Fix**:
```typescript
// Option A: Only process SMS from known leads
if (!existingLead) {
  logger.info("Inbound SMS from unknown number, ignoring", { from });
  return;  // Don't create new lead
}

// Option B: Filter by tenant's inbound number rules
if (!lead && !tenant.allowNewLeadsSMS) {
  return;  // Ignore if tenant doesn't allow it
}
```

**Issue #16: STOP Compliance Incomplete**
```typescript
// Current:
if (STOP_KEYWORDS.has(bodyNorm)) {
  await db.update(leads).set({ status: "unsubscribed", ... });
}

// TCPA requires:
// ✗ Acknowledge STOP immediately ("You have been unsubscribed")
// ✗ Log all STOP requests
// ✗ Never send again (even if lead restarts?)

// Fix:
if (STOP_KEYWORDS.has(bodyNorm)) {
  await db.update(leads).set({ status: "unsubscribed", ... });
  
  // Send acknowledgment
  await sendSMS(from, "You have been unsubscribed. Reply START to resubscribe.");
  
  // Audit log
  await db.insert(stopRequests).values({
    leadId: lead.id,
    timestamp: new Date(),
  });
}
```

---

## 7. RATE LIMITING & QUOTAS

### 🔴 Critical Rate Limiting Issues

**Issue #17: SMS Rate Limit Only Per-Minute**
```typescript
// File: server/_core/sms.ts
const rateLimitMap: Record<number, RateLimitEntry> = {};
const RATE_LIMIT_MAX = 60;  // 60 SMS/minute per tenant

// Problem: No daily/monthly quota
// Attacker can send 60 SMS/min × 60 min = 3600 SMS/hour
// = 86K SMS/day = 2.6M SMS/month

// Fix: Add quota levels
const QUOTAS = {
  free: { perMinute: 10, perDay: 100, perMonth: 1000 },
  starter: { perMinute: 60, perDay: 1000, perMonth: 50000 },
  pro: { perMinute: 200, perDay: 5000, perMonth: 500000 },
};

async function checkRateLimit(tenantId: number, plan: Plan): Promise<boolean> {
  // Check per-minute rate
  const minuteUsage = await db.select(...).where(...).limit(1);
  if (minuteUsage > plan.perMinute) return false;
  
  // Check daily rate
  const dayUsage = await db.select(...).where(...).limit(1);
  if (dayUsage > plan.perDay) return false;
  
  // Check monthly rate
  const monthUsage = await db.select(...).where(...).limit(1);
  if (monthUsage > plan.perMonth) return false;
  
  return true;
}
```

---

## 8. AUTOMATION RUNNER DEEP-DIVE

### ✅ Missing Info

**File: server/services/automationRunner.ts** (not shown in audit)
This file is **critical** but wasn't reviewed. Key questions:
- How are triggers matched to events?
- How are conditions evaluated?
- How are actions executed?
- What happens on error?

**Issue #18: Automation Type Safety Missing**
```typescript
// File: server/routers.ts
activateTemplate: tenantProcedure
  .input(z.object({ templateKey: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const template = automationTemplates.find(t => t.key === input.templateKey);
    if (!template) throw new TRPCError({ code: "NOT_FOUND" });
    
    const triggerMapping: Record<string, string> = {
      "lead.created": "new_lead",
      "appointment.booked": "appointment_reminder",
      // ← Magic string mapping, no validation
    };
    
    await AutomationService.upsertAutomationByKey(ctx.db, ctx.tenantId, template.key, {
      triggerType: triggerMapping[template.trigger] as any || "custom",  // ← Fallback to custom
      // Problem: If template.trigger not in mapping → silently creates custom automation
    });
  }),
```

---

## 9. CORS & CROSS-ORIGIN REQUEST HANDLING

### 🔴 Critical: CORS Configuration Missing

**Issue #19: No CORS Headers Configured**
```typescript
// File: server/_core/index.ts
app.use(express.json(...));
app.use(express.urlencoded(...));
// ✗ No CORS middleware
// ✗ Browser will block cross-origin requests

// If frontend is on domain1.com and API is on domain2.com:
// Browser blocks all requests

// Fix:
import cors from "cors";
app.use(cors({
  origin: process.env.APP_URL,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type"],
}));
```

---

## 10. ASYNC LOCAL STORAGE FOR REQUEST CONTEXT

### ✅ Good Pattern

**File: server/_core/requestContext.ts**
```typescript
import { AsyncLocalStorage } from "async_hooks";

const storage = new AsyncLocalStorage<RequestContextValue>();

export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  return storage.run({ correlationId }, fn);
}

export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}
```

**Usage in logger**:
```typescript
// Every log automatically includes correlationId
logger.info("SMS sent", { to, provider });
// Output: { ts: "...", level: "info", message: "SMS sent", correlationId: "uuid", to, provider }
```

**Strengths**:
- ✓ No need to pass correlationId through function calls
- ✓ Automatic context propagation
- ✓ Perfect for distributed tracing

**Issue #20: Correlation ID Not Used in All Logs**
```typescript
// Added in logger ✓
// But not threaded through:
// ✗ Worker logs don't have correlationId
// ✗ Webhook logs don't have correlationId
// ✗ System error logs don't have correlationId

// Fix: Add correlation ID middleware
app.use((req, res, next) => {
  const correlationId = req.headers["x-correlation-id"] || uuid();
  runWithCorrelationId(correlationId, () => next());
});
```

---

## 11. CRITICAL MISSING IMPLEMENTATIONS

### 🔴 Issue #21: API Key Authentication Not Implemented in Procedures

```typescript
// File: server/routers.ts
// Missing: No way to call API with API key (only session cookies)

// Should have:
apiProcedure = router({
  authenticate: async (opts) => {
    const authHeader = opts.req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    
    const token = authHeader.slice(7);
    const apiKey = await AuthService.getApiKeyByToken(db, token);
    
    return { ...opts, apiKey };
  },
});
```

### 🔴 Issue #22: No Input Sanitization on SMS Body

```typescript
// File: server/routers.ts
sendMessage: tenantProcedure
  .input(sendMessageSchema)
  .mutation(async ({ ctx, input }) => {
    let finalBody = input.body;
    // ✗ No sanitization
    // ✗ Could contain control characters, very long, etc.
```

**Fix**:
```typescript
.input(z.object({
  body: z.string()
    .min(1, "Message required")
    .max(160, "SMS must be ≤160 characters")
    .regex(/^[\w\s\-.,!?'"&()\n]*$/, "Invalid characters")
    .trim(),
}))
```

### 🔴 Issue #23: No Request Timeout Protection

```typescript
// If client sends request but disconnects:
// ✗ Server continues processing
// ✗ Wastes resources

// Fix: Add timeout middleware
app.use((req, res, next) => {
  req.setTimeout(30_000);  // 30s timeout
  res.setTimeout(30_000);
  next();
});
```

---

## 12. DATABASE TRANSACTION HANDLING

### 🔴 Issue #24: No Transactions for Multi-Step Operations

```typescript
// File: server/services/lead.service.ts
export async function sendMessage(...) {
  const [lead] = await db.select().from(leads)...;
  const res = await sendSMS(...);
  
  await createMessage(db, {  // ← Separate insert
    tenantId,
    leadId,
    body,
    status: res.success ? "sent" : "failed",
  });
}

// Problem:
// 1. SMS sends successfully
// 2. Database insert fails
// 3. Message sent but not logged in DB

// Fix: Use transaction
await db.transaction(async (trx) => {
  const res = await sendSMS(...);
  if (!res.success) throw new Error("SMS failed");
  
  await trx.insert(messages).values({...});
  // If this fails, SMS also rolls back... wait, SMS is already sent
  // Still broken!
});

// Better fix: Idempotent operations
// 1. Insert message record FIRST with status="queued"
// 2. Send SMS
// 3. Update message record with status="sent" or "failed"
```

---

## 13. COOKIE SECURITY ANALYSIS

### ✅ Good Cookie Handling

**File: server/_core/cookies.ts**
```typescript
export function getSessionCookieOptions(req?: Request) {
  const secure = isSecureRequest(req);
  
  return {
    httpOnly: true,        // ✓ No JavaScript access
    path: "/",             // ✓ Site-wide
    sameSite: secure ? "none" : "lax",  // ✓ Cross-site protection
    secure,                // ✓ HTTPS only
  };
}

function isSecureRequest(req?: Request) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  // ✓ Checks X-Forwarded-Proto (for reverse proxies)
}
```

**Strengths**:
- ✓ HttpOnly prevents XSS
- ✓ Secure flag prevents man-in-the-middle
- ✓ SameSite prevents CSRF
- ✓ Handles reverse proxy case

### 🟡 Issues

**Issue #25: Cookie Domain Not Set**
```typescript
// Missing: domain option
// On shared hosting with subdomains:
// api.rebookd.org vs app.rebookd.org
// Cookie won't be shared between subdomains without domain: ".rebookd.org"

// Fix:
return {
  httpOnly: true,
  path: "/",
  domain: process.env.COOKIE_DOMAIN,  // ".rebookd.org"
  sameSite: secure ? "none" : "lax",
  secure,
};
```

---

## 14. SHARED HOSTING SPECIFIC ISSUES

### 🔴 SSL Certificate Management

**Current State**: "Secure Socket Layer: ON"

**Issue #26: SSL Certificate Auto-Renewal**
```
If using shared hosting's default SSL:
- Auto-renews (usually)
- But check cPanel/WHM settings
- Some hosts require manual renewal

Fix: Verify settings in cPanel → SSL/TLS
```

### 🔴 Issue #27: Background Job Execution on Shared Hosting

```bash
Current: Docker worker service
Shared hosting: No Docker support

Options:
1. PHP Cron (run Node via exec)
   */1 * * * * /usr/bin/node /home/rebooked/app/worker.js

2. Node via SSH (tmux session)
   ssh user@host
   nohup npm run worker &

3. PM2 process manager
   npm install -g pm2
   pm2 start app.js
   pm2 startup
   pm2 save

Recommendation: Use PM2 (production-grade)
```

### 🟡 Issue #28: FTP Upload Size Limit

```
FTP account: 1 account
Problem: Can't upload 500MB+ app files via FTP

Solution:
1. SSH + git clone (faster, no file size limit)
   git clone https://github.com/yourorg/rebookd2.git

2. Use GitHub Actions to deploy
   - Build on CI
   - Deploy to shared host via rsync
```

---

## 15. PRODUCTION READINESS CHECKLIST

### For Shared Hosting Deployment

- [ ] **Refactor Docker → PM2**: Remove docker-compose, use PM2 for process management
- [ ] **Use Shared Hosting MySQL**: Point DATABASE_URL to cPanel MySQL
- [ ] **Configure Email**: Use mail.rebooked.org SMTP instead of SendGrid
- [ ] **SSL Certificate**: Verify auto-renewal in cPanel
- [ ] **Set Up Cron Jobs**: 
  - */1 * * * * Node worker.js (run automations)
  - 0 */4 * * * cleanup.js (archive old logs, delete old messages)
- [ ] **Add CORS Middleware**: Enable cross-origin requests
- [ ] **Log Rotation**: Configure PM2 or logrotate to prevent disk fill
- [ ] **Database Backups**: cPanel → Backup Wizard (daily)
- [ ] **Monitor Disk Space**: Alert when >80% full
- [ ] **Set Request Timeouts**: 30s default, handle gracefully
- [ ] **Add Correlation IDs**: Thread through all logging
- [ ] **Secure Env Variables**: Use cPanel's env config, not .env in git
- [ ] **Add Transactions**: Multi-step operations (send SMS + log)
- [ ] **Implement Retries**: Failed SMS retries with backoff
- [ ] **API Key Auth**: Support token-based auth, not just cookies
- [ ] **Request Validation**: Sanitize all inputs (SMS body max length, etc.)
- [ ] **TCPA Compliance**: STOP acknowledgments, audit logs
- [ ] **Rate Limiting**: Per-minute, daily, monthly quotas

---

## 16. FINAL SCORING (Post-Review #2)

| Category | Previous | Current | Reason |
|----------|----------|---------|--------|
| **Architecture** | 8/10 | 7/10 | Docker unsuitable for shared hosting |
| **Deployment** | 5/10 | 3/10 | Shared hosting mismatch discovered |
| **Frontend UX** | 6/10 | 5/10 | Unbounded queries, polling issues |
| **Security** | 7/10 | 6/10 | Phone normalization, CORS missing |
| **Infrastructure** | 6/10 | 4/10 | 40GB disk fill risk, 5 DB limit |
| **Compliance** | 4/10 | 3/10 | TCPA incomplete, GDPR missing |
| **Scalability** | 5/10 | 3/10 | Shared hosting at 1K tenant limit |
| **DevOps** | 8/10 | 4/10 | Docker won't deploy on shared host |
| **TOTAL** | 49/80 | 35/80 | Major platform mismatch |

---

## 17. RECOMMENDATIONS FOR SHARED HOSTING

### IMMEDIATE (Before Any Production Use)

1. **Stop using Docker** — Refactor for shared hosting (PM2 + Node)
2. **Add CORS middleware** — Frontend can't communicate with API
3. **Fix SMS rate limiting** — Add daily/monthly quotas
4. **Secure env vars** — Move out of git, use cPanel config
5. **Add input validation** — Sanitize SMS body, validate phones
6. **Implement transactions** — Multi-step operations atomic

### WEEK 1

7. **Set up PM2 process management** — Replace Docker services
8. **Configure email** — Use shared hosting SMTP
9. **Add log rotation** — Prevent 40GB disk fill
10. **Set up database backups** — cPanel automated backups daily
11. **Implement request timeouts** — Prevent hung connections

### WEEK 2

12. **Add API key authentication** — Support non-cookie auth
13. **TCPA compliance** — STOP acknowledgments, audit logs
14. **Phone normalization** — Country-aware parsing
15. **Correlation IDs** — Thread through all logs
16. **Error handling** — Graceful degradation when services fail

### WEEK 3

17. **Optimize frontend queries** — Load single lead by ID, not 1000
18. **Smart polling** — Reduce message refetch to 30s when idle
19. **Encryption key rotation** — Support multiple key versions
20. **Performance monitoring** — Track API latency, error rates

---

## CONCLUSION: SHARED HOSTING IS A CONSTRAINT

**Your infrastructure**:
- ✓ Good: Unlimited bandwidth, SSL included, 40GB disk
- ✗ Bad: No Docker, limited to 5 databases, shared IP
- ⚠️ Risky: 40GB fills in ~1 month with logs

**Scalability at shared hosting**:
- **Up to 1000 tenants**: Viable with optimization
- **1000-5000 tenants**: Need to migrate to cloud (AWS, Heroku)
- **5000+ tenants**: Shared hosting impossible

**Action**: Deploy to shared hosting as MVP (~1K tenants), then plan cloud migration for scale.

