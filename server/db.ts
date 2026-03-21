export async function createLead(data: {
  tenantId: number;
  phone: string;
  name?: string;
  email?: string;
  source?: string;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(leads).values(data);
  return { success: true };
}

export async function updateLeadStatus(tenantId: number, leadId: number, status: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(leads)
    .set({ status: status as any, updatedAt: new Date() })
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));
}

export async function updateLead(
  tenantId: number,
  leadId: number,
  data: { name?: string; email?: string; notes?: string; status?: string; appointmentAt?: Date | null }
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(leads)
    .set({ ...data, status: data.status as any, updatedAt: new Date() })
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function getMessagesByLeadId(tenantId: number, leadId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(messages)
    .where(and(eq(messages.leadId, leadId), eq(messages.tenantId, tenantId)))
    .orderBy(messages.createdAt);
}

export async function createMessage(data: {
  tenantId: number;
  leadId: number;
  direction: "inbound" | "outbound";
  body: string;
  fromNumber?: string;
  toNumber?: string;
  tone?: string;
  aiRewritten?: boolean;
  automationId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(messages).values({ ...data, status: "sent" });
  // Update lead lastMessageAt
  await db
    .update(leads)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(and(eq(leads.id, data.leadId), eq(leads.tenantId, data.tenantId)));
  // Increment usage counter for outbound messages
  if (data.direction === "outbound") {
    await db
      .update(usage)
      .set({ messagesSent: sql`${usage.messagesSent} + 1`, updatedAt: new Date() })
      .where(eq(usage.tenantId, data.tenantId));

    // Check usage thresholds and send email alert once per cycle
    const usageRow = await db.select().from(usage).where(eq(usage.tenantId, data.tenantId)).orderBy(desc(usage.id)).limit(1);
    const subscriptionRow = await db
      .select({ sub: subscriptions, plan: plans })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.tenantId, data.tenantId))
      .orderBy(desc(subscriptions.id))
      .limit(1);

    if (usageRow[0] && subscriptionRow[0]) {
      const currentUsage = usageRow[0].messagesSent;
      const cap = subscriptionRow[0].plan.maxMessages;
      if (cap > 0 && currentUsage >= Math.floor(cap * 0.8) && !usageRow[0].hasUsageAlerted) {
        const { sendEmail } = await import("./_core/email");
        const userEmail = await getPrimaryUserEmailByTenant(data.tenantId);
        if (userEmail) {
          await sendEmail({
            to: userEmail,
            subject: "Rebookd Alert: SMS usage at 80%",
            text: `Your Rebookd plan is using ${currentUsage} of ${cap} SMS this period. Please upgrade if you need more capacity.`,
          });
        }
        await db
          .update(usage)
          .set({ hasUsageAlerted: true, updatedAt: new Date() })
          .where(eq(usage.tenantId, data.tenantId));
      }
    }
  }
  return result;
}

export async function getRecentMessages(tenantId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ msg: messages, lead: leads })
    .from(messages)
    .innerJoin(leads, eq(messages.leadId, leads.id))
    .where(eq(messages.tenantId, tenantId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
}

// ─── Templates ────────────────────────────────────────────────────────────────

export async function getTemplatesByTenantId(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(templates).where(eq(templates.tenantId, tenantId)).orderBy(templates.name);
}

export async function getTemplateById(tenantId: number, templateId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, templateId), eq(templates.tenantId, tenantId)))
    .limit(1);
  return result[0];
}

export async function createTemplate(data: {
  tenantId: number;
  key: string;
  name: string;
  body: string;
  tone?: "friendly" | "professional" | "casual" | "urgent";
  category?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(templates).values(data);
  return { success: true };
}

export async function updateTemplate(
  tenantId: number,
  templateId: number,
  data: { name?: string; body?: string; tone?: "friendly" | "professional" | "casual" | "urgent" }
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(templates)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(templates.id, templateId), eq(templates.tenantId, tenantId)));
}

export async function deleteTemplate(tenantId: number, templateId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(templates).where(and(eq(templates.id, templateId), eq(templates.tenantId, tenantId)));
}

// ─── Automations ──────────────────────────────────────────────────────────────

export async function getAutomationsByTenantId(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(automations).where(eq(automations.tenantId, tenantId)).orderBy(desc(automations.createdAt));
}

export async function getAutomationById(tenantId: number, automationId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(automations)
    .where(and(eq(automations.id, automationId), eq(automations.tenantId, tenantId)))
    .limit(1);
  return result[0];
}

