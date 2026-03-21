# 🎯 THIRD EXHAUSTIVE CRITIQUE — Rebookd v2
## Production-Grade Deep-Dive: Services, Authentication, Billing, and Critical Logic Flows

**Focus Areas**: Business logic, service layer architecture, auth flow security, billing integration, automation runner, webhook deduplication, data integrity

---

## 1. AUTHENTICATION FLOW ANALYSIS

### ✅ Strengths

**1.1 Dual Auth Method Support**
```typescript
// File: server/_core/oauth.ts
loginMethod: "local" | "oauth" | "password"

// ✓ Supports:
// 1. Local password-based auth
// 2. OAuth (external provider)
// 3. Backwards compatible with password field
```

**1.2 Rate Limiting on Auth Endpoints**
```typescript
// File: server/routers.ts
const authAttempts = new Map<string, { count: number; resetAt: number }>();

function checkAuthRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = authAttempts.get(key);
  if (!entry || entry.resetAt < now) {
    authAttempts.set(key, { count: 1, resetAt: now + 15 * 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;  // ← 10 attempts / 15 min
  entry.count += 1;
  return true;
}

// ✓ Per-email rate limiting
// ✓ 10 attempts per 15 minutes
// ✓ Prevents brute force
```

**1.3 Password Hashing with bcrypt**
```typescript
// signup:
const passwordHash = await bcrypt.hash(input.password, 10);

// login:
const valid = await bcrypt.compare(input.password, user.passwordHash);

// ✓ bcryptjs with 10 rounds (~100ms, good security)
// ✓ Timing-safe comparison
```

### 🔴 Critical Issues

**Issue #1: Authentication Rate Limiter Only In-Memory**
```typescript
// Problem: Same as SMS rate limiter
// If app restarts: attacker gets another 10 attempts

// Fix: Use database-backed rate limiting
await db.insert(authAttempts).values({
  email,
  attemptAt: new Date(),
  ipAddress: req.ip,
});

const recentAttempts = await db.select().from(authAttempts)
  .where(and(
    eq(authAttempts.email, email),
    gt(authAttempts.attemptAt, new Date(Date.now() - 15 * 60_000))
  ));

if (recentAttempts.length >= 10) {
  throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
}
```

**Issue #2: Signup Password Validation Too Weak**
```typescript
.input(z.object({
  email: z.string().email(),
  password: z.string().min(8)  // ← Only checks length
}))

// Problem: Allows weak passwords like "12345678"
// No uppercase, lowercase, digit, special char requirements

// Fix:
password: z.string()
  .min(12, "Password must be at least 12 characters")
  .refine(p => /[A-Z]/.test(p), "Must contain uppercase")
  .refine(p => /[a-z]/.test(p), "Must contain lowercase")
  .refine(p => /\d/.test(p), "Must contain a digit")
  .refine(p => /[!@#$%^&*]/.test(p), "Must contain special char")
```

**Issue #3: Session Token Stored as Plain Cookie**
```typescript
// signup/login:
ctx.res.cookie(COOKIE_NAME, user.openId, {
  httpOnly: true,
  secure: true,
  sameSite: "none"
});

// Problem: openId is used as session token directly
// Better: Create a signed JWT

// Fix:
import { jwtVerify, SignJWT } from "jose";

const token = await new SignJWT({ userId: user.id, openId: user.openId })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("24h")
  .sign(new TextEncoder().encode(process.env.JWT_SECRET));

ctx.res.cookie(COOKIE_NAME, token, {
  httpOnly: true,
  secure: true,
  sameSite: "none"
});
```

**Issue #4: Login Page Not Protected**
```typescript
// File: server/_core/oauth.ts
app.get("/login", (_req: Request, res: Response) => {
  res.send(loginPageHtml());
});

// Problem: Anyone can POST to /api/auth/signin or /api/auth/signup
// No CAPTCHA for signup
// Allows account enumeration

// Fix: Add CAPTCHA (hCaptcha or reCAPTCHA v3)
```

### 🟡 Medium Issues

