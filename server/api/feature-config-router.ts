import { z } from "zod";
import { tenantProcedure } from "../_core/trpc";
import * as FeatureConfigService from "../services/feature-config.service";

/**
 * tRPC router definition for per-tenant feature configuration.
 * Consumed as `featureConfig` in the appRouter.
 */
export const featureConfigRouter = {
  get: tenantProcedure
    .input(z.object({ feature: z.string().min(1).max(100) }))
    .query(async ({ input, ctx }) => {
      const config = await FeatureConfigService.getConfig(
        ctx.db,
        ctx.tenantId,
        input.feature,
      );
      return { config };
    }),

  save: tenantProcedure
    .input(
      z.object({
        feature: z.string().min(1).max(100),
        config: z.record(z.string(), z.unknown()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await FeatureConfigService.saveConfig(
        ctx.db,
        ctx.tenantId,
        input.feature,
        input.config as Record<string, unknown>,
      );
      return { success: true };
    }),
};