export async function getAutomationByKey(tenantId: number, key: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(automations)
    .where(and(eq(automations.tenantId, tenantId), eq(automations.key, key)))
    .limit(1);
  return result[0];
}

export async function upsertAutomationByKey(tenantId: number, key: string, data: {
  name?: string;
  category?: "follow_up" | "reactivation" | "appointment" | "welcome" | "custom";
  triggerType?: "new_lead" | "inbound_message" | "status_change" | "time_delay" | "appointment_reminder";
  triggerConfig?: Record<string, unknown>;
  conditions?: Array<Record<string, unknown>>;
  actions?: Array<Record<string, unknown>>;
  enabled?: boolean;
}) {
  const existing = await getAutomationByKey(tenantId, key);
  if (existing) {
    await updateAutomation(tenantId, existing.id, {
      name: data.name,
      category: data.category,
      triggerType: data.triggerType,
      triggerConfig: data.triggerConfig,
      conditions: data.conditions,
      actions: data.actions,
      enabled: data.enabled,
    });
    return existing;
  }

  const inserted = await createAutomation({
    tenantId,
    key,
    name: data.name ?? key,
    category: data.category ?? "custom",
    triggerType: data.triggerType ?? "new_lead",
    triggerConfig: data.triggerConfig ?? {},
    conditions: data.conditions ?? [],
    actions: data.actions ?? [],
    enabled: data.enabled ?? true,
  });
  return inserted;
}

export async function getAutomationsByTrigger(tenantId: number, triggerType: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(automations)
    .where(and(eq(automations.tenantId, tenantId), eq(automations.triggerType, triggerType), eq(automations.enabled, true)))
    .orderBy(desc(automations.createdAt));
}

export async function createAutomation(data: {
  tenantId: number;
  name: string;
  key: string;
  category: "follow_up" | "reactivation" | "appointment" | "welcome" | "custom";
  enabled?: boolean;
  triggerType: "new_lead" | "inbound_message" | "status_change" | "time_delay" | "appointment_reminder";
  triggerConfig?: Record<string, unknown>;
  conditions?: Array<Record<string, unknown>>;
  actions?: Array<Record<string, unknown>>;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(automations).values(data);
  return { success: true };
}

export async function updateAutomation(
  tenantId: number,
  automationId: number,
  data: {
    name?: string;
    enabled?: boolean;
    triggerType?: string;
    triggerConfig?: Record<string, unknown>;
    conditions?: Array<Record<string, unknown>>;
    actions?: Array<Record<string, unknown>>;
  }
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(automations)
    .set({ ...data, triggerType: data.triggerType as any, updatedAt: new Date() })
    .where(and(eq(automations.id, automationId), eq(automations.tenantId, tenantId)));
}

export async function toggleAutomation(tenantId: number, automationId: number, enabled: boolean) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(automations)
    .set({ enabled, updatedAt: new Date() })
    .where(and(eq(automations.id, automationId), eq(automations.tenantId, tenantId)));
}

export async function deleteAutomation(tenantId: number, automationId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(automations).where(and(eq(automations.id, automationId), eq(automations.tenantId, tenantId)));
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getDashboardMetrics(tenantId: number) {
  const db = await getDb();
  if (!db) return { leadCount: 0, messageCount: 0, automationCount: 0, bookedCount: 0 };

  const [leadCount, messageCount, automationCount, bookedCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(leads).where(eq(leads.tenantId, tenantId)),
    db.select({ count: sql<number>`count(*)` }).from(messages).where(eq(messages.tenantId, tenantId)),
    db.select({ count: sql<number>`count(*)` }).from(automations).where(and(eq(automations.tenantId, tenantId), eq(automations.enabled, true))),
    db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.tenantId, tenantId), eq(leads.status, "booked"))),
  ]);

  return {
    leadCount: Number(leadCount[0]?.count ?? 0),
    messageCount: Number(messageCount[0]?.count ?? 0),
    automationCount: Number(automationCount[0]?.count ?? 0),
    bookedCount: Number(bookedCount[0]?.count ?? 0),
  };
}