**Issue #5: No Forgot Password Flow**
```typescript
// Current: "Contact your administrator"
// Better: Self-service password reset

// Implementation:
// 1. POST /api/auth/forgot-password { email }
// 2. Generate reset token, send email
// 3. POST /api/auth/reset-password { token, newPassword }
```

**Issue #6: No Email Verification**
```typescript
// signup automatically logs user in
// No email verification required

// Better: Send verification email, require click-to-activate
```

---

## 2. AUTHORIZATION & MULTI-TENANT ISOLATION

### ✅ Strengths

**2.1 Middleware-Based Authorization**
```typescript
// File: server/_core/trpc.ts
export const protectedProcedure = t.procedure.use(requireUser);
export const tenantProcedure = t.procedure.use(requireTenant);
export const adminProcedure = t.procedure.use(requireAdmin);

// ✓ Clean separation of concerns
// ✓ Authorization enforced at middleware
// ✓ Can't accidentally bypass
```

**2.2 Tenant Resolution in Middleware**
```typescript
const requireTenant = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const tenantId = await TenantService.getTenantId(ctx.db, ctx.user.id);
  return next({ ctx: { ...ctx, user: ctx.user, tenantId } });
});

// ✓ tenantId automatically resolved from user.tenantId
// ✓ Can't forge tenantId in request
// ✓ Every tenantProcedure has valid tenant
```

**2.3 All Queries Include Tenant Filter**
```typescript
// Example: leads.list
return LeadService.getLeads(ctx.db, ctx.tenantId, {...});

// Inside:
const conditions = [eq(leads.tenantId, tenantId)];

// ✓ Every query filters by tenantId
// ✓ Can't access other tenant's data
```

### 🔴 Critical Issues

**Issue #7: Admin User Can Access Any Tenant**
```typescript
// adminProcedure doesn't enforce tenantId
export const adminProcedure = t.procedure.use(requireAdmin);

// Problem: Admin queries don't filter by tenantId
// Admin can see all tenants' data

// This is intentional (admin role), but needs audit logging
// When admin reads tenant X's data, log it:
logger.info("admin_access", { adminId, tenantId, resource: "leads" });
```

**Issue #8: Cross-Tenant Lead Access Possible?**
```typescript
// If user manually changes leadId in request:
// GET /api/leads.get?leadId=9999

// Inside:
const lead = await LeadService.getLeadById(ctx.db, ctx.tenantId, input.leadId);
if (!lead) throw new TRPCError({ code: "NOT_FOUND" });

// ✓ Query includes tenantId filter
// ✓ Wrong tenant → lead returns null → 404
// ✓ Secure by design
```

**Issue #9: API Keys Don't Have Scope Limiting**
```typescript
// File: server/routers.ts
apiKeys: router({
  create: tenantProcedure
    .input(z.object({ label: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const key = `rk_${randomUUID().replace(/-/g, "")}`;
      const keyHash = await bcrypt.hash(key, 10);
      await AuthService.createApiKey(ctx.db, ctx.tenantId, keyHash, key.slice(0, 7), input.label);
      return { key };
    }),
});

// Problem:
// ✗ No scope limiting (e.g., "read-only", "send-sms-only")
// ✗ API key has full access to tenant's data
// ✗ If leaked, attacker has full tenant access

// Fix: Add scopes
createApiKey(db, tenantId, keyHash, scopes: ["leads:read", "leads:write", "messages:send"]);

// Then in middleware:
if (!apiKey.scopes.includes("messages:send")) {
  throw new TRPCError({ code: "FORBIDDEN", message: "This key can't send messages" });
}
```

---

## 3. BILLING & USAGE TRACKING

### ✅ Strengths

