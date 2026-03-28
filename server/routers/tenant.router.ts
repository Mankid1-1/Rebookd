import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { phoneSchema } from "../../shared/schemas/leads";
import { eq, and, gte } from "drizzle-orm";
import { subscriptions, tenants, users, tenantInvitations } from "../../drizzle/schema";
import { sendEmail } from "../_core/email";
import { protectedProcedure, tenantProcedure, router } from "../_core/trpc";
import { randomUUID } from "crypto";
import * as TenantService from "../services/tenant.service";
import * as UserService from "../services/user.service";

export const tenantRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.user;
    if (!user.tenantId) return null; // Admin users without tenant see null
    const tenant = await TenantService.getTenantById(ctx.db, user.tenantId);
    if (!tenant) return null;
    // Merge settings JSON fields into the response for the Settings page
    const s = tenant.settings ?? {};
    return { ...tenant, email: s.email ?? null, phone: s.phone ?? null, website: s.website ?? null, address: s.address ?? null, city: s.city ?? null, stateRegion: s.stateRegion ?? null, zipCode: s.zipCode ?? null };
  }),

  update: tenantProcedure
    .input(z.object({
      name: z.string().optional(),
      timezone: z.string().optional(),
      industry: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
      phone: z.string().optional(),
      website: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      stateRegion: z.string().optional(),
      zipCode: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { email, phone, website, address, city, stateRegion, zipCode, ...coreFields } = input;
      const settingsFields: Record<string, string | undefined> = {};
      if (email !== undefined) settingsFields.email = email;
      if (phone !== undefined) settingsFields.phone = phone;
      if (website !== undefined) settingsFields.website = website;
      if (address !== undefined) settingsFields.address = address;
      if (city !== undefined) settingsFields.city = city;
      if (stateRegion !== undefined) settingsFields.stateRegion = stateRegion;
      if (zipCode !== undefined) settingsFields.zipCode = zipCode;
      await TenantService.updateTenant(ctx.db, ctx.tenantId, {
        ...coreFields,
        ...(Object.keys(settingsFields).length > 0 ? { settings: settingsFields } : {}),
      });
      return { success: true };
    }),

  subscription: tenantProcedure.query(async ({ ctx }) => {
    const sub = await TenantService.getSubscriptionByTenantId(ctx.db, ctx.tenantId);
    return { sub: sub ?? null };
  }),

  usage: tenantProcedure.query(async ({ ctx }) => {
    const usageData = await TenantService.getUsageByTenantId(ctx.db, ctx.tenantId);
    return usageData ?? { messagesSent: 0, automationsRun: 0, aiRewrites: 0, revenueRecovered: 0, createdAt: new Date() };
  }),

  planLimits: tenantProcedure.query(async ({ ctx }) => {
    return TenantService.getTenantPlanLimits(ctx.db, ctx.tenantId);
  }),

  phoneNumbers: tenantProcedure.query(async ({ ctx }) => TenantService.getPhoneNumbersByTenantId(ctx.db, ctx.tenantId)),

  addPhoneNumber: tenantProcedure
    .input(z.object({ number: phoneSchema, label: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await TenantService.addPhoneNumber(ctx.db, ctx.tenantId, { number: input.number, title: input.label });
      return { success: true };
    }),

  removePhoneNumber: tenantProcedure
    .input(z.object({ phoneNumberId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await TenantService.removePhoneNumber(ctx.db, ctx.tenantId, input.phoneNumberId);
      return { success: true };
    }),

  setDefaultPhoneNumber: tenantProcedure
    .input(z.object({ phoneNumberId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await TenantService.setDefaultPhoneNumber(ctx.db, ctx.tenantId, input.phoneNumberId);
      return { success: true };
    }),

  setInboundPhoneNumber: tenantProcedure
    .input(z.object({ phoneNumberId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await TenantService.setInboundPhoneNumber(ctx.db, ctx.tenantId, input.phoneNumberId);
      return { success: true };
    }),

  // ─── Feature Settings ───────────────────────────────────────────────

  settings: tenantProcedure.query(async ({ ctx }) => {
    return TenantService.getSettings(ctx.db, ctx.tenantId);
  }),

  updateNoShowRecoveryConfig: tenantProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(async ({ ctx, input }) => {
      await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "noShowRecovery", input);
      return { success: true };
    }),

  updateCancellationRecoveryConfig: tenantProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(async ({ ctx, input }) => {
      await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "cancellationRecovery", input);
      return { success: true };
    }),

  updateRetentionEngineConfig: tenantProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(async ({ ctx, input }) => {
      await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "retentionEngine", input);
      return { success: true };
    }),

  updateSmartSchedulingConfig: tenantProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(async ({ ctx, input }) => {
      await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "smartScheduling", input);
      return { success: true };
    }),

  updateBookingConversionConfig: tenantProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(async ({ ctx, input }) => {
      await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "bookingConversion", input);
      return { success: true };
    }),

  updateLeadCaptureConfig: tenantProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(async ({ ctx, input }) => {
      await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "leadCapture", input);
      return { success: true };
    }),

  updatePaymentEnforcementConfig: tenantProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(async ({ ctx, input }) => {
      await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "paymentEnforcement", input);
      return { success: true };
    }),

  updateAfterHoursConfig: tenantProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(async ({ ctx, input }) => {
      await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "afterHours", input);
      return { success: true };
    }),

  updateAdminAutomationConfig: tenantProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(async ({ ctx, input }) => {
      await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "adminAutomation", input);
      return { success: true };
    }),

  updateCalendarIntegrationConfig: tenantProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(async ({ ctx, input }) => {
      await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "calendarIntegration", input);
      return { success: true };
    }),

  updateWaitingListConfig: tenantProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(async ({ ctx, input }) => {
      await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "waitingList", input);
      return { success: true };
    }),

  updateReviewManagementConfig: tenantProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(async ({ ctx, input }) => {
      await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "reviewManagement", input);
      return { success: true };
    }),

  updateReschedulingConfig: tenantProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(async ({ ctx, input }) => {
      await TenantService.updateFeatureConfig(ctx.db, ctx.tenantId, "rescheduling", input);
      return { success: true };
    }),

  // ─── Team Management (flattened – tRPC v11 doesn't resolve nested routers) ───
  teamList: tenantProcedure.query(async ({ ctx }) => {
      const members = await ctx.db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          tenantRole: users.tenantRole,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.tenantId, ctx.tenantId));
      return members.map((m) => ({
        ...m,
        tenantRole: m.tenantRole ?? "owner",
      }));
  }),

  teamInvite: tenantProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ ctx, input }) => {
        // Only owners can invite
        const caller = await ctx.db.select({ tenantRole: users.tenantRole }).from(users).where(eq(users.id, ctx.user.id)).then((r) => r[0]);
        if (caller && caller.tenantRole === "employee") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only the account owner can invite team members" });
        }

        // Check seat limits
        const limits = await TenantService.getTenantPlanLimits(ctx.db, ctx.tenantId);
        const currentMembers = await ctx.db.select({ id: users.id }).from(users).where(eq(users.tenantId, ctx.tenantId));
        if (currentMembers.length >= limits.maxSeats) {
          throw new TRPCError({ code: "FORBIDDEN", message: `Your ${limits.planName} plan allows up to ${limits.maxSeats} team member(s). Upgrade to add more.` });
        }

        // Check if already a member of this tenant
        const existing = await ctx.db.select({ id: users.id }).from(users).where(and(eq(users.email, input.email), eq(users.tenantId, ctx.tenantId))).then((r) => r[0]);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "This user is already a team member" });
        }

        // Check for existing pending invitation
        const existingInvite = await ctx.db.select({ id: tenantInvitations.id }).from(tenantInvitations).where(and(eq(tenantInvitations.email, input.email), eq(tenantInvitations.tenantId, ctx.tenantId), gte(tenantInvitations.expiresAt, new Date()))).then((r) => r[0]);
        if (existingInvite) {
          throw new TRPCError({ code: "CONFLICT", message: "An invitation is already pending for this email" });
        }

        const token = randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await ctx.db.insert(tenantInvitations).values({
          tenantId: ctx.tenantId,
          email: input.email,
          role: "employee",
          token,
          expiresAt,
        });

        // Send invitation email
        const appUrl = process.env.APP_URL || "http://localhost:3000";
        const inviteUrl = `${appUrl}/login?invite=${encodeURIComponent(token)}`;
        const tenantData = await TenantService.getTenantById(ctx.db, ctx.tenantId);
        const businessName = tenantData?.name ?? "a business";

        await sendEmail({
          to: input.email,
          subject: `You've been invited to join ${businessName} on Rebooked`,
          text: `You've been invited to join ${businessName} as an employee on Rebooked. Click here to accept: ${inviteUrl}`,
          html: `<p>You've been invited to join <strong>${businessName}</strong> as an employee on Rebooked.</p><p><a href="${inviteUrl}">Accept Invitation</a></p><p>This invitation expires in 7 days.</p>`,
        });

        return { success: true };
  }),

  teamRemove: tenantProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
        // Only owners can remove
        const caller = await ctx.db.select({ tenantRole: users.tenantRole }).from(users).where(eq(users.id, ctx.user.id)).then((r) => r[0]);
        if (caller && caller.tenantRole === "employee") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only the account owner can remove team members" });
        }

        // Cannot remove yourself
        if (input.userId === ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot remove yourself from the team" });
        }

        // Verify the user belongs to this tenant
        const target = await ctx.db.select({ id: users.id, tenantId: users.tenantId }).from(users).where(eq(users.id, input.userId)).then((r) => r[0]);
        if (!target || target.tenantId !== ctx.tenantId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found in your team" });
        }

        await ctx.db.update(users).set({ tenantId: null, tenantRole: null }).where(eq(users.id, input.userId));
        return { success: true };
  }),

  teamPending: tenantProcedure.query(async ({ ctx }) => {
      const invitations = await ctx.db
        .select({
          id: tenantInvitations.id,
          email: tenantInvitations.email,
          role: tenantInvitations.role,
          expiresAt: tenantInvitations.expiresAt,
          createdAt: tenantInvitations.createdAt,
        })
        .from(tenantInvitations)
        .where(and(eq(tenantInvitations.tenantId, ctx.tenantId), gte(tenantInvitations.expiresAt, new Date())));
      return invitations;
  }),

  teamCancelInvite: tenantProcedure
      .input(z.object({ invitationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const caller = await ctx.db.select({ tenantRole: users.tenantRole }).from(users).where(eq(users.id, ctx.user.id)).then((r) => r[0]);
        if (caller && caller.tenantRole === "employee") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only the account owner can cancel invitations" });
        }

        await ctx.db.delete(tenantInvitations).where(and(eq(tenantInvitations.id, input.invitationId), eq(tenantInvitations.tenantId, ctx.tenantId)));
        return { success: true };
  }),

  teamResendInvite: tenantProcedure
      .input(z.object({ invitationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const caller = await ctx.db.select({ tenantRole: users.tenantRole }).from(users).where(eq(users.id, ctx.user.id)).then((r) => r[0]);
        if (caller && caller.tenantRole === "employee") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only the account owner can resend invitations" });
        }

        const invitation = await ctx.db.select().from(tenantInvitations).where(and(eq(tenantInvitations.id, input.invitationId), eq(tenantInvitations.tenantId, ctx.tenantId))).then((r) => r[0]);
        if (!invitation) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
        }

        // Extend expiration
        const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await ctx.db.update(tenantInvitations).set({ expiresAt: newExpiresAt }).where(eq(tenantInvitations.id, input.invitationId));

        const appUrl = process.env.APP_URL || "http://localhost:3000";
        const inviteUrl = `${appUrl}/login?invite=${encodeURIComponent(invitation.token)}`;
        const tenantData = await TenantService.getTenantById(ctx.db, ctx.tenantId);
        const businessName = tenantData?.name ?? "a business";

        await sendEmail({
          to: invitation.email,
          subject: `Reminder: You've been invited to join ${businessName} on Rebooked`,
          text: `You've been invited to join ${businessName} as an employee on Rebooked. Click here to accept: ${inviteUrl}`,
          html: `<p>Reminder: You've been invited to join <strong>${businessName}</strong> as an employee on Rebooked.</p><p><a href="${inviteUrl}">Accept Invitation</a></p><p>This invitation expires in 7 days.</p>`,
        });

        return { success: true };
  }),
});