export async function getAutomationStats(tenantId: number) {
  const db = await getDb();
  if (!db) return { totalEnabled: 0, totalRuns: 0 };
  const rows = await db
    .select({ enabled: automations.enabled, runCount: automations.runCount })
    .from(automations)
    .where(eq(automations.tenantId, tenantId));
  return {
    totalEnabled: rows.filter((r) => r.enabled).length,
    totalRuns: rows.reduce((sum, r) => sum + (Number(r.runCount) || 0), 0),
  };
}

export async function getLeadStatusBreakdown(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({ status: leads.status, count: sql<number>`count(*)` })
    .from(leads)
    .where(eq(leads.tenantId, tenantId))
    .groupBy(leads.status);
  return result.map((r) => ({ status: r.status, count: Number(r.count) }));
}

export async function getMessageVolume(tenantId: number, days = 30) {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await db
    .select({
      date: sql<string>`DATE(createdAt)`,
      count: sql<number>`count(*)`,
      direction: messages.direction,
    })
    .from(messages)
    .where(and(eq(messages.tenantId, tenantId), sql`createdAt >= ${since}`))
    .groupBy(sql`DATE(createdAt)`, messages.direction)
    .orderBy(sql`DATE(createdAt)`);
  return result;
}

// ─── AI Message Logs ──────────────────────────────────────────────────────────

export async function getAiLogsByTenantId(tenantId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(aiMessageLogs)
    .where(eq(aiMessageLogs.tenantId, tenantId))
    .orderBy(desc(aiMessageLogs.createdAt))
    .limit(limit);
}

export async function createAiLog(data: {
  tenantId: number;
  leadId?: number;
  original: string;
  rewritten?: string;
  tone: string;
  success: boolean;
  error?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(aiMessageLogs).values(data);
}

// ─── System Error Logs ────────────────────────────────────────────────────────

export async function getSystemErrors(type?: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const conditions = type ? [eq(systemErrorLogs.type, type as any)] : [];
  return db
    .select()
    .from(systemErrorLogs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(systemErrorLogs.createdAt))
    .limit(limit);
}

export async function createSystemError(data: {
  type: "twilio" | "ai" | "automation" | "billing" | "webhook";
  message: string;
  detail?: string;
  tenantId?: number;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(systemErrorLogs).values(data);
}

// ─── Webhook Logs ─────────────────────────────────────────────────────────────

export async function getWebhookLogs(tenantId?: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const conditions = tenantId ? [eq(webhookLogs.tenantId, tenantId)] : [];
  return db
    .select()
    .from(webhookLogs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(webhookLogs.createdAt))
    .limit(limit);
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

export async function getApiKeysByTenantId(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(apiKeys).where(eq(apiKeys.tenantId, tenantId)).orderBy(desc(apiKeys.createdAt));
}

export async function createApiKey(tenantId: number, keyHash: string, keyPrefix: string, label?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(apiKeys).values({ tenantId, keyHash, keyPrefix, label });
  return { success: true };
}

export async function revokeApiKey(tenantId: number, keyId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(apiKeys).set({ active: false }).where(and(eq(apiKeys.id, keyId), eq(apiKeys.tenantId, tenantId)));
}

// ─── Premade Automation Upserts ────────────────────────────────────────────────

export const PREMADE_KEYS = [
  "appointment_reminder_24h","appointment_reminder_2h","appointment_confirmation",
  "no_show_follow_up","no_show_rebooking","cancellation_same_day","cancellation_rebooking",
  "post_appointment_feedback","post_appointment_upsell","win_back_30d","win_back_90d",
  "new_lead_welcome","lead_follow_up_3d","lead_follow_up_7d","birthday_promo","loyalty_milestone",
] as const;

export type PremadeKey = typeof PREMADE_KEYS[number];

const PREMADE_CATEGORIES: Record<PremadeKey, "follow_up" | "reactivation" | "appointment" | "welcome" | "custom"> = {
  appointment_reminder_24h: "appointment",
  appointment_reminder_2h: "appointment",
  appointment_confirmation: "appointment",
  no_show_follow_up: "custom",
  no_show_rebooking: "custom",
  cancellation_same_day: "custom",
  cancellation_rebooking: "custom",
  post_appointment_feedback: "follow_up",
  post_appointment_upsell: "follow_up",
  win_back_30d: "reactivation",
  win_back_90d: "reactivation",
  new_lead_welcome: "welcome",
  lead_follow_up_3d: "follow_up",
  lead_follow_up_7d: "follow_up",
  birthday_promo: "custom",
  loyalty_milestone: "custom",
};

function premadeName(key: PremadeKey): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