**3.1 Atomic Usage Increment**
```typescript
// File: server/services/usage.service.ts
export async function incrementOutboundUsageIfAllowed(db: Db, tenantId: number): Promise<boolean> {
  const state = await getTenantUsageState(db, tenantId);
  const cap = state.plan?.maxMessages ?? 0;
  const usageRow = state.usage;

  if (cap === 0) {
    // Unlimited plan
    await db
      .update(usage)
      .set({ messagesSent: sql`${usage.messagesSent} + 1`, updatedAt: new Date() })
      .where(eq(usage.id, usageRow.id));
    return true;
  }

  // Capped plan: only increment if under cap
  const result = await db.execute(sql`
    UPDATE usage u
    INNER JOIN subscriptions s ON s.tenantId = u.tenantId AND s.status = 'active'
    INNER JOIN plans p ON p.id = s.planId
    SET u.messagesSent = u.messagesSent + 1, u.updatedAt = NOW()
    WHERE u.id = ${usageRow.id} AND u.tenantId = ${tenantId} AND u.messagesSent < p.maxMessages
  `);

  return (header?.affectedRows ?? 0) > 0;
}

// ✓ Single SQL statement prevents race conditions
// ✓ Checks cap atomically during update
// ✓ Won't increment if already at cap
// ✓ Returns boolean indicating success
```

**3.2 Plan-Based Limits**
```typescript
// schema: plans.maxMessages
// Free: 100/month
// Starter: 5000/month
// Pro: unlimited

// ✓ Different plans, different limits
// ✓ Enforced at usage increment
```

### 🔴 Critical Issues

**Issue #10: Usage Period Not Defined**
```typescript
// File: drizzle/schema.ts
usage: mysqlTable("usage", {
  tenantId: int("tenantId").notNull(),
  messagesSent: int("messagesSent").default(0).notNull(),
  periodStart: timestamp("periodStart"),
  periodEnd: timestamp("periodEnd"),
  // ✗ When is usage reset?
  // ✗ Monthly? At subscription renewal?
  // ✗ How to handle mid-month upgrades?
});
```

**Problem Scenario**:
```
1. Jan 1: User on Free plan (100 SMS/month)
2. Jan 15: User upgrades to Pro plan (unlimited)
3. Usage row from Jan 1 has 50 SMS used
4. Do they get 50 more SMS in Jan? Or unlimited immediately?
```

**Fix**:
```typescript
// When subscription changes, create new usage row
async function createUsageForSubscription(db: Db, subscription: Subscription) {
  const now = new Date();
  const periodStart = now;
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  await db.insert(usage).values({
    tenantId: subscription.tenantId,
    messagesSent: 0,
    periodStart,
    periodEnd,
  });
}
```

**Issue #11: No Billing Invoice Tracking**
```typescript
// Current: Stripe handles everything
// Missing: Local invoice records

// Problem:
// ✗ Can't generate PDF invoices from Rebookd
// ✗ Customer can't access invoice history in app
// ✗ Stripe API only source of truth

// Fix: Create invoices table
invoices: mysqlTable("invoices", {
  id: int("id").primaryKey().autoIncrement(),
  tenantId: int("tenantId").notNull(),
  stripeInvoiceId: varchar("stripeInvoiceId", { length: 100 }),
  amount: int("amount"),  // cents
  currency: varchar("currency", { length: 3 }),
  status: mysqlEnum("status", ["draft", "open", "paid", "uncollectible", "void"]),
  createdAt: timestamp("createdAt").defaultNow(),
  pdfUrl: varchar("pdfUrl", { length: 500 }),
});

// Then in Stripe webhook handler:
case "invoice.paid":
  await db.insert(invoices).values({
    tenantId,
    stripeInvoiceId: invoice.id,
    amount: invoice.amount_paid,
    currency: invoice.currency,
    status: "paid",
    pdfUrl: invoice.hosted_invoice_url,
  });
```

**Issue #12: Trial Enforcement Missing**
```typescript
// Current: Trial status tracked, but not enforced
// After trial ends:
// ✗ Automations still fire
// ✗ SMS still sent
// ✗ No enforcement until subscription status checked

// Fix: Check subscription status before critical operations
async function assertSubscriptionActive(db: Db, tenantId: number) {
  const sub = await getSubscriptionByTenantId(db, tenantId);
  if (!sub || (sub.status !== "active" && sub.status !== "trialing")) {
    throw new TRPCError({ code: "PAYMENT_REQUIRED", message: "Subscription inactive" });
  }
}

// Then in sendMessage, runAutomation, etc.:
await assertSubscriptionActive(db, tenantId);
```

