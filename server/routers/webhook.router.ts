import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import { verifyInboundWebhookSignature } from "../_core/webhookSignature";
import { emitEvent } from "../services/event-bus.service";
import * as WebhookDedupService from "../services/webhook-dedup.service";

export const webhooksRouter = router({
  receive: publicProcedure
    .input(z.object({
      event: z.enum(["lead.created", "appointment.booked", "appointment.no_show", "appointment.cancelled", "message.received", "message.sent"]),
      data: z.record(z.string(), z.any()),
      tenantId: z.number(),
      userId: z.number().optional(),
      signature: z.string().optional(),
      /** Client-supplied key; duplicate deliveries return deduplicated: true */
      idempotencyKey: z.string().min(8).max(64).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const isProd = process.env.NODE_ENV === "production";
      const secret = ENV.webhookSecret?.trim();
      const allowUnsigned = !isProd && process.env.WEBHOOK_ALLOW_UNSIGNED === "true";

      if (!secret) {
        if (!allowUnsigned) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: isProd
              ? "WEBHOOK_SECRET is required in production"
              : "Set WEBHOOK_SECRET or WEBHOOK_ALLOW_UNSIGNED=true (development only)",
          });
        }
      } else {
        const sig =
          input.signature ??
          (ctx.req.headers["x-webhook-signature"] as string | undefined) ??
          "";
        if (!sig || !verifyInboundWebhookSignature(secret, input.event, input.data, input.tenantId, sig)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or missing webhook signature" });
        }
      }

      if (input.idempotencyKey) {
        if (!ctx.db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const first = await WebhookDedupService.tryClaimInboundWebhookDedup(ctx.db, input.tenantId, input.idempotencyKey);
        if (!first) return { success: true as const, deduplicated: true as const };
      }

      await emitEvent({ type: input.event, data: input.data, tenantId: input.tenantId, userId: input.userId, timestamp: new Date() });
      return { success: true as const };
    }),
});