export const onboardingRouter = router({
  setup: protectedProcedure.input(z.object({
    businessName: z.string().min(1),
    website: z.string().optional(),
    referralSource: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    timezone: z.string().optional(),
    industry: z.string().optional(),
    avgAppointmentValue: z.number().optional(),
    monthlyNoShows: z.number().optional(),
    monthlyCancellations: z.number().optional(),
    monthlyAppointments: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    // Check if user already has a tenant
    const existingUser = await UserService.getUserById(ctx.db, ctx.user.id);
    if (existingUser?.tenantId) {
      return { success: true, tenantId: existingUser.tenantId };
    }

    // Create slug from business name
    const slug = input.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) + "-" + Date.now().toString(36);

    // Create tenant
    const result = await ctx.db.insert(tenants).values({
      name: input.businessName,
      slug,
      timezone: input.timezone || "America/New_York",
      industry: input.industry || null,
      country: input.country || null,
      settings: {
        city: input.city || null,
        website: input.website || null,
        referralSource: input.referralSource || null,
        avgAppointmentValue: input.avgAppointmentValue || 100,
        monthlyNoShows: input.monthlyNoShows || 0,
        monthlyCancellations: input.monthlyCancellations || 0,
        monthlyAppointments: input.monthlyAppointments || 0,
      },
    });

    const tenantId = Number(result[0].insertId);

    // Assign tenant to user
    await ctx.db.update(users).set({ tenantId }).where(eq(users.id, ctx.user.id));

    // Create a trial subscription (30 days)
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);
    await ctx.db.insert(subscriptions).values({
      tenantId,
      planId: 1, // default plan
      status: "trialing",
      trialEndsAt: trialEnd,
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEnd,
    });

    return { success: true, tenantId };
  }),
});