**Issue #13: No Refund or Downgrade Handling**
```typescript
// If tenant downgrades mid-cycle:
// Plan A: $100/month (unlimited SMS)
// Day 15: Downgrade to Plan B: $50/month (1000 SMS)
// Already sent 800 SMS

// Current:
// ✗ No refund calculated
// ✗ No proration
// ✗ New plan still enforces 1000 SMS cap (race condition if at 800)

// Fix: Update usage period and recalculate
```

---

## 4. AUTOMATION RUNNER DEEP-DIVE

### ✅ Excellent Implementation

**4.1 Step-Based Execution**
```typescript
// File: server/services/automationRunner.ts
async function runStep(db: Db, step: any, event: EventPayload, tenantId: number, leadId?: number) {
  switch (step.type) {
    case "delay": {...}
    case "sms": {...}
    case "webhook": {...}
  }
}

// ✓ Supports multiple step types
// ✓ Extensible for new step types
// ✓ Each step is isolated
```

**4.2 Event-to-Trigger Mapping**
```typescript
function eventToTriggerTypes(eventType: EventPayload["type"]): string[] {
  return (
    ({
      "lead.created": ["new_lead"],
      "message.received": ["inbound_message"],
      "appointment.booked": ["appointment_reminder"],
      // ...
    } as Record<string, string[]>)[eventType] ?? []
  );
}

// ✓ Clear mapping
// ✓ One event can trigger multiple automations
// ✓ Easy to add new triggers
```

**4.3 Retry with Exponential Backoff**
```typescript
async function sendWithRetry(
  to: string,
  body: string,
  fromNumber: string | undefined,
  tenantId: number,
  attempt = 1,
): Promise<SMSResult> {
  const res = await sendSMS(to, body, fromNumber, tenantId);
  if (res.success) return res;
  
  if (attempt < MAX_RETRY) {
    await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
    return sendWithRetry(..., attempt + 1);
  }
  return res;
}

// ✓ Max 3 attempts (1s, 2s, 4s delays)
// ✓ Exponential backoff prevents thundering herd
```

### 🔴 Critical Issues

**Issue #14: Synchronous Step Execution Blocks**
```typescript
// Current:
for (const step of steps) {
  await runStep(...);  // ← Waits for each step sequentially
}

// Problem: If step 1 is a delay(60s):
// Step 1 waits 60 seconds
// Step 2 doesn't start until then
// Event loop blocked for 1 minute

// Fix: Use job queue (Bull, BullMQ, RabbitMQ)
// Queue steps asynchronously:
for (const step of steps) {
  queue.add("runStep", { step, event, tenantId, leadId });
}

// Then worker processes queue
queue.process("runStep", async (job) => {
  await runStep(...);
});
```

**Issue #15: No Error Handling Per Step**
```typescript
// Current:
try {
  const steps = automation.actions || [];
  for (const step of steps) {
    await runStep(...);  // ← If step fails, entire automation stops
  }
} catch (error) {
  // Log error, increment errorCount
}

// Problem:
// If step 1 succeeds, step 2 fails:
// ✗ Step 3 never runs
// ✗ Partial automation execution

// Fix: Continue on error
for (const step of steps) {
  try {
    await runStep(...);
  } catch (error) {
    logger.error(`Step ${step.type} failed`, { error, leadId, automationId: automation.id });
    // Continue to next step? Or stop?
    // Depends on business logic
  }
}
```

**Issue #16: No Idempotency on Automation Execution**
```typescript
// Problem:
// 1. Event fires: "lead.created"
// 2. Automation runner processes event
// 3. Runner crashes mid-execution
// 4. Event queue re-delivers event
// 5. Automation runs again → duplicate SMS sent

// Current: EventBus has in-memory deduplication (5min TTL)
// But: Survives app restart?

// Fix: Database-backed deduplication
const dedup = await db.select().from(automationExecutions)
  .where(and(
    eq(automationExecutions.automationId, automation.id),
    eq(automationExecutions.eventId, event.id)  // Must have event.id
  ));

if (dedup.length > 0) {
  return;  // Already ran
}

await db.insert(automationExecutions).values({
  automationId: automation.id,
  eventId: event.id,
  status: "success",
  executedAt: new Date(),
});
```

**Issue #17: No Conditional Logic in Steps**
```typescript
// Current steps:
case "sms": {
  // Always sends SMS
}

// Missing: Conditional steps
// Example: "Send SMS ONLY if lead.status === 'contacted'"

// Fix: Add condition evaluation
case "sms": {
  if (step.conditions) {
    const conditionsMet = evaluateConditions(step.conditions, event.data);
    if (!conditionsMet) return { skipped: true };  // Skip this step
  }
  // Send SMS
}

function evaluateConditions(conditions: Condition[], data: any): boolean {
  return conditions.every(cond => {
    const value = data[cond.field];
    switch (cond.operator) {
      case "eq": return value === cond.value;
      case "gt": return value > cond.value;
      case "contains": return String(value).includes(cond.value);
    }
  });
}
```

---

## 5. WEBHOOK DEDUPLICATION

### ✅ Good Pattern

**5.1 Database-Backed Deduplication**
```typescript
// File: server/services/webhookDedup.service.ts (assumed)
export async function tryClaimInboundWebhookDedup(db: Db, tenantId: number, idempotencyKey: string) {
  // Try to insert dedup record
  // If already exists (unique constraint), return false
  // If insert succeeds, return true
  
  try {
    await db.insert(webhookDedup).values({
      tenantId,
      idempotencyKey,
      createdAt: new Date(),
    });
    return true;
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return false;  // Already processed
    }
    throw err;
  }
}

// ✓ Solves app restart issue
// ✓ Survives crashes
// ✓ Database is source of truth
```

### 🔴 Issues

**Issue #18: Dedup Records Never Cleaned Up**
```typescript
// webhookDedup table grows indefinitely
// After 1 year: millions of records
// Queries slow down

// Fix: Archive old records
async function cleanupOldWebhookDedups(db: Db, daysToKeep = 90) {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
  await db.delete(webhookDedup).where(lt(webhookDedup.createdAt, cutoff));
}

// Run nightly:
cron.schedule("0 2 * * *", () => cleanupOldWebhookDedups(db));
```

---

## 6. LEAD SEARCH PERFORMANCE

### 🔴 Critical Performance Issue

**Issue #19: Lead Search Loads All Leads Into Memory**
```typescript
// File: server/services/lead.service.ts
export async function getLeads(db: Db, tenantId: number, opts?: {...}) {
  const search = opts?.search?.trim();
  
  if (search) {
    const all = await db.select().from(leads).where(baseWhere);  // ← All leads!
    let presented = all.map((lead) => presentLead(lead));
    const q = search.toLowerCase();
    presented = presented.filter((l) => {
      // Filter in JavaScript
    });
    const total = presented.length;
    return { leads: presented.slice(offset, offset + limit), total };
  }
  // ... paginated query for non-search
}

// Problem:
// 10K leads × 500 bytes per lead = 5MB in memory
// With 100 concurrent users: 500MB RAM
// With 1000 concurrent users: 5GB RAM → OOM

// With 100K leads: Can't even load into memory
```

**Fix**:
```typescript
// Use database-level search
if (search) {
  const likePattern = `%${search}%`;
  const results = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.tenantId, tenantId),
      or(
        sql`${leads.name} LIKE ${likePattern}`,
        sql`${leads.phone} LIKE ${likePattern}`,
        sql`${leads.email} LIKE ${likePattern}`
      )
    ))
    .orderBy(desc(leads.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(and(
      eq(leads.tenantId, tenantId),
      or(
        sql`${leads.name} LIKE ${likePattern}`,
        sql`${leads.phone} LIKE ${likePattern}`,
        sql`${leads.email} LIKE ${likePattern}`
      )
    ));

  return { leads: results.map(presentLead), total: count };
}
```

---

## 7. SEND MESSAGE FLOW

### ✅ Strengths

**7.1 Idempotency on Send**
```typescript
export async function sendMessage(db: Db, tenantId: number, leadId: number, body: string, idempotencyKey?: string) {
  if (idempotencyKey) {
    const [existing] = await db.select().from(messages)
      .where(and(eq(messages.tenantId, tenantId), eq(messages.idempotencyKey, idempotencyKey)))
      .limit(1);
    if (existing) {
      return {
        success: existing.status !== "failed",
        sid: existing.twilioSid || undefined,
        deduplicated: true,
      };
    }
  }
  // ... send SMS
}

// ✓ Duplicate requests return cached result
// ✓ Safe to retry
```

**7.2 Transaction on Message Creation**
```typescript
export async function createMessage(db: Db, data: {...}) {
  return db.transaction(async (tx) => {
    const result = await tx.insert(messages).values({...});
    await tx.update(leads).set({ lastMessageAt: new Date(), ... });
    
    if (data.direction === "outbound" && data.status !== "failed") {
      const incremented = await UsageService.incrementOutboundUsageIfAllowed(tx, data.tenantId);
    }
    return result;
  });
}

// ✓ All-or-nothing
// ✓ SMS + lead update + usage all succeed or all fail
```

### 🔴 Issues

**Issue #20: AI Rewrite Timeout Not Fully Handled**
```typescript
// File: server/routers.ts
let finalBody = input.body;
if (input.tone) {
  try {
    const result = await invokeLLM({...});
    const content = (result as any).choices?.[0]?.message?.content || "";
    finalBody = content.trim() || finalBody;
  } catch (err) {
    if (!isAppError(err)) {
      console.error("AI rewrite failed:", err);
    }
  }
}

// Problem:
// ✗ Timeout not set on fetch
// ✗ If LLM hangs 30s, request times out
// ✗ Message not sent

// Fix:
finalBody = input.body;
if (input.tone) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);  // 5s
    
    const result = await invokeLLM({...}, { signal: controller.signal });
    clearTimeout(timeout);
    
    const content = (result as any).choices?.[0]?.message?.content || "";
    finalBody = content.trim() || finalBody;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      logger.warn("LLM timeout, using original message");
    } else {
      console.error("AI rewrite failed:", err);
    }
  }
}
```

---

## 8. SERVICE LAYER QUALITY

### ✅ Good Patterns

**8.1 Consistent Query Pagination**
```typescript
// All list services include pagination
export async function getAllTenants(db: Db, page = 1, limit = 50) {
  const offset = (page - 1) * limit;
  const [rows, countRows] = await Promise.all([
    db.select().from(tenants).orderBy(desc(tenants.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(tenants),
  ]);
  return { rows, total: Number(countRows[0]?.count ?? 0) };
}

// ✓ Standard offset-based pagination
// ✓ Returns total count
// ✓ Efficient count with Promise.all()
```

**8.2 Presentation Layer Decryption**
```typescript
function presentLead<T extends Record<string, any>>(lead: T): T {
  if (!lead) return lead;
  return {
    ...lead,
    phone: lead.phone ? decrypt(lead.phone) : lead.phone,
    name: lead.name ? decrypt(lead.name) : lead.name,
    email: lead.email ? decrypt(lead.email) : lead.email,
  };
}

// ✓ Decryption happens at presentation layer
// ✓ Doesn't modify database records
// ✓ Always decrypts before returning to client
```

### 🔴 Issues

**Issue #21: Soft Delete Not Consistently Applied**
```typescript
// Schema includes deletedAt field
// But queries don't always filter by it

// Example: getAutomations() includes `isNull(automations.deletedAt)`
// But getAutomationById() does too

// Good! ✓

// BUT: What if developer forgets?
export async function getAllAutomations(db: Db) {
  return db.select().from(automations);  // ← Forgets deletedAt filter!
}

// Fix: Create helper function
function withoutDeleted<T extends { deletedAt: Date | null }>(query: Query<T>) {
  return query.where(isNull(deletedAt));
}

// Then:
export async function getAutomations(db: Db) {
  return withoutDeleted(db.select().from(automations));  // ← Automatic
}
```

---

## 9. FINAL COMPREHENSIVE SCORING

### By Category

| Category | Score | Status |
|----------|-------|--------|
| **Authentication** | 6/10 | Rate limiting in-memory, weak password validation |
| **Authorization** | 8/10 | Multi-tenant well-isolated, admin needs audit logging |
| **Billing** | 5/10 | Atomic usage increment good, no invoice tracking, no prorating |
| **Automation Engine** | 7/10 | Step-based good, but no conditional logic, sync blocking |
| **Lead Management** | 4/10 | Search loads all into memory (critical bug) |
| **Message Flow** | 7/10 | Idempotency good, LLM timeout risky |
| **Services** | 7/10 | Consistent patterns, soft delete needs enforcement |
| **Data Integrity** | 7/10 | Transactions used, but webhook dedup never cleaned |
| **Error Handling** | 6/10 | Structured logging, but partial automation failures |
| **OVERALL** | **6.4/10** | **Production-ready with caveats** |

---

## 10. CRITICAL FIXES REQUIRED

### Must Fix Before Production

1. **Database-backed auth rate limiting** (not in-memory)
2. **Fix lead search memory leak** (database-level filtering)
3. **Subscription status enforcement** (check before SMS/automation)
4. **Idempotent automation execution** (prevent re-runs on crash)
5. **API key scoping** (not full tenant access)
6. **Strong password validation** (uppercase, digits, special chars)
7. **Usage period definition** (when reset monthly, prorating)
8. **Webhook dedup cleanup** (archive old records)
9. **LLM timeout with signal** (prevent hangs)
10. **Admin audit logging** (track privileged access)

---

## 11. BUILD & DEPLOYMENT ANALYSIS

### ✅ Good Setup

**11.1 pnpm Package Manager**
```json
"packageManager": "pnpm@10.4.1+..."

// ✓ Deterministic lock file
// ✓ Faster than npm/yarn
// ✓ Less disk space
```

**11.2 esbuild for Fast Bundling**
```bash
"build": "esbuild server/_core/index.ts --bundle --format=esm"

// ✓ Fast compilation
// ✓ Small bundle size
// ✓ ESM format (modern)
```

**11.3 PM2 Config Mentioned**
```json
"pm2:start": "pm2 start ecosystem.config.cjs"

// ✓ Process manager included
// ✓ Suitable for shared hosting
```

### 🔴 Issues

**Issue #22: Build Script Complex**
```bash
"build": "
  vite build &&
  esbuild server/_core/index.ts ... &&
  esbuild server/worker.ts ...
"

// Problem: Multiple esbuild calls
// If first succeeds, second fails: partial build
// Hard to debug

// Fix: Use single esbuild config
// Or use tsup
```

**Issue #23: No Environment Config per Stage**
```json
"dev": "NODE_ENV=development ...",
"start": "NODE_ENV=production node dist/index.js"

// Missing intermediate (staging)
```

---

## 12. FINAL RECOMMENDATION

**Status**: 🟡 **READY FOR LIMITED PRODUCTION (1K tenants, <50K leads)**

**Before Launch**:
- [ ] Fix lead search memory leak
- [ ] Add database-backed rate limiting
- [ ] Enforce subscription status
- [ ] Add strong password validation
- [ ] Implement API key scoping
- [ ] Add admin audit logging

**After Launch (First 2 Weeks)**:
- [ ] Monitor database size (40GB limit)
- [ ] Monitor error rates (Sentry)
- [ ] Monitor API latency (p95, p99)
- [ ] Set up log rotation
- [ ] Set up database backups

**Post-MVP (1-3 Months)**:
- [ ] Migrate to cloud (AWS, etc.)
- [ ] Implement conditional automation steps
- [ ] Add invoice tracking
- [ ] Implement usage period prorating
- [ ] Add custom webhook endpoints

